import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyCloudSnapshot, upsertPortfolio, waitForStoreHydration, withTimeout } from "@/lib/cloud-sync";
import { emptySnapshot, type PortfolioSnapshot } from "@/lib/portfolio-snapshot";
import { useStore } from "@/lib/store";

const cloudWithDuplicateSpcx = (): PortfolioSnapshot => ({
  holdings: [
    {
      id: "a",
      symbol: "SPCX",
      type: "stock",
      quantity: 3,
      avgCost: 126.51,
      name: "First",
      priceId: "SPCX",
      createdAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "b",
      symbol: "spcx",
      type: "stock",
      quantity: 7,
      avgCost: 147.15,
      createdAt: "2026-02-01T00:00:00.000Z",
    },
    {
      id: "c",
      symbol: "AAPL",
      type: "stock",
      quantity: 1,
      avgCost: 100,
      createdAt: "2026-01-01T00:00:00.000Z",
    },
  ],
  trades: [],
  returns: [],
  clearedHoldings: [],
  removedHoldings: [],
  priceHistory: {},
  updatedAt: "2026-03-01T00:00:00.000Z",
});

describe("store hydration", () => {
  it("finishes during store setup so cloud reconcile is not left waiting", async () => {
    expect(useStore.persist.hasHydrated()).toBe(true);
    await expect(waitForStoreHydration()).resolves.toBeUndefined();
  });
});

describe("withTimeout", () => {
  it("returns the value when the operation settles in time", async () => {
    await expect(withTimeout(Promise.resolve("ok"), 1_000, "同步超时，请重试")).resolves.toBe("ok");
  });

  it("rejects with the timeout message when the operation never settles", async () => {
    vi.useFakeTimers();
    try {
      const pending = withTimeout(new Promise(() => {}), 20_000, "读取云端数据超时，请重试").then(
        () => "resolved",
        (err: unknown) => (err instanceof Error ? err.message : "unknown"),
      );
      await vi.advanceTimersByTimeAsync(20_000);
      await expect(pending).resolves.toBe("读取云端数据超时，请重试");
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("applyCloudSnapshot", () => {
  beforeEach(() => {
    localStorage.clear();
    useStore.setState({
      holdings: [],
      trades: [],
      returns: [],
      clearedHoldings: [],
      removedHoldings: [],
    });
  });

  it("merges two SPCX rows from a cloud snapshot and writes the merged portfolio back", async () => {
    const pushed: PortfolioSnapshot[] = [];
    const wrote = await applyCloudSnapshot(cloudWithDuplicateSpcx(), async (next) => {
      pushed.push(next);
    });

    const spcx = useStore.getState().holdings.filter((h) => h.symbol.toLowerCase() === "spcx");
    expect(wrote).toBe(true);
    expect(spcx).toHaveLength(1);
    expect(spcx[0]).toMatchObject({ id: "a", symbol: "SPCX", name: "First", quantity: 10 });
    expect(spcx[0].avgCost).toBeCloseTo((3 * 126.51 + 7 * 147.15) / 10, 8);
    expect(useStore.getState().holdings.find((h) => h.symbol === "AAPL")?.quantity).toBe(1);

    expect(pushed).toHaveLength(1);
    const writtenSpcx = pushed[0].holdings.filter((h) => h.symbol.toLowerCase() === "spcx");
    expect(writtenSpcx).toHaveLength(1);
    expect(writtenSpcx[0]).toMatchObject({ id: "a", quantity: 10 });
    expect(pushed[0].holdings).toHaveLength(2);
  });

  it("does not write back when the cloud snapshot has no duplicate symbol and type", async () => {
    const snapshot = cloudWithDuplicateSpcx();
    snapshot.holdings = snapshot.holdings.filter((h) => h.id !== "b");
    const pushed: PortfolioSnapshot[] = [];
    const wrote = await applyCloudSnapshot(snapshot, async (next) => {
      pushed.push(next);
    });

    expect(wrote).toBe(false);
    expect(pushed).toHaveLength(0);
    expect(useStore.getState().holdings).toHaveLength(2);
  });

  it("hydrates a holding sector from a cloud snapshot and keeps it after duplicate collapse", async () => {
    const snapshot = cloudWithDuplicateSpcx();
    snapshot.holdings = snapshot.holdings.map((holding) =>
      holding.id === "b" ? { ...holding, sector: "太空" } : holding,
    );
    snapshot.holdings.push({
      id: "rklb",
      symbol: "RKLB",
      type: "stock",
      quantity: 4,
      avgCost: 20,
      sector: "  AI基建  ",
      createdAt: "2026-01-01T00:00:00.000Z",
    });

    const pushed: PortfolioSnapshot[] = [];
    const wrote = await applyCloudSnapshot(snapshot, async (next) => {
      pushed.push(next);
    });

    const spcx = useStore.getState().holdings.find((h) => h.symbol === "SPCX");
    const rklb = useStore.getState().holdings.find((h) => h.symbol === "RKLB");
    expect(wrote).toBe(true);
    expect(spcx?.sector).toBe("太空");
    expect(rklb?.sector).toBe("AI基建");
    expect(pushed[0].holdings.find((h) => h.symbol === "SPCX")?.sector).toBe("太空");
    expect(pushed[0].holdings.find((h) => h.symbol === "RKLB")?.sector).toBe("AI基建");
  });

  it("keeps a local sector the cloud snapshot is missing and writes that label back", async () => {
    useStore.setState({
      holdings: [
        {
          id: "local-nvda",
          symbol: "NVDA",
          type: "stock",
          quantity: 1,
          avgCost: 50,
          sector: "太空",
          createdAt: "2026-09-01T00:00:00.000Z",
        },
      ],
      trades: [],
      returns: [],
      clearedHoldings: [],
      removedHoldings: [],
    });
    const cloud: PortfolioSnapshot = {
      ...emptySnapshot(),
      holdings: [
        {
          id: "cloud-nvda",
          symbol: "NVDA",
          type: "stock",
          quantity: 8,
          avgCost: 120,
          createdAt: "2026-09-01T00:00:00.000Z",
        },
      ],
      updatedAt: "2026-11-03T05:35:24.000Z",
    };
    const pushed: PortfolioSnapshot[] = [];
    const wrote = await applyCloudSnapshot(cloud, async (next) => {
      pushed.push(next);
    }, {
      ...emptySnapshot(),
      holdings: useStore.getState().holdings,
    });

    expect(wrote).toBe(true);
    expect(useStore.getState().holdings[0]).toMatchObject({ id: "cloud-nvda", quantity: 8, sector: "太空" });
    expect(pushed[0].holdings[0]).toMatchObject({ quantity: 8, sector: "太空" });
  });

  it("does not replace a cloud sector with a different local sector", async () => {
    const cloud: PortfolioSnapshot = {
      ...emptySnapshot(),
      holdings: [
        {
          id: "cloud-aapl",
          symbol: "AAPL",
          type: "stock",
          quantity: 5,
          avgCost: 180,
          sector: "AI基建",
          createdAt: "2026-09-01T00:00:00.000Z",
        },
      ],
    };
    const pushed: PortfolioSnapshot[] = [];
    const wrote = await applyCloudSnapshot(cloud, async (next) => {
      pushed.push(next);
    }, {
      ...emptySnapshot(),
      holdings: [
        {
          id: "local-aapl",
          symbol: "AAPL",
          type: "stock",
          quantity: 1,
          avgCost: 10,
          sector: "太空",
          createdAt: "2026-09-01T00:00:00.000Z",
        },
      ],
    });

    expect(wrote).toBe(false);
    expect(pushed).toHaveLength(0);
    expect(useStore.getState().holdings[0]).toMatchObject({ id: "cloud-aapl", quantity: 5, sector: "AI基建" });
  });
});

describe("sector round-trip through upsert", () => {
  it("sends the sector field with the holding", async () => {
    let payload: { holdings?: { symbol?: string; sector?: string }[] } | null = null;
    const client = {
      from: () => ({
        upsert: (body: { holdings?: { symbol?: string; sector?: string }[] }) => {
          payload = body;
          return {
            select: () => ({
              single: async () => ({ data: { updated_at: "2026-11-03T05:35:24.000Z" }, error: null }),
            }),
          };
        },
      }),
    };

    await upsertPortfolio(client as never, "user-1", {
      ...emptySnapshot(),
      holdings: [
        {
          id: "h1",
          symbol: "NVDA",
          type: "stock",
          quantity: 8,
          avgCost: 120,
          sector: "太空",
          createdAt: "2026-09-01T00:00:00.000Z",
        },
        {
          id: "h2",
          symbol: "AAPL",
          type: "stock",
          quantity: 3,
          avgCost: 180,
          createdAt: "2026-09-01T00:00:00.000Z",
        },
      ],
    });

    expect(payload?.holdings?.find((holding) => holding.symbol === "NVDA")?.sector).toBe("太空");
    expect(payload?.holdings?.find((holding) => holding.symbol === "AAPL")?.sector).toBeUndefined();
  });
});
