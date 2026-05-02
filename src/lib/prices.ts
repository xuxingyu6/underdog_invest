// Price fetching: CoinGecko (crypto, free, no key) + Finnhub (stocks, requires API key in localStorage)
import type { PriceQuote } from "./types";

const CACHE_KEY = "invest-price-cache-v1";
const CACHE_TTL_KEY = "invest-price-cache-ttl-v1";
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const isDev = import.meta.env.DEV;
const COINGECKO_BASE = isDev ? "/api/coingecko" : "/api/crypto-prices";
const FINNHUB_BASE = isDev ? "/api/finnhub" : "https://finnhub.io/api/v1";

type Cache = Record<string, PriceQuote>;

function readCache(): Cache {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeCache(c: Cache) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(c));
    localStorage.setItem(CACHE_TTL_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

function isCacheFresh(): boolean {
  const ttl = localStorage.getItem(CACHE_TTL_KEY);
  if (!ttl) return false;
  return Date.now() - parseInt(ttl, 10) < CACHE_TTL;
}

export function getCachedQuote(key: string): PriceQuote | undefined {
  return readCache()[key];
}

export function getFinnhubKey(): string {
  return localStorage.getItem("finnhub-api-key") || "";
}

export function setFinnhubKey(k: string) {
  localStorage.setItem("finnhub-api-key", k);
}

// Common crypto symbol -> CoinGecko id mapping
const CRYPTO_MAP: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  ADA: "cardano",
  DOGE: "dogecoin",
  XRP: "ripple",
  BNB: "binancecoin",
  AVAX: "avalanche-2",
  DOT: "polkadot",
  MATIC: "matic-network",
  LINK: "chainlink",
  TRX: "tron",
  LTC: "litecoin",
  SHIB: "shiba-inu",
  UNI: "uniswap",
  ATOM: "cosmos",
  FIL: "filecoin",
  NEAR: "near",
  APT: "aptos",
  ARB: "arbitrum",
  OP: "optimism",
  USDT: "tether",
  USDC: "usd-coin",
};

export function resolveCryptoId(symbolOrId: string): string {
  const upper = symbolOrId.toUpperCase();
  return CRYPTO_MAP[upper] ?? symbolOrId.toLowerCase();
}

async function fetchWithRetry(url: string, retries = 3): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(url);
    if (res.status === 429) {
      const wait = Math.min(2000 * Math.pow(2, i), 10000);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    return res;
  }
  throw new Error("max retries");
}

export async function fetchCryptoPrices(ids: string[]): Promise<Record<string, PriceQuote>> {
  if (!ids.length) return {};
  const cache = readCache();
  if (isCacheFresh()) {
    const out: Record<string, PriceQuote> = {};
    for (const id of ids) {
      const c = cache[`crypto:${id}`];
      if (c) out[`crypto:${id}`] = { ...c, stale: true };
    }
    return out;
  }
  try {
    const url = isDev
      ? `${COINGECKO_BASE}/simple/price?ids=${encodeURIComponent(
          ids.join(","),
        )}&vs_currencies=usd&include_24hr_change=true`
      : `${COINGECKO_BASE}?ids=${encodeURIComponent(ids.join(","))}`;
    const res = await fetchWithRetry(url);
    if (!res.ok) throw new Error("coingecko fail");
    const data = await res.json();
    const out: Record<string, PriceQuote> = {};
    for (const id of ids) {
      const row = data[id];
      if (row && typeof row.usd === "number") {
        const q: PriceQuote = {
          price: row.usd,
          change24h: row.usd_24h_change ?? 0,
          fetchedAt: Date.now(),
        };
        out[`crypto:${id}`] = q;
        cache[`crypto:${id}`] = q;
      }
    }
    writeCache(cache);
    return out;
  } catch {
    const out: Record<string, PriceQuote> = {};
    for (const id of ids) {
      const c = cache[`crypto:${id}`];
      if (c) out[`crypto:${id}`] = { ...c, stale: true };
    }
    return out;
  }
}

export async function fetchStockPrice(symbol: string): Promise<PriceQuote | null> {
  const key = getFinnhubKey();
  const cache = readCache();
  const cacheKey = `stock:${symbol.toUpperCase()}`;
  if (!key) {
    const c = cache[cacheKey];
    return c ? { ...c, stale: true } : null;
  }
  try {
    const url = `${FINNHUB_BASE}/quote?symbol=${encodeURIComponent(symbol)}&token=${key}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("finnhub fail");
    const data = await res.json();
    if (typeof data.c !== "number" || data.c === 0) throw new Error("no quote");
    const q: PriceQuote = {
      price: data.c,
      change24h: data.dp ?? 0,
      fetchedAt: Date.now(),
    };
    cache[cacheKey] = q;
    writeCache(cache);
    return q;
  } catch {
    const c = cache[cacheKey];
    return c ? { ...c, stale: true } : null;
  }
}

export async function fetchStockPrices(symbols: string[]): Promise<Record<string, PriceQuote>> {
  const out: Record<string, PriceQuote> = {};
  for (const s of symbols) {
    const q = await fetchStockPrice(s);
    if (q) out[`stock:${s.toUpperCase()}`] = q;
  }
  return out;
}
