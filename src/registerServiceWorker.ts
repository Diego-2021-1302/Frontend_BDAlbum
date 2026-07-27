export function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      // Registramos el sw.js que está en la carpeta public
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('Service Worker registered for PWA:', registration.scope);
        })
        .catch((error) => {
          console.error('Service Worker registration failed:', error);
        });
    });
  }
}
