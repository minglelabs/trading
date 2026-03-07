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
  buildTickerData,
  buildWindowData,
  calculateTrailingReturn,
  ChartPayload,
  COLORS,
  findNearestCommonDate,
  formatDate,
  formatDateTime,
  formatPercent,
  getLatestCommonDate,
  getOverlapAnchorDate,
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

interface RollingComparisonProps {
  initialData: ChartPayload | null;
}

const panelClassName =
  "overflow-hidden rounded-[28px] border border-[var(--line)] bg-[var(--paper)] shadow-[var(--shadow)] ring-0";

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
  const initialVisibleFrom = useMemo(
    () => (latestCommonDate ? subtractMonthsKey(latestCommonDate, 60) : null),
    [latestCommonDate]
  );

  const navigatorContainerRef = useRef<HTMLDivElement | null>(null);
  const detailContainerRef = useRef<HTMLDivElement | null>(null);
  const navigatorChartRef = useRef<IChartApi | null>(null);
  const detailChartRef = useRef<IChartApi | null>(null);
  const navigatorSeriesRef = useRef<SeriesRefs>({ QQQ: null, TQQQ: null });
  const detailSeriesRef = useRef<SeriesRefs>({ QQQ: null, TQQQ: null });

  const [selectedPeriodId, setSelectedPeriodId] = useState<PeriodId>("1y");
  const [navigatorScaleMode, setNavigatorScaleMode] =
    useState<ScaleMode>("log");
  const [anchorDate, setAnchorDate] = useState<string | null>(latestCommonDate);
  const [visibleWindowFrom, setVisibleWindowFrom] =
    useState<string | null>(initialVisibleFrom);

  const selectedPeriod = useMemo(
    () => PERIODS.find((period) => period.id === selectedPeriodId) ?? PERIODS[3],
    [selectedPeriodId]
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

  const detailStatusText = useMemo(() => {
    if (!qqqDetailWindow && !tqqqDetailWindow) {
      return "선택한 기준일에서는 QQQ/TQQQ 모두 해당 기간 데이터가 없습니다.";
    }

    const qqqText = qqqDetailWindow
      ? `QQQ ${formatPercent(qqqDetailWindow.returnPct)}`
      : "QQQ N/A";
    const tqqqText = tqqqDetailWindow
      ? `TQQQ ${formatPercent(tqqqDetailWindow.returnPct)}`
      : "TQQQ N/A";
    return `${qqqText} / ${tqqqText}`;
  }, [qqqDetailWindow, tqqqDetailWindow]);

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

  useEffect(() => {
    if (
      !tickerData ||
      !latestCommonDate ||
      !overlapAnchorDate ||
      !initialVisibleFrom ||
      !navigatorContainerRef.current ||
      !detailContainerRef.current
    ) {
      return;
    }

    const navigatorChart = createBaseChart(
      navigatorContainerRef.current,
      NAVIGATOR_HEIGHT
    );
    const detailChart = createBaseChart(detailContainerRef.current, DETAIL_HEIGHT);

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

    navigatorQqq.setData(
      normalizeAgainstDate(tickerData.QQQ.rows, overlapAnchorDate) as LineData<Time>[]
    );
    navigatorTqqq.setData(
      normalizeAgainstDate(tickerData.TQQQ.rows, overlapAnchorDate) as LineData<Time>[]
    );

    navigatorChartRef.current = navigatorChart;
    detailChartRef.current = detailChart;
    navigatorSeriesRef.current = { QQQ: navigatorQqq, TQQQ: navigatorTqqq };
    detailSeriesRef.current = { QQQ: detailQqq, TQQQ: detailTqqq };

    const initialRange = {
      from: toBusinessDay(initialVisibleFrom),
      to: toBusinessDay(latestCommonDate),
    };
    navigatorChart.timeScale().setVisibleRange(initialRange);
    navigatorChart.timeScale().subscribeVisibleTimeRangeChange(
      handleVisibleRangeChange
    );
    handleVisibleRangeChange(initialRange);

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
    });

    resizeObserver.observe(navigatorContainerRef.current);
    resizeObserver.observe(detailContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      navigatorChart.timeScale().unsubscribeVisibleTimeRangeChange(
        handleVisibleRangeChange
      );
      navigatorChart.remove();
      detailChart.remove();
      navigatorChartRef.current = null;
      detailChartRef.current = null;
      navigatorSeriesRef.current = { QQQ: null, TQQQ: null };
      detailSeriesRef.current = { QQQ: null, TQQQ: null };
    };
  }, [
    initialVisibleFrom,
    latestCommonDate,
    overlapAnchorDate,
    tickerData,
  ]);

  useEffect(() => {
    if (!navigatorChartRef.current) {
      return;
    }

    applyNavigatorScale(navigatorChartRef.current, navigatorScaleMode);
  }, [navigatorScaleMode]);

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

  if (!initialData || !tickerData || !latestCommonDate) {
    return (
      <main className="mx-auto min-h-screen w-[min(1320px,calc(100%-32px))] py-7 sm:py-12">
        <Card className={panelClassName}>
          <CardHeader className="gap-4 px-7 py-7">
            <CardTitle className="text-3xl font-semibold tracking-[-0.04em] text-[var(--text)]">
              차트 데이터 파일이 없습니다.
            </CardTitle>
            <CardDescription className="max-w-3xl text-base leading-7 text-[var(--muted)]">
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
            <p className="m-0 text-xs font-bold uppercase tracking-[0.12em] text-[var(--muted)]">
              TradingView Lightweight Charts
            </p>
            <CardTitle className="text-[clamp(2.125rem,6vw,4rem)] leading-[0.96] font-semibold tracking-[-0.04em] text-[var(--text)]">
              QQQ / TQQQ Rolling Comparison
            </CardTitle>
            <CardDescription className="max-w-4xl text-base leading-7 text-[var(--muted)]">
              위 차트는 TradingView의 공식 차트 라이브러리인 Lightweight
              Charts로 구성했습니다. 상단 히스토리 차트를 좌우로 드래그하면
              기준 시점이 바뀌고, 아래의 trailing 수익률 비교가 즉시 다시
              계산됩니다. 상단 네비게이터는 QQQ와 TQQQ를 모두 TQQQ 상장일
              종가=100으로 정규화한 누적 상대지수입니다.
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
            value={`${tickerData.QQQ.firstDate} ~ ${latestCommonDate}`}
            detail={`상단 네비게이터는 ${tickerData.TQQQ.firstDate} 기준 QQQ/TQQQ를 모두 100으로 맞춥니다.`}
          />
          <SummaryCard
            label="마지막 갱신"
            value={formatDateTime(initialData.generatedAt)}
            detail={`소스: ${initialData.source} / python refresh_data.py 로 다시 생성 가능합니다.`}
          />
        </section>

        <Card className={panelClassName}>
          <CardHeader className="gap-4 px-6 pt-6 pb-3 md:grid-cols-[1fr_auto] md:items-end">
            <div className="space-y-2">
              <CardTitle className="text-3xl font-semibold tracking-[-0.03em] text-[var(--text)]">
                전체 히스토리 네비게이터
              </CardTitle>
              <CardDescription className="max-w-4xl text-[15px] leading-6 text-[var(--muted)]">
                QQQ와 TQQQ를 모두 TQQQ 상장일 종가=100으로 맞춘 누적 상대지수입니다.
                이 차트를 좌우로 움직이면 아래의 기간별 비교 기준일이 바뀝니다.
              </CardDescription>
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
            <div className="h-[340px] px-1 pb-6">
              <div ref={navigatorContainerRef} className={surfaceClassName} />
            </div>
          </CardContent>
          <div className="px-6 pb-6 text-[13px] text-[var(--muted)]">
            기준 시점은 현재 보이는 오른쪽 끝 날짜를 따라갑니다.
          </div>
        </Card>

        <Card className={panelClassName}>
          <CardHeader className="gap-4 px-6 pt-6 pb-3 md:grid-cols-[1fr_auto] md:items-end">
            <div className="space-y-2">
              <CardTitle className="text-3xl font-semibold tracking-[-0.03em] text-[var(--text)]">
                {selectedPeriod.label} trailing return comparison
              </CardTitle>
              <CardDescription className="text-[15px] leading-6 text-[var(--muted)]">
                {detailRangeLabel}
              </CardDescription>
            </div>
            <p className="text-sm text-[var(--muted)]">{detailStatusText}</p>
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

              <div className="h-[420px] px-0 pb-6">
                <div ref={detailContainerRef} className={surfaceClassName} />
              </div>
            </div>
          </CardContent>
          <div className="px-6 pb-6 text-[13px] text-[var(--muted)]">
            기간 카드를 누르면 1개월/3개월/6개월/1년/5년 중 원하는 비교
            구간으로 즉시 전환됩니다.
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
      <p className="m-0 text-xs font-bold uppercase tracking-[0.08em] text-[var(--muted)]">
        {label}
      </p>
      <p className="m-0 text-2xl font-semibold text-[var(--text)]">{value}</p>
      <p className="m-0 text-sm leading-6 text-[var(--muted)]">{detail}</p>
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

function returnClassName(value: number | null): string {
  if (value === null) {
    return "text-sm text-[#97a0af]";
  }

  return value >= 0
    ? "text-sm font-medium text-[#0b6e4f]"
    : "text-sm font-medium text-[#ba181b]";
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
      textColor: "#304257",
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
