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

import { Badge } from "@/components/ui/badge";
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

interface RollingComparisonProps {
  initialData: ChartPayload | null;
}

const panelClassName =
  "overflow-visible rounded-[28px] border border-[var(--line)] bg-[var(--paper)] shadow-[var(--shadow)] ring-0";

const surfaceClassName =
  "h-full w-full overflow-visible rounded-[20px] border border-[rgba(31,41,55,0.08)] bg-[#fffaf3]";

export function RollingComparison({
  initialData,
}: RollingComparisonProps): React.JSX.Element {
  const tickerData = useMemo(
    () => (initialData ? buildTickerData(initialData) : null),
    [initialData]
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

      const recentWindowStart = subtractMonthsKey(latestCommonDate, 60);
      return recentWindowStart < overlapAnchorDate
        ? overlapAnchorDate
        : recentWindowStart;
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
      "선택한 기준일에서는 QQQ/TQQQ 모두 해당 기간 데이터가 없습니다."
    );
  }, [qqqDetailWindow, tqqqDetailWindow]);
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
      "선택한 기준일 이후에는 QQQ/TQQQ 미래 데이터가 없습니다."
    );
  }, [qqqForwardWindow, tqqqForwardWindow]);
  const historyTrailingStatus = useMemo(() => {
    if (!tickerData || !anchorDate) {
      return buildComparisonStatus(
        null,
        null,
        "선택한 기준일에서는 QQQ/TQQQ 모두 해당 기간 데이터가 없습니다."
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
      "선택한 기준일에서는 QQQ/TQQQ 모두 해당 기간 데이터가 없습니다."
    );
  }, [anchorDate, historyTrailingPeriod, tickerData]);
  const historyForwardStatus = useMemo(() => {
    if (!tickerData || !anchorDate) {
      return buildComparisonStatus(
        null,
        null,
        "선택한 기준일 이후에는 QQQ/TQQQ 미래 데이터가 없습니다."
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
      "선택한 기준일 이후에는 QQQ/TQQQ 미래 데이터가 없습니다."
    );
  }, [anchorDate, historyForwardPeriod, tickerData]);

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

  if (!initialData || !tickerData || !latestCommonDate || !overlapAnchorDate) {
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
              QQQ / TQQQ Rolling Comparison
            </CardTitle>
            <CardDescription className="max-w-4xl text-base leading-7 text-[var(--muted-text)]">
              위 차트는 TradingView의 공식 차트 라이브러리인 Lightweight
              Charts로 구성했습니다. 상단 전체 히스토리 차트를 좌우로
              드래그하면
              기준 시점이 바뀌고, 아래의 trailing/forward 수익률 비교가 즉시
              다시 계산됩니다. 상단 전체 히스토리 차트는 TQQQ 상장일 종가를
              QQQ/TQQQ 모두 100으로 맞춘 상대지수입니다.
            </CardDescription>
            <div className="flex flex-wrap gap-2.5">
              <Pill label="QQQ" color={COLORS.QQQ} />
              <Pill label="TQQQ" color={COLORS.TQQQ} />
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
            detail={`${formatDate(overlapAnchorDate)} 종가를 QQQ/TQQQ 모두 100으로 맞춘 상대지수입니다.`}
          />
          <SummaryCard
            label="마지막 갱신"
            value={formatDateTime(initialData.generatedAt)}
            detail={`소스: ${initialData.source} / python refresh_data.py 로 다시 생성 가능합니다.`}
          />
        </section>

        <Card className={panelClassName}>
          <CardHeader className="gap-5 px-6 pt-6 pb-3 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.95fr)_auto] xl:items-start">
            <div className="space-y-2 xl:max-w-3xl">
              <CardTitle className="text-3xl font-semibold tracking-[-0.03em] text-[var(--text)]">
                전체 히스토리 차트
              </CardTitle>
              <CardDescription className="max-w-4xl text-[15px] leading-6 text-[var(--muted-text)]">
                TQQQ 상장일인 {formatDate(overlapAnchorDate)} 종가를
                QQQ/TQQQ 모두 100으로 맞춘 상대지수입니다. 이 차트를 좌우로
                움직이면 아래 기간별 비교의 기준일이 바뀝니다.
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
            <div className="grid gap-3 xl:pt-1">
              <HistoryComparisonSummary
                label="트레일링"
                selectedPeriodId={historyTrailingPeriodId}
                status={historyTrailingStatus}
                onSelectPeriodId={setHistoryTrailingPeriodId}
              />
              <HistoryComparisonSummary
                label="포워드"
                selectedPeriodId={historyForwardPeriodId}
                status={historyForwardStatus}
                onSelectPeriodId={setHistoryForwardPeriodId}
              />
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
                <ChartLegendPill label="QQQ" color={COLORS.QQQ} />
                <ChartLegendPill label="TQQQ" color={COLORS.TQQQ} />
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
                  label="QQQ"
                  value={detailStatus.qqq}
                  color={COLORS.QQQ}
                  highlighted={detailStatus.highlights.includes("QQQ")}
                />
                <span className="text-sm text-[var(--muted-text)]">/</span>
                <DetailStatusPill
                  label="TQQQ"
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
                      QQQ {period.qqq === null ? "N/A" : formatPercent(period.qqq)}
                    </span>
                    <span
                      className={returnClassName(period.tqqq)}
                    >
                      TQQQ{" "}
                      {period.tqqq === null ? "N/A" : formatPercent(period.tqqq)}
                    </span>
                  </button>
                ))}
              </div>

              <div className="relative h-[420px] px-0 pb-6">
                <div className="pointer-events-none absolute top-4 left-5 z-10 flex flex-wrap gap-2">
                  <ChartLegendPill label="QQQ" color={COLORS.QQQ} />
                  <ChartLegendPill label="TQQQ" color={COLORS.TQQQ} />
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
                  label="QQQ"
                  value={forwardStatus.qqq}
                  color={COLORS.QQQ}
                  highlighted={forwardStatus.highlights.includes("QQQ")}
                />
                <span className="text-sm text-[var(--muted-text)]">/</span>
                <DetailStatusPill
                  label="TQQQ"
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
                      QQQ {period.qqq === null ? "N/A" : formatPercent(period.qqq)}
                    </span>
                    <span className={returnClassName(period.tqqq)}>
                      TQQQ {period.tqqq === null ? "N/A" : formatPercent(period.tqqq)}
                    </span>
                  </button>
                ))}
              </div>

              <div className="relative h-[420px] px-0 pb-6">
                <div className="pointer-events-none absolute top-4 left-5 z-10 flex flex-wrap gap-2">
                  <ChartLegendPill label="QQQ" color={COLORS.QQQ} />
                  <ChartLegendPill label="TQQQ" color={COLORS.TQQQ} />
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
  label: "QQQ" | "TQQQ";
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
  selectedPeriodId,
  status,
  onSelectPeriodId,
}: {
  label: string;
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
            label="QQQ"
            value={status.qqq}
            color={COLORS.QQQ}
            highlighted={status.highlights.includes("QQQ")}
          />
          <span className="text-sm text-[var(--muted-text)]">/</span>
          <DetailStatusPill
            label="TQQQ"
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
