const CACHE = 'vappie-cache-v5-syncfix';
const CORE = [
  '/', '/index.html', '/styles.css', '/app.js', '/seedData.js', '/manifest.webmanifest',
  '/icons/icon-192.png', '/icons/icon-512.png', '/icons/apple-touch-icon.png', '/icons/favicon-32.png',
  '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(CORE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Database en login zijn altijd live en worden nooit door de PWA-cache onderschept.
  if (url.hostname.endsWith('.supabase.co')) return;

  // Navigaties: altijd eerst internet, offline terugvallen op de laatste index.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request, { cache: 'no-store' })
        .then(response => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then(cache => cache.put('/index.html', copy));
          }
          return response;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  const sameOrigin = url.origin === self.location.origin;
  const isAppCode = sameOrigin && ['/app.js', '/styles.css', '/seedData.js', '/manifest.webmanifest'].includes(url.pathname);

  // Belangrijk voor iPhone/PWA: app-code is network-first.
  // Daardoor blijft een oude app.js niet eindeloos uit de cache komen.
  if (isAppCode) {
    event.respondWith(
      fetch(request, { cache: 'no-store' })
        .then(response => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then(cache => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  const canCache = sameOrigin || url.hostname === 'cdn.jsdelivr.net' || url.hostname === 'cdn.sheetjs.com';
  if (!canCache) return;

  // Afbeeldingen/icons en externe libraries mogen cache-first blijven.
  event.respondWith(
    caches.match(request).then(cached => cached || fetch(request).then(response => {
      if (response && response.ok) {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(request, copy));
      }
      return response;
    }))
  );
});
