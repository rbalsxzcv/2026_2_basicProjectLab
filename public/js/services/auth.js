/**
 * 파일: public/js/services/auth.js
 * 역할: 아이디+비밀번호 회원가입 / 로그인 / 로그아웃 / 비밀번호 변경, 오류 문구 변환
 * 사용하는 파일: core/firebase.js, core/store.js, core/router.js, services/users.js
 *
 * ★ 아이디 → 이메일 변환(toAuthEmail)은 이 파일에만 있습니다.
 *   Firebase Authentication 은 이메일이 필요해서 'abc' → 'abc@plantcoach.example' 로 바꿔 씁니다.
 *   (.example 은 실제로 쓰이지 않는 예약 도메인이라 메일이 가지 않습니다)
 */

import {
  auth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from '../core/firebase.js';
import { store } from '../core/store.js';
import { navigate } from '../core/router.js';
import { createProfile, setPendingSignup } from './users.js';

const AUTH_EMAIL_DOMAIN = 'plantcoach.example';

// 가입은 됐지만 회원정보 저장에 실패했을 때 던지는 오류 (화면에서 구분해서 안내)
export class ProfileSaveError extends Error {
  constructor(cause) {
    super('가입은 되었지만 정보 저장에 실패했어요. 내 정보에서 다시 저장해 주세요.');
    this.name = 'ProfileSaveError';
    this.code = 'PROFILE_SAVE_FAILED';
    this.cause = cause;
  }
}

export function toAuthEmail(loginId) {
  return `${String(loginId).trim().toLowerCase()}@${AUTH_EMAIL_DOMAIN}`;
}

// 지금 로그인한 계정의 아이디 (이메일 앞부분)
export function currentLoginId() {
  const email = auth?.currentUser?.email ?? '';
  return email.split('@')[0] ?? '';
}

// 영문 소문자·숫자 4~20자. 문제가 있으면 안내 문구, 괜찮으면 null
export function validateLoginId(loginId) {
  const value = String(loginId ?? '');
  if (!value) return '아이디를 입력해 주세요.';
  if (!/^[a-z0-9]+$/.test(value)) return '아이디는 영문 소문자와 숫자만 쓸 수 있어요.';
  if (value.length < 4 || value.length > 20) return '아이디는 4~20자로 해 주세요.';
  return null;
}

export function validatePassword(pw) {
  if (!pw) return '비밀번호를 입력해 주세요.';
  if (String(pw).length < 6) return '비밀번호는 6자 이상으로 해 주세요.';
  return null;
}

export async function signUp({ loginId, password, nickname, region, homeType }) {
  // 로그인 감시(app.js)가 회원정보 저장이 끝날 때까지 기다리도록 표시
  let finish;
  setPendingSignup(new Promise((resolve) => (finish = resolve)));

  try {
    // 1) 계정 만들기 (성공하면 자동으로 로그인 상태가 됨)
    const credential = await createUserWithEmailAndPassword(auth, toAuthEmail(loginId), password);

    // 2) 회원정보 문서 만들기
    try {
      await createProfile(credential.user.uid, { loginId, nickname, region, homeType });
    } catch (error) {
      console.warn('[auth] 회원정보 저장 실패', error);
      throw new ProfileSaveError(error);
    }
    return credential.user;
  } finally {
    finish();
    setPendingSignup(null);
  }
}

export async function logIn(loginId, password) {
  const credential = await signInWithEmailAndPassword(auth, toAuthEmail(loginId), password);
  return credential.user;
}

export async function logOut() {
  await signOut(auth);
  store.reset();
  navigate('/login', { replace: true });
}

// 보안을 위해 현재 비밀번호로 한 번 더 확인(재인증)한 뒤 바꿉니다.
export async function changePassword(currentPw, newPw) {
  const user = auth.currentUser;
  if (!user) throw Object.assign(new Error('로그인이 필요해요'), { code: 'auth/requires-recent-login' });
  const credential = EmailAuthProvider.credential(user.email, currentPw);
  await reauthenticateWithCredential(user, credential);
  await updatePassword(user, newPw);
}

// Firebase 오류 코드 → 한국어 안내
export function authErrorMessage(error) {
  if (error instanceof ProfileSaveError) return error.message;
  switch (error?.code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-email':
      return '아이디 또는 비밀번호가 맞지 않아요.';
    case 'auth/email-already-in-use':
      return '이미 사용 중인 아이디예요.';
    case 'auth/weak-password':
      return '비밀번호는 6자 이상으로 해 주세요.';
    case 'auth/too-many-requests':
      return '시도가 많았어요. 잠시 후 다시 해 주세요.';
    case 'auth/network-request-failed':
      return '인터넷 연결을 확인해 주세요.';
    case 'auth/requires-recent-login':
      return '보안을 위해 현재 비밀번호를 다시 입력해 주세요.';
    default:
      return '잠시 문제가 생겼어요. 다시 시도해 주세요.';
  }
}
