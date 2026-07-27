const CACHE_NAME = 'briego-v3';

self.addEventListener('install', (e) => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))));
  self.clients.claim();
});

// Manejador mínimo para que Chrome/Safari acepten la PWA como instalable
self.addEventListener('fetch', (event) => {
  // No interceptar nada, dejar que todo vaya a la red directamente
  return;
});
