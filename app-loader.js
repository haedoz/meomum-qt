// Prepare the current shell before revealing the application; no visible reload cycle.
const build=new URL(import.meta.url).searchParams.get('v')||'336';
const expected='meomum-pages-v'+build;
const workerVersion=worker=>new Promise(resolve=>{
 if(!worker)return resolve(null);
 const channel=new MessageChannel(),timer=setTimeout(()=>{channel.port1.close();resolve(null);},1200);
 channel.port1.onmessage=event=>{clearTimeout(timer);channel.port1.close();resolve(event.data?.version??null);};
 try{worker.postMessage({type:'APP_VERSION'},[channel.port2]);}catch{clearTimeout(timer);resolve(null);}
});
async function prepareWorker(){
 if(!('serviceWorker' in navigator))return;
 const controlled=Boolean(navigator.serviceWorker.controller);
 const registration=await navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'});
 // A first installation has no older worker that could serve outdated modules.
 if(!controlled||navigator.onLine===false)return;
 if(await workerVersion(navigator.serviceWorker.controller)===expected)return;
 await new Promise(resolve=>{
  let done=false;
  const finish=()=>{if(done)return;done=true;clearTimeout(timer);navigator.serviceWorker.removeEventListener('controllerchange',changed);registration.removeEventListener('updatefound',found);resolve();};
  const changed=async()=>{if(await workerVersion(navigator.serviceWorker.controller)===expected)finish();};
  const watch=worker=>{if(!worker)return;const check=()=>{if(worker.state==='activated')changed();if(worker.state==='redundant')finish();};worker.addEventListener('statechange',check);check();};
  const found=()=>watch(registration.installing);
  const timer=setTimeout(finish,30000);
  navigator.serviceWorker.addEventListener('controllerchange',changed);
  registration.addEventListener('updatefound',found);
  watch(registration.installing);
  if(registration.waiting)registration.waiting.postMessage({type:'ACTIVATE_UPDATE'});
  registration.update().then(changed).catch(finish);
  changed();
 });
}
try{
 // Refresh the worker in the background; opening the app must not wait for an update.
 void prepareWorker().catch(()=>{});
 const stylesheet=document.querySelector('link[data-app-style]');
 const loaded=stylesheet.sheet?Promise.resolve():new Promise((resolve,reject)=>{stylesheet.addEventListener('load',resolve,{once:true});stylesheet.addEventListener('error',()=>reject(Error('화면 스타일을 불러오지 못했어요.')),{once:true});});
 await loaded;
 await import('./app.js?v='+build);
}catch(error){
 const main=document.getElementById('main');main.replaceChildren();const p=document.createElement('p');p.textContent='앱을 여는 중 연결이 끊겼어요. 다시 시도해 주세요.';const button=document.createElement('button');button.type='button';button.className='btn';button.textContent='다시 열기';button.onclick=()=>location.reload();main.append(p,button);
}finally{document.documentElement.classList.remove('app-booting');}
