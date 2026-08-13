import type { PricedHolding } from "@/hooks/use-priced-holdings";

export interface PositionRow {
  key: string;
  label: string;
  sublabel?: string;
  marketValue: number;
  pct: number;
}

export interface PositionAnalysis {
  totalFunds: number;
  assetValue: number;
  cashValue: number;
  assetPct: number;
  cashPct: number;
  assets: PositionRow[];
}

function safeNumber(value: unknown): number {
  return typeof value === "number" && isFinite(value) ? value : 0;
}

/**
 * 内部仓位分析（美股 / 加密货币各一个口径）。
 *
 * 分析总资金 = 该类型全部持仓当前市值 + 统一现金池
 * 单个资产仓位 = 当前市值 / 分析总资金 × 100%
 * 现金仓位 = 现金 / 分析总资金 × 100%
 *
 * 两个口径共享同一笔现金，这是设计上的有意行为；
 * 分析总资金只用于模块内部，不影响网站既有总资产逻辑。
 */
export function buildPositionAnalysis(
  priced: PricedHolding[],
  type: "stock" | "crypto",
): PositionAnalysis {
  const safe = (priced ?? []).filter(
    (p): p is PricedHolding => !!p && typeof p === "object",
  );
  const assets = safe.filter((p) => p.type === type);
  const cashValue = safe
    .filter((p) => p.type === "cash")
    .reduce((s, p) => s + safeNumber(p.marketValue), 0);
  const assetValue = assets.reduce((s, p) => s + safeNumber(p.marketValue), 0);
  const totalFunds = assetValue + cashValue;
  const pct = (value: number) => (totalFunds > 0 ? (value / totalFunds) * 100 : 0);

  const assetsRows: PositionRow[] = assets.map((p) => ({
    key: p.id,
    label: p.symbol,
    sublabel: p.name,
    marketValue: safeNumber(p.marketValue),
    pct: pct(safeNumber(p.marketValue)),
  }));
  assetsRows.sort((a, b) => b.marketValue - a.marketValue);

  return {
    totalFunds,
    assetValue,
    cashValue,
    assetPct: pct(assetValue),
    cashPct: pct(cashValue),
    assets: assetsRows,
  };
}

export interface CollapsedRows {
  rows: PositionRow[];
  hasMore: boolean;
  hiddenCount: number;
}

/**
 * 超出 max 条时只保留前 max 条，其余合并为「其他」。
 * 展开（expanded=true）时返回全部资产。
 */
export function collapseRows(
  rows: PositionRow[],
  max = 5,
  expanded = false,
): CollapsedRows {
  const sorted = [...rows];
  if (expanded || sorted.length <= max) {
    return { rows: sorted, hasMore: false, hiddenCount: 0 };
  }
  const top = sorted.slice(0, max);
  const rest = sorted.slice(max);
  const otherValue = rest.reduce((s, r) => s + safeNumber(r.marketValue), 0);
  const otherPct = rest.reduce((s, r) => s + safeNumber(r.pct), 0);
  return {
    rows: [...top, { key: "other", label: "其他", marketValue: otherValue, pct: otherPct }],
    hasMore: true,
    hiddenCount: rest.length,
  };
}
