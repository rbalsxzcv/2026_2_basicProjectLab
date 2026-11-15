/**
 * 파일: public/js/utils/dom.js
 * 역할: 안전한 HTML 만들기(html 템플릿, 자동 이스케이프)와 DOM 찾기·이벤트 도우미
 * 사용하는 파일: 없음
 * 담당: C1
 *
 * html 사용법:
 *   container.innerHTML = html`<p>${user.nickname}님</p>`;
 *   → ${} 안의 값은 자동으로 이스케이프되어 <script> 같은 글자가 들어와도 안전합니다.
 *   - 배열은 그대로 이어 붙입니다:  html`<ul>${items.map((i) => html`<li>${i}</li>`)}</ul>`
 *   - html`` 결과를 다시 ${} 에 넣으면 이스케이프하지 않습니다(이미 안전하므로).
 *   - 직접 만든 HTML 문자열을 그대로 넣고 싶을 때만 raw(str) 로 감쌉니다. (사용자 입력에는 절대 X)
 */

// 안전하다고 표시된 HTML 문자열. String 을 상속해서 일반 문자열처럼 innerHTML 에 넣을 수 있습니다.
class SafeHtml extends String {}

const ESCAPE_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ESCAPE_MAP[ch]);
}

// 이미 안전한 HTML 이라고 표시 (이스케이프하지 않음)
export function raw(str) {
  return new SafeHtml(str ?? '');
}

function toHtml(value) {
  if (value === null || value === undefined || value === false) return '';
  if (value instanceof SafeHtml) return String(value);
  if (Array.isArray(value)) return value.map(toHtml).join('');
  return escapeHtml(value);
}

// 태그드 템플릿: html`...` 처럼 백틱 앞에 함수 이름을 붙여 쓰는 문법입니다.
export function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i++) {
    out += toHtml(values[i]) + strings[i + 1];
  }
  return new SafeHtml(out);
}

export function qs(selector, root = document) {
  return root.querySelector(selector);
}

export function qsa(selector, root = document) {
  return [...root.querySelectorAll(selector)];
}

// 이벤트 위임: root 안에서 selector 에 맞는 요소에 이벤트가 생기면 handler(event, 그 요소) 실행
// 반환값: 이벤트를 해제하는 함수
export function on(root, eventName, selector, handler) {
  const listener = (event) => {
    const target = event.target.closest(selector);
    if (target && root.contains(target)) handler(event, target);
  };
  root.addEventListener(eventName, listener);
  return () => root.removeEventListener(eventName, listener);
}
