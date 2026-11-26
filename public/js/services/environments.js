/**
 * 파일: public/js/services/environments.js
 * 역할: 환경 측정 기록 — plants/{id}/environments/{envId}
 * 사용하는 파일: core/firebase.js, core/store.js
 *
 * 문서 모양:
 *   { measuredLux, luxSource: 'camera'|'sensor'|'manual', weather: { tempC, humidity, precipitation },
 *     windowDir, heaterOrAcExposed, matchScore, lightLevel: 'LOW'|'OK'|'HIGH',
 *     coach: { goodPoint, actions }, measuredAt }
 */

import { db, collection, addDoc, getDocs, query, orderBy, limit, serverTimestamp } from '../core/firebase.js';
import { store } from '../core/store.js';

function currentUid() {
  const uid = store.get('user')?.uid;
  if (!uid) throw new Error('로그인이 필요해요');
  return uid;
}

function envCol(plantId) {
  return collection(db, 'users', currentUid(), 'plants', plantId, 'environments');
}

// 측정 결과 저장 (measuredAt 은 자동). 반환: 저장한 객체 (id 포함)
export async function saveEnvironment(plantId, data) {
  const record = {
    measuredLux: Number(data.measuredLux) || 0,
    luxSource: data.luxSource ?? 'manual',
    weather: data.weather
      ? {
          tempC: data.weather.tempC ?? null,
          humidity: data.weather.humidity ?? null,
          precipitation: Boolean(data.weather.precipitation),
        }
      : null,
    windowDir: data.windowDir ?? null,
    heaterOrAcExposed: data.heaterOrAcExposed ?? null,
    matchScore: data.matchScore ?? null,
    lightLevel: data.lightLevel ?? null,
    coach: data.coach ? { goodPoint: data.coach.goodPoint ?? '', actions: data.coach.actions ?? [] } : null,
    measuredAt: serverTimestamp(),
  };
  const ref = await addDoc(envCol(plantId), record);
  return { id: ref.id, ...record, measuredAt: null };
}

// 가장 최근 측정 (없으면 null)
export async function getLatestEnvironment(plantId) {
  const list = await listEnvironments(plantId, 1);
  return list[0] ?? null;
}

// 최근 측정 n개 (최신순)
export async function listEnvironments(plantId, n = 5) {
  const snap = await getDocs(query(envCol(plantId), orderBy('measuredAt', 'desc'), limit(n)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
