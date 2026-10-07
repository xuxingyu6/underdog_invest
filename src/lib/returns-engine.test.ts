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

function trade(partial: Pick<Trade, "id" | "date" | "symbol" | "type" | "action" | "quantity" | "price">): Trade {
  return { ...partial, createdAt: `${partial.date}T00:00:00.000Z` };
}

function holding(partial: Pick<Holding, "id" | "symbol" | "type" | "quantity" | "avgCost"> & Partial<Holding>): Holding {
  return { createdAt: "2026-08-01T00:00:00.000Z", ...partial };
}

describe("calendar day detail", () => {
  const history = {
    "2026-08-31": { "stock:SPCX": 120, "crypto:bitcoin": 40 },
    "2026-09-01": { "stock:SPCX": 110, "crypto:bitcoin": 55 },
    "2026-10-07": { "stock:SPCX": 200, "crypto:bitcoin": 999, "stock:VST": 300 },
  };

  const trades: Trade[] = [
    trade({ id: "spcx-1", date: "2026-08-01", symbol: "SPCX", type: "stock", action: "buy", quantity: 3, price: 100 }),
    trade({ id: "spcx-2", date: "2026-09-01", symbol: "SPCX", type: "stock", action: "buy", quantity: 7, price: 140 }),
    trade({ id: "btc-1", date: "2026-08-01", symbol: "BTC", type: "crypto", action: "buy", quantity: 2, price: 50 }),
    trade({ id: "vst-1", date: "2026-09-15", symbol: "VST", type: "stock", action: "buy", quantity: 6, price: 80 }),
  ];

  const holdings: Holding[] = [
    holding({ id: "h-spcx", symbol: "SPCX", type: "stock", quantity: 10, avgCost: 200, name: "SPCX" }),
    holding({ id: "h-btc", symbol: "BTC", type: "crypto", quantity: 2, avgCost: 50, priceId: "bitcoin" }),
    holding({ id: "h-vst", symbol: "VST", type: "stock", quantity: 6, avgCost: 80 }),
    holding({ id: "h-night", symbol: "NIGHT", type: "crypto", quantity: 100, avgCost: 1, name: "Night" }),
    holding({ id: "h-gold", symbol: "黄金", type: "other", quantity: 1, avgCost: 40, manualPrice: 90 }),
  ];

  function day(date: string, scope: "all" | "stock" | "crypto" = "all") {
    return buildComputedReturns({
      trades,
      holdings,
      history,
      scope,
      today: "2026-10-07",
    }).dailyMap[date];
  }

  it("breaks a day into historical per-symbol P&L that sums to the calendar total", () => {
    const detail = day("2026-09-01");
    const spcx = detail.positions.find((p) => p.symbol === "SPCX");
    const btc = detail.positions.find((p) => p.symbol === "BTC");

    // Held that day: 3 @ 100 plus 7 @ 140. Later Oct 7 prices are not used.
    expect(spcx).toMatchObject({
      available: true,
      quantity: 10,
      avgCost: 128,
      price: 110,
      pnl: (110 - 128) * 10,
      marketValue: 1100,
      name: "SPCX",
    });
    expect(btc).toMatchObject({
      available: true,
      quantity: 2,
      price: 55,
      pnl: (55 - 50) * 2,
      marketValue: 110,
    });

    const available = detail.positions.filter((p) => p.available);
    expect(available.reduce((sum, p) => sum + (p.pnl ?? 0), 0)).toBeCloseTo(detail.pnl, 8);
    expect(available.reduce((sum, p) => sum + (p.marketValue ?? 0), 0)).toBeCloseTo(detail.marketValue, 8);
    expect(detail.pnl).toBeCloseTo((110 - 128) * 10 + (55 - 50) * 2, 8);
    expect(detail.marketValue).toBeCloseTo(1210, 8);
    expect(detail.rate).toBeCloseTo((detail.pnl / detail.costBasis) * 100, 8);
  });

  it("uses quantity and cost from trades on that date, not the current holding", () => {
    const detail = day("2026-08-31");
    const spcx = detail.positions.find((p) => p.symbol === "SPCX");
    expect(spcx).toMatchObject({
      available: true,
      quantity: 3,
      avgCost: 100,
      price: 120,
      pnl: 60,
      marketValue: 360,
    });
    expect(detail.positions.some((p) => p.symbol === "VST")).toBe(false);
  });

  it("carries the previous snapshot forward and ignores a price that did not exist yet", () => {
    const detail = buildComputedReturns({
      trades,
      holdings,
      history: {
        "2026-08-31": { "stock:SPCX": 120, "crypto:bitcoin": 40 },
        "2026-10-07": { "stock:SPCX": 200, "crypto:bitcoin": 999 },
      },
      scope: "all",
      today: "2026-10-07",
    }).dailyMap["2026-09-01"];

    expect(detail.positions.find((p) => p.symbol === "SPCX")).toMatchObject({ price: 120, quantity: 10 });
    expect(detail.positions.find((p) => p.symbol === "BTC")?.price).toBe(40);
  });

  it("marks symbols without a historical price as unavailable and leaves them out of the day total", () => {
    const detail = day("2026-09-01");
    const night = detail.positions.find((p) => p.symbol === "NIGHT");
    const gold = detail.positions.find((p) => p.symbol === "黄金");

    expect(night).toMatchObject({ available: false, price: null, pnl: null, marketValue: null, quantity: 100 });
    expect(gold).toMatchObject({ available: false, price: null, pnl: null });
    expect(detail.marketValue).toBeCloseTo(1210, 8);
    expect(detail.pnl).toBeCloseTo((110 - 128) * 10 + 10, 8);
  });

  it("keeps the day detail inside the selected asset scope", () => {
    const detail = day("2026-09-01", "stock");
    expect(detail.positions.map((p) => p.symbol)).toEqual(["SPCX"]);
    expect(detail.pnl).toBeCloseTo((110 - 128) * 10, 8);
    expect(detail.marketValue).toBeCloseTo(1100, 8);
  });
});
