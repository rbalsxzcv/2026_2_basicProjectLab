/**
 * 파일: public/js/core/firebase-config.js
 * 역할: Firebase 웹 앱 설정값과 App Check 사이트 키를 한곳에 모아 둠
 * 사용하는 파일: core/firebase.js, app.js
 * 담당: C1
 *
 * 값 넣는 방법: manual/02-firebase-setup.md, App Check 사이트 키: manual/03-real-ai-mode.md
 * ※ 이 값들은 공개되어도 괜찮은 값입니다. 데이터 보호는 firestore.rules 와 App Check 가 담당합니다.
 *   (reCAPTCHA "비밀 키"는 절대 여기에 넣지 않습니다. 디버그 토큰은 편의를 위해 의도적으로 넣어 둠 — 아래 설명 참고)
 */

// Firebase 콘솔 → 프로젝트 설정 → 내 앱 → 웹 앱 의 firebaseConfig 값
export const firebaseConfig = {
  apiKey: "AIzaSyBN4EVKIOj0xIvWF90xFUbRkQVpt-20kVc",
  authDomain: "basicprojectlabgrove.firebaseapp.com",
  projectId: "basicprojectlabgrove",
  storageBucket: "basicprojectlabgrove.firebasestorage.app",
  messagingSenderId: "659104238203",
  appId: "1:659104238203:web:06b8e6b62df19e8ee030de",
  measurementId: "G-TBMR3ETW8J"
};

// App Check(reCAPTCHA v3) 사이트 키. 비어 있으면 App Check 를 건너뜀 (AI real 모드 사용 불가, mock 은 동작)
export const appCheckSiteKey = '6LcaNSYuAAAAAABCTeoYNz6aBpbqovqrmFMOodCX';

// App Check 고정 디버그 토큰 — 배포 주소(*.web.app, *.firebaseapp.com)가 아닌 곳(localhost, 내부 IP 등)에서 사용
// Firebase 콘솔 → App Check → 앱 → ⋮ → 디버그 토큰 관리 에 이 값을 "한 번만" 등록하면 어느 PC 에서나 바로 AI 호출 가능
// ⚠ 보안 절충: 이 값이 Git 에 올라가므로, 저장소를 볼 수 있는 사람은 App Check 를 통과할 수 있습니다.
//   유출이 걱정되면 콘솔에서 이 토큰을 삭제하고 새 UUID 로 바꾸세요. 비우면('') 브라우저마다 임의 토큰 방식으로 돌아갑니다.
export const appCheckDebugToken = '0286a3e7-b36b-43d7-9fa9-a911d3c145c2';

// apiKey가 아직 'YOUR_'로 시작하면 설정이 안 된 것으로 봅니다.
export const isFirebaseConfigured = !firebaseConfig.apiKey.startsWith('YOUR_');
