# [Page] P4 — Notifications (in-app inbox + optional browser notifications)

> Read with: `00_MAIN.md` (§5.5 `notifications`, §5.10 startup), SPEC 1.1 entry paths. Spec: SPEC F-07, structure [알림 창의 체크리스트 창 클릭] → [체크리스트], [다음 달로 넘어가서 리포트 알람이 뜰 경우] → [월간 리포트].
> Owner: C. Branch: `feat/p4-notifications` (or same branch as P3).

## 1. Goal
* Two notification types:
  1. **Checklist:** today's checklist newly created → tap → `#/checklist?plant=id`
  2. **Monthly report:** last month's report newly created → tap → `#/report/YYYY-MM?plant=id`
* Default is the **in-app inbox** (top 🔔 + unread badge + list screen).
* If the user allows, show **browser notifications** while the app is open.
* **Device push when the app is closed (FCM)** needs a server → **optional**, only documented (§7).

## 2. Prerequisites
* **Common frozen.** `services/notifications.js` (C5 stub), `ui/layout.js` (`setBadge`), `core/startup.js` (already calls `notifyChecklistCreated`, `notifyReportCreated`, `watchUnreadCount`), `core/router.js` (`returnTo`).
* **Independent test:** checklist notifications work with the C5 checklist stub (it returns `created: true` once a day). Report notifications are tested via `#/dev` buttons (P6's reports stub returns `[]` until P6 merges — that's fine).

## 3. Files to create

### 3.1 `public/js/services/notifications.js` — **replace C5 stub with full version** (keep all names/args/returns)
```js
export async function createNotification({ key, type, title, body, link })
// doc id = key (dedupe). Already exists → do nothing. → true if newly created
export async function listNotifications(n = 30)          // newest first
export async function markRead(id)
export async function markAllRead()
export function watchUnreadCount(callback)               // onSnapshot, returns unsubscribe
export async function requestBrowserPermission()         // only on button click → 'granted' | 'denied' | 'unsupported'
export function showBrowserNotification({ title, body, link }) // only if permitted and tab in background
export async function notifyChecklistCreated(plant, checklist)
export async function notifyReportCreated({ plantId, month })
```
* **Key rule:** checklist `CHECKLIST_{YYYY-MM-DD}_{plantId}`, report `REPORT_{YYYY-MM}_{plantId}`.
* `notifyChecklistCreated`: `const { remaining } = summarize(checklist)` → `createNotification({ key: CHECKLIST_${today()}_${plant.id}, type: 'CHECKLIST', title: '오늘의 체크리스트가 준비됐어요', body: `${plant.name}${withJosa(plant.name, '와', '과')} 함께할 일 ${remaining}개가 기다려요`, link: `#/checklist?plant=${plant.id}` })` → if newly created, `showBrowserNotification(...)`.
* `notifyReportCreated`: plant name from store `plants` → `createNotification({ key: REPORT_${month}_${plantId}, type: 'MONTHLY_REPORT', title/body: warm Korean copy (e.g. "{이름}의 {n}월 이야기가 도착했어요"), link: `#/report/${month}?plant=${plantId}` })` → browser notification if new.
* `withJosa(name, '와', '과')`: tiny final-consonant (받침) helper **inside this file** (not in `utils/dom.js`).
* `showBrowserNotification`: `new Notification(title, { body, icon: 'assets/characters/default.svg' })`; click → `window.focus()` + `location.hash = link`. Skip if `document.visibilityState === 'visible'` (in-app inbox is enough).
* Notifications older than 30 days are hidden in `listNotifications` results only (not deleted).

### 3.2 `public/js/pages/notifications.js` (`#/notifications`)
* `title: '알림'`, `styles: ['css/pages/notifications.css']`.
* **Layout:**
  1. Top-right text button [모두 읽음].
  2. List — each: icon (✅ checklist / 📄 report), title, body, time ("방금", "3시간 전", "11월 1일"); unread = light green bg + dot.
  3. Tap → `markRead` → `location.hash = link`.
  4. **Device notification card:** current permission. Before allowing: [브라우저 알림 받기] → `requestBrowserPermission()`. Denied → "브라우저 설정에서 알림을 허용해 주세요". Unsupported → hide card.
  5. Empty → `emptyState({ icon: '🔔', message: '아직 새 소식이 없어요' })`.

### 3.3 `public/css/pages/notifications.css`
List rows (40px icon circle), unread mark, settings card.

## 4. Files to modify (owned scope)
* `public/js/services/notifications.js` — replace stub (§3.1).
* `public/js/pages/dev-ui.js` — **inside `[P4]` section only**: [알림 모두 지우기], [테스트 알림 만들기(체크리스트·리포트 각 1개)] (report one via `notifyReportCreated({ plantId: current, month: prevMonth(thisMonth()) })`).
* **Don't edit Common:** `startup.js` wiring, `ui/layout.js` 🔔/`setBadge`, `core/router.js` `returnTo` (query preserved) exist already. If they misbehave, **tell A**; A fixes on `main` and you pull.

**All files in this task:** `services/notifications.js`, `pages/notifications.js`, `css/pages/notifications.css`, `[P4]` section of `dev-ui.js`.

## 5. Edge cases
* Opening the app several times a day → still max 1 checklist notification per plant per day (key).
* Notification's plant deleted → checklist/report screens show "식물을 찾을 수 없어요" and switch to the current plant (if a page lacks this, propose it to that page's owner).
* Browser permission requested **only on button click** (no auto prompt).

## 6. Don't
* §7 FCM only if the team decides; not in this session's default scope.
* No nagging/guilt copy ("아직 안 했어요!", "식물이 힘들어해요").

## 7. (Optional) Device push when the app is closed — FCM
Only in a separate session if the team decides; confirm prerequisites with the user first.
1. Firebase console → Project settings → Cloud Messaging → generate **Web Push certificate (VAPID key)**.
2. `public/firebase-messaging-sw.js` service worker (must be at site root); client gets a token → save to `users/{uid}/fcmTokens/{token}`.
3. Scheduled sending (daily checklist, monthly report on the 1st) needs a server or Cloud Functions + Blaze plan — this breaks `00_MAIN.md` §3 "no backend", so MAIN must be updated by team agreement first.
4. iPhone gets web push only if the user **adds the web app to the home screen** → plan demos on Android / desktop Chrome.

## 8. Done when
- [ ] Logging in without today's checklist creates a checklist notification and a number on 🔔.
- [ ] Refresh doesn't create the same notification again.
- [ ] Tapping goes to that plant's checklist and marks it read.
- [ ] [테스트 알림 만들기] report notification opens the right month's report link (after P6 merges, deleting last month's `monthlyReports` doc and logging in again creates it automatically).
- [ ] Opening a notification link while logged out goes to that screen after login.
- [ ] After allowing via [브라우저 알림 받기], with the tab in background, a new notification shows a browser notification.
- [ ] [모두 읽음] clears the badge.
- [ ] No Common file names/shapes changed (`git diff main --stat`).
- [ ] `docs/PROGRESS.md` has the P4 entry + whether optional FCM was skipped.
