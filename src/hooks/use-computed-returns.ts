import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { getHistory } from "@/lib/priceHistory";
import { resolveCryptoId } from "@/lib/prices";
import type { Trade, ScopeType, Holding } from "@/lib/types";

export interface DailyPoint {
  date: string;
  pnl: number;
  rate: number;
  marketValue: number;
}

function priceKey(symbol: string, type: string): string {
  if (type === "crypto") return `crypto:${resolveCryptoId(symbol)}`;
  return `${type}:${symbol.toUpperCase()}`;
}

function positionsAt(trades: Trade[], date: string): Record<string, { qty: number; type: string; symbol: string }> {
  const pos: Record<string, { qty: number; type: string; symbol: string }> = {};
  trades
    .filter((t) => t.type !== "cash" && t.date <= date)
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))
    .forEach((t) => {
      const k = `${t.type}:${t.symbol.toLowerCase()}`;
      const cur = pos[k] || { qty: 0, type: t.type, symbol: t.symbol };
      cur.qty += t.action === "buy" ? t.quantity : -t.quantity;
      if (cur.qty < 1e-7) cur.qty = 0;
      pos[k] = cur;
    });
  return pos;
}

function inScope(type: string, scope: ScopeType): boolean {
  if (scope === "all") return true;
  return type === scope;
}

export function useComputedReturns(scope: ScopeType) {
  const trades = useStore((s) => s.trades);
  const holdings = useStore((s) => s.holdings);

  return useMemo(() => {
    const history = getHistory();
    const dates = Object.keys(history).sort();
    const today = new Date().toISOString().slice(0, 10);

    // Build positions from direct holdings
    const currentHoldingsMap: Record<string, { qty: number; type: string; symbol: string }> = {};
    holdings.forEach((h: Holding) => {
      if (h.type === "cash") return;
      const k = `${h.type}:${h.symbol.toLowerCase()}`;
      currentHoldingsMap[k] = { qty: h.quantity, type: h.type, symbol: h.symbol };
    });

    // Build trade-based positions
    const latestDate = dates.length > 0 ? dates[dates.length - 1] : "";
    const tradePositions = latestDate ? positionsAt(trades, latestDate) : {};

    // Merge positions: trade positions take priority, fallback to direct holdings
    const allPositions: Record<string, { qty: number; type: string; symbol: string }> = {};
    Object.keys(tradePositions).forEach((k) => {
      if (tradePositions[k].qty > 0) allPositions[k] = tradePositions[k];
    });
    Object.keys(currentHoldingsMap).forEach((k) => {
      if (!allPositions[k] && currentHoldingsMap[k].qty > 0) allPositions[k] = currentHoldingsMap[k];
    });

    // Calculate daily returns for each date in history
    const dailyMap: Record<string, DailyPoint> = {};

    // If no history, create today's entry using current holdings
    if (dates.length === 0) {
      let pnl = 0;
      let cost = 0;

      Object.values(allPositions).forEach((p) => {
        if (p.qty <= 0) return;
        if (!inScope(p.type, scope)) return;
        const h = holdings.find((h) => `${h.type}:${h.symbol.toLowerCase()}` === `${p.type}:${p.symbol.toLowerCase()}`);
        if (!h || h.avgCost <= 0) return;

        // Try to get current price from history or use avgCost
        const key = priceKey(p.symbol, p.type);
        const currentPrice = h.manualPrice ?? h.avgCost;

        pnl += (currentPrice - h.avgCost) * p.qty;
        cost += h.avgCost * p.qty;
      });

      if (cost > 0) {
        dailyMap[today] = {
          date: today,
          pnl,
          rate: (pnl / cost) * 100,
          marketValue: cost + pnl,
        };
      }
    } else {
      // Calculate for each date in history
      for (const date of dates) {
        let pnl = 0;
        let cost = 0;

        Object.values(allPositions).forEach((p) => {
          if (p.qty <= 0) return;
          if (!inScope(p.type, scope)) return;
          const h = holdings.find((h) => `${h.type}:${h.symbol.toLowerCase()}` === `${p.type}:${p.symbol.toLowerCase()}`);
          if (!h || h.avgCost <= 0) return;

          const key = priceKey(p.symbol, p.type);
          const currentPrice = history[date]?.[key] ?? h.avgCost;

          pnl += (currentPrice - h.avgCost) * p.qty;
          cost += h.avgCost * p.qty;
        });

        if (cost > 0) {
          dailyMap[date] = {
            date,
            pnl,
            rate: (pnl / cost) * 100,
            marketValue: cost + pnl,
          };
        }
      }
    }

    // Monthly aggregation
    const monthMap: Record<string, { rate: number; pnl: number; days: number }> = {};
    Object.values(dailyMap).forEach((d) => {
      const k = d.date.slice(0, 7);
      const cur = monthMap[k] || { rate: 0, pnl: 0, days: 0 };
      cur.pnl += d.pnl;
      cur.days += 1;
      monthMap[k] = cur;
    });

    const tmpFactor: Record<string, number> = {};
    Object.values(dailyMap).forEach((d) => {
      const k = d.date.slice(0, 7);
      tmpFactor[k] = (tmpFactor[k] ?? 1) * (1 + d.rate / 100);
    });
    Object.keys(monthMap).forEach((k) => {
      monthMap[k].rate = ((tmpFactor[k] ?? 1) - 1) * 100;
    });

    return { dailyMap, monthMap };
  }, [trades, holdings, scope]);
}
