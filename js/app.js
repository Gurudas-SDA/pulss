// Pulss — sāknēšana, hash maršrutētājs, skatu montēšana, SW reģistrācija.
import { t } from './i18n.js';

export const APP_VERSION = '0.1.0';

// Globālais stāvoklis (vienkāršs objekts; skati to importē tieši).
export const state = {
  client: null,        // HrmClient | MockHrm (2./3. solis)
  connected: false,
  battery: null,       // 0..100 | null
  bpm: null,
  mock: new URLSearchParams(location.search).get('mock') === '1',
  recorder: null,      // Recorder (3. solis)
};

const ROUTES = {
  home:       () => import('./ui/home.js'),
  record:     () => import('./ui/record.js'),
  analytics:  () => import('./ui/analytics.js'),
  activities: () => import('./ui/activities.js'),
  settings:   () => import('./ui/settings.js'),
  session:    () => import('./ui/session.js'),
};

const NAV_ITEMS = [
  { route: 'home',       label: t.nav.home,       ico: '♥' },
  { route: 'analytics',  label: t.nav.analytics,  ico: '📈' },
  { route: 'activities', label: t.nav.activities, ico: '☰' },
  { route: 'settings',   label: t.nav.settings,   ico: '⚙' },
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

export function showToast(text, onTap) {
  toastEl.textContent = text;
  toastEl.hidden = false;
  toastEl.onclick = () => { toastEl.hidden = true; if (onTap) onTap(); };
  if (!onTap) setTimeout(() => { toastEl.hidden = true; }, 4000);
}

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

window.addEventListener('hashchange', route);
route();
registerSw();
