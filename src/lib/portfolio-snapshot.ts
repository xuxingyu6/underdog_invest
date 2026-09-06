import type { ClearedHolding, Holding, ReturnEntry, Trade } from "./types";
import type { History } from "./priceHistory";

export const PORTFOLIO_BACKUP_VERSION = 3;

export interface PortfolioSnapshot {
  holdings: Holding[];
  trades: Trade[];
  returns: ReturnEntry[];
  clearedHoldings: ClearedHolding[];
  removedHoldings: Holding[];
  priceHistory: History;
  updatedAt?: string;
}

export interface PortfolioBackup extends PortfolioSnapshot {
  version: number;
  exportedAt: string;
  theme?: "light" | "dark";
}

export interface SnapshotCounts {
  holdings: number;
  trades: number;
  returns: number;
  clearedHoldings: number;
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
    clearedHoldings: snapshot.clearedHoldings.length,
  };
}

export function hasPortfolioData(snapshot: PortfolioSnapshot): boolean {
  return (
    snapshot.holdings.length > 0 ||
    snapshot.trades.length > 0 ||
    snapshot.returns.length > 0 ||
    snapshot.clearedHoldings.length > 0 ||
    snapshot.removedHoldings.length > 0
  );
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function asHistory(value: unknown): History {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as History)
    : {};
}

/** Always emit every persisted collection, including empty arrays. */
export function normalizeSnapshot(raw: Partial<PortfolioSnapshot> | null | undefined): PortfolioSnapshot {
  return {
    holdings: asArray<Holding>(raw?.holdings),
    trades: asArray<Trade>(raw?.trades),
    returns: asArray<ReturnEntry>(raw?.returns),
    clearedHoldings: asArray<ClearedHolding>(raw?.clearedHoldings),
    removedHoldings: asArray<Holding>(raw?.removedHoldings),
    priceHistory: asHistory(raw?.priceHistory),
    updatedAt: typeof raw?.updatedAt === "string" ? raw.updatedAt : undefined,
  };
}

export function createPortfolioBackup(
  snapshot: PortfolioSnapshot,
  extras: { theme?: "light" | "dark"; exportedAt?: string } = {},
): PortfolioBackup {
  const normalized = normalizeSnapshot(snapshot);
  return {
    ...normalized,
    version: PORTFOLIO_BACKUP_VERSION,
    exportedAt: extras.exportedAt ?? new Date().toISOString(),
    ...(extras.theme === "light" || extras.theme === "dark" ? { theme: extras.theme } : {}),
  };
}

export function parsePortfolioBackup(data: unknown): PortfolioBackup {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("invalid file");
  }
  const raw = data as Record<string, unknown>;
  if (!Array.isArray(raw.holdings) && !Array.isArray(raw.trades)) {
    throw new Error("invalid file");
  }
  const snapshot = normalizeSnapshot({
    holdings: raw.holdings as Holding[] | undefined,
    trades: raw.trades as Trade[] | undefined,
    returns: raw.returns as ReturnEntry[] | undefined,
    clearedHoldings: raw.clearedHoldings as ClearedHolding[] | undefined,
    removedHoldings: raw.removedHoldings as Holding[] | undefined,
    priceHistory: raw.priceHistory as History | undefined,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : undefined,
  });
  return {
    ...snapshot,
    version: typeof raw.version === "number" ? raw.version : PORTFOLIO_BACKUP_VERSION,
    exportedAt: typeof raw.exportedAt === "string" ? raw.exportedAt : new Date().toISOString(),
    theme: raw.theme === "dark" || raw.theme === "light" ? raw.theme : undefined,
  };
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
  const left = normalizeSnapshot(local);
  const right = normalizeSnapshot(cloud);
  return {
    holdings: mergeByKey(left.holdings, right.holdings, holdingKey),
    trades: mergeByKey(left.trades, right.trades, (t) => t.id),
    returns: mergeByKey(left.returns, right.returns, (r) => r.id),
    clearedHoldings: mergeByKey(left.clearedHoldings, right.clearedHoldings, holdingKey),
    removedHoldings: mergeByKey(left.removedHoldings, right.removedHoldings, holdingKey),
    priceHistory: mergePriceHistory(left.priceHistory, right.priceHistory),
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
