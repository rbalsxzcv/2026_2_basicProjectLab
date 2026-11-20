/**
 * 파일: public/js/pages/dev-ui.js
 * 역할: 개발용 테스트 화면 (#/dev) — 공용 UI, AI·날씨, 공용 테스트 버튼, 페이지별 테스트 구역, 게임 테스트
 * 사용하는 파일: ui/components.js, ui/celebrate.js, core/ai.js, core/weather.js, core/ai-config.js, ai/usage.js,
 *               services/plants.js, services/game.js, services/dev-tools.js, utils/dom.js, utils/date.js
 * 담당: C1 (공용 UI) · C2 (AI) · C5 (공용 테스트 + 페이지 구역) · C6 (게임 테스트)
 *
 * ★ 배포할 때는 core/routes.js 에서 '/dev' 줄을 지우세요. (개발용 화면)
 * ★ 화면은 <section data-dev-section="..."> 구역으로 나뉩니다.
 *   각 페이지 담당자는 "자기 구역 함수 안쪽만" 고칩니다. 다른 구역은 건드리지 않습니다.
 */

import { html, on } from '../utils/dom.js';
import {
  toast,
  openModal,
  confirmModal,
  choiceModal,
  showLoading,
  hideLoading,
  gauge,
  emptyState,
} from '../ui/components.js';
import { celebrateIfLeveledUp, floatExp } from '../ui/celebrate.js';
import { store } from '../core/store.js';
import { getAiMode, getWeatherMode, setAiMode, setWeatherMode } from '../core/ai-config.js';
import { getUsage } from '../ai/usage.js';
import {
  generateCharacter,
  diagnose,
  advise,
  analyzeEnvironment,
  suggestChecklist,
  writeMonthlyReport,
} from '../core/ai.js';
import { getWeather } from '../core/weather.js';
import { getCurrentPlant } from '../services/plants.js';
import { awardExp, markCared, setAlert, refreshPlantState } from '../services/game.js';
import { devSetScheduleDueDate, devDeleteChecklist, devDumpPlant } from '../services/dev-tools.js';
import { today, addDays } from '../utils/date.js';
import { fileToDataUrl } from '../utils/image.js';

// ───────── 작은 도우미 ─────────

// 결과를 <pre> 에 보기 좋게. 긴 이미지 data URL 은 길이만 표시
function showJson(pre, value) {
  pre.textContent = JSON.stringify(
    value,
    (key, v) => (typeof v === 'string' && v.startsWith('data:') && v.length > 120 ? `(data URL, ${v.length}자)` : v),
    2,
  );
}

function requirePlant() {
  const plant = getCurrentPlant();
  if (!plant) toast('먼저 식물을 등록해 주세요.', 'error');
  return plant;
}

// AI 테스트용 작은 초록색 사진 (사진을 고르지 않았을 때 사용)
function sampleImage() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#e6f4ea';
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = '#5ba672';
  ctx.beginPath();
  ctx.ellipse(32, 26, 18, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f2b880';
  ctx.fillRect(18, 40, 28, 20);
  return canvas.toDataURL('image/jpeg', 0.8);
}

const loggedOutNote = html`<p class="muted">로그인하면 쓸 수 있어요.</p>`;

// ===== [C1] 공용 UI =====
function renderComponentsSection(root) {
  root.innerHTML = html`
    <h2 class="dev-title">🧩 공용 UI (C1)</h2>
    <div class="stack">
      <div class="row dev-wrap">
        <button type="button" class="btn btn-primary">기본 버튼</button>
        <button type="button" class="btn btn-secondary">테두리 버튼</button>
        <button type="button" class="btn btn-ghost">글자 버튼</button>
        <button type="button" class="btn btn-primary" disabled>비활성</button>
      </div>
      <div class="card">
        <p class="card-title">카드 제목</p>
        <p class="card-sub">카드 보조 문구예요. <span class="tag">태그</span> <span class="tag tag-accent">살구 태그</span></p>
      </div>
      <div class="row dev-wrap">
        <span class="chip">칩</span><span class="chip is-active">선택된 칩</span><span class="badge">3</span>
        <label class="toggle"><input type="checkbox" checked /><span></span> 스위치</label>
      </div>
      <div class="field">
        <label class="label" for="dev-input">입력 칸</label>
        <input class="input" id="dev-input" placeholder="입력해 보세요" />
        <p class="field-error">오류 문구는 빨강 대신 살구색이에요.</p>
      </div>
      <div class="row dev-wrap">
        <button type="button" class="btn btn-secondary btn-sm" data-act="toast-info">토스트(info)</button>
        <button type="button" class="btn btn-secondary btn-sm" data-act="toast-success">토스트(success)</button>
        <button type="button" class="btn btn-secondary btn-sm" data-act="toast-error">토스트(error)</button>
      </div>
      <div class="row dev-wrap">
        <button type="button" class="btn btn-secondary btn-sm" data-act="modal">모달</button>
        <button type="button" class="btn btn-secondary btn-sm" data-act="modal-locked">닫기 막힌 모달</button>
        <button type="button" class="btn btn-secondary btn-sm" data-act="confirm">confirmModal</button>
        <button type="button" class="btn btn-secondary btn-sm" data-act="choice">choiceModal</button>
        <button type="button" class="btn btn-secondary btn-sm" data-act="loading">로딩 2초</button>
      </div>
      <div class="stack">${gauge(20)}${gauge(55)}${gauge(90)}</div>
      <div class="card">${emptyState({ icon: '🌱', message: '빈 화면 안내 예시예요', actionLabel: '홈으로', actionHref: '#/main' })}</div>
      <p class="muted" data-c1-result>오늘(한국 날짜): ${today()}</p>
    </div>
  `;
  const result = root.querySelector('[data-c1-result]');

  on(root, 'click', '[data-act]', async (event, el) => {
    const act = el.dataset.act;
    if (act === 'toast-info') toast('안내 토스트예요');
    if (act === 'toast-success') toast('저장했어요', 'success');
    if (act === 'toast-error') toast('문제가 생겼어요. 다시 시도해 주세요.', 'error');
    if (act === 'modal') {
      const value = await openModal({
        title: '모달 제목',
        body: html`<p>배경을 누르거나 ESC 로 닫을 수 있어요.</p>`,
        actions: [
          { label: '좋아요', value: 'ok', variant: 'primary' },
          { label: '닫기', value: 'close', variant: 'ghost' },
        ],
      });
      result.textContent = `모달 결과: ${value}`;
    }
    if (act === 'modal-locked') {
      const value = await openModal({
        title: '흙 상태를 먼저 확인해요',
        body: html`<p>배경을 눌러도 닫히지 않아요. 버튼만 눌러 주세요. (Safe-Lock 팝업용)</p>`,
        actions: [
          { label: '말라 있어요', value: 'dry', variant: 'primary' },
          { label: '아직 축축해요', value: 'wet', variant: 'secondary' },
        ],
        dismissible: false,
      });
      result.textContent = `닫기 막힌 모달 결과: ${value}`;
    }
    if (act === 'confirm') result.textContent = `confirmModal 결과: ${await confirmModal('정말 할까요?')}`;
    if (act === 'choice') {
      const value = await choiceModal({
        title: '흙 상태',
        question: '흙을 만져 보면 어떤가요?',
        options: ['흙이 축축해요', '흙이 바짝 말라있어요', '잘 모르겠어요'],
      });
      result.textContent = `choiceModal 결과: ${value}`;
    }
    if (act === 'loading') {
      showLoading('식물 친구를 깨우는 중이에요…');
      setTimeout(hideLoading, 2000);
    }
  });
}

// ===== [C2] AI · 날씨 =====
function usageText(usage) {
  return `오늘 실제 AI 사용량 — 글 ${usage.text}/${usage.limits.text}, 사진 ${usage.vision}/${usage.limits.vision}, 이미지 ${usage.image}/${usage.limits.image}`;
}

function renderAiSection(root) {
  let imageDataUrl = null;

  function draw() {
    const usage = getUsage();
    const aiMode = getAiMode();
    const weatherMode = getWeatherMode();
    root.innerHTML = html`
      <h2 class="dev-title">🤖 AI · 날씨 테스트 (C2)</h2>
      <div class="stack">
        <p class="muted">스위치는 내 브라우저에만 저장돼요. (ai-config.js 를 고칠 필요 없음)</p>
        <label class="toggle"><input type="checkbox" data-mode="ai" ${aiMode === 'real' ? 'checked' : ''} /><span></span> AI 모드: <strong>${aiMode}</strong></label>
        <label class="toggle"><input type="checkbox" data-mode="weather" ${weatherMode === 'real' ? 'checked' : ''} /><span></span> 날씨 모드: <strong>${weatherMode}</strong></label>
        <p class="muted" data-usage>${usageText(usage)}</p>
        <label class="btn btn-secondary btn-sm">
          시험용 사진 고르기 ${imageDataUrl ? '(고름 ✓)' : '(안 고르면 샘플 그림)'}
          <input class="sr-only" type="file" accept="image/*" data-ai-image />
        </label>
        <div class="row dev-wrap">
          <button type="button" class="btn btn-secondary btn-sm" data-ai="character">generateCharacter</button>
          <button type="button" class="btn btn-secondary btn-sm" data-ai="diagnose">diagnose</button>
          <button type="button" class="btn btn-secondary btn-sm" data-ai="advise">advise</button>
          <button type="button" class="btn btn-secondary btn-sm" data-ai="environment">analyzeEnvironment</button>
          <button type="button" class="btn btn-secondary btn-sm" data-ai="checklist">suggestChecklist</button>
          <button type="button" class="btn btn-secondary btn-sm" data-ai="report">writeMonthlyReport</button>
          <button type="button" class="btn btn-secondary btn-sm" data-ai="weather">getWeather</button>
          <button type="button" class="btn btn-ghost btn-sm" data-ai="missing">입력 빠짐 테스트</button>
        </div>
        <img class="dev-character hidden" alt="생성된 캐릭터" data-ai-img />
        <pre class="dev-pre" data-ai-result>버튼을 누르면 결과가 여기에 나와요.</pre>
      </div>
    `;
  }

  const sampleHistory = [{ type: 'PHOTO_DIAGNOSIS', date: addDays(today(), -3), summaryTag: '건강해요' }];
  const calls = {
    character: () => generateCharacter({ imageBase64: imageDataUrl ?? sampleImage(), speciesName: '몬스테라' }),
    diagnose: () => diagnose({ imageBase64: imageDataUrl ?? sampleImage(), speciesName: '몬스테라' }),
    advise: () =>
      advise({ speciesName: '몬스테라', symptoms: '잎 끝 갈변 및 전체적 처짐', userAnswer: '흙이 축축해요', recentHistory: sampleHistory }),
    environment: () =>
      analyzeEnvironment({
        speciesName: '몬스테라',
        profile: { luxRange: '1000~10000 lux', tempRange: '18~27℃', humidityRange: '50~70%' },
        measuredLux: 800,
        weather: { tempC: 12, humidity: 45, precipitation: false },
        homeType: '아파트',
        windowDir: '남향',
        heaterOrAcExposed: false,
      }),
    checklist: () =>
      suggestChecklist({
        speciesName: '몬스테라',
        profile: { humidityRange: '50~70%' },
        weather: { tempC: 12, humidity: 35, precipitation: false },
        latestEnvironment: null,
        dueSchedules: [{ taskType: 'WATER', dueDate: today() }],
        recentHistory: sampleHistory,
      }),
    report: () =>
      writeMonthlyReport({
        speciesName: '몬스테라',
        daysSincePurchase: 200,
        lifespan: { type: 'PERENNIAL', endDate: null },
        stats: { routineRate: 72, ventilationCount: 18, waterOnTimeRate: 80, photoCount: 4 },
        monthlyHistory: sampleHistory,
        previousReport: null,
      }),
    weather: () => getWeather(store.get('user')?.home?.region || '서울특별시'),
    missing: () => diagnose({ speciesName: '몬스테라' }), // 사진 없음 → AiError
  };

  on(root, 'change', '[data-mode]', (event, el) => {
    const mode = el.checked ? 'real' : 'mock';
    if (el.dataset.mode === 'ai') setAiMode(mode);
    else setWeatherMode(mode);
    toast(`${el.dataset.mode === 'ai' ? 'AI' : '날씨'} 모드: ${mode}`);
    draw();
  });

  on(root, 'change', '[data-ai-image]', async (event, el) => {
    const file = el.files?.[0];
    if (!file) return;
    try {
      imageDataUrl = await fileToDataUrl(file);
      draw();
    } catch (error) {
      toast(error.message, 'error');
    }
  });

  on(root, 'click', '[data-ai]', async (event, el) => {
    const pre = root.querySelector('[data-ai-result]');
    const img = root.querySelector('[data-ai-img]');
    pre.textContent = '기다리는 중…';
    img.classList.add('hidden');
    try {
      const result = await calls[el.dataset.ai]();
      showJson(pre, result);
      if (result?.imageBase64) {
        img.src = result.imageBase64;
        img.classList.remove('hidden');
      }
    } catch (error) {
      pre.textContent = `${error.name}: ${error.message}`;
    }
    // 사용량 숫자 갱신 (결과는 유지)
    const usageEl = root.querySelector('[data-usage]');
    if (usageEl) usageEl.textContent = usageText(getUsage());
  });

  draw();
}

// ===== [C5] 공용 테스트 (현재 식물) =====
function renderSharedSection(root) {
  if (!store.get('user')) {
    root.innerHTML = html`<h2 class="dev-title">🧪 공용 테스트 (C5)</h2>${loggedOutNote}`;
    return;
  }
  const plant = getCurrentPlant();
  root.innerHTML = html`
    <h2 class="dev-title">🧪 공용 테스트 (C5)</h2>
    <p class="muted">현재 식물: <strong>${plant?.name ?? '없음'}</strong></p>
    <div class="row dev-wrap">
      <button type="button" class="btn btn-secondary btn-sm" data-shared="water-today">물주기 예정일을 오늘로</button>
      <button type="button" class="btn btn-secondary btn-sm" data-shared="water-past">물주기 예정일을 3일 전으로</button>
      <button type="button" class="btn btn-secondary btn-sm" data-shared="delete-checklist">오늘 체크리스트 지우기</button>
      <button type="button" class="btn btn-secondary btn-sm" data-shared="dump">현재 식물 데이터 보기</button>
    </div>
    <pre class="dev-pre" data-shared-result></pre>
  `;
  const pre = root.querySelector('[data-shared-result]');

  on(root, 'click', '[data-shared]', async (event, el) => {
    const current = requirePlant();
    if (!current) return;
    try {
      const act = el.dataset.shared;
      if (act === 'water-today') {
        await devSetScheduleDueDate(current.id, 'WATER', today());
        toast('물주기 예정일을 오늘로 바꿨어요', 'success');
      } else if (act === 'water-past') {
        await devSetScheduleDueDate(current.id, 'WATER', addDays(today(), -3));
        toast('물주기 예정일을 3일 전으로 바꿨어요 (WAITING 확인용)', 'success');
      } else if (act === 'delete-checklist') {
        await devDeleteChecklist(current.id, today());
        toast('오늘 체크리스트를 지웠어요. 새로고침하면 다시 만들어져요.', 'success');
      } else if (act === 'dump') {
        showJson(pre, await devDumpPlant(current.id));
      }
    } catch (error) {
      console.warn('[dev] 공용 테스트 실패', error);
      pre.textContent = `실패: ${error.message}`;
    }
  });
}

// ===== [C6] 게임 테스트 =====
function renderGameSection(root) {
  if (!store.get('user')) {
    root.innerHTML = html`<h2 class="dev-title">🎮 게임 테스트 (C6)</h2>${loggedOutNote}`;
    return;
  }

  function draw() {
    const plant = getCurrentPlant();
    root.innerHTML = html`
    <h2 class="dev-title">🎮 게임 테스트 (C6)</h2>
    <p class="muted">
      메인 화면은 열릴 때마다 상태를 다시 계산하므로, 상태를 직접 바꾸지 않고 "원인"을 만드는 버튼이에요.
      WAITING 은 위의 [물주기 예정일을 3일 전으로] 를 쓰세요.
    </p>
    <p class="muted" data-game-info>
      ${plant ? `${plant.name} · Lv.${plant.level ?? 1} · EXP ${plant.exp ?? 0} · 상태 ${plant.state} · 관찰 필요 ${plant.alertOpen ? '켜짐' : '꺼짐'}` : '식물 없음'}
    </p>
    <div class="row dev-wrap">
      <button type="button" class="btn btn-secondary btn-sm" data-game="alert">관찰 필요 켜기/끄기</button>
      <button type="button" class="btn btn-secondary btn-sm" data-game="cared">방금 관리함</button>
      <button type="button" class="btn btn-secondary btn-sm" data-game="exp20">+20 EXP</button>
      <button type="button" class="btn btn-secondary btn-sm" data-game="exp100">+100 EXP</button>
      <button type="button" class="btn btn-secondary btn-sm" data-game="refresh">상태 다시 계산</button>
      <a class="btn btn-primary btn-sm" href="#/main">메인에서 확인</a>
    </div>
  `;
  }

  // 이벤트는 한 번만 연결 (draw 로 다시 그려도 root 는 그대로라 계속 동작)
  on(root, 'click', '[data-game]', async (event, el) => {
    const current = requirePlant();
    if (!current) return;
    try {
      const act = el.dataset.game;
      if (act === 'alert') {
        await setAlert(current.id, !current.alertOpen);
        toast(`관찰 필요: ${!current.alertOpen ? '켜짐 → ALERT' : '꺼짐'}`, 'success');
      } else if (act === 'cared') {
        await markCared(current.id);
        toast('방금 관리함 → 30분 동안 GROWING', 'success');
      } else if (act === 'exp20' || act === 'exp100') {
        const amount = act === 'exp20' ? 20 : 100;
        const result = await awardExp(current.id, amount, 'DEV');
        floatExp(el, amount);
        await celebrateIfLeveledUp(result, getCurrentPlant());
      } else if (act === 'refresh') {
        toast(`새 상태: ${await refreshPlantState(current.id)}`);
      }
    } catch (error) {
      console.warn('[dev] 게임 테스트 실패', error);
      toast(`실패: ${error.message}`, 'error');
    }
    draw(); // 정보 다시 그리기
  });

  draw();
}

// ===== [P1] 성장 캘린더 테스트 — P1 담당자만 수정 =====
function renderP1Section(root) {
  root.innerHTML = html`<h2 class="dev-title">📅 [P1] 성장 캘린더</h2><p class="muted">P1 담당자가 테스트 버튼을 추가해요.</p>`;
}

// ===== [P2] 프롬프트 실험실 테스트 — P2 담당자만 수정 =====
function renderP2Section(root) {
  root.innerHTML = html`<h2 class="dev-title">🧫 [P2] 프롬프트 실험실</h2><p class="muted">P2 담당자가 테스트 버튼을 추가해요.</p>`;
}

// ===== [P3] 체크리스트 테스트 — P3 담당자만 수정 =====
function renderP3Section(root) {
  if (!store.get('user')) {
    root.innerHTML = html`<h2 class="dev-title">✅ [P3] 체크리스트</h2>${loggedOutNote}`;
    return;
  }
  root.innerHTML = html`
    <h2 class="dev-title">✅ [P3] 체크리스트</h2>
    <p class="muted">현재 식물 기준으로 테스트해요. 결과를 <a href="#/checklist">체크리스트 화면</a>에서 확인하세요.</p>
    <div class="row dev-wrap">
      <button type="button" class="btn btn-secondary btn-sm" data-p3="regen">오늘 체크리스트를 AI로 다시 만들기</button>
      <button type="button" class="btn btn-secondary btn-sm" data-p3="due-today">비료·잎 닦기 예정일을 오늘로</button>
    </div>
    <pre class="dev-pre" data-p3-result></pre>
  `;
  const pre = root.querySelector('[data-p3-result]');

  on(root, 'click', '[data-p3]', async (event, el) => {
    const current = requirePlant();
    if (!current) return;
    try {
      const act = el.dataset.p3;
      if (act === 'regen') {
        // 오늘의 문서를 지운 뒤 다시 만들면 AI 코치가 오늘 할 일을 다시 고릅니다
        try {
          await devDeleteChecklist(current.id, today());
        } catch {
          /* 아직 없으면 그냥 만듦 */
        }
        // 공유 import 줄을 건드리지 않으려고 여기서만 동적 import
        const { ensureTodayChecklist } = await import('../services/checklists.js');
        const { checklist, created } = await ensureTodayChecklist(current);
        showJson(pre, { created, generatedBy: checklist?.generatedBy, items: checklist?.items });
        toast(created ? '오늘 체크리스트를 다시 만들었어요' : '오늘 체크리스트가 이미 있었어요', 'success');
      } else if (act === 'due-today') {
        await devSetScheduleDueDate(current.id, 'FERTILIZE', today());
        await devSetScheduleDueDate(current.id, 'WIPE_LEAF', today());
        toast('비료·잎 닦기 예정일을 오늘로 바꿨어요 (체크리스트를 다시 만들면 반영돼요)', 'success');
      }
    } catch (error) {
      console.warn('[dev] [P3] 테스트 실패', error);
      pre.textContent = `실패: ${error.message}`;
    }
  });
}

// ===== [P4] 알림 테스트 — P4 담당자만 수정 =====
function renderP4Section(root) {
  if (!store.get('user')) {
    root.innerHTML = html`<h2 class="dev-title">🔔 [P4] 알림</h2>${loggedOutNote}`;
    return;
  }
  root.innerHTML = html`
    <h2 class="dev-title">🔔 [P4] 알림</h2>
    <p class="muted">현재 식물 기준으로 테스트해요. 결과는 <a href="#/notifications">알림함</a>에서 확인하세요.</p>
    <div class="row dev-wrap">
      <button type="button" class="btn btn-secondary btn-sm" data-p4="clear">알림 모두 지우기</button>
      <button type="button" class="btn btn-secondary btn-sm" data-p4="test">테스트 알림 만들기(체크리스트·리포트 각 1개)</button>
    </div>
    <pre class="dev-pre" data-p4-result></pre>
  `;
  const pre = root.querySelector('[data-p4-result]');

  on(root, 'click', '[data-p4]', async (event, el) => {
    const current = requirePlant();
    if (!current) return;
    try {
      const act = el.dataset.p4;
      if (act === 'clear') {
        // 공유 import 줄을 건드리지 않으려고 여기서만 동적 import
        const { markAllRead } = await import('../services/notifications.js');
        await markAllRead();
        toast('모든 알림을 읽음으로 바꾸어요', 'success');
      } else if (act === 'test') {
        const { notifyChecklistCreated, notifyReportCreated } = await import('../services/notifications.js');
        const { ensureTodayChecklist } = await import('../services/checklists.js');
        const { prevMonth, thisMonth } = await import('../utils/date.js');
        const { checklist } = await ensureTodayChecklist(current);
        await notifyChecklistCreated(current, checklist);
        const reportMonth = prevMonth(thisMonth());
        await notifyReportCreated({ plantId: current.id, month: reportMonth });
        showJson(pre, { checklist: checklist?.items?.length ?? 0, reportMonth });
        toast('테스트 알림을 만들었어요', 'success');
      }
    } catch (error) {
      console.warn('[dev] [P4] 테스트 실패', error);
      pre.textContent = `실패: ${error.message}`;
    }
  });
}

// ===== [P5] 환경 분석 테스트 — P5 담당자만 수정 =====
function renderP5Section(root) {
  root.innerHTML = html`<h2 class="dev-title">☀️ [P5] 환경 분석</h2><p class="muted">P5 담당자가 테스트 버튼을 추가해요.</p>`;
}

// ===== [P6] 월간 리포트 테스트 — P6 담당자만 수정 =====
function renderP6Section(root) {
  root.innerHTML = html`<h2 class="dev-title">📄 [P6] 월간 리포트</h2><p class="muted">P6 담당자가 테스트 버튼을 추가해요.</p>`;
}

// 구역 목록 (위에서부터 순서대로 그림)
const SECTIONS = [
  ['components', renderComponentsSection],
  ['ai', renderAiSection],
  ['shared', renderSharedSection],
  ['game', renderGameSection],
  ['p1', renderP1Section],
  ['p2', renderP2Section],
  ['p3', renderP3Section],
  ['p4', renderP4Section],
  ['p5', renderP5Section],
  ['p6', renderP6Section],
];

export default {
  title: '개발 테스트',
  requiresAuth: false,
  showNav: true,
  styles: [],

  async render(container) {
    container.innerHTML = html`
      <div class="dev-page stack">
        <p class="muted">개발용 화면이에요. 배포할 때는 routes.js 에서 /dev 를 지워 주세요.</p>
        ${SECTIONS.map(([id]) => html`<section class="card stack" data-dev-section="${id}"></section>`)}
      </div>
      <style>
        .dev-title { font-size: 16px; font-weight: 800; }
        .dev-wrap { flex-wrap: wrap; }
        .dev-pre { background: #f1f3ef; border-radius: 10px; padding: 12px; font-size: 12px;
                   white-space: pre-wrap; word-break: break-all; max-height: 320px; overflow: auto; margin: 0; }
        .dev-pre:empty { display: none; }
        .dev-character { width: 140px; height: 140px; object-fit: contain; }
      </style>
    `;
    for (const [id, renderSection] of SECTIONS) {
      const root = container.querySelector(`[data-dev-section="${id}"]`);
      try {
        renderSection(root);
      } catch (error) {
        console.warn(`[dev] ${id} 구역을 그리지 못했어요`, error);
        root.textContent = `${id} 구역 오류: ${error.message}`;
      }
    }
  },
};
