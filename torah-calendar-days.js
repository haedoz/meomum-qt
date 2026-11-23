import {HDate,HebrewCalendar} from './vendor/hebcal.mjs';
import aliyot from './vendor/torah-aliyot.js';
export {torahVerseCounts} from './torah-data.js';
const cache=new Map();
export function adjacentTorahDay(day,offset){
 const date=new Date(day+'T12:00:00');date.setDate(date.getDate()+offset);
 const year=date.getFullYear();return year>=1&&year<=9999?String(year).padStart(4,'0')+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0'):null;
}
export function dailyTorah(day,israel=true){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day))return;
 const date=new Date(day+'T12:00:00');if(!Number.isFinite(+date)||date.getFullYear()<1||date.getFullYear()>9999)return;
 const id=Number(israel)+'|'+day;if(cache.has(id))return cache.get(id);
 const hd=new HDate(date),part=date.getDay()+1;
 // Simchat Torah completes the cycle, then begins Genesis (Israel: 22 Tishrei;
 // diaspora: 23 Tishrei). Other festival weeks continue daily weekly study.
 let result;
 if(hd.getMonth()===7&&hd.getDate()===(israel?22:23))result={name:'베조트 하브라카 · 베레쉬트',part:0,special:true,ranges:[['DEU',33,1,34,12],['GEN',1,1,2,3]]};
 else{
  let cursor=hd,reading;
  for(let n=0;n<5;n++){
   reading=HebrewCalendar.getSedra(cursor.getFullYear(),israel).lookup(cursor);
   if(!reading.chag)break;
   cursor=new HDate(reading.hdate.abs()+7);
  }
  let key=reading.parsha.join('-');
  // Between Haazinu and Simchat Torah, study Vezot Haberakhah.
  const simchat=new HDate(israel?22:23,7,hd.getFullYear());
  if(hd.abs()<simchat.abs()&&simchat.abs()<=reading.hdate.abs())key='Vezot Haberakhah';
  const portion=aliyot[key];if(!portion)return;
  result={name:portion.name,part,ranges:portion.aliyot[part-1],sabbath:adjacentTorahDay(day,reading.hdate.abs()-hd.abs())};
 }
 if(cache.size>1500)cache.clear();cache.set(id,result);return result;
}
export const torahDays=new Proxy(Object.create(null),{get(_target,day){
 if(typeof day!=='string')return;
 let israel=true;try{israel=localStorage.getItem('logbible-hebrew-israel')!=='false';}catch{}
 return dailyTorah(day,israel);
}});
