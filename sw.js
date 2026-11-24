const version = "meomum-pages-v342";
const paths = ["./", "./app-loader.js", "./app-loader.js?v=342", "./app.js", "./app.js?v=342", "./atlas-data.js", "./atlas-data.js?v=3", "./atlas-geography.js", "./atlas-overlays.js", "./bdb.js", "./bdb.js?v=38", "./bible-atlas.js", "./bible-atlas.js?v=9", "./books.js", "./daily-verse-refs.js", "./daily-verse-refs.js?v=1", "./fonts/NotoSansKR-VariableFont_wght.ttf", "./fonts/Paperlogy-4Regular.ttf", "./fonts/PretendardVariable.woff2", "./hebrew-calendar.js", "./hebrew-calendar.js?v=6", "./hebrew-guide.js", "./hebrew-guide.js?v=10", "./index.html", "./landscape.svg", "./offline-sync.js", "./offline-sync.js?v=2", "./torah-data.js", "./torah-calendar-days.js", "./vendor/torah-aliyot.js", "./torah-schedule.js", "./study-library.js", "./study-content.js", "./spirit-study.js", "./spirit-study-data.js", "./style.css?v=342", "./vendor/hebcal.mjs", "./vendor/sql-wasm.mjs", "./vendor/sql-wasm.wasm", "./canaan-map.js", "./app-updates.js", "./logbible-logo.svg", "./icon-180-v3.png", "./icon-192-v3.png", "./icon-512-v3.png", "./manifest.webmanifest?v=6"];
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const cache=await caches.open(version);
 const urls=[...new Set(paths.map(path=>new URL(path,self.registration.scope).href))];
 try{await cache.addAll(urls.map(url=>new Request(url,{cache:'reload'})));}catch(error){await caches.delete(version);throw error;}
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
  event.respondWith(fetch(new Request(request,{cache:'no-store'})).then(async response=>{if(response.ok){const cache=await caches.open(version);await cache.put(new URL('./index.html',self.registration.scope),response.clone());}return response;}).catch(async()=>{
   const cache=await caches.open(version);
   return await cache.match(new URL('./index.html',self.registration.scope))||await cache.match(new URL('./',self.registration.scope));
  }));return;
 }
 if(!/\.(?:pdf|js|mjs|css|wasm|woff2?|ttf|svg|png|webmanifest)$/.test(url.pathname))return;
 event.respondWith((async()=>{
  const cache=await caches.open(version);
  const saved=await cache.match(request)||(!url.search?await cache.match(request,{ignoreSearch:true}):null);
  if(saved)return saved;
  const response=await fetch(request);
  if(response.ok)await cache.put(request,response.clone());
  return response;
 })());
});

self.addEventListener('message',event=>{if(event.data?.type==='APP_VERSION')event.ports?.[0]?.postMessage({version});if(event.data?.type==='ACTIVATE_UPDATE')event.waitUntil(self.skipWaiting());});
