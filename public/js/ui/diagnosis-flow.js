/**
 * 파일: public/js/ui/diagnosis-flow.js
 * 역할: 사진 → (질문 → 처방) 흐름을 여러 화면에서 다시 쓰기 위한 함수 (캘린더, 체크리스트)
 * 사용하는 파일: services/photos.js, services/images.js, utils/image.js, utils/date.js, ui/components.js
 * 담당: C5 (뼈대) → P1 (완성)
 *
 * 이 파일은 P1이 완성한다(질문·처방·경험치). 함수 이름·인자·반환 형식은 바꾸지 않는다.
 *
 * ── 지금(뼈대) 동작 ──
 *  사진 고르기 → 미리보기 확인 → photos 에 기록 (diagnosis: null) → 끝. AI 호출 없음.
 */

import { html } from '../utils/dom.js';
import { toast, openModal } from './components.js';
import { addPhoto } from '../services/photos.js';
import { prepareImageForSave } from '../services/images.js';
import { fileToDataUrl } from '../utils/image.js';
import { today } from '../utils/date.js';

// 파일 선택 창을 열고 고른 파일을 돌려줌. 취소하면 null
// ※ 브라우저는 "사용자가 누른 직후"에만 파일 창을 열어 줍니다. 그래서 await 전에 바로 click() 합니다.
function pickImageFile() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.setAttribute('capture', 'environment');
    input.addEventListener('change', () => resolve(input.files?.[0] ?? null), { once: true });
    input.addEventListener('cancel', () => resolve(null), { once: true }); // 최신 브라우저: 취소 이벤트
    input.click();
  });
}

/**
 * @param {object} options
 * @param {object} options.plant          식물 객체 (id 필요)
 * @param {object} [options.species]      식물 종류 (P1 에서 AI 진단에 사용)
 * @param {File}   [options.imageFile]    이미 고른 파일이 있으면 전달 (없으면 파일 창을 엶)
 * @param {boolean} [options.withDiagnosis=true]  false 면 사진만 기록
 * @returns {Promise<{photo, diagnosis, expResult} | null>}  사용자가 취소하면 null
 */
export async function runDiagnosisFlow({ plant, species = null, imageFile = null, withDiagnosis = true } = {}) {
  const file = imageFile ?? (await pickImageFile());
  if (!file) return null;

  let dataUrl;
  try {
    dataUrl = await fileToDataUrl(file);
  } catch (error) {
    toast(error.message || '사진을 읽지 못했어요.', 'error');
    return null;
  }

  const ok = await openModal({
    title: '사진 기록',
    body: html`
      <div class="stack center">
        <img src="${dataUrl}" alt="고른 사진 미리보기" style="max-height: 240px; border-radius: 16px; margin: 0 auto;" />
        <p>이 사진으로 기록할까요?</p>
      </div>
    `,
    actions: [
      { label: '기록하기', value: true, variant: 'primary' },
      { label: '취소', value: false, variant: 'ghost' },
    ],
  });
  if (!ok) return null;

  try {
    const image = await prepareImageForSave(dataUrl);
    const photo = await addPhoto(plant.id, { image, date: today(), diagnosis: null });
    toast('사진을 기록했어요', 'success');
    return { photo, diagnosis: null, expResult: null };
  } catch (error) {
    console.warn('[diagnosis-flow] 사진 저장 실패', error);
    toast(error.message?.includes('사진이 너무 커요') ? error.message : '사진을 저장하지 못했어요. 다시 시도해 주세요.', 'error');
    return null;
  }
}
