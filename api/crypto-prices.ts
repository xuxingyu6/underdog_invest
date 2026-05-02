const CACHE_TTL = 10 * 60 * 1000;

interface CacheEntry {
  data: Record<string, { usd: number; usd_24h_change: number | null }>;
  ts: number;
}

let cache: CacheEntry | null = null;

async function fetchFromCoinGecko(ids: string): Promise<Record<string, { usd: number; usd_24h_change: number | null }>> {
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(
    ids
  )}&vs_currencies=usd&include_24hr_change=true`;

  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
      });

      if (res.status === 429) {
        if (attempt < 3) {
          const wait = Math.min(2000 * Math.pow(2, attempt), 15000);
          await new Promise((r) => setTimeout(r, wait));
          continue;
        }
        throw new Error("rate limited after retries");
      }

      if (!res.ok) {
        throw new Error(`upstream ${res.status}`);
      }

      return await res.json();
    } catch (err) {
      if (attempt < 3) {
        const wait = Math.min(1000 * Math.pow(2, attempt), 8000);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      throw err;
    }
  }

  throw new Error("max retries");
}

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
    const data = await fetchFromCoinGecko(ids);
    cache = { data, ts: Date.now() };
    res.status(200).json(filterData(data, ids));
  } catch {
    if (cache) {
      res.status(200).json(filterData(cache.data, ids));
      return;
    }
    res.status(502).json({ error: "fetch failed after retries" });
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
