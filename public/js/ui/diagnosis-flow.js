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

function cancelOnNavigation() {
  const close = () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  window.addEventListener('hashchange', close, { once: true });
  return () => window.removeEventListener('hashchange', close);
}

export async function runDiagnosisFlow({ plant, species = null, imageFile = null, withDiagnosis = true } = {}) {
    let file = imageFile;
  let dataUrl;
  let diagnosis = null;
  const removeNavigationHandler = cancelOnNavigation();
  try {
    while (!file) {
      file = await pickDiagnosisImageFile();
      if (!file) return null;
      try { dataUrl = await fileToDataUrl(file); }
      catch (error) { toast(error.message || '사진을 읽지 못했어요.', 'error'); file = null; continue; }
      const accepted = await openModal({
        title: '사진 기록',
        body: html`<div class="stack center"><img src="${dataUrl}" alt="고른 사진 미리보기" style="max-height:240px;max-width:100%;border-radius:16px;margin:auto"/><p>이 사진으로 기록할까요?</p></div>`,
        actions: [{ label: '기록하기', value: 'save', variant: 'primary' }, { label: '다시 고르기', value: 'retry', variant: 'ghost' }],
      });
      if (accepted === null) return null;
      if (accepted === 'retry') { file = null; continue; }
      break;
    }
    if (!dataUrl) dataUrl = await fileToDataUrl(file);

    if (withDiagnosis) {
      let first;
      try {
        showLoading('AI 코치가 잎을 살펴보는 중이에요…');
        first = await startDiagnosis({ imageDataUrl: dataUrl, speciesName: species?.name ?? plant?.name ?? '식물' });
      } catch (error) {
        toast(error.message || '사진을 살펴보지 못했어요.', 'error');
        if (!(await confirmModal('사진만 먼저 기록할까요?', { okLabel: '사진만 기록하기', cancelLabel: '취소' }))) return null;
      } finally { hideLoading(); }

      if (first) {
        const options = first.options?.length === 3 ? first.options : ['흙이 축축해요', '흙이 바짝 말라있어요', '잘 모르겠어요'];
        const userAnswer = await choiceModal({ title: '조금만 더 알려 주세요', question: `사진으로 보면 ${first.symptoms}\n\n${first.question}`, options });
        if (userAnswer === null) {
          const photoOnly = await confirmModal('진단 없이 사진만 기록할까요?', { okLabel: '사진만 기록하기', cancelLabel: '취소' });
          if (!photoOnly) return null;
        } else {
          let guideLoading = false;
          try {
            showLoading('맞춤 가이드를 만드는 중이에요…');
            guideLoading = true;
            const result = await finishDiagnosis({ plantId: plant.id, speciesName: species?.name ?? plant?.name ?? '식물', first, userAnswer });

            // 결과 모달이 로딩 오버레이 뒤에 가려지지 않도록, 결과를 받은 즉시 닫습니다.
            hideLoading({ force: true });
            guideLoading = false;

            diagnosis = { ...first, userAnswer, ...result };
            const resultChoice = await openModal({
              title: diagnosis.summaryTag ?? '오늘 해 볼 일',
              body: html`<div class="stack"><img src="${dataUrl}" alt="진단한 식물 사진" style="width:100%;max-height:220px;object-fit:cover;border-radius:14px"/><p><strong>사진으로 보면</strong> ${diagnosis.symptoms}</p><p><strong>오늘 해 볼 일</strong></p><ol>${diagnosis.advice.map((item) => html`<li>${item}</li>`)}</ol></div>`,
              actions: [ ...(diagnosis.severity === 'watch' ? [{ label: '다 확인했어요', value: 'clear', variant: 'secondary' }] : []), { label: '확인', value: 'ok', variant: 'primary' }],
            });
            diagnosis.clearAlert = resultChoice === 'clear';
          } catch (error) {
            diagnosis = null;
            toast(error.message || '맞춤 가이드를 만들지 못했어요.', 'error');
            if (!(await confirmModal('사진만 먼저 기록할까요?', { okLabel: '사진만 기록하기', cancelLabel: '취소' }))) return null;
          } finally {
            // 요청 실패처럼 결과를 받기 전에 빠져나온 경우에도 반드시 닫습니다.
            if (guideLoading) hideLoading({ force: true });
          }
        }
      }
    }

    const date = today();
    const alreadyRecorded = await hasPhotoOn(plant.id, date);
    const image = await prepareImageForSave(dataUrl);
    const storedDiagnosis = diagnosis ? { ...diagnosis } : null;
    if (storedDiagnosis) delete storedDiagnosis.clearAlert;
    const photo = await addPhoto(plant.id, { image, date, diagnosis: storedDiagnosis });
    if (diagnosis) {
      await addHistory(plant.id, 'PHOTO_DIAGNOSIS', buildHistorySummary({ first: diagnosis, userAnswer: diagnosis.userAnswer, result: diagnosis }));
      await setAlert(plant.id, diagnosis.severity === 'watch' && !diagnosis.clearAlert);
      if (diagnosis.clearAlert) await setAlert(plant.id, false);
    }
    let expResult = null;
    if (!alreadyRecorded) {
      expResult = await awardExp(plant.id, EXP.PHOTO, 'PHOTO');
      await markCared(plant.id);
      await celebrateIfLeveledUp(expResult, plant);
    } else toast('오늘 사진 경험치는 이미 받았어요.');
    await refreshPlantState(plant.id);
    toast('사진을 기록했어요.', 'success');
    return { photo, diagnosis: storedDiagnosis, expResult };
  } catch (error) {
    console.warn('[diagnosis-flow] 사진 기록 실패', error);
    toast(error.message || '사진을 기록하지 못했어요.', 'error');
    return null;
  } finally {
    removeNavigationHandler();
  }
}
