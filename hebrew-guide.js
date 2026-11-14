const rows=[
 ['니산','נִיסָן','아빕 · אָבִיב','3–4월','30일','유다','ה · 헤','보리 등 곡물 수확 시작 · 늦은 비','EXO/12/2'],
 ['이야르','אִיָּר','지브 · זִו','4–5월','29일','잇사갈','ו · 바브','수확이 이어지는 때 · 건기로 전환','1KI/6/1'],
 ['시완','סִיוָן','','5–6월','30일','스불론','ז · 자인','밀 수확 · 건기','EST/8/9'],
 ['탐무즈','תַּמּוּז','','6–7월','29일','르우벤','ח · 헤트','여름 농작물과 포도 돌보기','ZEC/8/19'],
 ['아브','אָב','','7–8월','30일','시므온','ט · 테트','포도·여름 과실 수확','NUM/33/38'],
 ['엘룰','אֱלוּל','','8–9월','29일','갓','י · 요드','포도·무화과 등 과실 수확','NEH/6/15'],
 ['티슈리','תִּשְׁרֵי','에다님 · אֵתָנִים','9–10월','30일','에브라임','ל · 라메드','추수 마무리 · 이른 비가 시작되는 시기','1KI/8/2'],
 ['헤슈반','חֶשְׁוָן','불 · בּוּל','10–11월','29일 또는 30일','므낫세','נ · 눈','우기 · 밭갈이와 씨뿌리기','1KI/6/38'],
 ['키슬레브','כִּסְלֵו','','11–12월','29일 또는 30일','베냐민','ס · 사메크','우기 · 겨울 농사','ZEC/7/1'],
 ['테베트','טֵבֵת','','12–1월','29일','단','ע · 아인','비가 내리는 겨울','EST/2/16'],
 ['쉐바트','שְׁבָט','','1–2월','30일','아셀','צ · 차디','겨울 농사와 이른 꽃피움','ZEC/1/7'],
 ['아다르','אֲדָר','','2–3월','평년 29일','납달리','ק · 코프','봄으로 전환 · 감귤류 등 겨울 과실','EST/3/7']
];
let section='cycle',order='civil',cycleMonth=0;
const safe=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function hebrewGuideAction(t){
 if(t.hebrewGuideSection && ['months','cycle'].includes(t.hebrewGuideSection)){section=t.hebrewGuideSection;return true;}
 if('hebrewCycleMonth' in t){const month=Number(t.hebrewCycleMonth);if(Number.isInteger(month)&&month>=0&&month<12){cycleMonth=month;return true;}}
 if(t.hebrewGuideOrder){order=t.hebrewGuideOrder;return true;}
 return false;
}
const toggle=(key,choices,current)=>'<div class="jewish-guide-switch">'+choices.map(([id,label])=>'<button type="button" data-'+key+'="'+id+'" aria-pressed="'+(id===current)+'">'+label+'</button>').join('')+'</div>';
function monthGuide(){
 const sorted=rows.map((r,i)=>({r,biblical:i+1,civil:(i+6)%12+1})).sort((a,b)=>a[order]-b[order]);
 return '<section class="card jewish-guide-intro"><h2>같은 달력, 다른 시작점</h2><p>민간력은 티슈리를 새해의 시작으로 보고, 성서의 월 순서는 니산(아빕)을 첫째 달로 셉니다. 아래 월 순서는 평년 기준이에요.</p>'+toggle('hebrew-guide-order',[['civil','민간력 · 티슈리부터'],['biblical','성서력 · 니산부터']],order)+'</section><div class="jewish-month-grid">'+sorted.map(({r,biblical,civil})=>'<article class="card jewish-month-card"><header><span class="jewish-month-index">'+(order==='civil'?civil:biblical)+'월</span><div class="jewish-month-names"><div class="jewish-month-primary"><h2>'+r[0]+'</h2><bdi lang="he">'+r[1]+'</bdi></div>'+(r[2]?'<span class="jewish-month-alias-inline" aria-label="다른 이름 '+r[2].split(' · ')[0]+'">('+r[2].split(' · ')[0]+' <bdi lang="he">'+r[2].split(' · ')[1]+'</bdi>)</span>':'')+'</div></header>'+'<dl><div><dt>월 순서</dt><dd>민간력 '+civil+'월 · 성서력 '+biblical+'월</dd></div><div><dt>양력 무렵</dt><dd>'+r[3]+'</dd></div><div><dt>일수</dt><dd>'+r[4]+'</dd></div></dl><details><summary>제공 자료의 지파·문자 연결</summary><p>지파 · '+r[5]+'<br>히브리 문자 · <bdi>'+r[6]+'</bdi></p></details><button class="text-action" type="button" data-atlas-ref="'+r[8]+'">관련 본문 보기 →</button></article>').join('')+'</div><aside class="card jewish-guide-note"><h2>윤년에는 아다르가 두 달</h2><p>19년 주기의 3·6·8·11·14·17·19번째 해는 윤년입니다. 현대 유대력에서는 아다르 1(30일)과 아다르 2(29일)를 두어 계절을 맞춥니다. 헤슈반과 키슬레브의 길이도 해마다 달라질 수 있어요.</p><p>양력 대응은 대략적인 계절 범위이며, 실제 날짜는 달력의 히브리력 표시를 확인해 주세요. 지파·문자 연결은 제공된 학습 자료의 전통적 연결이며 성경이 각 달에 지정한 규정은 아닙니다.</p></aside>';
}
function cycleGuide(){
 const festivals={
  0:[['10일','유월절 양을 고르는 날'],['14일','유월절 준비·제사'],['15–21일','무교절']],
  2:[['6일','칠칠절·오순절 · 해외 공동체는 7일까지']],
  3:[['17일','탐무즈 17일 금식']],4:[['9일','아브 9일 금식']],
  6:[['1일','나팔절·로쉬 하샤나'],['10일','대속죄일'],['15–21일','초막절'],['22일','여덟째 날 성회']],
  8:[['25일부터 8일','하누카·수전절']],9:[['10일','테베트 10일 금식']],
  11:[['14일','부림절'],['15일','수산 부림절 · 윤년에는 아다르 2']]
 };
 const point=(radius,degrees)=>{const a=degrees*Math.PI/180;return [220+radius*Math.cos(a),220+radius*Math.sin(a)];};
 const arcs=rows.map((r,i)=>{const a=-90+i*30+.8,b=a+28.4,p=point(205,a),q=point(205,b),u=point(112,b),v=point(112,a);return '<path class="jewish-wheel-sector '+(i<6?'dry':'rain')+(cycleMonth===i?' selected':'')+'" d="M'+p.join(' ')+' A205 205 0 0 1 '+q.join(' ')+' L'+u.join(' ')+' A112 112 0 0 0 '+v.join(' ')+' Z"/>';}).join('');
 const r=rows[cycleMonth],events=festivals[cycleMonth] ?? [];
 const wheel='<div class="jewish-year-wheel"><svg viewBox="0 0 440 440" aria-hidden="true">'+arcs+'<text class="jewish-wheel-center" x="220" y="202" text-anchor="middle">'+r[0]+'</text><text class="jewish-wheel-center-meta" x="220" y="230" text-anchor="middle">'+r[3]+' 무렵</text><text class="jewish-wheel-center-meta" x="220" y="255" text-anchor="middle">'+(cycleMonth<6?'수확 · 건기 쪽':'파종 · 우기 쪽')+'</text></svg>'+rows.map((month,i)=>{const [x,y]=point(158,-75+i*30);return '<button type="button" data-hebrew-cycle-month="'+i+'" aria-pressed="'+(cycleMonth===i)+'" aria-label="'+month[0]+' 절기와 계절" style="left:'+x/4.4+'%;top:'+y/4.4+'%"><strong>'+month[0]+'</strong><span>'+(i+1)+'월</span></button>';}).join('')+'</div>';
 return '<section class="card jewish-cycle-card"><header><h2>한 해의 절기와 계절</h2><p>월을 누르면 그 달의 절기와 농사 흐름이 보여요.</p></header>'+wheel+'<div class="jewish-wheel-legend"><span class="dry">건기 · 수확</span><span class="rain">우기 · 파종</span></div><p class="jewish-cycle-caption">니산을 1월로 세는 성서력 순서입니다. 비와 농사 시기는 이스라엘의 대표적인 계절 흐름이며 지역과 해에 따라 달라요.</p></section><section class="card jewish-cycle-detail" aria-live="polite"><header><div><p>성서력 '+(cycleMonth+1)+'월 · 민간력 '+((cycleMonth+6)%12+1)+'월</p><h2>'+r[0]+' <bdi lang="he">'+r[1]+'</bdi></h2></div><span>'+r[3]+'</span></header><div class="jewish-cycle-season"><span>계절과 농사</span><p>'+r[7]+'</p></div><h3>이달의 절기와 기념일</h3>'+(events.length?'<ul>'+events.map(([date,name])=>'<li><span>'+date+'</span><strong>'+name+'</strong></li>').join('')+'</ul>':'<p class="jewish-no-feast">이 안내에서 따로 표시한 주요 절기는 없어요.</p>')+'<button type="button" class="text-action" data-atlas-ref="'+r[8]+'">관련 본문 보기 →</button></section><aside class="card jewish-guide-note"><h2>날짜를 볼 때</h2><p>절기의 실제 양력 날짜는 달력에서 확인할 수 있어요. 이스라엘·해외 공동체의 절기 기간 차이와 안식일에 따른 금식일 이동은 기존 달력 계산을 따릅니다.</p><p>초실절의 날짜 해석은 전통마다 다릅니다. 윤년에는 아다르 1·2가 있으며 부림절은 아다르 2에 지킵니다. 위 원은 평년의 12달 흐름을 보여줍니다.</p></aside>';
}
export function hebrewGuideScreen(){return '<header class="page-heading"><p class="eyebrow">JEWISH CALENDAR</p><h1>유대력 · 민간력과 성서력</h1><p class="lead">월의 이름과 순서, 절기와 계절을 살펴보세요.</p></header>'+toggle('hebrew-guide-section',[['cycle','절기·계절'],['months','월별 안내']],section)+(section==='months'?monthGuide():cycleGuide())+'<details class="jewish-guide-sources"><summary>자료와 확인 기준</summary><p>월별 지파·문자 연결과 계절 흐름 참고: 사용자 제공 자료를 앱 화면으로 재구성. 월 일수와 윤달 설명: <a href="https://hebcal.github.io/api/hdate/enums/months.html" target="_blank" rel="noopener">Hebcal</a>, <a href="https://eclipse.gsfc.nasa.gov/SEhelp/calendars.html" target="_blank" rel="noopener">NASA 달력 설명</a>. 민간력·월 이름: <a href="https://www.chabad.org/library/article_cdo/aid/526874/jewish/The-Jewish-Month.htm" target="_blank" rel="noopener">Chabad</a>. 절기 날짜: <a href="https://www.hebcal.com/holidays/shavuot?i=on" target="_blank" rel="noopener">Hebcal 절기 안내</a>. 계절·농사 흐름은 제공 도표를 지역·계절 개요로 정리했습니다.</p></details>';}
