// PWA installation and offline registration only. No app UI or rating logic changes.
// A service worker cannot register on file://. The desktop HTML app still works normally.
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js', { scope: './' }).catch(() => {
      // Installation/offline support is optional; the app continues to work online.
    });
  });
}
