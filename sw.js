// Service worker de Control de Flotilla FRAGO — versión segura (no atrapa versiones viejas)
const CACHE = 'flotilla-v24';
const ASSETS = ['icon-192.png', 'icon-512.png', 'manifest.json'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).catch(() => {}));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // no interceptar CDNs (jsPDF, etc.)

  // HTML: SIEMPRE red primero. Nunca sirve una versión vieja atorada.
  if (req.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('/')) {
    e.respondWith(
      fetch(req).then(r => { const cp = r.clone(); caches.open(CACHE).then(c => c.put(req, cp)).catch(() => {}); return r; })
        .catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    );
    return;
  }
  // Íconos y estáticos: caché primero (rápido), con respaldo a red.
  e.respondWith(caches.match(req).then(r => r || fetch(req).then(rr => {
    const cp = rr.clone(); caches.open(CACHE).then(c => c.put(req, cp)).catch(() => {}); return rr;
  })));
});
