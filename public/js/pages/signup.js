/**
 * 파일: public/js/pages/signup.js
 * 역할: 회원가입 화면 (#/signup) — 아이디, 비밀번호, 닉네임, 거주지역, 자택 종류
 * 사용하는 파일: services/auth.js, ui/components.js, utils/dom.js, public/data/regions.json
 *
 * ★ 가입에 성공하면 app.js 의 로그인 감시가 다음 화면(식물 등록)으로 보냅니다.
 */

import { html } from '../utils/dom.js';
import { toast } from '../ui/components.js';
import { signUp, validateLoginId, validatePassword, authErrorMessage, ProfileSaveError } from '../services/auth.js';

async function loadRegionData() {
  const response = await fetch('data/regions.json');
  if (!response.ok) throw new Error('regions.json 불러오기 실패');
  return response.json();
}

function validateNickname(value) {
  const trimmed = value.trim();
  if (!trimmed) return '닉네임을 입력해 주세요.';
  if (trimmed.length > 12) return '닉네임은 12자 이내로 해 주세요.';
  return null;
}

export default {
  title: '회원가입',
  requiresAuth: false,
  showNav: false,
  styles: ['css/pages/auth.css'],

  async render(container) {
    let regionData = null;
    try {
      regionData = await loadRegionData();
    } catch (error) {
      console.warn('[signup] 지역 정보 불러오기 실패', error);
    }

    container.innerHTML = html`
      <section class="auth-page">
        <div class="auth-logo auth-logo-small">
          <div class="auth-logo-icon" aria-hidden="true">🌱</div>
          <h2 class="auth-logo-title">반가워요!</h2>
          <p class="auth-logo-sub">몇 가지만 알려 주시면 바로 시작할 수 있어요.</p>
        </div>

        <form class="auth-form card stack" novalidate>
          <div class="field">
            <label class="label" for="su-id">아이디</label>
            <input class="input" id="su-id" name="loginId" type="text" autocomplete="username"
              autocapitalize="none" spellcheck="false" placeholder="영문 소문자·숫자 4~20자" />
            <p class="field-error" data-error="loginId"></p>
          </div>

          <div class="field">
            <label class="label" for="su-pw">비밀번호</label>
            <input class="input" id="su-pw" name="password" type="password" autocomplete="new-password" placeholder="6자 이상" />
            <p class="field-error" data-error="password"></p>
          </div>

          <div class="field">
            <label class="label" for="su-pw2">비밀번호 확인</label>
            <input class="input" id="su-pw2" name="password2" type="password" autocomplete="new-password" />
            <p class="field-error" data-error="password2"></p>
          </div>

          <div class="field">
            <label class="label" for="su-nick">닉네임</label>
            <input class="input" id="su-nick" name="nickname" type="text" maxlength="12" placeholder="12자 이내" />
            <p class="field-error" data-error="nickname"></p>
          </div>

          <div class="field">
            <label class="label" for="su-region">거주지역</label>
            ${regionData
              ? html`
                  <select class="select" id="su-region" name="region">
                    <option value="">지역을 골라 주세요</option>
                    ${regionData.regions.map((r) => html`<option value="${r.name}">${r.name}</option>`)}
                  </select>
                `
              : html`<p class="field-error">지역 정보를 불러오지 못했어요. 새로고침해 주세요.</p>`}
            <p class="muted">날씨와 습도를 분석하는 데 쓰여요</p>
            <p class="field-error" data-error="region"></p>
          </div>

          <div class="field">
            <label class="label" for="su-home">자택 종류 <span class="muted">(선택)</span></label>
            <select class="select" id="su-home" name="homeType">
              <option value="">선택 안 함</option>
              ${(regionData?.homeTypes ?? []).map((t) => html`<option value="${t}">${t}</option>`)}
            </select>
          </div>

          <p class="field-error" data-form-error role="alert"></p>

          <button type="submit" class="btn btn-primary btn-block" data-submit disabled>가입하기</button>
        </form>

        <p class="auth-switch">이미 계정이 있나요? <a href="#/login"><strong>로그인</strong></a></p>
      </section>
    `;

    const form = container.querySelector('form');
    const submitBtn = form.querySelector('[data-submit]');
    const formError = form.querySelector('[data-form-error]');
    const touched = new Set(); // 사용자가 한 번이라도 입력한 칸만 오류를 보여 줌

    function values() {
      return {
        loginId: form.loginId.value.trim(),
        password: form.password.value,
        password2: form.password2.value,
        nickname: form.nickname.value,
        region: form.region?.value ?? '',
        homeType: form.homeType.value,
      };
    }

    function errorsOf(v) {
      return {
        loginId: validateLoginId(v.loginId),
        password: validatePassword(v.password),
        password2: v.password2 !== v.password ? '비밀번호가 서로 달라요.' : null,
        nickname: validateNickname(v.nickname),
        region: v.region ? null : '거주지역을 골라 주세요.',
      };
    }

    // 입력할 때마다 칸 아래에 결과를 보여 주고, 모두 맞으면 [가입하기] 를 켭니다.
    function refresh() {
      const errors = errorsOf(values());
      for (const [key, message] of Object.entries(errors)) {
        const el = form.querySelector(`[data-error="${key}"]`);
        if (el) el.textContent = touched.has(key) ? message ?? '' : '';
      }
      submitBtn.disabled = pending || !regionData || Object.values(errors).some(Boolean);
    }

    form.loginId.addEventListener('input', () => {
      const lower = form.loginId.value.toLowerCase();
      if (lower !== form.loginId.value) form.loginId.value = lower;
    });

    form.addEventListener('input', (event) => {
      if (event.target.name) touched.add(event.target.name);
      if (event.target.name === 'password' && form.password2.value) touched.add('password2');
      refresh();
    });
    form.addEventListener('change', (event) => {
      if (event.target.name) touched.add(event.target.name);
      refresh();
    });

    let pending = false;
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (pending) return;
      const v = values();
      if (Object.values(errorsOf(v)).some(Boolean)) {
        Object.keys(errorsOf(v)).forEach((k) => touched.add(k));
        refresh();
        return;
      }

      pending = true;
      submitBtn.disabled = true;
      submitBtn.textContent = '가입하는 중…';
      formError.textContent = '';
      try {
        await signUp({
          loginId: v.loginId,
          password: v.password,
          nickname: v.nickname.trim(),
          region: v.region,
          homeType: v.homeType,
        });
        toast('가입을 환영해요! 🌱', 'success');
        // 다음 화면 이동은 app.js 가 처리
      } catch (error) {
        if (error instanceof ProfileSaveError) {
          // 계정은 만들어져 로그인 상태 → app.js 가 내 정보 화면으로 보냄
          toast(error.message, 'error');
          return;
        }
        formError.textContent = authErrorMessage(error);
        pending = false;
        submitBtn.textContent = '가입하기';
        refresh();
      }
    });

    refresh();
  },
};
