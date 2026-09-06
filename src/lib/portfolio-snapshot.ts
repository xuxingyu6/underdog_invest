import type { ClearedHolding, Holding, ReturnEntry, Trade } from "./types";
import type { History } from "./priceHistory";

export interface PortfolioSnapshot {
  holdings: Holding[];
  trades: Trade[];
  returns: ReturnEntry[];
  clearedHoldings: ClearedHolding[];
  removedHoldings: Holding[];
  priceHistory: History;
  updatedAt?: string;
}

export interface SnapshotCounts {
  holdings: number;
  trades: number;
  returns: number;
}

export interface SyncMeta {
  userId: string | null;
  lastSyncedAt: string | null;
  dirty: boolean;
}

export type ReconcileDecision =
  | { type: "apply-cloud"; snapshot: PortfolioSnapshot }
  | { type: "push-local" }
  | { type: "prompt-upload" }
  | { type: "prompt-conflict"; cloud: PortfolioSnapshot }
  | { type: "noop" };

export function emptySnapshot(): PortfolioSnapshot {
  return {
    holdings: [],
    trades: [],
    returns: [],
    clearedHoldings: [],
    removedHoldings: [],
    priceHistory: {},
  };
}

export function snapshotCounts(snapshot: PortfolioSnapshot): SnapshotCounts {
  return {
    holdings: snapshot.holdings.length,
    trades: snapshot.trades.length,
    returns: snapshot.returns.length,
  };
}

export function hasPortfolioData(snapshot: PortfolioSnapshot): boolean {
  return (
    snapshot.holdings.length > 0 ||
    snapshot.trades.length > 0 ||
    snapshot.returns.length > 0 ||
    snapshot.removedHoldings.length > 0
  );
}

function mergeByKey<T>(
  local: T[],
  cloud: T[],
  keyOf: (item: T) => string,
): T[] {
  const map = new Map<string, T>();
  for (const item of cloud) {
    const key = keyOf(item);
    if (key) map.set(key, item);
  }
  for (const item of local) {
    const key = keyOf(item);
    if (key) map.set(key, item);
  }
  return [...map.values()];
}

function holdingKey<T extends { type: string; symbol: string }>(item: T): string {
  return `${item.type}:${item.symbol.toLowerCase()}`;
}

function mergePriceHistory(local: History, cloud: History): History {
  const dates = new Set([...Object.keys(cloud), ...Object.keys(local)]);
  const out: History = {};
  for (const date of dates) {
    out[date] = { ...(cloud[date] ?? {}), ...(local[date] ?? {}) };
  }
  return out;
}

/** Union local + cloud. On key collision, local wins (this device's latest edits). */
export function mergeSnapshots(
  local: PortfolioSnapshot,
  cloud: PortfolioSnapshot,
): PortfolioSnapshot {
  return {
    holdings: mergeByKey(local.holdings, cloud.holdings, holdingKey),
    trades: mergeByKey(local.trades, cloud.trades, (t) => t.id),
    returns: mergeByKey(local.returns, cloud.returns, (r) => r.id),
    clearedHoldings: mergeByKey(local.clearedHoldings, cloud.clearedHoldings, holdingKey),
    removedHoldings: mergeByKey(local.removedHoldings, cloud.removedHoldings, holdingKey),
    priceHistory: mergePriceHistory(local.priceHistory ?? {}, cloud.priceHistory ?? {}),
  };
}

export function decideReconcile(args: {
  local: PortfolioSnapshot;
  cloud: PortfolioSnapshot | null;
  meta: SyncMeta;
  userId: string;
}): ReconcileDecision {
  const { local, cloud, meta, userId } = args;
  const cloudSnapshot = cloud ?? emptySnapshot();
  const hasLocal = hasPortfolioData(local);
  const hasCloud = hasPortfolioData(cloudSnapshot);
  const foreignUser = Boolean(meta.userId && meta.userId !== userId);
  const sameUser = meta.userId === userId;

  if (foreignUser) {
    return { type: "apply-cloud", snapshot: cloudSnapshot };
  }

  if (!hasLocal && !hasCloud) return { type: "noop" };
  if (!hasLocal && hasCloud) return { type: "apply-cloud", snapshot: cloudSnapshot };

  if (hasLocal && !hasCloud) {
    if (sameUser && meta.lastSyncedAt) return { type: "push-local" };
    return { type: "prompt-upload" };
  }

  if (sameUser && meta.lastSyncedAt && !meta.dirty) {
    return { type: "apply-cloud", snapshot: cloudSnapshot };
  }
  if (sameUser && meta.lastSyncedAt && meta.dirty) {
    const cloudTs = cloudSnapshot.updatedAt ?? "";
    if (!cloudTs || cloudTs <= meta.lastSyncedAt) return { type: "push-local" };
    return { type: "prompt-conflict", cloud: cloudSnapshot };
  }

  return { type: "prompt-conflict", cloud: cloudSnapshot };
}
