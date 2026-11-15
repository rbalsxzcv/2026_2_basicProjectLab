/**
 * 파일: public/js/utils/date.js
 * 역할: 한국 시간(Asia/Seoul) 기준 날짜 계산 도우미 (00_MAIN §5.8)
 * 사용하는 파일: 없음
 * 담당: C1
 *
 * ★ 날짜는 항상 'YYYY-MM-DD' 문자열, 월은 'YYYY-MM' 문자열로 다룹니다.
 * ★ new Date().toISOString().slice(0, 10) 은 절대 쓰지 마세요.
 *   (UTC 기준이라 한국 아침 9시 전에는 "어제" 날짜가 나옵니다)
 */

// Intl.DateTimeFormat: 시간대를 지정해서 날짜를 글자로 바꿔 주는 브라우저 기본 도구
// 'en-CA' 형식은 '2026-11-12' 처럼 YYYY-MM-DD 로 나옵니다.
const KST_FORMAT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

// Date 객체 → 한국 날짜 'YYYY-MM-DD'
function kstDateOf(date) {
  const parts = KST_FORMAT.formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

// 'YYYY-MM-DD' → 그날 정오(12:00) UTC 의 Date. 정오로 두면 시간대 경계 문제가 생기지 않습니다.
function noonUtc(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
}

function pad(n) {
  return String(n).padStart(2, '0');
}

// 오늘 (한국 날짜)
export function today() {
  return kstDateOf(new Date());
}

// 이번 달 'YYYY-MM'
export function thisMonth() {
  return today().slice(0, 7);
}

// 날짜에 n일 더하기 (음수면 빼기)
export function addDays(dateStr, n) {
  const d = noonUtc(dateStr);
  d.setUTCDate(d.getUTCDate() + n);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

// a 에서 b 까지 며칠인지 (b - a). 예) diffDays('2026-11-01', '2026-11-11') → 10
export function diffDays(a, b) {
  return Math.round((noonUtc(b) - noonUtc(a)) / 86_400_000);
}

// 지난달. 예) prevMonth('2026-01') → '2025-12'
export function prevMonth(monthStr) {
  const [y, m] = monthStr.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${pad(m - 1)}`;
}

// 'YYYY-MM-DD' → '11월 11일 (수)'
export function formatKorean(dateStr) {
  const d = noonUtc(dateStr);
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 (${WEEKDAYS[d.getUTCDay()]})`;
}

// 그 달이 며칠까지 있는지. 예) daysInMonth('2026-02') → 28
export function daysInMonth(monthStr) {
  const [y, m] = monthStr.split('-').map(Number);
  // 다음 달 0일 = 이번 달 마지막 날
  return new Date(Date.UTC(y, m, 0, 12)).getUTCDate();
}

// 그 달의 첫날 ~ 마지막 날. 예) monthRange('2026-11') → { start: '2026-11-01', end: '2026-11-30' }
export function monthRange(monthStr) {
  return { start: `${monthStr}-01`, end: `${monthStr}-${pad(daysInMonth(monthStr))}` };
}

// Firestore Timestamp(또는 Date, 밀리초 숫자) → 한국 날짜 'YYYY-MM-DD'. 값이 없으면 null
export function toDateStr(timestamp) {
  if (!timestamp) return null;
  if (typeof timestamp.toDate === 'function') return kstDateOf(timestamp.toDate());
  if (timestamp instanceof Date) return kstDateOf(timestamp);
  if (typeof timestamp === 'number') return kstDateOf(new Date(timestamp));
  return null;
}
