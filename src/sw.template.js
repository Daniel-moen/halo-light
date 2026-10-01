// Halo Light service worker: precache the whole app so it works offline.
const CACHE = 'halo-__VERSION__';
const URLS = __URLS__;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(URLS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('halo-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.mode === 'navigate') {
    // Network first for the page so updates arrive; cached shell when offline.
    event.respondWith(
      fetch(req).catch(() => caches.match('/', { cacheName: CACHE })),
    );
    return;
  }
  event.respondWith(caches.match(req, { cacheName: CACHE }).then((hit) => hit || fetch(req)));
});
