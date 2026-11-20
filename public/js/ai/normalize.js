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

// ───────── 새 식물 종류 만들기 (사용자가 입력한 이름 → plant-species.json 과 같은 모양) ─────────
export const SPECIES_NAME_MAX = 30;
export const LIFESPAN_TYPES = ['PERENNIAL', 'ANNUAL', 'BIENNIAL', 'HARVEST'];
// 추가를 거절하는 이유: 식물이 아님 / 화분에서 기를 수 없음(조화·꽃다발 등) / 재배가 제한된 식물
export const SPECIES_REJECT_REASONS = ['NOT_PLANT', 'NOT_GROWABLE', 'RESTRICTED'];

// 식물 이름에 쓸 수 있는 글자: 한글, 영문, 숫자, 띄어쓰기, - · ( )
// (따옴표·콜론·중괄호 등을 막아서 AI 에게 지시문을 끼워 넣기 어렵게 함)
const SPECIES_NAME_PATTERN = /^[가-힣A-Za-z0-9 \-·()]+$/;

// 국내에서 재배가 법으로 제한되는 식물 (AI 판단과 별개로 한 번 더 막음)
const RESTRICTED_CONTAINS = [
  '대마', '마리화나', '칸나비스', 'cannabis', 'marijuana', '아편', 'opium',
  '페요테', 'peyote', '코카나무', '마약', '환각', '크라톰', 'kratom', '살비아디비노룸', 'salviadivinorum',
];
const RESTRICTED_EXACT = ['양귀비', '코카', 'coca', '헴프', 'hemp', 'papaversomniferum']; // '개양귀비'·'꽃양귀비'는 허용

// 겁주거나 죄책감을 주는 표현 (00_MAIN §6 금지어) — AI 가 쓴 글에 있으면 기본 문구로 바꿈
const FORBIDDEN_WORDS = ['죽음', '죽어', '죽는', '죽을', '죽었', '시듦', '시들', '실패', '경고', '벌점', '망가'];

const compact = (text) => String(text ?? '').replace(/\s+/g, '').toLowerCase();

// 재배가 제한된 식물 이름인지 (띄어쓰기·대소문자 무시)
export function isRestrictedSpeciesName(text) {
  const k = compact(text);
  if (!k) return false;
  return RESTRICTED_EXACT.includes(k) || RESTRICTED_CONTAINS.some((word) => k.includes(word));
}

function hasForbiddenWords(text) {
  return FORBIDDEN_WORDS.some((word) => String(text ?? '').includes(word));
}

// 식물 이름으로 써도 되는 글자인지 (길이·글자 종류·금지어)
function isSafeSpeciesName(text) {
  return (
    isText(text) &&
    text.trim().length <= SPECIES_NAME_MAX &&
    SPECIES_NAME_PATTERN.test(text.trim()) &&
    !hasForbiddenWords(text)
  );
}

// 숫자를 정수로 바꾸고 [min, max] 안으로 맞춤. 숫자가 아니면 fallback
function clampInt(value, min, max, fallback) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

// 최솟값·최댓값을 다듬고, 거꾸로 들어오면 서로 바꿈
function range(minValue, maxValue, limitMin, limitMax, fallbackMin, fallbackMax) {
  let low = clampInt(minValue, limitMin, limitMax, fallbackMin);
  let high = clampInt(maxValue, limitMin, limitMax, fallbackMax);
  if (low > high) [low, high] = [high, low];
  return [low, high];
}

const SPECIES_DEFAULTS = {
  isPlant: false, // AI 가 판정을 빠뜨리면 "식물 아님"으로 봄 (애매하면 추가하지 않는 쪽이 안전)
  rejectReason: null,
  name: '',
  aliases: [],
  luxMin: 1000,
  luxMax: 10000,
  tempMin: 18,
  tempMax: 27,
  humidityMin: 40,
  humidityMax: 70,
  waterIntervalDays: 7,
  fertilizeIntervalDays: 30,
  wipeLeafIntervalDays: 14,
  repotIntervalDays: 365,
  lifespanType: 'PERENNIAL',
  defaultLifespanDays: null,
  careTip: '겉흙이 마르면 듬뿍 주고, 밝은 간접광이 드는 자리에 두세요.',
};

const species = {
  validate(input) {
    if (!isText(input?.speciesName)) return '식물 이름을 입력해 주세요.';
    const name = input.speciesName.trim();
    if (name.length < 2) return '식물 이름을 2글자 이상 입력해 주세요.';
    if (name.length > SPECIES_NAME_MAX) return `식물 이름은 ${SPECIES_NAME_MAX}자 이내로 입력해 주세요.`;
    if (!SPECIES_NAME_PATTERN.test(name)) return '식물 이름은 한글, 영문, 숫자로만 입력해 주세요.';
    if (isRestrictedSpeciesName(name)) return '이 식물은 앱에서 키우기를 도와드리기 어려워요.';
    return null;
  },
  buildVars: (input) => ({ speciesName: input.speciesName.trim().replace(/\s+/g, ' ') }),
  defaults: SPECIES_DEFAULTS,
  normalize(result) {
    const d = SPECIES_DEFAULTS;
    const [luxMin, luxMax] = range(result.luxMin, result.luxMax, 50, 100000, d.luxMin, d.luxMax);
    const [tempMin, tempMax] = range(result.tempMin, result.tempMax, -10, 45, d.tempMin, d.tempMax);
    const [humidityMin, humidityMax] = range(result.humidityMin, result.humidityMax, 10, 100, d.humidityMin, d.humidityMax);
    const lifespanType = LIFESPAN_TYPES.includes(result.lifespanType) ? result.lifespanType : d.lifespanType;
    // 여러해살이는 마무리 날짜가 없음. 나머지는 기본 수명이 꼭 있어야 등록 화면에서 날짜를 채울 수 있음
    const defaultLifespanDays =
      lifespanType === 'PERENNIAL' ? null : clampInt(result.defaultLifespanDays, 14, 730, 120);
    // 과습 방지: 물주기 간격이 너무 짧지 않게 (여러해살이 3일, 채소·허브 등 2일이 최소 — 기본 목록의 최솟값 기준)
    const waterMin = lifespanType === 'PERENNIAL' ? 3 : 2;

    // 이름·별칭은 글자 종류·길이·금지어를 통과한 것만 씀 (이름이 비면 core/ai.js 가 입력한 이름으로 채움)
    const name = isSafeSpeciesName(result.name) ? result.name.trim() : '';
    const aliases = textList(result.aliases).filter(isSafeSpeciesName).slice(0, 5);

    // 판정: isPlant 가 정확히 true 일 때만 통과. 거절 이유가 있거나 제한 식물 이름이면 거절
    let isPlant = result.isPlant === true;
    let rejectReason = SPECIES_REJECT_REASONS.includes(result.rejectReason) ? result.rejectReason : null;
    if ([name, ...aliases].some(isRestrictedSpeciesName)) rejectReason = 'RESTRICTED';
    if (rejectReason) isPlant = false;
    if (!isPlant && !rejectReason) rejectReason = 'NOT_PLANT';

    return {
      isPlant,
      rejectReason,
      // mock 응답인지 (mocks/species.json 에만 "_mock": true 가 있음). mock 은 식물인지 실제로 판단하지 못함
      isMock: result._mock === true,
      name,
      aliases,
      luxMin,
      luxMax,
      tempMin,
      tempMax,
      humidityMin,
      humidityMax,
      waterIntervalDays: clampInt(result.waterIntervalDays, waterMin, 60, d.waterIntervalDays),
      fertilizeIntervalDays: clampInt(result.fertilizeIntervalDays, 7, 365, d.fertilizeIntervalDays),
      wipeLeafIntervalDays: clampInt(result.wipeLeafIntervalDays, 3, 120, d.wipeLeafIntervalDays),
      repotIntervalDays: clampInt(result.repotIntervalDays, 90, 1095, d.repotIntervalDays),
      lifespanType,
      defaultLifespanDays,
      careTip: hasForbiddenWords(result.careTip) ? d.careTip : str(result.careTip, d.careTip).slice(0, 120),
    };
  },
};

export const RULES = { character, diagnose, advice, environment, checklist, 'monthly-report': monthlyReport, species };

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
    case 'species':
      if (typeof obj.isPlant !== 'boolean') issues.push('"isPlant" 는 true 또는 false 여야 해요.');
      if (obj.rejectReason !== null && obj.rejectReason !== undefined && !SPECIES_REJECT_REASONS.includes(obj.rejectReason))
        issues.push('"rejectReason" 은 null, NOT_PLANT, NOT_GROWABLE, RESTRICTED 중 하나여야 해요.');
      if (obj.isPlant === false) break; // 식물이 아니면 나머지 값은 없어도 됨
      needText('name');
      needText('careTip');
      for (const key of [
        'luxMin', 'luxMax', 'tempMin', 'tempMax', 'humidityMin', 'humidityMax',
        'waterIntervalDays', 'fertilizeIntervalDays', 'wipeLeafIntervalDays', 'repotIntervalDays',
      ]) {
        if (typeof obj[key] !== 'number') issues.push(`"${key}" 가 숫자가 아니에요.`);
      }
      if (!LIFESPAN_TYPES.includes(obj.lifespanType))
        issues.push('"lifespanType" 은 PERENNIAL, ANNUAL, BIENNIAL, HARVEST 중 하나여야 해요.');
      break;
    default:
      issues.push(`알 수 없는 이름이에요: ${name}`);
  }
  return issues;
}
