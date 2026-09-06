/* ===================== APP LOGIC ===================== */
const STORAGE_KEY = "java-senior-roadmap-progress-v2";
const COLLAPSE_KEY = "java-senior-roadmap-collapse-v2";
const THEME_KEY = "java-senior-roadmap-theme-v1";

function escapeHtml(str){
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function loadChecked(){
  try{ return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]")); }
  catch(e){ return new Set(); }
}
function saveChecked(set){
  try{ localStorage.setItem(STORAGE_KEY, JSON.stringify([...set])); }catch(e){}
}
function loadCollapse(){
  try{ return JSON.parse(localStorage.getItem(COLLAPSE_KEY) || "null"); }
  catch(e){ return null; }
}
function saveCollapse(obj){
  try{ localStorage.setItem(COLLAPSE_KEY, JSON.stringify(obj)); }catch(e){}
}

let checked = loadChecked();
let openMap = loadCollapse() || {0:true};

const root = document.getElementById("sections-root");
const navList = document.getElementById("nav-list");
let totalTopics = 0;

SECTIONS.forEach((sec, si) => {
  sec.topics.forEach((t, ti) => { t.id = "s"+si+"-t"+ti; totalTopics++; });
});
document.getElementById("stat-total").textContent = totalTopics;

function slugForSection(si){ return "sec-"+si; }

/* ---------- Мобильное меню (выезжающий сайдбар) ---------- */
const sidebarEl = document.querySelector(".sidebar");
const sidebarBackdrop = document.getElementById("sidebar-backdrop");
function openSidebar(){
  sidebarEl.classList.add("open");
  if(sidebarBackdrop) sidebarBackdrop.classList.add("show");
}
function closeSidebar(){
  sidebarEl.classList.remove("open");
  if(sidebarBackdrop) sidebarBackdrop.classList.remove("show");
}
document.getElementById("btn-mobile-menu")?.addEventListener("click", openSidebar);
document.getElementById("btn-sidebar-close")?.addEventListener("click", closeSidebar);
sidebarBackdrop?.addEventListener("click", closeSidebar);

function render(){
  root.innerHTML = "";
  navList.innerHTML = "";

  SECTIONS.forEach((sec, si) => {
    const doneCount = sec.topics.filter(t => checked.has(t.id)).length;
    const pct = Math.round((doneCount / sec.topics.length) * 100);

    const li = document.createElement("li");
    li.className = "nav-item";
    li.innerHTML = `<span class="nav-idx">${String(si+1).padStart(2,"0")}</span><span class="nav-title">${escapeHtml(sec.title)}</span><span class="nav-bar"><span style="width:${pct}%"></span></span>`;
    li.addEventListener("click", () => {
      openMap[si] = true; saveCollapse(openMap); render();
      closeSidebar();
      document.getElementById(slugForSection(si)).scrollIntoView({behavior:"smooth", block:"start"});
    });
    navList.appendChild(li);

    const secEl = document.createElement("section");
    secEl.className = "topic-section" + (openMap[si] ? " open" : "");
    secEl.id = slugForSection(si);

    const head = document.createElement("div");
    head.className = "sec-head";
    head.innerHTML = `
      <div class="sec-num">${String(si+1).padStart(2,"0")}</div>
      <div class="sec-titles">
        <h3>${escapeHtml(sec.title)}</h3>
        <p>${escapeHtml(sec.subtitle)}</p>
      </div>
      <div class="sec-meta">
        <div class="sec-progress">
          <div class="sec-progress-track"><span style="width:${pct}%"></span></div>
          <div class="sec-progress-label">${doneCount}/${sec.topics.length}</div>
        </div>
        <svg class="chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
      </div>`;
    head.addEventListener("click", () => {
      openMap[si] = !openMap[si]; saveCollapse(openMap); render();
    });
    secEl.appendChild(head);

    const body = document.createElement("div");
    body.className = "sec-body";
    sec.topics.forEach(t => {
      const row = document.createElement("div");
      row.className = "topic-row" + (checked.has(t.id) ? " done" : "");
      const searchBlob = [t.title, t.desc, t.q||"", ...t.groups.flatMap(g => [g.h, ...g.items])].join(" ").toLowerCase();
      row.dataset.search = searchBlob;
      const groupsHtml = t.groups.map(g => `
        <div class="group-block">
          <div class="group-h">${escapeHtml(g.h)}</div>
          <ul class="group-items">${g.items.map(it => `<li>${escapeHtml(it)}</li>`).join("")}</ul>
        </div>`).join("");
      row.innerHTML = `
        <input type="checkbox" class="topic-check" ${checked.has(t.id) ? "checked" : ""}>
        <div class="topic-main">
          <div class="topic-title-row"><span class="topic-title">${escapeHtml(t.title)}</span></div>
          <p class="topic-desc">${escapeHtml(t.desc)}</p>
          <div class="group-list">${groupsHtml}</div>
          ${t.q ? `<div class="qbox"><b>Частый вопрос на собеседовании</b>${escapeHtml(t.q)}</div>` : ""}
        </div>`;
      const cb = row.querySelector(".topic-check");
      const toggle = () => {
        if(checked.has(t.id)) checked.delete(t.id); else checked.add(t.id);
        saveChecked(checked);
        render();
      };
      cb.addEventListener("click", (e) => { e.stopPropagation(); toggle(); });
      row.querySelector(".topic-title").addEventListener("click", toggle);
      body.appendChild(row);
    });
    secEl.appendChild(body);
    root.appendChild(secEl);
  });

  updateStats();
  applySearch(document.getElementById("search-input-main").value);
}

function updateStats(){
  const doneTotal = checked.size;
  const pct = totalTopics ? Math.round((doneTotal/totalTopics)*100) : 0;
  document.getElementById("stat-pct").textContent = pct;
  document.getElementById("stat-done").textContent = doneTotal;
  const circumference = 138.2;
  const ring = document.getElementById("ring-progress");
  ring.setAttribute("stroke-dashoffset", String(circumference - (circumference*pct/100)));
}

function applySearch(query){
  const q = query.trim().toLowerCase();
  let visibleCount = 0;
  const rows = document.querySelectorAll(".topic-row");
  const sections = document.querySelectorAll(".topic-section");
  if(!q){
    rows.forEach(r => { r.classList.remove("hidden"); visibleCount++; });
    sections.forEach(s => s.style.display = "");
    document.getElementById("empty-state").classList.remove("show");
    document.getElementById("toolbar-visible").textContent = totalTopics;
    return;
  }
  sections.forEach((secEl) => {
    let anyVisible = false;
    secEl.querySelectorAll(".topic-row").forEach(r => {
      const match = r.dataset.search.includes(q);
      r.classList.toggle("hidden", !match);
      if(match){ anyVisible = true; visibleCount++; }
    });
    secEl.style.display = anyVisible ? "" : "none";
    if(anyVisible) secEl.classList.add("open");
  });
  document.getElementById("toolbar-visible").textContent = visibleCount;
  document.getElementById("empty-state").classList.toggle("show", visibleCount === 0);
}

const searchMain = document.getElementById("search-input-main");
const searchSide = document.getElementById("search-input");
searchMain.addEventListener("input", () => { searchSide.value = searchMain.value; applySearch(searchMain.value); });
searchSide.addEventListener("input", () => { searchMain.value = searchSide.value; applySearch(searchSide.value); });

document.getElementById("btn-expand-all").addEventListener("click", () => {
  SECTIONS.forEach((_, si) => openMap[si] = true); saveCollapse(openMap); render();
});
document.getElementById("btn-collapse-all").addEventListener("click", () => {
  SECTIONS.forEach((_, si) => openMap[si] = false); saveCollapse(openMap); render();
});

document.getElementById("btn-reset").addEventListener("click", () => {
  if(confirm("Сбросить весь прогресс изучения? Это действие нельзя отменить.")){
    checked = new Set(); saveChecked(checked); render();
  }
});

document.getElementById("btn-export").addEventListener("click", () => {
  const payload = { checked: [...checked], exportedAt: new Date().toISOString() };
  document.getElementById("export-text").value = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
  document.getElementById("export-modal").classList.add("show");
});
document.getElementById("export-close").addEventListener("click", () => document.getElementById("export-modal").classList.remove("show"));
document.getElementById("export-copy").addEventListener("click", () => {
  const ta = document.getElementById("export-text");
  ta.select(); document.execCommand("copy");
});

document.getElementById("btn-import").addEventListener("click", () => {
  document.getElementById("import-text").value = "";
  document.getElementById("import-modal").classList.add("show");
});
document.getElementById("import-cancel").addEventListener("click", () => document.getElementById("import-modal").classList.remove("show"));
document.getElementById("import-apply").addEventListener("click", () => {
  try{
    const raw = document.getElementById("import-text").value.trim();
    const payload = JSON.parse(decodeURIComponent(escape(atob(raw))));
    checked = new Set(payload.checked || []);
    saveChecked(checked);
    document.getElementById("import-modal").classList.remove("show");
    render();
  }catch(e){
    alert("Не удалось прочитать данные. Проверьте, что текст скопирован полностью.");
  }
});

/* Theme handling */
function applyTheme(mode){
  if(mode === "system") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", mode);
  document.querySelectorAll("[data-theme-btn]").forEach(b => b.classList.toggle("active", b.dataset.themeBtn === mode));
  try{ localStorage.setItem(THEME_KEY, mode); }catch(e){}
}
document.querySelectorAll("[data-theme-btn]").forEach(b => {
  b.addEventListener("click", () => applyTheme(b.dataset.themeBtn));
});
applyTheme((() => { try{ return localStorage.getItem(THEME_KEY) || "system"; }catch(e){ return "system"; } })());

render();
