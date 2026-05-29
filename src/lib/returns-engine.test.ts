import { describe, expect, it } from "vitest";
import { buildComputedReturns } from "@/lib/returns-engine";
import type { Holding, Trade } from "@/lib/types";

const baseHolding = {
  id: "h1",
  symbol: "AAPL",
  type: "stock",
  quantity: 1,
  avgCost: 100,
  createdAt: "2026-05-01T00:00:00.000Z",
} satisfies Holding;

describe("buildComputedReturns", () => {
  it("fills missing calendar days from the latest local price snapshot", () => {
    const { dailyMap } = buildComputedReturns({
      trades: [],
      holdings: [baseHolding],
      history: {
        "2026-05-19": { "stock:AAPL": 110 },
        "2026-05-21": { "stock:AAPL": 121 },
      },
      scope: "stock",
      today: "2026-05-21",
    });

    expect(dailyMap["2026-05-20"]).toMatchObject({
      date: "2026-05-20",
      pnl: 10,
      rate: 10,
      marketValue: 110,
    });
  });

  it("uses the start and end market value for monthly returns instead of compounding cumulative daily rates", () => {
    const { monthMap } = buildComputedReturns({
      trades: [],
      holdings: [baseHolding],
      history: {
        "2026-05-01": { "stock:AAPL": 110 },
        "2026-05-02": { "stock:AAPL": 110 },
        "2026-05-03": { "stock:AAPL": 121 },
      },
      scope: "stock",
      today: "2026-05-03",
    });

    expect(monthMap["2026-05"].rate).toBeCloseTo(10, 6);
    expect(monthMap["2026-05"].pnl).toBeCloseTo(11, 6);
  });

  it("separates stock and crypto monthly performance by scope", () => {
    const cryptoHolding = {
      id: "h2",
      symbol: "BTC",
      type: "crypto",
      quantity: 1,
      avgCost: 200,
      createdAt: "2026-05-01T00:00:00.000Z",
    } satisfies Holding;

    const result = buildComputedReturns({
      trades: [],
      holdings: [baseHolding, cryptoHolding],
      history: {
        "2026-05-01": { "stock:AAPL": 100, "crypto:bitcoin": 200 },
        "2026-05-31": { "stock:AAPL": 110, "crypto:bitcoin": 300 },
      },
      scope: "crypto",
      today: "2026-05-31",
    });

    expect(result.monthMap["2026-05"].rate).toBeCloseTo(50, 6);
    expect(result.dailyMap["2026-05-15"].marketValue).toBe(200);
  });

  it("removes buy and sell cash flows from monthly performance", () => {
    const trades: Trade[] = [
      {
        id: "t1",
        date: "2026-05-01",
        symbol: "AAPL",
        type: "stock",
        action: "buy",
        quantity: 1,
        price: 100,
        createdAt: "2026-05-01T00:00:00.000Z",
      },
      {
        id: "t2",
        date: "2026-05-15",
        symbol: "AAPL",
        type: "stock",
        action: "buy",
        quantity: 1,
        price: 100,
        createdAt: "2026-05-15T00:00:00.000Z",
      },
    ];

    const { monthMap } = buildComputedReturns({
      trades,
      holdings: [{ ...baseHolding, quantity: 2 }],
      history: {
        "2026-05-01": { "stock:AAPL": 100 },
        "2026-05-31": { "stock:AAPL": 110 },
      },
      scope: "stock",
      today: "2026-05-31",
    });

    expect(monthMap["2026-05"].pnl).toBeCloseTo(20, 6);
    expect(monthMap["2026-05"].rate).toBeCloseTo(10, 6);
  });
});
