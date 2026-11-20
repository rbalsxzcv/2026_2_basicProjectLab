# 진행 기록

## [C1] 앱 셸 · 라우터 · 공통 UI · Firebase 연결 (2026-11-12, 담당: A)
- 만든 파일: `public/index.html`, `public/css/base.css`, `public/css/components.css`,
  `public/js/app.js`, `public/js/core/{firebase-config,firebase,routes,router,store,startup}.js`,
  `public/js/ui/{layout,components}.js`, `public/js/utils/{date,dom}.js`,
  `public/js/pages/{not-ready,dev-ui}.js`, `firestore.rules`, `firebase.json`, `.gitignore`, `docs/PROGRESS.md`
- 수정한 파일: 없음
- 동작 확인 방법:
  - VS Code Live Server 로 `public/index.html` 열기, 또는 `python -m http.server 5500 --directory public` → http://localhost:5500
  - Firebase 설정 전: 안내 카드가 보임. `#/dev` 는 Firebase 없이도 열려서 토스트·모달·choiceModal·로딩·게이지를 눌러 볼 수 있음
  - Firebase 설정 후: `#/abc` → "준비 중", 로그아웃 상태에서 `#/main` → `#/login`
- 남은 문제 / 알릴 것:
  - Firebase SDK 버전 `13.3.0` (`core/firebase.js` 맨 위 `FIREBASE_VERSION` + import 주소 5곳)
  - `firebase-config.js` 는 아직 자리표시값(`YOUR_...`). 값 넣는 방법은 파일 맨 위 주석 참고
  - App Check 사이트 키는 비어 있음 → 비어 있는 동안 App Check 를 건너뜀 (AI real 모드는 동작 안 함, mock 은 동작)
  - 계약 외 추가 export: `router.getCurrentPageInfo()` (app.js 가 로그아웃 때 사용), `routes.GUEST_ONLY_PATHS`,
    `startRouter({ intercept })` 옵션 (Firebase 설정 전 안내 화면용)
  - Firebase Hosting 배포(HTTPS 가 필요한 휴대폰 카메라 테스트·시연용):
    Firebase CLI 설치 → `firebase login` → 프로젝트 폴더에서 `firebase use <프로젝트ID>` → `firebase deploy --only hosting`

## [C2] AI 어댑터 · 날씨 · 프롬프트 템플릿 (2026-11-12, 담당: A)
- 만든 파일: `public/js/core/{ai-config,ai,weather}.js`, `public/js/ai/{provider,prompts,json,normalize,usage}.js`,
  `public/prompts/{character,diagnose,advice,environment,checklist,monthly-report}.v1.txt`, `public/prompts/README.md`,
  `public/mocks/{diagnose-1,diagnose-2,advice,environment,checklist,monthly-report}.json`
- 수정한 파일: `public/js/pages/dev-ui.js` (AI·날씨 구역)
- 동작 확인 방법: `#/dev` → "AI · 날씨 테스트" 에서 함수별 버튼 → `<pre>` 에 §5.4 모양 JSON.
  suggestChecklist 는 mock 에 일부러 넣은 WATER 가 걸러짐. [입력 빠짐 테스트] → "사진이 필요해요."
- 사용 모델: **아직 없음** — `AI_MODELS = { text: '', vision: '', image: '' }`.
  real 모드로 바꿔도 모델 이름이 비어 있으면 경고 1번 + mock 으로 동작.
  모델 이름은 Firebase AI Logic 공식 문서(https://firebase.google.com/docs/ai-logic/models)에서 골라 `ai-config.js` 에 넣기
- 캐릭터 이미지: **mock SVG** (image 모델이 비어 있음). 무료 요금제에서 이미지 생성 모델이 되면 `AI_MODELS.image` 에 이름 입력
- 날씨: mock 기본. real(Open-Meteo)은 키 없이 동작 확인함 (서울 현재 기온·습도 반환)
- 남은 문제 / 알릴 것:
  - real 모드 코드는 SDK 13.3.0 의 실제 export(getAI, GoogleAIBackend, getGenerativeModel, ResponseModality)를 확인하고 작성했지만,
    Firebase 프로젝트가 없어 실제 Gemini 호출은 아직 시험하지 못함 → 콘솔 설정 후 `#/dev` 에서 확인 필요
  - `ai-config.js` 에 `setAiMode`, `setWeatherMode` 추가 (#/dev 스위치용)

## [C3] 로그인 · 회원가입 · 내 정보 (2026-11-12, 담당: A)
- 만든 파일: `public/data/regions.json`, `public/js/services/{auth,users}.js`,
  `public/js/pages/{login,signup,profile}.js`, `public/css/pages/{auth,profile}.css`
- 수정한 파일: `public/js/core/startup.js` ([C3] 구역)
- 동작 확인 방법 (Firebase 설정 후): 가입 → Authentication 에 `아이디@plantcoach.example`, Firestore `users/{uid}`(비밀번호 없음) 생성 →
  같은 아이디로 가입 시 "이미 사용 중인 아이디예요." → 내 정보에서 닉네임·지역 수정 후 새로고침해도 유지 → 비밀번호 변경 → 로그아웃
- 남은 문제 / 알릴 것:
  - Firebase 콘솔에서 Authentication → 이메일/비밀번호 사용 설정 + `firestore.rules` 게시 필요
  - 가입 직후 로그인 감시가 회원정보 저장보다 먼저 도는 문제를 막으려고 `users.setPendingSignup()` 추가
  - 추가 export: `auth.ProfileSaveError`, `auth.currentLoginId()`

## [C4] 식물 등록 · 식물 관리 · 데포르메 캐릭터 (2026-11-12, 담당: A)
- 만든 파일: `public/data/plant-species.json`, `public/js/services/{species,images,plants,schedules}.js`,
  `public/js/utils/image.js`, `public/assets/characters/default.svg`,
  `public/js/pages/{plant-register,plant-manage}.js`, `public/css/pages/plant.css`
- 수정한 파일: `public/js/core/startup.js` ([C4] 구역)
- 동작 확인 방법: 새 계정 로그인 → 식물 등록 화면 자동 이동 → 종류·이름·날짜·(수명)·사진 → 등록 →
  Firestore 에 `plants` 1개, `schedules` 4개, (사진 있으면) `photos` 1개. 바질·방울토마토만 수명 칸 보임
- 남은 문제 / 알릴 것:
  - `plant-species.json` 값은 참고용 대략값 → 팀 검토 필요
  - 정기 일정의 시작일은 항상 "등록한 날(오늘)" — 오래전에 산 식물도 첫날부터 밀린 일정이 생기지 않게
  - 첫 사진은 C5 의 `photos.addPhoto()` 로 저장 (C4·C5 를 한 번에 만들어서 처음부터 이 방식)
  - 큰 사진 압축 확인: 3000×2000 PNG → 긴 쪽 768px JPEG 로 줄여 700KB 이하
  - 추가 export: `plants.DEFAULT_CHARACTER`

## [C5] 공유 서비스 · 페이지용 뼈대 · 시작 작업 연결 · 테스트 도구 (2026-11-12, 담당: A)
- 만든 파일: `public/js/services/{aiHistory,environments,photos,checklists,notifications,reports,dev-tools}.js`,
  `public/js/ui/diagnosis-flow.js`, `public/data/daily-tasks.json`
- 수정한 파일: `public/js/services/schedules.js` (getDueSchedules·hasOverdue·completeSchedule·postponeSchedule 추가),
  `public/js/core/startup.js` (백그라운드 구역 전부 — **이제 동결**), `public/js/pages/dev-ui.js` (공용 테스트 + [P1]~[P6] 빈 구역)
- 동작 확인 방법: `#/dev` 공용 테스트 → [물주기 예정일을 오늘로] → [오늘 체크리스트 지우기] → 새로고침 → 체크리스트에 물주기 포함
  ([현재 식물 데이터 보기] 로 확인)
- 뼈대 파일 (담당자가 안쪽만 완성, 이름·인자·반환 형식 유지):
  `ui/diagnosis-flow.js` → P1 · `services/checklists.js` → P3 · `services/notifications.js` → P4 · `services/reports.js` → P6
- 남은 문제 / 알릴 것:
  - `services/dev-tools.js` 추가: #/dev 공용 버튼이 Firestore 를 직접 고쳐야 해서 "Firestore 는 services/ 에서만" 규칙을 지키려고 만든 개발용 파일.
    배포할 때 `dev-ui.js` 와 함께 지우면 됨 (00_MAIN §4 폴더 구조에는 아직 없음 → 팀 확인 필요)
  - aiHistory 의 type 필터는 색인 없이 "최신 20개를 가져와 화면 쪽에서 거름"

## [C6] 메인 게임 화면 · 경험치 · 캐릭터 상태 머신 (2026-11-12, 담당: A)
- 만든 파일: `public/js/services/game.js`, `public/js/ui/celebrate.js`,
  `public/assets/characters/{deco-ribbon,deco-butterfly,deco-star}.svg`,
  `public/js/pages/main.js`, `public/css/pages/main.css`
- 수정한 파일: `public/js/pages/dev-ui.js` (게임 테스트 구역)
- 동작 확인 방법: `#/dev` 게임 테스트 → [관찰 필요 켜기/끄기] → 메인에 돋보기(ALERT) / [방금 관리함] → 반짝이(GROWING) /
  공용 [물주기 예정일을 3일 전으로] → 숨쉬기 + "…"(WAITING) / [+100 EXP] → 레벨업 모달. 메인에서 캐릭터를 톡 누르거나 좌우로 문지르면 반응
- 남은 문제 / 알릴 것:
  - 쓰다듬기 경험치 `EXP.PET = 0` (팀 결정 전). 0보다 크게 바꾸면 하루 3번까지 자동 지급
  - **공통 통합 확인(가입 → 식물 등록 → 메인 → 로그아웃 → 다시 로그인)은 Firebase 프로젝트를 연결한 뒤 해야 함.**
    통과하면 아래 줄을 "공통 완료·동결, P1~P6 시작 가능" 으로 바꾸세요.
  - 상태: 공통 코드 작성 완료 — Firebase 연결 후 통합 확인 대기

## [P1] 성장 캘린더 · 대화형 사진 진단 (2026-11-17, 담당: B)
- 만든 파일: `public/js/services/diagnosis.js`, `public/js/pages/calendar.js`, `public/css/pages/calendar.css`
- 완성한 파일: `public/js/ui/diagnosis-flow.js` (사진 미리보기 → 관찰 → 흙 질문 → 오늘 가이드 → 사진·AI 기록·경험치 저장)
- 수정한 파일: `public/js/pages/dev-ui.js` ([P1] 구역에 오늘 사진 기록 초기화와 캘린더 링크 추가)
- 동작 확인 방법: Firebase 설정 후 `#/dev` 에서 AI 모드를 mock 으로 두고 `[P1] 오늘 사진 기록 지우기` 로 일일 경험치 흐름 초기화 → `#/calendar` 에서 사진 진단과 사진만 기록을 각각 확인
- 남은 확인: Firebase 연결 후 diagnose-1 / diagnose-2 mock, 하루 첫 사진 +15 EXP, 월 이동·날짜 선택·기록 펼치기에서 AI 미호출을 통합 확인

## [P2] 프롬프트 실험실 · 템플릿 버전 비교 (2026-11-17, 담당: B)
- 만든 파일: `public/js/pages/prompt-lab.js`, `public/css/pages/prompt-lab.css`, `public/prompts/samples/*-input.json`
- 추가한 프롬프트: `public/prompts/advice.v2.txt` (후보 버전, 아직 채택 안 함; `PROMPT_VERSION` 은 v1 유지)
- 수정한 파일: `public/prompts/README.md` (실험 절차·mock 한계·후보 기록), `public/js/pages/dev-ui.js` ([P2] 실험실 링크)
- 동작 확인 방법: 로그인 후 `#/prompt-lab` 에서 템플릿·입력·버전·반복 횟수 선택 → 결과 JSON 모양 검사 및 JSON 다운로드 확인
- 남은 확인: real 모드 비교는 Firebase AI Logic / App Check 설정 후 수행. mock 응답은 고정이므로 프롬프트 버전 간 품질 차이를 평가하지 않음

## [P3] 체크리스트 · Safe-Lock (2026-11-15, 담당: C)
- 만든 파일: `public/js/pages/checklist.js`, `public/css/pages/checklist.css`
- 수정한 파일: `public/js/services/checklists.js` (C5 뼈대 → 완성, 함수 형식 유지), `public/js/pages/dev-ui.js` ([P3] 구역만)
- 동작 확인 방법 (Firebase 설정 후):
  - `#/checklist` 진입 → 오늘 문서 1개만 생성 (`#/dev` [오늘 체크리스트를 AI로 다시 만들기] 로 재생성)
  - mock 에 WATER 가 있어도 데일리 루틴엔 물주기가 없음. 물주기는 정기 관리만 (`#/dev` 공용 [물주기 예정일을 오늘로] → [오늘 체크리스트 지우기] → 진입)
  - 데일리 +5 / 정기 +20 EXP → 메인 EXP 바에 반영, 레벨업 시 축하 모달
  - 물주기 완료 버튼 → 흙 확인 팝업 (배경 클릭·ESC 로 닫히지 않음)
    → [아직 축축해요]: 미완료 · 무경험치 · `schedules/WATER.dueDate` = 오늘+2, 체크리스트에 미룸 카드
    → [말라 있어요]: 완료 · +20 EXP · `dueDate` = 오늘+간격
  - 지나간 정기 관리: 메인에서 WAITING → 완료 후 GROWING(30분) → PEACEFUL
  - [📷 사진으로 상태 확인하기] → `runDiagnosisFlow` (P1 머지 전엔 사진만 기록됨 — 정상)
- 남은 문제 / 알릴 것:
  - P1 이 머지되기 전까지 [사진으로 확인] 은 사진 기록만 (지침 §1-4 의 정상 동작)
  - 프롬프트·mock (`checklist.v1.txt` · `mocks/checklist.json`) 은 C2 값 유지 — 문구 수정 필요 시 이 브랜치에서 반영
  - **[P6 교차 계약 — P6 담당자 필수 확인]** `services/checklists.js` 의 체크리스트 항목은 `00_MAIN.md` §5.5 형태 그대로입니다.
    - `completedAt` = 실제 완료 날짜(UTC 기준 `YYYY-MM-DD`). P6의 `waterOnTimeRate` 계산(`completedAt ≤ dueDate + 1 day`)이 가능합니다.
    - `postponed` 항목은 **절대 `isCompleted`와 동시에 true가 될 수 없습니다**(완료 로직이 미루기 분기를 먼저 return). P6의 분모에서 미루기 제외 규칙과 모순 없습니다.
    - `summarize()`는 미루기 항목을 `{total, done, remaining, percent}` 에서 제외합니다. 메인 카드와 P6의 `routineRate` 둘 다 동일 기준으로 동작합니다.
    - 미루기 후 다음 날 `schedules/WATER.dueDate` = 오늘+2 (postponeSchedule). P6는 `schedules` 에서도 정기 관리 날짜를 읽을 수 있습니다.

## [P4] 알림함 · 브라우저 알림 (2026-11-15, 담당: C)
- 만든 파일: `public/js/pages/notifications.js`, `public/css/pages/notifications.css`
- 수정한 파일: `public/js/services/notifications.js` (C5 뼈대 → 완성, 함수 형식 유지), `public/js/pages/dev-ui.js` ([P4] 구역만)
- 동작 확인 방법 (Firebase 설정 후):
  - 오늘 체크리스트 없이 로그인 → 체크리스트 알림 1개 + 상단 🔔 숫자. 새로고침해도 같은 알림은 안 생김 (키 중복 제거)
  - 알림 탭 → 해당 식물의 `#/checklist?plant=...` 로 이동 + 읽음 처리
  - `#/dev` [P4] → [테스트 알림 만들기(체크리스트·리포트 각 1개)] → 리포트 알림은 `#/report/{지난달}?plant=...` 링크
  - [브라우저 알림 받기] → 권한 허용 후 탭을 다른 탭으로 옮기고 알림 만들면 브라우저 알림. 클릭 → 앱으로 복귀 + 해당 화면
  - [모두 읽음] → 뱃지 0
  - 30일 이전 알림은 목록에서 숨김(삭제 아님)
- 남은 문제 / 알릴 것:
  - 선택 항목 FCM(앱 닫은 뒤 디바이스 푸시)은 **팀 결정 전까지 제외** (P4 §7 — 서버 필요, 00_MAIN §3 "백엔드 없음" 원칙 충돌)
  - 리포트 알림의 본문은 P6 머지 전에도 정상 동작 (P6 는 리포트 문서 생성 쪽만 담당)
  - **[P6 교차 계약 — P6 담당자 필수 확인]**
    - `notifyReportCreated({ plantId, month })` 의 `plantId` 는 **문자열(식물 id)** 로 기대합니다. `startup.js:66` 에서 `ensureLastMonthReports` 가 반환한 `r` (=`{ plantId, month, created }`) 을 그대로 넘기므로 정상입니다.
    - **지침 오타 주의:** `prompt/pages/P4_notifications.md` §4 예제는 `notifyReportCreated({ plantId: current, ... })` 로 **식물 변수**를 적고 있습니다. 이는 지침 오타이며, 실제 서명은 `plantId` (문자열) 입니다. P6 등이 지침을 그대로 베끼면 식물 이름이 `'내 식물'` 로 고정됩니다.
    - 본 코드는 `plantId` 가 문자열이든 식물 변수든 모두 수용합니다 (`typeof plantId === 'string' ? plantId : plantId?.id ?? ''`).
    - P6 의 `computeMonthlyStats` 가 체크리스트를 읽는 경우: `completedAt` = 실제 완료 날짜, `postponed` 는 절대 `isCompleted` 와 공존하지 않음 (P3 노트의 교차 계약과 동일).

## [P5] AI 환경 분석 (2026-11-16, 담당: D)
- 만든 파일: `public/js/utils/lux.js`, `public/js/utils/envScore.js`, `public/js/pages/environment.js`, `public/css/pages/environment.css`
- 수정한 파일: `public/js/pages/dev-ui.js` ([P5] 구역), `docs/PROGRESS.md`
- 동작 확인 방법:
  - `#/environment` 에서 [측정 시작] → 3초 원형 진행 후 "약 ~ lux (추정)" 표시 및 카메라 종료 확인 (권한 거부·비HTTPS 시 4개 위치 프리셋 선택)
  - 거주지역 날씨 표시 확인 (mock 모드에서 "예시 날씨" 태그)
  - 창문 방향·냉난방기 토글 선택 후 [분석하기] → 점수·빛 판정·AI 코치 조언·세부 막대 표시 및 `environments`/`aiHistory` 저장
  - `public/mocks/environment.json` 이름을 임시 변경해 AI 실패 시 `ruleBasedTips`("기본 가이드를 보여 드려요") 폴백 확인
  - `#/dev` → `[P5] 환경 분석` 구역에서 300 / 2,000 / 20,000 lux 가짜 측정값 분석 버튼 확인
- 남은 문제 / 다른 담당자에게 알릴 것:
  - 휴대폰 실제 후면 카메라 테스트는 HTTPS(Firebase Hosting 배포) 환경에서 확인 필요
  - Firebase 콘솔 연결 전이라면 Firestore 저장·로그인 흐름은 콘솔 설정 후 확인 필요

## [P6] 월간 리포트 (2026-11-20, 담당: D)
- 만든 파일: `public/js/pages/report.js`, `public/css/pages/report.css`
- 수정한 파일: `public/js/services/reports.js` (C5 뼈대 완성), `public/js/pages/dev-ui.js` ([P6] 구역), `docs/PROGRESS.md`
- 동작 확인 방법:
  - `#/dev` → `[P6] 월간 리포트` → `[지난달 샘플 기록 만들기]` → `[지난달 리포트 강제 생성]` 으로 통계·AI 칭찬·제안 확인
  - `#/report` 에서 4개 통계 카드, 이전 달 대비 변화(▲ 초록 / ▼ 회색), AI 칭찬, 다음 달 습관, 분갈이/수명 안내 카드 확인
  - 이번 달 선택 시 "이번 달 기록 미리보기"만 표시되고 AI 호출이 없는지 확인
  - 이미 저장된 리포트를 다시 열 때 AI 재호출(`[ai]` 로그)이 없는지 확인
- 남은 문제 / 다른 담당자에게 알릴 것:
  - `startup.js` 수정 없이 기존 `ensureLastMonthReports` 뼈대 연결 그대로 동작함
  - Firebase 콘솔 연결 후 실제 계정에서 샘플 생성·리포트 생성·180일 이상 분갈이 안내 최종 확인 필요

## [추가] AI 식물 종류 추가 (2026-11-18, 담당: A)
- 만든 파일: `public/prompts/species.v1.txt`, `public/mocks/species.json`
- 수정한 파일 (기존 함수·변수 이름과 반환 모양은 그대로, 추가만 함):
  - `public/js/core/ai.js` — `generateSpecies({ speciesName })` 추가 (Firebase AI Logic, text 모델)
  - `public/js/ai/normalize.js` — `RULES.species` · `checkShape('species')` 추가 (숫자 범위·lifespanType 다듬기)
  - `public/js/services/species.js` — `findSpeciesByName`, `addSpeciesByName` 추가.
    AI로 만든 종류는 `users/{uid}/customSpecies/ai-xxxx` 에 저장되고 `loadSpecies`/`getSpecies`/`searchSpecies` 결과에 함께 나옴
  - `public/js/pages/plant-register.js` — 검색어와 정확히 같은 종류가 없으면 [🤖 'OO' AI로 새 식물 추가하기] 버튼 표시
  - `00_MAIN.md` §5.4·§5.5, `public/prompts/README.md` — 새 함수·컬렉션·템플릿 기록
- 동작 확인 방법: `#/plants/new` → 검색칸에 목록에 없는 이름(예: 아레카야자) 입력 → [AI로 새 식물 추가하기] →
  선택 카드에 "AI가 만들어 준 참고용 정보예요" 표시 → 등록 → Firestore `customSpecies` 1개, `plants.speciesId = 'ai-…'`, `schedules` 4개.
  mock 모드에서는 입력한 이름 + 기본 생육값으로 만들어짐
- 남은 문제 / 알릴 것:
  - 다른 화면은 지금처럼 `getSpecies(plant.speciesId)` 만 쓰면 AI 종류도 그대로 동작 (추가 작업 없음)
  - AI 생육값은 참고용 대략값. 이미 같은 이름(별칭 포함)이 있으면 AI를 부르지 않고 기존 종류를 씀
  - `firestore.rules` 변경 불필요 (`users/{uid}/**` 규칙에 포함)

## [추가] AI 식물 종류 추가 — 안전장치 보강 (2026-11-18, 담당: A)
- 수정한 파일 (이번에 새로 추가한 기능 범위 안에서만 수정, 기존 공통 함수·변수·반환 모양은 그대로):
  - `public/js/ai/normalize.js` (`RULES.species`) — `isPlant === true` 일 때만 통과(빠지면 거절), `rejectReason` 추가,
    입력 글자 제한(한글·영문·숫자·띄어쓰기·- · ( ), 2~30자), 재배 제한 식물(대마·양귀비 등) 입력·출력 모두 차단,
    이름·별칭·careTip 금지어(죽음·시듦·실패·경고 등) 검사, 물주기 최소 3일(여러해살이)/2일(그 외)
  - `public/prompts/species.v1.txt` — 판정 기준(NOT_PLANT / NOT_GROWABLE / RESTRICTED), 입력 속 지시 무시, 애매하면 보수적으로
  - `public/js/services/species.js` — `previewSpeciesByName`(AI 초안, 저장 안 함) · `saveSpeciesDraft`(확인 후 저장) 추가,
    `addSpeciesByName` 은 같은 이름·같은 인자로 유지(두 함수를 이어서 부름). 문서 id = 'ai-' + 대표 이름 → 중복 저장 방지
  - `public/js/pages/plant-register.js` — 저장 전 확인 창, 검색 결과가 없고 2글자 이상일 때만 AI 버튼 표시
  - `public/css/pages/plant.css` — 확인 창 목록 스타일(`.species-draft`)
  - `public/mocks/species.json`, `00_MAIN.md` §5.4·§5.5 — `rejectReason`, 새 함수 기록
- 동작 확인 방법: `#/plants/new` → ① "몬" 입력 → 버튼 안 보임 ② 목록에 없는 이름 → 버튼 → 확인 창 → [다시 입력할게요] → Firestore 에 저장 안 됨
  ③ 다시 → [이 정보로 추가하기] → `customSpecies/ai-<이름>` 저장 ④ "대마" → AI 호출 없이 안내 ⑤ "몬스테라{}" → 글자 안내
- 남은 문제 / 알릴 것 (코드만으로 못 막음 → 팀 결정):
  - mock 모드는 항상 "식물"로 판정하고 기본값으로 만듦 → 배포 시 real 모드 확인 필요. mock 으로 만든 테스트 데이터는 콘솔에서 지우기
  - AI 생육값의 정확성 자체는 검증 불가 (참고용 표시 + 사용자 확인으로 완화). 다른 화면의 "AI 정보" 표시, 종류 수정·삭제 화면은 미구현
  - 브라우저에서 도는 검사이므로 의도적 변조는 못 막음 (사용자별 저장이라 피해는 본인 계정 한정)
  - 예전에 만든 종류(id 가 'ai-<무작위>')도 그대로 동작함

## [버그] "쓰레기통"이 식물로 등록됨 (2026-11-18, 담당: A)
- 원인: `core/ai-config.js` 의 `AI_MODELS.text` 가 비어 있어 #/dev 에서 real 로 바꿔도 `provider.js` 가 mock 으로 동작.
  mock 응답(`mocks/species.json`)은 항상 isPlant: true → 무엇을 넣어도 통과. (코드 필터로는 "식물인지"를 판단할 수 없음)
- 수정: `mocks/species.json` 에 `"_mock": true` → normalize 가 `isMock` 으로 전달 → mock 으로 만든 종류는 `source: 'MOCK'` 으로 저장,
  확인 창·선택 카드에 "테스트(mock) 모드라 AI가 실제로 확인하지 않았어요" 표시
- 실제 판정을 쓰려면: `AI_MODELS.text` 에 공식 문서(https://firebase.google.com/docs/ai-logic/models)의 모델 이름을 넣고 #/dev 에서 real 로 전환 (팀 결정)
- 정리할 것: 테스트로 만든 `users/{uid}/customSpecies` 문서(예: ai-쓰레기통)와 그 종류로 등록한 식물은 콘솔/내 식물 관리에서 삭제

## [설정] 실제 AI(real) 모드 준비 (2026-11-18, 담당: A)
- 수정한 파일: `public/js/core/ai-config.js` (`AI_MODELS.text = 'gemini-3.8-flash'`, `AI_MODE` 는 'mock' 유지),
  `public/js/core/firebase-config.js` (`appCheckSiteKey` — reCAPTCHA v3 공개 사이트 키), `README.md` (실행·real 모드·테스트 안내)
- Firebase 콘솔: AI Logic(Gemini Developer API) 시작, App Check(reCAPTCHA v3) 등록
- 동작 확인 방법: README "실제 AI(real) 모드 켜기" 순서대로 디버그 토큰 등록 → #/dev 에서 real → advise 버튼 → 사용량 증가 확인
- 남은 문제 / 알릴 것: 팀원은 각자 디버그 토큰 등록 필요. Firestore App Check 적용(Enforce)은 아직 끔


## [통합] 4개 브랜치 합치기 · 통합 디버그 (2026-11-20, 브랜치: integration)
- 합친 브랜치: `gyuminKim`(공통 C1~C6 + AI 식물 종류), `Jun_Seok`(P1·P2), `Junsang`(P3·P4), `Jeanwon`(P5·P6 — main 에 아직 머지 안 돼 있었음)
- main 에서 고장 난 원인:
  - `Jeanwon` 브랜치(P5 환경 분석·P6 월간 리포트)가 main 에 없음 → `#/environment`, `#/report` 가 "준비 중", 리포트 자동 생성 안 됨
  - 머지 충돌을 한쪽 내용으로 덮어써서 내용이 사라짐:
    `public/js/pages/dev-ui.js` ([P1]·[P2] 테스트 구역 사라짐), `docs/PROGRESS.md` ([P3]·[P4]·[추가]·[버그]·[설정] 기록 사라짐),
    `public/prompts/README.md` (species v1 기록 사라짐)
  - 줄바꿈(CRLF/LF)이 팀원마다 달라 파일 전체가 바뀐 것처럼 보임 → 충돌·덮어쓰기의 원인
- 수정한 것:
  - 위 3개 파일을 브랜치별 원본으로 다시 3-way 병합 (모든 구역·기록 복원)
  - `.gitattributes` 추가 (`* text=auto`) — 저장소에는 항상 LF 로 저장. `services/checklists.js` 는 줄바꿈만 LF 로 바뀜(내용 같음)
  - `pages/report.js` — 식물 등록 전 달·아직 오지 않은 달에도 [리포트 만들기] 가 보여 빈 통계 리포트가 저장되던 문제 →
    `reports.isEligible` 로 확인해서 안내 문구만 표시
  - `pages/calendar.js` — 사진이 없을 때 나오는 [사진 기록하기] 버튼이 지금 화면(#/calendar) 링크라 눌러도 반응이 없던 문제 →
    [📷 오늘 사진 기록하기] 와 같은 동작
  - `pages/dev-ui.js` [P4] — 버튼 이름 "알림 모두 지우기" → 실제 동작대로 "알림 모두 읽음 처리"
- 동작 확인 (mock AI · 테스트용 가짜 Firebase 로 브라우저에서 자동 실행, 실제 Firebase 프로젝트에는 쓰지 않음):
  - 모든 JS 문법 · import/export 이름 · 페이지 CSS · JSON 파일 확인
  - 가입 → 식물 등록 → 메인 → 체크리스트(데일리 +5 / 물주기 Safe-Lock 미룸·완료 / 비료 +20) → 사진 진단(대화형, 하루 1회 +15) →
    환경 분석(카메라 없음 → 위치 선택, 저장) → 월간 리포트(샘플·생성·다시 열기) → 알림(생성·뱃지·탭 이동·모두 읽음) →
    로그인 직후 자동 작업(체크리스트·알림) → 내 정보 수정 → AI 식물 종류 추가 → 식물 수정·삭제 → 로그아웃·로그인
- 남은 문제 / 알릴 것:
  - 실제 Firebase(규칙·App Check)와 real AI 모드는 콘솔에서 직접 확인 필요. `AI_MODELS.vision`·`image` 는 비어 있어 사진 진단·캐릭터는 real 모드에서도 mock 으로 동작
  - 휴대폰 카메라 조도 측정은 HTTPS(Firebase Hosting) 에서 확인 필요
  - 앞으로 브랜치를 main 에 합칠 때: 충돌 난 파일은 "한쪽 선택"이 아니라 양쪽 구역을 모두 남기기 (특히 dev-ui.js · PROGRESS.md)
