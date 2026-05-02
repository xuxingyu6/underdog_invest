import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { useStore } from "@/lib/store";
import { ASSET_TYPE_LABELS, type AssetType, type Holding } from "@/lib/types";
import { resolveCryptoId } from "@/lib/prices";
import { toast } from "sonner";

interface Props {
  trigger: React.ReactNode;
  initial?: Holding;
}

export function HoldingFormDialog({ trigger, initial }: Props) {
  const addHolding = useStore((s) => s.addHolding);
  const updateHolding = useStore((s) => s.updateHolding);
  const [open, setOpen] = useState(false);

  const [type, setType] = useState<AssetType>(initial?.type ?? "stock");
  const [symbol, setSymbol] = useState(initial?.symbol ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [quantity, setQuantity] = useState(String(initial?.quantity ?? ""));
  const [avgCost, setAvgCost] = useState(String(initial?.avgCost ?? ""));
  const [manualPrice, setManualPrice] = useState(String(initial?.manualPrice ?? ""));
  const [priceId, setPriceId] = useState(initial?.priceId ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  // Cash uses a single "amount" field for quantity, avgCost=1
  const [cashAmount, setCashAmount] = useState(String(initial?.quantity ?? ""));

  const isCash = type === "cash";
  const needsPrice = type === "gold" || type === "bond" || type === "other";

  const reset = () => {
    setType("stock"); setSymbol(""); setName("");
    setQuantity(""); setAvgCost(""); setManualPrice(""); setPriceId(""); setNote(""); setCashAmount("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isCash) {
      const amt = parseFloat(cashAmount);
      if (!isFinite(amt) || amt < 0) { toast.error("请输入有效金额"); return; }
      const payload = {
        symbol: symbol || "现金",
        name: name || "现金",
        type: "cash" as AssetType,
        quantity: amt,
        avgCost: 1,
        manualPrice: 1,
        note,
      };
      if (initial) updateHolding(initial.id, payload);
      else addHolding(payload);
    } else {
      const q = parseFloat(quantity);
      const a = parseFloat(avgCost);
      if (!symbol.trim()) { toast.error("请输入标的代码"); return; }
      if (!isFinite(q) || q <= 0) { toast.error("请输入有效数量"); return; }
      if (!isFinite(a) || a < 0) { toast.error("请输入有效成本"); return; }
      const mp = parseFloat(manualPrice);
      const payload = {
        symbol: symbol.toUpperCase(),
        name,
        type,
        quantity: q,
        avgCost: a,
        manualPrice: isFinite(mp) ? mp : undefined,
        priceId: type === "crypto" ? (priceId || resolveCryptoId(symbol)) : type === "stock" ? symbol.toUpperCase() : undefined,
        note,
      };
      if (initial) updateHolding(initial.id, payload);
      else addHolding(payload);
    }
    toast.success(initial ? "已更新持仓" : "已添加持仓");
    setOpen(false);
    if (!initial) reset();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? "编辑持仓" : "添加持仓"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>资产类型</Label>
            <Select value={type} onValueChange={(v) => setType(v as AssetType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(ASSET_TYPE_LABELS) as AssetType[]).map((t) => (
                  <SelectItem key={t} value={t}>{ASSET_TYPE_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isCash ? (
            <>
              <div className="space-y-2">
                <Label>名称（可选）</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="例：USD 现金" />
              </div>
              <div className="space-y-2">
                <Label>金额 (USD)</Label>
                <Input type="number" step="0.01" value={cashAmount} onChange={(e) => setCashAmount(e.target.value)} required />
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>标的代码</Label>
                  <Input value={symbol} onChange={(e) => setSymbol(e.target.value)} placeholder={type === "crypto" ? "BTC" : type === "stock" ? "AAPL" : "黄金"} required />
                </div>
                <div className="space-y-2">
                  <Label>名称（可选）</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="例：苹果" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>持仓数量</Label>
                  <Input type="number" step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>平均成本 (USD)</Label>
                  <Input type="number" step="any" value={avgCost} onChange={(e) => setAvgCost(e.target.value)} required />
                </div>
              </div>
              {needsPrice && (
                <div className="space-y-2">
                  <Label>当前价格 (USD)</Label>
                  <Input type="number" step="any" value={manualPrice} onChange={(e) => setManualPrice(e.target.value)} placeholder="手动录入" />
                </div>
              )}
              {type === "crypto" && (
                <div className="space-y-2">
                  <Label>CoinGecko ID（可选，留空自动匹配）</Label>
                  <Input value={priceId} onChange={(e) => setPriceId(e.target.value)} placeholder="bitcoin" />
                </div>
              )}
            </>
          )}

          <div className="space-y-2">
            <Label>备注</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>取消</Button>
            <Button type="submit">{initial ? "保存" : "添加"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
