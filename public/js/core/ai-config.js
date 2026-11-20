/**
 * 파일: public/js/core/ai-config.js
 * 역할: AI·날씨 동작 모드, 프롬프트 버전, 모델 이름, 하루 호출 한도를 한곳에서 관리
 * 사용하는 파일: 없음
 * 담당: C2
 *
 * ★ main 브랜치에는 항상 AI_MODE = 'mock' 으로 둡니다.
 *   실제 AI 는 이 파일을 고치지 말고 #/dev 화면의 스위치로 켭니다 (내 브라우저 localStorage 에만 저장).
 * real 모드 준비·모델 이름 고르는 법: manual/03-real-ai-mode.md
 */

export const AI_MODE = 'mock'; // 'mock' = 가짜 응답 / 'real' = Firebase AI Logic
export const WEATHER_MODE = 'mock'; // 'mock' = 가짜 날씨 / 'real' = Open-Meteo
export const PROMPT_VERSION = 'v1'; // public/prompts/*.v1.txt
// 공식 문서(https://firebase.google.com/docs/ai-logic/models)의 모델 이름 그대로.
// vision 이 비면 text 모델로 사진도 보냄, image 가 비면 캐릭터는 mock SVG
export const AI_MODELS = { text: 'gemini-3.5-flash-lite', vision: '', image: '' };
export const AI_FALLBACK_TO_MOCK = false; // true면 실제 호출 실패 시 mock으로 대체 (시연용 안전장치)
export const AI_DAILY_LIMITS = { text: 200, vision: 100, image: 20 };
export const AI_TIMEOUT_MS = 45000;

const AI_MODE_KEY = 'plantCoach.aiMode';
const WEATHER_MODE_KEY = 'plantCoach.weatherMode';

function readLocal(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocal(key, value) {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    /* localStorage 사용 불가 — 무시 */
  }
}

// localStorage 'plantCoach.aiMode' 우선, 없으면 AI_MODE
export function getAiMode() {
  const saved = readLocal(AI_MODE_KEY);
  return saved === 'real' || saved === 'mock' ? saved : AI_MODE;
}

// localStorage 'plantCoach.weatherMode' 우선, 없으면 WEATHER_MODE
export function getWeatherMode() {
  const saved = readLocal(WEATHER_MODE_KEY);
  return saved === 'real' || saved === 'mock' ? saved : WEATHER_MODE;
}

// #/dev 의 스위치가 부르는 함수 (null 을 넣으면 기본값으로 되돌림)
export function setAiMode(mode) {
  writeLocal(AI_MODE_KEY, mode);
}

export function setWeatherMode(mode) {
  writeLocal(WEATHER_MODE_KEY, mode);
}
