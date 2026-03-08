# trading

시장 데이터와 차트 실험용 프로젝트들을 모아둔 작업용 레포입니다.

이 레포는 루트에서 한 번에 실행하는 구조가 아니라, 각 하위 폴더가 독립적으로 동작합니다.
처음 써보시는 분은 `ticker_comparison`부터 시작하시는 것이 가장 쉽습니다.

## 가장 먼저 읽으실 내용

- 전체 안내: 이 문서
- 실제 실행 가이드: [`ticker_comparison/README.md`](ticker_comparison/README.md)

## 이 레포에서 무엇을 할 수 있나요?

| 폴더 | 설명 | 추천 대상 |
| --- | --- | --- |
| `ticker_comparison` | 두 개의 미국 티커를 비교하는 웹 앱입니다. 기본값은 `QQQ / TQQQ`입니다. | 처음 실행해보는 분 |
| `fear_greed` | Fear & Greed 관련 데이터/시각화 작업입니다. | 별도 분석 작업이 필요한 분 |
| `qqq_tqqq` | 실험성 자산 비교 작업 폴더입니다. | 내부 참고용 |

## 초심자용 빠른 시작

`ticker_comparison`을 실행하는 것이 가장 간단합니다.

1. 이 저장소 폴더를 준비합니다.
   - `git clone`으로 내려받아도 되고, 압축 파일을 풀어도 됩니다.
2. Codex에서 이 레포 폴더를 엽니다.
3. Codex에게 아래 문장을 그대로 보내면 됩니다.

```text
이 저장소의 ticker_comparison 프로젝트를 실행해주세요.
필요한 의존성을 설치하고, 개발 서버를 띄운 뒤, 접속 주소를 알려주세요.
문제가 있으면 직접 고쳐서 다시 실행해주세요.
```

4. Codex가 보통 아래 작업을 대신 해줍니다.
   - `ticker_comparison` 폴더로 이동
   - `npm install`
   - `npm run dev`
   - 실행된 주소 안내
5. 브라우저에서 안내받은 주소를 엽니다.
   - 보통 `http://localhost:3000`
   - 이미 다른 앱이 `3000`을 쓰고 있으면 `3001`, `3002`처럼 바뀔 수 있습니다.

## 직접 실행하고 싶다면

이 레포 루트에는 공용 `package.json`이 없습니다. 실행하려는 프로젝트 폴더로 먼저 들어가셔야 합니다.

### macOS / Linux

```bash
cd /path/to/trading/ticker_comparison
npm install
npm run dev
```

### Windows PowerShell

```powershell
cd C:\path\to\trading\ticker_comparison
npm install
npm run dev
```

실행이 끝나면 터미널에 로컬 주소가 출력됩니다.

## 권장 준비물

- `Node.js` LTS 버전
- `npm` (`Node.js` 설치 시 함께 설치됩니다)
- 인터넷 연결
- 선택 사항: `Python 3`
  - `ticker_comparison`의 기본 데이터 파일을 다시 만들 때만 필요합니다.

## 루트에서 자주 헷갈리는 점

- 루트에서 바로 `npm install`을 실행하는 구조가 아닙니다.
- 먼저 프로젝트 폴더로 이동해야 합니다.
- 가장 먼저 실행해볼 프로젝트는 `ticker_comparison`입니다.
- 더 자세한 사용법, 데이터 갱신 방법, 문제 해결은 [`ticker_comparison/README.md`](ticker_comparison/README.md)에 정리되어 있습니다.
