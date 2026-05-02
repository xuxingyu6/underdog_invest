import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { AssetTypeBadge } from "@/components/AssetTypeBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { useStore } from "@/lib/store";
import { ASSET_TYPE_LABELS, type AssetType, type Action } from "@/lib/types";
import { formatMoney, formatQuantity, formatAvgCost, formatPercent, plClass } from "@/lib/format";
import { Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function Trades() {
  const trades = useStore((s) => s.trades);
  const holdings = useStore((s) => s.holdings);
  const deleteTrade = useStore((s) => s.deleteTrade);

  const sorted = [...trades].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt.localeCompare(a.createdAt)));

  return (
    <AppLayout
      title="交易记录"
      subtitle="买入卖出操作会自动更新对应持仓"
      actions={<TradeFormDialog holdings={holdings} />}
    >
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b border-border">
                <th className="px-6 py-3 font-medium">日期</th>
                <th className="px-4 py-3 font-medium">标的</th>
                <th className="px-4 py-3 font-medium">类型</th>
                <th className="px-4 py-3 font-medium">操作</th>
                <th className="px-4 py-3 font-medium text-right">数量</th>
                <th className="px-4 py-3 font-medium text-right">成交价</th>
                <th className="px-4 py-3 font-medium text-right">总金额</th>
                <th className="px-4 py-3 font-medium text-right">已实现盈亏</th>
                <th className="px-4 py-3 font-medium">备注</th>
                <th className="px-6 py-3 font-medium text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 && (
                <tr><td colSpan={10} className="px-6 py-12 text-center text-muted-foreground">暂无交易记录</td></tr>
              )}
              {sorted.map((t) => (
                <tr key={t.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                  <td className="px-6 py-3 font-mono text-xs">{t.date}</td>
                  <td className="px-4 py-3 font-medium">{t.symbol}</td>
                  <td className="px-4 py-3"><AssetTypeBadge type={t.type} /></td>
                  <td className={cn("px-4 py-3 font-medium", t.action === "buy" ? "text-profit" : "text-loss")}>
                    {t.action === "buy" ? "买入" : "卖出"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{formatQuantity(t.quantity)}</td>
                  <td className="px-4 py-3 text-right font-mono">{formatAvgCost(t.price, t.type)}</td>
                  <td className={cn("px-4 py-3 text-right font-mono", plClass(t.action === "buy" ? -1 : 1))}>
                    {formatMoney(t.quantity * t.price)}
                  </td>
                  <td className={cn("px-4 py-3 text-right font-mono", t.action === "sell" && t.realizedPnl !== undefined ? plClass(t.realizedPnl) : "")}>
                    {t.action === "sell" && t.realizedPnl !== undefined ? (
                      <>
                        <div>{formatMoney(t.realizedPnl)}</div>
                        {t.realizedPnlPct !== undefined && <div className="text-xs">{formatPercent(t.realizedPnlPct)}</div>}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{t.note}</td>
                  <td className="px-6 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <TradeFormDialog
                        initial={t}
                        holdings={holdings}
                        trigger={
                          <Button variant="ghost" size="icon" aria-label="编辑">
                            <Pencil className="w-4 h-4" />
                          </Button>
                        }
                      />
                      <Button variant="ghost" size="icon" onClick={() => { deleteTrade(t.id); toast.success("已删除"); }}>
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
    </AppLayout>
  );
}

function TradeFormDialog({ initial, holdings, trigger }: { initial?: import("@/lib/types").Trade; holdings: import("@/lib/types").Holding[]; trigger?: React.ReactNode }) {
  const addTrade = useStore((s) => s.addTrade);
  const updateTrade = useStore((s) => s.updateTrade);
  const [open, setOpen] = useState(false);
  const isEdit = !!initial;

  const [date, setDate] = useState(initial?.date ?? new Date().toISOString().slice(0, 10));
  const [symbol, setSymbol] = useState(initial?.symbol ?? "");
  const [type, setType] = useState<AssetType>(initial?.type ?? "stock");
  const [action, setAction] = useState<Action>(initial?.action ?? "buy");
  const [quantity, setQuantity] = useState(initial ? String(initial.quantity) : "");
  const [price, setPrice] = useState(initial ? String(initial.price) : "");
  const [note, setNote] = useState(initial?.note ?? "");

  const total = (parseFloat(quantity) || 0) * (parseFloat(price) || 0);

  const currentHolding = holdings.find(
    (h) => h.symbol.toLowerCase() === symbol.trim().toLowerCase() && h.type === type
  );

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = parseFloat(quantity);
    const p = parseFloat(price);
    if (!symbol.trim()) { toast.error("请输入标的"); return; }
    if (!isFinite(q) || q <= 0) { toast.error("请输入有效数量"); return; }
    if (!isFinite(p) || p <= 0) { toast.error("请输入有效价格"); return; }
    if (action === "sell" && currentHolding && q > currentHolding.quantity + 0.0000001) {
      toast.error(`卖出数量超过持仓数量（当前持仓 ${currentHolding.quantity}）`);
      return;
    }
    const payload = { date, symbol: symbol.toUpperCase(), type, action, quantity: q, price: p, note };
    if (isEdit && initial) {
      updateTrade(initial.id, payload);
      toast.success("已更新交易");
    } else {
      addTrade(payload);
      toast.success("已记录交易");
      setSymbol(""); setQuantity(""); setPrice(""); setNote("");
    }
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? <Button size="sm"><Plus className="w-4 h-4 mr-2" />添加交易</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{isEdit ? "编辑交易" : "添加交易"}</DialogTitle><DialogDescription>{isEdit ? "修改交易记录的价格、数量等信息" : "记录一笔新的买入或卖出交易"}</DialogDescription></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>日期</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>资产类型</Label>
              <Select value={type} onValueChange={(v) => setType(v as AssetType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(ASSET_TYPE_LABELS) as AssetType[]).filter((t) => t !== "cash").map((t) => (
                    <SelectItem key={t} value={t}>{ASSET_TYPE_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>标的代码</Label>
              <Input value={symbol} onChange={(e) => setSymbol(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>操作</Label>
              <Select value={action} onValueChange={(v) => setAction(v as Action)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="buy">买入</SelectItem>
                  <SelectItem value="sell">卖出</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {action === "sell" && currentHolding && (
            <div className="text-xs text-muted-foreground">
              当前持仓：<span className="font-mono">{currentHolding.quantity}</span> · 成本 <span className="font-mono">{formatAvgCost(currentHolding.avgCost, type)}</span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>数量</Label>
              <Input type="number" step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>成交价格 (USD)</Label>
              <Input type="number" step="any" value={price} onChange={(e) => setPrice(e.target.value)} required />
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            总金额：<span className="font-mono">{formatMoney(total)}</span>
          </div>
          <div className="space-y-2">
            <Label>备注</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>取消</Button>
            <Button type="submit">{isEdit ? "保存" : "添加"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
