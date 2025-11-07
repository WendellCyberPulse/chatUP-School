self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open('chatup-cache').then((cache) => {
      return cache.addAll([
        './',
        './index.html',
        './chat.html',
        './chat.css',
        './chat.js'
      ]);
    })
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => response || fetch(e.request))
  );
});
