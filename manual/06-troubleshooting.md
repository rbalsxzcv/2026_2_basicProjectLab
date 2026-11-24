# 06. 문제 해결

화면에는 짧은 안내만 나옵니다. **자세한 원인은 F12 → Console** 에서 확인하세요.
(사진·프롬프트 본문은 콘솔에 찍히지 않고, 길이만 나옵니다)

## 실행

| 증상 | 원인 | 해결 |
| :--- | :--- | :--- |
| 주소를 열었더니 `GET / 404` | 프로젝트 맨 위 폴더를 서버로 엶 | `python -m http.server 5500 --directory public` |
| 빈 화면, 콘솔에 CORS / module 오류 | `file://` 로 열었음 | 서버로 열기 ([01](01-local-run.md)) |
| 고친 코드가 반영 안 됨 | 브라우저 캐시 | Ctrl+F5 |
| "Firebase 설정이 필요해요" 카드 | `firebaseConfig` 가 `YOUR_...` | [02](02-firebase-setup.md) |
| 로그인 후 "회원정보가 비어 있어요" | 가입 때 회원정보 저장 실패 | 내 정보 화면에서 다시 저장 (식물이 없으면 저장 후 식물 등록으로 이동) |
| Firestore `Missing or insufficient permissions` | 보안 규칙 미게시 / 로그인 안 됨 | `firestore.rules` 를 콘솔 규칙 탭에 게시 |
| 보안 규칙 게시 시 `Parse error` | `rules_version` 앞에 주석이 있음 | `rules_version = '2';` 를 맨 첫 줄로 |

## AI (real 모드) — 콘솔의 `[ai] 호출 실패 …` 줄

| 콘솔 내용 | 원인 | 해결 |
| :--- | :--- | :--- |
| `[ai] real 모드지만 준비가 안 됐어요 … mock 으로 동작합니다` | `AI_MODELS.text` 가 비었거나 AI 초기화 실패 | [03](03-real-ai-mode.md) A-3 |
| App Check / 401 / unauthenticated | 디버그 토큰 미등록 (또는 다른 브라우저·시크릿 창) | [03](03-real-ai-mode.md) B-1 |
| `API_KEY_SERVICE_BLOCKED` | 웹 API 키에 API 제한이 걸림 | 담당자 A: Cloud 콘솔에서 Firebase AI Logic API 허용 |
| 403 / PERMISSION_DENIED | AI Logic 설정 문제 | 담당자 A 에게 알리기 |
| 404 / model not found | 모델 이름이 바뀜·종료됨 | [공식 모델 목록](https://firebase.google.com/docs/ai-logic/models)에서 새 이름으로 |
| 429 | 무료 요금제 분당 한도 | 잠시 후 다시 |
| 화면에 "오늘 AI 코치 이용량을 모두 썼어요" | 브라우저별 하루 한도 | F12 → Application → Local Storage → `plantCoach.aiUsage` 삭제 |
| 화면에 "응답이 너무 늦어요" | 45초 시간 초과 | 잠시 후 다시 / `AI_TIMEOUT_MS` |

AI 가 실패해도 화면은 멈추지 않습니다. 체크리스트는 기본 루틴, 환경 분석은 규칙 기반 조언("기본 가이드를 보여 드려요"),
월간 리포트는 통계 기반 기본 문구(`generatedBy: 'DEFAULT'`)로 대신 채워집니다.

## 기능별

| 증상 | 확인할 것 |
| :--- | :--- |
| 조도 측정에서 카메라가 안 켜짐 | HTTPS 또는 localhost 인지, 카메라 권한을 허용했는지. 안 되면 4가지 위치 프리셋으로 선택 가능 |
| 날씨를 불러오지 못했어요 | 내 정보에 거주지역이 있는지, real 모드면 인터넷 연결 |
| 체크리스트에 물주기가 안 나옴 | 정상일 수 있음 — 물주기는 **예정일이 된 날에만** 들어옵니다. `#/dev` [물주기 예정일을 오늘로] → [오늘 체크리스트 지우기] |
| 사진 경험치가 안 오름 | 하루 첫 사진만 +15 (식물 등록 사진도 그날 사진으로 셈). `#/dev` [P1] [오늘 사진 기록 지우기] |
| 리포트에 [리포트 만들기] 버튼이 없음 | 이번 달(미리보기만), 식물을 등록하기 전 달, 아직 오지 않은 달은 만들 수 없음 |
| 브라우저 알림이 안 뜸 | 알림 권한 허용 + **탭이 화면에 보이지 않을 때만** 뜹니다 (보이는 동안은 앱 안 알림함으로 충분) |
