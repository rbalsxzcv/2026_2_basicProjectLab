# [Common] C2 — AI adapter (mock + Firebase AI Logic) · weather · prompt templates

> Read with: `00_MAIN.md` (§3 stack, §5.4 AI/weather contract, §6 rule 7 secrets). Spec: SPEC 3.1 system, 3.3 AI context, 3.5 prompt guide.
> Owner: A. Replaces the former Node/Express server: everything here runs in the browser.

## 1. Goal
* Provide **all 7 functions in §5.4**. With `mock` mode they return realistic fake responses so every page can be built end-to-end without real AI.
* `real` mode calls Gemini through **Firebase AI Logic** — only `js/ai/provider.js` knows how.
* Manage prompts as **versioned text files** (team decision: "templatize good outputs").
* Add a **daily call limit** and **timeout** for cost and safety.

## 2. Prerequisites
* C1 done (`core/firebase.js` exports `ai`, `getGenerativeModel`, `ResponseModality`).
* **Ask the user before writing real-mode code:**
  1. Is Firebase AI Logic set up in the console (AI Services → AI Logic → Gemini Developer API) and App Check registered (site key + localhost debug token)?
  2. Model names for text, vision (image input), image generation — taken from the **official Firebase AI Logic docs** model list.
  3. Whether the image-generation model is usable on their plan. If not, keep character images as mock SVG (`AI_MODELS.image = ''`).
* **Never guess SDK call shapes or model names.** Check the official Firebase AI Logic web docs (generate text, analyze images, generate images, structured output). If docs aren't available, leave real mode as a TODO that throws, and keep mock.

## 3. Files to create

### 3.1 `public/js/core/ai-config.js` — settings in one place
```js
export const AI_MODE = 'mock';          // 'mock' = 가짜 응답 / 'real' = Firebase AI Logic
export const WEATHER_MODE = 'mock';     // 'mock' = 가짜 날씨 / 'real' = Open-Meteo
export const PROMPT_VERSION = 'v1';     // public/prompts/*.v1.txt
export const AI_MODELS = { text: '', vision: '', image: '' }; // 공식 문서의 모델 이름
export const AI_FALLBACK_TO_MOCK = false; // true면 실제 호출 실패 시 mock으로 대체 (시연용 안전장치)
export const AI_DAILY_LIMITS = { text: 200, vision: 100, image: 20 };
export const AI_TIMEOUT_MS = 45000;
export function getAiMode() { ... }      // localStorage 'plantCoach.aiMode' 우선, 없으면 AI_MODE
export function getWeatherMode() { ... } // localStorage 'plantCoach.weatherMode' 우선
```
* Local overrides let each member switch modes in `#/dev` **without editing/committing this file** (keep `main` on mock).
* `real` but `AI_MODELS.text` empty or `ai` is `null` → console warning once, behave as mock.

### 3.2 `public/js/core/ai.js` — ★ functions the app calls
Exports the six §5.4 AI functions + `class AiError extends Error`. One helper avoids repetition:
```js
// name: 프롬프트·mock 파일 이름, kind: 'text'|'vision'|'image'
async function aiCall(name, input, { kind }) { ... }
```
Steps: ① `RULES[name].validate(input)` fails → `throw new AiError('<Korean guide, e.g. 사진이 필요해요.>')` ② trim large inputs ③ `prompts.fill(name, RULES[name].buildVars(input))` ④ `provider.generateJson({ name, prompt, imageBase64 })` ⑤ `withDefaults(result, RULES[name].defaults)` → `RULES[name].normalize` ⑥ return data.
* `generateCharacter` uses `provider.generateImage` and returns `{ imageBase64 }`.
* Unknown errors → `AiError('AI 코치가 잠시 쉬는 중이에요. 잠시 후 다시 시도해 주세요.')` (details to console). Timeout → `AiError('응답이 너무 늦어요. 잠시 후 다시 시도해 주세요.')`. Offline → `AiError('인터넷 연결을 확인해 주세요.')`.
* Trim before prompting: `recentHistory`/`monthlyHistory` max 10 items, each item's JSON ≤ 300 chars.
* **Never log images or full prompts** (lengths only).

### 3.3 `public/js/ai/normalize.js` — per-feature rules
`export const RULES = { character, diagnose, advice, environment, checklist, 'monthly-report' }`, each `{ validate, buildVars, defaults, normalize }`, plus `export function checkShape(name, obj)` → array of Korean issue strings (empty = pass; used by P2 prompt lab).

| Function | Prompt name | Required | normalize |
| :--- | :--- | :--- | :--- |
| `generateCharacter` | `character` | `imageBase64` | `{ imageBase64 }` |
| `diagnose` | `diagnose` | `imageBase64`, `speciesName` | `severity` only `normal`/`watch` (else `watch`); `options` exactly 3 (fill with defaults `['흙이 축축해요', '흙이 바짝 말라있어요', '잘 모르겠어요']`) |
| `advise` | `advice` | `speciesName`, `symptoms`, `userAnswer` | `advice` cut/fill to 2; `summaryTag` ≤ 12 chars |
| `analyzeEnvironment` | `environment` | `speciesName`, `measuredLux` (number) | `actions` max 2 |
| `suggestChecklist` | `checklist` | `speciesName` | keep only allowed taskTypes below; **remove all PERIODIC_CARE items** (periodic care is added from schedules — overwatering guard); max 4; dedupe taskType |
| `writeMonthlyReport` | `monthly-report` | `speciesName`, `stats` | `suggestions` max 2; missing `repotNotice`/`lifespanNotice` → `null` |

**Allowed taskType (DAILY_MICRO):** `VENTILATE`(환기), `CHECK_LEAF`(잎 관찰), `CHECK_LIGHT`(빛 확인·자리 조정), `MIST`(분무 — dry only). **PERIODIC_CARE (client schedules only):** `WATER`, `FERTILIZE`, `WIPE_LEAF`, `REPOT`.

### 3.4 `public/js/ai/provider.js` — AI adapter (only file that knows the provider)
```js
export async function generateJson({ name, prompt, imageBase64 }) { ... } // → object
export async function generateImage({ prompt, imageBase64 }) { ... }      // → data URL string
```
* **mock mode:**
  * `fetch('mocks/${name}.json')`. Variants declared in `const MOCK_VARIANTS = { diagnose: ['diagnose-1', 'diagnose-2'] }` → pick one at random (`diagnose-1` normal, `diagnose-2` watch → both flows testable).
  * Random 600–1200 ms delay.
  * `generateImage` builds a **simple chibi plant SVG in code** (round pot + smiling face + 2–3 leaves, pastel) → `data:image/svg+xml;base64,...`; leaf color varies slightly each time.
* **real mode (Firebase AI Logic):**
  * Model: text-only → `AI_MODELS.text`; with image → `AI_MODELS.vision`; image generation → `AI_MODELS.image` (empty → mock SVG).
  * `getGenerativeModel(ai, { model, systemInstruction: 'JSON으로만 답하세요.', generationConfig: { responseMimeType: 'application/json' } }, { timeout: AI_TIMEOUT_MS })` — confirm option names in official docs.
  * Image input: split the data URL into MIME type + base64 and send as an inline-data part as documented.
  * Parse response text with `json.extractJson()`. Parse failure → **retry once** with the same prompt; then error.
  * `generateImage`: image model with response modalities text+image; take the first inline image part → data URL.
  * Before every real call: `usage.checkAndCount(kind)`; over limit → `AiError('오늘 AI 코치 이용량을 모두 썼어요. 내일 다시 만나요!')`.
  * On failure: throw (caller falls back to defaults). If `AI_FALLBACK_TO_MOCK` is true → console warning and return mock instead (also when over limit).
  * Log only `console.info('[ai]', name, promptLength, elapsedMs)` (both modes) — pages use this to verify "no AI call".

### 3.5 `public/js/ai/prompts.js`
* `fill(name, vars, { version = PROMPT_VERSION } = {})`: fetch `prompts/${name}.${version}.txt` (cache per name+version), replace `{var}`.
* Object/array values → `JSON.stringify`; empty → `'정보 없음'`.
* Var in template but missing in vars → console warning + `'정보 없음'`.

### 3.6 `public/js/ai/json.js`
* `extractJson(text)`: strip ```` ```json ```` fences → cut from first `{` to last `}` → `JSON.parse`; throw on failure.
* `withDefaults(obj, defaults)`: fill missing keys (1 level deep).

### 3.7 `public/js/ai/usage.js` — daily limit
```js
export function checkAndCount(kind) // 'text'|'vision'|'image' → false if over limit
export function getUsage()          // { date, text, vision, image, limits }
```
* Counted in `localStorage['plantCoach.aiUsage']` per KST date (`today()`); reset when the date changes. Comment: this is a soft guard per browser; quotas can also be set in the Firebase/Google Cloud console.

### 3.8 `public/js/core/weather.js`
```js
export async function getWeather(region) // → { tempC, humidity, precipitation, source }
export class WeatherError extends Error {}
```
* Region name → lat/lon from `data/regions.json` (C3). Missing region → `WeatherError('거주지역 정보가 필요해요.')`.
* **mock:** plausible Korean monthly averages + small randomness (e.g. Dec–Feb −2~6℃, humidity 35–50%; Jul–Aug 24~30℃, 70–85%). `source: 'mock'`.
* **real:** Open-Meteo forecast API "current" values for temperature, relative humidity, precipitation (`precipitation > 0` → `true`). Follow the official Open-Meteo docs for URL/params — don't guess. `source: 'real'`. Timeout 20 s.
* Cache per region in memory for 10 minutes. Failure → `WeatherError('날씨를 불러오지 못했어요.')`.

### 3.9 `public/prompts/*.v1.txt` — 6 templates (Korean text below is final; copy verbatim)
Common preamble at the top of every file:
```text
당신은 식물을 처음 키우는 초보자를 돕는 다정한 식물 코치입니다.
전문 용어를 피하고, 겁주거나 죄책감을 주는 표현(죽는다, 망가진다 등)을 쓰지 않습니다.
반드시 아래 JSON 형식으로만 답하고, JSON 밖에는 아무것도 쓰지 마세요.
```

**`character.v1.txt`** (image generation — JSON preamble not needed)
```text
첨부한 {speciesName} 사진을 바탕으로 귀여운 데포르메 스타일의 식물 캐릭터를 그려 주세요.
- 화분과 잎 모양, 색감은 사진의 특징을 살릴 것
- 둥글고 단순한 형태, 웃는 얼굴, 파스텔 톤
- 배경은 투명 또는 단색, 정사각형
```

**`diagnose.v1.txt`**
```text
[식물 종류: {speciesName}]
사진만으로는 과습과 건조를 단정할 수 없습니다. 증상을 관찰하고, 사용자에게 흙 상태를 확인할 질문을 하세요.
이상 징후가 거의 없으면 severity를 "normal", 갈변·처짐·황변 등이 보이면 "watch"로 하세요.
{
  "symptoms": "관찰된 외형적 특징 요약 (예: 잎 끝 갈변 및 전체적 처짐)",
  "severity": "normal 또는 watch",
  "question": "상태를 정확히 파악하기 위해 흙 상태를 묻는 질문 (1줄)",
  "options": ["흙이 축축해요", "흙이 바짝 말라있어요", "잘 모르겠어요"]
}
```

**`advice.v1.txt`**
```text
식물 종류: {speciesName}
관찰된 징후: {symptoms}
사용자가 확인한 흙 상태: {userAnswer}
이전 분석 요약(최근 순): {recentHistory}

초보자가 오늘 당장 실천할 수 있는 행동 가이드 2가지를 친절하고 따뜻한 어조로 작성하세요.
흙이 축축하다면 물주기를 권하지 마세요.
{
  "advice": ["행동 가이드 1", "행동 가이드 2"],
  "summaryTag": "상태 요약 태그 (예: 과습 의심, 건강해요)"
}
```

**`environment.v1.txt`**
```text
식물 종류: {speciesName} (생육 기준: {profile})
측정 조도(추정): {measuredLux} lux
실외 날씨: {weather}
자택 종류: {homeType}, 창문 방향: {windowDir}, 냉난방기 직접 노출: {heaterOrAcExposed}

현재 환경의 좋은 점 1가지와, 초보자가 바로 할 수 있는 개선 행동 1~2가지를 알려 주세요.
예: "창가에서 50cm 안쪽으로 자리를 옮겨주세요.", "주변에 물을 담은 컵을 두세요."
{
  "goodPoint": "좋은 점 1문장",
  "actions": ["개선 행동 1", "개선 행동 2"]
}
```

**`checklist.v1.txt`**
```text
식물 종류: {speciesName} (생육 기준: {profile})
오늘 날씨: {weather}
최근 환경 분석: {latestEnvironment}
오늘 도래한 정기 관리(이미 목록에 들어감): {dueSchedules}
이전 분석 요약: {recentHistory}

오늘 할 가벼운 데일리 루틴을 2~3개 골라 주세요.
taskType은 VENTILATE, CHECK_LEAF, CHECK_LIGHT, MIST 중에서만 고르세요.
물주기·비료·분갈이·잎 닦기는 넣지 마세요. MIST는 날씨나 환경이 건조할 때만 넣으세요.
{
  "items": [ { "category": "DAILY_MICRO", "taskType": "VENTILATE", "title": "창문 열고 10분 환기하기" } ]
}
```

**`monthly-report.v1.txt`**
```text
식물 종류: {speciesName}, 함께한 날: {daysSincePurchase}일, 수명 정보: {lifespan}
이번 달 통계: {stats}
이번 달 분석 요약: {monthlyHistory}
지난달 리포트: {previousReport}

지난달과 비교해 잘한 점을 먼저 구체적으로 칭찬하고, 다음 달에 시도할 습관 1~2가지를 제안하세요.
함께한 날이 180일 이상이면 repotNotice에 "뿌리가 꽉 찼을 수 있으니 화분 밑바닥 배수 구멍을 확인해 보세요" 취지의 안내를 쓰고, 아니면 null.
수명 종료일이 30일 이내면 lifespanNotice에 수확·마무리 안내를, 아니면 null.
{
  "praise": "칭찬 2~3문장",
  "suggestions": ["제안 1", "제안 2"],
  "repotNotice": null,
  "lifespanNotice": null
}
```

### 3.10 `public/prompts/README.md` — templating rules (write in Korean)
* File naming `<name>.v<n>.txt`; active version = `PROMPT_VERSION` in `ai-config.js`.
* Improvement flow: ① copy to `v2` → ② compare v1/v2 outputs on the same input (P2 prompt lab) → ③ if better, record in the table below and adopt.
* Record table: `| 날짜 | 템플릿 | 버전 | 바꾼 점 | 좋았던 출력 예시(요약) | 채택 여부 |`
* Ownership (post-freeze wording rights): `diagnose`, `advice` → P1 (B) · `checklist` → P3 (C) · `environment`, `monthly-report` → P5/P6 (D) · `character` → A · procedure & lab → P2 (B).
* Owners may freely change **wording**; JSON **keys and shapes (00_MAIN §5.4) never change**.

### 3.11 `public/mocks/*.json`
`diagnose-1.json` (severity normal), `diagnose-2.json` (severity watch, drooping leaves), `advice.json`, `environment.json`, `checklist.json` (VENTILATE·CHECK_LEAF + one deliberate `WATER` item to prove filtering), `monthly-report.json`. Exact §5.4 keys, warm Korean copy.

## 4. Files to modify
* `public/js/pages/dev-ui.js` — add section `data-dev-section="ai"`: mode switches (AI mock/real, weather mock/real → localStorage), current usage (`getUsage()`), and one button per §5.4 function with a sample input, showing the JSON result in `<pre>`.

## 5. Don't
* No Firestore access in `ai/` or `core/ai.js`, `core/weather.js` (they return results; callers save).
* No guessed SDK shapes, model names or weather URLs.
* No API keys anywhere.

## 6. Done when
- [ ] All 7 functions return §5.4-shaped data in mock mode (check in `#/dev`).
- [ ] Missing required inputs throw `AiError` with a Korean message.
- [ ] `suggestChecklist` never returns `WATER` etc. (mock file includes one — it's filtered out).
- [ ] `generateCharacter` returns an SVG data URL that renders as a character in an `<img>`.
- [ ] `real` with empty model names → warning, behaves as mock.
- [ ] (If console setup done) `real` mode returns real Gemini responses in the same shapes; limit set to 1 → second call shows the limit message; `AI_FALLBACK_TO_MOCK=true` → mock instead.
- [ ] Weather mock works; real mode returns Seoul's current weather from Open-Meteo.
- [ ] 6 prompts + `prompts/README.md` exist.
- [ ] No images/prompt bodies/keys in console logs.
- [ ] `docs/PROGRESS.md` has the C2 entry (models used, whether image generation is real or mock).
