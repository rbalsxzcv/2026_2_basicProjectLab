/**
 * 파일: public/js/core/ai-config.js
 * 역할: AI·날씨 동작 모드, 프롬프트 버전, 모델 이름, 하루 호출 한도를 한곳에서 관리
 * 사용하는 파일: 없음
 * 담당: C2
 *
 * ★ main 브랜치에는 항상 AI_MODE = 'mock' 으로 둡니다.
 *   각자 실제 AI를 시험할 때는 이 파일을 고치지 말고 #/dev 화면의 스위치를 쓰세요.
 *   (스위치는 내 브라우저의 localStorage 에만 저장되어 다른 사람에게 영향이 없습니다)
 *
 * ───────── 실제 AI(real) 모드 준비 방법 ─────────
 * 1) Firebase 콘솔 → [AI Services] → [AI Logic] → [시작하기] → "Gemini Developer API" 선택
 *    (무료 Spark 요금제에서 사용 가능). App Check 도 함께 등록합니다 (firebase-config.js 주석 참고).
 * 2) 공식 문서의 모델 목록에서 이름을 골라 아래 AI_MODELS 에 적습니다.
 *    https://firebase.google.com/docs/ai-logic/models
 *    - text   : 글만 주고받는 모델 (예: 문서에 나온 "gemini-…-flash" 계열 이름)
 *    - vision : 사진을 함께 보내는 모델. 비워 두면 text 모델을 씁니다(Gemini는 대부분 사진도 읽음).
 *    - image  : 이미지를 "만들어 주는" 모델 (예: 이름에 "image" 가 들어간 모델).
 *               무료 요금제에서 안 되면 '' 로 두세요 → 캐릭터는 mock SVG 로 그려집니다.
 *    ※ 모델 이름은 자주 바뀌니 꼭 공식 문서에서 그대로 복사하세요. (짐작해서 적지 않기)
 * 3) #/dev → "AI 테스트" 구역에서 AI 모드를 real 로 바꾸고 버튼을 눌러 확인합니다.
 */

export const AI_MODE = 'mock'; // 'mock' = 가짜 응답 / 'real' = Firebase AI Logic
export const WEATHER_MODE = 'mock'; // 'mock' = 가짜 날씨 / 'real' = Open-Meteo
export const PROMPT_VERSION = 'v1'; // public/prompts/*.v1.txt
export const AI_MODELS = { text: 'gemini-3.5-flash-lite', vision: '', image: '' }; // 공식 문서의 모델 이름
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
