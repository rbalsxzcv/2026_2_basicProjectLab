# [Page] P3 — AI checklist · daily routine · overwatering Safe-Lock

> Read with: `00_MAIN.md` (§5.4 `suggestChecklist`·`getWeather`, §5.5 `checklists`·`schedules`, §5.6 EXP, §2 principle 1). Spec: SPEC F-03, structure [체크리스트], [알림 창의 체크리스트 창 클릭] → [체크리스트].
> Owner: C. Branch from frozen `main`: `feat/p3-checklist`.

## 1. Goal
* Once a day **AI picks today's daily routine**; due **periodic care (watering etc.) comes from schedules**.
* Completing items gives EXP reflected on the main character. Daily +5, Periodic +20.
* **Before completing watering, always show the soil-dryness popup**; wet soil → not completed, schedule +2 days (no penalty).
* The checklist screen can **check status by photo** (`runDiagnosisFlow` reuse — until P1 merges it's the C5 stub that only records a photo. That's fine).

## 2. Prerequisites
* **Common frozen.** Especially `services/schedules.js` (`getDueSchedules`, `completeSchedule`, `postponeSchedule`), `services/checklists.js` (C5 stub), `data/daily-tasks.json`, `services/game.js`, `ui/celebrate.js`, `ui/diagnosis-flow.js`, `services/aiHistory.js`, `services/environments.js` (`getLatestEnvironment`), `services/species.js` (`speciesProfile`), `core/ai.js` (`suggestChecklist`), `core/weather.js` (`getWeather`).
* **Independent test:** needs only Main + Common (mock AI, mock weather, `#/dev` schedule buttons).

## 3. Files to create

### 3.1 (exists) `public/data/daily-tasks.json`, `public/js/services/schedules.js`
Use as is. Refine the default checklist rule here: VENTILATE·CHECK_LEAF always; CHECK_LIGHT when the latest environment analysis is LOW; MIST only when weather humidity < species min humidity (`onlyWhenDry`).
If `schedules.js` seems to need changes, propose to the team (main game and plant registration also use it).

### 3.2 `public/js/services/checklists.js` — **replace C5 stub with full version**
> Names/args/returns of `ALLOWED_DAILY`, `TASK_INFO`, `getChecklist`, `ensureTodayChecklist`, `summarize`, `completeItem` stay **identical**. Main (remaining count) and startup/P4 (`created`) depend on them. Keep `ALLOWED_DAILY` and `TASK_INFO` values as in C5.

**`ensureTodayChecklist(plant)`:**
1. Today's doc exists → `{ checklist, created: false }`.
2. Periodic: `getDueSchedules` → each `{ category: 'PERIODIC_CARE', taskType, title: TASK_INFO.label, exp: 20, dueDate }`. **Water/fertilize/repot/wipe-leaf enter ONLY this way.**
3. Daily: `suggestChecklist({ speciesName, profile, weather, latestEnvironment, dueSchedules, recentHistory })`.
   * `weather` = `getWeather(user.home.region)` (failure → `null`); `recentHistory` = `getRecentHistory(plant.id, { n: 5 })`.
   * **Filter again**: only `ALLOWED_DAILY`, max 3, dedupe, title ≤ 30 chars. Empty → default routine.
   * AI fails → build from `daily-tasks.json`, `generatedBy: 'DEFAULT'`.
   * Each item `{ category: 'DAILY_MICRO', exp: 5, dueDate: null }`.
4. All items: `id` (short random string), `isCompleted: false`, `completedAt: null`, `soilMoistureDry: null`, `postponed: false`.
5. Save as doc id `today()`. **Never twice a day:** create-if-absent inside `runTransaction`.
6. `addHistory(plant.id, 'CHECKLIST', { titles: item titles })`.
7. `{ checklist, created: true }`.

**`completeItem` (`runTransaction`):**
1. Already completed → `{ status: 'already' }`.
2. **WATER with `soilMoistureDry === false`** → item `postponed: true`, `soilMoistureDry: false`, not completed → after transaction `postponeSchedule(plantId, 'WATER', 2)` → no EXP → `{ status: 'postponed' }`.
3. Otherwise → `isCompleted: true`, `completedAt: today()`; WATER records `soilMoistureDry: true`.
4. After transaction: PERIODIC → `completeSchedule`, then `awardExp(plantId, item.exp, item.taskType)`, `markCared`, `refreshPlantState`.
5. `{ status: 'completed', expResult }`.
* WATER without a `soilMoistureDry` value (null) → **throw** (prevents a popup-skipping bug).

### 3.3 `public/js/pages/checklist.js` (`#/checklist`)
* `title: '오늘의 체크리스트'`, `styles: ['css/pages/checklist.css']`.
* Query `?plant=id` selects that plant (from notifications). Plant not found → toast "식물을 찾을 수 없어요" and use the current plant.
* **Layout:**
  1. **Plant chips** (if several) + today's date.
  2. **Progress card:** small character + circular progress (`summarize`) + "{done}/{total} 완료". `generatedBy === 'AI'` → "🤖 AI 코치가 오늘 할 일을 골랐어요", else "기본 루틴이에요".
  3. **[Daily] 가벼운 안부 루틴 · 하나에 +5 EXP** — item cards: emoji + title + check button (44px circle).
  4. **[Periodic] 주기적 집중 관리 · 하나에 +20 EXP** — cards: emoji + name + one-line tip + if overdue "{n}일 지났어요 · 천천히 해도 괜찮아요" (small grey text, not apricot). None → "오늘은 쉬어 가는 날이에요 🌿".
  5. **Postponed:** `postponed` watering card dimmed + "흙이 촉촉해서 {날짜}로 미뤘어요".
  6. **[📷 사진으로 상태 확인하기]** → `runDiagnosisFlow({ plant, species })` (P1). Toast when done.
  7. **All done:** progress card switches to celebration "오늘 할 일을 모두 마쳤어요! {이름}이(가) 기뻐해요 ✨".
  8. Bottom link: "📄 이번 달 기록 보기" → `#/report`.
* **Complete-button behavior:**
  * DAILY → `completeItem` immediately → check animation + `floatExp(button, 5)` + `celebrateIfLeveledUp`.
  * **WATER → Safe-Lock popup** (`choiceModal`, **`dismissible: false`**):
    * Title: "잠깐! 흙을 먼저 확인해 볼까요?"
    * Body: "손가락이나 나무젓가락으로 겉흙 3~5cm 안쪽을 찔러보세요. 흙이 말라 있나요?"
    * Options: [말라 있어요] / [아직 축축해요]
    * 말라 있어요 → `completeItem(..., { soilMoistureDry: true })` → +20 EXP.
    * 아직 축축해요 → `completeItem(..., { soilMoistureDry: false })` → toast "흙이 아직 촉촉하네요. 이틀 뒤에 다시 알려 드릴게요 🌱" (no EXP, no penalty).
  * FERTILIZE / WIPE_LEAF / REPOT → `confirmModal("{팁}\n\n다 했나요?", { okLabel: '다 했어요', cancelLabel: '나중에' })` → complete.
  * Lock that button while processing.
* On enter call `ensureTodayChecklist(plant)` (creates if missing; while creating show skeleton "AI 코치가 오늘 할 일을 고르는 중이에요…").

### 3.4 `public/css/pages/checklist.css`
Progress card (conic-gradient ring), EXP badges on section titles, item cards (done = green bg + check, no strikethrough), check pop animation, dimmed postponed card.

## 4. Files to modify (owned scope)
* `public/js/services/checklists.js` — replace stub (§3.2).
* `public/prompts/checklist.v*.txt`, `public/mocks/checklist.json` — wording (keep keys/shapes).
* `public/js/pages/dev-ui.js` — **inside `[P3]` section only**: [오늘 체크리스트를 AI로 다시 만들기] (delete today's doc → `ensureTodayChecklist`), [비료·잎 닦기 예정일을 오늘로].

**All files in this task:** `pages/checklist.js`, `css/pages/checklist.css`, `services/checklists.js`, the prompt/mock files above, `[P3]` section of `dev-ui.js`. Do **not** edit `main.js`, `startup.js`, `game.js`, `schedules.js` — already wired in Common.

## 5. Edge cases
* Date changed past midnight while viewing → on tap compare `today()` with screen date; if different, toast "날짜가 바뀌었어요" and reload.
* AI and weather both fail → default routine + periodic care; a checklist is always created.
* Same item completed on two devices at once → transaction gives EXP only once.

## 6. Don't
* Never let AI add watering, and never allow completing watering without the popup.
* No penalties, warning colors, or EXP loss for postponing/delays.

## 7. Done when
- [ ] Entering the checklist creates today's doc only once (unchanged after refresh).
- [ ] Even with `WATER` in mock checklist, no watering in daily routines. Watering appears only on its due date (`#/dev` [물주기 예정일을 오늘로] → [오늘 체크리스트 지우기] → re-enter).
- [ ] Daily +5 and periodic +20 EXP appear on main's EXP bar.
- [ ] Completing watering opens the soil popup that won't close on backdrop click.
- [ ] [아직 축축해요] → not completed, no EXP, `schedules/WATER.dueDate` = today + 2.
- [ ] [말라 있어요] → completed, +20 EXP, `dueDate` = today + watering interval.
- [ ] Overdue periodic care → main character WAITING; after completion GROWING (30 min) → PEACEFUL.
- [ ] Main's checklist card shows remaining count.
- [ ] Photo-check button opens `runDiagnosisFlow` (before P1 merges, photo-only is fine).
- [ ] No Common file names/shapes changed (`git diff main --stat`).
- [ ] `docs/PROGRESS.md` has the P3 entry.
