/**
 * 파일: public/js/services/users.js
 * 역할: 회원정보 문서 users/{uid} 만들기·읽기·고치기 (00_MAIN §5.5)
 * 사용하는 파일: core/firebase.js, core/store.js
 * 담당: C3
 *
 * ★ 비밀번호는 어디에도 저장하지 않습니다. (Firebase Authentication 이 따로 관리)
 */

import { db, doc, getDoc, setDoc, updateDoc, serverTimestamp } from '../core/firebase.js';
import { store } from '../core/store.js';

// 회원가입이 진행 중일 때, 회원정보 저장이 끝나기를 기다리기 위한 Promise
// (가입 직후 로그인 감시가 먼저 실행되어 "회원정보 없음"으로 착각하는 것을 막음)
let pendingSignup = null;

export function setPendingSignup(promise) {
  pendingSignup = promise;
}

function userRef(uid) {
  // doc(db, '컬렉션', '문서ID') : Firestore 문서 하나의 "주소"를 만듭니다. (아직 읽거나 쓰지 않음)
  return doc(db, 'users', uid);
}

export async function createProfile(uid, { loginId, nickname, region, homeType }) {
  // setDoc: 그 주소에 문서를 통째로 씁니다. serverTimestamp(): 서버 시각을 넣어 달라는 표시
  await setDoc(userRef(uid), {
    loginId,
    nickname,
    home: { region: region ?? '', homeType: homeType ?? '' },
    createdAt: serverTimestamp(),
  });
}

// 회원정보 읽기. 문서가 없으면 null
export async function getProfile(uid) {
  const snap = await getDoc(userRef(uid));
  if (!snap.exists()) return null;
  return { uid, ...snap.data() };
}

// 닉네임, 집 정보 두 가지만 고칠 수 있습니다. (둘 중 하나만 넘겨도 됨)
export async function updateProfile(uid, { nickname, home }) {
  const patch = {};
  if (nickname !== undefined) patch.nickname = nickname;
  if (home !== undefined) patch.home = { region: home.region ?? '', homeType: home.homeType ?? '' };
  if (Object.keys(patch).length === 0) return;

  await updateDoc(userRef(uid), patch);

  // 다른 화면도 바로 바뀌도록 store 의 user 도 고침
  const current = store.get('user');
  if (current?.uid === uid) store.set('user', { ...current, ...patch });
}

// store 의 uid 로 회원정보를 읽어 store.user 에 넣음. 반환: 회원정보 또는 null
export async function loadCurrentUserProfile() {
  const uid = store.get('user')?.uid;
  if (!uid) return null;

  const waiting = pendingSignup;
  if (waiting) {
    try {
      await waiting;
    } catch {
      /* 가입 쪽에서 오류를 처리함 */
    }
  }

  const profile = await getProfile(uid);
  if (profile) {
    store.set('user', {
      uid,
      loginId: profile.loginId ?? '',
      nickname: profile.nickname ?? '',
      home: { region: profile.home?.region ?? '', homeType: profile.home?.homeType ?? '' },
      createdAt: profile.createdAt ?? null,
    });
  }
  return profile;
}
