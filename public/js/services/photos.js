/**
 * 파일: public/js/services/photos.js
 * 역할: 식물 사진 기록 — plants/{id}/photos/{photoId}
 * 사용하는 파일: core/firebase.js, core/store.js, utils/date.js
 * 담당: C5
 *
 * 문서 모양: { image, date: 'YYYY-MM-DD', diagnosis: {...} | null, createdAt }
 * ★ image 는 저장 전에 services/images.js 의 prepareImageForSave 를 거친 값이어야 합니다.
 */

import {
  db,
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
} from '../core/firebase.js';
import { store } from '../core/store.js';
import { today, monthRange } from '../utils/date.js';

function currentUid() {
  const uid = store.get('user')?.uid;
  if (!uid) throw new Error('로그인이 필요해요');
  return uid;
}

function photosCol(plantId) {
  return collection(db, 'users', currentUid(), 'plants', plantId, 'photos');
}

// 사진 한 장 기록. 반환: 저장한 사진 객체 (id 포함)
export async function addPhoto(plantId, { image, date = today(), diagnosis = null }) {
  if (!image) throw new Error('사진이 없어요');
  const data = { image, date, diagnosis, createdAt: serverTimestamp() };
  // addDoc: 문서 ID 를 자동으로 만들어 새 문서를 추가합니다.
  const ref = await addDoc(photosCol(plantId), data);
  return { id: ref.id, ...data, createdAt: null };
}

// 그 달의 사진 (날짜 오름차순)
export async function listPhotosInMonth(plantId, month) {
  const { start, end } = monthRange(month);
  // where 두 개를 같은 필드(date)에만 걸면 따로 색인(index)을 만들 필요가 없습니다.
  const q = query(photosCol(plantId), where('date', '>=', start), where('date', '<=', end));
  const snap = await getDocs(q);
  const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  // 같은 날 여러 장이면 먼저 찍은 것부터
  return list.sort((a, b) => a.date.localeCompare(b.date) || millis(a.createdAt) - millis(b.createdAt));
}

// 최근 사진 n장 (최신순)
export async function listRecentPhotos(plantId, n = 10) {
  const q = query(photosCol(plantId), orderBy('createdAt', 'desc'), limit(n));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// 그날 사진이 이미 있는지 (경험치는 하루 한 번만 주기 위해)
export async function hasPhotoOn(plantId, date) {
  const q = query(photosCol(plantId), where('date', '==', date), limit(1));
  const snap = await getDocs(q);
  return !snap.empty;
}

function millis(timestamp) {
  return typeof timestamp?.toMillis === 'function' ? timestamp.toMillis() : 0;
}
