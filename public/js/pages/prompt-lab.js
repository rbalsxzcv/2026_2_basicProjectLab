/**
 * 파일: public/js/pages/prompt-lab.js
 * 역할: 프롬프트 실험실 (#/prompt-lab) — 템플릿·입력·버전을 골라 실행하고, 응답 모양 검사·버전 비교·결과 내려받기
 * 사용하는 파일: ai/prompts.js, ai/provider.js, ai/normalize.js, ai/usage.js, core/ai-config.js,
 *               ui/components.js, utils/dom.js, utils/image.js, public/prompts/samples/*-input.json
 * 담당: P2
 *
 * ★ 개발용 화면이에요. 배포 전 core/routes.js 에서 제거합니다.
 * ★ 시험 도구라서 예외로 ai/provider.js · ai/prompts.js 를 직접 부릅니다. (00_MAIN 규칙 4 예외)
 *   mock 모드는 템플릿 본문을 쓰지 않고 mocks/*.json 을 돌려주므로 화면·검사 흐름만 확인할 수 있어요.
 */

import { html, on } from '../utils/dom.js';
import { toast } from '../ui/components.js';
import { fill } from '../ai/prompts.js';
import { checkShape } from '../ai/normalize.js';
import { generateJson, generateImage } from '../ai/provider.js';
import { getUsage } from '../ai/usage.js';
import { getAiMode, PROMPT_VERSION } from '../core/ai-config.js';
import { fileToDataUrl } from '../utils/image.js';

const TEMPLATES = ['character', 'diagnose', 'advice', 'environment', 'checklist', 'monthly-report', 'species'];
const IMAGE_TEMPLATES = ['character', 'diagnose']; // 사진이 필요한 템플릿
const MAX_TIMES = 5;

function formatUsage(usage) {
  return ['text', 'vision', 'image'].map((kind) => `${kind} ${usage[kind]}/${usage.limits[kind]}`).join(' · ');
}

// normalize 검사: character 는 이미지 data URL 을 { imageBase64 } 모양으로 감싸서 검사
function normalizeCheck(name, response) {
  const shape = name === 'character' ? { imageBase64: response } : response;
  const issues = checkShape(name, shape);
  return { passed: issues.length === 0, issues };
}

// 내려받기 파일 이름용 'YYYYMMDD-HHmm'
function runTimestamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
}

// 'v1, v2' → ['v1', 'v2'] (중복 제거)
function parseVersions(text) {
  return [...new Set(String(text).split(',').map((v) => v.trim()).filter(Boolean))];
}

function resultCard(result, index) {
  const badge = result.check ? (result.check.passed ? '통과' : '확인 필요') : '오류';
  let body;
  if (result.error) body = html`<p class="prompt-lab-error">${result.error}</p>`;
  else if (result.image) body = html`<img class="prompt-lab-output-image" src="${result.image}" alt="생성 이미지 결과" />`;
  else body = html`<pre>${JSON.stringify(result.response, null, 2)}</pre>`;

  return html`
    <article class="prompt-lab-result">
      <header>
        <strong>${index + 1}회차 · ${result.elapsedMs}ms</strong>
        <span class="prompt-lab-badge ${result.check?.passed ? 'is-pass' : 'is-issue'}">${badge}</span>
      </header>
      ${body}
      ${result.check?.issues?.length ? html`<ul class="prompt-lab-issues">${result.check.issues.map((issue) => html`<li>${issue}</li>`)}</ul>` : ''}
      ${result.prompt ? html`<details><summary>채워진 프롬프트 보기</summary><pre>${result.prompt}</pre></details>` : ''}
    </article>
  `;
}

export default {
  title: '프롬프트 실험실',
  requiresAuth: true,
  showNav: false,
  styles: ['css/pages/prompt-lab.css'],

  async render(container) {
    // 화면 상태 (다시 그려도 사용자가 고른 값이 남도록 여기에 보관)
    let name = 'advice';
    let samples = [];
    let sampleIndex = 0;
    let inputText = '';
    let versionText = PROMPT_VERSION;
    let times = 1;
    let imageDataUrl = null;
    let results = []; // [{ version, runs: [...] }]
    let running = false;

    async function loadSamples(template) {
      sampleIndex = 0;
      try {
        const response = await fetch(`prompts/samples/${template}-input.json`);
        if (!response.ok) throw new Error('샘플 파일을 찾지 못했어요.');
        const value = await response.json();
        samples = Array.isArray(value) ? value : [{ label: '기본 샘플', input: value.input ?? value }];
        if (!samples.length) throw new Error('샘플이 비어 있어요.');
        inputText = JSON.stringify(samples[0].input ?? {}, null, 2);
      } catch (error) {
        samples = [];
        inputText = '{}';
        toast(error.message || '샘플 입력을 불러오지 못했어요.', 'error');
      }
    }

    function draw() {
      const wantsImage = IMAGE_TEMPLATES.includes(name);
      const compare = parseVersions(versionText).length > 1;

      container.innerHTML = html`
        <section class="prompt-lab stack">
          <aside class="prompt-lab-note">개발용 화면이에요. 배포 전 routes에서 제거해요.</aside>
          <section class="prompt-lab-status">
            <strong>AI ${getAiMode()}</strong>
            <span>기본 버전 ${PROMPT_VERSION}</span>
            <span>오늘 사용량 · ${formatUsage(getUsage())}</span>
          </section>

          <section class="card stack prompt-lab-form">
            <label>템플릿
              <select data-template>${TEMPLATES.map((item) => html`<option value="${item}" ${item === name ? 'selected' : ''}>${item}</option>`)}</select>
            </label>
            ${samples.length > 1
              ? html`<label>입력 샘플
                  <select data-sample>${samples.map((sample, index) => html`<option value="${index}" ${index === sampleIndex ? 'selected' : ''}>${sample.label ?? `샘플 ${index + 1}`}</option>`)}</select>
                </label>`
              : ''}
            <label>버전 <span class="prompt-lab-hint">단일 버전 또는 쉼표로 비교 (예: v1,v2)</span>
              <input data-versions type="text" value="${versionText}" placeholder="v1 또는 v1,v2" />
            </label>
            <label>입력 JSON
              <textarea data-input-json rows="12" spellcheck="false">${inputText}</textarea>
            </label>
            ${wantsImage
              ? html`<label>사진 파일
                  <input data-image type="file" accept="image/*" capture="environment" />
                  ${imageDataUrl
                    ? html`<img class="prompt-lab-preview" src="${imageDataUrl}" alt="선택한 사진 미리보기" />`
                    : html`<span class="prompt-lab-hint">사진 템플릿은 사진을 선택해야 실행할 수 있어요.</span>`}
                </label>`
              : ''}
            <label>반복 횟수
              <select data-times>${Array.from({ length: MAX_TIMES }, (_, i) => i + 1).map((count) => html`<option value="${count}" ${count === times ? 'selected' : ''}>${count}회</option>`)}</select>
            </label>
            <div class="row prompt-lab-actions">
              <button type="button" class="btn btn-primary" data-run ${running ? 'disabled' : ''}>${running ? '실행 중…' : '실행하기'}</button>
              <button type="button" class="btn btn-secondary" data-download ${results.length ? '' : 'disabled'}>결과 JSON 내려받기</button>
            </div>
          </section>

          ${results.length
            ? html`
                <section class="prompt-lab-results ${compare ? 'is-compare' : ''}">
                  ${results.map(
                    (group) => html`
                      <section class="prompt-lab-version">
                        <h2>${group.version}</h2>
                        ${group.runs.map((result, index) => resultCard(result, index))}
                      </section>
                    `,
                  )}
                </section>
              `
            : ''}
        </section>
      `;
    }

    function downloadResults() {
      if (!results.length) return;
      const versions = results.map((group) => group.version).join('-');
      const payload = { name, versions, downloadedAt: new Date().toISOString(), results };
      // Blob: 메모리 안의 파일. 임시 주소를 만들어 <a download> 로 내려받게 합니다.
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${name}-${versions}-${runTimestamp()}.json`;
      link.click();
      URL.revokeObjectURL(url);
    }

    // 버전 × 반복 횟수만큼 실행. 한 번이 실패해도 나머지는 계속
    async function runAll() {
      let input;
      try {
        input = JSON.parse(inputText);
      } catch {
        toast('입력 JSON 형식을 확인해 주세요.', 'error');
        return;
      }
      if (!input || Array.isArray(input) || typeof input !== 'object') {
        toast('입력 JSON은 객체여야 해요.', 'error');
        return;
      }
      if (IMAGE_TEMPLATES.includes(name) && !imageDataUrl) {
        toast('먼저 사진 파일을 선택해 주세요.', 'error');
        return;
      }
      const versions = parseVersions(versionText);
      if (!versions.length || versions.some((version) => !/^v\d+$/.test(version))) {
        toast('버전은 v1 형식으로 입력해 주세요.', 'error');
        return;
      }

      running = true;
      results = versions.map((version) => ({ version, runs: [] }));
      draw();

      for (const group of results) {
        for (let index = 0; index < times; index++) {
          const started = performance.now();
          let prompt = '';
          try {
            prompt = await fill(name, input, { version: group.version });
            const response =
              name === 'character'
                ? await generateImage({ prompt, imageBase64: imageDataUrl })
                : await generateJson({ name, prompt, imageBase64: name === 'diagnose' ? imageDataUrl : null });
            group.runs.push({
              elapsedMs: Math.round(performance.now() - started),
              response: name === 'character' ? null : response,
              image: name === 'character' ? response : null,
              check: normalizeCheck(name, response),
              prompt,
            });
          } catch (error) {
            const message = error.message || '실행 중 문제가 생겼어요.';
            group.runs.push({ elapsedMs: Math.round(performance.now() - started), error: message, check: null, prompt });
            toast(message, 'error');
          }
          draw();
        }
      }
      running = false;
      draw();
    }

    const offs = [
      on(container, 'change', '[data-template], [data-sample], [data-times], [data-image]', async (event, element) => {
        if (element.matches('[data-template]')) {
          name = element.value;
          imageDataUrl = null;
          results = [];
          await loadSamples(name);
          draw();
        } else if (element.matches('[data-sample]')) {
          sampleIndex = Number(element.value);
          inputText = JSON.stringify(samples[sampleIndex]?.input ?? {}, null, 2);
          draw();
        } else if (element.matches('[data-times]')) {
          times = Number(element.value) || 1;
        } else {
          const file = element.files?.[0];
          if (!file) return;
          try {
            imageDataUrl = await fileToDataUrl(file);
            draw();
          } catch (error) {
            toast(error.message || '사진을 읽지 못했어요.', 'error');
          }
        }
      }),
      on(container, 'input', '[data-input-json]', (event, element) => {
        inputText = element.value;
      }),
      on(container, 'input', '[data-versions]', (event, element) => {
        versionText = element.value;
      }),
      on(container, 'click', '[data-run], [data-download]', async (event, element) => {
        if (element.matches('[data-download]')) downloadResults();
        else if (!running) await runAll();
      }),
    ];

    await loadSamples(name);
    draw();
    return () => offs.forEach((off) => off());
  },
};
