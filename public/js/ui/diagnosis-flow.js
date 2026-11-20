/**
 * 파일: public/js/ui/diagnosis-flow.js
 * 역할: 대화형 사진 진단 흐름 — 사진 고르기 → 미리보기 → AI 관찰 → 흙 상태 질문 → 오늘의 가이드 → 저장·경험치
 *       성장 캘린더(P1)와 체크리스트(P3)가 함께 씁니다.
 * 사용하는 파일: services/diagnosis.js, services/photos.js, services/aiHistory.js, services/game.js,
 *               services/images.js, ui/components.js, ui/celebrate.js, utils/image.js, utils/date.js, utils/dom.js
 * 담당: P1
 *
 * ★ runDiagnosisFlow 의 이름·인자·반환 형식은 00_MAIN 계약 그대로 유지합니다.
 * ★ AI 는 사진만 보고 단정하지 않습니다. 관찰 → 사용자에게 흙 상태 질문 → 두 정보를 합쳐 처방.
 */

import { html } from '../utils/dom.js';
import { toast, openModal, choiceModal, confirmModal, showLoading, hideLoading } from './components.js';
import { addPhoto, hasPhotoOn } from '../services/photos.js';
import { addHistory } from '../services/aiHistory.js';
import { awardExp, markCared, setAlert, refreshPlantState, EXP } from '../services/game.js';
import { celebrateIfLeveledUp } from './celebrate.js';
import { prepareImageForSave } from '../services/images.js';
import { fileToDataUrl } from '../utils/image.js';
import { today } from '../utils/date.js';
import { startDiagnosis, finishDiagnosis, buildHistorySummary } from '../services/diagnosis.js';

const DEFAULT_OPTIONS = ['흙이 축축해요', '흙이 바짝 말라있어요', '잘 모르겠어요'];

// 사용자가 흐름을 그만둔 경우를 나타내는 값 (null = "진단 없이 사진만 기록" 과 구분)
const CANCELLED = Symbol('cancelled');

// 파일 선택 창 열기. 고른 파일 또는 null(취소)
// ※ 브라우저는 "사용자가 막 누른 직후"에만 파일 선택 창을 열어 주므로 버튼 클릭 안에서 부르세요.
export function pickDiagnosisImageFile() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.setAttribute('capture', 'environment');
    input.addEventListener('change', () => resolve(input.files?.[0] ?? null), { once: true });
    input.addEventListener('cancel', () => resolve(null), { once: true });
    input.click();
  });
}

// 진단 도중 다른 화면으로 이동하면: 열린 모달·로딩을 닫고, 이후 단계는 진행하지 않음
function watchNavigation() {
  const state = { left: false };
  const onLeave = () => {
    state.left = true;
    hideLoading({ force: true });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); // 닫을 수 있는 모달 닫기
  };
  window.addEventListener('hashchange', onLeave, { once: true });
  state.stop = () => window.removeEventListener('hashchange', onLeave);
  return state;
}

// 사진 미리보기. [기록하기] → data URL, [다시 고르기] → 새 사진, 닫으면 null
async function choosePhoto(initialFile) {
  let file = initialFile;
  for (;;) {
    if (!file) file = await pickDiagnosisImageFile();
    if (!file) return null;

    let dataUrl;
    try {
      dataUrl = await fileToDataUrl(file);
    } catch (error) {
      toast(error.message || '사진을 읽지 못했어요.', 'error');
      return null;
    }

    const answer = await openModal({
      title: '사진 기록',
      body: html`
        <div class="stack center">
          <img src="${dataUrl}" alt="고른 사진 미리보기" style="max-height: 240px; max-width: 100%; border-radius: 16px; margin: auto" />
          <p>이 사진으로 기록할까요?</p>
        </div>
      `,
      actions: [
        { label: '기록하기', value: 'save', variant: 'primary' },
        { label: '다시 고르기', value: 'retry', variant: 'ghost' },
      ],
    });
    if (answer === 'save') return dataUrl;
    if (answer !== 'retry') return null;
    file = null; // 모달 버튼을 누른 직후라 파일 선택 창을 다시 열 수 있음
  }
}

// AI 단계가 실패했을 때: 사진은 잃지 않도록 "사진만 기록"을 권함
async function offerPhotoOnly(message) {
  const ok = await confirmModal(message, { okLabel: '사진만 기록하기', cancelLabel: '취소' });
  return ok ? null : CANCELLED;
}

// 관찰 → 질문 → 가이드. 반환: { diagnosis, clearAlert } | null(사진만 기록) | CANCELLED
async function askDiagnosis({ plant, speciesName, dataUrl, nav }) {
  // ① AI 관찰
  let first;
  showLoading('AI 코치가 잎을 살펴보는 중이에요…');
  try {
    first = await startDiagnosis({ imageDataUrl: dataUrl, speciesName });
  } catch (error) {
    hideLoading();
    if (nav.left) return CANCELLED;
    toast(error.message || '사진을 살펴보지 못했어요.', 'error');
    return offerPhotoOnly('사진만 먼저 기록할까요?');
  }
  hideLoading();
  if (nav.left) return CANCELLED;

  // ② 흙 상태 질문 (단정하지 않도록 "사진으로 보면" 으로 시작)
  const options = first.options?.length === 3 ? first.options : DEFAULT_OPTIONS;
  const userAnswer = await choiceModal({
    title: '조금만 더 알려 주세요',
    question: `사진으로 보면 ${first.symptoms}\n\n${first.question}`,
    options,
  });
  if (nav.left) return CANCELLED;
  if (userAnswer === null) {
    const photoOnly = await confirmModal('진단 없이 사진만 기록할까요?', { okLabel: '사진만 기록하기', cancelLabel: '취소' });
    return photoOnly ? null : CANCELLED;
  }

  // ③ 오늘의 가이드
  let result;
  showLoading('맞춤 가이드를 만드는 중이에요…');
  try {
    result = await finishDiagnosis({ plantId: plant.id, speciesName, first, userAnswer });
  } catch (error) {
    hideLoading();
    if (nav.left) return CANCELLED;
    toast(error.message || '맞춤 가이드를 만들지 못했어요.', 'error');
    return offerPhotoOnly('사진만 먼저 기록할까요?');
  }
  hideLoading();
  if (nav.left) return CANCELLED;

  // 저장 모양 = 00_MAIN §5.5 photos.diagnosis
  const diagnosis = {
    symptoms: first.symptoms,
    severity: first.severity,
    question: first.question,
    userAnswer,
    advice: result.advice,
    summaryTag: result.summaryTag,
  };

  // ④ 결과 보기. "관찰 필요"가 켜질 결과면 [다 확인했어요] 로 바로 끌 수 있음
  const choice = await openModal({
    title: diagnosis.summaryTag || '오늘 해 볼 일',
    body: html`
      <div class="stack">
        <img src="${dataUrl}" alt="진단한 식물 사진" style="width: 100%; max-height: 220px; object-fit: cover; border-radius: 14px" />
        <p><strong>사진으로 보면</strong> ${diagnosis.symptoms}</p>
        <p><strong>오늘 해 볼 일</strong></p>
        <ol>${diagnosis.advice.map((item) => html`<li>${item}</li>`)}</ol>
      </div>
    `,
    actions: [
      ...(diagnosis.severity === 'watch' ? [{ label: '다 확인했어요', value: 'clear', variant: 'secondary' }] : []),
      { label: '확인', value: 'ok', variant: 'primary' },
    ],
  });
  return { diagnosis, clearAlert: choice === 'clear' };
}

/**
 * 사진 기록(+ 선택: 대화형 진단)
 * @returns {Promise<{ photo, diagnosis, expResult } | null>}  중간에 그만두면 null
 */
export async function runDiagnosisFlow({ plant, species = null, imageFile = null, withDiagnosis = true } = {}) {
  const nav = watchNavigation();
  try {
    // 1~2) 사진 고르기 + 미리보기
    const dataUrl = await choosePhoto(imageFile);
    if (!dataUrl || nav.left) return null;

    // 3~7) 진단 (사진만 기록이면 건너뜀)
    let diagnosis = null;
    let clearAlert = false;
    if (withDiagnosis) {
      const speciesName = species?.name ?? plant?.name ?? '식물';
      const outcome = await askDiagnosis({ plant, speciesName, dataUrl, nav });
      if (outcome === CANCELLED || nav.left) return null;
      if (outcome) ({ diagnosis, clearAlert } = outcome);
    }

    // 8) 저장 · 경험치 (사진 경험치는 하루 한 번)
    const date = today();
    const alreadyRecorded = await hasPhotoOn(plant.id, date);
    const image = await prepareImageForSave(dataUrl);
    const photo = await addPhoto(plant.id, { image, date, diagnosis });

    if (diagnosis) {
      // aiHistory 에는 사진 없이 짧은 요약만
      await addHistory(plant.id, 'PHOTO_DIAGNOSIS', buildHistorySummary({ first: diagnosis, userAnswer: diagnosis.userAnswer, result: diagnosis }));
      // watch → 관찰 필요(ALERT), normal 또는 [다 확인했어요] → 해제
      await setAlert(plant.id, diagnosis.severity === 'watch' && !clearAlert);
    }

    let expResult = null;
    if (!alreadyRecorded) {
      expResult = await awardExp(plant.id, EXP.PHOTO, 'PHOTO');
      await markCared(plant.id);
      await celebrateIfLeveledUp(expResult, plant);
    } else {
      toast('오늘 사진 경험치는 이미 받았어요.');
    }
    await refreshPlantState(plant.id);
    toast('사진을 기록했어요.', 'success');
    return { photo, diagnosis, expResult };
  } catch (error) {
    console.warn('[diagnosis-flow] 사진 기록 실패', error);
    toast(error.message || '사진을 기록하지 못했어요.', 'error');
    return null;
  } finally {
    nav.stop();
  }
}
