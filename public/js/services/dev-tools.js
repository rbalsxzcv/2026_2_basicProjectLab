/**
 * 파일: public/js/services/dev-tools.js
 * 역할: #/dev 테스트 버튼 전용 Firestore 도우미 (개발용)
 * 사용하는 파일: core/firebase.js, core/store.js, services/schedules.js, utils/date.js
 *
 * ※ "Firestore 는 services/ 에서만" 규칙에 따라, 테스트 버튼이 쓰는 직접 쓰기 작업을
 *   이 파일에 모았습니다. 앱의 실제 화면은 이 파일을 쓰지 않습니다.
 */

import {
  db,
  doc,
  collection,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  writeBatch,
  serverTimestamp,
} from '../core/firebase.js';
import { store } from '../core/store.js';
import { listSchedules } from './schedules.js';
import { daysInMonth } from '../utils/date.js';

function currentUid() {
  const uid = store.get('user')?.uid;
  if (!uid) throw new Error('로그인이 필요해요');
  return uid;
}

function plantPath(plantId) {
  return ['users', currentUid(), 'plants', plantId];
}

// ───────── 공용 테스트 ─────────

// 일정 예정일을 원하는 날짜로 바꾸기 (예: 물주기 예정일을 오늘로)
export async function devSetScheduleDueDate(plantId, taskType, dueDate) {
  await updateDoc(doc(db, ...plantPath(plantId), 'schedules', taskType), { dueDate });
}

// 그날 체크리스트 지우기 (다시 만들어지는지 확인용)
export async function devDeleteChecklist(plantId, date) {
  await deleteDoc(doc(db, ...plantPath(plantId), 'checklists', date));
}

// 식물 문서 + 일정 4개 (화면에 JSON 으로 보여 주기용, 이미지는 길이만)
export async function devDumpPlant(plantId) {
  const snap = await getDoc(doc(db, ...plantPath(plantId)));
  const plant = snap.exists() ? { id: snap.id, ...snap.data() } : null;
  if (plant?.characterImage?.startsWith('data:')) {
    plant.characterImage = `(data URL, ${plant.characterImage.length}자)`;
  }
  const schedules = await listSchedules(plantId);
  return { plant, schedules };
}

// ───────── 성장 캘린더 ─────────

// 그날 사진 기록 모두 지우기 (하루 한 번 사진 경험치를 다시 시험할 때). 반환: 지운 개수
export async function devDeletePhotosOn(plantId, date) {
  const snap = await getDocs(query(collection(db, ...plantPath(plantId), 'photos'), where('date', '==', date)));
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
  return snap.size;
}

// ───────── 월간 리포트 ─────────

function sampleItem(taskType, title, { exp, category, isCompleted, dateStr, dueDate = null, postponed = false }) {
  return {
    id: taskType,
    category,
    taskType,
    title,
    exp,
    isCompleted,
    completedAt: isCompleted ? dateStr : null,
    dueDate,
    soilMoistureDry: taskType === 'WATER' ? !postponed : null,
    postponed,
  };
}

/**
 * 지난달 샘플 기록 만들기 (실제 체크리스트 기록 없이 리포트를 시험하기 위해) — 모든 문서에 sample: true
 * 체크리스트 약 20일치(완료·미완료·미룬 물주기 섞음) + 사진 3장 + aiHistory 4개
 * @returns {Promise<{ checklists: number, photos: number, aiHistory: number }>}
 */
export async function devCreateSampleMonth(plantId, month) {
  const path = plantPath(plantId);
  const batch = writeBatch(db);
  const days = Math.min(20, daysInMonth(month));

  // 1) 체크리스트
  for (let d = 1; d <= days; d++) {
    const dateStr = `${month}-${String(d).padStart(2, '0')}`;
    const items = [
      sampleItem('VENTILATE', '창문 열고 환기하기', { exp: 5, category: 'DAILY_MICRO', isCompleted: d % 4 !== 0, dateStr }),
      sampleItem('CHECK_LEAF', '잎 상태 살펴보기', { exp: 5, category: 'DAILY_MICRO', isCompleted: d % 3 !== 0, dateStr }),
    ];
    // 5일·12일·19일에는 물주기 (12일은 흙이 축축해서 미룸)
    if (d === 5 || d === 12 || d === 19) {
      const postponed = d === 12;
      items.push(
        sampleItem('WATER', '물주기', { exp: 20, category: 'PERIODIC_CARE', isCompleted: !postponed, dateStr, dueDate: dateStr, postponed }),
      );
    }
    batch.set(doc(db, ...path, 'checklists', dateStr), {
      items,
      generatedBy: 'DEFAULT',
      sample: true,
      createdAt: serverTimestamp(),
    });
  }

  // 2) 사진 3장 (작은 SVG)
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#e6f4ea"/><circle cx="32" cy="30" r="14" fill="#5ba672"/></svg>';
  const image = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  for (const day of ['03', '10', '18']) {
    batch.set(doc(collection(db, ...path, 'photos')), {
      image,
      date: `${month}-${day}`,
      diagnosis: null,
      sample: true,
      createdAt: serverTimestamp(),
    });
  }

  // 3) aiHistory 4개
  const histories = [
    { type: 'ENVIRONMENT', summary: { date: `${month}-04`, score: 85, lightLevel: 'OK', tips: '간접광이 좋아요' } },
    { type: 'PHOTO_DIAGNOSIS', summary: { date: `${month}-10`, summaryTag: '건강해요' } },
    { type: 'CHECKLIST', summary: { date: `${month}-15`, titles: ['창문 열고 환기하기', '잎 상태 살펴보기'] } },
    { type: 'ENVIRONMENT', summary: { date: `${month}-19`, score: 78, lightLevel: 'OK', tips: '습도 유지 좋아요' } },
  ];
  for (const h of histories) {
    batch.set(doc(collection(db, ...path, 'aiHistory')), { ...h, sample: true, createdAt: serverTimestamp() });
  }

  await batch.commit();
  return { checklists: days, photos: 3, aiHistory: histories.length };
}

// sample: true 인 문서만 지우기. 반환: 지운 개수
export async function devClearSamples(plantId) {
  let deleted = 0;
  for (const sub of ['checklists', 'photos', 'aiHistory']) {
    const snap = await getDocs(query(collection(db, ...plantPath(plantId), sub), where('sample', '==', true)));
    await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
    deleted += snap.size;
  }
  return deleted;
}

// 그 달 리포트 지우기 (다시 생성되는지 확인용)
export async function devDeleteReport(plantId, month) {
  await deleteDoc(doc(db, ...plantPath(plantId), 'monthlyReports', month));
}
