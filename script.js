const LANG_KEY = 'hooky-lang';
const SEEN_KEY = 'k7c5-autofill-seen';
const CODES = ['k7c6', 'k7c7', 'k7c8', 'k7c9'];
const STEP_MS = 180;
const SERIES_FIRST_LINE = 9;
const SEED_ROWS = 7;

const TITLES = {
  ru: 'k7c5: автоматизация Google Таблиц, сайты и боты',
  en: 'k7c5: Google Sheets automation, websites and bots',
};

const DESCRIPTIONS = {
  ru: 'Автоматизирую Google Таблицы, делаю сайты и ботов для Telegram и Discord. Для малого бизнеса в США, по-русски и по-английски.',
  en: 'I automate Google Sheets and build websites and Telegram and Discord bots. For small businesses in the USA, in English and Russian.',
};

function readSaved(storage, key) {
  try {
    return storage.getItem(key);
  } catch (error) {
    return null;
  }
}

function save(storage, key, value) {
  try {
    storage.setItem(key, value);
  } catch (error) {
    return false;
  }
  return true;
}

function pickLang() {
  const saved = readSaved(localStorage, LANG_KEY);
  if (saved === 'ru' || saved === 'en') return saved;
  const browserLangs = navigator.languages?.length ? navigator.languages : [navigator.language ?? ''];
  for (const item of browserLangs) {
    const code = String(item).toLowerCase();
    if (code.startsWith('ru')) return 'ru';
    if (code.startsWith('en')) return 'en';
  }
  return 'en';
}

function motionOK() {
  return window.matchMedia('(prefers-reduced-motion: no-preference)').matches;
}

document.documentElement.lang = pickLang();
document.documentElement.classList.add('js');
if (motionOK() && readSaved(sessionStorage, SEEN_KEY) !== 'yes') {
  document.documentElement.classList.add('autofill-intro');
}

let runId = 0;
let dragging = false;
let previewRows = 0;

const parts = {};

function findParts() {
  parts.selection = document.querySelector('.selection');
  parts.preview = document.querySelector('.fill-preview');
  parts.tip = document.querySelector('.fill-tip');
  parts.handle = document.querySelector('.fill-handle');
  parts.hint = document.getElementById('fill-hint');
  parts.rows = [...document.querySelectorAll('.series-row')];
  parts.numbers = [...document.querySelectorAll('.number')];
  parts.iframe = document.querySelector('.preview-iframe');
}

function setLang(lang, fromUser) {
  document.documentElement.lang = lang;
  document.title = TITLES[lang];
  document.querySelector('meta[name="description"]')?.setAttribute('content', DESCRIPTIONS[lang]);
  document.querySelectorAll('[data-set-lang]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.setLang === lang));
  });
  save(localStorage, LANG_KEY, lang);
  if (fromUser) reloadPreview();
}

function reloadPreview() {
  const iframe = parts.iframe;
  if (!iframe || iframe.dataset.loaded !== 'yes') return;
  try {
    iframe.contentWindow.location.reload();
  } catch (error) {
    iframe.src = iframe.getAttribute('src');
  }
}

function showFilled(count) {
  parts.selection.style.gridRowEnd = String(SERIES_FIRST_LINE + count);
  parts.rows.forEach((row, index) => {
    row.classList.toggle('is-empty', index >= count);
  });
  parts.numbers.forEach((number, index) => {
    number.classList.toggle('is-selected', index < SEED_ROWS + count);
  });
}

function showPreview(count) {
  if (count === null) {
    parts.preview.hidden = true;
    return;
  }
  parts.preview.hidden = count === 0;
  parts.preview.style.gridRowEnd = String(SERIES_FIRST_LINE + Math.max(count, 1));
  parts.tip.textContent = count > 0 ? CODES[count - 1] : '';
  parts.numbers.forEach((number, index) => {
    number.classList.toggle('is-selected', index < SEED_ROWS + count);
  });
}

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function markSeen() {
  save(sessionStorage, SEEN_KEY, 'yes');
}

async function playSeries() {
  const run = ++runId;
  document.documentElement.classList.remove('autofill-intro');
  showFilled(0);
  for (let count = 1; count <= CODES.length; count++) {
    showPreview(count);
    await wait(STEP_MS);
    if (run !== runId) return;
  }
  showPreview(null);
  showFilled(CODES.length);
  markSeen();
}

async function finishFrom(count) {
  const run = ++runId;
  showFilled(count);
  for (let next = count + 1; next <= CODES.length; next++) {
    await wait(STEP_MS);
    if (run !== runId) return;
    showFilled(next);
  }
  markSeen();
}

function rowsAbove(y) {
  const passed = parts.rows.filter((row) => row.getBoundingClientRect().top + 16 < y).length;
  return Math.min(Math.max(passed, 0), CODES.length);
}

function onHandleDown(event) {
  event.preventDefault();
  runId++;
  document.documentElement.classList.remove('autofill-intro');
  parts.handle.setPointerCapture(event.pointerId);
  dragging = true;
  previewRows = 0;
  showFilled(0);
  showPreview(0);
}

function onHandleMove(event) {
  if (!dragging) return;
  previewRows = rowsAbove(event.clientY);
  showPreview(previewRows);
}

function onHandleUp() {
  if (!dragging) return;
  dragging = false;
  showPreview(null);
  finishFrom(previewRows);
}

function onHandleClick(event) {
  if (event.detail === 0) playSeries();
}

function setupLanguage() {
  document.querySelectorAll('[data-set-lang]').forEach((button) => {
    button.hidden = false;
    button.addEventListener('click', () => setLang(button.dataset.setLang, true));
  });
  setLang(document.documentElement.lang, false);
}

function setupPreview() {
  parts.iframe?.addEventListener('load', () => {
    parts.iframe.dataset.loaded = 'yes';
  });
}

function setupHandle() {
  if (!motionOK()) return;
  parts.handle.hidden = false;
  parts.hint.hidden = false;
  parts.handle.addEventListener('pointerdown', onHandleDown);
  parts.handle.addEventListener('pointermove', onHandleMove);
  parts.handle.addEventListener('pointerup', onHandleUp);
  parts.handle.addEventListener('pointercancel', onHandleUp);
  parts.handle.addEventListener('click', onHandleClick);
}

async function start() {
  findParts();
  setupLanguage();
  setupPreview();
  setupHandle();
  if (document.documentElement.classList.contains('autofill-intro')) {
    await Promise.race([document.fonts.ready, wait(600)]);
    await wait(200);
    playSeries();
  }
}

document.addEventListener('DOMContentLoaded', start);
