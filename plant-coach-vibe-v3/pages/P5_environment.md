# [Page] P5 — AI environment analysis (light · weather · match score · AI coach advice)

> Read with: `00_MAIN.md` (§5.4 `analyzeEnvironment`·`getWeather`, §5.5 `environments`·`aiHistory`). Spec: SPEC F-02, structure [AI 환경 분석 화면].
> Owner: D. Branch from frozen `main`: `feat/p5-environment`. Suggested order: P5 → P6.

## 1. Goal
* **Measure the plant spot's brightness for 3 s** with the phone camera (or light sensor),
* get **weather** from the profile region,
* show a **match score (0–100)** and **light verdict (부족/적정/직사광선 주의)** against species ranges,
* give **action-focused AI coach advice**. Results are saved and used by the checklist (P3) and monthly report (P6).
* Save with Common `aiHistory.js`, `environments.js`.

## 2. Prerequisites
* **Common frozen.** `services/environments.js`, `services/aiHistory.js`, `store.user.home.region`, `services/plants.js`, `services/species.js` (`speciesProfile`), `core/ai.js` (`analyzeEnvironment`), `core/weather.js` (`getWeather`).
* **Independent test:** needs only Main + Common (mock AI/weather; manual presets or `#/dev` fake lux if no camera).

## 3. Files to create

### 3.1 `public/js/utils/lux.js` — brightness measurement
```js
export function canMeasure()                    // { sensor: boolean, camera: boolean }
export async function measureLux({ durationMs = 3000, onProgress, videoEl } = {})
// → { lux: number, source: 'sensor' | 'camera' }
export const MANUAL_PRESETS = [
  { label: '어두운 방 안쪽', lux: 100 },
  { label: '밝은 실내 (창에서 2m 이상)', lux: 500 },
  { label: '창가 (커튼 너머)', lux: 2000 },
  { label: '햇빛이 직접 드는 창가', lux: 15000 },
];
export function stopCamera()                     // stop all open camera tracks
```
* **1st — light sensor:** use if `'AmbientLightSensor' in window` (most browsers don't support it; fail silently to next).
* **2nd — camera:** `getUserMedia({ video: { facingMode: 'environment' } })` → preview (`videoEl`) → every 0.2 s draw to a 64×64 canvas, average brightness (Y = 0.2126R + 0.7152G + 0.0722B) → 3 s average → estimate lux:

  | Avg brightness (0–255) | Est. lux |
  | :--- | :--- |
  | 0–40 | 50–200 |
  | 40–90 | 200–800 |
  | 90–150 | 800–3,000 |
  | 150–210 | 3,000–10,000 |
  | 210–255 | 10,000–30,000 |
  Linear interpolation within a range. **Auto-exposure makes camera values differ a lot from real lux → always label the result "추정치".**
* **Always stop the camera** when done or on error.
* Report progress via `onProgress(0~1)`.

### 3.2 `public/js/utils/envScore.js` — rule-based score (no AI)
```js
export function lightLevel(lux, species)    // lux < luxMin → 'LOW', lux > luxMax * 1.5 → 'HIGH', else 'OK'
export function calcMatchScore({ lux, weather, heaterOrAcExposed, windowDir, species })
// → { score, lightLevel, breakdown: { light, temp, humidity, exposure } }
export function ruleBasedTips({ lightLevel, weather, heaterOrAcExposed, species }) // advice when AI fails
export const LIGHT_LABEL = { LOW: '빛이 부족해요', OK: '빛이 딱 좋아요', HIGH: '직사광선 주의' };
```
* Points: **light 50** (OK 50, LOW 10–40 proportional to shortfall, HIGH 25), **temperature 20** (assume indoors is milder than outdoors → deduct only when outdoor temp is extreme), **humidity 20** (proportional to distance from range), **heater/AC exposure 10** (exposed → 0). Total 0–100, rounded.
* Window direction isn't scored; only reflected in advice text (south = more light, north = less).
* `ruleBasedTips` examples (SPEC F-02 verbatim):
  * LOW → "창가에서 50cm 안쪽으로 자리를 옮겨주세요." (very low → "창가 쪽으로 옮겨 주세요")
  * Dry (humidity < humidityMin) → "주변에 물을 담은 컵을 두거나 주 2회 분무를 권장합니다."
  * HIGH → "한낮에는 얇은 커튼으로 햇빛을 한 번 걸러 주세요."
  * Heater/AC exposure → "에어컨·난방기 바람이 직접 닿지 않는 곳으로 옮겨 주세요."

### 3.3 (exists) `services/aiHistory.js`, `services/environments.js`
Use as is; shape = `00_MAIN.md` §5.5. Propose changes to the team (checklist and report read these records).

### 3.4 `public/js/pages/environment.js` (`#/environment`)
* `title: 'AI 환경 분석'`, `styles: ['css/pages/environment.css']`.
* **Layout (step-by-step, flowing down one screen):**
  1. **Target plant card:** character thumbnail + name + "권장 밝기 {luxMin}~{luxMax} lux · 권장 습도 {min}~{max}%". Chips if several plants.
  2. **① 밝기 재기:** "식물이 놓인 자리에서 휴대폰 뒷면 카메라를 창 쪽으로 3초간 비춰 주세요." → [측정 시작] → small camera preview + circular progress → result "약 1,200 lux (추정)". Camera denied/unsupported → 4 `MANUAL_PRESETS` buttons (source `manual`). [다시 재기] available.
  3. **② 우리 집 날씨:** on enter `getWeather(region)` → "서울특별시 · 4℃ · 습도 42% · 비 안 옴" (mock → small "예시 날씨"). Failure → "날씨를 불러오지 못했어요" + retry; analysis still possible without weather.
  4. **③ 실내 환경:** window direction chips (남향/동향/서향/북향/창문 없음), toggle "에어컨·난방기 바람이 직접 닿아요", home type shown from profile (edit in 내 정보).
  5. [분석하기] (disabled until brightness measured).
  6. **Result card:**
     * `gauge(score)` + big score + `LIGHT_LABEL` badge.
     * **AI coach advice:** `showLoading('AI 코치가 환경을 살펴보는 중이에요…')` → `analyzeEnvironment(...)` → "👍 {goodPoint}" + action list (check icons). Failure → `ruleBasedTips` result + small "기본 가이드를 보여 드려요".
     * Score breakdown (light/temp/humidity/wind) as 4 small bars.
  7. **Past measurements:** latest 5 (date · score · light verdict) — stored values only, **no AI re-call**.
* **Save:** when a result appears, auto `saveEnvironment` + `addHistory(plantId, 'ENVIRONMENT', { lux, lightLevel, score, humidity, tips: actions.join(' / ') })`.
* **Cleanup fn:** `stopCamera()` on leave.

### 3.5 `public/css/pages/environment.css`
Step cards (number circle + title), camera preview (rounded, 160px), circular progress (conic-gradient), big result gauge, history list.

## 4. Files to modify (owned scope)
* `public/prompts/environment.v*.txt`, `public/mocks/environment.json` — wording (keep keys/shapes).
* `public/js/pages/dev-ui.js` — **inside `[P5]` section only**: [가짜 측정값으로 분석 (카메라 없이 lux 300/2000/20000)].

**All files in this task:** `pages/environment.js`, `css/pages/environment.css`, `utils/lux.js`, `utils/envScore.js`, the prompt/mock files above, `[P5]` section of `dev-ui.js`.

## 5. Edge cases
* Not HTTPS/localhost → no camera → guide to manual selection. (Phone test needs HTTPS → Firebase Hosting, see README.)
* No region in profile → link "내 정보에서 거주지역을 설정해 주세요".
* Leaving mid-measurement → camera off immediately.

## 6. Don't
* Don't touch `ai/*`, `core/ai.js`, `core/weather.js` (Common).
* Never present the measurement as exact lux.

## 7. Done when
- [ ] Measuring with a phone (or laptop camera) shows estimated lux after 3 s progress, and the camera turns off (browser camera indicator disappears).
- [ ] Denying camera permission still allows manual selection.
- [ ] Weather card uses the profile region.
- [ ] Analysis shows score, light verdict, AI advice, and saves to `environments` and `aiHistory` (type `ENVIRONMENT`, no photo).
- [ ] When AI fails (e.g. temporarily rename `public/mocks/environment.json`), rule-based advice is shown.
- [ ] Past measurements show without AI calls (no `[ai]` log).
- [ ] No Common file names/shapes changed (`git diff main --stat`).
- [ ] `docs/PROGRESS.md` has the P5 entry.
