/**
 * 파일: public/js/pages/not-ready.js
 * 역할: 아직 만들지 않은 화면, 또는 없는 주소일 때 보여 주는 "준비 중" 화면
 * 사용하는 파일: ui/components.js
 * 담당: C1
 */

import { emptyState } from '../ui/components.js';

export default {
  title: '준비 중',
  requiresAuth: false,
  showNav: true,
  styles: [],
  async render(container) {
    container.innerHTML = emptyState({
      icon: '🌱',
      message: '이 화면은 아직 자라는 중이에요',
      actionLabel: '홈으로 가기',
      actionHref: '#/main',
    });
  },
};
