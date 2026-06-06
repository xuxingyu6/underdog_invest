import { beforeEach, describe, expect, it } from "vitest";
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
});
