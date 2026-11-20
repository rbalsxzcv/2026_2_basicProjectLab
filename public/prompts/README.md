# 프롬프트 템플릿 관리 규칙

AI에게 보내는 글(프롬프트)은 코드에 직접 쓰지 않고 이 폴더의 텍스트 파일로 관리합니다.
팀 결정: **"좋은 출력이 나온 프롬프트는 템플릿으로 남긴다."**

## 파일 이름

* `<이름>.v<번호>.txt` — 예: `diagnose.v1.txt`, `diagnose.v2.txt`
* 지금 쓰는 버전은 `public/js/core/ai-config.js` 의 `PROMPT_VERSION` 값입니다. (현재 `v1`)
* `{speciesName}` 처럼 중괄호로 감싼 영문 이름은 변수입니다. `ai/prompts.js` 가 실제 값으로 바꿉니다.
  * 값이 객체·배열이면 JSON 글자로, 비어 있으면 `정보 없음` 으로 들어갑니다.

| 템플릿 | 쓰는 함수 (`core/ai.js`) | 변수 |
| :--- | :--- | :--- |
| `character` | `generateCharacter` | speciesName |
| `diagnose` | `diagnose` | speciesName |
| `advice` | `advise` | speciesName, symptoms, userAnswer, recentHistory |
| `environment` | `analyzeEnvironment` | speciesName, profile, measuredLux, weather, homeType, windowDir, heaterOrAcExposed |
| `checklist` | `suggestChecklist` | speciesName, profile, weather, latestEnvironment, dueSchedules, recentHistory |
| `monthly-report` | `writeMonthlyReport` | speciesName, daysSincePurchase, lifespan, stats, monthlyHistory, previousReport |
| `species` | `generateSpecies` | speciesName (사용자가 입력한 식물 이름) |

## 실험실 사용법

`#/prompt-lab` 은 로그인 후 여는 개발 전용 화면입니다. 템플릿, 입력 샘플, 버전(`v1` 또는 `v1,v2`), 반복 횟수를 고르고 실행합니다. `character` 와 `diagnose` 는 사진 파일도 선택해야 합니다. 각 결과 카드에서 걸린 시간, 원본 응답, `checkShape` 검사 결과, 채워진 프롬프트를 볼 수 있습니다. 비교할 버전을 입력하면 버전별 결과가 나란히 표시되고, 내려받기 버튼은 현재 결과 전체를 JSON 파일로 저장합니다.

실행 전에 같은 입력과 같은 사진을 쓰고, 반복 횟수도 맞춰 주세요. normalize 검사는 키와 배열 모양을 확인할 뿐, 안내 내용이 안전하고 적절한지는 사람이 읽고 판단해야 합니다. mock 모드는 템플릿 본문을 사용하지 않고 고정된 mock 응답을 돌려주므로 화면·검사 흐름만 확인할 수 있습니다. 프롬프트 문구의 품질 비교는 Firebase AI Logic 설정 후 real 모드에서 진행하세요.

## 개선하는 순서

1. 지금 버전을 복사해 새 버전을 만듭니다. (`advice.v1.txt` → `advice.v2.txt`)
2. 같은 입력과 사진, 같은 반복 횟수로 v1 과 v2 의 출력을 비교합니다. (P2 프롬프트 실험실 `#/prompt-lab`)
3. 키·배열 모양 검사와 안내 내용의 안전성·구체성을 함께 확인합니다. 특히 흙이 축축하다고 답했을 때 물주기를 권하지 않는지 살펴봅니다.
4. 더 좋으면 아래 기록 표에 적고, 팀에 알린 뒤 채택합니다.
   (채택 = `PROMPT_VERSION` 을 올리거나, 템플릿별 버전 관리가 필요하면 P2에서 방식 제안)

비교 결과에서 위험하거나 어색한 안내가 발견되면 개선점을 표에 남기고 새 버전에서 다시 확인합니다. 결과 JSON 다운로드 파일에는 입력·프롬프트가 포함될 수 있으므로 사진이나 민감한 정보를 넣지 마세요.

## 기록 표

| 날짜 | 템플릿 | 버전 | 바꾼 점 | 좋았던 출력 예시(요약) | 채택 여부 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 2026-11-12 | 전체 | v1 | 최초 작성 (C2) | — | 채택 |
| 2026-11-17 | advice | v2 (후보) | 젖은 흙일 때 물주기 금지, 두 행동 가이드와 짧은 상태 태그를 분명히 함 | mock 응답은 고정이므로 real 모드 비교 전 | 미채택 · 검토 중 |
| 2026-11-18 | species | v1 | 최초 작성 (AI 식물 종류 추가) | — | 채택 |

## 담당 (공통 동결 후 문구 수정 권한)

| 템플릿 | 담당 |
| :--- | :--- |
| `diagnose`, `advice` | P1 (B) |
| `checklist` | P3 (C) |
| `environment`, `monthly-report` | P5 / P6 (D) |
| `character` | A |
| `species` | A |
| 개선 절차 · 실험실 | P2 (B) |

## 꼭 지킬 것

* 담당자는 **문구(wording)** 는 자유롭게 바꿀 수 있습니다.
* 하지만 응답 JSON 의 **키 이름과 모양(00_MAIN §5.4)은 절대 바꾸지 않습니다.** 바뀌면 화면이 깨집니다.
* 겁주거나 죄책감을 주는 표현(죽음, 시듦, 실패, 경고, 벌점 등)은 쓰지 않습니다.
* 체크리스트 프롬프트에는 물주기·비료·분갈이·잎 닦기를 넣지 않습니다. (과습 방지 — 정기 관리는 일정에서만)
