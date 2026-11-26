/**
 * 파일: public/js/utils/image.js
 * 역할: 사진 파일을 작게 줄여 data URL(글자로 된 이미지)로 바꾸기
 * 사용하는 파일: 없음
 *
 * ★ Firestore 문서 하나는 1MB 를 넘을 수 없습니다. 저장 전에는 꼭 shrinkDataUrl 을 거치세요.
 *   (보통은 services/images.js 의 prepareImageForSave 가 대신 해 줍니다)
 */

const TOO_BIG_MESSAGE = '사진이 너무 커요. 다른 사진을 골라 주세요.';

// 파일 → 그릴 수 있는 이미지. 휴대폰 사진의 회전 정보(EXIF)를 반영하려고 createImageBitmap 을 먼저 시도
async function fileToBitmap(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      /* 지원하지 않는 브라우저 → 아래 방법으로 계속 */
    }
  }
  return loadImage(URL.createObjectURL(file), true);
}

// 주소(data URL 등) → <img> 로딩이 끝날 때까지 기다림
function loadImage(src, revoke = false) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      if (revoke) URL.revokeObjectURL(src);
      resolve(img);
    };
    img.onerror = () => {
      if (revoke) URL.revokeObjectURL(src);
      reject(new Error('이미지를 읽지 못했어요'));
    };
    img.src = src;
  });
}

// 이미지 → 긴 쪽이 maxSize 이하인 JPEG data URL
function drawToDataUrl(source, maxSize, quality) {
  const width = source.width;
  const height = source.height;
  const scale = Math.min(1, maxSize / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext('2d');
  // JPEG 은 투명을 지원하지 않으므로 흰 배경을 먼저 칠함
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', quality);
}

// 사진 파일 → 긴 쪽 maxSize 픽셀, JPEG data URL
export async function fileToDataUrl(file, { maxSize = 768, quality = 0.8 } = {}) {
  if (!file || !String(file.type).startsWith('image/')) throw new Error('사진 파일을 골라 주세요.');
  let bitmap;
  try {
    bitmap = await fileToBitmap(file);
  } catch {
    throw new Error('사진을 읽지 못했어요. 다른 사진을 골라 주세요.');
  }
  const dataUrl = drawToDataUrl(bitmap, maxSize, quality);
  if (typeof bitmap.close === 'function') bitmap.close();
  return dataUrl;
}

// data URL 의 대략적인 바이트 수 (base64 는 4글자 = 3바이트)
export function dataUrlBytes(dataUrl) {
  const base64 = String(dataUrl).split(',')[1] ?? '';
  return Math.ceil((base64.length * 3) / 4);
}

// maxBytes 이하가 될 때까지 화질·크기를 낮춰 다시 만듦. 끝까지 크면 오류
export async function shrinkDataUrl(dataUrl, maxBytes = 700_000) {
  if (dataUrlBytes(dataUrl) <= maxBytes) return dataUrl;

  const img = await loadImage(dataUrl);
  let size = Math.max(img.width, img.height);
  let quality = 0.75;
  for (let attempt = 0; attempt < 8; attempt++) {
    const next = drawToDataUrl(img, size, quality);
    if (dataUrlBytes(next) <= maxBytes) return next;
    // 화질을 먼저 낮추고, 그래도 크면 크기도 줄임
    if (quality > 0.5) quality -= 0.1;
    else size = Math.round(size * 0.8);
  }
  throw new Error(TOO_BIG_MESSAGE);
}
