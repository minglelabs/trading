# ticker_comparison

A two-ticker comparison app built with `Next.js + React + TypeScript + Tailwind CSS + shadcn/ui`. The default pair is `QQQ / TQQQ`.

## Tech Stack

- `Next.js 16`
- `React 19`
- `TypeScript`
- `Tailwind CSS 4`
- `shadcn/ui`
- `TradingView Lightweight Charts`

## Install

```bash
cd /Users/nam/trading/ticker_comparison
npm install
```

## Run

Development server:

```bash
cd /Users/nam/trading/ticker_comparison
npm run dev
```

Production build check:

```bash
cd /Users/nam/trading/ticker_comparison
npm run build
```

## Refresh Data

```bash
cd /Users/nam/trading/ticker_comparison
npm run refresh:data
```

This command downloads long-range daily data from `Stooq` and recreates `public/chart-data.json`.

The default local file only contains `QQQ/TQQQ`. Other ticker pairs are fetched on demand from the app header search.

## Behavior

- When you enter two tickers in the header search, the app fetches only that pair instead of preloading every symbol.
- The top `Full History Chart` starts at the second ticker's first available date and normalizes both tickers to `100` on that date.
- Dragging the top chart updates the anchor date used by the comparison sections below.
- The lower sections show trailing return comparison and forward return comparison for the selected window (`1M`, `3M`, `6M`, `1Y`, `5Y`).
- Forward comparison uses the future window after the anchor date and falls back to the last available date if the full period does not exist.
- The toggle on the right switches the navigator between `log scale` and `linear scale`.
- The current ticker pair is shown directly on the chart legends.
