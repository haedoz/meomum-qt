import {books} from './books.js';
import {places,journeys,placeNotes} from './atlas-data.js?v=3';
import {historicalOverlays} from './atlas-overlays.js';
import {landRings,lakeRings,modernRegions} from './atlas-geography.js';
const titles=Object.fromEntries(books);
const reference=ref=>{const [book,chapter,verse]=ref.split('/');return titles[book]+' '+chapter+':'+verse;};
const safe=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const routes=journeys.filter(item=>item.id!=='borders');
let selected=routes[0].id,group=routes[0].group,step=0,viewport;
let minMapWidth=.03,maxMapWidth=65;
const enabled=new Set([selected]);
const boundaries=new Set();
let passageText=()=>'';
let openPanel='';
const colors=['#176db1','#b6532e','#648528','#8b52ab','#16887b','#c14673','#a07b1b','#485fc3','#008357','#a44693','#a66013','#596da2','#af3e3e'];
const colorFor=id=>colors[routes.findIndex(item=>item.id===id)%colors.length];
const project=([x,y])=>[x,-y*1.25];
const pathFor=points=>points.map((p,i)=>(i?'L':'M')+project(p).join(',')).join(' ')+' Z';
const mapUnit=()=>Math.max(viewport[2]/Math.max(280,Math.min(760,(globalThis.innerWidth ?? 390)-48)),viewport[3]/460);
const land=landRings.map(pathFor).join(' '),lakes=lakeRings.map(pathFor).join(' ');
export function atlasAction(target) {
 if(target.atlasPanel){openPanel=openPanel===target.atlasPanel?'':target.atlasPanel;return true;}
 if(target.atlasBoundary){const id=target.atlasBoundary;if(boundaries.has(id))boundaries.delete(id);else boundaries.add(id);viewport=[34.0,-42.6,2.8,4.6];return true;}
 if(target.atlasGroup){group=target.atlasGroup;return true;}
 if(target.atlasJourney && routes.some(item=>item.id===target.atlasJourney)) {
  const id=target.atlasJourney;
  if(enabled.has(id))enabled.delete(id);else{enabled.add(id);selected=id;step=0;}
  if(!enabled.has(selected) && enabled.size){selected=[...enabled].at(-1);step=0;}
  viewport=undefined;return true;
 }
 if(target.atlasOnly && routes.some(item=>item.id===target.atlasOnly)){selected=target.atlasOnly;step=0;enabled.clear();enabled.add(selected);viewport=undefined;return true;}
 if(target.atlasFocus && enabled.has(target.atlasFocus)){selected=target.atlasFocus;step=0;return true;}
 if(target.atlasClear){enabled.clear();viewport=undefined;return true;}
 if('atlasStep' in target){const r=routes.find(item=>item.id===selected);step=Math.max(0,Math.min(r.steps.length-1,step+Number(target.atlasStep)));return true;}
 if(target.atlasReset){viewport=undefined;return true;}
 if(target.atlasLocate){const p=project(places[routes.find(r=>r.id===selected).steps[step].place].slice(1));viewport=[p[0]-1.1,p[1]-1.3,2.2,2.6];return true;}
 return false;
}
function fit(points){
 const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
 const x1=Math.min(...xs),x2=Math.max(...xs),y1=Math.min(...ys),y2=Math.max(...ys);
 const w=Math.max(2,(x2-x1)*1.30),h=Math.max(2.7,(y2-y1)*1.32);
 return [(x1+x2-w)/2,(y1+y2-h)/2,w,h];
}
function mapControls(){return '<div class="atlas-controls"><span class="muted">밀어서 이동 · 두 손가락 확대/축소</span><button class="btn" type="button" data-atlas-reset="all">전체 보기</button></div>';}
function chooser(visible){
 const groups=[...new Set(routes.map(r=>r.group))];
 return '<section class="atlas-selection-panel"><div class="row"><div><h2>선택 가능한 여정</h2><p>보고 싶은 여정을 골라 함께 비교해 보세요.</p></div><span class="reading-badge">'+visible.length+'개 표시</span></div>'+
 '<nav class="atlas-groups" aria-label="여정 분류">'+groups.map(name=>'<button type="button" data-atlas-group="'+name+'" aria-pressed="'+(group===name)+'">'+name+'</button>').join('')+'</nav>'+
 '<div class="atlas-choices">'+routes.filter(r=>r.group===group).map(r=>'<div class="atlas-choice"><button type="button" class="atlas-toggle" data-atlas-journey="'+r.id+'" aria-pressed="'+enabled.has(r.id)+'"><span class="atlas-choice-check" aria-hidden="true">'+(enabled.has(r.id)?'✓':'＋')+'</span><span class="atlas-color-dot" style="background:'+colorFor(r.id)+'"></span><span>'+safe(r.title)+'</span></button><button type="button" class="text-action" data-atlas-only="'+r.id+'">단독 보기</button></div>').join('')+'</div>'+
 '</section>';
}
function labelsFor(route,frameWidth){
 const seen=new Set(),pins=[];
 route.steps.forEach((entry,index)=>{if(!seen.has(entry.place)){seen.add(entry.place);pins.push({entry,index});}});
 const font=mapUnit()*12,radius=mapUnit()*7,used=[];
 return pins.map(({entry,index})=>{
  const [x,y]=project(places[entry.place].slice(1)),fullName=places[entry.place][0];
  const uncertain=/추정|대표|체류 지역|전통적/.test(fullName)||/추정|대표/.test(placeNotes[entry.place]?.confidence ?? '');
  const name=fullName.split(' · ')[0]+(uncertain?'*':'');
  const number=route.steps.map((stop,i)=>stop.place===entry.place?i+1:null).filter(Boolean).join('·');
  const labelText=name+(number.includes('·')?' ('+number+')':'');
  const width=[...labelText].reduce((n,c)=>n+(/[\u1100-\uD7FF]/.test(c)?1:.57),0)*font;
  let label={x:x+radius*1.7,y:y-radius*1.6};
  const offsets=[[1.7,-1.6],[1.7,2.8],[-1.7,-1.6],[-1.7,2.8],[1.7,-4.6],[1.7,5.8],[-1.7,-7.6],[1.7,8.8]];
  for(const [dx,dy] of offsets){
   const test={x:x+radius*dx-(dx<0?width:0),y:y+radius*dy};
   if(x>=viewport[0]&&x<=viewport[0]+viewport[2])test.x=Math.max(viewport[0]+font*.5,Math.min(viewport[0]+viewport[2]-width-font*.5,test.x));
   if(!used.some(b=>test.x<b.x+b.w && test.x+width>b.x && test.y-font<b.y && test.y>b.y-font*1.1)){label=test;break;}
  }
  used.push({...label,w:width});
  const active=route.steps[step].place===entry.place;
  return '<g class="atlas-pin '+(active?'active':'')+'" data-atlas-pin="'+index+'" role="button" tabindex="0" aria-label="'+safe(name)+'" transform="translate('+x+','+y+')"><circle class="atlas-hit" r="'+radius*2.8+'"/><circle r="'+radius+'"/><text dy=".35em" text-anchor="middle" font-size="'+font*.62+'">'+(index+1)+'</text></g>'+
   '<path class="atlas-label-leader" d="M'+x+','+y+' L'+label.x+','+(label.y-font*.35)+'"/>'+
   '<text class="atlas-place-label" x="'+label.x+'" y="'+label.y+'" font-size="'+font+'">'+safe(labelText)+'</text>';
 }).join('');
}
function geography(frameWidth){
 const labels=[[31.6,34.4,'지중해'],[32,39.1,'소아시아'],[43.1,34.8,'메소포타미아'],[30.2,28.8,'애굽'],[36.1,31.2,'가나안'],[13.2,42.0,'이탈리아'],[23,41.4,'마게도냐'],[34.1,27.9,'홍해']];
 return labels.map(([x,y,name])=>'<text class="atlas-region-label" x="'+x+'" y="'+(-y*1.25)+'" font-size="'+mapUnit()*14+'" text-anchor="middle">'+name+'</text>').join('');
}
function directionArrow(segment,color){
 const ps=segment.map(project),lengths=ps.slice(1).map((p,i)=>Math.hypot(p[0]-ps[i][0],p[1]-ps[i][1]));
 let distance=lengths.reduce((a,b)=>a+b,0)*.55;
 for(let i=0;i<lengths.length;i++){
  if(distance>lengths[i]){distance-=lengths[i];continue;}
  if(!lengths[i])continue;
  const a=ps[i],b=ps[i+1],t=distance/lengths[i],x=a[0]+(b[0]-a[0])*t,y=a[1]+(b[1]-a[1])*t,angle=Math.atan2(b[1]-a[1],b[0]-a[0])*180/Math.PI;
  return '<path class="atlas-direction" d="M-4 -3 1 0 -4 3" transform="translate('+x+' '+y+') rotate('+angle+') scale('+mapUnit()+')" style="stroke:'+color+'"/>';
 }
 return '';
}
function journeyScreen(){
 const visible=routes.filter(r=>enabled.has(r.id)),route=routes.find(r=>r.id===selected),active=route.steps[step];
 const points=(visible.length?visible:[route]).flatMap(r=>r.segments.flat().map(project));
 if(!viewport)viewport=fit(points);
 minMapWidth=.03;maxMapWidth=65;
 const paths=visible.map(r=>r.segments.map(segment=>'<polyline class="atlas-route" style="stroke:'+colorFor(r.id)+'" marker-end="url(#arrow-'+r.id+')" points="'+segment.map(project).map(p=>p.join(',')).join(' ')+'"/>'+directionArrow(segment,colorFor(r.id))).join('')+
 (r.id===selected?'':r.steps.map(stop=>{const [x,y]=project(places[stop.place].slice(1));return '<circle class="atlas-layer-pin" cx="'+x+'" cy="'+y+'" r="'+viewport[2]/150+'" style="fill:'+colorFor(r.id)+'"/>';}).join(''))).join('');
 const arrows='<defs>'+visible.map(r=>'<marker id="arrow-'+r.id+'" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="'+mapUnit()*7+'" markerHeight="'+mapUnit()*7+'" markerUnits="userSpaceOnUse" orient="auto"><path d="M1 1 9 5 1 9" style="fill:none;stroke:'+colorFor(r.id)+';stroke-width:1.7"/></marker>').join('')+'</defs>';
 const detail=enabled.has(selected)?'<section class="card atlas-detail" aria-live="polite"><div class="row"><span class="reading-badge">'+safe(route.title)+' · '+(step+1)+' / '+route.steps.length+'</span><button class="text-action" type="button" data-atlas-locate="true">이 장소 확대</button></div><h2>'+safe(places[active.place][0])+'</h2><p>'+safe(active.text)+'</p><span class="atlas-confidence">'+safe(placeNotes[active.place]?.confidence ?? '위치 추정')+'</span><button type="button" class="note-link" data-atlas-ref="'+active.ref+'">'+safe(reference(active.ref))+' 읽기 →</button><div class="row atlas-pagination"><button class="btn" data-atlas-step="-1" '+(!step?'disabled':'')+'>← 이전 사건</button><button class="btn" data-atlas-step="1" '+(step===route.steps.length-1?'disabled':'')+'>다음 사건 →</button></div></section>'+
 '<section class="card atlas-reading-guide"><h2>여정과 관련 말씀</h2><p>'+safe(route.description)+'</p><div class="atlas-scripture-links">'+[...new Set([route.steps[0].ref,route.steps.find(s=>s.place==='egypt')?.ref,route.steps.at(-1).ref].filter(Boolean))].map(ref=>passageCard(ref)).join('')+'</div></section>':'';
 return compactControls(visible)+(openPanel==='journeys'?chooser(visible):openPanel==='boundaries'?boundaryChooser():'')+'<section class="atlas-map-card"><header class="row"><h2>'+visible.length+'개 여정 함께 보기</h2><span class="atlas-map-key"><i class="sea"></i>바다 <i class="land"></i>육지</span></header><svg class="atlas-map atlas-journey-map" viewBox="'+viewport.join(' ')+'" role="group" aria-label="성경 여정 지도">'+arrows+'<path class="atlas-land" d="'+land+'"/><path class="atlas-lakes" d="'+lakes+'"/>'+boundaryShapes()+geography(viewport[2])+paths+(enabled.has(selected)?labelsFor(route,viewport[2]):'')+'</svg>'+mapControls()+boundaryLegend()+'<p class="atlas-legend">화살표는 이동 방향, 점선은 재구성한 이동권입니다. 중간 경로는 추정이며 포로기 가지선은 여러 유배 목적지를 나타냅니다. *는 위치 추정 또는 지역 대표점입니다.</p></section>'+detail;
}
function atlasIcon(type){
 const paths=type==='route'?'<circle cx="5" cy="6" r="2"/><circle cx="19" cy="18" r="2"/><path d="M7 6h6a4 4 0 0 1 0 8h-2a4 4 0 0 0 0 8"/>':'<path d="m12 3 10 6-10 6L2 9 12 3Zm-9 11 9 5 9-5M3 18l9 5 9-5"/>';
 return '<svg class="atlas-control-icon" viewBox="0 0 24 26" aria-hidden="true">'+paths+'</svg>';
}
function compactControls(visible){
 return '<section class="atlas-compact-controls"><div class="atlas-toolbar"><h1>성경 지도</h1><div><button type="button" data-atlas-panel="journeys" aria-expanded="'+(openPanel==='journeys')+'">'+atlasIcon('route')+'여정 선택 <span>'+visible.length+'</span> ⌄</button><button type="button" data-atlas-panel="boundaries" aria-expanded="'+(openPanel==='boundaries')+'">'+atlasIcon('layers')+'영역 <span>'+boundaries.size+'</span> ⌄</button></div></div><div class="atlas-active-strip" aria-label="선택한 여정">'+(visible.length?visible.map(r=>'<div class="atlas-layer-chip"><button type="button" data-atlas-focus="'+r.id+'" aria-pressed="'+(selected===r.id)+'"><span class="atlas-color-dot" style="background:'+colorFor(r.id)+'"></span>'+safe(r.title)+'</button><button type="button" data-atlas-journey="'+r.id+'" aria-label="'+safe(r.title)+' 숨기기">×</button></div>').join(''):'<span class="muted">여정을 선택해 지도에 표시해 보세요.</span>')+'</div></section>';
}
function passageCard(ref){
 const text=passageText(ref);
 return '<article class="atlas-passage"><div class="row"><strong>'+safe(reference(ref))+'</strong><button type="button" class="text-action" data-atlas-ref="'+ref+'">본문 이동 →</button></div><p>'+safe(text || '이 구절이 있는 성경 번역본을 추가하면 본문이 여기에 표시돼요.')+'</p></article>';
}
function boundaryChooser(){
 return '<section class="atlas-boundary-panel card"><h2>지도에 표시할 영역</h2><p>같은 지도 위에 영역을 겹쳐 볼 수 있어요.</p><div class="atlas-boundary-options">'+[['tribes','12지파'],['kingdoms','남유다·북이스라엘'],['modern','현대 이스라엘']].map(([id,title])=>'<button type="button" data-atlas-boundary="'+id+'" aria-pressed="'+boundaries.has(id)+'"><span aria-hidden="true">'+(boundaries.has(id)?'✓':'＋')+'</span> '+title+'</button>').join('')+'</div></section>';
}
function boundaryLegend(){
 return '<div class="atlas-boundary-legend">'+[...boundaries].map(id=>id==='tribes'?'12지파 · 전통적인 땅 분배 재구성':id==='kingdoms'?'기원전 8세기 · 파랑: 북이스라엘 / 붉은색: 남유다':'현대 지리 · 파랑: 이스라엘 / 보라: 팔레스타인(서안·가자)').map(text=>'<p>'+text+'</p>').join('')+'</div>';
}
function boundaryShapes(){
 let result='';
 for(const id of boundaries){
  if(id==='modern'){
   result+=modernRegions.filter(r=>['Israel','Palestine'].includes(r.id)).map(r=>'<path class="atlas-territory" fill="'+(r.id==='Israel'?'#3c91d3':'#ae72bd')+'" d="'+r.rings.map(pathFor).join(' ')+'"/>').join('');
   continue;
  }
  const layer=historicalOverlays[id];
  result+='<g transform="matrix('+layer.matrix.join(' ')+')">'+layer.shapes.map(shape=>'<path class="atlas-territory" fill="'+shape.fill+'" d="'+shape.d+'"/>').join('')+'</g>';
  result+=layer.labels.map(label=>'<text class="atlas-territory-label" x="'+label.x+'" y="'+label.y+'" font-size="'+mapUnit()*12+'">'+safe(label.name)+'</text>').join('');
 }
 return result;
}
export function atlasScreen(resolveText){
 if(typeof resolveText==='function')passageText=resolveText;
 return journeyScreen()+'<p class="atlas-credit">고대 영역은 역사 지도 도형을 지명 기준으로 맞춘 재구성 영역입니다. 정밀 경계선이 아닙니다. 12지파: Janz · Richardprins 외 (CC BY-SA 3.0). 왕국: Tobias Schäfer 87 (CC BY 4.0), 기원전 8세기. 현대 지리: Natural Earth 5.1.2. <a href="./ATLAS-CALENDAR-SOURCES.md" target="_blank" rel="noopener">자료 출처와 편집 기준</a></p>';
}
export function mountAtlas(root,redraw){
 enableMapGestures(root.querySelector('.atlas-map'),redraw);
 root.querySelectorAll('[data-atlas-pin]').forEach(pin=>{
  const choose=()=>{step=Number(pin.dataset.atlasPin);redraw();};
  pin.addEventListener('click',()=>{if(Date.now()>=ignorePinUntil)choose();});
  pin.addEventListener('keydown',event=>{if(event.key==='Enter' || event.key===' '){event.preventDefault();choose();}});
 });
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
    const scale=Math.max(minMapWidth,Math.min(maxMapWidth,w/factor))/w;
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
