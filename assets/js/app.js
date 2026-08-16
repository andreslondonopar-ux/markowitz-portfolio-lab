// Orquestación: lee los tickers del usuario, llama a /api/prices, corre el pipeline
// completo de Markowitz.js y actualiza cada sección de la página en vivo.
//
// Escenario base = long-only (sin ventas en corto), que es el caso realista para la
// mayoría de portafolios. El interruptor "Permitir shorting" recalcula Paso 6-8 con la
// fórmula analítica sin restricción — sin volver a pedir precios, reutilizando `state`.

const MAX_TICKERS = 10;

(function () {
  const el = (id) => document.getElementById(id);

  const tickersInput = el("tickers-input");
  const riskfreeInput = el("riskfree-input");
  const yearsInput = el("years-input");
  const recalcBtn = el("recalc-btn");
  const statusLineEl = el("status-line");
  const allowShortToggle = el("allow-short-toggle");
  const allowShortLabel = el("allow-short-label");

  const paso1List = el("paso1-ticker-list");
  const plotPricesEl = el("plot-prices");
  const statTilesEl = el("stat-tiles");
  const plotCorrEl = el("plot-corr");
  const statsTableWrapEl = el("stats-table-wrap");
  const plotMonteCarloEl = el("plot-montecarlo");
  const plotFrontierEl = el("plot-frontier");
  const notableTilesEl = el("notable-tiles");
  const plotTangencyWeightsEl = el("plot-tangency-weights");
  const comparisonTableWrapEl = el("comparison-table-wrap");
  const targetSlider = el("target-return-slider");
  const targetReturnValueEl = el("target-return-value");
  const targetTilesEl = el("target-tiles");
  const plotTargetWeightsEl = el("plot-target-weights");
  const targetShortNoteEl = el("target-short-note");
  const paso8CalloutEl = el("paso8-callout");

  let state = null; // último pipeline calculado (precios/mean/cov/curvas), para recomputar sin refetch
  let sliderTouched = false; // false = usar un punto de partida representativo; true = respetar la posición del usuario

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

  function renderPaso8Callout(isLongOnly) {
    paso8CalloutEl.innerHTML = isLongOnly
      ? `<strong>Escenario base: sin ventas en corto.</strong> Todos los pesos aquí son ≥ 0 —
         se probaron todas las combinaciones de activos posibles y se tomó la de menor riesgo
         para cada retorno objetivo. Activa <strong>"Permitir shorting"</strong> arriba si
         quieres ver la versión teórica sin restricción (Paso 4), que puede pedir posiciones
         negativas.`
      : `<strong>Shorting activado.</strong> Esta calculadora ahora usa la fórmula
         <em>analítica</em> sin restricción del Paso 4. Un peso negativo significa vender ese
         activo en corto para financiar una posición más grande en los demás — no es un error,
         es lo que implica quitar la restricción de no-negatividad. Desactiva el interruptor de
         arriba para volver al escenario base (long-only).`;
  }

  function setupTargetSlider({ mean, cov, usedTickers, riskFree, isLongOnly, coeffs, minVarReturn, maxReturn, defaultReturn }) {
    const sliderMin = minVarReturn;
    const sliderMax = Math.max(maxReturn, sliderMin + 0.01);

    targetSlider.min = sliderMin;
    targetSlider.max = sliderMax;
    targetSlider.step = (sliderMax - sliderMin) / 200 || 0.001;
    const startValue = sliderTouched ? parseFloat(targetSlider.value) : defaultReturn;
    targetSlider.value = clamp(startValue, sliderMin, sliderMax);

    function solve(r) {
      return isLongOnly
        ? Markowitz.longOnlyTargetReturnWeights(mean, cov, r)
        : Markowitz.targetReturnWeights(mean, cov, r, coeffs);
    }

    function update() {
      const r = parseFloat(targetSlider.value);
      targetReturnValueEl.textContent = fmtPct(r);
      let w;
      try {
        w = solve(r);
      } catch (e) {
        targetShortNoteEl.textContent = e.message || "No se pudo resolver este punto.";
        return;
      }
      const vol = Markowitz.portfolioVol(w, cov);
      const sharpe = Markowitz.sharpeRatio(r, vol, riskFree);
      targetTilesEl.innerHTML = `
        <div class="stat-tile"><div class="label">Retorno objetivo</div><div class="value">${fmtPct(r)}</div></div>
        <div class="stat-tile"><div class="label">Riesgo resultante</div><div class="value">${fmtPct(vol)}</div></div>
        <div class="stat-tile"><div class="label">Sharpe</div><div class="value ${sharpe >= 0 ? "up" : "down"}">${fmtNum(sharpe)}</div></div>
      `;
      const weightTable = Markowitz.weightTable(usedTickers, w);
      Plots.renderWeightsHBar(plotTargetWeightsEl, weightTable);

      const shorted = weightTable.filter((t) => t.weight < -0.0005);
      targetShortNoteEl.textContent = shorted.length
        ? `Este portafolio vende en corto: ${shorted.map((t) => `${t.ticker} (${fmtPct(t.weight)})`).join(", ")}.`
        : "Este portafolio no requiere ventas en corto — todos los pesos son ≥ 0.";
    }

    targetSlider.oninput = () => {
      sliderTouched = true;
      update();
    };
    // Evita que el scroll del mouse sobre el slider cambie su valor sin querer
    // (comportamiento nativo de Chrome en <input type="range"> al pasar el cursor encima).
    targetSlider.onwheel = (e) => e.preventDefault();
    update();
  }

  // Recalcula Paso 6, 7 y 8 a partir de `state` (ya con precios/mean/cov listos) según el
  // interruptor de shorting — no vuelve a pedir precios.
  function renderDownstream() {
    if (!state) return;
    const { usedTickers, mean, cov, riskFree, cloud, coeffs, analyticCurve, minVarW, tangencyW, loFrontier } = state;
    const isLongOnly = !allowShortToggle.checked;
    allowShortLabel.textContent = isLongOnly ? "Long-only (base)" : "Con shorting";

    const activeMinVarW = isLongOnly ? loFrontier.minVarPoint.weights : minVarW;
    const activeMinVarReturn = isLongOnly ? loFrontier.minVarPoint.return : Markowitz.portfolioReturn(minVarW, mean);
    const activeMinVarVol = isLongOnly ? loFrontier.minVarPoint.vol : Markowitz.portfolioVol(minVarW, cov);

    const activeTangencyW = isLongOnly ? loFrontier.tangencyPoint.weights : tangencyW;
    const activeTangencyReturn = isLongOnly
      ? loFrontier.tangencyPoint.return
      : Markowitz.portfolioReturn(tangencyW, mean);
    const activeTangencyVol = isLongOnly ? loFrontier.tangencyPoint.vol : Markowitz.portfolioVol(tangencyW, cov);
    const activeTangencySharpe = Markowitz.sharpeRatio(activeTangencyReturn, activeTangencyVol, riskFree);

    const maxCloudVol = Math.max(...cloud.map((p) => p.vol));
    const cmlMaxX = Math.max(maxCloudVol, activeTangencyVol) * 1.3;
    const cml = [
      { vol: 0, return: riskFree },
      { vol: cmlMaxX, return: riskFree + activeTangencySharpe * cmlMaxX },
    ];

    Plots.renderEfficientFrontier(plotFrontierEl, {
      cloud,
      longOnlyCurve: loFrontier.points,
      analytic: analyticCurve,
      minVarPoint: { vol: activeMinVarVol, return: activeMinVarReturn },
      tangencyPoint: { vol: activeTangencyVol, return: activeTangencyReturn },
      cml,
      activeMode: isLongOnly ? "longonly" : "short",
    });

    renderNotableTiles(activeMinVarReturn, activeMinVarVol, activeTangencyReturn, activeTangencyVol, activeTangencySharpe, riskFree);
    Plots.renderWeightsHBar(plotTangencyWeightsEl, Markowitz.weightTable(usedTickers, activeTangencyW));
    renderComparisonTable(usedTickers, mean, cov, riskFree, activeMinVarW, activeTangencyW);

    renderPaso8Callout(isLongOnly);
    setupTargetSlider({
      mean,
      cov,
      usedTickers,
      riskFree,
      isLongOnly,
      coeffs,
      minVarReturn: activeMinVarReturn,
      maxReturn: isLongOnly ? Math.max(...mean) : Math.max(Math.max(...mean), activeTangencyReturn) * 1.15,
      defaultReturn: activeTangencyReturn,
    });
  }

  async function runPipeline() {
    const tickers = parseTickers(tickersInput.value);
    if (tickers.length < 2) {
      setStatus("Ingresa al menos 2 tickers separados por coma.", true);
      return;
    }
    if (tickers.length > MAX_TICKERS) {
      setStatus(`Máximo ${MAX_TICKERS} tickers — la optimización long-only prueba todas las combinaciones posibles y crece rápido con cada activo adicional.`, true);
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
      sliderTouched = false; // dataset nuevo: arrancar el slider en un punto representativo de nuevo

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

      const { points: analyticCurve } = Markowitz.analyticFrontierCurve(mean, cov, 150);
      const minVarW = Markowitz.minVarianceWeights(mean, cov, coeffs);
      const tangencyW = Markowitz.tangencyWeights(mean, cov, riskFree);

      setStatus(`Calculando la frontera long-only exacta para ${usedTickers.length} activos…`);
      // Resolución adaptativa: la búsqueda long-only prueba 2^n combinaciones por punto.
      const loPoints = usedTickers.length <= 6 ? 150 : usedTickers.length <= 8 ? 100 : 60;
      const loFrontier = Markowitz.longOnlyFrontierCurve(mean, cov, riskFree, loPoints);

      state = { usedTickers, dates, mean, cov, riskFree, cloud, coeffs, analyticCurve, minVarW, tangencyW, loFrontier };
      renderDownstream();

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
  allowShortToggle.addEventListener("change", renderDownstream);

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
