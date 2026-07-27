export function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/src/service-worker.ts')
        .then((registration) => {
          console.log('Service Worker registered:', registration);
        })
        .catch((error) => {
          console.error('Service Worker registration failed:', error);
        });
    });
  }
}
