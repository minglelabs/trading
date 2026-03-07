import { ChartPayload, TickerPayload, withDefaultSymbols } from "@/lib/chart-data";

const STOOQ_URL = "https://stooq.com/q/d/l/";
const TICKER_PATTERN = /^[A-Za-z][A-Za-z0-9.-]{0,14}$/;

export function normalizeTickerInput(value: string): string | null {
  const normalized = value.trim().toUpperCase();
  if (!normalized || !TICKER_PATTERN.test(normalized)) {
    return null;
  }
  return normalized;
}

export async function fetchPairHistory(
  primarySymbol: string,
  comparisonSymbol: string
): Promise<ChartPayload> {
  const [primary, comparison] = await Promise.all([
    fetchHistory(primarySymbol),
    fetchHistory(comparisonSymbol),
  ]);

  return withDefaultSymbols({
    generatedAt: new Date().toISOString(),
    source: "stooq",
    symbols: {
      QQQ: primarySymbol,
      TQQQ: comparisonSymbol,
    },
    tickers: {
      QQQ: primary,
      TQQQ: comparison,
    },
  });
}

async function fetchHistory(ticker: string): Promise<TickerPayload> {
  const url = new URL(STOOQ_URL);
  url.searchParams.set("s", `${ticker.toLowerCase()}.us`);
  url.searchParams.set("i", "d");

  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      "user-agent": "qqq-tqqq-comparison/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`${ticker} 데이터를 가져오지 못했습니다.`);
  }

  const rawCsv = await response.text();
  const rows = parseStooqCsv(rawCsv);

  if (rows.length === 0) {
    throw new Error(`${ticker} 데이터가 비어 있습니다.`);
  }

  return {
    rows,
    firstDate: rows[0][0],
    lastDate: rows[rows.length - 1][0],
    points: rows.length,
  };
}

function parseStooqCsv(rawCsv: string): Array<[string, number]> {
  const [headerLine, ...dataLines] = rawCsv
    .trim()
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/);

  if (!headerLine) {
    return [];
  }

  const headers = headerLine.split(",");
  const dateIndex = headers.indexOf("Date");
  const closeIndex = headers.indexOf("Close");

  if (dateIndex < 0 || closeIndex < 0) {
    return [];
  }

  const rows: Array<[string, number]> = [];
  for (const line of dataLines) {
    if (!line.trim()) {
      continue;
    }

    const columns = line.split(",");
    const date = columns[dateIndex]?.trim();
    const closeValue = columns[closeIndex]?.trim();

    if (!date || !closeValue || closeValue.toLowerCase() === "nan") {
      continue;
    }

    const close = Number(closeValue);
    if (!Number.isFinite(close)) {
      continue;
    }

    rows.push([date, Number(close.toFixed(6))]);
  }

  return rows;
}
