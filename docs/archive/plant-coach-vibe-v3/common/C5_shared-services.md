# [Common] C5 — Shared services · page stubs · startup wiring · dev tools

> Read with: `00_MAIN.md` (§5.5 schema, §5.10 startup, §9 phases/ownership). Spec: SPEC 3.2 data, 3.3 AI context.
> Owner: A.

## 1. Goal
Let B/C/D build pages **in parallel without waiting**. So:
1. Build **full versions** of data services several pages share (`aiHistory`, `environments`, `photos`, `schedules` extension).
2. For functions other pages call but one page implements (`checklists.js`, `ui/diagnosis-flow.js`, `notifications.js`, `reports.js`), build **stubs with the final names/args/return shapes**. Stubs must **actually work** (simple, no AI).
3. **Wire `startup.js` completely** to the stubs so pages never edit it.
4. Prepare **test tools** (`#/dev` shared buttons) and **per-page sections**.

> After this file, the names/args/return shapes here are **frozen**. Pages only change internals (`00_MAIN.md` §9).

## 2. Prerequisites
* C1–C4. Especially `services/plants.js`, `services/schedules.js` (`createInitialSchedules`, `listSchedules`), `services/images.js`, `utils/image.js`, `utils/date.js`, `ui/layout.js` (`setBadge`).

## 3. Files to create

### 3.1 `public/js/services/aiHistory.js` (full)
```js
export async function addHistory(plantId, type, summary)
// type: 'PHOTO_DIAGNOSIS' | 'ENVIRONMENT' | 'CHECKLIST'
// cut each string value to 200 chars; auto-add summary.date = today()
export async function getRecentHistory(plantId, { n = 5, type } = {})
// summary array, newest first (for AI requests)
export async function getHistoryInMonth(plantId, month)
// summaries in 'YYYY-MM' (query by summary.date string range)
```
* **Never put photos/data URLs in summary.** String values starting with `data:` are removed with a console warning.
* Filtering by `type` + ordering by `createdAt` needs a composite index. Prototype: **fetch latest 20 by `createdAt` desc, filter type on the client** (no index).

### 3.2 `public/js/services/environments.js` (full)
```js
export async function saveEnvironment(plantId, data)   // §5.5 shape, measuredAt auto
export async function getLatestEnvironment(plantId)    // null if none
export async function listEnvironments(plantId, n = 5)
```

### 3.3 `public/js/services/photos.js` (full)
```js
export async function addPhoto(plantId, { image, date, diagnosis = null }) // image already via prepareImageForSave
export async function listPhotosInMonth(plantId, month)  // date ascending
export async function listRecentPhotos(plantId, n = 10)
export async function hasPhotoOn(plantId, date)          // once-a-day EXP check
```
* If C4's `plants.createPlant` writes the first photo directly, **switch it to this function** (same shape).

### 3.4 `public/js/services/schedules.js` — **add functions** (full)
```js
export async function getDueSchedules(plantId, date = today())  // dueDate <= date
export async function hasOverdue(plantId, date = today())       // any dueDate < date
export async function completeSchedule(plantId, taskType, date = today()) // lastDoneAt = date, dueDate = date + intervalDays
export async function postponeSchedule(plantId, taskType, days = 2)       // dueDate = today() + days
```
* Only 4 schedules per plant → read all via `listSchedules`, filter on client.
* Keep `createInitialSchedules`, `listSchedules` unchanged.

### 3.5 `public/data/daily-tasks.json`
```json
[
  { "taskType": "VENTILATE", "title": "창문 열고 10분 환기하기" },
  { "taskType": "CHECK_LEAF", "title": "잎 앞뒷면 가볍게 눈맞춤하기" },
  { "taskType": "CHECK_LIGHT", "title": "햇빛이 잘 드는지 자리 살펴보기" },
  { "taskType": "MIST", "title": "잎 주변 공기에 가볍게 분무하기", "onlyWhenDry": true }
]
```

### 3.6 `public/js/services/checklists.js` — **stub** (completed by P3)
```js
export const ALLOWED_DAILY = ['VENTILATE', 'CHECK_LEAF', 'CHECK_LIGHT', 'MIST'];
export const TASK_INFO = {
  WATER:     { label: '물주기',  emoji: '💧', tip: '겉흙이 말랐는지 먼저 확인해요' },
  FERTILIZE: { label: '비료 주기', emoji: '🧪', tip: '정량보다 조금 적게 주는 게 안전해요' },
  WIPE_LEAF: { label: '잎 닦기',  emoji: '🧽', tip: '젖은 천으로 잎을 살살 닦아 주세요' },
  REPOT:     { label: '분갈이',  emoji: '🪴', tip: '배수 구멍으로 뿌리가 나왔는지 봐요' },
  VENTILATE: { emoji: '🌬️' }, CHECK_LEAF: { emoji: '🍃' }, CHECK_LIGHT: { emoji: '☀️' }, MIST: { emoji: '💦' },
};
export async function getChecklist(plantId, date = today())   // null if none
export async function ensureTodayChecklist(plant)              // → { checklist, created: boolean }
export function summarize(checklist)                           // → { total, done, remaining, percent }
export async function completeItem(plantId, itemId, { soilMoistureDry = null } = {})
// → { status: 'completed' | 'postponed' | 'already', expResult }
```
**Stub behavior (no AI):**
* `ensureTodayChecklist`: today's doc exists → `{ checklist, created: false }`. Else build from `getDueSchedules` periodic items (exp 20) + VENTILATE·CHECK_LEAF from `daily-tasks.json` (exp 5), save with `generatedBy: 'DEFAULT'` → `{ checklist, created: true }`. **Inside `runTransaction`, create only if absent** (never twice a day). Items exactly §5.5 (`id`, `isCompleted: false`, `completedAt: null`, `dueDate`, `soilMoistureDry: null`, `postponed: false`).
* `summarize`: exclude `postponed` items from total; null checklist → all 0.
* `completeItem`: `throw new Error('체크리스트 완료는 P3에서 구현돼요')`.
* Top comment: "이 파일은 P3가 완성한다. 위 함수의 이름·인자·반환 형식은 바꾸지 않는다."

### 3.7 `public/js/ui/diagnosis-flow.js` — **stub** (completed by P1)
```js
export async function runDiagnosisFlow({ plant, species, imageFile = null, withDiagnosis = true })
// → on done { photo, diagnosis, expResult } / user cancel → null
```
**Stub (no AI):** open file picker (if no `imageFile`) → `fileToDataUrl` → preview `confirmModal('이 사진으로 기록할까요?')` → `addPhoto(plant.id, { image: await prepareImageForSave(dataUrl), date: today(), diagnosis: null })` → `toast('사진을 기록했어요')` → return `{ photo, diagnosis: null, expResult: null }`. Cancel → `null`.
* Top comment: "이 파일은 P1이 완성한다(질문·처방·경험치). 함수 이름·인자·반환 형식은 바꾸지 않는다."

### 3.8 `public/js/services/notifications.js` — **stub** (completed by P4)
```js
export async function createNotification({ key, type, title, body, link }) // stub → false
export async function listNotifications(n = 30)          // stub → []
export async function markRead(id)                       // stub → no-op
export async function markAllRead()                      // stub → no-op
export function watchUnreadCount(callback)               // stub → callback(0), returns () => {}
export async function requestBrowserPermission()         // stub → 'unsupported'
export function showBrowserNotification({ title, body, link }) // stub → no-op
export async function notifyChecklistCreated(plant, checklist) // stub → no-op (called by startup)
export async function notifyReportCreated({ plantId, month })  // stub → no-op (called by startup)
```
* Top comment: "이 파일은 P4가 완성한다. 함수 이름·인자·반환 형식은 바꾸지 않는다."

### 3.9 `public/js/services/reports.js` — **stub** (completed by P6)
```js
export async function computeMonthlyStats(plantId, month)
// stub → { routineRate: 0, ventilationCount: 0, waterOnTimeRate: null, photoCount: 0, checklistDays: 0 }
export async function getReport(plantId, month)          // stub → null
export async function listReportMonths(plantId)          // stub → []
export async function generateReport(plant, month)       // stub → throw Error('월간 리포트는 P6에서 구현돼요')
export async function ensureLastMonthReports(plants)     // stub → [] (each item would be { plantId, month, created })
export function isEligible(plant, month)                 // real: plant created on/before that month's last day
```
* Top comment: "이 파일은 P6가 완성한다. 함수 이름·인자·반환 형식은 바꾸지 않는다."

### 3.10 `public/js/pages/dev-ui.js` — **shared test buttons + per-page sections**
Below the existing sections (visible only when logged in):
* **Shared tests (current plant):**
  * [물주기 예정일을 오늘로] — `schedules/WATER.dueDate = today()`
  * [물주기 예정일을 3일 전으로] — for WAITING state
  * [오늘 체크리스트 지우기] — delete `checklists/{today}`
  * [현재 식물 데이터 보기] — plant doc + 4 schedules as JSON in `<pre>`
* **Empty per-page sections** (title + comment only; each owner adds buttons **only inside their own section**):
  ```js
  // ===== [P1] 성장 캘린더 테스트 — P1 담당자만 수정 =====
  // ===== [P2] 프롬프트 실험실 테스트 — P2 담당자만 수정 =====
  // ===== [P3] 체크리스트 테스트 — P3 담당자만 수정 =====
  // ===== [P4] 알림 테스트 — P4 담당자만 수정 =====
  // ===== [P5] 환경 분석 테스트 — P5 담당자만 수정 =====
  // ===== [P6] 월간 리포트 테스트 — P6 담당자만 수정 =====
  ```
  C6's "game test" section also goes in this file.

## 4. Files to modify
* `public/js/services/schedules.js` — add §3.4 functions.
* `public/js/services/plants.js` — first photo via `photos.addPhoto` (only if needed).
* `public/js/core/startup.js` — **fill all three background sections**; after this the file is frozen:
  ```js
  // [C5] 오늘의 체크리스트 만들기 + 새로 만들었으면 알림 (식물마다, 기다리지 않음)
  //      P3는 ensureTodayChecklist 안쪽만, P4는 notifyChecklistCreated 안쪽만 바꾼다.
  for (const plant of store.get('plants') ?? []) {
    ensureTodayChecklist(plant)
      .then(({ checklist, created }) => (created ? notifyChecklistCreated(plant, checklist) : null))
      .catch((e) => console.warn('[C5] 체크리스트 생성 실패', e));
  }

  // [C5] 지난달 월간 리포트 + 새로 만들었으면 알림 — P6가 ensureLastMonthReports 안쪽을 완성
  ensureLastMonthReports(store.get('plants') ?? [])
    .then(async (results) => {
      for (const r of results.filter((x) => x.created)) await notifyReportCreated(r);
    })
    .catch((e) => console.warn('[C5] 월간 리포트 생성 실패', e));

  // [C5] 안 읽은 알림 수 → 상단 뱃지. 로그아웃(store user → null) 때 해제
  const stop = watchUnreadCount((count) => setBadge(count));
  const unsub = store.subscribe('user', (u) => { if (!u) { stop(); unsub(); setBadge(0); } });
  ```

## 5. Don't
* Don't build checklist, calendar, environment, report, notification, or prompt-lab screens (Pages).
* No AI calls inside stubs.

## 6. Done when
- [ ] The 4 shared test buttons in `#/dev` work.
- [ ] On login each plant gets today's checklist (`generatedBy: 'DEFAULT'`) exactly once; refresh doesn't duplicate.
- [ ] [물주기 예정일을 오늘로] → [오늘 체크리스트 지우기] → refresh: checklist contains watering.
- [ ] Stub `runDiagnosisFlow` saves a photo to `photos` with diagnosis `null`.
- [ ] `addHistory` with a data URL doesn't save it and warns.
- [ ] Stubs `notifications.js`, `reports.js` load without errors; startup runs with them (badge shows nothing).
- [ ] All §3 functions are exported with names/args exactly as in this doc.
- [ ] `docs/PROGRESS.md` has the C5 entry.
