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
