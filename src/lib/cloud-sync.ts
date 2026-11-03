import type { SupabaseClient } from "@supabase/supabase-js";
import { getHistory, setHistory } from "./priceHistory";
import {
  emptySnapshot,
  normalizeSnapshot,
  withFallbackSectors,
  type PortfolioSnapshot,
  type SyncMeta,
} from "./portfolio-snapshot";
import { normalizeSector } from "./sector-allocation";
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

function sectorSignature(holdings: { type?: string; symbol?: string; sector?: string }[]): string {
  return holdings
    .map((holding) => {
      const symbol = typeof holding.symbol === "string" ? holding.symbol.toLowerCase() : "";
      return `${holding.type ?? ""}:${symbol}=${normalizeSector(holding.sector) ?? ""}`;
    })
    .sort()
    .join("\n");
}

/**
 * Apply a cloud snapshot, keeping sector labels the cloud row does not have.
 * Pushes the result when duplicate holdings were collapsed or when a sector
 * was filled in. Without that write-back, the next clean sync reapplies the
 * cloud copy and either the duplicate rows or the missing sectors return.
 * Returns true when a snapshot was pushed.
 */
export async function applyCloudSnapshot(
  snapshot: PortfolioSnapshot,
  push: (next: PortfolioSnapshot) => Promise<void>,
  fallback?: PortfolioSnapshot,
): Promise<boolean> {
  const beforeCount = snapshot.holdings.length;
  const beforeSectors = sectorSignature(snapshot.holdings);
  const enriched = fallback ? withFallbackSectors(snapshot, fallback) : snapshot;
  applyLocalSnapshot(enriched);
  const local = readLocalSnapshot();
  const collapsed = local.holdings.length !== beforeCount;
  const sectorsChanged = sectorSignature(local.holdings) !== beforeSectors;
  if (!collapsed && !sectorsChanged) return false;
  await push(local);
  return true;
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

export const CLOUD_SYNC_TIMEOUT_MS = 20_000;

/** Reject when `promise` does not settle within `ms`, so the UI can leave its loading state. */
export function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer !== undefined) clearTimeout(timer);
  });
}

/**
 * Resolves once persist has finished, or on the next microtask if hydration
 * already failed. localStorage rehydration runs synchronously inside `create()`.
 * If it throws, zustand never sets `hasHydrated` and never emits
 * `onFinishHydration`, so waiting only on that listener hangs reconcile forever.
 */
export function waitForStoreHydration(): Promise<void> {
  const persist = useStore.persist;
  if (persist.hasHydrated()) return Promise.resolve();
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      unsubscribe();
      resolve();
    };
    const unsubscribe = persist.onFinishHydration(() => {
      finish();
    });
    if (persist.hasHydrated()) finish();
    queueMicrotask(() => {
      if (!persist.hasHydrated()) finish();
    });
  });
}

export { emptySnapshot };
