import type { SupabaseClient } from "@supabase/supabase-js";
import { getHistory, setHistory } from "./priceHistory";
import {
  emptySnapshot,
  normalizeSnapshot,
  type PortfolioSnapshot,
  type SyncMeta,
} from "./portfolio-snapshot";
import { useStore } from "./store";
import type { ClearedHolding, Holding, ReturnEntry, Trade } from "./types";

export const SYNC_META_KEY = "invest-cloud-sync-meta-v1";

const defaultMeta: SyncMeta = {
  userId: null,
  lastSyncedAt: null,
  dirty: false,
};

export function loadSyncMeta(): SyncMeta {
  try {
    const raw = localStorage.getItem(SYNC_META_KEY);
    if (!raw) return { ...defaultMeta };
    const parsed = JSON.parse(raw) as Partial<SyncMeta>;
    return {
      userId: typeof parsed.userId === "string" ? parsed.userId : null,
      lastSyncedAt: typeof parsed.lastSyncedAt === "string" ? parsed.lastSyncedAt : null,
      dirty: Boolean(parsed.dirty),
    };
  } catch {
    return { ...defaultMeta };
  }
}

export function saveSyncMeta(meta: SyncMeta) {
  try {
    localStorage.setItem(SYNC_META_KEY, JSON.stringify(meta));
  } catch {
    /* ignore quota */
  }
}

export function readLocalSnapshot(): PortfolioSnapshot {
  const state = useStore.getState();
  return normalizeSnapshot({
    holdings: state.holdings,
    trades: state.trades,
    returns: state.returns,
    clearedHoldings: state.clearedHoldings,
    removedHoldings: state.removedHoldings,
    priceHistory: getHistory(),
  });
}

export function applyLocalSnapshot(snapshot: PortfolioSnapshot) {
  setHistory(snapshot.priceHistory ?? {});
  useStore.getState().applySnapshot(snapshot);
}

export async function fetchPortfolio(
  client: SupabaseClient,
  userId: string,
): Promise<PortfolioSnapshot | null> {
  const { data, error } = await client
    .from("portfolios")
    .select(
      "holdings, trades, returns, cleared_holdings, removed_holdings, price_history, updated_at",
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return normalizeSnapshot({
    holdings: data.holdings as Holding[],
    trades: data.trades as Trade[],
    returns: data.returns as ReturnEntry[],
    clearedHoldings: data.cleared_holdings as ClearedHolding[],
    removedHoldings: data.removed_holdings as Holding[],
    priceHistory: data.price_history,
    updatedAt: typeof data.updated_at === "string" ? data.updated_at : undefined,
  });
}

export async function upsertPortfolio(
  client: SupabaseClient,
  userId: string,
  snapshot: PortfolioSnapshot,
): Promise<{ updatedAt: string }> {
  const normalized = normalizeSnapshot(snapshot);
  const payload = {
    user_id: userId,
    holdings: normalized.holdings,
    trades: normalized.trades,
    returns: normalized.returns,
    cleared_holdings: normalized.clearedHoldings,
    removed_holdings: normalized.removedHoldings,
    price_history: normalized.priceHistory,
  };

  const { data, error } = await client
    .from("portfolios")
    .upsert(payload, { onConflict: "user_id" })
    .select("updated_at")
    .single();

  if (error) throw error;
  return {
    updatedAt:
      typeof data?.updated_at === "string"
        ? data.updated_at
        : new Date().toISOString(),
  };
}

export function waitForStoreHydration(): Promise<void> {
  const persist = useStore.persist;
  if (persist.hasHydrated()) return Promise.resolve();
  return new Promise((resolve) => {
    const unsub = persist.onFinishHydration(() => {
      unsub();
      resolve();
    });
  });
}

export { emptySnapshot };
