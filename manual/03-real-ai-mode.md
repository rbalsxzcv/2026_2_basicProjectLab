# 03. 실제 AI(real) 모드 · 실제 날씨

기본값은 **mock** 입니다. `mock` 은 `public/mocks/*.json` 의 고정 응답을 돌려주고, 캐릭터는 코드로 그린 SVG 를 씁니다.
실제 Gemini 를 쓰는 **real** 모드는 아래 준비가 끝난 뒤 `#/dev` 스위치로 **각자 브라우저에서만** 켭니다.

## A. 프로젝트 쪽 준비 (한 번만, 담당자 A) — ✅ 팀 프로젝트는 이미 완료

1. **Firebase 콘솔 → AI Services → AI Logic → 시작하기 → "Gemini Developer API"** 선택 (무료 Spark 요금제 가능)
2. 설정 과정(또는 콘솔 → **App Check → 앱** 탭)에서 웹 앱에 **reCAPTCHA v3** 제공자를 등록합니다.
   * [reCAPTCHA 관리 콘솔](https://www.google.com/recaptcha/admin)에서 v3 키를 만들 때 도메인에
     `localhost` 와 (배포한다면) `<프로젝트ID>.web.app` 을 추가합니다.
   * 만들어진 **사이트 키**(공개용, `6L...`)를 `public/js/core/firebase-config.js` 의 `appCheckSiteKey` 에 넣습니다.
   * **비밀 키**는 Firebase 콘솔의 App Check 설정에만 넣고, 절대 코드에 넣지 않습니다.
   * `appCheckSiteKey` 가 비어 있으면 App Check 를 건너뜁니다 (real 모드 사용 불가, mock 은 동작).
3. 모델 이름을 `public/js/core/ai-config.js` 의 `AI_MODELS` 에 적습니다.
   **[공식 모델 목록](https://firebase.google.com/docs/ai-logic/models)에서 그대로 복사**하세요. (짐작해서 적지 않기)

   | 키 | 용도 | 현재 값 | 비워 두면 |
   | :--- | :--- | :--- | :--- |
   | `text` | 글만 주고받는 기능 (가이드, 체크리스트, 환경 조언, 리포트, 새 식물 종류) | `gemini-3.5-flash-lite` | real 이어도 전부 mock 으로 동작 (콘솔 경고 1번) |
   | `vision` | 사진을 함께 보내는 기능 (사진 진단) | `''` | `text` 모델로 사진도 보냄 (Gemini 는 대부분 사진을 읽음) |
   | `image` | 이미지를 **만드는** 기능 (데포르메 캐릭터) | `''` | 캐릭터는 mock SVG 로 그려짐 (무료 요금제에서 안 되면 비워 둠) |

## B. 팀원 각자 할 일 (사람마다, 브라우저마다 한 번)

### 1) App Check 디버그 토큰 등록

localhost 에서는 reCAPTCHA 대신 **디버그 토큰**으로 App Check 를 통과합니다.

1. `http://localhost:5500` 을 열고 **F12 → Console** 에 찍힌 `App Check debug token: xxxxxxxx-...` 를 복사
2. Firebase 콘솔 → **App Check → 앱** 탭 → 웹 앱 오른쪽 **⋮ → 디버그 토큰 관리 → 디버그 토큰 추가** 에 붙여 넣기
   (이름 예: `홍길동-크롬`)
3. 새로고침

* 시크릿 창·다른 브라우저·다른 컴퓨터는 토큰이 달라서 **다시 등록**해야 합니다.
* 디버그 토큰은 비밀번호처럼 다루세요. **Git·채팅방에 올리지 않습니다.**

### 2) `#/dev` 에서 AI 모드를 real 로

주소창에 `http://localhost:5500/#/dev` → "🤖 AI · 날씨 테스트" 구역의 **AI 모드** 스위치를 켭니다.
내 브라우저 `localStorage` (`plantCoach.aiMode`)에만 저장돼 다른 사람에게 영향이 없습니다. 끄면 다시 mock.

## C. real 모드가 진짜 동작하는지 확인

`#/dev` 에서 **advise** 또는 **suggestChecklist** 버튼을 누르고 확인합니다.

| 확인할 것 | real 로 동작 중 | 아직 mock |
| :--- | :--- | :--- |
| 사용량 표시 | "글 **1**/200" 처럼 올라감 | 0 그대로 |
| 결과 문장 | 누를 때마다 달라짐 | 항상 `mocks/*.json` 과 같음 |
| F12 콘솔 | 경고 없음 | `[ai] real 모드지만 준비가 안 됐어요 … mock 으로 동작합니다` |

화면에는 "AI 코치가 잠시 쉬는 중이에요" 처럼 짧게만 나옵니다. 원인은 콘솔의 `[ai] 호출 실패 …` 줄을 보세요 → [06. 문제 해결](06-troubleshooting.md)

## D. 비용·안전 장치 (`ai-config.js`)

| 설정 | 기본값 | 설명 |
| :--- | :--- | :--- |
| `AI_DAILY_LIMITS` | 글 200 · 사진 100 · 이미지 20 | 브라우저별 하루 호출 한도 (`localStorage` 의 `plantCoach.aiUsage`). 진짜 한도는 Firebase/Google Cloud 콘솔의 할당량에서도 걸 수 있음 |
| `AI_TIMEOUT_MS` | 45000 | 응답이 이보다 늦으면 "응답이 너무 늦어요" |
| `AI_FALLBACK_TO_MOCK` | `false` | `true` 면 실제 호출 실패(한도 초과 포함) 시 mock 으로 대신 응답 — **시연용 안전장치** |
| `PROMPT_VERSION` | `v1` | 사용할 프롬프트 템플릿 버전 (`public/prompts/<이름>.v1.txt`) |

## E. 날씨 real 모드 (Open-Meteo)

* 키가 필요 없는 공개 API 라 따로 준비할 것이 없습니다. `#/dev` 의 **날씨 모드** 스위치만 켜면 됩니다.
* 거주지역(시·도) 좌표는 `public/data/regions.json` 에 있습니다. 같은 지역은 10분 동안 다시 묻지 않습니다.
* 형식 참고: [Open-Meteo 문서](https://open-meteo.com/en/docs) — `current=temperature_2m,relative_humidity_2m,precipitation`

## 꼭 지킬 것

* `ai-config.js` 의 **`AI_MODE` 는 main 에서 항상 `'mock'`** — real 은 `#/dev` 스위치로만 켭니다.
* `AI_MODELS`·`appCheckSiteKey` 는 공통 설정입니다. 바꿀 일이 있으면 담당자 A 에게.
* reCAPTCHA 비밀 키, App Check 디버그 토큰, 개인 AI 키(Vertex AI 등)는 **절대 코드·Git 에 넣지 않습니다.**
* Firebase 콘솔에서 **Firestore 의 App Check 적용(Enforce)은 켜지 마세요.** 토큰을 등록하지 않은 팀원은 mock 모드여도 데이터를 못 읽게 됩니다.
* 무료 사용량이 있으니 real 모드는 필요할 때만 켜세요.
