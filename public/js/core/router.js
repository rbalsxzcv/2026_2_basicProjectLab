/**
 * 파일: public/js/core/router.js
 * 역할: 해시 라우터 — 주소(#/경로)가 바뀌면 페이지 모듈을 불러와 <main id="page"> 에 그립니다.
 * 사용하는 파일: core/routes.js, core/store.js, ui/layout.js, utils/dom.js
 *
 * 내보내는 함수: startRouter(), navigate(path), getCurrentPath(), consumeReturnTo()
 *              (+ getCurrentPageInfo(): app.js 가 로그아웃 때 현재 화면이 로그인 필요 화면인지 확인)
 */

import { routes, DEFAULT_AUTHED, DEFAULT_GUEST, GUEST_ONLY_PATHS } from './routes.js';
import { store } from './store.js';
import { setTitle, setNavVisible, setActiveNav } from '../ui/layout.js';
import { html } from '../utils/dom.js';

const RETURN_TO_KEY = 'returnTo';

let started = false;
let renderToken = 0; // 화면을 그릴 때마다 1씩 증가. 느린 옛 화면이 새 화면을 덮어쓰지 않게 막습니다.
let cleanup = null; // 이전 화면이 돌려준 정리 함수
let currentInfo = { path: '', requiresAuth: false };
let intercept = null; // app.js 가 넘겨주는 "화면 가로채기" 함수 (Firebase 설정 전 안내 화면 등)

// ───────── 주소 해석 ─────────

// '#/report/2026-10?plant=abc' → { path: '/report/2026-10', query: { plant: 'abc' } }
function parseHash(hash = location.hash) {
  const withoutHash = hash.replace(/^#/, '');
  const [rawPath, rawQuery = ''] = withoutHash.split('?');
  let path = rawPath || '';
  if (path && !path.startsWith('/')) path = '/' + path;
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);

  const query = {};
  // URLSearchParams: '?a=1&b=2' 같은 문자열을 쉽게 읽게 해 주는 브라우저 기본 도구
  for (const [key, value] of new URLSearchParams(rawQuery)) query[key] = value;
  return { path, query };
}

function splitSegments(path) {
  return path.split('/').filter(Boolean);
}

// 경로가 routes 의 패턴과 맞는지 확인하고, 맞으면 { route, vars } 반환
function matchRoute(path) {
  const segments = splitSegments(path);
  let best = null;

  for (const route of routes) {
    const pattern = splitSegments(route.path);
    if (pattern.length !== segments.length) continue;

    const vars = {};
    let staticCount = 0;
    let ok = true;
    for (let i = 0; i < pattern.length; i++) {
      if (pattern[i].startsWith(':')) {
        vars[pattern[i].slice(1)] = decodeURIComponent(segments[i]);
      } else if (pattern[i] === segments[i]) {
        staticCount++;
      } else {
        ok = false;
        break;
      }
    }
    // 고정 글자가 더 많이 맞는 경로가 우선 (예: '/plants/new' > '/plants/:id')
    if (ok && (!best || staticCount > best.staticCount)) best = { route, vars, staticCount };
  }
  return best;
}

// ───────── 내보내는 함수 ─────────

export function getCurrentPath() {
  return parseHash().path;
}

export function getCurrentPageInfo() {
  return { ...currentInfo };
}

// navigate('/main') 또는 navigate('#/checklist?plant=abc')
// replace: true 면 방문 기록을 남기지 않음 (뒤로 가기 했을 때 다시 돌아오지 않게)
export function navigate(path, { replace = false } = {}) {
  const target = '#' + String(path).replace(/^#/, '');
  if (location.hash === target) {
    // 같은 주소면 hashchange 가 일어나지 않으므로 직접 다시 그림
    if (started) handleRoute();
    return;
  }
  if (replace) {
    history.replaceState(null, '', target);
    if (started) handleRoute();
  } else {
    location.hash = target; // → hashchange 이벤트 → handleRoute()
  }
}

// 로그인 전에 가려던 주소를 꺼내고 지웁니다. (알림 링크로 들어왔다가 로그인한 경우 등)
export function consumeReturnTo() {
  try {
    const saved = sessionStorage.getItem(RETURN_TO_KEY);
    sessionStorage.removeItem(RETURN_TO_KEY);
    return saved || null;
  } catch {
    return null;
  }
}

// options.intercept(path) 가 true 를 돌려주면 라우터는 그 화면을 그리지 않습니다.
export function startRouter(options = {}) {
  if (started) return;
  started = true;
  intercept = options.intercept ?? null;
  window.addEventListener('hashchange', () => handleRoute());
  handleRoute();
}

// ───────── 화면 그리기 ─────────

function saveReturnTo(hash) {
  try {
    sessionStorage.setItem(RETURN_TO_KEY, hash);
  } catch {
    /* 무시 */
  }
}

// 페이지 모듈 불러오기. 파일이 없거나 불러오기에 실패하면 null
async function loadPage(file) {
  try {
    // import(): 필요한 순간에 파일을 불러오는 "동적 import". 결과의 default 가 페이지 객체입니다.
    const mod = await import(`../pages/${file}`);
    return mod.default ?? null;
  } catch (error) {
    console.warn(`[router] 페이지 파일을 불러오지 못했어요: pages/${file}`, error);
    return null;
  }
}

async function handleRoute() {
  const token = ++renderToken;
  const container = document.getElementById('page');
  let { path, query } = parseHash();

  // 1) 빈 주소 → 로그인 상태에 따라 기본 경로
  if (!path || path === '/') {
    navigate(store.get('user') ? DEFAULT_AUTHED : DEFAULT_GUEST, { replace: true });
    return;
  }

  if (intercept && intercept(path)) {
    currentInfo = { path, requiresAuth: false };
    return;
  }

  // 2) 경로 찾기
  const matched = matchRoute(path);

  // 3) 페이지 파일 불러오기 (없으면 not-ready)
  let page = matched ? await loadPage(matched.route.page) : null;
  if (token !== renderToken) return; // 그사이 다른 주소로 이동함
  const isFallback = !page;
  if (isFallback) page = await loadPage('not-ready.js');
  if (token !== renderToken || !page) return;

  // 4) 로그인 확인
  //    - 표에 있는 경로인데 파일이 아직 없으면(준비 중) 로그인 필요로 취급
  //    - 표에 없는 경로(#/abc)는 로그인 없이 "준비 중" 표시
  const requiresAuth = isFallback ? Boolean(matched) : page.requiresAuth !== false;
  const user = store.get('user');
  if (requiresAuth && !user) {
    saveReturnTo(location.hash);
    navigate(DEFAULT_GUEST, { replace: true });
    return;
  }
  if (user && GUEST_ONLY_PATHS.includes(path)) {
    navigate(DEFAULT_AUTHED, { replace: true });
    return;
  }

  // 5) 이전 화면 정리
  runCleanup();
  currentInfo = { path, requiresAuth };

  // 6) 페이지 CSS 붙이기 (이미 붙어 있으면 건너뜀)
  for (const href of page.styles ?? []) attachStyle(href);

  // 7) 상단 바 · 하단 메뉴
  setTitle(page.title ?? '');
  setNavVisible(page.showNav !== false);
  setActiveNav(path);

  // 8) 그리기
  const params = { ...(matched?.vars ?? {}), query };
  container.innerHTML = '';
  try {
    const result = await page.render(container, params);
    if (token !== renderToken) {
      // 그리는 사이 다른 화면으로 넘어감 → 방금 만든 화면의 정리 함수만 실행
      if (typeof result === 'function') result();
      return;
    }
    cleanup = typeof result === 'function' ? result : null;
  } catch (error) {
    console.error('[router] 화면을 그리다 문제가 생겼어요', path, error);
    if (token !== renderToken) return;
    showRenderError(container);
  }

  // 9) 맨 위로 스크롤 + 본문에 초점 (화면 읽기 프로그램 사용자 배려)
  window.scrollTo(0, 0);
  container.focus({ preventScroll: true });
}

function runCleanup() {
  if (!cleanup) return;
  try {
    cleanup();
  } catch (error) {
    console.warn('[router] 이전 화면 정리 중 문제', error);
  }
  cleanup = null;
}

function attachStyle(href) {
  const exists = [...document.querySelectorAll('link[data-page-style]')].some(
    (link) => link.getAttribute('href') === href,
  );
  if (exists) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  link.dataset.pageStyle = '';
  document.head.appendChild(link);
}

function showRenderError(container) {
  container.innerHTML = html`
    <section class="card error-card stack center">
      <p class="empty-state-icon" aria-hidden="true">🌱</p>
      <p class="card-title">화면을 그리다 문제가 생겼어요</p>
      <p class="card-sub">잠시 후 다시 시도해 주세요.</p>
      <button type="button" class="btn btn-primary" data-retry>다시 시도</button>
    </section>
  `;
  container.querySelector('[data-retry]').addEventListener('click', () => handleRoute());
}
