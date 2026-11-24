# 07. 확장 가이드 (선택 · 팀 결정 필요)

지금 설계에서 일부러 뺀 기능들입니다. 켜려면 요금제나 "서버 없음" 원칙이 바뀌므로 **팀 합의 → `00_MAIN.md` 수정**을 먼저 합니다.

## 사진을 Cloud Storage 에 저장하기 (Blaze 요금제 필요)

지금은 사진을 압축한 data URL 로 Firestore 문서에 직접 넣습니다 (`IMAGE_STORAGE_MODE = 'firestore'`).
바꿀 곳은 `public/js/services/images.js` **한 파일**입니다. 다른 파일은 모두 `prepareImageForSave()` 만 부릅니다.

1. `core/firebase.js` 에 `firebase-storage` CDN 모듈 추가 → `getStorage, ref, uploadString, getDownloadURL` 다시 내보내기
2. `images.js` 의 `'storage'` 분기 구현
   ```js
   // 예시 흐름
   const fileRef = ref(storage, `users/${uid}/photos/${id}.jpg`);
   await uploadString(fileRef, dataUrl, 'data_url');
   return await getDownloadURL(fileRef); // https 주소 → <img src> 에 그대로 사용 가능
   ```
3. `IMAGE_STORAGE_MODE = 'storage'` 로 변경, Storage 보안 규칙도 `users/{uid}/**` 기준으로 작성

## 앱을 닫아도 오는 푸시 알림 (FCM)

지금 알림은 **앱 안 알림함 + (앱이 열려 있을 때) 브라우저 알림**입니다. 앱을 닫은 뒤의 푸시는 서버가 필요합니다.

1. Firebase 콘솔 → 프로젝트 설정 → Cloud Messaging → **웹 푸시 인증서(VAPID 키)** 생성
2. `public/firebase-messaging-sw.js` 서비스 워커(사이트 루트에 있어야 함), 토큰을 `users/{uid}/fcmTokens/{token}` 에 저장
3. 매일 체크리스트 / 매월 1일 리포트 발송은 **Cloud Functions + Blaze 요금제**가 필요 → "백엔드 없음" 원칙과 충돌
4. iPhone 은 웹앱을 **홈 화면에 추가**해야만 웹 푸시를 받습니다 → 시연은 Android / 데스크톱 Chrome 권장

## 프롬프트 새 버전 채택

`PROMPT_VERSION` 은 모든 템플릿에 함께 적용됩니다. 템플릿마다 버전을 따로 두고 싶으면 P2 담당이 방식을 제안합니다.
절차는 [README 의 "프롬프트 템플릿 관리"](../README.md#프롬프트-템플릿-관리)를 따르세요.
