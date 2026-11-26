/**
 * 파일: public/js/services/game.js
 * 역할: 경험치(EXP) · 레벨 · 성장 단계 · 캐릭터 상태 머신
 * 사용하는 파일: core/firebase.js, core/store.js, services/schedules.js
 *
 * ★ 게임 숫자(경험치·레벨 기준)는 이 파일에만 정의합니다. 다른 파일은 여기서 가져다 씁니다.
 * ★ 벌점·감점은 없습니다(Anti-Guilt). 일정이 밀려도 캐릭터는 "차분히 기다리는 중"일 뿐입니다.
 */

import { db, doc, getDoc, updateDoc, runTransaction, serverTimestamp, Timestamp } from '../core/firebase.js';
import { store } from '../core/store.js';
import { hasOverdue } from './schedules.js';

// ───────── 상수 ─────────

export const EXP = { DAILY: 5, PERIODIC: 20, PHOTO: 15, PET: 0 };
export const EXP_PER_LEVEL = 100;
export const STAGES = [
  { id: 'SPROUT', name: '새싹', minLevel: 1 },
  { id: 'YOUNG', name: '어린 모종', minLevel: 3 },
  { id: 'LUSH', name: '풍성한 식물', minLevel: 6 },
];
export const UNLOCKS = [
  { level: 3, id: 'ribbon', name: '화분 리본', image: 'assets/characters/deco-ribbon.svg' },
  { level: 5, id: 'butterfly', name: '나비 친구', image: 'assets/characters/deco-butterfly.svg' },
  { level: 8, id: 'star', name: '반짝 별', image: 'assets/characters/deco-star.svg' },
];
export const STATE_MESSAGES = {
  PEACEFUL: '오늘도 살랑살랑 기분 좋아요',
  WAITING: '집사님을 차분히 기다리는 중이에요',
  ALERT: '관찰이 조금 더 필요해요',
  GROWING: '고마워요! 쑥쑥 자라는 기분이에요',
};
export const PET_MESSAGES = ['헤헤, 간지러워요', '기분이 좋아졌어요!', '오늘도 같이 있어 줘서 고마워요', '잎이 반짝반짝해진 것 같아요'];

const GROWING_WINDOW_MS = 30 * 60 * 1000; // 관리 후 30분 동안 GROWING

// ───────── 순수 함수 (Firestore 없음 — 테스트하기 쉬움) ─────────

export function levelFromExp(exp) {
  return Math.floor((Number(exp) || 0) / EXP_PER_LEVEL) + 1;
}

// { current: 이번 레벨에서 모은 EXP, needed: 100, percent: 0~100 }
export function expProgress(exp) {
  const current = (Number(exp) || 0) % EXP_PER_LEVEL;
  return { current, needed: EXP_PER_LEVEL, percent: Math.round((current / EXP_PER_LEVEL) * 100) };
}

export function stageFromLevel(level) {
  let stage = STAGES[0];
  for (const s of STAGES) if (level >= s.minLevel) stage = s;
  return stage;
}

export function unlockedItems(level) {
  return UNLOCKS.filter((u) => u.level <= level);
}

function toMillis(value) {
  if (!value) return null;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  return null;
}

// 우선순위: ALERT(관찰 필요) > WAITING(정기 관리 예정일 지남) > GROWING(30분 안에 관리함) > PEACEFUL
export function computeState({ alertOpen, hasOverdue: overdue, lastCareAt, now = Date.now() }) {
  if (alertOpen) return 'ALERT';
  if (overdue) return 'WAITING';
  const caredAt = toMillis(lastCareAt);
  if (caredAt && now - caredAt < GROWING_WINDOW_MS) return 'GROWING';
  return 'PEACEFUL';
}

// ───────── Firestore 함수 ─────────

function currentUid() {
  const uid = store.get('user')?.uid;
  if (!uid) throw new Error('로그인이 필요해요');
  return uid;
}

function plantRef(plantId) {
  return doc(db, 'users', currentUid(), 'plants', plantId);
}

// store 'plants' 안의 식물 하나를 고쳐서 메인 화면 등이 바로 바뀌게 함
function patchPlantInStore(plantId, patch) {
  const plants = store.get('plants') ?? [];
  if (!plants.some((p) => p.id === plantId)) return;
  store.set('plants', plants.map((p) => (p.id === plantId ? { ...p, ...patch } : p)));
}

function findPlantInStore(plantId) {
  return (store.get('plants') ?? []).find((p) => p.id === plantId) ?? null;
}

/**
 * 경험치 주기
 * @returns {Promise<{exp, level, leveledUp, newStage, newUnlocks}>}
 *   newStage: 단계가 바뀌었으면 STAGES 항목, 아니면 null / newUnlocks: 새로 열린 소품 배열
 */
export async function awardExp(plantId, amount, reason = '') {
  const add = Math.max(0, Math.round(Number(amount) || 0));

  if (add === 0) {
    let plant = findPlantInStore(plantId);
    if (!plant) {
      const snap = await getDoc(plantRef(plantId));
      plant = snap.exists() ? snap.data() : {};
    }
    const exp = plant.exp ?? 0;
    return { exp, level: levelFromExp(exp), leveledUp: false, newStage: null, newUnlocks: [] };
  }

  const ref = plantRef(plantId);
  // runTransaction: "읽고 → 계산하고 → 쓰기"를 한 덩어리로 처리. 동시에 두 번 눌러도 EXP 가 꼬이지 않음
  const result = await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('식물을 찾지 못했어요');
    const oldExp = snap.data().exp ?? 0;
    const exp = oldExp + add;
    const oldLevel = levelFromExp(oldExp);
    const level = levelFromExp(exp);
    tx.update(ref, { exp, level });

    const oldStage = stageFromLevel(oldLevel);
    const stage = stageFromLevel(level);
    return {
      exp,
      level,
      leveledUp: level > oldLevel,
      newStage: stage.id !== oldStage.id ? stage : null,
      newUnlocks: UNLOCKS.filter((u) => u.level > oldLevel && u.level <= level),
    };
  });

  console.info('[game] +EXP', add, reason, '→', result.exp);
  patchPlantInStore(plantId, { exp: result.exp, level: result.level });
  return result;
}

// 방금 관리함 → 30분 동안 GROWING
export async function markCared(plantId) {
  await updateDoc(plantRef(plantId), { lastCareAt: serverTimestamp() });
  patchPlantInStore(plantId, { lastCareAt: Timestamp.now() });
}

// 관찰 필요(ALERT) 켜기/끄기 — 사진 진단에서 사용
export async function setAlert(plantId, isOpen) {
  await updateDoc(plantRef(plantId), { alertOpen: Boolean(isOpen) });
  patchPlantInStore(plantId, { alertOpen: Boolean(isOpen) });
}

// 현재 상태를 다시 계산해서, 바뀌었으면 저장. 반환: 새 상태
export async function refreshPlantState(plantId) {
  let plant = findPlantInStore(plantId);
  if (!plant) {
    const snap = await getDoc(plantRef(plantId));
    if (!snap.exists()) return null;
    plant = { id: snap.id, ...snap.data() };
  }

  const overdue = await hasOverdue(plantId);
  const state = computeState({ alertOpen: plant.alertOpen, hasOverdue: overdue, lastCareAt: plant.lastCareAt });

  if (state !== plant.state) {
    await updateDoc(plantRef(plantId), { state });
    patchPlantInStore(plantId, { state });
  }
  return state;
}
