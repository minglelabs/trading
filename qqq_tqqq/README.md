# qqq_tqqq

QQQ, TQQQ 장기 데이터 비교용 작업 폴더입니다.

## 파일

- `refresh_data.py`: `Stooq`에서 QQQ, TQQQ 장기 데이터를 받아 `chart-data.js` 생성
- `chart-data.js`: 브라우저에서 바로 읽는 정적 데이터 파일
- `app.js`: TradingView Lightweight Charts 기반 비교 로직
- `index.html`: 로컬에서 바로 여는 차트 페이지

## 사용 방법

데이터 갱신:

```bash
cd /Users/nam/trading/qqq_tqqq
python refresh_data.py
```

차트 열기:

```bash
open /Users/nam/trading/qqq_tqqq/index.html
```

## 동작 방식

- 상단 차트는 전체 히스토리 네비게이터입니다.
- 상단 차트를 좌우로 드래그하면 기준 시점이 바뀝니다.
- 하단은 선택한 기간(`1M`, `3M`, `6M`, `1Y`, `5Y`)의 trailing 수익률 비교 차트입니다.
- `TQQQ`는 2010년 상장이라 그 이전 구간은 `N/A`가 나올 수 있습니다.
