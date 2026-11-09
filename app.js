import { books, chapterCounts } from './books.js';
import { bdbSizeSupported, editionKind, editionName, readBdb } from './bdb.js?v=36';

const icons = {
  book:'<path d="M12 6c-3-2-6-2-9-1v14c3-1 6-1 9 1 3-2 6-2 9-1V5c-3-1-6-1-9 1zm0 0v14"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18m-13 5h2m4 0h2"/>',
  folder:'<path d="M3 6h7l2 2h9v12H3z"/><path d="M8 13h8m-8 3h5"/>',
  settings:'<circle cx="12" cy="12" r="3"/><path d="m9 3-.5 3-2 1-3-.5-1.5 3 2 2v2l-2 2 1.5 3 3-.5 2 1 .5 3h4l.5-3 2-1 3 .5 1.5-3-2-2v-2l2-2-1.5-3-3 .5-2-1-.5-3z" transform="translate(1 -1)"/>',
  prayer:'<path d="M12 21c-4-3-8-6-8-11a4 4 0 0 1 8-1 4 4 0 0 1 8 1c0 5-4 8-8 11z"/>',
  marker:'<path d="m7 13 7-8a2 2 0 0 1 3 0l2 2a2 2 0 0 1 0 3l-8 7m-4-4 4 4m-4-4-3 4 3 3 4-3M3 21h7"/>',
  compare:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M12 5v14"/>',
  search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
  comment:'<path d="M20 11a7 7 0 0 1-7 7H7l-4 3v-9a7 7 0 0 1 7-7h3a7 7 0 0 1 7 6Z"/><path d="M8 11h7m-7 3h4"/>',
  note:'<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h4M9 12h6m-6 4h5"/>',
  copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 4H6a2 2 0 0 0-2 2v10"/>',
  left:'<path d="m15 5-7 7 7 7"/>',
  edit:'<path d="m4 16 11-11 4 4L8 20H4v-4Zm9-9 4 4"/>',
  right:'<path d="m9 5 7 7-7 7"/>',
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
const titles = Object.fromEntries(books);
const testamentByBook = Object.fromEntries(books.map(([book],index)=>[book,index<39?'old':'new']));
const retiredEditions = {krv:'개역한글',web:'WEB (영어)'};
const editions = {};
const commentaries = {}, originals = {}, dictionaries = {};
const studySelection = {commentary:{},original:{}};
let bibleSearchScope = 'all';
let bibleSearchResults;
const searchScopeLabels = {all:'전체 성경',old:'구약',new:'신약'};
const selectedSearchVerses = new Set();
let readerSwipe, ignoreReaderSwipeClickUntil = 0;
const localLanguages = {};
let importMessage = '', importingEditions = false, deletingEdition = false, chapterCheckBusy = false;
const colors = {gold:'노랑',sage:'연두',rose:'분홍'};
const markerColors = {gold:'#e6bc43',sage:'#7cb668',rose:'#dc7d9c',blue:'#6d9ddf'};
let lastMarkerEdit, markerHold, markerPointer, ignoreMarkerClick = 0;
const settings = {
  fontSize:{label:'글자 크기',min:12,max:48,step:1,unit:'px',initial:17},
  lineHeight:{label:'줄 간격',min:1.2,max:3,step:.05,unit:'배',initial:1.85},
  verseGap:{label:'구절 사이 간격',min:0,max:48,step:1,unit:'px',initial:8},
  letterSpace:{label:'글자 사이 간격',min:-1,max:5,step:.1,unit:'px',initial:0},
};
const themes = {system:'시스템 설정',light:'라이트',dark:'다크'};
const palettes = {slate:'미스트 블루',lavender:'모브 그레이',oat:'오트 베이지',gray:'라이트 그레이'};
const fontChoices = {pretendard:'프리텐다드',system:'기기 기본 글꼴',custom:'가져온 글꼴'};
let customFont, importingFont = false;
const markStyles = {fill:'형광펜',solid:'실선',wavy:'물결선',dashed:'점선'};
const parts = {morning:'아침 묵상',daytime:'하루 중 떠오른 생각',evening:'밤에 다시 돌아보기',question:'아직 남은 질문'};
const data = {};
const chosen = new Set();
let pickingIndividualVerses = false;
const blank = () => ({journal:{},dailyNotes:{},dailyVerses:{},marks:{},reader:{edition:'',book:'JHN',chapter:1},backup:'',display:{},theme:'system',palette:'slate',fontChoice:'pretendard',menuOrder:[...menuItems.keys()],markerColor:markerColors.gold,markerStyle:'fill',comparison:[],chapterLog:{},readingGoal:3,readingRange:null,editionLabels:{},prayers:[],newYear:[],verseBundles:[]});
let state = blank(), db, writeError = false;
let view, selectedDay = dateKey(), month = selectedDay.slice(0,7), filter = 'all', keyword = '';
const recordSelection = {edition:'',book:'',year:''};
const recordPickerLabels = {edition:['번역본','모든 번역본'],book:['성경','모든 성경'],year:['연도','모든 연도']};
let renderedDailyDate;
const dailyNoteLimit = 20000;
let verseArrivalTimer, arrivedVerse;
let toastTimer, jumpTo, activeRoute, prayerFilter = 'open', editId, trackerBook, editingVerseNote;

function dateKey(date = new Date()) {
  return [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
}
function longDate(key) {
  return new Intl.DateTimeFormat('ko-KR',{month:'long',day:'numeric',weekday:'long'}).format(new Date(key+'T12:00:00'));
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
  localLanguages[edition.id] = /[가-힣]/.test(edition.verses.GEN?.[1]?.[1] ?? '')?'ko':'en';
}
function localEditionId(id) {
  return /^local-[0-9a-f]{16}$/.test(id);
}
function editionLabel(id) {
  return editions[id] ?? retiredEditions[id] ?? state.editionLabels[id] ?? '가져온 역본';
}
function importPanel() {
  const installed = installedEditionIds().map(id=>{
    const bible = Object.hasOwn(editions,id);
    const label = editions[id] ?? commentaries[id]?.label ?? originals[id]?.label ?? dictionaries[id]?.label;
    const title = bible?'<button type="button" data-read-edition="'+id+'">'+esc(label)+' · 읽기 '+icon('arrow')+'</button>':
      '<span>'+esc(label)+' · '+(commentaries[id]?'주석':dictionaries[id]?'원어사전':'원어')+'</span>';
    return '<li>'+title+'<button type="button" class="text-action destructive" data-remove-edition="'+id+
      '" aria-label="'+esc(label)+' 파일 삭제" '+(importingEditions || deletingEdition?'disabled':'')+'>삭제</button></li>';
  });
  return '<div class="section-head"><h2 id="local-library-heading" tabindex="-1">내 성경 자료</h2></div><section class="card stack local-editions">'+
    '<p>사용할 성경 번역본 파일(.bdb)을 추가해 주세요. 주석(.cdb), 원전분해(.sdb), 원어사전(.dct) 파일도 추가할 수 있어요. 가져온 파일은 이 기기에 저장돼요.</p>'+
    '<button class="btn primary" data-action="choose-bdb" '+(importingEditions || deletingEdition?'disabled':'')+'>'+(importingEditions?'읽는 중…':'성경 번역본·자료 추가')+'</button>'+
    '<input id="bdb-files" type="file" accept=".bdb,.cdb,.sdb,.dct,application/vnd.sqlite3,application/x-sqlite3,application/octet-stream" multiple hidden>'+
    '<p id="bdb-status" class="muted" role="status">'+esc(importMessage)+'</p>'+
    (installed.length?'<ul class="installed-editions">'+installed.join('')+'</ul>':'')+'</section>';
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
    if (view==='today' || view==='calendar') render();
    if (view==='settings') render();
    else notify('성경 파일 처리가 끝났어요. 설정에서 결과를 확인할 수 있어요.');
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
async function save() {
  const status = document.querySelector('#save-status');
  if (status) status.textContent = '저장 중…';
  try {
    if (!db) throw Error('storage unavailable');
    await storeLocal('journal',state);
    writeError = false;
    if (status?.isConnected) status.textContent = '기기에 자동 저장';
    return true;
  } catch {
    writeError = true;
    if (status?.isConnected) status.textContent = '저장 실패 · 백업을 내보내세요';
    notify('기기에 저장하지 못했어요. 백업 파일을 내보낼 수 있어요.');
    return false;
  }
}
function navigate(screen, context) {
  const hash = '#'+screen;
  if (location.hash!==hash) history.pushState({qtPrevious:true,...context},'',hash);
  render();
}
function goBack() {
  if (history.state?.qtPrevious) return history.back();
  const fallback = {thoughts:'today',journal:'calendar',calendar:'records',prayers:'records',newyear:'records',prayer:'prayers','prayer-edit':'prayers',reading:'records',search:'bible',commentary:'bible',original:'bible'};
  history.replaceState(null,'','#'+(fallback[view] ?? 'today'));
  render();
}
function journalDate(hash) {
  const day = hash.startsWith('journal/') ? hash.slice(8) : '';
  return validDay(day)?day:'';
}
function validDay(day) {
  return typeof day==='string' && /^\d{4}-\d{2}-\d{2}$/.test(day) && dateKey(new Date(day+'T12:00:00'))===day;
}
const heading = (label,title,sub) => '<div class="eyebrow">'+label+'</div><h1>'+title+'</h1><p class="lead">'+sub+'</p>';
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
  const {edition,book,chapter} = readRef(key);
  swapComparison(edition);
  state.reader = {edition,book,chapter};
  chosen.clear();
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
  setReader(key);
  jumpTo = 'v-'+verse;
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
  const source = data[edition];
  const available = [];
  for (const [book] of books) {
    for (const [chapter,verses] of Object.entries(source?.[book] ?? {})) {
      for (const [verse,body] of Object.entries(verses)) {
        if (body) available.push([edition,book,chapter,verse].join('/'));
      }
    }
  }
  if (!available.length) return;
  let hash = 2166136261;
  for (const char of day) hash = Math.imul(hash ^ char.charCodeAt(0),16777619);
  return available[(hash>>>0)%available.length];
}
function rememberDailyVerse(day) {
  const edition = state.reader.edition;
  if (!edition) return;
  const saved = state.dailyVerses[day];
  const previousRef = saved?.wholeBible ? saved.ref : undefined;
  const matchingRef = previousRef && edition+previousRef.slice(previousRef.indexOf('/'));
  const ref = matchingRef && verseText(matchingRef)?matchingRef:dailyVerse(day,edition);
  if (!ref || !validRef(ref)) return;
  const body = verseText(ref);
  const label = editionLabel(edition);
  if (saved?.wholeBible && saved.ref===ref && saved.body===body && saved.label===label) return;
  state.dailyVerses[day] = {ref,body,label,wholeBible:true};
  if (db) save();
}
function journalEntry(key) {
  return state.journal[key] ??= {done:false,verses:[]};
}
function hasJournalContent(entry) {
  return Boolean(entry.done || entry.title?.trim() || entry.reflection?.trim() || entry.verses.length || entry.comments?.length);
}
function journalScreen() {
  const day = selectedDay;
  const entry = state.journal[day] ?? {verses:[]};
  const refs = entry.verses.map(ref => '<div class="post-quote"><div class="row"><button class="note-link" data-visit="'+ref+'">'+esc(reference(ref))+' · '+esc(editionLabel(readRef(ref).edition))+'</button>'+
    '<button class="text-action" data-remove="'+ref+'" data-date="'+day+'" aria-label="묵상에서 '+esc(reference(ref))+' 빼기">빼기</button></div><p>'+esc(savedVerseText(ref))+'</p></div>').join('');
  const date = new Intl.DateTimeFormat('ko-KR',{year:'numeric',month:'long',day:'numeric',weekday:'long'}).format(new Date(day+'T12:00:00'));
  return '<article class="post-editor journal-editor"><header><p class="eyebrow">QT JOURNAL</p><h1>나의 묵상</h1>'+
    '<div class="row post-meta"><time datetime="'+day+'">'+esc(date)+'</time><span id="save-status" class="save">'+(writeError?'저장 실패':'기기에 자동 저장')+'</span></div></header>'+
    '<div class="journal-editor-fields">'+refs+
    editorField('제목','title',entry.title,'text','aria-label="묵상 제목" data-journal-field="title" maxlength="150" placeholder="제목을 입력하세요 (선택)"')+
    editorField('묵상 내용','reflection',entry.reflection,'textarea','aria-label="묵상 본문" data-journal-field="reflection" rows="10" placeholder="마음에 남은 말씀과 생각을 적어보세요."')+
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
function dailyVerseQuote(key) {
  const quote = verseText(key);
  return (quote?'<blockquote>'+esc(quote)+'</blockquote>':'<p class="muted">이 구절의 번역본을 가져오면 본문을 볼 수 있어요.</p>')+
    '<p class="ref">'+esc(reference(key))+' · '+esc(editionLabel(readRef(key).edition))+'</p>'+
    (quote?'<button type="button" class="btn" data-visit="'+key+'">본문에서 읽기 '+icon('arrow')+'</button>':'');
}
function dailyNoteFields(day, note) {
  return editorField('묵상 내용','body',note?.body,'textarea','rows="7" maxlength="'+dailyNoteLimit+'" required placeholder="말씀을 읽고 마음에 남은 생각을 적어보세요."')+
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
function showDailyNote(day = dateKey()) {
  const note = state.dailyNotes[day];
  const saved = state.dailyVerses[day];
  const key = note?.ref ?? saved?.ref;
  if (!key) return;
  const quote = saved?.ref===key?saved.body:verseText(key);
  dialog('말씀 묵상 노트','<div class="daily-note-context">'+
    '<p class="ref">'+esc(reference(key))+' · '+esc(editionLabel(readRef(key).edition))+'</p>'+
    (quote?'<blockquote>'+esc(quote)+'</blockquote>':'')+'</div>'+dailyNoteFields(day,note));
  const form = modal.querySelector('form');
  form.classList.add('daily-note-dialog');
  form.dataset.dailyNote = day;
  form.dataset.ref = key;
}
async function saveDailyNote(form) {
  const day = form.dataset.dailyNote, ref = form.dataset.ref;
  const field = form.elements.body, body = field.value.trim();
  if (!body) return notify('묵상을 적어 주세요.');
  if (!validDay(day) || !validRef(ref)) return;
  const previous = state.dailyNotes[day];
  const entry = {ref,body};
  state.dailyNotes[day] = entry;
  const submit = form.querySelector('[type="submit"]');
  submit.disabled = true;
  field.readOnly = true;
  if (await save()) {
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
function todayScreen() {
  const today = dateKey(), reader = state.reader;
  const {ref:key,body:quote,label} = state.dailyVerses[today] ?? {};
  const note = state.dailyNotes[today];
  const noteButton = note || quote
    ? '<button class="hero-note-button" type="button" data-action="open-today-note" aria-haspopup="dialog">'+
      icon('comment')+(note?'묵상 보기':'묵상하기')+'</button>'
    : '';
  const journal = state.journal[today];
  const read = state.chapterLog[today]?.length || journalChapters(journal).size;
  const badge = label => '<span class="today-done">'+icon('check')+label+'</span>';
  return '<div class="welcome"><div class="eyebrow"><span></span> 나의 QT 노트</div><h1>오늘의 QT</h1><p class="date-tag">'+icon('calendar')+longDate(today)+'</p></div>'+
    (key?'<section class="hero tappable-card">'+cardHit('오늘의 말씀 본문 읽기',verseText(key)?'data-visit="'+key+'"':'data-action="open-today-note"')+'<div class="kicker"><span aria-hidden="true">✦</span> 오늘의 말씀</div><blockquote>'+esc(quote)+'</blockquote><p class="ref">'+esc(reference(key))+' · '+esc(label)+'</p><div class="hero-actions">'+
      '<span class="card-arrow" aria-hidden="true">'+icon('arrow')+'</span>'+noteButton+'</div></section>':
      '<section class="hero tappable-card">'+cardHit('성경 번역본 추가','data-nav="settings"')+'<div class="kicker"><span aria-hidden="true">✦</span> 내 성경</div><blockquote>사용할 성경 번역본 파일을 추가해 주세요.</blockquote><div class="hero-actions"><span class="card-arrow" aria-hidden="true">'+icon('arrow')+'</span>'+noteButton+'</div></section>')+
    '<div class="today-links">'+(reader.edition?'<div class="card row continue tappable-card'+(read?' is-done':'')+'">'+cardHit('이어서 읽기','data-nav="bible"')+
      '<div class="continue-label"><span class="tile-icon">'+icon('book')+'</span><div><div class="eyebrow">이어서 읽기</div><h3>'+titles[reader.book]+' '+reader.chapter+'장</h3>'+(read?badge('오늘 읽음'):'')+'</div></div><span class="card-arrow" aria-hidden="true">'+icon('arrow')+'</span></div>':'')+
    '<section class="card row today-journal tappable-card'+(journal?.done?' is-done':'')+'">'+cardHit('오늘의 묵상 열기','data-nav="journal/'+today+'"')+
      '<div class="continue-label"><span class="tile-icon">'+icon('comment')+'</span><div><div class="eyebrow">QT JOURNAL</div><h3>오늘의 묵상</h3>'+(journal?.done?badge('QT 완료'):'')+'</div></div><span class="card-arrow" aria-hidden="true">'+icon('arrow')+'</span></section>'+
    '<section class="card row today-thoughts tappable-card">'+cardHit('생각 노트 열기','data-nav="thoughts"')+
      '<div class="continue-label"><span class="tile-icon">'+icon('note')+'</span><div><h3>생각 노트</h3><p class="muted">자유롭게 남기는 생각</p></div></div><span class="card-arrow" aria-hidden="true">'+icon('arrow')+'</span></section></div>';
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
  const verse = '<button id="'+(secondary?'compare-v-'+edition+'-':'v-')+num+'" class="verse'+(secondary?' verse-support':'')+'" data-verse="'+key+'" lang="'+(localLanguages[edition] ?? 'ko')+'" aria-pressed="'+chosen.has(key)+'">'+
    '<span class="number">'+(secondary?'':num)+'</span><span class="verse-content">'+(secondary?'<span class="comparison-edition">'+esc(editionLabel(edition))+'</span>':'')+markedText(content,marker)+'</span></button>';
  return mark?.note?'<div class="verse-with-note">'+verse+
    '<button type="button" class="verse-note-icon" data-edit-verse-note="'+key+'" aria-label="'+num+'절 메모 보기">'+icon('note')+'</button></div>':verse;
}
function readerScreen() {
  const {edition,book,chapter} = state.reader;
  if (!edition) return '<section class="card stack spaced"><p>사용할 성경 번역본 파일을 추가해 주세요.</p><button class="btn primary" data-nav="settings">성경 번역본 추가</button></section>';
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
    return '<div class="verse-pair">'+first+alternatives.join('')+'</div>';
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
    '<div class="passage-title"><strong>'+titles[book]+' '+chapter+'장</strong><span>'+[edition,...comparison].map(editionLabel).map(esc).join(' · ')+'</span></div>'+
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
function showReaderSearch() {
  topBar.classList.add('search-open');
  readerSearchInput.value = '';
  readerSearchInput.hidden = false;
  readerSearchClose.hidden = false;
  readerSearchButton.setAttribute('aria-expanded','true');
  readerSearchButton.setAttribute('aria-label','검색 실행');
  readerSearchInput.focus();
}
function closeReaderSearch(restoreFocus = false) {
  bibleSearchScope = 'all';
  if (modal.open && ['search-scope','search-selected'].includes(modal.firstElementChild?.name)) modal.close();
  topBar.classList.remove('search-open');
  readerSearchInput.value = '';
  readerSearchInput.hidden = true;
  readerSearchClose.hidden = true;
  clearReaderSearchResults();
  readerSearchButton.setAttribute('aria-expanded','false');
  readerSearchButton.setAttribute('aria-label','성경 검색 열기');
  if (restoreFocus) readerSearchButton.focus({preventScroll:true});
}
function clearReaderSearchResults() {
  bibleSearchResults = undefined;
  selectedSearchVerses.clear();
  readerSearchPanel.hidden = true;
  readerSearchPanel.innerHTML = '';
}
function searchResultRow(key,canSelect) {
  const title = esc(reference(key));
  const checkbox = canSelect?'<label class="search-result-check"><input type="checkbox" data-search-select="'+key+'" aria-label="'+
    title+' 선택" '+(selectedSearchVerses.has(key)?'checked':'')+'></label>':'';
  return '<div class="search-result-row"><button type="button" class="record-open search-result" data-search-visit="'+key+'">'+
    '<strong>'+title+'</strong><span>'+esc(verseText(key))+'</span></button>'+checkbox+'</div>';
}
function readerSearchResults(page = 0) {
  if (!bibleSearchResults) return '';
  const {keys,bookStart,reference:isReference} = bibleSearchResults;
  const fontSize = displayValue('fontSize',state.display.fontSize);
  const panelHeight = Math.min(window.innerHeight*.68,620);
  const pageSize = Math.max(1,Math.floor((panelHeight-155-(bookStart?50:0))/(fontSize*3.95+13)));
  const pages = Math.ceil(keys.length/pageSize);
  page = Math.min(page,Math.max(0,pages-1));
  const visible = keys.slice(page*pageSize,(page+1)*pageSize);
  const count = (bookStart?'본문 검색 결과 ':'검색 결과 ')+keys.length.toLocaleString('ko-KR')+'개'+(pages?' · '+(page+1)+' / '+pages+'페이지':'');
  const pager = pages>1 ? '<div class="reader-search-pages" role="group" aria-label="검색 결과 페이지">'+
    '<button type="button" class="btn" data-search-page="'+(page-1)+'" data-search-direction="previous" '+(!page?'disabled':'')+'>이전</button>'+
    '<button type="button" class="btn" data-search-page="'+(page+1)+'" data-search-direction="next" '+(page+1>=pages?'disabled':'')+'>다음</button></div>' : '';
  const scope = isReference?'':'<button type="button" class="btn" data-action="pick-search-scope" aria-haspopup="dialog">범위 · '+
    esc(searchScopeLabels[bibleSearchScope] ?? titles[bibleSearchScope])+'</button>';
  const selectedCount = selectedSearchVerses.size;
  const collect = !isReference && (keys.length || selectedCount)?'<button type="button" class="btn" data-action="view-search-selection" '+
    'aria-haspopup="dialog" '+(selectedCount?'':'disabled')+'>모아 보기 ('+selectedCount+')</button>':'';
  const bookLink = bookStart?'<div class="reader-search-book-start"><button type="button" class="btn" data-search-book-start="'+
    bookStart+'">'+esc(titles[readRef(bookStart).book])+' 책 열기 '+icon('arrow')+'</button></div>':'';
  return '<section class="reader-search-group"><div class="reader-search-toolbar"><h3>'+count+
    '</h3><div class="reader-search-actions">'+scope+collect+'</div></div>'+bookLink+pager+'<div class="reader-search-list">'+
    (visible.map(key=>searchResultRow(key,!isReference)).join('') ||
      '<p class="muted">'+(bookStart?'본문에 일치하는 구절이 없어요.':'검색 결과가 없어요.')+'</p>')+'</div></section>';
}
function submitReaderSearch() {
  const query = readerSearchInput.value.trim();
  bibleSearchResults = query ? searchBible(state.reader.edition,query) : undefined;
  updateReaderSearch();
}
function updateReaderSearch(page = 0) {
  if (readerSearchInput.hidden || readerSearchForm.hidden) return;
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
    bookPickerSections(books.filter(([book])=>source?.[book]),bibleSearchScope,attribute),'search-scope');
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
  visit(key);
}
function showChapterJump() {
  const {book,source,selection} = bookPickerContext();
  const chapter = selection?.location?.chapter ?? state.reader.chapter;
  const chapters = Object.keys(source?.[book] ?? {});
  if (!chapters.length) return;
  dialog(esc(titles[book])+' · 장·절 이동','<label class="field">이동할 장·절'+
    '<input name="chapter" type="text" enterkeyhint="go" maxlength="20" placeholder="예: 12, 12 3, 12:3" autofocus></label>'+
    '<p class="muted">장 번호만 입력하면 1절로 이동해요. 현재 '+chapter+'장 · '+chapters[0]+'~'+chapters.at(-1)+'장</p>'+
    '<p class="muted" data-chapter-error role="status"></p><button type="submit" class="btn primary">이동</button>','chapter-jump');
}
function jumpToChapter(form) {
  const input = form.elements.chapter;
  const {chapter,verse:requestedVerse} = parseChapterVerse(input.value.normalize('NFKC').trim()) ?? {};
  const {edition,book,source,selection} = bookPickerContext();
  const verses = source?.[book]?.[chapter] ?? {};
  const available = Object.keys(verses).filter(number=>verses[number] &&
    (!selection || (Number(number)>0 && Number(number)<=500)));
  const verse = Number(requestedVerse ?? (available.includes('1')?'1':available[0]));
  if (!available.includes(String(verse))) {
    form.querySelector('[data-chapter-error]').textContent = '이 자료에서 열 수 있는 장·절 번호를 입력해 주세요.';
    input.focus();
    return;
  }
  modal.close();
  if (selection) {
    selection.location = {book,chapter,verse};
    render();
    showVerseArrival('study-v-'+verse);
    return;
  }
  visit([edition,book,chapter,verse].join('/'));
}
function originalCodes(text) {
  return esc(text).replace(/&lt;(W?[HG]\s*\d+[A-Za-z]?)\s*&gt;/gi,(_,code)=>{
    const label = code.replace(/^W|\s/gi,'').toUpperCase();
    return '<button type="button" class="original-code" data-strong-code="'+label+'" aria-label="'+label+' 뜻 보기">'+label+'</button>';
  });
}
function originalBody(body) {
  return body.split(/\r?\n/).filter(line=>line.trim()).map(line=>{
    const word = line.trim().match(/^\[([^\]]+)\]\s*(.*?)\s*@([^#]*)(?:#(.*))?$/);
    if (!word) return '<p>'+originalCodes(line)+'</p>';
    const [,form,lemma,grammar,meaning] = word;
    const gloss = meaning?.replace(/\*\s*$/,'').trim();
    return '<div class="original-word"><div class="original-word-head"><bdi>'+esc(form)+'</bdi>'+
      (gloss && gloss!=='_'?'<span class="original-gloss">'+esc(gloss)+'</span>':'')+'</div>'+
      (lemma?'<div class="original-lemma">'+originalCodes(lemma)+'</div>':'')+
      (grammar.trim()?'<div class="muted original-grammar">'+esc(grammar.trim())+'</div>':'')+'</div>';
  }).join('');
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
    '<section class="dictionary-detail"><h3>원어사전 · '+esc(entry.label)+'</h3><div class="dictionary-copy">'+dictionaryParagraphs(entry.entries[code])+'</div></section>':
    '<div class="stack"><p class="muted">'+(dictionariesByLanguage.length?'가져온 원어사전에 이 코드의 상세 항목이 없어요.':'어원과 용례까지 보려면 한국어 원어사전 파일(.dct)을 추가해 주세요.')+'</p>'+
      '<button class="btn" type="button" data-nav="settings" data-import-link>원어사전 파일 가져오기</button></div>';
  dialog(esc(code)+' · '+(code.startsWith('H')?'히브리어':'헬라어'),
    '<div class="dictionary-body" tabindex="0" role="region" aria-label="원어사전 내용">'+definition+
    (form?'<div class="original-detail-form"><bdi>'+esc(form)+'</bdi></div>':'')+
    '<dl class="original-detail">'+fields.filter(([,value])=>value).map(([label,value])=>
      '<div><dt>'+label+'</dt><dd>'+esc(value)+'</dd></div>').join('')+'</dl></div>','dictionary');
}
function dictionaryParagraphs(text) {
  return text.trim().split(/\r?\n[ \t]*(?:\r?\n)+/).map((block,index)=>{
    const lines = block.trim().split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
    if (!lines.length) return '';
    const hasHeadword = index===0 && lines[0].length<=110 && /[\u0370-\u03ff\u0590-\u05ff]/u.test(lines[0]);
    const headword = hasHeadword?'<p class="dictionary-headword"><bdi>'+esc(lines.shift().replace(/\s*\^+\s*/g,' '))+'</bdi></p>':'';
    return headword+lines.map(line=>'<p>'+esc(line).replace(/^(\([\da-z]{1,3}\))(?=\s)/i,'<strong class="dictionary-sense">$1</strong>')+'</p>').join('');
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
  return mode==='original'?Object.values(originals).find(item=>editionName(item.label)==='원전분해'):mannaCommentary();
}
function studyScreen(mode) {
  const original = mode==='original';
  const headingHtml = original?
    heading('ORIGINAL LANGUAGES','원전분해','히브리어와 헬라어의 단어별 뜻과 문법을 살펴봐요.'):
    heading('BIBLE COMMENTARY','만나주석','책과 장을 선택하거나 원하는 절로 바로 이동하세요.');
  const source = studySource(mode);
  if (!source) {
    const file = original?'원전분해.sdb':'만나주석.cdb';
    return headingHtml+'<section class="card stack spaced"><p>'+file+' 파일을 가져오면 여기서 볼 수 있어요.</p>'+
      '<button class="btn primary" data-nav="settings" data-import-link>'+(original?'원어':'주석')+' 파일 가져오기</button></section>';
  }
  const selection = studySelection[mode];
  const availableBooks = books.filter(([code])=>source.verses[code]);
  const requested = selection.location ?? state.reader;
  const book = source.verses[requested.book]?requested.book:availableBooks[0][0];
  const chapters = source.verses[book];
  const chapter = Object.hasOwn(chapters,requested.chapter)?requested.chapter:Number(Object.keys(chapters)[0]);
  const entries = chapters[chapter];
  const verse = book===requested.book && chapter===requested.chapter && entries[requested.verse]?requested.verse:undefined;
  selection.location = {book,chapter,verse};
  return headingHtml+
    '<div class="reader-controls commentary-controls">'+bookPickerField(book)+
      readerPickerField('장·절',chapter+'장'+(verse?' '+verse+'절':''),'jump-chapter','장·절 이동')+'</div>'+
    '<article class="card commentary-page">'+studyPassage(mode,book,chapter,entries)+'</article>';
}
function studyPassage(mode,book,chapter,entries) {
  const original = mode==='original';
  const verses = Object.entries(entries).filter(([verse,body])=>Number(verse)>0 && body);
  return '<header class="commentary-heading"><div><h2>'+esc(titles[book])+' '+chapter+'장</h2>'+
    '<p class="muted">'+(original?'절별 원어 자료':'절별 주석')+'</p></div></header>'+
    (verses.map(([verse,body])=>'<section class="commentary-verse"><div class="row study-verse-heading"><h3 id="study-v-'+verse+'" tabindex="-1">'+
      (Number(verse)>500?'참고 항목 '+verse:verse+'절')+'</h3>'+
      (Number(verse)<=500?'<button type="button" class="text-action" data-study-return="'+verse+'" aria-label="'+verse+'절 성경 본문 보기">본문 보기 '+icon('arrow')+'</button>':'')+'</div>'+
      (original?'<div class="original-body">'+originalBody(body)+'</div>':
        '<div class="commentary-copy">'+commentaryParagraphs(body).join('')+'</div>')+
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
  return new Set(entry?.done ? entry.verses.map(ref=>{
    const {book,chapter} = readRef(ref);
    return book+'/'+chapter;
  }) : []);
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
function readingProgress(canon) {
  const daily = new Map(Object.entries(state.chapterLog).map(([day,chapters])=>[day,new Set(chapters)]));
  for (const [day,entry] of Object.entries(state.journal)) {
    if (!entry.done || !entry.verses.length) continue;
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
  const canon = canonChapters();
  const {counts,rounds,remaining,today} = readingProgress(canon);
  const progress = canon.length-remaining.length;
  const percent = canon.length ? (progress/canon.length*100).toFixed(1) : '0.0';
  const book = trackerBook ?? state.reader.book;
  const chapters = chapterNumbers(book);
  const visited = chapters.filter(chapter=>counts.has(book+'/'+chapter)).length;
  const chapterButtons = chapters.map(chapter=>{
    const key = book+'/'+chapter, count = counts.get(key) ?? 0;
    return '<button class="chapter-tile" data-open-chapter="'+key+'" data-checked="'+Boolean(count)+'" aria-label="'+titles[book]+' '+chapter+'장, '+(count?count+'회 묵상':'묵상 체크 없음')+'">'+
      '<strong>'+chapter+'장</strong><span>'+(count?'✓ '+count+'회':'—')+'</span></button>';
  }).join('');
  return heading('READING JOURNEY','묵상 체크·일독','묵상한 장과 다시 읽은 횟수를 한눈에 봐요.')+
    '<section class="card reading-progress"><div class="row"><h2>'+String(rounds+1)+'회차 진행</h2><span class="reading-badge">일독 완료 '+rounds+'회</span></div>'+
    '<div class="row reading-count"><strong>'+progress+' <small>/ '+canon.length+'장</small></strong><span>'+percent+'%</span></div>'+
    '<progress max="'+Math.max(1,canon.length)+'" value="'+progress+'" aria-label="현재 일독 진행률"></progress>'+
    '<p class="muted">같은 장은 하루에 한 번 집계해요. 묵상에 담아둔 구절도 QT를 완료하면 해당 장에 반영돼요.</p></section>'+
    readingPlan(canon,counts,remaining,today)+
    '<section class="card reading-chapters"><h2>성경책별 체크</h2>'+
    '<label class="field">성경책<select id="tracker-book">'+options(books,book)+'</select></label>'+
    '<p class="muted">'+titles[book]+' · '+visited+' / '+chapters.length+'장 묵상</p>'+
    '<div class="chapter-grid">'+chapterButtons+'</div></section>';
}
function readingPlan(canon,counts,remaining,today) {
  const planned = planChapters(canon,state.readingRange);
  const scope = planned.length ? planned : canon;
  const range = planned.length ? state.readingRange : null;
  const queue = range ? scope.filter(key=>!counts.has(key)) : remaining;
  const checkedToday = scope.filter(key=>today.has(key)).length;
  const goal = state.readingGoal, slots = Math.max(0,goal-checkedToday);
  const suggestions = queue.slice(0,slots).map(key=>
    '<button class="reading-suggestion" data-open-chapter="'+key+'">'+chapterLabel(key)+' '+icon('arrow')+'</button>').join('');
  const label = range ? chapterLabel(range.start)+(range.start===range.end?'':' ~ '+chapterLabel(range.end)) : '성경 전체';
  const progress = scope.length-queue.length;
  return '<section class="card reading-plan"><div class="row"><h2>나의 묵상 계획</h2><span class="reading-badge">오늘 '+checkedToday+'장 체크</span></div>'+
    '<div class="plan-scope row"><div><strong>'+label+'</strong><p class="muted">범위 진행 '+progress+' / '+scope.length+'장</p></div><button class="btn" data-action="edit-reading-range">범위 설정</button></div>'+
    '<label class="field reading-goal"><span class="row">하루 분량 <output id="reading-goal-value">'+goal+'장</output></span>'+
    '<input type="range" id="reading-goal" min="1" max="30" step="1" value="'+goal+'" aria-label="하루 분량" aria-valuetext="'+goal+'장"><span class="row muted"><span>1장</span><span>30장</span></span></label>'+
    (range && !queue.length?'<p class="muted">정한 범위의 묵상을 모두 마쳤어요.</p>':
      suggestions?'<div class="reading-suggestions"><p class="muted">범위에서 이어 읽을 장</p>'+suggestions+'</div>':
      '<p class="muted">'+(slots?'성경 본문을 불러오면 추천 장을 볼 수 있어요.':'오늘 목표를 채웠어요.')+'</p>')+'</section>';
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
  dialog('묵상 범위 설정','<p class="muted">책 전체나 원하는 장 사이를 계획할 수 있어요.</p>'+
    rangeFields('시작',range.start)+rangeFields('끝',range.end)+'<p class="range-error" role="status"></p>'+
    '<div class="row"><button type="button" class="btn" data-action="reset-reading-range">성경 전체로</button><button type="button" class="btn primary" data-action="save-reading-range">범위 저장</button></div>');
}
function saveReadingRange() {
  const [start,end] = ['시작','끝'].map(side=>modal.querySelector('[data-range-book="'+side+'"]').value+'/'+modal.querySelector('[data-range-chapter="'+side+'"]').value);
  const range = {start,end};
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
  const erase = selected.every(Boolean);
  const marker = erase?selected[0]:{style:state.markerStyle,color:state.markerColor};
  const label = erase?'말씀 표시 해제':markStyles[marker.style]+' 바로 적용';
  return '<div class="selection verse-actions" aria-label="선택한 구절 메뉴"><div class="verse-actions-top">'+
    '<span class="compact">'+chosen.size+'절 선택</span><button class="icon-action" data-action="clear" aria-label="선택 해제">'+icon('close')+'</button></div>'+
    '<div class="verse-actions-row verse-actions-main"><div class="marker-group"><button class="icon-action marker-quick" data-action="quick-marker" aria-label="'+label+'" title="'+label+' · 길게 눌러 옵션" style="--marker-color:'+marker.color+';--marker-style:'+(['fill','wavy'].includes(marker.style)?'solid':marker.style)+'">'+icon('marker')+'</button>'+
    '<button class="icon-action marker-options" data-action="highlight" aria-label="형광펜 색상 및 밑줄 옵션">⌄</button></div>'+
    '<button class="btn" data-action="note">메모</button>'+
    '<button type="button" class="btn icon-action" data-action="copy-verses" aria-label="구절 복사" title="구절 복사">'+icon('copy')+'</button>'+
    '<button class="btn primary" data-action="attach">묵상에 담기</button></div>'+
    '<div class="verse-actions-row study-shortcuts"><button type="button" class="btn" data-nav="commentary">주석 보기</button>'+
    '<button type="button" class="btn" data-nav="original">원전분해 보기</button></div></div>';
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
  for (let day=1; day<=end; day++) {
    const key = monthPrefix+String(day).padStart(2,'0'), journal = state.journal[key];
    const hasJournal = Boolean(journal && hasJournalContent(journal));
    const hasDailyNote = Boolean(state.dailyNotes[key]);
    const hasReading = Boolean(state.chapterLog[key]?.length);
    const hasQT = hasJournal || hasDailyNote || hasReading;
    const items = prayersByDay.get(key) ?? [];
    const thoughtCount = items.filter(item=>item.kind==='thought').length;
    const prayerCount = items.length-thoughtCount;
    const hasVerse = state.dailyVerses[key] || state.dailyNotes[key];
    const hasMarks = marksByDay.has(key);
    const label = longDate(key)+(journal?.done?' QT 완료':hasJournal?' 묵상 노트 있음':'')+
      (hasDailyNote?' 말씀 묵상 있음':'')+(hasReading?' 성경 읽기 기록 있음':'')+(prayerCount?' 기도 '+prayerCount+'건':'')+
      (thoughtCount?' 생각 노트 '+thoughtCount+'건':'')+(hasVerse?' 오늘의 말씀 있음':'')+(hasMarks?' 구절 메모 또는 표시 있음':'');
    days += '<button class="day" data-day="'+key+'" aria-pressed="'+(key===selectedDay)+'" '+
      (hasQT?'data-qt-record ':'')+(key===today?'aria-current="date" ':'')+'aria-label="'+label+'">'+day+'</button>';
  }
  return heading('QT CALENDAR','묵상 달력','날짜를 고르고 항목을 눌러 그날의 기록을 펼쳐 보세요.')+
    '<div class="calendar-layout"><section class="card calendar-month"><div class="row"><button class="btn" data-month="-1" aria-label="이전 달">←</button><h3>'+year+'년 '+num+'월</h3><button class="btn" data-month="1" aria-label="다음 달">→</button></div><div class="calendar">'+days+'</div></section>'+
    '<div>'+calendarDaySummary(selectedDay,prayersByDay.get(selectedDay) ?? [],marksByDay.get(selectedDay) ?? [])+
    (undated.length?'<details class="undated-prayers"><summary>날짜 미기록 기도·생각 '+undated.length+'건</summary>'+
      undated.map(prayer=>calendarPrayer(prayer)).join('')+'</details>':'')+'</div></div>';
}
function calendarDetail(label,meta,content) {
  return '<details class="day-detail"><summary><span>'+label+'</span><span class="day-detail-meta">'+esc(meta)+'</span></summary>'+
    '<div class="day-detail-body">'+content+'</div></details>';
}
function calendarText(value) {
  return value?'<p class="day-detail-text">'+esc(value)+'</p>':'';
}
function calendarItemActions(edit,remove) {
  return '<div class="item-actions card-actions">'+(edit?'<button type="button" class="text-action" '+edit+'>수정</button>':'')+
    (remove?'<button type="button" class="text-action destructive" '+remove+'>삭제</button>':'')+'</div>';
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
  const journal = state.journal[day], note = state.dailyNotes[day], saved = state.dailyVerses[day];
  const ref = saved?.ref ?? note?.ref;
  const notes = records.filter(({mark})=>mark.note);
  const highlights = records.filter(({mark})=>verseMark(mark));
  const journalLink = 'data-nav="journal/'+day+'"';
  const verseContent = ref
    ? '<div class="tappable-card">'+(verseText(ref)?cardHit('본문에서 읽기','data-visit="'+ref+'"'):'')+
      '<p class="muted">'+esc(saved?.label ?? editionLabel(readRef(ref).edition))+'</p>'+calendarText(saved?.body ?? savedVerseText(ref))+'</div>'
    : '<p class="muted">'+(day>dateKey()?'아직 오지 않은 날이에요.':'이날 저장된 말씀 구절이 없어요.')+'</p>';
  const recordDetails = (items,isNote) => items.map(({key,verses,mark,noteKey})=>
    '<article class="day-detail-item tappable-card">'+(verseText(key)?cardHit('본문에서 읽기','data-visit="'+key+'"'):'')+
    '<strong>'+esc(selectionReference(key,verses))+'</strong><p class="muted">'+esc(editionLabel(readRef(key).edition))+'</p>'+
    (isNote?calendarText(mark.note):
      '<p class="day-detail-text">'+markedText(recordPassage(key,verses).map(([,body])=>body).join(' ') || savedVerseText(key),mark)+'</p>')+
    (isNote?calendarItemActions('data-edit-verse-note="'+noteKey+'"','data-delete-note="'+noteKey+'"'):'<div class="item-actions card-actions">'+highlightDeleteButton(key)+'</div>')+'</article>').join('');
  return '<section class="calendar-summaries day-summary" data-date="'+day+'" aria-labelledby="day-summary-heading">'+
    '<div class="section-head"><h2 id="day-summary-heading">'+longDate(day)+' 요약</h2></div>'+
    calendarDetail('오늘의 말씀',ref?reference(ref):'',verseContent)+
    (note?calendarDetail('말씀 묵상',reference(note.ref),'<div class="tappable-card">'+
      cardHit('말씀 묵상 열기','data-edit-daily-note="'+day+'"')+calendarText(note.body)+
      calendarItemActions('data-edit-daily-note="'+day+'"','data-delete-daily-note="'+day+'"')+'</div>'):'')+
    (journal && hasJournalContent(journal)?calendarDetail('묵상 노트','',
      '<div class="tappable-card">'+cardHit('묵상 노트 열기',journalLink)+
      (journal.title?'<strong>'+esc(journal.title)+'</strong>':'')+calendarText(journal.reflection)+
      calendarItemActions(journalLink,'data-delete-journal="'+day+'"')+'</div>'):
      '<div class="day-summary-write"><button type="button" class="btn" '+journalLink+'>묵상 노트 열기 '+icon('arrow')+'</button></div>')+
    (prayers.length?calendarDetail('기도',prayers.length+'건',prayers.map(calendarPrayer).join('')):'')+
    (thoughts.length?calendarDetail('생각 노트',thoughts.length+'건',thoughts.map(calendarPrayer).join('')):'')+
    (notes.length?calendarDetail('구절 메모',notes.length+'건',recordDetails(notes,true)):'')+
    (highlights.length?calendarDetail('형광펜·밑줄',highlights.length+'건',recordDetails(highlights,false)):'')+'</section>';
}
const recordFilters = {all:'전체',highlight:'형광펜',note:'메모'};
function markKinds(mark) {
  return [mark.color || mark.highlight?'highlight':'',mark.underline?'underline':'',mark.note?'note':''].filter(Boolean);
}
function recordRows() {
  const groups = new Map(), rows = new Map();
  const add = (key,verses,day,mark,noteKey) => {
    const id = [key,verses.join(','),day].join('/');
    const row = rows.get(id) ?? {key,verses,day,mark:{}};
    Object.assign(row.mark,mark);
    if (noteKey) row.noteKey = noteKey;
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
function recordList(rows = recordRows()) {
  const query = keyword.toLowerCase().trim();
  const matching = rows.filter(({key,verses,day,mark}) => {
    const {edition,book} = readRef(key);
    const matchesFilter = filter==='all' || (filter==='highlight' && verseMark(mark)) || (filter==='note' && mark.note);
    return matchesFilter &&
      (!recordSelection.edition || edition===recordSelection.edition) &&
      (!recordSelection.book || book===recordSelection.book) &&
      (!recordSelection.year || (day?.slice(0,4) ?? 'undated')===recordSelection.year) &&
      [selectionReference(key,verses),...recordPassage(key,verses).map(([,body])=>body),mark.note ?? ''].join(' ').toLowerCase().includes(query);
  });
  let previousYear;
  return '<p class="record-result muted">말씀 기록 '+matching.length+'건</p>'+
    (matching.map(({key,verses,day,mark,noteKey}) => {
      const year = day?.slice(0,4) ?? '';
      const title = year===previousYear?'':'<h3 class="record-year">'+(year?year+'년':'날짜 미기록')+'</h3>';
      previousYear = year;
      const passage = recordPassage(key,verses);
      const excerpt = passage.length?passage.map(([number,body])=>
        '<span class="record-verse"><span class="record-verse-number">'+number+'절</span>'+markedText(body,mark)+'</span>').join('')
        : markedText(savedVerseText(key),mark);
      return title+'<article class="card record-item"><button class="record-open" data-visit="'+key+'"><span class="row"><strong>'+esc(selectionReference(key,verses))+'</strong>'+
        (day?'<time datetime="'+day+'">'+day.replaceAll('-','.')+'</time>':'')+'</span>'+
        '<span class="record-edition">'+esc(editionLabel(readRef(key).edition))+'</span>'+
        '<span class="record-text record-excerpt">'+excerpt+'</span>'+
        (mark.note?'<span class="record-text record-note">'+esc(mark.note)+'</span>':'')+'</button>'+
        '<div class="record-footer"><span class="record-tags">'+
        markKinds(mark).map(kind=>'<span>'+(kind==='underline'?markStyles[mark.underline.style]+' 밑줄':recordFilters[kind])+'</span>').join('')+'</span>'+
        '<div class="item-actions record-delete">'+
        (noteKey?'<button type="button" class="text-action destructive" data-delete-note="'+noteKey+'">메모 삭제</button>':'')+
        (verseMark(mark)?highlightDeleteButton(key):'')+'</div></div></article>';
    }).join('') || '<p class="empty">조건에 맞는 말씀 기록이 없어요.</p>');
}
function recordPickerItems(key,rows) {
  if (key==='edition') return Object.entries(editions);
  if (key==='book') return books;
  const years = [...new Set(rows.map(({day})=>day?.slice(0,4) ?? 'undated'))];
  return years.map(year=>[year,year==='undated'?'날짜 미기록':year+'년']);
}
function recordsScreen() {
  const rows = recordRows();
  const counts = {all:rows.length,highlight:rows.filter(({mark})=>verseMark(mark)).length,note:rows.filter(({mark})=>mark.note).length};
  const pickers = Object.entries(recordPickerLabels).map(([key,[label,all]])=>{
    const selected = recordPickerItems(key,rows).find(([id])=>id===recordSelection[key]);
    return readerPickerField(label,selected?.[1] ?? all,'pick-record-'+key,label+' 선택');
  }).join('');
  return heading('VERSE COLLECTION','기록함','형광펜, 밑줄, 메모를 모아보고 원하는 말씀을 찾아보세요.')+
    '<div class="record-shortcuts">'+[
      ['calendar','calendar','달력','묵상 달력'],
      ['prayers','prayer','기도','기도 기록'],
      ['newyear','book','새해 말씀',state.newYear.length+'건'],
      ['reading','check','묵상 체크','성경 일독'],
    ].map(([route,symbol,label,detail])=>'<button class="record-shortcut" data-nav="'+route+'">'+icon(symbol)+'<strong>'+label+'</strong><span>'+detail+'</span></button>').join('')+'</div>'+
    (state.verseBundles.length?'<div class="section-head"><h2>구절 모음</h2></div>'+state.verseBundles.map(bundle=>
      '<article class="card row"><button type="button" class="record-open" data-open-verse-bundle="'+bundle.id+'">'+
      '<strong>'+esc(reference(bundle.verses[0].ref))+' · '+bundle.verses.length+'구절</strong>'+
      '<span class="muted">'+esc(bundle.day)+'</span></button><button type="button" class="text-action destructive" '+
      'data-remove-verse-bundle="'+bundle.id+'">삭제</button></article>').join(''):'')+
    '<div class="section-head"><h2>말씀 기록</h2></div><div class="filters">'+Object.entries(recordFilters).map(([id,label])=>'<button class="pill" data-filter="'+id+'" aria-pressed="'+(filter===id)+'">'+label+' <span>'+counts[id]+'</span></button>').join('')+'</div>'+
    '<div class="record-filters">'+pickers+'</div>'+
    '<label class="field spaced">기록 검색<input type="search" id="record-search" value="'+esc(keyword)+'" placeholder="구절, 본문, 메모 검색"></label><div id="record-list" class="spaced">'+recordList(rows)+'</div>';
}
function settingsScreen() {
  return heading('MY NOTEBOOK','저장과 설정','묵상 노트는 이 기기에 저장돼요.')+
    menuOrderSettings()+displaySettings()+importPanel()+
    '<div class="section-head"><h2>기록 백업</h2></div><section class="card stack"><p>백업 파일에 묵상, 날짜별 오늘의 말씀, 말씀 묵상, 기도, 새해 말씀, 구절 표시와 구절 모음, 장별 묵상 체크, 일독 계획과 화면 설정이 담겨요. 직접 가져온 성경 본문은 별도로 다시 가져와야 해요. 새 기기에서는 같은 웹앱을 열고 이 파일을 가져오세요.</p><p class="muted">마지막 내보내기 · '+(state.backup?esc(new Date(state.backup).toLocaleString('ko-KR')):'아직 내보낸 기록이 없어요')+'</p><button class="btn primary" data-action="export">전체 백업 내보내기</button><button class="btn" data-action="import">백업 파일 가져오기</button><input id="backup-file" type="file" accept=".json,application/json" hidden><p class="muted">백업 파일에는 개인 묵상이 들어 있어요. 나만 접근할 수 있는 곳에 보관해 주세요.</p></section>';
}
function menuOrderSettings() {
  const order = state.menuOrder.map(route=>esc(menuItems.get(route).textContent.trim())).join(' · ');
  return '<div class="section-head"><h2>메뉴 순서</h2></div><section class="card stack">'+
    '<p class="muted">현재 순서</p><p>'+order+'</p>'+
    '<button type="button" class="btn" data-action="choose-menu-order" aria-haspopup="dialog">순서 바꾸기</button></section>';
}
function showMenuOrderPicker() {
  pendingMenuOrder = [];
  const choices = state.menuOrder.map(route=>
    '<button type="button" class="btn" data-menu-choice="'+route+'" aria-pressed="false">'+
    esc(menuItems.get(route).textContent.trim())+'<span class="menu-order-position"></span></button>').join('');
  dialog('메뉴 순서 바꾸기','<p class="muted">원하는 순서대로 메뉴를 눌러 주세요. 모두 고르면 자동으로 저장돼요.</p>'+
    '<div class="stack menu-order-choices" role="group" aria-label="메뉴 순서">'+choices+'</div>');
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
function render() {
  const screens = {today:todayScreen,bible:readerScreen,calendar:calendarScreen,thoughts:thoughtsScreen,records:recordsScreen,settings:settingsScreen,prayers:prayersScreen,newyear:newYearScreen,journal:journalScreen,prayer:prayerScreen,reading:readingScreen,commentary:()=>studyScreen('commentary'),original:()=>studyScreen('original'),'prayer-edit':prayerEditorScreen};
  const hash = location.hash==='#search'?'bible':(location.hash.slice(1) || state.menuOrder[0]);
  const day = journalDate(hash);
  const prayerId = hash.startsWith('prayer/') && validId(hash.slice(7)) ? hash.slice(7) : '';
  const editorId = hash.startsWith('prayer-edit/') && validId(hash.slice(12)) ? hash.slice(12) : '';
  const next = day?'journal':prayerId?'prayer':editorId?'prayer-edit':Object.hasOwn(screens,hash) && !['journal','prayer','prayer-edit'].includes(hash)?hash:'bible';
  const route = day || prayerId || editorId?hash:next;
  const changed = activeRoute!==route;
  let studyJump;
  if (changed) {
    if (modal.open && modal.firstElementChild?.name==='chapter-jump') modal.close();
    if (Object.hasOwn(studySelection,next) && view==='bible') {
      const first = chosen.values().next().value;
      const selected = first?readRef(first):state.reader;
      studySelection[next].location = selected;
      studyJump = selected.verse;
    }
    chosen.clear();
    if (next==='reading') trackerBook = state.reader.book;
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
  document.querySelector('.back-button').hidden = view==='today' || (!history.state?.qtPrevious && (view==='bible' || !location.hash));
  readerSearchForm.hidden = view!=='bible' || !state.reader.edition;
  if (readerSearchForm.hidden && !readerSearchInput.hidden) closeReaderSearch();
  document.querySelector('.bottom').hidden = view==='journal' || view==='prayer-edit';
  applyDisplay();
  if (view==='today' || view==='calendar') {
    renderedDailyDate = dateKey();
    rememberDailyVerse(renderedDailyDate);
  }
  const sameCalendarDay = !changed && view==='calendar' && main.querySelector('.day-summary')?.dataset.date===selectedDay;
  const openSections = sameCalendarDay ? [...main.querySelectorAll('.day-detail[open] > summary')].map(summary=>summary.firstElementChild.textContent) : [];
  main.innerHTML = screens[view](prayerId || editorId);
  if (openSections.length) {
    for (const summary of main.querySelectorAll('.day-detail > summary')) {
      if (openSections.includes(summary.firstElementChild.textContent)) summary.parentElement.open = true;
    }
  }
  const writing = main.querySelector('[data-journal-field="reflection"]');
  if (writing) resizeWriting(writing);
  const navView = ['calendar','prayers','newyear','reading','prayer','prayer-edit','journal'].includes(view)?'records':view;
  state.menuOrder.forEach((route,index)=>{
    const button = menuItems.get(route);
    if (menuBar.children[index]!==button) menuBar.insertBefore(button,menuBar.children[index]);
    if (button.dataset.nav===navView) button.setAttribute('aria-current','page');
    else button.removeAttribute('aria-current');
  });
  if (changed) window.scrollTo(0,0);
  if (view==='bible' && jumpTo) {
    showVerseArrival(jumpTo);
    jumpTo = undefined;
  }
  if (studyJump && studySource(view)) {
    if (studySelection[view].location.verse===studyJump) showVerseArrival('study-v-'+studyJump);
    else notify('선택한 절의 자료가 없어요.');
  }
}
function showVerseArrival(id) {
  const verse = document.getElementById(id);
  if (!verse) return;
  clearTimeout(verseArrivalTimer);
  arrivedVerse?.classList.remove('verse-arrival');
  if (arrivedVerse===verse) void verse.offsetWidth;
  if (!verse.classList.contains('verse-arrival-focus')) {
    verse.classList.add('verse-arrival-focus');
    verse.addEventListener('blur',()=>verse.classList.remove('verse-arrival-focus'),{once:true});
  }
  verse.focus({preventScroll:true});
  main.querySelector('.verse-scroll-space')?.remove();
  const page = document.scrollingElement;
  const headerHeight = document.querySelector('.top').offsetHeight;
  const controlsHeight = view==='bible' ? (main.querySelector('.reader-controls')?.offsetHeight ?? 0) : 0;
  const top = Math.max(0,verse.getBoundingClientRect().top+page.scrollTop-headerHeight-controlsHeight-12);
  // Leave enough room for the last verses of a chapter to reach the header.
  const pageEnd = page.scrollHeight>page.clientHeight
    ? page.scrollHeight
    : main.getBoundingClientRect().bottom+page.scrollTop;
  const extraSpace = Math.ceil(top+page.clientHeight-pageEnd);
  if (top>0 && extraSpace>0) {
    const spacer = document.createElement('div');
    spacer.className = 'verse-scroll-space';
    spacer.style.height = extraSpace+'px';
    spacer.setAttribute('aria-hidden','true');
    main.append(spacer);
  }
  window.scrollTo(0,top);
  arrivedVerse = verse;
  verse.classList.add('verse-arrival');
  verseArrivalTimer = setTimeout(()=>{
    verse.classList.remove('verse-arrival');
    arrivedVerse = undefined;
  },1600);
}

function dialog(title,body,formName) {
  const close = formName?'type="button" data-action="close-dialog"':'value="cancel" formnovalidate';
  modal.innerHTML = '<form method="dialog" class="stack"'+(formName?' name="'+formName+'"':'')+
    '><div class="row"><h2>'+title+'</h2><button class="btn" '+close+'>닫기</button></div>'+body+'</form>';
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
  dialog('구절 메모','<p class="muted">'+esc(selectionReference(key,verses))+' · '+esc(editionLabel(readRef(key).edition))+'</p>'+
    editorField('나의 메모','note',mark?.note,'textarea','id="verse-note" placeholder="이 구절에서 마음에 남은 것을 적어보세요."')+
    '<div class="row verse-note-actions">'+(mark?.note?'<button type="button" class="btn danger" data-delete-note="'+key+'">메모 삭제</button>':'')+
    '<button type="button" class="btn primary" data-action="save-note">메모 저장</button></div>');
}
async function saveVerseNote() {
  const value = modal.querySelector('#verse-note').value.trim();
  if (!value) return notify('메모 내용을 입력해 주세요.');
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
  chosen.clear();
  modal.close();
  render();
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
    result.readingRange = {start:input.readingRange.start,end:input.readingRange.end};
  }
  if (input.editionLabels!==undefined) {
    if (!isObject(input.editionLabels)) throw Error('edition labels');
    for (const [id,label] of Object.entries(input.editionLabels)) {
      if (!localEditionId(id) || typeof label!=='string' || label.length>72) throw Error('edition label');
      result.editionLabels[id] = label;
    }
  }
  result.readingGoal = input.readingGoal;
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
  'close-bible-search'() { closeReaderSearch(true); },
  'pick-search-scope':showSearchScopePicker,
  'view-search-selection':showSelectedSearchVerses,
  'choose-menu-order':showMenuOrderPicker,
  'jump-chapter':showChapterJump,
  'pick-edition':showEditionPicker,
  'close-dialog'() { modal.close(); },
  back() { goBack(); },
  'open-today-note'() { showDailyNote(); },
  'choose-font'() { document.querySelector('#custom-font-file').click(); },
  'choose-bdb'() { document.querySelector('#bdb-files').click(); },
  'edit-reading-range'() { showReadingRange(); },
  'save-reading-range'() { saveReadingRange(); },
  'reset-reading-range'() { setReadingRange(null); },
  highlight() { showMarkDialog(); },
  'quick-marker'() { if (Date.now()>=ignoreMarkerClick) quickMarker(); },
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
  'add-thought'() { showThoughtEditor(); },
  'add-year'() { showYearEditor(); },
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
  chosen.clear();
  save();
  render();
  window.scrollTo(0,0);
}
function bookPickerContext() {
  const {edition,book} = state.reader;
  const selection = studySelection[view];
  return selection
    ? {book:selection.location?.book,source:studySource(view)?.verses,selection}
    : {book,source:data[edition],edition};
}
function pickerOptions(items,active,attribute) {
  return '<div class="reader-picker-options">'+items.map(([id,label])=>
    '<button type="button" class="btn" '+attribute+'="'+esc(id)+'"'+(id===active?' aria-current="true"':'')+
    '>'+esc(label)+'</button>').join('')+'</div>';
}
function showEditionPicker() {
  if (view!=='bible' || !state.reader.edition) return;
  dialog('번역본 선택',pickerOptions(Object.entries(editions),state.reader.edition,'data-pick-edition'));
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
    if (current.selection) current.selection.location = {book,chapter};
    else setReader([current.edition,book,chapter,1].join('/'));
    render();
  }
  main.querySelector('[data-action="pick-book"]')?.focus({preventScroll:true});
}
document.addEventListener('click',event => {
  const button = event.target.closest('button');
  if (!button) return;
  if (event.detail && Date.now()<ignoreReaderSwipeClickUntil && button.closest('.bible-passage')) {
    ignoreReaderSwipeClickUntil = 0;
    return;
  }
  const target = button.dataset;
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
  if (target.pickBook) return chooseBook(target.pickBook);
  if (target.action==='pick-book') return showBookPicker();
  if (target.strongCode) return showOriginalMeaning(button);
  if (target.studyReturn) return returnToBible(studySelection[view]?.location,Number(target.studyReturn));
  if (target.nav) {
    if (modal.contains(button)) modal.close();
    navigate(target.nav);
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
  if (target.action) return actions[target.action]?.();
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
  if (target.delete) return confirmItemRemoval(target.delete,editId);
  if (target.deletePrayer) return confirmItemRemoval('prayer',target.deletePrayer);
  if (target.deleteDailyNote) return confirmItemRemoval('dailyNote',target.deleteDailyNote);
  if (target.deleteJournal) return confirmItemRemoval('journal',target.deleteJournal);
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
  if (target.filter) filter = target.filter;
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
main.addEventListener('input',event => {
  const field = event.target;
  if (field.dataset.journalField) {
    const entry = journalEntry(selectedDay);
    entry[field.dataset.journalField] = field.value;
    main.querySelector('[data-delete-journal]').hidden = !hasJournalContent(entry);
    if (field.tagName==='TEXTAREA') resizeWriting(field);
    save();
  }
  if (field.id==='reading-goal') {
    document.getElementById('reading-goal-value').textContent = field.value+'장';
    field.setAttribute('aria-valuetext',field.value+'장');
  }
  if (field.id==='record-search') {
    keyword = field.value;
    document.querySelector('#record-list').innerHTML = recordList();
  }
});
readerSearchInput.addEventListener('input',clearReaderSearchResults);
readerSearchPanel.addEventListener('change',event=>{
  const field = event.target;
  const key = field.dataset.searchSelect;
  if (!key) return;
  if (field.checked) selectedSearchVerses.add(key);
  else selectedSearchVerses.delete(key);
  const button = readerSearchPanel.querySelector('[data-action="view-search-selection"]');
  button.disabled = !selectedSearchVerses.size;
  button.textContent = '모아 보기 ('+selectedSearchVerses.size+')';
});
readerSearchForm.addEventListener('submit',event=>{
  event.preventDefault();
  if (readerSearchInput.hidden) return showReaderSearch();
  readerSearchInput.blur();
  submitReaderSearch();
});
window.addEventListener('resize',()=>{
  if (bibleSearchResults) updateReaderSearch();
});
document.addEventListener('pointerdown',event=>{
  if (!readerSearchInput.hidden && !readerSearchForm.contains(event.target) && !modal.contains(event.target)) closeReaderSearch();
});
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
  if ('thought' in form.dataset) {
    event.preventDefault();
    return saveThought(form);
  }
  if (form.dataset.dailyNote) {
    event.preventDefault();
    return saveDailyNote(form);
  }
});
main.addEventListener('submit',event => {
  const form = event.target;
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
  if (!state.journal[day]?.done) return;
  const body = new FormData(form).get('comment').trim();
  if (!body) return notify('댓글 내용을 입력해 주세요.');
  const entry = journalEntry(day);
  (entry.comments ??= []).push({id:newId(),body,created:new Date().toISOString()});
  save();
  render();
});
main.addEventListener('change',async event => {
  const field = event.target;
  if (field.id==='reading-goal') {
    state.readingGoal = Number(field.value);
    const focused = document.activeElement===field;
    save();
    render();
    if (focused) document.getElementById('reading-goal')?.focus({preventScroll:true});
  }
  if (field.id==='tracker-book') {
    trackerBook = field.value;
    render();
  }
  const displayPreference = field.name==='palette'?'palette':{appearance:'theme','font-choice':'fontChoice'}[field.id];
  if (displayPreference) {
    state[displayPreference] = field.value;
    applyDisplay();
    save();
  }
  if (field.id==='custom-font-file' && field.files[0]) return importCustomFont(field.files[0]);
  if (field.id==='bdb-files') return importBibleFiles([...field.files]);
  if (field.id==='backup-file' && field.files[0]) {
    try {
      pendingImport = validatedBackup(JSON.parse(await field.files[0].text()));
      dialog('백업 기록 가져오기','<p>이 기기의 현재 기록을 백업 파일의 내용으로 바꿔요. 현재 기록을 보관하려면 먼저 내보내세요.</p><button class="btn primary block" type="button" data-action="restore">백업으로 복원</button>');
    } catch {
      notify('이 파일을 읽을 수 없어요. M-BIBLE에서 내보낸 백업인지 확인해 주세요.');
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
  const oldSize = {regular:17,large:20,largest:23};
  const oldFont = Object.hasOwn(oldSize,input.readingSize) ? oldSize[input.readingSize] : undefined;
  result.display = Object.fromEntries(Object.keys(settings).map(key => [
    key,displayValue(key,input.display?.[key] ?? (key==='fontSize'?oldFont:undefined)),
  ]));
  result.theme = Object.hasOwn(themes,input.theme)?input.theme:'system';
  const legacyPalettes = {rose:'lavender',coral:'oat',linen:'oat',sage:'gray',navy:'slate'};
  result.palette = Object.hasOwn(palettes,input.palette)?input.palette:
    Object.hasOwn(legacyPalettes,input.palette)?legacyPalettes[input.palette]:'slate';
  result.fontChoice = Object.hasOwn(fontChoices,input.fontChoice)?input.fontChoice:'pretendard';
  const menuOrder = Array.isArray(input.menuOrder) ? input.menuOrder.filter(route=>menuItems.has(route)) : [];
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
  for (const entry of Object.values(result.journal)) {
    if (typeof entry.reflection!=='string') {
      entry.reflection = Object.entries(parts)
        .filter(([key])=>entry[key]?.trim())
        .map(([key,label])=>label+'\n'+entry[key]).join('\n\n');
    }
    for (const key of Object.keys(parts)) delete entry[key];
  }
  return result;
}
async function loadFontFace(bytes) {
  return new FontFace('WordJournalCustom',bytes).load();
}
function activateFont(name,face) {
  if (customFont) document.fonts.delete(customFont.face);
  document.fonts.add(face);
  customFont = {name,face};
}
async function importCustomFont(file) {
  if (importingFont) return;
  if (!/\.(ttf|otf|woff2?)$/i.test(file.name) || !file.size || file.size>24*1024*1024) {
    notify('24MB 이하의 TTF, OTF, WOFF 또는 WOFF2 글꼴 파일을 선택해 주세요.');
    document.querySelector('#custom-font-file').value = '';
    return;
  }
  importingFont = true;
  render();
  try {
    const bytes = await file.arrayBuffer();
    const face = await loadFontFace(bytes);
    const name = file.name.normalize('NFC').slice(0,100);
    await storeLocal('custom-font',{name,bytes});
    activateFont(name,face);
    state.fontChoice = 'custom';
    if (await save()) notify('이 기기에 글꼴을 저장했어요.');
  } catch {
    notify('글꼴을 가져오지 못했어요. 파일 형식과 저장 공간을 확인해 주세요.');
  } finally {
    importingFont = false;
    if (view==='settings') render();
    else applyDisplay();
  }
}
function applyDisplay() {
  const root = document.documentElement;
  const size = displayValue('fontSize',state.display.fontSize);
  root.style.setProperty('--reading-size',size+'px');
  const uiSize = Math.max(14,Math.min(24,16+(size-settings.fontSize.initial)*0.6));
  root.style.fontSize = uiSize+'px';
  root.style.setProperty('--ui-size-offset',(uiSize-16)+'px');
  root.dataset.palette = state.palette;
  root.dataset.font = state.fontChoice==='custom' && !customFont?'pretendard':state.fontChoice;
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
  const id = state.reader.edition;
  const texts = id ? [1,2,3].map(number=>verseText(id+'/PSA/23/'+number)) :
    ['오늘 읽을 말씀을 천천히 살펴봐요.','마음에 남는 문장을 묵상 노트에 적어요.','한 줄씩 적으며 하루를 돌아봐요.'];
  return '<section class="reading-example"><div class="row"><h3>성경 미리보기</h3><span class="live-chip">실시간 적용</span></div>'+
    '<div class="bible-passage preview-passage"><header class="passage-heading"><strong>'+(id?'시편 23편':'글자 설정 예시')+'</strong><span>'+(id?esc(editionLabel(id)):'예시 문장')+'</span></header>'+
    texts.map((text,index)=>'<div class="verse"><span class="number">'+(index+1)+'</span>'+markedText(text)+'</div>').join('')+'</div></section>';
}
function displaySettings() {
  const swatches = Object.entries(palettes).map(([id,label])=>
    '<label class="palette-option"><input type="radio" name="palette" value="'+id+'" '+(state.palette===id?'checked':'')+'>'+
    '<span class="palette-swatch" data-swatch="'+id+'" aria-hidden="true"></span><span>'+label+'</span></label>').join('');
  return '<div class="section-head"><h2>화면 테마</h2></div><section class="card stack appearance-settings">'+
    '<fieldset class="palette-field"><legend>색상 테마</legend><div class="palette-grid">'+swatches+'</div></fieldset>'+
    '<label class="field">화면 모드<select id="appearance">'+options(Object.entries(themes),state.theme)+'</select></label></section>'+
    '<div class="section-head"><h2>글꼴과 읽기</h2></div><section class="card stack reading-settings">'+
    '<label class="field">앱 글꼴<select id="font-choice">'+options([
      ['pretendard',fontChoices.pretendard],['system',fontChoices.system],
      ...(customFont?[['custom',customFont.name]]:[]),
    ],state.fontChoice==='custom' && !customFont?'pretendard':state.fontChoice)+'</select></label>'+
    '<button class="btn" data-action="choose-font" '+(importingFont?'disabled':'')+'>'+(importingFont?'글꼴 읽는 중…':'내 글꼴 파일 가져오기')+'</button>'+
    '<input id="custom-font-file" type="file" accept=".ttf,.otf,.woff,.woff2" hidden>'+
    '<p class="muted">파일 앱에 저장된 TTF, OTF, WOFF, WOFF2를 이 기기에 추가할 수 있어요. 글꼴 파일은 백업에 포함되지 않아요.</p>'+
    '<p class="muted">글자 크기는 성경과 앱 전체에 적용돼요. 줄 간격과 구절 간격은 아래에서 바로 비교해 보세요.</p>'+displayFields()+readingPreview()+
    '<button class="text-action reset-reading" data-action="reset-display">본문 설정 초기화</button></section>';
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
  dialog('말씀 표시','<p class="muted">선택한 '+chosen.size+'절에 한 가지 표시를 적용해요.</p>'+
    '<label class="field">표시 방식<select id="mark-style">'+options(Object.entries(markStyles),appearance?.style ?? state.markerStyle)+'</select></label>'+
    '<label class="field color-field">원하는 색<input type="color" id="mark-color" value="'+initial+'"></label>'+
    '<div class="row"><button type="button" class="btn" data-action="erase-mark">표시 지우기</button><button type="button" class="btn primary" data-action="apply-mark">적용</button></div>');
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
    const day = item.day ?? '';
    if (!groups.has(day)) groups.set(day,[]);
    groups.get(day).push(item);
  }
  const list = [...groups].map(([day,notes])=>'<section class="thought-group"><h2>'+
    (day?'<time datetime="'+day+'">'+day.slice(0,4)+'년 '+longDate(day)+'</time>':'날짜 미기록')+'</h2>'+
    notes.map(note=>thoughtCard(note,false)).join('')+'</section>').join('');
  return heading('THOUGHT NOTES','생각 노트','어떤 생각이든 자유롭게 적어보세요.')+
    '<button type="button" class="btn primary block thought-add" data-action="add-thought">＋ 생각 기록 추가</button><div class="thought-list">'+
    (list || '<p class="empty">아직 남긴 생각이 없어요.</p>')+'</div>';
}
function prayersScreen() {
  const groups = {open:[],answered:[],thought:[]};
  for (const item of state.prayers) groups[item.kind==='thought'?'thought':item.done?'answered':'open'].push(item);
  const labels = {open:'기도 중',answered:'응답받음',thought:'생각 노트'};
  const thought = prayerFilter==='thought';
  return heading('PRAYER JOURNAL','기도 노트','기도 제목과 응답을 남겨보세요.')+
    '<div class="filters">'+Object.entries(labels).map(([key,label])=>'<button class="pill" data-prayer-filter="'+key+'" aria-pressed="'+(prayerFilter===key)+'">'+label+' '+groups[key].length+'</button>').join('')+'</div>'+
    '<button class="btn primary block" data-action="add-prayer">＋ '+(thought?'생각 기록 추가':'기도제목 추가')+'</button><div class="spaced">'+
    (groups[prayerFilter].map(prayerCard).join('') || '<p class="empty">이곳에 남긴 기록이 아직 없어요.</p>')+'</div>';
}
function prayerCard(item) {
  if (item.kind==='thought') return thoughtCard(item);
  return '<section class="card"><div class="row"><h3 class="item-title">'+esc(item.title)+'</h3><div class="item-actions"><button class="text-action" data-prayer="'+item.id+'">편집</button><button class="text-action destructive" data-delete-prayer="'+item.id+'">삭제</button></div></div>'+
    (item.day?'<p class="muted">'+longDate(item.day)+'</p>':'')+
    (item.body?'<p class="record-text">'+esc(item.body)+'</p>':'')+
    (item.answer?'<div class="answer"><strong>응답 기록</strong><p class="record-text">'+esc(item.answer)+'</p></div>':'')+'</section>';
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
function thoughtCard(item,showDate = true) {
  return '<article class="card thought-card">'+thoughtCopy(item)+'<div class="row thought-card-footer">'+
    (showDate?'<span class="muted">'+(item.day?longDate(item.day):'날짜 미기록')+'</span>':'')+
    calendarItemActions('data-prayer="'+item.id+'"','data-delete-prayer="'+item.id+'"')+'</div></article>';
}
function showThoughtEditor(item) {
  const day = item ? item.day : dateKey();
  dialog(item?'생각 노트 수정':'생각 노트','<p class="thought-date">'+(day?longDate(day):'날짜 미기록')+'</p>'+
    '<textarea name="body" rows="6" required aria-label="생각" placeholder="지금 떠오른 생각을 적어보세요.">'+esc(item?thoughtText(item):'')+'</textarea>'+
    '<button type="submit" class="btn primary block">'+(item?'수정 저장':'저장')+'</button>');
  const form = modal.querySelector('form');
  form.classList.add('thought-dialog');
  form.dataset.thought = item?.id ?? '';
  form.dataset.day = day ?? '';
}
async function saveThought(form) {
  const field = form.elements.body, body = field.value.trim();
  if (!body) return notify('생각을 적어 주세요.');
  const previous = state.prayers;
  const existing = previous.find(item=>item.id===form.dataset.thought && item.kind==='thought');
  if (form.dataset.thought && !existing) return;
  const item = {id:existing?.id ?? newId(),kind:'thought',title:'',body,answer:'',done:false};
  if (validDay(form.dataset.day)) item.day = form.dataset.day;
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
  if (form.isConnected) modal.close();
  render();
  notify('생각 노트에 저장했어요.');
}
function showPrayerEditor(item) {
  if (item?.kind==='thought' || (!item && prayerFilter==='thought')) return showThoughtEditor(item);
  navigate('prayer-edit/'+(item?.id ?? 'new'),view==='calendar'?{returnFromEditor:true}:undefined);
}
function prayerEditorScreen(id) {
  const item = state.prayers.find(prayer=>prayer.id===id);
  if (!item && !['new','thought'].includes(id)) return '<p class="empty">이 기록을 찾을 수 없어요.</p>';
  if (id==='thought' || item?.kind==='thought') {
    queueMicrotask(()=>{ if (view==='prayer-edit') showThoughtEditor(item); });
    return thoughtsScreen();
  }
  return '<div class="post-editor"><p class="eyebrow">'+'기도 노트'+'</p>'+
    '<h1>'+(item?'기도제목 편집':'새 기도제목')+'</h1>'+
    '<form data-prayer-editor="'+id+'">'+
    editorField('제목','title',item?.title,'text','required maxlength="150" placeholder="제목을 입력하세요"')+
    editorField('기록 날짜','day',item?item.day ?? '':dateKey(),'date')+
    editorField('기도 내용','body',item?.body,'textarea','rows="5" placeholder="편하게 적어보세요."')+
    '<details class="post-response" '+(item?.answer || item?.done?'open':'')+'><summary>응답 기록</summary>'+
      editorField('응답 내용','answer',item?.answer,'textarea','rows="3" placeholder="응답받은 이야기를 남겨보세요."')+
      '<label class="check-field"><input name="done" type="checkbox" '+(item?.done?'checked':'')+'> 응답받았어요</label></details>'+
    '<footer><button class="btn" type="button" data-action="back">취소</button><button class="btn primary" type="submit">저장</button></footer></form></div>';
}
async function savePrayer(form) {
  const values = new FormData(form);
  const title = values.get('title').trim();
  if (!title) return notify('제목을 입력해 주세요.');
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
  prayerFilter = item.done?'answered':'open';
  if (history.state?.returnFromEditor) history.back();
  else {
    history.replaceState(history.state,'','#prayers');
    render();
  }
  notify('기록을 저장했어요.');
}
function newYearScreen() {
  const years = [...new Set(state.newYear.map(item=>item.year))].sort((a,b)=>b-a);
  return heading('YEARLY VERSES','새해 말씀','한 해 동안 붙들고 싶은 말씀을 연도별로 모아보세요.')+
    '<button class="btn primary block spaced" data-action="add-year">＋ 새해 말씀 추가</button>'+
    (years.map(year=>'<div class="section-head"><h2>'+year+'년</h2></div>'+
      state.newYear.filter(item=>item.year===year).map(item=>'<section class="card"><div class="row"><h3 class="item-title">'+esc(item.title)+'</h3>'+
        '<button type="button" class="icon-action" data-year-edit="'+item.id+'" aria-label="새해 말씀 편집" title="새해 말씀 편집">'+icon('edit')+'</button></div>'+
        (item.day?'<p class="muted">'+esc(item.day)+'</p>':'')+item.refs.map(ref=>'<div class="year-verse"><button class="note-link" data-visit="'+ref+'">'+esc(reference(ref))+' · '+esc(editionLabel(readRef(ref).edition))+'</button><p class="record-text">'+esc(savedVerseText(ref))+'</p></div>').join('')+
        (item.note?'<p class="record-text">'+esc(item.note)+'</p>':'')+'</section>').join('')
    ).join('') || '<p class="empty spaced">성경에서 구절을 골라 담거나, 기억하고 싶은 말씀을 직접 적어보세요.</p>');
}
let yearRefs = [];
function showYearEditor(item,refs = []) {
  editId = item?.id;
  yearRefs = item?.refs ?? refs;
  const firstRef = yearRefs[0];
  dialog(item?'새해 말씀 편집':'새해 말씀 추가',
    editorField('연도','year',item?.year ?? new Date().getFullYear(),'number','min="1900" max="9999" required')+
    editorField('기록 날짜','day',item?item.day ?? '':dateKey(),'date')+
    editorField('말씀 제목 또는 구절','title',item?.title ?? (firstRef?reference(firstRef):''),'text','required maxlength="150"')+
    (firstRef?'<p class="muted">'+yearRefs.map(reference).map(esc).join(' · ')+'</p>':'')+
    editorField('붙들고 싶은 마음이나 말씀','note',item?.note,'textarea')+editorActions('year',item));
}
function saveYear() {
  const form = modal.querySelector('form');
  if (!form.reportValidity()) return;
  const values = new FormData(form);
  const title = values.get('title').trim();
  if (!title) return notify('말씀 제목이나 구절을 입력해 주세요.');
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
  const comment = state.journal[day]?.comments?.find(item=>item.id===id);
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
  const labels = {journal:'묵상',prayer:state.prayers.some(item=>item.id===id && item.kind==='thought')?'생각 기록':'기도제목',comment:'댓글',year:'새해 말씀',note:'구절 메모',dailyNote:'말씀 묵상',bundle:'구절 모음'};
  const label = labels[kind];
  const details = kind==='journal'?'이 날짜의 묵상, 댓글, 담아둔 구절과 QT 체크가 함께 삭제돼요.':
    kind==='prayer'?'이 게시글의 내용이 함께 삭제돼요.':kind==='note'?reference(id)+'에 남긴 메모를 삭제할까요?':'이 기록을 삭제할까요?';
  pendingRemoval = {kind,id,day,label};
  dialog(label+' 삭제','<p>'+details+'</p><div class="row"><button class="btn" value="cancel">취소</button><button type="button" class="btn danger" data-action="delete-item">삭제 확인</button></div>');
}
async function removeItem() {
  if (!pendingRemoval) return;
  const {kind,id,day,label} = pendingRemoval;
  const [container,key] = kind==='journal'?[state.journal,id]:
    kind==='dailyNote'?[state.dailyNotes,id]:kind==='comment'?[state.journal[day],'comments']:kind==='note'?[state.marks,id]:
    [state,kind==='prayer'?'prayers':kind==='bundle'?'verseBundles':'newYear'];
  const previous = container?.[key];
  if (!previous) { modal.close(); return; }
  if (kind==='journal' || kind==='dailyNote') delete container[key];
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
    } else render();
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
  if (document.hidden) return;
  if ((view==='today' || view==='calendar') && renderedDailyDate!==dateKey()) render();
  refreshLocalEditions();
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
try {
  db = await openDB();
  const [saved,imported,font] = await Promise.all([
    loadLocal('journal'),readLocalEditions().catch(()=>({added:[]})),loadLocal('custom-font').catch(()=>null),
  ]);
  for (const edition of imported.added) registerLocalEdition(edition);
  state = migrate(saved ?? blank());
  if (font) {
    try { activateFont(font.name,await loadFontFace(font.bytes)); }
    catch { /* Use the default font when the device cannot load the saved file. */ }
  }
} catch {
  writeError = true;
}
resetRestoredAndroidSettings();
render();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).catch(() => {});
