import {books} from './books.js';
import {HebrewCalendar,HDate} from './vendor/hebcal.mjs';
const reference = ref => { const [book,chapter,verse]=ref.split('/'); return (Object.fromEntries(books)[book] ?? book)+' '+chapter+':'+verse; };
const months={Nisan:'니산',Iyyar:'이야르',Sivan:'시완',Tamuz:'탐무즈',Av:'아브',Elul:'엘룰',Tishrei:'티슈리',Cheshvan:'헤슈반',Kislev:'키슬레브',Tevet:'테베트',"Sh'vat":'쉐바트',Adar:'아다르','Adar I':'아다르 1','Adar II':'아다르 2'};
const holidays=[
 [/Rosh Hashana/,'나팔절 · 로쉬 하샤나','유대력의 새해입니다. 성경은 일곱째 달 첫날을 나팔을 불며 기념하는 성회로 기록합니다.','LEV/23/24'],
 [/Yom Kippur/,'대속죄일','회개와 속죄를 기억하는 금식일입니다.','LEV/23/27'],
 [/Sukkot/,'초막절','광야에서 초막에 거했던 일을 기억하고 수확을 감사하는 절기입니다.','LEV/23/42'],
 [/Shmini Atzeret/,'쉐미니 아체레트 · 여덟째 날 성회','초막절 뒤에 이어지는 여덟째 날의 성회입니다.','LEV/23/36'],
 [/Simchat Torah/,'심핫 토라 · 율법의 기쁨','토라의 연간 낭독을 마치고 다시 시작하는 유대교 전통 절기입니다. 성경에 같은 이름의 절기로 제정되지는 않았습니다.','DEU/31/11'],
 [/Pesach/,'유월절 · 무교절 기간','애굽에서의 해방을 기억합니다. 유월절과 이어지는 무교절 기간을 함께 표시합니다.','EXO/12/14'],
 [/Shavuot/,'칠칠절 · 샤부오트','첫 수확과 일곱 주가 찬 때를 기념합니다. 유대교 전통에서는 율법 수여도 기억합니다.','LEV/23/15'],
 [/Chanukah/,'하누카 · 수전절','성전 재봉헌을 기념하는 여드레의 절기입니다. 요한복음에는 수전절이 언급됩니다.','JHN/10/22'],
 [/Shushan Purim/,'수산 부림절','수산에서 구원을 기뻐한 날을 기억하며, 예루살렘 등 성벽 도시에서 지킵니다.','EST/9/18'],
 [/Purim/,'부림절','에스더서에 기록된 유대 백성의 구원을 기억합니다.','EST/9/22'],
 [/Tu BiShvat/,'투 비슈바트','나무의 새해로 알려진 유대교 전통 기념일입니다.',''],
 [/Lag BaOmer/,'라그 바오메르','오메르를 세는 33일째의 유대교 전통 기념일입니다.',''],
 [/Rosh Chodesh/,'로쉬 호데쉬 · 월삭','히브리력 새 달의 시작을 표시합니다. 30일과 다음 달 1일 이틀인 경우도 있습니다.','NUM/28/11'],
 [/Tzom Gedaliah/,'그달리야 금식','총독 그달리야의 죽음을 기억하는 금식일입니다.','2KI/25/25'],
 [/Asara B'Tevet/,'테베트 10일 금식','예루살렘 포위의 시작을 기억합니다.','2KI/25/1'],
 [/Ta'anit Esther/,'에스더 금식','부림절에 앞서 금식과 구원의 이야기를 기억합니다.','EST/4/16'],
 [/Ta'anit Bechorot/,'장자 금식','유월절 전날의 전통적 금식입니다.','EXO/12/29'],
 [/Tzom Tammuz/,'탐무즈 17일 금식','예루살렘 성벽이 뚫린 일을 기억하는 유대교 전통 금식일입니다.',''],
 [/Tish'a B'Av/,'아브 9일 금식','성전 파괴 등 민족의 슬픔을 기억하는 유대교 전통 금식일입니다.','2KI/25/9'],
 [/Shabbat/,'안식일 특별 기념','회당의 토라 낭독과 절기 준비에 연결된 특별 안식일입니다.','EXO/20/8'],
];
let enabled=false, israel=true;
try { enabled=localStorage.getItem('logbible-hebrew-calendar')==='true';israel=localStorage.getItem('logbible-hebrew-israel')!=='false'; } catch {}
const cache=new Map();
const dateKey=date=>[date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
const safe=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function hebrewDate(day) {
 const h=new HDate(new Date(day+'T12:00:00'));
 return {day:h.getDate(),month:months[h.getMonthName()] ?? h.getMonthName(),year:h.getFullYear()};
}
function eventsFor(day) {
 const year=Number(day.slice(0,4)),key=year+'/'+israel;
 if(!cache.has(key)) {
  const entries=HebrewCalendar.calendar({year,isHebrewYear:false,il:israel,noModern:true});
  const map=new Map();
  for(const event of entries) {const date=dateKey(event.getDate().greg());const list=map.get(date) ?? [];list.push(event);map.set(date,list);}
  cache.set(key,map);
 }
 return cache.get(key).get(day) ?? [];
}
function eventInfo(event) {
 const desc=event.getDesc(),entry=holidays.find(([pattern])=>pattern.test(desc));
 return {title:entry?.[1] ?? desc,detail:entry?.[2] ?? '유대력의 전통 기념일입니다.',ref:entry?.[3] ?? '',english:desc,eve:desc.startsWith('Erev ')};
}
export function hebrewOptions() {
 return '<section class="hebrew-options"><button type="button" class="btn" data-hebrew-toggle="true" aria-pressed="'+enabled+'">히브리력 '+(enabled?'표시 중':'표시')+'</button>'+
 (enabled?'<div class="hebrew-scheme" role="group" aria-label="절기 기준"><button type="button" data-hebrew-scheme="israel" aria-pressed="'+israel+'">이스라엘</button><button type="button" data-hebrew-scheme="diaspora" aria-pressed="'+!israel+'">해외 유대 공동체</button></div>':'')+'</section>';
}
export function hebrewDayCell(day) {
 if(!enabled)return '';
 const h=hebrewDate(day),events=eventsFor(day);
 return '<small class="hebrew-cell-date">'+(h.day===1?h.month+' ':'')+h.day+'</small>'+(events.length?'<span class="hebrew-holiday-dot" aria-label="절기 있음"></span>':'');
}
export function hebrewDayDetail(day) {
 if(!enabled)return '';
 const h=hebrewDate(day),events=eventsFor(day).map(eventInfo);
 return '<section class="card hebrew-day-detail"><header class="row"><h2>'+h.month+' '+h.day+'일</h2><span class="reading-badge">'+h.year+'년</span></header>'+
 '<p class="muted">'+(israel?'이스라엘':'해외 유대 공동체')+' 기준 · 해당 양력일 낮의 히브리 날짜</p>'+
 (events.length?events.map(info=>'<article><h3>'+safe(info.title)+(info.eve?' 전날':'')+'</h3><p class="muted">'+safe(info.english)+'</p><p>'+safe(info.detail)+'</p>'+(info.ref?'<button type="button" class="note-link" data-atlas-ref="'+info.ref+'">'+safe(reference(info.ref))+' 읽기 →</button>':'')+'</article>').join(''):'<p>이날은 등록된 절기나 특별 기념일이 없어요.</p>')+
 '</section>';
}
export function hebrewAction(target) {
 if(target.hebrewToggle){enabled=!enabled;try{localStorage.setItem('logbible-hebrew-calendar',String(enabled));}catch{}return true;}
 if(target.hebrewScheme){israel=target.hebrewScheme==='israel';try{localStorage.setItem('logbible-hebrew-israel',String(israel));}catch{}return true;}
 return false;
}
export function hebrewEnabled() {return enabled;}
