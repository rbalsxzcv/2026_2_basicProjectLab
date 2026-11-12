/**
 * 파일: public/js/services/plants.js
 * 역할: 내 식물 목록 불러오기·선택·등록·수정·삭제 — users/{uid}/plants/{plantId}
 * 사용하는 파일: core/firebase.js, core/store.js, services/species.js, services/schedules.js,
 *               services/photos.js, utils/date.js
 * 담당: C4
 *
 * 식물 목록은 store 'plants' 에, 지금 보고 있는 식물 ID 는 store 'currentPlantId' 에 둡니다.
 */

import {
  db,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  orderBy,
  serverTimestamp,
  writeBatch,
} from '../core/firebase.js';
import { store } from '../core/store.js';
import { getSpecies } from './species.js';
import { createInitialSchedules } from './schedules.js';
import { addPhoto } from './photos.js';
import { today } from '../utils/date.js';

export const DEFAULT_CHARACTER = 'assets/characters/default.svg';

// 식물을 지울 때 같이 지워야 하는 하위 컬렉션 (Firestore 는 하위 컬렉션을 자동으로 지우지 않음)
const SUBCOLLECTIONS = ['schedules', 'checklists', 'environments', 'photos', 'aiHistory', 'monthlyReports'];
const BATCH_SIZE = 400; // writeBatch 한 번에 최대 500개 → 여유 있게 400

function currentUid() {
  const uid = store.get('user')?.uid;
  if (!uid) throw new Error('로그인이 필요해요');
  return uid;
}

function plantsCol() {
  return collection(db, 'users', currentUid(), 'plants');
}

function plantRef(plantId) {
  return doc(db, 'users', currentUid(), 'plants', plantId);
}

// 선택한 식물이 목록에 없으면(삭제됨 등) 첫 번째 식물로 바로잡기
function fixCurrentPlantId(plants) {
  const current = store.get('currentPlantId');
  if (plants.some((p) => p.id === current)) return;
  store.set('currentPlantId', plants[0]?.id ?? null);
}

// 내 식물 전체 (등록 순서). store 'plants' 에도 넣음
export async function loadPlants() {
  const snap = await getDocs(query(plantsCol(), orderBy('createdAt', 'asc')));
  const plants = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  fixCurrentPlantId(plants);
  store.set('plants', plants);
  return plants;
}

// 지금 보고 있는 식물 객체 (없으면 null)
export function getCurrentPlant() {
  const plants = store.get('plants') ?? [];
  const id = store.get('currentPlantId');
  return plants.find((p) => p.id === id) ?? plants[0] ?? null;
}

export function selectPlant(plantId) {
  store.set('currentPlantId', plantId);
}

export async function getPlant(plantId) {
  const snap = await getDoc(plantRef(plantId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/**
 * 식물 등록
 * @param {object} input
 * @param {string} input.speciesId       plant-species.json 의 id
 * @param {string} [input.name]          별명 (비우면 종류 이름)
 * @param {string} [input.purchasedAt]   'YYYY-MM-DD' (비우면 오늘)
 * @param {{type, endDate}} [input.lifespan]
 * @param {string} [input.photoDataUrl]  저장용으로 준비된 사진 (prepareImageForSave 결과)
 * @param {string} [input.characterImage] 캐릭터 이미지 (data URL 또는 기본 캐릭터 경로)
 * @returns {Promise<object>} 새 식물 객체
 */
export async function createPlant({ speciesId, name, purchasedAt, lifespan, photoDataUrl, characterImage }) {
  const species = await getSpecies(speciesId);
  if (!species) throw new Error('식물 종류를 찾지 못했어요');

  const todayStr = today();
  const purchased = purchasedAt && purchasedAt <= todayStr ? purchasedAt : todayStr;

  // 1) 식물 문서
  const data = {
    speciesId,
    name: (name ?? '').trim() || species.name,
    purchasedAt: purchased,
    lifespan: {
      type: lifespan?.type ?? species.lifespanType ?? 'PERENNIAL',
      endDate: lifespan?.endDate ?? null,
    },
    characterImage: characterImage || DEFAULT_CHARACTER,
    exp: 0,
    level: 1,
    state: 'PEACEFUL',
    alertOpen: false,
    lastCareAt: null,
    createdAt: serverTimestamp(),
  };
  const ref = await addDoc(plantsCol(), data);

  // 2) 정기 관리 일정 4개. 구입한 지 오래됐어도 첫날부터 밀린 일정이 생기지 않게 "오늘" 기준
  await createInitialSchedules(ref.id, species, todayStr);

  // 3) 등록 사진은 사진 기록에도 함께 저장 (명세: 등록 사진은 식물 사진 기록에 함께 저장)
  if (photoDataUrl) {
    try {
      await addPhoto(ref.id, { image: photoDataUrl, date: todayStr, diagnosis: null });
    } catch (error) {
      console.warn('[plants] 첫 사진 저장 실패 (식물 등록은 완료)', error);
    }
  }

  // 4) 목록 다시 불러오고 새 식물 선택
  await loadPlants();
  selectPlant(ref.id);
  return (store.get('plants') ?? []).find((p) => p.id === ref.id) ?? { id: ref.id, ...data };
}

// 고칠 수 있는 값: name, purchasedAt, lifespan, characterImage (종류는 바꿀 수 없음 — 일정이 꼬임)
export async function updatePlant(plantId, patch) {
  const allowed = {};
  if (patch.name !== undefined) allowed.name = String(patch.name).trim();
  if (patch.purchasedAt !== undefined) allowed.purchasedAt = patch.purchasedAt;
  if (patch.lifespan !== undefined) allowed.lifespan = patch.lifespan;
  if (patch.characterImage !== undefined) allowed.characterImage = patch.characterImage;
  if (Object.keys(allowed).length === 0) return;

  if (allowed.name === '') {
    const plant = (store.get('plants') ?? []).find((p) => p.id === plantId) ?? (await getPlant(plantId));
    const species = await getSpecies(plant?.speciesId);
    allowed.name = species?.name ?? '내 식물';
  }

  await updateDoc(plantRef(plantId), allowed);
  const plants = (store.get('plants') ?? []).map((p) => (p.id === plantId ? { ...p, ...allowed } : p));
  store.set('plants', plants);
}

// 식물과 그 아래 모든 기록 삭제
export async function deletePlant(plantId) {
  const uid = currentUid();
  for (const sub of SUBCOLLECTIONS) {
    const snap = await getDocs(collection(db, 'users', uid, 'plants', plantId, sub));
    for (let i = 0; i < snap.docs.length; i += BATCH_SIZE) {
      const batch = writeBatch(db);
      for (const d of snap.docs.slice(i, i + BATCH_SIZE)) batch.delete(d.ref);
      await batch.commit();
    }
  }
  await deleteDoc(plantRef(plantId));
  await loadPlants();
}
