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
let section='months',order='civil';
const safe=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function hebrewGuideAction(t){
 if(t.hebrewGuideSection){section=t.hebrewGuideSection;return true;}
 if(t.hebrewGuideOrder){order=t.hebrewGuideOrder;return true;}
 return false;
}
const toggle=(key,choices,current)=>'<div class="jewish-guide-switch">'+choices.map(([id,label])=>'<button type="button" data-'+key+'="'+id+'" aria-pressed="'+(id===current)+'">'+label+'</button>').join('')+'</div>';
function monthGuide(){
 const sorted=rows.map((r,i)=>({r,biblical:i+1,civil:(i+6)%12+1})).sort((a,b)=>a[order]-b[order]);
 return '<section class="card jewish-guide-intro"><h2>같은 달력, 다른 시작점</h2><p>민간력은 티슈리를 새해의 시작으로 보고, 성서의 월 순서는 니산(아빕)을 첫째 달로 셉니다. 아래 월 순서는 평년 기준이에요.</p>'+toggle('hebrew-guide-order',[['civil','민간력 · 티슈리부터'],['biblical','성서력 · 니산부터']],order)+'</section><div class="jewish-month-grid">'+sorted.map(({r,biblical,civil})=>'<article class="card jewish-month-card"><header><span class="jewish-month-index">'+(order==='civil'?civil:biblical)+'월</span><div><h2>'+r[0]+'</h2><bdi lang="he">'+r[1]+'</bdi></div></header>'+(r[2]?'<p class="jewish-month-alias">다른 이름 · '+r[2]+'</p>':'')+'<dl><div><dt>월 순서</dt><dd>민간력 '+civil+'월 · 성서력 '+biblical+'월</dd></div><div><dt>양력 무렵</dt><dd>'+r[3]+'</dd></div><div><dt>일수</dt><dd>'+r[4]+'</dd></div></dl><details><summary>제공 자료의 지파·문자 연결</summary><p>지파 · '+r[5]+'<br>히브리 문자 · <bdi>'+r[6]+'</bdi></p></details><button class="text-action" type="button" data-atlas-ref="'+r[8]+'">관련 본문 보기 →</button></article>').join('')+'</div><aside class="card jewish-guide-note"><h2>윤년에는 아다르가 두 달</h2><p>19년 주기의 3·6·8·11·14·17·19번째 해는 윤년입니다. 현대 유대력에서는 아다르 1(30일)과 아다르 2(29일)를 두어 계절을 맞춥니다. 헤슈반과 키슬레브의 길이도 해마다 달라질 수 있어요.</p><p>양력 대응은 대략적인 계절 범위이며, 실제 날짜는 달력의 히브리력 표시를 확인해 주세요. 지파·문자 연결은 제공된 학습 자료의 전통적 연결이며 성경이 각 달에 지정한 규정은 아닙니다.</p></aside>';
}
function cycleGuide(){
 const festivals=[['니산','유월절 준비·제사 14일 · 무교절 15–21일','EXO/12/6'],['시완','칠칠절·오순절: 현대 유대력 시완 6일, 해외 공동체는 7일까지','LEV/23/15'],['티슈리','나팔절 1일 · 대속죄일 10일 · 초막절 15–21일 · 여덟째 날 성회 22일','LEV/23/24'],['키슬레브','하누카·수전절: 25일부터 8일간','JHN/10/22'],['아다르','부림절 14일 · 수산 부림절 15일, 윤년에는 아다르 2','EST/9/21']];
 return '<section class="card jewish-guide-intro"><h2>절기와 계절을 함께 보기</h2><p>이스라엘 지역의 대표적인 농사·강우 흐름이에요. 지역과 해에 따라 시기는 달라집니다.</p></section><div class="jewish-season-grid">'+[['건기','대체로 늦봄부터 여름·초가을','니산–엘룰 무렵 · 곡물과 과실 수확'],['우기','대체로 가을부터 겨울·봄','티슈리–아다르 무렵 · 이른 비, 파종, 늦은 비']].map(([title,time,body])=>'<article class="card"><h2>'+title+'</h2><p>'+time+'</p><small>'+body+'</small></article>').join('')+'</div><section class="card jewish-festival-list"><h2>주요 절기</h2>'+festivals.map(([month,body,ref])=>'<article><strong>'+month+'</strong><p>'+body+'</p><button type="button" class="text-action" data-atlas-ref="'+ref+'">관련 본문 →</button></article>').join('')+'<p class="muted">초실절의 날짜 해석은 전통에 따라 다릅니다. 원본 도표의 날짜를 모든 전통의 고정 날짜로 사용하지 않습니다. 절기의 실제 양력 날짜와 이스라엘·해외 공동체의 차이는 기존 달력 계산을 따릅니다.</p></section><section class="card"><h2>월별 계절 흐름</h2><div class="jewish-season-list">'+rows.map(r=>'<div><strong>'+r[0]+'</strong><span>'+r[7]+'</span></div>').join('')+'</div></section>';
}
function originals(){return '<p class="jewish-original-caption">보내주신 원본 자료예요. 그림을 누르면 크게 열 수 있어요. 윤달·절기 날짜 설명은 월별 안내와 절기·계절 탭에서 보완했습니다.</p>'+[['months-nisan-elul.jpeg','니산부터 엘룰까지'],['months-tishrei-adar.jpeg','티슈리부터 아다르까지'],['year-cycle.jpeg','절기와 계절 순환 도표']].map(([file,title])=>'<figure class="card jewish-original"><figcaption>'+title+'</figcaption><a href="./calendar-reference/'+file+'" target="_blank" rel="noopener"><img src="./calendar-reference/'+file+'" alt="'+title+' · 사용자 제공 자료" loading="lazy"></a></figure>').join('');}
export function hebrewGuideScreen(){return '<header class="page-heading"><p class="eyebrow">JEWISH CALENDAR</p><h1>유대력 · 민간력과 성서력</h1><p class="lead">월의 이름과 순서, 절기와 계절을 살펴보세요.</p></header>'+toggle('hebrew-guide-section',[['months','월별 안내'],['cycle','절기·계절'],['originals','원본 자료']],section)+(section==='months'?monthGuide():section==='cycle'?cycleGuide():originals())+'<details class="jewish-guide-sources"><summary>자료와 확인 기준</summary><p>월별 지파·문자 연결과 원본 도표: 사용자 제공 자료. 월 일수와 윤달 설명: <a href="https://hebcal.github.io/api/hdate/enums/months.html" target="_blank" rel="noopener">Hebcal</a>, <a href="https://eclipse.gsfc.nasa.gov/SEhelp/calendars.html" target="_blank" rel="noopener">NASA 달력 설명</a>. 민간력·월 이름: <a href="https://www.chabad.org/library/article_cdo/aid/526874/jewish/The-Jewish-Month.htm" target="_blank" rel="noopener">Chabad</a>. 절기 날짜: <a href="https://www.hebcal.com/holidays/shavuot?i=on" target="_blank" rel="noopener">Hebcal 절기 안내</a>. 계절·농사 흐름은 제공 도표를 지역·계절 개요로 정리했습니다.</p></details>';}
