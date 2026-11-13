import {books} from './books.js';
import {places,journeys} from './atlas-data.js';
import {landRings} from './atlas-land.js';
const reference = ref => { const [book,chapter,verse]=ref.split('/'); return (Object.fromEntries(books)[book] ?? book)+' '+chapter+':'+verse; };
const safe = value => String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
let selected = journeys[0].id, step = 0, zoom = 1, pan = [0,0], borders = false;
const project = ([lon,lat])=>[lon,-lat*1.25];
const pathFor = points => points.map((point,index)=>(index?'L':'M')+project(point).join(',')).join(' ')+' Z';
const land = landRings.map(pathFor).join(' ');
export function atlasAction(target) {
  if (target.atlasGroup) {
    selected = journeys.find(route=>route.group===target.atlasGroup)?.id ?? selected;
    step=0;zoom=1;pan=[0,0];return true;
  }
  if (target.atlasJourney && journeys.some(route=>route.id===target.atlasJourney)) {
    selected=target.atlasJourney;step=0;zoom=1;pan=[0,0];return true;
  }
  const route=journeys.find(route=>route.id===selected);
  if ('atlasStep' in target) { step=Math.max(0,Math.min(route.steps.length-1,step+Number(target.atlasStep)));pan=[0,0];return true; }
  if (target.atlasZoom) { zoom=Math.max(1,Math.min(6,zoom*Number(target.atlasZoom)));return true; }
  if (target.atlasPan) { const [x,y]=target.atlasPan.split(',').map(Number);pan=[pan[0]+x,pan[1]+y];return true; }
  if (target.atlasReset) { zoom=1;pan=[0,0];return true; }
  if (target.atlasBorder) { borders=!borders;return true; }
  return false;
}
export function atlasScreen() {
  const route=journeys.find(route=>route.id===selected);
  const groups=[...new Set(journeys.map(item=>item.group))];
  const points=route.steps.map(item=>project(places[item.place].slice(1)));
  const minX=Math.min(...points.map(p=>p[0])),maxX=Math.max(...points.map(p=>p[0]));
  const minY=Math.min(...points.map(p=>p[1])),maxY=Math.max(...points.map(p=>p[1]));
  const width=Math.max(2,(maxX-minX)*1.32),height=Math.max(2.4,(maxY-minY)*1.32,width*.65);
  const frameWidth=Math.max(width,height*1.3)/zoom,frameHeight=Math.max(height,width*.65)/zoom;
  const center=zoom>1?points[step]:[(minX+maxX)/2,(minY+maxY)/2];
  const viewBox=[center[0]-frameWidth/2+pan[0]*frameWidth*.15,center[1]-frameHeight/2+pan[1]*frameHeight*.15,frameWidth,frameHeight].join(' ');
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
  return '<header class="page-heading"><p class="eyebrow">BIBLE ATLAS</p><h1>성경 지도</h1><p class="lead">장소를 누르거나 순서대로 여정을 따라가 보세요.</p></header>'+
    '<nav class="atlas-groups" aria-label="지도 주제">'+groups.map(group=>'<button type="button" data-atlas-group="'+safe(group)+'" aria-pressed="'+(route.group===group)+'">'+safe(group)+'</button>').join('')+'</nav>'+
    '<nav class="atlas-journeys" aria-label="여정 선택">'+journeys.filter(item=>item.group===route.group).map(item=>'<button type="button" class="btn" data-atlas-journey="'+item.id+'" aria-pressed="'+(item.id===selected)+'">'+safe(item.title)+'</button>').join('')+'</nav>'+
    '<section class="atlas-map-card"><header class="row"><h2>'+safe(route.title)+'</h2><button type="button" class="text-action" data-atlas-border="toggle" aria-pressed="'+(borders || selected==='borders')+'">경계 개요</button></header>'+
    '<svg class="atlas-map" viewBox="'+viewBox+'" role="group" aria-label="'+safe(route.title)+' 지도"><title>'+safe(route.title)+'</title><path class="atlas-land" d="'+land+'"/>'+geography+
    ((borders || selected==='borders')?'<path class="atlas-boundary" d="'+pathFor(envelope)+'"/>':'')+
    '<polyline class="atlas-route" points="'+points.map(p=>p.join(',')).join(' ')+'"/>'+pinGroups.join('')+activePin+
    '<text class="atlas-place-label" x="'+points[step][0]+'" y="'+(points[step][1]-radius*1.7)+'" text-anchor="middle" font-size="'+font+'">'+safe(place[0])+'</text></svg>'+
    '<div class="atlas-controls" aria-label="지도 조절"><button type="button" class="btn" data-atlas-zoom="1.5" aria-label="지도 확대" '+(zoom>=6?'disabled':'')+'>＋</button><button type="button" class="btn" data-atlas-zoom="0.666666667" aria-label="지도 축소" '+(zoom<=1?'disabled':'')+'>−</button><button type="button" class="btn" data-atlas-reset="all">전체</button><button class="btn" data-atlas-pan="-1,0" aria-label="서쪽으로 이동">←</button><button class="btn" data-atlas-pan="0,-1" aria-label="북쪽으로 이동">↑</button><button class="btn" data-atlas-pan="0,1" aria-label="남쪽으로 이동">↓</button><button class="btn" data-atlas-pan="1,0" aria-label="동쪽으로 이동">→</button></div>'+
    '<p class="atlas-legend"><span>● 장소</span><span>┄ 대표 이동 순서 · 점선은 실제 도로·항로를 확정하지 않음</span></p></section>'+
    '<section class="card atlas-detail" aria-live="polite"><div class="row"><span class="reading-badge">'+(step+1)+' / '+route.steps.length+'</span><span class="muted">'+safe(route.group)+'</span></div><h2>'+safe(place[0])+'</h2><p>'+safe(active.text)+'</p><button type="button" class="note-link" data-atlas-ref="'+active.ref+'">'+safe(reference(active.ref))+' 읽기 →</button><div class="row atlas-pagination"><button class="btn" data-atlas-step="-1" '+(step===0?'disabled':'')+'>← 이전 장소</button><button class="btn" data-atlas-step="1" '+(step===route.steps.length-1?'disabled':'')+'>다음 장소 →</button></div></section>'+
    '<details class="atlas-notes"><summary>경로 설명과 자료 출처</summary><p>'+safe(route.description)+'</p><p>핀은 주요 장소의 대표 좌표이며, 동선은 주요 사건을 연결한 개요입니다. 출애굽, 정찰, 포로기와 일부 지명은 위치·순서에 다른 견해가 있습니다. 경계 개요는 단–브엘세바 생활권의 대략적 범위입니다.</p><p><a href="https://www.openbible.info/geo/" target="_blank" rel="noopener">OpenBible 지명 자료</a> · <a href="https://www.naturalearthdata.com/about/terms-of-use/" target="_blank" rel="noopener">지도 윤곽 © Natural Earth · public domain</a></p></details>'+
    '<details class="atlas-stop-list"><summary>전체 장소 목록 · '+route.steps.length+'곳</summary>'+route.steps.map((entry,index)=>'<button type="button" data-atlas-go="'+index+'" aria-current="'+(step===index?'step':'false')+'">'+(index+1)+'. '+safe(places[entry.place][0])+'</button>').join('')+'</details>';
}
export function mountAtlas(root,redraw) {
  const choose=index=>{step=Number(index);pan=[0,0];redraw();root.querySelector('.atlas-detail h2')?.scrollIntoView({block:'nearest'});};
  root.querySelectorAll('[data-atlas-pin]').forEach(pin=>{
    pin.addEventListener('click',()=>choose(pin.dataset.atlasPin));
    pin.addEventListener('keydown',event=>{if(event.key==='Enter' || event.key===' '){event.preventDefault();choose(pin.dataset.atlasPin);}});
  });
  root.querySelectorAll('[data-atlas-go]').forEach(button=>button.addEventListener('click',()=>choose(button.dataset.atlasGo)));
}
