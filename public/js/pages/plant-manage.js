/**
 * 파일: public/js/pages/plant-manage.js
 * 역할: 내 식물 관리 (#/plants) — 목록, 보기(선택), 수정, 삭제
 * 사용하는 파일: services/plants.js, services/species.js, ui/components.js, utils/dom.js, utils/date.js
 */

import { html, on } from '../utils/dom.js';
import { toast, confirmModal, emptyState, showLoading, hideLoading } from '../ui/components.js';
import { store } from '../core/store.js';
import { navigate } from '../core/router.js';
import { loadPlants, selectPlant, deletePlant, DEFAULT_CHARACTER } from '../services/plants.js';
import { loadSpecies } from '../services/species.js';
import { today, diffDays } from '../utils/date.js';

export default {
  title: '내 식물 관리',
  requiresAuth: true,
  showNav: true,
  styles: ['css/pages/plant.css'],

  async render(container) {
    let alive = true;
    let speciesNames = {};
    try {
      const list = await loadSpecies();
      speciesNames = Object.fromEntries(list.map((s) => [s.id, s.name]));
    } catch (error) {
      console.warn('[plant-manage] 식물 종류 불러오기 실패', error);
    }
    if (!alive) return;

    function draw() {
      const plants = store.get('plants') ?? [];
      const currentId = store.get('currentPlantId');

      container.innerHTML = html`
        <section class="plant-manage stack">
          <a class="btn btn-primary btn-block" href="#/plants/new">+ 새 식물 등록</a>
          ${plants.length === 0
            ? emptyState({
                icon: '🪴',
                message: '아직 함께하는 식물이 없어요.\n첫 식물 친구를 등록해 볼까요?',
                actionLabel: '식물 등록하기',
                actionHref: '#/plants/new',
              })
            : html`
                <ul class="plant-cards stack">
                  ${plants.map((p) => {
                    const days = p.purchasedAt ? diffDays(p.purchasedAt, today()) + 1 : 1;
                    return html`
                      <li class="card plant-card ${p.id === currentId ? 'is-current' : ''}">
                        <div class="plant-card-main">
                          <img class="plant-thumb" src="${p.characterImage || DEFAULT_CHARACTER}" alt="${p.name} 캐릭터" data-fallback />
                          <div class="plant-card-info">
                            <p class="plant-card-name">
                              ${p.name}
                              ${p.id === currentId ? html`<span class="chip is-active chip-sm">지금 보는 중</span>` : ''}
                            </p>
                            <p class="muted">${speciesNames[p.speciesId] ?? ''} · Lv.${p.level ?? 1}</p>
                            <p class="muted">함께한 지 ${days}일째</p>
                          </div>
                        </div>
                        <div class="plant-card-actions">
                          <button type="button" class="btn btn-secondary btn-sm" data-action="view" data-id="${p.id}">이 식물 보기</button>
                          <a class="btn btn-ghost btn-sm" href="#/plants/${p.id}/edit">수정</a>
                          <button type="button" class="btn btn-ghost btn-sm" data-action="delete" data-id="${p.id}">삭제</button>
                        </div>
                      </li>
                    `;
                  })}
                </ul>
              `}
        </section>
      `;

      container.querySelectorAll('img[data-fallback]').forEach((img) => {
        img.addEventListener('error', () => (img.src = DEFAULT_CHARACTER), { once: true });
      });
    }

    const offClick = on(container, 'click', '[data-action]', async (event, el) => {
      const plant = (store.get('plants') ?? []).find((p) => p.id === el.dataset.id);
      if (!plant) return;

      if (el.dataset.action === 'view') {
        selectPlant(plant.id);
        navigate('/main');
        return;
      }

      if (el.dataset.action === 'delete') {
        const ok = await confirmModal(`${plant.name}의 성장 기록도 모두 지워져요. 정말 삭제할까요?`, { okLabel: '삭제' });
        if (!ok) return;
        showLoading('기록을 정리하는 중이에요…');
        try {
          await deletePlant(plant.id);
          toast(`${plant.name}의 기록을 정리했어요`, 'success');
        } catch (error) {
          console.warn('[plant-manage] 삭제 실패', error);
          toast('삭제하지 못했어요. 잠시 후 다시 시도해 주세요.', 'error');
        } finally {
          hideLoading();
        }
        if (alive && (store.get('plants') ?? []).length === 0) navigate('/plants/new');
      }
    });

    // 목록이 바뀌면(삭제·수정 등) 다시 그림
    const unsubPlants = store.subscribe('plants', () => alive && draw());
    const unsubCurrent = store.subscribe('currentPlantId', () => alive && draw());

    draw();
    // 최신 목록으로 한 번 더 (다른 기기에서 바뀌었을 수도 있음)
    loadPlants().catch((error) => console.warn('[plant-manage] 목록 새로고침 실패', error));

    return () => {
      alive = false;
      offClick();
      unsubPlants();
      unsubCurrent();
    };
  },
};
