import { describe, expect, it } from "vitest";
import { computeCumulativePnl } from "@/lib/portfolio-pnl";

describe("computeCumulativePnl", () => {
  it("matches the holdings card when nothing has been sold", () => {
    const result = computeCumulativePnl({
      marketValue: 15966.42,
      holdingCost: 16850.34,
      trades: [],
    });

    expect(result.unrealized).toBeCloseTo(15966.42 - 16850.34, 8);
    expect(result.unrealizedPct).toBeCloseTo(((15966.42 - 16850.34) / 16850.34) * 100, 8);
    expect(result.realized).toBe(0);
    expect(result.soldCost).toBe(0);
    expect(result.total).toBeCloseTo(-883.92, 8);
    expect(result.totalPct).toBeCloseTo((-883.92 / 16850.34) * 100, 8);
  });

  it("adds realized P&L from partial and full sells without touching current cost", () => {
    const result = computeCumulativePnl({
      marketValue: 72,
      holdingCost: 60,
      trades: [
        { action: "buy", price: 10, quantity: 10 },
        { action: "sell", price: 15, quantity: 4, realizedPnl: 20 },
        { action: "sell", price: 8, quantity: 2, realizedPnl: -4 },
      ],
    });

    expect(result.unrealized).toBe(12);
    expect(result.realized).toBe(16);
    expect(result.total).toBe(28);
    expect(result.holdingCost).toBe(60);
    // Floating percent uses current holding cost only, not sold or invested cost.
    expect(result.unrealizedPct).toBeCloseTo((12 / 60) * 100, 8);
    // Sold cost is the cost removed by each sale: 4*10 + 2*10.
    expect(result.soldCost).toBeCloseTo(15 * 4 - 20 + 8 * 2 - -4, 8);
    expect(result.investedCost).toBeCloseTo(60 + 60, 8);
    expect(result.totalPct).toBeCloseTo((28 / 120) * 100, 8);
  });

  it("counts a cleared position that is no longer in current holdings", () => {
    const result = computeCumulativePnl({
      marketValue: 1000,
      holdingCost: 800,
      trades: [
        { action: "sell", price: 30, quantity: 5, realizedPnl: 50 },
      ],
    });

    expect(result.unrealized).toBe(200);
    expect(result.unrealizedPct).toBeCloseTo((200 / 800) * 100, 8);
    expect(result.realized).toBe(50);
    expect(result.total).toBe(250);
    expect(result.soldCost).toBe(100);
    expect(result.investedCost).toBe(900);
    expect(result.totalPct).toBeCloseTo((250 / 900) * 100, 8);
  });

  it("treats a sell with no realized P&L as zero and does not invent its cost", () => {
    const result = computeCumulativePnl({
      marketValue: 50,
      holdingCost: 40,
      trades: [
        { action: "sell", price: 12, quantity: 3 },
        { action: "sell", price: 10, quantity: 1, realizedPnl: Number.NaN },
      ],
    });

    expect(result.realized).toBe(0);
    expect(result.soldCost).toBe(0);
    expect(result.unrealized).toBe(10);
    expect(result.unrealizedPct).toBeCloseTo((10 / 40) * 100, 8);
    expect(result.total).toBe(10);
    expect(result.totalPct).toBeCloseTo((10 / 40) * 100, 8);
  });

  it("returns a zero percent when there is no invested cost", () => {
    const result = computeCumulativePnl({
      marketValue: 0,
      holdingCost: 0,
      trades: [],
    });

    expect(result.total).toBe(0);
    expect(result.totalPct).toBe(0);
    expect(result.unrealizedPct).toBeNull();
  });

  it("omits the floating percent when current holding cost is zero", () => {
    const result = computeCumulativePnl({
      marketValue: 25,
      holdingCost: 0,
      trades: [{ action: "sell", price: 5, quantity: 2, realizedPnl: 4 }],
    });

    expect(result.unrealized).toBe(25);
    expect(result.holdingCost).toBe(0);
    expect(result.soldCost).toBe(6);
    expect(result.unrealizedPct).toBeNull();
    expect(result.totalPct).toBeCloseTo((29 / 6) * 100, 8);
  });
});
