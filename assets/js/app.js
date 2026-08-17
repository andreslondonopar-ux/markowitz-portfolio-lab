// Orquestación: lee los tickers del usuario, llama a /api/prices, corre el pipeline
// completo de Markowitz.js y actualiza cada sección de la página en vivo.
//
// Escenario base = long-only (sin ventas en corto), que es el caso realista para la
// mayoría de portafolios. El interruptor "Permitir shorting" recalcula Paso 6-8 con la
// fórmula analítica sin restricción — sin volver a pedir precios, reutilizando `state`.
//
// Bilingüe (ES/EN, ver assets/js/i18n.js): todo el texto generado aquí pasa por I18N.t()
// en vez de estar hardcodeado, para que cambiar de idioma no requiera volver a pedir datos.

const MAX_TICKERS = 10;

(function () {
  const el = (id) => document.getElementById(id);

  const tickerChipsEl = el("ticker-chips");
  const tickerEntryInput = el("ticker-entry");
  const riskfreeInput = el("riskfree-input");
  const yearsInput = el("years-input");
  const recalcBtn = el("recalc-btn");
  const statusLineEl = el("status-line");
  const allowShortToggle = el("allow-short-toggle");
  const allowShortLabel = el("allow-short-label");
  const langToggleBtn = el("lang-toggle");

  const paso1List = el("paso1-ticker-list");
  const plotPricesEl = el("plot-prices");
  const statTilesEl = el("stat-tiles");
  const plotCorrEl = el("plot-corr");
  const statsTableWrapEl = el("stats-table-wrap");
  const plotMonteCarloEl = el("plot-montecarlo");
  const plotFrontierEl = el("plot-frontier");
  const notableTilesEl = el("notable-tiles");
  const plotTangencyWeightsEl = el("plot-tangency-weights");
  const tangencyTableToggle = el("tangency-table-toggle");
  const tangencyTableWrap = el("tangency-table-wrap");
  const comparisonTableWrapEl = el("comparison-table-wrap");
  const targetSlider = el("target-return-slider");
  const targetReturnValueEl = el("target-return-value");
  const targetTilesEl = el("target-tiles");
  const plotTargetWeightsEl = el("plot-target-weights");
  const targetTableToggle = el("target-table-toggle");
  const targetTableWrap = el("target-table-wrap");
  const targetShortNoteEl = el("target-short-note");
  const paso8CalloutEl = el("paso8-callout");

  let state = null; // último pipeline calculado (precios/mean/cov/curvas), para recomputar sin refetch
  let sliderTouched = false; // false = usar un punto de partida representativo; true = respetar la posición del usuario
  let tickerChips = ["AAPL", "MSFT", "GOOGL", "AMZN", "JPM", "XOM", "SPY"]; // se agregan/quitan uno a la vez

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
  function setStatus(msg, isError = false) {
    statusLineEl.textContent = msg;
    statusLineEl.classList.toggle("error", !!isError);
  }
  function setBusy(b) {
    recalcBtn.disabled = b;
    document.body.classList.toggle("is-recalculating", b);
  }

  // --- Tickers: se agregan uno a la vez como chips, no como texto separado por coma ---
  function renderTickerChips() {
    tickerChipsEl.querySelectorAll(".ticker-chip").forEach((chip) => chip.remove());
    tickerChips.forEach((t) => {
      const chip = document.createElement("span");
      chip.className = "ticker-chip";
      chip.textContent = t;
      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.setAttribute("aria-label", I18N.t("app.removeTicker", { ticker: t }));
      removeBtn.textContent = "×";
      removeBtn.addEventListener("click", () => {
        tickerChips = tickerChips.filter((x) => x !== t);
        renderTickerChips();
      });
      chip.appendChild(removeBtn);
      tickerChipsEl.insertBefore(chip, tickerEntryInput);
    });
  }

  function addSingleTicker(raw) {
    const ticker = raw.trim().toUpperCase();
    if (!ticker || tickerChips.includes(ticker)) return;
    if (tickerChips.length >= MAX_TICKERS) {
      setStatus(I18N.t("app.maxTickersError", { n: MAX_TICKERS }), true);
      return;
    }
    tickerChips.push(ticker);
  }

  // Acepta un solo ticker o varios separados por coma (ej. si se pega una lista) — cada
  // uno se agrega como chip individual, igual que si se hubieran escrito uno a la vez.
  function addTickersFromRaw(raw) {
    raw.split(",").map((s) => s.trim()).filter(Boolean).forEach(addSingleTicker);
    renderTickerChips();
  }

  function renderStatTiles(tickers, mean, cov) {
    statTilesEl.innerHTML = tickers
      .map((t, i) => {
        const ret = mean[i];
        const vol = Math.sqrt(cov[i][i]);
        return `<div class="stat-tile"><div class="label">${t}</div><div class="value ${ret >= 0 ? "up" : "down"}">${fmtPct(ret)}</div><div style="font-size:12px;color:var(--text-faint)">${I18N.t("app.statVol")} ${fmtPct(vol)}</div></div>`;
      })
      .join("");
  }

  function renderStatsTable(tickers, mean, cov) {
    const rows = tickers
      .map((t, i) => `<tr><td>${t}</td><td>${fmtPct(mean[i])}</td><td>${fmtPct(Math.sqrt(cov[i][i]))}</td></tr>`)
      .join("");
    statsTableWrapEl.innerHTML = `<table class="data-table"><thead><tr><th>${I18N.t("app.tableAsset")}</th><th>${I18N.t("app.tableExpReturn")}</th><th>${I18N.t("app.tableVolatility")}</th></tr></thead><tbody>${rows}</tbody></table>`;
  }

  function renderNotableTiles(minVarReturn, minVarVol, tanReturn, tanVol, tanSharpe, riskFree) {
    notableTilesEl.innerHTML = `
      <div class="stat-tile"><div class="label">${I18N.t("app.notableMinVarReturn")}</div><div class="value">${fmtPct(minVarReturn)}</div></div>
      <div class="stat-tile"><div class="label">${I18N.t("app.notableMinVarVol")}</div><div class="value">${fmtPct(minVarVol)}</div></div>
      <div class="stat-tile"><div class="label">${I18N.t("app.notableTanReturn")}</div><div class="value up">${fmtPct(tanReturn)}</div></div>
      <div class="stat-tile"><div class="label">${I18N.t("app.notableTanVol")}</div><div class="value">${fmtPct(tanVol)}</div></div>
      <div class="stat-tile"><div class="label">${I18N.t("app.notableTanSharpe")}</div><div class="value ${tanSharpe >= 0 ? "up" : "down"}">${fmtNum(tanSharpe)}</div></div>
      <div class="stat-tile"><div class="label">${I18N.t("app.notableRiskFree")}</div><div class="value">${fmtPct(riskFree)}</div></div>
    `;
  }

  function renderComparisonTable(tickers, mean, cov, riskFree, minVarW, tanW) {
    const n = tickers.length;
    const equalW = new Array(n).fill(1 / n);
    const portfolios = [
      { name: I18N.t("app.portfolioEqualWeight"), w: equalW },
      { name: I18N.t("app.portfolioMinVar"), w: minVarW },
      { name: I18N.t("app.portfolioTangency"), w: tanW },
    ];
    const rows = portfolios
      .map((p) => {
        const ret = Markowitz.portfolioReturn(p.w, mean);
        const vol = Markowitz.portfolioVol(p.w, cov);
        const sharpe = Markowitz.sharpeRatio(ret, vol, riskFree);
        return `<tr><td>${p.name}</td><td>${fmtPct(ret)}</td><td>${fmtPct(vol)}</td><td>${fmtNum(sharpe)}</td></tr>`;
      })
      .join("");
    comparisonTableWrapEl.innerHTML = `<table class="data-table"><thead><tr><th>${I18N.t("app.tablePortfolio")}</th><th>${I18N.t("app.tableReturn")}</th><th>${I18N.t("app.tableVol")}</th><th>${I18N.t("app.tableSharpe")}</th></tr></thead><tbody>${rows}</tbody></table>`;
  }

  function renderWeightsTable(wrapEl, weightTable) {
    const sorted = [...weightTable].sort((a, b) => b.weight - a.weight);
    const rows = sorted
      .map((w) => `<tr><td>${w.ticker}</td><td>${fmtPct(w.weight)}</td></tr>`)
      .join("");
    wrapEl.innerHTML = `<table class="data-table"><thead><tr><th>${I18N.t("app.tableAsset")}</th><th>${I18N.t("app.tableWeight")}</th></tr></thead><tbody>${rows}</tbody></table>`;
  }

  function setupTableToggle(btn, wrapEl) {
    btn.addEventListener("click", () => {
      const isHidden = wrapEl.hasAttribute("hidden");
      if (isHidden) wrapEl.removeAttribute("hidden");
      else wrapEl.setAttribute("hidden", "");
      btn.textContent = isHidden ? I18N.t("app.hideTable") : I18N.t("app.viewTable");
    });
  }

  function renderPaso8Callout(isLongOnly) {
    paso8CalloutEl.innerHTML = I18N.t(isLongOnly ? "app.paso8CalloutLongOnly" : "app.paso8CalloutShort");
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
        targetShortNoteEl.textContent = e.message || I18N.t("app.couldNotSolve");
        return;
      }
      const vol = Markowitz.portfolioVol(w, cov);
      const sharpe = Markowitz.sharpeRatio(r, vol, riskFree);
      targetTilesEl.innerHTML = `
        <div class="stat-tile"><div class="label">${I18N.t("app.targetReturn")}</div><div class="value">${fmtPct(r)}</div></div>
        <div class="stat-tile"><div class="label">${I18N.t("app.targetVol")}</div><div class="value">${fmtPct(vol)}</div></div>
        <div class="stat-tile"><div class="label">${I18N.t("app.tableSharpe")}</div><div class="value ${sharpe >= 0 ? "up" : "down"}">${fmtNum(sharpe)}</div></div>
      `;
      const weightTable = Markowitz.weightTable(usedTickers, w);
      Plots.renderWeightsHBar(plotTargetWeightsEl, weightTable);
      renderWeightsTable(targetTableWrap, weightTable);

      const shorted = weightTable.filter((t) => t.weight < -0.0005);
      targetShortNoteEl.textContent = shorted.length
        ? I18N.t("app.shortNote", { list: shorted.map((t) => `${t.ticker} (${fmtPct(t.weight)})`).join(", ") })
        : I18N.t("app.noShortNote");
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
    allowShortLabel.textContent = I18N.t(isLongOnly ? "app.scenarioLongOnly" : "app.scenarioShort");

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
    const tangencyWeightTable = Markowitz.weightTable(usedTickers, activeTangencyW);
    Plots.renderWeightsHBar(plotTangencyWeightsEl, tangencyWeightTable);
    renderWeightsTable(tangencyTableWrap, tangencyWeightTable);
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

  function readyStatusMessage() {
    const { usedTickers, dates, warn } = state;
    return (
      I18N.t("app.ready", {
        n: usedTickers.length,
        n2: dates.length,
        d1: dates[0],
        d2: dates[dates.length - 1],
      }) + (warn || "")
    );
  }

  // Vuelve a dibujar todo (Paso 2, 3, 5, 6, 7, 8) a partir de `state` ya calculado — se usa
  // tanto al terminar el pipeline como al cambiar de idioma (sin pedir precios de nuevo).
  function renderFromState() {
    if (!state) return;
    const { usedTickers, dates, prices, mean, cov, corr, cloud } = state;

    paso1List.textContent = usedTickers.join(", ");
    Plots.renderNormalizedPrices(plotPricesEl, usedTickers, dates, prices);
    renderStatTiles(usedTickers, mean, cov);
    Plots.renderCorrelationHeatmap(plotCorrEl, usedTickers, corr);
    renderStatsTable(usedTickers, mean, cov);
    Plots.renderEfficientFrontier(plotMonteCarloEl, { cloud });
    renderDownstream();
    setStatus(readyStatusMessage());
  }

  async function runPipeline() {
    // Si quedó texto sin confirmar en el campo (el usuario no presionó Enter), lo agregamos.
    if (tickerEntryInput.value.trim()) {
      addTickersFromRaw(tickerEntryInput.value);
      tickerEntryInput.value = "";
    }
    const tickers = tickerChips.slice();
    if (tickers.length < 2) {
      setStatus(I18N.t("app.needTwoTickers"), true);
      return;
    }
    if (tickers.length > MAX_TICKERS) {
      setStatus(I18N.t("app.maxTickersError", { n: MAX_TICKERS }), true);
      return;
    }

    setBusy(true);
    setStatus(I18N.t("app.downloading", { list: tickers.join(", ") }));

    try {
      const years = clamp(parseInt(yearsInput.value, 10) || 8, 2, 20);
      const end = new Date();
      const start = new Date(end.getFullYear() - years, end.getMonth(), end.getDate());
      const url = `/api/prices?tickers=${encodeURIComponent(tickers.join(","))}&start=${toISO(start)}&end=${toISO(end)}`;

      const res = await fetch(url);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || I18N.t("app.priceFetchError"));

      const data = json.data || {};
      const errors = json.errors || {};
      const okTickers = Object.keys(data);
      const failedTickers = Object.keys(errors);
      const warn = failedTickers.length
        ? I18N.t("app.omitted", { list: failedTickers.map((t) => `${t} — ${errors[t]}`).join(", ") })
        : "";

      if (okTickers.length < 2) {
        throw new Error(
          I18N.t("app.notEnoughValid") + Object.entries(errors).map(([t, e]) => `${t}: ${e}`).join(" | ")
        );
      }

      const aligned = Markowitz.alignPrices(data);
      if (aligned.dates.length < 60) {
        throw new Error(I18N.t("app.tooFewDates") + warn);
      }

      const { tickers: usedTickers, dates, prices } = aligned;
      const returnsMatrix = Markowitz.logReturnsMatrix(prices);
      const mean = Markowitz.annualizedMean(returnsMatrix);
      const cov = Markowitz.annualizedCov(returnsMatrix);
      const corr = Markowitz.corrFromCov(cov);
      const riskFree = (parseFloat(riskfreeInput.value) || 0) / 100;
      sliderTouched = false; // dataset nuevo: arrancar el slider en un punto representativo de nuevo

      let coeffs;
      try {
        coeffs = Markowitz.analyticFrontierCoeffs(mean, cov);
      } catch (e) {
        throw new Error(I18N.t("app.covInvertError") + e.message);
      }

      const cloud = Markowitz.monteCarloSimulate(mean, cov, riskFree, 4000);

      const { points: analyticCurve } = Markowitz.analyticFrontierCurve(mean, cov, 150);
      const minVarW = Markowitz.minVarianceWeights(mean, cov, coeffs);
      const tangencyW = Markowitz.tangencyWeights(mean, cov, riskFree);

      setStatus(I18N.t("app.computingFrontier", { n: usedTickers.length }));
      // Resolución adaptativa: la búsqueda long-only prueba 2^n combinaciones por punto.
      const loPoints = usedTickers.length <= 6 ? 150 : usedTickers.length <= 8 ? 100 : 60;
      const loFrontier = Markowitz.longOnlyFrontierCurve(mean, cov, riskFree, loPoints);

      state = { usedTickers, dates, prices, mean, cov, corr, riskFree, cloud, coeffs, analyticCurve, minVarW, tangencyW, loFrontier, warn };
      renderFromState();
    } catch (err) {
      setStatus(err.message || I18N.t("app.unexpectedError"), true);
    } finally {
      setBusy(false);
    }
  }

  recalcBtn.addEventListener("click", runPipeline);
  tickerEntryInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTickersFromRaw(tickerEntryInput.value);
      tickerEntryInput.value = "";
    } else if (e.key === "Backspace" && tickerEntryInput.value === "" && tickerChips.length > 0) {
      tickerChips.pop();
      renderTickerChips();
    }
  });
  tickerEntryInput.addEventListener("blur", () => {
    if (tickerEntryInput.value.trim()) {
      addTickersFromRaw(tickerEntryInput.value);
      tickerEntryInput.value = "";
    }
  });
  allowShortToggle.addEventListener("change", renderDownstream);
  setupTableToggle(tangencyTableToggle, tangencyTableWrap);
  setupTableToggle(targetTableToggle, targetTableWrap);

  langToggleBtn.addEventListener("click", () => {
    const next = I18N.getLocale() === "es" ? "en" : "es";
    I18N.setLocale(next);
    langToggleBtn.textContent = next === "es" ? "EN" : "ES";
    renderTickerChips(); // los aria-label "Quitar X" / "Remove X" cambian de idioma
    // La fórmula con "sujeto a"/"subject to" quedó en texto crudo tras la traducción —
    // hay que pedirle a KaTeX que la vuelva a renderizar (las demás fórmulas ya
    // renderizadas no tienen data-i18n, así que no se tocan ni se vuelven a procesar).
    if (window.renderMathInElement) {
      window.renderMathInElement(document.body, {
        delimiters: [
          { left: "$$", right: "$$", display: true },
          { left: "\\(", right: "\\)", display: false },
        ],
      });
    }
    if (state) {
      renderFromState();
    } else {
      setStatus(I18N.t("controls.loadingDefault"));
    }
  });

  document.addEventListener("DOMContentLoaded", () => {
    I18N.applyStaticTranslations();
    langToggleBtn.textContent = I18N.getLocale() === "es" ? "EN" : "ES";
    renderTickerChips();
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
