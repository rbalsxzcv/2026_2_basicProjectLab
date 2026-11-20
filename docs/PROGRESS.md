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
