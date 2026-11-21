// Indoor Rating Studio V3 Beta: static offline assets only.
// Bump CACHE_NAME when changing the app's offline asset set.
const CACHE_NAME = 'indoor-studio-v3-beta-nomads-comparison-18';
const APP_FILES = [
  './',
  './index.html',
  './style.css',
  './roster.css',
  './roster-redesign.css',
  './team-theme.css',
  './mobile.css',
  './mobile-nav.js',
  './ratings.js',
  './storage.js',
  './script.js',
  './roster.js',
  './comparison.js',
  './comparison.css',
  './pwa.js',
  './manifest.webmanifest',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(APP_FILES.map(file => new URL(file, self.registration.scope)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith('indoor-studio-') && name !== CACHE_NAME).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const requestUrl = new URL(event.request.url);
  const scopeUrl = new URL(self.registration.scope);
  // Never intercept external sources, exports (blob: URLs), or unrelated site paths.
  if (requestUrl.origin !== scopeUrl.origin || !requestUrl.pathname.startsWith(scopeUrl.pathname)) return;

  // Network first: when online, pick up new GitHub Pages uploads; use saved assets offline.
  event.respondWith((async () => {
    try {
      const response = await fetch(event.request);
      if (response.ok) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(event.request, response.clone());
      }
      return response;
    } catch (_) {
      const cached = await caches.match(event.request, { ignoreSearch: true });
      if (cached) return cached;
      if (event.request.mode === 'navigate') {
        const fallback = await caches.match(new URL('./index.html', self.registration.scope));
        if (fallback) return fallback;
      }
      return Response.error();
    }
  })());
});
