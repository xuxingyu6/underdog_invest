import type { History } from "@/lib/priceHistory";
import { resolveCryptoId } from "@/lib/prices";
import type { AssetType, Holding, ScopeType, Trade } from "@/lib/types";

export interface DailyPoint {
  date: string;
  pnl: number;
  rate: number;
  marketValue: number;
  costBasis: number;
}

export interface MonthlyPoint {
  rate: number;
  pnl: number;
  days: number;
}

interface Position {
  key: string;
  qty: number;
  avgCost: number;
  type: AssetType;
  symbol: string;
  priceId?: string;
}

interface MonthFlow {
  buyAmount: number;
  sellAmount: number;
  netFlow: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function toUtcTime(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function fromUtcTime(time: number): string {
  const d = new Date(time);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date: string, days: number): string {
  return fromUtcTime(toUtcTime(date) + days * DAY_MS);
}

function dateRange(start: string, end: string): string[] {
  const out: string[] = [];
  for (let t = toUtcTime(start), stop = toUtcTime(end); t <= stop; t += DAY_MS) {
    out.push(fromUtcTime(t));
  }
  return out;
}

function maxDate(a: string, b: string): string {
  return a.localeCompare(b) >= 0 ? a : b;
}

function minDate(values: string[]): string | null {
  const valid = values.filter(isIsoDate).sort();
  return valid[0] ?? null;
}

function assetKey(type: AssetType, symbol: string): string {
  return `${type}:${symbol.toLowerCase()}`;
}

function priceKey(position: Pick<Position, "type" | "symbol" | "priceId">): string {
  const id = position.priceId || position.symbol;
  if (position.type === "crypto") return `crypto:${resolveCryptoId(id)}`;
  return `${position.type}:${id.toUpperCase()}`;
}

function inScope(type: AssetType, scope: ScopeType): boolean {
  if (type === "cash") return false;
  if (scope === "all") return true;
  return type === scope;
}

function buildHoldingMap(holdings: Holding[]): Record<string, Holding> {
  const out: Record<string, Holding> = {};
  holdings.forEach((h) => {
    if (!h || h.type === "cash") return;
    out[assetKey(h.type, h.symbol)] = h;
  });
  return out;
}

function buildTradedKeys(trades: Trade[]): Set<string> {
  const keys = new Set<string>();
  trades.forEach((t) => {
    if (!t || t.type === "cash") return;
    keys.add(assetKey(t.type as AssetType, t.symbol));
  });
  return keys;
}

function positionsAt(
  sortedTrades: Trade[],
  holdings: Holding[],
  holdingMap: Record<string, Holding>,
  tradedKeys: Set<string>,
  date: string,
): Position[] {
  const positions: Record<string, Position> = {};

  sortedTrades.forEach((t) => {
    if (!t || t.type === "cash" || t.date > date) return;
    const type = t.type as AssetType;
    const key = assetKey(type, t.symbol);
    const holding = holdingMap[key];
    const current = positions[key] ?? {
      key,
      qty: 0,
      avgCost: holding?.avgCost ?? 0,
      type,
      symbol: holding?.symbol ?? t.symbol,
      priceId: holding?.priceId,
    };

    if (t.action === "buy") {
      const totalQty = current.qty + t.quantity;
      current.avgCost =
        totalQty > 0
          ? (current.qty * current.avgCost + t.quantity * t.price) / totalQty
          : 0;
      current.qty = totalQty;
    } else {
      current.qty -= t.quantity;
      if (current.qty <= 0.0000001) {
        current.qty = 0;
        current.avgCost = 0;
      }
    }

    positions[key] = current;
  });

  holdings.forEach((h) => {
    if (!h || h.type === "cash" || h.quantity <= 0) return;
    const key = assetKey(h.type, h.symbol);
    if (tradedKeys.has(key) || positions[key]) return;
    positions[key] = {
      key,
      qty: h.quantity,
      avgCost: h.avgCost,
      type: h.type,
      symbol: h.symbol,
      priceId: h.priceId,
    };
  });

  return Object.values(positions).filter((p) => p.qty > 0.0000001);
}

function resolvePositionPrice(
  position: Position,
  carriedPrices: Record<string, number>,
  holding?: Holding,
): number {
  const snapshotPrice = carriedPrices[priceKey(position)];
  if (Number.isFinite(snapshotPrice) && snapshotPrice > 0) return snapshotPrice;
  if (holding?.manualPrice && Number.isFinite(holding.manualPrice) && holding.manualPrice > 0) {
    return holding.manualPrice;
  }
  return position.avgCost > 0 ? position.avgCost : 0;
}

function selectDateBounds(history: History, trades: Trade[], holdings: Holding[], today: string) {
  const historyDates = Object.keys(history).filter(isIsoDate).sort();
  const tradeDates = trades
    .filter((t) => t && t.type !== "cash" && isIsoDate(t.date))
    .map((t) => t.date);
  const hasInvestableHolding = holdings.some((h) => h && h.type !== "cash" && h.quantity > 0);
  const start = minDate([...historyDates, ...tradeDates, ...(hasInvestableHolding ? [today] : [])]);
  if (!start) return null;
  const latestHistoryDate = historyDates[historyDates.length - 1] ?? today;
  return { start, end: maxDate(today, latestHistoryDate) };
}

function getMonthFlow(
  trades: Trade[],
  scope: ScopeType,
  month: string,
  endDate: string,
  includeFromDate: string,
  includeStartDate: boolean,
): MonthFlow {
  return trades.reduce(
    (acc, t) => {
      if (!t || t.type === "cash" || !inScope(t.type as AssetType, scope)) return acc;
      if (!t.date.startsWith(month) || t.date > endDate) return acc;
      if (includeStartDate ? t.date < includeFromDate : t.date <= includeFromDate) return acc;
      const amount = t.quantity * t.price;
      if (t.action === "buy") acc.buyAmount += amount;
      else acc.sellAmount += amount;
      acc.netFlow = acc.buyAmount - acc.sellAmount;
      return acc;
    },
    { buyAmount: 0, sellAmount: 0, netFlow: 0 },
  );
}

function buildMonthMap(dailyMap: Record<string, DailyPoint>, trades: Trade[], scope: ScopeType) {
  const days = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));
  const byMonth: Record<string, DailyPoint[]> = {};
  days.forEach((d) => {
    const key = d.date.slice(0, 7);
    (byMonth[key] ||= []).push(d);
  });

  const monthMap: Record<string, MonthlyPoint> = {};
  Object.entries(byMonth).forEach(([month, points]) => {
    const first = points[0];
    const last = points[points.length - 1];
    const firstIndex = days.findIndex((d) => d.date === first.date);
    const previous = firstIndex > 0 ? days[firstIndex - 1] : undefined;
    const baseline = previous?.marketValue ?? first.marketValue;
    const flows = getMonthFlow(
      trades,
      scope,
      month,
      last.date,
      previous ? `${month}-01` : first.date,
      !!previous,
    );
    const pnl = last.marketValue - baseline - flows.netFlow;
    const denominator = baseline + flows.buyAmount;
    const fallbackDenominator = first.costBasis || first.marketValue;
    const rateBase = denominator > 0 ? denominator : fallbackDenominator;

    monthMap[month] = {
      pnl,
      rate: rateBase > 0 ? (pnl / rateBase) * 100 : 0,
      days: points.length,
    };
  });

  return monthMap;
}

export function buildComputedReturns({
  trades,
  holdings,
  history,
  scope,
  today,
}: {
  trades: Trade[];
  holdings: Holding[];
  history: History;
  scope: ScopeType;
  today: string;
}) {
  const bounds = selectDateBounds(history, trades, holdings, today);
  if (!bounds) return { dailyMap: {}, monthMap: {} };

  const holdingMap = buildHoldingMap(holdings);
  const tradedKeys = buildTradedKeys(trades);
  const sortedTrades = trades
    .filter((t) => t && t.type !== "cash")
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
  const carriedPrices: Record<string, number> = {};
  const dailyMap: Record<string, DailyPoint> = {};

  dateRange(bounds.start, bounds.end).forEach((date) => {
    Object.entries(history[date] ?? {}).forEach(([key, price]) => {
      if (Number.isFinite(price) && price > 0) carriedPrices[key] = price;
    });

    const positions = positionsAt(sortedTrades, holdings, holdingMap, tradedKeys, date).filter((p) =>
      inScope(p.type, scope),
    );
    if (!positions.length) return;

    let pnl = 0;
    let costBasis = 0;
    let marketValue = 0;

    positions.forEach((position) => {
      const holding = holdingMap[position.key];
      const price = resolvePositionPrice(position, carriedPrices, holding);
      if (price <= 0 || position.avgCost <= 0) return;

      const value = price * position.qty;
      const cost = position.avgCost * position.qty;
      marketValue += value;
      costBasis += cost;
      pnl += value - cost;
    });

    if (marketValue > 0 && costBasis > 0) {
      dailyMap[date] = {
        date,
        pnl,
        rate: (pnl / costBasis) * 100,
        marketValue,
        costBasis,
      };
    }
  });

  return {
    dailyMap,
    monthMap: buildMonthMap(dailyMap, sortedTrades, scope),
  };
}
