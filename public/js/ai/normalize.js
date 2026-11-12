/**
 * 파일: public/js/ai/normalize.js
 * 역할: AI 기능별 규칙 — 입력 확인(validate), 프롬프트 변수 만들기(buildVars),
 *       기본값(defaults), 응답 다듬기(normalize). + 응답 모양 검사(checkShape, 프롬프트 실험실용)
 * 사용하는 파일: 없음
 * 담당: C2
 *
 * ★ 반환 모양은 00_MAIN §5.4 와 같아야 합니다. AI가 엉뚱하게 답해도 normalize 가 모양을 맞춥니다.
 */

export const DAILY_TASK_TYPES = ['VENTILATE', 'CHECK_LEAF', 'CHECK_LIGHT', 'MIST'];
export const PERIODIC_TASK_TYPES = ['WATER', 'FERTILIZE', 'WIPE_LEAF', 'REPOT'];

const DEFAULT_OPTIONS = ['흙이 축축해요', '흙이 바짝 말라있어요', '잘 모르겠어요'];
const DEFAULT_ADVICE = [
  '손가락 한 마디 깊이로 흙을 만져 보고, 말랐을 때만 물을 주세요.',
  '밝은 간접광이 드는 자리에서 하루 이틀 지켜봐 주세요.',
];
const DAILY_TITLES = {
  VENTILATE: '창문 열고 10분 환기하기',
  CHECK_LEAF: '잎 앞뒷면 가볍게 눈맞춤하기',
  CHECK_LIGHT: '햇빛이 잘 드는지 자리 살펴보기',
  MIST: '잎 주변 공기에 가볍게 분무하기',
};

// ───────── 작은 도우미 ─────────
const isText = (v) => typeof v === 'string' && v.trim().length > 0;
const isDataUrl = (v) => typeof v === 'string' && v.startsWith('data:image/');
const str = (v, fallback = '') => (isText(v) ? v.trim() : fallback);
const list = (v) => (Array.isArray(v) ? v : []);
const textList = (v) => list(v).filter(isText).map((s) => s.trim());

function yesNo(value) {
  if (value === true) return '예';
  if (value === false) return '아니요';
  return value;
}

// ───────── 기능별 규칙 ─────────

const character = {
  validate(input) {
    if (!isDataUrl(input?.imageBase64)) return '사진이 필요해요.';
    return null;
  },
  buildVars: (input) => ({ speciesName: str(input.speciesName, '식물') }),
  defaults: { imageBase64: '' },
  normalize: (result) => ({ imageBase64: result.imageBase64 }),
};

const diagnose = {
  validate(input) {
    if (!isDataUrl(input?.imageBase64)) return '사진이 필요해요.';
    if (!isText(input?.speciesName)) return '식물 종류가 필요해요.';
    return null;
  },
  buildVars: (input) => ({ speciesName: input.speciesName }),
  defaults: {
    symptoms: '사진에서 뚜렷한 변화는 보이지 않아요.',
    severity: 'watch',
    question: '흙을 손가락으로 만져 보면 어떤가요?',
    options: DEFAULT_OPTIONS,
  },
  normalize(result) {
    const options = textList(result.options).slice(0, 3);
    for (const fallback of DEFAULT_OPTIONS) {
      if (options.length >= 3) break;
      if (!options.includes(fallback)) options.push(fallback);
    }
    return {
      symptoms: str(result.symptoms, diagnose.defaults.symptoms),
      severity: result.severity === 'normal' || result.severity === 'watch' ? result.severity : 'watch',
      question: str(result.question, diagnose.defaults.question),
      options,
    };
  },
};

const advice = {
  validate(input) {
    if (!isText(input?.speciesName)) return '식물 종류가 필요해요.';
    if (!isText(input?.symptoms)) return '관찰된 증상이 필요해요.';
    if (!isText(input?.userAnswer)) return '흙 상태를 골라 주세요.';
    return null;
  },
  buildVars: (input) => ({
    speciesName: input.speciesName,
    symptoms: input.symptoms,
    userAnswer: input.userAnswer,
    recentHistory: input.recentHistory ?? [],
  }),
  defaults: { advice: DEFAULT_ADVICE, summaryTag: '관찰 중' },
  normalize(result) {
    const items = textList(result.advice).slice(0, 2);
    for (const fallback of DEFAULT_ADVICE) {
      if (items.length >= 2) break;
      if (!items.includes(fallback)) items.push(fallback);
    }
    return { advice: items, summaryTag: str(result.summaryTag, '관찰 중').slice(0, 12) };
  },
};

const environment = {
  validate(input) {
    if (!isText(input?.speciesName)) return '식물 종류가 필요해요.';
    if (typeof input?.measuredLux !== 'number' || Number.isNaN(input.measuredLux)) return '밝기(조도) 값이 필요해요.';
    return null;
  },
  buildVars: (input) => ({
    speciesName: input.speciesName,
    profile: input.profile ?? null,
    measuredLux: Math.round(input.measuredLux),
    weather: input.weather ?? null,
    homeType: input.homeType ?? null,
    windowDir: input.windowDir ?? null,
    heaterOrAcExposed: yesNo(input.heaterOrAcExposed ?? null),
  }),
  defaults: {
    goodPoint: '식물을 위해 환경을 살펴보는 것 자체가 멋진 습관이에요.',
    actions: ['하루 중 가장 밝은 시간에 빛이 드는지 한 번 더 확인해 보세요.'],
  },
  normalize(result) {
    let actions = textList(result.actions).slice(0, 2);
    if (actions.length === 0) actions = [...environment.defaults.actions];
    return { goodPoint: str(result.goodPoint, environment.defaults.goodPoint), actions };
  },
};

const checklist = {
  validate(input) {
    if (!isText(input?.speciesName)) return '식물 종류가 필요해요.';
    return null;
  },
  buildVars: (input) => ({
    speciesName: input.speciesName,
    profile: input.profile ?? null,
    weather: input.weather ?? null,
    latestEnvironment: input.latestEnvironment ?? null,
    dueSchedules: input.dueSchedules ?? [],
    recentHistory: input.recentHistory ?? [],
  }),
  defaults: { items: [] },
  normalize(result) {
    const seen = new Set();
    const items = [];
    for (const item of list(result.items)) {
      const taskType = item?.taskType;
      // 데일리 루틴만 허용. 물주기 등 정기 관리는 일정(schedules)에서만 넣음 → 과습 방지
      if (!DAILY_TASK_TYPES.includes(taskType)) continue;
      if (seen.has(taskType)) continue;
      seen.add(taskType);
      items.push({ category: 'DAILY_MICRO', taskType, title: str(item.title, DAILY_TITLES[taskType]).slice(0, 40) });
      if (items.length >= 4) break;
    }
    return { items };
  },
};

const monthlyReport = {
  validate(input) {
    if (!isText(input?.speciesName)) return '식물 종류가 필요해요.';
    if (!input?.stats || typeof input.stats !== 'object') return '이번 달 통계가 필요해요.';
    return null;
  },
  buildVars: (input) => ({
    speciesName: input.speciesName,
    daysSincePurchase: input.daysSincePurchase ?? null,
    lifespan: input.lifespan ?? null,
    stats: input.stats,
    monthlyHistory: input.monthlyHistory ?? [],
    previousReport: input.previousReport ?? null,
  }),
  defaults: {
    praise: '이번 달에도 식물 곁을 지켜 준 집사님, 정말 고마워요.',
    suggestions: ['아침에 한 번, 잎을 가볍게 살펴보는 습관을 만들어 보세요.'],
    repotNotice: null,
    lifespanNotice: null,
  },
  normalize(result) {
    let suggestions = textList(result.suggestions).slice(0, 2);
    if (suggestions.length === 0) suggestions = [...monthlyReport.defaults.suggestions];
    return {
      praise: str(result.praise, monthlyReport.defaults.praise),
      suggestions,
      repotNotice: isText(result.repotNotice) ? result.repotNotice.trim() : null,
      lifespanNotice: isText(result.lifespanNotice) ? result.lifespanNotice.trim() : null,
    };
  },
};

export const RULES = { character, diagnose, advice, environment, checklist, 'monthly-report': monthlyReport };

// ───────── 모양 검사 (P2 프롬프트 실험실이 "AI 원래 응답"을 검사할 때 사용) ─────────
// 반환: 문제점(한국어) 배열. 빈 배열이면 통과.
export function checkShape(name, obj) {
  const issues = [];
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return ['응답이 JSON 객체가 아니에요.'];

  const needText = (key) => {
    if (!isText(obj[key])) issues.push(`"${key}" 글자가 없어요.`);
  };
  const needList = (key, min, max) => {
    const arr = obj[key];
    if (!Array.isArray(arr)) issues.push(`"${key}" 가 배열이 아니에요.`);
    else if (arr.length < min || arr.length > max)
      issues.push(`"${key}" 는 ${min === max ? min : `${min}~${max}`}개여야 하는데 ${arr.length}개예요.`);
  };
  const nullOrText = (key) => {
    if (!(key in obj)) issues.push(`"${key}" 키가 없어요. (없으면 null)`);
    else if (obj[key] !== null && !isText(obj[key])) issues.push(`"${key}" 는 글자 또는 null 이어야 해요.`);
  };

  switch (name) {
    case 'character':
      if (!isDataUrl(obj.imageBase64)) issues.push('"imageBase64" 가 이미지 data URL 이 아니에요.');
      break;
    case 'diagnose':
      needText('symptoms');
      needText('question');
      if (obj.severity !== 'normal' && obj.severity !== 'watch') issues.push('"severity" 는 normal 또는 watch 여야 해요.');
      needList('options', 3, 3);
      break;
    case 'advice':
      needList('advice', 2, 2);
      needText('summaryTag');
      if (isText(obj.summaryTag) && obj.summaryTag.length > 12) issues.push('"summaryTag" 가 12자를 넘어요.');
      break;
    case 'environment':
      needText('goodPoint');
      needList('actions', 1, 2);
      break;
    case 'checklist':
      if (!Array.isArray(obj.items)) issues.push('"items" 가 배열이 아니에요.');
      else {
        for (const item of obj.items) {
          if (!DAILY_TASK_TYPES.includes(item?.taskType))
            issues.push(`허용되지 않은 taskType "${item?.taskType}" 이 있어요. (데일리 루틴만)`);
          if (!isText(item?.title)) issues.push('제목(title)이 없는 항목이 있어요.');
        }
        if (obj.items.length > 4) issues.push('items 가 4개를 넘어요.');
      }
      break;
    case 'monthly-report':
      needText('praise');
      needList('suggestions', 1, 2);
      nullOrText('repotNotice');
      nullOrText('lifespanNotice');
      break;
    default:
      issues.push(`알 수 없는 이름이에요: ${name}`);
  }
  return issues;
}
