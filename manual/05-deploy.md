# 05. 배포 (Firebase Hosting)

평소 개발은 localhost 로 충분합니다. **HTTPS 가 필요할 때만** 배포합니다.
(휴대폰 후면 카메라로 조도 측정, 다른 기기에서 시연 등 — 카메라는 HTTPS 또는 localhost 에서만 켜짐)

## 1. 처음 한 번

1. [Firebase CLI](https://firebase.google.com/docs/cli) 설치 (Node.js 가 필요한 건 이 CLI 뿐입니다 — 앱 자체는 Node 불필요)
2. 로그인 · 프로젝트 연결
   ```powershell
   firebase login
   firebase use <프로젝트ID>
   ```
3. 저장소의 `firebase.json` 은 이미 `public` 폴더를 올리도록 되어 있습니다.
   ```json
   { "hosting": { "public": "public", "ignore": ["**/.*"] } }
   ```

## 2. 배포

```powershell
# 프로젝트 맨 위 폴더에서
firebase deploy --only hosting
```

주소: `https://<프로젝트ID>.web.app`

## 3. 배포 전 체크리스트

- [ ] `public/js/core/ai-config.js` 의 `AI_MODE`·`WEATHER_MODE` 확인 (시연에서 실제 AI 를 쓸지 팀이 결정)
- [ ] 시연에서 실제 AI 를 쓴다면 `AI_FALLBACK_TO_MOCK = true` 를 고려 (호출 실패 시 mock 으로 대신 응답)
- [ ] reCAPTCHA v3 키의 도메인에 `<프로젝트ID>.web.app` 이 등록돼 있는지 ([03. real 모드](03-real-ai-mode.md))
      — 배포 주소에서는 디버그 토큰이 아니라 reCAPTCHA 로 App Check 를 통과합니다.
- [ ] 정식 공개라면 `public/js/core/routes.js` 에서 개발용 화면 두 줄 제거
  ```js
  { path: '/dev', page: 'dev-ui.js' }, // 개발용 (배포 시 제거)
  { path: '/prompt-lab', page: 'prompt-lab.js' }, // 개발용 (배포 시 제거)
  ```
  (함께 `pages/dev-ui.js`, `pages/prompt-lab.js`, `services/dev-tools.js` 를 지워도 됩니다)
- [ ] mock 모드로 만든 테스트용 식물 종류(`customSpecies` 의 `source: "MOCK"`)·샘플 데이터 정리

## 참고

* `.firebase/` 폴더(배포 캐시)는 `.gitignore` 에 들어 있어 Git 에 올라가지 않습니다.
