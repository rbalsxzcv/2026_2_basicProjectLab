/**
 * 파일: public/js/services/aiHistory.js
 * 역할: AI 분석 결과의 "짧은 요약" 기록 — plants/{id}/aiHistory/{historyId} (원칙 4: AI 맥락 저장)
 * 사용하는 파일: core/firebase.js, core/store.js, utils/date.js
 *
 * ★ 사진(data URL)은 절대 넣지 않습니다. 다음 AI 호출 때 최근 몇 개만 함께 보냅니다.
 *   문서 모양: { type: 'PHOTO_DIAGNOSIS'|'ENVIRONMENT'|'CHECKLIST', summary: {...}, createdAt }
 */

import { db, collection, addDoc, getDocs, query, where, orderBy, limit, serverTimestamp } from '../core/firebase.js';
import { store } from '../core/store.js';
import { today, monthRange } from '../utils/date.js';

const TYPES = ['PHOTO_DIAGNOSIS', 'ENVIRONMENT', 'CHECKLIST'];
const MAX_TEXT = 200;
const FETCH_FOR_FILTER = 20; // type 으로 거를 때 최신 20개를 가져와 화면 쪽에서 거름 (색인 없이)

function currentUid() {
  const uid = store.get('user')?.uid;
  if (!uid) throw new Error('로그인이 필요해요');
  return uid;
}

function historyCol(plantId) {
  return collection(db, 'users', currentUid(), 'plants', plantId, 'aiHistory');
}

// 요약 정리: 글자는 200자까지, data URL(사진)은 빼고 경고
function cleanSummary(value, depth = 0) {
  if (typeof value === 'string') {
    if (value.startsWith('data:')) return undefined;
    return value.slice(0, MAX_TEXT);
  }
  if (Array.isArray(value)) {
    return value.map((v) => cleanSummary(v, depth + 1)).filter((v) => v !== undefined);
  }
  if (value && typeof value === 'object' && depth < 3) {
    const out = {};
    for (const [key, v] of Object.entries(value)) {
      if (typeof v === 'string' && v.startsWith('data:')) {
        console.warn(`[aiHistory] summary.${key} 에 사진(data URL)이 있어 저장하지 않았어요.`);
        continue;
      }
      const cleaned = cleanSummary(v, depth + 1);
      if (cleaned !== undefined) out[key] = cleaned;
    }
    return out;
  }
  return value;
}

// 요약 하나 추가. summary.date 는 오늘 날짜로 자동 설정
export async function addHistory(plantId, type, summary) {
  if (!TYPES.includes(type)) throw new Error(`알 수 없는 기록 종류예요: ${type}`);
  const cleaned = { ...cleanSummary(summary ?? {}), date: today() };
  const ref = await addDoc(historyCol(plantId), { type, summary: cleaned, createdAt: serverTimestamp() });
  return { id: ref.id, type, summary: cleaned };
}

// 최근 요약 n개 (최신순). AI 요청에 그대로 넣을 수 있는 summary 배열
export async function getRecentHistory(plantId, { n = 5, type } = {}) {
  const q = query(historyCol(plantId), orderBy('createdAt', 'desc'), limit(type ? Math.max(FETCH_FOR_FILTER, n) : n));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => d.data())
    .filter((h) => !type || h.type === type)
    .slice(0, n)
    .map((h) => ({ type: h.type, ...h.summary }));
}

// 그 달('YYYY-MM')의 요약들 (summary.date 글자 범위로 검색). 날짜 오름차순
export async function getHistoryInMonth(plantId, month) {
  const { start, end } = monthRange(month);
  const q = query(historyCol(plantId), where('summary.date', '>=', start), where('summary.date', '<=', end));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => d.data())
    .sort((a, b) => String(a.summary?.date).localeCompare(String(b.summary?.date)))
    .map((h) => ({ type: h.type, ...h.summary }));
}
