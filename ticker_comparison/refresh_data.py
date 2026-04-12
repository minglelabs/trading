#!/usr/bin/env python

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent
OUTPUT_PATH = ROOT / "public" / "chart-data.json"
TICKERS = ("QQQ", "TQQQ")
YAHOO_CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"
REQUEST_HEADERS = {
    "User-Agent": "Mozilla/5.0 ticker-comparison/1.0",
}


def fetch_history(ticker: str) -> dict[str, object]:
    params = urlencode(
        {
            "period1": 0,
            "period2": int(datetime.now(timezone.utc).timestamp()) + 86400,
            "interval": "1d",
            "includeAdjustedClose": "true",
        }
    )
    request = Request(
        f"{YAHOO_CHART_URL.format(symbol=ticker)}?{params}",
        headers=REQUEST_HEADERS,
    )

    with urlopen(request) as response:
        payload = json.load(response)

    chart = payload.get("chart") or {}
    error = chart.get("error")
    if error:
        message = error.get("description") or error.get("code") or "unknown error"
        raise RuntimeError(f"{ticker} data download failed: {message}")

    result = (chart.get("result") or [None])[0]
    if not result:
        raise RuntimeError(f"{ticker} data download returned no rows")

    timestamps = result.get("timestamp") or []
    indicators = result.get("indicators") or {}
    adjusted_close_sets = indicators.get("adjclose") or []
    adjusted_closes = (
        adjusted_close_sets[0].get("adjclose")
        if adjusted_close_sets and adjusted_close_sets[0]
        else []
    )

    if not timestamps or not adjusted_closes:
        raise RuntimeError(f"{ticker} data download returned no rows")

    rows: list[list[object]] = []
    for timestamp, close in zip(timestamps, adjusted_closes):
        if close is None:
            continue

        date_key = datetime.fromtimestamp(timestamp, tz=timezone.utc).strftime(
            "%Y-%m-%d"
        )
        rows.append([date_key, round(float(close), 6)])

    if not rows:
        raise RuntimeError(
            f"{ticker} data download returned no valid adjusted close rows"
        )

    return {
        "rows": rows,
        "firstDate": rows[0][0],
        "lastDate": rows[-1][0],
        "points": len(rows),
    }


def main() -> None:
    tickers = {ticker: fetch_history(ticker) for ticker in TICKERS}
    payload = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "source": "yahoo-finance",
        "symbols": {
            "QQQ": "QQQ",
            "TQQQ": "TQQQ",
        },
        "tickers": tickers,
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(
        json.dumps(payload, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )

    print(f"Wrote {OUTPUT_PATH}")
    for ticker, meta in tickers.items():
        print(
            f"{ticker}: {meta['points']} rows "
            f"({meta['firstDate']} -> {meta['lastDate']})"
        )


if __name__ == "__main__":
    main()
