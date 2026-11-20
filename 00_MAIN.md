# 00_MAIN — AI Plant Coach: master rules (attach to EVERY session)

> Always attach this file + this session's task file (e.g. `common/C3_auth.md`, `pages/P3_checklist.md`). Work ONLY within that task file's scope.
> Order: **Common C1–C6 (member A alone)** → freeze → **Pages P1–P6 (members B/C/D in parallel)** (§9).
> Feature details follow `docs/SPEC.md` (spec v2). If this file and SPEC differ, **this file wins** (prototype simplifications).
> Text in quotes inside task files is final Korean UI copy — use it verbatim.

## 1. Your role
Senior developer pairing with a 4-person CS undergrad team on a web-app prototype.
* Team knows HTML5; beginners at ES modules, async/await, Firebase, Git collaboration.
* Write **simple, readable** code. Three plain lines beat one clever line.
* Comments in **Korean**. Where a new concept first appears (`import`, `await`, Firestore query…), add a 1–2 line explanation.
* You don't remember other sessions or members. **Code + these docs + `docs/PROGRESS.md` are the only memory.**

## 2. Project summary
**AI 반려식물 코치** helps first-time plant owners build care habits with an AI coach. Each plant becomes a cute **deformed (chibi) character**; doing checklist items earns EXP and grows it.

4 non-negotiable principles:
1. **Overwatering guard (Safe-Lock):** watering can't be completed without a "soil dryness self-check". If soil is wet → not completed, schedule postponed 2 days (no penalty).
2. **Conversational diagnosis:** AI never concludes from a photo alone. It observes symptoms, asks the user about the soil, then prescribes from both.
3. **Anti-Guilt:** **never** any dying/wilting visuals, scary copy, or penalties. Delays are shown only as the character "calmly waiting".
4. **AI context saving:** store past AI analyses as **short JSON summaries without photos**; pass only the latest few to the next AI call. Viewing past records never re-calls AI.

## 3. Tech stack (fixed — don't change)
| Area | Choice | Notes |
| :--- | :--- | :--- |
| Frontend | **Plain HTML + CSS + JS (ES modules)** | No framework/build tool. React, Vue, Vite, TypeScript, Tailwind **forbidden**. |
| Navigation | **Hash-router SPA** (`#/main`) | `index.html` is the only HTML; pages are JS modules. |
| Backend | **None — Firebase + AI API calls only** | No Node/Express/PHP server, no Cloud Functions, no npm packages. All logic runs in the browser. |
| Auth | Firebase Authentication (email/password) | Login ID → email conversion (§5.9). |
| DB | Cloud Firestore | Client reads/writes via SDK. Security = `firestore.rules`. |
| AI | **Firebase AI Logic** (Gemini Developer API backend; works on free Spark plan) | Browser calls Gemini through the Firebase SDK; **no AI key in code**. Protected by **Firebase App Check** (the console's AI Logic setup enforces it). Wrapped by ONE adapter `js/ai/provider.js`; `mock` mode returns fake responses. |
| Weather | **Open-Meteo** (keyless public API, CORS OK) via `js/core/weather.js` | Keyless → no secret in client. `mock` mode returns fake values. |
| Images | **Compressed data URL stored in Firestore** | Cloud Storage needs Blaze plan → excluded by default; switchable only in `services/images.js`. |
| Firebase SDK | Official **CDN module URLs** `https://www.gstatic.com/firebasejs/<ver>/firebase-<module>.js` | Version lives only in `core/firebase.js`. |
| Run | Static server on `public/`: VS Code **Live Server** or `python -m http.server 5500 --directory public` → `http://localhost:5500` | ES modules fail on `file://`. Camera needs localhost or HTTPS. Optional Firebase Hosting for HTTPS (phone camera tests / demo). |

**Prototype simplifications vs SPEC v2:**
* No server: AI and weather are called from the client, and the client saves results to Firestore.
* Standard plant DB (`plantSpecies`) is the file `public/data/plant-species.json`, not Firestore.
* Daily checklist and monthly report are generated **when the app opens (right after login) if needed**, not by scheduled jobs.
* Notifications = **in-app inbox** by default; device push (FCM) needs a server → optional, out of scope unless the team decides (P4 §7).

## 4. Folder structure
`[ ]` = owning task file (`C*` = Common, `P*` = Pages). Details are in each task file.
```text
plant-coach/
├─ .gitignore                 # .DS_Store, .firebase/, local notes             [C1]
├─ firestore.rules            # Firestore security rules                        [C1]
├─ firebase.json              # (optional) Firebase Hosting, public="public"   [C1]
├─ docs/  SPEC.md (team) · PROGRESS.md [C1] · vibe/ (these guides)
└─ public/                    # everything the browser runs
   ├─ index.html              # ★ app shell                                     [C1]
   ├─ css/ base.css · components.css [C1] · pages/<page>.css (each page task)
   ├─ assets/characters/      # default.svg [C4], deco-*.svg [C6]
   ├─ data/ plant-species.json [C4] · regions.json [C3] · daily-tasks.json [C5]
   ├─ prompts/                # AI templates *.v1.txt + README.md               [C2]
   │  └─ samples/*-input.json # prompt-lab sample inputs                        [P2]
   ├─ mocks/*.json            # fake AI responses for mock mode                 [C2]
   └─ js/
      ├─ app.js               # ★ entry: auth watch → router                    [C1]
      ├─ core/
      │  ├─ firebase-config.js  # Firebase web config + App Check site key      [C1]
      │  ├─ firebase.js         # init app/auth/db/ai/App Check + re-exports    [C1]
      │  ├─ router.js · routes.js · store.js                                   [C1]
      │  ├─ startup.js          # tasks right after login                      [C1, filled C3–C5]
      │  ├─ ai-config.js        # AI/weather mode, prompt version, models, limits [C2]
      │  ├─ ai.js               # ★ AI functions the app calls (§5.4)          [C2]
      │  └─ weather.js          # getWeather (mock / Open-Meteo)               [C2]
      ├─ ai/  provider.js · prompts.js · json.js · normalize.js · usage.js      [C2]
      ├─ ui/
      │  ├─ layout.js · components.js                                          [C1]
      │  ├─ celebrate.js        # level-up modal, floating +EXP                [C6]
      │  └─ diagnosis-flow.js   # photo → question → prescription (reusable)   [C5 stub → P1]
      ├─ utils/ date.js · dom.js [C1] · image.js [C4] · lux.js · envScore.js [P5]
      ├─ services/              # Firestore access ONLY here
      │  ├─ auth.js · users.js [C3] · species.js · images.js · plants.js [C4]
      │  ├─ schedules.js [C4 create, C5 extend] · game.js [C6]
      │  ├─ aiHistory.js · environments.js · photos.js [C5]
      │  ├─ checklists.js [C5 stub → P3] · notifications.js [C5 stub → P4] · reports.js [C5 stub → P6]
      │  └─ diagnosis.js [P1]
      └─ pages/                 # one screen = one file
         ├─ login.js · signup.js · profile.js [C3] · plant-register.js · plant-manage.js [C4] · main.js [C6]
         ├─ not-ready.js · dev-ui.js (#/dev, per-task sections) [C1]
         └─ calendar.js [P1] · prompt-lab.js [P2] · checklist.js [P3] · notifications.js [P4] · environment.js [P5] · report.js [P6]
```

## 5. Shared contracts (do not change on your own)
Separately built files must fit together. If a change seems necessary, **propose it with reasons before coding**; if approved, update this file too.

### 5.1 Page module format
Every `public/js/pages/*.js` does `export default`:
```js
// public/js/pages/example.js
import { html } from '../utils/dom.js';
export default {
  title: '화면 제목',                 // shown in top bar
  requiresAuth: true,                 // false only for login, signup
  showNav: true,                      // show bottom nav
  styles: ['css/pages/example.css'],  // page CSS (router loads it)
  // container = <main id="page">, params = path vars + query
  async render(container, params) {
    container.innerHTML = html`<section class="page-example">...</section>`;
    // return a cleanup fn if needed (stop camera, unsubscribe...)
    return () => {};
  },
};
```

### 5.2 Routes (`core/routes.js`)
| Path | Page file | Login | Note |
| :--- | :--- | :--- | :--- |
| `#/login` | `login.js` | no | default entry |
| `#/signup` | `signup.js` | no | |
| `#/main` | `main.js` | yes | home after login |
| `#/plants/new` | `plant-register.js` | yes | auto-redirect when 0 plants |
| `#/plants` | `plant-manage.js` | yes | |
| `#/plants/:id/edit` | `plant-register.js` | yes | same file, edit mode |
| `#/environment` | `environment.js` | yes | current plant |
| `#/calendar` | `calendar.js` | yes | |
| `#/checklist` | `checklist.js` | yes | |
| `#/report` / `#/report/:month` | `report.js` | yes | `month` = `YYYY-MM` |
| `#/profile` | `profile.js` | yes | |
| `#/notifications` | `notifications.js` | yes | |
| `#/dev` | `dev-ui.js` | no | dev test screen (remove for release) |
| `#/prompt-lab` | `prompt-lab.js` | yes | dev prompt tester (remove for release) |
* If a page file doesn't exist yet, router shows `not-ready.js` ("준비 중이에요") — links can be added in any order.
* Query: `#/checklist?plant=abc` → `params.query.plant === 'abc'`.

### 5.3 Global state (`core/store.js`)
```js
store.get('user')            // { uid, loginId, nickname, home: { region, homeType } } | null
store.get('plants')          // my plants array (filled by plants.js)
store.get('currentPlantId')  // selected plant id (also in localStorage)
store.set(key, value)        // change → notify subscribers
store.subscribe(key, fn)     // returns unsubscribe fn
```

### 5.4 AI & weather contract (`core/ai.js`, `core/weather.js`)
Pages/services call ONLY these functions. Images are **data URL strings** (`data:image/...;base64,...`). Success returns the data object; failure throws `AiError` / `WeatherError` whose `message` is a Korean user-facing message.

| Function (`core/ai.js`) | Input | Returns |
| :--- | :--- | :--- |
| `generateCharacter` | `{ imageBase64, speciesName }` | `{ imageBase64 }` chibi character image |
| `diagnose` | `{ imageBase64, speciesName }` | `{ symptoms, severity: 'normal'\|'watch', question, options: [3] }` |
| `advise` | `{ speciesName, symptoms, userAnswer, recentHistory: [] }` | `{ advice: [2], summaryTag }` |
| `analyzeEnvironment` | `{ speciesName, profile, measuredLux, weather, homeType, windowDir, heaterOrAcExposed }` | `{ goodPoint, actions: [1–2] }` |
| `suggestChecklist` | `{ speciesName, profile, weather, latestEnvironment, dueSchedules: [], recentHistory: [] }` | `{ items: [{ category, taskType, title }] }` |
| `writeMonthlyReport` | `{ speciesName, daysSincePurchase, lifespan, stats, monthlyHistory: [], previousReport }` | `{ praise, suggestions: [1–2], repotNotice: string\|null, lifespanNotice: string\|null }` |
| `generateSpecies` | `{ speciesName }` (user-typed name) | `{ isPlant, rejectReason: null\|'NOT_PLANT'\|'NOT_GROWABLE'\|'RESTRICTED', isMock: boolean (mock response = no real judgment), name, aliases, luxMin, luxMax, tempMin, tempMax, humidityMin, humidityMax, waterIntervalDays, fertilizeIntervalDays, wipeLeafIntervalDays, repotIntervalDays, lifespanType, defaultLifespanDays, careTip }` (same shape as a `plant-species.json` entry + `isPlant`, `rejectReason`). Pages don't call it directly: use `services/species.js` `previewSpeciesByName(name)` → `{ species, isNew }` (no save) → after user confirms, `saveSpeciesDraft(species)` (saves). `addSpeciesByName(name)` = both without confirmation. |
| `getWeather(region)` (`core/weather.js`) | `'서울특별시'` | `{ tempC, humidity, precipitation: boolean, source: 'mock'\|'real' }` |

`recentHistory`, `monthlyHistory` = arrays of `aiHistory.summary` objects (no photos, latest 5 by default).

### 5.5 Firestore schema
All personal data under `users/{uid}`. Timestamps: `serverTimestamp()` / `Timestamp`; date-only values: `'YYYY-MM-DD'` strings.
```text
users/{uid}
  loginId: string   nickname: string   home: { region: string, homeType: string }   createdAt: Timestamp

users/{uid}/customSpecies/{speciesId}     # AI-created species (id = 'ai-' + normalized name); merged into loadSpecies/getSpecies/searchSpecies
  same fields as a plant-species.json entry   source: 'AI'|'MOCK' (MOCK = made in mock mode, not really checked)   createdAt: Timestamp

users/{uid}/plants/{plantId}
  speciesId: string   name: string   purchasedAt: 'YYYY-MM-DD'
  lifespan: { type: 'PERENNIAL'|'ANNUAL'|'BIENNIAL'|'HARVEST', endDate: 'YYYY-MM-DD'|null }
  characterImage: string     # data URL or https URL (used directly as img src)
  exp: number (cumulative, default 0)   level: number (default 1)
  state: 'PEACEFUL'|'WAITING'|'ALERT'|'GROWING'
  alertOpen: boolean         # unresolved "needs observation" diagnosis
  lastCareAt: Timestamp|null # last completed care
  createdAt: Timestamp

users/{uid}/plants/{plantId}/schedules/{taskType}     # doc id = taskType
  taskType: 'WATER'|'FERTILIZE'|'WIPE_LEAF'|'REPOT'   intervalDays: number
  dueDate: 'YYYY-MM-DD'   lastDoneAt: 'YYYY-MM-DD'|null

# taskType list (no other values)
#   DAILY_MICRO   (AI picks):        VENTILATE(환기) · CHECK_LEAF(잎 관찰) · CHECK_LIGHT(빛 확인) · MIST(분무, dry only)
#   PERIODIC_CARE (schedules only):  WATER(물주기) · FERTILIZE(비료) · WIPE_LEAF(잎 닦기) · REPOT(분갈이)

users/{uid}/plants/{plantId}/checklists/{YYYY-MM-DD}  # doc id = date
  items: [{ id, category: 'DAILY_MICRO'|'PERIODIC_CARE', taskType, title, exp,
            isCompleted, completedAt: string|null, dueDate: string|null,
            soilMoistureDry: boolean|null, postponed: boolean }]
  generatedBy: 'AI'|'DEFAULT'   createdAt: Timestamp

users/{uid}/plants/{plantId}/environments/{envId}
  measuredLux, luxSource: 'camera'|'sensor'|'manual'   weather: { tempC, humidity, precipitation }
  windowDir, heaterOrAcExposed, matchScore, lightLevel: 'LOW'|'OK'|'HIGH'
  coach: { goodPoint, actions }   measuredAt: Timestamp

users/{uid}/plants/{plantId}/photos/{photoId}
  image: string   date: 'YYYY-MM-DD'
  diagnosis: { symptoms, severity, question, userAnswer, advice, summaryTag } | null
  createdAt: Timestamp

users/{uid}/plants/{plantId}/aiHistory/{historyId}    # NO photos!
  type: 'PHOTO_DIAGNOSIS'|'ENVIRONMENT'|'CHECKLIST'   summary: object (~200-char JSON)   createdAt: Timestamp

users/{uid}/plants/{plantId}/monthlyReports/{YYYY-MM}
  stats: { routineRate, ventilationCount, waterOnTimeRate, photoCount }
  ai: { praise, suggestions, repotNotice, lifespanNotice, generatedBy: 'AI'|'DEFAULT' }
  createdAt: Timestamp

users/{uid}/notifications/{notiId}
  type: 'CHECKLIST'|'MONTHLY_REPORT'   title, body, link (e.g. '#/checklist?plant=abc')
  read: boolean   createdAt: Timestamp
```

### 5.6 Game constants (defined ONLY in `services/game.js`)
| Item | Value |
| :--- | :--- |
| Daily routine done | +5 EXP |
| Periodic care done (watering etc.) | +20 EXP |
| Growth-calendar photo | +15 EXP (once/day) |
| Petting | 0 EXP (reaction only, until team decides) |
| Level | `level = Math.floor(exp / 100) + 1` |
| Growth stage | Lv1–2 `SPROUT`(새싹) · Lv3–5 `YOUNG`(어린 모종) · Lv6+ `LUSH`(풍성한 식물) |
| State priority | `ALERT`(alertOpen) > `WAITING`(a periodic dueDate passed) > `GROWING`(lastCareAt within 30 min) > `PEACEFUL` |

### 5.7 Common UI (`ui/components.js`)
```js
toast(message, type = 'info')                   // 'info'|'success'|'error', disappears after 3s
await openModal({ title, body, actions })       // actions: [{ label, value, variant }] → clicked value
await confirmModal(message)                     // true / false
await choiceModal({ title, question, options }) // clicked option string (diagnosis question, soil popup)
showLoading(message) / hideLoading()            // full-screen loading (during AI calls)
gauge(score)                                    // 0–100 gauge HTML string
emptyState({ icon, message, actionLabel, actionHref })
```
**Never use browser `alert()`, `confirm()`, `prompt()`.**

### 5.8 Dates (`utils/date.js`)
* Every "today" is **Asia/Seoul**. `today()` → `'YYYY-MM-DD'`, `thisMonth()` → `'YYYY-MM'`, `addDays(dateStr, n)`, `diffDays(a, b)`, `prevMonth(monthStr)`, `formatKorean(dateStr)` → `'11월 11일 (수)'`.
* **Never** use `new Date().toISOString().slice(0,10)` (UTC → wrong date before 9 AM KST).

### 5.9 Login ID rules
* Users sign up with an **ID** (lowercase letters/digits, 4–20) + password (6+).
* Firebase Auth gets `toAuthEmail(id)` = `` `${id}@plantcoach.example` `` (`.example` is a reserved unused domain). This function lives only in `services/auth.js` (change only there if the team switches to real emails).
* So no email password reset; the prototype has no "forgot password".
* **Never store passwords in Firestore.**

### 5.10 Post-login tasks (`core/startup.js`) — fully wired in Common, frozen afterwards
* `runBlockingTasks(user)` — must finish **before** first render; may return a redirect path. ([C3] load profile, [C4] load plants; 0 plants → `/plants/new`)
* `runBackgroundTasks(user)` — runs **after** render, not awaited. ([C5] today's checklist per plant → `notifyChecklistCreated` if created; last month's reports → `notifyReportCreated` for each created; unread-count badge via `watchUnreadCount` → `setBadge`, stopped on logout.)
* Each task is wrapped in its own `try/catch` / `.catch` so one failure doesn't stop others.
* Return shapes: `ensureTodayChecklist(plant)` → `{ checklist, created }`; `ensureLastMonthReports(plants)` → `[{ plantId, month, created }]`.
* Page tasks **never edit startup.js**: they replace stub internals (`checklists.js`, `reports.js`, `notifications.js`) and the wiring just works.

## 6. Coding rules
1. **Scope:** touch only the task file's "files to create / modify". Need another file? Explain why and get permission first. During Pages phase, **never edit Common files** (§9.3).
2. **File header comment** on every JS file:
   ```js
   /**
    * 파일: public/js/pages/main.js
    * 역할: 메인 게임 화면 (캐릭터 표시, 선택창, 쓰다듬기, 체크리스트 이동)
    * 사용하는 파일: services/plants.js, services/game.js, ui/components.js
    * 담당: C6
    */
   ```
3. **Firestore only in `services/`.** Pages never call `collection()`, `doc()` directly.
4. **AI/weather only via `core/ai.js` / `core/weather.js`.** Pages/services never import `ai/provider.js` (exception: P2 prompt lab) or `fetch` external APIs directly.
5. **Escape user input:** put HTML via the `html` template from `utils/dom.js` (auto-escape).
6. **Errors:** wrap every `await` in `try/catch`; on failure `toast(Korean message, 'error')`. If AI fails, the screen must not freeze — **fall back to defaults**.
7. **Secrets:** no API keys anywhere in code (AI keys are managed by Firebase AI Logic; Open-Meteo is keyless). Firebase web config is public by design; protection = `firestore.rules` + App Check. Never log images or full prompts (lengths only).
8. **Naming:** files `kebab-case.js`, functions/vars `camelCase`, constants `UPPER_SNAKE_CASE`, functions start with a verb (`loadPlants`, `savePhoto`).
9. **Dependencies:** no npm packages, no external libraries except Firebase CDN modules.
10. **Copy:** all UI text Korean, polite, warm. Words like "죽음, 시듦, 실패, 경고, 벌점" forbidden → use "기다리는 중", "조금 더 관찰이 필요해요".

## 7. Design guide
* **Mobile first:** max width 480px centered; touch targets ≥ 44px tall.
* **Colors (CSS vars in `base.css`):** `--color-primary: #5BA672` (leaf green) · `--color-primary-soft: #E6F4EA` · `--color-accent: #F2B880` (warm apricot) · `--color-bg: #FBFAF6` (off-white) · `--color-text: #2F3A33` · `--color-muted: #7A857E` · `--color-danger-soft: #F6E3DC` (soft tone instead of red).
* **Shape:** rounded corners (`--radius: 16px`), soft shadows, card layout.
* **Font:** system (`-apple-system, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif`).
* **Motion:** gentle swaying CSS animation for characters; off under `prefers-reduced-motion`.
* **A11y:** `alt` on images, text or `aria-label` on buttons.

## 8. Session rules (one AI chat = one session)
**At start:**
1. Read this file + the task file.
2. Read `docs/PROGRESS.md` to see what's done.
3. Open existing files listed under "Prerequisites" and check real function names. **Never write function names from memory or guesses.**
4. State the files to create and the order briefly, then start.

**Before ending:**
1. Check every item of the task file's **"Done when"** list.
2. Append to `docs/PROGRESS.md`:
   ```md
   ## [P3] 체크리스트 (YYYY-MM-DD, 담당: 이름)
   - 만든 파일: ...
   - 수정한 파일: ...
   - 동작 확인 방법: ...
   - 남은 문제 / 다른 담당자에게 알릴 것: ...
   ```
3. Tell the user: **changed files, how to verify manually, suggested commit message** (e.g. `feat(checklist): Safe-Lock 팝업 추가`).

## 9. Phases · order · file ownership

### 9.1 Task files
| Phase | Task file | Content | Owner | Starts after |
| :--- | :--- | :--- | :--- | :--- |
| **Common** | `common/C1_shell.md` | App shell, router, common UI, Firebase/App Check init | A | — |
| | `common/C2_ai-weather.md` | AI adapter (mock + Firebase AI Logic), weather, prompt templates, mocks | A | C1 |
| | `common/C3_auth.md` | Login, signup, profile | A | C1 |
| | `common/C4_plant.md` | Plant register/manage, chibi character | A | C2, C3 |
| | `common/C5_shared-services.md` | Shared data services, stubs for pages, startup wiring, dev tools | A | C4 |
| | `common/C6_main-game.md` | Main game screen, EXP/level/state machine → **freeze** | A | C5 |
| **Pages** | `pages/P1_calendar.md` | Growth calendar + conversational photo diagnosis | B | freeze |
| | `pages/P2_prompt-lab.md` | Prompt test page, prompt templating procedure | B | freeze |
| | `pages/P3_checklist.md` | AI checklist + Safe-Lock | C | freeze |
| | `pages/P4_notifications.md` | In-app notification inbox (+ optional browser notifications) | C | freeze |
| | `pages/P5_environment.md` | AI environment analysis (light, weather, score) | D | freeze |
| | `pages/P6_report.md` | Monthly report | D | freeze |

* Common is built by **one person (A)** in order C1 → C6.
* After C6, Common is **frozen**. B/C/D build their pages **in parallel without waiting for each other**: each page needs only Main + Common interfaces; Common stubs stand in for other pages.
* After the freeze, A acts as integrator: reviews PRs, fixes Common bugs on `main`, applies approved contract changes.

### 9.2 Frozen Common interface
Pages only **read/call** these, never modify:
* Everything in §5 (page format, routes, store, AI/weather contract, Firestore schema, game constants, UI functions, date/ID rules, startup wiring).
* All files created in Common, except the stub files and sections listed in §9.3.

### 9.3 Edit permissions after the freeze
| File | Who | Scope |
| :--- | :--- | :--- |
| `ui/diagnosis-flow.js` | P1 (B) | replace stub with full version (keep names/args/return shapes) |
| `services/checklists.js` | P3 (C) | replace stub (keep shapes) |
| `services/notifications.js` | P4 (C) | replace stub (keep shapes) |
| `services/reports.js` | P6 (D) | replace stub (keep shapes) |
| `prompts/<name>.v*.txt`, `mocks/<name>*.json` | owner per table below | wording only; keep response keys/shapes |
| `prompts/README.md`, `prompts/samples/**` | P2 (B) | procedure, record table, samples |
| `pages/dev-ui.js` | every page task | only inside its own `[Pn]` section |
| `docs/PROGRESS.md` | everyone | append own entries only |
| Any other Common file | A only | bug fixes / approved contract changes on `main` |

Prompt/mock ownership: `diagnose`, `advice` → B (P1) · `checklist` → C (P3) · `environment`, `monthly-report` → D (P5/P6) · `character` → A.

### 9.4 Changing the Common interface
1. Don't edit directly. Post a **"계약 변경 제안"** in the team channel (what, why, affected pages).
2. Once all 4 agree, A merges a PR updating **this file (00_MAIN.md) first**.
3. A merges the Common code change as a separate PR; each page branch pulls `main` (`git pull origin main` or `git merge main`).
