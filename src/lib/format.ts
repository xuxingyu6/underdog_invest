// Number / currency / percent formatting
export function formatMoney(value: number, decimals = 2): string {
  if (!isFinite(value)) return "—";
  const abs = Math.abs(value).toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `${value < 0 ? "-" : ""}$${abs}`;
}

export function formatNumber(value: number, decimals = 2): string {
  if (!isFinite(value)) return "—";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatPercent(value: number, decimals = 2): string {
  if (!isFinite(value)) return "—";
  const sign = value > 0 ? "+" : value < 0 ? "" : "";
  return `${sign}${value.toFixed(decimals)}%`;
}

export function formatSignedMoney(value: number, decimals = 2): string {
  if (!isFinite(value)) return "—";
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  const abs = Math.abs(value).toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `${sign}$${abs}`;
}

// Truncate (not round) to given decimals
export function truncate(value: number, decimals: number): number {
  const f = Math.pow(10, decimals);
  return Math.trunc(value * f) / f;
}

// Format crypto price: 4 decimals truncated
export function formatCryptoPrice(value: number): string {
  if (!isFinite(value)) return "—";
  const t = truncate(value, 4);
  return `$${t.toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`;
}

export function formatStockPrice(value: number): string {
  return formatMoney(value, 2);
}

// Holding quantity: integer if >=1, 4 decimals if <1
export function formatQuantity(value: number, _type?: string): string {
  if (!isFinite(value)) return "—";
  if (Math.abs(value) >= 1) {
    return Math.trunc(value).toLocaleString("en-US");
  }
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  });
}

// Avg cost formatter:
// - stock: 2 decimals
// - crypto: if >=1 → 2 decimals, if <1 → 4 decimals truncated
export function formatAvgCost(value: number, type: "stock" | "crypto" | string): string {
  if (!isFinite(value)) return "—";
  if (type === "crypto") {
    if (Math.abs(value) >= 1) return formatMoney(value, 2);
    const t = truncate(value, 4);
    return `$${t.toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`;
  }
  return formatMoney(value, 2);
}

// Color class helpers for P&L
export function plClass(value: number): string {
  if (value > 0) return "text-profit";
  if (value < 0) return "text-loss";
  return "text-muted-foreground";
}

// Heat color for daily/monthly returns (CSS var token) — 6 levels
export function heatColor(rate: number | null | undefined): string {
  if (rate === null || rate === undefined || !isFinite(rate)) return "hsl(var(--heat-empty))";
  if (rate > 5) return "hsl(var(--heat-up-strong))";
  if (rate > 1) return "hsl(var(--heat-up-mid))";
  if (rate > 0) return "hsl(var(--heat-up-mild))";
  if (rate > -1) return "hsl(var(--heat-down-mild))";
  if (rate > -5) return "hsl(var(--heat-down-mid))";
  return "hsl(var(--heat-down-strong))";
}

// Text color for calendar cells based on rate
export function heatTextColor(rate: number | null | undefined): string {
  if (rate === null || rate === undefined || !isFinite(rate)) return "text-muted-foreground";
  if (rate > 5) return "text-white";
  if (rate > 1) return "text-white";
  if (rate > 0) return "text-green-700 dark:text-green-400";
  if (rate > -1) return "text-red-700 dark:text-red-400";
  if (rate > -5) return "text-white";
  return "text-white";
}

export function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
