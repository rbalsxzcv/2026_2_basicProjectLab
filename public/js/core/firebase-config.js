/**
 * 파일: public/js/core/firebase-config.js
 * 역할: Firebase 웹 앱 설정값과 App Check 사이트 키를 한곳에 모아 둠
 * 사용하는 파일: core/firebase.js, app.js
 * 담당: C1
 *
 * 값 넣는 방법: manual/02-firebase-setup.md, App Check 사이트 키: manual/03-real-ai-mode.md
 * ※ 이 값들은 공개되어도 괜찮은 값입니다. 데이터 보호는 firestore.rules 와 App Check 가 담당합니다.
 *   (reCAPTCHA "비밀 키"·App Check 디버그 토큰은 절대 여기에 넣지 않습니다)
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

// apiKey가 아직 'YOUR_'로 시작하면 설정이 안 된 것으로 봅니다.
export const isFirebaseConfigured = !firebaseConfig.apiKey.startsWith('YOUR_');
