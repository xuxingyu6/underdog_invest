export type AssetType = "stock" | "crypto" | "gold" | "bond" | "cash" | "other";

export type Action = "buy" | "sell";

export type PeriodType = "day" | "week" | "month" | "year";

export type ScopeType = "stock" | "crypto" | "all";

export interface Holding {
  id: string;
  symbol: string;             // e.g. AAPL, BTC, "黄金现货"
  name?: string;
  type: AssetType;
  quantity: number;           // for cash, equals amount; manual price = 1
  avgCost: number;            // for cash = 1
  manualPrice?: number;       // optional override for non-stock/crypto
  // For crypto: coingecko id (e.g. "bitcoin"), for stocks: ticker
  priceId?: string;
  note?: string;
  createdAt: string;
}

export interface Trade {
  id: string;
  date: string;          // ISO date (yyyy-mm-dd)
  symbol: string;
  type: AssetType;
  action: Action;
  quantity: number;
  price: number;
  note?: string;
  createdAt: string;
  // Realized P&L fields (only for sell actions)
  realizedPnl?: number;
  realizedPnlPct?: number;
}

export interface ClearedHolding {
  id: string;
  symbol: string;
  name?: string;
  type: AssetType;
  avgBuyCost: number;
  avgSellPrice: number;
  totalQuantity: number;
  totalRealizedPnl: number;
  totalRealizedPnlPct: number;
  firstBuyDate: string;
  lastSellDate: string;
  clearedAt: string;
}

export interface ReturnEntry {
  id: string;
  date: string;          // for day: yyyy-mm-dd; for month: yyyy-mm; etc.
  period: PeriodType;
  scope: ScopeType;
  rate: number;          // percent, e.g. 1.25 means +1.25%
  note?: string;
  createdAt: string;
}

export interface PriceQuote {
  price: number;
  change24h: number;     // percent
  fetchedAt: number;     // timestamp ms
  stale?: boolean;
}

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  stock: "美股",
  crypto: "加密货币",
  gold: "黄金",
  bond: "债券",
  cash: "现金",
  other: "其他",
};

export const ASSET_TYPE_COLOR: Record<AssetType, string> = {
  stock: "hsl(var(--asset-stock))",
  crypto: "hsl(var(--asset-crypto))",
  gold: "hsl(var(--asset-gold))",
  bond: "hsl(var(--asset-bond))",
  cash: "hsl(var(--asset-cash))",
  other: "hsl(var(--asset-other))",
};
