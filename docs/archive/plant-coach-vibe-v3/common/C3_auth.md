# [Common] C3 — Login · signup · profile

> Read with: `00_MAIN.md` (§5.3 store, §5.5 `users/{uid}`, §5.9 ID rules). Spec: SPEC F-00, structure [로그인]·[회원가입]·[회원정보].
> Owner: A.

## 1. Goal
* **Sign up / log in / log out** with ID + password.
* Nickname and **home info (region, home type)** saved at signup to `users/{uid}`; viewable and editable on the profile screen.
* Region is later used for weather (`core/weather.js`).

## 2. Prerequisites
* C1: `core/firebase.js`, `core/router.js`, `core/store.js`, `core/startup.js`, `ui/components.js`, `utils/dom.js`.
* Email/password sign-in enabled in Firebase console and `firestore.rules` published (confirm with user).

## 3. Files to create

### 3.1 `public/data/regions.json`
* 17 provinces/metros. Item: `{ "id": "seoul", "name": "서울특별시", "lat": <lat>, "lon": <lon> }` — approx. coordinates of each provincial office (2 decimals enough).
* `core/weather.js` reads these coordinates. **Don't rename keys.**
* Also `homeTypes`: `["아파트", "단독주택", "원룸·오피스텔", "기숙사", "기타"]`.

### 3.2 `public/js/services/auth.js`
```js
export function toAuthEmail(loginId)          // 'abc' → 'abc@plantcoach.example'
export function validateLoginId(loginId)      // lowercase/digits 4–20 → error message or null
export function validatePassword(pw)          // 6+ → error message or null
export async function signUp({ loginId, password, nickname, region, homeType }) // create account + users doc
export async function logIn(loginId, password)
export async function logOut()                // signOut + store.reset() + '#/login'
export async function changePassword(currentPw, newPw) // reauthenticate then update
export function authErrorMessage(error)       // Firebase error code → Korean
```
* `signUp`: after `createUserWithEmailAndPassword`, call `users.createProfile()`. If profile save fails, throw a distinguishable error so UI can show "가입은 되었지만 정보 저장에 실패했어요. 내 정보에서 다시 저장해 주세요."
* `authErrorMessage` mapping (minimum):

  | Code | Message |
  | :--- | :--- |
  | `auth/invalid-credential`, `auth/wrong-password`, `auth/user-not-found` | 아이디 또는 비밀번호가 맞지 않아요. |
  | `auth/email-already-in-use` | 이미 사용 중인 아이디예요. |
  | `auth/weak-password` | 비밀번호는 6자 이상으로 해 주세요. |
  | `auth/too-many-requests` | 시도가 많았어요. 잠시 후 다시 해 주세요. |
  | `auth/network-request-failed` | 인터넷 연결을 확인해 주세요. |
  | `auth/requires-recent-login` | 보안을 위해 현재 비밀번호를 다시 입력해 주세요. |
  | other | 잠시 문제가 생겼어요. 다시 시도해 주세요. |

### 3.3 `public/js/services/users.js`
```js
export async function createProfile(uid, { loginId, nickname, region, homeType })
export async function getProfile(uid)          // null if missing
export async function updateProfile(uid, { nickname, home })  // only these two fields
export async function loadCurrentUserProfile() // read by store uid → store.set('user', {...})
```
* `createProfile` = `setDoc` `{ loginId, nickname, home: { region, homeType }, createdAt: serverTimestamp() }`.
* After `updateProfile`, update store `user` too (other screens update immediately).
* **No password field anywhere.**

### 3.4 `public/js/pages/login.js` (`#/login`)
* `requiresAuth: false`, `showNav: false`, `title: '로그인'`, `styles: ['css/pages/auth.css']`.
* Top → bottom:
  1. Logo area: 🌱 + "AI 반려식물 코치" + "초보 집사도 괜찮아요. AI 코치가 함께할게요."
  2. ID input (`autocomplete="username"`, auto-lowercase).
  3. Password (`autocomplete="current-password"`, show/hide toggle).
  4. [로그인] (`.btn-primary .btn-block`) — disabled while pending, text "로그인 중…".
  5. "처음이신가요? **회원가입**" → `#/signup`.
* Enter submits (`<form>`, `preventDefault` on `submit`).
* After success, navigation is handled by **app.js auth watcher** — don't `navigate` here.
* On failure show `authErrorMessage` under the form.

### 3.5 `public/js/pages/signup.js` (`#/signup`)
* `requiresAuth: false`, `showNav: false`, `title: '회원가입'`, `styles: ['css/pages/auth.css']`.
* Fields (SPEC F-00):

  | Field | Type | Check |
  | :--- | :--- | :--- |
  | 아이디 | text | `validateLoginId` (live) |
  | 비밀번호 | password | `validatePassword` |
  | 비밀번호 확인 | password | must match |
  | 닉네임 | text | 1–12 chars, trimmed |
  | 거주지역 | select (`regions.json`) | required; small text below "날씨와 습도를 분석하는 데 쓰여요" |
  | 자택 종류 | select (`homeTypes`) | optional, default "선택 안 함" |
* Live results in `.field-error` under each field. [가입하기] enabled only when all valid.
* On success the auth watcher takes over (no plants → plant registration after C4).
* "이미 계정이 있나요? **로그인**" link.

### 3.6 `public/js/pages/profile.js` (`#/profile`)
* `requiresAuth: true`, `title: '내 정보'`, `styles: ['css/pages/profile.css']`.
* Layout:
  1. **Profile card:** nickname (large), ID (small, read-only), join date.
  2. **Home card:** region, home type — [수정] turns them into selects in-place with [저장]/[취소].
  3. **Nickname edit:** pencil button on profile card → input.
  4. **Menu list:** "🪴 내 식물 관리" (→ `#/plants`), "🔑 비밀번호 변경" (modal: current · new · confirm), "📄 월간 리포트" (→ `#/report`).
  5. **Logout** (`.btn-ghost`) → `confirmModal('로그아웃할까요?')` → `logOut()`.
* Save success → `toast('저장했어요', 'success')`.
* Link to other screens even if not built yet (router shows not-ready).

### 3.7 `public/css/pages/auth.css`, `public/css/pages/profile.css`
* Login/signup: vertically centered, generous top margin for logo, light green gradient bg.
* Profile: 12px card gap; menu list rows with an arrow (›).

## 4. Files to modify
* `public/js/core/startup.js` — **[C3] section only**:
  ```js
  // [C3] 회원정보 불러오기
  await loadCurrentUserProfile();
  ```
  No profile doc (save failed at signup) → `redirect = '/profile'` + toast guide.

## 5. Edge cases
* Signed up but profile save failed → message above + profile screen can save again (if home info empty, show the input form immediately).
* Lock buttons against double submit.
* `regions.json` load fails → instead of select show "지역 정보를 불러오지 못했어요. 새로고침해 주세요."

## 6. Don't
* No password reset, social login, email verification.
* No plant files (C4).

## 7. Done when
- [ ] New signup creates `ID@plantcoach.example` in Authentication and `users/{uid}` (nickname, home, no password) in Firestore.
- [ ] Signing up with the same ID shows "이미 사용 중인 아이디예요."
- [ ] Wrong password shows a Korean error.
- [ ] Login persists after refresh; visiting login/signup while logged in returns to main.
- [ ] Changing nickname/region/home type on profile persists in Firestore and after refresh.
- [ ] After password change, login with the new password works.
- [ ] Logout goes to login; Back doesn't show profile.
- [ ] `docs/PROGRESS.md` has the C3 entry.
