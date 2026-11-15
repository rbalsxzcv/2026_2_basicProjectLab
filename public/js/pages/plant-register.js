/**
 * 파일: public/js/pages/plant-register.js
 * 역할: 식물 등록 (#/plants/new) / 식물 정보 수정 (#/plants/:id/edit)
 *       종류 선택 → 별명 → 구입일 → (수명) → 사진 → AI 캐릭터 만들기 → 등록
 * 사용하는 파일: services/species.js, services/plants.js, services/images.js, core/ai.js,
 *               utils/image.js, utils/date.js, utils/dom.js, ui/components.js
 * 담당: C4
 */

import { html, on } from '../utils/dom.js';
import { toast, openModal, showLoading, hideLoading } from '../ui/components.js';
import { store } from '../core/store.js';
import { navigate } from '../core/router.js';
import { setTitle } from '../ui/layout.js';
import { generateCharacter } from '../core/ai.js';
import { searchSpecies, getSpecies } from '../services/species.js';
import { createPlant, updatePlant, getPlant, DEFAULT_CHARACTER } from '../services/plants.js';
import { prepareImageForSave } from '../services/images.js';
import { fileToDataUrl } from '../utils/image.js';
import { today, addDays } from '../utils/date.js';

const LIFESPAN_TYPES_WITH_END = ['ANNUAL', 'BIENNIAL', 'HARVEST'];

function needsLifespan(species) {
  return LIFESPAN_TYPES_WITH_END.includes(species?.lifespanType);
}

function speciesSummary(species) {
  return html`
    <div class="species-selected card">
      <p class="card-title">🌿 ${species.name}</p>
      <p class="card-sub">${species.careTip}</p>
      <p class="species-meta">💧 물주기 권장 간격: 약 ${species.waterIntervalDays}일</p>
    </div>
  `;
}

export default {
  title: '식물 등록',
  requiresAuth: true,
  showNav: true,
  styles: ['css/pages/plant.css'],

  async render(container, params) {
    const isEdit = Boolean(params.id);
    let alive = true;
    let busy = false;

    // 화면 상태
    let selectedSpecies = null;
    let photoDataUrl = null; // 고른 사진 (압축된 data URL)
    let editPlant = null;
    let newCharacter = null; // 수정 모드에서 다시 만든 캐릭터
    let endDateTouched = false; // 사용자가 마무리 날짜를 직접 바꿨는지

    if (isEdit) {
      setTitle('식물 정보 수정'); // 같은 파일을 쓰므로 수정 모드일 때만 제목을 바꿈
      try {
        editPlant = (store.get('plants') ?? []).find((p) => p.id === params.id) ?? (await getPlant(params.id));
        selectedSpecies = editPlant ? await getSpecies(editPlant.speciesId) : null;
      } catch (error) {
        console.warn('[plant-register] 식물 불러오기 실패', error);
      }
      if (!alive) return;
      if (!editPlant) {
        container.innerHTML = html`
          <div class="card stack center">
            <p>식물 정보를 찾지 못했어요.</p>
            <a class="btn btn-secondary" href="#/plants">내 식물 관리로</a>
          </div>
        `;
        return () => {
          alive = false;
        };
      }
    }

    const hasPlants = (store.get('plants') ?? []).length > 0;
    const todayStr = today();

    container.innerHTML = html`
      <section class="plant-register stack">
        <p class="register-intro">
          ${isEdit ? '식물 정보를 고칠 수 있어요' : hasPlants ? '새 식물 친구를 등록해요' : '반가워요! 함께할 첫 식물을 알려 주세요 🌱'}
        </p>

        <form class="stack" novalidate data-form>
          <!-- 1. 종류 -->
          <div class="field">
            <span class="label">식물 종류 ${isEdit ? '' : html`<span class="required">(필수)</span>`}</span>
            ${isEdit
              ? html`
                  <input class="input" type="text" value="${selectedSpecies?.name ?? ''}" disabled aria-label="식물 종류" />
                  <p class="muted">종류를 바꾸려면 새로 등록해 주세요</p>
                `
              : html`
                  <input class="input" type="search" data-species-search placeholder="예) 몬스테라, 스투키" aria-label="식물 종류 검색" />
                  <div data-species-selected></div>
                  <ul class="species-list" data-species-list></ul>
                  <p class="muted">목록에 없나요? 비슷한 종류를 골라 주세요</p>
                `}
          </div>

          <!-- 2. 별명 -->
          <div class="field">
            <label class="label" for="pr-name">이름 (별명, 선택)</label>
            <input class="input" id="pr-name" name="name" type="text" maxlength="12"
              placeholder="${selectedSpecies?.name ?? '종류 이름이 들어가요'}" value="${editPlant?.name ?? ''}" />
          </div>

          <!-- 3. 구입일 -->
          <div class="field">
            <label class="label" for="pr-date">데려온 날 (선택)</label>
            <input class="input" id="pr-date" name="purchasedAt" type="date" max="${todayStr}"
              value="${editPlant?.purchasedAt ?? todayStr}" />
          </div>

          <!-- 4. 수명 (한해살이·수확 식물만) -->
          <div class="field hidden" data-lifespan-field>
            <label class="label" for="pr-end">예상 마무리 날짜</label>
            <input class="input" id="pr-end" name="endDate" type="date" value="${editPlant?.lifespan?.endDate ?? ''}" />
            <p class="muted">한해살이·수확 식물은 마무리 시기에 맞춰 안내해 드려요.</p>
          </div>

          <!-- 5. 사진 -->
          <div class="field">
            <span class="label">사진 (선택)</span>
            <div class="photo-pick">
              <div class="photo-preview" data-photo-preview>
                ${isEdit
                  ? html`<img src="${editPlant.characterImage || DEFAULT_CHARACTER}" alt="지금 캐릭터" data-fallback />`
                  : html`<span class="photo-placeholder" aria-hidden="true">📷</span>`}
              </div>
              <label class="btn btn-secondary">
                사진 고르기
                <input class="sr-only" type="file" accept="image/*" capture="environment" data-photo-input />
              </label>
            </div>
            <p class="muted">사진을 올리면 AI가 내 식물을 닮은 캐릭터를 그려 줘요.</p>
            ${isEdit
              ? html`<button type="button" class="btn btn-secondary btn-block hidden" data-regen>이 사진으로 캐릭터 다시 만들기</button>`
              : ''}
          </div>

          <button type="submit" class="btn btn-primary btn-block" data-submit ${isEdit ? '' : 'disabled'}>
            ${isEdit ? '저장하기' : '등록하기'}
          </button>
        </form>
      </section>
    `;

    const form = container.querySelector('[data-form]');
    const submitBtn = form.querySelector('[data-submit]');
    const lifespanField = form.querySelector('[data-lifespan-field]');
    const previewEl = form.querySelector('[data-photo-preview]');
    const regenBtn = form.querySelector('[data-regen]');

    // 깨진 이미지 → 기본 캐릭터
    form.querySelectorAll('img[data-fallback]').forEach((img) => {
      img.addEventListener('error', () => (img.src = DEFAULT_CHARACTER), { once: true });
    });

    // ───── 수명 칸 보이기/숨기기 ─────
    function defaultEndDate() {
      const start = form.purchasedAt.value || todayStr;
      return selectedSpecies?.defaultLifespanDays ? addDays(start, selectedSpecies.defaultLifespanDays) : '';
    }

    // 한해살이·수확 식물만 마무리 날짜 칸을 보여 주고, 비어 있으면 기본값(데려온 날 + 기본 수명)을 채움
    function updateLifespanField() {
      const show = needsLifespan(selectedSpecies);
      lifespanField.classList.toggle('hidden', !show);
      if (show && !form.endDate.value) form.endDate.value = defaultEndDate();
    }

    form.endDate.addEventListener('input', () => (endDateTouched = true));
    form.purchasedAt.addEventListener('change', () => {
      if (form.purchasedAt.value > todayStr) form.purchasedAt.value = todayStr; // 미래 날짜 막기
      if (!endDateTouched && !isEdit) form.endDate.value = defaultEndDate();
    });

    // ───── 종류 검색 (등록 모드) ─────
    const searchInput = form.querySelector('[data-species-search]');
    const listEl = form.querySelector('[data-species-list]');
    const selectedEl = form.querySelector('[data-species-selected]');

    async function drawSpeciesList(keyword = '') {
      let list = [];
      try {
        list = await searchSpecies(keyword);
      } catch (error) {
        console.warn('[plant-register] 식물 목록 불러오기 실패', error);
        if (alive) listEl.innerHTML = html`<li class="muted">식물 목록을 불러오지 못했어요. 새로고침해 주세요.</li>`;
        return;
      }
      if (!alive) return;
      listEl.innerHTML = list.length
        ? html`${list.map(
            (s) => html`
              <li>
                <button type="button" class="species-item ${selectedSpecies?.id === s.id ? 'is-selected' : ''}" data-species-id="${s.id}"
                  aria-pressed="${selectedSpecies?.id === s.id ? 'true' : 'false'}">
                  <span class="species-name">${s.name}</span>
                  <span class="species-alias">${(s.aliases ?? []).join(', ')}</span>
                </button>
              </li>
            `,
          )}`
        : html`<li class="muted species-empty">검색 결과가 없어요.</li>`;
    }

    async function chooseSpecies(id) {
      selectedSpecies = await getSpecies(id);
      if (!alive || !selectedSpecies) return;
      selectedEl.innerHTML = speciesSummary(selectedSpecies);
      form.name.placeholder = selectedSpecies.name;
      endDateTouched = false;
      form.endDate.value = ''; // 종류가 바뀌면 마무리 날짜도 새 기본값으로
      updateLifespanField();
      submitBtn.disabled = false;
      drawSpeciesList(searchInput.value);
    }

    const offs = [];
    if (!isEdit) {
      searchInput.addEventListener('input', () => drawSpeciesList(searchInput.value));
      offs.push(on(listEl, 'click', '[data-species-id]', (event, el) => chooseSpecies(el.dataset.speciesId)));
      drawSpeciesList();
    } else {
      updateLifespanField();
    }

    // ───── 사진 고르기 ─────
    form.querySelector('[data-photo-input]').addEventListener('change', async (event) => {
      const file = event.target.files?.[0];
      event.target.value = ''; // 같은 사진을 다시 골라도 change 가 일어나게
      if (!file) return;
      try {
        photoDataUrl = await fileToDataUrl(file);
      } catch (error) {
        toast(error.message || '사진을 읽지 못했어요.', 'error');
        return;
      }
      if (!alive) return;
      previewEl.innerHTML = html`<img src="${photoDataUrl}" alt="고른 사진 미리보기" />`;
      regenBtn?.classList.remove('hidden');
    });

    // 사진 → 캐릭터. 실패하면 null
    async function makeCharacter() {
      try {
        const result = await generateCharacter({ imageBase64: photoDataUrl, speciesName: selectedSpecies?.name ?? '식물' });
        return await prepareImageForSave(result.imageBase64);
      } catch (error) {
        console.warn('[plant-register] 캐릭터 만들기 실패', error?.message);
        return null;
      }
    }

    // 수정 모드: [이 사진으로 캐릭터 다시 만들기]
    regenBtn?.addEventListener('click', async () => {
      if (busy || !photoDataUrl) return;
      busy = true;
      showLoading('내 식물을 닮은 캐릭터를 그리는 중이에요…');
      const character = await makeCharacter();
      hideLoading();
      busy = false;
      if (!alive) return;
      if (!character) {
        toast('캐릭터는 나중에 다시 만들 수 있어요');
        return;
      }
      newCharacter = character;
      previewEl.innerHTML = html`<img src="${character}" alt="새 캐릭터 미리보기" />`;
      toast('새 캐릭터가 준비됐어요. 저장하면 바뀌어요.', 'success');
    });

    // ───── 등록 / 저장 ─────
    async function submitRegister() {
      if (!selectedSpecies) {
        toast('식물 종류를 골라 주세요.', 'error');
        return;
      }
      const purchasedAt = form.purchasedAt.value || todayStr;
      const lifespan = {
        type: selectedSpecies.lifespanType ?? 'PERENNIAL',
        endDate: needsLifespan(selectedSpecies) ? form.endDate.value || defaultEndDate() || null : null,
      };

      let characterImage = DEFAULT_CHARACTER;
      let photoForSave = null;
      if (photoDataUrl) {
        showLoading('내 식물을 닮은 캐릭터를 그리는 중이에요…');
        try {
          photoForSave = await prepareImageForSave(photoDataUrl);
        } catch (error) {
          hideLoading();
          toast(error.message || '사진이 너무 커요. 다른 사진을 골라 주세요.', 'error');
          return;
        }
        const character = await makeCharacter();
        hideLoading();
        if (!alive) return; // 그사이 다른 화면으로 이동 → 결과 무시
        if (character) characterImage = character;
        else toast('캐릭터는 나중에 다시 만들 수 있어요');
      }

      showLoading('식물 친구를 등록하는 중이에요…');
      let plant;
      try {
        plant = await createPlant({
          speciesId: selectedSpecies.id,
          name: form.name.value,
          purchasedAt,
          lifespan,
          photoDataUrl: photoForSave,
          characterImage,
        });
      } finally {
        hideLoading();
      }
      if (!alive) return;

      const welcome = html`
        <div class="welcome stack center">
          <img class="welcome-img" src="${plant.characterImage}" alt="${plant.name} 캐릭터" />
          <p class="welcome-text">${plant.name}(이)가 Lv.1로 태어났어요!</p>
        </div>
      `;
      await openModal({ title: '🌱 환영해요!', body: welcome, actions: [{ label: '만나러 가기', value: true, variant: 'primary' }] });
      navigate('/main');
    }

    async function submitEdit() {
      const lifespan = needsLifespan(selectedSpecies)
        ? { type: selectedSpecies.lifespanType, endDate: form.endDate.value || null }
        : editPlant.lifespan;
      const patch = {
        name: form.name.value,
        purchasedAt: form.purchasedAt.value || editPlant.purchasedAt,
        lifespan,
      };
      if (newCharacter) patch.characterImage = newCharacter;
      await updatePlant(editPlant.id, patch);
      if (!alive) return;
      toast('저장했어요', 'success');
      navigate('/plants');
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (busy) return; // 두 번 누르기 방지
      busy = true;
      submitBtn.disabled = true;
      try {
        if (isEdit) await submitEdit();
        else await submitRegister();
      } catch (error) {
        console.warn('[plant-register] 저장 실패', error);
        toast('저장하지 못했어요. 잠시 후 다시 시도해 주세요.', 'error');
      } finally {
        busy = false;
        if (alive) submitBtn.disabled = !isEdit && !selectedSpecies;
      }
    });

    return () => {
      alive = false;
      offs.forEach((off) => off());
    };
  },
};
