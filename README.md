# AI 반려식물 코치 🌱

식물을 처음 키우는 사람이 AI 코치와 함께 관리 습관을 만들도록 돕는 웹앱 프로토타입입니다.
식물마다 귀여운 **데포르메(치비) 캐릭터**가 생기고, 체크리스트를 마칠수록 경험치가 쌓여 캐릭터가 자랍니다.

**지키는 원칙 4가지**

1. **과습 방지(Safe-Lock)** — "흙이 말랐는지" 확인 없이는 물주기를 완료할 수 없습니다. 축축하면 벌점 없이 2일 연기.
2. **대화형 진단** — AI 는 사진만 보고 단정하지 않습니다. 증상을 관찰하고 흙 상태를 되물은 뒤 처방합니다.
3. **Anti-Guilt** — 시들거나 슬픈 그림, 겁주는 문구, 벌점이 없습니다. 밀린 일정은 "차분히 기다리는 중"으로만 표현합니다.
4. **AI 맥락 절약** — 지난 AI 분석은 사진 없이 짧은 JSON 요약으로만 저장하고, 다음 호출에 최근 몇 개만 보냅니다.

---

## 빠른 시작

```powershell
# 프로젝트 맨 위 폴더에서 (설치할 것 없음)
python -m http.server 5500 --directory public
```

브라우저에서 **`http://localhost:5500`** → 회원가입 → 첫 식물 등록. 기본은 **mock(가짜 AI)** 모드라 바로 끝까지 써 볼 수 있습니다.

### 설명서 (`manual/`)

| 문서 | 내용 |
| :--- | :--- |
| [01. 로컬 실행](manual/01-local-run.md) | 서버 띄우기, localhost 로 열어야 하는 이유, 강력 새로고침 |
| [02. Firebase 설정](manual/02-firebase-setup.md) | 프로젝트·웹 앱 `firebaseConfig`, 로그인, Firestore·보안 규칙, SDK 버전 |
| [03. 실제 AI(real) 모드](manual/03-real-ai-mode.md) | AI Logic, App Check 사이트 키·**디버그 토큰 등록**, 모델 이름, 하루 한도, 날씨 real |
| [04. 개발·테스트 도구](manual/04-dev-tools.md) | `#/dev` 테스트 버튼, `#/prompt-lab`, 통합 확인 순서 |
| [05. 배포](manual/05-deploy.md) | Firebase Hosting (휴대폰 카메라 테스트·시연용 HTTPS), 배포 전 체크리스트 |
| [06. 문제 해결](manual/06-troubleshooting.md) | 콘솔 오류별 원인과 해결 |
| [07. 확장 가이드](manual/07-extensions.md) | Cloud Storage 사진 저장, FCM 푸시 (팀 결정 필요) |

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
| 사진 | 압축한 data URL 을 Firestore 에 저장 | Cloud Storage(Blaze) 미사용 |

## 화면과 기능

| 주소 | 화면 | 지침 | 핵심 |
| :--- | :--- | :--- | :--- |
| `#/login`, `#/signup` | 로그인 · 회원가입 | C3 | 아이디(영문 소문자·숫자 4~20) + 비밀번호(6+), 닉네임·거주지역·자택 종류 |
| `#/main` | 메인 게임 | C6 | 캐릭터 상태(평온·기다림·관찰 필요·성장), 쓰다듬기, 레벨 바, 체크리스트 바로가기 |
| `#/plants/new`, `#/plants/:id/edit`, `#/plants` | 식물 등록 · 수정 · 관리 | C4 | 종류 검색(없으면 AI 로 새 종류 추가), 사진 → AI 캐릭터, 정기 일정 4개 자동 생성 |
| `#/checklist` | 오늘의 체크리스트 | P3 | AI 데일리 루틴(+5) + 예정일이 된 정기 관리(+20), **물주기 Safe-Lock** |
| `#/calendar` | 성장 캘린더 | P1 | 사진 → AI 관찰 → 흙 상태 질문 → 오늘 할 일 2가지, 달력·타임라인 (+15, 하루 1회) |
| `#/environment` | AI 환경 분석 | P5 | 카메라 3초 조도 추정(또는 위치 선택) + 날씨 → 적합도 점수·빛 판정·AI 조언 |
| `#/report`, `#/report/:month` | 월간 리포트 | P6 | 지난달 통계 + AI 칭찬·다음 달 습관, 6개월 이상 분갈이 안내, 수명 마무리 안내 |
| `#/notifications` | 알림함 | P4 | 체크리스트·리포트 알림, 🔔 안 읽은 수, (선택) 브라우저 알림 |
| `#/profile` | 내 정보 | C3 | 닉네임·거주지역 수정, 비밀번호 변경, 로그아웃 |
| `#/dev`, `#/prompt-lab` | 개발용 | C1~P6, P2 | 테스트 버튼, 프롬프트 실험실 — **배포 전 제거** |

경험치: 데일리 +5 · 정기 관리 +20 · 하루 첫 사진 +15 · 레벨 = ⌊EXP/100⌋+1 · 성장 단계 Lv1–2 새싹 / Lv3–5 어린 모종 / Lv6+ 풍성한 식물.
로그인 직후에는 식물마다 오늘 체크리스트와 지난달 리포트가 없으면 자동으로 만들고 알림을 남깁니다 (`js/core/startup.js`).

## 폴더 구조

```text
.
├─ README.md                 ← 지금 이 파일
├─ 00_MAIN.md                ← 공통 약속(계약)·코딩 규칙·파일 소유권 — 모든 AI 작업에 함께 넣는 메인 지침
├─ manual/                   ← 실행·설정 설명서 (위 표)
├─ plant-coach-vibe-v3/      ← 바이브 코딩 지침 원본 (00_MAIN, common/C1~C6, pages/P1~P6)
├─ docs/PROGRESS.md          ← 작업 기록 (지침마다 한 항목씩)
├─ firestore.rules · firebase.json · .gitattributes · .gitignore
└─ public/                   ← 브라우저가 실행하는 전부 (이 폴더를 서버로 엶)
   ├─ index.html             ← 유일한 HTML (앱 셸)
   ├─ css/  base.css · components.css · pages/<화면>.css
   ├─ assets/characters/     ← 기본 캐릭터, 레벨 소품 SVG
   ├─ data/                  ← plant-species.json(기본 식물 10종) · regions.json(시·도 좌표) · daily-tasks.json
   ├─ prompts/               ← AI 프롬프트 템플릿 <이름>.v<번호>.txt + samples/(실험실 입력)
   ├─ mocks/                 ← mock 모드 가짜 AI 응답
   └─ js/
      ├─ app.js              ← 시작점: 로그인 감시 → 라우터
      ├─ core/               ← firebase(-config) · router · routes · store · startup · ai(-config) · weather
      ├─ ai/                 ← provider(AI 어댑터) · prompts · normalize · json · usage
      ├─ services/           ← ★ Firestore 접근은 여기서만 (auth, users, plants, species, schedules, checklists, …)
      ├─ ui/                 ← layout · components(토스트·모달 등) · celebrate · diagnosis-flow
      ├─ utils/              ← date(한국 시간) · dom(html 자동 이스케이프) · image · lux · envScore
      └─ pages/              ← 화면 하나 = 파일 하나
```

---

## 프롬프트 템플릿 관리

AI 에게 보내는 글(프롬프트)은 코드에 쓰지 않고 `public/prompts/` 의 텍스트 파일로 관리합니다.
팀 결정: **"좋은 출력이 나온 프롬프트는 템플릿으로 남긴다."**

### 파일 이름과 변수

* `<이름>.v<번호>.txt` — 예: `diagnose.v1.txt`, `advice.v2.txt`
* 지금 쓰는 버전은 `public/js/core/ai-config.js` 의 `PROMPT_VERSION` (현재 `v1`)
* `{speciesName}` 처럼 중괄호로 감싼 영문 이름은 변수이고 `js/ai/prompts.js` 가 채웁니다. 객체·배열은 JSON 글자로, 빈 값은 `정보 없음` 으로 들어갑니다.

| 템플릿 | 쓰는 함수 (`core/ai.js`) | 변수 | 문구 수정 담당 |
| :--- | :--- | :--- | :--- |
| `character` | `generateCharacter` | speciesName | A |
| `diagnose` | `diagnose` | speciesName | P1 (B) |
| `advice` | `advise` | speciesName, symptoms, userAnswer, recentHistory | P1 (B) |
| `environment` | `analyzeEnvironment` | speciesName, profile, measuredLux, weather, homeType, windowDir, heaterOrAcExposed | P5 (D) |
| `checklist` | `suggestChecklist` | speciesName, profile, weather, latestEnvironment, dueSchedules, recentHistory | P3 (C) |
| `monthly-report` | `writeMonthlyReport` | speciesName, daysSincePurchase, lifespan, stats, monthlyHistory, previousReport | P6 (D) |
| `species` | `generateSpecies` | speciesName (사용자가 입력한 식물 이름) | A |

개선 절차·실험실·샘플 입력(`prompts/samples/`)은 P2 (B) 담당입니다.

### 개선하는 순서

1. 지금 버전을 복사해 새 버전을 만듭니다. (`advice.v1.txt` → `advice.v2.txt`)
2. **같은 입력·같은 사진·같은 반복 횟수**로 v1 과 v2 를 비교합니다. (`#/prompt-lab` 에서 버전 `v1,v2` — [사용법](manual/04-dev-tools.md#prompt-lab--프롬프트-실험실))
3. 키·배열 모양 검사와 함께, 안내 내용의 안전성·구체성을 사람이 읽고 확인합니다. 특히 **흙이 축축하다고 답했을 때 물주기를 권하지 않는지** 봅니다.
4. 더 좋으면 아래 기록 표에 적고 팀에 알린 뒤 채택합니다. (채택 = `PROMPT_VERSION` 올리기 — `ai-config.js` 는 공통 파일이라 A 에게 요청)

위험하거나 어색한 안내가 보이면 개선점을 표에 남기고 새 버전에서 다시 확인합니다.

### 꼭 지킬 것

* 담당자는 **문구(wording)** 는 자유롭게 바꿀 수 있지만, 응답 JSON 의 **키 이름과 모양(`00_MAIN.md` §5.4)은 절대 바꾸지 않습니다.** 바뀌면 화면이 깨집니다.
* 겁주거나 죄책감을 주는 표현(죽음, 시듦, 실패, 경고, 벌점 등)은 쓰지 않습니다.
* 체크리스트 프롬프트에는 물주기·비료·분갈이·잎 닦기를 넣지 않습니다. (과습 방지 — 정기 관리는 일정에서만. 코드도 한 번 더 걸러 냄)

### 기록 표

| 날짜 | 템플릿 | 버전 | 바꾼 점 | 좋았던 출력 예시(요약) | 채택 여부 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 2026-11-12 | 전체 | v1 | 최초 작성 (C2) | — | 채택 |
| 2026-11-17 | advice | v2 (후보) | 젖은 흙일 때 물주기 금지, 두 행동 가이드와 짧은 상태 태그를 분명히 함 | mock 응답은 고정이므로 real 모드 비교 전 | 미채택 · 검토 중 |
| 2026-11-18 | species | v1 | 최초 작성 (AI 식물 종류 추가) | — | 채택 |

---

## 팀 협업 방식

기술개발 명세서 v2 를 바탕으로 AI 코딩 도구에 넣을 지침을 **공통 6개 + 페이지 6개**로 나눴습니다 (`plant-coach-vibe-v3/`).
공통(C1~C6)을 팀원 A 가 먼저 만들어 **공통 인터페이스를 동결**한 뒤, 페이지(P1~P6)를 B·C·D 가 2개씩 동시에 만들었습니다.
지침 파일은 토큰을 줄이려고 영어로 썼고, 화면 문구와 프롬프트 본문은 한국어입니다.

| 팀원 | 맡은 지침 | 특징 |
| :--- | :--- | :--- |
| **A (공통)** | C1 셸 · C2 AI·날씨 · C3 인증 · C4 식물 등록 · C5 공유 서비스 · C6 메인 게임 | 동결 후 **통합 담당** (PR 리뷰, 공통 버그 수정, 계약 변경 반영, 배포) |
| **B** | P1 성장 캘린더 + P2 프롬프트 실험실 | 2단계 AI 대화 흐름, 프롬프트 품질 관리 |
| **C** | P3 체크리스트 + P4 알림 | 트랜잭션·일정 연기·경험치 규칙, 알림함 |
| **D** | P5 환경 분석 + P6 월간 리포트 | 카메라 API, 통계 집계 |

### 각 페이지를 혼자 테스트할 수 있었던 이유

* **뼈대(stub)** — 여러 페이지가 서로 부르는 함수(`ui/diagnosis-flow.js`, `services/checklists.js`, `services/notifications.js`, `services/reports.js`)를 C5 에서 최종 이름·형식 그대로 먼저 만들고, 각 담당자가 **안쪽만** 완성본으로 바꿨습니다. 지금은 모두 완성본입니다.
* **AI·날씨 mock** — 실제 AI 없이 그럴듯한 가짜 응답. `#/dev` 스위치로 각자 브라우저에서만 real 전환.
* **`#/dev` 테스트 버튼** — 공통 버튼 + 페이지별 구역(`[P1]`~`[P6]`).

### 규칙 요약 (자세히는 [`00_MAIN.md`](00_MAIN.md))

* Firestore 는 `services/` 에서만, AI·날씨는 `core/ai.js`·`core/weather.js` 로만 부릅니다.
* 사용자 입력은 `html` 템플릿(`utils/dom.js`)으로 넣어 자동 이스케이프합니다. 브라우저 `alert/confirm/prompt` 는 쓰지 않습니다.
* "오늘"은 항상 한국 시간 `today()` — `new Date().toISOString().slice(0, 10)` 금지 (오전 9시 전엔 어제 날짜).
* 모든 JS 파일 맨 위에 머리 주석(파일·역할·사용하는 파일·담당), 주석은 한국어.
* 공통 파일(§9.3 표 밖)을 바꾸려면 직접 고치지 말고 팀 채널에 **"계약 변경 제안"**(무엇을·왜·영향받는 페이지) → 4명 합의 → A 가 `00_MAIN.md` 를 먼저 고치는 PR → 코드 PR 순서로 머지.
* 브랜치를 합칠 때 충돌 난 파일은 "한쪽 선택"이 아니라 **양쪽 구역을 모두 남깁니다** (특히 `dev-ui.js`, `docs/PROGRESS.md`). 줄바꿈은 `.gitattributes` 로 LF 통일.

### AI 코딩 도구에 붙여 넣을 문장

**새로 시작할 때** (지침 파일 이름만 바꾸세요)
```text
00_MAIN.md 와 plant-coach-vibe-v3/pages/P3_checklist.md 를 읽고 이 지침의 작업을 진행해 줘.
시작하기 전에 docs/PROGRESS.md 와 "Prerequisites"에 적힌 기존 파일들을 먼저 열어서 실제 함수 이름을 확인하고,
만들 파일 목록과 순서를 알려 준 다음 시작해. 지침의 수정 허용 파일 목록 밖의 파일은 고치기 전에 나한테 물어봐.
설명과 주석은 한국어로 해 줘.
```

**대화가 길어져 이어서 할 때**
```text
00_MAIN.md 와 plant-coach-vibe-v3/pages/P3_checklist.md 를 읽어 줘. 이 작업을 이어서 하는 중이야.
docs/PROGRESS.md 와 지금까지 만든 파일을 확인하고, "Done when" 항목 중 아직 안 된 것부터 진행해 줘.
```

> 루트의 `00_MAIN.md` 가 최신본입니다 (AI 식물 종류 추가 기능의 계약 `generateSpecies`·`customSpecies` 포함).
> `plant-coach-vibe-v3/00_MAIN.md` 는 처음 배포된 지침 원본입니다.

명세서의 "회의 후 확인 필요 사항"(쓰다듬기 경험치, 아이디 형식 등)이 결정되면 `00_MAIN.md` 5.6·5.9절의 값만 바꾸면 됩니다.
