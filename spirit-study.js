import {spiritStudyChapters} from './spirit-study-data.js';
let selected=0;
const safe=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function spiritStudyAction(target){if(!('spiritChapter' in target))return false;const index=Number(target.spiritChapter);if(!Number.isInteger(index)||index<0||index>=spiritStudyChapters.length)return false;selected=index;return true;}
function comparisonTable(table,title){return `<section class="spirit-reference-table"><h3>${safe(title)}</h3><div role="table" aria-label="${safe(title)}"><div class="spirit-table-head" role="row">${table.columns.map(c=>`<span role="columnheader">${safe(c)}</span>`).join('')}</div>${table.rows.map(row=>`<div class="spirit-table-row" role="row"><strong role="rowheader">${safe(row[0])}</strong>${row.slice(1).map((text,i)=>`<div role="cell"><small>${safe(table.columns[i+1])}</small><p>${safe(text)}</p></div>`).join('')}</div>`).join('')}</div></section>`;}
function chapterBody(chapter,renderStudyBlocks){
 const index=chapter.blocks.findIndex(([kind])=>kind==='table');
 if(index<0)return renderStudyBlocks(chapter.blocks);
 const before=chapter.blocks.slice(0,index),after=chapter.blocks.slice(index+1);const title=before.at(-1)?.[0]==='h'?before.pop()[1]:'삶의 변화 비교';
 return renderStudyBlocks(before)+comparisonTable(chapter.table,title)+renderStudyBlocks(after);
}
export function spiritStudyContent(renderStudyBlocks){const chapter=spiritStudyChapters[selected];return `<nav class="spirit-chapter-picker" aria-label="일곱 영 학습 주제">${spiritStudyChapters.map((item,i)=>`<button type="button" data-spirit-chapter="${i}" aria-pressed="${i===selected}"><span>0${i+1}</span>${safe(item.title)}</button>`).join('')}</nav><article class="study-prose study-panel study-full-detail spirit-study-article"><header><h2>${safe(chapter.title)}</h2><small>${safe(chapter.english)}</small></header>${chapterBody(chapter,renderStudyBlocks)}</article>`;}
