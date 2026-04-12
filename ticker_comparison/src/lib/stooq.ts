import { ChartPayload, TickerPayload, withDefaultSymbols } from "@/lib/chart-data";

const YAHOO_CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart/";
const NASDAQ_STOCK_SCREENER_URL =
  "https://api.nasdaq.com/api/screener/stocks?download=true";
const NASDAQ_ETF_SCREENER_URL =
  "https://api.nasdaq.com/api/screener/etf?download=true";
const TICKER_PATTERN = /^[A-Za-z][A-Za-z0-9.-]{0,14}$/;
export const MIN_TICKER_SUGGESTION_QUERY_LENGTH = 2;
const SUGGESTION_CACHE_TTL_MS = 5 * 60 * 1000;
const SUGGESTION_UNIVERSE_CACHE_TTL_MS = 60 * 60 * 1000;
const suggestionCache = new Map<
  string,
  { fetchedAt: number; groups: TickerSuggestionGroups }
>();
let suggestionUniverseCache:
  | { fetchedAt: number; items: TickerSuggestion[] }
  | null = null;

const NASDAQ_HEADERS = {
  "user-agent": "Mozilla/5.0 ticker-comparison/1.0",
  accept: "application/json",
  origin: "https://www.nasdaq.com",
  referer: "https://www.nasdaq.com/",
};
const YAHOO_HEADERS = {
  "user-agent": "Mozilla/5.0 ticker-comparison/1.0",
  accept: "application/json",
};

export interface TickerSuggestion {
  symbol: string;
  name: string;
  exchange: string;
  asset: string;
}

export interface TickerSuggestionGroups {
  startsWith: TickerSuggestion[];
  contains: TickerSuggestion[];
}

interface YahooChartResponse {
  chart?: {
    result?: Array<{
      timestamp?: number[];
      indicators?: {
        adjclose?: Array<{
          adjclose?: Array<number | null>;
        }>;
      };
    }>;
    error?: {
      code?: string;
      description?: string;
    } | null;
  };
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
    source: "yahoo-finance",
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
): Promise<TickerSuggestionGroups> {
  const normalized = query.trim().toUpperCase();
  if (normalized.length < MIN_TICKER_SUGGESTION_QUERY_LENGTH) {
    return {
      startsWith: [],
      contains: [],
    };
  }

  const cached = suggestionCache.get(normalized);
  if (cached && Date.now() - cached.fetchedAt < SUGGESTION_CACHE_TTL_MS) {
    return cached.groups;
  }

  const items = await fetchTickerSuggestionUniverse();
  const startsWith = items
    .filter((item) => item.symbol.startsWith(normalized))
    .sort((left, right) => comparePrefixSuggestions(left, right, normalized));
  const contains = items
    .filter(
      (item) =>
        !item.symbol.startsWith(normalized) && item.symbol.includes(normalized)
    )
    .sort((left, right) => compareContainsSuggestions(left, right, normalized));

  const groups = {
    startsWith,
    contains,
  };

  suggestionCache.set(normalized, {
    fetchedAt: Date.now(),
    groups,
  });

  return groups;
}

async function fetchHistory(ticker: string): Promise<TickerPayload> {
  const url = new URL(`${YAHOO_CHART_URL}${ticker}`);
  url.searchParams.set("period1", "0");
  url.searchParams.set(
    "period2",
    String(Math.floor(Date.now() / 1000) + 24 * 60 * 60)
  );
  url.searchParams.set("interval", "1d");
  url.searchParams.set("includeAdjustedClose", "true");

  const response = await fetch(url, {
    cache: "no-store",
    headers: YAHOO_HEADERS,
  });
  const payload = (await response.json()) as YahooChartResponse;
  const chartError = payload.chart?.error;

  if (!response.ok || chartError) {
    const message =
      chartError?.description ||
      chartError?.code ||
      `${ticker} 데이터를 가져오지 못했습니다.`;
    throw new Error(message);
  }

  const rows = parseYahooRows(payload);

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

function parseYahooRows(payload: YahooChartResponse): Array<[string, number]> {
  const result = payload.chart?.result?.[0];
  const timestamps = result?.timestamp ?? [];
  const adjustedCloses = result?.indicators?.adjclose?.[0]?.adjclose ?? [];

  if (timestamps.length === 0 || adjustedCloses.length === 0) {
    return [];
  }

  const rows: Array<[string, number]> = [];
  for (let index = 0; index < timestamps.length; index += 1) {
    const timestamp = timestamps[index];
    const close = adjustedCloses[index];

    if (typeof timestamp !== "number" || typeof close !== "number") {
      continue;
    }

    const date = new Date(timestamp * 1000).toISOString().slice(0, 10);
    rows.push([date, Number(close.toFixed(6))]);
  }

  return rows;
}

async function fetchTickerSuggestionUniverse(): Promise<TickerSuggestion[]> {
  if (
    suggestionUniverseCache &&
    Date.now() - suggestionUniverseCache.fetchedAt <
      SUGGESTION_UNIVERSE_CACHE_TTL_MS
  ) {
    return suggestionUniverseCache.items;
  }

  const [stocks, etfs] = await Promise.all([
    fetchNasdaqStockSuggestions(),
    fetchNasdaqEtfSuggestions(),
  ]);
  const deduped = new Map<string, TickerSuggestion>();

  for (const item of [...stocks, ...etfs]) {
    if (!deduped.has(item.symbol)) {
      deduped.set(item.symbol, item);
    }
  }

  const items = [...deduped.values()].sort((left, right) =>
    left.symbol.localeCompare(right.symbol)
  );
  suggestionUniverseCache = {
    fetchedAt: Date.now(),
    items,
  };

  return items;
}

async function fetchNasdaqStockSuggestions(): Promise<TickerSuggestion[]> {
  const response = await fetch(NASDAQ_STOCK_SCREENER_URL, {
    cache: "no-store",
    headers: NASDAQ_HEADERS,
  });

  if (!response.ok) {
    throw new Error("Ticker suggestions are unavailable right now.");
  }

  const payload = (await response.json()) as {
    data?: {
      rows?: Array<{
        symbol?: string;
        name?: string;
      }>;
    };
  };

  return (payload.data?.rows ?? [])
    .filter((item) => typeof item.symbol === "string" && item.symbol.length > 0)
    .map((item) => ({
      symbol: item.symbol!.toUpperCase(),
      name: item.name?.trim() || "-",
      exchange: "Stock",
      asset: "Stock",
    }));
}

async function fetchNasdaqEtfSuggestions(): Promise<TickerSuggestion[]> {
  const response = await fetch(NASDAQ_ETF_SCREENER_URL, {
    cache: "no-store",
    headers: NASDAQ_HEADERS,
  });

  if (!response.ok) {
    throw new Error("Ticker suggestions are unavailable right now.");
  }

  const payload = (await response.json()) as {
    data?: {
      data?: {
        rows?: Array<{
          symbol?: string;
          companyName?: string;
        }>;
      };
    };
  };

  return (payload.data?.data?.rows ?? [])
    .filter((item) => typeof item.symbol === "string" && item.symbol.length > 0)
    .map((item) => ({
      symbol: item.symbol!.toUpperCase(),
      name: item.companyName?.trim() || "-",
      exchange: "ETF",
      asset: "ETF",
    }));
}

function comparePrefixSuggestions(
  left: TickerSuggestion,
  right: TickerSuggestion,
  query: string
): number {
  if (left.symbol === query && right.symbol !== query) {
    return -1;
  }
  if (right.symbol === query && left.symbol !== query) {
    return 1;
  }
  if (left.symbol.length !== right.symbol.length) {
    return left.symbol.length - right.symbol.length;
  }
  return left.symbol.localeCompare(right.symbol);
}

function compareContainsSuggestions(
  left: TickerSuggestion,
  right: TickerSuggestion,
  query: string
): number {
  const leftIndex = left.symbol.indexOf(query);
  const rightIndex = right.symbol.indexOf(query);

  if (leftIndex !== rightIndex) {
    return leftIndex - rightIndex;
  }
  if (left.symbol.length !== right.symbol.length) {
    return left.symbol.length - right.symbol.length;
  }
  return left.symbol.localeCompare(right.symbol);
}
