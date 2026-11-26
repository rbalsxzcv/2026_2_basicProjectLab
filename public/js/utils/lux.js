/**
 * 파일: public/js/utils/lux.js
 * 역할: 조도(밝기) 측정 — 1순위 AmbientLightSensor, 2순위 후면 카메라 3초 평균, 3순위 수동 프리셋
 * 사용하는 파일: 없음 (브라우저 Web API 사용)
 */

export const MANUAL_PRESETS = [
  { label: '어두운 방 안쪽', lux: 100 },
  { label: '밝은 실내 (창에서 2m 이상)', lux: 500 },
  { label: '창가 (커튼 너머)', lux: 2000 },
  { label: '햇빛이 직접 드는 창가', lux: 15000 },
];

// 평균 밝기(0~255) → 추정 lux 선형 보간 구간
const LUX_BANDS = [
  { minY: 0, maxY: 40, minLux: 50, maxLux: 200 },
  { minY: 40, maxY: 90, minLux: 200, maxLux: 800 },
  { minY: 90, maxY: 150, minLux: 800, maxLux: 3000 },
  { minY: 150, maxY: 210, minLux: 3000, maxLux: 10000 },
  { minY: 210, maxY: 255, minLux: 10000, maxLux: 30000 },
];

const SAMPLE_SIZE = 64; // 64×64 작은 캔버스로 줄여 빠르게 평균 밝기 계산
const SAMPLE_INTERVAL_MS = 200; // 0.2초마다 한 번씩 밝기 측정

let activeStream = null;
let activeTimer = null;
let cancelCurrent = null;

// 현재 환경에서 조도 센서 / 카메라를 쓸 수 있는지 확인 (카메라는 HTTPS 또는 localhost 에서만 가능)
export function canMeasure() {
  const sensor = typeof window !== 'undefined' && 'AmbientLightSensor' in window;
  const camera =
    typeof navigator !== 'undefined' &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    (typeof window === 'undefined' || window.isSecureContext);
  return { sensor, camera };
}

// 열려 있는 카메라 스트림과 진행 중인 측정 타이머를 즉시 멈춤
export function stopCamera() {
  if (activeTimer) {
    clearInterval(activeTimer);
    activeTimer = null;
  }
  if (activeStream) {
    for (const track of activeStream.getTracks()) {
      track.stop();
    }
    activeStream = null;
  }
  if (cancelCurrent) {
    const cancel = cancelCurrent;
    cancelCurrent = null;
    cancel();
  }
}

// 0~255 평균 휘도(Y)를 구간 내 선형 보간으로 추정 lux 로 변환
function brightnessToLux(avgY) {
  const y = Math.max(0, Math.min(255, Number(avgY) || 0));
  const band = LUX_BANDS.find((b) => y <= b.maxY) ?? LUX_BANDS[LUX_BANDS.length - 1];
  const ratio = (y - band.minY) / (band.maxY - band.minY);
  return Math.round(band.minLux + ratio * (band.maxLux - band.minLux));
}

// 1순위: 브라우저 조도 센서(AmbientLightSensor)로 3초 측정
function tryLightSensor(durationMs, onProgress) {
  if (!('AmbientLightSensor' in window)) return Promise.resolve(null);

  return new Promise((resolve) => {
    let sensor;
    let timer = null;
    let settled = false;
    const samples = [];
    const startedAt = Date.now();

    function finish(value) {
      if (settled) return;
      settled = true;
      if (timer) clearInterval(timer);
      try {
        sensor?.stop();
      } catch {
        /* 이미 멈췄으면 무시 */
      }
      resolve(value);
    }

    try {
      sensor = new window.AmbientLightSensor({ frequency: 5 });
      sensor.addEventListener('reading', () => {
        if (typeof sensor.illuminance === 'number' && !Number.isNaN(sensor.illuminance)) {
          samples.push(sensor.illuminance);
        }
      });
      sensor.addEventListener('error', () => finish(null));
      sensor.start();

      timer = setInterval(() => {
        const ratio = Math.min(1, (Date.now() - startedAt) / durationMs);
        onProgress?.(ratio);
        if (ratio >= 1) {
          if (samples.length === 0) {
            finish(null);
          } else {
            const avg = samples.reduce((sum, v) => sum + v, 0) / samples.length;
            finish({ lux: Math.round(avg), source: 'sensor' });
          }
        }
      }, SAMPLE_INTERVAL_MS);
    } catch {
      finish(null);
    }
  });
}

// 2순위: 후면 카메라 영상을 64×64 캔버스에 그려 3초 평균 밝기 계산
async function measureWithCamera(durationMs, onProgress, videoEl) {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('카메라를 사용할 수 없는 환경이에요.');
  }

  // 기존 카메라가 켜져 있으면 먼저 끔
  stopCamera();

  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'environment' },
    audio: false,
  });
  activeStream = stream;

  const video = videoEl ?? document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.srcObject = stream;

  try {
    await video.play();
  } catch {
    /* 일부 브라우저는 자동 재생 promise 가 거부되어도 프레임은 읽을 수 있음 */
  }

  const canvas = document.createElement('canvas');
  canvas.width = SAMPLE_SIZE;
  canvas.height = SAMPLE_SIZE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  return new Promise((resolve, reject) => {
    const samples = [];
    const startedAt = Date.now();
    let settled = false;

    function cleanup() {
      if (activeTimer) {
        clearInterval(activeTimer);
        activeTimer = null;
      }
      if (activeStream) {
        for (const track of activeStream.getTracks()) track.stop();
        activeStream = null;
      }
      if (videoEl) videoEl.srcObject = null;
      cancelCurrent = null;
    }

    cancelCurrent = () => {
      if (settled) return;
      settled = true;
      cleanup();
      const err = new Error('측정이 취소되었어요.');
      err.name = 'AbortError';
      reject(err);
    };

    activeTimer = setInterval(() => {
      if (settled) return;
      // 비디오 프레임이 준비됐을 때만 픽셀 밝기 계산
      if (video.readyState >= 2 && video.videoWidth > 0) {
        ctx.drawImage(video, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
        const { data } = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
        let sumY = 0;
        const pixelCount = SAMPLE_SIZE * SAMPLE_SIZE;
        for (let i = 0; i < data.length; i += 4) {
          // 사람이 느끼는 밝기(휘도) 공식: Y = 0.2126R + 0.7152G + 0.0722B
          sumY += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
        }
        samples.push(sumY / pixelCount);
      }

      const ratio = Math.min(1, (Date.now() - startedAt) / durationMs);
      onProgress?.(ratio);

      if (ratio >= 1) {
        settled = true;
        cleanup();
        if (samples.length === 0) {
          reject(new Error('카메라 화면에서 밝기를 읽지 못했어요.'));
          return;
        }
        const avgY = samples.reduce((sum, v) => sum + v, 0) / samples.length;
        resolve({ lux: brightnessToLux(avgY), source: 'camera' });
      }
    }, SAMPLE_INTERVAL_MS);
  });
}

/**
 * 3초 동안 식물이 놓인 자리의 밝기를 측정합니다.
 * @param {object} [options]
 * @param {number} [options.durationMs=3000]  측정 시간(ms)
 * @param {(ratio: number) => void} [options.onProgress]  진행률(0~1) 콜백
 * @param {HTMLVideoElement} [options.videoEl]  카메라 미리보기를 띄울 video 요소
 * @returns {Promise<{ lux: number, source: 'sensor' | 'camera' }>}
 */
export async function measureLux({ durationMs = 3000, onProgress, videoEl } = {}) {
  onProgress?.(0);

  // 1순위: 조도 센서 (지원하지 않거나 실패하면 null)
  const sensorResult = await tryLightSensor(durationMs, onProgress);
  if (sensorResult) return sensorResult;

  // 2순위: 후면 카메라 밝기 추정
  return measureWithCamera(durationMs, onProgress, videoEl);
}
