import { html, on } from '../utils/dom.js';
import { toast } from '../ui/components.js';
import { fill } from '../ai/prompts.js';
import { checkShape } from '../ai/normalize.js';
import { generateJson, generateImage } from '../ai/provider.js';
import { getUsage } from '../ai/usage.js';
import { getAiMode, PROMPT_VERSION } from '../core/ai-config.js';
import { fileToDataUrl } from '../utils/image.js';

const TEMPLATES = ['character', 'diagnose', 'advice', 'environment', 'checklist', 'monthly-report'];

function formatUsage(usage) {
  return ['text', 'vision', 'image'].map((kind) => `${kind} ${usage[kind]}/${usage.limits[kind]}`).join(' · ');
}

function normalizeCheck(name, response) {
  const shape = name === 'character' ? { imageBase64: response } : response;
  const issues = checkShape(name, shape);
  return { passed: issues.length === 0, issues };
}

function runTimestamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
}

export default {
  title: '프롬프트 실험실',
  requiresAuth: true,
  showNav: false,
  styles: ['css/pages/prompt-lab.css'],

  async render(container) {
    let name = 'advice';
    let samples = [];
    let inputText = '';
    let imageDataUrl = null;
    let results = [];
    let running = false;

    async function loadSamples(template) {
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

    const draw = () => {
      const usage = getUsage();
      const wantsImage = name === 'character' || name === 'diagnose';
      const compare = [...new Set((container.querySelector('[data-versions]')?.value ?? PROMPT_VERSION).split(',').map((v) => v.trim()).filter(Boolean))].length > 1;
      container.innerHTML = html`<section class="prompt-lab stack">
        <aside class="prompt-lab-note">개발용 화면이에요. 배포 전 routes에서 제거해요.</aside>
        <section class="prompt-lab-status"><strong>AI ${getAiMode()}</strong><span>기본 버전 ${PROMPT_VERSION}</span><span>오늘 사용량 · ${formatUsage(usage)}</span></section>
        <section class="card stack prompt-lab-form">
          <label>템플릿<select data-template>${TEMPLATES.map((item) => html`<option value="${item}" ${item === name ? 'selected' : ''}>${item}</option>`)}</select></label>
          ${samples.length > 1 ? html`<label>입력 샘플<select data-sample>${samples.map((sample, index) => html`<option value="${index}">${sample.label ?? `샘플 ${index + 1}`}</option>`)}</select></label>` : ''}
          <label>버전 <span class="prompt-lab-hint">단일 버전 또는 쉼표로 비교 (예: v1,v2)</span><input data-versions type="text" value="${container.querySelector('[data-versions]')?.value ?? PROMPT_VERSION}" placeholder="v1 또는 v1,v2" /></label>
          <label>입력 JSON<textarea data-input-json rows="12" spellcheck="false">${inputText}</textarea></label>
          ${wantsImage ? html`<label>사진 파일<input data-image type="file" accept="image/*" capture="environment" />${imageDataUrl ? html`<img class="prompt-lab-preview" src="${imageDataUrl}" alt="선택한 사진 미리보기" />` : html`<span class="prompt-lab-hint">사진 템플릿은 사진을 선택해야 실행할 수 있어요.</span>`}</label>` : ''}
          <label>반복 횟수<select data-times>${[1,2,3,4,5].map((count) => html`<option value="${count}" ${count === 1 ? 'selected' : ''}>${count}회</option>`)}</select></label>
          <div class="row prompt-lab-actions"><button type="button" class="btn btn-primary" data-run ${running ? 'disabled' : ''}>${running ? '실행 중…' : '실행하기'}</button><button type="button" class="btn btn-secondary" data-download ${results.length ? '' : 'disabled'}>결과 JSON 내려받기</button></div>
        </section>
        ${results.length ? html`<section class="prompt-lab-results ${compare ? 'is-compare' : ''}">${results.map((group) => html`<section class="prompt-lab-version"><h2>${group.version}</h2>${group.runs.map((result, index) => html`<article class="prompt-lab-result"><header><strong>${index + 1}회차 · ${result.elapsedMs}ms</strong><span class="prompt-lab-badge ${result.check?.passed ? 'is-pass' : 'is-issue'}">${result.check ? (result.check.passed ? '통과' : '확인 필요') : '오류'}</span></header>${result.error ? html`<p class="prompt-lab-error">${result.error}</p>` : result.image ? html`<img class="prompt-lab-output-image" src="${result.image}" alt="생성 이미지 결과" />` : html`<pre>${JSON.stringify(result.response, null, 2)}</pre>`}${result.check?.issues?.length ? html`<ul class="prompt-lab-issues">${result.check.issues.map((issue) => html`<li>${issue}</li>`)}</ul>` : ''}${result.prompt ? html`<details><summary>채워진 프롬프트 보기</summary><pre>${result.prompt}</pre></details>` : ''}</article>`)}</section>`)}</section>` : ''}
      </section>`;
    };

    const removeChange = on(container, 'change', '[data-template], [data-sample], [data-image]', async (event, element) => {
      if (element.matches('[data-template]')) {
        name = element.value;
        imageDataUrl = null;
        await loadSamples(name);
        results = [];
        draw();
      } else if (element.matches('[data-sample]')) {
        inputText = JSON.stringify(samples[Number(element.value)]?.input ?? {}, null, 2);
        draw();
      } else {
        const file = element.files?.[0];
        if (!file) return;
        try { imageDataUrl = await fileToDataUrl(file); draw(); }
        catch (error) { toast(error.message || '사진을 읽지 못했어요.', 'error'); }
      }
    });

    const removeInput = on(container, 'input', '[data-input-json]', (_event, element) => { inputText = element.value; });
    const removeClick = on(container, 'click', '[data-run], [data-download]', async (_event, element) => {
      if (element.matches('[data-download]')) {
        if (!results.length) return;
        const versions = [...new Set(results.map((group) => group.version))].join('-');
        const blob = new Blob([JSON.stringify({ name, versions, downloadedAt: new Date().toISOString(), results }, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${name}-${versions}-${runTimestamp()}.json`;
        link.click();
        URL.revokeObjectURL(url);
        return;
      }
      if (running) return;
      let input;
      try { input = JSON.parse(container.querySelector('[data-input-json]').value); }
      catch { toast('입력 JSON 형식을 확인해 주세요.', 'error'); return; }
      if (!input || Array.isArray(input) || typeof input !== 'object') { toast('입력 JSON은 객체여야 해요.', 'error'); return; }
      if ((name === 'character' || name === 'diagnose') && !imageDataUrl) { toast('먼저 사진 파일을 선택해 주세요.', 'error'); return; }
      const versionText = container.querySelector('[data-versions]').value;
      const versions = [...new Set(versionText.split(',').map((version) => version.trim()).filter(Boolean))];
      if (!versions.length || versions.some((version) => !/^v\d+$/.test(version))) { toast('버전은 v1 형식으로 입력해 주세요.', 'error'); return; }
      const times = Number(container.querySelector('[data-times]').value);
      running = true;
      results = [];
      draw();
      const groups = [];
      for (const version of versions) {
        const runs = [];
        for (let index = 0; index < times; index++) {
          const started = performance.now();
          let prompt = '';
          try {
            prompt = await fill(name, input, { version });
            const response = name === 'character'
              ? await generateImage({ prompt, imageBase64: imageDataUrl })
              : await generateJson({ name, prompt, imageBase64: name === 'diagnose' ? imageDataUrl : null });
            const check = normalizeCheck(name, response);
            runs.push({ elapsedMs: Math.round(performance.now() - started), response: name === 'character' ? null : response, image: name === 'character' ? response : null, check, prompt });
          } catch (error) {
            const message = error.message || '실행 중 문제가 생겼어요.';
            runs.push({ elapsedMs: Math.round(performance.now() - started), error: message, check: null, prompt });
            toast(message, 'error');
          }
          const oldIndex = groups.findIndex((item) => item.version === version);
          if (oldIndex < 0) groups.push({ version, runs });
          else groups[oldIndex].runs = runs;
          results = [...groups];
          draw();
        }
      }
      running = false;
      draw();
    });

    await loadSamples(name);
    draw();
    return () => { removeChange(); removeInput(); removeClick(); };
  },
};
