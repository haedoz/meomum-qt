const version = 'meomum-pages-v52';
const paths = ['./','./app.js?v=52','./books.js','./bdb.js?v=35','./vendor/sql-wasm.mjs','./vendor/sql-wasm.wasm','./style.css?v=50','./landscape.svg','./fonts/PretendardVariable.woff2','./manifest.webmanifest','./icon-192.png','./icon-512.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(version).then(cache => cache.addAll(paths)));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith('meomum-pages-') && key !== version) await caches.delete(key);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.match('./')));
  } else if (paths.some(path => new URL(path, self.registration.scope).href === url.href)) {
    event.respondWith(caches.match(event.request).then(saved => saved || fetch(event.request)));
  }
});
