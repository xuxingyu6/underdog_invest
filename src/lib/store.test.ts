import { beforeEach, describe, expect, it } from "vitest";
import { applyLocalSnapshot, readLocalSnapshot } from "@/lib/cloud-sync";
import { createPortfolioBackup, parsePortfolioBackup } from "@/lib/portfolio-snapshot";
import { useStore } from "@/lib/store";

function resetStore() {
  localStorage.clear();
  useStore.setState({
    holdings: [],
    trades: [],
    returns: [],
    clearedHoldings: [],
    removedHoldings: [],
  });
}

describe("sold holdings summary", () => {
  beforeEach(resetStore);

  it("adds a buy trade when creating a non-cash holding", () => {
    useStore.getState().addHolding({
      symbol: "NVDA",
      type: "stock",
      quantity: 5,
      avgCost: 100,
      priceId: "NVDA",
      note: "starter position",
    });

    const [trade] = useStore.getState().trades;
    expect(trade).toMatchObject({
      symbol: "NVDA",
      type: "stock",
      action: "buy",
      quantity: 5,
      price: 100,
      note: "添加持仓自动生成 · starter position",
    });
    expect(trade.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("does not add a trade when creating a cash holding", () => {
    useStore.getState().addHolding({
      symbol: "现金",
      name: "现金",
      type: "cash",
      quantity: 1000,
      avgCost: 1,
      manualPrice: 1,
    });

    expect(useStore.getState().trades).toHaveLength(0);
  });

  it("does not duplicate buy trades when editing a holding", () => {
    useStore.getState().addHolding({
      symbol: "MSFT",
      type: "stock",
      quantity: 2,
      avgCost: 300,
      priceId: "MSFT",
    });
    const holdingId = useStore.getState().holdings[0].id;

    useStore.getState().updateHolding(holdingId, { name: "Microsoft" });

    expect(useStore.getState().trades).toHaveLength(1);
    expect(useStore.getState().trades[0].action).toBe("buy");
  });

  it("records partial sells as sold records with the sold quantity", () => {
    const store = useStore.getState();
    store.addHolding({
      symbol: "AAPL",
      type: "stock",
      quantity: 10,
      avgCost: 100,
      priceId: "AAPL",
    });

    useStore.getState().addTrade({
      date: "2026-06-01",
      symbol: "AAPL",
      type: "stock",
      action: "sell",
      quantity: 4,
      price: 120,
    });

    const [sold] = useStore.getState().clearedHoldings;
    expect(sold.soldQuantity).toBe(4);
    expect(sold.remainingQuantity).toBe(6);
    expect(sold.fullySold).toBe(false);
    expect(sold.avgBuyCost).toBe(100);
  });

  it("marks a sold record as fully sold when the remaining position is zero", () => {
    useStore.getState().addHolding({
      symbol: "TSLA",
      type: "stock",
      quantity: 3,
      avgCost: 200,
      priceId: "TSLA",
    });

    useStore.getState().addTrade({
      date: "2026-06-02",
      symbol: "TSLA",
      type: "stock",
      action: "sell",
      quantity: 3,
      price: 250,
    });

    const [sold] = useStore.getState().clearedHoldings;
    expect(sold.soldQuantity).toBe(3);
    expect(sold.remainingQuantity).toBe(0);
    expect(sold.fullySold).toBe(true);
  });

  it("export then import keeps trades and cleared holdings", () => {
    useStore.getState().addHolding({
      symbol: "AAPL",
      type: "stock",
      quantity: 10,
      avgCost: 100,
      priceId: "AAPL",
    });
    useStore.getState().addTrade({
      date: "2026-06-01",
      symbol: "AAPL",
      type: "stock",
      action: "sell",
      quantity: 10,
      price: 130,
    });

    const before = useStore.getState();
    expect(before.trades.length).toBeGreaterThanOrEqual(2);
    expect(before.clearedHoldings).toHaveLength(1);
    expect(before.holdings.filter((h) => h.symbol === "AAPL")).toHaveLength(0);

    const json = JSON.stringify(createPortfolioBackup(readLocalSnapshot()));
    const payload = JSON.parse(json);
    expect(payload.trades.length).toBe(before.trades.length);
    expect(payload.clearedHoldings.length).toBe(1);
    expect(payload.removedHoldings.length).toBeGreaterThan(0);

    resetStore();
    expect(useStore.getState().trades).toHaveLength(0);
    expect(useStore.getState().clearedHoldings).toHaveLength(0);

    applyLocalSnapshot(parsePortfolioBackup(payload));

    const after = useStore.getState();
    expect(after.trades).toHaveLength(before.trades.length);
    expect(after.trades.map((t) => t.action).sort()).toEqual(
      before.trades.map((t) => t.action).sort(),
    );
    expect(after.clearedHoldings).toHaveLength(1);
    expect(after.clearedHoldings[0]).toMatchObject({
      symbol: "AAPL",
      soldQuantity: 10,
      remainingQuantity: 0,
      fullySold: true,
    });
    expect(after.removedHoldings.some((h) => h.symbol === "AAPL")).toBe(true);
  });

  it("importAll restores cleared holdings from a trades-only backup", () => {
    useStore.getState().importAll({
      holdings: [],
      trades: [
        {
          id: "buy-1",
          date: "2026-01-01",
          symbol: "NVDA",
          type: "stock",
          action: "buy",
          quantity: 2,
          price: 100,
          createdAt: "2026-01-01T00:00:00.000Z",
        },
        {
          id: "sell-1",
          date: "2026-03-01",
          symbol: "NVDA",
          type: "stock",
          action: "sell",
          quantity: 2,
          price: 140,
          realizedPnl: 80,
          realizedPnlPct: 40,
          createdAt: "2026-03-01T00:00:00.000Z",
        },
      ],
      returns: [],
      clearedHoldings: [
        {
          id: "cleared-nvda",
          symbol: "NVDA",
          type: "stock",
          avgBuyCost: 100,
          avgSellPrice: 140,
          totalQuantity: 2,
          soldQuantity: 2,
          remainingQuantity: 0,
          fullySold: true,
          totalRealizedPnl: 80,
          totalRealizedPnlPct: 40,
          firstBuyDate: "2026-01-01",
          lastSellDate: "2026-03-01",
          clearedAt: "2026-03-01T00:00:00.000Z",
        },
      ],
    });

    const [sold] = useStore.getState().clearedHoldings;
    expect(useStore.getState().trades).toHaveLength(2);
    expect(sold).toMatchObject({ symbol: "NVDA", fullySold: true, soldQuantity: 2 });
  });

  it("restores a cloud snapshot including removed holdings", () => {
    useStore.getState().applySnapshot({
      holdings: [
        {
          id: "cash-1",
          symbol: "现金",
          type: "cash",
          quantity: 500,
          avgCost: 1,
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      trades: [],
      returns: [],
      removedHoldings: [
        {
          id: "old-1",
          symbol: "AAPL",
          type: "stock",
          quantity: 2,
          avgCost: 100,
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    });

    expect(useStore.getState().holdings).toHaveLength(1);
    expect(useStore.getState().removedHoldings[0]?.symbol).toBe("AAPL");
  });
});
