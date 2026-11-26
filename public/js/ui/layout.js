/**
 * 파일: public/js/ui/layout.js
 * 역할: 상단 바(제목, 알림 🔔 + 뱃지)와 하단 메뉴(5개)를 그리고 상태를 바꿈
 * 사용하는 파일: utils/dom.js
 *
 * 내보내는 함수: renderShell(), setTitle(text), setNavVisible(bool), setActiveNav(path), setBadge(count)
 */

import { html } from '../utils/dom.js';

const NAV_ITEMS = [
  { icon: '🏠', label: '홈', href: '#/main' },
  { icon: '✅', label: '체크리스트', href: '#/checklist' },
  { icon: '📅', label: '캘린더', href: '#/calendar' },
  { icon: '☀️', label: '환경', href: '#/environment' },
  { icon: '👤', label: '내 정보', href: '#/profile' },
];

// 첫 번째 경로 칸만 꺼냄. '#/report/2026-10' → 'report'
function firstSegment(pathOrHref) {
  return String(pathOrHref).replace(/^#/, '').split('?')[0].split('/').filter(Boolean)[0] ?? '';
}

export function renderShell() {
  const header = document.getElementById('app-header');
  const nav = document.getElementById('app-nav');

  header.innerHTML = html`
    <div class="app-header-inner">
      <h1 class="app-title" data-app-title>AI 반려식물 코치</h1>
      <a class="app-noti" href="#/notifications" aria-label="알림함">
        <span aria-hidden="true">🔔</span>
        <span class="badge hidden" data-app-badge></span>
      </a>
    </div>
  `;

  nav.innerHTML = html`
    <ul class="nav-list">
      ${NAV_ITEMS.map(
        (item) => html`
          <li>
            <a class="nav-item" href="${item.href}" data-nav="${firstSegment(item.href)}">
              <span class="nav-icon" aria-hidden="true">${item.icon}</span>
              <span>${item.label}</span>
            </a>
          </li>
        `,
      )}
    </ul>
  `;
}

export function setTitle(text) {
  const el = document.querySelector('[data-app-title]');
  if (el) el.textContent = text || 'AI 반려식물 코치';
  document.title = text ? `${text} · AI 반려식물 코치` : 'AI 반려식물 코치';
}

export function setNavVisible(visible) {
  document.getElementById('app-nav')?.classList.toggle('is-hidden', !visible);
  document.body.classList.toggle('no-nav', !visible);
}

export function setActiveNav(path) {
  const current = firstSegment(path);
  for (const link of document.querySelectorAll('#app-nav [data-nav]')) {
    const active = link.dataset.nav === current;
    link.classList.toggle('is-active', active);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
}

// 안 읽은 알림 수 뱃지. 0이면 숨기고, 99보다 크면 '99+'
export function setBadge(count) {
  const badge = document.querySelector('[data-app-badge]');
  if (!badge) return;
  const n = Number(count) || 0;
  badge.textContent = n > 99 ? '99+' : String(n);
  badge.classList.toggle('hidden', n <= 0);
  badge.closest('a')?.setAttribute('aria-label', n > 0 ? `알림함, 안 읽은 알림 ${n}개` : '알림함');
}
