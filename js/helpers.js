/*
  Общие "строительные блоки" данных дорожной карты.
  Файлы в js/data/*.js вызывают S()/T()/G() на верхнем уровне —
  каждый вызов S() сам добавляет раздел в общий массив SECTIONS.
  Этот файл должен подключаться в index.html ПЕРЕД всеми файлами js/data/*.js.
*/
const SECTIONS = [];

function S(title, subtitle, topics){ SECTIONS.push({ title, subtitle, topics }); }
function G(h, items){ return { h, items }; }
/*
  kb — необязательный topic_slug из kb/manifest.json (например "01-04-git").
  Если указан, в строке темы появляется кнопка «Материалы», открывающая
  соответствующий .md-конспект из kb/ во всплывающем окне (js/kb-viewer.js).
  Если тема пока не законспектирована в kb/ — просто не передавайте этот
  аргумент, кнопка не появится.
*/
function T(title, desc, groups, q, kb){ return { title, desc, groups, q, kb }; }
