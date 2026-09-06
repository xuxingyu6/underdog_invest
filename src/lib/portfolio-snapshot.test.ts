import { describe, expect, it } from "vitest";
import type { Holding, Trade } from "./types";
import {
  decideReconcile,
  emptySnapshot,
  hasPortfolioData,
  mergeSnapshots,
  snapshotCounts,
  type PortfolioSnapshot,
  type SyncMeta,
} from "./portfolio-snapshot";

const holding = (overrides: Partial<Holding> & Pick<Holding, "id" | "symbol">): Holding => ({
  type: "stock",
  quantity: 1,
  avgCost: 10,
  createdAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const trade = (overrides: Partial<Trade> & Pick<Trade, "id" | "symbol">): Trade => ({
  date: "2026-01-01",
  type: "stock",
  action: "buy",
  quantity: 1,
  price: 10,
  createdAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const snap = (partial: Partial<PortfolioSnapshot> = {}): PortfolioSnapshot => ({
  ...emptySnapshot(),
  ...partial,
});

const meta = (partial: Partial<SyncMeta> = {}): SyncMeta => ({
  userId: null,
  lastSyncedAt: null,
  dirty: false,
  ...partial,
});

describe("hasPortfolioData", () => {
  it("is false for an empty snapshot", () => {
    expect(hasPortfolioData(emptySnapshot())).toBe(false);
  });

  it("is true when any portfolio collection has rows", () => {
    expect(hasPortfolioData(snap({ holdings: [holding({ id: "h1", symbol: "AAPL" })] }))).toBe(true);
    expect(hasPortfolioData(snap({ trades: [trade({ id: "t1", symbol: "AAPL" })] }))).toBe(true);
    expect(hasPortfolioData(snap({ removedHoldings: [holding({ id: "h2", symbol: "MSFT" })] }))).toBe(true);
  });
});

describe("mergeSnapshots", () => {
  it("unions distinct records and lets local win on the same holding symbol", () => {
    const local = snap({
      holdings: [holding({ id: "local-aapl", symbol: "AAPL", quantity: 8 })],
      trades: [trade({ id: "t-local", symbol: "AAPL" })],
      priceHistory: { "2026-01-02": { "stock:AAPL": 120 } },
    });
    const cloud = snap({
      holdings: [
        holding({ id: "cloud-aapl", symbol: "AAPL", quantity: 2 }),
        holding({ id: "cloud-msft", symbol: "MSFT", quantity: 3 }),
      ],
      trades: [trade({ id: "t-cloud", symbol: "MSFT" })],
      priceHistory: { "2026-01-02": { "stock:AAPL": 100, "stock:MSFT": 400 } },
    });

    const merged = mergeSnapshots(local, cloud);
    expect(merged.holdings).toHaveLength(2);
    expect(merged.holdings.find((h) => h.symbol === "AAPL")?.quantity).toBe(8);
    expect(merged.holdings.find((h) => h.symbol === "MSFT")?.quantity).toBe(3);
    expect(merged.trades.map((t) => t.id).sort()).toEqual(["t-cloud", "t-local"]);
    expect(merged.priceHistory["2026-01-02"]).toEqual({
      "stock:AAPL": 120,
      "stock:MSFT": 400,
    });
  });
});

describe("decideReconcile", () => {
  const userId = "user-1";

  it("loads cloud when this device is empty", () => {
    const cloud = snap({
      holdings: [holding({ id: "h1", symbol: "NVDA" })],
      updatedAt: "2026-09-01T00:00:00.000Z",
    });
    expect(
      decideReconcile({ local: emptySnapshot(), cloud, meta: meta(), userId }),
    ).toEqual({ type: "apply-cloud", snapshot: cloud });
  });

  it("asks before uploading existing local data to an empty cloud", () => {
    const local = snap({ holdings: [holding({ id: "h1", symbol: "AAPL" })] });
    expect(decideReconcile({ local, cloud: null, meta: meta(), userId })).toEqual({
      type: "prompt-upload",
    });
  });

  it("does not offer to upload another account's leftover cache", () => {
    const local = snap({ holdings: [holding({ id: "h1", symbol: "AAPL" })] });
    expect(
      decideReconcile({
        local,
        cloud: null,
        meta: meta({ userId: "someone-else" }),
        userId,
      }),
    ).toEqual({ type: "apply-cloud", snapshot: emptySnapshot() });
  });

  it("asks when both sides have data on first login", () => {
    const local = snap({ holdings: [holding({ id: "h1", symbol: "AAPL" })] });
    const cloud = snap({
      holdings: [holding({ id: "h2", symbol: "MSFT" })],
      updatedAt: "2026-09-01T00:00:00.000Z",
    });
    expect(decideReconcile({ local, cloud, meta: meta(), userId })).toEqual({
      type: "prompt-conflict",
      cloud,
    });
  });

  it("applies cloud on the next visit when this user is clean", () => {
    const local = snap({ holdings: [holding({ id: "h1", symbol: "AAPL" })] });
    const cloud = snap({
      holdings: [holding({ id: "h2", symbol: "MSFT" })],
      updatedAt: "2026-09-02T00:00:00.000Z",
    });
    expect(
      decideReconcile({
        local,
        cloud,
        meta: meta({ userId, lastSyncedAt: "2026-09-01T00:00:00.000Z", dirty: false }),
        userId,
      }),
    ).toEqual({ type: "apply-cloud", snapshot: cloud });
  });

  it("pushes local when the device has unsynced edits and cloud is not newer", () => {
    const local = snap({ holdings: [holding({ id: "h1", symbol: "AAPL" })] });
    const cloud = snap({
      holdings: [holding({ id: "h2", symbol: "MSFT" })],
      updatedAt: "2026-09-01T00:00:00.000Z",
    });
    expect(
      decideReconcile({
        local,
        cloud,
        meta: meta({ userId, lastSyncedAt: "2026-09-01T00:00:00.000Z", dirty: true }),
        userId,
      }),
    ).toEqual({ type: "push-local" });
  });
});

describe("snapshotCounts", () => {
  it("counts the main collections", () => {
    expect(
      snapshotCounts(
        snap({
          holdings: [holding({ id: "h1", symbol: "AAPL" })],
          trades: [trade({ id: "t1", symbol: "AAPL" }), trade({ id: "t2", symbol: "AAPL" })],
        }),
      ),
    ).toEqual({ holdings: 1, trades: 2, returns: 0 });
  });
});
