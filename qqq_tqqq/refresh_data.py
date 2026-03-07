#!/usr/bin/env python

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import urlopen

import pandas as pd

ROOT = Path(__file__).resolve().parent
OUTPUT_PATH = ROOT / "public" / "chart-data.json"
TICKERS = ("QQQ", "TQQQ")
STOOQ_URL = "https://stooq.com/q/d/l/?s={symbol}.us&i=d"


def fetch_history(ticker: str) -> dict[str, object]:
    with urlopen(STOOQ_URL.format(symbol=ticker.lower())) as response:
        history = pd.read_csv(response)

    if history.empty:
        raise RuntimeError(f"{ticker} data download returned no rows")

    history["Date"] = pd.to_datetime(history["Date"], utc=True).dt.strftime("%Y-%m-%d")

    rows: list[list[object]] = []
    for row in history.itertuples(index=False):
        close = row.Close
        if close is None or pd.isna(close):
            continue
        rows.append([row.Date, round(float(close), 6)])

    if not rows:
        raise RuntimeError(f"{ticker} data download returned no valid adjusted close rows")

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
        "source": "stooq",
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
