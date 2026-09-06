import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Holding, Trade, ReturnEntry, AssetType, ClearedHolding } from "./types";
import { uid } from "./format";

function todayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

interface State {
  holdings: Holding[];
  trades: Trade[];
  returns: ReturnEntry[];
  clearedHoldings: ClearedHolding[];
  removedHoldings: Holding[];

  addHolding: (h: Omit<Holding, "id" | "createdAt">) => void;
  updateHolding: (id: string, patch: Partial<Holding>) => void;
  deleteHolding: (id: string) => void;
  setManualPrice: (id: string, price: number) => void;

  addTrade: (t: Omit<Trade, "id" | "createdAt">) => void;
  updateTrade: (id: string, patch: Partial<Omit<Trade, "id" | "createdAt">>) => void;
  deleteTrade: (id: string) => void;

  addReturn: (r: Omit<ReturnEntry, "id" | "createdAt">) => void;
  updateReturn: (id: string, patch: Partial<ReturnEntry>) => void;
  deleteReturn: (id: string) => void;

  deleteClearedHolding: (id: string) => void;

  importAll: (data: { holdings: Holding[]; trades: Trade[]; returns: ReturnEntry[]; clearedHoldings?: ClearedHolding[] }) => void;
  applySnapshot: (data: {
    holdings: Holding[];
    trades: Trade[];
    returns: ReturnEntry[];
    clearedHoldings?: ClearedHolding[];
    removedHoldings?: Holding[];
  }) => void;
  reset: () => void;
}

function computeAvgBuyCost(trades: Trade[], symbol: string, type: AssetType): number {
  const buyTrades = trades.filter(
    (t) => t.action === "buy" && t.symbol.toLowerCase() === symbol.toLowerCase() && t.type === type
  );
  if (buyTrades.length === 0) return 0;
  const totalQty = buyTrades.reduce((s, t) => s + t.quantity, 0);
  const totalAmount = buyTrades.reduce((s, t) => s + t.quantity * t.price, 0);
  return totalQty > 0 ? totalAmount / totalQty : 0;
}

function applyTradeToHoldings(
  holdings: Holding[],
  trades: Trade[],
  t: Omit<Trade, "id" | "createdAt">
): { holdings: Holding[]; tradeExtras: { realizedPnl?: number; realizedPnlPct?: number } } {
  if (t.type === "cash") return { holdings, tradeExtras: {} };
  const idx = holdings.findIndex((h) => h.symbol.toLowerCase() === t.symbol.toLowerCase() && h.type === t.type);
  if (t.action === "buy") {
    if (idx === -1) {
      const newH: Holding = {
        id: uid(),
        symbol: t.symbol.toUpperCase(),
        type: t.type as AssetType,
        quantity: t.quantity,
        avgCost: t.price,
        priceId: t.type === "crypto" ? t.symbol.toLowerCase() : t.symbol.toUpperCase(),
        createdAt: new Date().toISOString(),
      };
      return { holdings: [...holdings, newH], tradeExtras: {} };
    }
    const h = holdings[idx];
    const totalQty = h.quantity + t.quantity;
    const newAvg = totalQty > 0 ? (h.quantity * h.avgCost + t.quantity * t.price) / totalQty : 0;
    const updated = { ...h, quantity: totalQty, avgCost: newAvg };
    const next = [...holdings];
    next[idx] = updated;
    return { holdings: next, tradeExtras: {} };
  } else {
    if (idx === -1) return { holdings, tradeExtras: {} };
    const h = holdings[idx];
    if (t.quantity > h.quantity + 0.0000001) {
      return { holdings, tradeExtras: { realizedPnl: NaN } };
    }
    const avgBuyCost = computeAvgBuyCost(trades, t.symbol, t.type);
    const effectiveAvgCost = avgBuyCost > 0 ? avgBuyCost : h.avgCost;
    const realizedPnl = (t.price - effectiveAvgCost) * t.quantity;
    const realizedPnlPct = effectiveAvgCost > 0 ? ((t.price - effectiveAvgCost) / effectiveAvgCost) * 100 : 0;
    const newQty = h.quantity - t.quantity;
    if (newQty <= 0.0000001) {
      return { holdings: holdings.filter((_, i) => i !== idx), tradeExtras: { realizedPnl, realizedPnlPct } };
    }
    const next = [...holdings];
    next[idx] = { ...h, quantity: newQty };
    return { holdings: next, tradeExtras: { realizedPnl, realizedPnlPct } };
  }
}

function rebuildHoldingsFromTrades(holdings: Holding[], trades: Trade[], affectedKeys: string[]): Holding[] {
  const keys = new Set(affectedKeys);
  const grouped: Record<string, Trade[]> = {};
  trades.forEach((t) => {
    if (t.type === "cash") return;
    const k = `${t.type}:${t.symbol.toLowerCase()}`;
    (grouped[k] ||= []).push(t);
  });
  const compute = (list: Trade[]) => {
    const sorted = list.slice().sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
    let qty = 0;
    let avg = 0;
    for (const t of sorted) {
      if (t.action === "buy") {
        const total = qty + t.quantity;
        avg = total > 0 ? (qty * avg + t.quantity * t.price) / total : 0;
        qty = total;
      } else {
        qty = qty - t.quantity;
        if (qty <= 0.0000001) { qty = 0; avg = 0; }
      }
    }
    return { qty, avg };
  };
  const next: Holding[] = [];
  const handled = new Set<string>();
  holdings.forEach((h) => {
    const k = `${h.type}:${h.symbol.toLowerCase()}`;
    if (!keys.has(k)) { next.push(h); return; }
    handled.add(k);
    const { qty, avg } = compute(grouped[k] || []);
    if (qty > 0.0000001) next.push({ ...h, quantity: qty, avgCost: avg });
  });
  for (const k of keys) {
    if (handled.has(k)) continue;
    const list = grouped[k] || [];
    if (!list.length) continue;
    const { qty, avg } = compute(list);
    if (qty <= 0.0000001) continue;
    const sample = list[0];
    next.push({
      id: uid(),
      symbol: sample.symbol.toUpperCase(),
      type: sample.type as AssetType,
      quantity: qty,
      avgCost: avg,
      priceId: sample.type === "crypto" ? sample.symbol.toLowerCase() : sample.symbol.toUpperCase(),
      createdAt: new Date().toISOString(),
    });
  }
  return next;
}

function normalizeSoldHolding(record: ClearedHolding): ClearedHolding {
  const soldQuantity = record.soldQuantity ?? record.totalQuantity ?? 0;
  return {
    ...record,
    soldQuantity,
    remainingQuantity: record.remainingQuantity ?? 0,
    fullySold: record.fullySold ?? true,
  };
}

function computeSoldHolding(trades: Trade[], symbol: string, type: AssetType, currentHoldings: Holding[], removedHolding?: Holding): ClearedHolding | null {
  const relevant = trades.filter((t) => t.symbol.toLowerCase() === symbol.toLowerCase() && t.type === type);
  if (relevant.length === 0) return null;

  const buyTrades = relevant.filter((t) => t.action === "buy");
  const sellTrades = relevant.filter((t) => t.action === "sell");
  if (sellTrades.length === 0) return null;

  const totalBuyQty = buyTrades.reduce((s, t) => s + t.quantity, 0);
  const totalBuyAmount = buyTrades.reduce((s, t) => s + t.quantity * t.price, 0);
  const totalSellQty = sellTrades.reduce((s, t) => s + t.quantity, 0);
  const totalSellAmount = sellTrades.reduce((s, t) => s + t.quantity * t.price, 0);
  const currentHolding = currentHoldings.find(
    (h) => h.symbol.toLowerCase() === symbol.toLowerCase() && h.type === type
  );
  const holding = currentHolding ?? removedHolding;
  const remainingQuantity = currentHolding?.quantity ?? 0;
  const fullySold = remainingQuantity <= 0.0000001;

  const totalRealizedPnl = sellTrades.reduce((s, t) => s + (t.realizedPnl ?? 0), 0);
  const avgBuyCost = totalBuyQty > 0 ? totalBuyAmount / totalBuyQty : (holding?.avgCost ?? 0);
  const avgSellPrice = totalSellQty > 0 ? totalSellAmount / totalSellQty : 0;
  const totalRealizedPnlPct = avgBuyCost > 0 ? ((avgSellPrice - avgBuyCost) / avgBuyCost) * 100 : 0;

  const sortedBuys = buyTrades.slice().sort((a, b) => a.date.localeCompare(b.date));
  const sortedSells = sellTrades.slice().sort((a, b) => b.date.localeCompare(a.date));
  const firstBuyDate = sortedBuys.length > 0 ? sortedBuys[0].date : (removedHolding?.createdAt ?? sortedSells[sortedSells.length - 1].date);
  const lastSellDate = sortedSells[0].date;

  const originalQuantity = totalBuyQty > 0 ? totalBuyQty : (remainingQuantity + totalSellQty || removedHolding?.quantity || totalSellQty);

  return {
    id: holding?.id ?? `${type}:${symbol.toLowerCase()}`,
    symbol: symbol.toUpperCase(),
    name: holding?.name,
    type: type,
    avgBuyCost,
    avgSellPrice,
    totalQuantity: originalQuantity,
    soldQuantity: totalSellQty,
    remainingQuantity,
    fullySold,
    totalRealizedPnl,
    totalRealizedPnlPct,
    firstBuyDate,
    lastSellDate,
    clearedAt: new Date().toISOString(),
  };
}

function recomputeClearedHoldings(trades: Trade[], currentHoldings: Holding[], removedHoldings: Holding[] = []): ClearedHolding[] {
  const grouped: Record<string, { symbol: string; type: AssetType }> = {};
  trades.forEach((t) => {
    if (t.type === "cash") return;
    const k = `${t.type}:${t.symbol.toLowerCase()}`;
    grouped[k] = { symbol: t.symbol, type: t.type as AssetType };
  });

  removedHoldings.forEach((h) => {
    const k = `${h.type}:${h.symbol.toLowerCase()}`;
    if (!grouped[k]) {
      grouped[k] = { symbol: h.symbol, type: h.type };
    }
  });

  const cleared: ClearedHolding[] = [];
  for (const [, { symbol, type }] of Object.entries(grouped)) {
    const removed = removedHoldings.find(
      (h) => h.symbol.toLowerCase() === symbol.toLowerCase() && h.type === type
    );
    const result = computeSoldHolding(trades, symbol, type, currentHoldings, removed);
    if (result) cleared.push(result);
  }
  return cleared;
}

function recalcSellPnl(trades: Trade[], holdings: Holding[], removedHoldings: Holding[]): Trade[] {
  const grouped: Record<string, { trade: Trade; idx: number }[]> = {};
  trades.forEach((t, i) => {
    if (t.type === "cash") return;
    const k = `${t.type}:${t.symbol.toLowerCase()}`;
    (grouped[k] ||= []).push({ trade: t, idx: i });
  });

  const result = trades.map((t) => ({ ...t }));
  for (const [, items] of Object.entries(grouped)) {
    const allTrades = items.map((it) => it.trade);
    const buyTrades = allTrades.filter((t) => t.action === "buy");
    const totalBuyQty = buyTrades.reduce((s, t) => s + t.quantity, 0);
    const totalBuyAmount = buyTrades.reduce((s, t) => s + t.quantity * t.price, 0);
    let avgBuyCost = totalBuyQty > 0 ? totalBuyAmount / totalBuyQty : 0;

    if (avgBuyCost <= 0) {
      const sample = allTrades[0];
      const h = holdings.find(
        (x) => x.symbol.toLowerCase() === sample.symbol.toLowerCase() && x.type === sample.type
      ) ?? removedHoldings.find(
        (x) => x.symbol.toLowerCase() === sample.symbol.toLowerCase() && x.type === sample.type
      );
      if (h && h.avgCost > 0) avgBuyCost = h.avgCost;
    }

    for (const { trade: t, idx } of items) {
      if (t.action === "sell") {
        const effectiveAvg = avgBuyCost > 0 ? avgBuyCost : t.price;
        const pnl = (t.price - effectiveAvg) * t.quantity;
        const pnlPct = effectiveAvg > 0 ? ((t.price - effectiveAvg) / effectiveAvg) * 100 : 0;
        result[idx] = { ...result[idx], realizedPnl: pnl, realizedPnlPct: pnlPct };
      }
    }
  }
  return result;
}

export const useStore = create<State>()(
  persist(
    (set) => ({
      holdings: [],
      trades: [],
      returns: [],
      clearedHoldings: [],
      removedHoldings: [],

      addHolding: (h) =>
        set((s) => {
          const createdAt = new Date().toISOString();
          const holding: Holding = { ...h, id: uid(), createdAt };
          const holdings = [...s.holdings, holding];
          const trades =
            h.type === "cash"
              ? s.trades
              : [
                  {
                    id: uid(),
                    date: todayKey(),
                    symbol: h.symbol.toUpperCase(),
                    type: h.type,
                    action: "buy" as const,
                    quantity: h.quantity,
                    price: h.avgCost,
                    note: h.note ? `添加持仓自动生成 · ${h.note}` : "添加持仓自动生成",
                    createdAt,
                  },
                  ...s.trades,
                ];
          const clearedHoldings = recomputeClearedHoldings(trades, holdings, s.removedHoldings);
          return { holdings, trades, clearedHoldings };
        }),
      updateHolding: (id, patch) =>
        set((s) => {
          const holdings = s.holdings.map((h) => (h.id === id ? { ...h, ...patch } : h));
          const clearedHoldings = recomputeClearedHoldings(s.trades, holdings, s.removedHoldings);
          return { holdings, clearedHoldings };
        }),
      deleteHolding: (id) =>
        set((s) => {
          const removed = s.holdings.find((h) => h.id === id);
          const newRemoved = removed ? [...s.removedHoldings, removed] : s.removedHoldings;
          const holdings = s.holdings.filter((h) => h.id !== id);
          const clearedHoldings = recomputeClearedHoldings(s.trades, holdings, newRemoved);
          return { holdings, clearedHoldings, removedHoldings: newRemoved };
        }),
      setManualPrice: (id, price) =>
        set((s) => ({
          holdings: s.holdings.map((h) => (h.id === id ? { ...h, manualPrice: price } : h)),
        })),

      addTrade: (t) =>
        set((s) => {
          const { holdings: newHoldings, tradeExtras } = applyTradeToHoldings(s.holdings, s.trades, t);
          if (isNaN(tradeExtras.realizedPnl ?? 0)) {
            return {};
          }
          const trade: Trade = { ...t, id: uid(), createdAt: new Date().toISOString(), ...tradeExtras };
          const newTrades = [trade, ...s.trades];

          const newRemovedHoldings = [...s.removedHoldings];
          if (t.action === "sell") {
            const oldHolding = s.holdings.find(
              (h) => h.symbol.toLowerCase() === t.symbol.toLowerCase() && h.type === t.type
            );
            if (oldHolding && !newHoldings.some(
              (h) => h.symbol.toLowerCase() === t.symbol.toLowerCase() && h.type === t.type
            )) {
              newRemovedHoldings.push(oldHolding);
            }
          }

          const clearedHoldings = recomputeClearedHoldings(newTrades, newHoldings, newRemovedHoldings);
          return { trades: newTrades, holdings: newHoldings, clearedHoldings, removedHoldings: newRemovedHoldings };
        }),
      updateTrade: (id, patch) =>
        set((s) => {
          const old = s.trades.find((t) => t.id === id);
          if (!old) return {};
          const next: Trade = { ...old, ...patch };
          const trades = recalcSellPnl(s.trades.map((t) => (t.id === id ? next : t)), s.holdings, s.removedHoldings);
          const keys: string[] = [];
          if (old.type !== "cash") keys.push(`${old.type}:${old.symbol.toLowerCase()}`);
          if (next.type !== "cash") keys.push(`${next.type}:${next.symbol.toLowerCase()}`);
          const holdings = rebuildHoldingsFromTrades(s.holdings, trades, keys);
          const clearedHoldings = recomputeClearedHoldings(trades, holdings, s.removedHoldings);
          return { trades, holdings, clearedHoldings };
        }),
      deleteTrade: (id) =>
        set((s) => {
          const old = s.trades.find((t) => t.id === id);
          const trades = s.trades.filter((t) => t.id !== id);
          if (!old || old.type === "cash") return { trades };
          const holdings = rebuildHoldingsFromTrades(s.holdings, trades, [`${old.type}:${old.symbol.toLowerCase()}`]);
          const clearedHoldings = recomputeClearedHoldings(trades, holdings, s.removedHoldings);
          return { trades, holdings, clearedHoldings };
        }),

      addReturn: (r) =>
        set((s) => ({
          returns: [...s.returns, { ...r, id: uid(), createdAt: new Date().toISOString() }],
        })),
      updateReturn: (id, patch) =>
        set((s) => ({
          returns: s.returns.map((r) => (r.id === id ? { ...r, ...patch } : r)),
        })),
      deleteReturn: (id) =>
        set((s) => ({ returns: s.returns.filter((r) => r.id !== id) })),

      deleteClearedHolding: (id) =>
        set((s) => ({ clearedHoldings: s.clearedHoldings.filter((c) => c.id !== id) })),

      importAll: (data) =>
        set(() => {
          const holdings = data.holdings ?? [];
          const trades = data.trades ?? [];
          return {
            holdings,
            trades,
            returns: data.returns ?? [],
            clearedHoldings: recomputeClearedHoldings(trades, holdings, []),
            removedHoldings: [],
          };
        }),
      applySnapshot: (data) =>
        set(() => {
          const holdings = data.holdings ?? [];
          const trades = data.trades ?? [];
          const removedHoldings = data.removedHoldings ?? [];
          return {
            holdings,
            trades,
            returns: data.returns ?? [],
            removedHoldings,
            clearedHoldings: recomputeClearedHoldings(trades, holdings, removedHoldings).map(
              normalizeSoldHolding,
            ),
          };
        }),
      reset: () => set({ holdings: [], trades: [], returns: [], clearedHoldings: [], removedHoldings: [] }),
    }),
    {
      name: "invest-tracker-v1",
      onRehydrateStorage: () => {
        return (state, error) => {
          if (error || !state) return;
          if (Array.isArray(state.holdings)) {
            state.holdings = state.holdings.filter((h) => h && typeof h === "object" && h.id && h.symbol);
          } else {
            state.holdings = [];
          }
          if (Array.isArray(state.trades)) {
            state.trades = state.trades.filter((t) => t && typeof t === "object" && t.id && t.symbol);
          } else {
            state.trades = [];
          }
          if (Array.isArray(state.returns)) {
            state.returns = state.returns.filter((r) => r && typeof r === "object" && r.id);
          } else {
            state.returns = [];
          }
          if (!Array.isArray(state.clearedHoldings)) {
            state.clearedHoldings = [];
          } else {
            state.clearedHoldings = state.clearedHoldings
              .filter((c) => c && typeof c === "object" && c.id && c.symbol)
              .map(normalizeSoldHolding);
          }
          if (!Array.isArray(state.removedHoldings)) {
            state.removedHoldings = [];
          }
          state.clearedHoldings = recomputeClearedHoldings(
            state.trades,
            state.holdings,
            state.removedHoldings,
          ).map(normalizeSoldHolding);
        };
      },
    },
  ),
);
