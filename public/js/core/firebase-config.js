/**
 * 파일: public/js/core/firebase-config.js
 * 역할: Firebase 웹 앱 설정값과 App Check 사이트 키를 한곳에 모아 둠
 * 사용하는 파일: core/firebase.js, app.js
 * 담당: C1
 *
 * ───────── 값 넣는 방법 (Firebase 프로젝트를 만든 뒤 한 번만) ─────────
 * 1) https://console.firebase.google.com 에서 프로젝트를 만듭니다.
 * 2) 왼쪽 위 톱니바퀴 → [프로젝트 설정] → [일반] 탭 → 아래쪽 "내 앱"에서
 *    웹 앱(</> 아이콘)을 추가합니다. (Firebase Hosting 체크는 선택)
 * 3) 화면에 나오는 `const firebaseConfig = { ... }` 안의 값을 아래에 그대로 옮겨 적습니다.
 *    - apiKey            : "AIza..." 로 시작하는 문자열
 *    - authDomain        : "<프로젝트ID>.firebaseapp.com"
 *    - projectId         : 프로젝트 ID
 *    - appId             : "1:숫자:web:영문숫자" 형태
 *    - storageBucket, messagingSenderId 도 나오면 같이 붙여 넣어도 됩니다(없어도 동작).
 * 4) 이 값은 공개되어도 괜찮은 값이라 Git에 올려도 됩니다.
 *    데이터 보호는 firestore.rules(보안 규칙)와 App Check가 담당합니다.
 *
 * 값이 'YOUR_' 로 시작하면 "아직 설정 안 됨"으로 보고, 앱이 설정 안내 화면을 보여 줍니다.
 */

// Firebase 콘솔 → 프로젝트 설정 → 내 앱 → 웹 앱 의 firebaseConfig 값을 붙여 넣으세요.
// 이 값은 공개되어도 괜찮은 값입니다. 데이터 보호는 firestore.rules와 App Check가 담당합니다.
// ※ 콘솔 화면의 import / initializeApp / getAnalytics 줄은 넣지 마세요. (초기화는 firebase.js 가 함)
export const firebaseConfig = {
  apiKey: "AIzaSyBN4EVKIOj0xIvWF90xFUbRkQVpt-20kVc",
  authDomain: "basicprojectlabgrove.firebaseapp.com",
  projectId: "basicprojectlabgrove",
  storageBucket: "basicprojectlabgrove.firebasestorage.app",
  messagingSenderId: "659104238203",
  appId: "1:659104238203:web:06b8e6b62df19e8ee030de",
  measurementId: "G-TBMR3ETW8J"
};

// App Check(reCAPTCHA) 사이트 키 — AI Logic 설정 때 만든 값. 비어 있으면 App Check를 건너뜀.
//
// ───────── App Check 사이트 키 만드는 방법 ─────────
// 1) Firebase 콘솔 → [AI Services] → [AI Logic] → [시작하기] → "Gemini Developer API" 선택.
// 2) 설정 중(또는 콘솔 → [App Check] → [앱] 탭)에서 웹 앱에 "reCAPTCHA v3" 제공자를 등록합니다.
//    reCAPTCHA 관리 콘솔(https://www.google.com/recaptcha/admin)에서 v3 키를 만들 때
//    도메인에 localhost 와 (배포한다면) <프로젝트ID>.web.app 을 추가하세요.
// 3) 만들어진 "사이트 키"(공개용, 6L... 로 시작)를 아래 따옴표 안에 넣습니다.
//    ※ "비밀 키"는 Firebase 콘솔의 App Check 설정에만 넣고, 절대 코드에 넣지 마세요.
// 4) localhost 테스트용 디버그 토큰 등록은 core/firebase.js 맨 위 주석을 보세요.
export const appCheckSiteKey = '6LcaNSYuAAAAAABCTeoYNz6aBpbqovqrmFMOodCX';

// apiKey가 아직 'YOUR_'로 시작하면 설정이 안 된 것으로 봅니다.
export const isFirebaseConfigured = !firebaseConfig.apiKey.startsWith('YOUR_');
