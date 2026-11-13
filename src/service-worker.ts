const CACHE_NAME = 'album-bd-shell-v1';
const RUNTIME_CACHE = 'album-bd-runtime-v1';
const MEDIA_CACHE = 'album-bd-media-v1';
const OFFLINE_URL = '/index.html';
const MAX_MEDIA_CACHE_ITEMS = 120; // Límite inteligente para proteger memoria y almacenamiento

// Limpiador de caché LRU (purga los archivos multimedia más antiguos cuando excede la capacidad)
async function cleanOldestMediaCache() {
  try {
    const cache = await caches.open(MEDIA_CACHE);
    const keys = await cache.keys();
    if (keys.length > MAX_MEDIA_CACHE_ITEMS) {
      const itemsToDelete = keys.length - MAX_MEDIA_CACHE_ITEMS;
      for (let i = 0; i < itemsToDelete; i++) {
        await cache.delete(keys[i]);
      }
    }
  } catch (e) {
    // Ignorar
  }
}

self.addEventListener('install', (event: any) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll([
      '/',
      OFFLINE_URL,
    ]))
  );
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event: any) => {
  event.waitUntil(
    caches.keys().then((keys: string[]) =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME && key !== RUNTIME_CACHE && key !== MEDIA_CACHE)
          .map(key => caches.delete(key))
      )
    )
  );
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event: any) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const requestUrl = new URL(request.url);

  // ESTRATEGIA CACHE-FIRST PARA MULTIMEDIA (/api/media-file/)
  // Carga instantánea desde caché local sin repetir peticiones al servidor
  if (requestUrl.pathname.includes('/api/media-file/')) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(request).then((response: Response) => {
          if (response.ok || response.status === 206) {
            const copy = response.clone();
            caches.open(MEDIA_CACHE).then((cache) => {
              cache.put(request, copy).then(() => cleanOldestMediaCache());
            });
          }
          return response;
        }).catch(() => {
          return new Response('', { status: 404, statusText: 'Offline media unavailable' });
        });
      })
    );
    return;
  }

  // SPA Shell / Navegaciones
  if (requestUrl.origin === self.location.origin && request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response: Response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(OFFLINE_URL, copy));
          return response;
        })
        .catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }

  // Recursos estáticos
  if (request.destination === 'script' || request.destination === 'style' || request.destination === 'image') {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;
        return fetch(request)
          .then((response: Response) => {
            const copy = response.clone();
            caches.open(RUNTIME_CACHE).then(cache => cache.put(request, copy));
            return response;
          })
          .catch(() => caches.match(request));
      })
    );
    return;
  }

  // Lista de archivos API JSON
  if (requestUrl.pathname.includes('/api/media')) {
    event.respondWith(
      fetch(request)
        .then((response: Response) => {
          const copy = response.clone();
          caches.open(RUNTIME_CACHE).then(cache => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }
});
