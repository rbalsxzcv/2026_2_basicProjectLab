/**
 * 파일: public/js/services/reports.js
 * 역할: 월간 리포트 — plants/{id}/monthlyReports/{YYYY-MM}
 * 사용하는 파일: utils/date.js (P6 에서 core/firebase.js, core/ai.js 등을 사용)
 * 담당: C5 (뼈대) → P6 (완성)
 *
 * 이 파일은 P6가 완성한다. 함수 이름·인자·반환 형식은 바꾸지 않는다.
 *
 * ── 지금(뼈대) 동작 ──  빈 결과만 돌려줌. isEligible 만 실제로 동작.
 */

import { monthRange, toDateStr } from '../utils/date.js';

// 그 달의 통계
export async function computeMonthlyStats(plantId, month) {
  return { routineRate: 0, ventilationCount: 0, waterOnTimeRate: null, photoCount: 0, checklistDays: 0 };
}

// 저장된 리포트 (없으면 null)
export async function getReport(plantId, month) {
  return null;
}

// 리포트가 있는 달 목록 ['2026-10', ...]
export async function listReportMonths(plantId) {
  return [];
}

// 리포트 만들기 (AI 글 포함)
export async function generateReport(plant, month) {
  throw new Error('월간 리포트는 P6에서 구현돼요');
}

// 시작 작업(startup.js)이 부름: 지난달 리포트가 없으면 만들기
// 반환: [{ plantId, month, created }]
export async function ensureLastMonthReports(plants) {
  return [];
}

// 그 달 리포트를 만들 수 있는 식물인지: 그 달 마지막 날 이전에 등록된 식물
export function isEligible(plant, month) {
  const created = toDateStr(plant?.createdAt) ?? plant?.purchasedAt ?? null;
  if (!created) return false;
  return created <= monthRange(month).end;
}
