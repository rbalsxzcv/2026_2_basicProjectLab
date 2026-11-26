/**
 * 파일: public/js/pages/profile.js
 * 역할: 내 정보 화면 (#/profile) — 닉네임·집 정보 보기/수정, 비밀번호 변경, 메뉴, 로그아웃
 * 사용하는 파일: core/store.js, core/router.js, services/users.js, services/auth.js, ui/components.js, utils/dom.js, utils/date.js
 */

import { html, on } from '../utils/dom.js';
import { toast, openModal, confirmModal } from '../ui/components.js';
import { store } from '../core/store.js';
import { navigate } from '../core/router.js';
import { getProfile, createProfile, updateProfile, loadCurrentUserProfile } from '../services/users.js';
import { logOut, changePassword, validatePassword, authErrorMessage, currentLoginId } from '../services/auth.js';
import { toDateStr } from '../utils/date.js';

async function loadRegionData() {
  const response = await fetch('data/regions.json');
  if (!response.ok) throw new Error('regions.json 불러오기 실패');
  return response.json();
}

function joinDateText(createdAt) {
  const dateStr = toDateStr(createdAt);
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  return `${y}년 ${m}월 ${d}일 가입`;
}

function regionSelect(regionData, selected, name = 'region') {
  if (!regionData) return html`<p class="field-error">지역 정보를 불러오지 못했어요. 새로고침해 주세요.</p>`;
  return html`
    <select class="select" name="${name}" aria-label="거주지역">
      <option value="">지역을 골라 주세요</option>
      ${regionData.regions.map((r) => html`<option value="${r.name}" ${r.name === selected ? 'selected' : ''}>${r.name}</option>`)}
    </select>
  `;
}

function homeTypeSelect(regionData, selected, name = 'homeType') {
  return html`
    <select class="select" name="${name}" aria-label="자택 종류">
      <option value="">선택 안 함</option>
      ${(regionData?.homeTypes ?? []).map((t) => html`<option value="${t}" ${t === selected ? 'selected' : ''}>${t}</option>`)}
    </select>
  `;
}

export default {
  title: '내 정보',
  requiresAuth: true,
  showNav: true,
  styles: ['css/pages/profile.css'],

  async render(container) {
    const uid = store.get('user')?.uid;
    let alive = true; // 화면을 떠나면 false → 늦게 끝난 작업이 화면을 건드리지 않게
    let regionData = null;
    let profile = null;
    let editingNick = false;
    let editingHome = false;
    let saving = false;

    try {
      [regionData, profile] = await Promise.all([loadRegionData().catch(() => null), getProfile(uid)]);
    } catch (error) {
      console.warn('[profile] 회원정보 불러오기 실패', error);
      toast('회원정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.', 'error');
    }
    if (!alive) return;

    // 집 정보가 비어 있으면 바로 입력 상태로
    if (profile && !profile.home?.region) editingHome = true;

    function draw() {
      if (!profile) {
        drawMissingProfile();
        return;
      }
      const home = profile.home ?? {};
      container.innerHTML = html`
        <section class="profile-page stack">
          <div class="card profile-card">
            ${editingNick
              ? html`
                  <form class="row nick-form" data-form="nick">
                    <input class="input" name="nickname" maxlength="12" value="${profile.nickname ?? ''}" aria-label="닉네임" />
                    <button type="submit" class="btn btn-primary btn-sm">저장</button>
                    <button type="button" class="btn btn-ghost btn-sm" data-action="cancel-nick">취소</button>
                  </form>
                `
              : html`
                  <div class="row profile-name-row">
                    <h2 class="profile-nickname">${profile.nickname || '이름 없는 집사'}</h2>
                    <button type="button" class="btn btn-ghost btn-sm" data-action="edit-nick" aria-label="닉네임 수정">✏️</button>
                  </div>
                `}
            <p class="muted">아이디 ${profile.loginId || currentLoginId()}</p>
            <p class="muted">${joinDateText(profile.createdAt)}</p>
          </div>

          <div class="card">
            <div class="row profile-card-head">
              <h3 class="card-title">🏠 우리 집 정보</h3>
              ${editingHome ? '' : html`<button type="button" class="btn btn-ghost btn-sm" data-action="edit-home">수정</button>`}
            </div>
            ${editingHome
              ? html`
                  <form class="stack" data-form="home">
                    <div class="field">
                      <span class="label">거주지역</span>
                      ${regionSelect(regionData, home.region)}
                      <p class="muted">날씨와 습도를 분석하는 데 쓰여요</p>
                    </div>
                    <div class="field">
                      <span class="label">자택 종류</span>
                      ${homeTypeSelect(regionData, home.homeType)}
                    </div>
                    <div class="row">
                      <button type="submit" class="btn btn-primary btn-sm">저장</button>
                      ${home.region ? html`<button type="button" class="btn btn-ghost btn-sm" data-action="cancel-home">취소</button>` : ''}
                    </div>
                  </form>
                `
              : html`
                  <dl class="info-list">
                    <div><dt>거주지역</dt><dd>${home.region || '미입력'}</dd></div>
                    <div><dt>자택 종류</dt><dd>${home.homeType || '선택 안 함'}</dd></div>
                  </dl>
                `}
          </div>

          <ul class="card menu-list">
            <li><a class="menu-row" href="#/plants"><span>🪴 내 식물 관리</span><span aria-hidden="true">›</span></a></li>
            <li><button type="button" class="menu-row" data-action="change-pw"><span>🔑 비밀번호 변경</span><span aria-hidden="true">›</span></button></li>
            <li><a class="menu-row" href="#/report"><span>📄 월간 리포트</span><span aria-hidden="true">›</span></a></li>
          </ul>

          <button type="button" class="btn btn-ghost btn-block" data-action="logout">로그아웃</button>
        </section>
      `;
    }

    // 가입 때 회원정보 저장에 실패한 경우: 여기서 다시 저장
    function drawMissingProfile() {
      container.innerHTML = html`
        <section class="profile-page stack">
          <div class="card stack">
            <h2 class="card-title">회원정보를 저장해 주세요</h2>
            <p class="card-sub">가입은 되었지만 정보 저장에 실패했어요. 아래 내용을 다시 저장해 주세요.</p>
            <form class="stack" data-form="create">
              <div class="field">
                <label class="label" for="pf-nick">닉네임</label>
                <input class="input" id="pf-nick" name="nickname" maxlength="12" />
              </div>
              <div class="field">
                <span class="label">거주지역</span>
                ${regionSelect(regionData, '')}
                <p class="muted">날씨와 습도를 분석하는 데 쓰여요</p>
              </div>
              <div class="field">
                <span class="label">자택 종류</span>
                ${homeTypeSelect(regionData, '')}
              </div>
              <button type="submit" class="btn btn-primary btn-block">저장하기</button>
            </form>
          </div>
          <button type="button" class="btn btn-ghost btn-block" data-action="logout">로그아웃</button>
        </section>
      `;
    }

    async function guardedSave(task) {
      if (saving) return;
      saving = true;
      try {
        await task();
        toast('저장했어요', 'success');
      } catch (error) {
        console.warn('[profile] 저장 실패', error);
        toast('저장하지 못했어요. 잠시 후 다시 시도해 주세요.', 'error');
      } finally {
        saving = false;
        if (alive) draw();
      }
    }

    async function openPasswordModal() {
      // 같은 입력 칸(DOM)을 다시 쓰면, 문제가 있어 모달을 다시 열어도 입력한 값이 남아 있습니다.
      const body = document.createElement('div');
      body.className = 'stack';
      body.innerHTML = html`
        <div class="field">
          <label class="label" for="pw-cur">현재 비밀번호</label>
          <input class="input" id="pw-cur" type="password" autocomplete="current-password" />
        </div>
        <div class="field">
          <label class="label" for="pw-new">새 비밀번호</label>
          <input class="input" id="pw-new" type="password" autocomplete="new-password" placeholder="6자 이상" />
        </div>
        <div class="field">
          <label class="label" for="pw-new2">새 비밀번호 확인</label>
          <input class="input" id="pw-new2" type="password" autocomplete="new-password" />
        </div>
        <p class="field-error" data-pw-error></p>
      `;
      const errorEl = body.querySelector('[data-pw-error]');

      while (alive) {
        const ok = await openModal({
          title: '비밀번호 변경',
          body,
          actions: [
            { label: '변경하기', value: true, variant: 'primary' },
            { label: '취소', value: false, variant: 'ghost' },
          ],
        });
        if (!ok) return;

        const current = body.querySelector('#pw-cur').value;
        const next = body.querySelector('#pw-new').value;
        const next2 = body.querySelector('#pw-new2').value;
        const problem = !current
          ? '현재 비밀번호를 입력해 주세요.'
          : validatePassword(next) ?? (next !== next2 ? '새 비밀번호가 서로 달라요.' : null);
        if (problem) {
          errorEl.textContent = problem;
          continue;
        }

        try {
          await changePassword(current, next);
          toast('비밀번호를 바꿨어요', 'success');
          return;
        } catch (error) {
          errorEl.textContent =
            error?.code === 'auth/invalid-credential' || error?.code === 'auth/wrong-password'
              ? '현재 비밀번호가 맞지 않아요.'
              : authErrorMessage(error);
        }
      }
    }

    // 이벤트 위임: 화면을 다시 그려도 container 에 한 번만 걸어 두면 됩니다.
    const offClick = on(container, 'click', '[data-action]', async (event, el) => {
      const action = el.dataset.action;
      if (action === 'edit-nick') {
        editingNick = true;
        draw();
        container.querySelector('input[name="nickname"]')?.focus();
      } else if (action === 'cancel-nick') {
        editingNick = false;
        draw();
      } else if (action === 'edit-home') {
        editingHome = true;
        draw();
      } else if (action === 'cancel-home') {
        editingHome = false;
        draw();
      } else if (action === 'change-pw') {
        openPasswordModal();
      } else if (action === 'logout') {
        if (await confirmModal('로그아웃할까요?', { okLabel: '로그아웃' })) {
          try {
            await logOut();
          } catch (error) {
            console.warn('[profile] 로그아웃 실패', error);
            toast('로그아웃하지 못했어요. 다시 시도해 주세요.', 'error');
          }
        }
      }
    });

    const offSubmit = on(container, 'submit', 'form[data-form]', async (event, form) => {
      event.preventDefault();
      const kind = form.dataset.form;

      if (kind === 'nick') {
        const nickname = form.nickname.value.trim();
        if (!nickname || nickname.length > 12) {
          toast('닉네임은 1~12자로 해 주세요.', 'error');
          return;
        }
        await guardedSave(async () => {
          await updateProfile(uid, { nickname });
          profile = { ...profile, nickname };
          editingNick = false;
        });
      } else if (kind === 'home') {
        const region = form.region?.value ?? '';
        if (!region) {
          toast('거주지역을 골라 주세요.', 'error');
          return;
        }
        const home = { region, homeType: form.homeType.value };
        await guardedSave(async () => {
          await updateProfile(uid, { home });
          profile = { ...profile, home };
          editingHome = false;
        });
      } else if (kind === 'create') {
        const nickname = form.nickname.value.trim();
        const region = form.region?.value ?? '';
        if (!nickname || nickname.length > 12) {
          toast('닉네임은 1~12자로 해 주세요.', 'error');
          return;
        }
        if (!region) {
          toast('거주지역을 골라 주세요.', 'error');
          return;
        }
        await guardedSave(async () => {
          await createProfile(uid, { loginId: currentLoginId(), nickname, region, homeType: form.homeType.value });
          profile = await loadCurrentUserProfile();
        });
        // 가입 직후라 식물이 없으면 원래 가야 했던 식물 등록 화면으로 안내
        if (alive && profile && (store.get('plants') ?? []).length === 0) navigate('/plants/new');
      }
    });

    draw();

    return () => {
      alive = false;
      offClick();
      offSubmit();
    };
  },
};
