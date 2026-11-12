/**
 * 파일: public/js/services/checklists.js
 * 역할: 오늘의 체크리스트 — plants/{id}/checklists/{YYYY-MM-DD}
 * 사용하는 파일: core/firebase.js, core/store.js, services/schedules.js, services/game.js, utils/date.js
 * 담당: C5 (뼈대) → P3 (완성)
 *
 * 이 파일은 P3가 완성한다. 위 함수의 이름·인자·반환 형식은 바꾸지 않는다.
 *
 * ── 지금(뼈대) 동작 ──
 *  - ensureTodayChecklist: AI 없이 "오늘 도래한 정기 관리 + 기본 데일리 루틴 2개"로 만듦 (generatedBy: 'DEFAULT')
 *  - completeItem: 아직 구현 안 됨 (P3)
 */

import { db, doc, getDoc, runTransaction, serverTimestamp } from '../core/firebase.js';
import { store } from '../core/store.js';
import { getDueSchedules } from './schedules.js';
import { EXP } from './game.js';
import { today } from '../utils/date.js';

export const ALLOWED_DAILY = ['VENTILATE', 'CHECK_LEAF', 'CHECK_LIGHT', 'MIST'];
export const TASK_INFO = {
  WATER:     { label: '물주기',  emoji: '💧', tip: '겉흙이 말랐는지 먼저 확인해요' },
  FERTILIZE: { label: '비료 주기', emoji: '🧪', tip: '정량보다 조금 적게 주는 게 안전해요' },
  WIPE_LEAF: { label: '잎 닦기',  emoji: '🧽', tip: '젖은 천으로 잎을 살살 닦아 주세요' },
  REPOT:     { label: '분갈이',  emoji: '🪴', tip: '배수 구멍으로 뿌리가 나왔는지 봐요' },
  VENTILATE: { emoji: '🌬️' }, CHECK_LEAF: { emoji: '🍃' }, CHECK_LIGHT: { emoji: '☀️' }, MIST: { emoji: '💦' },
};

// 뼈대에서 기본으로 넣는 데일리 루틴
const DEFAULT_DAILY = ['VENTILATE', 'CHECK_LEAF'];

function currentUid() {
  const uid = store.get('user')?.uid;
  if (!uid) throw new Error('로그인이 필요해요');
  return uid;
}

function checklistRef(plantId, date) {
  return doc(db, 'users', currentUid(), 'plants', plantId, 'checklists', date);
}

let dailyTasksPromise = null;
async function loadDailyTasks() {
  if (!dailyTasksPromise) {
    dailyTasksPromise = fetch('data/daily-tasks.json')
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => {
        dailyTasksPromise = null;
        return [];
      });
  }
  return dailyTasksPromise;
}

// 00_MAIN §5.5 의 항목 모양 그대로
function makeItem({ category, taskType, title, exp, dueDate = null }) {
  return {
    id: taskType,
    category,
    taskType,
    title,
    exp,
    isCompleted: false,
    completedAt: null,
    dueDate,
    soilMoistureDry: null,
    postponed: false,
  };
}

// 그날 체크리스트 (없으면 null)
export async function getChecklist(plantId, date = today()) {
  const snap = await getDoc(checklistRef(plantId, date));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// 오늘 체크리스트가 없으면 만들기. 반환: { checklist, created }
export async function ensureTodayChecklist(plant) {
  const date = today();
  const existing = await getChecklist(plant.id, date);
  if (existing) return { checklist: existing, created: false };

  // 1) 오늘 도래한 정기 관리 (물주기 등)
  const due = await getDueSchedules(plant.id, date);
  const periodicItems = due.map((s) =>
    makeItem({
      category: 'PERIODIC_CARE',
      taskType: s.taskType,
      title: TASK_INFO[s.taskType]?.label ?? s.taskType,
      exp: EXP.PERIODIC,
      dueDate: s.dueDate,
    }),
  );

  // 2) 기본 데일리 루틴 (환기, 잎 관찰)
  const tasks = await loadDailyTasks();
  const dailyItems = DEFAULT_DAILY.map((taskType) =>
    makeItem({
      category: 'DAILY_MICRO',
      taskType,
      title: tasks.find((t) => t.taskType === taskType)?.title ?? taskType,
      exp: EXP.DAILY,
    }),
  );

  const data = { items: [...periodicItems, ...dailyItems], generatedBy: 'DEFAULT', createdAt: serverTimestamp() };

  // 3) 트랜잭션 안에서 "없을 때만" 만들기 → 여러 탭에서 동시에 열어도 하루에 한 번만 생김
  const ref = checklistRef(plant.id, date);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists()) return { checklist: { id: snap.id, ...snap.data() }, created: false };
    tx.set(ref, data);
    return { checklist: { id: date, ...data, createdAt: null }, created: true };
  });
}

// { total, done, remaining, percent } — 미룬(postponed) 항목은 전체에서 뺌
export function summarize(checklist) {
  const items = (checklist?.items ?? []).filter((item) => !item.postponed);
  const total = items.length;
  const done = items.filter((item) => item.isCompleted).length;
  return { total, done, remaining: total - done, percent: total ? Math.round((done / total) * 100) : 0 };
}

// 항목 완료. 반환: { status: 'completed'|'postponed'|'already', expResult }
export async function completeItem(plantId, itemId, { soilMoistureDry = null } = {}) {
  throw new Error('체크리스트 완료는 P3에서 구현돼요');
}
