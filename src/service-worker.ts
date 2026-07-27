const CACHE_NAME = 'album-bd-shell-v1';
const RUNTIME_CACHE = 'album-bd-runtime-v1';
const OFFLINE_URL = '/index.html';

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
          .filter(key => key !== CACHE_NAME && key !== RUNTIME_CACHE)
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
  const isSameOrigin = requestUrl.origin === self.location.origin;

  if (isSameOrigin && request.mode === 'navigate') {
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

  if (isSameOrigin && (request.destination === 'script' || request.destination === 'style' || request.destination === 'image')) {
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

  if (request.url.includes('/api/media')) {
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

  event.respondWith(
    fetch(request)
      .then((response: Response) => {
        const copy = response.clone();
        caches.open(RUNTIME_CACHE).then(cache => cache.put(request, copy));
        return response;
      })
      .catch(() => caches.match(request))
  );
});
