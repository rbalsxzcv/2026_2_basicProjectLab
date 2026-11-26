/**
 * 파일: public/js/ai/usage.js
 * 역할: 실제 AI 호출의 하루 사용량 세기 (비용 안전장치)
 * 사용하는 파일: core/ai-config.js, utils/date.js
 *
 * ※ 이 한도는 "브라우저마다" 세는 부드러운 안전장치입니다. (다른 브라우저/기기에서는 따로 셈)
 *   진짜 한도는 Firebase 콘솔 / Google Cloud 콘솔의 할당량(Quota) 설정에서도 걸 수 있습니다.
 */

import { AI_DAILY_LIMITS } from '../core/ai-config.js';
import { today } from '../utils/date.js';

const USAGE_KEY = 'plantCoach.aiUsage';

function emptyUsage() {
  return { date: today(), text: 0, vision: 0, image: 0 };
}

function readUsage() {
  try {
    const saved = JSON.parse(localStorage.getItem(USAGE_KEY) ?? 'null');
    // 날짜가 바뀌었으면 0부터 다시 셈
    if (!saved || saved.date !== today()) return emptyUsage();
    return { ...emptyUsage(), ...saved };
  } catch {
    return emptyUsage();
  }
}

function writeUsage(usage) {
  try {
    localStorage.setItem(USAGE_KEY, JSON.stringify(usage));
  } catch {
    /* 무시 */
  }
}

// kind: 'text' | 'vision' | 'image'. 한도를 넘었으면 false, 아니면 1 세고 true
export function checkAndCount(kind) {
  const usage = readUsage();
  const max = AI_DAILY_LIMITS[kind] ?? 0;
  if ((usage[kind] ?? 0) >= max) return false;
  usage[kind] = (usage[kind] ?? 0) + 1;
  writeUsage(usage);
  return true;
}

// { date, text, vision, image, limits }
export function getUsage() {
  return { ...readUsage(), limits: { ...AI_DAILY_LIMITS } };
}
