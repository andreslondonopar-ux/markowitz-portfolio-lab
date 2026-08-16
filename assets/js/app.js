// Orquestación: lee los tickers del usuario, llama a /api/prices, corre el pipeline
// completo de Markowitz.js y actualiza cada sección de la página en vivo.

(function () {
  const el = (id) => document.getElementById(id);

  const tickersInput = el("tickers-input");
  const riskfreeInput = el("riskfree-input");
  const yearsInput = el("years-input");
  const recalcBtn = el("recalc-btn");
  const statusLineEl = el("status-line");

  const paso1List = el("paso1-ticker-list");
  const plotPricesEl = el("plot-prices");
  const statTilesEl = el("stat-tiles");
  const plotCorrEl = el("plot-corr");
  const statsTableWrapEl = el("stats-table-wrap");
  const plotMonteCarloEl = el("plot-montecarlo");
  const plotFrontierEl = el("plot-frontier");
  const notableTilesEl = el("notable-tiles");
  const plotTangencyPieEl = el("plot-tangency-pie");
  const comparisonTableWrapEl = el("comparison-table-wrap");
  const targetSlider = el("target-return-slider");
  const targetReturnValueEl = el("target-return-value");
  const targetTilesEl = el("target-tiles");
  const plotTargetWeightsEl = el("plot-target-weights");

  function fmtPct(x, d = 1) {
    return (x * 100).toFixed(d) + "%";
  }
  function fmtNum(x, d = 2) {
    return x.toFixed(d);
  }
  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }
  function toISO(d) {
    return d.toISOString().slice(0, 10);
  }
  function parseTickers(str) {
    return [...new Set(str.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean))];
  }
  function setStatus(msg, isError = false) {
    statusLineEl.textContent = msg;
    statusLineEl.classList.toggle("error", !!isError);
  }
  function setBusy(b) {
    recalcBtn.disabled = b;
  }

  function renderStatTiles(tickers, mean, cov) {
    statTilesEl.innerHTML = tickers
      .map((t, i) => {
        const ret = mean[i];
        const vol = Math.sqrt(cov[i][i]);
        return `<div class="stat-tile"><div class="label">${t}</div><div class="value ${ret >= 0 ? "up" : "down"}">${fmtPct(ret)}</div><div style="font-size:12px;color:var(--text-faint)">vol ${fmtPct(vol)}</div></div>`;
      })
      .join("");
  }

  function renderStatsTable(tickers, mean, cov) {
    const rows = tickers
      .map((t, i) => `<tr><td>${t}</td><td>${fmtPct(mean[i])}</td><td>${fmtPct(Math.sqrt(cov[i][i]))}</td></tr>`)
      .join("");
    statsTableWrapEl.innerHTML = `<table class="data-table"><thead><tr><th>Activo</th><th>Retorno esp.</th><th>Volatilidad</th></tr></thead><tbody>${rows}</tbody></table>`;
  }

  function renderNotableTiles(minVarReturn, minVarVol, tanReturn, tanVol, tanSharpe, riskFree) {
    notableTilesEl.innerHTML = `
      <div class="stat-tile"><div class="label">Mín. varianza · retorno</div><div class="value">${fmtPct(minVarReturn)}</div></div>
      <div class="stat-tile"><div class="label">Mín. varianza · vol</div><div class="value">${fmtPct(minVarVol)}</div></div>
      <div class="stat-tile"><div class="label">Tangente · retorno</div><div class="value up">${fmtPct(tanReturn)}</div></div>
      <div class="stat-tile"><div class="label">Tangente · vol</div><div class="value">${fmtPct(tanVol)}</div></div>
      <div class="stat-tile"><div class="label">Tangente · Sharpe</div><div class="value ${tanSharpe >= 0 ? "up" : "down"}">${fmtNum(tanSharpe)}</div></div>
      <div class="stat-tile"><div class="label">Tasa libre de riesgo</div><div class="value">${fmtPct(riskFree)}</div></div>
    `;
  }

  function renderComparisonTable(tickers, mean, cov, riskFree, minVarW, tanW) {
    const n = tickers.length;
    const equalW = new Array(n).fill(1 / n);
    const portfolios = [
      { name: "Equal-weight", w: equalW },
      { name: "Mínima varianza", w: minVarW },
      { name: "Tangente (máx Sharpe)", w: tanW },
    ];
    const rows = portfolios
      .map((p) => {
        const ret = Markowitz.portfolioReturn(p.w, mean);
        const vol = Markowitz.portfolioVol(p.w, cov);
        const sharpe = Markowitz.sharpeRatio(ret, vol, riskFree);
        return `<tr><td>${p.name}</td><td>${fmtPct(ret)}</td><td>${fmtPct(vol)}</td><td>${fmtNum(sharpe)}</td></tr>`;
      })
      .join("");
    comparisonTableWrapEl.innerHTML = `<table class="data-table"><thead><tr><th>Portafolio</th><th>Retorno</th><th>Vol</th><th>Sharpe</th></tr></thead><tbody>${rows}</tbody></table>`;
  }

  function setupTargetSlider({ mean, cov, coeffs, usedTickers, riskFree, minVarReturn, tangencyReturn }) {
    const maxAssetReturn = Math.max(...mean);
    const sliderMin = minVarReturn;
    const sliderMax = Math.max(maxAssetReturn * 1.15, tangencyReturn * 1.15, sliderMin + 0.01);

    targetSlider.min = sliderMin;
    targetSlider.max = sliderMax;
    targetSlider.step = (sliderMax - sliderMin) / 200 || 0.001;
    targetSlider.value = clamp(tangencyReturn, sliderMin, sliderMax);

    function update() {
      const r = parseFloat(targetSlider.value);
      targetReturnValueEl.textContent = fmtPct(r);
      let w;
      try {
        w = Markowitz.targetReturnWeights(mean, cov, r, coeffs);
      } catch (e) {
        return;
      }
      const vol = Markowitz.portfolioVol(w, cov);
      const sharpe = Markowitz.sharpeRatio(r, vol, riskFree);
      targetTilesEl.innerHTML = `
        <div class="stat-tile"><div class="label">Retorno objetivo</div><div class="value">${fmtPct(r)}</div></div>
        <div class="stat-tile"><div class="label">Riesgo resultante</div><div class="value">${fmtPct(vol)}</div></div>
        <div class="stat-tile"><div class="label">Sharpe</div><div class="value ${sharpe >= 0 ? "up" : "down"}">${fmtNum(sharpe)}</div></div>
      `;
      Plots.renderWeightsBar(plotTargetWeightsEl, Markowitz.weightTable(usedTickers, w));
    }

    targetSlider.oninput = update;
    // Evita que el scroll del mouse sobre el slider cambie su valor sin querer
    // (comportamiento nativo de Chrome en <input type="range"> al pasar el cursor encima).
    targetSlider.onwheel = (e) => e.preventDefault();
    update();
  }

  async function runPipeline() {
    const tickers = parseTickers(tickersInput.value);
    if (tickers.length < 2) {
      setStatus("Ingresa al menos 2 tickers separados por coma.", true);
      return;
    }

    setBusy(true);
    setStatus(`Descargando precios de ${tickers.join(", ")}…`);

    try {
      const years = clamp(parseInt(yearsInput.value, 10) || 8, 2, 20);
      const end = new Date();
      const start = new Date(end.getFullYear() - years, end.getMonth(), end.getDate());
      const url = `/api/prices?tickers=${encodeURIComponent(tickers.join(","))}&start=${toISO(start)}&end=${toISO(end)}`;

      const res = await fetch(url);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error al consultar precios");

      const data = json.data || {};
      const errors = json.errors || {};
      const okTickers = Object.keys(data);
      const failedTickers = Object.keys(errors);
      const warn = failedTickers.length
        ? ` (omitidos: ${failedTickers.map((t) => `${t} — ${errors[t]}`).join(", ")})`
        : "";

      if (okTickers.length < 2) {
        throw new Error(
          "No hay suficientes tickers válidos. " +
            Object.entries(errors).map(([t, e]) => `${t}: ${e}`).join(" | ")
        );
      }

      const aligned = Markowitz.alignPrices(data);
      if (aligned.dates.length < 60) {
        throw new Error("Muy pocas fechas en común entre los activos elegidos." + warn);
      }

      const { tickers: usedTickers, dates, prices } = aligned;
      const returnsMatrix = Markowitz.logReturnsMatrix(prices);
      const mean = Markowitz.annualizedMean(returnsMatrix);
      const cov = Markowitz.annualizedCov(returnsMatrix);
      const corr = Markowitz.corrFromCov(cov);
      const riskFree = (parseFloat(riskfreeInput.value) || 0) / 100;

      paso1List.textContent = usedTickers.join(", ");

      Plots.renderNormalizedPrices(plotPricesEl, usedTickers, dates, prices);

      renderStatTiles(usedTickers, mean, cov);
      Plots.renderCorrelationHeatmap(plotCorrEl, usedTickers, corr);
      renderStatsTable(usedTickers, mean, cov);

      let coeffs;
      try {
        coeffs = Markowitz.analyticFrontierCoeffs(mean, cov);
      } catch (e) {
        throw new Error("No se pudo invertir la matriz de covarianza: " + e.message);
      }

      const cloud = Markowitz.monteCarloSimulate(mean, cov, riskFree, 4000);
      Plots.renderEfficientFrontier(plotMonteCarloEl, { cloud });

      const envelope = Markowitz.longOnlyEnvelope(cloud, 40);
      const { points: analyticCurve } = Markowitz.analyticFrontierCurve(mean, cov, 150);

      const minVarWeights = Markowitz.minVarianceWeights(mean, cov, coeffs);
      const minVarReturn = Markowitz.portfolioReturn(minVarWeights, mean);
      const minVarVol = Markowitz.portfolioVol(minVarWeights, cov);

      const tangencyW = Markowitz.tangencyWeights(mean, cov, riskFree);
      const tangencyReturn = Markowitz.portfolioReturn(tangencyW, mean);
      const tangencyVol = Markowitz.portfolioVol(tangencyW, cov);
      const tangencySharpe = Markowitz.sharpeRatio(tangencyReturn, tangencyVol, riskFree);

      const maxCloudVol = Math.max(...cloud.map((p) => p.vol));
      const cmlMaxX = Math.max(maxCloudVol, tangencyVol) * 1.3;
      const cml = [
        { vol: 0, return: riskFree },
        { vol: cmlMaxX, return: riskFree + tangencySharpe * cmlMaxX },
      ];

      Plots.renderEfficientFrontier(plotFrontierEl, {
        cloud,
        envelope,
        analytic: analyticCurve,
        minVarPoint: { vol: minVarVol, return: minVarReturn },
        tangencyPoint: { vol: tangencyVol, return: tangencyReturn },
        cml,
      });

      renderNotableTiles(minVarReturn, minVarVol, tangencyReturn, tangencyVol, tangencySharpe, riskFree);
      Plots.renderWeightsPie(plotTangencyPieEl, Markowitz.weightTable(usedTickers, tangencyW));
      renderComparisonTable(usedTickers, mean, cov, riskFree, minVarWeights, tangencyW);

      setupTargetSlider({ mean, cov, coeffs, usedTickers, riskFree, minVarReturn, tangencyReturn });

      setStatus(
        `Listo — ${usedTickers.length} activos, ${dates.length} observaciones diarias (${dates[0]} → ${dates[dates.length - 1]}).` +
          warn
      );
    } catch (err) {
      setStatus(err.message || "Error inesperado.", true);
    } finally {
      setBusy(false);
    }
  }

  recalcBtn.addEventListener("click", runPipeline);
  tickersInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") runPipeline();
  });

  document.addEventListener("DOMContentLoaded", () => {
    if (window.renderMathInElement) {
      window.renderMathInElement(document.body, {
        delimiters: [
          { left: "$$", right: "$$", display: true },
          { left: "\\(", right: "\\)", display: false },
        ],
      });
    }
    runPipeline();
  });
})();
