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
