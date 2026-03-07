import { ChartPayload, TickerPayload, withDefaultSymbols } from "@/lib/chart-data";

const STOOQ_URL = "https://stooq.com/q/d/l/";
const NASDAQ_SEARCH_URL = "https://api.nasdaq.com/api/autocomplete/slookup/10";
const TICKER_PATTERN = /^[A-Za-z][A-Za-z0-9.-]{0,14}$/;
const SUGGESTION_CACHE_TTL_MS = 5 * 60 * 1000;
const suggestionCache = new Map<
  string,
  { fetchedAt: number; items: TickerSuggestion[] }
>();

export interface TickerSuggestion {
  symbol: string;
  name: string;
  exchange: string;
  asset: string;
}

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

export async function fetchTickerSuggestions(
  query: string
): Promise<TickerSuggestion[]> {
  const normalized = query.trim().toUpperCase();
  if (!normalized) {
    return [];
  }

  const cached = suggestionCache.get(normalized);
  if (cached && Date.now() - cached.fetchedAt < SUGGESTION_CACHE_TTL_MS) {
    return cached.items;
  }

  const url = new URL(NASDAQ_SEARCH_URL);
  url.searchParams.set("search", normalized);

  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      "user-agent": "Mozilla/5.0 ticker-comparison/1.0",
      accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Ticker suggestions are unavailable right now.");
  }

  const payload = (await response.json()) as {
    data?: Array<{
      symbol?: string;
      name?: string;
      exchange?: string;
      asset?: string;
    }>;
  };

  const items = (payload.data ?? [])
    .filter((item) => typeof item.symbol === "string" && item.symbol.length > 0)
    .map((item) => ({
      symbol: item.symbol!.toUpperCase(),
      name: item.name?.trim() || "-",
      exchange: item.exchange?.trim() || "-",
      asset: item.asset?.trim() || "-",
    }))
    .filter((item) => item.symbol.includes(normalized))
    .slice(0, 8);

  suggestionCache.set(normalized, {
    fetchedAt: Date.now(),
    items,
  });

  return items;
}

async function fetchHistory(ticker: string): Promise<TickerPayload> {
  const url = new URL(STOOQ_URL);
  url.searchParams.set("s", `${ticker.toLowerCase()}.us`);
  url.searchParams.set("i", "d");

  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      "user-agent": "ticker-comparison/1.0",
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
