(function () {
  const dataPayload = window.QQQ_TQQQ_DATA;

  if (!window.LightweightCharts || !dataPayload) {
    throw new Error("Required chart library or dataset is missing.");
  }

  const PERIODS = [
    { id: "1m", label: "1M", months: 1 },
    { id: "3m", label: "3M", months: 3 },
    { id: "6m", label: "6M", months: 6 },
    { id: "1y", label: "1Y", months: 12 },
    { id: "5y", label: "5Y", months: 60 },
  ];

  const COLORS = {
    QQQ: "#0b6e4f",
    TQQQ: "#ba181b",
  };

  const tickerData = Object.fromEntries(
    Object.entries(dataPayload.tickers).map(([ticker, meta]) => [
      ticker,
      {
        ...meta,
        rows: meta.rows.map(([time, value]) => ({ time, value })),
      },
    ])
  );

  const overlapAnchorDate = tickerData.TQQQ.rows[0].time;
  const latestCommonDate = minDate(
    tickerData.QQQ.rows[tickerData.QQQ.rows.length - 1].time,
    tickerData.TQQQ.rows[tickerData.TQQQ.rows.length - 1].time
  );

  const elements = {
    anchorDate: document.getElementById("anchor-date"),
    anchorWindow: document.getElementById("anchor-window"),
    periodCards: document.getElementById("period-cards"),
    detailTitle: document.getElementById("detail-title"),
    detailWindow: document.getElementById("detail-window"),
    detailStatus: document.getElementById("detail-status"),
    navigatorChart: document.getElementById("navigator-chart"),
    navigatorLogScale: document.getElementById("navigator-log-scale"),
    detailChart: document.getElementById("detail-chart"),
    generatedAt: document.getElementById("generated-at"),
    dataRange: document.getElementById("data-range"),
    coverage: document.getElementById("coverage-note"),
  };

  const state = {
    selectedPeriodId: "1y",
    anchorDate: latestCommonDate,
    navigatorScaleMode: "log",
  };

  elements.generatedAt.textContent = formatDateTime(dataPayload.generatedAt);
  elements.dataRange.textContent =
    `${tickerData.QQQ.firstDate} ~ ${latestCommonDate}`;
  elements.coverage.textContent =
    `상단 네비게이터는 ${tickerData.TQQQ.firstDate} 종가를 QQQ/TQQQ 모두 100으로 맞춘 누적 상대지수입니다. 이보다 이전 기준일에서는 TQQQ 수익률이 비어 있습니다.`;

  const navigatorChart = createBaseChart(elements.navigatorChart, 340);
  const detailChart = createBaseChart(elements.detailChart, 420);
  const navigatorSeries = {
    QQQ: navigatorChart.addLineSeries({
      color: COLORS.QQQ,
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    }),
    TQQQ: navigatorChart.addLineSeries({
      color: COLORS.TQQQ,
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    }),
  };
  const detailSeries = {
    QQQ: detailChart.addLineSeries({
      color: COLORS.QQQ,
      lineWidth: 3,
      priceLineVisible: false,
      lastValueVisible: true,
    }),
    TQQQ: detailChart.addLineSeries({
      color: COLORS.TQQQ,
      lineWidth: 3,
      priceLineVisible: false,
      lastValueVisible: true,
    }),
  };

  navigatorSeries.QQQ.setData(
    normalizeAgainstDate(tickerData.QQQ.rows, overlapAnchorDate)
  );
  navigatorSeries.TQQQ.setData(
    normalizeAgainstDate(tickerData.TQQQ.rows, overlapAnchorDate)
  );
  applyNavigatorScale();

  navigatorChart.timeScale().setVisibleRange({
    from: toBusinessDay(subtractMonthsKey(latestCommonDate, 60)),
    to: toBusinessDay(latestCommonDate),
  });

  const periodButtons = new Map();
  renderPeriodCards();
  updateAll();

  navigatorChart.timeScale().subscribeVisibleTimeRangeChange((range) => {
    if (!range || !range.to) {
      return;
    }

    const nextAnchor = findNearestCommonDate(timeToDateKey(range.to));
    if (!nextAnchor || nextAnchor === state.anchorDate) {
      return;
    }

    state.anchorDate = nextAnchor;
    updateAll();
  });

  elements.navigatorLogScale.checked = true;
  elements.navigatorLogScale.addEventListener("change", (event) => {
    state.navigatorScaleMode = event.target.checked ? "log" : "linear";
    applyNavigatorScale();
  });

  window.addEventListener("resize", () => {
    resizeChart(navigatorChart, elements.navigatorChart, 340);
    resizeChart(detailChart, elements.detailChart, 420);
  });

  function renderPeriodCards() {
    elements.periodCards.innerHTML = "";

    PERIODS.forEach((period) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "period-card";
      button.dataset.period = period.id;
      button.innerHTML = [
        `<span class="period-card__label">${period.label}</span>`,
        `<span class="period-card__return" data-field="qqq">QQQ -</span>`,
        `<span class="period-card__return" data-field="tqqq">TQQQ -</span>`,
      ].join("");
      button.addEventListener("click", () => {
        state.selectedPeriodId = period.id;
        updateAll();
      });
      elements.periodCards.appendChild(button);
      periodButtons.set(period.id, button);
    });
  }

  function updateAll() {
    updateSummary();
    updatePeriodCards();
    updateDetailChart();
  }

  function updateSummary() {
    const selectedPeriod = getSelectedPeriod();
    const selectedRange = buildWindowRange(selectedPeriod, state.anchorDate);
    const visibleRange = navigatorChart.timeScale().getVisibleRange();
    const visibleFrom = visibleRange && visibleRange.from ? timeToDateKey(visibleRange.from) : null;

    elements.anchorDate.textContent = formatDate(state.anchorDate);
    elements.anchorWindow.textContent = visibleFrom
      ? `${formatDate(visibleFrom)} ~ ${formatDate(state.anchorDate)}`
      : formatDate(state.anchorDate);
    elements.detailTitle.textContent =
      `${selectedPeriod.label} trailing return comparison`;
    elements.detailWindow.textContent = selectedRange
      ? `${formatDate(selectedRange.start)} ~ ${formatDate(selectedRange.end)}`
      : "선택 구간 데이터가 없습니다.";
  }

  function applyNavigatorScale() {
    navigatorChart.priceScale("right").applyOptions({
      mode:
        state.navigatorScaleMode === "log"
          ? LightweightCharts.PriceScaleMode.Logarithmic
          : LightweightCharts.PriceScaleMode.Normal,
    });
  }

  function updatePeriodCards() {
    PERIODS.forEach((period) => {
      const button = periodButtons.get(period.id);
      const qqq = calculateTrailingReturn(tickerData.QQQ.rows, state.anchorDate, period);
      const tqqq = calculateTrailingReturn(tickerData.TQQQ.rows, state.anchorDate, period);

      button.classList.toggle("is-selected", state.selectedPeriodId === period.id);
      updateReturnField(button, "qqq", qqq);
      updateReturnField(button, "tqqq", tqqq);
    });
  }

  function updateDetailChart() {
    const period = getSelectedPeriod();
    const qqqRange = buildWindowData(tickerData.QQQ.rows, state.anchorDate, period);
    const tqqqRange = buildWindowData(tickerData.TQQQ.rows, state.anchorDate, period);

    detailSeries.QQQ.setData(qqqRange ? qqqRange.series : []);
    detailSeries.TQQQ.setData(tqqqRange ? tqqqRange.series : []);

    if (qqqRange || tqqqRange) {
      const from = minExistingDate(
        qqqRange ? qqqRange.start : null,
        tqqqRange ? tqqqRange.start : null
      );
      const to = maxExistingDate(
        qqqRange ? qqqRange.end : null,
        tqqqRange ? tqqqRange.end : null
      );

      detailChart.timeScale().setVisibleRange({
        from: toBusinessDay(from),
        to: toBusinessDay(to),
      });
      elements.detailStatus.textContent = buildDetailStatus(qqqRange, tqqqRange);
    } else {
      elements.detailStatus.textContent =
        "선택한 기준일에서는 QQQ/TQQQ 모두 해당 기간 데이터가 없습니다.";
    }
  }

  function buildDetailStatus(qqqRange, tqqqRange) {
    const qqqText = qqqRange ? `QQQ ${formatPercent(qqqRange.returnPct)}` : "QQQ N/A";
    const tqqqText = tqqqRange ? `TQQQ ${formatPercent(tqqqRange.returnPct)}` : "TQQQ N/A";
    return `${qqqText} / ${tqqqText}`;
  }

  function buildWindowRange(period, anchorDate) {
    const qqq = buildWindowData(tickerData.QQQ.rows, anchorDate, period);
    const tqqq = buildWindowData(tickerData.TQQQ.rows, anchorDate, period);
    if (!qqq && !tqqq) {
      return null;
    }
    return {
      start: minExistingDate(qqq ? qqq.start : null, tqqq ? tqqq.start : null),
      end: maxExistingDate(qqq ? qqq.end : null, tqqq ? tqqq.end : null),
    };
  }

  function buildWindowData(rows, anchorDate, period) {
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

  function calculateTrailingReturn(rows, anchorDate, period) {
    const range = buildWindowData(rows, anchorDate, period);
    if (!range) {
      return null;
    }
    return range.returnPct;
  }

  function normalizeAgainstDate(rows, baseDate) {
    const baseIndex = findIndexOnOrBefore(rows, baseDate);
    if (baseIndex < 0) {
      return [];
    }

    const baseValue = rows[baseIndex].value;
    return rows.map((row) => ({
      time: row.time,
      value: roundValue((row.value / baseValue) * 100),
    }));
  }

  function updateReturnField(button, field, returnPct) {
    const node = button.querySelector(`[data-field="${field}"]`);
    const isPositive = returnPct !== null && returnPct >= 0;

    node.textContent =
      `${field.toUpperCase()} ${returnPct === null ? "N/A" : formatPercent(returnPct)}`;
    node.classList.toggle("is-positive", returnPct !== null && isPositive);
    node.classList.toggle("is-negative", returnPct !== null && !isPositive);
    node.classList.toggle("is-empty", returnPct === null);
  }

  function createBaseChart(container, height) {
    const chart = LightweightCharts.createChart(container, {
      width: container.clientWidth,
      height,
      layout: {
        background: { color: "#fffaf3" },
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
          style: LightweightCharts.LineStyle.Dashed,
        },
        horzLine: {
          color: "rgba(23, 32, 51, 0.16)",
          width: 1,
          style: LightweightCharts.LineStyle.Dashed,
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
    return chart;
  }

  function resizeChart(chart, container, height) {
    chart.resize(container.clientWidth, height);
  }

  function getSelectedPeriod() {
    return PERIODS.find((period) => period.id === state.selectedPeriodId) || PERIODS[3];
  }

  function findNearestCommonDate(targetDate) {
    const qqqIndex = findIndexOnOrBefore(tickerData.QQQ.rows, targetDate);
    const tqqqIndex = findIndexOnOrBefore(tickerData.TQQQ.rows, targetDate);

    if (qqqIndex < 0 && tqqqIndex < 0) {
      return null;
    }
    if (qqqIndex < 0) {
      return tickerData.TQQQ.rows[tqqqIndex].time;
    }
    if (tqqqIndex < 0) {
      return tickerData.QQQ.rows[qqqIndex].time;
    }
    return minDate(tickerData.QQQ.rows[qqqIndex].time, tickerData.TQQQ.rows[tqqqIndex].time);
  }

  function findIndexOnOrBefore(rows, targetDate) {
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

  function subtractMonthsKey(dateKey, monthsBack) {
    const source = parseDateKey(dateKey);
    const totalMonths = source.getUTCFullYear() * 12 + source.getUTCMonth() - monthsBack;
    const year = Math.floor(totalMonths / 12);
    const month = totalMonths % 12;
    const lastDayOfMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const day = Math.min(source.getUTCDate(), lastDayOfMonth);
    return toDateKey(new Date(Date.UTC(year, month, day)));
  }

  function parseDateKey(dateKey) {
    return new Date(`${dateKey}T00:00:00Z`);
  }

  function toDateKey(date) {
    return date.toISOString().slice(0, 10);
  }

  function toBusinessDay(dateKey) {
    const [year, month, day] = dateKey.split("-").map(Number);
    return { year, month, day };
  }

  function timeToDateKey(time) {
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

  function formatDate(dateKey) {
    return new Intl.DateTimeFormat("ko-KR", {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }).format(parseDateKey(dateKey));
  }

  function formatDateTime(dateTime) {
    return new Intl.DateTimeFormat("ko-KR", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Seoul",
    }).format(new Date(dateTime));
  }

  function formatPercent(value) {
    const sign = value > 0 ? "+" : "";
    return `${sign}${value.toFixed(2)}%`;
  }

  function roundValue(value) {
    return Number(value.toFixed(4));
  }

  function minDate(a, b) {
    return a <= b ? a : b;
  }

  function minExistingDate(a, b) {
    if (!a) {
      return b;
    }
    if (!b) {
      return a;
    }
    return minDate(a, b);
  }

  function maxExistingDate(a, b) {
    if (!a) {
      return b;
    }
    if (!b) {
      return a;
    }
    return a >= b ? a : b;
  }
})();
