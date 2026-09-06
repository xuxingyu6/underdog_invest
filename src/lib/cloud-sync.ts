import type { SupabaseClient } from "@supabase/supabase-js";
import { getHistory, setHistory, type History } from "./priceHistory";
import {
  emptySnapshot,
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

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function asHistory(value: unknown): History {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as History)
    : {};
}

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
  return {
    holdings: state.holdings,
    trades: state.trades,
    returns: state.returns,
    clearedHoldings: state.clearedHoldings,
    removedHoldings: state.removedHoldings,
    priceHistory: getHistory(),
  };
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

  return {
    holdings: asArray<Holding>(data.holdings),
    trades: asArray<Trade>(data.trades),
    returns: asArray<ReturnEntry>(data.returns),
    clearedHoldings: asArray<ClearedHolding>(data.cleared_holdings),
    removedHoldings: asArray<Holding>(data.removed_holdings),
    priceHistory: asHistory(data.price_history),
    updatedAt: typeof data.updated_at === "string" ? data.updated_at : undefined,
  };
}

export async function upsertPortfolio(
  client: SupabaseClient,
  userId: string,
  snapshot: PortfolioSnapshot,
): Promise<{ updatedAt: string }> {
  const payload = {
    user_id: userId,
    holdings: snapshot.holdings,
    trades: snapshot.trades,
    returns: snapshot.returns,
    cleared_holdings: snapshot.clearedHoldings,
    removed_holdings: snapshot.removedHoldings,
    price_history: snapshot.priceHistory ?? {},
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
