const CACHE_TTL = 10 * 60 * 1000;

interface CacheEntry {
  data: Record<string, { usd: number; usd_24h_change: number | null }>;
  ts: number;
}

let cache: CacheEntry | null = null;

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  const ids = (req.query.ids as string) || "";
  if (!ids) {
    res.status(400).json({ error: "missing ids" });
    return;
  }

  if (cache && Date.now() - cache.ts < CACHE_TTL) {
    res.status(200).json(filterData(cache.data, ids));
    return;
  }

  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(
      ids
    )}&vs_currencies=usd&include_24hr_change=true`;

    const fetchRes = await fetch(url, {
      headers: { Accept: "application/json" },
    });

    if (fetchRes.status === 429) {
      if (cache) {
        res.status(200).json(filterData(cache.data, ids));
        return;
      }
      res.status(429).json({ error: "rate limited, no cache" });
      return;
    }

    if (!fetchRes.ok) {
      if (cache) {
        res.status(200).json(filterData(cache.data, ids));
        return;
      }
      res.status(502).json({ error: "upstream error" });
      return;
    }

    const data = await fetchRes.json();
    cache = { data, ts: Date.now() };
    res.status(200).json(filterData(data, ids));
  } catch {
    if (cache) {
      res.status(200).json(filterData(cache.data, ids));
      return;
    }
    res.status(502).json({ error: "fetch failed" });
  }
}

function filterData(
  data: Record<string, { usd: number; usd_24h_change: number | null }>,
  ids: string
) {
  const idList = ids.split(",");
  const out: Record<string, { usd: number; usd_24h_change: number | null }> = {};
  for (const id of idList) {
    if (data[id]) out[id] = data[id];
  }
  return out;
}
