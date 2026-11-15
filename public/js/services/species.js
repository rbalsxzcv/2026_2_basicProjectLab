/**
 * 파일: public/js/services/species.js
 * 역할: 표준 식물 DB(public/data/plant-species.json) 읽기·검색, AI용 생육 기준 요약
 * 사용하는 파일: public/data/plant-species.json
 * 담당: C4
 *
 * ※ 이 파일은 Firestore 가 아니라 정적 JSON 파일을 읽습니다. (00_MAIN §3 프로토타입 단순화)
 */

let speciesPromise = null;

// 목록 불러오기 (한 번 불러오면 기억해 두고 다시 씀). 반환: 식물 종류 배열
export async function loadSpecies() {
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

// id 로 하나 찾기. 없으면 null
export async function getSpecies(id) {
  const list = await loadSpecies();
  return list.find((s) => s.id === id) ?? null;
}

// 이름·별칭에 검색어가 들어간 것. 검색어가 비어 있으면 전체
export async function searchSpecies(keyword) {
  const list = await loadSpecies();
  const k = String(keyword ?? '').trim().replace(/\s+/g, '').toLowerCase();
  if (!k) return list;
  const normalize = (text) => String(text).replace(/\s+/g, '').toLowerCase();
  return list.filter((s) => [s.name, ...(s.aliases ?? [])].some((name) => normalize(name).includes(k)));
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
