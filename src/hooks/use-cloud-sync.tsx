import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import { toast } from "sonner";
import {
  applyLocalSnapshot,
  fetchPortfolio,
  loadSyncMeta,
  readLocalSnapshot,
  saveSyncMeta,
  upsertPortfolio,
  waitForStoreHydration,
} from "@/lib/cloud-sync";
import {
  decideReconcile,
  mergeSnapshots,
  snapshotCounts,
  type PortfolioSnapshot,
  type SnapshotCounts,
} from "@/lib/portfolio-snapshot";
import { getSupabase } from "@/lib/supabase";
import { useStore } from "@/lib/store";

export type PendingSync =
  | { kind: "upload"; local: SnapshotCounts }
  | { kind: "conflict"; local: SnapshotCounts; cloud: SnapshotCounts; cloudSnapshot: PortfolioSnapshot };

interface CloudSyncContextValue {
  configured: boolean;
  user: User | null;
  loading: boolean;
  syncing: boolean;
  lastSyncedAt: string | null;
  error: string | null;
  pending: PendingSync | null;
  outboundEnabled: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  pushNow: () => Promise<void>;
  resolveUpload: (upload: boolean) => Promise<void>;
  resolveConflict: (choice: "cloud" | "local" | "merge") => Promise<void>;
}

const CloudSyncContext = createContext<CloudSyncContextValue | null>(null);

const PUSH_DEBOUNCE_MS = 800;

function mapAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("invalid login")) return "邮箱或密码不正确";
  if (lower.includes("already registered") || lower.includes("user already")) return "该邮箱已注册，请直接登录";
  if (lower.includes("email not confirmed")) return "请先点击邮件中的确认链接";
  if (lower.includes("password")) return "密码至少 6 位";
  if (lower.includes("rate limit") || lower.includes("too many")) return "尝试次数过多，请稍后再试";
  return message || "操作失败";
}

export function CloudSyncProvider({ children }: { children: ReactNode }) {
  const configured = Boolean(getSupabase());
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(configured);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(() => loadSyncMeta().lastSyncedAt);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingSync | null>(null);
  const [outboundEnabled, setOutboundEnabled] = useState(false);

  const applyingRemote = useRef(false);
  const pushTimer = useRef<number | null>(null);
  const userIdRef = useRef<string | null>(null);
  userIdRef.current = user?.id ?? null;

  const markMeta = useCallback((patch: Partial<ReturnType<typeof loadSyncMeta>>) => {
    const next = { ...loadSyncMeta(), ...patch };
    saveSyncMeta(next);
    if (patch.lastSyncedAt !== undefined) setLastSyncedAt(patch.lastSyncedAt);
    return next;
  }, []);

  const pushSnapshot = useCallback(async (snapshot: PortfolioSnapshot) => {
    const client = getSupabase();
    const userId = userIdRef.current;
    if (!client || !userId) return;
    setSyncing(true);
    setError(null);
    try {
      const { updatedAt } = await upsertPortfolio(client, userId, snapshot);
      markMeta({ userId, lastSyncedAt: updatedAt, dirty: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : "同步失败";
      setError(message);
      markMeta({ dirty: true });
      throw err;
    } finally {
      setSyncing(false);
    }
  }, [markMeta]);

  const applyRemote = useCallback((snapshot: PortfolioSnapshot) => {
    applyingRemote.current = true;
    applyLocalSnapshot(snapshot);
    queueMicrotask(() => {
      applyingRemote.current = false;
    });
  }, []);

  const reconcile = useCallback(async (userId: string) => {
    const client = getSupabase();
    if (!client) return;
    setLoading(true);
    setError(null);
    setPending(null);
    setOutboundEnabled(false);
    try {
      await waitForStoreHydration();
      const cloud = await fetchPortfolio(client, userId);
      if (userIdRef.current !== userId) return;
      const local = readLocalSnapshot();
      const decision = decideReconcile({
        local,
        cloud,
        meta: loadSyncMeta(),
        userId,
      });

      if (decision.type === "apply-cloud") {
        applyRemote(decision.snapshot);
        markMeta({
          userId,
          lastSyncedAt: decision.snapshot.updatedAt ?? new Date().toISOString(),
          dirty: false,
        });
        setOutboundEnabled(true);
      } else if (decision.type === "push-local") {
        await pushSnapshot(local);
        setOutboundEnabled(true);
      } else if (decision.type === "prompt-upload") {
        setPending({ kind: "upload", local: snapshotCounts(local) });
      } else if (decision.type === "prompt-conflict") {
        setPending({
          kind: "conflict",
          local: snapshotCounts(local),
          cloud: snapshotCounts(decision.cloud),
          cloudSnapshot: decision.cloud,
        });
      } else {
        markMeta({ userId });
        setOutboundEnabled(true);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "读取云端数据失败";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [applyRemote, markMeta, pushSnapshot]);

  useEffect(() => {
    const client = getSupabase();
    if (!client) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    client.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setUser(data.session?.user ?? null);
      if (!data.session?.user) setLoading(false);
    });

    const { data } = client.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        setPending(null);
        setOutboundEnabled(false);
        setLoading(false);
        setError(null);
      }
    });

    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, []);

  const userId = user?.id ?? null;
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void reconcile(userId).then(() => {
      if (cancelled) return;
    });
    return () => {
      cancelled = true;
    };
  }, [userId, reconcile]);

  useEffect(() => {
    if (!user || !outboundEnabled) return;

    const schedulePush = () => {
      if (applyingRemote.current) return;
      markMeta({ userId: user.id, dirty: true });
      if (pushTimer.current) window.clearTimeout(pushTimer.current);
      pushTimer.current = window.setTimeout(() => {
        void pushSnapshot(readLocalSnapshot()).catch(() => {
          toast.error("云同步失败，数据仍保存在本机");
        });
      }, PUSH_DEBOUNCE_MS);
    };

    const unsub = useStore.subscribe((state, prev) => {
      if (
        state.holdings === prev.holdings &&
        state.trades === prev.trades &&
        state.returns === prev.returns &&
        state.clearedHoldings === prev.clearedHoldings &&
        state.removedHoldings === prev.removedHoldings
      ) {
        return;
      }
      schedulePush();
    });

    return () => {
      unsub();
      if (pushTimer.current) window.clearTimeout(pushTimer.current);
    };
  }, [user, outboundEnabled, markMeta, pushSnapshot]);

  const signIn = useCallback(async (email: string, password: string) => {
    const client = getSupabase();
    if (!client) throw new Error("未配置云同步");
    // Email + password only (no magic link).
    const { error: authError } = await client.auth.signInWithPassword({ email, password });
    if (authError) throw new Error(mapAuthError(authError.message));
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const client = getSupabase();
    if (!client) throw new Error("未配置云同步");
    const { data, error: authError } = await client.auth.signUp({ email, password });
    if (authError) throw new Error(mapAuthError(authError.message));
    if (!data.session) {
      toast.success("注册成功，请查收确认邮件后再登录");
    }
  }, []);

  const signOut = useCallback(async () => {
    const client = getSupabase();
    if (!client) return;
    if (pushTimer.current) window.clearTimeout(pushTimer.current);
    setOutboundEnabled(false);
    await client.auth.signOut();
    setUser(null);
    setPending(null);
    setError(null);
  }, []);

  const pushNow = useCallback(async () => {
    if (!userIdRef.current) return;
    try {
      await pushSnapshot(readLocalSnapshot());
      setOutboundEnabled(true);
      setPending(null);
      toast.success("已同步到云端");
    } catch {
      toast.error("同步失败");
    }
  }, [pushSnapshot]);

  const resolveUpload = useCallback(async (upload: boolean) => {
    if (!userIdRef.current) return;
    if (upload) {
      try {
        await pushSnapshot(readLocalSnapshot());
        setPending(null);
        setOutboundEnabled(true);
        toast.success("本机数据已上传到云端");
      } catch {
        toast.error("上传失败");
      }
      return;
    }
    markMeta({ userId: userIdRef.current });
    setPending(null);
    toast.message("已保留本机数据，暂不同步到云端");
  }, [markMeta, pushSnapshot]);

  const resolveConflict = useCallback(async (choice: "cloud" | "local" | "merge") => {
    if (!pending || pending.kind !== "conflict" || !userIdRef.current) return;
    try {
      if (choice === "cloud") {
        applyRemote(pending.cloudSnapshot);
        markMeta({
          userId: userIdRef.current,
          lastSyncedAt: pending.cloudSnapshot.updatedAt ?? new Date().toISOString(),
          dirty: false,
        });
        setOutboundEnabled(true);
        toast.success("已使用云端数据");
      } else if (choice === "local") {
        await pushSnapshot(readLocalSnapshot());
        setOutboundEnabled(true);
        toast.success("已用本机数据覆盖云端");
      } else {
        const merged = mergeSnapshots(readLocalSnapshot(), pending.cloudSnapshot);
        applyRemote(merged);
        await pushSnapshot(merged);
        setOutboundEnabled(true);
        toast.success("已合并本机与云端数据");
      }
      setPending(null);
    } catch {
      toast.error("处理同步冲突失败");
    }
  }, [applyRemote, markMeta, pending, pushSnapshot]);

  const value = useMemo<CloudSyncContextValue>(() => ({
    configured,
    user,
    loading,
    syncing,
    lastSyncedAt,
    error,
    pending,
    outboundEnabled,
    signIn,
    signUp,
    signOut,
    pushNow,
    resolveUpload,
    resolveConflict,
  }), [
    configured, user, loading, syncing, lastSyncedAt, error, pending, outboundEnabled,
    signIn, signUp, signOut, pushNow, resolveUpload, resolveConflict,
  ]);

  return <CloudSyncContext.Provider value={value}>{children}</CloudSyncContext.Provider>;
}

export function useCloudSync() {
  const ctx = useContext(CloudSyncContext);
  if (!ctx) {
    throw new Error("useCloudSync must be used within CloudSyncProvider");
  }
  return ctx;
}
