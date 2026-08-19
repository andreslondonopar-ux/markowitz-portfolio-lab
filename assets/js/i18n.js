// Diccionario ES/EN + helpers. Los valores pueden contener HTML (se usan con innerHTML
// en los elementos [data-i18n] y en los render*() de app.js/plots.js) — por eso nunca debe
// interpolarse texto de usuario (tickers) directo en un valor de este diccionario sin
// pasar por textContent en el DOM, ver `interaction.md` de la guía de dataviz.

const I18N = (() => {
  const STORAGE_KEY = "markowitzlab-locale";

  const dict = {
    "nav.intro": { es: "Intro", en: "Intro" },
    "nav.paso1": { es: "1. Activos", en: "1. Assets" },
    "nav.paso2": { es: "2. Datos", en: "2. Data" },
    "nav.paso3": { es: "3. Estadística", en: "3. Statistics" },
    "nav.paso4": { es: "4. Teoría", en: "4. Theory" },
    "nav.paso5": { es: "5. Monte Carlo", en: "5. Monte Carlo" },
    "nav.paso6": { es: "6. Frontera", en: "6. Frontier" },
    "nav.paso7": { es: "7. Portafolios", en: "7. Portfolios" },
    "nav.paso8": { es: "8. Calculadora", en: "8. Calculator" },
    "nav.limites": { es: "Límites", en: "Limits" },
    "nav.creador": { es: "Creador", en: "Creator" },

    "hero.eyebrow": { es: "Proyecto educativo · Teoría Moderna de Portafolios", en: "Educational project · Modern Portfolio Theory" },
    "hero.h1": { es: "Optimización de portafolios de Markowitz, paso a paso", en: "Markowitz portfolio optimization, step by step" },
    "hero.lead": {
      es: `En 1952, Harry Markowitz propuso una idea que le ganó el Nobel de Economía en 1990:
        un portafolio no se juzga activo por activo, sino como un todo — lo que importa no es
        solo cuánto rinde cada acción, sino cómo se mueven <em>juntas</em>. Este sitio recorre
        ese proceso completo con datos reales y en vivo: eliges los activos, y cada gráfica de
        abajo — precios, estadística, simulación, frontera eficiente — se recalcula frente a
        tus ojos.`,
      en: `In 1952, Harry Markowitz proposed an idea that won him the 1990 Nobel Prize in
        Economics: a portfolio isn't judged asset by asset, but as a whole — what matters
        isn't just how much each stock returns, but how they move <em>together</em>. This
        site walks through that entire process with real, live data: you pick the assets,
        and every chart below — prices, statistics, simulation, efficient frontier —
        recalculates right before your eyes.`,
    },

    "controls.tickersLabel": { es: "Tickers (uno a la vez — Enter para agregar)", en: "Tickers (one at a time — Enter to add)" },
    "controls.tickerPlaceholder": { es: "Ej. AAPL", en: "e.g. AAPL" },
    "controls.riskfreeLabel": { es: "Tasa libre de riesgo (% anual)", en: "Risk-free rate (% annual)" },
    "controls.yearsLabel": { es: "Años de histórico", en: "Years of history" },
    "controls.scenarioLabel": { es: "Escenario", en: "Scenario" },
    "controls.recalcBtn": { es: "Recalcular", en: "Recalculate" },
    "controls.loadingDefault": { es: "Cargando ejemplo por defecto…", en: "Loading default example…" },
    "controls.maxTickersHint": {
      es: "Máximo 10 tickers (la optimización long-only prueba combinaciones de activos, y crece rápido con cada uno adicional).",
      en: "Maximum 10 tickers (the long-only optimization tries combinations of assets, and grows fast with each additional one).",
    },

    "paso1.badge": { es: "PASO 1", en: "STEP 1" },
    "paso1.title": { es: "Selección de activos (stock picking)", en: "Asset selection (stock picking)" },
    "paso1.p1": {
      es: `Todo empieza por elegir un universo de activos candidatos. La tentación natural es
        escoger "las mejores acciones" — las de mayor retorno esperado. Pero la idea central
        de Markowitz es contraintuitiva: <strong>un activo mediocre por sí solo puede mejorar
        un portafolio</strong> si se mueve de forma distinta (poco correlacionada, o incluso
        negativamente correlacionada) a los demás.`,
      en: `It all starts with picking a universe of candidate assets. The natural temptation
        is to choose "the best stocks" — the ones with the highest expected return. But
        Markowitz's central idea is counterintuitive: <strong>a mediocre asset on its own
        can improve a portfolio</strong> if it moves differently (weakly correlated, or even
        negatively correlated) from the rest.`,
    },
    "paso1.p2": {
      es: `Por eso, además del retorno esperado de cada activo, la pieza de información más
        importante en esta etapa es cómo se correlacionan entre sí — eso se ve en el
        <a href="#paso3">Paso 3</a>. Prueba cambiando la lista de tickers arriba: por ejemplo,
        compara un set de acciones tecnológicas muy parecidas entre sí contra un set mezclado
        con bonos, oro o acciones defensivas.`,
      en: `That's why, besides each asset's expected return, the most important piece of
        information at this stage is how they correlate with each other — you'll see that in
        <a href="#paso3">Step 3</a>. Try changing the ticker list above: for example, compare
        a set of very similar tech stocks against a mixed set with bonds, gold, or defensive
        stocks.`,
    },
    "paso1.exampleTitle": { es: "En este ejemplo", en: "In this example" },
    "paso1.tickerHelp": {
      es: `Los tickers deben existir en Yahoo Finance (fuente de datos de este sitio). Para
        acciones/ETFs de EE. UU. basta con el símbolo normal (ej. <code>AAPL</code>); para
        otros mercados usa el sufijo de Yahoo Finance (ej. <code>SAP.DE</code>).`,
      en: `Tickers must exist on Yahoo Finance (this site's data source). For US
        stocks/ETFs the plain symbol is enough (e.g. <code>AAPL</code>); for other markets
        use Yahoo Finance's suffix (e.g. <code>SAP.DE</code>).`,
    },

    "paso2.badge": { es: "PASO 2", en: "STEP 2" },
    "paso2.title": { es: "Datos históricos y retornos", en: "Historical data and returns" },
    "paso2.p": {
      es: `Con los tickers elegidos, se descarga el histórico de precios de cierre diarios y se
        normaliza a base 100 para poder comparar activos con precios muy distintos en la misma
        escala. De ahí se calculan los <strong>retornos logarítmicos diarios</strong>
        (<code>ln(P_t / P_{t-1})</code>), la unidad básica sobre la que se construye todo lo
        demás — se usan log-retornos porque son aditivos en el tiempo y se comportan mejor
        estadísticamente que el retorno simple.`,
      en: `Once the tickers are chosen, daily closing prices are downloaded and normalized to
        base 100 so assets with very different prices can be compared on the same scale. From
        there the <strong>daily log returns</strong> are computed (<code>ln(P_t /
        P_{t-1})</code>), the basic unit everything else is built on — log returns are used
        because they're additive over time and behave better statistically than simple
        returns.`,
    },

    "paso3.badge": { es: "PASO 3", en: "STEP 3" },
    "paso3.title": { es: "Estadística: retorno, riesgo y correlación", en: "Statistics: return, risk, and correlation" },
    "paso3.p": {
      es: `De los retornos diarios se obtienen tres piezas anualizadas por activo: el
        <strong>retorno esperado</strong> (el promedio, ×252 días hábiles), la
        <strong>volatilidad</strong> (la desviación estándar, ×√252) como medida de riesgo, y la
        <strong>matriz de correlación</strong> entre todos los activos — el ingrediente que hace
        que la diversificación funcione.`,
      en: `From the daily returns, three annualized figures are derived per asset:
        <strong>expected return</strong> (the mean, ×252 trading days), <strong>volatility</strong>
        (the standard deviation, ×√252) as a risk measure, and the <strong>correlation
        matrix</strong> across all assets — the ingredient that makes diversification work.`,
    },
    "paso3.corrTitle": { es: "Correlación entre activos", en: "Correlation between assets" },
    "paso3.statsTitle": { es: "Retorno y volatilidad por activo", en: "Return and volatility by asset" },

    "paso4.badge": { es: "PASO 4", en: "STEP 4" },
    "paso4.title": { es: "La teoría de Markowitz", en: "Markowitz's theory" },
    "paso4.p1": {
      es: "El retorno esperado de un portafolio con pesos <code>w</code> es simplemente el promedio ponderado de los retornos individuales:",
      en: "The expected return of a portfolio with weights <code>w</code> is simply the weighted average of the individual returns:",
    },
    "paso4.p2": {
      es: `Pero el riesgo del portafolio <strong>no</strong> es el promedio ponderado de los riesgos
        individuales — depende de la matriz de covarianza completa <code>Σ</code>, que captura
        cómo se mueven los activos entre sí:`,
      en: `But portfolio risk is <strong>not</strong> the weighted average of the individual
        risks — it depends on the full covariance matrix <code>Σ</code>, which captures how
        the assets move relative to one another:`,
    },
    "paso4.p3": {
      es: "El problema de Markowitz consiste en encontrar, para cada nivel de retorno objetivo, los pesos que minimizan esa varianza:",
      en: "The Markowitz problem is to find, for each target return level, the weights that minimize that variance:",
    },
    // La palabra "sujeto a"/"subject to" queda dentro del LaTeX (\text{...}), por eso esta
    // fórmula también necesita traducirse — a diferencia de las demás, que son notación
    // matemática pura sin palabras en ningún idioma.
    "paso4.constraintFormula": {
      es: String.raw`$$ \min_{\mathbf{w}} \; \mathbf{w}^\top \Sigma \, \mathbf{w} \quad \text{sujeto a} \quad \mathbf{w}^\top \boldsymbol{\mu} = R_{obj}, \quad \mathbf{w}^\top \mathbf{1} = 1 $$`,
      en: String.raw`$$ \min_{\mathbf{w}} \; \mathbf{w}^\top \Sigma \, \mathbf{w} \quad \text{subject to} \quad \mathbf{w}^\top \boldsymbol{\mu} = R_{obj}, \quad \mathbf{w}^\top \mathbf{1} = 1 $$`,
    },
    "paso4.p4": {
      es: `Resolviendo ese problema con multiplicadores de Lagrange se llega a una fórmula cerrada
        (sin necesidad de un solver numérico) usando cuatro escalares derivados de <code>Σ⁻¹</code>:
        <code>A = 1ᵀΣ⁻¹1</code>, <code>B = 1ᵀΣ⁻¹μ</code>, <code>C = μᵀΣ⁻¹μ</code> y
        <code>D = AC − B²</code>. Con ellos, el portafolio óptimo para cualquier retorno objetivo
        <code>r</code> es:`,
      en: `Solving that problem with Lagrange multipliers leads to a closed-form formula (no
        numerical solver needed) using four scalars derived from <code>Σ⁻¹</code>:
        <code>A = 1ᵀΣ⁻¹1</code>, <code>B = 1ᵀΣ⁻¹μ</code>, <code>C = μᵀΣ⁻¹μ</code>, and
        <code>D = AC − B²</code>. With them, the optimal portfolio for any target return
        <code>r</code> is:`,
    },
    "paso4.p5": {
      es: "Este sitio calcula esos escalares con álgebra matricial en el navegador, en vivo, con tus propios activos (código en <code>assets/js/markowitz.js</code>).",
      en: "This site computes those scalars with matrix algebra in the browser, live, with your own assets (code in <code>assets/js/markowitz.js</code>).",
    },
    "paso4.assumptions": {
      es: `<strong>Supuestos del modelo — con honestidad sobre sus límites:</strong> asume que los
        retornos siguen (aproximadamente) una distribución normal, que media y varianza resumen
        bien el riesgo, que no hay costos de transacción ni impuestos, y que el inversionista es
        racional y averso al riesgo. En la práctica los retornos tienen colas más pesadas de lo
        normal y las correlaciones cambian en crisis — precisamente cuando más importa la
        diversificación. Es un punto de partida riguroso, no la última palabra.`,
      en: `<strong>Model assumptions — honestly, limits included:</strong> it assumes returns
        are (approximately) normally distributed, that mean and variance summarize risk well,
        that there are no transaction costs or taxes, and that the investor is rational and
        risk-averse. In practice, returns have fatter tails than normal and correlations shift
        in crises — precisely when diversification matters most. It's a rigorous starting
        point, not the last word.`,
    },

    "paso5.badge": { es: "PASO 5", en: "STEP 5" },
    "paso5.title": { es: "Simulación Monte Carlo", en: "Monte Carlo simulation" },
    "paso5.p": {
      es: `Antes de resolver la fórmula cerrada, vale la pena <em>verla</em>: se generan miles de
        portafolios con pesos aleatorios (siempre positivos y sumando 100%, es decir, sin ventas
        en corto) y se ubica cada uno en un plano de riesgo (eje x) vs. retorno (eje y), coloreado
        por su Sharpe ratio. Esta nube es un mapa empírico de "qué es posible" con estos activos.`,
      en: `Before solving the closed-form formula, it's worth <em>seeing</em> it: thousands of
        portfolios are generated with random weights (always positive and summing to 100%,
        i.e. no short selling) and each one is placed on a risk (x-axis) vs. return (y-axis)
        plane, colored by its Sharpe ratio. This cloud is an empirical map of "what's
        possible" with these assets.`,
    },

    "paso6.badge": { es: "PASO 6", en: "STEP 6" },
    "paso6.title": { es: "La frontera eficiente", en: "The efficient frontier" },
    "paso6.p": {
      es: `La <strong>frontera eficiente</strong> es el borde superior-izquierdo de lo posible: para
        cada nivel de riesgo, el máximo retorno alcanzable (o, equivalentemente, para cada retorno
        objetivo, el mínimo riesgo). El <strong>escenario base de este sitio es long-only</strong>
        (sin ventas en corto, como la mayoría de portafolios reales) — esa es la curva
        <strong>naranja</strong>. La curva <strong>blanca</strong> es la versión
        <em>analítica</em> del Paso 4, que sí permite shorting sin restricción (por eso puede
        "salirse" de la nube). En el gráfico, la curva resaltada (sólida y gruesa) es siempre el
        escenario activo — cámbialo con el interruptor de arriba para explorarlo en el Paso 8.`,
      en: `The <strong>efficient frontier</strong> is the upper-left edge of what's possible:
        for each risk level, the maximum achievable return (or, equivalently, for each target
        return, the minimum risk). This site's <strong>base scenario is long-only</strong> (no
        short selling, like most real portfolios) — that's the <strong>orange</strong> curve.
        The <strong>white</strong> curve is the <em>analytical</em> version from Step 4, which
        does allow unrestricted shorting (which is why it can "step outside" the cloud). In
        the chart, the highlighted curve (solid and thick) is always the active scenario —
        switch it with the toggle above to explore it in Step 8.`,
    },

    "paso7.badge": { es: "PASO 7", en: "STEP 7" },
    "paso7.title": { es: "Portafolios notables", en: "Notable portfolios" },
    "paso7.p": {
      es: `Sobre la frontera hay dos puntos especialmente importantes: el de
        <strong>mínima varianza</strong> (el portafolio menos riesgoso posible, sin importar el
        retorno) y el <strong>portafolio tangente</strong> — el que maximiza el Sharpe ratio,
        donde una línea recta desde la tasa libre de riesgo toca la frontera (la
        <strong>Capital Market Line</strong>). Según la teoría, todo inversionista racional debería
        combinar solo dos cosas: el activo libre de riesgo y este portafolio tangente, ajustando
        la mezcla según su apetito de riesgo.`,
      en: `There are two especially important points on the frontier: the
        <strong>minimum-variance</strong> portfolio (the least risky one possible, regardless
        of return) and the <strong>tangency portfolio</strong> — the one that maximizes the
        Sharpe ratio, where a straight line from the risk-free rate touches the frontier (the
        <strong>Capital Market Line</strong>). According to theory, every rational investor
        should combine just two things: the risk-free asset and this tangency portfolio,
        adjusting the mix to their risk appetite.`,
    },
    "paso7.tangencyWeightsTitle": { es: "Pesos del portafolio tangente", en: "Tangency portfolio weights" },
    "paso7.comparisonTitle": { es: "Comparación de portafolios", en: "Portfolio comparison" },

    "paso8.badge": { es: "PASO 8", en: "STEP 8" },
    "paso8.title": { es: "Calculadora: elige tu nivel de riesgo", en: "Calculator: choose your risk level" },
    "paso8.p": {
      es: "Mueve el control para fijar un retorno anual objetivo y observa en vivo qué pesos exactos necesitas en cada activo para lograr ese retorno con el mínimo riesgo posible.",
      en: "Move the control to set a target annual return and watch, live, exactly which weights you need in each asset to reach that return with the lowest possible risk.",
    },
    "paso8.sliderLabel": { es: "Retorno objetivo", en: "Target return" },

    "limits.badge": { es: "LÍMITES", en: "LIMITS" },
    "limits.title": { es: "Limitaciones y para seguir leyendo", en: "Limitations and further reading" },
    "limits.callout": {
      es: `Este sitio es material educativo, no asesoría financiera. Los datos vienen de Yahoo
        Finance (fuente gratuita, sin garantía de exactitud y con posibles huecos). El retorno
        esperado se estima como el promedio histórico, un predictor pobre del futuro — y los
        pesos "óptimos" se calculan sobre el mismo histórico que se usó para estimarlo, es
        decir, es optimización dentro de la muestra, no una predicción validada fuera de ella.
        (Los demás supuestos del modelo — normalidad, sin costos de transacción — están en el
        Paso 4.)`,
      en: `This site is educational material, not financial advice. Data comes from Yahoo
        Finance (a free source, with no accuracy guarantee and possible gaps). Expected return
        is estimated as the historical average, a poor predictor of the future — and the
        "optimal" weights are computed on the very same history used to estimate it, meaning
        this is in-sample optimization, not an out-of-sample validated prediction. (The
        model's other assumptions — normality, no transaction costs — are covered in Step 4.)`,
    },
    "limits.reading": {
      es: `Para profundizar: Harry Markowitz, <em>"Portfolio Selection"</em>, Journal of Finance
        (1952) — el paper original; William Sharpe y el modelo CAPM, que extiende esta misma idea
        a un mercado de equilibrio — puedes explorarlo en vivo, con el mismo formato paso a
        paso, en <a href="https://capm-beta-lab.vercel.app" target="_blank" rel="noopener">CAPM Beta-Alpha Lab</a>.`,
      en: `To go deeper: Harry Markowitz, <em>"Portfolio Selection"</em>, Journal of Finance
        (1952) — the original paper; William Sharpe and the CAPM model, which extends this
        same idea to an equilibrium market — explore it live, in the same step-by-step
        format, at <a href="https://capm-beta-lab.vercel.app" target="_blank" rel="noopener">CAPM Beta-Alpha Lab</a>.`,
    },

    "creator.badge": { es: "CREADOR", en: "CREATOR" },
    "creator.title": { es: "Sobre el creador", en: "About the creator" },
    "creator.text": {
      es: "Hecho por Andrés Londoño.",
      en: "Made by Andrés Londoño.",
    },

    "footer.text": {
      es: "Markowitz Portfolio Lab — proyecto educativo independiente. Datos: Yahoo Finance. Cómputo: 100% en el navegador (JavaScript), sin backend de optimización.",
      en: "Markowitz Portfolio Lab — an independent educational project. Data: Yahoo Finance. Computation: 100% in the browser (JavaScript), no optimization backend.",
    },

    // --- Generado por JS (app.js / plots.js) ---
    "app.removeTicker": { es: "Quitar {ticker}", en: "Remove {ticker}" },
    "app.maxTickersError": {
      es: "Máximo {n} tickers — la optimización long-only prueba todas las combinaciones posibles y crece rápido con cada activo adicional.",
      en: "Maximum {n} tickers — the long-only optimization tries every possible combination and grows fast with each additional asset.",
    },
    "app.needTwoTickers": { es: "Agrega al menos 2 tickers.", en: "Add at least 2 tickers." },
    "app.downloading": { es: "Descargando precios de {list}…", en: "Downloading prices for {list}…" },
    "app.priceFetchError": { es: "Error al consultar precios", en: "Error fetching prices" },
    "app.notEnoughValid": { es: "No hay suficientes tickers válidos. ", en: "Not enough valid tickers. " },
    "app.tooFewDates": { es: "Muy pocas fechas en común entre los activos elegidos.", en: "Too few overlapping dates among the chosen assets." },
    "app.covInvertError": { es: "No se pudo invertir la matriz de covarianza: ", en: "Could not invert the covariance matrix: " },
    "app.computingFrontier": { es: "Calculando la frontera long-only exacta para {n} activos…", en: "Computing the exact long-only frontier for {n} assets…" },
    "app.omitted": { es: " (omitidos: {list})", en: " (skipped: {list})" },
    "app.ready": {
      es: "Listo — {n} activos, {n2} observaciones diarias ({d1} → {d2}).",
      en: "Ready — {n} assets, {n2} daily observations ({d1} → {d2}).",
    },
    "app.unexpectedError": { es: "Error inesperado.", en: "Unexpected error." },
    "app.couldNotSolve": { es: "No se pudo resolver este punto.", en: "Could not solve this point." },
    "app.shortNote": { es: "Este portafolio vende en corto: {list}.", en: "This portfolio shorts: {list}." },
    "app.noShortNote": {
      es: "Este portafolio no requiere ventas en corto — todos los pesos son ≥ 0.",
      en: "This portfolio requires no short selling — all weights are ≥ 0.",
    },
    "app.viewTable": { es: "Ver como tabla", en: "View as table" },
    "app.hideTable": { es: "Ocultar tabla", en: "Hide table" },
    "app.scenarioLongOnly": { es: "Long-only (base)", en: "Long-only (base)" },
    "app.scenarioShort": { es: "Con shorting", en: "With shorting" },
    "app.tableAsset": { es: "Activo", en: "Asset" },
    "app.tableExpReturn": { es: "Retorno esp.", en: "Exp. return" },
    "app.tableVolatility": { es: "Volatilidad", en: "Volatility" },
    "app.tablePortfolio": { es: "Portafolio", en: "Portfolio" },
    "app.tableReturn": { es: "Retorno", en: "Return" },
    "app.tableVol": { es: "Vol", en: "Vol" },
    "app.tableSharpe": { es: "Sharpe", en: "Sharpe" },
    "app.tableWeight": { es: "Peso", en: "Weight" },
    "app.statVol": { es: "vol", en: "vol" },
    "app.portfolioEqualWeight": { es: "Equal-weight", en: "Equal-weight" },
    "app.portfolioMinVar": { es: "Mínima varianza", en: "Minimum variance" },
    "app.portfolioTangency": { es: "Tangente (máx Sharpe)", en: "Tangency (max Sharpe)" },
    "app.notableMinVarReturn": { es: "Mín. varianza · retorno", en: "Min. variance · return" },
    "app.notableMinVarVol": { es: "Mín. varianza · vol", en: "Min. variance · vol" },
    "app.notableTanReturn": { es: "Tangente · retorno", en: "Tangency · return" },
    "app.notableTanVol": { es: "Tangente · vol", en: "Tangency · vol" },
    "app.notableTanSharpe": { es: "Tangente · Sharpe", en: "Tangency · Sharpe" },
    "app.notableRiskFree": { es: "Tasa libre de riesgo", en: "Risk-free rate" },
    "app.targetReturn": { es: "Retorno objetivo", en: "Target return" },
    "app.targetVol": { es: "Riesgo resultante", en: "Resulting risk" },
    "app.paso8CalloutLongOnly": {
      es: `<strong>Escenario base: sin ventas en corto.</strong> Todos los pesos aquí son ≥ 0 —
        se probaron todas las combinaciones de activos posibles y se tomó la de menor riesgo
        para cada retorno objetivo. Activa <strong>"Permitir shorting"</strong> arriba si
        quieres ver la versión teórica sin restricción (Paso 4), que puede pedir posiciones
        negativas.`,
      en: `<strong>Base scenario: no short selling.</strong> Every weight here is ≥ 0 — every
        possible combination of assets was tried and the lowest-risk one was kept for each
        target return. Turn on <strong>"Allow shorting"</strong> above if you want to see the
        unrestricted theoretical version (Step 4), which can call for negative positions.`,
    },
    "app.paso8CalloutShort": {
      es: `<strong>Shorting activado.</strong> Esta calculadora ahora usa la fórmula
        <em>analítica</em> sin restricción del Paso 4. Un peso negativo significa vender ese
        activo en corto para financiar una posición más grande en los demás — no es un error,
        es lo que implica quitar la restricción de no-negatividad. Desactiva el interruptor de
        arriba para volver al escenario base (long-only).`,
      en: `<strong>Shorting enabled.</strong> This calculator now uses the unrestricted
        <em>analytical</em> formula from Step 4. A negative weight means shorting that asset
        to fund a bigger position in the others — that's not an error, it's what removing the
        non-negativity constraint implies. Turn the toggle above off to go back to the base
        (long-only) scenario.`,
    },

    // --- Gráficas (plots.js) ---
    "charts.priceYAxis": { es: "Precio normalizado (base 100)", en: "Normalized price (base 100)" },
    "charts.monteCarloName": { es: "Simulación Monte Carlo (long-only)", en: "Monte Carlo simulation (long-only)" },
    "charts.sharpeColorbar": { es: "Sharpe", en: "Sharpe" },
    "charts.hoverVolReturn": { es: "Vol: %{x:.2f}%<br>Retorno: %{y:.2f}%<extra></extra>", en: "Vol: %{x:.2f}%<br>Return: %{y:.2f}%<extra></extra>" },
    "charts.longOnlyCurveActive": { es: "Frontera long-only (escenario base)", en: "Long-only frontier (base scenario)" },
    "charts.longOnlyCurveInactive": { es: "Frontera long-only (sin shorting)", en: "Long-only frontier (no shorting)" },
    "charts.analyticCurveActive": { es: "Frontera analítica (escenario con shorting)", en: "Analytical frontier (shorting scenario)" },
    "charts.analyticCurveInactive": { es: "Frontera analítica (permite shorting)", en: "Analytical frontier (allows shorting)" },
    "charts.cml": { es: "Capital Market Line", en: "Capital Market Line" },
    "charts.minVar": { es: "Mínima varianza", en: "Minimum variance" },
    "charts.tangency": { es: "Portafolio tangente (máx Sharpe)", en: "Tangency portfolio (max Sharpe)" },
    "charts.volAxis": { es: "Volatilidad anualizada (%)", en: "Annualized volatility (%)" },
    "charts.returnAxis": { es: "Retorno esperado anualizado (%)", en: "Annualized expected return (%)" },
    "charts.weightAxis": { es: "Peso en el portafolio (%)", en: "Portfolio weight (%)" },
  };

  let locale = (localStorage.getItem(STORAGE_KEY) === "en") ? "en" : "es";

  function t(key, vars) {
    const entry = dict[key];
    let str = entry ? entry[locale] || entry.es : key;
    if (vars) {
      Object.keys(vars).forEach((k) => {
        str = str.replaceAll(`{${k}}`, vars[k]);
      });
    }
    return str;
  }

  function getLocale() {
    return locale;
  }

  function setLocale(newLocale) {
    locale = newLocale === "en" ? "en" : "es";
    localStorage.setItem(STORAGE_KEY, locale);
    document.documentElement.lang = locale;
    applyStaticTranslations();
  }

  function applyStaticTranslations() {
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      el.innerHTML = t(key);
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      el.placeholder = t(el.getAttribute("data-i18n-placeholder"));
    });
  }

  return { t, getLocale, setLocale, applyStaticTranslations };
})();
