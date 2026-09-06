/*
  Общие "строительные блоки" данных дорожной карты.
  Файлы в js/data/*.js вызывают S()/T()/G() на верхнем уровне —
  каждый вызов S() сам добавляет раздел в общий массив SECTIONS.
  Этот файл должен подключаться в index.html ПЕРЕД всеми файлами js/data/*.js.
*/
const SECTIONS = [];

function S(title, subtitle, topics){ SECTIONS.push({ title, subtitle, topics }); }
function G(h, items){ return { h, items }; }
function T(title, desc, groups, q){ return { title, desc, groups, q }; }
