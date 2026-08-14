// Service worker פשוט: שומר את שלד האפליקציה במטמון כדי שהיא תיפתח גם ללא אינטרנט
// (הנתונים עצמם תמיד ב-localStorage, לא כאן). כל שינוי בקבצים דורש עדכון CACHE_VERSION.
const CACHE_VERSION = 'cyclesync-v1';
const APP_SHELL = ['./', './index.html', './style.css', './app.js', './cycleEngine.js', './store.js', './manifest.json', './icons/icon-192.png', './icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return; // CDN בקשות (Chart.js/פונטים) עוברות ישר לרשת

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
