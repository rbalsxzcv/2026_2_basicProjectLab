/**
 * 사진 진단의 AI 호출과 기록 요약을 담당합니다. Firestore 쓰기는 화면 흐름에서 합니다.
 */
import { diagnose, advise } from '../core/ai.js';
import { getRecentHistory } from './aiHistory.js';
import { db, collection, getDocs, query, where, deleteDoc } from '../core/firebase.js';
import { store } from '../core/store.js';

export async function startDiagnosis({ imageDataUrl, speciesName }) {
  return diagnose({ imageBase64: imageDataUrl, speciesName });
}

export async function finishDiagnosis({ plantId, speciesName, first, userAnswer }) {
  // Firestore 읽기가 오프라인/권한/초기화 문제로 끝나지 않으면
  // P1의 로딩 오버레이가 영원히 남는다. 최근 기록은 보조 정보이므로
  // 짧게 기다린 뒤 비워진 기록으로 진단을 계속한다.
  const recentHistory = await Promise.race([
    getRecentHistory(plantId, { n: 5 }).catch(() => []),
    new Promise((resolve) => setTimeout(() => resolve([]), 5000)),
  ]);
  return advise({ speciesName, symptoms: first.symptoms, userAnswer, recentHistory });
}

export function buildHistorySummary({ first, userAnswer, result }) {
  return {
    symptoms: first.symptoms,
    severity: first.severity,
    userAnswer,
    summaryTag: result.summaryTag,
    advice: result.advice.join(' / '),
  };
}

// 개발 화면에서만 오늘 사진 기록을 비워 하루 1회 경험치 흐름을 다시 확인합니다.
export async function deleteTodaysPhotos(plantId, date) {
  const uid = store.get('user')?.uid;
  if (!uid) throw new Error('로그인이 필요해요');
  const photos = collection(db, 'users', uid, 'plants', plantId, 'photos');
  const snapshot = await getDocs(query(photos, where('date', '==', date)));
  await Promise.all(snapshot.docs.map((photo) => deleteDoc(photo.ref)));
  return snapshot.size;
}
