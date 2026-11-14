import {hebrewGuideScreen,hebrewGuideAction} from './hebrew-guide.js?v=8';
import {atlasScreen,mountAtlas,atlasAction} from './bible-atlas.js?v=8';
import {hebrewOptions,hebrewDayCell,hebrewDayDetail,hebrewAction,hebrewEnabled} from './hebrew-calendar.js?v=4';
import { books, chapterCounts } from './books.js';
import { dailyVerseRefs } from './daily-verse-refs.js?v=1';
import { bdbSizeSupported, editionKind, editionName, readBdb } from './bdb.js?v=38';

const ghCloudRepo = 'haedoz/logbible-data';
let ghDevices = [], ghDeviceScope = '', ghDeviceChecked = 0, ghDeviceBusy = false, ghDeviceInputTimer;
let ghPresence = null, ghPageLeaving = false;
function ghDeviceName() {
  const ua = navigator.userAgent;
  if (/iPad/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints>1)) return '아이패드';
  if (/iPhone/i.test(ua)) return '아이폰';
  if (/Android/i.test(ua)) return /Mobile/i.test(ua)?'안드로이드 폰':'안드로이드 태블릿';
  if (/Mac/i.test(ua)) return 'Mac';
  if (/Windows/i.test(ua)) return 'Windows PC';
  return '이 기기';
}
function ghDeviceMarkup() {
  const user = (localStorage.getItem('logbible-gh-user') || '').replace(/\.json$/i,'').trim();
  if (!user || ghDeviceScope!==user || !ghDevices.length) return '<p class="muted">'+(ghDeviceBusy?'동기화 기기 확인 중…':'동기화 접속이 확인된 기기가 아직 없어요.')+'</p>';
  return '<p class="muted">동기화 기기</p><div class="gh-device-chips">'+ghDevices.map(device=>{
    const recent = device.online===true && Date.now()-device.seen<90000;
    return '<span class="gh-device '+(recent?'online':'')+'"><i aria-hidden="true"></i><span>'+esc(device.name)+'</span><small>'+(recent?'접속 중':ghLastSeen(device.seen))+'</small></span>';
  }).join('')+'</div>';
}
function ghLastSeen(seen) {
  const minutes = Math.floor(Math.max(0,Date.now()-seen)/60000);
  if (minutes<1) return '방금 전';
  if (minutes<60) return minutes+'분 전';
  const hours = Math.floor(minutes/60);
  return hours<24?hours+'시간 전':Math.floor(hours/24)+'일 전';
}
function ghIsOnline() {
  return !ghPageLeaving && !document.hidden && localStorage.getItem('logbible-gh-auto')!=='false';
}
async function markGhOffline() {
  if (!ghPresence) return;
  const {url,headers,sha,user} = ghPresence;
  if (user!==localStorage.getItem('logbible-gh-user')?.replace(/\.json$/i,'').trim()) return;
  const device = {name:ghDeviceName(),seen:Date.now(),online:false};
  const content = btoa(Array.from(new TextEncoder().encode(JSON.stringify(device)),byte=>String.fromCharCode(byte)).join(''));
  try {
    const response = await fetch(url,{method:'PUT',keepalive:true,headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({message:'Mark sync device offline',content,sha})});
    if (response.ok) {
      const updated = await response.json();
      if (ghPresence?.url===url) ghPresence.sha = updated.content.sha;
      ghDeviceChecked = 0;
    }
  } catch { /* Heartbeat expiry also handles an interrupted app exit. */ }
}
async function refreshGhDevices(force = false) {
  const token = localStorage.getItem('logbible-gh-token')?.trim().replace(/[^\x21-\x7E]/g,'');
  const user = localStorage.getItem('logbible-gh-user')?.replace(/\.json$/i,'').trim();
  if (!token || !user || localStorage.getItem('logbible-gh-auto')==='false' || ghDeviceBusy) return;
  ghDeviceBusy = true;
  const scope = user;
  try {
    let id = localStorage.getItem('logbible-gh-device-id');
    if (!id) { id = crypto.randomUUID(); localStorage.setItem('logbible-gh-device-id',id); }
    const path = 'sync-devices/'+encodeURIComponent(user)+'/'+id+'.json';
    const headers = {Authorization:'Bearer '+token,Accept:'application/vnd.github+json'};
    const url = 'https://api.github.com/repos/'+ghCloudRepo+'/contents/';
    let response;
    if (force || ghDeviceScope!==user || Date.now()-ghDeviceChecked>=45000) {
    response = await fetch(url+path,{headers,cache:'no-store'});
    if (!response.ok && response.status!==404) throw Error('device');
    const previous = response.ok?await response.json():null;
    const device = {name:ghDeviceName(),seen:Date.now(),online:ghIsOnline()};
    const bytes = new TextEncoder().encode(JSON.stringify(device));
    const content = btoa(Array.from(bytes,byte=>String.fromCharCode(byte)).join(''));
    response = await fetch(url+path,{method:'PUT',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({message:'Update sync device',content,...(previous?.sha?{sha:previous.sha}:{})})});
    if (!response.ok) throw Error('device');
    const updated = await response.json();
    ghPresence = {url:url+path,headers,sha:updated.content.sha,user};
    ghDeviceChecked = Date.now();
    }
    response = await fetch(url+'sync-devices/'+encodeURIComponent(user),{headers,cache:'no-store'});
    if (!response.ok) throw Error('devices');
    const files = await response.json();
    const devices = await Promise.all(files.filter(file=>file.type==='file' && /\.json$/.test(file.name)).slice(0,30).map(async file=>{
      const result = await fetch(url+file.path.split('/').map(encodeURIComponent).join('/'),{headers,cache:'no-store'});
      if (!result.ok) return null;
      const entry = await result.json();
      try {
        const text = atob(entry.content.replace(/\s/g,''));
        const item = JSON.parse(new TextDecoder().decode(Uint8Array.from(text,c=>c.charCodeAt(0))));
        return typeof item.name==='string' && Number.isFinite(item.seen)?item:null;
      } catch { return null; }
    }));
    if (localStorage.getItem('logbible-gh-user')?.replace(/\.json$/i,'').trim()!==scope) return;
    ghDevices = devices.filter(Boolean).sort((a,b)=>b.seen-a.seen);
    ghDeviceScope = scope;
    const panel = document.getElementById('gh-device-list');
    if (panel) panel.innerHTML = ghDeviceMarkup();
  } catch { ghDeviceChecked = 0; }
  finally {
    ghDeviceBusy = false;
    if (ghPresence && !ghIsOnline()) markGhOffline();
    const panel = document.getElementById('gh-device-list');
    if (panel) panel.innerHTML = ghDeviceMarkup();
  }
}

const icons = {
  trash:'<path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7"/>',
  yearVerse:'<path d="M6 3h12v18l-6-4-6 4V3Z"/><path d="m12 6 1 2 2 .3-1.5 1.4.4 2-1.9-1-1.9 1 .4-2L9 8.3l2-.3 1-2Z"/>',
  map:'<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Zm6-3v15m6-12v15"/>',
  book:'<path d="M12 6c-3-2-6-2-9-1v14c3-1 6-1 9 1 3-2 6-2 9-1V5c-3-1-6-1-9 1zm0 0v14"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18m-13 5h2m4 0h2"/>',
  folder:'<path d="M3 6h7l2 2h9v12H3z"/><path d="M8 13h8m-8 3h5"/>',
  settings:'<circle cx="12" cy="12" r="3"/><path d="m9 3-.5 3-2 1-3-.5-1.5 3 2 2v2l-2 2 1.5 3 3-.5 2 1 .5 3h4l.5-3 2-1 3 .5 1.5-3-2-2v-2l2-2-1.5-3-3 .5-2-1-.5-3z" transform="translate(1 -1)"/>',
  prayer:'<path d="M12 21c-4-3-8-6-8-11a4 4 0 0 1 8-1 4 4 0 0 1 8 1c0 5-4 8-8 11z"/>',
  marker:'<path d="m7 13 7-8a2 2 0 0 1 3 0l2 2a2 2 0 0 1 0 3l-8 7m-4-4 4 4m-4-4-3 4 3 3 4-3M3 21h7"/>',
  compare:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M12 5v14"/>',
  search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
  filter:'<path d="M4 7h16M7 12h10m-7 5h4"/>',
  comment:'<path d="M20 11a7 7 0 0 1-7 7H7l-4 3v-9a7 7 0 0 1 7-7h3a7 7 0 0 1 7 6Z"/><path d="M8 11h7m-7 3h4"/>',
  note:'<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h4M9 12h6m-6 4h5"/>',
  copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 4H6a2 2 0 0 0-2 2v10"/>',
  left:'<path d="m15 5-7 7 7 7"/>',
  edit:'<path d="m4 16 11-11 4 4L8 20H4v-4Zm9-9 4 4"/>',
  right:'<path d="m9 5 7 7-7 7"/>',
  down:'<path d="m6 9 6 6 6-6"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  close:'<path d="m6 6 12 12M18 6 6 18"/>',
  back:'<path d="m14 6-6 6 6 6m-6-6h13"/>',
  arrow:'<path d="M4 12h15m-6-6 6 6-6 6"/>',
};
const icon = name => '<svg viewBox="0 0 24 24" aria-hidden="true">'+icons[name]+'</svg>';
document.querySelectorAll('[data-icon]').forEach(el => el.innerHTML = icon(el.dataset.icon));
const main = document.querySelector('#main');
const modal = document.querySelector('#modal');
const toast = document.querySelector('#toast');
const readerSearchForm = document.querySelector('#reader-search');
const readerSearchInput = document.querySelector('#reader-search-input');
const readerSearchButton = readerSearchForm.querySelector('.bible-search-button');
const readerSearchClose = readerSearchForm.querySelector('.reader-search-close');
const readerSearchPanel = readerSearchForm.querySelector('#reader-search-results');
const topBar = document.querySelector('.top-inner');
const menuBar = document.querySelector('.bottom .nav-inner');
const menuItems = new Map([...menuBar.querySelectorAll('[data-nav]')].map(button=>[button.dataset.nav,button]));
const settingsSections = {
  display:['화면',displaySettings],menu:['메뉴',menuOrderSettings],
  library:['성경 자료',importPanel],backup:['백업',backupSettings],
};
let settingsSection = 'display';
const titles = Object.fromEntries(books);
const testamentByBook = Object.fromEntries(books.map(([book],index)=>[book,index<39?'old':'new']));
const retiredEditions = {krv:'개역한글',web:'WEB (영어)'};
const editions = {};
const commentaries = {}, originals = {}, dictionaries = {};
const studySelection = {commentary:{},original:{}};
let readingArrival;
let readingBookmark = '', renderedBible = '', readingBookmarkTimer, lastBibleScrollTop;
const readingBookmarkKey = '로그바이블-reading-bookmark';
const draftEditors = new WeakMap();
const sessionDrafts = new Map();
let bibleSearchScope = 'all';
let bibleSearchResults, bibleSearchPage = 0, bibleSearchPageSize = 1;
const searchScopeLabels = {all:'전체 성경',old:'구약',new:'신약'};
const personalSearchTypes = {all:'모든 종류',journal:'QT 묵상',daily:'말씀 묵상',thought:'생각 노트',
  prayer:'기도',yearly:'새해 말씀',mark:'구절 메모·표시',bundle:'구절 모음'};
const personalSearchFilters = {type:'all',year:'all'};
let personalSearchSubmitted = false;
const selectedSearchVerses = new Set();
let readerSwipe, ignoreReaderSwipeClickUntil = 0;
const localLanguages = {};
let importMessage = '', importingEditions = false, deletingEdition = false, chapterCheckBusy = false;
const colors = {gold:'노랑',sage:'연두',rose:'분홍'};
const markerColors = {gold:'#e6bc43',sage:'#7cb668',rose:'#dc7d9c',blue:'#6d9ddf'};
let lastMarkerEdit, markerHold, markerPointer, ignoreMarkerClick = 0;
const settings = {
  fontSize:{label:'한글 본문 크기',min:12,max:48,step:1,unit:'px',initial:15},
  fontSizeEn:{label:'영어 성경 크기',min:12,max:48,step:1,unit:'px',initial:15},
  fontSizeHe:{label:'히브리어 원어 크기',min:12,max:56,step:1,unit:'px',initial:22},
  fontSizeGrc:{label:'헬라어 원어 크기',min:12,max:56,step:1,unit:'px',initial:20},
  lineHeight:{label:'줄 간격',min:1.2,max:3,step:.05,unit:'배',initial:1.25},
  verseGap:{label:'구절 사이 간격',min:0,max:48,step:1,unit:'px',initial:0},
  letterSpace:{label:'글자 사이 간격',min:-1,max:5,step:.1,unit:'px',initial:0},
};
const themes = {system:'시스템 설정',light:'라이트',dark:'다크'};
const palettes = {slate:'미스트 블루',lavender:'모브 그레이',oat:'오트 베이지',gray:'라이트 그레이'};
const fontChoices = {
  pretendard: '프리텐다드',
  paperlogy: '페이퍼로지',
  notosanskr: '노토 산스 KR',
  system: '기기 기본 글꼴',
  custom: '가져온 글꼴'
};
let customFont, importingFont = false;
const markStyles = {fill:'형광펜',solid:'실선',wavy:'물결선',dashed:'점선'};
const parts = {morning:'아침 묵상',daytime:'하루 중 떠오른 생각',evening:'밤에 다시 돌아보기',question:'아직 남은 질문'};
const data = {};
const chosen = new Set();
let pickingIndividualVerses = false;
const blank = () => ({journal:{},dailyNotes:{},dailyVerses:{},marks:{},reader:{edition:'',book:'JHN',chapter:1},backup:'',display:{},theme:'system',palette:'slate',fontChoice:'pretendard',quickMarkers:['#e6bc43','#7cb668','#dc7d9c'],menuOrder:[...menuItems.keys()],alignVerseAtTop:true,markerColor:markerColors.gold,markerStyle:'fill',comparison:[],chapterLog:{},readingGoal:3,readingRange:null,readingHistory:[],editionLabels:{},prayers:[],newYear:[],verseBundles:[]});
let state = blank(), db, writeError = false;
let activeJournalId='';
let todayThoughtsOpen=false;
let todayPlanMode='books',todayPlanBook='',todayBookPicker=false,todayBookScope='new';
let view, selectedDay = dateKey(), month = selectedDay.slice(0,7), filter = 'all';
const recordSelection = {edition:'',book:'',year:''};
let recordPage = 0;
let oldestRecordsFirst = false;
const recordPickerLabels = {edition:['번역본','모든 번역본'],book:['성경','모든 성경'],year:['연도','모든 연도']};
let renderedDailyDate;
const dailyNoteLimit = 20000;
let verseArrivalTimer, arrivedVerse, verseAlignmentEpoch=0;
let toastTimer, jumpTo, activeRoute, prayerFilter = 'open', editId, trackerBook, editingVerseNote;
let trackerYear;
const trackerScopes = {all:'전체 성경',old:'구약',new:'신약'};
let trackerScope = 'all';

function dateKey(date = new Date()) {
  return [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
}
function longDate(key) {
  return new Intl.DateTimeFormat('ko-KR',{month:'long',day:'numeric',weekday:'long'}).format(new Date(key+'T12:00:00'));
}
function shortDate(key) {
  return Number(key.slice(5,7))+'월 '+Number(key.slice(8,10))+'일';
}
function esc(value = '') {
  return String(value).replace(/[&<>"']/g,char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[char]);
}
function notify(message,label,action) {
  toast.textContent = message;
  if (label && action) {
    const button = document.createElement('button');
    button.textContent = label;
    button.dataset.action = action;
    toast.append(button);
  }
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.textContent = '',3200);
}
function openDB() {
  return new Promise((resolve,reject) => {
    const request = indexedDB.open('meomum-qt',1);
    request.onupgradeneeded = () => request.result.createObjectStore('local');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function readLocalEditions() {
  const keys = await new Promise((resolve,reject) => {
    const request = db.transaction('local').objectStore('local').getAllKeys(IDBKeyRange.bound('bible:','bible:~'));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const added = [];
  for (const key of keys) {
    if (hasLocalEdition(key.slice(6))) continue;
    const edition = await loadLocal(key).catch(()=>null);
    if (edition?.id && (edition.verses || edition.entries)) added.push(edition);
  }
  return {keys,added};
}
function hasLocalEdition(id) {
  return [editions,commentaries,originals,dictionaries].some(group=>Object.hasOwn(group,id));
}
async function refreshLocalEditions() {
  if (!db || importingEditions || deletingEdition) return;
  const library = await readLocalEditions().catch(()=>null);
  if (!library || importingEditions || deletingEdition) return;
  const available = new Set(library.keys.map(key=>key.slice(6)));
  const removed = installedEditionIds().filter(id=>!available.has(id));
  if (!library.added.length && !removed.length) return;
  for (const id of removed) forgetLocalEdition(id);
  for (const edition of library.added) registerLocalEdition(edition);
  reconcileReaderEdition();
  if (['today','calendar','bible','settings','commentary','original'].includes(view)) render();
}
function storeLocal(key,value) {
  return new Promise((resolve,reject) => {
    const transaction = db.transaction('local','readwrite');
    transaction.oncomplete = resolve;
    transaction.onabort = () => reject(transaction.error);
    transaction.objectStore('local').put(value,key);
  });
}
function installedEditionIds() {
  return [...Object.keys(editions),...Object.keys(commentaries),...Object.keys(originals),...Object.keys(dictionaries)];
}
function clearLocalEdition(id) {
  delete editions[id];
  delete data[id];
  delete localLanguages[id];
  delete commentaries[id];
  delete originals[id];
  delete dictionaries[id];
}
function forgetLocalEdition(id) {
  if (Object.hasOwn(editions,id)) state.editionLabels[id] = editions[id];
  clearLocalEdition(id);
}
function reconcileReaderEdition() {
  if (!Object.hasOwn(editions,state.reader.edition)) state.reader = initialReader(Object.keys(editions)[0] ?? '');
  state.comparison = comparisonEditions(state.comparison,state.reader.edition);
}
function comparisonEditions(value,primary) {
  const ids = Array.isArray(value) ? value : [value];
  return [...new Set(ids)].filter(id=>typeof id==='string' && id!==primary && Object.hasOwn(editions,id));
}
function swapComparison(edition) {
  if (state.comparison.includes(edition)) {
    state.comparison = state.comparison.map(id=>id===edition?state.reader.edition:id);
  }
}
function registerLocalEdition(edition) {
  const {id} = edition;
  const kind = editionKind(edition.label,edition.kind);
  clearLocalEdition(id);
  if (kind==='dictionary') {
    dictionaries[id] = edition;
    return;
  }
  if (kind==='commentary') {
    commentaries[edition.id] = edition;
    return;
  }
  if (kind==='original') {
    originals[edition.id] = edition;
    return;
  }
  editions[edition.id] = edition.label;
  data[edition.id] = edition.verses;
  const sample = (edition.verses?.GEN?.[1]?.[1] ?? edition.verses?.MAT?.[1]?.[1] ?? edition.verses?.PSA?.[23]?.[1] ?? '');
  localLanguages[edition.id] = /[가-힣]/.test(sample) ? 'ko' :
    /[\u0590-\u05ff]/.test(sample) || /BHS/i.test(edition.label) ? 'he' :
    /[\u0370-\u03ff]/.test(sample) || /LXX/i.test(edition.label) ? 'grc' : 'en';
}
function localEditionId(id) {
  return /^local-[0-9a-f]{16}$/.test(id);
}
function editionLabel(id) {
  return editions[id] ?? retiredEditions[id] ?? state.editionLabels[id] ?? '가져온 역본';
}
function importPanel() {
  const installedCards = installedEditionIds().map(id=>{
    const bible = Object.hasOwn(editions,id);
    const commentary = commentaries[id];
    const original = originals[id];
    const dictionary = dictionaries[id];
    const label = editions[id] ?? commentary?.label ?? original?.label ?? dictionary?.label ?? '성경 자료';
    const kind = bible ? 'bible' : commentary ? 'commentary' : original ? 'original' : 'dictionary';
    const kindLabel = bible ? '성경' : commentary ? '주석' : original ? '원전분해' : '원어사전';
    const kindIcon = bible ? icon('book') : commentary ? icon('comment') : original ? icon('search') : icon('folder');
    const kindDesc = bible ? '성경 본문 읽기 및 번역본 대조' : commentary ? '장별·절별 성경 해설 주석' : original ? '히브리어·헬라어 원문 및 단어 분해' : '스트롱 코드 원어사전 및 어원';

    return '<article class="installed-edition-card '+kind+'">'+
      '<div class="edition-card-main">'+
        '<div class="edition-card-icon">'+kindIcon+'</div>'+
        '<div class="edition-card-info">'+
          '<div class="edition-card-title-row">'+
            '<strong class="edition-card-name">'+esc(label)+'</strong>'+
            '<span class="edition-kind-pill '+kind+'">'+kindLabel+'</span>'+
          '</div>'+
          '<p class="edition-card-desc muted">'+kindDesc+'</p>'+
        '</div>'+
      '</div>'+
      '<div class="edition-card-actions">'+
        (bible ? '<button type="button" class="btn edition-read-btn" data-read-edition="'+id+'">본문 읽기 '+icon('arrow')+'</button>' : '')+
        '<button type="button" class="text-action destructive" data-remove-edition="'+id+
        '" aria-label="'+esc(label)+' 파일 삭제" '+(importingEditions || deletingEdition?'disabled':'')+'>삭제</button>'+
      '</div>'+
    '</article>';
  });
  return '<div class="section-head"><h2 id="local-library-heading" tabindex="-1">자료 추가하기</h2></div><section class="card stack local-editions">'+
    '<p>사용할 성경 번역본 파일(.bdb)을 추가해 주세요. 주석(.cdb), 원전분해(.sdb), 원어사전(.dct) 파일도 추가할 수 있어요. 가져온 파일은 이 기기에 안전하게 저장돼요.</p>'+
    '<button class="btn primary" data-action="choose-bdb" '+(importingEditions || deletingEdition?'disabled':'')+'>'+(importingEditions?'읽는 중…':'성경 번역본·자료 파일 추가')+'</button>'+
    '<input id="bdb-files" type="file" accept=".bdb,.cdb,.sdb,.dct,application/vnd.sqlite3,application/x-sqlite3,application/octet-stream" multiple hidden>'+
    '<p id="bdb-status" class="muted" role="status">'+esc(importMessage)+'</p>'+
    '</section>'+
    '<div class="section-head" style="margin-top:24px;"><div class="row"><h2>내 성경 자료 목록</h2><span class="reading-badge">'+installedCards.length+'개 보관 중</span></div></div>'+
    (installedCards.length ? '<div class="installed-editions-list">'+installedCards.join('')+'</div>' :
      '<section class="card empty" style="margin-top:10px;"><p class="muted">아직 기기에 추가된 성경이나 주석 자료가 없어요. 위에서 파일을 추가해 보세요.</p></section>');
}
async function importBibleFiles(files) {
  if (!files.length || importingEditions || deletingEdition) return;
  importingEditions = true;
  importMessage = '기기에서 성경 파일을 확인하고 있어요.';
  render();
  const results = [];
  try {
    for (const file of files) {
      try {
        if (!bdbSizeSupported(file.size)) throw Error('size');
        const edition = await readBdb(new Uint8Array(await file.arrayBuffer()),file.name,chapterCounts);
        const {id,kind} = edition;
        const alreadyCorrect = kind==='bible'?Object.hasOwn(editions,id):
          kind==='commentary'?Object.hasOwn(commentaries,id):kind==='dictionary'?Object.hasOwn(dictionaries,id):
          originals[id]?.formatVersion===edition.formatVersion;
        if (alreadyCorrect) {
          results.push(edition.label+' · 이미 추가됨');
          continue;
        }
        await storeLocal('bible:'+edition.id,edition);
        registerLocalEdition(edition);
        results.push(edition.label+' · 추가됨 ('+({bible:'성경 번역본',commentary:'주석',original:'원전분해',dictionary:'원어사전'})[kind]+')');
      } catch {
        results.push(file.name.normalize('NFC').slice(0,80)+' · 가져오지 못했어요. 파일 형식이나 저장 공간을 확인해 주세요.');
      }
    }
  } finally {
    importingEditions = false;
    const previous = state.reader.edition, comparisonCount = state.comparison.length;
    reconcileReaderEdition();
    if (previous!==state.reader.edition || comparisonCount!==state.comparison.length) save();
    importMessage = results.join('\n');
    if (['today','calendar','bible','commentary','original','settings'].includes(view)) render();
    if (view!=='settings') notify('성경 파일 처리가 끝났어요. 설정에서 결과를 확인할 수 있어요.');
  }
}
function confirmEditionRemoval(id) {
  if (importingEditions || deletingEdition || !hasLocalEdition(id)) return;
  const label = editions[id] ?? commentaries[id]?.label ?? originals[id]?.label ?? dictionaries[id]?.label;
  dialog('자료 삭제','<p>'+esc(label)+' 파일을 이 기기에서 삭제할까요? 묵상과 구절 메모는 남아 있어요.</p>'+
    '<div class="row"><button class="btn" value="cancel">취소</button>'+
    '<button type="button" class="btn danger" data-confirm-edition-removal="'+id+'">삭제 확인</button></div>');
}
async function removeLocalEdition(id,button) {
  if (importingEditions || deletingEdition || !hasLocalEdition(id)) return;
  deletingEdition = true;
  button.disabled = true;
  const label = editions[id] ?? commentaries[id]?.label ?? originals[id]?.label ?? dictionaries[id]?.label;
  try {
    await new Promise((resolve,reject)=>{
      const transaction = db.transaction('local','readwrite');
      transaction.oncomplete = resolve;
      transaction.onabort = () => reject(transaction.error);
      transaction.objectStore('local').delete('bible:'+id);
    });
    forgetLocalEdition(id);
    reconcileReaderEdition();
    await save();
    importMessage = label+' · 삭제됨';
    modal.close();
  } catch {
    notify('자료를 삭제하지 못했어요. 다시 시도해 주세요.');
    button.disabled = false;
  } finally {
    deletingEdition = false;
    render();
  }
}
function loadLocal(key) {
  return new Promise((resolve,reject) => {
    const request = db.transaction('local').objectStore('local').get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
let ghAutoBackupTimer;
function triggerGhAutoBackup() {
  const token = localStorage.getItem('logbible-gh-token');
  const user = localStorage.getItem('logbible-gh-user')?.trim();
  const auto = localStorage.getItem('logbible-gh-auto') !== 'false';
  if (!token || !user || !auto) return;
  clearTimeout(ghAutoBackupTimer);
  ghAutoBackupTimer = setTimeout(() => {
    actions['gh-backup']?.(true);
  }, 2500);
}
async function save() {
  const status = document.querySelector('#save-status');
  if (status) status.textContent = '저장 중…';
  try {
    if (!db) throw Error('storage unavailable');
    await storeLocal('journal',state);
    writeError = false;
    if (status?.isConnected) status.textContent = '기기에 자동 저장';
    triggerGhAutoBackup();
    return true;
  } catch {
    writeError = true;
    if (status?.isConnected) status.textContent = '저장 실패 · 백업을 내보내세요';
    notify('기기에 저장하지 못했어요. 백업 파일을 내보낼 수 있어요.');
    return false;
  }
}
function navigate(screen, context, studyFromSelection = false) {
  const hash = '#'+screen;
  if (location.hash!==hash) history.pushState({qtPrevious:true,...context},'',hash);
  checkGhAutoSync();
  render(studyFromSelection);
}
function goBack() {
  if (history.state?.qtPrevious) return history.back();
  const fallback = {'hebrew-guide':'calendar','today-reading':'today',thoughts:'records',journals:'records',bundles:'records',journal:'calendar',atlas:'records',calendar:'records',prayers:'records',newyear:'journals',prayer:'prayers','prayer-edit':'prayers',reading:'records','book-checks':'records',search:'bible',commentary:'bible',original:'bible'};
  const target = view==='prayer-edit' && main.querySelector('[data-thought-editor]')?'thoughts':fallback[view] ?? 'today';
  history.replaceState(null,'','#'+target);
  render();
}
function journalDate(hash) {
  const day = hash.startsWith('journal/') ? hash.slice(8).split('/')[0] : '';
  return validDay(day)?day:'';
}
function validDay(day) {
  return typeof day==='string' && /^\d{4}-\d{2}-\d{2}$/.test(day) && dateKey(new Date(day+'T12:00:00'))===day;
}
const heading = (label,title,sub) => '<header class="page-heading"><p class="eyebrow">'+label+'</p><h1>'+title+'</h1><p class="lead">'+sub+'</p></header>';
function readRef(key) {
  const [edition,book,chapter,verse] = key.split('/');
  return {edition,book,chapter:Number(chapter),verse:Number(verse)};
}
function reference(key) {
  const {book,chapter,verse} = readRef(key);
  return titles[book]+' '+chapter+':'+verse;
}
function verseText(key) {
  const {edition,book,chapter,verse} = readRef(key);
  return data[edition]?.[book]?.[chapter]?.[verse] ?? '';
}
function setReader(key) {
  const {edition,book,chapter,verse} = readRef(key);
  swapComparison(edition);
  state.reader = {edition,book,chapter};
  setReadingBookmark(key);
  chosen.clear();
  const vNum = Number(verse) || 1;
  studySelection.commentary.location = {book,chapter,verse:vNum};
  studySelection.original.location = {book,chapter,verse:vNum};
  save();
}
function visit(key) {
  const {edition,book,chapter,verse} = readRef(key);
  if (Object.hasOwn(retiredEditions,edition) && state.reader.edition) {
    key = [state.reader.edition,book,chapter,verse].join('/');
  } else if (!Object.hasOwn(editions,edition)) {
    notify('설정에서 성경 파일을 가져오면 본문을 열 수 있어요.');
    return;
  }
  if (!verseText(key)) return notify('이 역본에서 해당 구절을 찾을 수 없어요.');
  const vNum = Number(verse) || 1;
  studySelection.commentary.location = {book,chapter,verse:vNum};
  studySelection.original.location = {book,chapter,verse:vNum};
  setReader(key);
  jumpTo = 'v-'+vNum;
  navigate('bible');
}
function returnToBible(location, verse = location?.verse) {
  if (!location || !state.reader.edition) return navigate('bible');
  const {book,chapter} = location;
  const editionsToCheck = new Set([state.reader.edition,...state.comparison,...Object.keys(editions)]);
  for (const edition of editionsToCheck) {
    const passage = data[edition]?.[book]?.[chapter];
    if (!passage) continue;
    const number = verse ?? Object.keys(passage)[0];
    const key = [edition,book,chapter,number].join('/');
    if (!verseText(key)) continue;
    if (verse) return visit(key);
    setReader(key);
    return navigate('bible');
  }
  notify(verse?'가져온 역본에서 해당 절을 찾을 수 없어요.':'가져온 역본에서 이 장을 찾을 수 없어요.');
}
function savedVerseText(key) {
  return verseText(key) || '해당 역본의 본문을 표시할 수 없어요.';
}
function dailyVerse(day,edition) {
  const available = dailyVerseRefs.map(ref=>edition+'/'+ref).filter(ref=>verseText(ref).trim());
  if (!available.length) return;
  let hash = 2166136261;
  for (const char of day) hash = Math.imul(hash ^ char.charCodeAt(0),16777619);
  return available[(hash>>>0)%available.length];
}
function rememberDailyVerse(day) {
  const edition = state.reader.edition;
  const saved = state.dailyVerses[day];
  const note = state.dailyNotes[day];
  if (saved && (note || day!==dateKey() || state.journal[day]?.verses.includes(saved.ref))) return;
  const address = saved?.ref.slice(saved.ref.indexOf('/')+1);
  const matchingRef = dailyVerseRefs.includes(address)?edition+'/'+address:undefined;
  const ref = note?.ref ?? (edition && (matchingRef && verseText(matchingRef).trim()?matchingRef:dailyVerse(day,edition)));
  if (!ref || !validRef(ref) || !verseText(ref).trim()) {
    if (edition && saved && !matchingRef) {
      delete state.dailyVerses[day];
      if (db) save();
    }
    return;
  }
  const body = verseText(ref);
  const label = editionLabel(readRef(ref).edition);
  if (saved?.ref===ref && saved.body===body && saved.label===label) return;
  state.dailyVerses[day] = {ref,body,label};
  if (db) save();
}
function journalsOn(day) {
  const entry=state.journal[day];
  return entry?[[day,entry,''],...(entry.notes ?? []).map(note=>[day,note,note.id])]:[];
}
function allJournalEntries(){return Object.keys(state.journal).flatMap(journalsOn);}
function journalRoute(day,id=''){return 'journal/'+day+(id?'/'+id:'');}
function journalEntry(day,id=activeJournalId) {
  const parent=state.journal[day] ??= {done:false,verses:[]};
  return id?(parent.notes ?? []).find(note=>note.id===id) ?? parent:parent;
}
function startTodayJournal(){
  const day=dateKey(),parent=state.journal[day];
  if(!parent || !parent.done){navigate(journalRoute(day));return;}
  let note=(parent.notes ?? []).find(note=>!note.done);
  if(!note){note={id:newId(),done:false,verses:[],reflection:'',created:new Date().toISOString()};(parent.notes ??= []).push(note);save();}
  navigate(journalRoute(day,note.id));
}
function hasJournalContent(entry) {
  return Boolean(entry.done || entry.title?.trim() || entry.reflection?.trim() || entry.verses.length || entry.comments?.length);
}
function writingHeader(symbol,label,title,meta = '') {
  return '<header class="writing-header"><span class="writing-icon">'+icon(symbol)+'</span><div>'+
    '<p class="eyebrow">'+label+'</p><h1>'+title+'</h1>'+meta+'</div></header>';
}
function journalScreen() {
  const day = selectedDay;
  const entry = journalEntry(day);
  const validRefs = (entry.verses || []).filter(validRef);
  let refs = '';
  if (validRefs.length) {
    const chMap = new Map();
    for (const ref of validRefs) {
      const {edition, book, chapter, verse} = readRef(ref);
      const chKey = [edition, book, chapter].join('/');
      if (!chMap.has(chKey)) chMap.set(chKey, []);
      chMap.get(chKey).push(verse);
    }
    const chSummaries = [...chMap.entries()].map(([chKey, vNums]) => {
      vNums.sort((a,b) => a - b);
      return selectionReference(chKey + '/' + vNums[0], vNums);
    });
    const combinedRefTitle = chSummaries.join(', ');

    refs = '<section class="journal-verses-card card">'+
      '<div class="journal-verses-header row">'+
        '<div class="row" style="gap:6px; align-items:center;">'+
          '<span class="kicker" style="margin:0;">📖 묵상에 담은 말씀</span>'+
          '<span class="pill" style="font-size:0.75rem; padding:1px 8px;">'+validRefs.length+'구절</span>'+
        '</div>'+
        '<span class="muted" style="font-size:0.8125rem;">'+esc(combinedRefTitle)+'</span>'+
      '</div>'+
      '<div class="journal-verses-list">'+
        validRefs.map(ref => {
          const body = savedVerseText(ref) || verseText(ref);
          return '<div class="journal-verse-row">'+
            '<div class="row journal-verse-head">'+
              '<button type="button" class="note-link" data-visit="'+ref+'">'+esc(reference(ref))+' · '+esc(editionLabel(readRef(ref).edition))+'</button>'+
              '<button type="button" class="text-action destructive" data-remove="'+ref+'" data-date="'+day+'" aria-label="묵상에서 '+esc(reference(ref))+' 빼기">빼기</button>'+
            '</div>'+
            '<p class="journal-verse-text">'+esc(body)+'</p>'+
          '</div>';
        }).join('')+
      '</div>'+
    '</section>';
  }
  const date = new Intl.DateTimeFormat('ko-KR',{year:'numeric',month:'long',day:'numeric',weekday:'long'}).format(new Date(day+'T12:00:00'));
  return '<article class="post-editor journal-editor">'+writingHeader('comment','묵상 노트','나의 묵상',
    '<div class="post-meta"><time datetime="'+day+'">'+esc(date)+'</time><span id="save-status" class="save">'+
    (writeError?'저장 실패':'기기에 자동 저장')+'</span></div>')+
    '<div class="journal-editor-fields writing-panel">'+
    editorField('제목','title',entry.title,'text','aria-label="묵상 제목" data-journal-field="title" maxlength="150" placeholder="제목을 입력하세요 (선택)"')+
    refs+
    editorField('묵상 내용','reflection',entry.reflection,'textarea','aria-label="묵상 본문" data-journal-field="reflection" rows="5" placeholder="마음에 남은 말씀과 생각을 적어보세요."')+
    '</div><footer class="post-actions">'+
    '<button class="text-action destructive" data-delete-journal="'+day+'" '+(!hasJournalContent(entry)?'hidden':'')+'>묵상 삭제</button>'+
    '<button class="btn '+(entry.done?'':'primary')+'" data-done="'+day+'" aria-pressed="'+Boolean(entry.done)+'">'+(entry.done?'✓ QT 완료':'QT 마치기')+'</button>'+
    '</footer></article>'+
    (state.dailyNotes[day]?dailyNoteCard(day):'')+(entry.done?journalComments(day,entry.comments ?? []):'');
}
function journalComments(day,comments) {
  return '<section class="post-comments"><h2>댓글 <span class="comment-count">'+comments.length+'</span></h2>'+
    (comments.length?comments.map(item=>'<article class="post-comment"><div class="row"><div class="comment-author"><span class="comment-avatar" aria-hidden="true">나</span><div><strong>나</strong><time datetime="'+esc(item.created)+'">'+esc(new Date(item.created).toLocaleString('ko-KR'))+'</time></div></div>'+
      '<div class="item-actions"><button class="text-action" data-comment-day="'+day+'" data-comment-id="'+item.id+'">편집</button><button class="text-action destructive" data-delete-comment="'+item.id+'" data-date="'+day+'">삭제</button></div></div>'+
      '<p class="record-text">'+esc(item.body)+'</p></article>').join(''):'<p class="muted comment-empty">아직 댓글이 없어요.</p>')+
    '<form class="comment-compose" data-comment-form="'+day+'">'+editorField('댓글 쓰기','comment','','textarea','rows="2" required placeholder="묵상에 덧붙이고 싶은 생각을 남겨보세요."')+'<button class="btn primary" type="submit">등록</button></form></section>';
}
function devotionHeading(active) {
  const yearly=active==='newyear';
  return '<header class="page-heading journal-feed-page-heading"><p class="eyebrow">MY DEVOTIONS</p><div class="journal-feed-title-row"><h1>묵상 노트 모아보기</h1><button type="button" class="btn primary journal-feed-add" '+(yearly?'data-action="add-year"':'data-add-journal="true"')+'><span aria-hidden="true">＋</span> <span class="journal-add-label">'+(yearly?'새해 말씀 추가':'묵상 노트 추가')+'</span></button></div><p class="lead">'+(yearly?'한 해 동안 붙들고 싶은 말씀을 연도별로 모아보세요.':'마음에 남은 말씀과 묵상을 모아보세요.')+'</p></header><nav class="devotion-sections" aria-label="묵상 기록 종류">'+[['journals','묵상 노트'],['newyear','새해 말씀']].map(([route,label])=>'<button type="button" data-nav="'+route+'" aria-current="'+(route===active?'page':'false')+'">'+label+'</button>').join('')+'</nav>';
}
function yearDisplayReference(ref) {
  const saved=readRef(ref),edition=state.reader.edition || saved.edition;
  const key=[edition,saved.book,saved.chapter,saved.verse].join('/');
  const body=verseText(key);
  return {key,edition,label:editionLabel(edition),available:Boolean(body.trim()),body:body || '현재 선택한 번역본에는 이 구절의 본문이 없어요.'};
}
function todayYearVerse(day) {
  const year=Number(day.slice(0,4));
  const entries=state.newYear.filter(item=>Number(item.year)===year).sort((a,b)=>(b.day ?? '').localeCompare(a.day ?? ''));
  const item=entries[0];
  const preview=item?(item.refs.map(ref=>{const shown=yearDisplayReference(ref);return '<span class="today-year-line" lang="'+(localLanguages[shown.edition] ?? 'ko')+'">'+esc(shown.body)+'</span>';}).join('')||'<span class="today-year-line" lang="ko">'+esc(item.title||item.note||'')+'</span>'):'';
  return '<button type="button" class="card today-year-verse" data-open-year="'+year+'"><span class="today-year-emblem">'+icon('yearVerse')+'</span><span class="today-year-copy"><small>'+year+' 올해의 말씀'+(entries.length>1?' · '+entries.length+'건':'')+(item?.refs.length?' · '+esc(yearDisplayReference(item.refs[0]).label):'')+'</small><span class="today-year-body">'+(preview||'<span class="today-year-line" lang="ko">한 해 동안 묵상할 말씀을 담아보세요.</span>')+'</span></span>'+icon('right')+'</button>';
}
function journalsScreen() {
  const entries = allJournalEntries()
    .filter(([_, entry]) => hasJournalContent(entry))
    .sort(([dayA], [dayB]) => dayB.localeCompare(dayA));

  const count = entries.length;
  const cards = entries.map(([day, entry, noteId]) => {
    const date = new Intl.DateTimeFormat('ko-KR',{year:'numeric',month:'long',day:'numeric',weekday:'long'}).format(new Date(day+'T12:00:00'));
    const validRefs = (entry.verses || []).filter(validRef);
    let versesHtml = '';
    if (validRefs.length) {
      versesHtml = '<blockquote class="calendar-quote-body journal-feed-quote">'+
        validRefs.map(ref => {
          const body = savedVerseText(ref) || verseText(ref);
          return '<div class="journal-feed-verse-item">'+
            '<button type="button" class="note-link" data-visit="'+ref+'">'+esc(reference(ref))+' · '+esc(editionLabel(readRef(ref).edition))+'</button> '+
            '<span class="verse-text">'+esc(body)+'</span>'+
          '</div>';
        }).join('')+
      '</blockquote>';
    }

    return '<article class="card stack journal-feed-card" style="gap:10px">'+
      '<div class="row"><time datetime="'+day+'" class="kicker">'+esc(date)+'</time>'+
      (entry.done ? '<span class="pill" style="font-size:0.75rem;min-height:28px;padding:2px 10px;background:var(--light);color:var(--green)">✓ QT 완료</span>' : '')+
      '</div>'+
      (entry.title ? '<h2 style="font-size:1.1875rem;margin:2px 0">'+esc(entry.title)+'</h2>' : '')+
      versesHtml+
      (entry.reflection ? '<div class="record-text" style="white-space:pre-wrap;margin:4px 0;line-height:var(--reading-leading, 1.65)">'+esc(entry.reflection)+'</div>' : '')+
      '<footer class="journal-feed-actions">'+
      '<button type="button" class="text-action destructive" data-delete-journal="'+day+'" data-journal-note="'+noteId+'" aria-label="'+esc(date)+' 묵상 삭제">삭제</button>'+
      '<button type="button" class="btn" data-edit-journal="'+day+'" data-journal-note="'+noteId+'" aria-label="'+esc(date)+' 묵상 수정">'+icon('edit')+' 수정</button>'+
      '<button type="button" class="btn" data-nav="'+journalRoute(day,noteId)+'">묵상 열기 '+icon('right')+'</button>'+
      '</footer>'+
      '</article>';
  }).join('');

  return devotionHeading('journals')+
    '<div class="section-head"><h2>전체 묵상 <span class="comment-count">'+count+'편</span></h2></div>'+
    '<div class="journal-feed stack">'+(cards || '<p class="empty">아직 작성된 묵상 노트가 없어요. 위의 추가 버튼으로 첫 묵상을 기록해 보세요.</p>')+'</div>';
}
function dailyVerseQuote(key) {
  const quote = verseText(key);
  return (quote?'<blockquote>'+esc(quote)+'</blockquote>':'<p class="muted">이 구절의 번역본을 가져오면 본문을 볼 수 있어요.</p>')+
    '<p class="ref">'+esc(reference(key))+' · '+esc(editionLabel(readRef(key).edition))+'</p>'+
    (quote?'<button type="button" class="btn" data-visit="'+key+'">본문에서 읽기 '+icon('arrow')+'</button>':'');
}
function dailyNoteFields(day, note, compact = false) {
  return editorField('묵상 내용','body',note?.body,'textarea','rows="'+(compact?3:7)+'" maxlength="'+dailyNoteLimit+
    '" required placeholder="마음에 남은 생각을 적어보세요."')+draftNotice()+
    '<div class="row daily-note-actions"><span class="muted">'+(note?'✓ 묵상 달력에 기록됨':'저장하면 묵상 달력에 표시돼요.')+'</span>'+
    (note?'<button type="button" class="text-action destructive" data-delete-daily-note="'+day+'">삭제</button>':'')+
    '<button class="btn primary" type="submit">'+(note?'수정 저장':'저장')+'</button></div>';
}
function dailyNoteCard(day) {
  const note = state.dailyNotes[day];
  return '<section id="daily-note" class="card daily-note-history" aria-labelledby="daily-note-heading">'+
    '<h2 id="daily-note-heading" class="kicker" tabindex="-1"><span aria-hidden="true">✦</span> 이날의 말씀</h2>'+
    dailyVerseQuote(note.ref)+'<form class="daily-note-form" data-daily-note="'+day+'" data-ref="'+note.ref+'">'+
    dailyNoteFields(day,note)+'</form></section>';
}
function noteEditorContext(refLabel,key,quote,collapsed = false) {
  const body = quote?'<blockquote>'+esc(quote)+'</blockquote>':'';
  return '<div class="note-editor-context"><p class="ref">'+icon('book')+'<span>'+
    esc(refLabel)+' · '+esc(editionLabel(readRef(key).edition))+'</span></p>'+
    (collapsed?'<details><summary>선택한 말씀 펼치기</summary>'+body+'</details>':body)+'</div>';
}
function showDailyNote(day = dateKey()) {
  const note = state.dailyNotes[day];
  const saved = state.dailyVerses[day];
  const key = note?.ref ?? saved?.ref;
  if (!key) return;
  const quote = saved?.ref===key?saved.body:verseText(key);
  dialog('말씀 묵상 노트',noteEditorContext(reference(key),key,quote)+dailyNoteFields(day,note,true));
  const form = modal.querySelector('form');
  form.classList.add('note-editor-dialog');
  form.dataset.dailyNote = day;
  form.dataset.ref = key;
  prepareDraft(form,'daily/'+day+'/'+key,['body']);
  resizeWriting(form.elements.body);
}
async function saveDailyNote(form) {
  const day = form.dataset.dailyNote, ref = form.dataset.ref;
  const field = form.elements.body, body = field.value.trim();
  if (!body) return notify('묵상을 적어 주세요.');
  if (!validDay(day) || !validRef(ref)) return;
  const draft = draftSnapshot(form);
  const previous = state.dailyNotes[day];
  const entry = {ref,body};
  state.dailyNotes[day] = entry;
  const submit = form.querySelector('[type="submit"]');
  submit.disabled = true;
  field.readOnly = true;
  if (await save()) {
    finishDraft(form,draft);
    const inDialog = modal.contains(form);
    if (inDialog) modal.close();
    if (form.isConnected) {
      render();
      if (inDialog) main.querySelector('[data-action="open-today-note"]')?.focus({preventScroll:true});
    }
    notify('말씀 묵상을 달력에 기록했어요.');
  } else {
    if (state.dailyNotes[day]===entry) {
      if (previous) state.dailyNotes[day] = previous;
      else delete state.dailyNotes[day];
    }
    submit.disabled = false;
    field.readOnly = false;
  }
}
function cardHit(label,attributes) {
  return '<button type="button" class="card-hit" aria-label="'+esc(label)+'" '+attributes+'></button>';
}
function todaySummary(day,journal) {
  const prayers = state.prayers.filter(item=>item.day===day);
  const thoughts = prayers.filter(item=>item.kind==='thought').length;
  const entries = [
    ['comment','묵상 노트',journalsOn(day).filter(([,entry])=>entry.done||hasJournalContent(entry)).length+'건','data-start-journal="true"'],
    ['prayer','기도',prayers.length-thoughts+'건','data-nav="prayers"'],
    ['note','오늘의 생각',thoughts+'건','data-action="open-today-thoughts" aria-expanded="'+todayThoughtsOpen+'"'],
  ];
  return '<section class="today-summary" aria-labelledby="today-summary-heading"><div class="row today-summary-heading">'+
    '<h2 id="today-summary-heading">오늘의 요약</h2><button type="button" class="text-action today-calendar-link" data-action="open-today-calendar">'+icon('calendar')+' 묵상 달력 '+icon('right')+'</button></div>'+
    '<div class="today-summary-grid">'+entries.map(([symbol,label,value,action])=>
      '<button type="button" class="today-summary-item" '+action+'><span>'+icon(symbol)+label+'</span><strong>'+value+'</strong>'+
      (symbol==='check'?'<progress class="today-reading-progress" aria-hidden="true" max="'+state.readingGoal+'" value="'+Math.min(read,state.readingGoal)+'"></progress>':'')+
      '</button>').join('')+'</div>'+todayThoughts(day)+'</section>';
}
function todayThoughts(day){
  const items=state.prayers.filter(item=>item.kind==='thought'&&item.day===day);
  return '<section class="today-thoughts-section" id="today-thoughts" aria-labelledby="today-thoughts-title" '+(!todayThoughtsOpen?'hidden':'')+'><header class="row today-section-header"><div><h2 id="today-thoughts-title">오늘의 생각</h2><span>'+items.length+'개의 기록</span></div><button type="button" class="text-action" data-nav="thoughts">전체 생각노트 '+icon('right')+'</button></header><div class="card today-thoughts-card">'+
    (items.length?'<div class="today-thoughts-list">'+items.map(item=>'<button type="button" class="today-thought-preview" data-prayer="'+item.id+'" aria-label="생각노트 열기"><p>'+esc(item.body)+'</p>'+icon('right')+'</button>').join('')+'</div>':'<div class="today-thoughts-empty"><span>'+icon('note')+'</span><p>오늘 남긴 생각노트가 없어요.</p><small>떠오른 생각을 편하게 남겨보세요.</small></div>')+
    '<button type="button" class="today-thought-add" data-action="add-thought">'+icon('edit')+' 생각노트 추가</button></div></section>';
}
function todayPlan(day=dateKey()) {
  const canon=canonChapters(),progress=readingProgress(canon),planned=planChapters(canon,state.readingRange);
  const scope=planned.length?planned:canon,checked=checkedChaptersOn(day),done=scope.filter(key=>checked.has(key));
  const queue=state.readingRange?scope.filter(key=>!progress.counts.has(key)):progress.remaining;
  const next=queue.filter(key=>!checked.has(key)).slice(0,Math.max(0,state.readingGoal-done.length));
  return {done,next};
}
function todayPlanBrowser(day,next){
  const book=todayPlanBook || next[0]?.split('/')[0] || state.reader.book || 'GEN';
  const {counts}=readingProgress(canonChapters(),day.slice(0,4));
  const due=new Set(next),checkedToday=checkedChaptersOn(day);
  const switcher='<div class="today-plan-view-switch">'+[['books','성경책별'],['due','오늘 분량']].map(([mode,label])=>'<button type="button" data-today-plan-mode="'+mode+'" aria-pressed="'+(todayPlanMode===mode)+'">'+label+'</button>').join('')+'</div>';
  if(todayPlanMode==='due')return switcher;
  const picker=todayBookPicker?'<div class="today-book-picker"><div class="today-book-scopes">'+[['old','구약'],['new','신약']].map(([id,label])=>'<button type="button" data-today-book-scope="'+id+'" aria-pressed="'+(todayBookScope===id)+'">'+label+'</button>').join('')+'</div><div class="today-book-grid">'+books.filter(([id])=>testamentByBook[id]===todayBookScope).map(([id,title])=>'<button type="button" data-today-plan-book="'+id+'" aria-pressed="'+(id===book)+'">'+title+'</button>').join('')+'</div></div>':'';
  return switcher+'<div class="today-plan-book-heading"><strong>'+esc(titles[book])+'</strong><button type="button" data-today-book-picker="true" aria-expanded="'+todayBookPicker+'">성경책 선택 '+icon('down')+'</button></div>'+picker+'<p class="today-chapter-hint">'+day.slice(0,4)+'년 묵상 체크 · 장을 누르면 본문으로 이동해요.</p><div class="today-plan-chapters">'+chapterNumbers(book).map(chapter=>{const key=book+'/'+chapter;return '<button type="button" class="today-chapter-tile '+(counts.has(key)?'done':'')+(due.has(key)?' due':'')+'" data-open-chapter="'+key+'" aria-label="'+esc(chapterLabel(key))+(due.has(key)?' 오늘 분량':'')+(checkedToday.has(key)?' 오늘 완료':'')+'"><strong>'+chapter+'장</strong><span>'+(checkedToday.has(key)?'오늘 완료':due.has(key)?'오늘 분량':counts.has(key)?'✓ '+counts.get(key)+'회':'—')+'</span></button>';}).join('')+'</div>';
}
function todayPlanCard(day){
  const {done,next}=todayPlan(day),fromJournal=journalChapters(state.journal[day]);
  const row=(key,complete)=>'<div class="today-plan-row '+(complete?'is-complete':'')+'"><button type="button" class="today-plan-open" data-open-chapter="'+key+'"><span>'+icon('book')+'</span><span><strong>'+esc(chapterLabel(key))+'</strong><small>'+(complete?'오늘 읽은 말씀':'본문으로 이동')+'</small></span>'+icon('right')+'</button><button type="button" class="today-plan-check" data-check-chapter="'+key+'" aria-pressed="'+complete+'" aria-label="'+esc(chapterLabel(key))+' '+(complete?'완료 체크 해제':'완료 체크')+'" '+(fromJournal.has(key)?'disabled':'')+'>'+icon('check')+'<span>'+(complete?'완료':'체크')+'</span></button></div>';
  const range=state.readingRange;
  return '<section class="card today-plan-card" aria-labelledby="today-plan-title"><header class="row"><div><p class="eyebrow">매일 말씀 읽기</p><h2 id="today-plan-title">오늘의 통독</h2></div><span class="pill">'+done.length+' / '+state.readingGoal+'장</span></header><progress class="today-plan-progress" max="'+state.readingGoal+'" value="'+Math.min(done.length,state.readingGoal)+'" aria-label="오늘의 통독 진행"></progress><p class="muted">'+(range?esc(chapterLabel(range.start)+'부터 '+chapterLabel(range.end)+'까지'):'성경 전체 순서')+' · 하루 '+state.readingGoal+'장</p>'+todayPlanBrowser(day,next)+(todayPlanMode==='due'?'<div class="today-plan-grid">'+next.map(key=>row(key,false)).join('')+done.map(key=>row(key,true)).join('')+'</div>':'')+(!next.length?'<p class="today-plan-finished">'+(done.length>=state.readingGoal?'오늘의 통독 목표를 마쳤어요.':'계획한 범위를 모두 읽었어요.')+'</p>':'')+'</section>';
}
function todayReadingScreen() {
  const day=dateKey(),canon=canonChapters(),progress=readingProgress(canon),planned=planChapters(canon,state.readingRange);
  const scope=planned.length?planned:canon,done=scope.filter(key=>checkedChaptersOn(day).has(key));
  const queue=state.readingRange?scope.filter(key=>!progress.counts.has(key)):progress.remaining;
  const next=queue.filter(key=>!done.includes(key)).slice(0,Math.max(0,state.readingGoal-done.length));
  const row=(key,complete)=>'<button type="button" class="today-reading-row" data-open-chapter="'+key+'"><span class="today-reading-symbol">'+icon(complete?'check':'book')+'</span><span><strong>'+esc(chapterLabel(key))+'</strong><small>'+(complete?'오늘 묵상 완료':'읽고 묵상하기')+'</small></span>'+icon('right')+'</button>';
  return heading('TODAY’S READING','오늘의 묵상',longDate(day))+
    '<section class="card today-reading-list"><div class="row"><h2>오늘 읽을 말씀</h2><span class="pill">'+done.length+' / '+state.readingGoal+'장</span></div><p class="muted">'+(state.readingRange?'설정한 통독 범위':'성경 순서')+'와 하루 '+state.readingGoal+'장 목표에 맞춘 분량이에요.</p>'+
    (next.length?next.map(key=>row(key,false)).join(''):'<p class="today-reading-finished">'+(done.length>=state.readingGoal?'오늘 목표를 마쳤어요.':'설정한 범위의 읽을 분량을 모두 마쳤어요.')+'</p>')+'</section>'+
    (done.length?'<section class="card today-reading-list"><h2>오늘 묵상한 말씀</h2>'+done.map(key=>row(key,true)).join('')+'</section>':'');
}
function todayScreen() {
  const today = dateKey(), reader = state.reader;
  const saved = state.dailyVerses[today];
  const selectedRef = saved && reader.edition?reader.edition+saved.ref.slice(saved.ref.indexOf('/')):undefined;
  const selectedText = selectedRef?verseText(selectedRef):'';
  const {ref:key,body:quote,label} = selectedText.trim()?
    {ref:selectedRef,body:selectedText,label:editionLabel(reader.edition)}:saved ?? {};
  const hasPassage = Boolean(key && verseText(key));
  const heroLink = hasPassage?'오늘의 말씀 본문으로 이동':'성경 번역본 추가';
  const heroAction = hasPassage?'data-visit="'+key+'"':'data-nav="settings" data-import-link';
  return '<header class="today-heading"><time class="date-tag" datetime="'+today+'">'+icon('calendar')+longDate(today)+'</time><h1>오늘의 QT</h1></header>'+
    '<section class="hero today-verse-card tappable-card" aria-labelledby="today-verse-heading">'+cardHit(heroLink,heroAction)+
    '<h2 id="today-verse-heading"><span class="today-verse-icon">'+icon('sun')+'</span>오늘의 말씀</h2>'+
    (key?'<div class="today-quote"><div><blockquote>'+esc(quote)+
      '</blockquote><p class="ref"><strong>'+esc(reference(key))+'</strong><span>'+esc(label)+'</span></p></div></div>':
      '<p class="today-verse-empty">'+(reader.edition?'이 번역본에는 오늘의 말씀 후보에 해당하는 구절이 없어요.':'사용할 성경 번역본 파일을 추가해 주세요.')+'</p>')+
    '</section>'+
    todayYearVerse(today)+todaySummary(today,state.journal[today])+todayPlanCard(today);
}
function options(items,active) {
  return items.map(([value,label]) => '<option value="'+esc(value)+'" '+(String(value)===String(active)?'selected':'')+'>'+esc(label)+'</option>').join('');
}
function readerPickerField(label,value,action,description) {
  return '<div class="field">'+(label?'<span>'+label+'</span>':'')+'<button type="button" class="reader-picker-trigger" data-action="'+action+'" '+
    'aria-haspopup="dialog" aria-label="'+description+' · '+esc(value)+'">'+
    '<span>'+esc(value)+'</span></button></div>';
}
function bookPickerField(book,label = '성경') {
  return readerPickerField(label,titles[book],'pick-book','성경책 선택');
}
function verseButton(edition,book,chapter,num,content,marker,secondary = false) {
  if (!content) return '<span class="missing-verse">'+(secondary?esc(editionLabel(edition)):num+'절')+' · 이 역본에 본문 없음</span>';
  const key = [edition,book,chapter,num].join('/');
  const mark = state.marks[key];
  const verse = '<button id="'+(secondary?'compare-v-'+edition+'-':'v-')+num+'" class="verse'+(secondary?' verse-support':'')+'" data-verse="'+key+'"'+
    (!secondary && !state.comparison.length?' data-reading-verse="'+num+'"':'')+' lang="'+(localLanguages[edition] ?? 'ko')+'" aria-pressed="'+chosen.has(key)+'">'+
    '<span class="number" '+(secondary?'aria-hidden="true" style="visibility:hidden"':'')+'>'+num+'</span><span class="verse-content">'+(secondary?'<span class="comparison-edition">'+esc(editionLabel(edition))+'</span>':'')+markedText(content,marker)+'</span></button>';
  return mark?.note?'<div class="verse-with-note">'+verse+
    '<button type="button" class="verse-note-icon" data-edit-verse-note="'+key+'" aria-label="'+num+'절 메모 보기">'+icon('note')+'</button></div>':verse;
}
function readerScreen() {
  const {edition,book,chapter} = state.reader;
  if (!edition) return '<section class="card stack spaced"><p>사용할 성경 번역본 파일을 추가해 주세요.</p><button class="btn primary" data-nav="settings" data-import-link>성경 번역본 추가</button></section>';
  const chapters = data[edition]?.[book] ?? {};
  const verses = chapters[chapter] ?? {};
  const comparison = state.comparison;
  const otherVerses = comparison.map(id=>data[id]?.[book]?.[chapter] ?? {});
  const numbers = [...new Set([...Object.keys(verses),...otherVerses.flatMap(Object.keys)])].sort((a,b)=>a-b);
  const markers = indexVerseMarkers();
  const rows = numbers.map(num => {
    const marker = markers.get([book,chapter,num].join('/'))?.mark;
    const first = verseButton(edition,book,chapter,num,verses[num],marker);
    if (!comparison.length) return first;
    const alternatives = comparison.map((id,index)=>verseButton(id,book,chapter,num,otherVerses[index][num],undefined,true));
    return '<div class="verse-pair" data-reading-verse="'+num+'">'+first+alternatives.join('')+'</div>';
  }).join('');
  const available = availableChapters(edition);
  const index = available.indexOf(book+'/'+chapter);
  const atStart = index<=0;
  const atEnd = index>=available.length-1;
  return '<div class="reader-controls">'+readerPickerField('',editionLabel(edition),'pick-edition','번역본 선택')+
      '<button type="button" class="btn compare-toggle" data-action="compare" aria-label="역본 대조" title="역본 대조" aria-haspopup="dialog" aria-pressed="'+
        Boolean(comparison.length)+'" '+(Object.keys(editions).length<2?'disabled':'')+'>'+icon('compare')+'</button>'+
      bookPickerField(book,'')+readerPickerField('',chapter+'장','jump-chapter','장·절 이동')+'</div>'+
    '<article class="reading bible-passage'+(comparison.length?' comparing':'')+'"><header class="passage-heading passage-navigation">'+
    '<button class="btn chapter-arrow" data-step="-1" aria-label="위쪽 이전 장" '+(atStart?'disabled':'')+'>'+icon('left')+'</button>'+
    '<div class="passage-title"><strong>'+titles[book]+' '+chapter+'장</strong></div>'+
    '<button class="btn chapter-arrow" data-step="1" aria-label="위쪽 다음 장" '+(atEnd?'disabled':'')+'>'+icon('right')+'</button></header>'+
    (rows || '<p>본문을 불러올 수 없어요. 연결을 확인한 뒤 다시 열어주세요.</p>')+'</article>'+verseActions()+
    (rows?chapterCheckControl(book,chapter):'')+
    '<div class="row"><button class="btn" data-step="-1" '+(atStart?'disabled':'')+'>← 이전 장</button><button class="btn" data-step="1" '+(atEnd?'disabled':'')+'>다음 장 →</button></div>';
}
function initialReader(edition) {
  const [book,chapter] = (availableChapters(edition)[0] ?? 'JHN/1').split('/');
  return {edition,book,chapter:Number(chapter)};
}
function availableChapters(edition) {
  return books.flatMap(([book])=>Object.keys(data[edition]?.[book] ?? {}).map(chapter=>book+'/'+chapter));
}
const searchAliases = '창 출 레 민 신 수 삿 룻 삼상 삼하 왕상 왕하 대상 대하 스 느 에 욥 시 잠 전 아 사 렘 애 겔 단 호 욜 암 옵 욘 미 나 합 습 학 슥 말 마 막 눅 요 행 롬 고전 고후 갈 엡 빌 골 살전 살후 딤전 딤후 딛 몬 히 약 벧전 벧후 요일 요이 요삼 유 계'.split(' ');
const searchBooks = Object.fromEntries(books.flatMap(([code,title],index)=>[[title,code],[searchAliases[index],code],[code.toLowerCase(),code]]));
const searchText = text => text.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
function parseChapterVerse(query) {
  const match = query.match(/^(\d+)(?:(?:\s*:\s*|\s+|\s*장\s*:?\s*)(\d+)\s*절?|\s*장)?$/);
  if (!match) return;
  return {chapter:Number(match[1]),verse:match[2]===undefined?undefined:Number(match[2])};
}
function parseBibleReference(query) {
  const normalized = query.normalize('NFKC').trim();
  const bookName = normalized.toLowerCase();
  if (Object.hasOwn(searchBooks,bookName)) return {book:searchBooks[bookName]};
  const position = parseChapterVerse(normalized);
  if (position) return position;
  const match = normalized.match(/^(.+?)\s*(\d.*)$/);
  const alias = match?.[1].trim().toLowerCase();
  if (!Object.hasOwn(searchBooks,alias)) return;
  const namedPosition = parseChapterVerse(match[2]);
  if (namedPosition) return {...namedPosition,book:searchBooks[alias]};
}
function searchBible(edition,query) {
  const source = data[edition] ?? {};
  const position = parseBibleReference(query);
  let bookStart;
  if (position) {
    const {book = state.reader.book} = position;
    const chapters = source[book] ?? {};
    const chapter = position.chapter ?? Object.keys(chapters).find(number=>Object.values(chapters[number]).some(Boolean));
    const verses = chapters[chapter] ?? {};
    const verse = position.verse ?? (verses[1]?1:Object.keys(verses).find(number=>verses[number]));
    const key = verses[verse]?[edition,book,chapter,verse].join('/'):undefined;
    const fullBookName = position.chapter===undefined && position.book && titles[position.book]===query.normalize('NFKC').trim();
    if (!fullBookName) return {keys:key?[key]:[],reference:true};
    bookStart = key;
  }
  const needle = searchText(query), keys = [];
  if (needle) for (const [book] of books) {
    if (bibleSearchScope!=='all' && bibleSearchScope!==book && bibleSearchScope!==testamentByBook[book]) continue;
    for (const [chapter,verses] of Object.entries(source[book] ?? {})) {
      for (const [verse,body] of Object.entries(verses)) {
        if (!searchText(body).includes(needle)) continue;
        keys.push([edition,book,chapter,verse].join('/'));
      }
    }
  }
  return {keys,bookStart};
}
const originalSearchText = text => searchText(text.normalize('NFKD').replace(/\p{M}/gu,'')).replace(/ς/g,'σ');
function originalSearchCode(text) {
  const code = text.trim().match(/^W?([HG])\s*0*(\d{1,5})([A-Z]?)$/i);
  return code?(code[1]+Number(code[2])+code[3]).toUpperCase():'';
}
function searchOriginal(query) {
  const excerpts = new Map();
  const keys = [];
  const add = (book,chapter,verse,excerpt) => {
    const key = ['original',book,chapter,verse].join('/');
    keys.push(key);
    excerpts.set(key,excerpt);
  };
  const position = parseBibleReference(query);
  if (position) {
    const book = position.book ?? studySelection.original.location?.book ?? state.reader.book;
    const chapters = studyBookChapters('original',book) ?? {};
    const chapter = position.chapter ?? Object.keys(chapters)[0];
    const verses = studyChapterVerses('original',book,chapter);
    const verse = position.verse ?? Object.keys(verses).find(number=>Number(number)>0 && verses[number]);
    if (verse>0 && verse<=500 && verses[verse]) {
      const original = originalPassageSource(book,chapter).chapters?.[chapter]?.[verse];
      const words = originalVerseLines(studySource('original')?.verses[book]?.[chapter]?.[verse] ?? '');
      add(book,chapter,verse,original || words.map(word=>word.form ?? word.line).join(' '));
    }
    return {keys,excerpts,reference:true};
  }
  const needle = originalSearchText(query);
  const strong = originalSearchCode(query);
  const analysis = studySource('original')?.verses;
  if (needle) for (const [book] of books) {
    if (bibleSearchScope!=='all' && bibleSearchScope!==book && bibleSearchScope!==testamentByBook[book]) continue;
    const chapters = studyBookChapters('original',book) ?? {};
    for (const chapter of Object.keys(chapters)) {
      const original = originalPassageSource(book,chapter).chapters?.[chapter] ?? {};
      const breakdown = analysis?.[book]?.[chapter] ?? {};
      for (const verse of new Set([...Object.keys(original),...Object.keys(breakdown)].sort((a,b)=>a-b))) {
        if (Number(verse)<=0 || Number(verse)>500) continue;
        const text = original[verse] ?? '';
        if (!strong && originalSearchText(text).includes(needle)) {
          add(book,chapter,verse,text);
          continue;
        }
        const words = originalVerseLines(breakdown[verse] ?? '');
        const forms = words.map(word=>word.form ?? '').join(' ');
        const match = words.find(word=>{
          if (strong) return [...(word.lemma ?? word.line ?? '').matchAll(/(?:<|\b)(W?[HG]\s*\d+[A-Z]?)(?=>|\b)/gi)]
            .some(([,code])=>originalSearchCode(code)===strong);
          return [word.form,word.lemma,word.gloss,word.line].some(field=>field && originalSearchText(field).includes(needle));
        });
        if (match || (!strong && originalSearchText(forms).includes(needle))) {
          add(book,chapter,verse,[match?.form,match?.gloss].filter(Boolean).join(' · ') || text || forms || match?.line || '');
        }
      }
    }
  }
  return {keys,excerpts};
}
function readerSearchName(screen) {
  return screen==='records'?'기록 검색':screen==='original'?'원문 검색':'성경 검색';
}
function pageSearchType(currentView) {
  if (currentView === 'journals') return 'journal';
  if (currentView === 'prayers') return 'prayer';
  if (currentView === 'thoughts') return 'thought';
  if (currentView === 'newyear') return 'yearly';
  return 'all';
}
function pageSearchTitle(currentView) {
  if (currentView === 'journals') return '묵상 노트 검색';
  if (currentView === 'prayers') return '기도 검색';
  if (currentView === 'thoughts') return '생각 노트 검색';
  if (currentView === 'newyear') return '새해 말씀 검색';
  if (currentView === 'calendar') return '달력 기록 검색';
  return '내 기록 검색';
}
function isPageSearchable(currentView) {
  return ['records', 'journals', 'calendar', 'prayers', 'thoughts', 'newyear'].includes(currentView);
}
function showReaderSearch() {
  topBar.classList.add('search-open');
  readerSearchInput.value = '';
  readerSearchInput.hidden = false;
  readerSearchClose.hidden = false;
  readerSearchButton.setAttribute('aria-expanded','true');
  readerSearchButton.setAttribute('aria-label','검색 실행');
  readerSearchInput.focus();
  if (isPageSearchable(view)) {
    personalSearchFilters.type = pageSearchType(view);
    personalSearchFilters.year = 'all';
    personalSearchSubmitted = false;
    renderPersonalSearch();
  }
}
function closeReaderSearch(restoreFocus = false) {
  bibleSearchScope = 'all';
  personalSearchFilters.type = personalSearchFilters.year = 'all';
  personalSearchSubmitted = false;
  if (modal.open && ['search-scope','search-selected','personal-search-filter'].includes(modal.firstElementChild?.name)) modal.close();
  topBar.classList.remove('search-open');
  readerSearchInput.value = '';
  readerSearchInput.hidden = true;
  readerSearchClose.hidden = true;
  clearReaderSearchResults();
  readerSearchButton.setAttribute('aria-expanded','false');
  const searchName = isPageSearchable(view) ? pageSearchTitle(view) : readerSearchName(view);
  readerSearchButton.setAttribute('aria-label',searchName+' 열기');
  if (restoreFocus) readerSearchButton.focus({preventScroll:true});
}
function clearReaderSearchResults() {
  bibleSearchResults = undefined;
  selectedSearchVerses.clear();
  readerSearchPanel.hidden = true;
  readerSearchPanel.innerHTML = '';
}
function searchResultRow(key,canSelect,excerpts) {
  const title = esc(reference(key));
  const checkbox = canSelect?'<label class="search-result-check"><input type="checkbox" data-search-select="'+key+'" aria-label="'+
    title+' 선택" '+(selectedSearchVerses.has(key)?'checked':'')+'><span class="search-result-box" aria-hidden="true">'+icon('check')+'</span></label>':'';
  return '<div class="search-result-row"><button type="button" class="record-open search-result" data-search-visit="'+key+'">'+
    '<strong>'+title+'</strong><span'+(excerpts?' dir="auto"':'')+'>'+esc(excerpts?.get(key) ?? verseText(key))+'</span></button>'+checkbox+'</div>';
}
function searchToolbar(title,actions) {
  return '<div class="reader-search-toolbar"><div class="search-panel-heading"><span class="search-panel-symbol">'+
    icon('search')+'</span><h3>'+title+'</h3></div><div class="reader-search-actions">'+actions+'</div></div>';
}
function searchTool(action,label,glyph,attributes = '') {
  return '<button type="button" class="search-tool" data-action="'+action+'" aria-haspopup="dialog" '+attributes+
    '><span class="search-tool-pill">'+icon(glyph)+'<span>'+esc(label)+'</span></span></button>';
}
function readerSearchResults(page = 0,pageSize = bibleSearchPageSize) {
  if (!bibleSearchResults) return '';
  const {keys,bookStart,excerpts,reference:isReference} = bibleSearchResults;
  const pages = Math.ceil(keys.length/pageSize);
  page = Math.min(page,Math.max(0,pages-1));
  const visible = keys.slice(page*pageSize,(page+1)*pageSize);
  const pager = pages>1 ? '<nav class="reader-search-pages" aria-label="검색 결과 페이지">'+
    '<button type="button" class="search-page-arrow" aria-label="이전 페이지" data-search-page="'+(page-1)+'" data-search-direction="previous" '+(!page?'disabled':'')+'>'+icon('left')+'</button>'+
    '<span class="search-page-number" aria-label="'+(page+1)+'페이지, 전체 '+pages+'페이지">'+(page+1)+' / '+pages+'</span>'+
    '<button type="button" class="search-page-arrow" aria-label="다음 페이지" data-search-page="'+(page+1)+'" data-search-direction="next" '+(page+1>=pages?'disabled':'')+'>'+icon('right')+'</button></nav>' : '';
  const scopeLabel = searchScopeLabels[bibleSearchScope] ?? titles[bibleSearchScope];
  const scope = isReference?'':searchTool('pick-search-scope',scopeLabel,'filter','aria-label="범위 · '+esc(scopeLabel)+'"');
  const selectedCount = selectedSearchVerses.size;
  const collect = !excerpts && !isReference && (keys.length || selectedCount)?searchTool('view-search-selection',
    selectedCount?'모아 보기 ('+selectedCount+')':'모아 보기','copy',selectedCount?'':'disabled'):'';
  const bookLink = bookStart?'<div class="reader-search-book-start"><button type="button" class="search-book-link" data-search-book-start="'+
    bookStart+'"><span class="search-book-symbol">'+icon('book')+'</span><span>'+esc(titles[readRef(bookStart).book])+' 책 열기</span>'+icon('right')+'</button></div>':'';
  return '<section class="reader-search-group">'+searchToolbar('검색 결과',scope+collect)+bookLink+'<div class="reader-search-list">'+
    (visible.map(key=>searchResultRow(key,!excerpts && !isReference,excerpts)).join('') ||
      '<p class="muted">'+(bookStart?'본문에 일치하는 구절이 없어요.':'검색 결과가 없어요.')+'</p>')+'</div>'+pager+'</section>';
}
function fitReaderSearchPage() {
  const count = bibleSearchResults?.keys.length ?? 0;
  if (count<2) return 1;
  readerSearchPanel.hidden = false;
  readerSearchPanel.innerHTML = readerSearchResults(0,1);
  const heightOf = selector=>readerSearchPanel.querySelector(selector)?.getBoundingClientRect().height ?? 0;
  const rowHeight = heightOf('.search-result-row');
  if (!rowHeight) return 1;
  const maxHeight = parseFloat(getComputedStyle(readerSearchPanel).maxHeight);
  const panelHeight = Number.isFinite(maxHeight) ? maxHeight : Math.min(window.innerHeight*.76,660);
  const available = panelHeight-heightOf('.reader-search-toolbar')-heightOf('.reader-search-book-start')-2;
  if (count*rowHeight+7<=available) return count;
  return Math.max(1,Math.floor((available-heightOf('.reader-search-pages'))/rowHeight));
}
function submitReaderSearch() {
  const query = readerSearchInput.value.trim();
  bibleSearchResults = query?(view==='original'?searchOriginal(query):searchBible(state.reader.edition,query)):undefined;
  bibleSearchPageSize = fitReaderSearchPage();
  updateReaderSearch();
}
function updateReaderSearch(page = 0) {
  if (readerSearchInput.hidden || readerSearchForm.hidden) return;
  bibleSearchPage = page;
  const results = readerSearchResults(page);
  readerSearchPanel.innerHTML = results;
  readerSearchPanel.hidden = !results;
}
function changeSearchPage(button) {
  const page = Number(button.dataset.searchPage);
  if (!Number.isInteger(page) || page<0) return;
  updateReaderSearch(page);
  const direction = button.dataset.searchDirection;
  (readerSearchPanel.querySelector('[data-search-direction="'+direction+'"]:not(:disabled)') ??
    readerSearchPanel.querySelector('[data-search-page]:not(:disabled)'))?.focus({preventScroll:true});
}
function showSearchScopePicker() {
  const source = data[state.reader.edition];
  const attribute = 'data-search-scope';
  dialog('검색 범위','<div class="search-scope-presets">'+
    pickerOptions(Object.entries(searchScopeLabels),bibleSearchScope,attribute)+'</div>'+
    bookPickerSections(books.filter(([book])=>view==='original'?studyBookChapters('original',book):source?.[book]),bibleSearchScope,attribute),'search-scope');
}
function chooseSearchScope(scope) {
  bibleSearchScope = scope;
  modal.close();
  submitReaderSearch();
  readerSearchPanel.querySelector('[data-action="pick-search-scope"]')?.focus({preventScroll:true});
}
function showSelectedSearchVerses() {
  if (!selectedSearchVerses.size) return;
  showVerseBundle(selectedVerseSnapshots());
}
function selectedVerseSnapshots() {
  return [...selectedSearchVerses].filter(ref=>verseText(ref)).map(ref=>
    ({ref,body:verseText(ref),label:editionLabel(readRef(ref).edition)}));
}
function showVerseBundle(verses,id) {
  const passages = verses.map(({ref,body,label})=>
    '<section class="search-selected-verse"><div class="row"><h3>'+esc(reference(ref))+' · '+esc(label)+'</h3>'+
    (verseText(ref)?'<button type="button" class="text-action" data-search-visit="'+ref+'">본문 보기</button>':'')+'</div>'+
    '<p>'+esc(body)+'</p></section>').join('');
  const saveButton = id?'':'<button type="button" class="btn primary" data-action="save-verse-bundle">기록함에 저장</button>';
  dialog('선택한 구절 '+verses.length+'개','<div class="bundle-actions">'+saveButton+
    '<button type="button" class="btn" data-copy-bundle="'+(id ?? 'selection')+'">복사</button></div>'+
    '<p class="muted" role="status" data-bundle-status></p>'+passages,id?'saved-verse-bundle':'search-selected');
}
async function saveVerseBundle(button) {
  const verses = selectedVerseSnapshots();
  if (!verses.length) return;
  const bundle = {id:newId(),day:dateKey(),verses};
  const status = modal.querySelector('[data-bundle-status]');
  button.disabled = true;
  state.verseBundles.unshift(bundle);
  if (await save()) {
    status.textContent = '기록함의 구절 모음에 저장했어요.';
  } else {
    state.verseBundles = state.verseBundles.filter(item=>item.id!==bundle.id);
    status.textContent = '저장하지 못했어요. 다시 시도해 주세요.';
    button.disabled = false;
  }
}
async function copyVerseBundle(id) {
  const verses = id==='selection'?selectedVerseSnapshots():state.verseBundles.find(bundle=>bundle.id===id)?.verses;
  if (!verses?.length) return;
  const text = verses.map(({ref,body,label})=>reference(ref)+' · '+label+'\n'+body).join('\n\n');
  const status = modal.querySelector('[data-bundle-status]');
  try {
    await navigator.clipboard.writeText(text);
    status.textContent = '구절 모음을 복사했어요.';
  } catch {
    if (!status.isConnected) return;
    status.textContent = '자동 복사가 되지 않았어요. 아래 본문을 선택해서 복사해 주세요.';
    if (!modal.querySelector('[data-bundle-copy-text]')) {
      status.insertAdjacentHTML('afterend',editorField('복사할 구절','verses',text,'textarea','readonly rows="6" data-bundle-copy-text'));
    }
    const field = modal.querySelector('[data-bundle-copy-text]');
    field.focus();
    field.select();
  }
}
function visitSearchResult(key) {
  if (modal.open && modal.firstElementChild?.name==='saved-verse-bundle') modal.close();
  closeReaderSearch();
  if (view==='original' && key.startsWith('original/')) {
    const {book,chapter,verse} = readRef(key);
    studySelection.original.location = {book,chapter,verse};
    render();
    showVerseArrival('study-v-'+verse);
    return;
  }
  visit(key);
}
function showChapterJump() {
  const {book,source,selection} = bookPickerContext();
  const chapter = selection?.location?.chapter ?? state.reader.chapter;
  const chapters = Object.keys(source?.[book] ?? {});
  if (!chapters.length) return notify('이 책에 등록된 자료가 없어요.');
  dialog(esc(titles[book])+' · 장·절 이동','<label class="field">이동할 장·절'+
    '<input name="chapter" type="text" enterkeyhint="go" maxlength="20" placeholder="예: 12, 12 3, 12:3" autofocus></label>'+
    '<p class="muted">장 번호만 입력하면 1절로 이동해요. 현재 '+chapter+'장 · '+chapters[0]+'~'+chapters.at(-1)+'장</p>'+
    '<p class="muted" data-chapter-error role="status"></p><button type="submit" class="btn primary">이동</button>','chapter-jump');
}
function jumpToChapter(form) {
  const input = form.elements.chapter;
  const {chapter,verse:requestedVerse} = parseChapterVerse(input.value.normalize('NFKC').trim()) ?? {};
  const {edition,book,source,selection} = bookPickerContext();
  const verses = selection?studyChapterVerses(view,book,chapter):source?.[book]?.[chapter] ?? {};
  const available = Object.keys(verses).filter(number=>verses[number] &&
    (!selection || (Number(number)>0 && Number(number)<=500)));
  const verse = Number(requestedVerse ?? (available.includes('1')?'1':available[0]));
  if (!available.includes(String(verse))) {
    form.querySelector('[data-chapter-error]').textContent = '이 자료에서 열 수 있는 장·절 번호를 입력해 주세요.';
    input.focus();
    return;
  }
  modal.close();
  studySelection.commentary.location = {book,chapter,verse};
  studySelection.original.location = {book,chapter,verse};
  if (selection) {
    selection.location = {book,chapter,verse};
    state.reader.book = book;
    state.reader.chapter = chapter;
    return render();
  }
  visit([edition,book,chapter,verse].join('/'));
}
function originalCodes(text) {
  return esc(text).replace(/&lt;(W?[HG]\s*\d+[A-Za-z]?)\s*&gt;/gi,(_,code)=>strongCodeButton(code));
}
function strongCodeButton(code,current) {
  const label = code.replace(/^W|\s/gi,'').replace(/^([HG])0+(?=\d)/i,'$1').toUpperCase();
  return label===current?esc(code):'<button type="button" class="original-code" data-strong-code="'+label+
    '" aria-label="'+label+' 뜻 보기">'+label+'</button>';
}
function dictionaryCodes(text,current) {
  return esc(text).replace(/&lt;(W?[HG]\s*\d{1,5}[A-Za-z]?)\s*&gt;|\b(W?[HG]\s*\d{1,5}[A-Za-z]?)\b/gi,
    (_,bracketed,bare)=>strongCodeButton(bracketed ?? bare,current));
}
function originalVerseLines(body) {
  return body.split(/\r?\n/).filter(line=>line.trim()).map(line=>{
    const word = line.trim().match(/^\[([^\]]+)\]\s*(.*?)\s*@([^#]*)(?:#(.*))?$/);
    if (!word) return {line};
    const [,form,lemma,grammar,meaning] = word;
    const gloss = meaning?.replace(/\*\s*$/,'').trim() || '';
    return {form,lemma,grammar:grammar.trim(),gloss:gloss==='_'?'':gloss};
  });
}
function originalPassageSource(book,chapter) {
  const hebrew = testamentByBook[book]==='old';
  const label = hebrew?'BHSStp':'LXXStp';
  const candidates = Object.keys(editions).filter(id=>editionName(editions[id]).toLowerCase().includes(label.toLowerCase()));
  const edition = candidates.find(id=>data[id]?.[book]?.[chapter]) ?? candidates.find(id=>data[id]?.[book]);
  return {label,language:hebrew?'he':'grc',direction:hebrew?'rtl':'ltr',chapters:data[edition]?.[book]};
}
function originalVerseReading(body,verse,source,chapter) {
  const words = originalVerseLines(body);
  const imported = source.chapters?.[chapter]?.[verse]?.replace(/<W?[HG]\s*\d+[A-Za-z]?\s*>/gi,'').trim();
  const text = Number(verse)<=500?
    imported || words.filter(word=>word.form).map(word=>word.form).join(' ').replace(/־\s+/g,'־'):'';
  const original = text?
    '<h4 class="original-caption">'+(imported?source.label+' 원문':'원전분해 원문 표기')+'</h4>'+
    '<p class="original-verse-text" lang="'+source.language+'" dir="'+source.direction+'">'+esc(text)+'</p>':'';
  const breakdown = words.map(({line,form,lemma,grammar,gloss})=>{
    if (line) return '<p>'+originalCodes(line)+'</p>';
    return '<div class="original-word"><div class="original-word-head">'+
      '<bdi class="original-word-text" lang="'+source.language+'" dir="'+source.direction+'">'+esc(form)+'</bdi>'+
      (gloss?'<span class="original-gloss" lang="ko">'+esc(gloss)+'</span>':'')+'</div>'+
      (grammar?'<div class="muted original-grammar" lang="ko">'+esc(grammar)+'</div>':'')+
      (lemma?'<div class="original-lemma">'+originalCodes(lemma)+'</div>':'')+'</div>';
  }).join('');
  return '<div class="original-body">'+original+(breakdown?'<h4 class="original-caption">단어별 풀이</h4>'+breakdown:'')+'</div>';
}
function showOriginalMeaning(button) {
  const code = button.dataset.strongCode;
  const word = button.closest('.original-word');
  const form = word?.querySelector('bdi')?.textContent;
  const gloss = word?.querySelector('.original-gloss')?.textContent;
  const lemma = word?.querySelector('.original-lemma')?.textContent.trim();
  const grammar = word?.querySelector('.original-grammar')?.textContent;
  const fields = [['이 구절에서의 뜻',gloss],['기본형·읽는 법',lemma],['문법',grammar]];
  const dictionariesByLanguage = Object.values(dictionaries);
  const entry = dictionariesByLanguage.find(item=>/^HebGrkKo$/i.test(item.label) && item.entries[code]) ??
    dictionariesByLanguage.find(item=>item.entries[code]);
  const definition = entry?
    '<section class="dictionary-detail"><h3>원어사전 · '+esc(entry.label)+'</h3><div class="dictionary-copy">'+dictionaryParagraphs(entry.entries[code],code)+'</div></section>':
    '<div class="stack"><p class="muted">'+(dictionariesByLanguage.length?'가져온 원어사전에 이 코드의 상세 항목이 없어요.':'어원과 용례까지 보려면 한국어 원어사전 파일(.dct)을 추가해 주세요.')+'</p>'+
      '<button class="btn" type="button" data-nav="settings" data-import-link>원어사전 파일 가져오기</button></div>';
  const linkedEntry = modal.open && modal.contains(button);
  dialog(esc(code)+' · '+(code.startsWith('H')?'히브리어':'헬라어'),
    '<div class="dictionary-body" tabindex="0" role="region" aria-label="원어사전 내용">'+definition+
    (form?'<div class="original-detail-form"><bdi>'+esc(form)+'</bdi></div>':'')+
    '<dl class="original-detail">'+fields.filter(([,value])=>value).map(([label,value])=>
      '<div><dt>'+label+'</dt><dd>'+esc(value)+'</dd></div>').join('')+'</dl></div>','dictionary');
  if (linkedEntry) modal.querySelector('#active-dialog-title')?.focus({preventScroll:true});
}
function dictionaryParagraphs(text,current) {
  return text.trim().split(/\r?\n[ \t]*(?:\r?\n)+/).map((block,index)=>{
    const lines = block.trim().split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
    if (!lines.length) return '';
    const hasHeadword = index===0 && lines[0].length<=110 && /[\u0370-\u03ff\u0590-\u05ff]/u.test(lines[0]);
    const headword = hasHeadword?'<p class="dictionary-headword"><bdi>'+dictionaryCodes(lines.shift().replace(/\s*\^+\s*/g,' '),current)+'</bdi></p>':'';
    return headword+lines.map(line=>'<p>'+dictionaryCodes(line,current).replace(/^(\([\da-z]{1,3}\))(?=\s)/i,'<strong class="dictionary-sense">$1</strong>')+'</p>').join('');
  }).join('');
}
function mannaCommentary() {
  return Object.values(commentaries).find(item=>editionName(item.label)==='만나주석');
}
const commentarySentenceBreak = /(?<=[다요]\.|\)\.)\s+(?=[가-힣“‘「])/u;
function commentaryParagraphs(body) {
  return body.split(/\r?\n[ \t]*(?:\r?\n)+|[ \t]*(?=[▷▶▸])/)
    .map(block=>block.trim()).filter(Boolean).flatMap(block=>{
      const heading = block.match(/^[▷▶▸]\s*([^:\n]{1,90})[:：]\s*/u);
      const text = heading?block.slice(heading[0].length):block;
      const parts = [];
      let paragraph = '';
      for (const sentence of text.split(commentarySentenceBreak)) {
        if (paragraph && paragraph.length+sentence.length>230) {
          parts.push('<p>'+esc(paragraph)+'</p>');
          paragraph = '';
        }
        paragraph += (paragraph?' ':'')+sentence;
      }
      if (paragraph) parts.push('<p>'+esc(paragraph)+'</p>');
      if (heading) parts.unshift('<h4 class="commentary-subhead">'+esc(heading[1])+'</h4>');
      return parts;
    });
}
function studySource(mode) {
  if (mode==='original') return Object.values(originals).find(item=>editionName(item.label)==='원전분해');
  return commentaries[state.commentaryEdition] ?? mannaCommentary() ?? Object.values(commentaries)[0];
}
function studyBookChapters(mode,book) {
  const analysis = studySource(mode)?.verses[book];
  if (mode!=='original') return analysis;
  const original = originalPassageSource(book).chapters;
  return original?{...original,...analysis}:analysis;
}
function studyChapterVerses(mode,book,chapter) {
  const analysis = studySource(mode)?.verses[book]?.[chapter] ?? {};
  if (mode!=='original') return analysis;
  const original = originalPassageSource(book,chapter).chapters?.[chapter];
  return {...original,...analysis};
}
function studyScreen(mode) {
  const original = mode==='original';
  const source = studySource(mode);
  if (!source && !original) {
    return '<section class="card stack"><p>주석 파일(.cdb)을 가져오면 여기서 볼 수 있어요.</p>'+
      '<button class="btn primary" data-nav="settings" data-import-link>주석 파일 가져오기</button></section>';
  }
  const selection = studySelection[mode];
  const firstBook = books.find(([code])=>studyBookChapters(mode,code))?.[0];
  const loc = selection.location ?? {book: state.reader.book, chapter: state.reader.chapter, verse: 1};
  const book = loc.book ?? state.reader.book ?? firstBook;
  const chapter = loc.chapter ?? state.reader.chapter ?? 1;
  const verse = loc.verse ?? 1;
  const entries = source?.verses[book]?.[chapter] ?? {};
  selection.location = {book,chapter,verse};
  return '<div class="reader-controls commentary-controls'+(original?'':' with-commentary-source')+'">'+
      (original?'':readerPickerField('',source.label,'pick-commentary','주석 선택'))+
      bookPickerField(book,'')+readerPickerField('',chapter+'장'+(verse?' '+verse+'절':''),'jump-chapter','장·절 이동')+'</div>'+
    (original && !source?'<div class="original-source-note"><p>단어별 풀이를 보려면 원전분해.sdb 파일을 추가해 주세요.</p>'+
      '<button type="button" class="text-action" data-nav="settings" data-import-link>원어 파일 가져오기 '+icon('arrow')+'</button></div>':'')+
    '<article class="card commentary-page">'+studyPassage(mode,book,chapter,entries)+'</article>';
}
function studyPassage(mode,book,chapter,entries) {
  const original = mode==='original';
  const source = original?originalPassageSource(book,chapter):undefined;
  const verseNumbers = [...new Set([entries,source?.chapters?.[chapter]].flatMap(chapterVerses=>
    Object.entries(chapterVerses ?? {}).filter(([verse,text])=>Number(verse)>0 && text).map(([verse])=>verse)))].sort((a,b)=>a-b);
  return ''+
    (verseNumbers.map(verse=>'<section class="commentary-verse"'+
      (Number(verse)<=500?' data-reading-verse="'+verse+'"':'')+'><div class="row study-verse-heading"><h3 id="study-v-'+verse+'" tabindex="-1">'+
      (Number(verse)>500?'참고 항목 '+verse:verse+'절')+'</h3>'+
      (Number(verse)<=500?'<button type="button" class="text-action" data-study-return="'+verse+'" aria-label="'+verse+'절 성경 본문 보기">본문 보기 '+icon('arrow')+'</button>':'')+'</div>'+
      (original?'<div class="original-body">'+originalVerseReading(entries[verse] ?? '',verse,source,chapter)+'</div>':
        '<div class="commentary-copy">'+commentaryParagraphs(entries[verse]).join('')+'</div>')+
      '</section>').join('') || '<p class="empty">이 장에 등록된 자료가 없어요.</p>');
}
function chapterNumbers(book) {
  return Array.from({length:chapterCounts[book] ?? 0},(_,index)=>index+1);
}
function validChapter(key) {
  if (typeof key!=='string') return false;
  const [book,chapter] = key.split('/');
  return Object.hasOwn(titles,book) && /^\d+$/.test(chapter) &&
    book+'/'+Number(chapter)===key && Number(chapter)>=1 && Number(chapter)<=chapterCounts[book];
}
function journalChapters(entry) {
  return new Set([...(entry?.done ? entry.verses.map(ref=>{
    const {book,chapter} = readRef(ref);
    return book+'/'+chapter;
  }) : []),...(entry?.notes ?? []).flatMap(note=>[...journalChapters(note)])]);
}
function checkedChaptersOn(day) {
  return new Set([...(state.chapterLog[day] ?? []),...journalChapters(state.journal[day])]);
}
function openChapter(key) {
  if (!validChapter(key)) return;
  const [book,chapter] = key.split('/');
  if (state.reader.edition && !data[state.reader.edition]?.[book]?.[chapter]) {
    const edition = Object.keys(editions).find(id=>data[id]?.[book]?.[chapter]);
    if (!edition) return notify('가져온 역본에서 이 장을 찾을 수 없어요.');
    state.reader.edition = edition;
    state.comparison = state.comparison.filter(id=>id!==edition);
  }
  state.reader = {...state.reader,book,chapter:Number(chapter)};
  chosen.clear();
  save();
  navigate('bible');
  window.scrollTo(0,0);
}
function chapterCheckControl(book,chapter) {
  const key = book+'/'+chapter, today = dateKey();
  const manual = Boolean(state.chapterLog[today]?.includes(key));
  const fromJournal = journalChapters(state.journal[today]).has(key);
  const count = readingProgress([key]).counts.get(key) ?? 0;
  const label = fromJournal?'오늘 QT 체크됨':manual?'오늘 체크 해제':'이 장 묵상 체크';
  const action = '<button class="btn '+(manual || fromJournal?'':'primary')+'" data-check-chapter="'+key+'" aria-pressed="'+Boolean(manual || fromJournal)+'" '+
    (chapterCheckBusy || fromJournal?'disabled':'')+'>'+icon('check')+label+'</button>';
  const countLabel = '<span class="chapter-count" aria-live="polite">누적 '+count+'회</span>';
  return '<section class="card chapter-check row" data-chapter-control><div><div class="eyebrow">장별 묵상</div><h3>'+
    titles[book]+' '+chapter+'장</h3>'+countLabel+'</div>'+action+'</section>';
}
async function toggleChapter(key) {
  if (!validChapter(key) || chapterCheckBusy) return;
  const day = dateKey();
  if (journalChapters(state.journal[day]).has(key)) return;
  const previous = state.chapterLog[day];
  const checked = Boolean(previous?.includes(key));
  const next = checked ? previous.filter(value=>value!==key) : [...(previous ?? []),key];
  if (next.length) state.chapterLog[day] = next;
  else delete state.chapterLog[day];
  chapterCheckBusy = true;
  main.querySelectorAll('[data-check-chapter]').forEach(control=>control.disabled=true);
  const stored = await save();
  chapterCheckBusy = false;
  if (!stored) {
    if (previous) state.chapterLog[day] = previous;
    else delete state.chapterLog[day];
  }
  if (view==='bible') {
    const {book,chapter} = state.reader;
    const control = main.querySelector('[data-chapter-control]');
    if (control) control.outerHTML = chapterCheckControl(book,chapter);
  }
  if(view==='today'||view==='today-reading')render();
  if (stored) notify(checked?'오늘의 장 체크를 해제했어요.':'오늘 묵상한 장으로 체크했어요.');
}
function canonChapters() {
  return books.flatMap(([code])=>chapterNumbers(code).map(chapter=>code+'/'+chapter));
}
function planChapters(canon,range) {
  if (!range) return canon;
  const start = canon.indexOf(range.start), end = canon.indexOf(range.end);
  return start>=0 && end>=start ? canon.slice(start,end+1) : [];
}
function chapterLabel(key) {
  const [book,chapter] = key.split('/');
  return titles[book]+' '+chapter+'장';
}
function readingProgress(canon,year = '') {
  const daily = new Map(Object.entries(state.chapterLog).filter(([day])=>!year || day.startsWith(year+'-'))
    .map(([day,chapters])=>[day,new Set(chapters)]));
  for (const [day,entry,noteId] of allJournalEntries()) {
    if ((year && !day.startsWith(year+'-')) || !entry.done || !entry.verses.length) continue;
    if (!daily.has(day)) daily.set(day,new Set());
    for (const chapter of journalChapters(entry)) daily.get(day).add(chapter);
  }
  const counts = new Map();
  for (const checked of daily.values()) {
    for (const key of checked) counts.set(key,(counts.get(key) ?? 0)+1);
  }
  const rounds = canon.length ? Math.min(...canon.map(key=>counts.get(key) ?? 0)) : 0;
  const remaining = canon.filter(key=>(counts.get(key) ?? 0)<=rounds);
  return {counts,rounds,remaining,today:daily.get(dateKey()) ?? new Set()};
}
function readingScreen() {
  const isBookChecks = location.hash === '#book-checks';
  const tabs = '<nav class="settings-tabs reading-tabs" role="group" aria-label="체크 분류">'+
    '<button type="button" data-action="set-reading-tab" data-tab="reading" aria-pressed="'+(!isBookChecks)+'">묵상 일독 체크</button>'+
    '<button type="button" data-action="set-reading-tab" data-tab="book-checks" aria-pressed="'+(isBookChecks)+'">성경책별 체크</button>'+
    '</nav>';

  if (isBookChecks) {
    const year = selectedTrackerYear();
    const yearLabel = year?year+'년':'전체 연도';
    const {counts} = readingProgress([],year);
    const bookLabel = trackerBook?titles[trackerBook]:'책 바로 선택';
    return heading('READING','통독 체크','일독 계획과 성경책별 묵상 기록을 관리해요.')+
      tabs +
      '<div class="reading-book-filters">'+readerPickerField('연도',yearLabel,'pick-tracker-year','연도 선택')+
      readerPickerField('성경책',bookLabel,'pick-tracker-book','성경책 선택')+'</div>'+
      (trackerBook?bookChecksDetail(trackerBook,yearLabel,counts):bookChecksOverview(yearLabel,counts));
  }

  const canon = canonChapters();
  const {counts,rounds,remaining,today} = readingProgress(canon);
  const progress = canon.length-remaining.length;
  const percent = canon.length ? (progress/canon.length*100).toFixed(1) : '0.0';
  return heading('READING','통독 체크','일독 계획과 성경책별 묵상 기록을 관리해요.')+
    tabs +
    '<section class="card reading-progress"><div class="row"><h2>누적 일독 · '+String(rounds+1)+'회차</h2><span class="reading-badge">일독 완료 '+rounds+'회</span></div>'+
    '<div class="row reading-count"><strong>'+progress+' <small>/ '+canon.length+'장</small></strong><span>'+percent+'%</span></div>'+
    '<progress max="'+Math.max(1,canon.length)+'" value="'+progress+'" aria-label="현재 일독 진행률"></progress>'+
    '<p class="muted">같은 장은 하루에 한 번 집계해요. 묵상에 담아둔 구절도 QT를 완료하면 해당 장에 반영돼요.</p></section>'+
    readingPlan(canon,counts,remaining,today);
}
function trackerYears() {
  return [...new Set([dateKey(),...Object.keys(state.chapterLog),
    ...Object.keys(state.journal).filter(day=>journalChapters(state.journal[day]).size)].map(day=>day.slice(0,4)))].sort().reverse();
}
function selectedTrackerYear() {
  if (trackerYear==='' || trackerYears().includes(trackerYear)) return trackerYear;
  return dateKey().slice(0,4);
}
function bookChecksScreen() {
  return readingScreen();
}
function bookChecksProgress(label,yearLabel,visited,total) {
  const percent = total ? (visited/total*100).toFixed(1) : '0.0';
  return '<section class="card reading-book-progress"><div class="row">'+
    '<div><span class="eyebrow">'+yearLabel+'</span><h2 id="book-checks-heading" tabindex="-1">'+label+'</h2></div>'+
    '<span class="reading-book-count"><strong>'+visited+'</strong> / '+total+'장 ('+percent+'%)</span></div>'+
    '<progress max="'+total+'" value="'+visited+'" aria-label="'+yearLabel+' '+label+' 묵상 진행률"></progress></section>';
}
function bookChecksOverview(yearLabel,counts) {
  const tabs = '<div class="settings-tabs book-checks-scopes" role="group" aria-label="성경 범위">'+
    Object.entries(trackerScopes).map(([key,label])=>'<button type="button" data-tracker-scope="'+key+
      '" aria-pressed="'+(key===trackerScope)+'">'+label+'</button>').join('')+'</div>';
  const groups = trackerScope==='all'?['old','new']:[trackerScope];
  let visited = 0, total = 0;
  const list = groups.map(scope=>{
    const rows = books.filter(([book])=>testamentByBook[book]===scope).map(([book,title])=>{
      const chapterTotal = chapterCounts[book];
      const checked = chapterNumbers(book).filter(chapter=>counts.has(book+'/'+chapter)).length;
      visited += checked;
      total += chapterTotal;
      const percent = Math.round((checked / chapterTotal) * 100);
      const isDone = checked === chapterTotal && chapterTotal > 0;
      return '<button type="button" class="book-check-tile '+(isDone?'done':'')+'" data-book-check-detail="'+book+'">'+
        '<div class="book-check-tile-main">'+
          '<strong>'+title+'</strong>'+
          '<span class="book-check-tile-count">'+checked+'/'+chapterTotal+'</span>'+
        '</div>'+
        '<div class="book-check-mini-bar"><div class="book-check-mini-fill" style="width:'+percent+'%"></div></div>'+
        '</button>';
    });
    return '<section class="card book-check-group"><header class="row book-check-group-header"><h3>'+trackerScopes[scope]+' <small>'+rows.length+'권</small></h3><span class="muted">'+visited+' / '+total+'장</span></header>'+
      '<div class="book-check-grid">'+rows.join('')+'</div></section>';
  }).join('');
  return tabs+bookChecksProgress(trackerScopes[trackerScope],yearLabel,visited,total)+list;
}
function bookChecksDetail(book,yearLabel,counts) {
  const chapters = chapterNumbers(book);
  const visited = chapters.filter(chapter=>counts.has(book+'/'+chapter)).length;
  const chapterButtons = chapters.map(chapter=>{
    const key = book+'/'+chapter, count = counts.get(key) ?? 0;
    return '<button type="button" class="chapter-tile" data-open-chapter="'+key+'" data-checked="'+Boolean(count)+'" aria-label="'+
      titles[book]+' '+chapter+'장, '+(count?count+'회 묵상':'묵상 체크 없음')+'">'+
      '<strong>'+chapter+'장</strong><span>'+(count?'✓ '+count+'회':'—')+'</span></button>';
  }).join('');
  return '<button type="button" class="text-action book-checks-back" data-action="tracker-overview">'+icon('left')+
    '책 목록으로 돌아가기</button>'+
    bookChecksProgress(titles[book],yearLabel,visited,chapters.length)+
    '<section class="card reading-chapters book-checks">'+
    (!visited?'<p class="muted" style="margin-bottom:12px;">이 기간에 아직 체크한 장이 없어요. 장을 누르면 해당 본문으로 바로 이동해요.</p>':'<p class="muted" style="margin-bottom:12px;">장을 누르면 성경 본문으로 이동해요. 완독한 장은 체크 표시돼요.</p>')+
    '<div class="chapter-grid">'+chapterButtons+'</div></section>';
}
function readingPlan(canon,counts,remaining,today) {
  const planned = planChapters(canon,state.readingRange);
  const scope = planned.length ? planned : canon;
  const range = state.readingRange;
  const queue = range ? scope.filter(key=>!counts.has(key)) : remaining;
  const checkedToday = scope.filter(key=>today.has(key)).length;
  const goal = state.readingGoal, slots = Math.max(0,goal-checkedToday);
  const suggestions = queue.slice(0,slots).map(key=>
    '<button class="reading-suggestion" data-open-chapter="'+key+'">'+chapterLabel(key)+' '+icon('arrow')+'</button>').join('');
  const label = range ? chapterLabel(range.start)+(range.start===range.end?'':' ~ '+chapterLabel(range.end)) : '성경 전체 (1,189장)';
  const progress = scope.length-queue.length;
  const percent = scope.length ? (progress/scope.length*100).toFixed(1) : '0.0';

  let periodMeta = '';
  if (range?.targetDate) {
    const todayStr = dateKey();
    let dDayText = '';
    const diffMs = new Date(range.targetDate).getTime() - new Date(todayStr).getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays > 0) dDayText = 'D-' + diffDays;
    else if (diffDays === 0) dDayText = 'D-Day';
    else dDayText = 'D+' + Math.abs(diffDays) + ' (종료)';
    const dateRangeStr = (range.startDate ? range.startDate.replace(/-/g,'.') : '시작') + ' ~ ' + range.targetDate.replace(/-/g,'.');
    periodMeta = '<div class="plan-period-badge"><span>'+icon('calendar')+' '+dateRangeStr+'</span><strong>'+dDayText+'</strong></div>';
  } else {
    const remaining = queue.length;
    const estDays = goal > 0 ? Math.ceil(remaining / goal) : 0;
    const estDate = new Date(Date.now() + estDays * 24 * 60 * 60 * 1000);
    const estDateStr = estDate.getFullYear() + '.' + String(estDate.getMonth() + 1).padStart(2, '0') + '.' + String(estDate.getDate()).padStart(2, '0');
    const startStr = range?.startDate ? range.startDate.replace(/-/g,'.') + ' 시작' : '기간 제한 없음';
    periodMeta = '<div class="plan-period-badge"><span>'+icon('calendar')+' '+startStr+' · 매일 '+goal+'장 페이스</span><strong>남은 '+remaining+'장 · 약 '+estDays+'일 소요 ('+estDateStr+' 완독 예상)</strong></div>';
  }

  const historyList = (state.readingHistory || []).map((h, idx) => {
    const dates = (h.startDate ? h.startDate.replace(/-/g,'.') : '') + (h.endDate ? ' ~ ' + h.endDate.replace(/-/g,'.') : '');
    return '<article class="card row reading-history-item">'+
      '<div><strong>'+esc(h.title || (idx + 1) + '회차 완독')+'</strong>'+
      '<p class="muted">'+esc(h.rangeLabel)+' · '+(h.chaptersCount || 0)+'장 완독'+(dates ? '<br>' + dates : '')+'</p></div>'+
      '<span class="reading-badge done">완료</span>'+
      '</article>';
  }).join('');

  return '<section class="card reading-plan"><div class="row"><h2>나의 통독 계획</h2><span class="reading-badge">오늘 '+checkedToday+'장 체크</span></div>'+
    '<div class="plan-scope row"><div><strong>'+label+'</strong><p class="muted">진행 '+progress+' / '+scope.length+'장 ('+percent+'%)</p></div><button class="btn" data-action="edit-reading-range">계획·기간 설정</button></div>'+
    periodMeta +
    '<div class="plan-progress-bar"><progress max="'+Math.max(1,scope.length)+'" value="'+progress+'" aria-label="통독 진행률"></progress></div>'+
    '<label class="field reading-goal"><span class="row">하루 분량 <output id="reading-goal-value">'+goal+'장</output></span>'+
    '<input type="range" id="reading-goal" min="1" max="30" step="1" value="'+goal+'" aria-label="하루 분량" aria-valuetext="'+goal+'장"><span class="row muted"><span>1장</span><span>30장</span></span></label>'+
    (progress >= scope.length ?
      '<div class="plan-finish-banner"><p>🎉 계획하신 성경 통독을 모두 마쳤어요!</p><button type="button" class="btn primary" data-action="archive-reading-plan">통독 완료 기록 보관 & 새 계획</button></div>' :
      '<div class="row" style="margin-top:10px;"><button type="button" class="text-action" data-action="archive-reading-plan" style="font-size:0.8rem; color:var(--muted);">현재 계획 완료 처리 및 기록 보관</button></div>')+
    (suggestions?'<div class="reading-suggestions"><p class="muted">범위에서 이어 읽을 장</p>'+suggestions+'</div>':
      '<p class="muted">'+(slots?'성경 본문을 불러오면 추천 장을 볼 수 있어요.':'오늘 목표를 채웠어요.')+'</p>')+'</section>'+
    (historyList ?
      '<div class="section-head"><h2>지난 통독 기록</h2></div>'+
      '<div class="reading-history-group">'+historyList+'</div>' : '');
}
function rangeFields(side,key) {
  const [book,chapter] = key.split('/');
  const chapterOptions = chapterNumbers(book).map(value=>[value,value+'장']);
  return '<div class="range-fields"><label class="field">'+side+' 책<select data-range-book="'+side+'">'+options(books,book)+'</select></label>'+
    '<label class="field">'+side+' 장<select data-range-chapter="'+side+'">'+options(chapterOptions,chapter)+'</select></label></div>';
}
function showReadingRange() {
  const canon = canonChapters();
  if (!canon.length) return notify('성경 본문을 먼저 불러와 주세요.');
  const range = state.readingRange ?? {start:canon[0],end:canon.at(-1)};
  const startDate = state.readingRange?.startDate ?? dateKey();
  const targetDate = state.readingRange?.targetDate ?? '';
  const hasTarget = Boolean(targetDate);
  dialog('통독 계획 및 기간 설정','<p class="muted">통독할 성경 범위와 계획 방식을 설정할 수 있어요.</p>'+
    rangeFields('시작',range.start)+rangeFields('끝',range.end)+
    '<div class="plan-mode-tabs" role="tablist">'+
      '<button type="button" class="plan-mode-tab '+(hasTarget?'':'active')+'" data-action="plan-mode-daily">매일 꾸준히 (자유)</button>'+
      '<button type="button" class="plan-mode-tab '+(hasTarget?'active':'')+'" data-action="plan-mode-target">목표 기간 정하기</button>'+
    '</div>'+
    '<div id="plan-mode-daily-panel" '+(hasTarget?'hidden':'')+'>'+
      '<label class="field"><span>통독 시작일</span><input type="date" id="range-start-date" value="'+esc(startDate)+'"></label>'+
      '<p class="muted" style="margin-top:6px; font-size:0.8rem;">마감 날짜 없이 매일 읽는 하루 분량에 맞춰 예상 완독일이 계산돼요.</p>'+
    '</div>'+
    '<div id="plan-mode-target-panel" '+(hasTarget?'':'hidden')+'>'+
      '<div class="range-date-fields">'+
        '<label class="field"><span>시작일</span><input type="date" id="range-start-date-target" value="'+esc(startDate)+'"></label>'+
        '<label class="field"><span>목표 완료일</span><input type="date" id="range-target-date" value="'+esc(targetDate)+'"></label>'+
      '</div>'+
      '<p class="muted" style="margin-top:6px; font-size:0.8rem;">목표일까지 남은 D-Day와 일정에 맞춰 진행률이 표시돼요.</p>'+
    '</div>'+
    '<p class="range-error" role="status"></p>'+
    '<div class="row" style="margin-top:16px;"><button type="button" class="btn" data-action="reset-reading-range">성경 전체로</button><button type="button" class="btn primary" data-action="save-reading-range">계획 저장</button></div>');
}
function saveReadingRange() {
  const [start,end] = ['시작','끝'].map(side=>modal.querySelector('[data-range-book="'+side+'"]').value+'/'+modal.querySelector('[data-range-chapter="'+side+'"]').value);
  const isTargetMode = modal.querySelector('.plan-mode-tab[data-action="plan-mode-target"]')?.classList.contains('active');
  const startDate = (isTargetMode ? modal.querySelector('#range-start-date-target')?.value : modal.querySelector('#range-start-date')?.value) || dateKey();
  const targetDate = isTargetMode ? (modal.querySelector('#range-target-date')?.value || '') : '';
  const range = {start,end,startDate,targetDate};
  if (!planChapters(canonChapters(),range).length) {
    modal.querySelector('.range-error').textContent = '끝 장은 시작 장과 같거나 뒤에 있어야 해요.';
    return;
  }
  setReadingRange(range);
}
function setReadingRange(range) {
  state.readingRange = range;
  modal.close();
  save();
  render();
}
modal.addEventListener('change',event=>{
  updateEditorDate(event.target);
  const field = event.target;
  if (field.name==='compare-edition') {
    pendingComparison = pendingComparison.filter(id=>id!==field.value);
    if (field.checked) pendingComparison.push(field.value);
    for (const choice of modal.querySelectorAll('.compare-choice')) {
      const rank = pendingComparison.indexOf(choice.querySelector('input').value)+1;
      choice.querySelector('.compare-order').textContent = rank || '';
    }
    return;
  }
  const side = field.dataset.rangeBook;
  if (!side) return;
  const chapters = chapterNumbers(field.value);
  modal.querySelector('[data-range-chapter="'+side+'"]').innerHTML =
    options(chapters.map(value=>[value,value+'장']),side==='시작'?chapters[0]:chapters.at(-1));
  modal.querySelector('.range-error').textContent = '';
});
function verseActions() {
  if (!chosen.size) return '';
  const markers = indexVerseMarkers();
  const selected = [...chosen].map(key=>verseMark(markers.get(verseAddress(key))?.mark));
  const quickColors = state.quickMarkers || ['#e6bc43','#7cb668','#dc7d9c'];
  const dots = quickColors.map((color, idx) => {
    const isThisColor = selected.length && selected.every(m => m && m.color?.toLowerCase() === color.toLowerCase());
    return '<button type="button" class="marker-dot-btn '+(isThisColor?'active':'')+'" data-action="apply-dot-marker" data-preset="'+idx+
      '" style="background:'+color+';" aria-label="'+(idx+1)+'번 형광펜 바로 칠하기" title="'+(idx+1)+'번 형광펜"></button>';
  }).join('');

  return '<div class="selection verse-actions" aria-label="선택한 구절 메뉴"><div class="verse-actions-top">'+
    '<span class="compact">'+chosen.size+'절 선택</span><button class="icon-action" data-action="clear" aria-label="선택 해제">'+icon('close')+'</button></div>'+
    '<div class="verse-actions-row verse-actions-main">'+
    '<div class="quick-marker-palette" role="group" aria-label="퀵 형광펜">'+
      dots+
      '<button type="button" class="marker-dot-more" data-action="highlight" aria-haspopup="dialog" aria-label="형광펜 상세 설정">'+icon('down')+'</button>'+
    '</div>'+
    '<button class="btn" data-action="note">메모</button>'+
    '<button type="button" class="btn icon-action" data-action="copy-verses" aria-label="구절 복사" title="구절 복사">'+icon('copy')+'</button>'+
    '<button class="btn primary" data-action="attach">묵상에 담기</button></div>'+
    '<div class="verse-actions-row study-shortcuts"><button type="button" class="btn" data-nav="commentary">주석 보기</button>'+
    '<button type="button" class="btn" data-nav="original">원전분해 보기</button>'+
    '<button type="button" class="btn" data-action="add-selected-year">새해 말씀에 담기</button></div></div>';
}
function calendarScreen() {
  const [year,num] = month.split('-').map(Number), today = dateKey();
  const start = new Date(year,num-1,1), end = new Date(year,num,0).getDate();
  const monthPrefix = month+'-';
  const prayersByDay = new Map(), marksByDay = new Map(), undated = [];
  for (const prayer of state.prayers) {
    if (!prayer.day) { undated.push(prayer); continue; }
    if (!prayer.day.startsWith(monthPrefix)) continue;
    if (!prayersByDay.has(prayer.day)) prayersByDay.set(prayer.day,[]);
    prayersByDay.get(prayer.day).push(prayer);
  }
  for (const record of recordRows()) {
    if (!record.day?.startsWith(monthPrefix)) continue;
    if (!marksByDay.has(record.day)) marksByDay.set(record.day,[]);
    marksByDay.get(record.day).push(record);
  }
  let days = '<span class="dow">일</span><span class="dow">월</span><span class="dow">화</span><span class="dow">수</span><span class="dow">목</span><span class="dow">금</span><span class="dow">토</span>'+'<span></span>'.repeat(start.getDay());
  let recordedDays = 0;
  for (let day=1; day<=end; day++) {
    const key = monthPrefix+String(day).padStart(2,'0'), journal = state.journal[key];
    const hasJournal = journalsOn(key).some(([,entry])=>hasJournalContent(entry));
    const hasDailyNote = Boolean(state.dailyNotes[key]);
    const hasReading = Boolean(state.chapterLog[key]?.length);
    const hasQT = hasJournal || hasDailyNote || hasReading;
    const items = prayersByDay.get(key) ?? [];
    const thoughtCount = items.filter(item=>item.kind==='thought').length;
    const prayerCount = items.length-thoughtCount;
    const hasMarks = marksByDay.has(key);
    const hasOther = Boolean(items.length || hasMarks);
    if (hasQT || hasOther) recordedDays++;
    const label = longDate(key)+(journal?.done?' QT 완료':hasJournal?' 묵상 노트 있음':'')+
      (hasDailyNote?' 말씀 묵상 있음':'')+(hasReading?' 성경 읽기 기록 있음':'')+(prayerCount?' 기도 '+prayerCount+'건':'')+
      (thoughtCount?' 생각 노트 '+thoughtCount+'건':'')+(hasMarks?' 구절 메모 또는 표시 있음':'');
    days += '<button class="day" data-day="'+key+'" aria-pressed="'+(key===selectedDay)+'" '+
      (hasQT?'data-qt-record ':'')+(key===today?'aria-current="date" ':'')+'aria-label="'+label+'"><span>'+day+'</span>'+hebrewDayCell(key)+
      '<span class="calendar-day-marks" aria-hidden="true">'+(hasQT?'<i class="calendar-dot qt-dot"></i>':'')+
      (hasOther?'<i class="calendar-dot other-dot"></i>':'')+'</span></button>';
  }
  return heading('QT CALENDAR','묵상 달력','날짜를 고르고 항목을 눌러 그날의 기록을 펼쳐 보세요.')+
    hebrewOptions()+'<div class="calendar-layout"><section class="card calendar-month"><header class="row calendar-month-header">'+
    '<div><p class="muted">'+year+'년</p><h2>'+num+'월</h2></div><div class="calendar-month-actions">'+
    '<button class="btn" data-month="-1" aria-label="이전 달">'+icon('left')+'</button>'+
    '<button class="btn" data-action="calendar-today">오늘</button>'+
    '<button class="btn" data-month="1" aria-label="다음 달">'+icon('right')+'</button></div></header>'+
    '<div class="calendar'+(hebrewEnabled()?' with-hebrew':'')+'">'+days+'</div><footer class="calendar-legend"><span><i class="calendar-dot qt-dot"></i> 묵상·읽기</span>'+
    '<span><i class="calendar-dot other-dot"></i> 기타 기록</span><span>기록 '+recordedDays+'일</span></footer></section>'+
    '<div>'+hebrewDayDetail(selectedDay)+calendarDaySummary(selectedDay,prayersByDay.get(selectedDay) ?? [],marksByDay.get(selectedDay) ?? [])+
    (undated.length?'<details class="undated-prayers"><summary>날짜 미기록 기도·생각 '+undated.length+'건</summary>'+
      undated.map(prayer=>calendarPrayer(prayer)).join('')+'</details>':'')+'</div></div>';
}
function calendarDetail(symbol,label,meta,content) {
  return '<details class="day-detail" open><summary><span class="day-detail-label"><span class="day-detail-icon">'+icon(symbol)+'</span>'+label+'</span>'+
    (meta?'<span class="day-detail-meta">'+esc(meta)+'</span>':'')+'</summary>'+
    '<div class="day-detail-body">'+content+'</div></details>';
}
function calendarText(value) {
  return value?'<div class="day-detail-copy">'+value.split(/\r?\n[ \t]*(?:\r?\n)+/)
    .map(paragraph=>'<p class="day-detail-text">'+esc(paragraph)+'</p>').join('')+'</div>':'';
}
function calendarItemActions(edit,remove) {
  return '<div class="item-actions card-actions">'+(edit?'<button type="button" class="text-action" '+edit+'>'+icon('edit')+' 수정</button>':'')+
    (remove?'<button type="button" class="text-action destructive" '+remove+'>'+icon('trash')+' 삭제</button>':'')+'</div>';
}
function calendarPrayer(prayer) {
  const thought = prayer.kind==='thought';
  return '<article class="day-detail-item tappable-card">'+cardHit(thought?'생각 기록 열기':'기도 기록 열기','data-nav="prayer/'+prayer.id+'"')+
    (thought?thoughtCopy(prayer):'<strong>'+esc(prayer.title)+'</strong>'+calendarText(prayer.body)+
      (prayer.answer?'<span class="muted">응답 기록</span>'+calendarText(prayer.answer):''))+
    calendarItemActions('data-prayer="'+prayer.id+'"','data-delete-prayer="'+prayer.id+'"')+'</article>';
}
function calendarDaySummary(day,items,records) {
  const thoughts = items.filter(item=>item.kind==='thought');
  const prayers = items.filter(item=>item.kind!=='thought');
  const note = state.dailyNotes[day];
  const notes = records.filter(({mark})=>mark.note);
  const highlights = records.filter(({mark})=>verseMark(mark));
  const chapters = [...checkedChaptersOn(day)];
  const recordDetails = (items,isNote) => items.map(({key,verses,mark,noteKey})=>{
    const passage = recordPassage(key,verses);
    const bodies = passage.length?passage.map(([,body])=>body):[savedVerseText(key)].filter(Boolean);
    const markKind = mark.color || mark.highlight ? '형광펜' : mark.underline ? '밑줄' : '메모';
    const kindClass = mark.color || mark.highlight ? 'highlight' : mark.underline ? 'underline' : 'note';
    const content = isNote ? calendarText(mark.note) :
      '<blockquote class="calendar-quote-body">'+bodies.map(body=>'<p>'+markedText(body,mark)+'</p>').join('')+'</blockquote>';
    return '<article class="calendar-mark-card tappable-card '+kindClass+'">'+
      (verseText(key)?cardHit('본문에서 읽기','data-visit="'+key+'"'):'')+
      '<div class="row calendar-mark-header">'+
      '<span class="reading-badge">'+esc(selectionReference(key,verses))+' · '+esc(editionLabel(readRef(key).edition))+'</span>'+
      '<span class="mark-kind-pill '+kindClass+'">'+markKind+'</span>'+
      '</div>'+
      content+
      '<div class="row calendar-mark-footer">'+
      '<span class="note-link">본문에서 읽기 '+icon('arrow')+'</span>'+
      (isNote?calendarItemActions('data-edit-verse-note="'+noteKey+'"','data-delete-note="'+noteKey+'"'):'<div class="item-actions card-actions">'+highlightDeleteButton(key)+'</div>')+
      '</div></article>';
  }).join('');
  const journals=journalsOn(day).filter(([,entry])=>hasJournalContent(entry));
  const groupedRecords=(rows,isNote)=>{
    const groups=new Map();
    for(const row of rows){const {book,chapter}=readRef(row.key);const key=book+'/'+chapter;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row);}
    return [...groups].map(([key,rows])=>'<details class="calendar-mark-group"><summary><strong>'+esc(chapterLabel(key))+'</strong><span>'+rows.length+'건 '+icon('down')+'</span></summary><div>'+recordDetails(rows,isNote)+'</div></details>').join('');
  };
  const journalCards=journals.map(([,entry,id])=>'<article class="calendar-journal-summary"><button type="button" class="calendar-journal-open" data-nav="'+journalRoute(day,id)+'"><span><strong>'+esc(entry.title||'묵상 노트')+'</strong><small>'+(entry.done?'QT 완료':'작성 중')+'</small><p>'+esc(entry.reflection||'담아둔 말씀과 묵상을 확인하세요.')+'</p></span>'+icon('right')+'</button>'+calendarItemActions('data-nav="'+journalRoute(day,id)+'"','data-delete-journal="'+day+'" data-journal-note="'+id+'"')+'</article>').join('');
  const empty=!note&&!journals.length&&!prayers.length&&!thoughts.length&&!chapters.length&&!notes.length&&!highlights.length;
  return '<section class="calendar-summaries day-summary" data-date="'+day+'" aria-labelledby="day-summary-heading">'+
    '<header class="day-summary-title"><span class="day-detail-icon">'+icon('calendar')+'</span><div><p class="eyebrow">선택한 날짜</p><h2 id="day-summary-heading"><time datetime="'+day+'">'+longDate(day)+'</time></h2></div></header>'+
    '<p class="calendar-summary-hint">기록을 눌러 자세히 확인하세요.</p>'+
    (note?calendarDetail('comment','말씀 묵상','1건','<div class="tappable-card">'+cardHit('말씀 묵상 열기','data-edit-daily-note="'+day+'"')+calendarText(note.body)+calendarItemActions('data-edit-daily-note="'+day+'"','data-delete-daily-note="'+day+'"')+'</div>'):'')+
    (journals.length?calendarDetail('note','묵상 노트',journals.length+'편',journalCards):'')+
    (prayers.length?calendarDetail('prayer','기도',prayers.length+'건',prayers.map(calendarPrayer).join('')):'')+
    (thoughts.length?calendarDetail('note','생각 노트',thoughts.length+'건',thoughts.map(calendarPrayer).join('')):'')+
    (chapters.length?calendarDetail('check','묵상 체크',chapters.length+'장','<div class="calendar-chapter-grid">'+chapters.map(key=>'<button type="button" class="calendar-chapter-pill" data-open-chapter="'+key+'"><span class="chapter-check-mark">✓</span><strong>'+esc(chapterLabel(key))+'</strong>'+icon('right')+'</button>').join('')+'</div>'):'')+
    (notes.length?calendarDetail('edit','구절 메모',notes.length+'건',groupedRecords(notes,true)):'')+
    (highlights.length?calendarDetail('marker','형광펜·밑줄',highlights.length+'건',groupedRecords(highlights,false)):'')+
    (empty?'<p class="calendar-day-empty">이날 남긴 기록이 없어요.</p>':'')+
    (!journals.length?'<button type="button" class="btn calendar-add-journal" data-nav="journal/'+day+'">'+icon('edit')+' 묵상 노트 쓰기</button>':'')+'</section>';

}
const recordFilters = {all:'전체',highlight:'형광펜',note:'메모',journal:'묵상 노트'};
function markKinds(mark) {
  const kinds = [];
  if (mark.color || mark.highlight || mark.underline) kinds.push('highlight');
  if (mark.note) kinds.push('note');
  if (mark.journal) kinds.push('journal');
  return kinds;
}
function recordRows() {
  const groups = new Map(), rows = new Map();
  const add = (key,verses,day,mark,noteKey,journalDay) => {
    const id = [key,verses.join(','),day,mark.journal?'journal/'+journalDay:mark.note?'note':'mark'].join('/');
    const row = rows.get(id) ?? {key,verses,day,mark:{}};
    Object.assign(row.mark,mark);
    if (noteKey) row.noteKey = noteKey;
    if (journalDay) row.journalDay = journalDay;
    rows.set(id,row);
  };
  for (const [key,mark] of Object.entries(state.marks)) {
    if (mark.note) add(key,noteVerseNumbers(key,mark),mark.noteDay,{note:mark.note},key);
    if (!verseMark(mark)) continue;
    const id = [key.slice(0,key.lastIndexOf('/')),mark.group ?? key].join('/');
    if (!groups.has(id)) groups.set(id,[]);
    groups.get(id).push(key);
  }
  for (const keys of groups.values()) {
    keys.sort((a,b)=>verseNumber(a)-verseNumber(b));
    const key = keys[0];
    const {color,highlight,underline,markDay} = state.marks[key];
    add(key,keys.map(verseNumber),markDay,{color,highlight,underline});
  }
  for (const [day, entry, noteId] of allJournalEntries()) {
    if (!hasJournalContent(entry)) continue;
    const validRefs = (entry.verses || []).filter(validRef);

    const chMap = new Map();
    for (const ref of validRefs) {
      const {edition, book, chapter, verse} = readRef(ref);
      const chKey = [edition, book, chapter].join('/');
      if (!chMap.has(chKey)) chMap.set(chKey, []);
      chMap.get(chKey).push(verse);
    }

    const firstRef = validRefs[0] || (state.reader.edition ? state.reader.edition + '/JHN/1/1' : 'krv/JHN/1/1');
    const chSummaries = [...chMap.entries()].map(([chKey, vNums]) => {
      vNums.sort((a,b) => a - b);
      return selectionReference(chKey + '/' + vNums[0], vNums);
    });
    const combinedRefTitle = chSummaries.join(', ');

    add(firstRef, validRefs.map(ref => readRef(ref).verse), day, {
      journal: true,
      journalTitle: entry.title,
      journalReflection: entry.reflection,
      journalDone: entry.done,
      combinedRefTitle,
      allRefs: validRefs
    }, undefined, day+(noteId?'/'+noteId:''));
  }
  return [...rows.values()].reverse().sort((left,right)=>(right.day ?? '').localeCompare(left.day ?? ''));
}
function highlightDeleteButton(key) {
  return '<button type="button" class="text-action destructive" data-delete-highlight="'+key+'">표시 삭제</button>';
}
function highlightRecord(key) {
  return recordRows().find(row=>row.key===key && verseMark(row.mark));
}
function confirmHighlightRemoval(key) {
  const record = highlightRecord(key);
  if (!record) return;
  dialog('말씀 표시 삭제','<p>'+esc(selectionReference(key,record.verses))+'의 형광펜 또는 밑줄을 지울까요?</p>'+
    '<div class="row"><button class="btn" value="cancel">취소</button><button type="button" class="btn danger" data-remove-highlight="'+key+'">삭제 확인</button></div>');
}
function recordPassage(key,verses) {
  const {edition,book,chapter} = readRef(key);
  const passage = data[edition]?.[book]?.[chapter];
  return verses.filter(verse=>passage?.[verse]).map(verse=>[verse,passage[verse]]);
}
function renderRecordCard(item) {
  const {key,verses,day,mark,noteKey,journalDay} = item;

  const kindClass = mark.journal ? 'journal' : mark.note ? 'note' : 'highlight';
  const markKind = mark.journal ? '묵상 노트' : mark.note ? '메모' : '형광펜';

  let content = '';
  let badgeTitle = '';

  if (mark.journal) {
    const hasRefs = Boolean(mark.allRefs?.length);
    if (hasRefs) {
      const firstRef = mark.allRefs[0];
      const {book, chapter} = readRef(firstRef);
      const bTitle = titles[book] || book;
      if (mark.allRefs.length > 2) {
        badgeTitle = `${esc(bTitle)} ${chapter}장 (${mark.allRefs.length}구절) · ${esc(editionLabel(readRef(key).edition))}`;
      } else {
        badgeTitle = esc(mark.combinedRefTitle || selectionReference(key,verses)) + ' · ' + esc(editionLabel(readRef(key).edition));
      }
    } else {
      badgeTitle = mark.journalTitle ? esc(mark.journalTitle) : '나의 묵상';
    }

    let versesHtml = '';
    if (hasRefs) {
      versesHtml = '<blockquote class="calendar-quote-body">' +
        mark.allRefs.map(ref => {
          const {verse} = readRef(ref);
          const body = verseText(ref) || savedVerseText(ref);
          return '<span class="record-verse"><span class="record-verse-number">'+verse+'절</span>'+esc(body)+'</span>';
        }).join('') +
      '</blockquote>';
    }

    let reflectionHtml = '';
    if (mark.journalReflection?.trim()) {
      reflectionHtml = '<div class="record-journal-content">'+
        (mark.journalTitle ? '<h4 class="record-journal-title">'+esc(mark.journalTitle)+'</h4>' : '')+
        '<div class="record-journal-text">'+esc(mark.journalReflection)+'</div>'+
      '</div>';
    } else if (mark.journalTitle) {
      reflectionHtml = '<div class="record-journal-content">'+
        '<h4 class="record-journal-title">'+esc(mark.journalTitle)+'</h4>'+
      '</div>';
    }

    content = versesHtml + reflectionHtml;
  } else if (mark.note) {
    const passage = recordPassage(key,verses);
    const excerpt = passage.length?passage.map(([number,body])=>
      '<span class="record-verse"><span class="record-verse-number">'+number+'절</span>'+markedText(body,mark)+'</span>').join('')
      : markedText(savedVerseText(key),mark);
    badgeTitle = esc(selectionReference(key,verses))+' · '+esc(editionLabel(readRef(key).edition));
    content = '<blockquote class="calendar-quote-body">'+excerpt+'</blockquote>'+
      '<div class="record-note-content">'+
        '<span class="record-note-label">💬 메모</span>'+
        '<p class="record-note-body">'+esc(mark.note)+'</p>'+
      '</div>';
  } else {
    const passage = recordPassage(key,verses);
    const excerpt = passage.length?passage.map(([number,body])=>
      '<span class="record-verse"><span class="record-verse-number">'+number+'절</span>'+markedText(body,mark)+'</span>').join('')
      : markedText(savedVerseText(key),mark);
    badgeTitle = esc(selectionReference(key,verses))+' · '+esc(editionLabel(readRef(key).edition));
    content = '<blockquote class="calendar-quote-body">'+excerpt+'</blockquote>';
  }

  return '<article class="calendar-mark-card tappable-card '+kindClass+'">'+
    (verseText(key)?cardHit('본문에서 읽기','data-visit="'+key+'"'):'')+
    '<div class="row calendar-mark-header">'+
    '<span class="reading-badge">'+badgeTitle+'</span>'+
    '<div class="row calendar-mark-meta" style="gap:5px; align-items:center; flex-shrink:0; white-space:nowrap;">'+
    (day?'<time class="muted" style="font-size:0.75rem;" datetime="'+day+'">'+shortDate(day)+'</time>':'')+
    '<span class="mark-kind-pill '+kindClass+'">'+markKind+'</span>'+
    '</div></div>'+
    content+
    '<div class="row calendar-mark-footer">'+
    (mark.allRefs?.length ? '<span class="note-link">본문에서 읽기 '+icon('arrow')+'</span>' : '<span></span>')+
    '<div class="item-actions card-actions">'+
    (journalDay ? '<button type="button" class="text-action" data-nav="journal/'+journalDay+'">묵상 열기</button>' : '')+
    (noteKey ? '<button type="button" class="text-action destructive" data-delete-note="'+noteKey+'">삭제</button>' : '')+
    (!mark.journal && verseMark(mark) ? highlightDeleteButton(key) : '')+
    '</div></div></article>';
}
function recordList(rows = recordRows()) {
  const matching = rows.filter(({key,day,mark}) => {
    const {edition,book} = readRef(key);
    const matchesFilter = filter==='all' || markKinds(mark).includes(filter);
    return matchesFilter &&
      (!recordSelection.edition || edition===recordSelection.edition) &&
      (!recordSelection.book || book===recordSelection.book) &&
      (!recordSelection.year || (day?.slice(0,4) ?? 'undated')===recordSelection.year);
  });
  if (oldestRecordsFirst) matching.sort((a,b)=>(a.day ?? '9999').localeCompare(b.day ?? '9999'));
  const hasFilter = Object.values(recordSelection).some(Boolean);

  let groupsHtml = '';
  if (matching.length) {
      const dateGroups = new Map();
      for (const item of matching) {
        const d = item.day || 'undated';
        if (!dateGroups.has(d)) dateGroups.set(d, []);
        dateGroups.get(d).push(item);
      }
      const dateKeys = [...dateGroups.keys()].sort((a,b) => oldestRecordsFirst ? a.localeCompare(b) : b.localeCompare(a));
      groupsHtml = dateKeys.map(d => {
        const items = dateGroups.get(d);
        const label = d === 'undated' ? '날짜 미기록' : (d.slice(0,4)+'년 '+Number(d.slice(5,7))+'월 '+Number(d.slice(8,10))+'일 ('+['일','월','화','수','목','금','토'][new Date(d+'T12:00:00').getDay()]+')');
        return '<details class="record-group-accordion" open>'+
          '<summary class="record-group-summary">'+
            '<div class="record-group-info">'+
              '<span class="record-group-title">📅 '+esc(label)+'</span>'+
              '<span class="record-group-badge">'+items.length+'건</span>'+
            '</div>'+
            '<span class="record-group-chevron">'+icon('down')+'</span>'+
          '</summary>'+
          '<div class="record-group-items">'+
            items.map(renderRecordCard).join('')+
          '</div>'+
        '</details>';
      }).join('');

  }

  return '<div class="row record-list-tools">'+
    '<div class="row" style="gap:8px; align-items:center;">'+
      '<p class="record-result muted" tabindex="-1">말씀 기록 '+matching.length+'건</p>'+
      (hasFilter ? '<button type="button" class="text-action filter-reset-text" data-action="clear-record-filters">필터 초기화 ✕</button>' : '')+
      '<button type="button" class="text-action record-sort" data-action="sort-records" aria-label="오래된 순" aria-pressed="'+oldestRecordsFirst+'">'+
      (oldestRecordsFirst?'오래된 순':'최신 순')+icon('down')+'</button>'+
    '</div></div>'+
    (matching.length ? groupsHtml : '<p class="empty">조건에 맞는 말씀 기록이 없어요.</p>');
}
function personalSearchEntries() {
  const entries = [];
  const add = (type,day,title,body,attribute,value,year = day?.slice(0,4))=>
    entries.push({type,day,year:year || 'undated',title,body,attribute,value});
  const refsText = refs=>refs.map(ref=>reference(ref)+' '+verseText(ref)).join('\n');
  for (const [day,entry,noteId] of allJournalEntries()) {
    if (hasJournalContent(entry)) add('journal',day,entry.title || 'QT 묵상',
      [entry.reflection,refsText(entry.verses),...(entry.comments ?? []).map(comment=>comment.body)].filter(Boolean).join('\n'),
      'data-nav',journalRoute(day,noteId));
  }
  for (const [day,note] of Object.entries(state.dailyNotes)) {
    add('daily',day,reference(note.ref),note.body,'data-edit-daily-note',day);
  }
  for (const item of state.prayers) {
    const thought = item.kind==='thought';
    add(thought?'thought':'prayer',item.day,item.title || '생각 노트',
      [item.body,item.answer].filter(Boolean).join('\n'),'data-nav','prayer/'+item.id);
  }
  for (const item of state.newYear) {
    add('yearly',item.day,item.title,[item.note,refsText(item.refs)].filter(Boolean).join('\n'),
      'data-year-edit',item.id,String(item.year));
  }
  for (const row of recordRows()) {
    add('mark',row.day,selectionReference(row.key,row.verses),
      [row.mark.note,...recordPassage(row.key,row.verses).map(([,body])=>body)].filter(Boolean).join('\n'),
      row.noteKey?'data-edit-verse-note':'data-visit',row.noteKey ?? row.key);
  }
  for (const bundle of state.verseBundles) {
    add('bundle',bundle.day,reference(bundle.verses[0].ref)+' 외 '+bundle.verses.length+'구절',
      bundle.verses.map(verse=>reference(verse.ref)+' '+verse.body).join('\n'),'data-open-verse-bundle',bundle.id);
  }
  return entries.sort((a,b)=>(b.day ?? '').localeCompare(a.day ?? ''));
}
function personalYearLabel(year) {
  return year==='all'?'모든 연도':year==='undated'?'날짜 미기록':year+'년';
}
function renderPersonalSearch() {
  const currentScopedType = pageSearchType(view);
  const type = currentScopedType !== 'all' ? currentScopedType : personalSearchFilters.type;
  const year = personalSearchFilters.year;
  const query = searchText(readerSearchInput.value);
  const isCalendar = view === 'calendar';
  const entries = personalSearchSubmitted ? personalSearchEntries().filter(item=>{
    if (isCalendar) {
      if (!['journal', 'daily', 'mark'].includes(item.type)) return false;
    } else if (type !== 'all' && item.type !== type) {
      return false;
    }
    if (year !== 'all' && item.year !== year) return false;
    return !query || searchText([item.title,item.body,personalSearchTypes[item.type],item.day ?? '',personalYearLabel(item.year)].join(' ')).includes(query);
  }) : [];
  const rows = entries.map(({type,year,day,title,body,attribute,value})=>
    '<div class="search-result-row"><button type="button" class="record-open search-result" data-personal-hit '+attribute+'="'+esc(value)+'">'+
    '<small class="muted">'+esc(personalSearchTypes[type]+' · '+(day ?? personalYearLabel(year)))+'</small>'+
    (title===personalSearchTypes[type]?'':'<strong>'+esc(title)+'</strong>')+
    '<span>'+esc(body.slice(0,240))+'</span></button></div>').join('');
  const filterControls = currentScopedType !== 'all'
    ? searchTool('personal-search-year',personalYearLabel(year),'calendar')
    : searchTool('personal-search-type',personalSearchTypes[type],'filter')+searchTool('personal-search-year',personalYearLabel(year),'calendar');
  readerSearchPanel.innerHTML = '<section class="reader-search-group">'+searchToolbar(pageSearchTitle(view),filterControls)+
    '<div class="reader-search-list">'+(rows ||
    '<p class="muted">'+(personalSearchSubmitted?'조건에 맞는 기록이 없어요.':'검색어를 입력해 주세요.')+'</p>')+'</div></section>';
  readerSearchPanel.hidden = false;
}
function showPersonalSearchFilter(key) {
  const years = key==='year'?[...new Set(personalSearchEntries().map(item=>item.year))]
    .sort((a,b)=>a==='undated'?1:b==='undated'?-1:b.localeCompare(a)):[];
  const options = key==='type'?Object.entries(personalSearchTypes):['all',...years].map(year=>[year,personalYearLabel(year)]);
  dialog(key==='type'?'기록 종류':'기록 연도',
    pickerOptions(options.map(([id,label])=>[key+':'+id,label]),key+':'+personalSearchFilters[key],'data-personal-filter'),
    'personal-search-filter');
}
function choosePersonalSearchFilter(choice) {
  const [key,value] = choice.split(':');
  personalSearchFilters[key] = value;
  personalSearchSubmitted = true;
  modal.close();
  renderPersonalSearch();
  readerSearchPanel.querySelector('[data-action="personal-search-'+key+'"]')?.focus({preventScroll:true});
}
function recordPickerItems(key,rows) {
  if (key==='edition') return [...new Set(rows.map(({key})=>readRef(key).edition))].map(id=>[id,editionLabel(id)]);
  if (key==='book') {
    const savedBooks = new Set(rows.map(({key})=>readRef(key).book));
    return books.filter(([book])=>savedBooks.has(book));
  }
  const years = [...new Set(rows.map(({day})=>day?.slice(0,4) ?? 'undated'))];
  return years.map(year=>[year,year==='undated'?'날짜 미기록':year+'년']);
}
function recordsScreen() {
  const rows = recordRows();
  for (const key of Object.keys(recordSelection)) {
    if (recordSelection[key] && !recordPickerItems(key,rows).some(([id])=>id===recordSelection[key])) recordSelection[key] = '';
  }
  const journalCount = allJournalEntries().filter(([,entry])=>hasJournalContent(entry)).length;
  const prayers = state.prayers.filter(item=>item.kind!=='thought');
  const answered = prayers.filter(item=>item.done).length;
  const thoughts = state.prayers.length-prayers.length;
  const counts = {all:rows.length,highlight:0,note:0,journal:0};
  for (const {mark} of rows) for (const kind of markKinds(mark)) if (counts[kind] !== undefined) counts[kind]++;
  const activeFilters = Object.values(recordSelection).filter(Boolean).length;
  const filterChips = Object.entries(recordPickerLabels).map(([key,[label]])=>{
    const selected = recordPickerItems(key,rows).find(([id])=>id===recordSelection[key]);
    const isFiltered = Boolean(recordSelection[key]);
    const text = isFiltered ? (selected ? selected[1] : label) : label;
    return '<button type="button" class="filter-chip '+(isFiltered?'active':'')+'" data-action="pick-record-'+key+'" aria-label="'+label+' 필터">'+
      '<span>'+esc(text)+'</span>'+
      icon('down')+
      '</button>';
  }).join('');
  return heading('VERSE COLLECTION','기록함','형광펜, 밑줄, 메모를 모아보고 원하는 말씀을 찾아보세요.')+
    '<div class="record-shortcuts">'+[
      ['journals','comment','묵상 노트',journalCount+'건 · 새해 말씀 '+state.newYear.length+'건'],
      ['prayers','prayer','기도','기도 중 '+(prayers.length-answered)+'건 · 응답 '+answered+'건'],
      ['thoughts','note','생각 노트',thoughts+'건'],
      ['reading','check','통독 체크','일독 계획 · 성경책별 기록'],
    ].map(([route,symbol,label,detail])=>'<button class="record-shortcut" data-nav="'+route+'">'+icon(symbol)+'<strong>'+label+'</strong><span>'+detail+'</span></button>').join('')+'</div>'+
    (state.verseBundles.length?'<div class="section-head"><h2>구절 모음</h2></div>'+state.verseBundles.map(bundle=>
      '<article class="card row"><button type="button" class="record-open" data-open-verse-bundle="'+bundle.id+'">'+
      '<strong>'+esc(reference(bundle.verses[0].ref))+' · '+bundle.verses.length+'구절</strong>'+
      '<span class="muted">'+esc(bundle.day)+'</span></button><button type="button" class="text-action destructive" '+
      'data-remove-verse-bundle="'+bundle.id+'">삭제</button></article>').join(''):'')+
    '<div class="section-head"><h2>말씀 기록</h2></div>'+
    '<div class="record-toolbar">'+
      '<div class="record-type-tabs" role="group" aria-label="기록 종류">'+
        Object.entries(recordFilters).map(([id,label])=>'<button type="button" class="pill" data-filter="'+id+'" aria-pressed="'+(filter===id)+'">'+label+' <span>'+counts[id]+'</span></button>').join('')+
      '</div>'+
      '<div class="record-filter-row">'+filterChips+'</div>'+
    '</div>'+
    '<div id="record-list" class="spaced">'+recordList(rows)+'</div>';
}
function settingsScreen() {
  const tabs = Object.entries(settingsSections).map(([id,[label]])=>
    '<button type="button" data-settings-section="'+id+'" aria-pressed="'+(id===settingsSection)+'">'+label+'</button>').join('');
  return heading('MY NOTEBOOK','저장과 설정','묵상 노트는 이 기기에 저장돼요.')+
    '<nav class="settings-tabs" aria-label="설정 분류">'+tabs+'</nav>'+settingsSections[settingsSection][1]();
}
function backupSettings() {
  const ghToken = localStorage.getItem('logbible-gh-token') || '';
  const ghRepo = ghCloudRepo;
  const ghUser = localStorage.getItem('logbible-gh-user') || '';
  const ghLastSync = localStorage.getItem('logbible-gh-last-sync') || (state.backup ? new Date(state.backup).toLocaleString('ko-KR') : '');
  const ghAuto = localStorage.getItem('logbible-gh-auto') !== 'false';
  const isConnected = Boolean(ghToken && ghUser && ghAuto);

  return '<div class="section-head"><h2>기록 백업</h2></div><section class="card stack"><p>백업 파일에 묵상, 날짜별 오늘의 말씀, 말씀 묵상, 기도, 새해 말씀, 구절 표시와 구절 모음, 장별 묵상 체크, 일독 계획과 화면 설정이 담겨요. 직접 가져온 성경 본문은 별도로 다시 가져와야 해요. 새 기기에서는 같은 웹앱을 열고 이 파일을 가져오세요.</p><p class="muted">마지막 내보내기 · '+(state.backup?esc(new Date(state.backup).toLocaleString('ko-KR')):'아직 내보낸 기록이 없어요')+'</p><button class="btn primary" data-action="export">전체 백업 내보내기</button><button class="btn" data-action="import">백업 파일 가져오기</button><input id="backup-file" type="file" accept=".json,application/json" hidden><p class="muted">백업 파일에는 개인 묵상이 들어 있어요. 나만 접근할 수 있는 곳에 보관해 주세요.</p></section>'+
    '<div class="section-head"><h2>클라우드 자동 동기화</h2></div>'+
    '<section class="gh-card">'+
    '<div class="gh-header"><div><h3>GitHub 비공개 클라우드</h3></div>'+
    '<span class="gh-badge '+(isConnected?'':'off')+'">'+(isConnected?'자동 동기화 켜짐':!ghToken || !ghUser?'연결 설정 필요':'자동 동기화 꺼짐')+'</span></div>'+
    '<div id="gh-device-list" class="gh-device-list" aria-live="polite">'+ghDeviceMarkup()+'</div>'+
    '<div class="field"><span>깃허브 개인 토큰 (PAT)</span><input class="gh-input" id="gh-token-input" type="password" placeholder="ghp_..." value="'+esc(ghToken)+'" autocomplete="off" spellcheck="false"></div>'+
    '<div class="field"><span>사용자 파일명</span><input class="gh-input" id="gh-user-input" type="text" placeholder="사용하실 이름 영문 입력" value="'+esc(ghUser)+'" autocomplete="off" spellcheck="false"><p class="muted">기록 구분을 위한 영문 이름을 입력하세요. 같은 이름을 쓰는 기기끼리 자동으로 이어져요.</p></div>'+
    '<label class="gh-switch"><input type="checkbox" id="gh-auto-toggle" '+(ghAuto?'checked':'')+' data-action="gh-toggle-auto"><span>자동 동기화</span></label>'+
    (ghLastSync ? '<p class="muted">마지막 동기화 · '+esc(ghLastSync)+'</p>' : '')+
    '<div class="gh-actions">'+
    '<button type="button" class="btn primary" data-action="gh-backup">☁️ 지금 백업</button>'+
    '<button type="button" class="btn" data-action="gh-restore">🔄 지금 동기화</button>'+
    '</div>'+
    '<p class="muted" style="font-size:0.8rem; margin-top:8px;">💡 <strong>첫 등록 시:</strong> 새 이름으로 처음 시작할 때는 <strong>[지금 백업]</strong>을 한 번 눌러 깃허브에 첫 파일을 생성해 주세요. 다른 기기에서 이어받을 때는 <strong>[지금 동기화]</strong>를 누르면 바로 가져와요.</p>'+
    '<p class="muted">입력한 내용은 기기에 즉시 자동 저장되며, 토큰은 이 기기 브라우저에 저장돼요.</p>'+
    '</section>';
}
function menuOrderItem(route) {
  const item = menuItems.get(route);
  const symbol = item.querySelector('[data-icon]')?.dataset.icon;
  return '<span class="menu-order-icon">'+(symbol?icon(symbol):'')+'</span><span>'+esc(item.textContent.trim())+'</span>';
}
function menuOrderSettings() {
  const order = state.menuOrder.map(route=>'<li>'+menuOrderItem(route)+'</li>').join('');
  const first = esc(menuItems.get(state.menuOrder[0]).textContent.trim());
  return '<section class="card menu-order-card" aria-labelledby="menu-order-heading">'+
    '<div class="row menu-order-heading"><div><h2 id="menu-order-heading">메뉴 순서</h2><p class="muted">메뉴바 미리보기</p></div>'+
    '<button type="button" class="menu-order-edit" data-action="choose-menu-order" aria-haspopup="dialog">순서 바꾸기 '+icon('right')+'</button></div>'+
    '<ol class="menu-order-preview" role="list" aria-label="현재 메뉴 순서">'+order+'</ol>'+
    '<p class="menu-order-caption">첫 화면 <strong>'+first+'</strong></p></section>'+
    '<div class="section-head" style="margin-top:20px;"><h2>구절 이동 동작</h2></div><section class="card verse-arrival-settings">'+
    '<label class="verse-arrival-setting"><span><strong id="verse-arrival-label">이동한 구절을 맨 위에 표시</strong>'+
    '<span id="verse-arrival-description" class="muted">성경·주석·원전분해에 적용돼요. 켜면 검색하거나 직접 스크롤할 때 마지막 절도 상단 선택 줄 바로 아래까지 올릴 수 있어요.</span></span>'+
    '<span class="verse-arrival-switch"><input type="checkbox" role="switch" id="align-verse-at-top" aria-labelledby="verse-arrival-label" '+
    'aria-describedby="verse-arrival-description" '+(state.alignVerseAtTop===true?'checked':'')+'><span aria-hidden="true"></span></span></label></section>';
}
function showMenuOrderPicker() {
  pendingMenuOrder = [];
  const choices = state.menuOrder.map(route=>
    '<button type="button" class="menu-order-option" data-menu-choice="'+route+'" aria-pressed="false">'+
    menuOrderItem(route)+'<span class="menu-order-position"></span></button>').join('');
  dialog('메뉴 순서 바꾸기','<p class="muted">원하는 순서대로 누르면 번호가 붙어요. 모두 고르면 자동으로 저장돼요.</p>'+
    '<div class="menu-order-choices" role="group" aria-label="메뉴 순서">'+choices+'</div>');
}
function chooseMenuOrderItem(route) {
  const index = pendingMenuOrder.indexOf(route);
  if (index<0) pendingMenuOrder.push(route);
  else pendingMenuOrder.splice(index,1);
  if (pendingMenuOrder.length===menuItems.size) {
    state.menuOrder = [...pendingMenuOrder];
    modal.close();
    save();
    render();
    main.querySelector('[data-action="choose-menu-order"]')?.focus({preventScroll:true});
    return;
  }
  for (const choice of modal.querySelectorAll('[data-menu-choice]')) {
    const position = pendingMenuOrder.indexOf(choice.dataset.menuChoice)+1;
    choice.setAttribute('aria-pressed',String(Boolean(position)));
    choice.querySelector('.menu-order-position').textContent = position || '';
  }
}
function readingLocation(screen) {
  return screen==='bible'?(state.reader.edition?state.reader:undefined):studySelection[screen]?.location;
}
function readerAddress() {
  const {edition,book,chapter} = state.reader;
  return edition?[edition,book,chapter].join('/'):'';
}
function bibleResumeRef() {
  const address = readerAddress();
  return address && readingBookmark.startsWith(address+'/') && verseText(readingBookmark)?readingBookmark:'';
}
function setReadingBookmark(ref) {
  if (ref===readingBookmark || !verseText(ref)) return;
  readingBookmark = ref;
  try { localStorage.setItem(readingBookmarkKey,ref); } catch { /* Keep this session's place. */ }
}
function flushReadingBookmark() {
  const pending = readingBookmarkTimer!==undefined;
  if (pending) clearTimeout(readingBookmarkTimer);
  readingBookmarkTimer = undefined;
  if (view!=='bible' || jumpTo || !renderedBible || renderedBible!==readerAddress()) return;
  const scrollTop = document.scrollingElement.scrollTop;
  if (!pending && scrollTop===lastBibleScrollTop) return;
  lastBibleScrollTop = scrollTop;
  const {verse} = currentReadingPosition() ?? {};
  if (verse!==undefined) setReadingBookmark(renderedBible+'/'+verse);
}
function readingTop(screen) {
  const headerBottom=document.querySelector('.top').getBoundingClientRect().bottom;
  const toolbar=['bible','commentary','original'].includes(screen)?main.querySelector('.reading-toolbar'):null;
  const controls=toolbar ?? (['bible','commentary','original'].includes(screen)?main.querySelector('.reader-controls'):null);
  if(!controls)return headerBottom;
  const style=getComputedStyle(controls),stickyTop=parseFloat(style.top);
  const controlsBottom=style.position==='sticky' && Number.isFinite(stickyTop)?stickyTop+controls.getBoundingClientRect().height:controls.getBoundingClientRect().bottom;
  return Math.max(headerBottom,controlsBottom);
}
function currentReadingPosition(useSelection = false) {
  const location = readingLocation(view);
  if (!location) return;
  const {book,chapter} = location;
  const selected = useSelection && view==='bible'?chosen.values().next().value:undefined;
  if (selected) return readRef(selected);
  if (arrivedVerse && arrivedVerse.isConnected) {
    const v = Number(arrivedVerse.id.split('-').at(-1));
    if (Number.isFinite(v) && v > 0) return {book,chapter,verse:v};
  }
  if (readingArrival?.book===book && readingArrival.chapter===chapter &&
      Math.abs(readingArrival.scrollTop-document.scrollingElement.scrollTop)<=4) return readingArrival;
  const rows = [...main.querySelectorAll('[data-reading-verse]')];
  const threshold = readingTop(view) + 20;
  const row = rows.find(element=>element.getBoundingClientRect().bottom >= threshold) ?? rows[0];
  return {book,chapter,verse:row?Number(row.dataset.readingVerse):location.verse};
}
function syncBiblePosition({book,chapter,verse}) {
  const choices = new Set([state.reader.edition,...state.comparison,...Object.keys(editions)]);
  const edition = [...choices].find(id=>data[id]?.[book]?.[chapter]);
  if (!edition) return notify('가져온 역본에서 이 장을 찾을 수 없어요.');
  if (edition!==state.reader.edition || book!==state.reader.book || chapter!==state.reader.chapter) {
    setReader([edition,book,chapter,verse].join('/'));
  }
  if (verse===undefined) return;
  if (data[edition][book][chapter][verse]) {
    jumpTo = 'v-'+verse;
    return;
  }
  const comparison = state.comparison.find(id=>data[id]?.[book]?.[chapter]?.[verse]);
  if (comparison) jumpTo = 'compare-v-'+comparison+'-'+verse;
  else notify('가져온 역본에서 해당 절을 찾을 수 없어요.');
}
function rememberReadingArrival(verse) {
  const location = readingLocation(view);
  if (location) {
    const {book,chapter} = location;
    readingArrival = {book,chapter,verse,scrollTop:document.scrollingElement.scrollTop};
    if (view==='bible') {
      lastBibleScrollTop = readingArrival.scrollTop;
      setReadingBookmark(readerAddress()+'/'+verse);
    }
  }
}
function bundlesScreen() {
  const bundles = state.verseBundles || [];
  return heading('VERSE BUNDLES','구절 모음','함께 묵상하고 은혜받았던 구절들을 모아보세요.')+
    (bundles.length ? '<div class="stack" style="gap:10px">'+bundles.map(bundle =>
      '<article class="card stack" style="gap:8px;"><div class="row" style="justify-content:space-between; align-items:center;">'+
      '<div><strong style="font-size:1rem;">'+esc(reference(bundle.verses[0]?.ref || ''))+' 외 '+(bundle.verses.length-1)+'구절</strong>'+
      '<p class="muted" style="margin:2px 0; font-size:0.8125rem;">'+esc(bundle.day || '')+'</p></div>'+
      '<div class="row" style="gap:6px;">'+
      '<button type="button" class="btn small" data-open-verse-bundle="'+bundle.id+'">본문 보기</button>'+
      '<button type="button" class="text-action destructive" data-remove-verse-bundle="'+bundle.id+'">삭제</button>'+
      '</div></div>'+
      '<div class="post-quote" style="margin:0; font-size:0.875rem;">'+
      bundle.verses.map(v => '<span>'+esc(reference(v.ref))+'</span>').join(' · ')+
      '</div>'+
      '</article>'
    ).join('')+'</div>' : '<p class="empty">아직 저장된 구절 모음이 없어요.<br><small class="muted">성경 본문에서 구절을 선택한 뒤 구절 모음으로 저장할 수 있어요.</small></p>');
}
function render(studyFromSelection = false) {
  flushReadingBookmark();
  const screens = {'hebrew-guide':hebrewGuideScreen,atlas:()=>atlasScreen(address=>{const edition=[state.reader.edition,...Object.keys(editions)].find(id=>verseText(id+'/'+address));return edition?verseText(edition+'/'+address):'';}),today:todayScreen,'today-reading':todayReadingScreen,bible:readerScreen,calendar:calendarScreen,thoughts:thoughtsScreen,journals:journalsScreen,records:recordsScreen,bundles:bundlesScreen,settings:settingsScreen,prayers:prayersScreen,newyear:newYearScreen,journal:journalScreen,prayer:prayerScreen,reading:readingScreen,'book-checks':bookChecksScreen,commentary:()=>studyScreen('commentary'),original:()=>studyScreen('original'),'prayer-edit':prayerEditorScreen};
  const hash = location.hash==='#search'?'bible':(location.hash.slice(1) || state.menuOrder[0]);
  const day = journalDate(hash);
  const noteId=day?hash.split('/')[2] ?? '':'';
  activeJournalId=day && validId(noteId) && state.journal[day]?.notes?.some(note=>note.id===noteId)?noteId:'';
  const prayerId = hash.startsWith('prayer/') && validId(hash.slice(7)) ? hash.slice(7) : '';
  const editorId = hash.startsWith('prayer-edit/') && validId(hash.slice(12)) ? hash.slice(12) : '';
  const next = day?'journal':prayerId?'prayer':editorId?'prayer-edit':Object.hasOwn(screens,hash) && !['journal','prayer','prayer-edit'].includes(hash)?hash:'bible';
  const route = day || prayerId || editorId?hash:next;
  const changed = activeRoute!==route;
  let studyJump;
  if (changed) {
    if (modal.open &&
        modal.firstElementChild?.name === 'chapter-jump') {
      modal.close();
    }
    const isReadingTab = v => v === 'bible' || v === 'commentary' || v === 'original';
    const leavingReadingTab = isReadingTab(view);
    const enteringReadingTab = isReadingTab(next);

    // 떠나기 전에 현재 읽던 위치 저장
    let currentPos = undefined;
    if (leavingReadingTab) {
      currentPos = currentReadingPosition(true);
      if (currentPos && (view === 'commentary' || view === 'original')) {
        studySelection[view].location = {
          book: currentPos.book,
          chapter: currentPos.chapter,
          verse: currentPos.verse
        };
      }
    }

    // 성경 / 주석 / 원전분해 화면으로 진입할 때 상호 위치 동기화
    if (enteringReadingTab) {
      const syncPos = (leavingReadingTab || studyFromSelection) ? currentPos : undefined;

      if (next === 'bible') {
        if (syncPos) {
          syncBiblePosition(syncPos);
        } else if (!jumpTo) {
          const ref = bibleResumeRef();
          if (ref) jumpTo = 'v-' + verseNumber(ref);
        }
      } else if (next === 'commentary' || next === 'original') {
        const selection = studySelection[next];
        if (syncPos) {
          selection.location = {
            book: syncPos.book,
            chapter: syncPos.chapter,
            verse: syncPos.verse ?? 1
          };
        } else if (!selection.location) {
          selection.location = {
            book: state.reader.book,
            chapter: state.reader.chapter,
            verse: 1
          };
        }
        studyJump = selection.location?.verse;
      }
    }
    readingArrival = undefined;
    chosen.clear();
  }
  if (day) {
    selectedDay = day;
    month = day.slice(0,7);
  }
  activeRoute = route;
  view = next;
  main.classList.toggle('reader-view',view==='bible');
  main.classList.toggle('study-view',view==='commentary' || view==='original');
  main.classList.toggle('journal-view',view==='journal');
  main.classList.toggle('today-view',view==='today');
  main.classList.toggle('records-view',view==='records');
  document.querySelector('.back-button').hidden = view==='today' || (!history.state?.qtPrevious && (view==='bible' || !location.hash));
  const isPersonal = isPageSearchable(view);
  readerSearchForm.hidden = !(isPersonal || view==='original' || (view==='bible' && state.reader.edition));
  if ((changed || readerSearchForm.hidden) && !readerSearchInput.hidden) closeReaderSearch();
  const original = view==='original';
  const searchName = isPersonal ? pageSearchTitle(view) : readerSearchName(view);
  readerSearchForm.setAttribute('aria-label',searchName);
  readerSearchInput.setAttribute('aria-label',searchName);
  readerSearchInput.placeholder = isPersonal ? (
    view==='journals' ? '묵상 제목이나 내용 검색' :
    view==='prayers' ? '기도 제목이나 내용 검색' :
    view==='thoughts' ? '생각 노트 검색' :
    view==='newyear' ? '새해 말씀 검색' :
    view==='calendar' ? '날짜별 말씀이나 기록 검색' : '기록 제목이나 문구'
  ) : original?'원어, 단어 뜻, H559, 창 1:3':'단어, 창세기, 창 12:3';
  readerSearchClose.setAttribute('aria-label',searchName+' 닫기');
  if (readerSearchInput.hidden) readerSearchButton.setAttribute('aria-label',searchName+' 열기');
  document.querySelector('.bottom').hidden = view==='journal' || view==='prayer-edit';
  applyDisplay();
  if (view==='today' || view==='calendar') {
    renderedDailyDate = dateKey();
    if(view==='today')rememberDailyVerse(renderedDailyDate);
  }
  const sameCalendarDay = !changed && view==='calendar' && main.querySelector('.day-summary')?.dataset.date===selectedDay;
  const openSections = sameCalendarDay ? [...main.querySelectorAll('.day-detail[open] > summary')].map(summary=>summary.firstElementChild.textContent) : [];
  const isReading=['bible','commentary','original'].includes(view);
  cancelVerseArrival();
  main.innerHTML=screens[view](prayerId || editorId);
  if(isReading){
    const toolbar=document.createElement('div');toolbar.className='reading-toolbar';
    const modes=[['bible','본문','book'],['commentary','주석','comment'],['original','원전','note']];
    const active=modes.find(([route])=>route===view);
    toolbar.innerHTML='<details class="reading-mode-menu"><summary aria-label="성경 본문, 주석, 원전분해 전환">'+icon(active[2])+'<span>'+active[1]+'</span>'+icon('down')+'</summary><nav class="reading-mode-options" aria-label="성경 보기 방식">'+modes.map(([route,label,symbol])=>'<button type="button" data-nav="'+route+'" aria-current="'+(route===view?'page':'false')+'">'+icon(symbol)+(route==='bible'?'성경 본문':route==='original'?'원전분해':label)+'</button>').join('')+'</nav></details>';
    const controls=main.querySelector(':scope > .reader-controls');
    main.prepend(toolbar);if(controls)toolbar.append(controls);
  }
  if (view==='atlas') mountAtlas(main,render);
  if (document.getElementById('gh-device-list')) refreshGhDevices();
  renderedBible = view==='bible'?readerAddress():'';
  const thoughtForm = main.querySelector('form[data-thought-editor]');
  const prayerForm = main.querySelector('form[data-prayer-editor]');
  const dailyForm = main.querySelector('form[data-daily-note]');
  if (thoughtForm) prepareDraft(thoughtForm,'thought/'+thoughtForm.dataset.thoughtEditor,['day','body']);
  if (prayerForm) prepareDraft(prayerForm,'prayer/'+prayerForm.dataset.prayerEditor,['title','day','body','answer','done']);
  if (dailyForm) prepareDraft(dailyForm,'daily/'+dailyForm.dataset.dailyNote+'/'+dailyForm.dataset.ref,['body']);
  if (openSections.length) {
    for (const summary of main.querySelectorAll('.day-detail > summary')) {
      if (openSections.includes(summary.firstElementChild.textContent)) summary.parentElement.open = true;
    }
  }
  resizeEditorWriting();
  updateVerseScrollRoom();
  const navView = view==='hebrew-guide'?'calendar':view==='today-reading'?'today':['commentary','original'].includes(view)?'bible':['journals','prayers','thoughts','newyear','reading','book-checks','prayer','prayer-edit','journal'].includes(view)?'records':view;
  state.menuOrder.forEach((route,index)=>{
    const button = menuItems.get(route);
    if (menuBar.children[index]!==button) menuBar.insertBefore(button,menuBar.children[index]);
    if (button.dataset.nav===navView) button.setAttribute('aria-current','page');
    else button.removeAttribute('aria-current');
  });
  let arrival = view==='bible'?jumpTo:undefined;
  if (view==='bible') jumpTo = undefined;
  if (studyJump!==undefined) {
    const id = 'study-v-'+studyJump;
    if (studyJump>0 && studyJump<=500 && document.getElementById(id)) {
      arrival = id;
    } else {
      const avail = [...main.querySelectorAll('[data-reading-verse]')].map(el=>Number(el.dataset.readingVerse));
      const closest = avail.find(v=>v>=studyJump) ?? avail.at(-1);
      if (closest && document.getElementById('study-v-'+closest)) {
        arrival = 'study-v-'+closest;
      }
    }
  }
  if (arrival) {
    showVerseArrival(arrival);
  } else if (changed) {
    window.scrollTo(0,0);
    if (studyJump!==undefined) {
      rememberReadingArrival(studyJump);
      if (studySource(view)) notify('해당 절의 자료가 없어요.');
    }
  }
  if (view==='bible') lastBibleScrollTop = document.scrollingElement.scrollTop;
}
function verseScrollTop(verse) {
  const target = verse.closest('.verse-pair') ?? verse;
  return Math.max(0, Math.round(target.getBoundingClientRect().top + document.scrollingElement.scrollTop - readingTop(view) - 8));
}
function updateVerseScrollRoom() {
  const extended = state.alignVerseAtTop===true && ['bible','commentary','original'].includes(view);
  main.classList.toggle('verse-scroll-extended',extended);
  if (!extended) {
    main.style.removeProperty('--verse-arrival-room');
    void main.offsetHeight;
    return;
  }
  const last = Array.from(main.querySelectorAll('[data-reading-verse]')).at(-1);
  const lastVerse = last && studySelection[view]?document.getElementById('study-v-'+last.dataset.readingVerse) ?? last:last;
  const targetTop = lastVerse ? verseScrollTop(lastVerse) : 0;
  const page = document.scrollingElement;
  const existing = Number.parseFloat(main.style.getPropertyValue('--verse-arrival-room')) || 0;
  const naturalEnd = main.getBoundingClientRect().bottom+page.scrollTop-existing;
  const room = targetTop>0 ? Math.ceil(targetTop+page.clientHeight-naturalEnd + 40) : 0;
  if (room>0) main.style.setProperty('--verse-arrival-room',room+'px');
  else main.style.removeProperty('--verse-arrival-room');
  void main.offsetHeight;
}
function alignVerseArrival(verse) {
  const page = document.scrollingElement;
  updateVerseScrollRoom();
  const top = verseScrollTop(verse);
  const maxScroll = Math.max(0,page.scrollHeight-page.clientHeight);
  window.scrollTo(0,Math.min(top,maxScroll));
  rememberReadingArrival(Number(verse.id.split('-').at(-1)));
}
function refreshVerseScrollLayout() {
  if(arrivedVerse?.isConnected)alignVerseArrival(arrivedVerse);
  else updateVerseScrollRoom();
}
function cancelVerseArrival() {
  verseAlignmentEpoch++;
  clearTimeout(verseArrivalTimer);
  arrivedVerse?.classList.remove('verse-arrival');
  arrivedVerse=undefined;
}
function showVerseArrival(id) {
  const verse = document.getElementById(id);
  if (!verse) return;
  cancelVerseArrival();
  const epoch=verseAlignmentEpoch;

  alignVerseArrival(verse);
  arrivedVerse = verse;
  verse.classList.add('verse-arrival');

  const targetEl = verse.closest('.verse-pair') ?? verse;
  const ensureAlignment = () => {
    if (epoch===verseAlignmentEpoch && arrivedVerse===verse && verse.isConnected) {
      const expectedY = readingTop(view) + 8;
      const currentY = Math.round(targetEl.getBoundingClientRect().top);
      if (Math.abs(currentY - expectedY) > 2) {
        alignVerseArrival(verse);
      }
    }
  };
  window.requestAnimationFrame(ensureAlignment);
  setTimeout(ensureAlignment, 50);
  setTimeout(ensureAlignment, 150);

  verseArrivalTimer = setTimeout(()=>{
    if(epoch!==verseAlignmentEpoch)return;
    verse.classList.remove('verse-arrival');
    arrivedVerse = undefined;
  },1600);
}

function dialog(title,body,formName) {
  const close = formName?'type="button" data-action="close-dialog"':'value="cancel" formnovalidate';
  const titleFocus = formName==='chapter-jump'?'':' autofocus';
  modal.innerHTML = '<form method="dialog" class="stack"'+(formName?' name="'+formName+'"':'')+
    '><div class="row"><h2 id="active-dialog-title" tabindex="-1"'+titleFocus+'>'+title+
    '</h2><button class="btn dialog-close" '+close+'>닫기</button></div>'+body+'</form>';
  if (!modal.open) modal.showModal();
}
function updateMark(key,property,value) {
  const mark = state.marks[key] ??= {};
  if (value) mark[property] = value;
  else {
    delete mark[property];
    if (property==='note') {
      delete mark.noteDay;
      delete mark.noteEnd;
      delete mark.noteVerses;
    }
  }
  if (!mark.note && !mark.color && !mark.highlight && !mark.underline) delete state.marks[key];
}
function verseNumber(key) {
  return Number(key.slice(key.lastIndexOf('/')+1));
}
function selectVerse(key) {
  const first = chosen.values().next().value;
  const passage = key.slice(0,key.lastIndexOf('/'));
  if (!first || !first.startsWith(passage+'/')) {
    chosen.clear();
    chosen.add(key);
    pickingIndividualVerses = false;
    return;
  }
  if (chosen.delete(key)) return;
  if (pickingIndividualVerses) {
    const refs = [...chosen,key].sort((a,b)=>verseNumber(a)-verseNumber(b));
    chosen.clear();
    for (const ref of refs) chosen.add(ref);
    return;
  }
  const {edition,book,chapter,verse} = readRef(key);
  const start = Math.min(verse,verseNumber(first)), end = Math.max(verse,verseNumber(first));
  chosen.clear();
  for (const number of Object.keys(data[edition][book][chapter]).map(Number)) {
    if (number>=start && number<=end) chosen.add(passage+'/'+number);
  }
  pickingIndividualVerses = true;
}
function noteVerseNumbers(key,mark) {
  if (mark?.noteVerses) return mark.noteVerses;
  const first = verseNumber(key), last = mark?.noteEnd ?? first;
  return Array.from({length:last-first+1},(_,index)=>first+index);
}
function selectionReference(key,verses) {
  const {book,chapter} = readRef(key);
  const ranges = [];
  let start = verses[0];
  for (let i=0;i<verses.length;i++) {
    const end = verses[i];
    if (verses[i+1]===end+1) continue;
    ranges.push(start===end?String(end):start+'–'+end);
    start = verses[i+1];
  }
  return titles[book]+' '+chapter+':'+ranges.join(', ');
}
function showVerseNote(key,verses = noteVerseNumbers(key,state.marks[key])) {
  if (!key) return;
  const mark = state.marks[key];
  editingVerseNote = {key,verses};
  const passage = recordPassage(key,verses);
  const quote = passage.map(([number,body])=>verses.length>1?number+'절 '+body:body).join('\n');
  dialog('구절 메모','<div class="verse-note-body">'+
    noteEditorContext(selectionReference(key,verses),key,quote,quote.length>400)+
    editorField('나의 메모','note',mark?.note,'textarea','id="verse-note" rows="3" placeholder="마음에 남은 생각을 적어보세요."')+
    draftNotice()+'</div><footer class="row verse-note-actions">'+
    (mark?.note?'<button type="button" class="text-action destructive" data-delete-note="'+key+'">메모 삭제</button>':
      '<span class="muted">기록함에 저장돼요</span>')+
    '<button type="button" class="btn primary" data-action="save-note">'+icon('check')+' 저장</button></footer>','verse-note-editor');
  const form = modal.querySelector('form');
  form.classList.add('note-editor-dialog');
  prepareDraft(form,'verse/'+key+'/'+verses.join(','),['note']);
  resizeWriting(form.elements.note);
}
async function saveVerseNote() {
  const form = modal.querySelector('form');
  const value = modal.querySelector('#verse-note').value.trim();
  if (!value) return notify('메모 내용을 입력해 주세요.');
  const draft = draftSnapshot(form);
  const {key,verses} = editingVerseNote;
  const previous = state.marks[key];
  state.marks[key] = {...previous,note:value,noteEnd:verses.at(-1),noteVerses:verses,noteDay:previous?.noteDay ?? dateKey()};
  const button = modal.querySelector('[data-action="save-note"]');
  button.disabled = true;
  if (!await save()) {
    if (previous) state.marks[key] = previous;
    else delete state.marks[key];
    button.disabled = false;
    return;
  }
  if (lastMarkerEdit?.some(([ref])=>ref===key)) lastMarkerEdit = undefined;
  finishDraft(form,draft);
  if (modal.open && modal.contains(form)) {
    chosen.clear();
    modal.close();
    render();
  }
  notify('구절 메모를 저장했어요.');
}
function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function validRef(key) {
  if (typeof key !== 'string') return false;
  const {edition,book,chapter,verse} = readRef(key);
  const local = localEditionId(edition);
  return [edition,book,chapter,verse].join('/') === key &&
    (local || Object.hasOwn(retiredEditions,edition)) &&
    validChapter(book+'/'+chapter) && Number.isInteger(verse) && verse>=(local?0:1) && verse<=500;
}
function validatedJournalNote(note){
  if(!isObject(note)||!validId(note.id)||typeof note.done!=='boolean'||!Array.isArray(note.verses)||!note.verses.every(validRef))throw Error('journal note');
  const result={id:note.id,done:note.done,verses:[...new Set(note.verses)]};
  for(const field of [...Object.keys(parts),'title','reflection','created'])if(note[field]!==undefined){if(typeof note[field]!=='string')throw Error('journal note field');result[field]=note[field];}
  if(note.comments!==undefined){if(!Array.isArray(note.comments)||!note.comments.every(validComment))throw Error('journal note comments');result.comments=note.comments;}
  return result;
}
function validatedBackup(payload) {
  const input = payload?.data;
  if (payload?.format !== 'meomum-qt' || ![1,2,3].includes(payload.version) ||
      !isObject(input?.journal) || !isObject(input.marks)) throw Error('backup format');
  const result = blank();
  for (const [day,entry] of Object.entries(input.journal)) {
    const dayDate = new Date(day+'T12:00:00');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || dateKey(dayDate)!==day || !isObject(entry) ||
        typeof entry.done!=='boolean' || !Array.isArray(entry.verses) || !entry.verses.every(validRef)) throw Error('journal');
    const safeEntry = {done:entry.done,verses:[...new Set(entry.verses)]};
    for (const part of [...Object.keys(parts),'reflection','title']) {
      if (!Object.hasOwn(entry,part)) continue;
      if (typeof entry[part]!=='string') throw Error('journal field');
      safeEntry[part] = entry[part];
    }
    if (entry.comments!==undefined) {
      if (!Array.isArray(entry.comments) || !entry.comments.every(validComment) ||
          new Set(entry.comments.map(item=>item.id)).size!==entry.comments.length) throw Error('journal comments');
      safeEntry.comments = entry.comments;
    }
    if(entry.notes!==undefined){if(!Array.isArray(entry.notes)||new Set(entry.notes.map(note=>note.id)).size!==entry.notes.length)throw Error('journal notes');safeEntry.notes=entry.notes.map(validatedJournalNote);}
    result.journal[day] = safeEntry;
  }
  if (input.dailyVerses!==undefined) {
    if (!isObject(input.dailyVerses)) throw Error('daily verses');
    for (const [day,verse] of Object.entries(input.dailyVerses)) {
      if (!validDay(day) || !isObject(verse) || !validRef(verse.ref) ||
          typeof verse.body!=='string' || !verse.body.trim() || verse.body.length>10000 ||
          typeof verse.label!=='string' || verse.label.length>72) throw Error('daily verse');
      result.dailyVerses[day] = {ref:verse.ref,body:verse.body,label:verse.label};
      if (verse.wholeBible===true) result.dailyVerses[day].wholeBible = true;
    }
  }
  if (input.dailyNotes!==undefined) {
    if (!isObject(input.dailyNotes)) throw Error('daily notes');
    for (const [day,note] of Object.entries(input.dailyNotes)) {
      if (!validDay(day) || !isObject(note) || !validRef(note.ref) ||
          typeof note.body!=='string' || !note.body.trim() || note.body.length>dailyNoteLimit) throw Error('daily note');
      result.dailyNotes[day] = {ref:note.ref,body:note.body};
    }
  }
  for (const [key,mark] of Object.entries(input.marks)) {
    if (!validRef(key) || !isObject(mark) || (mark.color!==undefined && !Object.hasOwn(colors,mark.color)) ||
        (mark.note!==undefined && typeof mark.note!=='string')) throw Error('mark');
    if (mark.highlight!==undefined && !validColor(mark.highlight)) throw Error('highlight');
    if (mark.underline!==undefined && (!isObject(mark.underline) || !validColor(mark.underline.color) ||
        (!Object.hasOwn(markStyles,mark.underline.style) && mark.underline.style!=='double') || mark.underline.style==='fill')) throw Error('underline');
    if (mark.noteVerses!==undefined && (!Array.isArray(mark.noteVerses) || !mark.noteVerses.length ||
        mark.noteVerses[0]!==verseNumber(key) || !mark.noteVerses.every((verse,index,list)=>
          Number.isInteger(verse) && verse<=500 && (!index || verse>list[index-1])))) throw Error('note verses');
    result.marks[key] = {color:mark.color,note:mark.note,highlight:mark.highlight,underline:mark.underline,
      group:validId(mark.group)?mark.group:undefined,markDay:validDay(mark.markDay)?mark.markDay:undefined,
      noteDay:validDay(mark.noteDay)?mark.noteDay:undefined,noteVerses:mark.noteVerses,
      noteEnd:Number.isInteger(mark.noteEnd) && mark.noteEnd>=readRef(key).verse && mark.noteEnd<=500?mark.noteEnd:undefined};
  }
  if (isObject(input.reader)) {
    const {edition,book,chapter} = input.reader;
    if (Object.hasOwn(editions,edition) && Object.hasOwn(titles,book) && Number.isInteger(chapter) &&
        data[edition]?.[book]?.[chapter]) result.reader = {edition,book,chapter};
  }
  if (typeof input.backup==='string' && Number.isFinite(Date.parse(input.backup))) result.backup = input.backup;
  for (const name of ['prayers','newYear']) {
    if (input[name] === undefined) continue;
    if (!Array.isArray(input[name]) || !input[name].every(name==='prayers'?validPrayer:validYear)) throw Error(name);
    if (new Set(input[name].map(item=>item.id)).size!==input[name].length) throw Error('duplicate id');
    result[name] = input[name];
  }
  if (input.verseBundles!==undefined) {
    if (!Array.isArray(input.verseBundles) || !input.verseBundles.every(validVerseBundle) ||
        new Set(input.verseBundles.map(bundle=>bundle.id)).size!==input.verseBundles.length) throw Error('verse bundles');
    result.verseBundles = input.verseBundles;
  }
  if (input.chapterLog!==undefined) {
    if (!isObject(input.chapterLog)) throw Error('chapter log');
    for (const [day,chapters] of Object.entries(input.chapterLog)) {
      if (!validDay(day) || !Array.isArray(chapters) || !chapters.every(validChapter)) throw Error('chapter log entry');
      result.chapterLog[day] = [...new Set(chapters)];
    }
  }
  if (input.readingRange!=null) {
    if (!isObject(input.readingRange) || !planChapters(canonChapters(),input.readingRange).length) throw Error('reading range');
    result.readingRange = {
      start: input.readingRange.start,
      end: input.readingRange.end,
      startDate: input.readingRange.startDate || '',
      targetDate: input.readingRange.targetDate || ''
    };
  }
  if (Array.isArray(input.readingHistory)) {
    result.readingHistory = input.readingHistory;
  }
  if (input.editionLabels!==undefined) {
    if (!isObject(input.editionLabels)) throw Error('edition labels');
    for (const [id,label] of Object.entries(input.editionLabels)) {
      if (!localEditionId(id) || typeof label!=='string' || label.length>72) throw Error('edition label');
      result.editionLabels[id] = label;
    }
  }
  result.quickMarkers = Array.isArray(input.quickMarkers) && input.quickMarkers.length===3 ? input.quickMarkers : ['#e6bc43','#7cb668','#dc7d9c'];
  result.readingGoal = input.readingGoal;
  result.commentaryEdition = input.commentaryEdition;
  result.alignVerseAtTop = input.alignVerseAtTop;
  result.display = input.display;
  result.theme = input.theme;
  result.palette = input.palette;
  result.fontChoice = input.fontChoice;
  result.menuOrder = input.menuOrder;
  result.markerColor = input.markerColor;
  result.markerStyle = input.markerStyle;
  result.comparison = input.comparison;
  result.readingSize = input.readingSize;
  return migrate(result);
}
let pendingImport, pendingComparison = [], pendingMenuOrder = [];
const actions = {
  'resume-bible'() {
    const ref = bibleResumeRef();
    if (ref) visit(ref);
    else navigate('bible');
  },
  'close-bible-search'() { closeReaderSearch(true); },
  'pick-search-scope':showSearchScopePicker,
  'personal-search-type'() { showPersonalSearchFilter('type'); },
  'personal-search-year'() { showPersonalSearchFilter('year'); },
  'view-search-selection':showSelectedSearchVerses,
  'choose-menu-order':showMenuOrderPicker,
  'jump-chapter':showChapterJump,
  'pick-edition':showEditionPicker,
  'pick-commentary':() => showCommentaryPicker(),
  'sort-records'() {
    oldestRecordsFirst = !oldestRecordsFirst;
    recordPage = 0;
    render();
    main.querySelector('[data-action="sort-records"]')?.focus({preventScroll:true});
  },
  'clear-record-filters'() {
    for (const key of Object.keys(recordSelection)) recordSelection[key] = '';
    recordPage = 0;
    render();
  },
  'set-reading-tab'() {
    const btn = event.target.closest('[data-tab]');
    const tab = btn?.dataset.tab || 'reading';
    history.replaceState(null, '', '#' + tab);
    render();
  },
  'pick-tracker-year'() { showTrackerPicker('year'); },
  'pick-tracker-book'() { showTrackerPicker('book'); },
  'tracker-overview'() {
    const book = trackerBook;
    trackerBook = undefined;
    render();
    (main.querySelector('[data-book-check-detail="'+book+'"]') ??
      main.querySelector('[data-tracker-scope="'+trackerScope+'"]'))?.focus();
  },
  'close-dialog'() { modal.close(); },
  back() { goBack(); },
  'open-today-note'() { showDailyNote(); },
  'open-today-calendar'() {
    selectedDay = dateKey();
    month = selectedDay.slice(0,7);
    navigate('calendar');
  },
  'calendar-today'() {
    selectedDay = dateKey();
    month = selectedDay.slice(0,7);
    render();
    main.querySelector('[data-action="calendar-today"]')?.focus({preventScroll:true});
  },
  'choose-font'() { document.querySelector('#custom-font-file-he')?.click() || document.querySelector('#custom-font-file')?.click(); },
  'choose-font-ko'() { document.querySelector('#custom-font-file-ko').click(); },
  'choose-font-he'() { document.querySelector('#custom-font-file-he').click(); },
  'choose-font-grc'() { document.querySelector('#custom-font-file-grc').click(); },
  'choose-font-en'() { document.querySelector('#custom-font-file-en').click(); },
  'set-lang-font'(btn) {
    const el = btn || event?.target?.closest('[data-lang-font]');
    const lang = el?.dataset.lang;
    const font = el?.dataset.langFont;
    if (lang && font) {
      if (lang === 'ko') state.fontKorean = font;
      else if (lang === 'he') state.fontHebrew = font;
      else if (lang === 'grc') state.fontGreek = font;
      else if (lang === 'en') state.fontEnglish = font;
      applyDisplay();
      save();
      render();
    }
  },
  'choose-bdb'() { document.querySelector('#bdb-files').click(); },
  'reset-reading-range'() {
    const canon = canonChapters();
    if (!canon.length) return;
    modal.querySelector('[data-range-book="시작"]').value = canon[0].split('/')[0];
    modal.querySelector('[data-range-chapter="시작"]').value = canon[0].split('/')[1];
    modal.querySelector('[data-range-book="끝"]').value = canon.at(-1).split('/')[0];
    modal.querySelector('[data-range-chapter="끝"]').value = canon.at(-1).split('/')[1];
  },
  'archive-reading-plan'() {
    const canon = canonChapters();
    const planned = planChapters(canon,state.readingRange);
    const scope = planned.length ? planned : canon;
    const range = state.readingRange;
    const label = range ? chapterLabel(range.start)+(range.start===range.end?'':' ~ '+chapterLabel(range.end)) : '성경 전체 (1,189장)';
    dialog('통독 기록 보관',
      '<p>현재 통독 계획을 <strong>지난 통독 기록</strong>에 영구 보관하고 새로운 통독 계획을 시작하시겠어요?</p>'+
      '<p class="muted">보관할 범위: ' + esc(label) + ' (' + scope.length + '장)</p>'+
      '<div class="row" style="margin-top:12px;"><button type="button" class="btn" data-action="close-dialog">취소</button><button type="button" class="btn primary" data-action="confirm-archive-plan">보관하고 새 계획 시작</button></div>'
    );
  },
  'confirm-archive-plan'() {
    if (!state.readingHistory) state.readingHistory = [];
    const canon = canonChapters();
    const planned = planChapters(canon,state.readingRange);
    const scope = planned.length ? planned : canon;
    const range = state.readingRange;
    const label = range ? chapterLabel(range.start)+(range.start===range.end?'':' ~ '+chapterLabel(range.end)) : '성경 전체 (1,189장)';
    state.readingHistory.unshift({
      id: 'plan-' + Date.now(),
      title: (state.readingHistory.length + 1) + '회차 성경 통독',
      rangeLabel: label,
      startDate: range?.startDate || '',
      endDate: dateKey(),
      completedAt: dateKey(),
      chaptersCount: scope.length
    });
    state.readingRange = null;
    modal.close();
    save();
    render();
    notify('통독 기록을 보관함에 저장했어요!');
  },
  'set-app-font'(btn) {
    const f = (btn || event?.target?.closest('[data-font]'))?.dataset.font;
    if (f) {
      state.fontChoice = f;
      applyDisplay();
      save();
      render();
    }
  },
  'plan-mode-daily'() {
    modal.querySelectorAll('.plan-mode-tab').forEach(t=>t.classList.toggle('active',t.dataset.action==='plan-mode-daily'));
    const dailyPanel = modal.querySelector('#plan-mode-daily-panel');
    const targetPanel = modal.querySelector('#plan-mode-target-panel');
    if (dailyPanel) dailyPanel.hidden = false;
    if (targetPanel) targetPanel.hidden = true;
  },
  'plan-mode-target'() {
    modal.querySelectorAll('.plan-mode-tab').forEach(t=>t.classList.toggle('active',t.dataset.action==='plan-mode-target'));
    const dailyPanel = modal.querySelector('#plan-mode-daily-panel');
    const targetPanel = modal.querySelector('#plan-mode-target-panel');
    if (dailyPanel) dailyPanel.hidden = true;
    if (targetPanel) targetPanel.hidden = false;
  },
  'edit-reading-range'() { showReadingRange(); },
  'save-reading-range'() { saveReadingRange(); },
  'reset-reading-range'() { setReadingRange(null); },
  highlight() { showMarkDialog(); },
  'quick-marker'() { if (Date.now()>=ignoreMarkerClick) quickMarker(); },
  'apply-dot-marker'(button) {
    const preset = Number(button.dataset.preset);
    const color = (state.quickMarkers || ['#e6bc43','#7cb668','#dc7d9c'])[preset] || '#e6bc43';
    const keys = [...chosen];
    const markers = indexVerseMarkers();
    const allHaveColor = keys.length && keys.every(key => {
      const m = verseMark(markers.get(verseAddress(key))?.mark);
      return m && m.color?.toLowerCase() === color.toLowerCase();
    });
    if (allHaveColor) {
      applyVerseMarks(keys, undefined, '형광펜을 지웠어요.');
    } else {
      applyVerseMarks(keys, {style: 'fill', color}, (preset + 1) + '번 형광펜을 칠했어요.');
    }
  },
  'save-to-quick'(button) {
    const preset = Number(button.dataset.preset);
    const colorInput = modal.querySelector('#mark-color');
    const color = colorInput?.value;
    if (validColor(color)) {
      if (!Array.isArray(state.quickMarkers)) state.quickMarkers = ['#e6bc43','#7cb668','#dc7d9c'];
      state.quickMarkers[preset] = color;
      save();
      notify((preset + 1) + '번 퀵 형광펜에 지정했어요.');
      render();
    }
  },
  'undo-marker'() {
    if (!lastMarkerEdit) return;
    for (const [key,previous] of lastMarkerEdit) {
      if (previous) state.marks[key] = previous;
      else delete state.marks[key];
    }
    lastMarkerEdit = undefined;
    modal.close();
    save();
    render();
  },
  compare() {
    const available = Object.entries(editions).filter(([key])=>key!==state.reader.edition);
    pendingComparison = [...state.comparison];
    const choices = available.map(([id,label])=>{
      const rank = pendingComparison.indexOf(id)+1;
      return '<label class="compare-choice"><input type="checkbox" name="compare-edition" value="'+esc(id)+'" '+(rank?'checked':'')+'>'+
        esc(label)+'<span class="compare-order">'+(rank || '')+'</span></label>';
    });
    dialog('역본 대조','<p class="muted">함께 볼 번역본을 선택하세요. 선택한 순서대로 표시돼요.</p>'+
      '<div class="stack" role="group" aria-label="함께 볼 번역본">'+choices.join('')+'</div>'+
      '<div class="row"><button class="btn" type="button" data-action="stop-compare" '+(!state.comparison.length?'disabled':'')+'>대조 끄기</button><button class="btn primary" type="button" data-action="start-compare">적용</button></div>');
  },
  'start-compare'() { setComparison(pendingComparison); },
  'stop-compare'() { setComparison([]); },
  'apply-mark'() { applyMark(); },
  'erase-mark'() { applyMark(true); },
  'add-prayer'() { showPrayerEditor(); },
  'open-today-thoughts'() { todayThoughtsOpen=!todayThoughtsOpen;render();if(todayThoughtsOpen)document.getElementById('today-thoughts')?.scrollIntoView({behavior:'smooth',block:'start'}); },
  'add-thought'() { showThoughtEditor(); },
  'add-year'() { showYearEditor(); },
  'add-selected-year'() { if (chosen.size) showYearEditor(undefined,[...chosen]); },
  'add-year-reference'() { addYearReference(modal.querySelector('form[name="year-editor"]')); },
  'save-year'() { saveYear(); },
  'delete-item'() { removeItem(); },
  'save-comment'() { saveComment(); },
  'reset-display'() { state.display = {}; save(); render(); },
  note() {
    const refs = [...chosen];
    if (!refs.length) return;
    const key = refs[0];
    showVerseNote(key,refs.length===1?undefined:refs.map(verseNumber));
  },
  'save-note'() { saveVerseNote(); },
  async 'copy-verses'() {
    const refs = [...chosen].filter(ref=>verseText(ref)).sort((a,b)=>verseNumber(a)-verseNumber(b));
    if (!refs.length) return notify('복사할 구절을 선택해 주세요.');
    const first = refs[0];
    const citation = selectionReference(first,refs.map(verseNumber))+' · '+editionLabel(readRef(first).edition);
    const verses = refs.map(ref=>verseNumber(ref)+' '+verseText(ref));
    const text = citation+'\n'+verses.join('\n');
    try {
      await navigator.clipboard.writeText(text);
      notify('선택한 구절을 복사했어요.');
    } catch {
      dialog('구절 복사','<p class="muted">아래 본문을 선택해 복사해 주세요.</p>'+
        editorField('선택한 구절','verses',text,'textarea','readonly rows="6"'));
    }
  },
  attach() {
    const entry = journalEntry(dateKey());
    entry.verses = [...new Set([...entry.verses,...chosen])];
    chosen.clear();
    save().then(saved => { if (saved) notify('오늘 묵상에 구절을 담았어요.'); });
    render();
  },
  clear() { chosen.clear(); render(); },
  export() {
    const timestamp = new Date().toISOString();
    const editionLabels = {...state.editionLabels,...Object.fromEntries(Object.entries(editions).filter(([id])=>localEditionId(id)))};
    const blob = new Blob([JSON.stringify({format:'meomum-qt',version:3,data:{...state,editionLabels,backup:timestamp}},null,2)],{type:'application/json'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'meomum-qt-'+dateKey()+'.json';
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url),30000);
    state.backup = timestamp;
    save();
    render();
  },
  import() { document.querySelector('#backup-file').click(); },
  async restore() {
    if (!pendingImport) return;
    const previous = state;
    state = pendingImport;
    lastMarkerEdit = undefined;
    pendingImport = undefined;
    modal.close();
    if (await save()) notify('백업 기록을 복원했어요.');
    else state = previous;
    render();
  },
  'gh-toggle-auto'() {
    const checked = document.querySelector('#gh-auto-toggle')?.checked ?? true;
    localStorage.setItem('logbible-gh-auto', checked ? 'true' : 'false');
    if (!checked) markGhOffline();
    notify(checked ? '클라우드 자동 동기화를 켰어요.' : '클라우드 자동 동기화를 껐어요.');
    render();
    refreshGhDevices(true);
  },
  async 'gh-backup'(btnOrSilent = false) {
    const silent = btnOrSilent === true;
    const tokenInput = document.querySelector('#gh-token-input')?.value.trim();
    if (tokenInput !== undefined && tokenInput !== '') localStorage.setItem('logbible-gh-token', tokenInput);
    const userInput = document.querySelector('#gh-user-input')?.value.trim();
    if (userInput) localStorage.setItem('logbible-gh-user', userInput);

    const rawToken = localStorage.getItem('logbible-gh-token');
    const rawRepo = ghCloudRepo;
    const rawUser = localStorage.getItem('logbible-gh-user')?.trim();
    if (!rawToken) {
      if (!silent) notify('깃허브 토큰을 먼저 입력해 주세요.');
      return;
    }
    if (!rawUser) {
      if (!silent) notify('사용자 이름을 먼저 입력해 주세요.');
      return;
    }

    const token = rawToken.trim().replace(/[^\x21-\x7E]/g, '');
    const repo = rawRepo.replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/i, '').trim();
    const user = rawUser.trim().replace(/\.json$/i, '').trim();

    if (!silent) notify('깃허브에 백업 중이에요…');
    try {
      const timestamp = new Date().toISOString();
      const editionLabels = {...state.editionLabels,...Object.fromEntries(Object.entries(editions).filter(([id])=>localEditionId(id)))};
      const payload = {format:'meomum-qt',version:3,data:{...state,editionLabels,backup:timestamp}};
      const jsonStr = JSON.stringify(payload, null, 2);
      const utf8Bytes = new TextEncoder().encode(jsonStr);
      let binary = '';
      for (let i = 0; i < utf8Bytes.length; i++) binary += String.fromCharCode(utf8Bytes[i]);
      const contentBase64 = btoa(binary);

      const filePath = `${user}.json`;
      const encodedPath = encodeURIComponent(filePath);
      const url = `https://api.github.com/repos/${repo}/contents/${encodedPath}`;

      let sha;
      const getRes = await fetch(`${url}?_t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github+json'
        }
      });
      if (getRes.ok) {
        const fileData = await getRes.json();
        sha = fileData.sha;
      }

      const body = {
        message: `기록 백업 (${user}) · ${new Date().toLocaleString('ko-KR')}`,
        content: contentBase64,
        ...(sha ? { sha } : {})
      };
      let putRes = await fetch(url, {
        method: 'PUT',
        cache: 'no-store',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      if (putRes.status === 409) {
        const freshGet = await fetch(`${url}?_t=${Date.now()}`, {
          cache: 'no-store',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github+json'
          }
        });
        if (freshGet.ok) {
          const freshData = await freshGet.json();
          body.sha = freshData.sha;
          putRes = await fetch(url, {
            method: 'PUT',
            cache: 'no-store',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/vnd.github+json',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
          });
        }
      }

      if (!putRes.ok) {
        const err = await putRes.json().catch(() => ({}));
        throw new Error(err.message || putRes.statusText);
      }

      const nowStr = new Date().toLocaleString('ko-KR');
      localStorage.setItem('logbible-gh-last-sync', nowStr);
      refreshGhDevices(true);
      state.backup = timestamp;
      await storeLocal('journal', state);
      if (!silent) {
        notify('깃허브에 안전하게 백업했어요!');
        render();
      }
    } catch (e) {
      if (!silent) notify('백업 실패: ' + e.message);
    }
  },
  async 'gh-restore'(btnOrSilent = false) {
    const silent = btnOrSilent === true;
    const tokenInput = document.querySelector('#gh-token-input')?.value.trim();
    if (tokenInput !== undefined && tokenInput !== '') localStorage.setItem('logbible-gh-token', tokenInput);
    const userInput = document.querySelector('#gh-user-input')?.value.trim();
    if (userInput) localStorage.setItem('logbible-gh-user', userInput);

    const rawToken = localStorage.getItem('logbible-gh-token');
    const rawRepo = ghCloudRepo;
    const rawUser = localStorage.getItem('logbible-gh-user')?.trim();
    if (!rawToken) {
      if (!silent) notify('깃허브 토큰을 먼저 입력해 주세요.');
      return;
    }
    if (!rawUser) {
      if (!silent) notify('사용자 이름을 먼저 입력해 주세요.');
      return;
    }

    const token = rawToken.trim().replace(/[^\x21-\x7E]/g, '');
    const repo = rawRepo.replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/i, '').trim();
    const user = rawUser.trim().replace(/\.json$/i, '').trim();

    if (!silent) notify('깃허브에서 기록을 가져오는 중이에요…');
    try {
      let filePath = `${user}.json`;
      let encodedPath = encodeURIComponent(filePath);
      let url = `https://api.github.com/repos/${repo}/contents/${encodedPath}?_t=${Date.now()}`;
      let res = await fetch(url, {
        cache: 'no-store',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github+json'
        }
      });
      if (!res.ok && res.status === 404) {
        const listRes = await fetch(`https://api.github.com/repos/${repo}/contents?_t=${Date.now()}`, {
          cache: 'no-store',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github+json'
          }
        });
        if (listRes.ok) {
          const files = await listRes.json();
          const target = user.toLowerCase() + '.json';
          const match = Array.isArray(files) && files.find(f => f.name.toLowerCase() === target);
          if (match) {
            filePath = match.name;
            const correctUser = match.name.replace(/\.json$/i, '');
            localStorage.setItem('logbible-gh-user', correctUser);
            encodedPath = encodeURIComponent(filePath);
            url = `https://api.github.com/repos/${repo}/contents/${encodedPath}?_t=${Date.now()}`;
            res = await fetch(url, {
              cache: 'no-store',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github+json'
              }
            });
          }
        }
      }
      if (!res.ok) {
        if (res.status === 404) throw new Error('저장소에 백업 파일(' + filePath + ')이 아직 없어요. 먼저 [지금 백업]을 눌러주세요.');
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || res.statusText);
      }
      const fileData = await res.json();
      const binary = atob(fileData.content.replace(/\s/g, ''));
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const jsonStr = new TextDecoder().decode(bytes);
      const payload = JSON.parse(jsonStr);

      const currentReader = {...state.reader};
      const currentComparison = Array.isArray(state.comparison) ? [...state.comparison] : [];
      const currentDisplay = {...state.display};
      const currentFonts = {
        fontKorean: state.fontKorean,
        fontHebrew: state.fontHebrew,
        fontGreek: state.fontGreek,
        fontEnglish: state.fontEnglish,
        fontChoice: state.fontChoice,
        palette: state.palette,
        theme: state.theme
      };
      const imported = validatedBackup(payload);
      state = imported;
      state.reader = currentReader;
      state.comparison = comparisonEditions(currentComparison, state.reader.edition);
      state.display = currentDisplay;
      Object.assign(state, currentFonts);
      lastMarkerEdit = undefined;
      pendingImport = undefined;
      const nowStr = new Date().toLocaleString('ko-KR');
      localStorage.setItem('logbible-gh-last-sync', nowStr);
      refreshGhDevices(true);
      await storeLocal('journal', state);
      applyDisplay();
      if (!silent) notify('깃허브에서 최신 기록을 성공적으로 복원했어요!');
      render();
    } catch (e) {
      if (!silent) notify('동기화 실패: ' + e.message);
    }
  },
};
function stepChapter(offset) {
  const reader = state.reader;
  const source = data[reader.edition];
  if (!source) return;
  const chapters = availableChapters(reader.edition);
  const next = chapters[chapters.indexOf(reader.book+'/'+reader.chapter)+offset];
  if (!next) return;
  const [book,chapter] = next.split('/');
  reader.book = book;
  reader.chapter = Number(chapter);
  const first = Object.keys(source[book][chapter]).find(verse=>source[book][chapter][verse]);
  const verse = first ? Number(first) : 1;
  studySelection.commentary.location = {book,chapter:Number(chapter),verse};
  studySelection.original.location = {book,chapter:Number(chapter),verse};
  setReadingBookmark(readerAddress()+'/'+verse);
  chosen.clear();
  save();
  render();
  window.scrollTo(0,0);
}
function bookPickerContext() {
  const {edition,book} = state.reader;
  const selection = studySelection[view];
  return selection
    ? {book:selection.location?.book,source:Object.fromEntries(books.map(([code])=>[code,studyBookChapters(view,code)])),selection}
    : {book,source:data[edition],edition};
}
function pickerOptions(items,active,attribute) {
  return '<div class="reader-picker-options">'+items.map(([id,label])=>
    '<button type="button" class="btn" '+attribute+'="'+esc(id)+'"'+(id===active?' aria-current="true"':'')+
    '>'+esc(label)+'</button>').join('')+'</div>';
}
function showTrackerPicker(kind,testament,page) {
  const isBook = kind==='book';
  const selected = isBook?(trackerBook ?? state.reader.book):selectedTrackerYear();
  const section = testament ?? testamentByBook[selected] ?? 'old';
  const items = isBook?books.filter(([book])=>testamentByBook[book]===section):
    [['','전체 연도'],...trackerYears().map(year=>[year,year+'년'])];
  const pageSize = window.innerHeight<520?6:12;
  const pages = Math.ceil(items.length/pageSize);
  const initial = Math.floor(items.findIndex(([value])=>value===selected)/pageSize);
  const current = Math.max(0,Math.min(page ?? initial,pages-1));
  const tabs = isBook?'<div class="settings-tabs tracker-testaments" role="group" aria-label="구약 또는 신약">'+
    [['old','구약'],['new','신약']].map(([key,label])=>
      '<button type="button" data-tracker-testament="'+key+'" aria-pressed="'+(key===section)+'">'+label+'</button>').join('')+'</div>':'';
  const pager = pages>1?'<nav class="row tracker-picker-pages" aria-label="선택 목록 페이지">'+
    [[current-1,'이전','left'],[current+1,'다음','right']].map(([number,label,glyph])=>
      '<button type="button" class="btn" data-tracker-page="'+number+'" data-tracker-kind="'+kind+'" data-tracker-section="'+section+
      '" aria-label="'+label+' 페이지" '+(number<0 || number>=pages?'disabled':'')+'>'+icon(glyph)+'</button>').join('<span>'+(current+1)+' / '+pages+'</span>')+'</nav>':'';
  dialog(isBook?'성경책 선택':'연도 선택',tabs+
    pickerOptions(items.slice(current*pageSize,(current+1)*pageSize),selected,isBook?'data-tracker-book':'data-tracker-year')+pager,'tracker-picker');
  modal.querySelector('#active-dialog-title')?.focus({preventScroll:true});
}
function chooseTrackerValue(kind,value) {
  modal.close();
  if (kind==='book') return showBookChecksDetail(value);
  trackerYear = value;
  render();
  main.querySelector('[data-action="pick-tracker-year"]')?.focus({preventScroll:true});
}
function showBookChecksDetail(book) {
  if (!Object.hasOwn(titles,book)) return;
  trackerBook = book;
  render();
  window.scrollTo(0,0);
  main.querySelector('#book-checks-heading')?.focus({preventScroll:true});
}
function showEditionPicker() {
  if (view!=='bible' || !state.reader.edition) return;
  dialog('번역본 선택',pickerOptions(Object.entries(editions),state.reader.edition,'data-pick-edition'));
}
function showCommentaryPicker(page) {
  if (view!=='commentary') return;
  const items = Object.values(commentaries).map(({id,label})=>[id,label]);
  const active = studySource('commentary')?.id;
  if (!items.length) return;
  const pageSize = window.innerHeight<520?4:8;
  const pages = Math.ceil(items.length/pageSize);
  const current = Math.max(0,Math.min(page ?? Math.floor(items.findIndex(([id])=>id===active)/pageSize),pages-1));
  const pager = pages>1?'<nav class="row tracker-picker-pages" aria-label="주석 목록 페이지">'+
    '<button type="button" class="btn" data-commentary-page="'+(current-1)+'" aria-label="이전 페이지" '+(current===0?'disabled':'')+'>'+icon('left')+'</button>'+
    '<span>'+(current+1)+' / '+pages+'</span>'+
    '<button type="button" class="btn" data-commentary-page="'+(current+1)+'" aria-label="다음 페이지" '+(current+1===pages?'disabled':'')+'>'+icon('right')+'</button></nav>':'';
  dialog('주석 선택',pickerOptions(items.slice(current*pageSize,(current+1)*pageSize),active,'data-pick-commentary')+pager);
}
function chooseCommentary(id) {
  if (view!=='commentary' || !Object.hasOwn(commentaries,id)) return;
  const position = currentReadingPosition();
  const previous = studySource('commentary')?.id;
  modal.close();
  if (id!==previous) {
    state.commentaryEdition = id;
    studySelection.commentary.location = position;
    readingArrival = undefined;
    save();
    render();
    if (position?.verse && studyChapterVerses('commentary',position.book,position.chapter)[position.verse]) {
      showVerseArrival('study-v-'+position.verse);
    } else window.scrollTo(0,0);
  }
  main.querySelector('[data-action="pick-commentary"]')?.focus({preventScroll:true});
}
function chooseEdition(edition) {
  if (!Object.hasOwn(editions,edition)) return;
  const reader = state.reader;
  modal.close();
  if (reader.edition!==edition) {
    const chapters = data[edition]?.[reader.book];
    const location = chapters
      ? {book:reader.book,chapter:chapters[reader.chapter]?reader.chapter:Object.keys(chapters)[0]}
      : initialReader(edition);
    setReader([edition,location.book,location.chapter,1].join('/'));
    render();
  }
  main.querySelector('[data-action="pick-edition"]')?.focus({preventScroll:true});
}
function bookPickerSections(items,active,attribute) {
  const sections = [['old','구약'],['new','신약']].map(([testament,label])=>{
    const choices = items.filter(([code])=>testamentByBook[code]===testament);
    return '<section class="book-picker-section" aria-label="'+label+'"><h3>'+label+'</h3>'+
      (choices.length?pickerOptions(choices,active,attribute):'<p class="muted">선택할 책이 없어요.</p>')+'</section>';
  }).join('');
  return '<div class="book-picker">'+sections+'</div>';
}
function showBookPicker() {
  const {book,source} = bookPickerContext();
  if (!source) return;
  dialog('성경책 선택',bookPickerSections(books.filter(([code])=>source[code]),book,'data-pick-book'));
}
function showRecordPicker(key) {
  if (!Object.hasOwn(recordPickerLabels,key)) return;
  const [label,all] = recordPickerLabels[key];
  const items = recordPickerItems(key,recordRows());
  const active = recordSelection[key];
  const attribute = 'data-record-option';
  const choices = key==='book'
    ? pickerOptions([['',all]],active,attribute)+bookPickerSections(items,active,attribute)
    : pickerOptions([['',all],...items],active,attribute);
  dialog(label+' 선택','<div class="stack" data-record-filter="'+key+'">'+choices+'</div>');
}
function chooseRecordOption(button) {
  const {recordFilter:key} = button.closest('[data-record-filter]').dataset;
  recordSelection[key] = button.dataset.recordOption;
  recordPage = 0;
  modal.close();
  render();
  main.querySelector('[data-action="pick-record-'+key+'"]')?.focus({preventScroll:true});
}
function chooseBook(book) {
  const current = bookPickerContext();
  const chapters = current.source?.[book];
  if (!chapters) return;
  modal.close();
  if (current.book!==book) {
    const chapter = Number(Object.keys(chapters)[0]);
    studySelection.commentary.location = {book,chapter,verse:1};
    studySelection.original.location = {book,chapter,verse:1};
    if (current.selection) {
      current.selection.location = {book,chapter,verse:1};
      state.reader.book = book;
      state.reader.chapter = chapter;
    } else {
      setReader([current.edition,book,chapter,1].join('/'));
    }
    render();
  }
  main.querySelector('[data-action="pick-book"]')?.focus({preventScroll:true});
}
document.addEventListener('click',event => {
  if (!readerSearchInput.hidden && !readerSearchForm.contains(event.target) && !modal.contains(event.target)) closeReaderSearch();
  const button = event.target.closest('button');
  if (!button) return;
  if (event.detail && Date.now()<ignoreReaderSwipeClickUntil && button.closest('.bible-passage')) {
    ignoreReaderSwipeClickUntil = 0;
    return;
  }
  const target = button.dataset;
  if (atlasAction(target) || hebrewAction(target) || hebrewGuideAction(target)) { render(); return; }
  if (target.atlasRef) {
    const address = target.atlasRef;
    const edition = [state.reader.edition,...Object.keys(editions)].find(id=>verseText(id+'/'+address));
    if (edition) visit(edition+'/'+address);
    else notify('관련 구절을 보려면 해당 성경책이 있는 번역본을 추가해 주세요.');
    return;
  }
  if (target.action==='discard-draft') return discardDraft(button.form);
  if (target.settingsSection && Object.hasOwn(settingsSections,target.settingsSection)) {
    settingsSection = target.settingsSection;
    render();
    main.querySelector('[data-settings-section="'+settingsSection+'"]')?.focus({preventScroll:true});
    return;
  }
  if (target.personalFilter) return choosePersonalSearchFilter(target.personalFilter);
  if ('personalHit' in target) closeReaderSearch();
  if (target.action==='save-verse-bundle') return saveVerseBundle(button);
  if (target.copyBundle) return copyVerseBundle(target.copyBundle);
  if (target.openVerseBundle) {
    const bundle = state.verseBundles.find(item=>item.id===target.openVerseBundle);
    if (bundle) showVerseBundle(bundle.verses,bundle.id);
    return;
  }
  if (target.removeVerseBundle) return confirmItemRemoval('bundle',target.removeVerseBundle);
  if (target.menuChoice) return chooseMenuOrderItem(target.menuChoice);
  if ('recordOption' in target) return chooseRecordOption(button);
  if (target.action?.startsWith('pick-record-')) return showRecordPicker(target.action.slice('pick-record-'.length));
  if (target.pickEdition) return chooseEdition(target.pickEdition);
  if (target.pickCommentary) return chooseCommentary(target.pickCommentary);
  if ('commentaryPage' in target) return showCommentaryPicker(Number(target.commentaryPage));
  if (target.pickBook) return chooseBook(target.pickBook);
  if (target.trackerTestament) return showTrackerPicker('book',target.trackerTestament,0);
  if ('trackerPage' in target) return showTrackerPicker(target.trackerKind,target.trackerSection,Number(target.trackerPage));
  if ('trackerBook' in target) return chooseTrackerValue('book',target.trackerBook);
  if ('trackerYear' in target) return chooseTrackerValue('year',target.trackerYear);
  if (target.bookCheckDetail) return showBookChecksDetail(target.bookCheckDetail);
  if (Object.hasOwn(trackerScopes,target.trackerScope)) {
    trackerScope = target.trackerScope;
    render();
    main.querySelector('[data-tracker-scope="'+trackerScope+'"]')?.focus({preventScroll:true});
    return;
  }
  if (target.action==='pick-book') return showBookPicker();
  if (target.strongCode) return showOriginalMeaning(button);
  if (target.studyReturn) return returnToBible(studySelection[view]?.location,Number(target.studyReturn));
  if (target.nav) {
    if (modal.contains(button)) modal.close();
    if (target.nav==='settings' && 'importLink' in target) settingsSection = 'library';
    const studyFromSelection = Object.hasOwn(studySelection,target.nav) && button.closest('.study-shortcuts');
    navigate(target.nav,undefined,Boolean(studyFromSelection));
    if (target.nav==='bible') refreshLocalEditions();
    if ('importLink' in target) {
      const heading = document.getElementById('local-library-heading');
      heading?.focus({preventScroll:true});
      heading?.scrollIntoView({block:'start'});
    }
    if ('dailyLink' in target) {
      const heading = document.querySelector('#daily-note-heading');
      heading?.focus({preventScroll:true});
      heading?.scrollIntoView({block:'start'});
    }
    return;
  }
  if (target.removeEdition) return confirmEditionRemoval(target.removeEdition);
  if (target.confirmEditionRemoval) return removeLocalEdition(target.confirmEditionRemoval,button);
  if (target.readEdition && Object.hasOwn(editions,target.readEdition)) {
    const {book,chapter} = state.reader;
    const edition = target.readEdition;
    const location = data[edition]?.[book]?.[chapter]?{edition,book,chapter}:initialReader(edition);
    setReader([edition,location.book,location.chapter,1].join('/'));
    return navigate('bible');
  }
  if (target.searchVisit || target.searchBookStart) return visitSearchResult(target.searchVisit ?? target.searchBookStart);
  if (target.searchScope) return chooseSearchScope(target.searchScope);
  if ('searchPage' in target) return changeSearchPage(button);
  if (target.visit) return visit(target.visit);
  if (target.action) return actions[target.action]?.(button);
  if(target.todayPlanMode){todayPlanMode=target.todayPlanMode==='due'?'due':'books';render();return;}
  if(target.todayBookPicker){if(!todayBookPicker){const {next}=todayPlan();const book=todayPlanBook||next[0]?.split('/')[0]||state.reader.book;todayBookScope=testamentByBook[book]||'old';}todayBookPicker=!todayBookPicker;render();return;}
  if(target.todayBookScope){todayBookScope=target.todayBookScope==='old'?'old':'new';render();return;}
  if(target.todayPlanBook&&books.some(([book])=>book===target.todayPlanBook)){todayPlanBook=target.todayPlanBook;todayBookPicker=false;render();return;}
  if (target.openChapter) return openChapter(target.openChapter);
  if (target.checkChapter) return toggleChapter(target.checkChapter);
  if (target.displayStep) return stepDisplay(button);
  if (target.editVerseNote) return showVerseNote(target.editVerseNote);
  if (target.deleteNote) return confirmItemRemoval('note',target.deleteNote);
  if (target.prayerFilter) { prayerFilter = target.prayerFilter; return render(); }
  if (target.editDailyNote) return showDailyNote(target.editDailyNote);
  if (target.deleteHighlight) return confirmHighlightRemoval(target.deleteHighlight);
  if (target.removeHighlight) {
    const record = highlightRecord(target.removeHighlight);
    if (!record) return modal.close();
    const passage = record.key.slice(0,record.key.lastIndexOf('/'));
    return applyVerseMarks(record.verses.map(verse=>passage+'/'+verse),undefined,'말씀 표시를 지웠어요.');
  }
  if (target.prayer) return showPrayerEditor(state.prayers.find(item => item.id===target.prayer));
  if (target.yearEdit) return showYearEditor(state.newYear.find(item => item.id===target.yearEdit));
  if (target.removeYearRef) {
    yearRefs = yearRefs.filter(ref=>ref!==target.removeYearRef);
    const form = button.form;
    renderYearReferences(form);
    form.elements.reference.focus({preventScroll:true});
    return;
  }
  if (target.delete) return confirmItemRemoval(target.delete,editId);
  if (target.deletePrayer) return confirmItemRemoval('prayer',target.deletePrayer);
  if (target.deleteDailyNote) return confirmItemRemoval('dailyNote',target.deleteDailyNote);
  if (target.openYear) {
    navigate('newyear');
    document.getElementById('yearly-group-'+target.openYear)?.scrollIntoView({block:'start'});
    return;
  }
  if (target.addJournal || target.startJournal) {
    startTodayJournal();
    main.querySelector('[data-journal-field="reflection"]')?.focus({preventScroll:true});
    return;
  }
  if (target.editJournal) {
    if (!validDay(target.editJournal) || !state.journal[target.editJournal]) return;
    navigate(journalRoute(target.editJournal,target.journalNote ?? ''));
    main.querySelector('[data-journal-field="reflection"]')?.focus({preventScroll:true});
    return;
  }
  if (target.deleteJournal){const id=target.journalNote || (view==='journal'?activeJournalId:'');return id?confirmItemRemoval('journal-note',id,target.deleteJournal):confirmItemRemoval('journal',target.deleteJournal);}
  if (target.deleteComment) return confirmItemRemoval('comment',target.deleteComment,target.date);
  if (target.commentDay) return showCommentEditor(target.commentDay,target.commentId);
  if (target.verse) {
    const key = target.verse;
    selectVerse(key);
    render();
    if (event.detail===0) document.getElementById(button.id)?.focus({preventScroll:true});
    return;
  }
  if (target.day && view==='calendar' && validDay(target.day)) {
    selectedDay = target.day;
    render();
    if (event.detail===0) main.querySelector('[data-day="'+selectedDay+'"]')?.focus({preventScroll:true});
    return;
  }
  if (target.month) {
    const [year,num] = month.split('-').map(Number);
    selectedDay = dateKey(new Date(year,num-1+Number(target.month),1));
    month = selectedDay.slice(0,7);
  }
  if ('recordPage' in target) {
    const page = Number(target.recordPage);
    if (!Number.isInteger(page) || page<0) return;
    recordPage = page;
    render();
    const summary = main.querySelector('#record-list .record-result');
    summary?.focus({preventScroll:true});
    summary?.scrollIntoView({block:'start'});
    return;
  }
  if (target.filter) { filter = target.filter; recordPage = 0; }
  if (target.step) return stepChapter(Number(target.step));
  if (target.done) {
    const entry = journalEntry(target.done);
    entry.done = !entry.done;
    save().then(saved => { if (saved && entry.done) notify('달력에 QT 완료를 표시했어요.'); });
  }
  if (target.remove) {
    const entry = journalEntry(target.date);
    entry.verses = entry.verses.filter(ref => ref!==target.remove);
    save();
  }
  if (target.month || target.filter || target.done || target.remove) render();
});
function cancelMarkerHold() {
  clearTimeout(markerHold);
  markerPointer = undefined;
}
main.addEventListener('pointerdown',event => {
  if (event.isPrimary) ignoreReaderSwipeClickUntil = 0;
  if (event.pointerType==='touch') {
    readerSwipe = undefined;
    if (view==='bible' && event.isPrimary && event.clientX>22 && event.clientX<window.innerWidth-22 &&
        event.target.closest('.bible-passage') && !event.target.closest('.passage-heading, .verse-note-icon')) {
      readerSwipe = {id:event.pointerId,x:event.clientX,y:event.clientY};
    }
  }
  if (event.button!==0 || !event.target.closest('[data-action="quick-marker"]')) return;
  markerPointer = {id:event.pointerId,x:event.clientX,y:event.clientY};
  markerHold = setTimeout(() => {
    ignoreMarkerClick = Date.now()+800;
    cancelMarkerHold();
    if (chosen.size) showMarkDialog();
  },480);
});
main.addEventListener('pointermove',event => {
  if (markerPointer?.id===event.pointerId &&
      Math.hypot(event.clientX-markerPointer.x,event.clientY-markerPointer.y)>10) cancelMarkerHold();
});
document.addEventListener('pointerup',event=>{
  cancelMarkerHold();
  if (!readerSwipe || readerSwipe.id!==event.pointerId) return;
  const {x,y} = readerSwipe;
  readerSwipe = undefined;
  const horizontal = event.clientX-x, vertical = event.clientY-y;
  if (view!=='bible' || Math.abs(horizontal)<65 || Math.abs(horizontal)<Math.abs(vertical)*1.4) return;
  ignoreReaderSwipeClickUntil = Date.now()+350;
  stepChapter(horizontal<0?1:-1);
});
document.addEventListener('pointercancel',event=>{
  cancelMarkerHold();
  if (readerSwipe?.id===event.pointerId) readerSwipe = undefined;
});
main.addEventListener('contextmenu',event => {
  if (event.target.closest('[data-action="quick-marker"]')) event.preventDefault();
});
function resizeWriting(field) {
  field.style.height = 'auto';
  field.style.height = field.scrollHeight+'px';
}
function resizeEditorWriting() {
  main.querySelectorAll('[data-journal-field="reflection"], [data-thought-editor] textarea, [data-prayer-editor] textarea')
    .forEach(resizeWriting);
}
modal.addEventListener('input',event=>{
  const field = event.target;
  updateDraft(field.form);
  if (field.tagName==='TEXTAREA' && (field.form?.name==='year-editor' || field.form?.classList?.contains('note-editor-dialog'))) resizeWriting(field);
  if (field.name==='reference' && field.form?.name==='year-editor') field.form.querySelector('[data-year-ref-status]').textContent = '';
  updateEditorDate(field);
});
modal.addEventListener('keydown',event=>{
  const field = event.target;
  if (event.key!=='Enter' || event.isComposing || field.name!=='reference' || field.form?.name!=='year-editor') return;
  event.preventDefault();
  addYearReference(field.form);
});
let journalSaveTimer;
main.addEventListener('input',event => {
  const field = event.target;
  updateDraft(field.form);
  updateEditorDate(field);
  if (field.tagName==='TEXTAREA' && (field.form?.dataset.thoughtEditor || field.form?.dataset.prayerEditor)) resizeWriting(field);
  if (field.dataset.journalField) {
    const entry = journalEntry(selectedDay);
    entry[field.dataset.journalField] = field.value;
    const delBtn = main.querySelector('[data-delete-journal]');
    if (delBtn) delBtn.hidden = !hasJournalContent(entry);
    if (field.tagName==='TEXTAREA') resizeWriting(field);
    clearTimeout(journalSaveTimer);
    journalSaveTimer = setTimeout(() => {
      save();
    }, 600);
  }
  if (field.id==='reading-goal') {
    document.getElementById('reading-goal-value').textContent = field.value+'장';
    field.setAttribute('aria-valuetext',field.value+'장');
  }
});
main.addEventListener('focusout', event => {
  if (event.target.dataset?.journalField) {
    clearTimeout(journalSaveTimer);
    save();
  }
});
main.addEventListener('toggle',event=>{
  if (event.target.open && event.target.matches('[data-prayer-editor] .post-response')) {
    event.target.querySelectorAll('textarea').forEach(resizeWriting);
  }
},true);
readerSearchInput.addEventListener('input',()=>{
  if (isPageSearchable(view)) {
    personalSearchSubmitted = true;
    renderPersonalSearch();
  } else clearReaderSearchResults();
});
readerSearchPanel.addEventListener('change',event=>{
  const field = event.target;
  const key = field.dataset.searchSelect;
  if (!key) return;
  if (field.checked) selectedSearchVerses.add(key);
  else selectedSearchVerses.delete(key);
  const button = readerSearchPanel.querySelector('[data-action="view-search-selection"]');
  button.disabled = !selectedSearchVerses.size;
  button.querySelector('.search-tool-pill > span').textContent = selectedSearchVerses.size?'모아 보기 ('+selectedSearchVerses.size+')':'모아 보기';
});
readerSearchForm.addEventListener('submit',event=>{
  event.preventDefault();
  if (readerSearchInput.hidden) return showReaderSearch();
  readerSearchInput.blur();
  if (isPageSearchable(view)) {
    personalSearchSubmitted = true;
    return renderPersonalSearch();
  }
  submitReaderSearch();
});
window.addEventListener('resize',()=>{
  resizeEditorWriting();
  refreshVerseScrollLayout();
  if (modal.open) modal.querySelectorAll('form[name="year-editor"] textarea, .note-editor-dialog textarea').forEach(resizeWriting);
  if (!bibleSearchResults) return;
  const firstVisible = bibleSearchPage*bibleSearchPageSize;
  bibleSearchPageSize = fitReaderSearchPage();
  updateReaderSearch(Math.floor(firstVisible/bibleSearchPageSize));
});
window.addEventListener('scroll',()=>{
  const isReading = view==='bible' || view==='commentary' || view==='original';
  if (!isReading) return;
  if (view==='bible' && renderedBible) {
    const scrollTop = document.scrollingElement.scrollTop;
    if (scrollTop===lastBibleScrollTop) return;
    lastBibleScrollTop = scrollTop;
    if (readingBookmarkTimer===undefined) readingBookmarkTimer = setTimeout(flushReadingBookmark,160);
  }
  if (arrivedVerse) return;
  const pos = currentReadingPosition();
  if (pos && pos.book && pos.chapter) {
    studySelection.commentary.location = {book:pos.book, chapter:pos.chapter, verse:pos.verse ?? 1};
    studySelection.original.location = {book:pos.book, chapter:pos.chapter, verse:pos.verse ?? 1};
    if (view!=='bible') {
      state.reader.book = pos.book;
      state.reader.chapter = pos.chapter;
    }
  }
},{passive:true});
for(const type of ['pointerdown','touchstart','wheel','keydown'])window.addEventListener(type,()=>{if(arrivedVerse)cancelVerseArrival();},{passive:true,capture:true});
window.addEventListener('pagehide',flushReadingBookmark);
document.fonts?.addEventListener('loadingdone',refreshVerseScrollLayout);
function keepScrollInOverlay(event,delta) {
  const overlay = modal.open ? modal : readerSearchPanel.hidden ? null : readerSearchPanel;
  if (!overlay || !event.cancelable) return;
  for (let node = event.target; overlay.contains(node); node = node.parentElement) {
    const remaining = node.scrollHeight-node.clientHeight-node.scrollTop;
    if (((delta<0 && node.scrollTop>0) || (delta>0 && remaining>1)) &&
        /^(auto|scroll)$/.test(getComputedStyle(node).overflowY)) return;
    if (node===overlay) break;
  }
  event.preventDefault();
}
let overlayTouchY;
function preventPageZoom(event) {
  if (event.cancelable) event.preventDefault();
}
document.addEventListener('gesturestart',preventPageZoom,{passive:false});
document.addEventListener('gesturechange',preventPageZoom,{passive:false});
document.addEventListener('wheel',event=>{
  if (event.ctrlKey) return preventPageZoom(event);
  keepScrollInOverlay(event,event.deltaY);
},{passive:false});
document.addEventListener('touchstart',event=>{
  overlayTouchY = event.touches[0]?.clientY;
},{passive:true});
document.addEventListener('touchmove',event=>{
  if (event.target.closest?.('.atlas-map')) return;
  if (event.touches.length>1) return preventPageZoom(event);
  if (event.touches.length!==1) return;
  const y = event.touches[0].clientY;
  const delta = (overlayTouchY ?? y)-y;
  overlayTouchY = y;
  if (delta) keepScrollInOverlay(event,delta);
},{passive:false});
document.addEventListener('keydown',event=>{
  if (event.key!=='Escape' || readerSearchInput.hidden || modal.open) return;
  event.preventDefault();
  closeReaderSearch(true);
});
modal.addEventListener('submit',event => {
  const form = event.target;
  if (event.submitter?.value==='cancel') return;
  if (form.name==='chapter-jump') {
    event.preventDefault();
    return jumpToChapter(form);
  }
  if (form.dataset.dailyNote) {
    event.preventDefault();
    return saveDailyNote(form);
  }
});
main.addEventListener('submit',event => {
  const form = event.target;
  if (form.dataset.thoughtEditor) {
    event.preventDefault();
    return saveThought(form);
  }
  if (form.dataset.dailyNote) {
    event.preventDefault();
    return saveDailyNote(form);
  }
  if (form.matches('[data-prayer-editor]')) {
    event.preventDefault();
    return savePrayer(form);
  }
  const day = form.dataset.commentForm;
  if (!day) return;
  event.preventDefault();
  if (!journalEntry(day).done) return;
  const body = new FormData(form).get('comment').trim();
  if (!body) return notify('댓글 내용을 입력해 주세요.');
  const entry = journalEntry(day);
  (entry.comments ??= []).push({id:newId(),body,created:new Date().toISOString()});
  save();
  render();
});
main.addEventListener('change',async event => {
  const field = event.target;
  updateDraft(field.form);
  updateEditorDate(field);
  if (field.dataset.action === 'set-quick-color') {
    const preset = Number(field.dataset.preset);
    if (!Array.isArray(state.quickMarkers)) state.quickMarkers = ['#e6bc43','#7cb668','#dc7d9c'];
    state.quickMarkers[preset] = field.value;
    save();
    return render();
  }
  if (field.id==='align-verse-at-top') {
    state.alignVerseAtTop = field.checked;
    cancelVerseArrival();
    updateVerseScrollRoom();
    return save();
  }
  if (field.id==='reading-goal') {
    state.readingGoal = Number(field.value);
    const focused = document.activeElement===field;
    save();
    render();
    if (focused) document.getElementById('reading-goal')?.focus({preventScroll:true});
  }
  const displayPreference = field.name==='palette'?'palette':{appearance:'theme','font-choice':'fontChoice'}[field.id];
  if (displayPreference) {
    state[displayPreference] = field.value;
    applyDisplay();
    save();
  }
  if (field.id==='custom-font-file-ko' && field.files[0]) return importCustomFont(field.files[0], 'ko');
  if (field.id==='custom-font-file-he' && field.files[0]) return importCustomFont(field.files[0], 'he');
  if (field.id==='custom-font-file-grc' && field.files[0]) return importCustomFont(field.files[0], 'grc');
  if (field.id==='custom-font-file-en' && field.files[0]) return importCustomFont(field.files[0], 'en');
  if (field.id==='custom-font-file' && field.files[0]) return importCustomFont(field.files[0], 'he');
  if (field.id==='bdb-files') return importBibleFiles([...field.files]);
  if (field.id==='backup-file' && field.files[0]) {
    try {
      pendingImport = validatedBackup(JSON.parse(await field.files[0].text()));
      dialog('백업 기록 가져오기','<p>이 기기의 현재 기록을 백업 파일의 내용으로 바꿔요. 현재 기록을 보관하려면 먼저 내보내세요.</p><button class="btn primary block" type="button" data-action="restore">백업으로 복원</button>');
    } catch {
      notify('이 파일을 읽을 수 없어요. 로그바이블에서 내보낸 백업인지 확인해 주세요.');
    }
    field.value = '';
  }
});
function stepDisplay(button) {
  const key = button.dataset.displayStep;
  const setting = settings[key];
  const current = displayValue(key,state.display[key]);
  const value = displayValue(key,Number((current+Number(button.dataset.direction)*setting.step).toFixed(2)));
  if (current===value) return;
  state.display[key] = value;
  const group = button.closest('.reading-stepper');
  group.querySelector('output').textContent = value+' '+setting.unit;
  group.querySelector('[data-direction="-1"]').disabled = value<=setting.min;
  group.querySelector('[data-direction="1"]').disabled = value>=setting.max;
  applyDisplay();
  save();
}
function displayValue(key,value) {
  const setting = settings[key];
  const number = value === '' || value == null ? NaN : Number(value);
  return Number.isFinite(number) ? Math.max(setting.min,Math.min(setting.max,number)) : setting.initial;
}
function migrate(input) {
  const result = {...blank(),...input};
  result.commentaryEdition = localEditionId(input.commentaryEdition)?input.commentaryEdition:'';
  result.alignVerseAtTop = input.alignVerseAtTop!==false;
  const oldSize = {regular:17,large:20,largest:23};
  const oldFont = Object.hasOwn(oldSize,input.readingSize) ? oldSize[input.readingSize] : undefined;
  result.display = {};
  for (const key of Object.keys(settings)) {
    let value = input.display?.[key];
    if (value == null || value === '' || !Number.isFinite(Number(value))) {
      if (key === 'fontSize') value = oldFont;
      else if (key === 'fontSizeEn') value = input.display?.fontSize ?? 15;
      else if (key === 'fontSizeHe') value = input.display?.originalFontSize ?? 22;
      else if (key === 'fontSizeGrc') value = input.display?.originalFontSize ?? 20;
    }
    result.display[key] = displayValue(key,value);
  }
  result.theme = Object.hasOwn(themes,input.theme)?input.theme:'system';
  const legacyPalettes = {rose:'lavender',coral:'oat',linen:'oat',sage:'gray',navy:'slate'};
  result.palette = Object.hasOwn(palettes,input.palette)?input.palette:
    Object.hasOwn(legacyPalettes,input.palette)?legacyPalettes[input.palette]:'slate';
  result.fontChoice = Object.hasOwn(fontChoices,input.fontChoice)?input.fontChoice:'pretendard';
  result.fontKorean = input.fontKorean ?? input.fontChoice ?? 'pretendard';
  result.fontEnglish = (input.fontEnglish === 'custom' && customFonts.en) ? 'custom' : 'system';
  result.fontHebrew = (input.fontHebrew === 'custom' && customFonts.he) ? 'custom' : (input.fontHebrew === 'ezra' ? 'ezra' : 'system');
  result.fontGreek = (input.fontGreek === 'custom' && customFonts.grc) ? 'custom' : 'system';
  result.quickMarkers = Array.isArray(input.quickMarkers) && input.quickMarkers.length===3 ? input.quickMarkers : ['#e6bc43','#7cb668','#dc7d9c'];
  const menuOrder = Array.isArray(input.menuOrder) ? input.menuOrder.map(route=>({commentary:'calendar',original:'atlas'}[route] ?? route)).filter(route=>menuItems.has(route)) : [];
  result.menuOrder = [...new Set([...menuOrder,...menuItems.keys()])];
  if (!Object.hasOwn(editions,result.reader.edition)) result.reader.edition = Object.keys(editions)[0] ?? '';
  const {edition,book,chapter} = result.reader;
  if (edition && !data[edition]?.[book]?.[chapter]) result.reader = initialReader(edition);
  result.readingGoal = Number.isInteger(input.readingGoal) && input.readingGoal>=1 && input.readingGoal<=30?input.readingGoal:3;
  result.markerColor = validColor(input.markerColor)?input.markerColor:markerColors.gold;
  result.markerStyle = input.markerStyle==='double'?'solid':Object.hasOwn(markStyles,input.markerStyle)?input.markerStyle:'fill';
  for (const mark of Object.values(result.marks)) {
    if (!mark.underline) continue;
    if (mark.underline.style==='double') mark.underline = {...mark.underline,style:'solid'};
    delete mark.color;
    delete mark.highlight;
  }
  delete result.showCommentary;
  result.comparison = comparisonEditions(input.comparison,result.reader.edition);
  delete result.readingSize;
  for (const entry of Object.values(result.journal).flatMap(entry=>[entry,...(entry.notes ?? [])])) {
    if (typeof entry.reflection!=='string') {
      entry.reflection = Object.entries(parts)
        .filter(([key])=>entry[key]?.trim())
        .map(([key,label])=>label+'\n'+entry[key]).join('\n\n');
    }
    for (const key of Object.keys(parts)) delete entry[key];
  }
  return result;
}
const customFonts = { ko: null, he: null, grc: null, en: null };
function activateCustomFont(lang, name, family, face) {
  if (customFonts[lang]?.face) document.fonts.delete(customFonts[lang].face);
  document.fonts.add(face);
  customFonts[lang] = { name, family, face };
}
async function importCustomFont(file, lang = 'he') {
  if (importingFont) return;
  if (!/\.(ttf|otf|woff2?)$/i.test(file.name) || !file.size || file.size>24*1024*1024) {
    notify('24MB 이하의 TTF, OTF, WOFF 또는 WOFF2 글꼴 파일을 선택해 주세요.');
    return;
  }
  importingFont = true;
  render();
  try {
    const bytes = await file.arrayBuffer();
    const family = 'CustomFont_' + lang;
    const face = await new FontFace(family, bytes).load();
    const name = file.name.normalize('NFC').slice(0,100);
    await storeLocal('custom-font-' + lang, { name, bytes });
    activateCustomFont(lang, name, family, face);
    if (lang === 'ko') state.fontKorean = 'custom';
    else if (lang === 'he') state.fontHebrew = 'custom';
    else if (lang === 'grc') state.fontGreek = 'custom';
    else if (lang === 'en') state.fontEnglish = 'custom';
    if (await save()) {
      const labels = { ko: '한글 본문', he: '히브리어', grc: '헬라어', en: '영어' };
      notify((labels[lang] || '성경') + ' 글꼴로 [' + name + ']을(를) 적용했어요!');
    }
  } catch {
    notify('글꼴을 가져오지 못했어요. 파일 형식과 저장 공간을 확인해 주세요.');
  } finally {
    importingFont = false;
    applyDisplay();
    render();
  }
}

function applyDisplay() {
  const root = document.documentElement;
  const sizeKo = displayValue('fontSize',state.display.fontSize);
  const sizeEn = displayValue('fontSizeEn',state.display.fontSizeEn ?? sizeKo);
  const sizeHe = displayValue('fontSizeHe',state.display.fontSizeHe ?? state.display.originalFontSize ?? 22);
  const sizeGrc = displayValue('fontSizeGrc',state.display.fontSizeGrc ?? state.display.originalFontSize ?? 20);

  root.style.setProperty('--reading-size',sizeKo+'px');
  root.style.setProperty('--font-size-ko',sizeKo+'px');
  root.style.setProperty('--font-size-en',sizeEn+'px');
  root.style.setProperty('--font-size-he',sizeHe+'px');
  root.style.setProperty('--font-size-grc',sizeGrc+'px');
  root.style.setProperty('--original-reading-size',sizeHe+'px');
  const uiSize = Math.max(14,Math.min(24,16+(sizeKo-settings.fontSize.initial)*0.6));
  root.style.fontSize = uiSize+'px';
  root.style.setProperty('--ui-size-offset',(uiSize-16)+'px');
  root.dataset.palette = state.palette;

  const fontFamilies = {
    ko: {
      pretendard: 'Pretendard, -apple-system, sans-serif',
      paperlogy: 'Paperlogy, serif',
      notosanskr: 'NotoSansKR, sans-serif',
      system: '-apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", sans-serif',
      custom: customFonts.ko ? `"${customFonts.ko.family}", Pretendard, sans-serif` : 'Pretendard, sans-serif'
    },
    he: {
      ezra: '"Ezra SIL", "Ezra SIL SR", serif',
      system: 'system-ui, serif',
      custom: customFonts.he ? `"${customFonts.he.family}", "Ezra SIL", serif` : '"Ezra SIL", serif'
    },
    grc: {
      system: 'system-ui, serif',
      custom: customFonts.grc ? `"${customFonts.grc.family}", serif` : 'system-ui, serif'
    },
    en: {
      system: '-apple-system, BlinkMacSystemFont, serif',
      custom: customFonts.en ? `"${customFonts.en.family}", serif` : '-apple-system, BlinkMacSystemFont, serif'
    }
  };

  const koFont = (state.fontKorean === 'custom' && customFonts.ko)
    ? fontFamilies.ko.custom
    : (fontFamilies.ko[state.fontKorean] || fontFamilies.ko.pretendard);

  const enFont = (state.fontEnglish === 'custom' && customFonts.en)
    ? fontFamilies.en.custom
    : koFont;

  const heFont = (state.fontHebrew === 'custom' && customFonts.he)
    ? fontFamilies.he.custom
    : (state.fontHebrew === 'ezra')
      ? fontFamilies.he.ezra
      : `${koFont}, "Ezra SIL", system-ui, serif`;

  const grcFont = (state.fontGreek === 'custom' && customFonts.grc)
    ? fontFamilies.grc.custom
    : `${koFont}, system-ui, serif`;

  root.style.setProperty('--font-ko', koFont);
  root.style.setProperty('--sans', koFont);
  root.style.setProperty('--font-en', enFont);
  root.style.setProperty('--font-he', heFont);
  root.style.setProperty('--font-grc', grcFont);
  root.style.setProperty('--preferred-font', koFont);
  root.style.fontFamily = koFont;

  root.style.setProperty('--reading-leading',displayValue('lineHeight',state.display.lineHeight));
  root.style.setProperty('--verse-gap',displayValue('verseGap',state.display.verseGap)+'px');
  root.style.setProperty('--reading-tracking',displayValue('letterSpace',state.display.letterSpace)+'px');
  const dark = state.theme==='dark' || (state.theme==='system' && matchMedia('(prefers-color-scheme: dark)').matches);
  root.dataset.appearance = dark?'dark':'light';
  document.querySelector('meta[name=color-scheme]').content = dark?'dark':'only light';
  document.querySelector('meta[name=theme-color]').content = getComputedStyle(root).getPropertyValue('--paper').trim();
}
function displayFields() {
  return '<div class="reading-steppers">'+Object.entries(settings).map(([key,setting])=>{
    const value = displayValue(key,state.display[key]);
    return '<div class="reading-stepper" role="group" aria-label="'+setting.label+'"><strong>'+setting.label+'</strong><div class="stepper-controls">'+
      '<button class="step-button" type="button" data-display-step="'+key+'" data-direction="-1" aria-label="'+setting.label+' 줄이기" '+(value<=setting.min?'disabled':'')+'>−</button>'+
      '<output aria-label="'+setting.label+' 현재 값">'+value+' '+setting.unit+'</output>'+
      '<button class="step-button" type="button" data-display-step="'+key+'" data-direction="1" aria-label="'+setting.label+' 늘리기" '+(value>=setting.max?'disabled':'')+'>+</button></div></div>';
  }).join('')+'</div>';
}
function readingPreview() {
  return '<section class="reading-example"><div class="row"><h3>4개 언어 실시간 미리보기</h3><span class="live-chip">실시간 적용</span></div>'+
    '<div class="bible-passage preview-passage">'+
      '<div class="preview-lang-box">'+
        '<div class="row preview-lang-header"><span class="kicker">🇰🇷 한글</span><span class="muted" style="font-size:0.75rem;">시 23:1</span></div>'+
        '<p class="verse-copy" style="font-family:var(--font-ko); font-size:var(--font-size-ko, 15px); margin:2px 0;">여호와는 나의 목자시니 내게 부족함이 없으리로다</p>'+
      '</div>'+
      '<div class="preview-lang-box" style="margin-top:8px;">'+
        '<div class="row preview-lang-header"><span class="kicker">📜 히브리어 (구약 원어)</span><span class="muted" style="font-size:0.75rem;">시 23:1</span></div>'+
        '<p class="verse-copy" lang="he" dir="rtl" style="font-family:var(--font-he); font-size:var(--font-size-he, 22px); margin:2px 0;">יְהוָ֥ה רֹ֝עִ֗י לֹ֣א אֶחְסָֽר׃</p>'+
      '</div>'+
      '<div class="preview-lang-box" style="margin-top:8px;">'+
        '<div class="row preview-lang-header"><span class="kicker">🏛️ 헬라어 (신약 원어)</span><span class="muted" style="font-size:0.75rem;">요 1:1</span></div>'+
        '<p class="verse-copy" lang="grc" style="font-family:var(--font-grc); font-size:var(--font-size-grc, 20px); margin:2px 0;">Ἐν ἀρχῇ ἦν ὁ λόγος, καὶ ὁ λόγος ἦν πρὸς τὸν θεόν</p>'+
      '</div>'+
      '<div class="preview-lang-box" style="margin-top:8px;">'+
        '<div class="row preview-lang-header"><span class="kicker">📖 영어</span><span class="muted" style="font-size:0.75rem;">Ps 23:1</span></div>'+
        '<p class="verse-copy" lang="en" style="font-family:var(--font-en); font-size:var(--font-size-en, 15px); margin:2px 0;">The LORD is my shepherd; I shall not want.</p>'+
      '</div>'+
    '</div></section>';
}
function displaySettings() {
  const swatches = Object.entries(palettes).map(([id,label])=>
    '<label class="palette-option"><input type="radio" name="palette" value="'+id+'" '+(state.palette===id?'checked':'')+'>'+
    '<span class="palette-swatch" data-swatch="'+id+'" aria-hidden="true"></span><span>'+label+'</span></label>').join('');

  const koChips = [
    ['pretendard', '프리텐다드'],
    ['paperlogy', '페이퍼로지'],
    ['notosanskr', '노토 산스'],
    ['system', '기기 기본'],
    ...(customFonts.ko ? [['custom', customFonts.ko.name]] : [])
  ];
  const heChips = [
    ...(customFonts.he ? [['custom', customFonts.he.name]] : []),
    ['ezra', '에즈라 SIL'],
    ['system', '기기 기본']
  ];
  const grcChips = [
    ...(customFonts.grc ? [['custom', customFonts.grc.name]] : []),
    ['system', '기기 기본']
  ];
  const enChips = [
    ...(customFonts.en ? [['custom', customFonts.en.name]] : []),
    ['system', '기기 기본 (한글 글꼴과 동일)']
  ];

  const curKo = state.fontKorean || 'pretendard';
  const curHe = (state.fontHebrew === 'custom' && customFonts.he) ? 'custom' : (state.fontHebrew === 'ezra' ? 'ezra' : 'system');
  const curGrc = (state.fontGreek === 'custom' && customFonts.grc) ? 'custom' : 'system';
  const curEn = (state.fontEnglish === 'custom' && customFonts.en) ? 'custom' : 'system';

  const curKoLabel = koChips.find(([val]) => val === curKo)?.[1] || curKo;
  const curHeLabel = heChips.find(([val]) => val === curHe)?.[1] || curHe;
  const curGrcLabel = grcChips.find(([val]) => val === curGrc)?.[1] || curGrc;
  const curEnLabel = enChips.find(([val]) => val === curEn)?.[1] || curEn;

  const quickColors = state.quickMarkers || ['#e6bc43','#7cb668','#dc7d9c'];

  return '<div class="section-head"><h2>화면 테마</h2></div><section class="card stack appearance-settings">'+
    '<fieldset class="palette-field"><legend>색상 테마</legend><div class="palette-grid">'+swatches+'</div></fieldset>'+
    '<label class="field">화면 모드<select id="appearance">'+options(Object.entries(themes),state.theme)+'</select></label></section>'+

    '<div class="section-head"><h2>성경 및 언어별 글꼴</h2></div><section class="card stack reading-settings">'+

    '<div class="font-group-block">'+
      '<div class="row font-group-header">'+
        '<span class="font-group-label">🇰🇷 한글 본문 글꼴</span>'+
        '<span class="font-group-current">'+esc(curKoLabel)+'</span>'+
      '</div>'+
      '<div class="font-chip-grid">'+
        koChips.map(([val, label]) =>
          '<button type="button" class="font-chip '+(curKo===val?'active':'')+'" data-action="set-lang-font" data-lang="ko" data-lang-font="'+val+'">'+
          esc(label)+'</button>').join('')+
      '</div>'+
      '<div class="row" style="margin-top:4px;">'+
        '<button type="button" class="btn small" data-action="choose-font-ko">'+(customFonts.ko ? '한글 글꼴 변경' : '+ 한글 글꼴 파일 가져오기')+'</button>'+
        '<input id="custom-font-file-ko" type="file" accept=".ttf,.otf,.woff,.woff2" hidden>'+
      '</div>'+
    '</div>'+

    '<div class="font-group-block">'+
      '<div class="row font-group-header">'+
        '<span class="font-group-label">📜 히브리어 (구약 원어) 글꼴</span>'+
        '<span class="font-group-current">'+esc(curHeLabel)+'</span>'+
      '</div>'+
      '<div class="font-chip-grid">'+
        heChips.map(([val, label]) =>
          '<button type="button" class="font-chip '+(curHe===val?'active':'')+'" data-action="set-lang-font" data-lang="he" data-lang-font="'+val+'">'+
          esc(label)+'</button>').join('')+
      '</div>'+
      '<div class="row" style="margin-top:4px;">'+
        '<button type="button" class="btn small" data-action="choose-font-he">'+(customFonts.he ? '히브리어 글꼴 변경 (' + esc(customFonts.he.name) + ')' : '+ 히브리어 글꼴 파일(.ttf/.otf) 가져오기')+'</button>'+
        '<input id="custom-font-file-he" type="file" accept=".ttf,.otf,.woff,.woff2" hidden>'+
      '</div>'+
    '</div>'+

    '<div class="font-group-block">'+
      '<div class="row font-group-header">'+
        '<span class="font-group-label">🏛️ 헬라어 (신약 원어) 글꼴</span>'+
        '<span class="font-group-current">'+esc(curGrcLabel)+'</span>'+
      '</div>'+
      '<div class="font-chip-grid">'+
        grcChips.map(([val, label]) =>
          '<button type="button" class="font-chip '+(curGrc===val?'active':'')+'" data-action="set-lang-font" data-lang="grc" data-lang-font="'+val+'">'+
          esc(label)+'</button>').join('')+
      '</div>'+
      '<div class="row" style="margin-top:4px;">'+
        '<button type="button" class="btn small" data-action="choose-font-grc">'+(customFonts.grc ? '헬라어 글꼴 변경 (' + esc(customFonts.grc.name) + ')' : '+ 헬라어 글꼴 파일(.ttf/.otf) 가져오기')+'</button>'+
        '<input id="custom-font-file-grc" type="file" accept=".ttf,.otf,.woff,.woff2" hidden>'+
      '</div>'+
    '</div>'+

    '<div class="font-group-block">'+
      '<div class="row font-group-header">'+
        '<span class="font-group-label">📖 영어 성경 글꼴</span>'+
        '<span class="font-group-current">'+esc(curEnLabel)+'</span>'+
      '</div>'+
      '<div class="font-chip-grid">'+
        enChips.map(([val, label]) =>
          '<button type="button" class="font-chip '+(curEn===val?'active':'')+'" data-action="set-lang-font" data-lang="en" data-lang-font="'+val+'">'+
          esc(label)+'</button>').join('')+
      '</div>'+
      '<div class="row" style="margin-top:4px;">'+
        '<button type="button" class="btn small" data-action="choose-font-en">'+(customFonts.en ? '영문 글꼴 변경 (' + esc(customFonts.en.name) + ')' : '+ 영문 글꼴 파일(.ttf/.otf) 가져오기')+'</button>'+
        '<input id="custom-font-file-en" type="file" accept=".ttf,.otf,.woff,.woff2" hidden>'+
      '</div>'+
    '</div>'+

    '<p class="muted" style="margin-top:14px;">글자 크기, 줄 간격, 구절 간격을 조정하고 아래 실시간 미리보기에서 확인해 보세요.</p>'+
    displayFields()+readingPreview()+
    '<button class="text-action reset-reading" data-action="reset-display">본문 설정 초기화</button></section>'+
    '<div class="section-head"><h2>퀵 형광펜 설정</h2></div><section class="card stack quick-marker-settings">'+
    '<p class="muted">본문 구절 선택 시 바로 칠할 수 있는 3가지 동그라미 형광펜이에요. 동그라미를 누르면 원하는 색으로 바꿀 수 있어요.</p>'+
    '<div class="quick-marker-preset-row">'+
      quickColors.map((color, idx) =>
        '<label class="quick-marker-preset-pill">'+
          '<span class="preset-color-dot" style="background:'+color+';"></span>'+
          '<span class="preset-label">'+(idx + 1)+'번 형광펜</span>'+
          '<input type="color" data-action="set-quick-color" data-preset="'+idx+'" value="'+color+'">'+
        '</label>'
      ).join('')+
    '</div></section>';
}
function validColor(color) {
  return typeof color==='string' && /^#[a-f0-9]{6}$/i.test(color);
}
function verseMark(mark) {
  if (mark?.underline) return mark.underline;
  const color = mark?.highlight ?? markerColors[mark?.color];
  return color?{style:'fill',color}:undefined;
}
function verseAddress(key) {
  return key.slice(key.indexOf('/')+1);
}
function indexVerseMarkers() {
  const index = new Map();
  for (const [key,mark] of Object.entries(state.marks)) {
    if (!verseMark(mark)) continue;
    const address = verseAddress(key);
    const entry = index.get(address);
    if (!entry) index.set(address,{mark,keys:[key]});
    else {
      entry.keys.push(key);
      if ((mark.markDay ?? '')>=(entry.mark.markDay ?? '')) entry.mark = mark;
    }
  }
  return index;
}
function markedText(content,mark) {
  const appearance = verseMark(mark);
  let decoration = '';
  if (appearance && validColor(appearance.color)) {
    if (appearance.style==='fill') decoration = 'background-image:linear-gradient(transparent 18%,color-mix(in srgb,'+appearance.color+' 38%,transparent) 18% 82%,transparent 82%);';
    else if (Object.hasOwn(markStyles,appearance.style)) decoration =
      'text-decoration-line:underline;text-decoration-style:'+appearance.style+';text-decoration-color:'+appearance.color+';';
  }
  return '<span class="verse-copy"><span class="marked" style="'+decoration+'">'+esc(content)+'</span></span>';
}
function setVerseMark(key,appearance) {
  const mark = state.marks[key];
  if (mark) {
    delete mark.color;
    delete mark.highlight;
    delete mark.underline;
    delete mark.group;
    delete mark.markDay;
  }
  if (appearance?.style==='fill') updateMark(key,'highlight',appearance.color);
  else updateMark(key,'underline',appearance);
}
function applyVerseMarks(keys,appearance,message) {
  if (!keys.length) return;
  const markers = indexVerseMarkers();
  const selection = new Map(keys.map(key=>[verseAddress(key),key]));
  const affected = new Set();
  for (const [address,key] of selection) {
    affected.add(key);
    for (const existing of markers.get(address)?.keys ?? []) affected.add(existing);
  }
  lastMarkerEdit = [...affected].map(key=>[key,state.marks[key]?{...state.marks[key]}:undefined]);
  const group = newId(), markDay = dateKey();
  for (const [address,key] of selection) {
    const existing = markers.get(address);
    for (const duplicate of existing?.keys ?? []) setVerseMark(duplicate,undefined);
    if (appearance) {
      setVerseMark(key,appearance);
      Object.assign(state.marks[key],{group,markDay});
    }
  }
  chosen.clear();
  modal.close();
  save().then(saved=>{ if (saved) notify(message,'되돌리기','undo-marker'); });
  render();
}
function quickMarker() {
  const keys = [...chosen];
  const markers = indexVerseMarkers();
  if (keys.every(key=>markers.has(verseAddress(key)))) applyVerseMarks(keys,undefined,'말씀 표시를 지웠어요.');
  else applyVerseMarks(keys,{style:state.markerStyle,color:state.markerColor},'말씀 표시를 적용했어요.');
}
function setComparison(ids) {
  state.comparison = comparisonEditions(ids,state.reader.edition);
  chosen.clear();
  modal.close();
  save();
  render();
}
function showMarkDialog() {
  const first = chosen.values().next().value;
  const appearance = first && verseMark(indexVerseMarkers().get(verseAddress(first))?.mark);
  const initial = appearance?.color ?? state.markerColor;
  const quickColors = state.quickMarkers || ['#e6bc43','#7cb668','#dc7d9c'];
  dialog('말씀 표시','<p class="muted">선택한 '+chosen.size+'절에 한 가지 표시를 적용해요.</p>'+
    '<label class="field">표시 방식<select id="mark-style">'+options(Object.entries(markStyles),appearance?.style ?? state.markerStyle)+'</select></label>'+
    '<label class="field color-field">원하는 색<input type="color" id="mark-color" value="'+initial+'"></label>'+
    '<div class="quick-assign-block" style="margin-top:12px; padding:10px; background:var(--soft); border-radius:12px;">'+
      '<span class="muted" style="font-size:0.75rem; display:block; margin-bottom:6px;">현재 색상을 퀵 동그라미에 저장:</span>'+
      '<div class="row" style="gap:6px;">'+
        quickColors.map((c, i) =>
          '<button type="button" class="btn" data-action="save-to-quick" data-preset="'+i+'" style="font-size:0.8125rem; padding:5px 8px; flex:1;">'+
          '<span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:'+c+'; margin-right:4px;"></span>'+(i+1)+'번에 지정</button>'
        ).join('')+
      '</div>'+
    '</div>'+
    '<div class="row" style="margin-top:16px;"><button type="button" class="btn" data-action="erase-mark">표시 지우기</button><button type="button" class="btn primary" data-action="apply-mark">적용</button></div>');
}
function applyMark(erase = false) {
  if (erase) return applyVerseMarks([...chosen],undefined,'말씀 표시를 지웠어요.');
  const style = modal.querySelector('#mark-style').value;
  const color = modal.querySelector('#mark-color').value;
  state.markerStyle = style;
  state.markerColor = color;
  applyVerseMarks([...chosen],{style,color},'말씀 표시를 적용했어요.');
}
function newId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)),byte=>byte.toString(16).padStart(2,'0')).join('');
}
function validId(id) {
  return typeof id==='string' && /^[a-zA-Z0-9-]{1,80}$/.test(id);
}
function validVerseBundle(bundle) {
  return isObject(bundle) && validId(bundle.id) && validDay(bundle.day) &&
    Array.isArray(bundle.verses) && bundle.verses.length>0 && bundle.verses.every(verse=>
      isObject(verse) && validRef(verse.ref) && typeof verse.label==='string' && verse.label.length<=72 &&
      typeof verse.body==='string' && verse.body.length>0 && verse.body.length<=10000);
}
function validPrayer(item) {
  return isObject(item) && validId(item.id) && typeof item.title==='string' &&
    typeof item.body==='string' && typeof item.answer==='string' && typeof item.done==='boolean' && (item.day===undefined || validDay(item.day)) && (item.kind===undefined || item.kind==='thought');
}
function validYear(item) {
  return isObject(item) && validId(item.id) && Number.isInteger(item.year) && item.year>=1900 && item.year<=9999 &&
    typeof item.title==='string' && typeof item.note==='string' && Array.isArray(item.refs) && item.refs.every(validRef) && (item.day===undefined || validDay(item.day));
}
function thoughtsScreen() {
  const items = state.prayers.filter(item=>item.kind==='thought')
    .sort((a,b)=>(b.day ?? '').localeCompare(a.day ?? ''));
  const groups = new Map();
  for (const item of items) {
    const year = item.day?.slice(0,4) ?? '';
    if (!groups.has(year)) groups.set(year,[]);
    groups.get(year).push(item);
  }
  const list = [...groups].map(([year,notes])=>'<section class="thought-group"><header class="thought-group-header">'+
    '<h2>'+(year?year+'년':'날짜 미기록')+'</h2><span>'+notes.length+'건</span></header>'+
    notes.map(note=>thoughtCard(note,true)).join('')+'</section>').join('');
  return heading('THOUGHT NOTES','생각 노트','어떤 생각이든 자유롭게 적어보세요.')+
    '<button type="button" class="btn primary block thought-add" data-action="add-thought">＋ 생각 기록 추가</button><div class="thought-list">'+
    (list || '<p class="empty">아직 남긴 생각이 없어요.</p>')+'</div>';
}
function prayersScreen() {
  const groups = {open:[],answered:[]};
  for (const item of state.prayers) if (item.kind!=='thought') groups[item.done?'answered':'open'].push(item);
  const labels = {open:'기도 중',answered:'응답받음'};
  const current = groups[prayerFilter].sort((a,b)=>(b.day ?? '').localeCompare(a.day ?? ''));
  return heading('PRAYER JOURNAL','기도 노트','기도 제목과 응답을 남겨보세요.')+
    '<div class="prayer-overview" role="group" aria-label="기도 상태">'+Object.entries(labels).map(([key,label])=>
      '<button type="button" data-prayer-filter="'+key+'" aria-pressed="'+(prayerFilter===key)+'">'+
      '<span class="prayer-status-icon">'+icon(key==='open'?'prayer':'check')+'</span><span>'+label+'</span><strong>'+groups[key].length+'건</strong></button>').join('')+'</div>'+
    '<div class="row prayer-list-header"><h2>'+labels[prayerFilter]+'</h2><button class="btn primary" data-action="add-prayer">＋ 기도제목 추가</button></div>'+
    '<div class="prayer-list">'+(current.map(prayerCard).join('') || '<p class="empty">이곳에 남긴 기록이 아직 없어요.</p>')+'</div>';
}
function prayerCard(item) {
  if (item.kind==='thought') return thoughtCard(item);
  return '<article class="card prayer-record tappable-card">'+cardHit(item.done?'응답 기록 보기':'기도 응답 기록하기','data-prayer="'+item.id+'"')+'<div class="row prayer-record-meta"><span class="reading-badge">'+
    (item.done?'응답받음':'기도 중')+'</span>'+(item.day?'<time class="muted" datetime="'+item.day+'">'+
    item.day.slice(0,4)+'년 '+shortDate(item.day)+'</time>':'')+'</div>'+
    '<h3 class="item-title">'+esc(item.title)+'</h3>'+
    (item.body?'<p class="record-text">'+esc(item.body)+'</p>':'')+
    (item.answer?'<div class="answer"><strong>응답 기록</strong><p class="record-text">'+esc(item.answer)+'</p></div>':'')+
    calendarItemActions('data-prayer="'+item.id+'"','data-delete-prayer="'+item.id+'"')+'</article>';
}
function prayerScreen(id) {
  const item = state.prayers.find(prayer=>prayer.id===id);
  const thought = item?.kind==='thought';
  return heading(thought?'THOUGHT NOTES':'PRAYER JOURNAL',thought?'생각 기록':'기도 기록',
    thought?'남겨둔 생각을 다시 읽어보세요.':item?.done?'응답받음':'기도제목을 살펴봐요.')+
    '<div class="spaced">'+(item?prayerCard(item):'<p class="empty">이 기도제목을 찾을 수 없어요.</p>')+'</div>';
}
function editorField(label,name,value='',type='text',extra='') {
  const field = type==='textarea'
    ? '<textarea name="'+name+'" '+extra+'>'+esc(value)+'</textarea>'
    : '<input type="'+type+'" name="'+name+'" value="'+esc(value)+'" '+extra+'>';
  return '<label class="field">'+label+field+'</label>';
}
function draftNotice() {
  return '<div class="draft-notice" hidden><span data-draft-status role="status"></span>'+
    '<button type="button" class="text-action" data-action="discard-draft">임시 글 지우기</button></div>';
}
function readDraft(key) {
  if (sessionDrafts.has(key)) return sessionDrafts.get(key);
  try { return localStorage.getItem(key); } catch { return null; }
}
function storeDraft(key,value) {
  try {
    if (value===null) localStorage.removeItem(key);
    else localStorage.setItem(key,value);
    sessionDrafts.delete(key);
    return true;
  } catch {
    sessionDrafts.set(key,value);
    return false;
  }
}
function draftSnapshot(form) {
  const editor = draftEditors.get(form);
  return editor?JSON.stringify(editor.fields.map(field=>field.type==='checkbox'?field.checked:field.value)):null;
}
function applyDraftValues(editor,values) {
  editor.fields.forEach((field,index)=>{
    const value = values[index];
    if (field.type==='checkbox' && typeof value==='boolean') field.checked = value;
    else if (typeof value==='string') field.value = value;
    updateEditorDate(field);
    if (field.tagName==='TEXTAREA') resizeWriting(field);
  });
}
function showDraftStatus(editor,message) {
  if (!editor.status) return;
  editor.status.parentElement.hidden = !message;
  if (editor.status.textContent!==message) editor.status.textContent = message;
}
function prepareDraft(form,key,names) {
  const editor = {key:'로그바이블-draft/'+key,fields:names.map(name=>form.elements[name]).filter(Boolean),
    status:form.querySelector('[data-draft-status]')};
  draftEditors.set(form,editor);
  editor.baseline = draftSnapshot(form);
  const saved = editor.lastDraft = readDraft(editor.key);
  if (!saved) return;
  try {
    const values = JSON.parse(saved);
    if (!Array.isArray(values) || values.length!==editor.fields.length) return;
    applyDraftValues(editor,values);
    const answer = form.elements.answer;
    if (answer && (answer.value || form.elements.done.checked)) {
      form.querySelector('.post-response').open = true;
      resizeWriting(answer);
    }
    showDraftStatus(editor,sessionDrafts.has(editor.key)?'앱을 닫기 전까지만 임시 보관 중':'임시 글을 불러왔어요');
  } catch { /* Ignore a damaged draft. */ }
}
function updateDraft(form) {
  const editor = draftEditors.get(form);
  if (!editor) return;
  const value = draftSnapshot(form);
  if (value===editor.baseline) {
    if (readDraft(editor.key)===editor.lastDraft) storeDraft(editor.key,null);
    editor.lastDraft = null;
    showDraftStatus(editor,'');
  } else {
    editor.lastDraft = value;
    showDraftStatus(editor,storeDraft(editor.key,value)?'기기에 임시 저장됨':'앱을 닫기 전까지만 임시 보관 중');
  }
}
function discardDraft(form) {
  const editor = draftEditors.get(form);
  if (!editor) return;
  applyDraftValues(editor,JSON.parse(editor.baseline));
  if (readDraft(editor.key)===editor.lastDraft) storeDraft(editor.key,null);
  editor.lastDraft = null;
  showDraftStatus(editor,'');
  editor.fields[0]?.focus({preventScroll:true});
}
function finishDraft(form,snapshot) {
  const editor = draftEditors.get(form);
  if (editor && readDraft(editor.key)===snapshot) storeDraft(editor.key,null);
}
function editorActions(kind,item) {
  return '<div class="row">'+(item?'<button type="button" class="btn" data-delete="'+kind+'">삭제</button>':'')+
    '<button class="btn primary'+(item?'':' block')+'" type="button" data-action="save-'+kind+'">저장</button></div>';
}
function thoughtText(item) {
  return [item.title,item.body,item.answer].filter(Boolean).join('\n\n');
}
function thoughtCopy(item) {
  return '<div class="thought-copy">'+thoughtText(item).trim().split(/\r?\n[ \t]*(?:\r?\n)+/)
    .map(paragraph=>'<p>'+esc(paragraph)+'</p>').join('')+'</div>';
}
function thoughtCard(item,inList = false) {
  const date = inList && item.day?
    '<time class="thought-card-date" datetime="'+item.day+'">'+shortDate(item.day)+'</time>':'';
  return '<article class="card thought-card">'+date+thoughtCopy(item)+'<div class="row thought-card-footer">'+
    (inList?'':'<span class="muted">'+(item.day?longDate(item.day):'날짜 미기록')+'</span>')+
    calendarItemActions('data-prayer="'+item.id+'"','data-delete-prayer="'+item.id+'"')+'</div></article>';
}
function showThoughtEditor(item) {
  navigate('prayer-edit/'+(item?.id ?? 'thought'));
}
async function saveThought(form) {
  const field = form.elements.body, body = field.value.trim();
  if (!body) return notify('생각을 적어 주세요.');
  const previous = state.prayers;
  const id = form.dataset.thoughtEditor;
  const existing = previous.find(item=>item.id===id && item.kind==='thought');
  if (id!=='thought' && !existing) return;
  const draft = draftSnapshot(form);
  const item = {id:existing?.id ?? newId(),kind:'thought',title:'',body,answer:'',done:false};
  const day = form.elements.day.value;
  if (validDay(day)) item.day = day;
  state.prayers = existing?previous.map(entry=>entry===existing?item:entry):[item,...previous];
  const button = form.querySelector('.primary');
  button.disabled = true;
  field.readOnly = true;
  if (!await save()) {
    state.prayers = previous;
    button.disabled = false;
    field.readOnly = false;
    return;
  }
  finishDraft(form,draft);
  if (form.isConnected) {
    if (history.state?.qtPrevious) history.back();
    else {
      history.replaceState(null,'','#thoughts');
      render();
    }
  }
  notify('생각 노트에 저장했어요.');
}
function showPrayerEditor(item) {
  if (item?.kind==='thought') return showThoughtEditor(item);
  navigate('prayer-edit/'+(item?.id ?? 'new'),view==='calendar'?{returnFromEditor:true}:undefined);
}
function prayerEditorScreen(id) {
  const item = state.prayers.find(prayer=>prayer.id===id);
  if (!item && !['new','thought'].includes(id)) return '<p class="empty">이 기록을 찾을 수 없어요.</p>';
  if (id==='thought' || item?.kind==='thought') {
    return '<div class="post-editor thought-editor">'+writingHeader('note','생각 노트',item?'생각 노트 편집':'새 생각 노트')+
      '<form data-thought-editor="'+id+'"><div class="writing-panel">'+
      editorDateField(item?item.day ?? '':dateKey())+
      editorField('생각','body',item?thoughtText(item):'','textarea','rows="5" required placeholder="지금 떠오른 생각을 적어보세요."')+
      '</div>'+draftNotice()+'<footer><button class="btn" type="button" data-action="back">나가기</button><button class="btn primary" type="submit">저장</button></footer></form></div>';
  }
  return '<div class="post-editor prayer-editor">'+writingHeader('prayer','기도 노트',item?'기도와 응답 기록':'새 기도제목')+
    '<form data-prayer-editor="'+id+'"><div class="writing-panel">'+
    editorField('제목','title',item?.title,'text','required maxlength="150" placeholder="제목을 입력하세요"')+
    editorDateField(item?item.day ?? '':dateKey())+
    editorField('기도 내용','body',item?.body,'textarea','rows="5" placeholder="편하게 적어보세요."')+
    '</div><details class="post-response" '+(item?'open':'')+'><summary><span>'+icon('check')+'응답 기록</span>'+icon('down')+'</summary>'+
      '<label class="check-field"><input name="done" type="checkbox" '+(item?.done?'checked':'')+'> 응답받았어요</label>'+
      editorField('응답 내용','answer',item?.answer,'textarea','rows="3" placeholder="응답받은 이야기를 남겨보세요."')+'</details>'+
    draftNotice()+'<footer><button class="btn" type="button" data-action="back">나가기</button><button class="btn primary" type="submit">저장</button></footer></form></div>';
}
async function savePrayer(form) {
  const values = new FormData(form);
  const title = values.get('title').trim();
  if (!title) return notify('제목을 입력해 주세요.');
  const draft = draftSnapshot(form);
  const id = form.dataset.prayerEditor;
  const item = {id:id==='new'?newId():id,title,body:values.get('body').trim(),answer:values.get('answer').trim(),done:values.has('done')};
  const day = values.get('day');
  if (validDay(day)) item.day = day;
  const original = state.prayers;
  state.prayers = original.some(existing=>existing.id===item.id) ? original.map(existing=>existing.id===item.id?item:existing) : [item,...original];
  const button = form.querySelector('[type="submit"]');
  button.disabled = true;
  if (!await save()) {
    state.prayers = original;
    button.disabled = false;
    return;
  }
  finishDraft(form,draft);
  prayerFilter = item.done?'answered':'open';
  if (form.isConnected) {
    if(item.done)navigate('prayers');
    else if (history.state?.returnFromEditor) history.back();
    else {
      history.replaceState(history.state,'','#prayers');
      render();
    }
  }
  notify('기록을 저장했어요.');
}
function newYearScreen() {
  const years = [...new Set(state.newYear.map(item=>item.year))].sort((a,b)=>b-a);
  return devotionHeading('newyear')+
    '<div class="yearly-list">'+(years.map(year=>{
      const items = state.newYear.filter(item=>item.year===year);
      return '<section class="yearly-group" id="yearly-group-'+year+'"><header class="yearly-group-header row"><h2>'+year+'년</h2><span>'+items.length+
        '건</span></header>'+items.map(newYearCard).join('')+'</section>';
    }).join('') || '<p class="empty">구절 주소를 입력하거나 성경에서 구절을 골라 담아보세요.</p>')+'</div>';
}
function newYearCard(item) {
  return '<article class="card yearly-record"><header class="row yearly-card-top"><div>'+
    (item.day?'<time class="muted" datetime="'+item.day+'">'+
      (Number(item.day.slice(0,4))===item.year?'':item.day.slice(0,4)+'년 ')+shortDate(item.day)+'</time>':'')+
    (item.title && (!item.refs.length || item.title!==reference(item.refs[0]))?'<h3 class="item-title">'+esc(item.title)+'</h3>':'')+'</div>'+
    '<button type="button" class="icon-action" data-year-edit="'+item.id+'" aria-label="새해 말씀 편집" title="새해 말씀 편집">'+icon('edit')+'</button></header>'+
    item.refs.map(ref=>{const shown=yearDisplayReference(ref);return '<figure class="year-verse"><blockquote class="record-text" lang="'+(localLanguages[shown.edition] ?? 'ko')+'">'+esc(shown.body)+'</blockquote>'+
      '<figcaption><button type="button" class="note-link" data-visit="'+shown.key+'" '+(!shown.available?'disabled':'')+'><span>'+esc(reference(shown.key))+'</span>'+
      '<small>'+esc(shown.label)+'</small>'+icon('arrow')+'</button></figcaption></figure>';}).join('')+
    (item.note?'<div class="yearly-note"><span>메모</span>'+
      '<p class="record-text">'+esc(item.note)+'</p></div>':'')+'</article>';
}
let yearRefs = [];
function yearVerseKeys(query) {
  const range = query.normalize('NFKC').match(/^(.*?)\s*[-–~]\s*(\d+)\s*절?$/);
  const position = parseBibleReference(range?.[1] ?? query);
  const edition = state.reader.edition;
  if (!edition || !position?.book || !position.verse) return [];
  const {book,chapter,verse} = position;
  const last = range?Number(range[2]):verse;
  if (!validChapter(book+'/'+chapter) || last<verse || last>500) return [];
  const refs = Array.from({length:last-verse+1},(_,index)=>[edition,book,chapter,verse+index].join('/'));
  return refs.every(ref=>verseText(ref).trim())?refs:[];
}
function yearReferencePreview(item) {
  if (!yearRefs.length) return item?.title && !item.refs.length?
    '<p class="year-ref-legacy">'+esc(item.title)+'</p>':'';
  return yearRefs.map(ref=>{const shown=yearDisplayReference(ref);return '<article class="year-ref-preview"><div class="row"><span>'+
    esc(reference(shown.key))+' · '+esc(shown.label)+'</span>'+
    '<button type="button" class="text-action" data-remove-year-ref="'+ref+'" aria-label="'+
    esc(reference(ref))+' 제거">빼기</button></div><blockquote lang="'+(localLanguages[shown.edition] ?? 'ko')+'">'+esc(shown.body)+'</blockquote></article>';}).join('');
}
function renderYearReferences(form) {
  const item = state.newYear.find(entry=>entry.id===editId);
  form.querySelector('[data-year-ref-preview]').innerHTML = yearReferencePreview(item);
}
function addYearReference(form) {
  if (!form) return false;
  const field = form.elements.reference;
  const status = form.querySelector('[data-year-ref-status]');
  const refs = yearVerseKeys(field.value.trim());
  if (!refs.length) {
    status.textContent = state.reader.edition?'현재 번역본에서 찾을 수 있는 구절 주소를 입력해 주세요. 예: 시편 65:13':'먼저 성경 번역본을 추가해 주세요.';
    field.focus();
    return false;
  }
  yearRefs = [...new Set([...yearRefs,...refs])];
  field.value = '';
  status.textContent = '';
  renderYearReferences(form);
  return true;
}
function editorDateLabel(day) {
  if (!day) return '날짜 선택';
  const [year,month,number] = day.split('-').map(Number);
  return year+'. '+month+'. '+number+'.';
}
function editorDateField(day) {
  return '<label class="field">기록 날짜<span class="editor-date-control">'+
    '<span data-editor-date-value aria-hidden="true">'+editorDateLabel(day)+'</span>'+icon('calendar')+
    '<input type="date" name="day" value="'+esc(day)+'"></span></label>';
}
function updateEditorDate(field) {
  if (field.name!=='day') return;
  const label = field.parentElement?.querySelector('[data-editor-date-value]');
  if (label) label.textContent = editorDateLabel(field.value);
}
function showYearEditor(item,refs = []) {
  editId = item?.id;
  yearRefs = item?(item.refs.length?[...item.refs]:yearVerseKeys(item.title.split(/[|｜]/,1)[0].trim())):[...refs];
  const day = item?item.day ?? '':dateKey();
  dialog(item?'새해 말씀 편집':'새해 말씀 추가',
    '<div class="year-editor-dates">'+
    editorField('연도','year',item?.year ?? new Date().getFullYear(),'number','min="1900" max="9999" required')+
    editorDateField(day)+'</div>'+
    '<div class="year-ref-fields"><div class="year-ref-input">'+
    editorField('말씀 구절','reference','','text','maxlength="120" autocomplete="off" enterkeyhint="go" placeholder="예: 시편 65:13"')+
    '<button type="button" class="btn" data-action="add-year-reference">불러오기</button></div>'+
    '<p class="muted year-ref-status" data-year-ref-status role="status"></p>'+
    '<div class="year-ref-list" data-year-ref-preview>'+yearReferencePreview(item)+'</div></div>'+
    editorField('메모','note',item?.note,'textarea','rows="3" placeholder="기억하고 싶은 내용을 남겨보세요."')+
    '<footer class="year-editor-actions">'+editorActions('year',item)+'</footer>','year-editor');
  modal.querySelectorAll('form[name="year-editor"] textarea').forEach(resizeWriting);
}
function saveYear() {
  const form = modal.querySelector('form');
  if (!form.reportValidity()) return;
  if (form.elements.reference.value.trim() && !addYearReference(form)) return;
  const values = new FormData(form);
  const existing = state.newYear.find(item=>item.id===editId);
  if (!yearRefs.length && (!existing || existing.refs.length)) return notify('말씀 구절을 한 개 이상 골라 주세요.');
  const title = yearRefs.length?
    (existing?.refs.length && existing.title!==reference(existing.refs[0])?existing.title:reference(yearRefs[0])):existing.title;
  writeItem('newYear',{id:editId ?? newId(),year:Number(values.get('year')),title,note:values.get('note').trim(),refs:yearRefs,day:validDay(values.get('day'))?values.get('day'):undefined});
  chosen.clear();
  if (view==='bible') navigate('newyear');
  else render();
}
function writeItem(list,item) {
  const index = state[list].findIndex(existing=>existing.id===item.id);
  if (index===-1) state[list].unshift(item);
  else state[list][index] = item;
  modal.close();
  save();
}
function validComment(item) {
  return isObject(item) && validId(item.id) && typeof item.body==='string' &&
    typeof item.created==='string' && Number.isFinite(Date.parse(item.created));
}
let commentTarget;
function showCommentEditor(day,id) {
  const comment = journalEntry(day).comments?.find(item=>item.id===id);
  if (id && !comment) return;
  commentTarget = {day,comment};
  dialog(comment?'댓글 편집':'댓글 추가',
    editorField('댓글','comment',comment?.body,'textarea','required')+
    '<button type="button" class="btn primary" data-action="save-comment">댓글 저장</button>');
}
function saveComment() {
  const {day,comment} = commentTarget;
  const form = modal.querySelector('form');
  if (!form.reportValidity()) return;
  const body = new FormData(form).get('comment').trim();
  if (!body) return notify('코멘트를 입력해 주세요.');
  const entry = journalEntry(day);
  const comments = entry.comments ??= [];
  if (comment) {
    const index = comments.findIndex(item=>item.id===comment.id);
    if (index===-1) return;
    comments[index] = {...comment,body};
  } else comments.push({id:newId(),body,created:new Date().toISOString()});
  modal.close();
  save();
  render();
}
let pendingRemoval;
function confirmItemRemoval(kind,id,day) {
  const labels = {'journal-note':'묵상',journal:'묵상',prayer:state.prayers.some(item=>item.id===id && item.kind==='thought')?'생각 기록':'기도제목',comment:'댓글',year:'새해 말씀',note:'구절 메모',dailyNote:'말씀 묵상',bundle:'구절 모음'};
  const label = labels[kind];
  const details = kind==='journal'?'이 묵상의 내용, 댓글, 담아둔 구절과 QT 체크가 삭제돼요. 같은 날의 다른 묵상은 유지돼요.':
    kind==='prayer'?'이 게시글의 내용이 함께 삭제돼요.':kind==='note'?reference(id)+'에 남긴 메모를 삭제할까요?':'이 기록을 삭제할까요?';
  pendingRemoval = {kind,id,day,label,noteId:activeJournalId};
  dialog(label+' 삭제','<p>'+details+'</p><div class="row"><button class="btn" value="cancel">취소</button><button type="button" class="btn danger" data-action="delete-item">삭제 확인</button></div>');
}
async function removeItem() {
  if (!pendingRemoval) return;
  const {kind,id,day,label,noteId} = pendingRemoval;
  const [container,key] = kind==='journal'?[state.journal,id]:kind==='journal-note'?[state.journal[day],'notes']:
    kind==='dailyNote'?[state.dailyNotes,id]:kind==='comment'?[journalEntry(day,noteId),'comments']:kind==='note'?[state.marks,id]:
    [state,kind==='prayer'?'prayers':kind==='bundle'?'verseBundles':'newYear'];
  const previous = container?.[key];
  if (!previous) { modal.close(); return; }
  if (kind==='journal' && previous.notes?.length)container[key]={done:false,verses:[],notes:previous.notes};
  else if (kind==='journal' || kind==='dailyNote') delete container[key];
  else if (kind==='note') {
    container[key] = {...previous};
    updateMark(id,'note','');
    if (lastMarkerEdit?.some(([ref])=>ref===id)) lastMarkerEdit = undefined;
  } else container[key] = previous.filter(item=>item.id!==id);
  const confirm = modal.querySelector('[data-action="delete-item"]');
  confirm.disabled = true;
  if (await save()) {
    pendingRemoval = undefined;
    modal.close();
    if (view==='prayer' && kind==='prayer' && previous.some(item=>item.id===id && item.kind==='thought')) {
      if (history.state?.qtPrevious) history.back();
      else navigate('thoughts');
    } else if(view==='journal'&&(kind==='journal'||kind==='journal-note'))navigate('journals');
    else render();
    notify(label+'을 삭제했어요.');
  } else {
    container[key] = previous;
    confirm.disabled = false;
    modal.querySelector('p').textContent = '기기에 저장하지 못해 삭제를 취소했어요. 다시 시도해 주세요.';
  }
}

function resetRestoredAndroidSettings() {
  if (location.hash==='#settings' && /Android/i.test(navigator.userAgent) && matchMedia('(display-mode: standalone)').matches) {
    history.replaceState(null,'',location.pathname+location.search);
  }
}

matchMedia('(prefers-color-scheme: dark)').addEventListener('change',applyDisplay);
document.addEventListener('visibilitychange',()=>{
  if (document.hidden) return flushReadingBookmark();
  if ((view==='today' || view==='calendar') && renderedDailyDate!==dateKey()) render();
  refreshLocalEditions();
  checkGhAutoSync();
});
document.querySelector('.brand').addEventListener('click',event => {
  event.preventDefault();
  navigate('today');
});
window.addEventListener('hashchange',() => {
  if (activeRoute!==location.hash.slice(1)) render();
});
window.addEventListener('popstate',() => {
  if (activeRoute!==location.hash.slice(1)) render();
});
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
try { readingBookmark = localStorage.getItem(readingBookmarkKey) ?? ''; } catch { /* Use the current chapter. */ }
try {
  db = await openDB();
  const [saved,imported,fontLegacy,fontKo,fontHe,fontGrc,fontEn] = await Promise.all([
    loadLocal('journal'),readLocalEditions().catch(()=>({added:[]})),
    loadLocal('custom-font').catch(()=>null),
    loadLocal('custom-font-ko').catch(()=>null),
    loadLocal('custom-font-he').catch(()=>null),
    loadLocal('custom-font-grc').catch(()=>null),
    loadLocal('custom-font-en').catch(()=>null),
  ]);
  for (const edition of imported.added) registerLocalEdition(edition);
  state = migrate(saved ?? blank());

  if (fontKo) {
    try {
      const face = await new FontFace('CustomFont_ko', fontKo.bytes).load();
      activateCustomFont('ko', fontKo.name, 'CustomFont_ko', face);
    } catch {}
  }
  if (fontHe) {
    try {
      const face = await new FontFace('CustomFont_he', fontHe.bytes).load();
      activateCustomFont('he', fontHe.name, 'CustomFont_he', face);
    } catch {}
  }
  if (fontGrc) {
    try {
      const face = await new FontFace('CustomFont_grc', fontGrc.bytes).load();
      activateCustomFont('grc', fontGrc.name, 'CustomFont_grc', face);
    } catch {}
  }
  if (fontEn) {
    try {
      const face = await new FontFace('CustomFont_en', fontEn.bytes).load();
      activateCustomFont('en', fontEn.name, 'CustomFont_en', face);
    } catch {}
  }
  if (fontLegacy && !fontHe && !fontKo) {
    try {
      const lower = (fontLegacy.name || '').toLowerCase();
      const targetLang = (lower.includes('ezra') || lower.includes('sil') || lower.includes('heb')) ? 'he' :
                         (lower.includes('greek') || lower.includes('grc')) ? 'grc' : 'ko';
      const family = 'CustomFont_' + targetLang;
      const face = await new FontFace(family, fontLegacy.bytes).load();
      activateCustomFont(targetLang, fontLegacy.name, family, face);
      if (targetLang === 'he') state.fontHebrew = 'custom';
      else if (targetLang === 'grc') state.fontGreek = 'custom';
      else state.fontKorean = 'custom';
    } catch {}
  }
} catch {
  writeError = true;
}
resetRestoredAndroidSettings();
render();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).catch(() => {});
checkGhAutoSync();

let lastGhCheckTime = 0;
let isGhSyncing = false;
async function checkGhAutoSync() {
  if (isGhSyncing) return;
  const rawToken = localStorage.getItem('logbible-gh-token');
  const auto = localStorage.getItem('logbible-gh-auto') !== 'false';
  if (!rawToken || !auto) return;
  if (Date.now() - lastGhCheckTime < 2500) return;
  lastGhCheckTime = Date.now();
  isGhSyncing = true;
  refreshGhDevices();
  try {
    const rawRepo = ghCloudRepo;
    const rawUser = localStorage.getItem('logbible-gh-user')?.trim();
    if (!rawUser) return;

    const token = rawToken.trim().replace(/[^\x21-\x7E]/g, '');
    const repo = rawRepo.replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/i, '').trim();
    const user = rawUser.trim().replace(/\.json$/i, '').trim();

    let filePath = `${user}.json`;
    let encodedPath = encodeURIComponent(filePath);
    let url = `https://api.github.com/repos/${repo}/contents/${encodedPath}?_t=${Date.now()}`;
    let res = await fetch(url, {
      cache: 'no-store',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json'
      }
    });
    if (!res.ok && res.status === 404) {
      const listRes = await fetch(`https://api.github.com/repos/${repo}/contents?_t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github+json'
        }
      });
      if (listRes.ok) {
        const files = await listRes.json();
        const target = user.toLowerCase() + '.json';
        const match = Array.isArray(files) && files.find(f => f.name.toLowerCase() === target);
        if (match) {
          filePath = match.name;
          const correctUser = match.name.replace(/\.json$/i, '');
          localStorage.setItem('logbible-gh-user', correctUser);
          encodedPath = encodeURIComponent(filePath);
          url = `https://api.github.com/repos/${repo}/contents/${encodedPath}?_t=${Date.now()}`;
          res = await fetch(url, {
            cache: 'no-store',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/vnd.github+json'
            }
          });
        }
      }
    }
    if (!res.ok) return;
    const fileData = await res.json();
    const binary = atob(fileData.content.replace(/\s/g, ''));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const jsonStr = new TextDecoder().decode(bytes);
    const payload = JSON.parse(jsonStr);
    const remoteTime = payload?.data?.backup || '';
    const localTime = state?.backup || '';
    const nowStr = new Date().toLocaleString('ko-KR');
    localStorage.setItem('logbible-gh-last-sync', nowStr);

    if (remoteTime && (!localTime || remoteTime > localTime)) {
      const currentReader = {...state.reader};
      const currentComparison = Array.isArray(state.comparison) ? [...state.comparison] : [];
      const currentDisplay = {...state.display};
      const currentFonts = {
        fontKorean: state.fontKorean,
        fontHebrew: state.fontHebrew,
        fontGreek: state.fontGreek,
        fontEnglish: state.fontEnglish,
        fontChoice: state.fontChoice,
        palette: state.palette,
        theme: state.theme
      };
      const imported = validatedBackup(payload);
      state = imported;
      state.reader = currentReader;
      state.comparison = comparisonEditions(currentComparison, state.reader.edition);
      state.display = currentDisplay;
      Object.assign(state, currentFonts);
      lastMarkerEdit = undefined;
      pendingImport = undefined;
      await storeLocal('journal', state);
      applyDisplay();
      if (!document.activeElement?.matches('input, textarea')) {
        render();
      }
    }
  } catch {
    /* Silent background check */
  } finally {
    isGhSyncing = false;
  }
}

document.addEventListener('visibilitychange',()=>{
  if (document.hidden) markGhOffline();
  else { ghPageLeaving=false; refreshGhDevices(true); }
});
window.addEventListener('pagehide',()=>{ ghPageLeaving=true; markGhOffline(); });
window.addEventListener('pageshow',()=>{ ghPageLeaving=false; refreshGhDevices(true); });
window.addEventListener('focus', checkGhAutoSync);
setInterval(() => {
  const devicePanel = document.getElementById('gh-device-list');
  if (devicePanel && !document.hidden) {
    devicePanel.innerHTML = ghDeviceMarkup();
    refreshGhDevices();
  }
  if (!document.hidden) checkGhAutoSync();
}, 7000);

main.addEventListener('input', event => {
  const target = event.target;
  if (target.id === 'gh-token-input' || target.id === 'gh-user-input') {
    clearTimeout(ghDeviceInputTimer);
    ghDeviceInputTimer = setTimeout(() => refreshGhDevices(true), 700);
  }
  if (target.id === 'gh-token-input') localStorage.setItem('logbible-gh-token', target.value.trim().replace(/[^\x21-\x7E]/g, ''));
  if (target.id === 'gh-user-input') localStorage.setItem('logbible-gh-user', target.value.trim().replace(/\.json$/i, '').trim());
});
