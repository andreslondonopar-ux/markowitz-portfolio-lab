// Helpers de Plotly.js — tema oscuro consistente y config interactiva tipo TradingView
// (scrollZoom, pan, doble-click reset), siguiendo el mismo criterio usado en el resto de QUANT.

const Plots = (() => {
  const COLORS = {
    bg: "#0f1420",
    paper: "#0f1420",
    grid: "#232b3d",
    text: "#c9d1e0",
    accent: "#4fd1c5",
    accent2: "#f6ad55",
    accent3: "#f56565",
    muted: "#5a6478",
  };

  const CONFIG = {
    scrollZoom: true,
    displayModeBar: true,
    doubleClick: "reset+autosize",
    responsive: true,
    displaylogo: false,
  };

  function baseLayout(title, extra = {}) {
    return {
      title: title ? { text: title, font: { color: COLORS.text, size: 15 } } : undefined,
      paper_bgcolor: COLORS.paper,
      plot_bgcolor: COLORS.bg,
      font: { color: COLORS.text, family: "Inter, system-ui, sans-serif" },
      margin: { t: title ? 40 : 20, r: 20, b: 45, l: 55 },
      dragmode: "pan",
      hovermode: "x unified",
      xaxis: { gridcolor: COLORS.grid, zerolinecolor: COLORS.grid, ...(extra.xaxis || {}) },
      yaxis: { gridcolor: COLORS.grid, zerolinecolor: COLORS.grid, ...(extra.yaxis || {}) },
      legend: { font: { color: COLORS.text }, bgcolor: "rgba(0,0,0,0)" },
      ...extra,
    };
  }

  function renderNormalizedPrices(el, tickers, dates, priceMatrix) {
    const traces = tickers.map((t, i) => {
      const base = priceMatrix[0][i];
      return {
        x: dates,
        y: priceMatrix.map((row) => (row[i] / base) * 100),
        type: "scatter",
        mode: "lines",
        name: t,
        line: { width: 1.6 },
      };
    });
    const layout = baseLayout(null, {
      hovermode: "x unified",
      yaxis: { title: "Precio normalizado (base 100)", gridcolor: COLORS.grid },
    });
    Plotly.newPlot(el, traces, layout, CONFIG);
  }

  function renderCorrelationHeatmap(el, tickers, corr) {
    const trace = {
      z: corr,
      x: tickers,
      y: tickers,
      type: "heatmap",
      colorscale: [
        [0, COLORS.accent3],
        [0.5, "#1a2035"],
        [1, COLORS.accent],
      ],
      zmin: -1,
      zmax: 1,
      text: corr.map((row) => row.map((v) => v.toFixed(2))),
      texttemplate: "%{text}",
      hovertemplate: "%{y} vs %{x}: %{z:.2f}<extra></extra>",
      colorbar: { tickfont: { color: COLORS.text } },
    };
    const layout = baseLayout(null, { dragmode: false, hovermode: "closest" });
    Plotly.newPlot(el, [trace], layout, { ...CONFIG, scrollZoom: false });
  }

  function renderEfficientFrontier(el, { cloud, envelope, analytic, minVarPoint, tangencyPoint, cml }) {
    const traces = [];

    traces.push({
      x: cloud.map((p) => p.vol * 100),
      y: cloud.map((p) => p.return * 100),
      mode: "markers",
      type: "scattergl",
      name: "Simulación Monte Carlo (long-only)",
      marker: {
        size: 4,
        color: cloud.map((p) => p.sharpe),
        colorscale: [
          [0, COLORS.muted],
          [1, COLORS.accent],
        ],
        opacity: 0.55,
        colorbar: { title: "Sharpe", tickfont: { color: COLORS.text } },
      },
      hovertemplate: "Vol: %{x:.2f}%<br>Retorno: %{y:.2f}%<extra></extra>",
    });

    if (envelope && envelope.length) {
      traces.push({
        x: envelope.map((p) => p.vol * 100),
        y: envelope.map((p) => p.return * 100),
        mode: "lines",
        type: "scatter",
        name: "Envolvente long-only (desde la simulación)",
        line: { color: COLORS.accent2, width: 2, dash: "dot" },
      });
    }

    if (analytic && analytic.length) {
      traces.push({
        x: analytic.map((p) => p.vol * 100),
        y: analytic.map((p) => p.return * 100),
        mode: "lines",
        type: "scatter",
        name: "Frontera analítica (permite shorting)",
        line: { color: COLORS.text, width: 2 },
      });
    }

    if (cml && cml.length) {
      traces.push({
        x: cml.map((p) => p.vol * 100),
        y: cml.map((p) => p.return * 100),
        mode: "lines",
        type: "scatter",
        name: "Capital Market Line",
        line: { color: COLORS.accent3, width: 1.5, dash: "dash" },
      });
    }

    if (minVarPoint) {
      traces.push({
        x: [minVarPoint.vol * 100],
        y: [minVarPoint.return * 100],
        mode: "markers",
        type: "scatter",
        name: "Mínima varianza",
        marker: { size: 12, color: COLORS.accent2, symbol: "diamond", line: { color: "#000", width: 1 } },
      });
    }

    if (tangencyPoint) {
      traces.push({
        x: [tangencyPoint.vol * 100],
        y: [tangencyPoint.return * 100],
        mode: "markers",
        type: "scatter",
        name: "Portafolio tangente (máx Sharpe)",
        marker: { size: 13, color: COLORS.accent3, symbol: "star", line: { color: "#000", width: 1 } },
      });
    }

    const layout = baseLayout(null, {
      xaxis: { title: "Volatilidad anualizada (%)", gridcolor: COLORS.grid },
      yaxis: { title: "Retorno esperado anualizado (%)", gridcolor: COLORS.grid },
      margin: { t: 20, r: 40, b: 150, l: 55 },
      legend: {
        orientation: "h",
        x: 0,
        y: -0.22,
        yanchor: "top",
        font: { color: COLORS.text, size: 11.5 },
        bgcolor: "rgba(0,0,0,0)",
      },
    });
    Plotly.newPlot(el, traces, layout, CONFIG);
  }

  function renderWeightsBar(el, weightTable, colorPositive = COLORS.accent, colorNegative = COLORS.accent3) {
    const sorted = [...weightTable].sort((a, b) => b.weight - a.weight);
    const trace = {
      x: sorted.map((w) => w.ticker),
      y: sorted.map((w) => w.weight * 100),
      type: "bar",
      marker: { color: sorted.map((w) => (w.weight >= 0 ? colorPositive : colorNegative)) },
      hovertemplate: "%{x}: %{y:.1f}%<extra></extra>",
    };
    const layout = baseLayout(null, {
      dragmode: false,
      hovermode: "closest",
      yaxis: { title: "Peso en el portafolio (%)", gridcolor: COLORS.grid },
    });
    Plotly.newPlot(el, [trace], layout, { ...CONFIG, scrollZoom: false });
  }

  function renderWeightsPie(el, weightTable) {
    const positive = weightTable.filter((w) => w.weight > 0.0005);
    const trace = {
      labels: positive.map((w) => w.ticker),
      values: positive.map((w) => w.weight),
      type: "pie",
      hole: 0.45,
      textinfo: "label+percent",
      marker: { line: { color: COLORS.bg, width: 2 } },
    };
    const layout = baseLayout(null, { dragmode: false, showlegend: false });
    Plotly.newPlot(el, [trace], layout, { ...CONFIG, scrollZoom: false });
  }

  return {
    COLORS,
    CONFIG,
    baseLayout,
    renderNormalizedPrices,
    renderCorrelationHeatmap,
    renderEfficientFrontier,
    renderWeightsBar,
    renderWeightsPie,
  };
})();
