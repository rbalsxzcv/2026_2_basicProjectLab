/**
 * 파일: public/js/pages/report.js
 * 역할: 월간 리포트 화면 (#/report, #/report/:month) — 통계, 변화 추이, AI 칭찬·제안, 분갈이·수명 안내
 * 사용하는 파일: core/store.js, services/plants.js, services/reports.js, ui/components.js, utils/dom.js, utils/date.js
 */

import { html, on } from '../utils/dom.js';
import {
  today,
  thisMonth,
  prevMonth,
  monthRange,
  diffDays,
  toDateStr,
} from '../utils/date.js';
import { store } from '../core/store.js';
import { getCurrentPlant, selectPlant, DEFAULT_CHARACTER } from '../services/plants.js';
import {
  computeMonthlyStats,
  getReport,
  listReportMonths,
  generateReport,
  isEligible,
} from '../services/reports.js';
import { toast, showLoading, hideLoading, emptyState } from '../ui/components.js';

function formatMonthLabel(monthStr) {
  const [y, m] = monthStr.split('-').map(Number);
  return `${y}년 ${m}월`;
}

function monthNumber(monthStr) {
  return Number(monthStr.split('-')[1]);
}

// 이전 달 리포트와 비교한 변화 문구 (빨강 없이 초록 ▲ / 회색 ▼)
function renderDiff(currentVal, prevVal, unit) {
  if (currentVal === null || prevVal === null || currentVal === undefined || prevVal === undefined) {
    return '';
  }
  const diff = currentVal - prevVal;
  if (diff > 0) {
    return html`<div class="report-diff is-up">▲ ${diff}${unit}</div>`;
  }
  if (diff < 0) {
    return html`<div class="report-diff is-down">▼ ${Math.abs(diff)}${unit} · 지난달보다 조금 쉬어 갔어요</div>`;
  }
  return html`<div class="report-diff is-same">지난달과 같아요</div>`;
}

// 2×2 통계 카드 공통 렌더링
function renderStatsGrid(stats, prevStats = null) {
  const waterText = stats.waterOnTimeRate === null ? '기록 없음' : `${stats.waterOnTimeRate}%`;
  return html`
    <div class="report-stats-grid">
      <div class="report-stat-card">
        <span class="report-stat-label">루틴 실천율</span>
        <strong class="report-stat-value">${stats.routineRate}%</strong>
        <div class="report-stat-bar">
          <div class="report-stat-bar-fill" style="width: ${Math.min(100, Math.max(0, stats.routineRate))}%"></div>
        </div>
        ${renderDiff(stats.routineRate, prevStats?.routineRate, '%p')}
      </div>

      <div class="report-stat-card">
        <span class="report-stat-label">환기 횟수</span>
        <strong class="report-stat-value">${stats.ventilationCount}회</strong>
        ${renderDiff(stats.ventilationCount, prevStats?.ventilationCount, '회')}
      </div>

      <div class="report-stat-card">
        <span class="report-stat-label">물주기 정시율</span>
        <strong class="report-stat-value">${waterText}</strong>
        ${renderDiff(stats.waterOnTimeRate, prevStats?.waterOnTimeRate, '%p')}
      </div>

      <div class="report-stat-card">
        <span class="report-stat-label">사진 기록</span>
        <strong class="report-stat-value">${stats.photoCount}장</strong>
        ${renderDiff(stats.photoCount, prevStats?.photoCount, '장')}
      </div>
    </div>
  `;
}

export default {
  title: '월간 리포트',
  requiresAuth: true,
  showNav: true,
  styles: ['css/pages/report.css'],

  async render(container, params) {
    let disposed = false;

    const plants = store.get('plants') ?? [];
    if (plants.length === 0) {
      container.innerHTML = html`
        <section class="page-report">
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

    // 알림 등에서 ?plant=id 로 들어온 경우 확인
    const queryPlantId = params?.query?.plant;
    if (queryPlantId) {
      const matched = plants.find((p) => p.id === queryPlantId);
      if (matched) selectPlant(matched.id);
      else toast('식물을 찾을 수 없어요', 'error');
    }

    const currentMonth = thisMonth();
    const lastMonth = prevMonth(currentMonth);
    const paramMonth = /^\d{4}-\d{2}$/.test(params?.month ?? '') ? params.month : null;

    const state = {
      plant: getCurrentPlant(),
      month: paramMonth,
      months: [], // 이동 가능한 달 (오름차순)
      report: null,
      prevReport: null,
      previewStats: null,
    };

    // [리포트 만들기] 가 가능한 달인지: 지난 달이면서, 그 달에 이미 등록돼 있던 식물 (reports.isEligible)
    function canCreateReport(plant, month) {
      return Boolean(plant) && month < currentMonth && isEligible(plant, month);
    }

    // 현재 식물과 달에 맞는 리포트/통계 불러오기
    async function loadData() {
      state.plant = getCurrentPlant();
      if (!state.plant) return;

      const reportMonths = await listReportMonths(state.plant.id);
      if (disposed) return;

      if (!state.month) {
        state.month = reportMonths[0] ?? lastMonth;
      }

      // 리포트가 있는 달 + 지난달 + 이번 달을 오름차순으로 묶어 월 이동 범위로 사용
      state.months = [...new Set([...reportMonths, lastMonth, currentMonth, state.month])]
        .filter((m) => m <= currentMonth)
        .sort((a, b) => a.localeCompare(b));

      state.report = null;
      state.prevReport = null;
      state.previewStats = null;

      if (state.month === currentMonth) {
        // 이번 달은 AI 호출 없이 통계 미리보기만 계산
        state.previewStats = await computeMonthlyStats(state.plant.id, state.month);
      } else {
        const [report, prevReport] = await Promise.all([
          getReport(state.plant.id, state.month),
          getReport(state.plant.id, prevMonth(state.month)),
        ]);
        if (disposed) return;
        state.report = report;
        state.prevReport = prevReport;
      }
    }

    function draw() {
      const plant = state.plant;
      const month = state.month;
      const idx = state.months.indexOf(month);
      const prevTarget = idx > 0 ? state.months[idx - 1] : null;
      const nextTarget = idx >= 0 && idx < state.months.length - 1 ? state.months[idx + 1] : null;

      const startDate = plant.purchasedAt ?? toDateStr(plant.createdAt) ?? today();
      const baseEnd = month === currentMonth ? today() : monthRange(month).end;
      const daysTogether = Math.max(0, diffDays(startDate, baseEnd));
      const registeredInThisMonth = startDate.slice(0, 7) === month;
      const togetherText = registeredInThisMonth ? `${startDate}부터 함께했어요` : `함께한 지 ${daysTogether}일`;

      let bodyHtml;
      if (month === currentMonth) {
        bodyHtml = html`
          <section class="card stack">
            <div class="row" style="justify-content: space-between; align-items: center;">
              <h2 class="card-title" style="margin: 0;">이번 달 기록 미리보기</h2>
              <span class="tag">진행 중</span>
            </div>
            <p class="card-sub">다음 달 1일에 AI 코치 리포트가 도착해요.</p>
          </section>
          ${renderStatsGrid(
            state.previewStats ?? { routineRate: 0, ventilationCount: 0, waterOnTimeRate: null, photoCount: 0 },
          )}
        `;
      } else if (state.report) {
        const { stats, ai } = state.report;
        bodyHtml = html`
          ${renderStatsGrid(stats, state.prevReport?.stats)}

          <section class="report-praise-card">
            <div class="report-praise-head">
              <span>💚 AI 코치의 칭찬</span>
              ${ai.generatedBy === 'DEFAULT' ? html`<span class="tag tag-accent">기본 요약</span>` : ''}
            </div>
            <p class="report-praise-body">${ai.praise}</p>
          </section>

          <section class="card stack">
            <h2 class="card-title">다음 달 습관 제안</h2>
            <ol class="report-suggestions">
              ${(ai.suggestions ?? []).map(
                (item, i) => html`
                  <li class="report-suggestion-item">
                    <span class="report-suggestion-num">${i + 1}</span>
                    <span>${item}</span>
                  </li>
                `,
              )}
            </ol>
          </section>

          ${ai.repotNotice
            ? html`
                <div class="report-notice-card">
                  <span class="report-notice-icon" aria-hidden="true">🪴</span>
                  <div>
                    <strong>분갈이 확인 안내</strong>
                    <p>${ai.repotNotice}</p>
                  </div>
                </div>
              `
            : ''}

          ${ai.lifespanNotice
            ? html`
                <div class="report-notice-card">
                  <span class="report-notice-icon" aria-hidden="true">🌾</span>
                  <div>
                    <strong>수확 · 마무리 안내</strong>
                    <p>${ai.lifespanNotice}</p>
                  </div>
                </div>
              `
            : ''}
        `;
      } else if (!canCreateReport(plant, month)) {
        // 아직 오지 않은 달 / 식물을 등록하기 전의 달 → 만들 기록이 없으므로 버튼 대신 안내만
        const message =
          month > currentMonth
            ? `${formatMonthLabel(month)}은 아직 오지 않았어요.`
            : `${formatMonthLabel(month)}에는 아직 ${plant.name}와(과) 함께하기 전이에요.`;
        bodyHtml = html`
          <section class="card stack" style="text-align: center;">
            <p class="card-sub">${message}</p>
          </section>
        `;
      } else {
        bodyHtml = html`
          <section class="card stack" style="text-align: center;">
            <p class="card-sub">${formatMonthLabel(month)} 리포트가 아직 없어요.</p>
            <button type="button" class="btn btn-primary btn-block" data-act="create-report">리포트 만들기</button>
          </section>
        `;
      }

      container.innerHTML = html`
        <section class="page-report">
          ${plants.length > 1
            ? html`
                <div class="report-plant-chips" role="tablist" aria-label="식물 선택">
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

          <nav class="report-month-nav" aria-label="월 이동">
            <button
              type="button"
              class="report-nav-btn"
              aria-label="이전 달"
              data-nav-month="${prevTarget ?? ''}"
              ${prevTarget ? '' : 'disabled'}
            >
              ‹
            </button>
            <span class="report-month-title">${formatMonthLabel(month)}</span>
            <button
              type="button"
              class="report-nav-btn"
              aria-label="다음 달"
              data-nav-month="${nextTarget ?? ''}"
              ${nextTarget ? '' : 'disabled'}
            >
              ›
            </button>
          </nav>

          <section class="report-cover">
            <img
              class="report-cover-img"
              src="${plant.characterImage || DEFAULT_CHARACTER}"
              alt="${plant.name} 캐릭터"
            />
            <h2 class="report-cover-title">${plant.name}의 ${monthNumber(month)}월 이야기</h2>
            <p class="report-cover-sub">${togetherText}</p>
          </section>

          ${bodyHtml}

          <a class="btn btn-secondary btn-block" href="#/calendar?month=${month}">
            📅 이 달의 성장 캘린더 보기
          </a>
        </section>
      `;
    }

    const offClick = on(container, 'click', 'button', async (event, btn) => {
      if (btn.dataset.selectPlant) {
        const nextId = btn.dataset.selectPlant;
        if (nextId === state.plant?.id) return;
        selectPlant(nextId);
        state.month = paramMonth; // 식물 바꿀 때 경로 달이 없으면 최신 달로 재계산
        try {
          await loadData();
          if (!disposed) draw();
        } catch (error) {
          console.warn('[report] 식물 전환 실패', error);
          toast('리포트를 불러오지 못했어요.', 'error');
        }
        return;
      }

      if (btn.dataset.navMonth) {
        window.location.hash = `#/report/${btn.dataset.navMonth}`;
        return;
      }

      if (btn.dataset.act === 'create-report') {
        if (!canCreateReport(state.plant, state.month)) return; // 안전장치 (버튼이 없어야 정상)
        showLoading('AI 코치가 한 달을 돌아보는 중이에요…');
        try {
          await generateReport(state.plant, state.month);
          await loadData();
          if (!disposed) draw();
          toast('월간 리포트가 완성됐어요!', 'success');
        } catch (error) {
          console.warn('[report] 리포트 생성 실패', error);
          toast('리포트를 만들지 못했어요. 잠시 후 다시 시도해 주세요.', 'error');
        } finally {
          hideLoading();
        }
      }
    });

    try {
      await loadData();
      if (!disposed) draw();
    } catch (error) {
      console.warn('[report] 초기 불러오기 실패', error);
      toast('리포트를 불러오지 못했어요.', 'error');
    }

    return () => {
      disposed = true;
      offClick();
    };
  },
};
