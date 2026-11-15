/**
 * 파일: public/js/pages/main.js
 * 역할: 메인 게임 화면 (#/main) — 캐릭터 표시, 식물 선택, 쓰다듬기, 레벨 바, 체크리스트 바로가기, 메뉴
 * 사용하는 파일: services/plants.js, services/game.js, services/checklists.js,
 *               ui/components.js, utils/dom.js, utils/date.js
 * 담당: C6
 *
 * ★ Anti-Guilt: 캐릭터는 절대 시들거나 슬퍼 보이지 않습니다. 밀린 일정은 "차분히 기다리는 중"으로만 표현.
 * ★ 체크리스트 완료 로직은 여기 없습니다(P3). 이 화면은 남은 개수만 보여 주고 이동만 합니다.
 */

import { html, on } from '../utils/dom.js';
import { emptyState } from '../ui/components.js';
import { store } from '../core/store.js';
import { getCurrentPlant, selectPlant, DEFAULT_CHARACTER } from '../services/plants.js';
import {
  EXP,
  STATE_MESSAGES,
  PET_MESSAGES,
  levelFromExp,
  expProgress,
  stageFromLevel,
  unlockedItems,
  refreshPlantState,
  awardExp,
} from '../services/game.js';
import { getChecklist, summarize } from '../services/checklists.js';
import { today, formatKorean } from '../utils/date.js';

const STAGE_SCALE = { SPROUT: 0.75, YOUNG: 0.9, LUSH: 1.05 };
const PET_COOLDOWN_MS = 1000;
const PET_RUB_DISTANCE = 60; // 좌우로 60px 이상 문지르면 쓰다듬기
const PET_EXP_PER_DAY = 3;
const PET_EXP_KEY = 'plantCoach.petExp';

const MENU = [
  { icon: '☀️', label: 'AI 환경 분석', href: '#/environment' },
  { icon: '📅', label: '성장 캘린더', href: '#/calendar' },
  { icon: '📄', label: '월간 리포트', href: '#/report' },
  { icon: '🪴', label: '식물 관리', href: '#/plants' },
];

// 쓰다듬기 경험치는 하루 3번까지 (지금은 EXP.PET = 0 이라 실제로는 쓰이지 않음)
function canAwardPetExp(plantId) {
  try {
    const saved = JSON.parse(localStorage.getItem(PET_EXP_KEY) ?? '{}');
    const key = `${today()}:${plantId}`;
    if ((saved[key] ?? 0) >= PET_EXP_PER_DAY) return false;
    localStorage.setItem(PET_EXP_KEY, JSON.stringify({ [key]: (saved[key] ?? 0) + 1 }));
    return true;
  } catch {
    return false;
  }
}

function stateExtras(state) {
  if (state === 'ALERT') return html`<span class="magnifier" aria-hidden="true">🔍</span>`;
  if (state === 'GROWING') {
    return html`<span class="sparkles" aria-hidden="true">${Array.from({ length: 7 }, (_, i) => html`<i style="--i: ${i}">✦</i>`)}</span>`;
  }
  return '';
}

export default {
  title: '내 식물',
  requiresAuth: true,
  showNav: true,
  styles: ['css/pages/main.css'],

  async render(container) {
    let alive = true;
    let lastPetAt = 0;
    let bubbleTimer = null;
    let summaryRetryTimer = null;
    let summaryToken = 0;

    // ───────── 그리기 ─────────
    function draw() {
      const plants = store.get('plants') ?? [];
      const plant = getCurrentPlant();
      const user = store.get('user');

      if (!plant) {
        container.innerHTML = html`
          <section class="main-page">
            ${emptyState({
              icon: '🌱',
              message: '아직 함께하는 식물이 없어요.\n첫 식물 친구를 등록해 볼까요?',
              actionLabel: '식물 등록하기',
              actionHref: '#/plants/new',
            })}
          </section>
        `;
        return;
      }

      const exp = plant.exp ?? 0;
      const level = levelFromExp(exp);
      const stage = stageFromLevel(level);
      const progress = expProgress(exp);
      const state = plant.state ?? 'PEACEFUL';
      const decos = unlockedItems(level);

      container.innerHTML = html`
        <section class="main-page">
          <div class="greeting">
            <p class="greeting-text">${user?.nickname || '집사'}님, 오늘도 반가워요 🌿</p>
            <p class="muted">${formatKorean(today())}</p>
          </div>

          ${plants.length >= 2
            ? html`
                <div class="plant-selector" role="tablist" aria-label="식물 고르기">
                  ${plants.map(
                    (p) => html`
                      <button type="button" class="chip selector-chip ${p.id === plant.id ? 'is-active' : ''}" role="tab"
                        aria-selected="${p.id === plant.id ? 'true' : 'false'}" data-select="${p.id}">
                        <img src="${p.characterImage || DEFAULT_CHARACTER}" alt="" data-fallback />
                        <span>${p.name}</span>
                      </button>
                    `,
                  )}
                  <a class="chip selector-chip selector-add" href="#/plants/new" aria-label="새 식물 등록">+</a>
                </div>
              `
            : html`<h2 class="plant-name-only">${plant.name}</h2>`}

          <div class="stage state-${state.toLowerCase()}" style="--char-scale: ${STAGE_SCALE[stage.id] ?? 0.9}">
            <div class="bubble" data-bubble aria-live="polite">
              <span data-bubble-text>${STATE_MESSAGES[state]}</span>
              ${state === 'WAITING' ? html`<span class="dots" aria-hidden="true"><i>.</i><i>.</i><i>.</i></span>` : ''}
            </div>
            ${state === 'ALERT' ? html`<a class="btn btn-secondary btn-sm alert-link" href="#/calendar">성장 캘린더에서 살펴보기</a>` : ''}

            <div class="character-wrap" data-character role="button" tabindex="0" aria-label="${plant.name} 쓰다듬기">
              <div class="character-body" data-character-body>
                <img class="character-img" src="${plant.characterImage || DEFAULT_CHARACTER}" alt="${plant.name} 캐릭터" draggable="false" data-fallback />
                ${decos.map((d) => html`<img class="deco deco-${d.id}" src="${d.image}" alt="${d.name}" draggable="false" />`)}
              </div>
              ${stateExtras(state)}
            </div>
            <div class="floor-shadow" aria-hidden="true"></div>
          </div>

          <div class="card level-card">
            <div class="level-head">
              <strong>Lv.${level} · ${stage.name}</strong>
              <span class="muted">다음 레벨까지 ${progress.needed - progress.current} EXP</span>
            </div>
            <div class="exp-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress.percent}" aria-label="경험치">
              <div class="exp-fill" style="width: ${progress.percent}%"></div>
            </div>
          </div>

          <a class="card checklist-card" href="#/checklist">
            <div>
              <p class="card-title">✅ 오늘의 체크리스트</p>
              <p class="card-sub">할 일을 마치면 경험치가 쌓여요</p>
              <p class="checklist-summary" data-checklist-summary>불러오는 중…</p>
            </div>
            <span class="btn btn-primary btn-sm">보러 가기</span>
          </a>

          <nav class="menu-grid" aria-label="다른 화면">
            ${MENU.map(
              (m) => html`
                <a class="card menu-card" href="${m.href}">
                  <span class="menu-icon" aria-hidden="true">${m.icon}</span>
                  <span>${m.label}</span>
                </a>
              `,
            )}
          </nav>
        </section>
      `;

      // 깨진 캐릭터 이미지 → 기본 캐릭터
      container.querySelectorAll('img[data-fallback]').forEach((img) => {
        img.addEventListener('error', () => (img.src = DEFAULT_CHARACTER), { once: true });
      });

      loadChecklistSummary(plant.id);
    }

    // 체크리스트 카드의 "남은 할 일 N개"
    async function loadChecklistSummary(plantId, isRetry = false) {
      const token = ++summaryToken;
      clearTimeout(summaryRetryTimer);
      let text = '오늘 할 일을 확인해 보세요';
      try {
        const checklist = await getChecklist(plantId);
        if (checklist) {
          const s = summarize(checklist);
          text = s.total > 0 && s.remaining === 0 ? '오늘 할 일 완료! ✨' : `남은 할 일 ${s.remaining}개`;
        } else if (!isRetry) {
          // 로그인 직후엔 체크리스트가 뒤에서 만들어지는 중일 수 있어 한 번만 다시 확인
          summaryRetryTimer = setTimeout(() => alive && loadChecklistSummary(plantId, true), 2500);
        }
      } catch (error) {
        console.warn('[main] 체크리스트 요약 불러오기 실패', error);
      }
      if (!alive || token !== summaryToken) return;
      const el = container.querySelector('[data-checklist-summary]');
      if (el) el.textContent = text;
    }

    // 상태(PEACEFUL/WAITING/ALERT/GROWING) 다시 계산 — 저장된 상태로 먼저 그리고, 끝나면 store 변경으로 다시 그려짐
    function refreshState() {
      const plant = getCurrentPlant();
      if (!plant) return;
      refreshPlantState(plant.id).catch((error) => console.warn('[main] 상태 계산 실패 — 저장된 상태로 표시', error));
    }

    // ───────── 쓰다듬기 ─────────
    function pet() {
      const now = Date.now();
      if (now - lastPetAt < PET_COOLDOWN_MS) return; // 1초에 한 번만
      lastPetAt = now;

      const body = container.querySelector('[data-character-body]');
      const wrap = container.querySelector('[data-character]');
      const bubbleText = container.querySelector('[data-bubble-text]');
      if (!body || !wrap) return;

      // 말랑하게 눌리는 동작
      body.classList.remove('is-squish');
      void body.offsetWidth; // 애니메이션을 처음부터 다시 시작하게 하는 작은 요령
      body.classList.add('is-squish');

      // 💚 하나가 위로 떠오름
      const heart = document.createElement('span');
      heart.className = 'pet-heart';
      heart.textContent = '💚';
      heart.setAttribute('aria-hidden', 'true');
      wrap.appendChild(heart);
      setTimeout(() => heart.remove(), 1200);

      // 말풍선 2초 동안 바뀜
      const plant = getCurrentPlant();
      if (bubbleText) {
        bubbleText.textContent = PET_MESSAGES[Math.floor(Math.random() * PET_MESSAGES.length)];
        clearTimeout(bubbleTimer);
        bubbleTimer = setTimeout(() => {
          const el = container.querySelector('[data-bubble-text]');
          const current = getCurrentPlant();
          if (el && current) el.textContent = STATE_MESSAGES[current.state ?? 'PEACEFUL'];
        }, 2000);
      }

      // 팀이 쓰다듬기 경험치를 정하면(EXP.PET > 0) 하루 3번까지 지급
      if (EXP.PET > 0 && plant && canAwardPetExp(plant.id)) {
        awardExp(plant.id, EXP.PET, 'PET').catch((error) => console.warn('[main] 쓰다듬기 경험치 실패', error));
      }
    }

    // 포인터 이벤트: 마우스·손가락·펜을 한 번에 처리하는 브라우저 이벤트
    let stroke = null; // { startX, lastX, travel, startedAt, petted }
    const offs = [
      on(container, 'pointerdown', '[data-character]', (event, el) => {
        stroke = { startX: event.clientX, lastX: event.clientX, travel: 0, startedAt: Date.now(), petted: false };
        // 손가락이 캐릭터 밖으로 조금 나가도 계속 이 요소로 이벤트가 오게 "붙잡기"
        try {
          el.setPointerCapture(event.pointerId);
        } catch {
          /* 지원하지 않으면 무시 */
        }
      }),
      on(container, 'pointermove', '[data-character]', (event) => {
        if (!stroke) return;
        stroke.travel += Math.abs(event.clientX - stroke.lastX);
        stroke.lastX = event.clientX;
        if (!stroke.petted && stroke.travel >= PET_RUB_DISTANCE) {
          stroke.petted = true;
          pet();
        }
      }),
      on(container, 'pointerup', '[data-character]', () => {
        // 짧게 톡 누른 것 = 탭
        if (stroke && !stroke.petted && stroke.travel < 10) pet();
        stroke = null;
      }),
      on(container, 'pointercancel', '[data-character]', () => (stroke = null)),
      on(container, 'keydown', '[data-character]', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          pet();
        }
      }),
      // 식물 고르기
      on(container, 'click', '[data-select]', (event, el) => selectPlant(el.dataset.select)),
    ];

    // ───────── 구독 ─────────
    const unsubPlants = store.subscribe('plants', () => alive && draw());
    const unsubCurrent = store.subscribe('currentPlantId', () => {
      if (!alive) return;
      draw();
      refreshState();
    });

    draw();
    refreshState();

    return () => {
      alive = false;
      clearTimeout(bubbleTimer);
      clearTimeout(summaryRetryTimer);
      offs.forEach((off) => off());
      unsubPlants();
      unsubCurrent();
    };
  },
};
