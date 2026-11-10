const version = 'meomum-pages-v113';
const paths = ['./','./app.js?v=109','./books.js','./daily-verse-refs.js?v=1','./bdb.js?v=37','./vendor/sql-wasm.mjs','./vendor/sql-wasm.wasm','./style.css?v=98','./landscape.svg','./fonts/PretendardVariable.woff2','./manifest.webmanifest?v=4','./icon-192.png','./icon-512.png'];
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(version);
    await cache.addAll(paths.map(path => new Request(new URL(path,self.registration.scope),{cache:'reload'})));
    await self.skipWaiting();
  })());
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
    event.respondWith(fetch(event.request,{cache:'no-store'}).catch(() => caches.match('./')));
  } else if (paths.some(path => new URL(path, self.registration.scope).href === url.href)) {
    event.respondWith(caches.match(event.request).then(saved => saved || fetch(event.request)));
  }
});
