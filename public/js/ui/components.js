/**
 * 파일: public/js/ui/components.js
 * 역할: 모든 화면이 함께 쓰는 공용 UI (토스트, 모달, 선택 모달, 로딩, 게이지, 빈 화면)
 * 사용하는 파일: utils/dom.js, css/components.css
 *
 * ★ 브라우저 기본 alert(), confirm(), prompt() 는 쓰지 말고 이 파일의 함수를 쓰세요.
 */

import { html } from '../utils/dom.js';

// ───────── 토스트 ─────────

const TOAST_MS = 3000;

// type: 'info' | 'success' | 'error'
export function toast(message, type = 'info') {
  const root = document.getElementById('toast-root');
  if (!root) return;
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.setAttribute('role', type === 'error' ? 'alert' : 'status');
  el.textContent = message;
  root.appendChild(el);

  // 3초 뒤 서서히 사라짐 (먼저 뜬 것부터 차례로 사라짐)
  setTimeout(() => {
    el.classList.add('is-leaving');
    setTimeout(() => el.remove(), 300);
  }, TOAST_MS);
}

// ───────── 모달 ─────────

/**
 * 모달 열기. 누른 버튼의 value 로 결과가 정해지는 Promise 를 돌려줍니다.
 * @param {object} options
 * @param {string} options.title
 * @param {string|Node} options.body  html`` 문자열 또는 DOM 요소
 * @param {{label:string, value:any, variant?:'primary'|'secondary'|'ghost'}[]} options.actions
 * @param {boolean} options.dismissible  false 면 배경 클릭·ESC 로 닫히지 않음 (Safe-Lock 팝업)
 * @returns {Promise<any>}  누른 버튼의 value, 배경/ESC 로 닫으면 null
 */
export function openModal({ title = '', body = '', actions, dismissible = true } = {}) {
  const root = document.getElementById('modal-root');
  const buttons = actions?.length ? actions : [{ label: '확인', value: true, variant: 'primary' }];
  const previousFocus = document.activeElement;

  // Promise: "나중에 결과가 정해지는 값". resolve(값)을 부르면 await 하던 쪽으로 값이 전달됩니다.
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';

    const titleId = `modal-title-${Date.now()}`;
    backdrop.innerHTML = html`
      <div class="modal" role="dialog" aria-modal="true" ${title ? html`aria-labelledby="${titleId}"` : ''}>
        ${title ? html`<h2 class="modal-title" id="${titleId}">${title}</h2>` : ''}
        <div class="modal-body"></div>
        <div class="modal-actions">
          ${buttons.map(
            (action, index) => html`
              <button type="button" class="btn btn-block btn-${action.variant ?? 'secondary'}" data-index="${index}">
                ${action.label}
              </button>
            `,
          )}
        </div>
      </div>
    `;

    const bodyEl = backdrop.querySelector('.modal-body');
    if (body instanceof Node) bodyEl.appendChild(body);
    else bodyEl.innerHTML = String(body ?? '');

    let closed = false;
    function close(value) {
      if (closed) return;
      closed = true;
      document.removeEventListener('keydown', onKey);
      backdrop.remove();
      if (previousFocus && typeof previousFocus.focus === 'function') previousFocus.focus();
      resolve(value);
    }

    function onKey(event) {
      // 여러 모달이 겹쳐 있으면 맨 위 모달만 반응
      if (root.lastElementChild !== backdrop) return;
      if (event.key === 'Escape' && dismissible) close(null);
    }

    backdrop.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-index]');
      if (button && backdrop.contains(button)) {
        close(buttons[Number(button.dataset.index)].value);
        return;
      }
      if (event.target === backdrop && dismissible) close(null);
    });
    document.addEventListener('keydown', onKey);

    root.appendChild(backdrop);
    backdrop.querySelector('button[data-index]')?.focus();
  });
}

// 예/아니요 확인 → true / false
export async function confirmModal(message, { okLabel = '확인', cancelLabel = '취소', title = '' } = {}) {
  const result = await openModal({
    title,
    body: html`<p>${message}</p>`,
    actions: [
      { label: okLabel, value: true, variant: 'primary' },
      { label: cancelLabel, value: false, variant: 'ghost' },
    ],
  });
  return result === true;
}

// 여러 보기 중 하나 고르기 → 고른 문자열 (닫으면 null)
export function choiceModal({ title = '', question = '', options = [], dismissible = true } = {}) {
  return openModal({
    title,
    body: question ? html`<p>${question}</p>` : '',
    actions: options.map((option, index) => ({
      label: option,
      value: option,
      variant: index === 0 ? 'primary' : 'secondary',
    })),
    dismissible,
  });
}

// ───────── 로딩 ─────────

// 여러 곳에서 동시에 showLoading 을 불러도, 마지막 hideLoading 때만 닫히도록 횟수를 셉니다.
let loadingCount = 0;

export function showLoading(message = '잠시만 기다려 주세요…') {
  loadingCount++;
  const root = document.getElementById('loading-root');
  if (!root) return;
  let overlay = root.querySelector('.loading-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'loading-overlay';
    overlay.setAttribute('role', 'status');
    overlay.innerHTML = html`<div class="spinner" aria-hidden="true"></div><p class="loading-message"></p>`;
    root.appendChild(overlay);
  }
  overlay.querySelector('.loading-message').textContent = message;
}

export function hideLoading({ force = false } = {}) {
  loadingCount = force ? 0 : Math.max(0, loadingCount - 1);
  if (loadingCount > 0) return;
  document.querySelector('#loading-root .loading-overlay')?.remove();
}

// ───────── 게이지 · 빈 화면 (HTML 문자열을 돌려줌) ─────────

// 0~100 점수 막대. 0~39 살구색, 40~69 연두, 70~100 초록
export function gauge(score, { label = '점수' } = {}) {
  const value = Math.max(0, Math.min(100, Math.round(Number(score) || 0)));
  const level = value < 40 ? 'is-low' : value < 70 ? 'is-mid' : 'is-high';
  return html`
    <div class="gauge ${level}" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${value}" aria-label="${label}">
      <div class="gauge-label"><span>${label}</span><strong>${value}</strong></div>
      <div class="gauge-track"><div class="gauge-fill" style="width: ${value}%"></div></div>
    </div>
  `;
}

export function emptyState({ icon = '🌱', message = '', actionLabel = '', actionHref = '' } = {}) {
  return html`
    <div class="empty-state">
      <div class="empty-state-icon" aria-hidden="true">${icon}</div>
      <p class="empty-state-message">${message}</p>
      ${actionLabel && actionHref ? html`<a class="btn btn-primary" href="${actionHref}">${actionLabel}</a>` : ''}
    </div>
  `;
}
