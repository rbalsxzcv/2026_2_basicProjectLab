# AI 반려식물 코치 🌱

식물을 처음 키우는 사람이 AI 코치와 함께 관리 습관을 만들도록 돕는 웹앱 프로토타입입니다.
식물마다 귀여운 **데포르메(치비) 캐릭터**가 생기고, 체크리스트를 마칠수록 경험치가 쌓여 캐릭터가 자랍니다.
서버 없이 브라우저에서 **순수 HTML·CSS·JS + Firebase + Gemini(Firebase AI Logic)** 로 동작합니다.

**지키는 원칙 4가지**

1. **과습 방지(Safe-Lock)** — "흙이 말랐는지" 확인 없이는 물주기를 완료할 수 없습니다. 축축하면 벌점 없이 2일 연기합니다.
2. **대화형 진단** — AI 는 사진만 보고 단정하지 않습니다. 증상을 관찰하고 흙 상태를 되물은 뒤 두 정보를 합쳐 처방합니다.
3. **Anti-Guilt** — 시들거나 슬픈 그림, 겁주는 문구, 벌점이 없습니다. 밀린 일정은 "차분히 기다리는 중"으로만 표현합니다.
4. **AI 맥락 절약** — 지난 AI 분석은 사진 없이 짧은 JSON 요약으로만 저장하고, 다음 호출에 최근 몇 개만 보냅니다. 지난 기록을 다시 볼 때는 AI 를 부르지 않습니다.

---

## 목차

1. [빠른 시작](#빠른-시작)
2. [화면과 기능](#화면과-기능)
3. [기술 스택](#기술-스택)
4. [폴더 구조](#폴더-구조)
5. [코드 구조와 규칙](#코드-구조와-규칙)
6. [AI와 날씨 함수](#ai와-날씨-함수)
7. [데이터 구조](#데이터-구조)
8. [디자인 가이드](#디자인-가이드)
9. [설정](#설정) — [Firebase 프로젝트](#firebase-프로젝트) · [실제 AI(real) 모드](#실제-aireal-모드) · [실제 날씨(real) 모드](#실제-날씨real-모드)
10. [개발용 테스트 도구](#개발용-테스트-도구)
11. [프롬프트 템플릿](#프롬프트-템플릿)
12. [배포](#배포)
13. [문제 해결](#문제-해결)
14. [확장 아이디어](#확장-아이디어)
15. [개발 과정 기록](#개발-과정-기록)

---

## 빠른 시작

설치할 것은 없습니다 (Node.js·npm 불필요). `public/` 폴더를 정적 서버로 열기만 하면 됩니다.

```powershell
# 프로젝트 맨 위 폴더에서 실행 (public 폴더를 열어야 함 — 그냥 열면 GET / 404)
python -m http.server 5500 --directory public
```

또는 VS Code 확장 **Live Server** 설치 → `public/index.html` 오른쪽 클릭 → **Open with Live Server**.

브라우저에서 **`http://localhost:5500`** → 회원가입 → 첫 식물 등록.
Firebase 설정값은 저장소에 이미 들어 있고, AI·날씨는 기본이 **mock(가짜 응답)** 모드라 바로 모든 화면을 끝까지 써 볼 수 있습니다.

| 알아 둘 것 | 이유 · 해결 |
| :--- | :--- |
| `index.html` 을 더블클릭(`file://`)하면 빈 화면 | ES 모듈은 `file://` 에서 동작하지 않습니다. 반드시 서버로 여세요. |
| `127.0.0.1` 말고 **`localhost`** 로 열기 | App Check 디버그 토큰이 주소마다 따로 등록되며, localhost 기준으로 설정돼 있습니다. |
| 코드를 고쳤는데 화면이 그대로 | **Ctrl+F5** (강력 새로고침) — 브라우저가 옛 JS 파일을 기억하고 있을 수 있어요. |
| 휴대폰 카메라로 조도 측정 | 카메라는 `localhost` 또는 **HTTPS** 에서만 켜집니다 → [배포](#배포) |
| "Firebase 설정이 필요해요" 카드가 보임 | `firebaseConfig` 가 비어 있습니다 → [Firebase 프로젝트](#firebase-프로젝트) |

---

## 화면과 기능

하단 메뉴: 🏠 홈 · ✅ 체크리스트 · 📅 캘린더 · ☀️ 환경 · 👤 내 정보, 상단 🔔 알림함.

| 주소 | 화면 | 핵심 |
| :--- | :--- | :--- |
| `#/login`, `#/signup` | 로그인 · 회원가입 | 아이디(영문 소문자·숫자 4~20) + 비밀번호(6+), 닉네임·거주지역(시·도)·자택 종류 |
| `#/main` | 메인 게임 | 캐릭터 상태(평온·기다림·관찰 필요·성장), 식물 선택, 쓰다듬기, 레벨 바, 체크리스트 바로가기 |
| `#/plants/new`, `#/plants/:id/edit`, `#/plants` | 식물 등록 · 수정 · 관리 | 종류 검색(기본 10종, 없으면 AI 로 새 종류 추가), 사진 → AI 캐릭터, 정기 일정 4개 자동 생성. 식물이 0개면 등록 화면으로 자동 이동 |
| `#/checklist` | 오늘의 체크리스트 | AI 데일리 루틴(+5) + 예정일이 된 정기 관리(+20), **물주기 Safe-Lock**, [사진으로 상태 확인하기] |
| `#/calendar` | 성장 캘린더 | 사진 → AI 관찰 → 흙 상태 질문 → 오늘 할 일 2가지(+15, 하루 1회), 달력·날짜별 기록·타임라인 |
| `#/environment` | AI 환경 분석 | 카메라 3초 조도 추정(또는 위치 선택) + 날씨 + 창문 방향·냉난방기 → 적합도 점수·빛 판정·AI 조언 |
| `#/report`, `#/report/:month` | 월간 리포트 | 지난달 통계 4개 + 이전 달 대비 변화, AI 칭찬·다음 달 습관, 6개월 이상 분갈이 안내, 수명 마무리 안내 |
| `#/notifications` | 알림함 | 체크리스트·리포트 알림, 🔔 안 읽은 수, (선택) 브라우저 알림, 30일 지난 알림은 숨김 |
| `#/profile` | 내 정보 | 닉네임·거주지역·자택 종류 수정, 비밀번호 변경, 로그아웃 |
| `#/dev`, `#/prompt-lab` | 개발용 | 테스트 버튼 모음, 프롬프트 실험실 (메뉴에 없음) → [개발용 테스트 도구](#개발용-테스트-도구) |

### 사용 흐름

1. 회원가입 → 첫 식물 등록(사진을 올리면 캐릭터 생성) → 메인
2. 매일 체크리스트: 환기·잎 관찰 같은 데일리 루틴과, 예정일이 된 물주기·비료·잎 닦기·분갈이
3. 물주기는 반드시 흙 확인 팝업을 거칩니다 — [말라 있어요] 완료 +20 EXP / [아직 축축해요] 미완료·무경험치·2일 연기
4. 성장 캘린더에 사진을 남기면 AI 가 관찰 → 흙 상태 질문 → 오늘 할 일 2가지를 알려 줍니다. 관찰이 필요하면 메인 캐릭터 옆에 🔍
5. 환경 분석으로 지금 자리가 식물에 맞는지 점수와 조언을 받습니다
6. 매달 초 로그인하면 지난달 리포트가 만들어지고 알림이 옵니다

**로그인 직후 자동 작업** (`js/core/startup.js`)
* 첫 화면 전: 회원정보·식물 목록 불러오기 (식물 0개 → 등록 화면, 회원정보 없음 → 내 정보 화면)
* 첫 화면 뒤(기다리지 않음): 식물마다 오늘 체크리스트가 없으면 만들고 알림, 지난달 리포트가 없으면 만들고 알림, 안 읽은 알림 수를 🔔 에 실시간 표시
* 작업마다 따로 `try/catch` — 하나가 실패해도 나머지는 계속합니다.

### 게임 규칙

모든 숫자는 `js/services/game.js` 한 곳에만 정의돼 있습니다.

| 항목 | 값 |
| :--- | :--- |
| 데일리 루틴 완료 | +5 EXP |
| 정기 관리 완료 (물주기 등) | +20 EXP |
| 성장 캘린더 사진 | +15 EXP (하루 1회, 식물 등록 사진도 그날 사진으로 셈) |
| 쓰다듬기 | 0 EXP (반응만. `EXP.PET` 을 0보다 크게 하면 하루 3번까지 지급) |
| 레벨 | `Math.floor(exp / 100) + 1` |
| 성장 단계 | Lv1–2 새싹(`SPROUT`) · Lv3–5 어린 모종(`YOUNG`) · Lv6+ 풍성한 식물(`LUSH`) |
| 레벨 소품 | Lv3 화분 리본 · Lv5 나비 친구 · Lv8 반짝 별 |
| 캐릭터 상태 우선순위 | `ALERT`(관찰 필요 진단) > `WAITING`(정기 관리 예정일 지남) > `GROWING`(30분 안에 관리함) > `PEACEFUL` |

벌점·감점은 없습니다. 일정이 밀려도 캐릭터는 천천히 숨 쉬며 "…" 말풍선으로 기다릴 뿐입니다.

---

## 기술 스택

| 영역 | 선택 | 비고 |
| :--- | :--- | :--- |
| 화면 | **순수 HTML + CSS + JS (ES 모듈)** | 프레임워크·빌드 도구·npm 패키지 없음 |
| 화면 이동 | 해시 라우터 SPA (`#/main`) | `index.html` 하나, 화면은 JS 모듈 |
| 서버 | **없음** — Firebase + AI API 호출만 | 모든 로직이 브라우저에서 실행 |
| 로그인 | Firebase Authentication (이메일/비밀번호) | 아이디 → `아이디@plantcoach.example` |
| DB | Cloud Firestore | 보안 = `firestore.rules` |
| AI | **Firebase AI Logic** (Gemini Developer API) + App Check | 코드에 AI 키 없음. 어댑터 `js/ai/provider.js` 하나 |
| 날씨 | **Open-Meteo** (키 없는 공개 API) | `js/core/weather.js` |
| 사진 | 압축한 data URL 을 Firestore 에 저장 | Cloud Storage(Blaze 요금제) 미사용 |
| Firebase SDK | 공식 CDN 모듈 (`13.3.0`) | 버전은 `js/core/firebase.js` 에만 |
| 배포 | GitHub Pages (자동) / Firebase Hosting (선택) | `.github/workflows/pages.yml`, `firebase.json` |

**서버가 없어서 단순화한 점**
* AI·날씨는 브라우저가 직접 부르고, 결과도 브라우저가 Firestore 에 저장합니다.
* 기본 식물 DB 는 Firestore 가 아니라 정적 파일 `public/data/plant-species.json` (10종: 몬스테라·스투키·산세베리아·스킨답서스·테이블야자·금전수·고무나무·아이비·바질·방울토마토)입니다. AI 로 추가한 종류만 사용자별 Firestore 에 저장됩니다.
* 오늘 체크리스트와 지난달 리포트는 예약 작업이 아니라 **앱을 열 때(로그인 직후) 필요하면** 만듭니다.
* 알림은 **앱 안 알림함** + 앱이 열려 있을 때의 브라우저 알림입니다. 앱을 닫아도 오는 푸시(FCM)는 서버가 필요해서 넣지 않았습니다.

---

## 폴더 구조

```text
.
├─ README.md                 ← 지금 이 파일 (프로젝트 설명 전부)
├─ firestore.rules           ← Firestore 보안 규칙 (콘솔에 붙여 넣어 게시)
├─ firebase.json             ← Firebase Hosting 설정 (public 폴더 배포)
├─ .github/workflows/pages.yml ← main 에 push 하면 GitHub Pages 로 자동 배포
├─ .gitattributes · .gitignore
├─ docs/archive/             ← 개발 과정 기록 (참고용, 실행과 무관) → 개발 과정 기록 절
└─ public/                   ← 브라우저가 실행하는 전부 (이 폴더를 서버로 엶)
   ├─ index.html             ← 유일한 HTML (앱 셸)
   ├─ css/  base.css(색 변수·셸) · components.css(공용 UI) · pages/<화면>.css
   ├─ assets/characters/     ← 기본 캐릭터 default.svg, 레벨 소품 deco-*.svg
   ├─ data/                  ← plant-species.json(기본 식물 10종) · regions.json(시·도 좌표) · daily-tasks.json(기본 데일리 루틴)
   ├─ prompts/               ← AI 프롬프트 템플릿 <이름>.v<번호>.txt + samples/(실험실 입력)
   ├─ mocks/                 ← mock 모드 가짜 AI 응답
   └─ js/
      ├─ app.js              ← 시작점: Firebase 설정 확인 → 셸 → 로그인 감시 → 라우터
      ├─ core/               ← firebase(-config) · router · routes · store · startup · ai(-config) · weather
      ├─ ai/                 ← provider(AI 어댑터) · prompts(템플릿 채우기) · normalize(입력 확인·응답 다듬기) · json · usage(하루 한도)
      ├─ services/           ← ★ Firestore 접근은 여기서만
      │                         auth · users · plants · species · images · schedules · game · checklists
      │                         photos · diagnosis · environments · aiHistory · reports · notifications · dev-tools(#/dev 전용)
      ├─ ui/                 ← layout(상단 바·하단 메뉴) · components(토스트·모달 등) · celebrate(레벨업) · diagnosis-flow(대화형 진단)
      ├─ utils/              ← date(한국 시간) · dom(html 자동 이스케이프) · image(사진 압축) · lux(조도 측정) · envScore(환경 점수)
      └─ pages/              ← 화면 하나 = 파일 하나
```

---

## 코드 구조와 규칙

### 계층

```text
pages/*.js (화면)  ──►  services/*.js (Firestore 읽기·쓰기)  ──►  core/firebase.js
       │                       │
       └──────────────►  core/ai.js · core/weather.js  ──►  ai/provider.js (mock / Gemini) · Open-Meteo
```

* 화면은 Firestore(`collection()`, `doc()`)를 직접 부르지 않고 `services/` 함수만 씁니다.
* AI·날씨는 `core/ai.js`, `core/weather.js` 로만 부릅니다. `ai/provider.js` 를 직접 쓰는 곳은 프롬프트 실험실(`pages/prompt-lab.js`) 하나뿐입니다.
* Firebase 함수는 모두 `core/firebase.js` 에서 다시 내보낸 것을 가져다 씁니다 (CDN 주소·버전이 한 곳에만 있도록).

### 페이지 모듈 형식

`public/js/pages/*.js` 는 모두 이 모양으로 `export default` 합니다. 라우터가 CSS 를 붙이고 `render` 를 부릅니다.

```js
import { html } from '../utils/dom.js';
export default {
  title: '화면 제목',                 // 상단 바 제목
  requiresAuth: true,                 // 로그인·회원가입만 false
  showNav: true,                      // 하단 메뉴 표시
  styles: ['css/pages/example.css'],  // 화면 CSS (라우터가 불러옴)
  // container = <main id="page">, params = 경로 변수 + query
  async render(container, params) {
    container.innerHTML = html`<section class="page-example">...</section>`;
    return () => {};                  // 떠날 때 정리할 일 (카메라 끄기, 구독 해제 등)
  },
};
```

* 경로 표는 `core/routes.js` (위 [화면과 기능](#화면과-기능) 표와 같음). `:id`, `:month` 는 변수 → `params.id`, `params.month`.
* 쿼리: `#/checklist?plant=abc` → `params.query.plant === 'abc'`.
* 표에 없는 주소나 파일이 없는 화면은 `not-ready.js`("준비 중")를 보여 줍니다.

### 전역 상태 (`core/store.js`)

```js
store.get('user')            // { uid, loginId, nickname, home: { region, homeType } } | null
store.get('plants')          // 내 식물 배열 (services/plants.js 가 채움)
store.get('currentPlantId')  // 지금 보고 있는 식물 id (localStorage 에도 저장)
store.set(key, value)        // 바꾸면 구독자에게 알림
store.subscribe(key, fn)     // 구독 해제 함수를 돌려줌 — 화면을 떠날 때 꼭 해제
```

### 공용 UI (`ui/components.js`)

```js
toast(message, type = 'info')                   // 'info'|'success'|'error', 3초 뒤 사라짐
await openModal({ title, body, actions })       // actions: [{ label, value, variant }] → 누른 value
await confirmModal(message)                     // true / false
await choiceModal({ title, question, options }) // 누른 선택지 (진단 질문, 흙 확인 팝업)
showLoading(message) / hideLoading()            // 전체 화면 로딩 (AI 호출 중)
gauge(score)                                    // 0–100 게이지 HTML
emptyState({ icon, message, actionLabel, actionHref })
```

### 날짜 · 아이디

* "오늘"은 항상 한국 시간입니다 (`utils/date.js`): `today()` → `'YYYY-MM-DD'`, `thisMonth()` → `'YYYY-MM'`, `addDays`, `diffDays`, `prevMonth`, `formatKorean` → `'11월 11일 (수)'`.
  `new Date().toISOString().slice(0, 10)` 은 UTC 라서 한국 오전 9시 전에는 어제 날짜가 나오므로 쓰지 않습니다.
* 아이디는 Firebase Authentication 용 이메일 `아이디@plantcoach.example` 로 바꿔 씁니다 (`services/auth.js` 의 `toAuthEmail` 한 곳). `.example` 은 메일이 가지 않는 예약 도메인이라 "비밀번호 찾기(메일)"는 없습니다. 비밀번호는 Firestore 에 저장하지 않습니다.

### 코드 규칙

1. 모든 JS 파일 맨 위에 머리 주석 — `파일`, `역할`, `사용하는 파일`. 주석과 화면 문구는 한국어.
2. 사용자 입력은 `utils/dom.js` 의 `html` 템플릿으로 넣어 자동 이스케이프합니다. 직접 만든 HTML 만 `raw()` 로 감쌉니다.
3. 브라우저 `alert()`, `confirm()`, `prompt()` 대신 공용 UI 를 씁니다.
4. 모든 `await` 는 `try/catch` 로 감싸고 실패하면 한국어 `toast`. AI 가 실패해도 화면이 멈추지 않도록 기본값으로 대신합니다.
5. 코드에 API 키를 넣지 않습니다 (AI 키는 Firebase AI Logic 이 관리, Open-Meteo 는 키 없음). Firebase 웹 설정값은 원래 공개되는 값이고, 보호는 `firestore.rules` + App Check 가 합니다. 사진·프롬프트 본문은 콘솔에 찍지 않습니다(길이만).
6. 이름: 파일 `kebab-case.js`, 함수·변수 `camelCase`, 상수 `UPPER_SNAKE_CASE`, 함수는 동사로 시작(`loadPlants`).
7. 화면 문구는 따뜻한 존댓말. "죽음, 시듦, 실패, 경고, 벌점" 같은 말은 쓰지 않고 "기다리는 중", "조금 더 관찰이 필요해요" 로 씁니다. (AI 응답도 `ai/normalize.js` 가 금지어를 걸러 냅니다.)
8. 외부 라이브러리는 Firebase CDN 모듈만 씁니다.

---

## AI와 날씨 함수

화면·서비스는 아래 함수만 부릅니다. 이미지는 **data URL 문자열**(`data:image/...;base64,...`)입니다.
성공하면 데이터 객체를, 실패하면 `AiError` / `WeatherError` 를 던지고 그 `message` 는 사용자에게 바로 보여 줄 한국어 문구입니다.
AI 가 엉뚱하게 답해도 `ai/normalize.js` 가 아래 모양으로 맞추고, 빠진 값은 기본값으로 채웁니다.

| 함수 (`core/ai.js`) | 입력 | 반환 |
| :--- | :--- | :--- |
| `generateCharacter` | `{ imageBase64, speciesName }` | `{ imageBase64 }` 데포르메 캐릭터 이미지 |
| `diagnose` | `{ imageBase64, speciesName }` | `{ symptoms, severity: 'normal'\|'watch', question, options: [3개] }` |
| `advise` | `{ speciesName, symptoms, userAnswer, recentHistory: [] }` | `{ advice: [2개], summaryTag }` |
| `analyzeEnvironment` | `{ speciesName, profile, measuredLux, weather, homeType, windowDir, heaterOrAcExposed }` | `{ goodPoint, actions: [1–2개] }` |
| `suggestChecklist` | `{ speciesName, profile, weather, latestEnvironment, dueSchedules: [], recentHistory: [] }` | `{ items: [{ category, taskType, title }] }` |
| `writeMonthlyReport` | `{ speciesName, daysSincePurchase, lifespan, stats, monthlyHistory: [], previousReport }` | `{ praise, suggestions: [1–2개], repotNotice: string\|null, lifespanNotice: string\|null }` |
| `generateSpecies` | `{ speciesName }` (사용자가 입력한 이름) | `plant-species.json` 항목과 같은 모양 + `isPlant`, `rejectReason: null\|'NOT_PLANT'\|'NOT_GROWABLE'\|'RESTRICTED'`, `isMock` |
| `getWeather(region)` (`core/weather.js`) | `'서울특별시'` | `{ tempC, humidity, precipitation: boolean, source: 'mock'\|'real' }` |

* `recentHistory`, `monthlyHistory` 는 `aiHistory` 의 `summary` 객체 배열입니다 (사진 없음, 기본 최근 5개).
* 체크리스트 AI 는 데일리 루틴(`VENTILATE`, `CHECK_LEAF`, `CHECK_LIGHT`, `MIST`)만 고를 수 있습니다. AI 가 물주기 같은 정기 관리를 넣어도 코드가 걸러 냅니다 (과습 방지).
* AI 실패 시 대체: 체크리스트 → `data/daily-tasks.json` 기본 루틴, 환경 분석 → 규칙 기반 조언(`utils/envScore.js`), 월간 리포트 → 통계 기반 기본 문구(`generatedBy: 'DEFAULT'`), 캐릭터 → 기본 SVG.
* **새 식물 종류 추가**는 화면이 `generateSpecies` 를 직접 부르지 않고 `services/species.js` 를 씁니다.
  `previewSpeciesByName(name)` → `{ species, isNew }` (저장 안 함) → 사용자가 확인하면 `saveSpeciesDraft(species)` (저장).
  `addSpeciesByName(name)` 은 두 단계를 확인 없이 한 번에 합니다. 입력은 한글·영문·숫자·띄어쓰기·`-()` 2~30자, 재배가 제한된 식물(대마·양귀비 등)은 AI 를 부르지 않고 안내만 합니다.

---

## 데이터 구조

모든 개인 데이터는 `users/{uid}` 아래에 있고, 보안 규칙상 본인만 읽고 쓸 수 있습니다.
시각은 `serverTimestamp()` / `Timestamp`, 날짜만 필요한 값은 `'YYYY-MM-DD'` 문자열입니다.

```text
users/{uid}
  loginId: string   nickname: string   home: { region: string, homeType: string }   createdAt: Timestamp

users/{uid}/customSpecies/{speciesId}     # AI 로 추가한 식물 종류 (id = 'ai-' + 정규화한 이름)
  plant-species.json 항목과 같은 필드   source: 'AI'|'MOCK' (MOCK = mock 모드에서 만들어 실제 확인 안 됨)   createdAt

users/{uid}/plants/{plantId}
  speciesId: string   name: string   purchasedAt: 'YYYY-MM-DD'
  lifespan: { type: 'PERENNIAL'|'ANNUAL'|'BIENNIAL'|'HARVEST', endDate: 'YYYY-MM-DD'|null }
  characterImage: string     # data URL 또는 https 주소 (img src 로 바로 사용)
  exp: number (누적)   level: number
  state: 'PEACEFUL'|'WAITING'|'ALERT'|'GROWING'
  alertOpen: boolean         # 해결되지 않은 "관찰 필요" 진단
  lastCareAt: Timestamp|null # 마지막으로 관리를 완료한 시각
  createdAt: Timestamp

users/{uid}/plants/{plantId}/schedules/{taskType}     # 문서 id = taskType, 식물마다 4개
  taskType: 'WATER'|'FERTILIZE'|'WIPE_LEAF'|'REPOT'   intervalDays: number
  dueDate: 'YYYY-MM-DD'   lastDoneAt: 'YYYY-MM-DD'|null

# taskType 종류
#   DAILY_MICRO   (AI 가 고름):    VENTILATE(환기) · CHECK_LEAF(잎 관찰) · CHECK_LIGHT(빛 확인) · MIST(분무, 건조할 때만)
#   PERIODIC_CARE (일정에서만):    WATER(물주기) · FERTILIZE(비료) · WIPE_LEAF(잎 닦기) · REPOT(분갈이)

users/{uid}/plants/{plantId}/checklists/{YYYY-MM-DD}  # 문서 id = 날짜, 하루 하나
  items: [{ id, category: 'DAILY_MICRO'|'PERIODIC_CARE', taskType, title, exp,
            isCompleted, completedAt: 'YYYY-MM-DD'|null, dueDate: string|null,
            soilMoistureDry: boolean|null, postponed: boolean }]   # postponed 와 isCompleted 는 동시에 true 가 되지 않음
  generatedBy: 'AI'|'DEFAULT'   createdAt

users/{uid}/plants/{plantId}/environments/{envId}
  measuredLux, luxSource: 'camera'|'sensor'|'manual'   weather: { tempC, humidity, precipitation }
  windowDir, heaterOrAcExposed, matchScore, lightLevel: 'LOW'|'OK'|'HIGH'
  coach: { goodPoint, actions }   measuredAt

users/{uid}/plants/{plantId}/photos/{photoId}
  image: string   date: 'YYYY-MM-DD'
  diagnosis: { symptoms, severity, question, userAnswer, advice, summaryTag } | null
  createdAt

users/{uid}/plants/{plantId}/aiHistory/{historyId}    # 사진 절대 없음 — 짧은 요약만
  type: 'PHOTO_DIAGNOSIS'|'ENVIRONMENT'|'CHECKLIST'   summary: object (약 200자 JSON)   createdAt

users/{uid}/plants/{plantId}/monthlyReports/{YYYY-MM}
  stats: { routineRate, ventilationCount, waterOnTimeRate, photoCount }
  ai: { praise, suggestions, repotNotice, lifespanNotice, generatedBy: 'AI'|'DEFAULT' }
  createdAt

users/{uid}/notifications/{notiId}                    # 문서 id = 중복 방지 키 (같은 알림은 하나만)
  type: 'CHECKLIST'|'MONTHLY_REPORT'   title, body, link (예: '#/checklist?plant=abc')
  read: boolean   createdAt
```

* 월간 통계: 실천율 `routineRate`(미룬 항목 제외), 환기 횟수, 물주기 제때 비율 `waterOnTimeRate`(`completedAt ≤ dueDate + 1일`), 사진 수.
* 정기 일정의 첫 예정일은 "등록한 날" 기준입니다 (오래전에 산 식물도 첫날부터 밀린 일정이 생기지 않게).
* 별도 색인(index)이 필요한 쿼리는 쓰지 않습니다.

---

## 디자인 가이드

* **모바일 우선**: 최대 너비 480px 가운데 정렬, 터치 영역 높이 44px 이상.
* **색 (`css/base.css` 변수)**: `--color-primary #5BA672`(잎 초록) · `--color-primary-soft #E6F4EA` · `--color-accent #F2B880`(살구) · `--color-bg #FBFAF6` · `--color-text #2F3A33` · `--color-muted #7A857E` · `--color-danger-soft #F6E3DC` (빨강 대신 부드러운 톤).
* **모양**: 둥근 모서리(`--radius: 16px`), 부드러운 그림자, 카드 배치. 글꼴은 시스템 글꼴(`-apple-system, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif`).
* **움직임**: 캐릭터는 상태별로 살랑·숨쉬기·반짝임 CSS 애니메이션, `prefers-reduced-motion` 이면 끔.
* **접근성**: 이미지 `alt`, 버튼에 글자 또는 `aria-label`.

---

## 설정

### Firebase 프로젝트

> `public/js/core/firebase-config.js` 에는 **이 프로젝트의 값이 이미 들어 있습니다.** 아래는 새 Firebase 프로젝트로 옮길 때만 필요합니다.
> 같은 프로젝트를 여러 사람이 쓸 때는 각자 계정을 따로 만들면 됩니다 (보안 규칙상 계정별로 데이터가 분리됨).

1. **프로젝트 만들기** — [Firebase 콘솔](https://console.firebase.google.com) → 프로젝트 추가 (함께 관리할 사람은 프로젝트 설정 → 사용자 및 권한에서 초대)
2. **웹 앱 등록** — 프로젝트 설정 → 일반 → "내 앱" 에서 웹 앱(`</>`) 추가 → 화면의 `firebaseConfig` 값을 `firebase-config.js` 의 `firebaseConfig` 에 옮겨 적기
   * `apiKey`(`AIza...`), `authDomain`(`<프로젝트ID>.firebaseapp.com`), `projectId`, `appId` 가 필요하고 나머지는 있으면 같이 넣습니다.
   * 콘솔 예시의 `import` / `initializeApp` / `getAnalytics` 줄은 넣지 않습니다. 초기화는 `core/firebase.js` 가 합니다.
   * 이 값은 공개되어도 괜찮은 값이라 Git 에 올려도 됩니다. `apiKey` 가 `YOUR_` 로 시작하면 앱은 "설정 안 됨" 안내 카드를 보여 줍니다.
3. **Authentication** → 로그인 방법 → **이메일/비밀번호** 사용 설정
4. **Firestore Database** → 데이터베이스 만들기 (위치 `asia-northeast3`(서울) 권장) → **규칙** 탭에 [`firestore.rules`](firestore.rules) 내용을 통째로 붙여 넣고 **게시**
   * `rules_version = '2';` 는 반드시 맨 첫 줄이어야 합니다 (앞에 주석이 있으면 Parse error).
5. **요금제** — 무료 **Spark** 요금제로 동작합니다. 사진은 약 700KB 이하로 압축해 Firestore 문서에 넣습니다 (문서 하나 최대 1MB).
6. **SDK 버전** — `core/firebase.js` 맨 위 `FIREBASE_VERSION` 과 import 주소 5곳의 숫자를 함께 바꿉니다 (import 주소에는 변수를 쓸 수 없음). 현재 `13.3.0`.

### 실제 AI(real) 모드

기본값은 **mock** 입니다. mock 은 `public/mocks/*.json` 의 고정 응답을 돌려주고, 캐릭터는 코드로 그린 SVG 를 씁니다.
실제 Gemini 를 쓰는 **real** 모드는 아래 준비가 끝난 뒤 `#/dev` 스위치로 **브라우저마다** 켭니다. (`ai-config.js` 의 `AI_MODE` 는 `'mock'` 그대로 둡니다.)

**① 프로젝트 준비 (한 번만 — 이 프로젝트는 완료됨)**

1. Firebase 콘솔 → AI Services → **AI Logic** → 시작하기 → **Gemini Developer API** (Spark 요금제 가능)
2. App Check → 앱 탭에서 웹 앱에 **reCAPTCHA v3** 제공자 등록
   * [reCAPTCHA 관리 콘솔](https://www.google.com/recaptcha/admin)에서 v3 키를 만들 때 도메인에 `localhost` 와 (Firebase Hosting 을 쓴다면) `<프로젝트ID>.web.app` 추가
   * 공개용 **사이트 키**(`6L...`)는 `firebase-config.js` 의 `appCheckSiteKey` 에, **비밀 키**는 Firebase 콘솔에만 넣습니다.
   * `appCheckSiteKey` 가 비어 있으면 App Check 를 건너뜁니다 (real 모드 불가, mock 은 동작).
3. `public/js/core/ai-config.js` 의 `AI_MODELS` 에 모델 이름 입력 — [공식 모델 목록](https://firebase.google.com/docs/ai-logic/models)에서 그대로 복사

   | 키 | 용도 | 현재 값 | 비워 두면 |
   | :--- | :--- | :--- | :--- |
   | `text` | 글만 주고받는 기능 (처방, 체크리스트, 환경 조언, 리포트, 새 식물 종류) | `gemini-3.5-flash-lite` | real 이어도 전부 mock 으로 동작 (콘솔 경고 1번) |
   | `vision` | 사진을 함께 보내는 기능 (사진 진단) | `''` | `text` 모델로 사진도 보냄 |
   | `image` | 이미지를 만드는 기능 (데포르메 캐릭터) | `''` | 캐릭터는 mock SVG |

**② App Check 디버그 토큰**

`*.web.app`, `*.firebaseapp.com` 이 아닌 주소(localhost, 내부 IP, GitHub Pages 등)에서는 reCAPTCHA 대신 **디버그 토큰**으로 App Check 를 통과합니다 (`core/firebase.js`).

* **기본 — 고정 토큰**: `firebase-config.js` 의 `appCheckDebugToken` 값이 Firebase 콘솔(App Check → 앱 → ⋮ → 디버그 토큰 관리)에 한 번 등록돼 있으면, 어느 PC·브라우저에서나 따로 할 일 없이 AI 를 쓸 수 있습니다.
  ⚠ 토큰이 Git 에 올라가 있어 저장소를 볼 수 있는 사람은 App Check 를 통과할 수 있습니다. 문제가 생기면 콘솔에서 토큰을 지우고 새 UUID(PowerShell `[guid]::NewGuid()`)로 바꿔 등록합니다.
* **대안 — 브라우저별 임의 토큰**: `appCheckDebugToken = ''` 으로 비우면, F12 → Console 에 찍힌 `App Check debug token: ...` 을 위 위치에 등록하고 새로고침합니다. 시크릿 창·다른 브라우저·사이트 데이터 삭제 후에는 다시 등록해야 하며, 이 토큰은 비밀번호처럼 다룹니다.

**③ real 로 켜기와 확인**

`http://localhost:5500/#/dev` → "🤖 AI · 날씨 테스트" 의 **AI 모드** 스위치. 그 브라우저의 `localStorage`(`plantCoach.aiMode`)에만 저장됩니다.
**advise** 나 **suggestChecklist** 버튼을 눌러 확인합니다.

| 확인할 것 | real 로 동작 중 | 아직 mock |
| :--- | :--- | :--- |
| 사용량 표시 | "글 **1**/200" 처럼 올라감 | 0 그대로 |
| 결과 문장 | 누를 때마다 달라짐 | 항상 `mocks/*.json` 과 같음 |
| F12 콘솔 | 경고 없음 | `[ai] real 모드지만 준비가 안 됐어요 … mock 으로 동작합니다` |

**④ 비용·안전 장치 (`ai-config.js`)**

| 설정 | 기본값 | 설명 |
| :--- | :--- | :--- |
| `AI_DAILY_LIMITS` | 글 200 · 사진 100 · 이미지 20 | 브라우저별 하루 호출 한도 (`localStorage` 의 `plantCoach.aiUsage`). 진짜 한도는 Firebase/Google Cloud 콘솔 할당량에서 |
| `AI_TIMEOUT_MS` | 45000 | 이보다 늦으면 "응답이 너무 늦어요" |
| `AI_FALLBACK_TO_MOCK` | `false` | `true` 면 실제 호출 실패(한도 초과 포함) 시 mock 으로 대신 응답 — 시연용 안전장치 |
| `PROMPT_VERSION` | `v1` | 사용할 프롬프트 템플릿 버전 |

**주의**
* reCAPTCHA 비밀 키, 개인 AI 키(Vertex AI 등)는 코드·Git 에 넣지 않습니다 (편의를 위한 고정 디버그 토큰만 예외).
* Firebase 콘솔에서 **Firestore 의 App Check 적용(Enforce)은 켜지 않습니다.** 디버그 토큰이 없는 브라우저는 mock 모드여도 데이터를 못 읽게 됩니다.
* 무료 사용량이 있으니 real 모드는 필요할 때만 켭니다.

### 실제 날씨(real) 모드

Open-Meteo 는 키가 필요 없어 준비할 것이 없습니다. `#/dev` 의 **날씨 모드** 스위치만 켭니다.
거주지역(시·도) 좌표는 `public/data/regions.json` 에 있고, 같은 지역은 10분 동안 다시 묻지 않습니다.
요청 형식: [Open-Meteo 문서](https://open-meteo.com/en/docs) — `current=temperature_2m,relative_humidity_2m,precipitation`.
mock 날씨는 월별 한국 평균값에 약간의 무작위를 더한 값이며, 화면에 "예시 날씨" 로 표시됩니다.

---

## 개발용 테스트 도구

### `#/dev` — 테스트 버튼 모음

메뉴에는 없으니 주소창에 **`http://localhost:5500/#/dev`** 를 직접 입력합니다.
로그인 없이 열리지만, 식물 데이터를 건드리는 버튼은 **로그인 + 식물 1개 이상**이 필요합니다 (모두 "현재 식물" 기준).
식물 데이터를 직접 고치는 버튼은 `services/dev-tools.js` 를 씁니다 (화면은 Firestore 를 직접 부르지 않는다는 규칙).

| 구역 | 버튼 | 용도 |
| :--- | :--- | :--- |
| 🧩 공용 UI | 토스트·모달·닫기 막힌 모달·confirm·choice·로딩·게이지 | 공용 UI 확인 (Firebase 없이도 열림) |
| 🤖 AI · 날씨 테스트 | AI/날씨 mock·real 스위치, 함수별 시험 버튼, [입력 빠짐 테스트] | real 모드 확인, 응답 JSON 모양 확인 |
| 🧪 공용 테스트 | [물주기 예정일을 오늘로] [물주기 예정일을 3일 전으로] [오늘 체크리스트 지우기] [현재 식물 데이터 보기] | 일정·체크리스트 재현 |
| 🎮 게임 테스트 | [관찰 필요 켜기/끄기] [방금 관리함] [+20/+100 EXP] [상태 다시 계산] | 캐릭터 상태(ALERT·GROWING)·레벨업 모달 |
| 📅 성장 캘린더 | [오늘 사진 기록 지우기] | 하루 한 번 사진 경험치(+15) 다시 시험 |
| 🧫 프롬프트 실험실 | 실험실 열기 | 아래 `#/prompt-lab` |
| ✅ 체크리스트 | [오늘 체크리스트를 AI로 다시 만들기] [비료·잎 닦기 예정일을 오늘로] | 체크리스트 재생성 |
| 🔔 알림 | [알림 모두 읽음 처리] [테스트 알림 만들기] | 체크리스트·리포트 알림 |
| ☀️ 환경 분석 | 가짜 측정값 분석 (300 / 2,000 / 20,000 lux) | 카메라 없이 점수·조언·저장 |
| 📄 월간 리포트 | [지난달 샘플 기록 만들기/지우기] [지난달 리포트 강제 생성/지우기] | 실제 기록 없이 리포트 시험 (샘플 문서엔 `sample: true`) |

**자주 쓰는 시나리오**

| 확인하고 싶은 것 | 순서 |
| :--- | :--- |
| 물주기 Safe-Lock | [물주기 예정일을 오늘로] → [오늘 체크리스트 지우기] → `#/checklist` → 물주기 완료 → [아직 축축해요] 2일 연기 / [말라 있어요] +20 EXP |
| 캐릭터 WAITING | [물주기 예정일을 3일 전으로] → `#/main` 에서 "…" 말풍선 |
| 사진 진단 ALERT | `#/calendar` → [📷 오늘 사진 기록하기] → AI 진단 (mock 은 정상/관찰 필요 중 무작위) → 관찰 필요면 메인에 🔍 |
| 월간 리포트 | 📄 [지난달 샘플 기록 만들기] → [지난달 리포트 강제 생성] → `#/report` |
| 리포트 알림 | 📄 [지난달 리포트 지우기] → 로그아웃 → 다시 로그인 → 🔔 알림 → 리포트 열람 |

**전체 확인 순서 (한 계정으로 처음부터)**

1. 회원가입 → 첫 식물 등록(사진 → 캐릭터) → 메인
2. AI 환경 분석 (조도 측정 → 점수 → 조언)
3. 성장 캘린더 사진 진단 → 관찰 필요(ALERT, 돋보기)
4. 체크리스트 물주기 Safe-Lock — [아직 축축해요] 2일 연기 / [말라 있어요] +20 EXP, 레벨업
5. 체크리스트 [사진으로 상태 확인하기] → 질문·처방까지
6. 다시 로그인 → 체크리스트 알림 → 알림을 눌러 체크리스트로 이동
7. `#/dev` 지난달 샘플 기록 → 다시 로그인 → 리포트 알림 → 리포트 열람
8. `#/dev` 에서 AI·날씨를 real 로 바꿔 2~7 을 한 번 더

### `#/prompt-lab` — 프롬프트 실험실

로그인 후 주소창에 `#/prompt-lab`. 프롬프트 템플릿을 실행하고 버전끼리 비교하는 개발용 화면입니다.

1. 템플릿 선택 (`character`, `diagnose`, `advice`, `environment`, `checklist`, `monthly-report`, `species`)
2. 입력 샘플 선택 (`public/prompts/samples/<이름>-input.json`) — 입력 JSON 은 화면에서 직접 고쳐도 됩니다
3. 버전: 한 개(`v1`) 또는 쉼표로 비교(`v1,v2`) → 버전별 결과가 나란히 표시
4. `character`·`diagnose` 는 사진 파일 선택, 반복 횟수 1~5
5. [실행하기] → 결과마다 걸린 시간, 응답, **모양 검사**(`checkShape` → 통과/확인 필요), 채워진 프롬프트
6. [결과 JSON 내려받기] → `<이름>-<버전>-<YYYYMMDD-HHmm>.json`

* mock 모드는 템플릿 본문을 쓰지 않고 고정 응답을 돌려주므로 화면·검사 흐름만 확인됩니다. 문구 품질 비교는 real 모드에서 합니다. (`species` mock 은 이름을 비워 두는 설계라 "name 글자가 없어요" 가 정상)
* 모양 검사는 키·배열 개수만 봅니다. "흙이 축축한데 물주기를 권하는지" 같은 안전성은 사람이 읽고 판단합니다.
* 내려받은 파일에는 입력·프롬프트가 들어가니 사진·개인 정보를 넣지 않습니다.

### AI 로 새 식물 종류 추가 — 테스트할 때 주의

`#/plants/new` 에서 목록에 없는 이름(2글자 이상)을 입력하면 **[🤖 'OO' AI로 새 식물 추가하기]** 버튼이 나오고,
확인 창에서 [이 정보로 추가하기]를 눌러야만 `users/{uid}/customSpecies/ai-<이름>` 에 저장됩니다.

* **mock 모드에서는 AI 가 판단하지 않아서 "쓰레기통" 같은 이름도 식물로 만들어집니다** (확인 창에 🧪, `source: "MOCK"`). 식물 판정은 real 모드에서 시험합니다.
  real 모드 예: "쓰레기통" → "식물 이름으로 찾지 못했어요", "대마" → AI 호출 없이 안내, "아레카야자" → 확인 창에 🤖
* 추가한 종류를 고치거나 지우는 화면은 없습니다. Firebase 콘솔 → Firestore → `users/{내 uid}/customSpecies` 에서 지우고, 그 종류로 등록한 식물은 "내 식물 관리"에서 삭제합니다.

---

## 프롬프트 템플릿

AI 에게 보내는 글(프롬프트)은 코드에 쓰지 않고 `public/prompts/` 의 텍스트 파일로 관리합니다.

* 파일 이름: `<이름>.v<번호>.txt` — 예: `diagnose.v1.txt`, `advice.v2.txt`
* 사용하는 버전: `public/js/core/ai-config.js` 의 `PROMPT_VERSION` (모든 템플릿에 함께 적용, 현재 `v1`)
* `{speciesName}` 처럼 중괄호로 감싼 영문 이름은 변수이고 `js/ai/prompts.js` 가 채웁니다. 객체·배열은 JSON 글자로, 빈 값은 `정보 없음` 으로 들어갑니다.

| 템플릿 | 쓰는 함수 (`core/ai.js`) | 변수 |
| :--- | :--- | :--- |
| `character` | `generateCharacter` | speciesName |
| `diagnose` | `diagnose` | speciesName |
| `advice` | `advise` | speciesName, symptoms, userAnswer, recentHistory |
| `environment` | `analyzeEnvironment` | speciesName, profile, measuredLux, weather, homeType, windowDir, heaterOrAcExposed |
| `checklist` | `suggestChecklist` | speciesName, profile, weather, latestEnvironment, dueSchedules, recentHistory |
| `monthly-report` | `writeMonthlyReport` | speciesName, daysSincePurchase, lifespan, stats, monthlyHistory, previousReport |
| `species` | `generateSpecies` | speciesName (사용자가 입력한 식물 이름) |

**버전 현황**

| 템플릿 | 버전 | 상태 |
| :--- | :--- | :--- |
| 전체 7개 | v1 | 사용 중 |
| `advice` | v2 | 후보 (미채택) — 젖은 흙일 때 물주기 금지, 두 행동 가이드와 짧은 상태 태그를 더 분명히 함. real 모드 비교 전 |

**개선하는 순서**

1. 지금 버전을 복사해 새 버전을 만듭니다 (`advice.v1.txt` → `advice.v2.txt`).
2. `#/prompt-lab` 에서 **같은 입력·같은 사진·같은 반복 횟수**로 `v1,v2` 를 비교합니다 (real 모드).
3. 모양 검사와 함께 안내 내용의 안전성·구체성을 사람이 읽고 확인합니다. 특히 **흙이 축축하다고 답했을 때 물주기를 권하지 않는지** 봅니다.
4. 더 좋으면 `PROMPT_VERSION` 을 올려 채택하고 위 버전 현황 표를 고칩니다. `PROMPT_VERSION` 은 모든 템플릿에 적용되므로, 올리기 전에 나머지 템플릿에도 같은 번호의 파일이 있어야 합니다.

**꼭 지킬 것**

* 문구는 자유롭게 바꿀 수 있지만, 응답 JSON 의 **키 이름과 모양**([AI와 날씨 함수](#ai와-날씨-함수) 표)은 바꾸지 않습니다. 바뀌면 화면이 깨집니다. mock 응답(`public/mocks/`)도 같은 모양입니다.
* 겁주거나 죄책감을 주는 표현(죽음, 시듦, 실패, 경고, 벌점 등)은 쓰지 않습니다.
* 체크리스트 프롬프트에는 물주기·비료·분갈이·잎 닦기를 넣지 않습니다 (과습 방지 — 정기 관리는 일정에서만. 코드도 한 번 더 걸러 냄).

---

## 배포

평소에는 localhost 로 충분합니다. HTTPS 가 필요할 때(휴대폰 후면 카메라로 조도 측정, 다른 기기에서 시연) 배포합니다.

### GitHub Pages (자동)

`main` 브랜치에 push 하면 `.github/workflows/pages.yml` 이 `public/` 폴더를 그대로 GitHub Pages 에 올립니다 (Actions 탭에서 수동 실행도 가능).

* 처음 한 번: 저장소 **Settings → Pages → Source** 를 **GitHub Actions** 로 설정
* 주소: `https://<GitHub 사용자>.github.io/<저장소 이름>/`
* github.io 주소는 `*.web.app` 이 아니므로 App Check 는 **고정 디버그 토큰**으로 통과합니다 ([실제 AI(real) 모드](#실제-aireal-모드) ②). 토큰을 비우면 이 주소에서는 real 모드를 쓸 수 없습니다.

### Firebase Hosting (선택)

1. [Firebase CLI](https://firebase.google.com/docs/cli) 설치 (Node.js 가 필요한 건 이 CLI 뿐)
2. 프로젝트 맨 위 폴더에서
   ```powershell
   firebase login
   firebase use <프로젝트ID>
   firebase deploy --only hosting
   ```
3. 주소: `https://<프로젝트ID>.web.app` — 이 주소에서는 디버그 토큰이 아니라 reCAPTCHA v3 로 App Check 를 통과하므로, reCAPTCHA 키 도메인에 `<프로젝트ID>.web.app` 이 등록돼 있어야 합니다.

`firebase.json` 은 이미 `public` 폴더를 올리도록 되어 있고, 배포 캐시 `.firebase/` 는 `.gitignore` 에 들어 있습니다.

### 배포 전 체크리스트

- [ ] `public/js/core/ai-config.js` 의 `AI_MODE`·`WEATHER_MODE` 확인 (시연에서 실제 AI 를 쓸지 결정)
- [ ] 실제 AI 로 시연한다면 `AI_FALLBACK_TO_MOCK = true` 고려 (호출 실패 시 mock 으로 대신 응답)
- [ ] 정식 공개라면 개발용 화면 제거 — `public/js/core/routes.js` 에서 `/dev`, `/prompt-lab` 두 줄을 지우고, 함께 `pages/dev-ui.js`, `pages/prompt-lab.js`, `services/dev-tools.js` 를 지워도 됩니다
- [ ] mock 모드로 만든 테스트 식물 종류(`customSpecies` 의 `source: "MOCK"`)·샘플 데이터(`sample: true`) 정리

---

## 문제 해결

화면에는 짧은 안내만 나옵니다. **자세한 원인은 F12 → Console** 에서 확인합니다 (사진·프롬프트 본문은 찍히지 않고 길이만 나옴).

**실행**

| 증상 | 원인 | 해결 |
| :--- | :--- | :--- |
| 주소를 열었더니 `GET / 404` | 프로젝트 맨 위 폴더를 서버로 엶 | `python -m http.server 5500 --directory public` |
| 빈 화면, 콘솔에 CORS / module 오류 | `file://` 로 열었음 | 서버로 열기 ([빠른 시작](#빠른-시작)) |
| 고친 코드가 반영 안 됨 | 브라우저 캐시 | Ctrl+F5 |
| "Firebase 설정이 필요해요" 카드 | `firebaseConfig` 가 `YOUR_...` | [Firebase 프로젝트](#firebase-프로젝트) |
| 로그인 후 "회원정보가 비어 있어요" | 가입 때 회원정보 저장 실패 | 내 정보 화면에서 다시 저장 (식물이 없으면 저장 후 식물 등록으로 이동) |
| Firestore `Missing or insufficient permissions` | 보안 규칙 미게시 / 로그인 안 됨 | `firestore.rules` 를 콘솔 규칙 탭에 게시 |
| 보안 규칙 게시 시 `Parse error` | `rules_version` 앞에 주석이 있음 | `rules_version = '2';` 를 맨 첫 줄로 |

**AI (real 모드) — 콘솔의 `[ai] 호출 실패 …` 줄**

| 콘솔 내용 | 원인 | 해결 |
| :--- | :--- | :--- |
| `[ai] real 모드지만 준비가 안 됐어요 … mock 으로 동작합니다` | `AI_MODELS.text` 가 비었거나 AI 초기화 실패 | [실제 AI(real) 모드](#실제-aireal-모드) ①-3 |
| App Check / 401 / unauthenticated | 디버그 토큰 미등록 (또는 다른 브라우저·시크릿 창) | [실제 AI(real) 모드](#실제-aireal-모드) ② |
| `API_KEY_SERVICE_BLOCKED` | 웹 API 키에 API 제한이 걸림 | Google Cloud 콘솔 → API 키 제한에서 Firebase AI Logic API 허용 |
| 403 / PERMISSION_DENIED | AI Logic 설정 문제 | Firebase 콘솔에서 AI Logic·App Check 설정 확인 |
| 404 / model not found | 모델 이름이 바뀜·종료됨 | [공식 모델 목록](https://firebase.google.com/docs/ai-logic/models)에서 새 이름으로 |
| 429 | 무료 요금제 분당 한도 | 잠시 후 다시 |
| 화면에 "오늘 AI 코치 이용량을 모두 썼어요" | 브라우저별 하루 한도 | F12 → Application → Local Storage → `plantCoach.aiUsage` 삭제 |
| 화면에 "응답이 너무 늦어요" | 45초 시간 초과 | 잠시 후 다시 / `AI_TIMEOUT_MS` |

AI 가 실패해도 화면은 멈추지 않습니다. 체크리스트는 기본 루틴, 환경 분석은 규칙 기반 조언("기본 가이드를 보여 드려요"), 월간 리포트는 통계 기반 기본 문구로 대신 채워집니다.

**기능별**

| 증상 | 확인할 것 |
| :--- | :--- |
| 조도 측정에서 카메라가 안 켜짐 | HTTPS 또는 localhost 인지, 카메라 권한을 허용했는지. 안 되면 4가지 위치 프리셋으로 선택 |
| 날씨를 불러오지 못했어요 | 내 정보에 거주지역이 있는지, real 모드면 인터넷 연결 |
| 체크리스트에 물주기가 안 나옴 | 정상일 수 있음 — 물주기는 **예정일이 된 날에만** 들어옵니다. `#/dev` [물주기 예정일을 오늘로] → [오늘 체크리스트 지우기] |
| 사진 경험치가 안 오름 | 하루 첫 사진만 +15 (식물 등록 사진도 그날 사진으로 셈). `#/dev` 📅 [오늘 사진 기록 지우기] |
| 리포트에 [리포트 만들기] 버튼이 없음 | 이번 달(미리보기만), 식물을 등록하기 전 달, 아직 오지 않은 달은 만들 수 없음 |
| 브라우저 알림이 안 뜸 | 알림 권한 허용 + **탭이 화면에 보이지 않을 때만** 뜹니다 (보이는 동안은 앱 안 알림함으로 충분) |

---

## 확장 아이디어

지금 설계에서 일부러 뺀 기능입니다. 켜려면 요금제나 "서버 없음" 구조가 바뀝니다.

**사진을 Cloud Storage 에 저장 (Blaze 요금제 필요)**
지금은 사진을 압축한 data URL 로 Firestore 문서에 넣습니다 (`IMAGE_STORAGE_MODE = 'firestore'`).
바꿀 곳은 `public/js/services/images.js` 한 파일입니다 — 다른 파일은 모두 `prepareImageForSave()` 만 부릅니다.

1. `core/firebase.js` 에 `firebase-storage` CDN 모듈 추가 → `getStorage, ref, uploadString, getDownloadURL` 다시 내보내기
2. `images.js` 의 `'storage'` 분기 구현
   ```js
   const fileRef = ref(storage, `users/${uid}/photos/${id}.jpg`);
   await uploadString(fileRef, dataUrl, 'data_url');
   return await getDownloadURL(fileRef); // https 주소 → <img src> 에 그대로 사용
   ```
3. `IMAGE_STORAGE_MODE = 'storage'` 로 바꾸고, Storage 보안 규칙도 `users/{uid}/**` 기준으로 작성

**앱을 닫아도 오는 푸시 알림 (FCM)**

1. Firebase 콘솔 → 프로젝트 설정 → Cloud Messaging → 웹 푸시 인증서(VAPID 키) 생성
2. 사이트 루트에 `public/firebase-messaging-sw.js` 서비스 워커, 토큰은 `users/{uid}/fcmTokens/{token}` 에 저장
3. 매일 체크리스트·매월 리포트 발송은 **Cloud Functions + Blaze 요금제**가 필요 (서버 없음 구조와 충돌)
4. iPhone 은 웹앱을 홈 화면에 추가해야만 웹 푸시를 받습니다

**템플릿별 프롬프트 버전**
지금은 `PROMPT_VERSION` 하나가 모든 템플릿에 적용됩니다. 템플릿마다 버전을 따로 두려면 `ai/prompts.js` 의 파일 이름 조립 부분을 템플릿별 설정을 읽도록 바꾸면 됩니다.

---

## 개발 과정 기록

이 프로젝트는 4인 팀이 바이브 코딩(AI 코딩 도구 활용)으로 만들었습니다. 기술 명세를 공통 6개 + 화면 6개 지침으로 나눠
공통 부분을 먼저 만든 뒤 화면들을 병렬로 개발하고 하나로 합쳤습니다. 당시 문서는 참고용으로 `docs/archive/` 에 보관합니다 (현재 코드와 다를 수 있으며, 실행에는 필요 없음).

| 파일 | 내용 |
| :--- | :--- |
| [`docs/archive/00_MAIN.md`](docs/archive/00_MAIN.md) | 개발할 때 모든 AI 작업에 함께 넣던 공통 지침 (계약·코딩 규칙·작업 분담) |
| [`docs/archive/plant-coach-vibe-v3/`](docs/archive/plant-coach-vibe-v3/) | 공통(C1~C6)·화면(P1~P6)별 바이브 코딩 지침 원본 |
| [`docs/archive/PROGRESS.md`](docs/archive/PROGRESS.md) | 지침별 작업 기록, 브랜치 통합·버그 수정 기록 |
