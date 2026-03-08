# ticker_comparison

`QQQ / TQQQ`를 기본값으로 보여주고, 원하는 두 개의 미국 티커를 직접 검색해서 비교할 수 있는 웹 앱입니다.

개발을 잘 모르셔도 `Codex`에게 실행을 맡기면 로컬 서버를 띄워서 바로 써볼 수 있게 문서를 정리했습니다.

## 이 앱에서 할 수 있는 일

- 기본 비교: `QQQ`와 `TQQQ`의 전체 히스토리를 바로 확인
- 사용자 비교: 원하는 두 개의 티커를 입력해서 즉시 비교
- 기준일 이동: 상단 차트를 드래그해서 비교 기준일 변경
- 수익률 비교: `1M`, `3M`, `6M`, `1Y`, `5Y` 구간의 과거/미래 수익률 비교
- 축 전환: `log scale` / `linear scale` 전환

## 실행 전에 필요한 것

필수:

- `Node.js` LTS
- `npm`
- 인터넷 연결

선택:

- `Python 3`
- `pandas`

`Python 3`와 `pandas`는 앱 실행 자체에는 필요하지 않습니다.
기본 데이터 파일인 [`public/chart-data.json`](public/chart-data.json)을 다시 만들 때만 필요합니다.

## 가장 쉬운 방법: Codex에게 실행 맡기기

Windows든 macOS든, 저장소를 Codex에서 연 뒤 아래 프롬프트를 그대로 보내시면 됩니다.

```text
이 저장소의 ticker_comparison 프로젝트를 실행해주세요.
필요한 의존성을 설치하고, 개발 서버를 띄운 뒤, 접속 가능한 로컬 주소를 알려주세요.
실행이 안 되면 원인을 직접 고쳐서 다시 실행해주세요.
```

보통 Codex는 아래 순서로 처리합니다.

1. `ticker_comparison` 폴더로 이동
2. `npm install`
3. `npm run dev`
4. 접속 주소 안내

실행 후 브라우저에서 아래처럼 접속합니다.

- 기본적으로 `http://localhost:3000`
- 이미 다른 프로그램이 `3000` 포트를 사용 중이면 `3001`, `3002` 등으로 자동 변경될 수 있음

서버를 끄려면 서버가 실행 중인 터미널에서 `Ctrl + C`를 누르시면 됩니다.

## 직접 실행하는 방법

### 1. 프로젝트 폴더로 이동

macOS / Linux:

```bash
cd /path/to/trading/ticker_comparison
```

Windows PowerShell:

```powershell
cd C:\path\to\trading\ticker_comparison
```

### 2. 의존성 설치

```bash
npm install
```

### 3. 개발 서버 실행

```bash
npm run dev
```

터미널에 로컬 접속 주소가 출력됩니다. 보통은 아래 둘 중 하나입니다.

- `http://localhost:3000`
- `http://localhost:3001`

### 4. 브라우저에서 사용

1. 출력된 주소를 브라우저에 엽니다.
2. 첫 화면에서는 기본 비교값인 `QQQ / TQQQ`가 보입니다.
3. 상단 검색 UI에서 두 개의 티커를 입력합니다.
4. 다른 티커 조합은 서버가 실행 중일 때 실시간으로 불러옵니다.

## 자주 쓰는 명령어

### 개발 서버 실행

```bash
npm run dev
```

### 프로덕션 빌드 검증

```bash
npm run build
```

이 명령은 배포 전에 앱이 정상 빌드되는지 확인할 때 사용합니다.

### 프로덕션 서버 실행

```bash
npm run build
npm run start
```

### 기본 데이터 다시 만들기

```bash
npm run refresh:data
```

이 명령은 `Stooq`에서 장기 일봉 데이터를 받아서
[`public/chart-data.json`](public/chart-data.json)을 다시 생성합니다.

주의할 점:

- 이 기본 데이터 파일은 `QQQ / TQQQ`만 포함합니다.
- 다른 티커 조합은 앱 사용 중에 서버가 외부 데이터를 실시간으로 가져옵니다.
- `npm run refresh:data`는 `python` 명령이 `Python 3`를 가리킨다고 가정합니다.

## 데이터 갱신이 필요할 때

`npm run refresh:data`가 바로 동작하면 그대로 쓰시면 됩니다.

만약 `python` 또는 `pandas` 관련 오류가 나면 아래처럼 처리하시면 됩니다.

### macOS / Linux

```bash
python3 -m pip install pandas
python3 refresh_data.py
```

### Windows PowerShell

```powershell
py -3 -m pip install pandas
py -3 refresh_data.py
```

## 앱 동작 방식

- 첫 화면은 로컬 파일에 저장된 기본 데이터(`QQQ / TQQQ`)로 바로 렌더링됩니다.
- 새 티커 두 개를 검색하면 `/api/history`가 해당 쌍만 실시간으로 불러옵니다.
- 검색 제안은 `/api/symbol-search`가 외부 심볼 목록을 조회해서 보여줍니다.
- 검색 제안은 보통 2글자 이상 입력했을 때부터 의미 있게 동작합니다.
- 같은 티커를 두 번 넣으면 비교가 아니라서 오류 메시지가 납니다.
- 잘못된 형식의 티커를 넣어도 오류가 납니다.

## 공유 가능한 주소 형식

이 앱은 URL 파라미터로도 티커를 지정할 수 있습니다.

예:

```text
http://localhost:3000/?primary=MSFT&comparison=AAPL
```

포트가 `3001`로 실행됐다면 주소도 `3001`로 바꾸시면 됩니다.

## 외부 네트워크 의존성

이 프로젝트는 별도 `.env` 파일 없이 실행됩니다.
대신 서버가 실행 중일 때 아래 외부 서비스에 접근할 수 있어야 합니다.

- `stooq.com`
- `api.nasdaq.com`

아래 상황에서는 외부 네트워크가 특히 중요합니다.

- 새 티커 조합의 가격 히스토리 조회
- 티커 자동완성 목록 조회
- 기본 데이터 파일 재생성

## 문제 해결

### `npm install`이 실패합니다

- `Node.js`가 설치되어 있는지 먼저 확인합니다.
- 터미널을 완전히 닫았다가 다시 열고 재시도합니다.
- 그래도 안 되면 Codex에게 아래처럼 요청하시면 됩니다.

```text
ticker_comparison의 npm install 오류를 해결하고 다시 설치해주세요.
```

### `npm run dev`를 했는데 `3000` 포트를 못 씁니다

정상입니다. 이미 다른 프로그램이 `3000`을 쓰고 있으면 Next.js가 `3001` 같은 다른 포트를 자동 사용합니다.
터미널에 출력된 실제 주소로 접속하시면 됩니다.

### `.next/dev/lock` 관련 오류가 납니다

보통 같은 프로젝트의 개발 서버가 이미 하나 더 실행 중일 때 발생합니다.

1. 기존 `npm run dev` 터미널이 열려 있는지 확인합니다.
2. 이미 실행 중인 서버를 계속 쓸 거면 새 서버를 띄우지 않습니다.
3. 실행 중인 서버가 없는데도 계속 나오면 `.next` 폴더를 지우고 다시 `npm run dev`를 실행합니다.

### 페이지는 열리는데 검색 결과가 안 나옵니다

외부 네트워크 접근 문제일 가능성이 큽니다.
`stooq.com` 또는 `api.nasdaq.com` 접속이 막혀 있지 않은지 확인해 주세요.

### `npm run refresh:data`에서 `pandas` 오류가 납니다

아래 둘 중 본인 환경에 맞는 명령으로 설치하시면 됩니다.

macOS / Linux:

```bash
python3 -m pip install pandas
```

Windows PowerShell:

```powershell
py -3 -m pip install pandas
```

## Codex에게 추가로 시킬 수 있는 예시

- `ticker_comparison을 실행하고 현재 접속 주소를 알려주세요.`
- `build가 통과하는지 확인해주세요.`
- `기본 데이터를 새로 받아서 chart-data.json을 갱신해주세요.`
- `MSFT와 AAPL이 바로 열리도록 URL 예시를 알려주세요.`

## 검증된 기본 절차

이 레포에서는 아래 명령이 실제로 확인되었습니다.

```bash
npm install
npm run build
```
