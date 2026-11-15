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
