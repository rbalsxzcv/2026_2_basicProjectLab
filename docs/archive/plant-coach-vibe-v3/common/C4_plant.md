# [Common] C4 — Plant register · plant manage · chibi character

> Read with: `00_MAIN.md` (§5.2 routes, §5.4 `generateCharacter`, §5.5 `plants`·`schedules`·`photos`). Spec: SPEC F-01, structure [최초 접속 시 등록된 식물 없음] → [식물 등록], [메인] → [식물 관리] → [식물 등록].
> Owner: A.

## 1. Goal
* Picking a species links **standard care data**; uploading a photo lets the image AI create a **chibi character**.
* Registration also creates **periodic care schedules** (water, fertilize, wipe leaf, repot).
* **No plants on first login** → auto-go to registration.
* Plant manage screen: **list · select · edit · delete**.

## 2. Prerequisites
* C1 (shell), C2 (`generateCharacter` mock), C3 (login, `store.user`).

## 3. Files to create

### 3.1 `public/data/plant-species.json` — standard plant DB
10 beginner species: 몬스테라, 스투키, 산세베리아, 스킨답서스, 테이블야자, 금전수, 고무나무, 아이비, 바질, 방울토마토.
```json
{
  "id": "monstera",
  "name": "몬스테라",
  "aliases": ["몬스테라 델리시오사"],
  "luxMin": 1000, "luxMax": 10000,
  "tempMin": 18, "tempMax": 27,
  "humidityMin": 50, "humidityMax": 70,
  "waterIntervalDays": 7,
  "fertilizeIntervalDays": 30,
  "wipeLeafIntervalDays": 14,
  "repotIntervalDays": 365,
  "lifespanType": "PERENNIAL",
  "defaultLifespanDays": null,
  "careTip": "겉흙이 마르면 듬뿍, 받침의 고인 물은 버려 주세요."
}
```
* Fill with commonly known beginner **reference values**; top-level `"_note"`: "참고용 대략값이며 팀이 검토 후 수정".
* 바질 = `ANNUAL` (default ~150 days), 방울토마토 = `HARVEST` (default ~120 days).

### 3.2 `public/js/services/species.js`
```js
export async function loadSpecies()          // fetch + memory cache, array (excluding _note)
export async function getSpecies(id)         // null if missing
export async function searchSpecies(keyword) // match in name/aliases; empty keyword → all
export function speciesProfile(species)      // AI summary { luxRange, tempRange, humidityRange, waterIntervalDays }
```

### 3.3 `public/js/utils/image.js` — compression
```js
export async function fileToDataUrl(file, { maxSize = 768, quality = 0.8 } = {}) // long side → maxSize, JPEG data URL
export function dataUrlBytes(dataUrl)                                          // approx bytes
export async function shrinkDataUrl(dataUrl, maxBytes = 700_000)               // retry with lower quality/size
```
* Resize with `<canvas>`. Handle EXIF rotation via `createImageBitmap(file, { imageOrientation: 'from-image' })`; if unsupported, just continue.
* A Firestore doc can't exceed 1 MB → **always `shrinkDataUrl` before saving**.

### 3.4 `public/js/services/images.js` — image storage mode in one place
```js
export const IMAGE_STORAGE_MODE = 'firestore'; // 'storage' only with Blaze plan
export async function prepareImageForSave(dataUrl) // firestore mode: compressed data URL
```
* Don't implement `storage` mode; leave a comment that it would upload to Cloud Storage and return a URL. **Other files call only this function.**

### 3.5 `public/js/services/schedules.js` — periodic schedules (create & read only now)
```js
export const PERIODIC_TYPES = ['WATER', 'FERTILIZE', 'WIPE_LEAF', 'REPOT'];
export async function createInitialSchedules(plantId, species, startDate) // creates 4 docs
export async function listSchedules(plantId)                             // array of 4
```
* Doc id = taskType. `dueDate = addDays(startDate, intervalDays)`, `lastDoneAt: null`.
* C5 will **add** `getDueSchedules`, `hasOverdue`, `completeSchedule`, `postponeSchedule` here — mark the spot with a comment near the top.

### 3.6 `public/js/services/plants.js` — plant CRUD
```js
export async function loadPlants()                 // all my plants → store.set('plants'), fix currentPlantId
export function getCurrentPlant()                  // current plant object from store
export function selectPlant(plantId)               // store.set('currentPlantId')
export async function getPlant(plantId)
export async function createPlant({ speciesId, name, purchasedAt, lifespan, photoDataUrl, characterImage })
export async function updatePlant(plantId, patch)  // only name, purchasedAt, lifespan, characterImage
export async function deletePlant(plantId)
```
* `createPlant` order:
  1. Create `plants` doc: `exp: 0, level: 1, state: 'PEACEFUL', alertOpen: false, lastCareAt: null, createdAt`.
  2. `createInitialSchedules(plantId, species, purchasedAt or today)` — if purchase date is long ago, use **today** (so schedules aren't already overdue on day 1).
  3. If there's a photo, add the first record to `photos`: `{ image, date: today, diagnosis: null, createdAt }` (spec: "등록 사진은 식물 사진 기록에 함께 저장"). Use exactly §5.5 shape — `photos.js` (C5) reads the same path (C5 switches this to `photos.addPhoto`).
  4. Call `loadPlants()` again, then `selectPlant` the new plant.
* `deletePlant`: Firestore doesn't delete subcollections. Query `schedules, checklists, environments, photos, aiHistory, monthlyReports`, delete with `writeBatch` (≤ 400 per batch), then delete the plant doc, then `loadPlants()`.
* Empty plant name → use species name.

### 3.7 `public/assets/characters/default.svg`
Cute chibi plant for no-photo / character failure (round pot, smiling face, two sprout leaves, pastel green). Square viewBox, pure SVG (no external fonts/images).

### 3.8 `public/js/pages/plant-register.js` (`#/plants/new`, `#/plants/:id/edit`)
* `title`: register mode "식물 등록", edit mode "식물 정보 수정". `styles: ['css/pages/plant.css']`.
* **Register mode:**
  1. Intro: no plants → "반가워요! 함께할 첫 식물을 알려 주세요 🌱", else "새 식물 친구를 등록해요".
  2. **Species (required):** search input + result list below (cards, tap to select). Selected → small card with species name, `careTip`, recommended watering interval. Below list: "목록에 없나요? 비슷한 종류를 골라 주세요".
  3. **Name (optional nickname):** max 12 chars, placeholder = species name.
  4. **Purchase date (optional):** `<input type="date">`, default today, no future dates.
  5. **Lifespan:** visible only when `lifespanType` is `ANNUAL`/`BIENNIAL`/`HARVEST`. "예상 마무리 날짜" (default purchase date + `defaultLifespanDays`), editable. Hidden for `PERENNIAL`.
  6. **Photo (optional):** `<input type="file" accept="image/*" capture="environment">` + preview. Text: "사진을 올리면 AI가 내 식물을 닮은 캐릭터를 그려 줘요."
  7. [등록하기] button.
* **Submit:**
  1. With photo: `fileToDataUrl` → `showLoading('내 식물을 닮은 캐릭터를 그리는 중이에요…')` → `generateCharacter({ imageBase64, speciesName })` → `prepareImageForSave`.
  2. Character fails → use default character (path string `assets/characters/default.svg`) and `toast('캐릭터는 나중에 다시 만들 수 있어요')`.
  3. `createPlant(...)` → welcome modal showing the character large: "{이름}(이)가 Lv.1로 태어났어요!" → `#/main`.
* **Edit mode:** prefilled. **Species can't change** (schedules would break) — greyed out with "종류를 바꾸려면 새로 등록해 주세요". Uploading a new photo shows [이 사진으로 캐릭터 다시 만들기]. Save → `updatePlant` → `#/plants`.

### 3.9 `public/js/pages/plant-manage.js` (`#/plants`)
* `title: '내 식물 관리'`, `styles: ['css/pages/plant.css']`.
* Layout:
  1. Top [+ 새 식물 등록] → `#/plants/new`.
  2. Plant cards: character thumbnail (64px), name, species, `Lv.n`, "함께한 지 N일째", chip "지금 보는 중" if selected.
  3. Card buttons: [이 식물 보기] (select → `#/main`), [수정] (`#/plants/:id/edit`), [삭제].
  4. Delete: `confirmModal('{이름}의 성장 기록도 모두 지워져요. 정말 삭제할까요?', { okLabel: '삭제' })` → `deletePlant` → toast. 0 plants afterwards → `#/plants/new`.
  5. No plants → `emptyState`.

### 3.10 `public/css/pages/plant.css`
Species result cards, selected border, photo preview (rounded square, 1:1), plant card list.

## 4. Files to modify
* `public/js/core/startup.js` — **[C4] section only**:
  ```js
  // [C4] 식물 목록 불러오기, 식물이 없으면 등록 화면으로
  const plants = await loadPlants();
  if (plants.length === 0) redirect = '/plants/new';
  ```

## 5. Edge cases
* Huge photo → if > 700 KB after compression, shrink more; if still failing: "사진이 너무 커요. 다른 사진을 골라 주세요."
* Navigating away during character generation → ignore result (render token check).
* Prevent double-click on register.

## 6. Don't
* Don't build the main screen (C6). `#/main` being not-ready after registration is fine now.
* No EXP/state logic (C6 `game.js`).

## 7. Done when
- [ ] New user logging in lands on plant registration automatically.
- [ ] Registering with species, name, date, (lifespan), photo creates `plants`, 4 `schedules`, (with photo) 1 `photos` doc.
- [ ] In mock mode a photo yields an SVG character stored in `characterImage`; no photo → default character path stored.
- [ ] A large photo (5 MB+) is compressed and saved without error.
- [ ] Plant manage: edit name/date, select another plant, delete; deletion removes all subcollection docs.
- [ ] 바질·방울토마토 show the lifespan input; 몬스테라 doesn't.
- [ ] `docs/PROGRESS.md` has the C4 entry.
