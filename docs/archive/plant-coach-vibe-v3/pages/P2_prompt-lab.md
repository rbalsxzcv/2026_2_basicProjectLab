# [Page] P2 — Prompt lab & prompt templating procedure

> Read with: `00_MAIN.md` (§5.4 AI contract, §6 rule 7 secrets), `common/C2_ai-weather.md` (current AI structure). Spec: SPEC 3.3 AI context, 3.5 prompt guide (extra: templatize good outputs).
> Owner: B. Branch: `feat/p2-prompt-lab` (or same branch as P1).

## 1. Goal
* Implement the team decision "try various AI outputs, templatize the good ones": a **dev-only page** to run templates, compare versions and check normalize rules — all in the browser.
* Keep the templating **procedure and record table** in `prompts/README.md`.

## 2. Prerequisites
* **Common frozen.** `ai/provider.js` (`generateJson`, `generateImage`), `ai/prompts.js` (`fill(name, vars, { version })`), `ai/normalize.js` (`RULES`, `checkShape`), `ai/usage.js` (`getUsage`), `core/ai-config.js` (`getAiMode`, `PROMPT_VERSION`).
* Real-AI tests need the console setup from C2 (Firebase AI Logic + App Check). Everything also runs in mock mode.
* **Exception to rule 4:** this page may import `ai/provider.js` and `ai/prompts.js` directly (it's a test tool).

## 3. Files to create

### 3.1 `public/js/pages/prompt-lab.js` (`#/prompt-lab`)
* `title: '프롬프트 실험실'`, `requiresAuth: true`, `showNav: false`, `styles: ['css/pages/prompt-lab.css']`. Top note: "개발용 화면이에요. 배포 전 routes에서 제거해요."
* **Layout:**
  1. **Status bar:** current AI mode (mock/real), active `PROMPT_VERSION`, today's usage (`getUsage()`: text/vision/image vs limits).
  2. **Template select:** `character`, `diagnose`, `advice`, `environment`, `checklist`, `monthly-report`.
  3. **Version input:** single (e.g. `v2`) or compare (`v1,v2`).
  4. **Input JSON:** textarea prefilled from `prompts/samples/<name>-input.json` (selectable if several); validate JSON before running.
  5. **Image:** file input for templates needing an image (`diagnose`, `character`) → `fileToDataUrl`.
  6. **Times:** 1–5 (default 1).
  7. [실행하기]: for each version × times → `fill(name, vars, { version })` → `generateJson` (or `generateImage` for `character`) → show each result card: version, elapsed ms, pretty JSON (or image), **normalize check** (`checkShape` → "통과" or issue list like missing keys, too many items).
  8. Compare mode shows versions side by side for the same input.
  9. [결과 JSON 내려받기]: downloads all results as `<name>-<versions>-<YYYYMMDD-HHmm>.json` (Blob download) — this replaces saving to `samples/outputs/`.
* Lock the run button while running; errors as toast + error card (don't stop other runs).
* Never print images or full prompts to console (lengths only); the page may show the filled prompt in a collapsible block for debugging.

### 3.2 `public/prompts/samples/*-input.json`
1–2 plausible inputs per template (e.g. 몬스테라·겨울·습도 35%·북향), keys matching §5.4 inputs. A file holding several samples is an array `[{ "label": "...", "input": {...} }]`.

### 3.3 `public/css/pages/prompt-lab.css`
Form layout, result cards, side-by-side compare (2 columns, stacked on narrow screens), pass/fail badges (green / apricot — no red).

## 4. Files to modify (owned scope)
* `public/prompts/README.md` — add: lab usage, how to compare, one filled example row in the record table; keep the ownership table; when bumping a version, also update the `PROMPT_VERSION` comment in `ai-config.js` **via a request to A** (Common file).
* `public/prompts/diagnose.v*.txt`, `advice.v*.txt` — B's own templates (new versions allowed; keys/shapes unchanged).
* `public/js/pages/dev-ui.js` — **inside `[P2]` section only**: link button to `#/prompt-lab`.

**All files in this task:** `pages/prompt-lab.js`, `css/pages/prompt-lab.css`, `prompts/samples/**`, `prompts/README.md`, own templates, `[P2]` section of `dev-ui.js`. Other owners' templates: only via their owner.

## 5. Edge cases
* AI adds explanations around JSON → `extractJson` handles it; one retry is inside provider.
* Unsafe/odd advice normalize can't catch (e.g. recommending watering when soil is wet) → record as a prompt-improvement item in the README table.
* Over daily limit → show the limit message as the result card.

## 6. Don't
* Don't change §5.4 input/output shapes or `ai/*` files.
* No keys, images or prompt bodies in logs or commits.

## 7. Done when
- [ ] In mock mode every template runs and shows results with normalize check.
- [ ] Compare `advice` `v1,v2` (after creating `advice.v2.txt`) shows both side by side and downloads a result file.
- [ ] A deliberately broken output (e.g. mock with missing key) shows the issue in the check.
- [ ] (Real mode) templates return real responses; usage counts increase.
- [ ] `prompts/README.md` has the lab procedure and an example record row.
- [ ] No Common file changed (`git diff main --stat`).
- [ ] `docs/PROGRESS.md` has the P2 entry (adopted prompt versions, if any).
