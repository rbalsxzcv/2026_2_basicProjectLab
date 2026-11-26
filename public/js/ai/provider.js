/**
 * 파일: public/js/ai/provider.js
 * 역할: AI 어댑터 — "어떤 AI를 어떻게 부르는지" 아는 유일한 파일
 *       - mock 모드: public/mocks/*.json 가짜 응답 + 코드로 그린 캐릭터 SVG
 *       - real 모드: Firebase AI Logic (Gemini Developer API)
 * 사용하는 파일: core/firebase.js, core/ai-config.js, ai/json.js, ai/usage.js
 *
 * ★ 페이지·서비스는 이 파일을 직접 부르지 말고 core/ai.js 의 함수를 쓰세요. (예외: pages/prompt-lab.js 프롬프트 실험실)
 * ★ 사진이나 프롬프트 본문은 절대 콘솔에 찍지 않습니다. (길이만)
 *
 * 이 파일이 던지는 오류에는 code 가 붙어 있고, core/ai.js 가 한국어 안내 문구로 바꿉니다.
 *   'LIMIT'   하루 한도 초과 / 'TIMEOUT' 응답 지연 / 'PARSE' JSON 해석 실패 / 'NO_IMAGE' 이미지 없음
 */

import { ai, getGenerativeModel, ResponseModality } from '../core/firebase.js';
import { AI_MODELS, AI_TIMEOUT_MS, AI_FALLBACK_TO_MOCK, getAiMode } from '../core/ai-config.js';
import { extractJson } from './json.js';
import { checkAndCount } from './usage.js';

// mock 응답이 여러 개인 기능 → 무작위로 하나 고름 (diagnose-1: 정상, diagnose-2: 관찰 필요)
const MOCK_VARIANTS = { diagnose: ['diagnose-1', 'diagnose-2'] };

function codedError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

// ───────── 모드 판단 ─────────

let warnedNotReady = false;

// real 모드를 실제로 쓸 수 있는지. 준비가 안 됐으면 경고를 한 번만 찍고 mock 처럼 동작
function canUseReal() {
  if (getAiMode() !== 'real') return false;
  if (ai && AI_MODELS.text) return true;
  if (!warnedNotReady) {
    warnedNotReady = true;
    console.warn(
      '[ai] real 모드지만 준비가 안 됐어요 (AI_MODELS.text 비어 있음 또는 Firebase AI 초기화 실패). mock 으로 동작합니다.',
    );
  }
  return false;
}

// ───────── mock ─────────

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomDelay() {
  return wait(600 + Math.random() * 600);
}

async function mockJson(name) {
  const variants = MOCK_VARIANTS[name];
  const file = variants ? variants[Math.floor(Math.random() * variants.length)] : name;
  await randomDelay();
  const response = await fetch(`mocks/${file}.json`);
  if (!response.ok) throw new Error(`mock 파일을 찾지 못했어요: mocks/${file}.json`);
  return response.json();
}

// 둥근 화분 + 웃는 얼굴 + 잎 3장의 귀여운 캐릭터를 SVG로 그려 data URL 로 돌려줌
function mockCharacterSvg() {
  const hue = 95 + Math.floor(Math.random() * 50); // 잎 색을 조금씩 다르게
  const leaf = `hsl(${hue}, 45%, 62%)`;
  const leafDark = `hsl(${hue}, 40%, 48%)`;
  const potHue = [20, 30, 200, 330][Math.floor(Math.random() * 4)];
  const pot = `hsl(${potHue}, 60%, 82%)`;
  const potDark = `hsl(${potHue}, 45%, 70%)`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <ellipse cx="100" cy="186" rx="52" ry="8" fill="#000" opacity="0.08"/>
  <path d="M100 92 C 96 70, 98 52, 100 40" stroke="${leafDark}" stroke-width="5" fill="none" stroke-linecap="round"/>
  <ellipse cx="72" cy="62" rx="28" ry="16" fill="${leaf}" transform="rotate(-28 72 62)"/>
  <ellipse cx="128" cy="62" rx="28" ry="16" fill="${leaf}" transform="rotate(28 128 62)"/>
  <ellipse cx="100" cy="36" rx="14" ry="22" fill="${leaf}"/>
  <path d="M50 96 h100 l-10 80 a10 10 0 0 1 -10 8 h-60 a10 10 0 0 1 -10 -8 z" fill="${pot}"/>
  <rect x="44" y="88" width="112" height="18" rx="9" fill="${potDark}"/>
  <circle cx="82" cy="132" r="6" fill="#2F3A33"/>
  <circle cx="118" cy="132" r="6" fill="#2F3A33"/>
  <circle cx="84" cy="130" r="2" fill="#fff"/>
  <circle cx="120" cy="130" r="2" fill="#fff"/>
  <ellipse cx="70" cy="146" rx="8" ry="5" fill="#F2B880" opacity="0.7"/>
  <ellipse cx="130" cy="146" rx="8" ry="5" fill="#F2B880" opacity="0.7"/>
  <path d="M90 146 q10 10 20 0" stroke="#2F3A33" stroke-width="3.5" fill="none" stroke-linecap="round"/>
</svg>`;
  // btoa: 글자를 base64 로 바꾸는 브라우저 기본 함수 (위 SVG는 영문만 있어서 바로 변환 가능)
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

// ───────── real (Firebase AI Logic) ─────────

// 'data:image/jpeg;base64,AAAA' → { mimeType: 'image/jpeg', data: 'AAAA' }
function splitDataUrl(dataUrl) {
  const match = /^data:([^;,]+);base64,(.*)$/.exec(dataUrl ?? '');
  if (!match) throw new Error('이미지 형식이 올바르지 않아요');
  return { mimeType: match[1], data: match[2] };
}

// 프롬프트(+사진)을 SDK가 받는 모양으로 만들기. 사진은 inlineData 조각으로 보냅니다.
function buildParts(prompt, imageBase64) {
  if (!imageBase64) return prompt;
  const { mimeType, data } = splitDataUrl(imageBase64);
  return [prompt, { inlineData: { mimeType, data } }];
}

// SDK 자체 timeout 이 있지만, 혹시 모를 상황을 위해 한 번 더 시간 제한을 겁니다.
function withTimeout(promise) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(codedError('TIMEOUT', 'AI 응답 시간 초과')), AI_TIMEOUT_MS + 2000);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function countOrThrow(kind) {
  if (!checkAndCount(kind)) throw codedError('LIMIT', '오늘 AI 호출 한도를 넘었어요');
}

async function realJson({ prompt, imageBase64 }) {
  const kind = imageBase64 ? 'vision' : 'text';
  const modelName = imageBase64 ? AI_MODELS.vision || AI_MODELS.text : AI_MODELS.text;
  // getGenerativeModel(ai, 모델 설정, 요청 옵션) — Firebase AI Logic 공식 문서 형식
  const model = getGenerativeModel(
    ai,
    {
      model: modelName,
      systemInstruction: 'JSON으로만 답하세요.',
      generationConfig: { responseMimeType: 'application/json' },
    },
    { timeout: AI_TIMEOUT_MS },
  );

  // JSON 해석에 실패하면 같은 프롬프트로 딱 한 번 더 시도
  for (let attempt = 1; attempt <= 2; attempt++) {
    countOrThrow(kind);
    const result = await withTimeout(model.generateContent(buildParts(prompt, imageBase64)));
    try {
      return extractJson(result.response.text());
    } catch (error) {
      console.warn(`[ai] JSON 해석 실패 (${attempt}번째)`);
      if (attempt === 2) throw codedError('PARSE', 'AI 응답을 해석하지 못했어요');
    }
  }
  throw codedError('PARSE', 'AI 응답을 해석하지 못했어요');
}

async function realImage({ prompt, imageBase64 }) {
  countOrThrow('image');
  // 이미지 생성 모델: 응답에 글자와 이미지를 모두 받도록 설정 (공식 문서의 Gemini 이미지 생성 방식)
  const model = getGenerativeModel(
    ai,
    {
      model: AI_MODELS.image,
      generationConfig: { responseModalities: [ResponseModality.TEXT, ResponseModality.IMAGE] },
    },
    { timeout: AI_TIMEOUT_MS },
  );
  const result = await withTimeout(model.generateContent(buildParts(prompt, imageBase64)));
  const parts = result.response.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((part) => part.inlineData?.data);
  if (!imagePart) throw codedError('NO_IMAGE', 'AI가 이미지를 돌려주지 않았어요');
  return `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
}

// ───────── 내보내는 함수 ─────────

// name: 프롬프트·mock 파일 이름 (예: 'diagnose'). 반환: 응답 객체
export async function generateJson({ name, prompt, imageBase64 = null }) {
  const startedAt = performance.now();
  const promptLength = prompt?.length ?? 0;
  try {
    if (!canUseReal()) return await mockJson(name);
    try {
      return await realJson({ prompt, imageBase64 });
    } catch (error) {
      if (!AI_FALLBACK_TO_MOCK) throw error;
      console.warn('[ai] 실제 호출 실패 → mock 으로 대체 (AI_FALLBACK_TO_MOCK)', name, error.code ?? error.message);
      return await mockJson(name);
    }
  } finally {
    console.info('[ai]', name, promptLength, Math.round(performance.now() - startedAt));
  }
}

// 반환: 이미지 data URL 문자열
export async function generateImage({ prompt, imageBase64 = null }) {
  const startedAt = performance.now();
  const promptLength = prompt?.length ?? 0;
  try {
    // 이미지 모델 이름이 비어 있으면 항상 mock SVG
    if (!canUseReal() || !AI_MODELS.image) {
      await randomDelay();
      return mockCharacterSvg();
    }
    try {
      return await realImage({ prompt, imageBase64 });
    } catch (error) {
      if (!AI_FALLBACK_TO_MOCK) throw error;
      console.warn('[ai] 이미지 생성 실패 → mock SVG 로 대체 (AI_FALLBACK_TO_MOCK)', error.code ?? error.message);
      return mockCharacterSvg();
    }
  } finally {
    console.info('[ai]', 'character', promptLength, Math.round(performance.now() - startedAt));
  }
}
