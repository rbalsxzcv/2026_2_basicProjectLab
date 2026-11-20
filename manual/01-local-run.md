# 01. 내 컴퓨터에서 실행하기

설치할 것은 없습니다. (Node.js·npm 불필요) `public/` 폴더를 정적 서버로 열기만 하면 됩니다.

## 방법 A — Python

```powershell
# 프로젝트 맨 위 폴더에서 실행 (public 폴더를 열어야 함 — 그냥 열면 GET / 404)
python -m http.server 5500 --directory public
```

브라우저에서 **`http://localhost:5500`** 을 엽니다.

## 방법 B — VS Code Live Server

1. VS Code 확장 **Live Server** 설치
2. `public/index.html` 오른쪽 클릭 → **Open with Live Server**

## 꼭 알아 둘 것

| 상황 | 이유 · 해결 |
| :--- | :--- |
| `index.html` 을 더블클릭(`file://`)으로 열면 빈 화면 | ES 모듈은 `file://` 에서 동작하지 않습니다. 반드시 서버로 여세요. |
| `127.0.0.1` 말고 **`localhost`** 로 열기 | App Check 디버그 모드는 localhost 기준으로 안내합니다. 디버그 토큰도 주소마다 따로 등록됩니다. |
| 코드를 고쳤는데 화면이 그대로 | **Ctrl+F5** (강력 새로고침) — 브라우저가 옛 JS 파일을 기억하고 있을 수 있어요. |
| 휴대폰 카메라로 조도 측정 | 카메라는 `localhost` 또는 **HTTPS** 에서만 켜집니다. 휴대폰 테스트는 [05. 배포](05-deploy.md) 참고. |
| "Firebase 설정이 필요해요" 카드가 보임 | `firebaseConfig` 가 비어 있습니다 → [02. Firebase 설정](02-firebase-setup.md) |

## 처음 켰을 때의 기본 상태

* AI·날씨는 **mock(가짜 응답)** 모드입니다. 실제 AI 없이도 모든 화면을 끝까지 시험할 수 있습니다.
* 실제 AI(Gemini)를 쓰려면 → [03. 실제 AI(real) 모드](03-real-ai-mode.md)
* 테스트 버튼 모음 화면 `#/dev` 사용법 → [04. 개발·테스트 도구](04-dev-tools.md)
