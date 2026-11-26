/**
 * 파일: public/js/services/images.js
 * 역할: 이미지 저장 방식을 한곳에서 결정 (지금은 압축한 data URL 을 Firestore 에 직접 저장)
 * 사용하는 파일: utils/image.js
 *
 * ★ 다른 파일은 사진을 저장하기 전에 반드시 prepareImageForSave(dataUrl) 만 부릅니다.
 *   나중에 Cloud Storage 로 바꾸더라도 이 파일만 고치면 됩니다.
 */

import { shrinkDataUrl } from '../utils/image.js';

// 'firestore' = 압축한 data URL 을 문서에 그대로 저장 (무료 Spark 요금제 가능)
// 'storage'   = Cloud Storage 에 올리고 https 주소를 저장 (Blaze 요금제 필요 — 아직 구현 안 함)
export const IMAGE_STORAGE_MODE = 'firestore';

// 반환: 문서에 저장할 문자열 (data URL 또는 경로/주소). <img src> 에 그대로 쓸 수 있음
export async function prepareImageForSave(dataUrl) {
  // 'assets/characters/default.svg' 같은 경로나 https 주소는 그대로 저장
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) return dataUrl;

  if (IMAGE_STORAGE_MODE === 'storage') {
    // 아직 구현 안 함 (Blaze 요금제 필요). 바꾸는 방법: README "확장 아이디어"
    throw new Error('storage 모드는 아직 준비되지 않았어요');
  }

  // firestore 모드: 문서 1MB 제한보다 넉넉히 작게 (약 700KB 이하)
  return shrinkDataUrl(dataUrl);
}
