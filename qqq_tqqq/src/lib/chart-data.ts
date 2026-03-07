export type TickerSymbol = "QQQ" | "TQQQ";
export type PeriodId = "1m" | "3m" | "6m" | "1y" | "5y";

export interface ChartPayload {
  generatedAt: string;
  source: string;
  symbols: Record<TickerSymbol, string>;
  tickers: Record<TickerSymbol, TickerPayload>;
}

export interface TickerPayload {
  rows: [string, number][];
  firstDate: string;
  lastDate: string;
  points: number;
}

export interface ChartRow {
  time: string;
  value: number;
}

export interface TickerSeries {
  rows: ChartRow[];
  firstDate: string;
  lastDate: string;
  points: number;
}

export interface Period {
  id: PeriodId;
  label: string;
  months: number;
}

export interface WindowSeries {
  start: string;
  end: string;
  returnPct: number;
  series: ChartRow[];
}

export const PERIODS: Period[] = [
  { id: "1m", label: "1M", months: 1 },
  { id: "3m", label: "3M", months: 3 },
  { id: "6m", label: "6M", months: 6 },
  { id: "1y", label: "1Y", months: 12 },
  { id: "5y", label: "5Y", months: 60 },
];

export const COLORS: Record<TickerSymbol, string> = {
  QQQ: "#0b6e4f",
  TQQQ: "#ba181b",
};

export const DEFAULT_SYMBOLS: Record<TickerSymbol, string> = {
  QQQ: "QQQ",
  TQQQ: "TQQQ",
};

export function withDefaultSymbols(
  payload: Omit<ChartPayload, "symbols"> & {
    symbols?: Partial<Record<TickerSymbol, string>>;
  }
): ChartPayload {
  return {
    ...payload,
    symbols: {
      QQQ: payload.symbols?.QQQ?.toUpperCase() || DEFAULT_SYMBOLS.QQQ,
      TQQQ: payload.symbols?.TQQQ?.toUpperCase() || DEFAULT_SYMBOLS.TQQQ,
    },
  };
}

export function buildTickerData(
  payload: ChartPayload
): Record<TickerSymbol, TickerSeries> {
  return Object.fromEntries(
    Object.entries(payload.tickers).map(([ticker, meta]) => [
      ticker,
      {
        ...meta,
        rows: meta.rows.map(([time, value]) => ({ time, value })),
      },
    ])
  ) as Record<TickerSymbol, TickerSeries>;
}

export function getLatestCommonDate(
  tickers: Record<TickerSymbol, TickerSeries>
): string {
  return minDate(
    tickers.QQQ.rows[tickers.QQQ.rows.length - 1].time,
    tickers.TQQQ.rows[tickers.TQQQ.rows.length - 1].time
  );
}

export function getOverlapAnchorDate(
  tickers: Record<TickerSymbol, TickerSeries>
): string {
  return tickers.TQQQ.rows[0].time;
}

export function normalizeAgainstDate(
  rows: ChartRow[],
  baseDate: string
): ChartRow[] {
  const baseIndex = findIndexOnOrBefore(rows, baseDate);
  if (baseIndex < 0) {
    return [];
  }

  const baseValue = rows[baseIndex].value;
  return rows.slice(baseIndex).map((row) => ({
    time: row.time,
    value: roundValue((row.value / baseValue) * 100),
  }));
}

export function buildWindowData(
  rows: ChartRow[],
  anchorDate: string,
  period: Period
): WindowSeries | null {
  const endIndex = findIndexOnOrBefore(rows, anchorDate);
  if (endIndex < 0) {
    return null;
  }

  const endDate = rows[endIndex].time;
  const startTarget = subtractMonthsKey(endDate, period.months);
  const startIndex = findIndexOnOrBefore(rows, startTarget);

  if (startIndex < 0 || startIndex >= endIndex) {
    return null;
  }

  const base = rows[startIndex].value;
  const series = rows.slice(startIndex, endIndex + 1).map((row) => ({
    time: row.time,
    value: roundValue((row.value / base) * 100),
  }));

  return {
    start: rows[startIndex].time,
    end: endDate,
    returnPct: ((rows[endIndex].value / base) - 1) * 100,
    series,
  };
}

export function calculateTrailingReturn(
  rows: ChartRow[],
  anchorDate: string,
  period: Period
): number | null {
  const window = buildWindowData(rows, anchorDate, period);
  return window ? window.returnPct : null;
}

export function buildForwardWindowData(
  rows: ChartRow[],
  anchorDate: string,
  period: Period
): WindowSeries | null {
  const startIndex = findIndexOnOrBefore(rows, anchorDate);
  if (startIndex < 0 || startIndex >= rows.length - 1) {
    return null;
  }

  const startDate = rows[startIndex].time;
  const endTarget = addMonthsKey(startDate, period.months);
  const endIndex = findIndexOnOrBefore(rows, endTarget);

  if (endIndex <= startIndex) {
    return null;
  }

  const base = rows[startIndex].value;
  const series = rows.slice(startIndex, endIndex + 1).map((row) => ({
    time: row.time,
    value: roundValue((row.value / base) * 100),
  }));

  return {
    start: startDate,
    end: rows[endIndex].time,
    returnPct: ((rows[endIndex].value / base) - 1) * 100,
    series,
  };
}

export function calculateForwardReturn(
  rows: ChartRow[],
  anchorDate: string,
  period: Period
): number | null {
  const window = buildForwardWindowData(rows, anchorDate, period);
  return window ? window.returnPct : null;
}

export function findNearestCommonDate(
  tickers: Record<TickerSymbol, TickerSeries>,
  targetDate: string
): string | null {
  const qqqIndex = findIndexOnOrBefore(tickers.QQQ.rows, targetDate);
  const tqqqIndex = findIndexOnOrBefore(tickers.TQQQ.rows, targetDate);

  if (qqqIndex < 0 && tqqqIndex < 0) {
    return null;
  }
  if (qqqIndex < 0) {
    return tickers.TQQQ.rows[tqqqIndex].time;
  }
  if (tqqqIndex < 0) {
    return tickers.QQQ.rows[qqqIndex].time;
  }

  return minDate(
    tickers.QQQ.rows[qqqIndex].time,
    tickers.TQQQ.rows[tqqqIndex].time
  );
}

export function findIndexOnOrBefore(rows: ChartRow[], targetDate: string): number {
  let left = 0;
  let right = rows.length - 1;
  let answer = -1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);

    if (rows[mid].time <= targetDate) {
      answer = mid;
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }

  return answer;
}

export function subtractMonthsKey(dateKey: string, monthsBack: number): string {
  return shiftMonthsKey(dateKey, -monthsBack);
}

export function addMonthsKey(dateKey: string, monthsForward: number): string {
  return shiftMonthsKey(dateKey, monthsForward);
}

function shiftMonthsKey(dateKey: string, monthDelta: number): string {
  const source = parseDateKey(dateKey);
  const totalMonths =
    source.getUTCFullYear() * 12 + source.getUTCMonth() + monthDelta;
  const year = Math.floor(totalMonths / 12);
  const month = totalMonths % 12;
  const lastDayOfMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = Math.min(source.getUTCDate(), lastDayOfMonth);
  return toDateKey(new Date(Date.UTC(year, month, day)));
}

export function parseDateKey(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00Z`);
}

export function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function timeToDateKey(
  time: string | number | { year: number; month: number; day: number }
): string {
  if (typeof time === "string") {
    return time;
  }

  if (typeof time === "number") {
    return toDateKey(new Date(time * 1000));
  }

  const year = String(time.year).padStart(4, "0");
  const month = String(time.month).padStart(2, "0");
  const day = String(time.day).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatDate(dateKey: string): string {
  const [year, month, day] = dateKey.split("-");
  return formatKoreanDateLabel(year, month, day);
}

export function formatDateTime(dateTime: string): string {
  const parsed = new Date(dateTime);
  if (Number.isNaN(parsed.getTime())) {
    return dateTime;
  }

  const { year, month, day, hour, minute } = getTimeZoneParts(
    parsed,
    "Asia/Seoul"
  );
  return `${formatKoreanDateLabel(year, month, day)} ${hour}:${minute}`;
}

export function formatPercent(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function minDate(a: string, b: string): string {
  return a <= b ? a : b;
}

export function minExistingDate(a: string | null, b: string | null): string | null {
  if (!a) {
    return b;
  }
  if (!b) {
    return a;
  }
  return minDate(a, b);
}

export function maxExistingDate(a: string | null, b: string | null): string | null {
  if (!a) {
    return b;
  }
  if (!b) {
    return a;
  }
  return a >= b ? a : b;
}

function roundValue(value: number): number {
  return Number(value.toFixed(4));
}

function formatKoreanDateLabel(
  year: string,
  month: string,
  day: string
): string {
  return `${Number(year)}년 ${Number(month)}월 ${Number(day)}일`;
}

function getTimeZoneParts(
  date: Date,
  timeZone: string
): Record<"year" | "month" | "day" | "hour" | "minute", string> {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  const values: Record<"year" | "month" | "day" | "hour" | "minute", string> = {
    year: "",
    month: "",
    day: "",
    hour: "",
    minute: "",
  };

  for (const part of formatter.formatToParts(date)) {
    if (part.type in values) {
      values[part.type as keyof typeof values] = part.value;
    }
  }

  return values;
}
