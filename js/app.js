// Pulss — sāknēšana, hash maršrutētājs, skatu montēšana, SW reģistrācija.
import { t } from './i18n.js';
import { openDb, getSetting } from './db.js';
import { Recorder } from './recorder.js';

export const APP_VERSION = '0.5.1';

// Globālais stāvoklis (vienkāršs objekts; skati to importē tieši).
export const state = {
  client: null,        // HrmClient | MockHrm — rada home.js pie "Pievienot jostu"
  connected: false,
  battery: null,       // 0..100 | null
  bpm: null,
  mock: new URLSearchParams(location.search).get('mock') === '1', // boot: OR saglabātais iestatījums
  recorder: null,      // Recorder (boot)
  installPrompt: null, // BeforeInstallPromptEvent | null — Chrome instalēšanas piedāvājums (home.js kartīte)
};

const ROUTES = {
  home:       () => import('./ui/home.js'),
  record:     () => import('./ui/record.js'),
  analytics:  () => import('./ui/analytics.js'),
  activities: () => import('./ui/activities.js'),
  settings:   () => import('./ui/settings.js'),
  session:    () => import('./ui/session.js'),
};

// Navigācijas ikonas — iekļauti SVG (24×24, currentColor → aktīvās cilnes krāsa nāk no CSS).
const SVG_ATTRS = 'xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false"';
const ICONS = {
  heart: `<svg ${SVG_ATTRS} fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`,
  trend: `<svg ${SVG_ATTRS} fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/></svg>`,
  list: `<svg ${SVG_ATTRS} fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>`,
  gear: `<svg ${SVG_ATTRS} fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
};

const NAV_ITEMS = [
  { route: 'home',       label: t.nav.home,       ico: ICONS.heart },
  { route: 'analytics',  label: t.nav.analytics,  ico: ICONS.trend },
  { route: 'activities', label: t.nav.activities, ico: ICONS.list },
  { route: 'settings',   label: t.nav.settings,   ico: ICONS.gear },
];

const viewEl = document.getElementById('view');
const navEl = document.getElementById('nav');
const titleEl = document.getElementById('topbar-title');
const toastEl = document.getElementById('toast');

let current = null; // { name, module }

function parseHash() {
  const raw = (location.hash || '#home').slice(1);
  const [name, ...rest] = raw.split('/');
  return {
    name: name || 'home',
    params: { id: rest.length ? decodeURIComponent(rest.join('/')) : undefined },
  };
}

function renderNav(active) {
  navEl.innerHTML = NAV_ITEMS.map((n) =>
    `<a href="#${n.route}" class="${n.route === active ? 'active' : ''}">` +
    `<span class="ico" aria-hidden="true">${n.ico}</span><span>${n.label}</span></a>`
  ).join('');
}

async function route() {
  const { name, params } = parseHash();
  const loader = ROUTES[name];
  if (!loader) { location.replace('#home'); return; }

  if (current && current.module.unmount) {
    try { current.module.unmount(); } catch (e) { console.error(e); }
  }

  const mod = await loader();
  current = { name, module: mod };

  const hideNav = name === 'record';
  navEl.hidden = hideNav;
  document.body.classList.toggle('nav-hidden', hideNav);
  renderNav(name);
  const title = (t[name] && t[name].title) || t.appName;
  titleEl.textContent = title;
  document.title = `${title} · ${t.appName}`;

  viewEl.innerHTML = '';
  mod.render(viewEl, params);
  window.scrollTo(0, 0);
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

// Lejupielāde caur pagaidu <a download> (JSON/CSV eksporti).
export function downloadFile(name, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function showToast(text, onTap) {
  toastEl.textContent = text;
  toastEl.hidden = false;
  toastEl.onclick = () => { toastEl.hidden = true; if (onTap) onTap(); };
  if (!onTap) setTimeout(() => { toastEl.hidden = true; }, 4000);
}

// Instalēšanas piedāvājums (Chrome/Android): notikumu aiztur un glabā state; home.js rāda kartīti.
// Ja notikums nekad nepienāk (iOS, jau instalēts u.c.) — kartīte vienkārši neparādās.
export function isStandalone() {
  return (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
}
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  state.installPrompt = e;
  window.dispatchEvent(new Event('pulss:installable'));
});
window.addEventListener('appinstalled', () => {
  state.installPrompt = null;
  window.dispatchEvent(new Event('pulss:installable'));
});

function registerSw() {
  if (!('serviceWorker' in navigator)) return;
  const hadController = !!navigator.serviceWorker.controller;
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // Jauns SW pārņēmis kontroli. Pie pirmās instalācijas (nebija kontroliera) toastu nerāda.
    if (!hadController) return;
    showToast(t.update.newVersion, () => {
      if (refreshing) return;
      refreshing = true;
      location.reload();
    });
  });
  navigator.serviceWorker.register('sw.js').catch((e) => console.warn('SW registration failed', e));
}

async function boot() {
  try {
    await openDb();
    if (!state.mock) state.mock = !!(await getSetting('mock', false));
    state.recorder = new Recorder();
  } catch (e) {
    console.error(e);
    renderNav('home');
    viewEl.innerHTML = `<div class="card"><p class="error">${t.errors.dbFailed}: ${escapeHtml(e.message || e)}</p></div>`;
    return;
  }
  window.addEventListener('hashchange', route);
  await route();
}

boot();
registerSw();
