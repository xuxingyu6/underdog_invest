import { useRef, useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useStore } from "@/lib/store";
import { getFinnhubKey, setFinnhubKey } from "@/lib/prices";
import { applyLocalSnapshot, readLocalSnapshot } from "@/lib/cloud-sync";
import { createPortfolioBackup, parsePortfolioBackup, snapshotCounts } from "@/lib/portfolio-snapshot";
import { getStoredTheme, setStoredTheme } from "@/hooks/use-theme";
import { AccountCard } from "@/components/AccountCard";
import { useCloudSync } from "@/hooks/use-cloud-sync";
import { Download, Upload, Trash2, Key } from "lucide-react";
import { toast } from "sonner";

export default function Settings() {
  const holdings = useStore((s) => s.holdings);
  const trades = useStore((s) => s.trades);
  const returns = useStore((s) => s.returns);
  const clearedHoldings = useStore((s) => s.clearedHoldings);
  const reset = useStore((s) => s.reset);
  const { user, outboundEnabled } = useCloudSync();

  const [apiKey, setApiKey] = useState("");
  useEffect(() => { setApiKey(getFinnhubKey()); }, []);

  const fileRef = useRef<HTMLInputElement>(null);

  const exportJson = () => {
    const data = createPortfolioBackup(readLocalSnapshot(), { theme: getStoredTheme() });
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `folio-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    const counts = snapshotCounts(data);
    toast.success(
      `已导出备份：${counts.holdings} 持仓 · ${counts.trades} 交易 · ${counts.clearedHoldings} 已清仓 · ${counts.returns} 收益`,
    );
  };

  const onImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const backup = parsePortfolioBackup(JSON.parse(await f.text()));
      applyLocalSnapshot(backup);
      if (backup.theme) setStoredTheme(backup.theme);
      toast.success("已导入数据，页面即将刷新");
      setTimeout(() => window.location.reload(), 800);
    } catch {
      toast.error("文件格式不正确");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const saveKey = () => {
    setFinnhubKey(apiKey.trim());
    toast.success("已保存 Finnhub API Key");
  };

  return (
    <AppLayout title="设置" subtitle="数据备份、云同步、API Key 与主题管理">
      <div className="grid lg:grid-cols-2 gap-6 max-w-5xl">
        <AccountCard />
        <Card title="数据备份" desc="导出/导入完整 JSON 备份文件，包含持仓、交易记录、已清仓、收益和价格历史。">
          <div className="flex flex-wrap gap-2">
            <Button onClick={exportJson} variant="outline">
              <Download className="w-4 h-4 mr-2" />导出 JSON
            </Button>
            <Button onClick={() => fileRef.current?.click()} variant="outline">
              <Upload className="w-4 h-4 mr-2" />导入 JSON
            </Button>
            <input ref={fileRef} type="file" accept="application/json" onChange={onImport} className="hidden" />
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            当前：{holdings.length} 个持仓 · {trades.length} 条交易 · {clearedHoldings.length} 条已清仓 · {returns.length} 条收益记录
          </p>
        </Card>

        <Card title="美股 API Key" desc="用于 Finnhub 实时报价（免费注册，每分钟 60 次）。Key 仅保存在浏览器本地。">
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5"><Key className="w-3.5 h-3.5" />Finnhub API Key</Label>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="粘贴你的 API Key"
              />
              <Button onClick={saveKey} className="sm:shrink-0">保存</Button>
            </div>
            <p className="text-xs text-muted-foreground">
              申请地址：<a href="https://finnhub.io/register" target="_blank" rel="noreferrer" className="underline hover:text-foreground">finnhub.io/register</a>
            </p>
          </div>
        </Card>

        <Card title="主题" desc="使用顶部右上角的图标切换亮色 / 暗色主题，默认亮色。">
          <p className="text-sm text-muted-foreground">主题选择会自动保存。</p>
        </Card>

        <Card
          title="重置数据"
          desc={
            user && outboundEnabled
              ? "清空本机数据，并在已登录时同步为空到云端。操作不可恢复，建议先导出备份。"
              : "清空所有本地数据，操作不可恢复，建议先导出备份。"
          }
        >
          <Button
            variant="destructive"
            onClick={() => {
              const message =
                user && outboundEnabled
                  ? "确定要清空本机和云端数据吗？此操作不可恢复。"
                  : "确定要清空所有数据吗？此操作不可恢复。";
              if (confirm(message)) {
                reset();
                toast.success("已重置");
              }
            }}
          >
            <Trash2 className="w-4 h-4 mr-2" />清空全部数据
          </Button>
        </Card>
      </div>
    </AppLayout>
  );
}

function Card({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 sm:p-6 min-w-0">
      <h3 className="font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground mt-1 mb-4">{desc}</p>
      {children}
    </div>
  );
}
