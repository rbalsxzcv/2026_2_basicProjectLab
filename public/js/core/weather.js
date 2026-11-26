/**
 * 파일: public/js/core/weather.js
 * 역할: 거주지역의 현재 날씨 { tempC, humidity, precipitation, source } 가져오기
 *       - mock 모드: 월별 한국 평균값 + 약간의 무작위
 *       - real 모드: Open-Meteo (키가 필요 없는 공개 날씨 API)
 * 사용하는 파일: core/ai-config.js, utils/date.js, public/data/regions.json
 *
 * Open-Meteo 공식 문서: https://open-meteo.com/en/docs
 *   요청 예) https://api.open-meteo.com/v1/forecast?latitude=37.57&longitude=126.98
 *            &current=temperature_2m,relative_humidity_2m,precipitation&timezone=Asia%2FSeoul
 *   응답의 current.temperature_2m(℃), current.relative_humidity_2m(%), current.precipitation(mm) 을 씁니다.
 *
 * ★ 이 파일은 Firestore 에 저장하지 않습니다.
 */

import { getWeatherMode } from './ai-config.js';
import { thisMonth } from '../utils/date.js';

export class WeatherError extends Error {
  constructor(message) {
    super(message);
    this.name = 'WeatherError';
  }
}

const CACHE_MS = 10 * 60 * 1000; // 같은 지역은 10분 동안 다시 묻지 않음
const TIMEOUT_MS = 20_000;
const cache = new Map(); // region → { at, value }

let regionsPromise = null;

// regions.json 불러오기 (한 번만)
async function loadRegions() {
  if (!regionsPromise) {
    regionsPromise = fetch('data/regions.json')
      .then((response) => {
        if (!response.ok) throw new Error('regions.json 불러오기 실패');
        return response.json();
      })
      .catch((error) => {
        regionsPromise = null; // 다음에 다시 시도할 수 있게
        throw error;
      });
  }
  return (await regionsPromise).regions ?? [];
}

// 월별 대략적인 한국 날씨 [최저기온, 최고기온, 최저습도, 최고습도, 비 올 확률]
const MONTHLY_MOCK = {
  1: [-4, 3, 40, 55, 0.1],
  2: [-2, 6, 40, 55, 0.1],
  3: [3, 12, 45, 60, 0.15],
  4: [9, 19, 50, 62, 0.2],
  5: [14, 24, 55, 68, 0.2],
  6: [19, 27, 65, 78, 0.3],
  7: [24, 30, 72, 85, 0.45],
  8: [24, 31, 70, 85, 0.4],
  9: [18, 26, 62, 75, 0.25],
  10: [11, 20, 55, 68, 0.15],
  11: [4, 13, 48, 62, 0.15],
  12: [-2, 6, 40, 55, 0.1],
};

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function mockWeather() {
  const month = Number(thisMonth().slice(5, 7));
  const [tMin, tMax, hMin, hMax, rainChance] = MONTHLY_MOCK[month];
  return {
    tempC: Math.round(randomBetween(tMin, tMax) * 10) / 10,
    humidity: Math.round(randomBetween(hMin, hMax)),
    precipitation: Math.random() < rainChance,
    source: 'mock',
  };
}

async function realWeather({ lat, lon }) {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current: 'temperature_2m,relative_humidity_2m,precipitation',
    timezone: 'Asia/Seoul',
  });
  // AbortController: 일정 시간이 지나면 fetch 를 중간에 멈추게 해 주는 도구
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { signal: controller.signal });
    if (!response.ok) throw new Error(`Open-Meteo 응답 ${response.status}`);
    const data = await response.json();
    const current = data.current ?? {};
    return {
      tempC: Number(current.temperature_2m),
      humidity: Number(current.relative_humidity_2m),
      precipitation: Number(current.precipitation) > 0,
      source: 'real',
    };
  } finally {
    clearTimeout(timer);
  }
}

// region: '서울특별시' (regions.json 의 name, 또는 id 'seoul')
export async function getWeather(region) {
  if (!region) throw new WeatherError('거주지역 정보가 필요해요.');

  const mode = getWeatherMode();
  const cacheKey = `${mode}:${region}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_MS) return { ...cached.value };

  let found;
  try {
    const regions = await loadRegions();
    found = regions.find((r) => r.name === region || r.id === region);
  } catch (error) {
    console.warn('[weather] 지역 목록 불러오기 실패', error);
    throw new WeatherError('날씨를 불러오지 못했어요.');
  }
  if (!found) throw new WeatherError('거주지역 정보가 필요해요.');

  try {
    const value = mode === 'real' ? await realWeather(found) : mockWeather();
    cache.set(cacheKey, { at: Date.now(), value });
    return { ...value };
  } catch (error) {
    console.warn('[weather] 날씨 불러오기 실패', error);
    throw new WeatherError('날씨를 불러오지 못했어요.');
  }
}
