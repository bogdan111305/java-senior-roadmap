/* ===================== KB VIEWER =====================
   Модалка для просмотра конспектов из kb/ прямо на сайте road map.
   Полностью статично: подгружает kb/manifest.json (см.
   tools/build-kb-manifest.py) и сами .md-файлы через fetch(), рендерит
   markdown через marked и Mermaid-диаграммы через mermaid.js — без
   какого-либо сервера. Открывается по клику на кнопку «Материалы» у темы
   road map, которую добавляет app.js для тех T(...), у которых передан
   пятый аргумент kb (topic_slug из kb/manifest.json).

   ВАЖНО про локальный запуск: открытие index.html напрямую по file://
   в Chrome блокирует fetch() локальных файлов (CORS для file://) — сайт
   нужно открывать через локальный сервер (например, расширение VS Code
   "Live Server", или `python -m http.server` из корня репозитория, или
   просто через реальный GitHub Pages после пуша). Firefox к file:// не
   так строг, но лучше не полагаться на это.
*/

const KB_FRONTMATTER_RE = /^---\s*\n[\s\S]*?\n---\s*\n/;

let kbManifestPromise = null;
let kbCurrentParentSlug = null; // top-level ключ manifest, чей файл-навигатор сейчас показан
let kbCurrentPath = null;       // kb-относительный путь текущего открытого файла

function kbEscapeHtml(str){
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function kbLoadManifest(){
  if(!kbManifestPromise){
    kbManifestPromise = fetch("kb/manifest.json")
      .then(res => {
        if(!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .catch(err => {
        kbManifestPromise = null; // разрешить повторную попытку при следующем открытии
        throw err;
      });
  }
  return kbManifestPromise;
}

/* Схлопывает "01-fundamentals/03-networking-basics" + "../04-git.md"
   в "01-fundamentals/04-git.md" — упрощённый резолвер относительных
   путей, которого достаточно для ссылок внутри markdown (без "./", без
   абсолютных путей и без query/hash — hash уже отрезан вызывающим кодом). */
function kbResolveRelativePath(baseDir, relHref){
  const baseParts = baseDir ? baseDir.split("/").filter(Boolean) : [];
  const relParts = relHref.split("/").filter(Boolean);
  for(const part of relParts){
    if(part === ".") continue;
    else if(part === ".."){ baseParts.pop(); }
    else baseParts.push(part);
  }
  return baseParts.join("/");
}

function kbDirname(path){
  const idx = path.lastIndexOf("/");
  return idx === -1 ? "" : path.slice(0, idx);
}

/* Ищет путь среди верхнеуровневых узлов manifest.json и их children.
   Возвращает { parentSlug, parentNode, title } либо null, если файла нет
   в манифесте (например, тема ещё не законспектирована). */
function kbFindByPath(manifest, path){
  for(const [slug, node] of Object.entries(manifest)){
    if(node.path === path) return { parentSlug: slug, parentNode: node, title: node.title };
    if(Array.isArray(node.children)){
      const child = node.children.find(c => c.path === path);
      if(child) return { parentSlug: slug, parentNode: node, title: child.title };
    }
  }
  return null;
}

function kbSetupMermaidTheme(){
  const explicit = document.documentElement.getAttribute("data-theme");
  const isDark = explicit === "dark" || (!explicit && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
  try{
    mermaid.initialize({ startOnLoad: false, theme: isDark ? "dark" : "default", securityLevel: "strict" });
  }catch(e){ /* mermaid не загрузился (например, офлайн CDN) — диаграммы останутся текстом */ }
}

let kbMarkedConfigured = false;
function kbConfigureMarked(){
  if(kbMarkedConfigured || typeof marked === "undefined") return;
  const renderer = new marked.Renderer();
  const originalCode = renderer.code.bind(renderer);
  // ВАЖНО: в marked@12 Renderer.code всё ещё принимает позиционные
  // аргументы (code, infostring, escaped), а НЕ единый объект-токен
  // (токен-объект появился только в более поздних major-версиях) — если
  // читать здесь token.lang/token.text, ветка mermaid никогда не сработает
  // и все блоки молча уйдут в обычный рендер кода (это и произошло в первой
  // версии этого файла: диаграммы показывались как обычный текст).
  renderer.code = (code, infostring, escaped) => {
    const lang = (infostring || "").match(/^\S*/)?.[0] || "";
    if(lang.trim().toLowerCase() === "mermaid"){
      // Экранируем, чтобы литеральные "<br/>" внутри подписей диаграмм
      // дошли до mermaid как текст его собственного синтаксиса, а не были
      // распарсены браузером как настоящий <br>-элемент при innerHTML.
      return `<pre class="mermaid">${kbEscapeHtml(code)}</pre>`;
    }
    return originalCode(code, infostring, escaped);
  };
  marked.setOptions({ renderer, gfm: true, breaks: false });
  kbMarkedConfigured = true;
}

async function kbRenderMermaidBlocks(container){
  if(typeof mermaid === "undefined") return;
  kbSetupMermaidTheme();
  const nodes = container.querySelectorAll("pre.mermaid");
  for(const node of nodes){
    try{
      await mermaid.run({ nodes: [node] });
    }catch(err){
      console.error("Mermaid: не удалось отрисовать диаграмму", err);
      node.insertAdjacentHTML(
        "afterend",
        `<div class="kb-mermaid-error">Диаграмму не удалось отрисовать (см. консоль) — текст блока выше.</div>`
      );
    }
  }
}

function kbUpdateActiveFileNav(path){
  const select = document.querySelector("#kb-modal-files .kb-file-select");
  if(select && select.value !== path) select.value = path;
}

/* Переключатель файлов темы-подпапки — один компактный <select> вместо
   ряда кнопок: на узком экране ряд кнопок легко занимал 2-3 строки над
   текстом, а select — всегда одна строка независимо от числа файлов. */
function kbRenderFileNav(node){
  const nav = document.getElementById("kb-modal-files");
  if(!node || !Array.isArray(node.children) || node.children.length === 0){
    nav.hidden = true;
    nav.innerHTML = "";
    return;
  }
  const items = [{ path: node.path, title: "Обзор" }, ...node.children.map(c => ({ path: c.path, title: c.title }))];
  const options = items.map(it =>
    `<option value="${kbEscapeHtml(it.path)}">${kbEscapeHtml(it.title)}</option>`
  ).join("");
  nav.innerHTML = `<select class="kb-file-select" aria-label="Файл темы">${options}</select>`;
  nav.hidden = false;
  const select = nav.querySelector(".kb-file-select");
  select.addEventListener("change", () => {
    const item = items.find(it => it.path === select.value);
    if(item) kbLoadFile(item.path, { title: item.title });
  });
}

function kbFilenameFallbackTitle(path){
  const base = path.split("/").pop() || path;
  return base.replace(/\.md$/i, "");
}

async function kbLoadFile(path, meta){
  kbCurrentPath = path;
  kbUpdateActiveFileNav(path);

  const titleEl = document.getElementById("kb-modal-title");
  const statusEl = document.getElementById("kb-modal-status");
  const contentEl = document.getElementById("kb-modal-content");
  titleEl.textContent = (meta && meta.title) || kbFilenameFallbackTitle(path);
  statusEl.textContent = "Загрузка…";
  statusEl.hidden = false;
  contentEl.innerHTML = "";
  contentEl.hidden = true;

  try{
    const res = await fetch("kb/" + path);
    if(!res.ok) throw new Error("HTTP " + res.status + " при загрузке " + path);
    const raw = await res.text();
    const body = raw.replace(KB_FRONTMATTER_RE, "");
    kbConfigureMarked();
    contentEl.innerHTML = (typeof marked !== "undefined") ? marked.parse(body) : "<pre>" + kbEscapeHtml(body) + "</pre>";
    statusEl.hidden = true;
    contentEl.hidden = false;
    kbPostProcessLinks(contentEl, path);
    await kbRenderMermaidBlocks(contentEl);
  }catch(err){
    statusEl.hidden = false;
    statusEl.textContent = "Не удалось загрузить файл kb/" + path + ": " + err.message +
      ". Если вы открыли index.html напрямую как файл (file://) — запустите локальный сервер (например, расширение VS Code Live Server или `python -m http.server`) и откройте сайт через http://.";
    contentEl.hidden = true;
  }
}

function kbPostProcessLinks(container, currentPath){
  const baseDir = kbDirname(currentPath);
  container.querySelectorAll("a[href]").forEach(a => {
    const href = a.getAttribute("href");
    if(!href || href.startsWith("#")) return;
    if(/^([a-z][a-z0-9+.-]*:)?\/\//i.test(href) || href.startsWith("mailto:")){
      a.target = "_blank";
      a.rel = "noopener";
      return;
    }
    if(/\.md(#.*)?$/i.test(href)){
      a.addEventListener("click", (e) => {
        e.preventDefault();
        const hrefPath = href.split("#")[0];
        const resolved = kbResolveRelativePath(baseDir, hrefPath);
        kbNavigateToPath(resolved);
      });
    }
  });
}

async function kbNavigateToPath(resolvedPath){
  document.getElementById("kb-modal-body").scrollTo({ top: 0 });
  try{
    const manifest = await kbLoadManifest();
    const found = kbFindByPath(manifest, resolvedPath);
    if(found){
      kbCurrentParentSlug = found.parentSlug;
      kbRenderFileNav(found.parentNode);
      const eyebrow = document.getElementById("kb-modal-eyebrow");
      eyebrow.textContent = "База знаний · Раздел " + (found.parentNode.section != null ? found.parentNode.section : "?");
      await kbLoadFile(resolvedPath, { title: found.title });
      return;
    }
  }catch(e){ /* manifest недоступен — попробуем открыть файл всё равно, просто без навигации */ }
  // Файла нет в manifest.json (например, тема ещё не написана в kb/) —
  // всё равно пробуем открыть по прямому пути, просто без списка файлов.
  kbCurrentParentSlug = null;
  kbRenderFileNav(null);
  await kbLoadFile(resolvedPath, {});
}

function kbCloseModal(){
  document.getElementById("kb-modal").classList.remove("show");
}

function kbOpenModal(){
  document.getElementById("kb-modal").classList.add("show");
  document.getElementById("kb-modal-body").scrollTo({ top: 0 });
}

/* Точка входа, вызывается из app.js по клику на кнопку «Материалы».
   slug — верхнеуровневый topic_slug из kb/manifest.json. */
async function openKbViewer(slug){
  kbOpenModal();
  const titleEl = document.getElementById("kb-modal-title");
  const statusEl = document.getElementById("kb-modal-status");
  const contentEl = document.getElementById("kb-modal-content");
  const eyebrow = document.getElementById("kb-modal-eyebrow");
  titleEl.textContent = "Загрузка…";
  eyebrow.textContent = "База знаний";
  statusEl.hidden = false;
  statusEl.textContent = "Загрузка…";
  contentEl.hidden = true;
  document.getElementById("kb-modal-files").hidden = true;

  try{
    const manifest = await kbLoadManifest();
    const node = manifest[slug];
    if(!node){
      statusEl.textContent = "Тема «" + slug + "» пока не законспектирована в kb/.";
      return;
    }
    kbCurrentParentSlug = slug;
    eyebrow.textContent = "База знаний · Раздел " + (node.section != null ? node.section : "?");
    kbRenderFileNav(node);
    await kbLoadFile(node.path, { title: node.title });
  }catch(err){
    statusEl.textContent = "Не удалось загрузить kb/manifest.json: " + err.message +
      ". Если вы открыли index.html напрямую как файл (file://), запустите локальный сервер и откройте сайт через http://.";
  }
}
window.openKbViewer = openKbViewer;

document.getElementById("kb-modal-close")?.addEventListener("click", kbCloseModal);
document.getElementById("kb-modal")?.addEventListener("click", (e) => {
  if(e.target.id === "kb-modal") kbCloseModal();
});
document.addEventListener("keydown", (e) => {
  if(e.key === "Escape" && document.getElementById("kb-modal")?.classList.contains("show")) kbCloseModal();
});
