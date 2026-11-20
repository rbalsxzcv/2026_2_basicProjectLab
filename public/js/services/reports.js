/**
 * 파일: public/js/services/reports.js
 * 역할: 월간 리포트 통계 집계·AI 생성·저장 — plants/{id}/monthlyReports/{YYYY-MM}
 * 사용하는 파일: core/firebase.js, core/store.js, core/ai.js, services/species.js,
 *               services/photos.js, services/aiHistory.js, utils/date.js
 * 담당: P6
 *
 * ★ 함수 이름·인자·반환 형식은 00_MAIN §5 계약 그대로 유지 (startup.js, report.js 가 사용).
 */

import {
  db,
  doc,
  collection,
  getDoc,
  getDocs,
  query,
  where,
  documentId,
  runTransaction,
  serverTimestamp,
} from '../core/firebase.js';
import { store } from '../core/store.js';
import { writeMonthlyReport } from '../core/ai.js';
import { getSpecies } from './species.js';
import { listPhotosInMonth } from './photos.js';
import { getHistoryInMonth } from './aiHistory.js';
import {
  thisMonth,
  prevMonth,
  monthRange,
  addDays,
  diffDays,
  toDateStr,
} from '../utils/date.js';

function currentUid() {
  const uid = store.get('user')?.uid;
  if (!uid) throw new Error('로그인이 필요해요');
  return uid;
}

function plantSubCol(plantId, name) {
  return collection(db, 'users', currentUid(), 'plants', plantId, name);
}

function reportRef(plantId, month) {
  return doc(db, 'users', currentUid(), 'plants', plantId, 'monthlyReports', month);
}

// 'YYYY-MM' 의 다음 달 계산 (수명 종료일 판정용)
function nextMonth(monthStr) {
  const [y, m] = monthStr.split('-').map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
}

// completedAt(ISO 문자열 또는 'YYYY-MM-DD' 또는 Timestamp) 에서 'YYYY-MM-DD' 추출
function completedDateOf(value) {
  if (!value) return null;
  if (typeof value === 'string') return value.slice(0, 10);
  return toDateStr(value);
}

/**
 * 그 달의 월간 통계를 계산합니다.
 * @returns {Promise<{ routineRate: number, ventilationCount: number, waterOnTimeRate: number|null, photoCount: number, checklistDays: number }>}
 */
export async function computeMonthlyStats(plantId, month) {
  const { start, end } = monthRange(month);

  // documentId() 범위 쿼리로 해당 달의 체크리스트 문서만 조회 (색인 불필요)
  const checklistsQuery = query(
    plantSubCol(plantId, 'checklists'),
    where(documentId(), '>=', start),
    where(documentId(), '<=', end),
  );

  const [checklistsSnap, photos] = await Promise.all([
    getDocs(checklistsQuery),
    listPhotosInMonth(plantId, month),
  ]);

  let totalItems = 0;
  let completedItems = 0;
  let ventilationCount = 0;
  let completedWaterCount = 0;
  let onTimeWaterCount = 0;

  for (const docSnap of checklistsSnap.docs) {
    const items = docSnap.data()?.items ?? [];
    for (const item of items) {
      // Safe-Lock 으로 미룬(postponed) 물주기는 전체 분모에서 제외
      if (!item.postponed) {
        totalItems++;
        if (item.isCompleted) completedItems++;
      }

      if (item.isCompleted && item.taskType === 'VENTILATE') {
        ventilationCount++;
      }

      if (item.isCompleted && item.taskType === 'WATER') {
        completedWaterCount++;
        const doneDate = completedDateOf(item.completedAt) ?? docSnap.id;
        const deadline = item.dueDate ? addDays(item.dueDate, 1) : doneDate;
        if (doneDate <= deadline) {
          onTimeWaterCount++;
        }
      }
    }
  }

  return {
    routineRate: totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0,
    ventilationCount,
    waterOnTimeRate:
      completedWaterCount > 0 ? Math.round((onTimeWaterCount / completedWaterCount) * 100) : null,
    photoCount: photos.length,
    checklistDays: checklistsSnap.size,
  };
}

// 저장된 리포트 (없으면 null)
export async function getReport(plantId, month) {
  const snap = await getDoc(reportRef(plantId, month));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// 리포트가 있는 달 목록 ['2026-10', ...] (최신순)
export async function listReportMonths(plantId) {
  const snap = await getDocs(plantSubCol(plantId, 'monthlyReports'));
  return snap.docs
    .map((d) => d.id)
    .sort((a, b) => b.localeCompare(a));
}

// AI 실패 시 통계만으로 만드는 기본 칭찬 문구
function buildDefaultAiReport(stats) {
  const praise =
    stats.routineRate >= 70
      ? '꾸준히 잘 챙겨 주셨어요! 작은 관심들이 모여 식물이 건강하게 자라고 있어요.'
      : '바쁜 한 달에도 들러 주셔서 고마워요. 식물은 집사님의 발걸음을 기다리고 있어요.';
  return {
    praise,
    suggestions: ['다음 달에도 물주기 전 흙을 만져 보는 작은 습관을 이어가 보세요.'],
    repotNotice: null,
    lifespanNotice: null,
    generatedBy: 'DEFAULT',
  };
}

// 안전장치: AI가 빼먹어도 조건을 만족하면 분갈이/수명 안내를 채워 줌
function applySafetyNotices(aiResult, { daysSincePurchase, lifespan, month }) {
  const result = { ...aiResult };

  if (!result.repotNotice && daysSincePurchase >= 180) {
    result.repotNotice = '뿌리가 꽉 찼을 수 있으니 화분 밑바닥 배수 구멍을 확인해 보세요.';
  }

  const endDate = lifespan?.endDate;
  if (!result.lifespanNotice && endDate) {
    const nextMonthEnd = monthRange(nextMonth(month)).end;
    if (endDate <= nextMonthEnd) {
      result.lifespanNotice =
        lifespan?.type === 'HARVEST'
          ? '곧 수확 시기가 다가와요. 잎이나 열매 상태를 천천히 살펴보세요.'
          : '함께한 계절을 마무리할 시기가 가까워지고 있어요. 성장 캘린더에서 추억을 돌아보세요.';
    }
  }

  return result;
}

// 리포트 만들기 (통계 + AI 글 → Firestore 저장, 기존 문서가 있으면 절대 덮어쓰지 않음)
export async function generateReport(plant, month) {
  if (!plant?.id) throw new Error('식물 정보가 필요해요.');

  // 이미 리포트가 있으면 AI를 다시 부르지 않고 그대로 반환
  const existing = await getReport(plant.id, month);
  if (existing) return existing;

  const [stats, monthlyHistory, prevReport, species] = await Promise.all([
    computeMonthlyStats(plant.id, month),
    getHistoryInMonth(plant.id, month),
    getReport(plant.id, prevMonth(month)),
    getSpecies(plant.speciesId).catch(() => null),
  ]);

  const monthEnd = monthRange(month).end;
  const startDate = plant.purchasedAt ?? toDateStr(plant.createdAt) ?? monthEnd;
  const daysSincePurchase = Math.max(0, diffDays(startDate, monthEnd));

  let aiData;
  try {
    const aiResult = await writeMonthlyReport({
      speciesName: species?.name ?? plant.name,
      daysSincePurchase,
      lifespan: plant.lifespan ?? null,
      stats,
      monthlyHistory: monthlyHistory.slice(0, 10),
      previousReport: prevReport ? { stats: prevReport.stats, ai: prevReport.ai } : null,
    });
    aiData = { ...aiResult, generatedBy: 'AI' };
  } catch (error) {
    console.warn('[reports] AI 리포트 생성 실패 → 기본 문구로 대체', error);
    aiData = buildDefaultAiReport(stats);
  }

  aiData = applySafetyNotices(aiData, {
    daysSincePurchase,
    lifespan: plant.lifespan,
    month,
  });

  const payload = {
    stats: {
      routineRate: stats.routineRate,
      ventilationCount: stats.ventilationCount,
      waterOnTimeRate: stats.waterOnTimeRate,
      photoCount: stats.photoCount,
    },
    ai: aiData,
    createdAt: serverTimestamp(),
  };

  // 트랜잭션으로 "없을 때만" 저장 → 중복 생성 방지
  const ref = reportRef(plant.id, month);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists()) return { id: snap.id, ...snap.data() };
    tx.set(ref, payload);
    return { id: month, ...payload, createdAt: null };
  });
}

// 시작 작업(startup.js)이 부름: 지난달 리포트가 없으면 식물별로 순차 생성
// 반환: [{ plantId, month, created }]
export async function ensureLastMonthReports(plants) {
  const month = prevMonth(thisMonth());
  const results = [];

  for (const plant of plants ?? []) {
    if (!isEligible(plant, month)) {
      results.push({ plantId: plant.id, month, created: false });
      continue;
    }
    // 식물 하나가 실패해도 다음 식물은 계속 만들도록 식물마다 따로 감쌈
    try {
      const existing = await getReport(plant.id, month);
      if (existing) {
        results.push({ plantId: plant.id, month, created: false });
        continue;
      }
      await generateReport(plant, month);
      results.push({ plantId: plant.id, month, created: true });
    } catch (error) {
      console.warn('[reports] 지난달 리포트 생성 실패', plant.id, error);
      results.push({ plantId: plant.id, month, created: false });
    }
  }

  return results;
}

// 그 달 리포트를 만들 수 있는 식물인지: 그 달 마지막 날 이전에 등록된 식물
export function isEligible(plant, month) {
  const created = toDateStr(plant?.createdAt) ?? plant?.purchasedAt ?? null;
  if (!created) return false;
  return created <= monthRange(month).end;
}
