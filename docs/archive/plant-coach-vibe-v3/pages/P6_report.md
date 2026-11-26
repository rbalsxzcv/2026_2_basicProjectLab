# [Page] P6 — AI monthly report & habit coach

> Read with: `00_MAIN.md` (§5.4 `writeMonthlyReport`, §5.5 `monthlyReports`·`checklists`·`photos`·`aiHistory`). Spec: SPEC F-05, structure [체크리스트]·[성장 캘린더] → [월간 리포트], [다음 달로 넘어가서 리포트 알람이 뜰 경우] → [월간 리포트].
> Owner: D. Branch: `feat/p6-report` (or same branch as P5).

## 1. Goal
* When the month changes, gather **last month's plant info and records** and have AI write a monthly report with **praise + habit suggestions for next month**.
* Reports are saved and serve as the **comparison base (previous report)** for the next month.
* Plants kept 6+ months get a **repotting notice**; plants with a set lifespan get a **wrap-up/harvest notice**.
* Viewing a saved report **never re-calls AI**.

## 2. Prerequisites
* **Common frozen.** `services/reports.js` (C5 stub), `services/checklists.js` (`getChecklist`; data shape §5.5), `services/photos.js`, `services/aiHistory.js` (`getHistoryInMonth`), `services/plants.js`, `utils/date.js` (`prevMonth`, `monthRange`), `core/ai.js` (`writeMonthlyReport`). `startup.js` already calls `ensureLastMonthReports` and notifies for `created` items.
* **Independent test:** checklist completion (P3) isn't needed — use the `#/dev` [지난달 샘플 기록 만들기] button.

## 3. Files to create

### 3.1 `public/js/services/reports.js` — **replace C5 stub with full version** (keep names/args/returns)
```js
export async function computeMonthlyStats(plantId, month)
// → { routineRate, ventilationCount, waterOnTimeRate, photoCount, checklistDays }
export async function getReport(plantId, month)          // null if none
export async function listReportMonths(plantId)          // months with reports (newest first)
export async function generateReport(plant, month)       // stats + AI → save → return report
export async function ensureLastMonthReports(plants)     // → [{ plantId, month, created }]
export function isEligible(plant, month)                 // registered on/before that month's last day
```

**`computeMonthlyStats` rules:**
* Source: `checklists` whose doc id is in the month (`where(documentId(), '>=', 'YYYY-MM-01')`, `'<='` last day).
* `routineRate` = completed items / all items (postponed watering excluded from denominator) → integer 0–100.
* `ventilationCount` = completed `VENTILATE` items.
* `waterOnTimeRate` = share of completed `WATER` whose `completedAt` ≤ `dueDate` + 1 day (no watering → `null`).
* `photoCount` = `listPhotosInMonth` count.
* `checklistDays` = days with a checklist.

**`generateReport(plant, month)`:**
1. `computeMonthlyStats` → `getHistoryInMonth(plant.id, month)` (max 10) → `getReport(plant.id, prevMonth(month))` (previous, or `null`).
2. `daysSincePurchase` = days from `purchasedAt` to the month's last day.
3. `writeMonthlyReport({ speciesName, daysSincePurchase, lifespan, stats, monthlyHistory, previousReport: previous report's ai+stats or null })`.
4. **Safety net:** if AI omitted `repotNotice` but `daysSincePurchase >= 180`, insert default "뿌리가 꽉 찼을 수 있으니 화분 밑바닥 배수 구멍을 확인해 보세요". Same for `lifespanNotice` if the lifespan end date is on/before next month's last day.
5. AI fails → save **default praise from stats only** (e.g. routine rate ≥ 70% "꾸준히 잘 챙겨 주셨어요!", else "바쁜 한 달에도 들러 주셔서 고마워요.") with `ai.generatedBy = 'DEFAULT'`.
6. `setDoc` to `monthlyReports/{month}` — never overwrite an existing one (transaction or existence check).

**`ensureLastMonthReports(plants)`:**
* `month = prevMonth(thisMonth())`. For each plant that `isEligible` and has no report → `generateReport`. Plants **sequentially** (don't call AI many times at once).
* `created` in the result is used by startup → `notifyReportCreated` (P4).

### 3.2 `public/js/pages/report.js` (`#/report`, `#/report/:month`)
* `title: '월간 리포트'`, `styles: ['css/pages/report.css']`. Query `?plant=id` (from notifications); plant not found → toast "식물을 찾을 수 없어요" and use the current plant.
* **Which month:** path `month` if given; else latest month with a report; else last month.
* **Layout:**
  1. **Plant chips** + **month nav** `‹ 2026년 10월 ›` (only between months with reports and this month).
  2. **Cover card:** character + "{이름}의 10월 이야기" + "함께한 지 {n}일".
  3. **4 stat cards (2×2):** routine rate % (bar), ventilation count, on-time watering %, photo count. With a previous report, show change next to each (▲ green / ▼ grey — **no red**; decrease copy "지난달보다 조금 쉬어 갔어요").
  4. **AI praise card:** 💚 + `praise`.
  5. **Next month's habits:** numbered `suggestions`.
  6. **Notice cards (only if present):** 🪴 repotting (`repotNotice`), 🌾 wrap-up/harvest (`lifespanNotice`).
  7. Bottom: "📅 이 달의 성장 캘린더 보기" → `#/calendar?month=YYYY-MM`.
* **Viewing this month:** instead of an AI report, "이번 달 기록 미리보기" — stat cards via `computeMonthlyStats` + "다음 달 1일에 AI 코치 리포트가 도착해요". **No AI call.**
* **Past month without a report** (e.g. app not opened that month): [리포트 만들기] → `showLoading('AI 코치가 한 달을 돌아보는 중이에요…')` → `generateReport`.
* Months with a report show stored values only.

### 3.3 `public/css/pages/report.css`
Cover card (light green bg, big character), 2×2 stat grid, change arrows, praise card (warm apricot bg), notice cards.

## 4. Files to modify (owned scope)
* `public/js/services/reports.js` — replace stub (§3.1).
* `public/js/pages/dev-ui.js` — **inside `[P6]` section only**:
  * [지난달 샘플 기록 만들기] — so reports are testable without P3: for the current plant create ~20 days of last month's `checklists` docs (exact §5.5 shape: mix of completed, incomplete, postponed watering), 3 `photos` (small SVG data URLs), 4 `aiHistory`. Add `sample: true` to every doc.
  * [샘플 기록 지우기] — delete only `sample: true` docs.
  * [지난달 리포트 강제 생성] / [지난달 리포트 지우기].
* `public/prompts/monthly-report.v*.txt`, `public/mocks/monthly-report.json` — wording (keep keys/shapes).
* Don't edit `startup.js` — already wired in Common.

**All files in this task:** `services/reports.js`, `pages/report.js`, `css/pages/report.css`, the prompt/mock files above, `[P6]` section of `dev-ui.js`.

## 5. Edge cases
* Plant registered mid last month → count from registration to month end only (checklists exist only then, so it's natural); cover shows "{등록일}부터 함께했어요".
* Month with no records → stats 0; even if AI gets "almost no records", avoid negative copy (default copy recommended).
* App opened after several months → auto-generate **last month only**; earlier months via [리포트 만들기].

## 6. Don't
* No weekly reports (spec v2 changed to monthly).
* Don't re-call AI every time the report screen opens.

## 7. Done when
- [ ] `#/dev` [지난달 샘플 기록 만들기] → [지난달 리포트 강제 생성] creates `monthlyReports/{last month}` with stats matching the sample (e.g. hand-counted routine rate).
- [ ] Report shows 4 stats, praise, suggestions; with a previous report, change arrows appear.
- [ ] The same month's report is never created twice (even after many refreshes).
- [ ] A plant with `purchasedAt` 180+ days ago (edit in Firestore) gets the repot notice.
- [ ] This month shows only the AI-free stats preview.
- [ ] Re-viewing a saved report makes no AI call (no `[ai]` log).
- [ ] No Common file names/shapes changed (`git diff main --stat`).
- [ ] `docs/PROGRESS.md` has the P6 entry.
