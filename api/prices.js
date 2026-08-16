// Vercel serverless function (Node runtime, sin dependencias).
// Proxy al endpoint de gráficas de Yahoo Finance para traer precios históricos
// diarios (ajustados por dividendos/splits) y evitar CORS en el navegador.
//
// Nota: se probó primero Stooq (CSV público, sin key) pero desde este entorno
// devuelve un reto anti-bot en JavaScript en vez del CSV — no resoluble desde
// un fetch server-side simple. Yahoo Finance funciona pasando un User-Agent
// de navegador (sin él responde 429).
//
// GET /api/prices?tickers=AAPL,MSFT,SPY&start=2015-01-01&end=2026-08-16

function toUnixSeconds(dateStr) {
  return Math.floor(new Date(dateStr + "T00:00:00Z").getTime() / 1000);
}

export default async function handler(req, res) {
  const { tickers, start, end } = req.query;

  if (!tickers || typeof tickers !== "string") {
    res.status(400).json({ error: "Falta el parámetro 'tickers' (comma-separated)." });
    return;
  }

  const list = tickers
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  if (list.length === 0) {
    res.status(400).json({ error: "La lista de tickers está vacía." });
    return;
  }

  const now = new Date();
  const defaultEnd = now.toISOString().slice(0, 10);
  const defaultStart = new Date(now.getFullYear() - 8, now.getMonth(), now.getDate())
    .toISOString()
    .slice(0, 10);

  const period1 = toUnixSeconds(start || defaultStart);
  const period2 = toUnixSeconds(end || defaultEnd);

  const data = {};
  const errors = {};

  await Promise.all(
    list.map(async (rawTicker) => {
      const symbol = rawTicker.trim().toUpperCase();
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
        symbol
      )}?period1=${period1}&period2=${period2}&interval=1d`;
      try {
        const r = await fetch(url, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
            Accept: "application/json",
          },
        });
        const json = await r.json();

        if (!r.ok || json?.chart?.error) {
          errors[rawTicker] = json?.chart?.error?.description || `Yahoo Finance respondió ${r.status}`;
          return;
        }

        const result = json?.chart?.result?.[0];
        const timestamps = result?.timestamp;
        const adjClose = result?.indicators?.adjclose?.[0]?.adjclose;
        const close = result?.indicators?.quote?.[0]?.close;
        const series = adjClose || close;

        if (!timestamps || !series) {
          errors[rawTicker] = "Ticker no encontrado";
          return;
        }

        const rows = [];
        for (let i = 0; i < timestamps.length; i++) {
          const price = series[i];
          if (price === null || price === undefined || !Number.isFinite(price)) continue;
          const date = new Date(timestamps[i] * 1000).toISOString().slice(0, 10);
          rows.push({ date, close: price });
        }

        if (rows.length < 30) {
          errors[rawTicker] = "Muy pocos datos históricos disponibles";
          return;
        }
        data[rawTicker] = rows;
      } catch (err) {
        errors[rawTicker] = "Error de red al consultar Yahoo Finance";
      }
    })
  );

  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
  res.status(200).json({ data, errors, range: { start: period1, end: period2 } });
}
