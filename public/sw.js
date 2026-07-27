const CACHE_NAME = 'briego-v2';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => caches.delete(cache))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // NO cachear las llamadas a la API de configuración ni al backend
  if (event.request.url.includes('/api/')) {
    return;
  }

  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});
