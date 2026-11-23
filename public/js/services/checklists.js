/**
 * 파일: public/js/services/checklists.js
 * 역할: 오늘의 체크리스트 — plants/{id}/checklists/{YYYY-MM-DD}
 *       - ensureTodayChecklist: 하루 한 번 오늘 체크리스트 만들기 (정기 관리 + AI 데일리 루틴)
 *       - completeItem: 항목 완료 처리, 물주기는 흙 상태 확인(Safe-Lock) 필수
 * 사용하는 파일: core/firebase.js, core/store.js, core/ai.js, core/weather.js,
 *               services/schedules.js, services/game.js, services/aiHistory.js,
 *               services/environments.js, services/species.js, utils/date.js
 * 담당: P3
 *
 * ★ 함수 이름·인자·반환 형식은 00_MAIN §5 계약 그대로 유지 (main.js, startup.js, notifications.js 가 사용).
 */

import { db, doc, getDoc, runTransaction, serverTimestamp } from '../core/firebase.js';
import { store } from '../core/store.js';
import { getDueSchedules, completeSchedule, postponeSchedule } from './schedules.js';
import { EXP, awardExp, markCared, refreshPlantState } from './game.js';
import { today } from '../utils/date.js';
import { suggestChecklist } from '../core/ai.js';
import { getWeather } from '../core/weather.js';
import { addHistory, getRecentHistory } from './aiHistory.js';
import { getLatestEnvironment } from './environments.js';
import { getSpecies, speciesProfile } from './species.js';

export const ALLOWED_DAILY = ['VENTILATE', 'CHECK_LEAF', 'CHECK_LIGHT', 'MIST'];
export const TASK_INFO = {
  WATER:     { label: '물주기',  emoji: '💧', tip: '겉흙이 말랐는지 먼저 확인해요' },
  FERTILIZE: { label: '비료 주기', emoji: '🧪', tip: '정량보다 조금 적게 주는 게 안전해요' },
  WIPE_LEAF: { label: '잎 닦기',  emoji: '🧽', tip: '젖은 천으로 잎을 살살 닦아 주세요' },
  REPOT:     { label: '분갈이',  emoji: '🪴', tip: '배수 구멍으로 뿌리가 나왔는지 봐요' },
  VENTILATE: { emoji: '🌬️' }, CHECK_LEAF: { emoji: '🍃' }, CHECK_LIGHT: { emoji: '☀️' }, MIST: { emoji: '💦' },
};

function currentUid() {
  const uid = store.get('user')?.uid;
  if (!uid) throw new Error('로그인이 필요해요');
  return uid;
}

// uid: 오래 걸리는 작업은 "시작할 때의 계정"을 넘겨서, 중간에 계정이 바뀌어도 엉뚱한 계정에 쓰지 않게 함
function checklistRef(plantId, date, uid = currentUid()) {
  return doc(db, 'users', uid, 'plants', plantId, 'checklists', date);
}

// 작업 도중 로그아웃·다른 계정 로그인이 일어났는지
function accountChanged(uid) {
  return store.get('user')?.uid !== uid;
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
// id: 같은 taskType 이더라도 여러 항목이 생길 수 있으므로 짧은 랜덤 문자열 사용
function shortId() {
  return Math.random().toString(36).slice(2, 8);
}

function makeItem({ category, taskType, title, exp, dueDate = null }) {
  return {
    id: shortId(),
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
// ★ AI 호출이 몇 초 걸리므로, 그 사이 계정이 바뀌면 저장하지 않고 { checklist: null, created: false } 반환
export async function ensureTodayChecklist(plant) {
  const uid = currentUid(); // 시작 시점의 계정에 고정
  const date = today();
  const existing = await getChecklist(plant.id, date);
  if (existing) return { checklist: existing, created: false };

  // 1) 오늘 도래한 정기 관리 (물주기 등) — 물주기·비료·분갈이·잎 닦기는 이 경로로만 들어옴
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

  // 2) 데일리 안부 루틴 — AI 가 고르고, 실패하면 기본 루틴으로
  let dailyItems = [];
  let generatedBy = 'AI';
  try {
    dailyItems = await pickDailyRoutine(plant, due);
    if (dailyItems.length === 0) throw new Error('빈 결과');
  } catch (error) {
    console.warn('[checklists] 데일리 루틴 추천 실패 → 기본 루틴으로', error);
    dailyItems = await buildDefaultRoutine(plant);
    generatedBy = 'DEFAULT';
  }

  const data = { items: [...periodicItems, ...dailyItems], generatedBy, createdAt: serverTimestamp() };

  // AI 를 기다리는 사이 다른 계정으로 바뀌었으면 여기서 중단 (이전 계정 식물이 새 계정에 섞이는 문제 방지)
  if (accountChanged(uid)) return { checklist: null, created: false };

  // 3) 트랜잭션 안에서 "없을 때만" 만들기 → 여러 탭에서 동시에 열어도 하루에 한 번만 생김
  const ref = checklistRef(plant.id, date, uid);
  const result = await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists()) return { checklist: { id: snap.id, ...snap.data() }, created: false };
    tx.set(ref, data);
    return { checklist: { id: date, ...data, createdAt: null }, created: true };
  });

  // 4) 새로 만들었을 때만 분석 요약 기록 (실패해도 치명적이지 않음)
  if (result.created && !accountChanged(uid)) {
    try {
      await addHistory(plant.id, 'CHECKLIST', {
        titles: [...periodicItems, ...dailyItems].map((i) => i.title),
      });
    } catch (error) {
      console.warn('[checklists] 체크리스트 기록 저장 실패', error);
    }
  }

  return result;
}

// AI 가 오늘의 데일리 루틴을 고릅니다. 항목이 없으면 오류를 던지고 기본 루틴으로 넘어갑니다.
// 데일리 루틴에 물주기 등 정기 관리가 절대 들어오지 않도록 ALLOWED_DAILY 만 골라 최대 3개.
async function pickDailyRoutine(plant, due) {
  const tasks = await loadDailyTasks();
  const user = store.get('user') ?? {};

  // 날씨·환경·최근 기록이 없어도 AI 는 동작해야 하므로 각각 실패 시 null/빈 값으로
  const [species, weather, latestEnvironment, recentHistory] = await Promise.all([
    getSpecies(plant.speciesId).catch(() => null),
    getWeather(user.home?.region).catch(() => null),
    getLatestEnvironment(plant.id).catch(() => null),
    getRecentHistory(plant.id, { n: 5 }).catch(() => []),
  ]);

  const result = await suggestChecklist({
    speciesName: species?.name ?? plant.name,
    profile: speciesProfile(species),
    weather: weather
      ? { tempC: weather.tempC, humidity: weather.humidity, precipitation: weather.precipitation }
      : null,
    latestEnvironment,
    dueSchedules: due.map((s) => ({ taskType: s.taskType, dueDate: s.dueDate })),
    recentHistory,
  });

  const seen = new Set();
  const items = [];
  for (const raw of result.items ?? []) {
    const taskType = raw?.taskType;
    // 데일리 루틴만 허용 (정기 관리·물주기는 절대 안 됨), 중복 제거, 최대 3개, 제목 30자
    if (!ALLOWED_DAILY.includes(taskType) || seen.has(taskType)) continue;
    seen.add(taskType);
    const chosen = String(raw?.title ?? '').slice(0, 30);
    const title = chosen || tasks.find((t) => t.taskType === taskType)?.title || taskType;
    items.push(
      makeItem({ category: 'DAILY_MICRO', taskType, title, exp: EXP.DAILY }),
    );
    if (items.length >= 3) break;
  }
  return items;
}

// AI 실패 시 기본 루틴 (daily-tasks.json 기준):
// VENTILATE·CHECK_LEAF 는 항상, CHECK_LIGHT 는 최근 환경 분석이 LOW 일 때,
// MIST 는 (json 의 onlyWhenDry) 날씨 습도가 종류 최소 습도보다 낮을 때만
async function buildDefaultRoutine(plant) {
  const tasks = await loadDailyTasks();
  const user = store.get('user') ?? {};
  const [species, weather, latestEnvironment] = await Promise.all([
    getSpecies(plant.speciesId).catch(() => null),
    getWeather(user.home?.region).catch(() => null),
    getLatestEnvironment(plant.id).catch(() => null),
  ]);

  const wanted = ['VENTILATE', 'CHECK_LEAF'];
  if (latestEnvironment?.lightLevel === 'LOW') wanted.push('CHECK_LIGHT');
  const minHumidity = species?.humidityMin ?? null;
  if (weather && typeof minHumidity === 'number' && weather.humidity < minHumidity) wanted.push('MIST');

  return wanted.slice(0, 3).map((taskType) =>
    makeItem({
      category: 'DAILY_MICRO',
      taskType,
      title: tasks.find((t) => t.taskType === taskType)?.title ?? taskType,
      exp: EXP.DAILY,
    }),
  );
}

// { total, done, remaining, percent } — 미룬(postponed) 항목은 전체에서 뺌
export function summarize(checklist) {
  const items = (checklist?.items ?? []).filter((item) => !item.postponed);
  const total = items.length;
  const done = items.filter((item) => item.isCompleted).length;
  return { total, done, remaining: total - done, percent: total ? Math.round((done / total) * 100) : 0 };
}

// 항목 완료. 반환: { status: 'completed'|'postponed'|'already', expResult }
// 물주기(WATER)는 Safe-Lock: soilMoistureDry 값이 반드시 있어야 완료·연기 중 하나로 처리됩니다.
export async function completeItem(plantId, itemId, { soilMoistureDry = null } = {}) {
  const date = today();
  const ref = checklistRef(plantId, date);

  // 트랜잭션: 읽기 → 상태 바꾸기. 두 기기에서 동시에 눌러도 EXP·일정이 한 번만 처리됨
  const outcome = await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('오늘 체크리스트를 찾을 수 없어요. 한 번 더 들어와 주세요.');
    const data = snap.data();
    const item = data.items?.find((i) => i.id === itemId);
    if (!item) throw new Error('완료할 항목을 찾을 수 없어요.');

    // 1) 이미 완료된 항목
    if (item.isCompleted) return { status: 'already' };

    // 2) 물주기인데 흙 상태를 아직 확인 안 했음(null) → 팝업 없이 완료되는 버그 방지
    if (item.taskType === 'WATER' && soilMoistureDry === null) {
      throw new Error('물주기 전에 흙 상태를 먼저 확인해 주세요.');
    }

    // 3) 물주기 + 아직 축축함 → 미루기(완료 아님, 벌점 없음)
    if (item.taskType === 'WATER' && soilMoistureDry === false) {
      item.postponed = true;
      item.soilMoistureDry = false;
      tx.update(ref, { items: data.items });
      return { status: 'postponed' };
    }

    // 4) 완료 처리 (물주기는 확인 결과 soilMoistureDry: true 를 기록)
    item.isCompleted = true;
    item.completedAt = date;
    if (item.taskType === 'WATER') item.soilMoistureDry = true;
    tx.update(ref, { items: data.items });
    return { status: 'completed', item: { ...item } };
  });

  // 트랜잭션 이후: 일정 갱신 + 경험치 + 캐릭터 상태 반영
  if (outcome.status === 'postponed') {
    await postponeSchedule(plantId, 'WATER', 2);
    return { status: 'postponed' };
  }

  if (outcome.status === 'completed' && outcome.item) {
    const item = outcome.item;
    if (item.category === 'PERIODIC_CARE') await completeSchedule(plantId, item.taskType, date);
    const expResult = await awardExp(plantId, item.exp, item.taskType);
    await markCared(plantId);
    await refreshPlantState(plantId);
    return { status: 'completed', expResult };
  }

  return { status: 'already' };
}
