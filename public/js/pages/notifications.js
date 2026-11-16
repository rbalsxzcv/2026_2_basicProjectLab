/**
 * 파일: public/js/pages/notifications.js
 * 역할: 알림함 (#/notifications) — 앱 안 알림 목록, 안 읽음 표시, [모두 읽음], 브라우저 알림 카드
 *       알림 탭 → 읽음 처리 + 해당 화면으로 이동
 * 사용하는 파일: services/notifications.js, ui/components.js, utils/dom.js, utils/date.js,
 *               css/pages/notifications.css
 * 담당: P4
 *
 * ★ Firestore 는 services/notifications.js 에서만 접근. 이 화면은 불러와서 그림.
 * ★ 안 읽은 개수 뱃지(상단 🔔)는 core/startup.js 가 watchUnreadCount 로 관리 — 여기선 안 읽음.
 */

import { html, on } from '../utils/dom.js';
import { toast, emptyState } from '../ui/components.js';
import { listNotifications, markRead, markAllRead, requestBrowserPermission } from '../services/notifications.js';
import { toDateStr } from '../utils/date.js';

const ICONS = { CHECKLIST: '✅', MONTHLY_REPORT: '📄' };
const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

// ───────── 시간 표기 ─────────
// createdAt(Timestamp) → '방금' · 'n분 전' · 'n시간 전' · 'M월 D일'
function timeAgo(noti) {
  const created = noti?.createdAt;
  if (!created || typeof created.toMillis !== 'function') return '';
  const diff = Date.now() - created.toMillis();
  if (diff < MINUTE_MS) return '방금';
  if (diff < HOUR_MS) return `${Math.floor(diff / MINUTE_MS)}분 전`;
  if (diff < 24 * HOUR_MS) return `${Math.floor(diff / HOUR_MS)}시간 전`;
  // toDateStr: 한국 시간(Asia/Seoul) 기준 YYYY-MM-DD — 자정 전후 오차 방지
  const dateStr = toDateStr(created);
  const [, m, d] = dateStr.split('-');
  return `${Number(m)}월 ${Number(d)}일`;
}

export default {
  title: '알림',
  requiresAuth: true,
  showNav: true,
  styles: ['css/pages/notifications.css'],

  async render(container) {
    let alive = true;
    let busy = false; // [모두 읽음] 중복 클릭 방지

    function draw(notis) {
      const unread = notis.filter((n) => !n.read);

      container.innerHTML = html`
        <section class="notifications-page">
          <div class="noti-header">
            <p class="noti-header-title">알림함</p>
            <button type="button" class="btn btn-ghost btn-sm" data-mark-all ${unread.length === 0 ? 'disabled' : ''}>
              모두 읽음
            </button>
          </div>

          ${browserCard()}

          ${notis.length
            ? html`<ul class="noti-list">${notis.map(drawRow)}</ul>`
            : emptyState({ icon: '🔔', message: '아직 새 소식이 없어요' })}
        </section>
      `;
    }

    function drawRow(noti) {
      return html`
        <li>
          <button type="button" class="noti-row ${noti.read ? '' : 'is-unread'}" data-open="${noti.id}" data-link="${noti.link ?? ''}"
            aria-label="${noti.title} 알림 열기">
            <span class="noti-icon" aria-hidden="true">${ICONS[noti.type] ?? '🔔'}</span>
            <span class="noti-body">
              <span class="noti-title">${noti.title}</span>
              <span class="noti-text">${noti.body}</span>
              <span class="noti-time">${timeAgo(noti)}</span>
            </span>
          </button>
        </li>
      `;
    }

    // ───────── 브라우저 알림 카드 ─────────
    // 권한을 자동 물어보지 않습니다. 사용자가 [브라우저 알림 받기] 를 눌러야만 브라우저가 물어봐 줘요.
    function browserCard() {
      if (typeof Notification === 'undefined') return ''; // 미지원 브라우저 → 카드 숨김
      const permission = Notification.permission;
      if (permission === 'granted') {
        return html`
          <div class="card browser-card">
            <span class="browser-card-icon" aria-hidden="true">🔔</span>
            <p class="browser-card-text">브라우저 알림이 켜져 있어요. 알림을 만들 때 앱이 배경에 있으면 브라우저 알림도 보여요.</p>
          </div>
        `;
      }
      if (permission === 'denied') {
        return html`
          <div class="card browser-card">
            <span class="browser-card-icon" aria-hidden="true">🔕</span>
            <p class="browser-card-text">브라우저 설정에서 알림을 허용해 주세요.</p>
          </div>
        `;
      }
      // default: 아직 물어보지 않은 상태
      return html`
        <div class="card browser-card">
          <span class="browser-card-icon" aria-hidden="true">🔔</span>
          <div class="browser-card-text">
            앱이 열려 있는 동안 브라우저 알림을 받을 수 있어요.
            <button type="button" class="btn btn-secondary btn-sm" data-browser-allow style="margin-top: var(--space-2);">
              브라우저 알림 받기
            </button>
          </div>
        </div>
      `;
    }

    // ───────── 이벤트 ─────────
    const offs = [
      // 알림 탭 → 읽음 처리 → 링크로 이동 (실패 시 이동하지 않음)
      on(container, 'click', '[data-open]', async (event, el) => {
        const link = el.dataset.link;
        if (!link) return;
        try {
          await markRead(el.dataset.open);
          location.hash = link; // 성공 시에만 이동
        } catch (error) {
          console.warn('[notifications] 읽음 처리 실패', error);
          toast('목록을 갱신하지 못했어요. 다시 시도해 주세요.', 'error');
        }
      }),

      // 모두 읽음
      on(container, 'click', '[data-mark-all]', async () => {
        if (busy) return;
        busy = true;
        try {
          await markAllRead();
          await load(); // 읽음 상태로 전체 목록 + 카드 다시 그리기
        } catch (error) {
          console.warn('[notifications] 모두 읽음 실패', error);
          toast('처리를 하지 못했어요. 다시 시도해 주세요.', 'error');
        } finally {
          busy = false;
        }
      }),

      // 브라우저 알림 권한 받기 (버튼 클릭 시에만 브라우저가 권한을 물어봄)
      on(container, 'click', '[data-browser-allow]', async () => {
        const result = await requestBrowserPermission();
        if (result === 'granted') toast('브라우저 알림을 켰어요', 'success');
        else if (result === 'denied') toast('브라우저 설정에서 알림을 허용해 주세요');
        if (alive) load(); // 권한 결과로 카드가 바뀌므로 전체 다시 그리기
      }),
    ];

    // ───────── 로드 ─────────
    async function load() {
      if (!alive) return;
      let notis;
      try {
        notis = await listNotifications(30);
      } catch (error) {
        console.warn('[notifications] 알림 불러오기 실패', error);
        if (alive) {
          container.innerHTML = html`
            <section class="notifications-page">
              ${emptyState({
                icon: '🔔',
                message: '알림을 불러오지 못했어요.',
                actionLabel: '다시 시도',
                actionHref: '#/notifications',
              })}
            </section>
          `;
          toast('알림을 불러오지 못했어요. 다시 시도해 주세요.', 'error');
        }
        return;
      }
      if (!alive) return;
      draw(notis);
    }

    load();

    return () => {
      alive = false;
      offs.forEach((off) => off());
    };
  },
};
