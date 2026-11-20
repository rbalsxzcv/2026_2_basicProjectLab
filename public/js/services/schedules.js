/**
 * 파일: public/js/services/schedules.js
 * 역할: 식물별 정기 관리 일정 (물주기, 비료, 잎 닦기, 분갈이) — plants/{id}/schedules/{taskType}
 * 사용하는 파일: core/firebase.js, core/store.js, utils/date.js
 * 담당: C4 (만들기·읽기) + C5 (예정일 계산·완료·연기)
 *
 * 문서 모양: { taskType, intervalDays, dueDate: 'YYYY-MM-DD', lastDoneAt: 'YYYY-MM-DD' | null }
 * 문서 ID = taskType (예: 'WATER') → 식물마다 딱 4개
 */

import { db, doc, getDocs, setDoc, updateDoc, collection, writeBatch } from '../core/firebase.js';
import { store } from '../core/store.js';
import { today, addDays } from '../utils/date.js';

export const PERIODIC_TYPES = ['WATER', 'FERTILIZE', 'WIPE_LEAF', 'REPOT'];

// 식물 DB(plant-species.json)의 어떤 값이 각 일정의 간격인지
const INTERVAL_FIELD = {
  WATER: 'waterIntervalDays',
  FERTILIZE: 'fertilizeIntervalDays',
  WIPE_LEAF: 'wipeLeafIntervalDays',
  REPOT: 'repotIntervalDays',
};
const FALLBACK_INTERVAL = { WATER: 7, FERTILIZE: 30, WIPE_LEAF: 14, REPOT: 365 };

function currentUid() {
  const uid = store.get('user')?.uid;
  if (!uid) throw new Error('로그인이 필요해요');
  return uid;
}

function schedulesCol(plantId) {
  // collection(db, ...경로) : 여러 문서가 모인 "컬렉션"의 주소
  return collection(db, 'users', currentUid(), 'plants', plantId, 'schedules');
}

function scheduleRef(plantId, taskType) {
  return doc(db, 'users', currentUid(), 'plants', plantId, 'schedules', taskType);
}

// ───────── C4: 만들기 · 읽기 ─────────

// 식물을 등록할 때 4개 일정을 한 번에 만듭니다. dueDate = 시작일 + 간격
export async function createInitialSchedules(plantId, species, startDate) {
  // writeBatch: 여러 개의 쓰기를 모아 한 번에 저장 (전부 성공하거나 전부 실패)
  const batch = writeBatch(db);
  for (const taskType of PERIODIC_TYPES) {
    const intervalDays = Number(species?.[INTERVAL_FIELD[taskType]]) || FALLBACK_INTERVAL[taskType];
    batch.set(scheduleRef(plantId, taskType), {
      taskType,
      intervalDays,
      dueDate: addDays(startDate, intervalDays),
      lastDoneAt: null,
    });
  }
  await batch.commit();
}

// 그 식물의 일정 4개 (PERIODIC_TYPES 순서)
export async function listSchedules(plantId) {
  const snap = await getDocs(schedulesCol(plantId));
  const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return list.sort((a, b) => PERIODIC_TYPES.indexOf(a.taskType) - PERIODIC_TYPES.indexOf(b.taskType));
}

// ───────── C5: 예정일 계산 · 완료 · 연기 ─────────
// (일정은 식물마다 4개뿐이라 전부 읽은 뒤 브라우저에서 걸러도 충분히 빠릅니다)

// 예정일이 date 이하인(오늘 할 차례이거나 지난) 일정
export async function getDueSchedules(plantId, date = today()) {
  const list = await listSchedules(plantId);
  return list.filter((s) => s.dueDate && s.dueDate <= date);
}

// 예정일이 이미 지난 일정이 하나라도 있는지 (캐릭터 WAITING 상태 판단용)
export async function hasOverdue(plantId, date = today()) {
  const list = await listSchedules(plantId);
  return list.some((s) => s.dueDate && s.dueDate < date);
}

// 완료 처리: 마지막 관리일 = date, 다음 예정일 = date + 간격
export async function completeSchedule(plantId, taskType, date = today()) {
  const list = await listSchedules(plantId);
  const schedule = list.find((s) => s.taskType === taskType);
  const intervalDays = schedule?.intervalDays ?? FALLBACK_INTERVAL[taskType] ?? 7;
  const patch = { lastDoneAt: date, dueDate: addDays(date, intervalDays) };
  if (schedule) await updateDoc(scheduleRef(plantId, taskType), patch);
  else await setDoc(scheduleRef(plantId, taskType), { taskType, intervalDays, ...patch });
  return { taskType, intervalDays, ...patch };
}

// 미루기 (흙이 아직 축축할 때 등): 예정일 = 오늘 + days. 벌점 없음
export async function postponeSchedule(plantId, taskType, days = 2) {
  const dueDate = addDays(today(), days);
  await updateDoc(scheduleRef(plantId, taskType), { dueDate });
  return { taskType, dueDate };
}
