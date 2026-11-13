import {books} from './books.js';
import {places,journeys,placeNotes} from './atlas-data.js?v=2';
import {landRings,lakeRings,modernRegions} from './atlas-geography.js';
const titles=Object.fromEntries(books);
const reference=ref=>{const [book,chapter,verse]=ref.split('/');return titles[book]+' '+chapter+':'+verse;};
const safe=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const routes=journeys.filter(item=>item.id!=='borders');
let selected=routes[0].id,group=routes[0].group,step=0,viewport,mode='journeys';
let minMapWidth=.03,maxMapWidth=65;
const enabled=new Set([selected]);
const colors=['#176db1','#b6532e','#648528','#8b52ab','#16887b','#c14673','#a07b1b','#485fc3','#008357','#a44693','#a66013','#596da2','#af3e3e'];
const colorFor=id=>colors[routes.findIndex(item=>item.id===id)%colors.length];
const project=([x,y])=>[x,-y*1.25];
const pathFor=points=>points.map((p,i)=>(i?'L':'M')+project(p).join(',')).join(' ')+' Z';
const mapUnit=()=>Math.max(viewport[2]/Math.max(280,Math.min(760,(globalThis.innerWidth ?? 390)-48)),viewport[3]/460);
const land=landRings.map(pathFor).join(' '),lakes=lakeRings.map(pathFor).join(' ');
const mapModes=[['journeys','성경 여정'],['tribes','12지파'],['kingdoms','남유다·북이스라엘'],['modern','현대 이스라엘']];
const history={
 tribes:{title:'12지파의 땅 분배',size:[2168,3300],file:'tribes-ko.svg',description:'여호수아 13–19장에 따른 전통적인 분배 재구성도입니다. 실제 점령 범위와 일치한다는 뜻은 아닙니다. 단의 북쪽 이동 이전을 나타냅니다.',ref:'JOS/13/7',credit:'Janz · Richardprins 외, 한국어판 정리 · CC BY-SA 3.0',url:'https://commons.wikimedia.org/wiki/File:12_Tribes_of_Israel_Map.svg'},
 kingdoms:{title:'남유다와 북이스라엘 · 기원전 8세기',size:[2369,3070],file:'kingdoms-ko.svg',description:'기원전 8세기를 대상으로 한 역사 재구성도입니다. 두 왕국의 범위는 시대에 따라 변했으므로 모든 시대를 대표하는 고정 경계로 읽지 않습니다.',ref:'1KI/12/20',credit:'Tobias Schäfer 87 · Finkelstein (2013), p.2 기반 · CC BY 4.0 · 한국어 표기 편집',url:'https://commons.wikimedia.org/wiki/File:Kingdoms_of_Israel_and_Judah_(8th_century_BCE).svg'}
};
export function atlasAction(target) {
 if(target.atlasMode && mapModes.some(([id])=>id===target.atlasMode)){mode=target.atlasMode;viewport=undefined;return true;}
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
 return '<section class="atlas-selection-panel"><div class="row"><div><h2>함께 볼 여정</h2><p>체크하면 지도에 추가돼요. 여러 개를 선택할 수 있어요.</p></div><span class="reading-badge">'+visible.length+'개 표시</span></div>'+
 '<nav class="atlas-groups" aria-label="여정 분류">'+groups.map(name=>'<button type="button" data-atlas-group="'+name+'" aria-pressed="'+(group===name)+'">'+name+'</button>').join('')+'</nav>'+
 '<div class="atlas-choices">'+routes.filter(r=>r.group===group).map(r=>'<div class="atlas-choice"><button type="button" class="atlas-toggle" data-atlas-journey="'+r.id+'" aria-pressed="'+enabled.has(r.id)+'"><span class="atlas-choice-check" aria-hidden="true">'+(enabled.has(r.id)?'✓':'＋')+'</span><span class="atlas-color-dot" style="background:'+colorFor(r.id)+'"></span><span>'+safe(r.title)+'</span></button><button type="button" class="text-action" data-atlas-only="'+r.id+'">단독 보기</button></div>').join('')+'</div>'+
 '<div class="atlas-layer-list" aria-label="표시 중인 여정">'+visible.map(r=>'<div class="atlas-layer-chip"><button type="button" data-atlas-focus="'+r.id+'" aria-pressed="'+(selected===r.id)+'"><span class="atlas-color-dot" style="background:'+colorFor(r.id)+'"></span>'+safe(r.title)+'</button><button type="button" data-atlas-journey="'+r.id+'" aria-label="'+safe(r.title)+' 숨기기">×</button></div>').join('')+'</div></section>';
}
function labelsFor(route,frameWidth){
 const seen=new Set(),pins=[];
 route.steps.forEach((entry,index)=>{if(!seen.has(entry.place)){seen.add(entry.place);pins.push({entry,index});}});
 const font=mapUnit()*12,radius=mapUnit()*7,used=[];
 return pins.map(({entry,index})=>{
  const [x,y]=project(places[entry.place].slice(1)),name=places[entry.place][0];
  const number=route.steps.map((stop,i)=>stop.place===entry.place?i+1:null).filter(Boolean).join('·');
  const width=Math.min(name.length,22)*font*.57;
  let label={x:x+radius*1.7,y:y-radius*1.6};
  const offsets=[[1.7,-1.6],[1.7,2.8],[-1.7,-1.6],[-1.7,2.8],[1.7,-4.6],[1.7,5.8],[-1.7,-7.6],[1.7,8.8]];
  for(const [dx,dy] of offsets){
   const test={x:x+radius*dx-(dx<0?width:0),y:y+radius*dy};
   if(!used.some(b=>test.x<b.x+b.w && test.x+width>b.x && test.y-font<b.y && test.y>b.y-font*1.1)){label=test;break;}
  }
  used.push({...label,w:width});
  const active=route.steps[step].place===entry.place;
  return '<g class="atlas-pin '+(active?'active':'')+'" data-atlas-pin="'+index+'" role="button" tabindex="0" aria-label="'+safe(name)+'" transform="translate('+x+','+y+')"><circle class="atlas-hit" r="'+radius*2.8+'"/><circle r="'+radius+'"/><text dy=".35em" text-anchor="middle" font-size="'+font*.62+'">'+(index+1)+'</text></g>'+
   '<path class="atlas-label-leader" d="M'+x+','+y+' L'+label.x+','+(label.y-font*.35)+'"/>'+
   '<text class="atlas-place-label" x="'+label.x+'" y="'+label.y+'" font-size="'+font+'">'+safe(name)+(number.includes('·')?' ('+number+')':'')+'</text>';
 }).join('');
}
function geography(frameWidth){
 const labels=[[31.6,34.4,'지중해'],[32,39.1,'소아시아'],[43.1,34.8,'메소포타미아'],[30.2,28.8,'애굽'],[36.1,31.2,'가나안'],[13.2,42.0,'이탈리아'],[23,41.4,'마게도냐'],[34.1,27.9,'홍해']];
 return labels.map(([x,y,name])=>'<text class="atlas-region-label" x="'+x+'" y="'+(-y*1.25)+'" font-size="'+mapUnit()*14+'" text-anchor="middle">'+name+'</text>').join('');
}
function journeyScreen(){
 const visible=routes.filter(r=>enabled.has(r.id)),route=routes.find(r=>r.id===selected),active=route.steps[step];
 const points=(visible.length?visible:[route]).flatMap(r=>r.segments.flat().map(project));
 if(!viewport)viewport=fit(points);
 minMapWidth=.03;maxMapWidth=65;
 const paths=visible.map(r=>r.segments.map(segment=>'<polyline class="atlas-route" style="stroke:'+colorFor(r.id)+'" points="'+segment.map(project).map(p=>p.join(',')).join(' ')+'"/>').join('')+
 (r.id===selected?'':r.steps.map(stop=>{const [x,y]=project(places[stop.place].slice(1));return '<circle class="atlas-layer-pin" cx="'+x+'" cy="'+y+'" r="'+viewport[2]/150+'" style="fill:'+colorFor(r.id)+'"/>';}).join(''))).join('');
 const detail=enabled.has(selected)?'<section class="card atlas-detail" aria-live="polite"><div class="row"><span class="reading-badge">'+safe(route.title)+' · '+(step+1)+' / '+route.steps.length+'</span><button class="text-action" type="button" data-atlas-locate="true">이 장소 확대</button></div><h2>'+safe(places[active.place][0])+'</h2><p>'+safe(active.text)+'</p><span class="atlas-confidence">'+safe(placeNotes[active.place]?.confidence ?? '위치 추정')+'</span><button type="button" class="note-link" data-atlas-ref="'+active.ref+'">'+safe(reference(active.ref))+' 읽기 →</button><div class="row atlas-pagination"><button class="btn" data-atlas-step="-1" '+(!step?'disabled':'')+'>← 이전 사건</button><button class="btn" data-atlas-step="1" '+(step===route.steps.length-1?'disabled':'')+'>다음 사건 →</button></div></section>'+
 '<section class="card atlas-reading-guide"><h2>이 여정을 읽는 방법</h2><p>'+safe(route.description)+'</p><div class="atlas-scripture-links">'+[...new Set([route.steps[0].ref,route.steps.find(s=>s.place==='egypt')?.ref,route.steps.at(-1).ref].filter(Boolean))].map(ref=>'<button type="button" class="btn" data-atlas-ref="'+ref+'">'+safe(reference(ref))+'</button>').join('')+'</div></section>':'';
 return chooser(visible)+'<section class="atlas-map-card"><header class="row"><h2>'+visible.length+'개 여정 함께 보기</h2><span class="atlas-map-key"><i class="sea"></i>바다 <i class="land"></i>육지</span></header><svg class="atlas-map atlas-journey-map" viewBox="'+viewport.join(' ')+'" role="group" aria-label="성경 여정 지도"><path class="atlas-land" d="'+land+'"/><path class="atlas-lakes" d="'+lakes+'"/>'+geography(viewport[2])+paths+(enabled.has(selected)?labelsFor(route,viewport[2]):'')+'</svg>'+mapControls()+'<p class="atlas-legend">점선은 방문 순서를 잇는 개략적 이동권입니다. 성경에 기록되지 않은 중간 이동로는 확정 경로로 표시하지 않습니다.</p></section>'+detail;
}
function historyScreen(){
 const info=history[mode];minMapWidth=info.size[0]*.02;maxMapWidth=info.size[0]*2;
 if(!viewport)viewport=[0,0,...info.size];
 const extra=mode==='tribes'?'레위는 연속된 땅 대신 여러 지파 안의 성읍을 받았습니다. 요셉의 몫은 에브라임과 므낫세로 표시하며, 므낫세의 땅은 요단 동·서에 나뉩니다.':'북이스라엘은 파란색, 남유다는 황토색 영역입니다. 사마리아와 예루살렘을 각각의 중심 도시로 확인해 보세요.';
 return '<section class="atlas-map-card atlas-history-card"><header><h2>'+safe(info.title)+'</h2><p>'+safe(info.description)+'</p></header><svg class="atlas-map atlas-history-map" viewBox="'+viewport.join(' ')+'" role="img" aria-label="'+safe(info.title)+'"><image href="./maps/'+info.file+'" x="0" y="0" width="'+info.size[0]+'" height="'+info.size[1]+'"/></svg>'+mapControls()+'<p class="atlas-credit"><a target="_blank" rel="noopener" href="'+info.url+'">'+safe(info.credit)+'</a></p></section><section class="card atlas-reading-guide"><h2>지도에서 살펴보기</h2><p>'+extra+'</p><button type="button" class="note-link" data-atlas-ref="'+info.ref+'">'+safe(reference(info.ref))+' 읽기 →</button></section>';
}
function modernScreen(){
 minMapWidth=.03;maxMapWidth=25;if(!viewport)viewport=[33.5,-42.2,3.6,6.1];
 const shapes=modernRegions.map(region=>'<path class="atlas-modern-region '+(region.id==='Israel'?'israel':region.id==='Palestine'?'palestine':'neighbor')+'" d="'+region.rings.map(pathFor).join(' ')+'"/>').join('');
 const towns=[[34.78,32.08,'텔아비브'],[35.23,31.78,'예루살렘'],[34.99,32.82,'하이파'],[34.95,29.56,'에일라트'],[34.84,31.24,'브엘세바'],[35.93,31.95,'암만'],[35.51,33.89,'베이루트']];
 const labels=towns.map(([x,y,name])=>'<circle class="atlas-modern-city" cx="'+x+'" cy="'+(-y*1.25)+'" r="'+viewport[2]/190+'"/><text class="atlas-place-label" x="'+(x+viewport[2]/80)+'" y="'+(-y*1.25)+'" font-size="'+mapUnit()*12+'">'+name+'</text>').join('');
 return '<section class="atlas-map-card"><header><h2>현대 이스라엘과 주변 지역</h2><p>현대 지리 비교용 · Natural Earth 5.1.2의 행정구역 구분</p></header><svg class="atlas-map atlas-modern-map" viewBox="'+viewport.join(' ')+'" role="img" aria-label="현대 이스라엘과 팔레스타인 및 주변국"><path class="atlas-land" d="'+land+'"/>'+shapes+'<path class="atlas-lakes" d="'+lakes+'"/>'+labels+'<text class="atlas-region-label" x="34.2" y="-40.8" font-size="'+mapUnit()*17+'">지중해</text></svg>'+mapControls()+'<p class="atlas-legend">파랑 · 이스라엘 / 보라 · 팔레스타인(서안·가자). 분쟁 지역의 법적 지위나 실시간 통제선을 확정하는 지도가 아닙니다.</p><p class="atlas-credit"><a href="https://www.naturalearthdata.com/about/terms-of-use/" target="_blank" rel="noopener">Natural Earth v5.1.2 · Public domain</a></p></section>';
}
export function atlasScreen(){
 return '<header class="page-heading"><p class="eyebrow">BIBLE ATLAS</p><h1>성경 지도</h1><p class="lead">여정과 시대별 지리를 비교해 보세요.</p></header><nav class="atlas-mode-tabs" aria-label="지도 종류">'+mapModes.map(([id,title])=>'<button type="button" data-atlas-mode="'+id+'" aria-pressed="'+(mode===id)+'">'+title+'</button>').join('')+'</nav>'+(mode==='journeys'?journeyScreen():mode==='modern'?modernScreen():historyScreen());
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
