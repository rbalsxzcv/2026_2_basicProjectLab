/**
 * 파일: public/js/core/ai.js
 * 역할: ★ 앱이 부르는 AI 함수 7개 (캐릭터·진단·처방·환경·체크리스트·월간 리포트·새 식물 종류) + AiError
 * 사용하는 파일: ai/normalize.js, ai/prompts.js, ai/provider.js, ai/json.js
 *
 * 사용 예)
 *   import { diagnose, AiError } from '../core/ai.js';
 *   try {
 *     const result = await diagnose({ imageBase64, speciesName: '몬스테라' });
 *   } catch (error) {
 *     toast(error.message, 'error');   // error.message 는 사용자에게 보여 줄 한국어 문구
 *   }
 *
 * ★ 이 파일은 Firestore 에 저장하지 않습니다. 결과를 돌려주기만 하고, 저장은 부르는 쪽(services)이 합니다.
 */

import { RULES } from '../ai/normalize.js';
import { fill } from '../ai/prompts.js';
import { generateJson, generateImage } from '../ai/provider.js';
import { withDefaults } from '../ai/json.js';

// 사용자에게 그대로 보여 줘도 되는 한국어 메시지를 담은 오류
export class AiError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AiError';
  }
}

const MESSAGES = {
  generic: 'AI 코치가 잠시 쉬는 중이에요. 잠시 후 다시 시도해 주세요.',
  timeout: '응답이 너무 늦어요. 잠시 후 다시 시도해 주세요.',
  offline: '인터넷 연결을 확인해 주세요.',
  limit: '오늘 AI 코치 이용량을 모두 썼어요. 내일 다시 만나요!',
};

const HISTORY_MAX_ITEMS = 10;
const HISTORY_ITEM_MAX_CHARS = 300;

// 프롬프트에 넣기 전에 긴 기록을 줄입니다 (최대 10개, 하나당 JSON 300자)
function trimHistory(items) {
  if (!Array.isArray(items)) return [];
  return items.slice(0, HISTORY_MAX_ITEMS).map((item) => {
    const json = JSON.stringify(item);
    return json.length > HISTORY_ITEM_MAX_CHARS ? json.slice(0, HISTORY_ITEM_MAX_CHARS) : item;
  });
}

function trimInput(input) {
  const copy = { ...input };
  if ('recentHistory' in copy) copy.recentHistory = trimHistory(copy.recentHistory);
  if ('monthlyHistory' in copy) copy.monthlyHistory = trimHistory(copy.monthlyHistory);
  return copy;
}

// 어떤 오류든 사용자에게 보여 줄 AiError 로 바꿈 (자세한 내용은 콘솔에만)
function toAiError(error) {
  if (error instanceof AiError) return error;
  if (error?.code === 'LIMIT') return new AiError(MESSAGES.limit);
  const isTimeout =
    error?.code === 'TIMEOUT' ||
    error?.name === 'TimeoutError' ||
    error?.name === 'AbortError' ||
    /timeout|timed out|aborted/i.test(String(error?.message ?? ''));
  if (isTimeout) return new AiError(MESSAGES.timeout);
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return new AiError(MESSAGES.offline);
  console.warn('[ai] 호출 실패', error?.code ?? '', error?.message ?? error);
  return new AiError(MESSAGES.generic);
}

/**
 * 모든 AI 함수가 공통으로 거치는 단계
 * ① 입력 확인 → ② 긴 입력 줄이기 → ③ 프롬프트 채우기 → ④ AI 호출 → ⑤ 기본값 채우기·다듬기
 * @param {string} name  프롬프트·mock 파일 이름
 * @param {object} input
 * @param {{kind: 'text'|'vision'|'image'}} options
 */
async function aiCall(name, input, { kind }) {
  const rule = RULES[name];

  // ① 입력 확인 — 빠진 값이 있으면 바로 한국어 안내
  const problem = rule.validate(input ?? {});
  if (problem) throw new AiError(problem);

  try {
    // ② ③
    const trimmed = trimInput(input);
    const prompt = await fill(name, rule.buildVars(trimmed));
    const imageBase64 = kind === 'text' ? null : input.imageBase64;

    // ④
    let result;
    if (kind === 'image') {
      result = { imageBase64: await generateImage({ prompt, imageBase64 }) };
    } else {
      result = await generateJson({ name, prompt, imageBase64 });
    }

    // ⑤ ⑥
    return rule.normalize(withDefaults(result, rule.defaults));
  } catch (error) {
    throw toAiError(error);
  }
}

// 사진 → 데포르메 캐릭터 이미지 { imageBase64 }
export function generateCharacter({ imageBase64, speciesName } = {}) {
  return aiCall('character', { imageBase64, speciesName }, { kind: 'image' });
}

// 사진 → 증상 관찰 + 흙 상태 질문 { symptoms, severity, question, options[3] }
export function diagnose({ imageBase64, speciesName } = {}) {
  return aiCall('diagnose', { imageBase64, speciesName }, { kind: 'vision' });
}

// 증상 + 사용자 답 → 행동 가이드 { advice[2], summaryTag }
export function advise({ speciesName, symptoms, userAnswer, recentHistory = [] } = {}) {
  return aiCall('advice', { speciesName, symptoms, userAnswer, recentHistory }, { kind: 'text' });
}

// 조도·날씨·집 정보 → 환경 조언 { goodPoint, actions[1–2] }
export function analyzeEnvironment(input = {}) {
  return aiCall('environment', input, { kind: 'text' });
}

// 오늘의 데일리 루틴 추천 { items: [{ category, taskType, title }] } (물주기 등은 절대 포함 안 됨)
export function suggestChecklist(input = {}) {
  return aiCall('checklist', input, { kind: 'text' });
}

// 월간 리포트 글 { praise, suggestions[1–2], repotNotice, lifespanNotice }
export function writeMonthlyReport(input = {}) {
  return aiCall('monthly-report', input, { kind: 'text' });
}

// 사용자가 입력한 식물 이름 → 새 식물 종류의 생육 정보
// { isPlant, rejectReason, name, aliases[], luxMin, luxMax, tempMin, tempMax, humidityMin, humidityMax,
//   waterIntervalDays, fertilizeIntervalDays, wipeLeafIntervalDays, repotIntervalDays,
//   lifespanType, defaultLifespanDays, careTip }  (plant-species.json 항목과 같은 모양 + isPlant, rejectReason)
// rejectReason: null | 'NOT_PLANT' | 'NOT_GROWABLE' | 'RESTRICTED'  (isPlant 가 false 일 때 이유)
// isMock: true 면 mock 응답 (AI 가 실제로 판단하지 않음 — 무엇을 넣어도 식물로 나옴)
// ※ Firestore 저장은 services/species.js (previewSpeciesByName → saveSpeciesDraft) 가 합니다.
export async function generateSpecies({ speciesName } = {}) {
  const result = await aiCall('species', { speciesName }, { kind: 'text' });
  // AI(또는 mock)가 이름을 비워 두면 사용자가 입력한 이름을 그대로 씀
  if (!result.name) result.name = String(speciesName).trim();
  return result;
}
