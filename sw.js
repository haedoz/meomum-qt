const version = "meomum-pages-v218";
const paths = ["./", "./app.js", "./app.js?v=218", "./atlas-data.js", "./atlas-data.js?v=3", "./atlas-geography.js", "./atlas-overlays.js", "./bdb.js", "./bdb.js?v=38", "./bible-atlas.js", "./bible-atlas.js?v=9", "./books.js", "./daily-verse-refs.js", "./daily-verse-refs.js?v=1", "./fonts/NotoSansKR-VariableFont_wght.ttf", "./fonts/Paperlogy-4Regular.ttf", "./fonts/PretendardVariable.woff2", "./hebrew-calendar.js", "./hebrew-calendar.js?v=4", "./hebrew-guide.js", "./hebrew-guide.js?v=8", "./icon-192.png", "./icon-512.png", "./index.html", "./landscape.svg", "./manifest.webmanifest?v=4", "./offline-sync.js", "./torah-data.js", "./style.css?v=218", "./vendor/hebcal.mjs", "./vendor/sql-wasm.mjs", "./vendor/sql-wasm.wasm"];
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const cache=await caches.open(version);
 await cache.addAll(paths.map(path=>new Request(new URL(path,self.registration.scope),{cache:'reload'})));
 await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 for(const key of await caches.keys())if(key.startsWith('meomum-pages-')&&key!==version)await caches.delete(key);
 await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin)return;
 if(request.mode==='navigate'){
  event.respondWith(fetch(request).catch(async()=>{
   const cache=await caches.open(version);
   return await cache.match(new URL('./',self.registration.scope))||await cache.match(new URL('./index.html',self.registration.scope));
  }));return;
 }
 if(!/\.(?:js|mjs|css|wasm|woff2?|ttf|svg|png|webmanifest)$/.test(url.pathname))return;
 event.respondWith((async()=>{
  const cache=await caches.open(version);
  const saved=await cache.match(request)||await cache.match(request,{ignoreSearch:true});
  if(saved)return saved;
  const response=await fetch(request);
  if(response.ok)await cache.put(request,response.clone());
  return response;
 })());
});
