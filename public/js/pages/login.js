/**
 * 파일: public/js/pages/login.js
 * 역할: 로그인 화면 (#/login)
 * 사용하는 파일: services/auth.js, utils/dom.js
 *
 * ★ 로그인에 성공하면 app.js 의 로그인 감시가 알아서 다음 화면으로 보냅니다. 여기서 navigate 하지 않음.
 */

import { html } from '../utils/dom.js';
import { logIn, authErrorMessage } from '../services/auth.js';

export default {
  title: '로그인',
  requiresAuth: false,
  showNav: false,
  styles: ['css/pages/auth.css'],

  async render(container) {
    container.innerHTML = html`
      <section class="auth-page">
        <div class="auth-logo">
          <div class="auth-logo-icon" aria-hidden="true">🌱</div>
          <h2 class="auth-logo-title">AI 반려식물 코치</h2>
          <p class="auth-logo-sub">초보 집사도 괜찮아요. AI 코치가 함께할게요.</p>
        </div>

        <form class="auth-form card stack" novalidate>
          <div class="field">
            <label class="label" for="login-id">아이디</label>
            <input class="input" id="login-id" name="loginId" type="text" autocomplete="username"
              autocapitalize="none" spellcheck="false" inputmode="latin" required />
          </div>

          <div class="field">
            <label class="label" for="login-pw">비밀번호</label>
            <div class="password-wrap">
              <input class="input" id="login-pw" name="password" type="password" autocomplete="current-password" required />
              <button type="button" class="btn btn-ghost btn-sm password-toggle" data-toggle-pw aria-label="비밀번호 보기">보기</button>
            </div>
          </div>

          <p class="field-error" data-form-error role="alert"></p>

          <button type="submit" class="btn btn-primary btn-block" data-submit>로그인</button>
        </form>

        <p class="auth-switch">처음이신가요? <a href="#/signup"><strong>회원가입</strong></a></p>
      </section>
    `;

    const form = container.querySelector('form');
    const idInput = form.querySelector('#login-id');
    const pwInput = form.querySelector('#login-pw');
    const submitBtn = form.querySelector('[data-submit]');
    const errorEl = form.querySelector('[data-form-error]');
    const toggleBtn = form.querySelector('[data-toggle-pw]');

    // 아이디는 자동으로 소문자로
    idInput.addEventListener('input', () => {
      const lower = idInput.value.toLowerCase();
      if (lower !== idInput.value) idInput.value = lower;
    });

    toggleBtn.addEventListener('click', () => {
      const show = pwInput.type === 'password';
      pwInput.type = show ? 'text' : 'password';
      toggleBtn.textContent = show ? '숨기기' : '보기';
      toggleBtn.setAttribute('aria-label', show ? '비밀번호 숨기기' : '비밀번호 보기');
    });

    let pending = false;
    // submit: 엔터를 누르거나 로그인 버튼을 누르면 실행됩니다.
    form.addEventListener('submit', async (event) => {
      event.preventDefault(); // 페이지가 새로고침되는 기본 동작 막기
      if (pending) return;

      const loginId = idInput.value.trim();
      const password = pwInput.value;
      if (!loginId || !password) {
        errorEl.textContent = '아이디와 비밀번호를 입력해 주세요.';
        return;
      }

      pending = true;
      submitBtn.disabled = true;
      submitBtn.textContent = '로그인 중…';
      errorEl.textContent = '';
      try {
        await logIn(loginId, password);
        // 성공 → app.js 가 화면을 바꿉니다.
      } catch (error) {
        errorEl.textContent = authErrorMessage(error);
        pending = false;
        submitBtn.disabled = false;
        submitBtn.textContent = '로그인';
      }
    });
  },
};
