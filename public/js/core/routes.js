/**
 * 파일: public/js/core/routes.js
 * 역할: 주소(#/경로) ↔ 페이지 파일 연결 표 (00_MAIN §5.2)
 * 사용하는 파일: core/router.js
 * 담당: C1
 *
 * - ':id', ':month' 처럼 ':' 로 시작하는 부분은 변수입니다. (#/report/2026-10 → params.month = '2026-10')
 * - 라우터는 "칸 수가 같고, 고정된 글자가 더 많은 경로"를 먼저 고릅니다.
 *   그래서 '/plants/new' 가 '/plants/:id' 같은 경로보다 항상 먼저 맞춰집니다.
 * - 페이지 파일이 아직 없으면 라우터가 not-ready.js("준비 중")를 대신 보여 줍니다.
 */

export const routes = [
  { path: '/login', page: 'login.js' },
  { path: '/signup', page: 'signup.js' },
  { path: '/main', page: 'main.js' },
  { path: '/plants/new', page: 'plant-register.js' },
  { path: '/plants', page: 'plant-manage.js' },
  { path: '/plants/:id/edit', page: 'plant-register.js' },
  { path: '/environment', page: 'environment.js' },
  { path: '/calendar', page: 'calendar.js' },
  { path: '/checklist', page: 'checklist.js' },
  { path: '/report', page: 'report.js' },
  { path: '/report/:month', page: 'report.js' },
  { path: '/profile', page: 'profile.js' },
  { path: '/notifications', page: 'notifications.js' },
  { path: '/dev', page: 'dev-ui.js' }, // 개발용 (배포 시 제거)
  { path: '/prompt-lab', page: 'prompt-lab.js' }, // 개발용 (배포 시 제거)
];

export const DEFAULT_AUTHED = '/main';
export const DEFAULT_GUEST = '/login';

// 로그인한 사람이 들어가면 메인으로 돌려보내는 화면
export const GUEST_ONLY_PATHS = ['/login', '/signup'];
