/**
 * 파일: public/js/ui/celebrate.js
 * 역할: 레벨업 축하 모달, 버튼 위로 떠오르는 "+20 EXP" 글자
 * 사용하는 파일: ui/components.js, utils/dom.js, services/plants.js (기본 캐릭터 경로)
 * 담당: C6 — 공통 완료 후 이름·인자·반환 형식 동결 (P1 캘린더, P3 체크리스트가 사용)
 *
 * 사용 예)
 *   const result = await awardExp(plant.id, EXP.PERIODIC, 'WATER');
 *   floatExp(buttonEl, EXP.PERIODIC);
 *   await celebrateIfLeveledUp(result, plant);
 */

import { html } from '../utils/dom.js';
import { openModal } from './components.js';
import { DEFAULT_CHARACTER } from '../services/plants.js';

// result = awardExp 의 반환값. 레벨이 올랐을 때만 모달을 띄우고, 닫힐 때까지 기다립니다.
// 반환: 모달을 띄웠으면 true, 아니면 false
export async function celebrateIfLeveledUp(result, plant) {
  if (!result?.leveledUp) return false;

  const unlockText = (result.newUnlocks ?? []).map((u) => u.name).join(', ');
  await openModal({
    title: '🎉 축하해요!',
    body: html`
      <div class="celebrate">
        <span class="celebrate-spark" aria-hidden="true">✨</span>
        <span class="celebrate-spark" aria-hidden="true">⭐</span>
        <span class="celebrate-spark" aria-hidden="true">✨</span>
        <img class="celebrate-img" src="${plant?.characterImage || DEFAULT_CHARACTER}" alt="${plant?.name ?? '내 식물'} 캐릭터" />
        <p class="celebrate-level">Lv.${result.level}이 되었어요!</p>
        ${result.newStage ? html`<p>${result.newStage.name}(으)로 자랐어요</p>` : ''}
        ${unlockText ? html`<p class="tag">새 소품: ${unlockText}</p>` : ''}
      </div>
    `,
    actions: [{ label: '고마워요!', value: true, variant: 'primary' }],
  });
  return true;
}

// targetEl(버튼 등) 위에 "+20 EXP" 를 띄웠다가 사라지게 합니다.
export function floatExp(targetEl, amount) {
  if (!targetEl || !amount) return;
  const rect = targetEl.getBoundingClientRect();
  const el = document.createElement('span');
  el.className = 'float-exp';
  el.textContent = `+${amount} EXP`;
  el.setAttribute('aria-hidden', 'true');
  el.style.left = `${rect.left + rect.width / 2}px`;
  el.style.top = `${rect.top - 8}px`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1300);
}
