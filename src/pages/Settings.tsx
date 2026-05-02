import { useRef, useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useStore } from "@/lib/store";
import { getFinnhubKey, setFinnhubKey } from "@/lib/prices";
import { Download, Upload, Trash2, Key } from "lucide-react";
import { toast } from "sonner";

export default function Settings() {
  const holdings = useStore((s) => s.holdings);
  const trades = useStore((s) => s.trades);
  const returns = useStore((s) => s.returns);
  const importAll = useStore((s) => s.importAll);
  const reset = useStore((s) => s.reset);

  const [apiKey, setApiKey] = useState("");
  useEffect(() => { setApiKey(getFinnhubKey()); }, []);

  const fileRef = useRef<HTMLInputElement>(null);

  const exportJson = () => {
    const data = { holdings, trades, returns, exportedAt: new Date().toISOString(), version: 1 };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `folio-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("已导出备份文件");
  };

  const onImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const text = await f.text();
      const data = JSON.parse(text);
      if (!Array.isArray(data.holdings) || !Array.isArray(data.trades) || !Array.isArray(data.returns)) {
        throw new Error("invalid file");
      }
      importAll({ holdings: data.holdings, trades: data.trades, returns: data.returns });
      toast.success("已导入数据");
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
    <AppLayout title="设置" subtitle="数据备份、API Key 与主题管理">
      <div className="grid lg:grid-cols-2 gap-6 max-w-5xl">
        <Card title="数据备份" desc="导出/导入完整 JSON 备份文件，本地保存的所有持仓、交易和收益数据。">
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
            当前：{holdings.length} 个持仓 · {trades.length} 条交易 · {returns.length} 条收益记录
          </p>
        </Card>

        <Card title="美股 API Key" desc="用于 Finnhub 实时报价（免费注册，每分钟 60 次）。Key 仅保存在浏览器本地。">
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5"><Key className="w-3.5 h-3.5" />Finnhub API Key</Label>
            <div className="flex gap-2">
              <Input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="粘贴你的 API Key"
              />
              <Button onClick={saveKey}>保存</Button>
            </div>
            <p className="text-xs text-muted-foreground">
              申请地址：<a href="https://finnhub.io/register" target="_blank" rel="noreferrer" className="underline hover:text-foreground">finnhub.io/register</a>
            </p>
          </div>
        </Card>

        <Card title="主题" desc="使用顶部右上角的图标切换亮色 / 暗色主题，默认亮色。">
          <p className="text-sm text-muted-foreground">主题选择会自动保存。</p>
        </Card>

        <Card title="重置数据" desc="清空所有本地数据，操作不可恢复，建议先导出备份。">
          <Button
            variant="destructive"
            onClick={() => {
              if (confirm("确定要清空所有数据吗？此操作不可恢复。")) {
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
    <div className="bg-card border border-border rounded-xl p-6">
      <h3 className="font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground mt-1 mb-4">{desc}</p>
      {children}
    </div>
  );
}
