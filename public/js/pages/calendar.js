/**
 * 파일: public/js/pages/calendar.js
 * 역할: 성장 캘린더 (#/calendar, ?month=YYYY-MM) — 달력·날짜별 기록·이번 달 타임라인, 오늘 사진 기록(대화형 진단)
 * 사용하는 파일: core/store.js, services/photos.js, services/plants.js, services/species.js,
 *               ui/diagnosis-flow.js, ui/components.js, utils/dom.js, utils/date.js
 * 담당: P1
 *
 * ★ AI 는 [📷 오늘 사진 기록하기] 에서만 부릅니다. 달 이동·날짜 선택·메모 펼치기는 저장된 기록만 읽습니다.
 */

import { html, on } from '../utils/dom.js';
import { today, thisMonth, prevMonth, daysInMonth, formatKorean, toDateStr } from '../utils/date.js';
import { emptyState, toast, openModal } from '../ui/components.js';
import { store } from '../core/store.js';
import { listPhotosInMonth } from '../services/photos.js';
import { getCurrentPlant, selectPlant } from '../services/plants.js';
import { getSpecies } from '../services/species.js';
import { runDiagnosisFlow, pickDiagnosisImageFile } from '../ui/diagnosis-flow.js';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function monthLabel(month) {
  const [year, number] = month.split('-');
  return `${year}년 ${Number(number)}월`;
}

// 'YYYY-MM' 의 다음 달
function nextMonth(month) {
  const [y, m] = month.split('-').map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
}

// 그달 1일의 요일 (0 = 일요일). 정오(UTC)로 계산해 시간대 경계 문제를 피함
function firstWeekday(month) {
  return new Date(`${month}-01T12:00:00Z`).getUTCDay();
}

function millis(timestamp) {
  return timestamp?.toMillis?.() ?? 0;
}

// 기록 카드 하나: 날짜 + 사진 + 상태 태그 + (진단이 있으면) 접히는 AI 처방 메모
function recordCard(photo, plantName) {
  const diagnosis = photo.diagnosis;
  const isWatch = diagnosis?.severity === 'watch';
  const tag = diagnosis
    ? diagnosis.summaryTag ?? (isWatch ? '조금 더 살펴봐요' : '편안해 보여요')
    : '📷 사진 기록';

  return html`
    <article class="calendar-card">
      <p class="calendar-card-date">${formatKorean(photo.date)}</p>
      <img class="calendar-photo" src="${photo.image}" alt="${plantName} 성장 기록 사진" loading="lazy" />
      <p><span class="calendar-tag ${isWatch ? 'is-watch' : ''}">${tag}</span></p>
      ${diagnosis
        ? html`
            <details class="calendar-memo">
              <summary>AI 처방 메모</summary>
              <div class="calendar-memo-content">
                <p><strong>사진으로 보면</strong> ${diagnosis.symptoms ?? '관찰 기록이 있어요.'}</p>
                ${diagnosis.userAnswer ? html`<p><strong>내가 확인한 흙 상태</strong> ${diagnosis.userAnswer}</p>` : ''}
                ${(diagnosis.advice ?? []).map((item, index) => html`<p>${index + 1}. ${item}</p>`)}
              </div>
            </details>
          `
        : ''}
    </article>
  `;
}

export default {
  title: '성장 캘린더',
  requiresAuth: true,
  showNav: true,
  styles: ['css/pages/calendar.css'],

  async render(container, params = {}) {
    const plantList = store.get('plants') ?? [];
    let plant = getCurrentPlant();

    // ?month=YYYY-MM (월간 리포트에서 들어옴). 아직 오지 않은 달은 이번 달로
    const queryMonth = params.query?.month ?? '';
    let month = /^\d{4}-\d{2}$/.test(queryMonth) && queryMonth <= thisMonth() ? queryMonth : thisMonth();
    let selectedDate = today().startsWith(month) ? today() : null;
    let photos = [];
    let disposed = false;
    let recording = false; // 사진 기록 중 (버튼 잠금)

    function draw() {
      const todayStr = today();
      const totalDays = daysInMonth(month);
      const startOffset = firstWeekday(month);
      // 등록한 날 이전은 흐리게 (등록일 = 문서를 만든 날, 없으면 데려온 날)
      const registeredOn = toDateStr(plant?.createdAt) ?? plant?.purchasedAt ?? null;

      // 날짜별 사진 묶기
      const photosByDay = new Map();
      for (const photo of photos) {
        const list = photosByDay.get(photo.date) ?? [];
        list.push(photo);
        photosByDay.set(photo.date, list);
      }

      // 선택한 날짜가 이 달이 아니면: 이 달의 마지막 기록일 → 오늘 → 1일
      if (!selectedDate || !selectedDate.startsWith(month)) {
        const recordDays = [...photosByDay.keys()].sort();
        selectedDate = recordDays.at(-1) ?? (todayStr.startsWith(month) ? todayStr : `${month}-01`);
      }

      const cellCount = Math.ceil((startOffset + totalDays) / 7) * 7;
      const cells = Array.from({ length: cellCount }, (_, index) => {
        const day = index - startOffset + 1;
        if (day < 1 || day > totalDays) return html`<span class="calendar-day is-outside" aria-hidden="true"></span>`;

        const date = `${month}-${String(day).padStart(2, '0')}`;
        const dayPhotos = photosByDay.get(date) ?? [];
        const first = dayPhotos[0];
        const classes = [
          'calendar-day',
          date === todayStr ? 'is-today' : '',
          date === selectedDate ? 'is-selected' : '',
          registeredOn && date < registeredOn ? 'is-before-registration' : '',
        ]
          .filter(Boolean)
          .join(' ');

        return html`
          <button type="button" class="${classes}" data-date="${date}" aria-pressed="${date === selectedDate}"
            aria-label="${date}${dayPhotos.length ? ` 사진 ${dayPhotos.length}장` : ''}">
            <span class="calendar-day-number">${day}</span>
            ${first
              ? html`
                  <span class="calendar-thumb ${first.diagnosis?.severity === 'watch' ? 'is-watch' : ''}">
                    <img src="${first.image}" alt="" />
                    ${dayPhotos.length > 1 ? html`<b>+${dayPhotos.length - 1}</b>` : ''}
                  </span>
                `
              : ''}
          </button>
        `;
      });

      const newestFirst = (a, b) => millis(b.createdAt) - millis(a.createdAt);
      const selected = photos.filter((photo) => photo.date === selectedDate).sort(newestFirst);
      const timeline = [...photos].sort((a, b) => b.date.localeCompare(a.date) || newestFirst(a, b));
      const plantName = plant?.name ?? '식물';

      container.innerHTML = html`
        <section class="calendar-page">
          ${plantList.length > 1
            ? html`
                <div class="plant-chips" aria-label="식물 선택">
                  ${plantList.map(
                    (item) => html`
                      <button type="button" class="plant-chip ${item.id === plant?.id ? 'is-active' : ''}" data-plant="${item.id}">
                        ${item.name}
                      </button>
                    `,
                  )}
                </div>
              `
            : ''}

          <header class="calendar-month">
            <button type="button" class="calendar-arrow" data-month="prev" aria-label="이전 달">‹</button>
            <h2>${monthLabel(month)}</h2>
            <button type="button" class="calendar-arrow" data-month="next" aria-label="다음 달" ${month >= thisMonth() ? 'disabled' : ''}>›</button>
          </header>

          <div class="calendar-weekdays" aria-hidden="true">${WEEKDAYS.map((d) => html`<span>${d}</span>`)}</div>
          <div class="calendar-grid">${cells}</div>

          <section class="calendar-selected">
            <h2>${formatKorean(selectedDate)} 기록</h2>
            ${selected.length
              ? selected.map((photo) => recordCard(photo, plantName))
              : html`<p class="muted">이 날짜에는 사진 기록이 없어요.</p>`}
          </section>

          ${timeline.length
            ? html`
                <section class="calendar-timeline">
                  <h2>${monthLabel(month)} 사진 기록</h2>
                  ${timeline.map((photo) => recordCard(photo, plantName))}
                </section>
              `
            : emptyState({ icon: '🌱', message: '첫 성장 사진을 남겨 볼까요?', actionLabel: '사진 기록하기', actionHref: '#/calendar' })}

          <button type="button" class="calendar-record" data-record ${recording ? 'disabled' : ''}>📷 오늘 사진 기록하기</button>
          <a class="calendar-report" href="#/report/${month}">📄 이번 달 기록으로 월간 리포트 보기</a>
        </section>
      `;
    }

    // 그 달 사진 불러오기 (Firestore 읽기만 — AI 호출 없음)
    async function load() {
      photos = [];
      if (plant) {
        try {
          photos = await listPhotosInMonth(plant.id, month);
        } catch (error) {
          toast(error.message || '사진 기록을 불러오지 못했어요.', 'error');
        }
      }
      if (!disposed) draw();
    }

    // [📷 오늘 사진 기록하기] → "AI 진단 받기" / "사진만 기록하기" → runDiagnosisFlow
    async function recordPhoto() {
      if (!plant) {
        const goRegister = await openModal({
          title: '식물을 먼저 등록해 주세요',
          body: html`<p>사진 기록은 등록한 식물에 연결해서 저장해요.</p>`,
          actions: [
            { label: '식물 등록하기', value: true, variant: 'primary' },
            { label: '닫기', value: false, variant: 'ghost' },
          ],
        });
        if (goRegister) location.hash = '#/plants/new';
        return;
      }

      recording = true;
      try {
        // 파일 선택 창은 버튼 클릭 직후에 열어야 브라우저가 막지 않음
        const imageFile = await pickDiagnosisImageFile();
        if (!imageFile) return;
        const withDiagnosis = await openModal({
          title: '사진 기록',
          body: html`<p>어떤 방식으로 기록할까요?</p>`,
          actions: [
            { label: 'AI 진단 받기', value: true, variant: 'primary' },
            { label: '사진만 기록하기', value: false, variant: 'secondary' },
          ],
        });
        if (withDiagnosis === null) return;
        const species = await getSpecies(plant.speciesId).catch(() => null);
        await runDiagnosisFlow({ plant, species, imageFile, withDiagnosis });
        // 오늘 기록이 보이도록 이번 달로 이동해서 다시 불러옴
        month = thisMonth();
        selectedDate = today();
        await load();
      } catch (error) {
        toast(error.message || '사진을 선택하지 못했어요.', 'error');
      } finally {
        recording = false;
      }
    }

    const removeClick = on(container, 'click', '[data-date], [data-month], [data-record], [data-plant], .empty-state .btn', async (event, target) => {
      if (target.dataset.date) {
        selectedDate = target.dataset.date;
        draw();
        return;
      }
      if (target.dataset.month) {
        const next = target.dataset.month === 'prev' ? prevMonth(month) : nextMonth(month);
        if (next <= thisMonth()) {
          month = next;
          await load();
        }
        return;
      }
      if (target.dataset.plant) {
        plant = plantList.find((item) => item.id === target.dataset.plant) ?? plant;
        selectPlant(plant.id);
        await load();
        return;
      }
      // [📷 오늘 사진 기록하기] 또는 빈 화면의 [사진 기록하기] (같은 #/calendar 주소라 링크 이동은 막음)
      if (target.matches('.empty-state .btn')) event.preventDefault();
      if (!recording) await recordPhoto();
    });

    await load();
    return () => {
      disposed = true;
      removeClick();
    };
  },
};
