import { beforeEach, describe, expect, it } from "vitest";
import { applyCloudSnapshot } from "@/lib/cloud-sync";
import type { PortfolioSnapshot } from "@/lib/portfolio-snapshot";
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
});
