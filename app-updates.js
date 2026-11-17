// Refresh the application shell without touching journals, Bibles, tokens, or drafts.
export function startAppUpdates({version,beforeReload=async()=>true}){
 if(!('serviceWorker' in navigator))return;
 let registration,checking=false,reloading=false,lastCheck=0,pending=false;
 const workerVersion=worker=>new Promise(resolve=>{
  if(!worker)return resolve(null);
  const channel=new MessageChannel(),timer=setTimeout(()=>{channel.port1.close();resolve(null);},1800);
  channel.port1.onmessage=event=>{clearTimeout(timer);channel.port1.close();resolve(event.data?.version ?? null);};
  try{worker.postMessage({type:'APP_VERSION'},[channel.port2]);}catch{clearTimeout(timer);channel.port1.close();resolve(null);}
 });
 const safeToReload=()=>!document.hidden&&!document.querySelector('dialog[open]')&&!document.documentElement?.dataset.filePickerOpen&&!document.activeElement?.matches('input,textarea,[contenteditable="true"]')&&!document.querySelector('#main textarea,form[data-thought-editor],form[data-prayer-editor],form[data-daily-note],form[data-torah-note]');
 async function apply(){
  if(reloading||!pending||!safeToReload())return;
  reloading=true;
  try{if(await beforeReload()===false){reloading=false;return;}location.reload();}catch{reloading=false;}
 }
 async function compare(){
  const installed=await workerVersion(navigator.serviceWorker.controller);
  const shellVersion=document.querySelector('meta[name=app-version]')?.content;
  const newer=Number(installed?.match(/v(\d+)$/)?.[1])>Number(version.match(/v(\d+)$/)?.[1]);
  if(installed&&(newer||(installed===version&&shellVersion!==version))){pending=true;await apply();}
 }
 async function check(force=false){
  if(checking||navigator.onLine===false||document.hidden||!registration)return;
  if(!force&&Date.now()-lastCheck<60000)return;
  checking=true;lastCheck=Date.now();
  try{await registration.update();await compare();}catch{}finally{checking=false;}
 }
 navigator.serviceWorker.addEventListener('controllerchange',compare);
 navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).then(reg=>{
  registration=reg;
  if(reg.waiting)reg.waiting.postMessage({type:'ACTIVATE_UPDATE'});
  reg.addEventListener('updatefound',()=>{
   const worker=reg.installing;if(!worker)return;
   worker.addEventListener('statechange',()=>{if(worker.state==='installed'&&reg.waiting)reg.waiting.postMessage({type:'ACTIVATE_UPDATE'});if(worker.state==='activated')compare();});
  });
  navigator.storage?.persist?.().catch(()=>{});
  compare();check(true);
 }).catch(()=>{});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden){apply();check();}});
 window.addEventListener('pageshow',()=>{apply();check();});
 window.addEventListener('online',()=>check(true));
 document.addEventListener('focusout',()=>setTimeout(apply,0));
 // A reader may leave an editor without a full page navigation.
 window.addEventListener('hashchange',()=>setTimeout(apply,0));
}
