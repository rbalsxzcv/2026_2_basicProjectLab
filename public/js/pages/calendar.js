import { html, on } from '../utils/dom.js';
import { today, thisMonth, prevMonth, addDays, daysInMonth, formatKorean } from '../utils/date.js';
import { emptyState, toast, openModal } from '../ui/components.js';
import { listPhotosInMonth } from '../services/photos.js';
import { getCurrentPlant, selectPlant } from '../services/plants.js';
import { getSpecies } from '../services/species.js';
import { runDiagnosisFlow, pickDiagnosisImageFile } from '../ui/diagnosis-flow.js';
import { store } from '../core/store.js';

const monthLabel = (month) => {
  const [year, number] = month.split('-');
  return `${year}년 ${Number(number)}월`;
};
const previousDay = (date) => addDays(date, -1);

export default {
  title: '성장 캘린더',
  requiresAuth: true,
  showNav: true,
  styles: ['css/pages/calendar.css'],

  async render(container, params = {}) {
    const plantList = store.get('plants') ?? [];
    let plant = getCurrentPlant() ?? plantList[0] ?? null;
    if (plant && !getCurrentPlant()) selectPlant(plant.id);

    let month = /^\d{4}-\d{2}$/.test(params.query?.month ?? '') ? params.query.month : thisMonth();
    let selectedDate = today().startsWith(month) ? today() : null;
    let photos = [];
    let disposed = false;
    let loading = false;

    const draw = () => {
      const firstDate = `${month}-01`;
      const startOffset = new Date(`${firstDate}T12:00:00Z`).getUTCDay();
      const totalDays = daysInMonth(month);
      const photoByDay = new Map();
      photos.forEach((photo) => {
        const entries = photoByDay.get(photo.date) ?? [];
        entries.push(photo);
        photoByDay.set(photo.date, entries);
      });
      const datesWithPhotos = [...photoByDay.keys()].sort();
      if (!selectedDate || !selectedDate.startsWith(month)) {
        selectedDate = datesWithPhotos.at(-1) ?? (today().startsWith(month) ? today() : firstDate);
      }
      const cells = Array.from({ length: Math.ceil((startOffset + totalDays) / 7) * 7 }, (_, index) => {
        const day = index - startOffset + 1;
        if (day < 1 || day > totalDays) return html`<span class="calendar-day is-outside" aria-hidden="true"></span>`;
        const date = `${month}-${String(day).padStart(2, '0')}`;
        const dayPhotos = photoByDay.get(date) ?? [];
        const first = dayPhotos[0];
        const registration = plant?.purchasedAt;
        const classes = ['calendar-day', date === today() ? 'is-today' : '', date === selectedDate ? 'is-selected' : '', registration && date < registration ? 'is-before-registration' : ''].filter(Boolean).join(' ');
        return html`<button type="button" class="${classes}" data-date="${date}" aria-label="${date}${dayPhotos.length ? ` 사진 ${dayPhotos.length}장` : ''}" aria-pressed="${date === selectedDate}">
          <span class="calendar-day-number">${day}</span>
          ${first ? html`<span class="calendar-thumb ${first.diagnosis?.severity === 'watch' ? 'is-watch' : ''}"><img src="${first.image}" alt="" />${dayPhotos.length > 1 ? html`<b>+${dayPhotos.length - 1}</b>` : ''}</span>` : ''}
        </button>`;
      });
      const selected = photos.filter((photo) => photo.date === selectedDate).sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
      const timeline = [...photos].sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
      container.innerHTML = html`<section class="calendar-page">
        ${plantList.length > 1 ? html`<div class="plant-chips" aria-label="식물 선택">${plantList.map((item) => html`<button type="button" class="plant-chip ${item.id === plant?.id ? 'is-active' : ''}" data-plant="${item.id}">${item.name}</button>`)}</div>` : ''}
        <header class="calendar-month"><button type="button" class="calendar-arrow" data-month="prev" aria-label="이전 달">‹</button><h2>${monthLabel(month)}</h2><button type="button" class="calendar-arrow" data-month="next" aria-label="다음 달" ${month >= thisMonth() ? 'disabled' : ''}>›</button></header>
        <div class="calendar-weekdays" aria-hidden="true">${['일','월','화','수','목','금','토'].map((d) => html`<span>${d}</span>`)}</div>
        <div class="calendar-grid">${cells}</div>
        <section class="calendar-selected"><h2>${formatKorean(selectedDate)} 기록</h2>${selected.length ? selected.map((photo) => recordCard(photo)) : html`<p class="muted">이 날짜에는 사진 기록이 없어요.</p>`}</section>
        ${timeline.length ? html`<section class="calendar-timeline"><h2>${monthLabel(month)} 사진 기록</h2>${timeline.map((photo) => recordCard(photo))}</section>` : emptyState({ icon: '🌱', message: '첫 성장 사진을 남겨 볼까요?', actionLabel: '사진 기록하기', actionHref: '#/calendar' })}
        <button type="button" class="calendar-record" data-record ${loading ? 'disabled' : ''}>📷 오늘 사진 기록하기</button>
        <a class="calendar-report" href="#/report/${month}">📄 이번 달 기록으로 월간 리포트 보기</a>
      </section>`;
    };

    function recordCard(photo) {
      const diagnosis = photo.diagnosis;
      const details = diagnosis ? html`<details class="calendar-memo"><summary>AI 처방 메모</summary><div class="calendar-memo-content"><p><strong>사진으로 보면</strong> ${diagnosis.symptoms ?? '관찰 기록이 있어요.'}</p>${diagnosis.userAnswer ? html`<p><strong>내가 확인한 흙 상태</strong> ${diagnosis.userAnswer}</p>` : ''}${(diagnosis.advice ?? []).map((item, index) => html`<p>${index + 1}. ${item}</p>`)}</div></details>` : '';
      return html`<article class="calendar-card"><p class="calendar-card-date">${formatKorean(photo.date)}</p><img class="calendar-photo" src="${photo.image}" alt="${plant?.name ?? '식물'} 성장 기록 사진" loading="lazy"/><p><span class="calendar-tag ${diagnosis?.severity === 'watch' ? 'is-watch' : ''}">${diagnosis ? diagnosis.summaryTag ?? (diagnosis.severity === 'watch' ? '조금 더 살펴봐요' : '편안해 보여요') : '📷 사진 기록'}</span></p>${details}</article>`;
    }

    const load = async () => {
      if (!plant) { photos = []; draw(); return; }
      try { photos = await listPhotosInMonth(plant.id, month); }
      catch (error) { toast(error.message || '사진 기록을 불러오지 못했어요.', 'error'); photos = []; }
      if (!disposed) draw();
    };

    const removeClick = on(container, 'click', '[data-date], [data-month], [data-record], [data-plant]', async (event, target) => {
      if (target.dataset.date) { selectedDate = target.dataset.date; draw(); return; }
      if (target.dataset.month) {
        const next = target.dataset.month === 'prev' ? prevMonth(month) : (() => { const d = new Date(`${month}-01T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() + 1); return d.toISOString().slice(0,7); })();
        if (next <= thisMonth()) { month = next; await load(); }
        return;
      }
      if (target.dataset.plant) { plant = plantList.find((item) => item.id === target.dataset.plant) ?? plant; selectPlant(plant.id); await load(); return; }
      if (loading) return;
      if (!plant) {
        const goRegister = await openModal({ title: '식물을 먼저 등록해 주세요', body: '사진 기록은 등록한 식물에 연결해서 저장해요.', actions: [{ label: '식물 등록하기', value: true, variant: 'primary' }, { label: '닫기', value: false, variant: 'ghost' }] });
        if (goRegister) location.hash = '#/plants/new';
        return;
      }
      loading = true;
      try {
        // 파일 선택기를 클릭 이벤트 안에서 먼저 열어 브라우저 사용자 동작으로 인식되게 합니다.
        const imageFile = await pickDiagnosisImageFile();
        if (!imageFile) return;
        const choice = await openModal({ title: '사진 기록', body: '어떤 방식으로 기록할까요?', actions: [{ label: 'AI 진단 받기', value: true, variant: 'primary' }, { label: '사진만 기록하기', value: false, variant: 'secondary' }] });
        if (choice !== null) {
          const species = await getSpecies(plant.speciesId).catch(() => null);
          await runDiagnosisFlow({ plant, species, imageFile, withDiagnosis: choice });
          await load();
        }
      } catch (error) { toast(error.message || '사진을 선택하지 못했어요.', 'error'); }
      finally { loading = false; }
    });
    await load();
    return () => { disposed = true; removeClick(); };
  },
};

