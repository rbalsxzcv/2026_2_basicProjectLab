/**
 * 파일: public/js/pages/environment.js
 * 역할: AI 환경 분석 화면 (#/environment) — 밝기 측정, 날씨, 실내 환경, 적합도 점수, AI 코치 조언, 과거 기록
 * 사용하는 파일: core/store.js, core/ai.js, core/weather.js, services/plants.js, services/species.js,
 *               services/environments.js, services/aiHistory.js, ui/components.js,
 *               utils/dom.js, utils/date.js, utils/lux.js, utils/envScore.js
 * 담당: P5
 */

import { html, on } from '../utils/dom.js';
import { toDateStr, formatKorean } from '../utils/date.js';
import { store } from '../core/store.js';
import { analyzeEnvironment } from '../core/ai.js';
import { getWeather } from '../core/weather.js';
import { getCurrentPlant, selectPlant, DEFAULT_CHARACTER } from '../services/plants.js';
import { getSpecies, speciesProfile } from '../services/species.js';
import { saveEnvironment, listEnvironments } from '../services/environments.js';
import { addHistory } from '../services/aiHistory.js';
import { toast, showLoading, hideLoading, gauge, emptyState } from '../ui/components.js';
import { canMeasure, measureLux, MANUAL_PRESETS, stopCamera } from '../utils/lux.js';
import { calcMatchScore, ruleBasedTips, LIGHT_LABEL } from '../utils/envScore.js';

const WINDOW_DIRS = ['남향', '동향', '서향', '북향', '창문 없음'];

// 측정된 lux 를 "약 1,200 lux (추정)" 형태로 표시 (정확한 수치로 오해하지 않게 항상 추정 표기)
function formatEstimatedLux(lux) {
  return `약 ${Math.round(Number(lux) || 0).toLocaleString('ko-KR')} lux (추정)`;
}

function formatHistoryDate(measuredAt) {
  const dateStr = toDateStr(measuredAt);
  return dateStr ? formatKorean(dateStr) : '방금 전';
}

export default {
  title: 'AI 환경 분석',
  requiresAuth: true,
  showNav: true,
  styles: ['css/pages/environment.css'],

  async render(container) {
    let disposed = false;

    const plants = store.get('plants') ?? [];
    if (plants.length === 0) {
      container.innerHTML = html`
        <section class="page-environment">
          ${emptyState({
            icon: '🌱',
            message: '아직 등록된 식물이 없어요. 식물을 먼저 등록해 주세요.',
            actionLabel: '식물 등록하기',
            actionHref: '#/plants/new',
          })}
        </section>
      `;
      return () => {};
    }

    // 화면 상태
    const state = {
      plant: getCurrentPlant(),
      species: null,
      // ① 밝기 측정 상태
      measuredLux: null,
      luxSource: null, // 'sensor' | 'camera' | 'manual'
      measuring: false,
      progress: 0,
      manualMode: false,
      cameraNotice: '',
      // ② 날씨 상태
      region: store.get('user')?.home?.region ?? '',
      homeType: store.get('user')?.home?.homeType ?? '아파트',
      weather: null,
      weatherLoading: false,
      weatherError: false,
      // ③ 실내 환경
      windowDir: '남향',
      heaterOrAcExposed: false,
      // 분석 결과 및 과거 기록
      result: null, // { score, lightLevel, breakdown, coach: { goodPoint, actions }, isFallback }
      history: [],
    };

    // 현재 선택된 식물의 종 정보와 과거 측정 기록 불러오기
    async function loadPlantData() {
      state.plant = getCurrentPlant();
      if (!state.plant) return;
      try {
        const [species, history] = await Promise.all([
          getSpecies(state.plant.speciesId),
          listEnvironments(state.plant.id, 5),
        ]);
        if (disposed) return;
        state.species = species;
        state.history = history;
      } catch (error) {
        console.warn('[environment] 식물/이력 불러오기 실패', error);
      }
    }

    // 거주지역 날씨 불러오기
    async function loadWeather() {
      if (!state.region) {
        state.weather = null;
        state.weatherError = false;
        return;
      }
      state.weatherLoading = true;
      state.weatherError = false;
      drawWeather();
      try {
        const weather = await getWeather(state.region);
        if (disposed) return;
        state.weather = weather;
      } catch (error) {
        if (disposed) return;
        console.warn('[environment] 날씨 불러오기 실패', error);
        state.weather = null;
        state.weatherError = true;
      } finally {
        state.weatherLoading = false;
        if (!disposed) drawWeather();
      }
    }

    // 부분 DOM 업데이트 (카메라 측정 중 <video> 가 지워지지 않도록 날씨/결과만 따로 갱신 가능)
    function drawWeather() {
      const box = container.querySelector('[data-weather-box]');
      if (!box) return;

      if (!state.region) {
        box.innerHTML = html`
          <p class="card-sub">
            거주지역이 설정되지 않았어요. <a href="#/profile">내 정보에서 거주지역을 설정해 주세요</a>.
          </p>
        `;
        return;
      }
      if (state.weatherLoading) {
        box.innerHTML = html`<p class="card-sub">날씨를 불러오는 중이에요…</p>`;
        return;
      }
      if (state.weatherError || !state.weather) {
        box.innerHTML = html`
          <div class="env-weather-row">
            <span class="card-sub">날씨를 불러오지 못했어요.</span>
            <button type="button" class="btn btn-secondary btn-sm" data-act="retry-weather">다시 불러오기</button>
          </div>
        `;
        return;
      }

      const w = state.weather;
      const rainText = w.precipitation ? '비 옴' : '비 안 옴';
      box.innerHTML = html`
        <div class="env-weather-row">
          <span class="env-weather-text">${state.region} · ${w.tempC}℃ · 습도 ${w.humidity}% · ${rainText}</span>
          ${w.source === 'mock' ? html`<span class="tag">예시 날씨</span>` : ''}
        </div>
      `;
    }

    function drawLuxSection() {
      const box = container.querySelector('[data-lux-box]');
      if (!box) return;

      const capability = canMeasure();
      const canAuto = capability.sensor || capability.camera;
      const showPresets = state.manualMode || !canAuto;

      if (state.measuring) {
        const pct = Math.round(state.progress * 100);
        box.innerHTML = html`
          <div class="env-measure-box">
            <div class="env-progress-ring" data-progress-ring style="--progress: ${pct}">
              <div class="env-camera-wrap">
                <video class="env-camera-video" data-camera-video autoplay muted playsinline></video>
              </div>
              <span class="env-progress-text" data-progress-text>${pct}%</span>
            </div>
            <p class="card-sub">창 쪽을 향해 3초간 움직이지 말아 주세요…</p>
          </div>
        `;
        return;
      }

      if (state.measuredLux !== null && !showPresets) {
        box.innerHTML = html`
          <div class="env-lux-result">
            <div>
              <div class="env-lux-value">${formatEstimatedLux(state.measuredLux)}</div>
              <div class="env-lux-note">카메라·센서 기반 추정치예요.</div>
            </div>
            <button type="button" class="btn btn-secondary btn-sm" data-act="remeasure">다시 재기</button>
          </div>
          <button type="button" class="btn btn-ghost btn-sm" data-act="switch-manual">직접 선택하기</button>
        `;
        return;
      }

      if (showPresets) {
        const notice = state.cameraNotice || (!canAuto ? '카메라를 쓸 수 없는 환경(HTTPS 또는 localhost 필요)이라 위치로 선택해요.' : '');
        box.innerHTML = html`
          ${notice ? html`<p class="card-sub">${notice}</p>` : ''}
          <div class="env-preset-grid">
            ${MANUAL_PRESETS.map(
              (preset) => html`
                <button
                  type="button"
                  class="env-preset-btn ${state.luxSource === 'manual' && state.measuredLux === preset.lux ? 'is-selected' : ''}"
                  data-preset-lux="${preset.lux}"
                >
                  <span>${preset.label}</span>
                  <span class="env-preset-lux">약 ${preset.lux.toLocaleString('ko-KR')} lux (추정)</span>
                </button>
              `,
            )}
          </div>
          ${state.measuredLux !== null
            ? html`<p class="env-lux-note">선택한 밝기: <strong>${formatEstimatedLux(state.measuredLux)}</strong></p>`
            : ''}
          ${canAuto
            ? html`<button type="button" class="btn btn-ghost btn-sm" data-act="switch-camera">카메라로 다시 측정하기</button>`
            : ''}
        `;
        return;
      }

      box.innerHTML = html`
        <button type="button" class="btn btn-primary btn-block" data-act="start-measure">측정 시작</button>
        <button type="button" class="btn btn-ghost btn-sm" data-act="switch-manual">카메라 없이 위치로 고르기</button>
      `;
    }

    function drawAnalyzeButton() {
      const btn = container.querySelector('[data-act="analyze"]');
      if (btn) btn.disabled = state.measuredLux === null || state.measuring;
    }

    function drawResult() {
      const box = container.querySelector('[data-result-box]');
      if (!box) return;
      if (!state.result) {
        box.innerHTML = '';
        return;
      }

      const { score, lightLevel: level, breakdown, coach, isFallback } = state.result;
      const badgeClass = level === 'OK' ? 'tag' : 'tag tag-accent';

      box.innerHTML = html`
        <section class="card stack">
          <div class="env-result-top">
            <div>
              <div class="card-sub">환경 적합도</div>
              <div class="env-score-big">${score}<span class="env-score-unit">점</span></div>
            </div>
            <span class="${badgeClass}">${LIGHT_LABEL[level] ?? level}</span>
          </div>

          ${gauge(score, { label: '종합 점수' })}

          <div class="env-coach-box">
            <div class="row" style="justify-content: space-between; align-items: center;">
              <strong>AI 코치 조언</strong>
              ${isFallback ? html`<span class="tag tag-accent">기본 가이드를 보여 드려요</span>` : ''}
            </div>
            <p class="env-good-point">👍 ${coach.goodPoint}</p>
            <ul class="env-action-list">
              ${coach.actions.map(
                (action) => html`
                  <li class="env-action-item">
                    <span class="env-action-icon" aria-hidden="true">✓</span>
                    <span>${action}</span>
                  </li>
                `,
              )}
            </ul>
          </div>

          <div class="env-breakdown">
            ${[
              { label: '빛', value: breakdown.light, max: 50 },
              { label: '온도', value: breakdown.temp, max: 20 },
              { label: '습도', value: breakdown.humidity, max: 20 },
              { label: '바람', value: breakdown.exposure, max: 10 },
            ].map(
              (item) => html`
                <div class="env-sub-bar">
                  <div class="env-sub-head">
                    <span>${item.label}</span>
                    <span>${item.value}/${item.max}</span>
                  </div>
                  <div class="env-sub-track">
                    <div class="env-sub-fill" style="width: ${Math.round((item.value / item.max) * 100)}%"></div>
                  </div>
                </div>
              `,
            )}
          </div>
        </section>
      `;
    }

    function drawHistory() {
      const box = container.querySelector('[data-history-box]');
      if (!box) return;
      if (!state.history.length) {
        box.innerHTML = html`<p class="card-sub">아직 측정한 기록이 없어요.</p>`;
        return;
      }
      box.innerHTML = html`
        <ul class="env-history-list">
          ${state.history.map(
            (item) => html`
              <li class="env-history-item">
                <span>${formatHistoryDate(item.measuredAt)}</span>
                <span><strong>${item.matchScore ?? '-'}점</strong> · ${LIGHT_LABEL[item.lightLevel] ?? item.lightLevel ?? ''}</span>
              </li>
            `,
          )}
        </ul>
      `;
    }

    // 전체 화면 뼈대 그리기
    function drawAll() {
      const plant = state.plant;
      const species = state.species;
      const rangeText = species
        ? `권장 밝기 ${species.luxMin}~${species.luxMax} lux · 권장 습도 ${species.humidityMin}~${species.humidityMax}%`
        : '생육 기준을 불러오는 중이에요…';

      container.innerHTML = html`
        <section class="page-environment">
          ${plants.length > 1
            ? html`
                <div class="env-plant-chips" role="tablist" aria-label="식물 선택">
                  ${plants.map(
                    (p) => html`
                      <button
                        type="button"
                        class="chip ${p.id === plant.id ? 'is-active' : ''}"
                        data-select-plant="${p.id}"
                      >
                        ${p.name}
                      </button>
                    `,
                  )}
                </div>
              `
            : ''}

          <section class="card env-target-card">
            <img
              class="env-target-thumb"
              src="${plant.characterImage || DEFAULT_CHARACTER}"
              alt="${plant.name} 캐릭터"
            />
            <div class="env-target-meta">
              <div class="env-target-name">${plant.name}</div>
              <p class="env-target-range">${rangeText}</p>
            </div>
          </section>

          <section class="card">
            <div class="env-step-head">
              <span class="env-step-num">1</span>
              <h2 class="env-step-title">밝기 재기</h2>
            </div>
            <p class="env-step-desc">식물이 놓인 자리에서 휴대폰 뒷면 카메라를 창 쪽으로 3초간 비춰 주세요.</p>
            <div class="stack" data-lux-box></div>
          </section>

          <section class="card">
            <div class="env-step-head">
              <span class="env-step-num">2</span>
              <h2 class="env-step-title">우리 집 날씨</h2>
            </div>
            <div data-weather-box></div>
          </section>

          <section class="card stack">
            <div class="env-step-head" style="margin-bottom: 0;">
              <span class="env-step-num">3</span>
              <h2 class="env-step-title">실내 환경</h2>
            </div>

            <div class="field">
              <span class="label">창문 방향</span>
              <div class="env-dir-chips">
                ${WINDOW_DIRS.map(
                  (dir) => html`
                    <button
                      type="button"
                      class="chip ${state.windowDir === dir ? 'is-active' : ''}"
                      data-window-dir="${dir}"
                    >
                      ${dir}
                    </button>
                  `,
                )}
              </div>
            </div>

            <label class="toggle">
              <input type="checkbox" data-heater-toggle ${state.heaterOrAcExposed ? 'checked' : ''} />
              <span></span>
              에어컨·난방기 바람이 직접 닿아요
            </label>

            <div class="env-home-line">
              <span>주거 형태: <strong>${state.homeType}</strong></span>
              <a href="#/profile">내 정보에서 수정</a>
            </div>
          </section>

          <button type="button" class="btn btn-primary btn-block" data-act="analyze" disabled>분석하기</button>

          <div data-result-box></div>

          <section class="card stack">
            <h2 class="card-title">과거 측정 기록</h2>
            <div data-history-box></div>
          </section>
        </section>
      `;

      drawLuxSection();
      drawWeather();
      drawAnalyzeButton();
      drawResult();
      drawHistory();
    }

    // 3초 밝기 측정 시작
    async function startMeasurement() {
      if (state.measuring) return;
      state.measuring = true;
      state.progress = 0;
      state.cameraNotice = '';
      drawLuxSection();
      drawAnalyzeButton();

      const videoEl = container.querySelector('[data-camera-video]');
      try {
        const res = await measureLux({
          durationMs: 3000,
          videoEl,
          onProgress: (ratio) => {
            if (disposed) return;
            state.progress = ratio;
            const pct = Math.round(ratio * 100);
            const ring = container.querySelector('[data-progress-ring]');
            const text = container.querySelector('[data-progress-text]');
            if (ring) ring.style.setProperty('--progress', String(pct));
            if (text) text.textContent = `${pct}%`;
          },
        });
        if (disposed) return;
        state.measuredLux = res.lux;
        state.luxSource = res.source;
        state.manualMode = false;
      } catch (error) {
        if (disposed || error?.name === 'AbortError') return;
        console.warn('[environment] 밝기 측정 실패 → 수동 선택 전환', error);
        state.manualMode = true;
        state.cameraNotice = '카메라를 사용할 수 없어 아래 위치에서 직접 선택해 주세요.';
      } finally {
        stopCamera();
        state.measuring = false;
        if (!disposed) {
          drawLuxSection();
          drawAnalyzeButton();
        }
      }
    }

    // 점수 계산 + AI 조언 + Firestore 자동 저장
    async function runAnalysis() {
      if (state.measuredLux === null || !state.plant) return;

      const species = state.species;
      const scored = calcMatchScore({
        lux: state.measuredLux,
        weather: state.weather,
        heaterOrAcExposed: state.heaterOrAcExposed,
        windowDir: state.windowDir,
        species,
      });

      let coach;
      let isFallback = false;
      showLoading('AI 코치가 환경을 살펴보는 중이에요…');
      try {
        coach = await analyzeEnvironment({
          speciesName: species?.name ?? state.plant.name,
          profile: speciesProfile(species),
          measuredLux: state.measuredLux,
          weather: state.weather,
          homeType: state.homeType,
          windowDir: state.windowDir,
          heaterOrAcExposed: state.heaterOrAcExposed,
        });
      } catch (error) {
        console.warn('[environment] AI 분석 실패 → 규칙 기반 폴백', error);
        coach = ruleBasedTips({
          lightLevel: scored.lightLevel,
          weather: state.weather,
          heaterOrAcExposed: state.heaterOrAcExposed,
          windowDir: state.windowDir,
          species,
        });
        isFallback = true;
      } finally {
        hideLoading();
      }

      if (disposed) return;

      state.result = {
        ...scored,
        coach,
        isFallback,
      };
      drawResult();

      // 결과 자동 저장 (environments + aiHistory)
      try {
        await saveEnvironment(state.plant.id, {
          measuredLux: state.measuredLux,
          luxSource: state.luxSource ?? 'manual',
          weather: state.weather,
          windowDir: state.windowDir,
          heaterOrAcExposed: state.heaterOrAcExposed,
          matchScore: scored.score,
          lightLevel: scored.lightLevel,
          coach,
        });
        await addHistory(state.plant.id, 'ENVIRONMENT', {
          lux: state.measuredLux,
          lightLevel: scored.lightLevel,
          score: scored.score,
          humidity: state.weather?.humidity ?? null,
          tips: coach.actions.join(' / '),
        });
        state.history = await listEnvironments(state.plant.id, 5);
        if (!disposed) drawHistory();
      } catch (error) {
        console.warn('[environment] 환경 기록 저장 실패', error);
        toast('분석 결과를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.', 'error');
      }
    }

    // 이벤트 위임 연결
    const offClick = on(container, 'click', 'button', async (event, btn) => {
      if (btn.dataset.selectPlant) {
        const nextId = btn.dataset.selectPlant;
        if (nextId === state.plant?.id) return;
        stopCamera();
        selectPlant(nextId);
        state.result = null;
        await loadPlantData();
        if (!disposed) drawAll();
        return;
      }

      if (btn.dataset.windowDir) {
        state.windowDir = btn.dataset.windowDir;
        for (const chip of container.querySelectorAll('[data-window-dir]')) {
          chip.classList.toggle('is-active', chip.dataset.windowDir === state.windowDir);
        }
        return;
      }

      if (btn.dataset.presetLux) {
        state.measuredLux = Number(btn.dataset.presetLux);
        state.luxSource = 'manual';
        drawLuxSection();
        drawAnalyzeButton();
        return;
      }

      const act = btn.dataset.act;
      if (act === 'start-measure' || act === 'remeasure') {
        await startMeasurement();
      } else if (act === 'switch-manual') {
        stopCamera();
        state.manualMode = true;
        drawLuxSection();
      } else if (act === 'switch-camera') {
        state.manualMode = false;
        state.cameraNotice = '';
        drawLuxSection();
      } else if (act === 'retry-weather') {
        await loadWeather();
      } else if (act === 'analyze') {
        await runAnalysis();
      }
    });

    const offChange = on(container, 'change', '[data-heater-toggle]', (event, input) => {
      state.heaterOrAcExposed = input.checked;
    });

    await loadPlantData();
    if (disposed) return () => {};
    drawAll();
    loadWeather(); // 날씨는 비동기로 불러와 2번 카드만 갱신

    // 페이지를 떠날 때 카메라와 이벤트 해제
    return () => {
      disposed = true;
      stopCamera();
      offClick();
      offChange();
    };
  },
};
