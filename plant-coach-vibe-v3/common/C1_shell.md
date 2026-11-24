# [Common] C1 — App shell · router · common UI · Firebase connection

> Read with: `00_MAIN.md` (§4 folders, §5 contracts, §7 design). Spec: SPEC ch.1 app structure.
> Owner: A.

## 1. Goal
Build the app **skeleton**. No real screens yet, but after this session:
* `index.html` loads as the **main interface** with top bar · body · bottom nav,
* changing `#/path` **loads the page module and draws it** in the body,
* missing page files show a "준비 중" screen,
* logged-out users are sent to the login screen.

Later sessions only **drop page files into** this skeleton.

## 2. Prerequisites
* None (first session).
* Ask the user for the Firebase web config (`firebaseConfig`) and put it in `firebase-config.js`. If not available, use placeholders and show "Firebase 설정이 필요해요" when config is empty.
* App Check site key (from the AI Logic / App Check setup in the console) — if not available yet, leave empty; App Check init is skipped while empty (AI real mode then won't work, mock still works).

## 3. Files to create

### 3.1 `public/index.html` — ★ main interface
The **only HTML file**. Screens change only the content of `<main id="page">`.
* `<html lang="ko">`, `<meta charset="utf-8">`, `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`, `<meta name="theme-color" content="#5BA672">`, `<title>AI 반려식물 코치</title>`.
* Link only `css/base.css` and `css/components.css`. **Page CSS is attached by the router — don't add it here.**
* `<body>` (ids are used by other files — keep exactly):
  ```html
  <div id="app" class="app-shell">
    <header id="app-header"></header>      <!-- filled by layout.js -->
    <main id="page" tabindex="-1"></main>  <!-- router draws pages -->
    <nav id="app-nav" aria-label="주요 메뉴"></nav>
  </div>
  <div id="modal-root"></div>
  <div id="toast-root" aria-live="polite"></div>
  <div id="loading-root"></div>
  <noscript>이 앱은 자바스크립트가 필요해요.</noscript>
  <script type="module" src="js/app.js"></script>
  ```
* While first loading, `#page` contains "식물 친구를 깨우는 중이에요…" + small spinner (app.js clears it).

### 3.2 `public/css/base.css`
* `:root`: §7 color vars, `--radius: 16px`, `--shadow: 0 4px 16px rgba(47,58,51,.08)`, `--header-h: 56px`, `--nav-h: 64px`, `--space-1~5` (4/8/12/16/24px), font var.
* Small reset (`box-sizing: border-box`, no default margin, `img { max-width: 100% }`).
* `.app-shell`: max width 480px, centered, min-height 100dvh, bg `--color-bg`.
* `#app-header`: sticky top, height `--header-h`, title centered, notification icon right.
* `#app-nav`: fixed bottom, same width as shell, height `--nav-h` + `env(safe-area-inset-bottom)`. Hide class `.is-hidden`.
* `#page`: 16px side padding, bottom padding = nav height; smaller when nav hidden (`body.no-nav`).
* Utilities: `.stack`, `.row`, `.muted`, `.center`, `.hidden`, `.sr-only`.
* `@media (prefers-reduced-motion: reduce)`: disable all animation/transition.

### 3.3 `public/css/components.css`
Classes shared by `ui/components.js` and all pages, each with a Korean comment.
* Buttons: `.btn` + `.btn-primary` (green fill), `.btn-secondary` (green outline), `.btn-ghost` (text only), `.btn-block`, disabled state, min-height 44px.
* Card: `.card`, `.card-title`, `.card-sub`.
* Form: `.field`, `.label`, `.input`, `.select`, `.textarea`, `.field-error` (dark apricot text, not red), `.toggle` (checkbox switch).
* Chips/badges: `.chip`, `.chip.is-active`, `.badge` (count), `.tag` (status tag).
* Modal: `.modal-backdrop`, `.modal`, `.modal-title`, `.modal-body`, `.modal-actions` — bottom sheet style.
* Toast: `.toast`, `.toast-success`, `.toast-error` — bottom, above nav.
* Loading: `.loading-overlay`, `.spinner` (ideally a swaying sprout CSS animation).
* Gauge: `.gauge` — semicircle or bar, 0–100.
* Empty: `.empty-state`.

### 3.4 `public/js/core/firebase-config.js`
```js
// Firebase 콘솔 → 프로젝트 설정 → 내 앱 → 웹 앱 의 firebaseConfig 값을 붙여 넣으세요.
// 이 값은 공개되어도 괜찮은 값입니다. 데이터 보호는 firestore.rules와 App Check가 담당합니다.
export const firebaseConfig = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_PROJECT.firebaseapp.com',
  projectId: 'YOUR_PROJECT',
  appId: 'YOUR_APP_ID',
};
// App Check(reCAPTCHA) 사이트 키 — AI Logic 설정 때 만든 값. 비어 있으면 App Check를 건너뜀.
export const appCheckSiteKey = '';
export const isFirebaseConfigured = !firebaseConfig.apiKey.startsWith('YOUR_');
```

### 3.5 `public/js/core/firebase.js` — Firebase init (SDK version only here)
* Import the modular SDK from **official CDN URLs**; version only in top constant `FIREBASE_VERSION`. Use the number from the official Firebase docs' CDN example; if unsure, **ask the user** (no guessing). Modules: `firebase-app`, `firebase-auth`, `firebase-firestore`, `firebase-ai`, `firebase-app-check`.
* `initializeApp(firebaseConfig)` → `export const app, auth, db`.
* **App Check:** if `appCheckSiteKey` is set, initialize App Check with the reCAPTCHA provider exactly as in the official App Check web docs, **before** using AI. On `localhost`, set `self.FIREBASE_APPCHECK_DEBUG_TOKEN = true` before init (debug token is printed in the console → register it in Firebase console → App Check → Manage debug tokens). Comment this procedure in Korean.
* **AI:** `export const ai = getAI(app, { backend: new GoogleAIBackend() })` (Gemini Developer API). Wrap in try/catch; if it fails, export `null` and warn (mock mode must still work).
* Re-export commonly used functions so other files never need CDN URLs:
  * Firestore: `doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, collection, query, where, orderBy, limit, serverTimestamp, Timestamp, increment, writeBatch, runTransaction, onSnapshot, documentId`
  * Auth: `onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, updatePassword, EmailAuthProvider, reauthenticateWithCredential`
  * AI: `getGenerativeModel, ResponseModality`
* All files import like `import { db, doc, getDoc } from '../core/firebase.js'` — **only from this file**.

### 3.6 `public/js/core/routes.js`
Copy the §5.2 table into an array.
```js
export const routes = [
  { path: '/login', page: 'login.js' },
  { path: '/plants/:id/edit', page: 'plant-register.js' },
  // ...
  { path: '/dev', page: 'dev-ui.js' },              // 개발용 (배포 시 제거)
  { path: '/prompt-lab', page: 'prompt-lab.js' },   // 개발용 (배포 시 제거)
];
export const DEFAULT_AUTHED = '/main';
export const DEFAULT_GUEST = '/login';
```
* More specific paths (`/plants/:id/edit`) must match before less specific ones (`/plants`): sort, or use exact matching.

### 3.7 `public/js/core/router.js` — hash router
Exports: `startRouter()`, `navigate(path)`, `getCurrentPath()`, `consumeReturnTo()`.

On every `hashchange`:
1. Split path and query from `location.hash`. `#/report/2026-10?plant=abc` → path `/report/2026-10`, `params = { month: '2026-10', query: { plant: 'abc' } }`. Empty hash → default path by login state.
2. Match routes incl. `:vars`. No match → `not-ready.js`.
3. **Dynamic load** `import(\`../pages/${page}\`)`. Load fails (no file) → `not-ready.js` (console warning only).
4. **Auth check:** `requiresAuth` but no `store.get('user')` → save the full target hash (with query, e.g. `#/checklist?plant=abc`) to `sessionStorage.returnTo`, go `#/login`. Logged in and going to login/signup → `#/main`.
5. Run the previous page's cleanup fn (returned by render).
6. Attach CSS from page `styles` as `<link data-page-style>` (skip if already attached).
7. `layout.setTitle(title)`, `layout.setNavVisible(showNav !== false)`, `layout.setActiveNav(path)`.
8. `await page.render(container, params)`. On error: card "화면을 그리다 문제가 생겼어요" + "다시 시도" button, details in console.
9. Scroll to top, focus `#page`.
* Use a **render token** so a slow earlier render can't overwrite a newer page.
* `consumeReturnTo()`: return saved path and clear it (return to notification link after login).

### 3.8 `public/js/core/store.js`
Exactly §5.3. Simple `Map` + subscriber lists.
* `set('currentPlantId')` also saves to `localStorage['plantCoach.currentPlantId']`; read at start. Wrap `localStorage` in `try/catch`.
* `reset()` — clear all values on logout.

### 3.9 `public/js/core/startup.js` — post-login task list
Create section comments now; C3–C5 fill them (§5.10). After Common, this file is frozen.
```js
// 화면을 띄우기 전에 꼭 끝나야 하는 작업. redirect 경로를 반환하면 그리로 이동.
export async function runBlockingTasks(user) {
  let redirect = null;
  // [C3] 회원정보 불러오기
  // [C4] 식물 목록 불러오기, 식물이 없으면 redirect = '/plants/new'
  return redirect;
}

// 화면을 띄운 뒤 뒤에서 조용히 할 작업 (기다리지 않음)
export function runBackgroundTasks(user) {
  // [C5] 오늘의 체크리스트 만들기 + 새로 만들었으면 알림
  // [C5] 지난달 월간 리포트 만들기 + 새로 만들었으면 알림
  // [C5] 안 읽은 알림 수 → 상단 뱃지 (로그아웃 시 해제)
}
```
* Each task in its own `try/catch`; failures only `console.warn`.

### 3.10 `public/js/app.js` — ★ entry
1. If `isFirebaseConfigured` is false, show a setup-guide card in the body and stop.
2. `renderShell()` (layout.js) draws top bar and bottom nav.
3. `onAuthStateChanged(auth, async (fbUser) => { ... })`
   * Logged in: `store.set('user', { uid: fbUser.uid })` → `await runBlockingTasks()` → go to returned redirect, else `consumeReturnTo()` path, else if currently on login/signup → `/main` → `runBackgroundTasks()`.
   * Logged out: `store.reset()` → `/login` if on an auth-required screen.
   * Call `startRouter()` **once, after the first auth check** (prevents login-screen flash).
4. Global `unhandledrejection` → `toast('문제가 생겼어요. 다시 시도해 주세요.', 'error')`.

### 3.11 `public/js/ui/layout.js`
Exports: `renderShell()`, `setTitle(text)`, `setNavVisible(bool)`, `setActiveNav(path)`, `setBadge(count)`.
* Top bar: centered title, right 🔔 link (`#/notifications`) + count badge (hidden at 0, `99+` above 99).
* Bottom nav, 5 items (icon + label, `<a href>`):

  | Icon | Label | Link |
  | :--- | :--- | :--- |
  | 🏠 | 홈 | `#/main` |
  | ✅ | 체크리스트 | `#/checklist` |
  | 📅 | 캘린더 | `#/calendar` |
  | ☀️ | 환경 | `#/environment` |
  | 👤 | 내 정보 | `#/profile` |
* Item whose first path segment matches gets `.is-active` + `aria-current="page"`.

### 3.12 `public/js/ui/components.js`
Implement all §5.7 functions.
* `openModal({ title, body, actions, dismissible = true })`: draws in `#modal-root`, returns a **Promise** resolved with clicked `value`, then closes. If `dismissible`, backdrop click/ESC closes with `null`. If `false`, only buttons close it (Safe-Lock popup). Focus first button on open; restore previous focus on close.
* `body` accepts an HTML string or a DOM node.
* `choiceModal({ title, question, options, dismissible })`: options as vertical buttons; returns chosen string.
* `confirmModal(message, { okLabel = '확인', cancelLabel = '취소' })`.
* `toast(message, type)`: stacks; each disappears after 3s in order.
* `showLoading(message)` / `hideLoading()`: counted for nesting (closes only on last hide).
* `gauge(score)`: color steps (0–39 apricot, 40–69 light green, 70–100 green), HTML string.
* `emptyState({ icon, message, actionLabel, actionHref })` HTML string.

### 3.13 `public/js/utils/date.js`
All §5.8 functions. KST conversion via `Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' })` to get `YYYY-MM-DD`. `addDays`, `diffDays` convert date strings to noon (12:00) UTC to avoid boundary bugs. Also `daysInMonth(monthStr)`, `monthRange(monthStr)` → `{ start: 'YYYY-MM-01', end: 'YYYY-MM-<last>' }`, `toDateStr(timestamp)` (Firestore Timestamp → KST date).

### 3.14 `public/js/utils/dom.js`
* `html` tagged template: **auto-escapes** `${}` values. Arrays are joined; only values wrapped with `raw(str)` aren't escaped.
* `qs(sel, root)`, `qsa(sel, root)`, `on(root, eventName, selector, handler)` (delegation, returns remove fn).

### 3.15 `public/js/pages/not-ready.js`
`emptyState` with "🌱 이 화면은 아직 자라는 중이에요" + home button. `requiresAuth: false`, `title: '준비 중'`.

### 3.16 `public/js/pages/dev-ui.js` — dev component screen (`#/dev`)
Buttons, cards, toasts (3 types), modal, choiceModal, loading, gauges (20/55/90) all clickable on one screen. `requiresAuth: false`. Comment: remove from routes for release.
* C2 adds an AI/weather section, C5 shared test buttons + **per-page sections**, C6 a game-test section. Build the screen from `<section data-dev-section="...">` blocks so sections stay separate.

### 3.17 Others
* `firestore.rules`:
  ```text
  rules_version = '2';
  service cloud.firestore {
    match /databases/{database}/documents {
      match /users/{uid} {
        allow read, write: if request.auth != null && request.auth.uid == uid;
        match /{document=**} {
          allow read, write: if request.auth != null && request.auth.uid == uid;
        }
      }
    }
  }
  ```
  Top comment: "Firebase 콘솔 → Firestore → 규칙 탭에 붙여 넣고 게시".
* `firebase.json` (optional Hosting): `{ "hosting": { "public": "public", "ignore": ["**/.*"] } }` + Korean note in PROGRESS on how to deploy (`firebase deploy --only hosting`, needs Firebase CLI) — only for HTTPS phone tests/demo.
* `.gitignore`: `.DS_Store`, `.firebase/`, `*.local.md`.
* `docs/PROGRESS.md`: title `# 진행 기록` + C1 entry.

## 4. Files to modify
None.

## 5. Edge cases
* Empty Firebase config → setup card (app must not break).
* Unknown path → not-ready.
* Page render error → error card + retry.
* `localStorage` blocked (private mode) → silently ignore.
* Empty App Check key / AI init failure → app still runs (mock mode).

## 6. Don't
* Don't build real pages like login (C3).
* Don't build any server; no npm packages; no framework/bundler.

## 7. How to verify (tell the user)
ES modules don't run from `file://`. Use VS Code **Live Server** (right-click `public/index.html` → Open with Live Server) or `python -m http.server 5500 --directory public` → `http://localhost:5500`.

## 8. Done when
- [ ] Opening the app shows top bar and bottom nav with no console errors.
- [ ] In `#/dev`, toast · modal · choiceModal · loading · gauge all work; a `dismissible: false` modal doesn't close on backdrop click.
- [ ] Unknown path like `#/abc` shows "준비 중".
- [ ] Logged out, `#/main` redirects to `#/login` (not-ready shown there is fine for now).
- [ ] Current bottom-nav item is highlighted.
- [ ] Empty Firebase config shows the guide card.
- [ ] `today()` returns the Korean date (even before 9 AM).
- [ ] Every JS file has a header comment.
- [ ] `docs/PROGRESS.md` has the C1 entry.
