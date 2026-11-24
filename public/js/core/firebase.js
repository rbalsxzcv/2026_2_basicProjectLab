/**
 * 파일: public/js/core/firebase.js
 * 역할: Firebase 초기화(app, auth, db, App Check, AI)와 자주 쓰는 함수 다시 내보내기
 * 사용하는 파일: core/firebase-config.js (+ Firebase 공식 CDN 모듈)
 * 담당: C1
 *
 * ★ 다른 모든 파일은 Firebase 함수를 "이 파일에서만" 가져옵니다.
 *   예) import { db, doc, getDoc } from '../core/firebase.js';
 *   그래서 CDN 주소와 SDK 버전은 이 파일 한 곳에만 있습니다.
 *
 * localhost 에서 AI real 모드를 쓰려면 App Check 디버그 토큰 등록이 필요합니다 → manual/03-real-ai-mode.md
 */

// SDK 버전은 여기 한 곳에서만 바꿉니다. (공식 CDN 예제: https://firebase.google.com/docs/web/alt-setup)
// 아래 import 주소의 숫자도 같이 바꿔야 합니다. (import 주소에는 변수를 쓸 수 없어서 직접 적음)
export const FIREBASE_VERSION = '13.3.0';

// import: 다른 파일(여기서는 인터넷의 Firebase 모듈)에 있는 함수를 가져와 쓰는 문법입니다.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.3.0/firebase-app.js';
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from 'https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js';
import {
  getFirestore,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp,
  increment,
  writeBatch,
  runTransaction,
  onSnapshot,
  documentId,
} from 'https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js';
import {
  getAI,
  getGenerativeModel,
  GoogleAIBackend,
  ResponseModality,
} from 'https://www.gstatic.com/firebasejs/13.3.0/firebase-ai.js';
import {
  initializeAppCheck,
  ReCaptchaV3Provider,
} from 'https://www.gstatic.com/firebasejs/13.3.0/firebase-app-check.js';

import { firebaseConfig, appCheckSiteKey, appCheckDebugToken, isFirebaseConfigured } from './firebase-config.js';

// 설정이 비어 있으면 null 로 두고, app.js 가 설정 안내 화면을 보여 줍니다.
let app = null;
let auth = null;
let db = null;
let ai = null;

if (isFirebaseConfigured) {
  app = initializeApp(firebaseConfig);

  // ── App Check: AI를 쓰기 "전에" 먼저 켜야 합니다 ──
  if (appCheckSiteKey) {
    try {
      // 배포 주소가 아니면(localhost, 내부 IP 등) reCAPTCHA 대신 디버그 토큰을 씁니다.
      //  - appCheckDebugToken(firebase-config.js) 이 있으면 그 고정 토큰 사용
      //    → 콘솔에 한 번만 등록하면 어느 PC·브라우저에서도, 사이트 데이터를 지워도 계속 동작
      //  - 비어 있으면 브라우저마다 임의 토큰 생성 (콘솔에 찍힌 토큰을 Firebase 에 등록해야 함)
      const isDeployed = /\.(web\.app|firebaseapp\.com)$/.test(location.hostname);
      if (!isDeployed) {
        self.FIREBASE_APPCHECK_DEBUG_TOKEN = appCheckDebugToken || true;
      }
      initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(appCheckSiteKey),
        isTokenAutoRefreshEnabled: true, // 토큰이 만료되기 전에 자동으로 새로 받기
      });
    } catch (error) {
      console.warn('[firebase] App Check 초기화 실패 — AI 실제 모드가 동작하지 않을 수 있어요.', error);
    }
  } else {
    console.info('[firebase] App Check 사이트 키가 비어 있어 건너뜁니다. (AI는 mock 모드로 사용하세요)');
  }

  auth = getAuth(app);
  db = getFirestore(app);

  // ── AI (Firebase AI Logic, Gemini Developer API) ──
  // 실패해도 앱은 계속 동작해야 하므로 try/catch 로 감싸고, 실패하면 ai = null (mock 모드 사용)
  try {
    ai = getAI(app, { backend: new GoogleAIBackend() });
  } catch (error) {
    console.warn('[firebase] AI 초기화 실패 — mock 모드로만 사용할 수 있어요.', error);
    ai = null;
  }
} else {
  console.warn('[firebase] Firebase 설정이 비어 있어요. public/js/core/firebase-config.js 를 채워 주세요.');
}

export { app, auth, db, ai };

// 다른 파일이 CDN 주소를 몰라도 되도록 자주 쓰는 함수를 다시 내보냅니다.
export {
  // Firestore
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp,
  increment,
  writeBatch,
  runTransaction,
  onSnapshot,
  documentId,
  // Auth
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  // AI
  getGenerativeModel,
  ResponseModality,
};
