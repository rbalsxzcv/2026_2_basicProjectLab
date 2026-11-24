# [Page] P1 — Growth calendar · conversational photo diagnosis

> Read with: `00_MAIN.md` (§5.4 `diagnose`·`advise`, §5.5 `photos`·`aiHistory`, §5.6 EXP). Spec: SPEC F-04, structure [성장 캘린더].
> Owner: B. Branch from frozen `main`: `feat/p1-calendar`.

## 1. Goal
* On photo upload, AI **first observes symptoms**, **asks back about the soil**, then combines the answer into **2 actions for today** — a **conversational diagnosis**.
* Results stack as [date + photo + status tag + AI prescription memo] cards in a **calendar and timeline**.
* **Past records show stored results only; never re-call AI.**
* The flow is a **separate UI module** so the checklist (P3) can reuse it.

## 2. Prerequisites
* **Common frozen.** Especially `services/photos.js` (`addPhoto`, `listPhotosInMonth`, `hasPhotoOn`), `ui/diagnosis-flow.js` (C5 stub), `services/aiHistory.js` (`addHistory`, `getRecentHistory`), `services/game.js` (`awardExp`, `markCared`, `setAlert`, `refreshPlantState`, `EXP.PHOTO`), `ui/celebrate.js`, `utils/image.js`, `services/images.js`, `core/ai.js` (`diagnose`, `advise`).
* There may be a first photo from plant registration (`photos`, diagnosis `null`).
* **Independent test:** needs only Main + Common. Works in AI mock mode (diagnose-1 normal / diagnose-2 watch picked at random).

## 3. Files to create

### 3.1 (exists) `public/js/services/photos.js`
Use the Common version **as is**. If it needs a change, propose to the team (P6 report also uses it).

### 3.2 `public/js/services/diagnosis.js` — diagnosis calls (no UI)
```js
export async function startDiagnosis({ imageDataUrl, speciesName })
// → ai.diagnose → { symptoms, severity, question, options }
export async function finishDiagnosis({ plantId, speciesName, first, userAnswer })
// → getRecentHistory(plantId, { n: 5 }) → ai.advise → { advice, summaryTag }
export function buildHistorySummary({ first, userAnswer, result })
// → { symptoms, severity, userAnswer, summaryTag, advice: '가이드1 / 가이드2' } (no photo)
```

### 3.3 `public/js/ui/diagnosis-flow.js` — **replace C5 stub with full version**
> Keep name/args/return **identical** to the stub. P3 calls it.
```js
export async function runDiagnosisFlow({ plant, species, imageFile = null, withDiagnosis = true })
// → on done { photo, diagnosis, expResult } / user cancels midway → null
```
Steps:
1. No `imageFile` → open a file picker (create `<input type="file" accept="image/*" capture="environment">` in code and click). Cancel → `null`.
2. `fileToDataUrl` → preview modal ("이 사진으로 기록할까요?" [기록하기] [다시 고르기]).
3. `withDiagnosis` false → jump to step 8 (photo without diagnosis).
4. `showLoading('AI 코치가 잎을 살펴보는 중이에요…')` → `startDiagnosis`.
5. **Question step:** `choiceModal({ title: '조금만 더 알려 주세요', question: "관찰: {symptoms}\n\n{question}", options })`.
   * Show observations non-assertively (prefix "사진으로 보면").
   * User closes → confirm "진단 없이 사진만 기록할까요?" → yes: step 8 (no diagnosis), no: `null`.
6. Answer → `showLoading('맞춤 가이드를 만드는 중이에요…')` → `finishDiagnosis`.
7. **Result modal:** photo + status tag + "오늘 해 볼 일" 2 items (numbered) + [확인].
8. **Save & apply:**
   * `addPhoto(plant.id, { image: await prepareImageForSave(dataUrl), date: today(), diagnosis: { ...first, userAnswer, ...result } or null })`.
   * With diagnosis: `addHistory(plant.id, 'PHOTO_DIAGNOSIS', buildHistorySummary(...))`, `setAlert(plant.id, severity === 'watch')`.
   * First photo today → `awardExp(plant.id, EXP.PHOTO, 'PHOTO')` + `markCared` → `celebrateIfLeveledUp`. Already recorded today → no EXP, small note "오늘 사진 경험치는 이미 받았어요".
   * `refreshPlantState(plant.id)`.
9. Any AI failure → `toast(error message)` then offer "사진만 먼저 기록할까요?" (never lose the photo).

**Resolving state:** a `normal` diagnosis sets `alertOpen` false → character back to PEACEFUL. If the plant is in `ALERT`, the result modal also shows [다 확인했어요] → `setAlert(false)`.

### 3.4 `public/js/pages/calendar.js` (`#/calendar`)
* `title: '성장 캘린더'`, `styles: ['css/pages/calendar.css']`.
* **Layout:**
  1. **Plant chips** (if several).
  2. **Month header:** `‹  2026년 11월  ›` — prev/next (no future months). Supports `?month=YYYY-MM`.
  3. **Calendar grid:** Sun–Sat 7 columns. Days with photos show a small round thumbnail (several → first + count); `watch` tag → light apricot thumbnail border. Today → green border. Days before plant registration dimmed.
  4. **Selected-day panel:** tap a date → that day's cards below (default: today or the month's last record day).
  5. **Timeline (this month, newest first):** each card: date (`formatKorean`), photo (full width, 1:1), status tag, collapsible "AI 처방 메모" (observation · my answer · 2 guides). Photos without diagnosis show only tag "📷 사진 기록".
  6. **Floating record button:** [📷 오늘 사진 기록하기] → small sheet "AI 진단 받기" (default) / "사진만 기록하기" → `runDiagnosisFlow`. Refresh list after.
  7. Bottom link: "📄 이번 달 기록으로 월간 리포트 보기" → `#/report` (spec: calendar → monthly report).
* **AI is called only from button 6.** Month move, date select, card expand = Firestore reads only.
* No photos → `emptyState({ icon: '🌱', message: '첫 성장 사진을 남겨 볼까요?', actionLabel: '사진 기록하기' })`.

### 3.5 `public/css/pages/calendar.css`
Grid (square cells, 28px round thumbnails), today/selected marks, timeline cards, floating button (16px above nav), collapse/expand.

## 4. Files to modify (owned scope)
* `public/js/ui/diagnosis-flow.js` — replace stub (§3.3).
* `public/prompts/diagnose.v*.txt`, `public/prompts/advice.v*.txt`, `public/mocks/diagnose-*.json`, `public/mocks/advice.json` — wording for diagnosis quality (keep response keys/shapes).
* `public/js/pages/dev-ui.js` — **inside `[P1]` section only**: [오늘 사진 기록 지우기] (to retest once-a-day EXP). Mock picks `diagnose-1`/`diagnose-2` at random, so a few tries show both flows.

**All files in this task:** `pages/calendar.js`, `css/pages/calendar.css`, `services/diagnosis.js`, `ui/diagnosis-flow.js`, the prompt/mock files above, `[P1]` section of `dev-ui.js`. Nothing else.

## 5. Edge cases
* `ai/normalize.js` already forces 3 `options`; if still empty, use `['흙이 축축해요', '흙이 바짝 말라있어요', '잘 모르겠어요']`.
* Navigating away during diagnosis → clean up open modals/loading.
* Multiple photos per day allowed (EXP once a day).

## 6. Don't
* No "re-analyze past record with AI" button.
* Never put photos in `aiHistory`.
* No assertive/scary copy like "병에 걸렸어요", "죽어가요".

## 7. Done when
- [ ] Uploading a photo goes observation → question (3 options) → 2 guides.
- [ ] Results saved to `photos` (with photo) and `aiHistory` (type `PHOTO_DIAGNOSIS`, no photo).
- [ ] Mock `diagnose-2` (watch) turns main character ALERT (magnifier); later normal diagnosis or [다 확인했어요] returns it to PEACEFUL.
- [ ] Only the first photo per day gives +15 EXP.
- [ ] Thumbnails show on the calendar; month move · date select · card expand make no AI calls (no `[ai]` logs in console).
- [ ] Closing the question step allows "photo only".
- [ ] No Common file names/shapes changed on this branch (`git diff main --stat`).
- [ ] `docs/PROGRESS.md` has the P1 entry.
