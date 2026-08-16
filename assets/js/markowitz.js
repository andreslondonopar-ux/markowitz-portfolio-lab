// Pipeline financiero: precios -> retornos -> estadística -> Markowitz.
// Depende de linalg.js (cargar antes en el HTML).

const TRADING_DAYS = 252;

const Markowitz = (() => {
  function alignPrices(dataByTicker) {
    const tickers = Object.keys(dataByTicker);
    const maps = tickers.map((t) => new Map(dataByTicker[t].map((r) => [r.date, r.close])));

    let commonDates = [...maps[0].keys()];
    for (let i = 1; i < maps.length; i++) {
      const s = maps[i];
      commonDates = commonDates.filter((d) => s.has(d));
    }
    commonDates.sort();

    const prices = commonDates.map((date) => tickers.map((_, i) => maps[i].get(date)));
    return { tickers, dates: commonDates, prices };
  }

  function logReturnsMatrix(priceMatrix) {
    const nObs = priceMatrix.length;
    const nAssets = priceMatrix[0].length;
    const rets = [];
    for (let i = 1; i < nObs; i++) {
      const row = new Array(nAssets);
      for (let j = 0; j < nAssets; j++) row[j] = Math.log(priceMatrix[i][j] / priceMatrix[i - 1][j]);
      rets.push(row);
    }
    return rets;
  }

  function annualizedMean(returnsMatrix) {
    const nObs = returnsMatrix.length;
    const nAssets = returnsMatrix[0].length;
    const mean = new Array(nAssets).fill(0);
    for (const row of returnsMatrix) for (let j = 0; j < nAssets; j++) mean[j] += row[j];
    return mean.map((m) => (m / nObs) * TRADING_DAYS);
  }

  function annualizedCov(returnsMatrix) {
    const nObs = returnsMatrix.length;
    const nAssets = returnsMatrix[0].length;
    const dailyMean = new Array(nAssets).fill(0);
    for (const row of returnsMatrix) for (let j = 0; j < nAssets; j++) dailyMean[j] += row[j];
    for (let j = 0; j < nAssets; j++) dailyMean[j] /= nObs;

    const cov = Linalg.zeros(nAssets, nAssets);
    for (const row of returnsMatrix) {
      for (let i = 0; i < nAssets; i++) {
        for (let j = 0; j < nAssets; j++) {
          cov[i][j] += (row[i] - dailyMean[i]) * (row[j] - dailyMean[j]);
        }
      }
    }
    for (let i = 0; i < nAssets; i++)
      for (let j = 0; j < nAssets; j++) cov[i][j] = (cov[i][j] / (nObs - 1)) * TRADING_DAYS;
    return cov;
  }

  function corrFromCov(cov) {
    const n = cov.length;
    const std = cov.map((row, i) => Math.sqrt(row[i]));
    const corr = Linalg.zeros(n, n);
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) corr[i][j] = cov[i][j] / (std[i] * std[j]);
    return corr;
  }

  function portfolioReturn(w, mean) {
    return Linalg.dot(w, mean);
  }

  function portfolioVariance(w, cov) {
    return Linalg.multiply(Linalg.multiply(w, cov), w);
  }

  function portfolioVol(w, cov) {
    return Math.sqrt(Math.max(portfolioVariance(w, cov), 0));
  }

  function sharpeRatio(ret, vol, riskFree) {
    return vol > 0 ? (ret - riskFree) / vol : 0;
  }

  // Muestreo uniforme sobre el símplex (Dirichlet(1,...,1)) -> pesos long-only que suman 1.
  function randomWeights(n) {
    const w = Array.from({ length: n }, () => -Math.log(Math.random() + 1e-12));
    const s = w.reduce((a, b) => a + b, 0);
    return w.map((x) => x / s);
  }

  function monteCarloSimulate(mean, cov, riskFree, nSim = 4000) {
    const n = mean.length;
    const results = new Array(nSim);
    for (let i = 0; i < nSim; i++) {
      const w = randomWeights(n);
      const ret = portfolioReturn(w, mean);
      const vol = portfolioVol(w, cov);
      results[i] = { weights: w, return: ret, vol, sharpe: sharpeRatio(ret, vol, riskFree) };
    }
    return results;
  }

  function subVector(v, idx) {
    return idx.map((i) => v[i]);
  }
  function subMatrix(M, idx) {
    return idx.map((i) => idx.map((j) => M[i][j]));
  }

  // Fórmulas clásicas de frontera eficiente sin restricción de shorting (Merton 1972).
  function analyticFrontierCoeffs(mean, cov) {
    const covInv = Linalg.inverse(cov);
    const n = mean.length;
    const onesVec = Linalg.ones(n);
    const covInvOnes = Linalg.multiply(covInv, onesVec);
    const covInvMean = Linalg.multiply(covInv, mean);
    const A = Linalg.dot(onesVec, covInvOnes);
    const B = Linalg.dot(onesVec, covInvMean);
    const C = Linalg.dot(mean, covInvMean);
    const D = A * C - B * B;
    return { covInv, A, B, C, D };
  }

  function minVarianceWeights(mean, cov, coeffs) {
    const { covInv, A } = coeffs || analyticFrontierCoeffs(mean, cov);
    const n = mean.length;
    return Linalg.multiply(covInv, Linalg.ones(n)).map((x) => x / A);
  }

  function targetReturnWeights(mean, cov, r, coeffs) {
    const c = coeffs || analyticFrontierCoeffs(mean, cov);
    const { covInv, A, B, C, D } = c;
    const n = mean.length;
    const term = mean.map((m, i) => (C - B * r) * 1 + (A * r - B) * m);
    return Linalg.multiply(covInv, term).map((x) => x / D);
  }

  function analyticFrontierVol(r, coeffs) {
    const { A, B, C, D } = coeffs;
    const variance = (A * r * r - 2 * B * r + C) / D;
    return Math.sqrt(Math.max(variance, 0));
  }

  function analyticFrontierCurve(mean, cov, nPoints = 120) {
    const coeffs = analyticFrontierCoeffs(mean, cov);
    const minVarReturn = coeffs.B / coeffs.A;
    const spread = Math.max(...mean) - Math.min(...mean) || 0.05;
    const rMin = minVarReturn - spread * 1.2;
    const rMax = Math.max(...mean) + spread * 1.2;
    const points = [];
    for (let i = 0; i < nPoints; i++) {
      const r = rMin + ((rMax - rMin) * i) / (nPoints - 1);
      points.push({ return: r, vol: analyticFrontierVol(r, coeffs) });
    }
    return { points, coeffs, minVarReturn };
  }

  function tangencyWeights(mean, cov, riskFree) {
    const covInv = Linalg.inverse(cov);
    const n = mean.length;
    const excess = mean.map((m) => m - riskFree);
    const covInvExcess = Linalg.multiply(covInv, excess);
    const denom = Linalg.dot(Linalg.ones(n), covInvExcess);
    return covInvExcess.map((x) => x / denom);
  }

  // --- Optimización long-only (sin ventas en corto) ---
  //
  // La fórmula analítica de arriba resuelve el problema sin restringir el signo de los
  // pesos (permite shorting). Para exigir w >= 0 no hay fórmula cerrada: se prueban TODOS
  // los subconjuntos posibles de activos activos (2^n, trivial para n <= ~10), se resuelve
  // cada subconjunto con la misma fórmula cerrada (poniendo el resto en 0), se descartan los
  // que resulten en algún peso negativo, y entre los que sí son factibles se toma el de menor
  // varianza. A diferencia de una heurística (ej. "quitar el activo más negativo y reintentar"),
  // esto prueba todas las combinaciones y por lo tanto siempre encuentra el óptimo real.

  function longOnlyMinVarianceWeights(mean, cov) {
    const n = mean.length;
    if (n === 1) return [1];
    let best = null;
    for (let mask = 1; mask < 1 << n; mask++) {
      const active = [];
      for (let i = 0; i < n; i++) if (mask & (1 << i)) active.push(i);

      let subW;
      if (active.length === 1) {
        subW = [1];
      } else {
        try {
          subW = minVarianceWeights(subVector(mean, active), subMatrix(cov, active));
        } catch (e) {
          continue;
        }
      }
      if (subW.some((x) => x < -1e-9)) continue;

      const full = new Array(n).fill(0);
      active.forEach((origI, k) => (full[origI] = Math.max(subW[k], 0)));
      const vol = portfolioVol(full, cov);
      if (!best || vol < best.vol) best = { weights: full, vol };
    }
    if (!best) throw new Error("No se encontró un portafolio long-only factible.");
    return best.weights;
  }

  function longOnlyTargetReturnWeights(mean, cov, r) {
    const n = mean.length;
    if (n === 1) return [1];
    let best = null;
    for (let mask = 1; mask < 1 << n; mask++) {
      const active = [];
      for (let i = 0; i < n; i++) if (mask & (1 << i)) active.push(i);
      if (active.length < 2) continue; // 1 solo activo casi nunca puede igualar r exactamente

      let subW;
      try {
        subW = targetReturnWeights(subVector(mean, active), subMatrix(cov, active), r);
      } catch (e) {
        continue;
      }
      if (subW.some((x) => x < -1e-9)) continue;

      const full = new Array(n).fill(0);
      active.forEach((origI, k) => (full[origI] = Math.max(subW[k], 0)));
      const vol = portfolioVol(full, cov);
      if (!best || vol < best.vol) best = { weights: full, vol };
    }
    if (!best) throw new Error(`No hay un portafolio long-only factible para ${(r * 100).toFixed(1)}% de retorno.`);
    return best.weights;
  }

  // Frontera eficiente long-only exacta: min-varianza global hasta el mejor activo individual
  // (el máximo retorno alcanzable sin shorting es 100% en el activo de mayor retorno esperado).
  function longOnlyFrontierCurve(mean, cov, riskFree, nPoints = 120) {
    const minVarW = longOnlyMinVarianceWeights(mean, cov);
    const minVarReturn = portfolioReturn(minVarW, mean);
    const minVarVol = portfolioVol(minVarW, cov);
    const maxAssetReturn = Math.max(...mean);

    const points = [];
    let tangencyPoint = null;
    for (let i = 0; i < nPoints; i++) {
      const r = minVarReturn + ((maxAssetReturn - minVarReturn) * i) / (nPoints - 1);
      let w;
      try {
        w = longOnlyTargetReturnWeights(mean, cov, r);
      } catch (e) {
        continue;
      }
      const vol = portfolioVol(w, cov);
      const ret = portfolioReturn(w, mean);
      const sharpe = sharpeRatio(ret, vol, riskFree);
      const point = { return: ret, vol, weights: w, sharpe };
      points.push(point);
      if (!tangencyPoint || sharpe > tangencyPoint.sharpe) tangencyPoint = point;
    }
    return {
      points,
      minVarPoint: { return: minVarReturn, vol: minVarVol, weights: minVarW },
      tangencyPoint,
    };
  }

  function weightTable(tickers, weights) {
    return tickers.map((t, i) => ({ ticker: t, weight: weights[i] }));
  }

  return {
    alignPrices,
    logReturnsMatrix,
    annualizedMean,
    annualizedCov,
    corrFromCov,
    portfolioReturn,
    portfolioVariance,
    portfolioVol,
    sharpeRatio,
    randomWeights,
    monteCarloSimulate,
    analyticFrontierCoeffs,
    minVarianceWeights,
    targetReturnWeights,
    analyticFrontierVol,
    analyticFrontierCurve,
    tangencyWeights,
    longOnlyMinVarianceWeights,
    longOnlyTargetReturnWeights,
    longOnlyFrontierCurve,
    weightTable,
    TRADING_DAYS,
  };
})();
