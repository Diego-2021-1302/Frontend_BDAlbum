// Service Worker minimalista para permitir la instalación PWA sin interferir con la red
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => self.clients.claim());

self.addEventListener('fetch', (event) => {
  // Dejamos que las peticiones pasen directamente al servidor sin interceptarlas
  return;
});
