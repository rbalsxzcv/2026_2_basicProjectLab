# 02. Firebase 프로젝트 설정

> 이 저장소의 `public/js/core/firebase-config.js` 에는 **팀 프로젝트 값이 이미 들어 있습니다.**
> 아래 과정은 새 Firebase 프로젝트를 만들거나, 다른 프로젝트로 옮길 때만 하면 됩니다.
> 팀원은 같은 프로젝트를 쓰되 **각자 테스트용 계정을 따로** 만드세요. (보안 규칙상 계정별로 데이터가 분리됨)

## 1. 프로젝트 만들기 (한 명이 하고 팀원 초대)

1. [Firebase 콘솔](https://console.firebase.google.com) → 프로젝트 추가
2. 프로젝트 설정 → **사용자 및 권한** 에서 팀원 초대

## 2. 웹 앱 등록 → `firebaseConfig` 복사

1. 왼쪽 위 톱니바퀴 → **프로젝트 설정** → **일반** 탭 → 아래쪽 "내 앱" 에서 웹 앱(`</>` 아이콘) 추가
   (Firebase Hosting 체크는 선택)
2. 화면에 나오는 `const firebaseConfig = { ... }` 안의 값을
   `public/js/core/firebase-config.js` 의 `firebaseConfig` 에 그대로 옮겨 적습니다.

   | 키 | 모양 |
   | :--- | :--- |
   | `apiKey` | `"AIza..."` 로 시작 |
   | `authDomain` | `"<프로젝트ID>.firebaseapp.com"` |
   | `projectId` | 프로젝트 ID |
   | `appId` | `"1:숫자:web:영문숫자"` |
   | `storageBucket`, `messagingSenderId`, `measurementId` | 있으면 같이 붙여도 됨 (없어도 동작) |

   * 콘솔 예시 코드의 `import` / `initializeApp` / `getAnalytics` 줄은 넣지 마세요. 초기화는 `core/firebase.js` 가 합니다.
   * 이 값은 **공개되어도 괜찮은 값**이라 Git 에 올려도 됩니다. 데이터 보호는 보안 규칙과 App Check 가 담당합니다.
   * `apiKey` 가 `YOUR_` 로 시작하면 앱은 "설정 안 됨"으로 보고 안내 카드를 보여 줍니다.

## 3. Authentication (로그인)

**Authentication → 로그인 방법 → 이메일/비밀번호** 사용 설정.

* 앱은 아이디를 `아이디@plantcoach.example` 이메일로 바꿔서 가입합니다. (`.example` 은 메일이 가지 않는 예약 도메인)
* 그래서 "비밀번호 찾기(메일)"는 없습니다. 비밀번호는 Firestore 에 저장하지 않습니다.

## 4. Firestore Database + 보안 규칙

1. **Firestore Database → 데이터베이스 만들기** (위치: `asia-northeast3`(서울) 권장)
2. **규칙** 탭에 저장소 맨 위의 [`firestore.rules`](../firestore.rules) 내용을 통째로 붙여 넣고 **게시**
   * `rules_version = '2';` 줄은 **반드시 맨 첫 줄**이어야 합니다. (앞에 주석이 있으면 Parse error)
   * 규칙 요약: 로그인한 사람은 `users/{자기 uid}` 아래만 읽고 쓸 수 있습니다.
3. 별도 색인(index)을 만들 필요는 없습니다. (색인이 필요한 쿼리는 쓰지 않도록 설계)

## 5. 요금제

* 기본 설계는 **무료 Spark 요금제**로 동작합니다.
* Cloud Storage 는 Blaze(종량제)가 필요해서 쓰지 않습니다. 사진은 압축(약 700KB 이하)해서 Firestore 문서에 저장합니다.
  나중에 바꾸려면 → [07. 확장 가이드](07-extensions.md)

## 6. Firebase SDK 버전

SDK 는 공식 CDN 주소로 불러오며, 버전은 `public/js/core/firebase.js` 한 곳에만 있습니다. (현재 `13.3.0`)
바꿀 때는 맨 위 `FIREBASE_VERSION` 과 **import 주소 5곳의 숫자**를 함께 바꿉니다. (import 주소에는 변수를 쓸 수 없음)

## 다음 단계

* 실제 AI 를 쓰려면 AI Logic + App Check 도 설정해야 합니다 → [03. 실제 AI(real) 모드](03-real-ai-mode.md)
