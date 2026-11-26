/**
 * 파일: public/js/services/species.js
 * 역할: 표준 식물 DB(public/data/plant-species.json) 읽기·검색, AI용 생육 기준 요약
 *       + 목록에 없는 식물을 AI로 만들어 내 식물 도감(users/{uid}/customSpecies)에 추가
 * 사용하는 파일: public/data/plant-species.json, core/firebase.js, core/store.js, core/ai.js
 *
 * ※ 기본 식물 목록은 Firestore 가 아니라 정적 JSON 파일을 읽습니다. (서버 없는 프로토타입 구조)
 * ※ AI로 추가한 식물은 사용자마다 users/{uid}/customSpecies/{speciesId} 에 저장됩니다.
 *   loadSpecies / getSpecies / searchSpecies 는 기본 목록 + 내가 추가한 식물을 함께 돌려주므로
 *   다른 화면은 이 함수들만 부르면 됩니다. (AI로 만든 종류의 id 는 'ai-' + 대표 이름)
 * ※ AI 결과는 바로 저장하지 않고, 사용자가 확인한 뒤에만 저장합니다. (previewSpeciesByName → saveSpeciesDraft)
 */

import { db, doc, collection, getDoc, getDocs, setDoc, serverTimestamp } from '../core/firebase.js';
import { store } from '../core/store.js';
import { generateSpecies, AiError } from '../core/ai.js';

let speciesPromise = null; // 기본 목록 (plant-species.json)
let customCache = { uid: null, promise: null }; // 내가 AI로 추가한 목록 (로그인한 사람별로 따로 기억)

// 기본 목록 불러오기 (한 번 불러오면 기억해 두고 다시 씀)
function loadBuiltInSpecies() {
  if (!speciesPromise) {
    speciesPromise = fetch('data/plant-species.json')
      .then((response) => {
        if (!response.ok) throw new Error('plant-species.json 불러오기 실패');
        return response.json();
      })
      .then((data) => (Array.isArray(data) ? data : data.species ?? []))
      .catch((error) => {
        speciesPromise = null; // 다음에 다시 시도할 수 있게
        throw error;
      });
  }
  return speciesPromise;
}

function currentUid() {
  return store.get('user')?.uid ?? null;
}

function customSpeciesCol(uid) {
  return collection(db, 'users', uid, 'customSpecies');
}

// 내가 AI로 추가한 식물 목록. 로그인 전이거나 불러오기에 실패하면 빈 배열 (기본 목록은 계속 쓸 수 있게)
function loadCustomSpecies() {
  const uid = currentUid();
  if (!uid || !db) return Promise.resolve([]);
  if (customCache.uid !== uid || !customCache.promise) {
    const promise = getDocs(customSpeciesCol(uid))
      .then((snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      .catch((error) => {
        console.warn('[species] 내가 추가한 식물 불러오기 실패', error?.code ?? error?.message);
        if (customCache.promise === promise) customCache = { uid: null, promise: null }; // 다음에 다시 시도
        return [];
      });
    customCache = { uid, promise };
  }
  return customCache.promise;
}

// 띄어쓰기·대소문자를 무시하고 비교하기 위한 글자
function normalizeName(text) {
  return String(text ?? '').replace(/\s+/g, '').toLowerCase();
}

// 목록에서 이름·별칭이 "정확히" 같은 것 하나 찾기. 없으면 null
function findByName(list, name) {
  const k = normalizeName(name);
  if (!k) return null;
  return list.find((s) => [s.name, ...(s.aliases ?? [])].some((n) => normalizeName(n) === k)) ?? null;
}

// 목록 불러오기 (기본 목록 + 내가 AI로 추가한 식물). 반환: 식물 종류 배열
export async function loadSpecies() {
  // Promise.all: 두 작업을 동시에 시작하고 둘 다 끝날 때까지 기다립니다.
  const [builtIn, custom] = await Promise.all([loadBuiltInSpecies(), loadCustomSpecies()]);
  return [...builtIn, ...custom];
}

// id 로 하나 찾기. 없으면 null
export async function getSpecies(id) {
  const list = await loadSpecies();
  return list.find((s) => s.id === id) ?? null;
}

// 이름·별칭에 검색어가 들어간 것. 검색어가 비어 있으면 전체
export async function searchSpecies(keyword) {
  const list = await loadSpecies();
  const k = normalizeName(keyword);
  if (!k) return list;
  return list.filter((s) => [s.name, ...(s.aliases ?? [])].some((name) => normalizeName(name).includes(k)));
}

// 이름·별칭이 정확히 같은 식물 하나 (띄어쓰기·대소문자 무시). 없으면 null
export async function findSpeciesByName(name) {
  return findByName(await loadSpecies(), name);
}

// AI 가 추가를 거절한 이유별 안내 문구 (Anti-Guilt: 부드럽게)
const REJECT_MESSAGES = {
  NOT_PLANT: (typed) => `'${typed}'은(는) 식물 이름으로 찾지 못했어요. 이름을 한 번 더 확인해 주세요.`,
  NOT_GROWABLE: (typed) => `'${typed}'은(는) 화분에서 기르며 관리하기 어려운 대상이라 추가하지 않았어요.`,
  RESTRICTED: () => '이 식물은 앱에서 키우기를 도와드리기 어려워요.',
};

// 같은 대표 이름이면 항상 같은 문서 id → 여러 번(동시에) 저장해도 하나만 남음
function draftId(draft) {
  return `ai-${normalizeName(draft.name)}`;
}

/**
 * 1단계: 목록에 없는 식물 이름 → AI가 생육 정보 "초안"을 만들어 돌려줌 (★ 아직 저장하지 않음)
 * - 이미 같은 이름(별칭 포함)이 있으면 AI를 부르지 않고 그 식물을 돌려줍니다.
 * - AI가 알려 준 대표 이름·별칭이 이미 목록에 있으면 그 식물을 돌려줍니다. (isNew: false)
 * 화면은 결과를 사용자에게 보여 주고, 사용자가 확인하면 saveSpeciesDraft(species) 로 저장합니다.
 * @param {string} name 사용자가 입력한 식물 이름
 * @returns {Promise<{ species: object, isNew: boolean }>}
 *   isNew: true  → species 는 저장 전 초안 (id 없음)
 *   isNew: false → species 는 이미 목록에 있는 식물 (id 있음)
 * 실패: 식물이 아니거나·기를 수 없거나·AI 호출 실패 → AiError (message 는 사용자에게 보여 줄 한국어)
 */
export async function previewSpeciesByName(name) {
  if (!currentUid()) throw new Error('로그인이 필요해요');
  const typed = String(name ?? '').trim().replace(/\s+/g, ' ');

  // ① 이미 있으면 그대로 사용 (AI 호출 아끼기)
  const existing = await findSpeciesByName(typed);
  if (existing) return { species: existing, isNew: false };

  // ② AI 에게 생육 정보 만들기 요청 (Firebase AI Logic — core/ai.js 를 통해서만 부름)
  //    입력 확인(글자 종류·길이·제한 식물)은 core/ai.js 가 AI 를 부르기 전에 합니다.
  const { isPlant, rejectReason, isMock, ...fields } = await generateSpecies({ speciesName: typed });
  if (!isPlant) {
    const message = REJECT_MESSAGES[rejectReason] ?? REJECT_MESSAGES.NOT_PLANT;
    throw new AiError(message(typed));
  }

  // ③ AI 가 알려 준 대표 이름(또는 별칭)이 이미 목록에 있으면 그것을 사용
  const list = await loadSpecies();
  const sameSpecies = findByName(list, fields.name) ?? fields.aliases.map((a) => findByName(list, a)).find(Boolean);
  if (sameSpecies) return { species: sameSpecies, isNew: false };

  // 사용자가 입력한 이름도 별칭에 넣어 두면 다음에 같은 이름으로 검색할 때 바로 찾을 수 있음
  // (사용자가 확인 창에서 "이 식물이 맞다"고 고른 뒤에만 저장되므로 잘못된 연결이 남지 않음)
  const aliases = [];
  for (const alias of [...fields.aliases, typed]) {
    const k = normalizeName(alias);
    if (k === normalizeName(fields.name)) continue;
    if (aliases.some((a) => normalizeName(a) === k)) continue;
    aliases.push(alias);
  }

  // mock 모드에서 만든 것은 source: 'MOCK' 으로 구분 (AI 가 실제로 확인하지 않은 임시 정보 → 나중에 찾아 지우기 쉽게)
  return { species: { ...fields, aliases, source: isMock ? 'MOCK' : 'AI' }, isNew: true };
}

/**
 * 2단계: 사용자가 확인한 초안을 내 식물 도감(users/{uid}/customSpecies)에 저장
 * - 같은 대표 이름의 식물이 이미 저장돼 있으면 새로 쓰지 않고 그 식물을 돌려줍니다.
 * @param {object} draft previewSpeciesByName 이 돌려준 species (isNew: true 인 것)
 * @returns {Promise<object>} 저장된 식물 종류 (id 포함)
 */
export async function saveSpeciesDraft(draft) {
  const uid = currentUid();
  if (!uid) throw new Error('로그인이 필요해요');
  if (!draft || typeof draft.name !== 'string' || !normalizeName(draft.name)) throw new Error('저장할 식물 정보가 없어요');

  const id = draftId(draft);
  const ref = doc(customSpeciesCol(uid), id);

  // 같은 id 가 이미 있으면(다른 탭에서 먼저 저장 등) 그것을 그대로 사용
  const snap = await getDoc(ref);
  let saved;
  if (snap.exists()) {
    saved = { id, ...snap.data() };
  } else {
    // 화면에서 쓰는 값만 골라 저장 (초안에 다른 값이 섞여 있어도 저장하지 않음)
    const data = {
      name: draft.name,
      aliases: Array.isArray(draft.aliases) ? draft.aliases : [],
      luxMin: draft.luxMin,
      luxMax: draft.luxMax,
      tempMin: draft.tempMin,
      tempMax: draft.tempMax,
      humidityMin: draft.humidityMin,
      humidityMax: draft.humidityMax,
      waterIntervalDays: draft.waterIntervalDays,
      fertilizeIntervalDays: draft.fertilizeIntervalDays,
      wipeLeafIntervalDays: draft.wipeLeafIntervalDays,
      repotIntervalDays: draft.repotIntervalDays,
      lifespanType: draft.lifespanType,
      defaultLifespanDays: draft.defaultLifespanDays ?? null,
      careTip: draft.careTip,
      source: draft.source === 'MOCK' ? 'MOCK' : 'AI',
      createdAt: serverTimestamp(),
    };
    await setDoc(ref, data);
    saved = { id, ...data, createdAt: null };
  }

  // 기억해 둔 목록에도 바로 넣어서, 다시 불러오지 않아도 getSpecies(id) 로 찾을 수 있게
  const custom = await loadCustomSpecies();
  if (customCache.uid === uid && !custom.some((s) => s.id === id)) custom.push(saved);
  return saved;
}

/**
 * 목록에 없는 식물 이름 → AI가 생육 정보를 만들어 바로 내 식물 도감에 추가 (확인 단계 없음)
 * 화면에서는 사용자 확인을 거치는 previewSpeciesByName → saveSpeciesDraft 를 쓰는 것을 권장합니다.
 * @param {string} name 사용자가 입력한 식물 이름
 * @returns {Promise<object>} plant-species.json 항목과 같은 모양의 식물 종류 (+ source: 'AI')
 * 실패: 식물이 아니거나 AI 호출 실패 → AiError (message 는 사용자에게 보여 줄 한국어)
 */
export async function addSpeciesByName(name) {
  const { species, isNew } = await previewSpeciesByName(name);
  return isNew ? saveSpeciesDraft(species) : species;
}

// AI 프롬프트에 넣을 짧은 생육 기준 요약
export function speciesProfile(species) {
  if (!species) return null;
  return {
    luxRange: `${species.luxMin}~${species.luxMax} lux`,
    tempRange: `${species.tempMin}~${species.tempMax}℃`,
    humidityRange: `${species.humidityMin}~${species.humidityMax}%`,
    waterIntervalDays: species.waterIntervalDays,
  };
}
