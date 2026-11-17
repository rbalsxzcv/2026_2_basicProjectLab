/**
 * 파일: public/js/pages/checklist.js
 * 역할: 오늘의 체크리스트 (#/checklist) — 데일리 루틴 + 주기적 관리, 물주기는 Safe-Lock 팝업
 *       진행 원, 완료 처리(+EXP), 사진으로 상태 확인하기, 월간 리포트 링크
 * 사용하는 파일: core/store.js, core/router.js, services/plants.js, services/checklists.js,
 *               services/species.js, ui/components.js, ui/celebrate.js, ui/diagnosis-flow.js,
 *               utils/dom.js, utils/date.js, css/pages/checklist.css
 * 담당: P3
 *
 * ★ 완료 로직은 services/checklists.js 의 completeItem 이 처리. 이 화면은 버튼 동작과 그림만.
 * ★ Anti-Guilt: 벌점·경고색 없음. 밀린 일정은 "차분히 기다리는 중"으로만 표현.
 */

import { html, on } from '../utils/dom.js';
import { toast, choiceModal, confirmModal, emptyState } from '../ui/components.js';
import { store } from '../core/store.js';
import { getCurrentPlant, selectPlant, DEFAULT_CHARACTER } from '../services/plants.js';
import { ensureTodayChecklist, getChecklist, summarize, completeItem, TASK_INFO } from '../services/checklists.js';
import { getSpecies } from '../services/species.js';
import { celebrateIfLeveledUp, floatExp } from '../ui/celebrate.js';
import { runDiagnosisFlow } from '../ui/diagnosis-flow.js';
import { today, addDays, formatKorean, diffDays } from '../utils/date.js';

export default {
  title: '오늘의 체크리스트',
  requiresAuth: true,
  showNav: true,
  styles: ['css/pages/checklist.css'],

  async render(container, params) {
    let alive = true;
    let screenDate = today(); // 진입 시 날짜 (자정 넘기 대비)
    let busy = false; // 완료 처리 중 (버튼 잠금)

    // ───────── 식물 고르기: 알림 링크(?plant=id) 우선, 없으면 현재 식물 ─────────
    let plant = null;
    const plants = store.get('plants') ?? [];
    const queryId = params?.query?.plant;
    if (queryId) {
      plant = plants.find((p) => p.id === queryId) ?? null;
      if (!plant) toast('식물을 찾을 수 없어요', 'error');
    }
    if (!plant) plant = getCurrentPlant();

    if (!plant) {
      container.innerHTML = html`
        <section class="checklist-page">
          ${emptyState({
            icon: '🌱',
            message: '아직 함께하는 식물이 없어요.\n첫 식물 친구를 등록해 볼까요?',
            actionLabel: '식물 등록하기',
            actionHref: '#/plants/new',
          })}
        </section>
      `;
      return () => {
        alive = false;
      };
    }

    // ───────── 그리기 ─────────
    function draw(checklist) {
      const plants = store.get('plants') ?? []; // 최신 목록으로 (식물 추가·삭제 반영)
      const s = summarize(checklist ?? { items: [] });
      const allDone = s.total > 0 && s.remaining === 0;
      const items = checklist?.items ?? [];
      const daily = items.filter((i) => i.category === 'DAILY_MICRO');
      // 미룬 물주기는 아래 "미룸" 카드에서만 보여요 (여기서도 나오면 두 번그려짐)
      const periodic = items.filter((i) => i.category === 'PERIODIC_CARE' && !i.postponed);
      const postponed = items.filter((i) => i.postponed);
      const generatedBy = checklist?.generatedBy;
      const isAi = generatedBy === 'AI';

      container.innerHTML = html`
        <section class="checklist-page">
          <!-- 식물 고르기 (여러 개면 칩, 없으면 이름만) -->
          ${plants.length >= 2
            ? html`
                <div class="plant-selector" role="tablist" aria-label="식물 고르기">
                  ${plants.map(
                    (p) => html`
                      <button type="button" class="chip selector-chip ${p.id === plant.id ? 'is-active' : ''}"
                        role="tab" aria-selected="${p.id === plant.id ? 'true' : 'false'}" data-select-plant="${p.id}">
                        <span>${p.name}</span>
                      </button>
                    `,
                  )}
                </div>
              `
            : ''}
          <p class="checklist-date">${formatKorean(screenDate)}</p>

          <!-- 진행 카드 -->
          ${allDone
            ? html`
                <div class="card progress-card is-all-done">
                  <p class="all-done-text">
                    오늘 할 일을 모두 마쳤어요!<br />${plant.name}이(가) 기뻐해요 ✨
                  </p>
                </div>
              `
            : html`
                <div class="card progress-card">
                  <div class="progress-ring" style="--percent: ${s.percent}" role="progressbar"
                    aria-valuemin="0" aria-valuemax="100" aria-valuenow="${s.percent}" aria-label="오늘 진행">
                    <img class="progress-ring-inner" src="${plant.characterImage || DEFAULT_CHARACTER}" alt="${plant.name} 캐릭터" data-fallback />
                  </div>
                  <div class="progress-info">
                    <p class="progress-count">${s.done}/${s.total} 완료</p>
                    <p class="progress-note">${isAi ? '🤖 AI 코치가 오늘 할 일을 골랐어요' : '기본 루틴이에요'}</p>
                  </div>
                </div>
              `}

          <!-- [Daily] 가벼운 안부 루틴 -->
          <div>
            <h3 class="section-title">가벼운 안부 루틴 <span class="tag">하나에 +5 EXP</span></h3>
            <div class="stack">
              ${daily.length
                ? daily.map((item) => renderItem(item))
                : html`<p class="muted">오늘은 가볍게 쉬어 가도 좋아요 🌿</p>`}
            </div>
          </div>

          <!-- [Periodic] 주기적 집중 관리 -->
          <div>
            <h3 class="section-title">주기적 집중 관리 <span class="tag tag-accent">하나에 +20 EXP</span></h3>
            <div class="stack">
              ${periodic.length
                ? periodic.map((item) => renderItem(item))
                : html`<p class="muted">오늘은 쉬어 가는 날이에요 🌿</p>`}
            </div>
          </div>

          <!-- 미룸 (흙이 촉촉해서 미룬 물주기) -->
          ${postponed.length
            ? html`
                <div class="stack">
                  ${postponed.map((item) => renderItem(item))}
                </div>
              `
            : ''}

          <!-- 사진으로 상태 확인하기 (P1 완성 전엔 사진만 기록) -->
          <button type="button" class="btn btn-secondary btn-block photo-check-btn" data-photo ${busy ? 'disabled' : ''}>
            📷 사진으로 상태 확인하기
          </button>

          <!-- 하단: 월간 리포트 -->
          <a class="report-link" href="#/report">📄 이번 달 기록 보기</a>
        </section>
      `;

      // 깨진 캐릭터 이미지 → 기본 캐릭터
      container.querySelectorAll('img[data-fallback]').forEach((img) => {
        img.addEventListener('error', () => (img.src = DEFAULT_CHARACTER), { once: true });
      });
    }

    // ───────── 항목 카드 하나 ─────────
    function renderItem(item) {
      const info = TASK_INFO[item.taskType] ?? {};
      const emoji = info.emoji ?? '🌿';
      const isDone = item.isCompleted;
      const isPostponed = item.postponed;
      const isWater = item.taskType === 'WATER';

      // 주기적 관리: 예정일이 지나면 "n일 지났어요" (차분한 표현)
      let overdueText = '';
      if (item.category === 'PERIODIC_CARE' && !isDone && !isPostponed && item.dueDate && item.dueDate < screenDate) {
        const days = diffDays(item.dueDate, screenDate);
        overdueText = html`<p class="item-overdue">${days}일 지났어요 · 천천히 해도 괜찮아요</p>`;
      }

      return html`
        <div class="item-card ${isDone ? 'is-done' : ''} ${isPostponed ? 'is-postponed' : ''}">
          <span class="item-emoji" aria-hidden="true">${emoji}</span>
          <div class="item-body">
            <p class="item-title">${item.title}</p>
            ${isPostponed
              ? html`<p class="item-postponed">${formatKorean(addDays(today(), 2))}로 미뤘어요. 흙이 아직 촉촉하네요 🌱</p>`
              : isWater && !isDone
                ? html`<p class="item-tip">${info.tip}</p>`
                : ''}
            ${overdueText}
          </div>
          ${isPostponed
            ? ''
            : isDone
              ? html`<button type="button" class="check-btn is-done" disabled aria-label="완료됨">✓</button>`
              : html`<button type="button" class="check-btn" data-complete="${item.id}" aria-label="${item.title} 완료">✓</button>`}
        </div>
      `;
    }

    // ───────── 완료 처리 ─────────
    async function handleComplete(item, btn) {
      if (busy) return;

      // 자정 넘김: 버튼을 눌렀을 때 날짜가 바뀌어 있으면 새로고침 (지침 §5)
      if (today() !== screenDate) {
        toast('날짜가 바뀌었어요', 'info');
        location.reload();
        return;
      }

      // 물주기: Safe-Lock 팝업 (배경·ESC 로 닫히지 않음)
      if (item.taskType === 'WATER') {
        const answer = await choiceModal({
          title: '잠깐! 흙을 먼저 확인해 볼까요?',
          question: '손가락이나 나무젓가락으로 겉흙 3~5cm 안쪽을 찔러보세요. 흙이 말라 있나요?',
          options: ['말라 있어요', '아직 축축해요'],
          dismissible: false,
        });
        if (answer === null) return; // (dismissible:false라 닫힐 수 없지만 안전장치)
        busy = true;
        try {
          const result = await completeItem(plant.id, item.id, {
            soilMoistureDry: answer === '말라 있어요',
          });
          if (result.status === 'postponed') {
            toast('흙이 아직 촉촉하네요. 이틀 뒤에 다시 알려 드릴게요 🌱');
          } else if (result.status === 'completed') {
            afterComplete(btn, item, result);
          }
        } catch (error) {
          console.warn('[checklist] 물주기 완료 실패', error);
          toast(error.message || '완료하지 못했어요. 다시 시도해 주세요.', 'error');
        } finally {
          busy = false;
          if (alive) refresh();
        }
        return;
      }

      // 비료·잎 닦기·분갈이: 확인 팝업
      if (item.category === 'PERIODIC_CARE') {
        const tip = (TASK_INFO[item.taskType] ?? {}).tip ?? '';
        const ok = await confirmModal(`${tip}\n\n다 했나요?`, { okLabel: '다 했어요', cancelLabel: '나중에' });
        if (!ok) return;
        busy = true;
        try {
          const result = await completeItem(plant.id, item.id);
          if (result.status === 'completed') afterComplete(btn, item, result);
        } catch (error) {
          console.warn('[checklist] 완료 실패', error);
          toast('완료하지 못했어요. 다시 시도해 주세요.', 'error');
        } finally {
          busy = false;
          if (alive) refresh();
        }
        return;
      }

      // 데일리 루틴: 바로 완료
      busy = true;
      try {
        const result = await completeItem(plant.id, item.id);
        if (result.status === 'completed') afterComplete(btn, item, result);
      } catch (error) {
        console.warn('[checklist] 완료 실패', error);
        toast('완료하지 못했어요. 다시 시도해 주세요.', 'error');
      } finally {
        busy = false;
        if (alive) refresh();
      }
    }

    // 완료 후: 떠오르는 EXP + 레벨업 축하
    function afterComplete(btn, item, result) {
      floatExp(btn, item.exp);
      celebrateIfLeveledUp(result.expResult, plant).catch(() => {});
    }

    // 저장된 것으로 다시 그림 (완료·미룸 반영)
    async function refresh() {
      try {
        const checklist = await getChecklist(plant.id);
        if (alive && checklist) {
          currentItems = checklist.items;
          draw(checklist);
        }
      } catch (error) {
        console.warn('[checklist] 새로고침 실패', error);
      }
    }

    // ───────── 이벤트 ─────────
    const offs = [
      on(container, 'click', '[data-complete]', async (event, el) => {
        if (busy) return;
        const item = findItem(el.dataset.complete);
        if (!item) return;
        await handleComplete(item, el);
      }),
      // 칩 클릭 → 해당 식물로 전환 (plant 변수만 교체, offs 재정의 방지)
      on(container, 'click', '[data-select-plant]', (event, el) => {
        const next = (store.get('plants') ?? []).find((p) => p.id === el.dataset.selectPlant);
        if (!next || next.id === plant.id) return;
        selectPlant(next.id);
        plant = next;
        // init()을 다시 부르면 offs가 재정의되지 않아 이벤트가 누적됨
        // 대신 plant만 교체하고 draw()로 화면만 갱신
        refresh();
      }),
      on(container, 'click', '[data-photo]', async () => {
        if (busy) return;
        busy = true;
        let species = null;
        try {
          species = await getSpecies(plant.speciesId);
        } catch (error) {
          console.warn('[checklist] 종류 정보 불러오기 실패', error);
        }
        try {
          const result = await runDiagnosisFlow({ plant, species });
          if (result) toast('사진으로 상태를 확인했어요', 'success');
        } catch (error) {
          console.warn('[checklist] 사진 확인 실패', error);
          toast('사진으로 확인하지 못했어요. 다시 시도해 주세요.', 'error');
        } finally {
          busy = false;
        }
      }),
    ];

    let currentItems = [];

    function findItem(id) {
      return currentItems.find((i) => i.id === id) ?? null;
    }

    // ───────── 진입: 오늘 체크리스트 생성 (없으면) ─────────
    async function init() {
      // 자정 넘기 대비: 화면 날짜와 실제 오늘이 다르면 새로고침
      if (today() !== screenDate) {
        toast('날짜가 바뀌었어요', 'info');
        location.reload();
        return;
      }

      container.innerHTML = html`
        <section class="checklist-page">
          <div class="checklist-skeleton">
            <p>AI 코치가 오늘 할 일을 고르는 중이에요…</p>
            <div class="skeleton-line"></div>
            <div class="skeleton-line"></div>
          </div>
        </section>
      `;

      try {
        const { checklist } = await ensureTodayChecklist(plant);
        currentItems = checklist?.items ?? [];
        if (alive) draw(checklist);
      } catch (error) {
        console.warn('[checklist] 오늘 체크리스트 생성 실패', error);
        if (alive) {
          container.innerHTML = html`
            <section class="checklist-page">
              ${emptyState({
                icon: '🌱',
                message: '오늘 할 일을 불러오지 못했어요.',
                actionLabel: '다시 시도',
                actionHref: '#/checklist',
              })}
            </section>
          `;
          toast('오늘 할 일을 불러오지 못했어요. 다시 시도해 주세요.', 'error');
        }
      }
    }

    // 식물 목록이 바뀌면(다른 기기 등) 다시 그림
    const unsubPlants = store.subscribe('plants', () => alive && refresh());

    init();

    return () => {
      alive = false;
      offs.forEach((off) => off());
      unsubPlants();
    };
  },
};
