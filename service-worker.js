const CACHE = 'vappie-cache-v44-overzicht-fullscreen';
const CORE = [
  '/index.html',
  '/styles.css',
  '/app.js',
  '/seedData.js',
  '/planning2026.js',
  '/enhancements.css',
  '/enhancements.js',
  '/meldingen.css',
  '/meldingen.js',
  '/enquetes.css',
  '/enquetes.js',
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    for (const url of CORE) {
      try {
        const response = await fetch(url, { cache: 'reload' });
        if (response && response.ok) await cache.put(url, response.clone());
      } catch (_) {
        // Eén ontbrekend bestand mag de installatie niet meer blokkeren.
      }
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.hostname.endsWith('.supabase.co')) return;

  const sameOrigin = url.origin === self.location.origin;
  if (!sameOrigin) return;

  // HTML en code altijd eerst van het netwerk: voorkomt blijven hangen op oude Vappie-versies.
  const live = request.mode === 'navigate' || [
    '/index.html','/app.js','/styles.css','/seedData.js','/planning2026.js',
    '/enhancements.js','/enhancements.css','/meldingen.js','/meldingen.css','/enquetes.js','/enquetes.css',
    '/manifest.webmanifest'
  ].includes(url.pathname);

  if (live) {
    event.respondWith((async () => {
      try {
        const response = await fetch(request, { cache: 'no-store' });
        if (response && response.ok) {
          const cache = await caches.open(CACHE);
          const key = request.mode === 'navigate' ? '/index.html' : url.pathname;
          await cache.put(key, response.clone());
        }
        return response;
      } catch (_) {
        const cache = await caches.open(CACHE);
        return (await cache.match(request.mode === 'navigate' ? '/index.html' : url.pathname)) || Response.error();
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(url.pathname);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response && response.ok) await cache.put(url.pathname, response.clone());
      return response;
    } catch (_) {
      return Response.error();
    }
  })());
});
