/**
 * 파일: public/js/services/diagnosis.js
 * 역할: 사진 진단의 AI 호출(관찰 → 처방)과 aiHistory 에 남길 요약 만들기 (화면 없음)
 * 사용하는 파일: core/ai.js, services/aiHistory.js
 *
 * ※ Firestore 저장은 ui/diagnosis-flow.js 가 photos · aiHistory 서비스를 불러서 합니다.
 */

import { diagnose, advise } from '../core/ai.js';
import { getRecentHistory } from './aiHistory.js';

const HISTORY_WAIT_MS = 5000; // 최근 기록은 보조 정보라 오래 기다리지 않음

// 1단계: 사진 → { symptoms, severity, question, options }
export async function startDiagnosis({ imageDataUrl, speciesName }) {
  return diagnose({ imageBase64: imageDataUrl, speciesName });
}

// 2단계: 관찰 + 사용자가 확인한 흙 상태 + 최근 기록 → { advice, summaryTag }
export async function finishDiagnosis({ plantId, speciesName, first, userAnswer }) {
  // 최근 기록 읽기가 (오프라인 등으로) 끝나지 않아도 로딩 화면이 멈추지 않게, 잠시 기다린 뒤 빈 기록으로 진행
  const recentHistory = await Promise.race([
    getRecentHistory(plantId, { n: 5 }).catch(() => []),
    new Promise((resolve) => setTimeout(() => resolve([]), HISTORY_WAIT_MS)),
  ]);
  return advise({ speciesName, symptoms: first.symptoms, userAnswer, recentHistory });
}

// aiHistory 에 남길 짧은 요약 (사진 없음)
export function buildHistorySummary({ first, userAnswer, result }) {
  return {
    symptoms: first.symptoms,
    severity: first.severity,
    userAnswer,
    summaryTag: result.summaryTag,
    advice: result.advice.join(' / '),
  };
}
