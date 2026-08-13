import { describe, expect, it } from "vitest";
import type { PricedHolding } from "@/hooks/use-priced-holdings";
import { buildPositionAnalysis, collapseRows } from "./position-analysis";

function holding(
  id: string,
  symbol: string,
  type: PricedHolding["type"],
  marketValue: number,
): PricedHolding {
  return {
    id,
    symbol,
    name: undefined,
    type,
    quantity: 1,
    avgCost: 1,
    currentPrice: marketValue,
    priceChange24h: 0,
    priceStale: false,
    marketValue,
    pnl: 0,
    pnlPct: 0,
  };
}

const cash = (value: number) => holding("cash-1", "CASH", "cash", value);

describe("buildPositionAnalysis", () => {
  it("美股模块：个股仓位 + 现金仓位 = 100%", () => {
    const priced = [
      holding("1", "RKLB", "stock", 1500),
      holding("2", "SPCX", "stock", 1000),
      holding("3", "CRCL", "stock", 500),
      cash(1000),
    ];
    const result = buildPositionAnalysis(priced, "stock");

    expect(result.totalFunds).toBe(4000);
    expect(result.assetPct).toBeCloseTo(75, 6);
    expect(result.cashPct).toBeCloseTo(25, 6);
    expect(result.assets.map((a) => a.label)).toEqual(["RKLB", "SPCX", "CRCL"]);
    expect(result.assets[0].pct).toBeCloseTo(37.5, 6);
    expect(result.assets[1].pct).toBeCloseTo(25, 6);
    expect(result.assets[2].pct).toBeCloseTo(12.5, 6);
    const sum =
      result.assets.reduce((s, a) => s + a.pct, 0) + result.cashPct;
    expect(sum).toBeCloseTo(100, 6);
  });

  it("加密模块：币种仓位 + 现金仓位 = 100%", () => {
    const priced = [
      holding("1", "BTC", "crypto", 2000),
      holding("2", "ADA", "crypto", 1000),
      cash(1000),
    ];
    const result = buildPositionAnalysis(priced, "crypto");

    expect(result.totalFunds).toBe(4000);
    expect(result.assetPct).toBeCloseTo(75, 6);
    expect(result.cashPct).toBeCloseTo(25, 6);
    expect(result.assets[0].pct).toBeCloseTo(50, 6);
    expect(result.assets[1].pct).toBeCloseTo(25, 6);
  });

  it("两个模块共享同一笔现金，且各自口径可以不同", () => {
    const priced = [
      holding("1", "RKLB", "stock", 4000),
      holding("2", "BTC", "crypto", 3000),
      cash(2000),
    ];
    const stock = buildPositionAnalysis(priced, "stock");
    const crypto = buildPositionAnalysis(priced, "crypto");

    expect(stock.totalFunds).toBe(6000);
    expect(crypto.totalFunds).toBe(5000);
    expect(stock.cashValue).toBe(2000);
    expect(crypto.cashValue).toBe(2000);
  });

  it("按当前市值从高到低排序，不使用成本", () => {
    const priced = [
      holding("1", "SMALL", "stock", 100),
      holding("2", "BIG", "stock", 900),
      holding("3", "MID", "stock", 500),
      cash(0),
    ];
    const result = buildPositionAnalysis(priced, "stock");
    expect(result.assets.map((a) => a.label)).toEqual(["BIG", "MID", "SMALL"]);
  });

  it("空数据时不会出现 NaN / Infinity", () => {
    const result = buildPositionAnalysis([], "stock");
    expect(result.totalFunds).toBe(0);
    expect(result.assetPct).toBe(0);
    expect(result.cashPct).toBe(0);
    expect(result.assets).toEqual([]);
    expect(Number.isFinite(result.assetPct)).toBe(true);
    expect(Number.isFinite(result.cashPct)).toBe(true);
  });

  it("只有现金时，现金仓位为 100%", () => {
    const result = buildPositionAnalysis([cash(2000)], "stock");
    expect(result.totalFunds).toBe(2000);
    expect(result.assetPct).toBe(0);
    expect(result.cashPct).toBe(100);
    expect(result.assets).toEqual([]);
  });

  it("marketValue 非法时按 0 处理，不产生 NaN", () => {
    const bad = { ...holding("1", "BAD", "stock", 500), marketValue: Number.NaN };
    const result = buildPositionAnalysis([bad, cash(500)], "stock");
    expect(result.totalFunds).toBe(500);
    expect(result.assetPct).toBe(0);
    expect(result.cashPct).toBe(100);
    expect(Number.isFinite(result.assets[0].pct)).toBe(true);
  });
});

describe("collapseRows", () => {
  it("数量不超过上限时全部显示，不出现「其他」", () => {
    const rows = Array.from({ length: 5 }, (_, i) => ({
      key: String(i),
      label: `A${i}`,
      marketValue: i + 1,
      pct: 10,
    }));
    const result = collapseRows(rows, 5, false);
    expect(result.hasMore).toBe(false);
    expect(result.rows).toHaveLength(5);
    expect(result.rows.some((r) => r.label === "其他")).toBe(false);
  });

  it("超过上限时前 5 条保留，其余合并为「其他」", () => {
    const rows = Array.from({ length: 7 }, (_, i) => ({
      key: String(i),
      label: `A${i}`,
      marketValue: 10 - i,
      pct: (10 - i) * 2,
    }));
    const result = collapseRows(rows, 5, false);
    expect(result.hasMore).toBe(true);
    expect(result.hiddenCount).toBe(2);
    expect(result.rows).toHaveLength(6);
    expect(result.rows[5]).toMatchObject({ label: "其他", marketValue: 9, pct: 18 });
  });

  it("展开后返回全部资产", () => {
    const rows = Array.from({ length: 7 }, (_, i) => ({
      key: String(i),
      label: `A${i}`,
      marketValue: i,
      pct: i,
    }));
    const result = collapseRows(rows, 5, true);
    expect(result.hasMore).toBe(false);
    expect(result.rows).toHaveLength(7);
  });
});
