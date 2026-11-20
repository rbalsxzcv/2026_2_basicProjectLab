/**
 * 파일: public/js/core/startup.js
 * 역할: 로그인 직후 할 일 목록 (00_MAIN §5.10)
 *       - runBlockingTasks: 첫 화면을 그리기 "전에" 꼭 끝나야 하는 일 (회원정보, 식물 목록)
 *       - runBackgroundTasks: 화면을 그린 "뒤에" 조용히 하는 일 (체크리스트, 월간 리포트, 알림 뱃지)
 * 사용하는 파일: services/users.js, services/plants.js, services/checklists.js,
 *               services/reports.js, services/notifications.js, ui/layout.js, ui/components.js
 * 담당: C1 · C3 · C4 · C5. ★ 공통 동결 파일 — 동작을 바꾸려면 각 서비스 함수의 안쪽을 고칩니다.
 */

import { store } from './store.js';
import { loadCurrentUserProfile } from '../services/users.js';
import { loadPlants } from '../services/plants.js';
import { ensureTodayChecklist } from '../services/checklists.js';
import { ensureLastMonthReports } from '../services/reports.js';
import { watchUnreadCount, notifyChecklistCreated, notifyReportCreated } from '../services/notifications.js';
import { setBadge } from '../ui/layout.js';
import { toast } from '../ui/components.js';

// 화면을 띄우기 전에 꼭 끝나야 하는 작업. redirect 경로를 반환하면 그리로 이동.
export async function runBlockingTasks(user) {
  let redirect = null;

  // [C3] 회원정보 불러오기
  try {
    const profile = await loadCurrentUserProfile();
    if (!profile) {
      // 가입은 됐지만 회원정보 저장에 실패한 경우 → 내 정보 화면에서 다시 저장
      redirect = '/profile';
      toast('회원정보가 비어 있어요. 내 정보에서 다시 저장해 주세요.', 'error');
    }
  } catch (error) {
    console.warn('[C3] 회원정보 불러오기 실패', error);
  }

  // [C4] 식물 목록 불러오기, 식물이 없으면 등록 화면으로
  try {
    const plants = await loadPlants();
    if (plants.length === 0 && !redirect) redirect = '/plants/new';
  } catch (error) {
    console.warn('[C4] 식물 목록 불러오기 실패', error);
    store.set('plants', []);
  }

  return redirect;
}

// 화면을 띄운 뒤 뒤에서 조용히 할 작업 (기다리지 않음)
export function runBackgroundTasks(user) {
  // [C5] 오늘의 체크리스트 만들기 + 새로 만들었으면 알림 (식물마다, 기다리지 않음)
  try {
    for (const plant of store.get('plants') ?? []) {
      ensureTodayChecklist(plant)
        .then(({ checklist, created }) => (created ? notifyChecklistCreated(plant, checklist) : null))
        .catch((e) => console.warn('[C5] 체크리스트 생성 실패', e));
    }
  } catch (e) {
    console.warn('[C5] 체크리스트 작업 시작 실패', e);
  }

  // [C5] 지난달 월간 리포트 + 새로 만들었으면 알림
  try {
    ensureLastMonthReports(store.get('plants') ?? [])
      .then(async (results) => {
        for (const r of results.filter((x) => x.created)) await notifyReportCreated(r);
      })
      .catch((e) => console.warn('[C5] 월간 리포트 생성 실패', e));
  } catch (e) {
    console.warn('[C5] 월간 리포트 작업 시작 실패', e);
  }

  // [C5] 안 읽은 알림 수 → 상단 뱃지. 로그아웃(store user → null) 때 해제
  try {
    const stop = watchUnreadCount((count) => setBadge(count));
    const unsub = store.subscribe('user', (u) => {
      if (!u) {
        stop();
        unsub();
        setBadge(0);
      }
    });
  } catch (e) {
    console.warn('[C5] 알림 뱃지 연결 실패', e);
  }
}
