/**
 * 파일: public/js/utils/envScore.js
 * 역할: AI 없이 규칙 기반으로 환경 적합도 점수(0~100)와 기본 조언을 계산
 * 사용하는 파일: 없음
 * 담당: P5
 */

export const LIGHT_LABEL = {
  LOW: '빛이 부족해요',
  OK: '빛이 딱 좋아요',
  HIGH: '직사광선 주의',
};

// 빛 판정: 권장 최소보다 낮으면 LOW, 최대의 1.5배를 넘으면 HIGH, 그 외 OK
export function lightLevel(lux, species) {
  const value = Number(lux) || 0;
  const luxMin = species?.luxMin ?? 500;
  const luxMax = species?.luxMax ?? 10000;
  if (value < luxMin) return 'LOW';
  if (value > luxMax * 1.5) return 'HIGH';
  return 'OK';
}

// 빛 점수 (최대 50점)
function scoreLight(lux, level, species) {
  if (level === 'OK') return 50;
  if (level === 'HIGH') return 25;

  // LOW: 부족 비율에 따라 10~40점
  const luxMin = Math.max(1, species?.luxMin ?? 500);
  const ratio = Math.max(0, Math.min(1, (Number(lux) || 0) / luxMin));
  return Math.round(10 + ratio * 30);
}

// 온도 점수 (최대 20점): 실내는 바깥보다 온화하므로 실외 기온이 극단적일 때만 감점
function scoreTemp(weather, species) {
  if (typeof weather?.tempC !== 'number' || Number.isNaN(weather.tempC)) return 16;
  const tempMin = species?.tempMin ?? 15;
  const tempMax = species?.tempMax ?? 28;
  const t = weather.tempC;

  // 실내는 바깥보다 ±8℃ 정도 완충된다고 보고, 그 범위를 넘을 때만 감점
  let gap = 0;
  if (t < tempMin - 8) gap = tempMin - 8 - t;
  else if (t > tempMax + 5) gap = t - (tempMax + 5);

  return Math.max(4, Math.round(20 - gap * 1.5));
}

// 습도 점수 (최대 20점): 권장 범위에서 떨어진 거리에 비례해 감점
function scoreHumidity(weather, species) {
  if (typeof weather?.humidity !== 'number' || Number.isNaN(weather.humidity)) return 14;
  const hMin = species?.humidityMin ?? 40;
  const hMax = species?.humidityMax ?? 70;
  const h = weather.humidity;

  let gap = 0;
  if (h < hMin) gap = hMin - h;
  else if (h > hMax) gap = h - hMax;

  return Math.max(4, Math.round(20 - gap * 0.5));
}

/**
 * 측정 조도·날씨·냉난방기 노출 여부를 바탕으로 적합도 점수(0~100)를 계산합니다.
 * 창문 방향(windowDir)은 점수에는 반영하지 않고 조언 문구에만 반영합니다.
 */
export function calcMatchScore({ lux, weather, heaterOrAcExposed, windowDir, species }) {
  const level = lightLevel(lux, species);
  const light = scoreLight(lux, level, species);
  const temp = scoreTemp(weather, species);
  const humidity = scoreHumidity(weather, species);
  const exposure = heaterOrAcExposed ? 0 : 10;

  const total = Math.max(0, Math.min(100, Math.round(light + temp + humidity + exposure)));
  return {
    score: total,
    lightLevel: level,
    breakdown: { light, temp, humidity, exposure },
  };
}

/**
 * AI 호출이 실패했을 때 보여 줄 규칙 기반 기본 조언 ({ goodPoint, actions })
 */
export function ruleBasedTips({ lightLevel: level, weather, heaterOrAcExposed, windowDir, species }) {
  const actions = [];
  const luxMin = species?.luxMin ?? 500;
  const humidityMin = species?.humidityMin ?? 40;

  if (level === 'LOW') {
    if (windowDir === '북향' || windowDir === '창문 없음') {
      actions.push('창가 쪽으로 옮겨 주세요.');
    } else {
      actions.push('창가에서 50cm 안쪽으로 자리를 옮겨주세요.');
    }
  } else if (level === 'HIGH') {
    actions.push('한낮에는 얇은 커튼으로 햇빛을 한 번 걸러 주세요.');
  }

  if (typeof weather?.humidity === 'number' && weather.humidity < humidityMin) {
    actions.push('주변에 물을 담은 컵을 두거나 주 2회 분무를 권장합니다.');
  }

  if (heaterOrAcExposed) {
    actions.push('에어컨·난방기 바람이 직접 닿지 않는 곳으로 옮겨 주세요.');
  }

  // 별다른 주의 사항이 없을 때 기본 행동 1개 채우기
  if (actions.length === 0) {
    if (windowDir === '남향') {
      actions.push('햇빛이 잘 드는 창가 쪽이니, 한낮 강한 빛만 가끔 살펴 주세요.');
    } else {
      actions.push(`권장 밝기(${luxMin}~${species?.luxMax ?? 10000} lux) 범위에서 잘 지내고 있어요. 가끔 환기만 해 주세요.`);
    }
  }

  const goodPoint =
    level === 'OK'
      ? '지금 자리는 식물이 편안하게 빛을 받기 좋은 밝기예요.'
      : heaterOrAcExposed
        ? '식물 상태를 자주 살펴보며 환경을 챙겨 주시는 점이 좋아요.'
        : '직접적인 냉난방 바람을 피해 안정적인 자리에 놓여 있어요.';

  return {
    goodPoint,
    actions: actions.slice(0, 2),
  };
}
