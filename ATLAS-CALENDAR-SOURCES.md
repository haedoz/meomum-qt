# 지도·달력 자료와 편집 기준

## 성경 여정

사건 순서와 본문 주소는 atlas-data.js의 steps/sourceRefs에 들어 있습니다. 아브라함의 애굽 방문은 창세기 12:10, 네겝으로의 귀환은 13:1에 근거해 표시합니다.

지명 식별은 OpenBible.info Bible Geocoding Data의 ancient.jsonl 및 modern.jsonl 원자료와 대조했습니다. 해당되는 항목은 placeNotes에 실제 지명 페이지 주소와 위치 확실성 표기를 기록했습니다. 출처: https://github.com/openbibleinfo/Bible-Geocoding-Data — CC BY 4.0. 위치 후보가 갈리는 곳은 일반적인 위치로 단정하지 않습니다. 좌표가 지역의 대표점인 애굽·모압 평지·네겝과 바다 횡단 지점을 확정 도시 좌표와 구분해 표시합니다.

경로는 성경이 말하는 주요 방문 순서와 전통적인 이동권을 구분합니다. 중간 연결선은 측량되거나 확인된 발자취가 아닙니다. 아브라함의 유프라테스–레반트 이동권, 출애굽 광야 경로와 바울의 해상 항로에는 복원·추정이 포함됩니다. 북이스라엘 포로들의 유배지는 열왕기하 17:6이 열거한 여러 목적지이며 하나의 확정 이동 순서로 읽지 않습니다.

## 지형과 현대 지리

Natural Earth v5.1.2의 1:50m land, lakes, admin_0_countries GeoJSON 원본에서 해당 지역 도형을 추출했습니다. Public domain. 출처: https://github.com/nvkelso/natural-earth-vector/tree/v5.1.2/geojson
https://www.naturalearthdata.com/about/terms-of-use/

현대 이스라엘 보기는 이 자료가 구분한 이스라엘·팔레스타인과 주변 국가의 현대 지리 비교입니다. 실시간 통제선 또는 분쟁 지역의 최종적 법적 경계를 보증하지 않습니다. 해당 자료 버전은 지도 화면에 표시합니다.

## 12지파

원본 “12 Tribes of Israel Map.svg”, Janz / יוסי / Kordas / Richardprins 및 후속 번역자들의 작업. https://commons.wikimedia.org/wiki/File:12_Tribes_of_Israel_Map.svg
CC BY-SA 3.0: https://creativecommons.org/licenses/by-sa/3.0/
기존 한국어 switch 번역을 선택하고 다른 언어 분기만 정리했습니다. 원본의 경계·지명 위치·도형을 유지했습니다. 이 파생 지도도 CC BY-SA 3.0으로 제공합니다. 여호수아 13–19장의 전통적 분배 해석도이며 모든 지역의 실제 정복을 뜻하지 않습니다. 단의 북쪽 이동 이전입니다.

## 남유다·북이스라엘

원본 “Kingdoms of Israel and Judah (8th century BCE).svg”, Tobias Schäfer 87, 2026. https://commons.wikimedia.org/wiki/File:Kingdoms_of_Israel_and_Judah_(8th_century_BCE).svg
CC BY 4.0: https://creativecommons.org/licenses/by/4.0/
원저자는 경계·도시에 대해 Israel Finkelstein, The Forgotten Kingdom (2013), p.2를 인용했습니다. 지형 GEBCO 2023, 해안선·수계 GSHHG, 음영 NASA SRTM GL3. 이 앱은 도형을 유지하고 언어 분기를 정리하여 주요 영문 지명을 한국어로 편집했습니다. 기원전 8세기 재구성도로, 분열왕국 전체 시대의 고정 경계가 아닙니다.

## 히브리력

@hebcal/core 5.9.0, GPL-2.0. vendor/hebcal-LICENSE.txt 포함. 원본 소스: https://github.com/hebcal/hebcal-es6/tree/v5.9.0
양력일 낮에 대응하는 히브리 날짜를 계산하며 지역별 일몰 시각을 계산하지 않습니다. 이스라엘과 해외 유대 공동체 기준을 선택할 수 있습니다.

## 같은 지도 위의 영역 표시

역사 SVG를 독립 이미지로 표시하지 않고 영역 path만 추출해 같은 지도 위에 올립니다. 두로·예루살렘·브엘세바 등 지명 대응점을 이용한 아핀 좌표 변환입니다. 원본 역사 지도의 일반화와 좌표 변환 오차가 포함되므로 정밀 경계선으로 사용하지 않습니다. 현대 영역은 Natural Earth의 지리 좌표 도형을 그대로 사용합니다. atlas-overlays.js는 원본 역사 자료의 파생물이며 12지파 도형은 CC BY-SA 3.0을 따릅니다.

## 2026-11-13 사용자 캡처 대조 수정

사용자 제공 캡처 3–15번을 각각의 여정 흐름 참고 자료로 사용했습니다. 캡처 1·2·16번은 영역 비교 참고이며 영역 도형의 출처는 위 역사 지도와 Natural Earth를 유지합니다. 캡처의 작은 지명은 정확히 판독할 수 없는 경우가 있어 이미지에 보이는 선을 정밀 측량 자료처럼 복사하지 않았습니다. 주요 지점은 아래 본문과 대조했고, 중간 연결 좌표는 여전히 지리적 재구성입니다. 사용자 캡처 이미지는 배포 파일에 포함하지 않습니다.

- 아브라함: 창 11–13, 21장. 유프라테스·레반트 이동권과 네겝·애굽 왕복. https://bible.usccb.org/bible/genesis/12
- 출애굽: 출 12–19, 민 10–13·33장. 시내산 이후 하세롯·가데스까지 주요 지점 연장. 남부 시내산 견해이며 모든 진영을 그린 것은 아닙니다. https://bible.usccb.org/bible/numbers/33
- 정찰: 민 13:21–26. 남북 범위와 에스골 귀환. 북단 지점과 왕복 중간길은 추정. https://bible.usccb.org/bible/numbers/13
- 가나안 진입·정복: 민 20–22, 신 2, 수 4·6·8–11장. 모세 시대 우회와 여호수아 시대 전투 구분. https://bible.usccb.org/bible/numbers/21
- 북이스라엘 포로기: 왕하 17:6. 복수 유배 목적지를 가지선으로 표현. https://bible.usccb.org/bible/2kings/17
- 남유다 포로기: 왕하 25:6–11. 시드기야의 리블라 이송과 바벨론 유배 주요 지점 개요. https://bible.usccb.org/bible/2kings/25
- 예수 유년기: 마 2, 눅 2장. 복음서 종합 개요이며 확정 연대기 조화를 주장하지 않음. https://bible.usccb.org/bible/matthew/2
- 공생애: 요 2·4·10장, 막 7장 등. 시돈·데가볼리·요단 동편 보완. https://bible.usccb.org/bible/mark/7
- 바울 1차: 행 13–14. 출발·귀환 지점과 육지/해상 연결 재검토. https://bible.usccb.org/bible/acts/13
- 바울 2차: 행 15–18. 암비볼리·아볼로니아·겐그레아 보완. https://bible.usccb.org/bible/acts/17
- 바울 3차 출발: 행 18:23–20:3, 고후 2:12–13. 갈라디아·브루기아는 지역 대표점, 빌립보·고린도도 지역 방문을 표시하는 대표점으로 구분. https://bible.usccb.org/bible/2corinthians/2
- 바울 3차 복귀: 행 20–21. 마게도냐 귀환·드로아·에게해 기항지·예루살렘. 드로아–앗소는 바울의 육로 표시. https://bible.usccb.org/bible/acts/20
- 로마: 행 27–28. 살모네·가우다·압비오 광장·트레이스 타베르네 보완. 폭풍 표류는 추정선. https://bible.usccb.org/bible/acts/27

추가된 고대 지명 식별에는 OpenBible.info Bible Geocoding Data(CC BY 4.0)를 사용했으며, 실제 해당 항목 URL은 atlas-data.js의 placeNotes에 저장했습니다. 성경 본문은 번역문을 복제하지 않고 사건을 자체 요약했습니다.

## 반복 방문과 구간 표시

반복해서 연결되는 두 장소의 선은 화면에서 나란히 벌려 그립니다. 이는 선 겹침을 피하는 시각적 간격이며 실제로 별도의 도로를 이용했다는 지리 정보가 아닙니다. 핀 옆 괄호는 전체 사건 목록에서의 방문 순서입니다. 구간별 보기와 방문 순서는 기존 대조 사건 목록을 사용하며 생략된 모든 역사적 이동을 복원했다는 뜻은 아닙니다. 포로기 가지선은 순차 여정과 구분해 사마리아에서 각 목적지로 연결합니다.
