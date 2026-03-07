"use client";

import {
  startTransition,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ColorType,
  createChart,
  IChartApi,
  IRange,
  ISeriesApi,
  LineData,
  LineSeries,
  LineStyle,
  MouseEventParams,
  PriceScaleMode,
  Time,
} from "lightweight-charts";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  buildForwardWindowData,
  buildTickerData,
  buildWindowData,
  calculateForwardReturn,
  calculateTrailingReturn,
  ChartPayload,
  COLORS,
  DEFAULT_SYMBOLS,
  findNearestCommonDate,
  findIndexOnOrBefore,
  formatDate,
  formatDateTime,
  formatPercent,
  getOverlapAnchorDate,
  getLatestCommonDate,
  maxExistingDate,
  minExistingDate,
  normalizeAgainstDate,
  PERIODS,
  PeriodId,
  subtractMonthsKey,
  timeToDateKey,
} from "@/lib/chart-data";
import type { TickerSuggestion } from "@/lib/stooq";

const NAVIGATOR_HEIGHT = 340;
const DETAIL_HEIGHT = 420;

type ScaleMode = "log" | "linear";

type SeriesRefs = {
  QQQ: ISeriesApi<"Line"> | null;
  TQQQ: ISeriesApi<"Line"> | null;
};

type ComparisonStatus = {
  hasData: boolean;
  message: string | null;
  qqq: number | null;
  tqqq: number | null;
  highlights: Array<"QQQ" | "TQQQ">;
};

type HoverOverlayElementRefs = {
  root: HTMLDivElement | null;
  qqq: HTMLSpanElement | null;
  tqqq: HTMLSpanElement | null;
};

type CalendarCell = {
  dateKey: string;
  day: number;
  inMonth: boolean;
  disabled: boolean;
};

type SuggestionField = "primary" | "comparison";

interface RollingComparisonProps {
  initialData: ChartPayload | null;
}

const panelClassName =
  "overflow-visible rounded-[28px] border border-[var(--line)] bg-[var(--paper)] shadow-[var(--shadow)] ring-0";

const surfaceClassName =
  "h-full w-full overflow-visible rounded-[20px] border border-[rgba(31,41,55,0.08)] bg-[#fffaf3]";

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

export function RollingComparison({
  initialData,
}: RollingComparisonProps): React.JSX.Element {
  const [chartData, setChartData] = useState<ChartPayload | null>(initialData);
  const [isTickerLoading, setIsTickerLoading] = useState(false);
  const [tickerLoadError, setTickerLoadError] = useState<string | null>(null);
  const [primaryTickerInput, setPrimaryTickerInput] = useState(
    initialData?.symbols.QQQ ?? DEFAULT_SYMBOLS.QQQ
  );
  const [comparisonTickerInput, setComparisonTickerInput] = useState(
    initialData?.symbols.TQQQ ?? DEFAULT_SYMBOLS.TQQQ
  );
  const [primarySuggestions, setPrimarySuggestions] = useState<TickerSuggestion[]>(
    []
  );
  const [comparisonSuggestions, setComparisonSuggestions] = useState<
    TickerSuggestion[]
  >([]);
  const [suggestionError, setSuggestionError] = useState<string | null>(null);
  const [loadingSuggestionField, setLoadingSuggestionField] =
    useState<SuggestionField | null>(null);
  const [activeSuggestionField, setActiveSuggestionField] =
    useState<SuggestionField | null>(null);
  const activeSymbols = chartData?.symbols ?? DEFAULT_SYMBOLS;
  const primaryTickerLabel = activeSymbols.QQQ;
  const comparisonTickerLabel = activeSymbols.TQQQ;
  const pairTickerLabel = `${primaryTickerLabel}/${comparisonTickerLabel}`;
  const tickerData = useMemo(
    () => (chartData ? buildTickerData(chartData) : null),
    [chartData]
  );
  const latestCommonDate = useMemo(
    () => (tickerData ? getLatestCommonDate(tickerData) : null),
    [tickerData]
  );
  const overlapAnchorDate = useMemo(
    () => (tickerData ? getOverlapAnchorDate(tickerData) : null),
    [tickerData]
  );
  const navigatorQqqRows = useMemo(
    () =>
      tickerData && overlapAnchorDate
        ? normalizeAgainstDate(tickerData.QQQ.rows, overlapAnchorDate)
        : [],
    [overlapAnchorDate, tickerData]
  );
  const navigatorTqqqRows = useMemo(
    () =>
      tickerData && overlapAnchorDate
        ? normalizeAgainstDate(tickerData.TQQQ.rows, overlapAnchorDate)
        : [],
    [overlapAnchorDate, tickerData]
  );
  const navigatorDateKeys = useMemo(
    () => navigatorTqqqRows.map((row) => row.time),
    [navigatorTqqqRows]
  );
  const initialVisibleFrom = useMemo(
    () => {
      if (!latestCommonDate || !overlapAnchorDate) {
        return null;
      }

      return resolveInitialVisibleFrom(latestCommonDate, overlapAnchorDate);
    },
    [latestCommonDate, overlapAnchorDate]
  );

  const navigatorContainerRef = useRef<HTMLDivElement | null>(null);
  const detailContainerRef = useRef<HTMLDivElement | null>(null);
  const forwardContainerRef = useRef<HTMLDivElement | null>(null);
  const navigatorChartRef = useRef<IChartApi | null>(null);
  const detailChartRef = useRef<IChartApi | null>(null);
  const forwardChartRef = useRef<IChartApi | null>(null);
  const navigatorSeriesRef = useRef<SeriesRefs>({ QQQ: null, TQQQ: null });
  const detailSeriesRef = useRef<SeriesRefs>({ QQQ: null, TQQQ: null });
  const forwardSeriesRef = useRef<SeriesRefs>({ QQQ: null, TQQQ: null });
  const navigatorHoverOverlayRef = useRef<HoverOverlayElementRefs>({
    root: null,
    qqq: null,
    tqqq: null,
  });
  const detailHoverOverlayRef = useRef<HoverOverlayElementRefs>({
    root: null,
    qqq: null,
    tqqq: null,
  });
  const forwardHoverOverlayRef = useRef<HoverOverlayElementRefs>({
    root: null,
    qqq: null,
    tqqq: null,
  });
  const primaryInputRef = useRef<HTMLDivElement | null>(null);
  const comparisonInputRef = useRef<HTMLDivElement | null>(null);
  const anchorPickerRef = useRef<HTMLDivElement | null>(null);
  const anchorPickerInputRef = useRef<HTMLInputElement | null>(null);

  const [selectedPeriodId, setSelectedPeriodId] = useState<PeriodId>("6m");
  const [historyTrailingPeriodId, setHistoryTrailingPeriodId] =
    useState<PeriodId>("6m");
  const [historyForwardPeriodId, setHistoryForwardPeriodId] =
    useState<PeriodId>("6m");
  const [navigatorScaleMode, setNavigatorScaleMode] =
    useState<ScaleMode>("log");
  const [anchorDate, setAnchorDate] = useState<string | null>(latestCommonDate);
  const [visibleWindowFrom, setVisibleWindowFrom] =
    useState<string | null>(initialVisibleFrom);
  const [isAnchorPickerOpen, setIsAnchorPickerOpen] = useState(false);
  const [anchorPickerDraftDate, setAnchorPickerDraftDate] = useState(
    latestCommonDate ?? ""
  );
  const [anchorPickerMonthKey, setAnchorPickerMonthKey] = useState(
    latestCommonDate ? latestCommonDate.slice(0, 7) : ""
  );

  const selectedPeriod = useMemo(
    () => PERIODS.find((period) => period.id === selectedPeriodId) ?? PERIODS[3],
    [selectedPeriodId]
  );
  const historyTrailingPeriod = useMemo(
    () =>
      PERIODS.find((period) => period.id === historyTrailingPeriodId) ?? PERIODS[2],
    [historyTrailingPeriodId]
  );
  const historyForwardPeriod = useMemo(
    () =>
      PERIODS.find((period) => period.id === historyForwardPeriodId) ?? PERIODS[2],
    [historyForwardPeriodId]
  );

  const periodReturns = useMemo(() => {
    if (!tickerData || !anchorDate) {
      return [];
    }

    return PERIODS.map((period) => ({
      ...period,
      qqq: calculateTrailingReturn(tickerData.QQQ.rows, anchorDate, period),
      tqqq: calculateTrailingReturn(tickerData.TQQQ.rows, anchorDate, period),
    }));
  }, [anchorDate, tickerData]);
  const forwardPeriodReturns = useMemo(() => {
    if (!tickerData || !anchorDate) {
      return [];
    }

    return PERIODS.map((period) => ({
      ...period,
      qqq: calculateForwardReturn(tickerData.QQQ.rows, anchorDate, period),
      tqqq: calculateForwardReturn(tickerData.TQQQ.rows, anchorDate, period),
    }));
  }, [anchorDate, tickerData]);

  const qqqDetailWindow = useMemo(() => {
    if (!tickerData || !anchorDate) {
      return null;
    }
    return buildWindowData(tickerData.QQQ.rows, anchorDate, selectedPeriod);
  }, [anchorDate, selectedPeriod, tickerData]);

  const tqqqDetailWindow = useMemo(() => {
    if (!tickerData || !anchorDate) {
      return null;
    }
    return buildWindowData(tickerData.TQQQ.rows, anchorDate, selectedPeriod);
  }, [anchorDate, selectedPeriod, tickerData]);
  const qqqForwardWindow = useMemo(() => {
    if (!tickerData || !anchorDate) {
      return null;
    }
    return buildForwardWindowData(tickerData.QQQ.rows, anchorDate, selectedPeriod);
  }, [anchorDate, selectedPeriod, tickerData]);
  const tqqqForwardWindow = useMemo(() => {
    if (!tickerData || !anchorDate) {
      return null;
    }
    return buildForwardWindowData(tickerData.TQQQ.rows, anchorDate, selectedPeriod);
  }, [anchorDate, selectedPeriod, tickerData]);

  const detailRangeLabel = useMemo(() => {
    const start = minExistingDate(
      qqqDetailWindow?.start ?? null,
      tqqqDetailWindow?.start ?? null
    );
    const end = maxExistingDate(
      qqqDetailWindow?.end ?? null,
      tqqqDetailWindow?.end ?? null
    );

    if (!start || !end) {
      return "선택 구간 데이터가 없습니다.";
    }

    return `${formatDate(start)} ~ ${formatDate(end)}`;
  }, [qqqDetailWindow, tqqqDetailWindow]);

  const detailStatus = useMemo(() => {
    return buildComparisonStatus(
      qqqDetailWindow?.returnPct ?? null,
      tqqqDetailWindow?.returnPct ?? null,
      `선택한 기준일에서는 ${pairTickerLabel} 모두 해당 기간 데이터가 없습니다.`
    );
  }, [pairTickerLabel, qqqDetailWindow, tqqqDetailWindow]);
  const forwardRangeLabel = useMemo(() => {
    const start = minExistingDate(
      qqqForwardWindow?.start ?? null,
      tqqqForwardWindow?.start ?? null
    );
    const end = maxExistingDate(
      qqqForwardWindow?.end ?? null,
      tqqqForwardWindow?.end ?? null
    );

    if (!start || !end) {
      return "선택 구간 데이터가 없습니다.";
    }

    return `${formatDate(start)} ~ ${formatDate(end)}`;
  }, [qqqForwardWindow, tqqqForwardWindow]);
  const forwardStatus = useMemo(() => {
    return buildComparisonStatus(
      qqqForwardWindow?.returnPct ?? null,
      tqqqForwardWindow?.returnPct ?? null,
      `선택한 기준일 이후에는 ${pairTickerLabel} 미래 데이터가 없습니다.`
    );
  }, [pairTickerLabel, qqqForwardWindow, tqqqForwardWindow]);
  const historyTrailingStatus = useMemo(() => {
    if (!tickerData || !anchorDate) {
      return buildComparisonStatus(
        null,
        null,
        `선택한 기준일에서는 ${pairTickerLabel} 모두 해당 기간 데이터가 없습니다.`
      );
    }

    return buildComparisonStatus(
      calculateTrailingReturn(
        tickerData.QQQ.rows,
        anchorDate,
        historyTrailingPeriod
      ),
      calculateTrailingReturn(
        tickerData.TQQQ.rows,
        anchorDate,
        historyTrailingPeriod
      ),
      `선택한 기준일에서는 ${pairTickerLabel} 모두 해당 기간 데이터가 없습니다.`
    );
  }, [anchorDate, historyTrailingPeriod, pairTickerLabel, tickerData]);
  const historyForwardStatus = useMemo(() => {
    if (!tickerData || !anchorDate) {
      return buildComparisonStatus(
        null,
        null,
        `선택한 기준일 이후에는 ${pairTickerLabel} 미래 데이터가 없습니다.`
      );
    }

    return buildComparisonStatus(
      calculateForwardReturn(
        tickerData.QQQ.rows,
        anchorDate,
        historyForwardPeriod
      ),
      calculateForwardReturn(
        tickerData.TQQQ.rows,
        anchorDate,
        historyForwardPeriod
      ),
      `선택한 기준일 이후에는 ${pairTickerLabel} 미래 데이터가 없습니다.`
    );
  }, [anchorDate, historyForwardPeriod, pairTickerLabel, tickerData]);
  const anchorPickerDateKey =
    anchorPickerDraftDate ||
    anchorDate ||
    latestCommonDate ||
    overlapAnchorDate ||
    "1970-01-01";
  const anchorPickerMinDate = overlapAnchorDate ?? anchorPickerDateKey;
  const anchorPickerMaxDate = latestCommonDate ?? anchorPickerDateKey;
  const anchorPickerYear = Number(anchorPickerDateKey.slice(0, 4));
  const anchorPickerMonth = Number(anchorPickerDateKey.slice(5, 7));
  const anchorPickerDay = Number(anchorPickerDateKey.slice(8, 10));
  const anchorPickerYears = useMemo(
    () => buildYearOptions(anchorPickerMinDate, anchorPickerMaxDate),
    [anchorPickerMaxDate, anchorPickerMinDate]
  );
  const anchorPickerDays = useMemo(
    () => buildDayOptions(anchorPickerYear, anchorPickerMonth),
    [anchorPickerMonth, anchorPickerYear]
  );
  const anchorCalendarCells = useMemo(
    () =>
      buildCalendarCells(
        anchorPickerMonthKey || getMonthKey(anchorPickerDateKey),
        anchorPickerMinDate,
        anchorPickerMaxDate
      ),
    [
      anchorPickerDateKey,
      anchorPickerMonthKey,
      anchorPickerMaxDate,
      anchorPickerMinDate,
    ]
  );

  const handleAnchorDateSelection = (targetDateKey: string) => {
    if (!tickerData) {
      return;
    }

    const clampedTarget = clampDateKey(
      targetDateKey,
      anchorPickerMinDate,
      anchorPickerMaxDate
    );
    const nextAnchor = findNearestCommonDate(tickerData, clampedTarget);
    if (!nextAnchor) {
      return;
    }

    const nextEndIndex = findIndexOnOrBefore(navigatorTqqqRows, nextAnchor);
    if (nextEndIndex < 0) {
      return;
    }

    const currentEndIndex = anchorDate
      ? findIndexOnOrBefore(navigatorTqqqRows, anchorDate)
      : -1;
    const currentStartIndex = visibleWindowFrom
      ? findIndexOnOrBefore(navigatorTqqqRows, visibleWindowFrom)
      : -1;
    const fallbackStartIndex = initialVisibleFrom
      ? findIndexOnOrBefore(navigatorTqqqRows, initialVisibleFrom)
      : 0;
    const windowSize =
      currentStartIndex >= 0 && currentEndIndex >= currentStartIndex
        ? currentEndIndex - currentStartIndex
        : Math.max(0, nextEndIndex - Math.max(0, fallbackStartIndex));
    const nextStartIndex = Math.max(0, nextEndIndex - windowSize);
    const nextVisibleFrom = navigatorDateKeys[nextStartIndex] ?? nextAnchor;

    if (navigatorChartRef.current) {
      navigatorChartRef.current.timeScale().setVisibleRange({
        from: toBusinessDay(nextVisibleFrom),
        to: toBusinessDay(nextAnchor),
      });
    }

    startTransition(() => {
      setAnchorDate(nextAnchor);
      setVisibleWindowFrom(nextVisibleFrom);
      setAnchorPickerDraftDate(nextAnchor);
      setAnchorPickerMonthKey(getMonthKey(nextAnchor));
    });
    setIsAnchorPickerOpen(false);
  };

  const handleAnchorPickerInputChange = (nextDateKey: string) => {
    if (!nextDateKey) {
      return;
    }
    const normalized = clampDateKey(
      nextDateKey,
      anchorPickerMinDate,
      anchorPickerMaxDate
    );
    setAnchorPickerDraftDate(normalized);
    setAnchorPickerMonthKey(getMonthKey(normalized));
  };

  const handleAnchorPickerMonthStep = (delta: -1 | 1) => {
    const nextMonthKey = shiftMonthKey(
      anchorPickerMonthKey || getMonthKey(anchorPickerDateKey),
      delta
    );
    const minMonthKey = getMonthKey(anchorPickerMinDate);
    const maxMonthKey = getMonthKey(anchorPickerMaxDate);
    const boundedMonthKey =
      nextMonthKey < minMonthKey
        ? minMonthKey
        : nextMonthKey > maxMonthKey
          ? maxMonthKey
          : nextMonthKey;
    const nextDraft = setDateKeyParts(anchorPickerDateKey, {
      year: Number(boundedMonthKey.slice(0, 4)),
      month: Number(boundedMonthKey.slice(5, 7)),
    });

    setAnchorPickerMonthKey(boundedMonthKey);
    setAnchorPickerDraftDate(
      clampDateKey(nextDraft, anchorPickerMinDate, anchorPickerMaxDate)
    );
  };

  const handleTickerSearch = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const primary = primaryTickerInput.trim().toUpperCase();
    const comparison = comparisonTickerInput.trim().toUpperCase();

    if (!primary || !comparison) {
      setTickerLoadError("비교할 두 티커를 모두 입력해 주세요.");
      return;
    }

    if (primary === comparison) {
      setTickerLoadError("서로 다른 두 티커를 입력해 주세요.");
      return;
    }

    setIsTickerLoading(true);
    setTickerLoadError(null);
    setActiveSuggestionField(null);

    try {
      const params = new URLSearchParams({
        primary,
        comparison,
      });
      const response = await fetch(`/api/history?${params.toString()}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as unknown;

      if (!response.ok || !isChartPayload(payload)) {
        const message =
          typeof payload === "object" &&
          payload !== null &&
          "error" in payload &&
          typeof payload.error === "string"
            ? payload.error
            : "티커 데이터를 불러오지 못했습니다.";
        throw new Error(message);
      }

      const nextChartData = payload;
      const nextTickerData = buildTickerData(nextChartData);
      const nextLatestCommonDate = getLatestCommonDate(nextTickerData);
      const nextOverlapAnchorDate = getOverlapAnchorDate(nextTickerData);
      const nextInitialVisibleFrom = resolveInitialVisibleFrom(
        nextLatestCommonDate,
        nextOverlapAnchorDate
      );

      startTransition(() => {
        setChartData(nextChartData);
        setPrimaryTickerInput(nextChartData.symbols.QQQ);
        setComparisonTickerInput(nextChartData.symbols.TQQQ);
        setAnchorDate(nextLatestCommonDate);
        setVisibleWindowFrom(nextInitialVisibleFrom);
        setAnchorPickerDraftDate(nextLatestCommonDate);
        setAnchorPickerMonthKey(getMonthKey(nextLatestCommonDate));
      });
      setIsAnchorPickerOpen(false);
    } catch (error) {
      setTickerLoadError(
        error instanceof Error ? error.message : "티커 데이터를 불러오지 못했습니다."
      );
    } finally {
      setIsTickerLoading(false);
    }
  };

  const applyTickerSuggestion = (
    field: SuggestionField,
    suggestion: TickerSuggestion
  ) => {
    if (field === "primary") {
      setPrimaryTickerInput(suggestion.symbol);
      setPrimarySuggestions([]);
    } else {
      setComparisonTickerInput(suggestion.symbol);
      setComparisonSuggestions([]);
    }

    setSuggestionError(null);
    setActiveSuggestionField(null);
  };

  const handleVisibleRangeChange = useEffectEvent((range: IRange<Time> | null) => {
    if (!tickerData || !range || !range.to) {
      return;
    }

    const nextAnchor = findNearestCommonDate(
      tickerData,
      timeToDateKey(range.to as string | number | { year: number; month: number; day: number })
    );
    if (!nextAnchor) {
      return;
    }

    const nextVisibleFrom = range.from
      ? timeToDateKey(
          range.from as string | number | { year: number; month: number; day: number }
        )
      : null;

    startTransition(() => {
      setAnchorDate(nextAnchor);
      setVisibleWindowFrom(nextVisibleFrom);
    });
  });

  const handleNavigatorArrowStep = useEffectEvent((offset: -1 | 1) => {
    if (
      !navigatorChartRef.current ||
      !anchorDate ||
      !visibleWindowFrom ||
      navigatorDateKeys.length === 0
    ) {
      return;
    }

    const endIndex = findIndexOnOrBefore(navigatorTqqqRows, anchorDate);
    const startIndex = findIndexOnOrBefore(navigatorTqqqRows, visibleWindowFrom);
    if (startIndex < 0 || endIndex < 0 || startIndex > endIndex) {
      return;
    }

    const lastIndex = navigatorDateKeys.length - 1;
    const windowSize = endIndex - startIndex;
    let nextStartIndex = startIndex + offset;
    let nextEndIndex = endIndex + offset;

    if (nextStartIndex < 0) {
      nextStartIndex = 0;
      nextEndIndex = Math.min(lastIndex, windowSize);
    }

    if (nextEndIndex > lastIndex) {
      nextEndIndex = lastIndex;
      nextStartIndex = Math.max(0, lastIndex - windowSize);
    }

    if (nextStartIndex === startIndex && nextEndIndex === endIndex) {
      return;
    }

    navigatorChartRef.current.timeScale().setVisibleRange({
      from: toBusinessDay(navigatorDateKeys[nextStartIndex]),
      to: toBusinessDay(navigatorDateKeys[nextEndIndex]),
    });
  });
  const handleNavigatorCrosshairMove = useEffectEvent(
    (param: MouseEventParams<Time>) => {
      syncHoverOverlay(
        navigatorHoverOverlayRef.current,
        param,
        navigatorSeriesRef.current
      );
    }
  );
  const handleDetailCrosshairMove = useEffectEvent(
    (param: MouseEventParams<Time>) => {
      syncHoverOverlay(
        detailHoverOverlayRef.current,
        param,
        detailSeriesRef.current
      );
    }
  );
  const handleForwardCrosshairMove = useEffectEvent(
    (param: MouseEventParams<Time>) => {
      syncHoverOverlay(
        forwardHoverOverlayRef.current,
        param,
        forwardSeriesRef.current
      );
    }
  );

  useEffect(() => {
    if (
      !tickerData ||
      !latestCommonDate ||
      !initialVisibleFrom ||
      !overlapAnchorDate ||
      !navigatorContainerRef.current ||
      !detailContainerRef.current ||
      !forwardContainerRef.current
    ) {
      return;
    }

    const navigatorChart = createBaseChart(
      navigatorContainerRef.current,
      NAVIGATOR_HEIGHT
    );
    const detailChart = createBaseChart(detailContainerRef.current, DETAIL_HEIGHT);
    const forwardChart = createBaseChart(forwardContainerRef.current, DETAIL_HEIGHT);

    const navigatorQqq = navigatorChart.addSeries(LineSeries, {
      color: COLORS.QQQ,
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    const navigatorTqqq = navigatorChart.addSeries(LineSeries, {
      color: COLORS.TQQQ,
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    const detailQqq = detailChart.addSeries(LineSeries, {
      color: COLORS.QQQ,
      lineWidth: 3,
      priceLineVisible: false,
      lastValueVisible: true,
    });
    const detailTqqq = detailChart.addSeries(LineSeries, {
      color: COLORS.TQQQ,
      lineWidth: 3,
      priceLineVisible: false,
      lastValueVisible: true,
    });
    const forwardQqq = forwardChart.addSeries(LineSeries, {
      color: COLORS.QQQ,
      lineWidth: 3,
      priceLineVisible: false,
      lastValueVisible: true,
    });
    const forwardTqqq = forwardChart.addSeries(LineSeries, {
      color: COLORS.TQQQ,
      lineWidth: 3,
      priceLineVisible: false,
      lastValueVisible: true,
    });

    navigatorQqq.setData(navigatorQqqRows as LineData<Time>[]);
    navigatorTqqq.setData(navigatorTqqqRows as LineData<Time>[]);

    navigatorChartRef.current = navigatorChart;
    detailChartRef.current = detailChart;
    forwardChartRef.current = forwardChart;
    navigatorSeriesRef.current = { QQQ: navigatorQqq, TQQQ: navigatorTqqq };
    detailSeriesRef.current = { QQQ: detailQqq, TQQQ: detailTqqq };
    forwardSeriesRef.current = { QQQ: forwardQqq, TQQQ: forwardTqqq };

    const initialRange = {
      from: toBusinessDay(initialVisibleFrom),
      to: toBusinessDay(latestCommonDate),
    };
    navigatorChart.timeScale().setVisibleRange(initialRange);
    navigatorChart.timeScale().subscribeVisibleTimeRangeChange(
      handleVisibleRangeChange
    );
    navigatorChart.subscribeCrosshairMove(handleNavigatorCrosshairMove);
    detailChart.subscribeCrosshairMove(handleDetailCrosshairMove);
    forwardChart.subscribeCrosshairMove(handleForwardCrosshairMove);
    handleVisibleRangeChange(initialRange);

    const navigatorHoverOverlay = navigatorHoverOverlayRef.current;
    const detailHoverOverlay = detailHoverOverlayRef.current;
    const forwardHoverOverlay = forwardHoverOverlayRef.current;

    const resizeObserver = new ResizeObserver(() => {
      if (navigatorContainerRef.current && navigatorChartRef.current) {
        navigatorChartRef.current.resize(
          navigatorContainerRef.current.clientWidth,
          NAVIGATOR_HEIGHT
        );
      }
      if (detailContainerRef.current && detailChartRef.current) {
        detailChartRef.current.resize(
          detailContainerRef.current.clientWidth,
          DETAIL_HEIGHT
        );
      }
      if (forwardContainerRef.current && forwardChartRef.current) {
        forwardChartRef.current.resize(
          forwardContainerRef.current.clientWidth,
          DETAIL_HEIGHT
        );
      }
    });

    resizeObserver.observe(navigatorContainerRef.current);
    resizeObserver.observe(detailContainerRef.current);
    resizeObserver.observe(forwardContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      navigatorChart.timeScale().unsubscribeVisibleTimeRangeChange(
        handleVisibleRangeChange
      );
      navigatorChart.unsubscribeCrosshairMove(handleNavigatorCrosshairMove);
      detailChart.unsubscribeCrosshairMove(handleDetailCrosshairMove);
      forwardChart.unsubscribeCrosshairMove(handleForwardCrosshairMove);
      hideHoverOverlay(navigatorHoverOverlay);
      hideHoverOverlay(detailHoverOverlay);
      hideHoverOverlay(forwardHoverOverlay);
      navigatorChart.remove();
      detailChart.remove();
      forwardChart.remove();
      navigatorChartRef.current = null;
      detailChartRef.current = null;
      forwardChartRef.current = null;
      navigatorSeriesRef.current = { QQQ: null, TQQQ: null };
      detailSeriesRef.current = { QQQ: null, TQQQ: null };
      forwardSeriesRef.current = { QQQ: null, TQQQ: null };
    };
  }, [
    initialVisibleFrom,
    latestCommonDate,
    tickerData,
    navigatorQqqRows,
    navigatorTqqqRows,
    overlapAnchorDate,
  ]);

  useEffect(() => {
    if (!isAnchorPickerOpen) {
      return;
    }

    anchorPickerInputRef.current?.focus();

    const handlePointerDown = (event: PointerEvent) => {
      if (
        anchorPickerRef.current &&
        !anchorPickerRef.current.contains(event.target as Node)
      ) {
        setIsAnchorPickerOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsAnchorPickerOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isAnchorPickerOpen]);

  useEffect(() => {
    const query = primaryTickerInput.trim();
    if (query.length === 0) {
      setPrimarySuggestions([]);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        setLoadingSuggestionField("primary");
        const response = await fetch(
          `/api/symbol-search?q=${encodeURIComponent(query)}`,
          {
            cache: "no-store",
            signal: controller.signal,
          }
        );
        const payload = (await response.json()) as {
          items?: TickerSuggestion[];
          error?: string;
        };

        if (!response.ok) {
          throw new Error(payload.error || "Ticker suggestions are unavailable.");
        }

        setPrimarySuggestions(payload.items ?? []);
        setSuggestionError(null);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        setPrimarySuggestions([]);
        setSuggestionError(
          error instanceof Error
            ? error.message
            : "Ticker suggestions are unavailable."
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoadingSuggestionField((current) =>
            current === "primary" ? null : current
          );
        }
      }
    }, 180);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [primaryTickerInput]);

  useEffect(() => {
    const query = comparisonTickerInput.trim();
    if (query.length === 0) {
      setComparisonSuggestions([]);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        setLoadingSuggestionField("comparison");
        const response = await fetch(
          `/api/symbol-search?q=${encodeURIComponent(query)}`,
          {
            cache: "no-store",
            signal: controller.signal,
          }
        );
        const payload = (await response.json()) as {
          items?: TickerSuggestion[];
          error?: string;
        };

        if (!response.ok) {
          throw new Error(payload.error || "Ticker suggestions are unavailable.");
        }

        setComparisonSuggestions(payload.items ?? []);
        setSuggestionError(null);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        setComparisonSuggestions([]);
        setSuggestionError(
          error instanceof Error
            ? error.message
            : "Ticker suggestions are unavailable."
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoadingSuggestionField((current) =>
            current === "comparison" ? null : current
          );
        }
      }
    }, 180);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [comparisonTickerInput]);

  useEffect(() => {
    if (!activeSuggestionField) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      const isInsidePrimary =
        !!primaryInputRef.current && primaryInputRef.current.contains(target);
      const isInsideComparison =
        !!comparisonInputRef.current && comparisonInputRef.current.contains(target);

      if (!isInsidePrimary && !isInsideComparison) {
        setActiveSuggestionField(null);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [activeSuggestionField]);

  useEffect(() => {
    if (!navigatorChartRef.current) {
      return;
    }

    applyNavigatorScale(navigatorChartRef.current, navigatorScaleMode);
  }, [navigatorScaleMode]);

  useEffect(() => {
    if (navigatorDateKeys.length === 0) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }

      if (isTextEditingElement(document.activeElement)) {
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        handleNavigatorArrowStep(-1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        handleNavigatorArrowStep(1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [navigatorDateKeys.length]);

  useEffect(() => {
    if (
      !detailChartRef.current ||
      !detailSeriesRef.current.QQQ ||
      !detailSeriesRef.current.TQQQ
    ) {
      return;
    }

    detailSeriesRef.current.QQQ.setData(
      (qqqDetailWindow?.series ?? []) as LineData<Time>[]
    );
    detailSeriesRef.current.TQQQ.setData(
      (tqqqDetailWindow?.series ?? []) as LineData<Time>[]
    );

    const from = minExistingDate(
      qqqDetailWindow?.start ?? null,
      tqqqDetailWindow?.start ?? null
    );
    const to = maxExistingDate(
      qqqDetailWindow?.end ?? null,
      tqqqDetailWindow?.end ?? null
    );

    if (from && to) {
      detailChartRef.current.timeScale().setVisibleRange({
        from: toBusinessDay(from),
        to: toBusinessDay(to),
      });
    }
  }, [qqqDetailWindow, tqqqDetailWindow]);
  useEffect(() => {
    if (
      !forwardChartRef.current ||
      !forwardSeriesRef.current.QQQ ||
      !forwardSeriesRef.current.TQQQ
    ) {
      return;
    }

    forwardSeriesRef.current.QQQ.setData(
      (qqqForwardWindow?.series ?? []) as LineData<Time>[]
    );
    forwardSeriesRef.current.TQQQ.setData(
      (tqqqForwardWindow?.series ?? []) as LineData<Time>[]
    );

    const from = minExistingDate(
      qqqForwardWindow?.start ?? null,
      tqqqForwardWindow?.start ?? null
    );
    const to = maxExistingDate(
      qqqForwardWindow?.end ?? null,
      tqqqForwardWindow?.end ?? null
    );

    if (from && to) {
      forwardChartRef.current.timeScale().setVisibleRange({
        from: toBusinessDay(from),
        to: toBusinessDay(to),
      });
    }
  }, [qqqForwardWindow, tqqqForwardWindow]);
  useEffect(() => {
    hideHoverOverlay(navigatorHoverOverlayRef.current);
    hideHoverOverlay(detailHoverOverlayRef.current);
    hideHoverOverlay(forwardHoverOverlayRef.current);
  }, [anchorDate, selectedPeriodId]);

  if (!chartData || !tickerData || !latestCommonDate || !overlapAnchorDate) {
    return (
      <main className="mx-auto min-h-screen w-[min(1320px,calc(100%-32px))] py-7 sm:py-12">
        <Card className={panelClassName}>
          <CardHeader className="gap-4 px-7 py-7">
            <CardTitle className="text-3xl font-semibold tracking-[-0.04em] text-[var(--text)]">
              차트 데이터 파일이 없습니다.
            </CardTitle>
            <CardDescription className="max-w-3xl text-base leading-7 text-[var(--muted-text)]">
              먼저 <code className="rounded bg-black/5 px-1.5 py-0.5">python refresh_data.py</code>
              를 실행해서 <code className="rounded bg-black/5 px-1.5 py-0.5">public/chart-data.json</code>
              을 생성해 주세요.
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen w-[min(1320px,calc(100%-32px))] py-4 sm:py-7">
      <section className="grid gap-5">
        <Card className={panelClassName}>
          <CardHeader className="gap-4 px-7 py-7">
            <p className="m-0 text-xs font-bold uppercase tracking-[0.12em] text-[var(--muted-text)]">
              TradingView Lightweight Charts
            </p>
            <CardTitle className="text-[clamp(2.125rem,6vw,4rem)] leading-[0.96] font-semibold tracking-[-0.04em] text-[var(--text)]">
              {primaryTickerLabel} / {comparisonTickerLabel} Rolling Comparison
            </CardTitle>
            <CardDescription className="max-w-4xl text-base leading-7 text-[var(--muted-text)]">
              위 차트는 TradingView의 공식 차트 라이브러리인 Lightweight
              Charts로 구성했습니다. 상단 전체 히스토리 차트를 좌우로
              드래그하면
              기준 시점이 바뀌고, 아래의 trailing/forward 수익률 비교가 즉시
              다시 계산됩니다. 상단 전체 히스토리 차트는 두 티커의 공통 시작일
              종가를 {pairTickerLabel} 모두 100으로 맞춘
              상대지수입니다.
            </CardDescription>
            <form
              onSubmit={handleTickerSearch}
              className="grid gap-2 rounded-[24px] border border-[var(--line)] bg-white/72 p-3 shadow-sm lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
            >
              <div
                ref={primaryInputRef}
                className="relative grid gap-1 text-[11px] font-semibold text-[var(--muted-text)]"
              >
                <label htmlFor="primary-ticker">기본/첫 번째 티커</label>
                <input
                  id="primary-ticker"
                  value={primaryTickerInput}
                  onFocus={() => setActiveSuggestionField("primary")}
                  onChange={(event) => {
                    setPrimaryTickerInput(event.target.value.toUpperCase());
                    setActiveSuggestionField("primary");
                  }}
                  placeholder="QQQ"
                  autoCapitalize="characters"
                  spellCheck={false}
                  autoComplete="off"
                  className="h-11 rounded-2xl border border-[rgba(23,32,51,0.12)] bg-white px-3 text-sm font-semibold uppercase text-[var(--text)] outline-none transition focus:border-[rgba(23,32,51,0.24)] focus:ring-2 focus:ring-[rgba(23,32,51,0.08)]"
                />
                {activeSuggestionField === "primary" &&
                (primaryTickerInput.trim().length > 0 ||
                  loadingSuggestionField === "primary") ? (
                  <TickerSuggestionList
                    suggestions={primarySuggestions}
                    loading={loadingSuggestionField === "primary"}
                    onSelect={(suggestion) =>
                      applyTickerSuggestion("primary", suggestion)
                    }
                  />
                ) : null}
              </div>
              <div
                ref={comparisonInputRef}
                className="relative grid gap-1 text-[11px] font-semibold text-[var(--muted-text)]"
              >
                <label htmlFor="comparison-ticker">비교/두 번째 티커</label>
                <input
                  id="comparison-ticker"
                  value={comparisonTickerInput}
                  onFocus={() => setActiveSuggestionField("comparison")}
                  onChange={(event) => {
                    setComparisonTickerInput(event.target.value.toUpperCase());
                    setActiveSuggestionField("comparison");
                  }}
                  placeholder="TQQQ"
                  autoCapitalize="characters"
                  spellCheck={false}
                  autoComplete="off"
                  className="h-11 rounded-2xl border border-[rgba(23,32,51,0.12)] bg-white px-3 text-sm font-semibold uppercase text-[var(--text)] outline-none transition focus:border-[rgba(23,32,51,0.24)] focus:ring-2 focus:ring-[rgba(23,32,51,0.08)]"
                />
                {activeSuggestionField === "comparison" &&
                (comparisonTickerInput.trim().length > 0 ||
                  loadingSuggestionField === "comparison") ? (
                  <TickerSuggestionList
                    suggestions={comparisonSuggestions}
                    loading={loadingSuggestionField === "comparison"}
                    onSelect={(suggestion) =>
                      applyTickerSuggestion("comparison", suggestion)
                    }
                  />
                ) : null}
              </div>
              <div className="flex items-end">
                <Button
                  type="submit"
                  className="h-11 w-full rounded-2xl bg-[var(--text)] px-5 text-sm font-semibold text-white hover:bg-[rgba(23,32,51,0.92)] lg:w-auto"
                  disabled={isTickerLoading}
                >
                  {isTickerLoading ? "불러오는 중..." : "티커 불러오기"}
                </Button>
              </div>
              <div className="lg:col-span-3 flex flex-wrap items-center gap-2 text-[12px] font-medium">
                <span className="rounded-full bg-[rgba(23,32,51,0.06)] px-2.5 py-1 text-[var(--muted-text)]">
                  현재 비교: {pairTickerLabel}
                </span>
                <span className="rounded-full bg-[rgba(23,32,51,0.06)] px-2.5 py-1 text-[var(--muted-text)]">
                  필요한 두 티커만 즉시 조회합니다
                </span>
                {suggestionError ? (
                  <span className="rounded-full bg-[rgba(23,32,51,0.06)] px-2.5 py-1 text-[var(--muted-text)]">
                    자동완성 일시 오류
                  </span>
                ) : null}
                {tickerLoadError ? (
                  <span className="rounded-full bg-[rgba(186,24,27,0.08)] px-2.5 py-1 text-[#ba181b]">
                    {tickerLoadError}
                  </span>
                ) : null}
              </div>
            </form>
            <div className="flex flex-wrap gap-2.5">
              <Pill label={primaryTickerLabel} color={COLORS.QQQ} />
              <Pill label={comparisonTickerLabel} color={COLORS.TQQQ} />
              <Badge
                variant="outline"
                className="rounded-full border-[var(--line)] bg-white/72 px-3 py-2 text-[13px] font-medium text-[var(--text)]"
              >
                상단 차트를 좌우로 드래그
              </Badge>
              <Badge
                variant="outline"
                className="rounded-full border-[var(--line)] bg-white/72 px-3 py-2 text-[13px] font-medium text-[var(--text)]"
              >
                마우스휠로 확대/축소
              </Badge>
            </div>
          </CardHeader>
        </Card>

        <section className="grid gap-3 md:grid-cols-3">
          <SummaryCard
            label="기준 시점"
            value={anchorDate ? formatDate(anchorDate) : "-"}
            detail={
              visibleWindowFrom && anchorDate
                ? `${formatDate(visibleWindowFrom)} ~ ${formatDate(anchorDate)}`
                : "-"
            }
          />
          <SummaryCard
            label="데이터 범위"
            value={`${formatDate(overlapAnchorDate)} ~ ${formatDate(latestCommonDate)}`}
            detail={`${formatDate(overlapAnchorDate)} 공통 시작일 종가를 ${pairTickerLabel} 모두 100으로 맞춘 상대지수입니다.`}
          />
          <SummaryCard
            label="마지막 갱신"
            value={formatDateTime(chartData.generatedAt)}
            detail={`소스: ${chartData.source} / 기본 QQQ-TQQQ 파일은 python refresh_data.py 로 다시 생성 가능합니다.`}
          />
        </section>

        <Card className={panelClassName}>
          <CardHeader className="gap-5 px-6 pt-6 pb-3 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.95fr)_auto] xl:items-start">
            <div className="space-y-2 xl:max-w-3xl">
              <CardTitle className="text-3xl font-semibold tracking-[-0.03em] text-[var(--text)]">
                전체 히스토리 차트
              </CardTitle>
              <CardDescription className="max-w-4xl text-[15px] leading-6 text-[var(--muted-text)]">
                두 티커의 공통 시작일인 {formatDate(overlapAnchorDate)} 종가를
                {pairTickerLabel} 모두 100으로 맞춘 상대지수입니다. 이 차트를
                좌우로 움직이면 아래 기간별 비교의 기준일이 바뀝니다.
              </CardDescription>
              <div className="flex flex-wrap items-center gap-2 rounded-[18px] border border-[var(--line)] bg-white/76 px-3 py-3 shadow-sm">
                <span className="rounded-full bg-[rgba(23,32,51,0.1)] px-2.5 py-1 text-[12px] font-bold tracking-[0.06em] text-[var(--text)]">
                  기준일
                </span>
                <span className="rounded-full border border-[rgba(11,110,79,0.18)] bg-[rgba(11,110,79,0.08)] px-2.5 py-1 text-[12px] font-semibold text-[#0b6e4f]">
                  트레일링 {historyTrailingPeriod.label}
                </span>
                <span className="rounded-full border border-[rgba(186,24,27,0.18)] bg-[rgba(186,24,27,0.08)] px-2.5 py-1 text-[12px] font-semibold text-[#ba181b]">
                  포워드 {historyForwardPeriod.label}
                </span>
                <span className="rounded-full bg-[rgba(23,32,51,0.08)] px-3 py-1 text-sm font-bold text-[var(--text)]">
                  {anchorDate ? formatDate(anchorDate) : "-"}
                </span>
              </div>
            </div>
            <div className="space-y-2 xl:pt-1">
              <div className="relative inline-flex" ref={anchorPickerRef}>
                <button
                  type="button"
                  onClick={() => {
                    if (!isAnchorPickerOpen && anchorDate) {
                      setAnchorPickerDraftDate(anchorDate);
                      setAnchorPickerMonthKey(getMonthKey(anchorDate));
                    }
                    setIsAnchorPickerOpen((current) => !current);
                  }}
                  aria-expanded={isAnchorPickerOpen}
                  aria-haspopup="dialog"
                  className="inline-flex items-center gap-2 rounded-full border border-[rgba(23,32,51,0.12)] bg-[rgba(23,32,51,0.05)] px-3 py-1.5 text-[11px] font-semibold text-[var(--text)] shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] transition hover:border-[rgba(23,32,51,0.22)] hover:bg-[rgba(23,32,51,0.08)]"
                >
                  <CalendarDays className="size-3.5 text-[var(--muted-text)]" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--muted-text)]">
                    기준일
                  </span>
                  <span>{anchorDate ? formatDate(anchorDate) : "-"}</span>
                </button>
                {isAnchorPickerOpen ? (
                  <div
                    role="dialog"
                    aria-label="기준일 선택"
                    className="absolute top-full left-0 z-30 mt-3 w-[min(420px,calc(100vw-48px))] rounded-[28px] border border-[var(--line)] bg-[#fffdf8] p-4 shadow-[0_22px_60px_rgba(16,24,40,0.18)]"
                  >
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-[var(--text)]">
                          기준일 선택
                        </p>
                        <p className="text-[12px] leading-5 text-[var(--muted-text)]">
                          날짜를 직접 입력하거나 달력에서 선택해 주세요. 휴장일을
                          고르면 직전 공통 거래일로 맞춰집니다.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-full border-[rgba(31,41,55,0.12)] bg-white/88 px-3"
                        onClick={() => setIsAnchorPickerOpen(false)}
                      >
                        닫기
                      </Button>
                    </div>

                    <div className="mb-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                      <label className="grid gap-1.5 text-[11px] font-semibold text-[var(--muted-text)]">
                        직접 입력
                        <input
                          ref={anchorPickerInputRef}
                          type="date"
                          min={anchorPickerMinDate}
                          max={anchorPickerMaxDate}
                          value={anchorPickerDraftDate}
                          onChange={(event) =>
                            handleAnchorPickerInputChange(event.target.value)
                          }
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              handleAnchorDateSelection(anchorPickerDraftDate);
                            }
                          }}
                          className="h-11 rounded-2xl border border-[rgba(23,32,51,0.12)] bg-white px-3 text-sm font-medium text-[var(--text)] outline-none transition focus:border-[rgba(23,32,51,0.24)] focus:ring-2 focus:ring-[rgba(23,32,51,0.08)]"
                        />
                      </label>
                      <div className="grid grid-cols-2 gap-2 sm:w-[140px] sm:grid-cols-1">
                        <Button
                          type="button"
                          variant="outline"
                          className="h-11 rounded-2xl border-[rgba(23,32,51,0.12)] bg-white/86 px-4 text-sm font-semibold text-[var(--text)]"
                          onClick={() => handleAnchorDateSelection(anchorPickerDraftDate)}
                        >
                          이동
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-11 rounded-2xl border-[rgba(23,32,51,0.12)] bg-white/70 px-4 text-sm font-semibold text-[var(--muted-text)]"
                          onClick={() => {
                            setAnchorPickerDraftDate(anchorPickerMaxDate);
                            setAnchorPickerMonthKey(getMonthKey(anchorPickerMaxDate));
                            handleAnchorDateSelection(anchorPickerMaxDate);
                          }}
                        >
                          최신
                        </Button>
                      </div>
                    </div>

                    <div className="mb-4 grid grid-cols-3 gap-2">
                      <label className="grid gap-1.5 text-[11px] font-semibold text-[var(--muted-text)]">
                        연도
                        <select
                          value={String(anchorPickerYear)}
                          onChange={(event) => {
                            const nextDateKey = setDateKeyParts(anchorPickerDateKey, {
                              year: Number(event.target.value),
                            });
                            handleAnchorPickerInputChange(nextDateKey);
                          }}
                          className="h-10 rounded-2xl border border-[rgba(23,32,51,0.12)] bg-white px-3 text-sm font-medium text-[var(--text)] outline-none transition focus:border-[rgba(23,32,51,0.24)]"
                        >
                          {anchorPickerYears.map((year) => (
                            <option key={year} value={year}>
                              {year}년
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="grid gap-1.5 text-[11px] font-semibold text-[var(--muted-text)]">
                        월
                        <select
                          value={String(anchorPickerMonth)}
                          onChange={(event) => {
                            const nextDateKey = setDateKeyParts(anchorPickerDateKey, {
                              month: Number(event.target.value),
                            });
                            handleAnchorPickerInputChange(nextDateKey);
                          }}
                          className="h-10 rounded-2xl border border-[rgba(23,32,51,0.12)] bg-white px-3 text-sm font-medium text-[var(--text)] outline-none transition focus:border-[rgba(23,32,51,0.24)]"
                        >
                          {Array.from({ length: 12 }, (_, index) => index + 1).map(
                            (month) => (
                              <option key={month} value={month}>
                                {month}월
                              </option>
                            )
                          )}
                        </select>
                      </label>
                      <label className="grid gap-1.5 text-[11px] font-semibold text-[var(--muted-text)]">
                        일
                        <select
                          value={String(anchorPickerDay)}
                          onChange={(event) => {
                            const nextDateKey = setDateKeyParts(anchorPickerDateKey, {
                              day: Number(event.target.value),
                            });
                            handleAnchorPickerInputChange(nextDateKey);
                          }}
                          className="h-10 rounded-2xl border border-[rgba(23,32,51,0.12)] bg-white px-3 text-sm font-medium text-[var(--text)] outline-none transition focus:border-[rgba(23,32,51,0.24)]"
                        >
                          {anchorPickerDays.map((day) => (
                            <option key={day} value={day}>
                              {day}일
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <div className="rounded-[24px] border border-[rgba(23,32,51,0.08)] bg-white/86 p-3">
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          className="rounded-full border-[rgba(23,32,51,0.12)] bg-white"
                          onClick={() => handleAnchorPickerMonthStep(-1)}
                        >
                          <ChevronLeft className="size-4" />
                        </Button>
                        <div className="text-sm font-bold text-[var(--text)]">
                          {formatMonthLabel(anchorPickerMonthKey)}
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          className="rounded-full border-[rgba(23,32,51,0.12)] bg-white"
                          onClick={() => handleAnchorPickerMonthStep(1)}
                        >
                          <ChevronRight className="size-4" />
                        </Button>
                      </div>
                      <div className="mb-2 grid grid-cols-7 gap-1">
                        {WEEKDAY_LABELS.map((dayLabel) => (
                          <span
                            key={dayLabel}
                            className="px-1 py-1 text-center text-[11px] font-bold text-[var(--muted-text)]"
                          >
                            {dayLabel}
                          </span>
                        ))}
                      </div>
                      <div className="grid grid-cols-7 gap-1">
                        {anchorCalendarCells.map((cell) => {
                          const isSelected = cell.dateKey === anchorPickerDraftDate;

                          return (
                            <button
                              key={cell.dateKey}
                              type="button"
                              disabled={cell.disabled}
                              onClick={() => handleAnchorDateSelection(cell.dateKey)}
                              className={[
                                "h-10 rounded-2xl text-sm font-medium transition",
                                cell.disabled
                                  ? "cursor-not-allowed bg-transparent text-[rgba(100,116,139,0.35)]"
                                  : isSelected
                                    ? "border border-[rgba(23,32,51,0.2)] bg-[rgba(23,32,51,0.1)] text-[var(--text)] shadow-sm"
                                    : cell.inMonth
                                      ? "text-[var(--text)] hover:bg-[rgba(23,32,51,0.06)]"
                                      : "text-[rgba(100,116,139,0.58)] hover:bg-[rgba(23,32,51,0.04)]",
                              ].join(" ")}
                            >
                              {cell.day}
                            </button>
                          );
                        })}
                      </div>
                      <div className="mt-3 flex justify-between gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="h-9 rounded-full border-[rgba(23,32,51,0.12)] bg-white/84 px-4 text-xs font-semibold text-[var(--muted-text)]"
                          onClick={() => handleAnchorDateSelection(anchorPickerMinDate)}
                        >
                          최초 기준
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-9 rounded-full border-[rgba(23,32,51,0.12)] bg-white/84 px-4 text-xs font-semibold text-[var(--muted-text)]"
                          onClick={() => handleAnchorDateSelection(anchorPickerMaxDate)}
                        >
                          최신 기준
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="grid gap-3">
                <HistoryComparisonSummary
                  label="트레일링"
                  primaryLabel={primaryTickerLabel}
                  comparisonLabel={comparisonTickerLabel}
                  selectedPeriodId={historyTrailingPeriodId}
                  status={historyTrailingStatus}
                  onSelectPeriodId={setHistoryTrailingPeriodId}
                />
                <HistoryComparisonSummary
                  label="포워드"
                  primaryLabel={primaryTickerLabel}
                  comparisonLabel={comparisonTickerLabel}
                  selectedPeriodId={historyForwardPeriodId}
                  status={historyForwardStatus}
                  onSelectPeriodId={setHistoryForwardPeriodId}
                />
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-full border border-[var(--line)] bg-white/78 px-3 py-2 text-sm font-medium text-[var(--text)]">
              <Switch
                checked={navigatorScaleMode === "log"}
                onCheckedChange={(checked) =>
                  setNavigatorScaleMode(checked ? "log" : "linear")
                }
                aria-label="로그 스케일"
              />
              <span>로그 스케일</span>
            </div>
          </CardHeader>
          <CardContent className="px-3 pb-0 md:px-4">
            <div className="relative h-[340px] px-1 pb-6">
              <div className="pointer-events-none absolute top-4 left-5 z-10 flex flex-wrap gap-2">
                <ChartLegendPill label={primaryTickerLabel} color={COLORS.QQQ} />
                <ChartLegendPill label={comparisonTickerLabel} color={COLORS.TQQQ} />
              </div>
              <ChartHoverOverlay
                onRootRef={(node) => {
                  navigatorHoverOverlayRef.current.root = node;
                }}
                onQqqRef={(node) => {
                  navigatorHoverOverlayRef.current.qqq = node;
                }}
                onTqqqRef={(node) => {
                  navigatorHoverOverlayRef.current.tqqq = node;
                }}
              />
              <div ref={navigatorContainerRef} className={surfaceClassName} />
            </div>
          </CardContent>
          <div className="px-6 pb-6 text-[13px] text-[var(--muted-text)]">
            기준 시점은 현재 보이는 오른쪽 끝 날짜를 따라갑니다. 좌우 방향키로
            하루씩 이동할 수도 있습니다.
          </div>
        </Card>

        <Card className={panelClassName}>
          <CardHeader className="gap-4 px-6 pt-6 pb-3 md:grid-cols-[1fr_auto] md:items-end">
            <div className="space-y-2">
              <CardTitle className="text-3xl font-semibold tracking-[-0.03em] text-[var(--text)]">
                {selectedPeriod.label} trailing return comparison
              </CardTitle>
              <CardDescription className="text-[15px] leading-6 text-[var(--muted-text)]">
                {detailRangeLabel}
              </CardDescription>
            </div>
            {detailStatus.hasData ? (
              <div className="flex flex-wrap items-center justify-end gap-2">
                <DetailStatusPill
                  label={primaryTickerLabel}
                  value={detailStatus.qqq}
                  color={COLORS.QQQ}
                  highlighted={detailStatus.highlights.includes("QQQ")}
                />
                <span className="text-sm text-[var(--muted-text)]">/</span>
                <DetailStatusPill
                  label={comparisonTickerLabel}
                  value={detailStatus.tqqq}
                  color={COLORS.TQQQ}
                  highlighted={detailStatus.highlights.includes("TQQQ")}
                />
              </div>
            ) : (
              <p className="text-sm text-[var(--muted-text)]">{detailStatus.message}</p>
            )}
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <div className="grid gap-5 px-5 pb-5 lg:grid-cols-[340px_minmax(0,1fr)]">
              <div className="grid content-start gap-2.5">
                {periodReturns.map((period) => (
                  <button
                    key={period.id}
                    type="button"
                    onClick={() => setSelectedPeriodId(period.id)}
                    className={[
                      "grid w-full gap-2 rounded-[18px] border px-4 py-4 text-left transition",
                      "border-[rgba(31,41,55,0.1)] bg-white/78 hover:-translate-y-px hover:border-[rgba(23,32,51,0.2)]",
                      selectedPeriodId === period.id
                        ? "border-[rgba(23,32,51,0.32)] bg-[#fffdf9]"
                        : "",
                    ].join(" ")}
                  >
                    <span className="text-lg font-semibold text-[var(--text)]">
                      {period.label}
                    </span>
                    <span
                      className={returnClassName(period.qqq)}
                    >
                      {primaryTickerLabel}{" "}
                      {period.qqq === null ? "N/A" : formatPercent(period.qqq)}
                    </span>
                    <span
                      className={returnClassName(period.tqqq)}
                    >
                      {comparisonTickerLabel}{" "}
                      {period.tqqq === null ? "N/A" : formatPercent(period.tqqq)}
                    </span>
                  </button>
                ))}
              </div>

              <div className="relative h-[420px] px-0 pb-6">
                <div className="pointer-events-none absolute top-4 left-5 z-10 flex flex-wrap gap-2">
                  <ChartLegendPill label={primaryTickerLabel} color={COLORS.QQQ} />
                  <ChartLegendPill label={comparisonTickerLabel} color={COLORS.TQQQ} />
                </div>
                <ChartHoverOverlay
                  onRootRef={(node) => {
                    detailHoverOverlayRef.current.root = node;
                  }}
                  onQqqRef={(node) => {
                    detailHoverOverlayRef.current.qqq = node;
                  }}
                  onTqqqRef={(node) => {
                    detailHoverOverlayRef.current.tqqq = node;
                  }}
                />
                <div ref={detailContainerRef} className={surfaceClassName} />
              </div>
            </div>
          </CardContent>
          <div className="px-6 pb-6 text-[13px] text-[var(--muted-text)]">
            기간 카드를 누르면 1개월/3개월/6개월/1년/5년 중 원하는 비교
            구간으로 즉시 전환됩니다.
          </div>
        </Card>

        <Card className={panelClassName}>
          <CardHeader className="gap-4 px-6 pt-6 pb-3 md:grid-cols-[1fr_auto] md:items-end">
            <div className="space-y-2">
              <CardTitle className="text-3xl font-semibold tracking-[-0.03em] text-[var(--text)]">
                {selectedPeriod.label} forward return comparison
              </CardTitle>
              <CardDescription className="text-[15px] leading-6 text-[var(--muted-text)]">
                {forwardRangeLabel}
              </CardDescription>
            </div>
            {forwardStatus.hasData ? (
              <div className="flex flex-wrap items-center justify-end gap-2">
                <DetailStatusPill
                  label={primaryTickerLabel}
                  value={forwardStatus.qqq}
                  color={COLORS.QQQ}
                  highlighted={forwardStatus.highlights.includes("QQQ")}
                />
                <span className="text-sm text-[var(--muted-text)]">/</span>
                <DetailStatusPill
                  label={comparisonTickerLabel}
                  value={forwardStatus.tqqq}
                  color={COLORS.TQQQ}
                  highlighted={forwardStatus.highlights.includes("TQQQ")}
                />
              </div>
            ) : (
              <p className="text-sm text-[var(--muted-text)]">{forwardStatus.message}</p>
            )}
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <div className="grid gap-5 px-5 pb-5 lg:grid-cols-[340px_minmax(0,1fr)]">
              <div className="grid content-start gap-2.5">
                {forwardPeriodReturns.map((period) => (
                  <button
                    key={period.id}
                    type="button"
                    onClick={() => setSelectedPeriodId(period.id)}
                    className={[
                      "grid w-full gap-2 rounded-[18px] border px-4 py-4 text-left transition",
                      "border-[rgba(31,41,55,0.1)] bg-white/78 hover:-translate-y-px hover:border-[rgba(23,32,51,0.2)]",
                      selectedPeriodId === period.id
                        ? "border-[rgba(23,32,51,0.32)] bg-[#fffdf9]"
                        : "",
                    ].join(" ")}
                  >
                    <span className="text-lg font-semibold text-[var(--text)]">
                      {period.label}
                    </span>
                    <span className={returnClassName(period.qqq)}>
                      {primaryTickerLabel}{" "}
                      {period.qqq === null ? "N/A" : formatPercent(period.qqq)}
                    </span>
                    <span className={returnClassName(period.tqqq)}>
                      {comparisonTickerLabel}{" "}
                      {period.tqqq === null ? "N/A" : formatPercent(period.tqqq)}
                    </span>
                  </button>
                ))}
              </div>

              <div className="relative h-[420px] px-0 pb-6">
                <div className="pointer-events-none absolute top-4 left-5 z-10 flex flex-wrap gap-2">
                  <ChartLegendPill label={primaryTickerLabel} color={COLORS.QQQ} />
                  <ChartLegendPill label={comparisonTickerLabel} color={COLORS.TQQQ} />
                </div>
                <ChartHoverOverlay
                  onRootRef={(node) => {
                    forwardHoverOverlayRef.current.root = node;
                  }}
                  onQqqRef={(node) => {
                    forwardHoverOverlayRef.current.qqq = node;
                  }}
                  onTqqqRef={(node) => {
                    forwardHoverOverlayRef.current.tqqq = node;
                  }}
                />
                <div ref={forwardContainerRef} className={surfaceClassName} />
              </div>
            </div>
          </CardContent>
          <div className="px-6 pb-6 text-[13px] text-[var(--muted-text)]">
            기준 시점 이후 미래 구간을 비교합니다. 선택한 기간이 끝까지
            채워지지 않으면 마지막 존재 데이터까지만 반영됩니다.
          </div>
        </Card>
      </section>
    </main>
  );
}

function SummaryCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <Card className={`${panelClassName} gap-3 px-5 py-4`}>
      <p className="m-0 text-xs font-bold uppercase tracking-[0.08em] text-[var(--muted-text)]">
        {label}
      </p>
      <p className="m-0 text-2xl font-semibold text-[var(--text)]">{value}</p>
      <p className="m-0 text-sm leading-6 text-[var(--muted-text)]">{detail}</p>
    </Card>
  );
}

function Pill({ label, color }: { label: string; color: string }) {
  return (
    <Badge
      variant="outline"
      className="rounded-full border-[var(--line)] bg-white/72 px-3 py-2 text-[13px] font-medium text-[var(--text)]"
    >
      <span
        className="size-2.5 rounded-full"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      {label}
    </Badge>
  );
}

function ChartLegendPill({ label, color }: { label: string; color: string }) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-[var(--line)] bg-white/86 px-3 py-1.5 text-[12px] font-semibold text-[var(--text)] shadow-sm">
      <span
        className="h-[3px] w-5 rounded-full"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      {label}
    </div>
  );
}

function TickerSuggestionList({
  suggestions,
  loading,
  onSelect,
}: {
  suggestions: TickerSuggestion[];
  loading: boolean;
  onSelect: (suggestion: TickerSuggestion) => void;
}) {
  return (
    <div className="absolute top-full left-0 z-20 mt-2 max-h-72 w-full overflow-auto rounded-[22px] border border-[rgba(23,32,51,0.12)] bg-[#fffdf8] p-2 shadow-[0_18px_40px_rgba(16,24,40,0.14)]">
      {loading ? (
        <div className="rounded-2xl px-3 py-3 text-xs font-medium text-[var(--muted-text)]">
          Searching symbols...
        </div>
      ) : suggestions.length === 0 ? (
        <div className="rounded-2xl px-3 py-3 text-xs font-medium text-[var(--muted-text)]">
          No matching symbols.
        </div>
      ) : (
        <div className="grid gap-1">
          {suggestions.map((suggestion) => (
            <button
              key={`${suggestion.symbol}-${suggestion.exchange}-${suggestion.asset}`}
              type="button"
              onClick={() => onSelect(suggestion)}
              className="grid gap-0.5 rounded-2xl px-3 py-2 text-left transition hover:bg-[rgba(23,32,51,0.06)]"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-bold text-[var(--text)]">
                  {suggestion.symbol}
                </span>
                <span className="text-[11px] font-semibold text-[var(--muted-text)]">
                  {suggestion.exchange}
                </span>
              </div>
              <div className="truncate text-[12px] font-medium text-[var(--muted-text)]">
                {suggestion.name}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ChartHoverOverlay({
  onRootRef,
  onQqqRef,
  onTqqqRef,
}: {
  onRootRef: (node: HTMLDivElement | null) => void;
  onQqqRef: (node: HTMLSpanElement | null) => void;
  onTqqqRef: (node: HTMLSpanElement | null) => void;
}) {
  return (
    <div
      ref={onRootRef}
      className="pointer-events-none absolute inset-0 z-10 hidden"
    >
      <span
        ref={onQqqRef}
        className="absolute right-1 hidden -translate-y-1/2 rounded-[6px] bg-[#0b6e4f] px-2 py-1 text-[13px] font-semibold tracking-[0.01em] text-white shadow-[0_10px_24px_rgba(11,110,79,0.28)]"
      />
      <span
        ref={onTqqqRef}
        className="absolute right-1 hidden -translate-y-1/2 rounded-[6px] bg-[#ba181b] px-2 py-1 text-[13px] font-semibold tracking-[0.01em] text-white shadow-[0_10px_24px_rgba(186,24,27,0.28)]"
      />
    </div>
  );
}

function DetailStatusPill({
  label,
  value,
  color,
  highlighted,
}: {
  label: string;
  value: number | null;
  color: string;
  highlighted: boolean;
}) {
  const returnTone = getReturnTone(value);

  return (
    <span
      className={[
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition",
        highlighted
          ? "font-semibold text-[var(--text)] shadow-sm"
          : "bg-white/74 font-medium text-[var(--muted-text)]",
      ].join(" ")}
      style={{
        borderColor: highlighted ? hexToRgba(color, 0.38) : "rgba(31, 41, 55, 0.1)",
        backgroundColor: highlighted ? hexToRgba(color, 0.14) : undefined,
      }}
    >
      <span
        className={highlighted ? "font-bold" : "font-semibold"}
        style={{ color }}
      >
        {label}
      </span>
      <span
        className={[
          highlighted ? "text-[15px] font-bold" : "font-semibold",
          returnTone.className,
        ].join(" ")}
      >
        {value === null ? "N/A" : formatPercent(value)}
      </span>
    </span>
  );
}

function HistoryComparisonSummary({
  label,
  primaryLabel,
  comparisonLabel,
  selectedPeriodId,
  status,
  onSelectPeriodId,
}: {
  label: string;
  primaryLabel: string;
  comparisonLabel: string;
  selectedPeriodId: PeriodId;
  status: ComparisonStatus;
  onSelectPeriodId: (periodId: PeriodId) => void;
}) {
  return (
    <div className="rounded-[22px] border border-[var(--line)] bg-white/72 px-4 py-3 shadow-sm">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--muted-text)]">
          {label} {periodLabelFromId(selectedPeriodId)}
        </p>
        <div className="flex flex-wrap gap-1">
          {PERIODS.map((period) => (
            <button
              key={`${label}-${period.id}`}
              type="button"
              onClick={() => onSelectPeriodId(period.id)}
              className={[
                "rounded-full border px-2 py-0.5 text-[11px] font-semibold transition",
                selectedPeriodId === period.id
                  ? "border-[rgba(23,32,51,0.24)] bg-[rgba(23,32,51,0.08)] text-[var(--text)]"
                  : "border-[rgba(31,41,55,0.08)] bg-white/70 text-[var(--muted-text)] hover:border-[rgba(23,32,51,0.16)] hover:text-[var(--text)]",
              ].join(" ")}
            >
              {period.label}
            </button>
          ))}
        </div>
      </div>
      {status.hasData ? (
        <div className="flex flex-wrap items-center gap-2">
          <DetailStatusPill
            label={primaryLabel}
            value={status.qqq}
            color={COLORS.QQQ}
            highlighted={status.highlights.includes("QQQ")}
          />
          <span className="text-sm text-[var(--muted-text)]">/</span>
          <DetailStatusPill
            label={comparisonLabel}
            value={status.tqqq}
            color={COLORS.TQQQ}
            highlighted={status.highlights.includes("TQQQ")}
          />
        </div>
      ) : (
        <p className="text-sm leading-6 text-[var(--muted-text)]">{status.message}</p>
      )}
    </div>
  );
}

function periodLabelFromId(periodId: PeriodId): string {
  return PERIODS.find((period) => period.id === periodId)?.label ?? "6M";
}

function buildComparisonStatus(
  qqq: number | null,
  tqqq: number | null,
  emptyMessage: string
): ComparisonStatus {
  if (qqq === null && tqqq === null) {
    return {
      hasData: false,
      message: emptyMessage,
      qqq: null,
      tqqq: null,
      highlights: [],
    };
  }

  let highlights: Array<"QQQ" | "TQQQ"> = [];
  if (qqq !== null && tqqq !== null) {
    if (qqq > tqqq) {
      highlights = ["QQQ"];
    } else if (tqqq > qqq) {
      highlights = ["TQQQ"];
    } else {
      highlights = ["QQQ", "TQQQ"];
    }
  } else if (qqq !== null) {
    highlights = ["QQQ"];
  } else if (tqqq !== null) {
    highlights = ["TQQQ"];
  }

  return {
    hasData: true,
    message: null,
    qqq,
    tqqq,
    highlights,
  };
}

function returnClassName(value: number | null): string {
  if (value === null) {
    return "text-sm text-[#4b5563]";
  }

  return value >= 0
    ? "text-sm font-medium text-[#0b6e4f]"
    : "text-sm font-medium text-[#ba181b]";
}

function getReturnTone(value: number | null): { className: string } {
  if (value === null) {
    return {
      className: "text-[#475569]",
    };
  }

  return value >= 0
    ? {
        className: "text-[#0b6e4f]",
      }
    : {
        className: "text-[#ba181b]",
      };
}

function isChartPayload(value: unknown): value is ChartPayload {
  return (
    typeof value === "object" &&
    value !== null &&
    "tickers" in value &&
    "symbols" in value &&
    "generatedAt" in value &&
    "source" in value
  );
}

function isTextEditingElement(target: Element | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName;
  return (
    tagName === "INPUT" ||
    tagName === "TEXTAREA" ||
    tagName === "SELECT" ||
    target.isContentEditable
  );
}

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace("#", "");
  const fullHex =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => char + char)
          .join("")
      : normalized;

  const red = parseInt(fullHex.slice(0, 2), 16);
  const green = parseInt(fullHex.slice(2, 4), 16);
  const blue = parseInt(fullHex.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function syncHoverOverlay(
  overlayRefs: HoverOverlayElementRefs,
  param: MouseEventParams<Time>,
  seriesRefs: SeriesRefs
): void {
  if (!overlayRefs.root || !overlayRefs.qqq || !overlayRefs.tqqq) {
    return;
  }

  if (!param.point || !param.time || !seriesRefs.QQQ || !seriesRefs.TQQQ) {
    hideHoverOverlay(overlayRefs);
    return;
  }

  const qqqValue = getLineValue(param.seriesData.get(seriesRefs.QQQ));
  const tqqqValue = getLineValue(param.seriesData.get(seriesRefs.TQQQ));

  if (qqqValue === null && tqqqValue === null) {
    hideHoverOverlay(overlayRefs);
    return;
  }

  overlayRefs.root.style.display = "block";

  const qqqY =
    qqqValue === null ? null : seriesRefs.QQQ.priceToCoordinate(qqqValue);
  const tqqqY =
    tqqqValue === null ? null : seriesRefs.TQQQ.priceToCoordinate(tqqqValue);

  const positions = resolveAxisLabelPositions(
    overlayRefs.root.clientHeight,
    overlayRefs.qqq.offsetHeight || 30,
    overlayRefs.tqqq.offsetHeight || 30,
    qqqY,
    tqqqY
  );

  applyAxisHoverLabel(
    overlayRefs.qqq,
    qqqValue,
    positions.qqq
  );
  applyAxisHoverLabel(
    overlayRefs.tqqq,
    tqqqValue,
    positions.tqqq
  );
}

function hideHoverOverlay(overlayRefs: HoverOverlayElementRefs): void {
  if (overlayRefs.root) {
    overlayRefs.root.style.display = "none";
  }
  if (overlayRefs.qqq) {
    overlayRefs.qqq.style.display = "none";
  }
  if (overlayRefs.tqqq) {
    overlayRefs.tqqq.style.display = "none";
  }
}

function getLineValue(data: unknown): number | null {
  if (
    typeof data === "object" &&
    data !== null &&
    "value" in data &&
    typeof data.value === "number"
  ) {
    return data.value;
  }

  return null;
}

function formatHoverValue(value: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function applyAxisHoverLabel(
  element: HTMLSpanElement,
  value: number | null,
  top: number | null
): void {
  if (value === null || top === null) {
    element.style.display = "none";
    return;
  }

  element.style.display = "block";
  element.style.top = `${top}px`;
  element.textContent = formatHoverValue(value);
}

function resolveAxisLabelPositions(
  containerHeight: number,
  qqqHeight: number,
  tqqqHeight: number,
  qqqY: number | null,
  tqqqY: number | null
): { qqq: number | null; tqqq: number | null } {
  const padding = 8;
  const minGap = 8;

  let qqqTop = clampAxisY(qqqY, qqqHeight, containerHeight, padding);
  let tqqqTop = clampAxisY(tqqqY, tqqqHeight, containerHeight, padding);

  if (qqqTop === null || tqqqTop === null) {
    return { qqq: qqqTop, tqqq: tqqqTop };
  }

  const requiredGap = (qqqHeight + tqqqHeight) / 2 + minGap;
  const currentGap = Math.abs(qqqTop - tqqqTop);

  if (currentGap >= requiredGap) {
    return { qqq: qqqTop, tqqq: tqqqTop };
  }

  const midpoint = (qqqTop + tqqqTop) / 2;
  qqqTop = midpoint - requiredGap / 2;
  tqqqTop = midpoint + requiredGap / 2;

  qqqTop = clampAxisY(qqqTop, qqqHeight, containerHeight, padding) ?? qqqTop;
  tqqqTop = clampAxisY(tqqqTop, tqqqHeight, containerHeight, padding) ?? tqqqTop;

  if (qqqTop + requiredGap > tqqqTop) {
    qqqTop = Math.max(padding + qqqHeight / 2, tqqqTop - requiredGap);
    tqqqTop = Math.min(
      containerHeight - padding - tqqqHeight / 2,
      qqqTop + requiredGap
    );
  }

  return { qqq: qqqTop, tqqq: tqqqTop };
}

function clampAxisY(
  y: number | null,
  labelHeight: number,
  containerHeight: number,
  padding: number
): number | null {
  if (y === null || Number.isNaN(y)) {
    return null;
  }

  const min = padding + labelHeight / 2;
  const max = containerHeight - padding - labelHeight / 2;
  return Math.min(Math.max(y, min), max);
}

function createBaseChart(
  container: HTMLDivElement,
  height: number
): IChartApi {
  return createChart(container, {
    width: container.clientWidth,
    height,
    layout: {
      background: {
        type: ColorType.Solid,
        color: "#fffaf3",
      },
      textColor: "#1f2937",
      fontFamily:
        '"IBM Plex Sans KR", "Pretendard Variable", "SUIT", "Apple SD Gothic Neo", sans-serif',
    },
    grid: {
      vertLines: { color: "rgba(48, 66, 87, 0.08)" },
      horzLines: { color: "rgba(48, 66, 87, 0.08)" },
    },
    rightPriceScale: {
      borderColor: "rgba(48, 66, 87, 0.18)",
    },
    timeScale: {
      borderColor: "rgba(48, 66, 87, 0.18)",
      timeVisible: true,
      secondsVisible: false,
    },
    crosshair: {
      vertLine: {
        color: "rgba(23, 32, 51, 0.24)",
        width: 1,
        style: LineStyle.Dashed,
      },
      horzLine: {
        color: "rgba(23, 32, 51, 0.16)",
        width: 1,
        style: LineStyle.Dashed,
        labelVisible: false,
      },
    },
    handleScroll: {
      mouseWheel: true,
      pressedMouseMove: true,
      horzTouchDrag: true,
      vertTouchDrag: false,
    },
    handleScale: {
      axisPressedMouseMove: true,
      mouseWheel: true,
      pinch: true,
    },
    localization: {
      locale: "ko-KR",
      timeFormatter: (time: Time) => timeToDateKey(time),
    },
  });
}

function applyNavigatorScale(chart: IChartApi, mode: ScaleMode): void {
  chart.priceScale("right").applyOptions({
    mode: mode === "log" ? PriceScaleMode.Logarithmic : PriceScaleMode.Normal,
  });
}

function toBusinessDay(dateKey: string): Time {
  const [year, month, day] = dateKey.split("-").map(Number);
  return {
    year,
    month,
    day,
  };
}

function resolveInitialVisibleFrom(
  latestCommonDate: string,
  overlapAnchorDate: string
): string {
  const recentWindowStart = subtractMonthsKey(latestCommonDate, 60);
  return recentWindowStart < overlapAnchorDate
    ? overlapAnchorDate
    : recentWindowStart;
}

function buildYearOptions(minDateKey: string, maxDateKey: string): number[] {
  const minYear = Number(minDateKey.slice(0, 4));
  const maxYear = Number(maxDateKey.slice(0, 4));
  return Array.from({ length: maxYear - minYear + 1 }, (_, index) => minYear + index);
}

function buildDayOptions(year: number, month: number): number[] {
  return Array.from({ length: getDaysInMonth(year, month) }, (_, index) => index + 1);
}

function clampDateKey(dateKey: string, minDateKey: string, maxDateKey: string): string {
  if (dateKey < minDateKey) {
    return minDateKey;
  }
  if (dateKey > maxDateKey) {
    return maxDateKey;
  }
  return dateKey;
}

function getMonthKey(dateKey: string): string {
  return dateKey.slice(0, 7);
}

function formatMonthLabel(monthKey: string): string {
  return `${Number(monthKey.slice(0, 4))}년 ${Number(monthKey.slice(5, 7))}월`;
}

function shiftMonthKey(monthKey: string, delta: number): string {
  const year = Number(monthKey.slice(0, 4));
  const monthIndex = Number(monthKey.slice(5, 7)) - 1;
  const shifted = new Date(Date.UTC(year, monthIndex + delta, 1));
  return `${shifted.getUTCFullYear()}-${padNumber(shifted.getUTCMonth() + 1)}`;
}

function setDateKeyParts(
  dateKey: string,
  nextParts: Partial<{ year: number; month: number; day: number }>
): string {
  const year = nextParts.year ?? Number(dateKey.slice(0, 4));
  const month = nextParts.month ?? Number(dateKey.slice(5, 7));
  const day = Math.min(
    nextParts.day ?? Number(dateKey.slice(8, 10)),
    getDaysInMonth(year, month)
  );

  return `${padNumber(year, 4)}-${padNumber(month)}-${padNumber(day)}`;
}

function buildCalendarCells(
  monthKey: string,
  minDateKey: string,
  maxDateKey: string
): CalendarCell[] {
  const year = Number(monthKey.slice(0, 4));
  const month = Number(monthKey.slice(5, 7));
  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const startWeekday = firstOfMonth.getUTCDay();
  const startDate = new Date(Date.UTC(year, month - 1, 1 - startWeekday));

  return Array.from({ length: 42 }, (_, index) => {
    const current = new Date(startDate);
    current.setUTCDate(startDate.getUTCDate() + index);
    const currentYear = current.getUTCFullYear();
    const currentMonth = current.getUTCMonth() + 1;
    const dateKey = `${padNumber(currentYear, 4)}-${padNumber(currentMonth)}-${padNumber(
      current.getUTCDate()
    )}`;

    return {
      dateKey,
      day: current.getUTCDate(),
      inMonth: currentMonth === month,
      disabled: dateKey < minDateKey || dateKey > maxDateKey,
    };
  });
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function padNumber(value: number, length = 2): string {
  return String(value).padStart(length, "0");
}
