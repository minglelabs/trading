# qqq_tqqq

`Next.js + React + TypeScript + Tailwind CSS + shadcn/ui` 기반의 QQQ/TQQQ 비교 차트 앱입니다.

## 기술 스택

- `Next.js 16`
- `React 19`
- `TypeScript`
- `Tailwind CSS 4`
- `shadcn/ui`
- `TradingView Lightweight Charts`

## 설치

```bash
cd /Users/nam/trading/qqq_tqqq
npm install
```

## 실행

개발 서버:

```bash
cd /Users/nam/trading/qqq_tqqq
npm run dev
```

프로덕션 빌드 확인:

```bash
cd /Users/nam/trading/qqq_tqqq
npm run build
```

## 데이터 갱신

```bash
cd /Users/nam/trading/qqq_tqqq
npm run refresh:data
```

이 명령은 `Stooq`에서 장기 일봉 데이터를 받아 `public/chart-data.json`을 다시 생성합니다.

## 동작 방식

- 상단 `전체 히스토리 차트`는 `TQQQ` 상장일 이후만 보여주며, 그 날짜 종가를 `QQQ/TQQQ` 모두 `100`으로 맞춘 상대지수입니다.
- 상단 차트를 좌우로 드래그하면 기준 시점이 바뀝니다.
- 하단은 선택한 기간(`1M`, `3M`, `6M`, `1Y`, `5Y`)의 trailing 수익률 비교 차트입니다.
- 우측 토글로 네비게이터를 `로그 스케일 / 선형 스케일`로 전환할 수 있습니다.
- 상단 차트 안에는 `QQQ`/`TQQQ` 범례가 같이 표시됩니다.
