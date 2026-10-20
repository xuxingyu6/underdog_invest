/**
 * Stock-only sector weights.
 * Weight = sector market value / total stock market value × 100.
 * Crypto, cash, and other asset types are excluded. Each holding has one sector.
 */

export const UNCATEGORIZED_SECTOR = "未分类";

/** Chart / asset tokens, in legend order. Distinct across light and dark. */
export const SECTOR_PALETTE = [
  "hsl(var(--chart-3))",
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-5))",
  "hsl(var(--chart-4))",
  "hsl(var(--asset-gold))",
  "hsl(var(--asset-cash))",
  "hsl(var(--asset-bond))",
] as const;

export function sectorColor(index: number): string {
  const safe = Number.isFinite(index) ? Math.abs(Math.trunc(index)) : 0;
  return SECTOR_PALETTE[safe % SECTOR_PALETTE.length];
}

export function normalizeSector(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function sectorName(value: unknown): string {
  return normalizeSector(value) ?? UNCATEGORIZED_SECTOR;
}

export interface SectorHoldingInput {
  type?: string | null;
  sector?: string | null;
  marketValue?: number | null;
}

export interface SectorSlice {
  name: string;
  marketValue: number;
  /** Raw weight, 0–100, before display rounding. */
  pct: number;
}

export interface SectorAllocation {
  slices: SectorSlice[];
  totalMarketValue: number;
}

function safeNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function aggregateStockSectors(
  priced: SectorHoldingInput[] | null | undefined,
): SectorAllocation {
  const stocks = (priced ?? []).filter((row) => {
    if (!row || row.type !== "stock") return false;
    return safeNumber(row.marketValue) > 0;
  });
  const totalMarketValue = stocks.reduce((sum, row) => sum + safeNumber(row.marketValue), 0);
  if (!(totalMarketValue > 0)) {
    return { slices: [], totalMarketValue: 0 };
  }

  const totals = new Map<string, number>();
  for (const row of stocks) {
    const name = sectorName(row.sector);
    totals.set(name, (totals.get(name) ?? 0) + safeNumber(row.marketValue));
  }

  const slices = [...totals.entries()]
    .map(([name, marketValue]) => ({
      name,
      marketValue,
      pct: (marketValue / totalMarketValue) * 100,
    }))
    .sort((a, b) => b.pct - a.pct || a.name.localeCompare(b.name, "zh"));

  return { slices, totalMarketValue };
}

/** One decimal place, matching the in-bar and legend labels. */
export function displayedSectorTenths(pct: number): number {
  if (!Number.isFinite(pct)) return 0;
  return Math.round(pct * 10 + 1e-9);
}

export function formatSectorPct(pct: number): string {
  return `${(displayedSectorTenths(pct) / 10).toFixed(1)}%`;
}

/** Sum of the one-decimal labels. Whole numbers render as 100%, otherwise 99.9%. */
export function formatShownSectorSum(pcts: number[]): string {
  const tenths = pcts.reduce((sum, pct) => sum + displayedSectorTenths(pct), 0);
  if (tenths % 10 === 0) return `${tenths / 10}%`;
  return `${(tenths / 10).toFixed(1)}%`;
}

export function sectorSliceLabel(name: string, pct: number): string {
  return `${name} ${formatSectorPct(pct)}`;
}
