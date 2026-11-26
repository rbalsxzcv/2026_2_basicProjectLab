# [Common] C6 — Main game screen · EXP · character state machine

> Read with: `00_MAIN.md` (§5.6 game constants, §7 design, §6 copy rules). Spec: SPEC F-06, structure [메인 게임 화면].
> Owner: A. **Finishing this file completes Common → freeze.**

## 1. Goal
* Build the post-login home **main game screen**: the plant's chibi character, **character selector**, **checklist shortcut card**, **petting interaction**, menu to other screens.
* Build `game.js` (**EXP · level · state machine**) used later by checklist and calendar.
* Anti-Guilt: the character never looks wilted or sad.

## 2. Prerequisites
* C1–C5. Especially `services/plants.js` (`loadPlants`, `getCurrentPlant`, `selectPlant`), `services/schedules.js` (`hasOverdue`), `services/checklists.js` (`getChecklist`, `summarize` — C5 stub), `assets/characters/default.svg`.

## 3. Files to create

### 3.1 `public/js/services/game.js`
**Constants (must equal `00_MAIN.md` §5.6):**
```js
export const EXP = { DAILY: 5, PERIODIC: 20, PHOTO: 15, PET: 0 };
export const EXP_PER_LEVEL = 100;
export const STAGES = [
  { id: 'SPROUT', name: '새싹', minLevel: 1 },
  { id: 'YOUNG', name: '어린 모종', minLevel: 3 },
  { id: 'LUSH', name: '풍성한 식물', minLevel: 6 },
];
export const UNLOCKS = [
  { level: 3, id: 'ribbon', name: '화분 리본', image: 'assets/characters/deco-ribbon.svg' },
  { level: 5, id: 'butterfly', name: '나비 친구', image: 'assets/characters/deco-butterfly.svg' },
  { level: 8, id: 'star', name: '반짝 별', image: 'assets/characters/deco-star.svg' },
];
export const STATE_MESSAGES = {
  PEACEFUL: '오늘도 살랑살랑 기분 좋아요',
  WAITING: '집사님을 차분히 기다리는 중이에요',
  ALERT: '관찰이 조금 더 필요해요',
  GROWING: '고마워요! 쑥쑥 자라는 기분이에요',
};
export const PET_MESSAGES = ['헤헤, 간지러워요', '기분이 좋아졌어요!', '오늘도 같이 있어 줘서 고마워요', '잎이 반짝반짝해진 것 같아요'];
```
**Pure functions (no Firestore, easy to test):**
```js
export function levelFromExp(exp)            // Math.floor(exp / 100) + 1
export function expProgress(exp)             // { current: exp % 100, needed: 100, percent }
export function stageFromLevel(level)        // matching STAGES item
export function unlockedItems(level)         // UNLOCKS with level <= given
export function computeState({ alertOpen, hasOverdue, lastCareAt, now = Date.now() })
// priority: alertOpen → 'ALERT', hasOverdue → 'WAITING', lastCareAt within 30 min → 'GROWING', else 'PEACEFUL'
```
**Firestore functions:**
```js
export async function awardExp(plantId, amount, reason)
// runTransaction: add exp + recompute level → { exp, level, leveledUp, newStage, newUnlocks }
export async function markCared(plantId)          // lastCareAt = serverTimestamp()
export async function setAlert(plantId, isOpen)   // update alertOpen (used by P1)
export async function refreshPlantState(plantId)
// schedules.hasOverdue → computeState → save if changed → update the plant in store plants → return new state
```
* `amount` 0 → do nothing, return current values.
* Every function ends by updating store `plants` so main updates immediately.

### 3.2 `public/js/ui/celebrate.js`
```js
export async function celebrateIfLeveledUp(result, plant) // result = awardExp return
export function floatExp(targetEl, amount)               // "+20 EXP" floating above a button
```
* On level-up `openModal`: character image + sparkles + "Lv.{n}이 되었어요!" + if stage changed "{단계 이름}(으)로 자랐어요" + if new decoration "새 소품: 화분 리본".
* Used by P1 (calendar) and P3 (checklist). **Names/args/returns are frozen after Common.**

### 3.3 `public/assets/characters/deco-ribbon.svg`, `deco-butterfly.svg`, `deco-star.svg`
Small overlay decorations (transparent bg, pastel), pure SVG.

### 3.4 `public/js/pages/main.js` (`#/main`)
* `title: '내 식물'`, `styles: ['css/pages/main.css']`.
* **Layout (top → bottom):**
  1. **Greeting:** "{닉네임}님, 오늘도 반가워요 🌿" + today (`formatKorean`).
  2. **Character selector:** 2+ plants → horizontal scroll chips (mini character + name). Tap → `selectPlant` → redraw. Last chip [+] → `#/plants/new`. 1 plant → name only.
  3. **Character stage (center, largest):**
     * Background: soft radial gradient + floor shadow.
     * `characterImage` in `<img>`. Size by stage: SPROUT 75%, YOUNG 90%, LUSH 105% (CSS var).
     * Unlocked decorations absolutely positioned over the character (ribbon on pot, butterfly top-right, star above head).
     * State animation classes (`state-peaceful` etc.):

       | State | Expression |
       | :--- | :--- |
       | `PEACEFUL` | sway left-right (3 s period, ±3°) |
       | `WAITING` | very slow up-down breathing + speech bubble "…" dot animation |
       | `ALERT` | 🔍 magnifier slowly wiggling beside the character (no red, no exclamation marks) |
       | `GROWING` | sparkle particles (6–8 small CSS stars spreading upward) + bouncy motion |
     * **Speech bubble:** `STATE_MESSAGES[state]`.
     * **Petting:** tap, or rub left-right with finger/mouse (pointer events, ≥ 60px travel) → squishy press animation + one 💚 floating up + bubble shows a random `PET_MESSAGES` for 2 s. Max once per second. If `EXP.PET > 0`, `awardExp` up to 3×/day (currently 0 → not called).
     * In `ALERT`, small [성장 캘린더에서 살펴보기] button under the bubble → `#/calendar`.
  4. **Level bar:** "Lv.{n} · {단계 이름}" + EXP bar (`expProgress`) + "다음 레벨까지 {n} EXP".
  5. **Checklist card (prominent):** "✅ 오늘의 체크리스트" + "할 일을 마치면 경험치가 쌓여요" + [보러 가기] → `#/checklist`. In `[data-checklist-summary]` show from `getChecklist(current id)` → `summarize`: "남은 할 일 {remaining}개" / "오늘 할 일 완료! ✨" / (no checklist) "오늘 할 일을 확인해 보세요". When P3 completes internals the shapes stay the same, so this screen needs no change.
  6. **Menu grid (2×2):** ☀️ AI 환경 분석 (`#/environment`), 📅 성장 캘린더 (`#/calendar`), 📄 월간 리포트 (`#/report`), 🪴 식물 관리 (`#/plants`).
* **Behavior:**
  * On render call `refreshPlantState(current id)` (draw with stored state first while waiting).
  * `store.subscribe('plants')`, `store.subscribe('currentPlantId')` → redraw on changes; unsubscribe in cleanup.
  * No plants → `emptyState` + register button.

### 3.5 `public/css/pages/main.css`
* Stage height ~300px; character image max 220px.
* Keyframes: `sway`, `breathe`, `wiggle` (magnifier), `sparkle`, `squish` (petting), `float-up` (heart/EXP).
* `prefers-reduced-motion` → all keyframes off (state conveyed only by bubble text).
* Menu grid: big icon + short label cards.

## 4. Files to modify
* `public/js/pages/dev-ui.js` — add a "game test" section (see §7). Don't touch existing sections or page sections.

## 5. Edge cases
* Broken `characterImage` path → `onerror` swaps to the default character.
* `refreshPlantState` fails → show stored state, console warning only.
* Selected plant deleted → auto-select the first plant (check plants.js correction logic).

## 6. Don't
* No checklist completion logic (P3). This screen only shows remaining count and links.
* No negative visuals (wilting, crying, greying out).

## 7. Done when
- [ ] After login, main shows the current plant's character, name, level, EXP bar.
- [ ] With 2+ plants, switching in the selector changes character and info; selection persists after refresh.
- [ ] Tapping/rubbing the character shows the reaction animation and bubble.
- [ ] `#/dev` has a "게임 테스트" section. Main recomputes state via `refreshPlantState` on render, so don't set `state` directly — add **cause buttons**: [관찰 필요 켜기/끄기] (`setAlert`) → ALERT, [방금 관리함] (`markCared`) → GROWING; WAITING via C5's [물주기 예정일을 3일 전으로]. After each, going to main shows the matching animation. (ES module functions can't be called from the browser console directly, so test with buttons.)
- [ ] [+100 EXP] raises the level and `celebrateIfLeveledUp` shows the modal.
- [ ] The 4 menu items and checklist [보러 가기] go to the right paths (not-ready for missing screens).
- [ ] Checklist card shows "남은 할 일 N개" from the C5 stub's checklist.
- [ ] **Common integration check:** new ID signup → plant registration (photo → character) → main works in one go; logout → login lands directly on main.
- [ ] `docs/PROGRESS.md` has the C6 entry + **"공통 완료·동결, P1~P6 시작 가능"**.
