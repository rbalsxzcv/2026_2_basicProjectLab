/**
 * 파일: public/js/app.js
 * 역할: 앱 시작점 — Firebase 설정 확인 → 셸 그리기 → 로그인 상태 감시 → 라우터 시작
 * 사용하는 파일: core/firebase-config.js, core/firebase.js, core/router.js, core/store.js,
 *               core/startup.js, ui/layout.js, ui/components.js
 */

import { isFirebaseConfigured } from './core/firebase-config.js';
import { auth, onAuthStateChanged } from './core/firebase.js';
import { startRouter, navigate, getCurrentPath, getCurrentPageInfo, consumeReturnTo } from './core/router.js';
import { GUEST_ONLY_PATHS, DEFAULT_AUTHED, DEFAULT_GUEST } from './core/routes.js';
import { store } from './core/store.js';
import { runBlockingTasks, runBackgroundTasks } from './core/startup.js';
import { renderShell } from './ui/layout.js';
import { toast } from './ui/components.js';
import { html } from './utils/dom.js';

let routerStarted = false;

// 라우터 시작 전이면 주소만 바꿔 두고(깜빡임 방지), 시작 후면 실제로 이동
function goTo(path) {
  if (routerStarted) navigate(path, { replace: true });
  else history.replaceState(null, '', '#' + String(path).replace(/^#/, ''));
}

function startRouterOnce(options) {
  if (routerStarted) return;
  routerStarted = true;
  startRouter(options);
}

// Firebase 설정이 비어 있을 때 보여 주는 안내 카드
function renderSetupGuide(container) {
  container.innerHTML = html`
    <section class="card setup-card stack">
      <p class="card-title">🔧 Firebase 설정이 필요해요</p>
      <ol>
        <li>Firebase 콘솔에서 프로젝트와 웹 앱을 만들어요.</li>
        <li><code>public/js/core/firebase-config.js</code> 의 <code>firebaseConfig</code> 값을 채워요.</li>
        <li>Authentication → 이메일/비밀번호 로그인을 켜요.</li>
        <li>Firestore 를 만들고 <code>firestore.rules</code> 내용을 규칙 탭에 게시해요.</li>
        <li>저장하고 이 화면을 새로고침해요.</li>
      </ol>
      <p class="card-sub">자세한 방법은 저장소 <code>README.md</code> 의 "Firebase 프로젝트" 절에 있어요.</p>
      <a class="btn btn-secondary" href="#/dev">Firebase 없이 공용 UI 시험해 보기 (#/dev)</a>
    </section>
  `;
}

function main() {
  // 어디서든 처리되지 않은 비동기 오류가 생기면 부드럽게 알려 줌 (자세한 내용은 콘솔)
  window.addEventListener('unhandledrejection', (event) => {
    console.error('[app] 처리되지 않은 오류', event.reason);
    toast('문제가 생겼어요. 다시 시도해 주세요.', 'error');
  });

  renderShell();

  // 1) Firebase 설정이 비어 있으면 안내 카드를 보여 주고 멈춤.
  //    단, 공용 UI 시험 화면(#/dev)만은 Firebase 없이도 열 수 있게 합니다.
  if (!isFirebaseConfigured) {
    startRouterOnce({
      intercept(path) {
        if (path === '/dev') return false;
        document.body.classList.add('no-nav');
        document.getElementById('app-nav').classList.add('is-hidden');
        renderSetupGuide(document.getElementById('page'));
        return true;
      },
    });
    return;
  }

  // 2) 로그인 상태 감시. 로그인·로그아웃할 때마다, 그리고 앱을 처음 열 때 한 번 실행됩니다.
  onAuthStateChanged(auth, async (fbUser) => {
    if (fbUser) {
      // ── 로그인됨 ──
      store.set('user', { uid: fbUser.uid });

      let redirect = null;
      try {
        // await: 이 작업(회원정보·식물 목록 불러오기)이 끝날 때까지 기다립니다.
        redirect = await runBlockingTasks(fbUser);
      } catch (error) {
        console.warn('[app] 시작 작업 실패', error);
      }

      const returnTo = consumeReturnTo();
      const current = getCurrentPath();
      if (redirect) goTo(redirect);
      else if (returnTo) goTo(returnTo);
      else if (!current || current === '/' || GUEST_ONLY_PATHS.includes(current)) goTo(DEFAULT_AUTHED);

      // 앱을 처음 열 때만 라우터를 시작합니다.
      // (로그인 화면에서 로그인한 경우엔 이미 돌고 있으므로 위 goTo 가 화면을 바꿈)
      startRouterOnce();

      runBackgroundTasks(store.get('user'));
    } else {
      // ── 로그아웃됨 ──
      store.reset();
      if (routerStarted) {
        // 로그인이 필요한 화면에 있었다면 로그인 화면으로
        if (getCurrentPageInfo().requiresAuth) navigate(DEFAULT_GUEST, { replace: true });
      } else {
        // 첫 로그인 확인이 끝난 "뒤에" 라우터를 시작 → 로그인 화면이 잠깐 번쩍이는 문제 방지
        startRouterOnce();
      }
    }
  });
}

main();
