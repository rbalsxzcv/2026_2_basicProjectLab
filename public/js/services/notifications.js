/**
 * 파일: public/js/services/notifications.js
 * 역할: 앱 안 알림함 — users/{uid}/notifications/{notiId}  (+ 선택: 브라우저 알림)
 *       - createNotification: 문서 ID(=key) 로 중복 제거해서 알림 만들기
 *       - watchUnreadCount: 안 읽은 개수를 실시간 감시 (상단 🔔 뱃지)
 *       - notifyChecklistCreated / notifyReportCreated: 시작 작업(startup.js)이 부름
 * 사용하는 파일: core/firebase.js, core/store.js, utils/date.js, services/checklists.js (summarize)
 * 담당: P4
 *
 * ★ 함수 이름·인자·반환 형식은 C5 뼈대 그대로 유지.
 * ★ 브라우저 알림은 "탭이 화면에 없을 때만" 띄웁니다 (앱이 보여 있으면 알림함으로 충분).
 * ★ 30일보다 오래된 알림은 목록에서만 숨기고, 삭제하지는 않습니다.
 */

import {
  db,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  getDocs,
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  writeBatch,
} from '../core/firebase.js';
import { store } from '../core/store.js';
import { today, addDays, toDateStr } from '../utils/date.js';
import { summarize } from './checklists.js';

const HIDE_AFTER_DAYS = 30;

function currentUid() {
  const uid = store.get('user')?.uid;
  if (!uid) throw new Error('로그인이 필요해요');
  return uid;
}

function notificationsCol() {
  return collection(db, 'users', currentUid(), 'notifications');
}

function notificationRef(key) {
  return doc(db, 'users', currentUid(), 'notifications', key);
}

// key: 같은 알림을 두 번 만들지 않기 위한 고유 값 (문서 ID 로 사용)
// 반환: 새로 만들었으면 true, 이미 있었으면 false
export async function createNotification({ key, type, title, body, link }) {
  const ref = notificationRef(key);
  // 같은 키면 같은 문서 → 새로고침·다른 탭에서 여러 번 불러도 알림은 하나
  const snap = await getDoc(ref);
  if (snap.exists()) return false;
  await setDoc(ref, { type, title, body, link, read: false, createdAt: serverTimestamp() });
  return true;
}

// 최신 알림 n개 (30일 이전은 결과에서만 숨김 — 삭제는 안 함)
export async function listNotifications(n = 30) {
  const q = query(notificationsCol(), orderBy('createdAt', 'desc'), limit(n));
  const snap = await getDocs(q);
  const cutoff = addDays(today(), -HIDE_AFTER_DAYS);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((noti) => {
      const created = toDateStr(noti.createdAt);
      return created ? created >= cutoff : true;
    });
}

export async function markRead(id) {
  await updateDoc(notificationRef(id), { read: true });
}

export async function markAllRead() {
  const q = query(notificationsCol(), where('read', '==', false));
  const snap = await getDocs(q);
  if (snap.empty) return;
  const batch = writeBatch(db);
  for (const d of snap.docs) batch.update(d.ref, { read: true });
  await batch.commit();
}

// 안 읽은 알림 수가 바뀔 때마다 callback(count). 반환: 감시를 멈추는 함수
export function watchUnreadCount(callback) {
  const q = query(notificationsCol(), where('read', '==', false));
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.length),
    (error) => console.warn('[notifications] 알림 감시 실패', error),
  );
}

// 반환: 'granted' | 'denied' | 'default' | 'unsupported'
// ★ 브라우저가 "사용자가 막 눌러야" 권한을 물어봐 주므로, 버튼 클릭 시에만 호출
export async function requestBrowserPermission() {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.requestPermission();
}

// 탭이 화면에 없을 때만 브라우저 알림 띄우기. 클릭 → 앱으로 돌아와 해당 화면으로 이동
export function showBrowserNotification({ title, body, link }) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  if (document.visibilityState === 'visible') return; // 앱이 보여 있으면 알림함으로 충분
  const noti = new Notification(title, { body, icon: 'assets/characters/default.svg' });
  noti.onclick = () => {
    window.focus();
    if (link) location.hash = link; // link 는 이미 '#/checklist?plant=abc' 형태
    noti.close();
  };
}

// 시작 작업(startup.js)이 부름: 오늘 체크리스트를 새로 만들었을 때
export async function notifyChecklistCreated(plant, checklist) {
  const { remaining } = summarize(checklist);
  const created = await createNotification({
    key: `CHECKLIST_${today()}_${plant.id}`,
    type: 'CHECKLIST',
    title: '오늘의 체크리스트가 준비됐어요',
    body: `${plant.name}${withJosa(plant.name, '와', '과')} 함께할 일 ${remaining}개가 기다려요`,
    link: `#/checklist?plant=${plant.id}`,
  });
  if (created) {
    showBrowserNotification({
      title: '오늘의 체크리스트가 준비됐어요',
      body: `${plant.name}${withJosa(plant.name, '와', '과')} 함께할 일 ${remaining}개가 기다려요`,
      link: `#/checklist?plant=${plant.id}`,
    });
  }
}

// 시작 작업(startup.js)이 부름: 지난달 리포트를 새로 만들었을 때
// plantId: 문자열(식물 id) 또는 식물 변수(호환용) — 둘 다 수용
export async function notifyReportCreated({ plantId, month }) {
  const id = typeof plantId === 'string' ? plantId : (plantId?.id ?? '');
  const plant = (store.get('plants') ?? []).find((p) => p.id === id);
  const name = plant?.name ?? '내 식물';
  const monthNum = Number(month?.slice(5)) || 0;
  const body = '함께한 달의 기록을 정리했어요. 쉴 때 편하게 읽어 보세요.';
  const created = await createNotification({
    key: `REPORT_${month}_${id}`,
    type: 'MONTHLY_REPORT',
    title: `${name}의 ${monthNum}월 이야기가 도착했어요`,
    body,
    link: `#/report/${month}?plant=${id}`,
  });
  if (created) {
    showBrowserNotification({
      title: `${name}의 ${monthNum}월 이야기가 도착했어요`,
      body,
      link: `#/report/${month}?plant=${id}`,
    });
  }
}

// ───────── 작은 도우미 ─────────

// 마지막 음절의 받침(종성)이 있는지 정확히 계산:
// 한글 음절 코드 = AC00 + (초성×21 + 중성)×28 + 종성 → 28 로 나눈 나머지가 0 이면 받침 없음
function hasBatchim(str) {
  const ch = String(str).charCodeAt(String(str).length - 1);
  if (ch < 0xac00 || ch > 0xd7a3) return false; // 한글 음절이 아니면 없음
  return (ch - 0xac00) % 28 !== 0;
}

// '몬스테라' 와 → '몬스테라와', '산세베리아' 과 → '산세베리아과' 처럼 붙여 주기
function withJosa(name, ja, geoeul) {
  return hasBatchim(name) ? geoeul : ja;
}
