import { useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { AllocationPie } from "@/components/AllocationPie";
import { AssetTypeBadge } from "@/components/AssetTypeBadge";
import { HoldingFormDialog } from "@/components/HoldingFormDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { usePricedHoldings } from "@/hooks/use-priced-holdings";
import { useStore } from "@/lib/store";
import type { PricedHolding } from "@/hooks/use-priced-holdings";
import {
  formatMoney, formatNumber, formatPercent, formatStockPrice, formatCryptoPrice,
  formatSignedMoney, plClass, formatQuantity, formatAvgCost,
} from "@/lib/format";
import { Plus, RefreshCw, Pencil, Trash2, AlertCircle, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ASSET_TYPE_LABELS } from "@/lib/types";

function priceCellLabel(h: ReturnType<typeof usePricedHoldings>["priced"][number]) {
  if (h.type === "cash") return "—";
  if (h.type === "crypto") return formatCryptoPrice(h.currentPrice);
  return formatStockPrice(h.currentPrice);
}

function calcHoldingPeriod(firstDate: string, lastDate: string): string {
  const start = new Date(firstDate);
  const end = new Date(lastDate);
  const diffMs = end.getTime() - start.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return "当天";
  if (diffDays < 30) return `${diffDays}天`;
  const months = Math.floor(diffDays / 30);
  const remainingDays = diffDays % 30;
  if (months < 12) {
    return remainingDays > 0 ? `${months}个月零${remainingDays}天` : `${months}个月`;
  }
  const years = Math.floor(months / 12);
  const remMonths = months % 12;
  if (remMonths > 0) return `${years}年零${remMonths}个月`;
  return `${years}年`;
}

export default function Holdings() {
  const { priced, loading, lastFetch, refresh } = usePricedHoldings();
  const deleteHolding = useStore((s) => s.deleteHolding);
  const clearedHoldings = useStore((s) => s.clearedHoldings);
  const deleteClearedHolding = useStore((s) => s.deleteClearedHolding);
  const [activeTab, setActiveTab] = useState("current");

  const totals = useMemo(() => {
    const market = priced.reduce((s, h) => s + h.marketValue, 0);
    const cost = priced.reduce((s, h) => s + h.avgCost * h.quantity, 0);
    const pnl = market - cost;
    const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0;
    const cash = priced.filter((h) => h.type === "cash").reduce((s, h) => s + h.marketValue, 0);
    const cashRatio = market > 0 ? (cash / market) * 100 : 0;
    return { market, cost, pnl, pnlPct, cashRatio };
  }, [priced]);

  const cashTone =
    totals.cashRatio > 30 ? "text-muted-foreground"
    : totals.cashRatio < 10 ? "text-warning"
    : "text-profit";

  const lastFetchLabel = lastFetch
    ? `${new Date(lastFetch).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
    : "未刷新";

  return (
    <AppLayout
      title="持仓"
      subtitle="实时追踪你的资产配置和盈亏"
      actions={
        <>
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
            <RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} />
            刷新价格
          </Button>
          <HoldingFormDialog trigger={
            <Button size="sm"><Plus className="w-4 h-4 mr-2" />添加持仓</Button>
          } />
        </>
      }
    >
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
        <TabsList>
          <TabsTrigger value="current">当前持仓</TabsTrigger>
          <TabsTrigger value="cleared">已清仓 ({clearedHoldings.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="current" className="mt-6">
          {/* Top KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <KpiCard label="总资产市值" value={formatMoney(totals.market)} />
            <KpiCard label="持仓成本" value={formatMoney(totals.cost)} />
            <KpiCard
              label="累计盈亏"
              value={formatSignedMoney(totals.pnl)}
              sub={formatPercent(totals.pnlPct)}
              tone={totals.pnl >= 0 ? "profit" : "loss"}
            />
            <KpiCard
              label="现金比例"
              value={formatPercent(totals.cashRatio)}
              sub={
                totals.cashRatio > 30 ? "偏高" : totals.cashRatio < 10 ? "偏低" : "正常区间"
              }
              customValueClass={cashTone}
            />
          </div>

          {/* Allocation pie */}
          <div className="mb-6">
            <AllocationPie priced={priced} />
          </div>

          {/* Holdings table */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="font-semibold">持仓明细</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  上次刷新：{lastFetchLabel} · 每 60 秒自动更新
                </p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b border-border">
                    <th className="px-6 py-3 font-medium">标的</th>
                    <th className="px-4 py-3 font-medium">类型</th>
                    <th className="px-4 py-3 font-medium text-right">数量</th>
                    <th className="px-4 py-3 font-medium text-right">成本</th>
                    <th className="px-4 py-3 font-medium text-right">现价 / 24h</th>
                    <th className="px-4 py-3 font-medium text-right">市值</th>
                    <th className="px-4 py-3 font-medium text-right">浮动盈亏</th>
                    <th className="px-6 py-3 font-medium text-right">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {priced.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center text-muted-foreground">
                        暂无持仓 — 点击右上角「添加持仓」开始记录
                      </td>
                    </tr>
                  )}
                  {priced.map((h) => (
                    <tr key={h.id} className="border-b border-border last:border-0 hover:bg-muted/40 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-medium">{h.symbol}</div>
                        {h.name && <div className="text-xs text-muted-foreground">{h.name}</div>}
                      </td>
                      <td className="px-4 py-4"><AssetTypeBadge type={h.type} /></td>
                      <td className="px-4 py-4 text-right font-mono">{h.type === "cash" ? "—" : formatQuantity(h.quantity)}</td>
                      <td className="px-4 py-4 text-right font-mono">{h.type === "cash" ? "—" : formatAvgCost(h.avgCost, h.type)}</td>
                      <td className="px-4 py-4 text-right font-mono">
                        <div className="flex items-center justify-end gap-1.5">
                          {h.priceStale && h.type !== "cash" && (
                            <AlertCircle className="w-3.5 h-3.5 text-warning" aria-label="数据可能不是最新" />
                          )}
                          <span>{priceCellLabel(h)}</span>
                        </div>
                        {h.type !== "cash" && h.priceChange24h !== 0 && (
                          <div className={cn("text-xs mt-0.5", plClass(h.priceChange24h))}>
                            {formatPercent(h.priceChange24h)}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4 text-right font-mono font-medium">{formatMoney(h.marketValue)}</td>
                      <td className={cn("px-4 py-4 text-right font-mono", plClass(h.pnl))}>
                        {h.type === "cash" ? "—" : (
                          <>
                            <div>{formatSignedMoney(h.pnl)}</div>
                            <div className="text-xs">{formatPercent(h.pnlPct)}</div>
                          </>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {h.type !== "cash" && (
                            <SellFormDialog
                              holding={h}
                              trigger={
                                <Button variant="ghost" size="icon" aria-label="卖出" className="text-loss hover:text-loss">
                                  <TrendingDown className="w-4 h-4" />
                                </Button>
                              }
                            />
                          )}
                          <HoldingFormDialog
                            initial={h}
                            trigger={
                              <Button variant="ghost" size="icon" aria-label="编辑">
                                <Pencil className="w-4 h-4" />
                              </Button>
                            }
                          />
                          <Button
                            variant="ghost" size="icon" aria-label="删除"
                            onClick={() => {
                              deleteHolding(h.id);
                              toast.success(`已删除 ${h.symbol}`);
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-xs text-muted-foreground mt-4">
            美股价格来自 Finnhub（需在「设置」配置 API Key），加密货币来自 CoinGecko。
            资产类型支持：{Object.values(ASSET_TYPE_LABELS).join(" / ")}。
          </p>
        </TabsContent>

        <TabsContent value="cleared" className="mt-6">
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-border">
              <h3 className="font-semibold">已清仓记录</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                已清仓的标的不计入扇形图和总资产市值
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b border-border">
                    <th className="px-6 py-3 font-medium">标的</th>
                    <th className="px-4 py-3 font-medium">类型</th>
                    <th className="px-4 py-3 font-medium text-right">买入均价</th>
                    <th className="px-4 py-3 font-medium text-right">卖出均价</th>
                    <th className="px-4 py-3 font-medium text-right">持有数量</th>
                    <th className="px-4 py-3 font-medium text-right">持有周期</th>
                    <th className="px-4 py-3 font-medium text-right">总已实现盈亏</th>
                    <th className="px-6 py-3 font-medium text-right">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {clearedHoldings.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center text-muted-foreground">
                        暂无已清仓记录
                      </td>
                    </tr>
                  )}
                  {clearedHoldings.map((c) => (
                    <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                      <td className="px-6 py-4">
                        <div className="font-medium">{c.symbol}</div>
                        {c.name && <div className="text-xs text-muted-foreground">{c.name}</div>}
                      </td>
                      <td className="px-4 py-4"><AssetTypeBadge type={c.type} /></td>
                      <td className="px-4 py-4 text-right font-mono">{formatAvgCost(c.avgBuyCost, c.type)}</td>
                      <td className="px-4 py-4 text-right font-mono">{formatAvgCost(c.avgSellPrice, c.type)}</td>
                      <td className="px-4 py-4 text-right font-mono">{formatQuantity(c.totalQuantity)}</td>
                      <td className="px-4 py-4 text-right text-xs">{calcHoldingPeriod(c.firstBuyDate, c.lastSellDate)}</td>
                      <td className={cn("px-4 py-4 text-right font-mono", plClass(c.totalRealizedPnl))}>
                        <div>{formatSignedMoney(c.totalRealizedPnl)}</div>
                        <div className="text-xs">{formatPercent(c.totalRealizedPnlPct)}</div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button
                          variant="ghost" size="icon" aria-label="删除"
                          onClick={() => {
                            deleteClearedHolding(c.id);
                            toast.success(`已删除 ${c.symbol}`);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}

interface KpiProps {
  label: string;
  value: string;
  sub?: string;
  tone?: "profit" | "loss" | "neutral";
  customValueClass?: string;
}

function KpiCard({ label, value, sub, tone = "neutral", customValueClass }: KpiProps) {
  const toneCls =
    customValueClass ?? (tone === "profit" ? "text-profit" : tone === "loss" ? "text-loss" : "");
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn("text-2xl font-mono font-semibold mt-1", toneCls)}>{value}</div>
      {sub && <div className={cn("text-xs mt-1", toneCls)}>{sub}</div>}
    </div>
  );
}

function SellFormDialog({ holding, trigger }: { holding: PricedHolding; trigger?: React.ReactNode }) {
  const addTrade = useStore((s) => s.addTrade);
  const [open, setOpen] = useState(false);

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState(String(holding.currentPrice > 0 ? holding.currentPrice : holding.avgCost));
  const [note, setNote] = useState("");

  const total = (parseFloat(quantity) || 0) * (parseFloat(price) || 0);
  const maxQty = holding.quantity;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = parseFloat(quantity);
    const p = parseFloat(price);
    if (!isFinite(q) || q <= 0) { toast.error("请输入有效数量"); return; }
    if (!isFinite(p) || p <= 0) { toast.error("请输入有效价格"); return; }
    if (q > maxQty + 0.0000001) {
      toast.error(`卖出数量不能超过持仓数量（当前持仓 ${maxQty}）`);
      return;
    }
    addTrade({
      date,
      symbol: holding.symbol,
      type: holding.type,
      action: "sell",
      quantity: q,
      price: p,
      note,
    });
    toast.success(`已卖出 ${holding.symbol} × ${q}`);
    setQuantity("");
    setNote("");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? <Button variant="outline" size="sm">卖出</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>卖出 {holding.symbol}</DialogTitle>
          <DialogDescription>输入卖出数量和价格，系统将自动计算已实现盈亏</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="text-xs text-muted-foreground">
            当前持仓：<span className="font-mono font-medium">{formatQuantity(maxQty)}</span>
            {" · "}买入均价：<span className="font-mono">{formatAvgCost(holding.avgCost, holding.type)}</span>
          </div>
          <div className="space-y-2">
            <Label>卖出日期</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>卖出数量</Label>
              <Input
                type="number"
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder={`最大 ${maxQty}`}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>卖出价格 (USD)</Label>
              <Input type="number" step="any" value={price} onChange={(e) => setPrice(e.target.value)} required />
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            预计收入：<span className="font-mono">{formatMoney(total)}</span>
          </div>
          <div className="space-y-2">
            <Label>备注</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="如：止损、获利了结" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>取消</Button>
            <Button type="submit" className="bg-loss hover:bg-loss/90">确认卖出</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
