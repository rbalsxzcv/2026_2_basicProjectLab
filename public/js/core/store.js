/**
 * 파일: public/js/core/store.js
 * 역할: 앱 전체가 함께 보는 상태(로그인 사용자, 식물 목록, 선택한 식물) 저장소 (00_MAIN §5.3)
 * 사용하는 파일: 없음 (가장 아래층)
 * 담당: C1
 *
 * 사용법:
 *   store.get('user')                       // 값 읽기
 *   store.set('plants', [...])              // 값 바꾸기 → 구독자에게 알림
 *   const stop = store.subscribe('plants', (plants) => { ... });  // 바뀔 때마다 실행
 *   stop();                                 // 구독 해제 (화면을 떠날 때 꼭!)
 */

const CURRENT_PLANT_KEY = 'plantCoach.currentPlantId';

// Map: 키-값 쌍을 저장하는 자바스크립트 기본 자료구조
const values = new Map();
const subscribers = new Map(); // key → Set(함수들)

// 시작할 때 localStorage 에 저장된 "마지막으로 보던 식물"을 읽어 옵니다.
// (시크릿 모드 등에서 localStorage 가 막혀 있으면 조용히 무시)
try {
  const saved = localStorage.getItem(CURRENT_PLANT_KEY);
  if (saved) values.set('currentPlantId', saved);
} catch {
  /* localStorage 사용 불가 — 무시 */
}

function notify(key, value) {
  const fns = subscribers.get(key);
  if (!fns) return;
  for (const fn of [...fns]) {
    try {
      fn(value);
    } catch (error) {
      console.warn('[store] 구독 함수 실행 중 문제', key, error);
    }
  }
}

export const store = {
  get(key) {
    return values.get(key) ?? null;
  },

  set(key, value) {
    values.set(key, value);

    if (key === 'currentPlantId') {
      try {
        if (value) localStorage.setItem(CURRENT_PLANT_KEY, value);
        else localStorage.removeItem(CURRENT_PLANT_KEY);
      } catch {
        /* localStorage 사용 불가 — 무시 */
      }
    }

    notify(key, value);
  },

  // 반환값: 구독을 멈추는 함수
  subscribe(key, fn) {
    if (!subscribers.has(key)) subscribers.set(key, new Set());
    subscribers.get(key).add(fn);
    return () => subscribers.get(key)?.delete(fn);
  },

  // 로그아웃할 때 모든 값을 비웁니다. (구독자에게는 null 로 알림)
  reset() {
    const keys = [...values.keys()];
    values.clear();
    try {
      localStorage.removeItem(CURRENT_PLANT_KEY);
    } catch {
      /* 무시 */
    }
    for (const key of keys) notify(key, null);
  },
};
