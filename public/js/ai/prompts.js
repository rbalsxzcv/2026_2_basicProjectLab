/**
 * 파일: public/js/ai/prompts.js
 * 역할: public/prompts/<이름>.<버전>.txt 템플릿을 불러와 {변수}를 채움
 * 사용하는 파일: core/ai-config.js
 * 담당: C2
 *
 * 예) fill('advice', { speciesName: '몬스테라', symptoms: '잎 끝 갈변', ... })
 *     → advice.v1.txt 안의 {speciesName} 이 '몬스테라' 로 바뀐 글자
 */

import { PROMPT_VERSION } from '../core/ai-config.js';

const cache = new Map(); // 'advice.v1' → 템플릿 글자
const EMPTY_TEXT = '정보 없음';

// 템플릿 파일 불러오기 (한 번 불러온 건 기억해 두고 다시 씀)
export async function loadTemplate(name, version = PROMPT_VERSION) {
  const key = `${name}.${version}`;
  if (cache.has(key)) return cache.get(key);
  const response = await fetch(`prompts/${key}.txt`);
  if (!response.ok) throw new Error(`프롬프트 파일을 찾지 못했어요: prompts/${key}.txt`);
  const text = await response.text();
  cache.set(key, text);
  return text;
}

function isEmpty(value) {
  return (
    value === undefined ||
    value === null ||
    value === '' ||
    (Array.isArray(value) && value.length === 0)
  );
}

function toText(value) {
  if (isEmpty(value)) return EMPTY_TEXT;
  if (typeof value === 'object') return JSON.stringify(value); // 객체·배열은 JSON 글자로
  return String(value);
}

export async function fill(name, vars = {}, { version = PROMPT_VERSION } = {}) {
  const template = await loadTemplate(name, version);
  // {영문변수} 모양만 바꿉니다. JSON 예시의 { "key": ... } 는 공백·따옴표가 있어서 건드리지 않음
  return template.replace(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (match, key) => {
    if (!(key in vars)) {
      console.warn(`[prompts] ${name}.${version} 의 {${key}} 값이 없어 '${EMPTY_TEXT}'으로 채웠어요`);
      return EMPTY_TEXT;
    }
    return toText(vars[key]);
  });
}
