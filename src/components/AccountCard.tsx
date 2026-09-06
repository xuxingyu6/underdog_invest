import { useEffect, useState } from "react";
import { Cloud, CloudOff, Loader2, LogOut, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCloudSync } from "@/hooks/use-cloud-sync";
import { toast } from "sonner";

function formatSyncedAt(iso: string | null): string {
  if (!iso) return "尚未同步";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "尚未同步";
  return date.toLocaleString("zh-CN", { hour12: false });
}

function countsText(counts: { holdings: number; trades: number; returns: number }) {
  return `${counts.holdings} 个持仓 · ${counts.trades} 条交易 · ${counts.returns} 条收益`;
}

export function AccountCard() {
  const {
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
  } = useCloudSync();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(Boolean(pending));

  useEffect(() => {
    if (pending) setDialogOpen(true);
  }, [pending]);

  const submit = async (mode: "in" | "up") => {
    const trimmed = email.trim();
    if (!trimmed || !password) {
      toast.error("请输入邮箱和密码");
      return;
    }
    setBusy(true);
    try {
      if (mode === "in") await signIn(trimmed, password);
      else await signUp(trimmed, password);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "登录失败");
    } finally {
      setBusy(false);
    }
  };

  let status = "未登录（仅本机）";
  if (!configured) status = "未配置";
  else if (loading) status = "正在连接…";
  else if (user && pending) status = "待确认（尚未覆盖任何数据）";
  else if (user && syncing) status = "同步中…";
  else if (user && error) status = "同步失败，本机缓存仍可用";
  else if (user && outboundEnabled) status = "已登录，写入会同步到云端";
  else if (user) status = "已登录";

  return (
    <div className="bg-card border border-border rounded-xl p-6 lg:col-span-2">
      <h3 className="font-semibold flex items-center gap-2">
        {configured ? <Cloud className="w-4 h-4" /> : <CloudOff className="w-4 h-4" />}
        账号与云同步
      </h3>
      <p className="text-sm text-muted-foreground mt-1 mb-4">
        登录后持仓会备份到云端；退出或未配置时，仍使用浏览器本地存储。
      </p>

      {!configured && (
        <p className="text-sm text-muted-foreground">
          尚未设置 <code className="text-xs">VITE_SUPABASE_URL</code> 与{" "}
          <code className="text-xs">VITE_SUPABASE_ANON_KEY</code>。配置后即可在多设备间恢复数据。
        </p>
      )}

      {configured && !user && (
        <div className="space-y-3 max-w-md">
          <div className="space-y-1.5">
            <Label htmlFor="account-email">邮箱</Label>
            <Input
              id="account-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="account-password">密码</Label>
            <Input
              id="account-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="至少 6 位"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void submit("in")} disabled={busy || loading}>
              {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              登录
            </Button>
            <Button variant="outline" onClick={() => void submit("up")} disabled={busy || loading}>
              注册
            </Button>
          </div>
        </div>
      )}

      {configured && user && (
        <div className="space-y-3">
          <p className="text-sm">
            当前账号：<span className="font-medium">{user.email}</span>
          </p>
          <p className="text-sm text-muted-foreground">状态：{status}</p>
          <p className="text-sm text-muted-foreground">上次同步：{formatSyncedAt(lastSyncedAt)}</p>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void pushNow()} disabled={syncing || loading}>
              {syncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              立即同步
            </Button>
            {pending && (
              <Button variant="outline" onClick={() => setDialogOpen(true)}>
                处理本机数据
              </Button>
            )}
            <Button variant="outline" onClick={() => void signOut()}>
              <LogOut className="w-4 h-4 mr-2" />
              退出登录
            </Button>
          </div>
        </div>
      )}

      <Dialog
        open={Boolean(pending) && dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
        }}
      >
        <DialogContent>
          {pending?.kind === "upload" && (
            <>
              <DialogHeader>
                <DialogTitle>上传本机数据到云端？</DialogTitle>
                <DialogDescription>
                  首次登录，云端还是空的。本机现有 {countsText(pending.local)}。不会自动清空本机数据。
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => void resolveUpload(false)}>
                  暂不上传
                </Button>
                <Button onClick={() => void resolveUpload(true)}>上传到云端</Button>
              </DialogFooter>
            </>
          )}
          {pending?.kind === "conflict" && (
            <>
              <DialogHeader>
                <DialogTitle>本机与云端都有数据</DialogTitle>
                <DialogDescription>
                  请选择如何处理，避免误覆盖。本机：{countsText(pending.local)}。云端：{countsText(pending.cloud)}。
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="sm:justify-start flex-wrap gap-2">
                <Button onClick={() => void resolveConflict("cloud")}>使用云端</Button>
                <Button variant="outline" onClick={() => void resolveConflict("local")}>
                  上传本机并覆盖云端
                </Button>
                <Button variant="outline" onClick={() => void resolveConflict("merge")}>
                  合并
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
