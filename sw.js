// Pulss service worker.
// CACHE_VERSION must be bumped on EVERY deploy — the browser only byte-compares
// this registered script, so a change here is what triggers the update.
const CACHE_VERSION = 'v1';
const CACHE = 'pulss-' + CACHE_VERSION;
const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/app.css',
  './js/app.js',
  './js/i18n.js',
  './js/ble.js',
  './js/db.js',
  './js/recorder.js',
  './js/charts.js',
  './js/ui/home.js',
  './js/ui/record.js',
  './js/ui/activities.js',
  './js/ui/analytics.js',
  './js/ui/session.js',
  './js/ui/settings.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
];

// Absolute URLs of SHELL entries, resolved against the SW scope.
const SHELL_URLS = new Set(SHELL.map((p) => new URL(p, self.location.href).href));

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k.startsWith('pulss-') && k !== CACHE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Navigations: network-first, fall back to cached index.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Shell assets: cache-first.
  const key = url.origin + url.pathname; // strip query (?mock=1 etc.)
  if (SHELL_URLS.has(key)) {
    event.respondWith(
      caches.match(key).then((hit) => hit || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(key, copy));
        return res;
      }))
    );
  }
});
