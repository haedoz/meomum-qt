import { books } from './books.js';

const sqliteSignature = 'SQLite format 3\0';
const maxFileSize = 96 * 1024 * 1024;
let engine;

export function bdbSizeSupported(size) {
  return size >= 100 && size <= maxFileSize;
}
function fileId(bytes) {
  let first = 2166136261, second = 0x9e3779b9;
  for (const byte of bytes) {
    first = Math.imul(first ^ byte,16777619);
    second = Math.imul(second ^ byte,1597334677);
  }
  return 'local-'+[first,second].map(hash=>(hash>>>0).toString(16).padStart(8,'0')).join('');
}
function plainVerse(text,preserveCodes) {
  const entities = {amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '};
  return text.replace(/<br\s*\/?>/gi,'\n')
    .replace(/<\/?[a-z][^>]*>/gi,tag=>preserveCodes && /^<W?[HG](?:\s*\d|[<>])/i.test(tag)?tag:'')
    .replace(/&(amp|lt|gt|quot|apos|nbsp);/g,(_,key)=>entities[key])
    .trim();
}

function fileLabel(name) {
  return name.normalize('NFC').trim().replace(/\s*\(\d+\)$/,'')
    .replace(/\.[bcs]db$/i,'').replace(/\s*\(\d+\)$/,'').trim().slice(0,72);
}
export function editionName(label) {
  return fileLabel(label).replace(/\s+(\d+)$/,(suffix,number)=>Number(number)<1000?'':suffix).replace(/\s+/g,'');
}
export function editionKind(label,declared = 'bible') {
  const name = editionName(label);
  if (/^(?:BHSStp|LXXStp|한국어직역)$/i.test(name)) return 'bible';
  if (['원전분해','개역개정S','개역한글S','KJV_S'].includes(name)) return 'original';
  if (['만나주석','매튜헨리','랑게렌스키'].includes(name)) return 'commentary';
  if (['쉬운성경','바른성경','개역개정','ESV','NIV1984','NIV2011'].includes(name)) return 'bible';
  return declared;
}

function dictionaryText(value) {
  const entities = {amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '};
  return value.replace(/\r\n?/g,'\n')
    .replace(/<(?:br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/gi,'\n')
    .replace(/<\/?[a-z][^>]*>/gi,'')
    .replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi,(match,key)=>{
      if (key[0]!=='#') return entities[key.toLowerCase()];
      const code = key[1].toLowerCase()==='x'?parseInt(key.slice(2),16):Number(key.slice(1));
      return code>0 && code<=0x10ffff?String.fromCodePoint(code):match;
    }).trim();
}
function strongKey(value) {
  const match = String(value).trim().match(/^W?([HG])\s*0*(\d{1,5})([a-z]?)$/i);
  return match ? (match[1]+Number(match[2])+match[3]).toUpperCase() : '';
}
function readDictionary(db) {
  const entries = {};
  const tables = db.exec("SELECT name FROM sqlite_schema WHERE type='table' AND sql LIKE 'CREATE TABLE%' AND name NOT LIKE 'sqlite_%' LIMIT 20")[0]?.values ?? [];
  for (const [table] of tables) {
    const query = 'SELECT * FROM "'+table.replace(/"/g,'""')+'"';
    const sample = db.exec(query+' LIMIT 40')[0];
    if (!sample?.values.length) continue;
    const codes = sample.columns.findIndex((_,index)=>sample.values.some(row=>strongKey(row[index])));
    const textColumns = sample.columns.map((name,index)=>({name,index})).filter(({index})=>index!==codes &&
      sample.values.some(row=>typeof row[index]==='string' && row[index].length>12));
    if (!textColumns.length) continue;
    const content = textColumns.find(({name})=>/definition|content|body|[a-z]?text|data|description|meaning/i.test(name)) ??
      textColumns.reduce((best,column)=>sample.values.reduce((sum,row)=>sum+(String(row[column.index] ?? '').length),0)>
        sample.values.reduce((sum,row)=>sum+(String(row[best.index] ?? '').length),0)?column:best);
    if (codes<0 && !sample.values.some(row=>typeof row[content.index]==='string' &&
        /\bW?[HG]\s*\d{1,5}[a-z]?\b/i.test(dictionaryText(row[content.index].slice(0,600))))) continue;
    const rows = db.exec(query+' LIMIT 40001')[0].values;
    if (rows.length>40000) throw Error('unsupported dictionary size');
    for (const row of rows) {
      if (typeof row[content.index]!=='string' || row[content.index].length>300000) continue;
      const text = dictionaryText(row[content.index]);
      const heading = text.slice(0,200).match(/^\s*W?[HG]\s*\d{1,5}[a-z]?\b/i)?.[0];
      const key = strongKey(row[codes]) || strongKey(heading);
      if (key && text) entries[key] = text;
    }
  }
  if (!Object.keys(entries).length) throw Error('unsupported Strong dictionary');
  return entries;
}

export async function readBdb(bytes,name,canonical,openDatabase) {
  if (!bdbSizeSupported(bytes.byteLength) || String.fromCharCode(...bytes.subarray(0,16))!==sqliteSignature) {
    throw Error('unsupported SQLite file');
  }
  if (!openDatabase) {
    engine ??= import('./vendor/sql-wasm.mjs').then(({default:init})=>
      init({locateFile:file=>new URL('./vendor/'+file,import.meta.url).href})).catch(error=>{
        engine = undefined;
        throw error;
      });
    const sqlite = await engine;
    openDatabase = data => new sqlite.Database(data);
  }
  const db = openDatabase(bytes);
  try {
    db.run('PRAGMA trusted_schema=OFF; PRAGMA query_only=ON;');
    if (/\.dct\s*(?:\(\d+\))?$/i.test(name.trim())) {
      const label = name.normalize('NFC').trim().replace(/\.dct.*$/i,'').slice(0,72) || '원어사전';
      return {id:fileId(bytes),label,entries:readDictionary(db),kind:'dictionary'};
    }
    const declaration = db.exec("SELECT sql FROM sqlite_schema WHERE name='Bible' COLLATE NOCASE AND type='table'");
    if (!/^CREATE\s+TABLE\b/i.test(declaration[0]?.values[0]?.[0] ?? '')) throw Error('unsupported Bible table');
    const rows = db.exec('SELECT book, chapter, verse, btext FROM Bible LIMIT 40001')[0]?.values ?? [];
    if (!rows.length || rows.length>40000) throw Error('unsupported verse count');
    const ext = name.trim().replace(/\s*\(\d+\)$/,'').toLowerCase().slice(-4);
    const samples = rows.slice(0,40).map(([, , ,text])=>typeof text==='string'?text:'');
    const hasOriginalCodes = samples.filter(text=>(text.match(/<W[HG]\s*\d+[A-Za-z]?\s*>/gi)?.length ?? 0)>=2).length>=2;
    const kind = editionKind(name,hasOriginalCodes || ext==='.sdb'?'original':ext==='.cdb'?'commentary':'bible');
    const commentary = kind==='commentary', original = kind==='original';
    // Some Bible editions include a verse numbered 0 (for example, LXXStp at Daniel 5:0).
    const firstVerse = original ? 1 : 0;
    const verses = {};
    for (const [number,chapter,verse,text] of rows) {
      if ((commentary && text==null) || (original && (text==null || (typeof text==='string' && !text.trim())))) continue;
      const book = Number.isInteger(number) ? books[number-1]?.[0] : undefined;
      if (!book || !Number.isInteger(chapter) || chapter<1 || chapter>canonical[book] ||
          !Number.isInteger(verse) || verse<firstVerse || verse>(commentary?9999:500) || typeof text!=='string' || text.length>(commentary?3000000:10000)) {
        throw Error('invalid verse');
      }
      const bookData = verses[book] ??= {};
      const chapterData = bookData[chapter] ??= {};
      const content = plainVerse(text,original);
      if (Object.hasOwn(chapterData,verse) && !commentary) throw Error('duplicate verse');
      chapterData[verse] = chapterData[verse] ? chapterData[verse]+'\n\n'+content : content;
    }
    if (!Object.keys(verses).length) throw Error('empty file');
    const label = fileLabel(name) || (commentary?'내 주석':original?'내 원어 자료':'내 성경');
    return {id:fileId(bytes),label,verses,kind,formatVersion:2};
  } finally {
    db.close();
  }
}
