/**
 * 파일: public/js/ai/json.js
 * 역할: AI 응답 글자에서 JSON 꺼내기, 빠진 값을 기본값으로 채우기
 * 사용하는 파일: 없음
 */

// AI가 ```json ... ``` 으로 감싸거나 앞뒤에 말을 붙여도 JSON 부분만 꺼내서 객체로 바꿉니다.
// 실패하면 오류를 던집니다.
export function extractJson(text) {
  if (typeof text !== 'string') throw new Error('응답이 글자가 아니에요');
  const noFence = text.replace(/```(?:json)?/gi, '');
  const start = noFence.indexOf('{');
  const end = noFence.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('응답에서 JSON을 찾지 못했어요');
  return JSON.parse(noFence.slice(start, end + 1));
}

// obj 에 없는 키를 defaults 로 채움 (1단계 깊이만)
export function withDefaults(obj, defaults) {
  const source = obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : {};
  const result = { ...source };
  for (const [key, value] of Object.entries(defaults ?? {})) {
    if (result[key] === undefined || result[key] === null || result[key] === '') {
      result[key] = Array.isArray(value) ? [...value] : value;
    }
  }
  return result;
}
