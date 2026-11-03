import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AccountCard } from "@/components/AccountCard";
import { CloudSyncProvider } from "@/hooks/use-cloud-sync";
import { CLOUD_SYNC_TIMEOUT_MS, SYNC_META_KEY } from "@/lib/cloud-sync";
import { useStore } from "@/lib/store";

const harness = vi.hoisted(() => ({
  user: { id: "user-1", email: "xingyu15690@gmail.com" } as { id: string; email: string } | null,
  row: null as Record<string, unknown> | null,
  error: null as { message: string } | null,
  upserts: [] as unknown[],
  hang: false,
}));

vi.mock("@/lib/supabase", () => ({
  getSupabaseConfig: () => ({
    url: "https://example.supabase.co",
    anonKey: "anon",
    configured: true,
  }),
  getSupabase: () => ({
    auth: {
      getSession: async () => ({
        data: { session: harness.user ? { user: harness.user } : null },
      }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: () => {} } },
      }),
      signInWithPassword: async () => ({ error: null }),
      signUp: async () => ({ data: { session: null }, error: null }),
      signOut: async () => {},
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => {
            if (harness.hang) return new Promise(() => {});
            return Promise.resolve({ data: harness.row, error: harness.error });
          },
        }),
      }),
      upsert: (payload: unknown) => ({
        select: () => ({
          single: async () => {
            harness.upserts.push(payload);
            return { data: { updated_at: "2026-10-02T00:00:00.000Z" }, error: null };
          },
        }),
      }),
    }),
  }),
}));

const cloudRow = {
  holdings: [
    {
      id: "h1",
      symbol: "NVDA",
      type: "stock",
      quantity: 8,
      avgCost: 120,
      createdAt: "2026-09-01T00:00:00.000Z",
    },
    {
      id: "h2",
      symbol: "AAPL",
      type: "stock",
      quantity: 3,
      avgCost: 180,
      createdAt: "2026-09-02T00:00:00.000Z",
    },
  ],
  trades: [
    {
      id: "t1",
      date: "2026-09-01",
      symbol: "NVDA",
      type: "stock",
      action: "buy",
      quantity: 8,
      price: 120,
      createdAt: "2026-09-01T00:00:00.000Z",
    },
  ],
  returns: [],
  cleared_holdings: [],
  removed_holdings: [],
  price_history: {},
  updated_at: "2026-10-02T00:00:00.000Z",
};

function renderAccount() {
  return render(
    <MemoryRouter>
      <CloudSyncProvider>
        <AccountCard />
      </CloudSyncProvider>
    </MemoryRouter>,
  );
}

describe("CloudSyncProvider reconcile", () => {
  beforeEach(() => {
    localStorage.clear();
    harness.user = { id: "user-1", email: "xingyu15690@gmail.com" };
    harness.row = cloudRow;
    harness.error = null;
    harness.upserts = [];
    harness.hang = false;
    useStore.setState({
      holdings: [],
      trades: [],
      returns: [],
      clearedHoldings: [],
      removedHoldings: [],
    });
  });

  it("pulls an existing cloud portfolio into an empty browser without uploading it", async () => {
    renderAccount();

    expect(await screen.findByText(/已登录，写入会同步到云端/)).toBeInTheDocument();
    expect(screen.queryByText("正在连接…")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "立即同步" })).toBeEnabled();
    expect(screen.getByText("xingyu15690@gmail.com")).toBeInTheDocument();

    const { holdings, trades } = useStore.getState();
    expect(holdings.map((holding) => holding.symbol).sort()).toEqual(["AAPL", "NVDA"]);
    expect(holdings.find((holding) => holding.symbol === "NVDA")?.quantity).toBe(8);
    expect(trades).toHaveLength(1);
    expect(harness.upserts).toHaveLength(0);
  });

  it("keeps local sectors when a clean sync applies a cloud snapshot that has none", async () => {
    localStorage.setItem(
      SYNC_META_KEY,
      JSON.stringify({
        userId: "user-1",
        lastSyncedAt: "2026-10-02T00:00:00.000Z",
        dirty: false,
      }),
    );
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
        {
          id: "local-aapl",
          symbol: "AAPL",
          type: "stock",
          quantity: 1,
          avgCost: 10,
          sector: "AI基建",
          createdAt: "2026-09-02T00:00:00.000Z",
        },
      ],
    });

    renderAccount();

    expect(await screen.findByText(/已登录，写入会同步到云端/)).toBeInTheDocument();
    const holdings = useStore.getState().holdings;
    expect(holdings.find((holding) => holding.symbol === "NVDA")).toMatchObject({
      id: "h1",
      quantity: 8,
      sector: "太空",
    });
    expect(holdings.find((holding) => holding.symbol === "AAPL")).toMatchObject({
      id: "h2",
      quantity: 3,
      sector: "AI基建",
    });

    expect(harness.upserts).toHaveLength(1);
    const uploaded = harness.upserts[0] as { holdings: { symbol: string; sector?: string }[] };
    expect(uploaded.holdings.find((holding) => holding.symbol === "NVDA")?.sector).toBe("太空");
    expect(uploaded.holdings.find((holding) => holding.symbol === "AAPL")?.sector).toBe("AI基建");
  });

  it("applies a cloud sector when the local holding has none", async () => {
    localStorage.setItem(
      SYNC_META_KEY,
      JSON.stringify({
        userId: "user-1",
        lastSyncedAt: "2026-10-02T00:00:00.000Z",
        dirty: false,
      }),
    );
    harness.row = {
      ...cloudRow,
      holdings: (cloudRow.holdings as { id: string }[]).map((holding) =>
        holding.id === "h1" ? { ...holding, sector: "太空" } : holding,
      ),
    };
    useStore.setState({
      holdings: [
        {
          id: "local-nvda",
          symbol: "NVDA",
          type: "stock",
          quantity: 1,
          avgCost: 50,
          createdAt: "2026-09-01T00:00:00.000Z",
        },
      ],
    });

    renderAccount();

    expect(await screen.findByText(/已登录，写入会同步到云端/)).toBeInTheDocument();
    expect(useStore.getState().holdings.find((holding) => holding.symbol === "NVDA")).toMatchObject({
      quantity: 8,
      sector: "太空",
    });
    expect(harness.upserts).toHaveLength(0);
  });

  it("stops connecting and retries when the cloud read fails, then applies the portfolio", async () => {
    harness.error = { message: "permission denied" };
    harness.row = null;
    renderAccount();

    expect(await screen.findByRole("button", { name: "重试同步" })).toBeEnabled();
    expect(screen.getByText(/同步失败，本机缓存仍可用/)).toBeInTheDocument();
    expect(screen.getByText("permission denied")).toBeInTheDocument();
    expect(screen.queryByText("正在连接…")).not.toBeInTheDocument();
    expect(useStore.getState().holdings).toHaveLength(0);
    expect(harness.upserts).toHaveLength(0);

    harness.error = null;
    harness.row = cloudRow;
    fireEvent.click(screen.getByRole("button", { name: "重试同步" }));

    expect(await screen.findByText(/已登录，写入会同步到云端/)).toBeInTheDocument();
    expect(useStore.getState().holdings).toHaveLength(2);
    expect(harness.upserts).toHaveLength(0);
  });

  it("surfaces a timeout instead of staying on connecting when the cloud read never returns", async () => {
    harness.hang = true;
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      renderAccount();
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(screen.getByText(/正在连接/)).toBeInTheDocument();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(CLOUD_SYNC_TIMEOUT_MS);
      });
      expect(screen.getByText("读取云端数据超时，请重试")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "重试同步" })).toBeEnabled();
      expect(screen.queryByText("正在连接…")).not.toBeInTheDocument();
      expect(useStore.getState().holdings).toHaveLength(0);
      expect(harness.upserts).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
