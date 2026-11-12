/**
 * 파일: public/js/services/notifications.js
 * 역할: 앱 안 알림함 — users/{uid}/notifications/{notiId}  (+ 선택: 브라우저 알림)
 * 사용하는 파일: (P4 에서 core/firebase.js, core/store.js 등을 사용)
 * 담당: C5 (뼈대) → P4 (완성)
 *
 * 이 파일은 P4가 완성한다. 함수 이름·인자·반환 형식은 바꾸지 않는다.
 *
 * ── 지금(뼈대) 동작 ──  아무것도 하지 않음 (알림 0개, 뱃지 0)
 * 문서 모양 (00_MAIN §5.5): { type: 'CHECKLIST'|'MONTHLY_REPORT', title, body, link, read, createdAt }
 */

// key: 같은 알림을 두 번 만들지 않기 위한 고유 값 (예: 'checklist-<plantId>-2026-11-12')
// 반환: 새로 만들었으면 true, 이미 있었으면 false
export async function createNotification({ key, type, title, body, link }) {
  return false;
}

// 최신 알림 n개
export async function listNotifications(n = 30) {
  return [];
}

export async function markRead(id) {}

export async function markAllRead() {}

// 안 읽은 알림 수가 바뀔 때마다 callback(count). 반환: 감시를 멈추는 함수
export function watchUnreadCount(callback) {
  callback(0);
  return () => {};
}

// 반환: 'granted' | 'denied' | 'default' | 'unsupported'
export async function requestBrowserPermission() {
  return 'unsupported';
}

export function showBrowserNotification({ title, body, link }) {}

// 시작 작업(startup.js)이 부름: 오늘 체크리스트를 새로 만들었을 때
export async function notifyChecklistCreated(plant, checklist) {}

// 시작 작업(startup.js)이 부름: 지난달 리포트를 새로 만들었을 때
export async function notifyReportCreated({ plantId, month }) {}
