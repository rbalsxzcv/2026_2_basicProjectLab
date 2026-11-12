/**
 * 파일: public/js/services/dev-tools.js
 * 역할: #/dev 테스트 버튼 전용 Firestore 도우미 (개발용 — 배포 시 dev-ui.js 와 함께 제거)
 * 사용하는 파일: core/firebase.js, core/store.js, services/schedules.js
 * 담당: C5
 *
 * ※ 00_MAIN 규칙 3 "Firestore 는 services/ 에서만" 을 지키기 위해, 테스트 버튼이 쓰는 직접 쓰기 작업을
 *   이 파일에 모았습니다. 앱의 실제 화면은 이 파일을 쓰지 않습니다.
 */

import { db, doc, getDoc, updateDoc, deleteDoc } from '../core/firebase.js';
import { store } from '../core/store.js';
import { listSchedules } from './schedules.js';

function currentUid() {
  const uid = store.get('user')?.uid;
  if (!uid) throw new Error('로그인이 필요해요');
  return uid;
}

// 일정 예정일을 원하는 날짜로 바꾸기 (예: 물주기 예정일을 오늘로)
export async function devSetScheduleDueDate(plantId, taskType, dueDate) {
  await updateDoc(doc(db, 'users', currentUid(), 'plants', plantId, 'schedules', taskType), { dueDate });
}

// 그날 체크리스트 지우기 (다시 만들어지는지 확인용)
export async function devDeleteChecklist(plantId, date) {
  await deleteDoc(doc(db, 'users', currentUid(), 'plants', plantId, 'checklists', date));
}

// 식물 문서 + 일정 4개 (화면에 JSON 으로 보여 주기용, 이미지는 길이만)
export async function devDumpPlant(plantId) {
  const snap = await getDoc(doc(db, 'users', currentUid(), 'plants', plantId));
  const plant = snap.exists() ? { id: snap.id, ...snap.data() } : null;
  if (plant?.characterImage?.startsWith('data:')) {
    plant.characterImage = `(data URL, ${plant.characterImage.length}자)`;
  }
  const schedules = await listSchedules(plantId);
  return { plant, schedules };
}
