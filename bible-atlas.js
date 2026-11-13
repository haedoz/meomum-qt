import {books} from './books.js';
import {places,journeys} from './atlas-data.js';
import {landRings} from './atlas-land.js';
const reference = ref => { const [book,chapter,verse]=ref.split('/'); return (Object.fromEntries(books)[book] ?? book)+' '+chapter+':'+verse; };
const safe = value => String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
let selected = journeys[0].id, group = journeys[0].group, step = 0, borders = false, viewport;
const enabled = new Set([selected]);
const routeColors = ['#3977b7','#a55a36','#718638','#9b5da7','#3d8c86','#be526c','#8c7643','#5261b0','#257f65','#a04e83','#9a722b','#677caa','#9c4545','#3c929d'];
const colorFor = id => routeColors[journeys.findIndex(route=>route.id===id)%routeColors.length];
const project = ([lon,lat])=>[lon,-lat*1.25];
const pathFor = points => points.map((point,index)=>(index?'L':'M')+project(point).join(',')).join(' ')+' Z';
const land = landRings.map(pathFor).join(' ');
export function atlasAction(target) {
  if (target.atlasGroup) { group=target.atlasGroup; return true; }
  if (target.atlasJourney && journeys.some(route=>route.id===target.atlasJourney)) {
    const id=target.atlasJourney;
    if(enabled.has(id)) enabled.delete(id);
    else { enabled.add(id);selected=id;step=0; }
    if(!enabled.has(selected) && enabled.size) {selected=[...enabled].at(-1);step=0;}
    viewport=undefined;return true;
  }
  if(target.atlasFocus && enabled.has(target.atlasFocus)) { selected=target.atlasFocus;step=0;return true; }
  const route=journeys.find(route=>route.id===selected);
  if ('atlasStep' in target) {step=Math.max(0,Math.min(route.steps.length-1,step+Number(target.atlasStep)));viewport=undefined;return true;}
  if (target.atlasReset) {viewport=undefined;return true;}
  if (target.atlasBorder) {borders=!borders;return true;}
  return false;
}
export function atlasScreen() {
  const route=journeys.find(route=>route.id===selected);
  const groups=[...new Set(journeys.map(item=>item.group))];
  const points=route.steps.map(item=>project(places[item.place].slice(1)));
  const visible=journeys.filter(item=>enabled.has(item.id));
  const extent=visible.length?visible.flatMap(item=>item.steps.map(stop=>project(places[stop.place].slice(1)))):points;
  const minX=Math.min(...extent.map(p=>p[0])),maxX=Math.max(...extent.map(p=>p[0]));
  const minY=Math.min(...extent.map(p=>p[1])),maxY=Math.max(...extent.map(p=>p[1]));
  const width=Math.max(2,(maxX-minX)*1.32),height=Math.max(2.4,(maxY-minY)*1.32,width*.65);
  if(!viewport) {
    const w=Math.max(width,height*1.3),h=Math.max(height,width*.65);
    viewport=[(minX+maxX-w)/2,(minY+maxY-h)/2,w,h];
  }
  const viewBox=viewport.join(' '),frameWidth=viewport[2];
  const radius=frameWidth/68,font=frameWidth/48;
  const active=route.steps[step],place=places[active.place];
  // The envelope is a general north–south overview, never a modern border claim.
  const envelope=[[35.65,33.25],[35.85,32.6],[35.55,31.6],[34.80,31.25],[34.5,31.5],[34.95,32.3],[35.1,33.1]];
  const pinGroups=route.steps.map((entry,index)=>{
    const p=points[index];
    return '<g class="atlas-pin '+(index===step?'active':'')+'" data-atlas-pin="'+index+'" role="button" tabindex="0" aria-label="'+(index+1)+'. '+safe(places[entry.place][0])+'" transform="translate('+p.join(',')+')">'+
      '<circle r="'+radius*3.4+'" class="atlas-hit"/><circle r="'+radius+'"/><text text-anchor="middle" dy=".34em" font-size="'+font*.63+'">'+(index+1)+'</text></g>';
  });
  // Put the active pin last so repeat visits at the same coordinates remain selectable.
  const activePin=pinGroups.splice(step,1)[0];
  const geography=[[33,34,'지중해'],[32,39,'소아시아'],[43,34,'메소포타미아'],[30,28,'애굽'],[35.5,30.8,'가나안'],[13,42,'이탈리아'],[23,41.4,'마게도냐']].map(([x,y,label])=>'<text class="atlas-region-label" x="'+x+'" y="'+(-y*1.25)+'" text-anchor="middle" font-size="'+font*.8+'">'+label+'</text>').join('');
  return '<header class="page-heading"><p class="eyebrow">BIBLE ATLAS</p><h1>성경 지도</h1><p class="lead">지도를 밀어 이동하고 두 손가락으로 확대하세요. 여러 여정을 켜서 함께 볼 수 있어요.</p></header>'+
    '<nav class="atlas-groups" aria-label="지도 주제">'+groups.map(name=>'<button type="button" data-atlas-group="'+safe(name)+'" aria-pressed="'+(group===name)+'">'+safe(name)+'</button>').join('')+'</nav>'+
    '<nav class="atlas-journeys" aria-label="여정 선택">'+journeys.filter(item=>item.group===group).map(item=>'<button type="button" class="btn" data-atlas-journey="'+item.id+'" aria-pressed="'+enabled.has(item.id)+'">'+'<span class="atlas-color-dot" style="background:'+colorFor(item.id)+'"></span>'+safe(item.title)+'</button>').join('')+'</nav>'+
    '<div class="atlas-layer-list" aria-label="표시 중인 여정">'+visible.map(item=>'<button type="button" data-atlas-focus="'+item.id+'" aria-pressed="'+(selected===item.id)+'"><span class="atlas-color-dot" style="background:'+colorFor(item.id)+'"></span>'+safe(item.title)+'</button>').join('')+'</div>'+
    '<section class="atlas-map-card"><header class="row"><h2>'+(visible.length?visible.length+'개 여정 표시':'표시할 여정을 골라주세요')+'</h2><button type="button" class="text-action" data-atlas-border="toggle" aria-pressed="'+(borders || selected==='borders')+'">경계 개요</button></header>'+
    '<svg class="atlas-map" viewBox="'+viewBox+'" role="group" aria-label="'+safe(route.title)+' 지도"><title>'+safe(route.title)+'</title><path class="atlas-land" d="'+land+'"/>'+geography+
    ((borders || selected==='borders')?'<path class="atlas-boundary" d="'+pathFor(envelope)+'"/>':'')+
    visible.map(item=>'<polyline class="atlas-route" style="stroke:'+colorFor(item.id)+'" points="'+item.steps.map(stop=>project(places[stop.place].slice(1)).join(',')).join(' ')+'"/>'+ (item.id===selected?'':item.steps.map(stop=>'<circle class="atlas-layer-pin" style="fill:'+colorFor(item.id)+'" cx="'+places[stop.place][1]+'" cy="'+(-places[stop.place][2]*1.25)+'" r="'+radius*.55+'"/>').join(''))).join('')+
    (enabled.has(selected)?pinGroups.join('')+activePin+'<text class="atlas-place-label" x="'+points[step][0]+'" y="'+(points[step][1]-radius*1.7)+'" text-anchor="middle" font-size="'+font+'">'+safe(place[0])+'</text>':'')+'</svg>'+
    '<div class="atlas-controls"><span class="muted">드래그 · 두 손가락 확대/축소 · 마우스 휠</span><button type="button" class="btn" data-atlas-reset="all">전체 보기</button></div>'+
    '<p class="atlas-legend"><span>● 장소</span><span>┄ 대표 이동 순서 · 점선은 실제 도로·항로를 확정하지 않음</span></p></section>'+
    '<section '+(!enabled.has(selected)?'hidden ':'')+'class="card atlas-detail" aria-live="polite"><div class="row"><span class="reading-badge">'+(step+1)+' / '+route.steps.length+'</span><span class="muted">'+safe(route.group)+'</span></div><h2>'+safe(place[0])+'</h2><p>'+safe(active.text)+'</p><button type="button" class="note-link" data-atlas-ref="'+active.ref+'">'+safe(reference(active.ref))+' 읽기 →</button><div class="row atlas-pagination"><button class="btn" data-atlas-step="-1" '+(step===0?'disabled':'')+'>← 이전 장소</button><button class="btn" data-atlas-step="1" '+(step===route.steps.length-1?'disabled':'')+'>다음 장소 →</button></div></section>'+
    '<details '+(!enabled.has(selected)?'hidden ':'')+'class="atlas-stop-list"><summary>전체 장소 목록 · '+route.steps.length+'곳</summary>'+route.steps.map((entry,index)=>'<button type="button" data-atlas-go="'+index+'" aria-current="'+(step===index?'step':'false')+'">'+(index+1)+'. '+safe(places[entry.place][0])+'</button>').join('')+'</details>';
}
export function mountAtlas(root,redraw) {
  enableMapGestures(root.querySelector('.atlas-map'),redraw);
  const choose=index=>{step=Number(index);redraw();root.querySelector('.atlas-detail h2')?.scrollIntoView({block:'nearest'});};
  root.querySelectorAll('[data-atlas-pin]').forEach(pin=>{
    pin.addEventListener('click',()=>{if(Date.now()>=ignorePinUntil)choose(pin.dataset.atlasPin);});
    pin.addEventListener('keydown',event=>{if(event.key==='Enter' || event.key===' '){event.preventDefault();choose(pin.dataset.atlasPin);}});
  });
  root.querySelectorAll('[data-atlas-go]').forEach(button=>button.addEventListener('click',()=>choose(button.dataset.atlasGo)));
}

let ignorePinUntil=0;
function enableMapGestures(map,redraw) {
  const pointers=new Map();
  let start, moved=false, wheelTimer;
  const sample=()=>{
    const values=[...pointers.values()];
    const a=values[0],b=values[1] ?? a;
    return {x:(a.x+b.x)/2,y:(a.y+b.y)/2,distance:Math.hypot(a.x-b.x,a.y-b.y)};
  };
  const begin=()=>{
    if(!pointers.size) {start=undefined;return;}
    start={...sample(),frame:[...viewport],inverse:map.getScreenCTM().inverse()};
  };
  const apply=(center,factor)=>{
    const origin=new DOMPoint(start.x,start.y).matrixTransform(start.inverse);
    const current=new DOMPoint(center.x,center.y).matrixTransform(start.inverse);
    const [x,y,w,h]=start.frame;
    const scale=Math.max(.03,Math.min(40,w/factor))/w;
    viewport=[origin.x-(current.x-x)*scale,origin.y-(current.y-y)*scale,w*scale,h*scale];
    map.setAttribute('viewBox',viewport.join(' '));
  };
  map.addEventListener('pointerdown',event=>{
    if(event.pointerType==='mouse' && event.button!==0)return;
    pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    // Capture on the pressed pin so a tap can still activate that pin.
    event.target.setPointerCapture?.(event.pointerId);
    if(pointers.size>1)moved=true;
    begin();
  });
  map.addEventListener('pointermove',event=>{
    if(!pointers.has(event.pointerId) || !start)return;
    pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    const now=sample();
    if(Math.hypot(now.x-start.x,now.y-start.y)>3 || pointers.size>1)moved=true;
    if(moved)apply(now,start.distance>0 && pointers.size>1?now.distance/start.distance:1);
  });
  const finish=event=>{
    if(!pointers.delete(event.pointerId))return;
    if(pointers.size)begin();
    else {
      if(moved){ignorePinUntil=Date.now()+400;redraw();}
      start=undefined;moved=false;
    }
  };
  map.addEventListener('pointerup',finish);
  map.addEventListener('pointercancel',finish);
  map.addEventListener('wheel',event=>{
    event.preventDefault();event.stopPropagation();
    start={x:event.clientX,y:event.clientY,frame:[...viewport],inverse:map.getScreenCTM().inverse()};
    apply(start,Math.exp(-Math.max(-100,Math.min(100,event.deltaY))*.008));
    clearTimeout(wheelTimer);
    wheelTimer=setTimeout(()=>{if(map.isConnected)redraw();},140);
  },{passive:false});
}
