import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import {
  fetchCryptoPrices,
  fetchStockPrices,
  resolveCryptoId,
  getCachedQuote,
} from "@/lib/prices";
import type { Holding, PriceQuote } from "@/lib/types";

export interface PricedHolding extends Holding {
  currentPrice: number;
  priceChange24h: number;
  priceStale: boolean;
  marketValue: number;
  pnl: number;
  pnlPct: number;
}

export function usePricedHoldings() {
  const holdings = useStore((s) => s.holdings);
  const [quotes, setQuotes] = useState<Record<string, PriceQuote>>({});
  const [loading, setLoading] = useState(false);
  const [lastFetch, setLastFetch] = useState<number>(0);

  const cryptoIds = useMemo(
    () =>
      Array.from(
        new Set(
          holdings
            .filter((h) => h.type === "crypto")
            .map((h) => resolveCryptoId(h.priceId || h.symbol)),
        ),
      ),
    [holdings],
  );

  const stockSymbols = useMemo(
    () =>
      Array.from(
        new Set(
          holdings
            .filter((h) => h.type === "stock")
            .map((h) => (h.priceId || h.symbol).toUpperCase()),
        ),
      ),
    [holdings],
  );

  const refresh = async () => {
    setLoading(true);
    const [c, s] = await Promise.all([
      fetchCryptoPrices(cryptoIds),
      fetchStockPrices(stockSymbols),
    ]);
    const merged = { ...c, ...s };
    setQuotes((prev) => ({ ...prev, ...merged }));
    // record fresh (non-stale) prices into history snapshot for today
    const snapshot: Record<string, number> = {};
    Object.entries(merged).forEach(([k, q]) => {
      if (q && !q.stale && isFinite(q.price)) snapshot[k] = q.price;
    });
    // Also record manual prices for gold/bond/other holdings
    holdings.forEach((h) => {
      if (h.type === "gold" || h.type === "bond" || h.type === "other") {
        if (h.manualPrice && isFinite(h.manualPrice)) {
          const key = `${h.type}:${h.symbol.toUpperCase()}`;
          snapshot[key] = h.manualPrice;
        }
      }
    });
    if (Object.keys(snapshot).length) {
      const { recordSnapshot } = await import("@/lib/priceHistory");
      recordSnapshot(snapshot);
    }
    setLastFetch(Date.now());
    setLoading(false);
  };

  // initial fetch + 60s interval
  useEffect(() => {
    // load any cached quotes first to render immediately
    const cachePreload: Record<string, PriceQuote> = {};
    cryptoIds.forEach((id) => {
      const q = getCachedQuote(`crypto:${id}`);
      if (q) cachePreload[`crypto:${id}`] = { ...q, stale: true };
    });
    stockSymbols.forEach((s) => {
      const q = getCachedQuote(`stock:${s}`);
      if (q) cachePreload[`stock:${s}`] = { ...q, stale: true };
    });
    if (Object.keys(cachePreload).length) setQuotes((p) => ({ ...cachePreload, ...p }));

    if (cryptoIds.length || stockSymbols.length) {
      refresh();
    }
    const t = setInterval(() => {
      if (cryptoIds.length || stockSymbols.length) refresh();
    }, 60_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cryptoIds.join(","), stockSymbols.join(",")]);

  const priced: PricedHolding[] = holdings.map((h) => {
    let price = 0;
    let change = 0;
    let stale = false;
    if (h.type === "cash") {
      price = 1;
    } else if (h.type === "stock") {
      const key = `stock:${(h.priceId || h.symbol).toUpperCase()}`;
      const q = quotes[key];
      if (q) {
        price = q.price;
        change = q.change24h;
        stale = !!q.stale;
      } else if (h.manualPrice) {
        price = h.manualPrice;
        stale = true;
      }
    } else if (h.type === "crypto") {
      const key = `crypto:${resolveCryptoId(h.priceId || h.symbol)}`;
      const q = quotes[key];
      if (q) {
        price = q.price;
        change = q.change24h;
        stale = !!q.stale;
      } else if (h.manualPrice) {
        price = h.manualPrice;
        stale = true;
      }
    } else {
      // gold / bond / other => use manualPrice
      price = h.manualPrice ?? h.avgCost;
    }
    const marketValue = price * h.quantity;
    const cost = h.avgCost * h.quantity;
    const pnl = marketValue - cost;
    const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0;
    return {
      ...h,
      currentPrice: price,
      priceChange24h: change,
      priceStale: stale,
      marketValue,
      pnl,
      pnlPct,
    };
  });

  return { priced, loading, lastFetch, refresh };
}
