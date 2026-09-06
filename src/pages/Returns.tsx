import { useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { useStore } from "@/lib/store";
import type { PeriodType, ScopeType } from "@/lib/types";
import { formatPercent, plClass } from "@/lib/format";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from "recharts";
import { cn } from "@/lib/utils";

const SCOPE_LABEL: Record<ScopeType, string> = { stock: "美股", crypto: "加密", all: "全部" };
const PERIOD_LABEL: Record<PeriodType, string> = { day: "日", week: "周", month: "月", year: "年" };

export default function Returns() {
  const returns = useStore((s) => s.returns);
  const deleteReturn = useStore((s) => s.deleteReturn);
  const [scope, setScope] = useState<ScopeType>("all");

  // Monthly chart data (latest 24 months)
  const monthly = useMemo(() => {
    const arr = returns
      .filter((r) => r.period === "month" && r.scope === scope)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-24)
      .map((r) => ({ label: r.date, rate: r.rate, note: r.note }));
    return arr;
  }, [returns, scope]);

  // Year data: prefer recorded year entries, otherwise compound from months in that year
  const yearly = useMemo(() => {
    // gather years from existing year/month records
    const years = new Set<string>();
    returns.forEach((r) => {
      if (r.scope !== scope) return;
      if (r.period === "year") years.add(r.date);
      if (r.period === "month") years.add(r.date.slice(0, 4));
    });
    const out: { label: string; rate: number; computed: boolean }[] = [];
    Array.from(years).sort().forEach((y) => {
      const explicit = returns.find((r) => r.scope === scope && r.period === "year" && r.date === y);
      if (explicit) {
        out.push({ label: y, rate: explicit.rate, computed: false });
      } else {
        const months = returns.filter((r) => r.scope === scope && r.period === "month" && r.date.startsWith(y));
        if (months.length === 0) return;
        const factor = months.reduce((acc, m) => acc * (1 + m.rate / 100), 1);
        out.push({ label: y, rate: (factor - 1) * 100, computed: true });
      }
    });
    return out;
  }, [returns, scope]);

  const list = [...returns].filter((r) => r.scope === scope).sort((a, b) => b.date.localeCompare(a.date));

  return (
    <AppLayout
      title="收益率"
      subtitle="录入并可视化每日 / 周 / 月 / 年的收益率"
      actions={<ReturnFormDialog />}
    >
      <Tabs value={scope} onValueChange={(v) => setScope(v as ScopeType)} className="mb-6">
        <TabsList>
          <TabsTrigger value="all">全部</TabsTrigger>
          <TabsTrigger value="stock">美股</TabsTrigger>
          <TabsTrigger value="crypto">加密</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <ChartCard title="月度收益率（最近 24 个月）" data={monthly} />
        <ChartCard title="年度收益率（自动复利）" data={yearly.map(y => ({ label: y.label, rate: y.rate }))} hint="未录入年度数据时由当年月度复利得出" />
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h3 className="font-semibold">收益记录</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b border-border whitespace-nowrap">
                <th className="px-6 py-3 font-medium">周期</th>
                <th className="px-4 py-3 font-medium">日期/标签</th>
                <th className="px-4 py-3 font-medium">范围</th>
                <th className="px-4 py-3 font-medium text-right">收益率</th>
                <th className="px-4 py-3 font-medium">备注</th>
                <th className="px-6 py-3 font-medium text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 && (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">暂无记录</td></tr>
              )}
              {list.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                  <td className="px-6 py-3">{PERIOD_LABEL[r.period]}</td>
                  <td className="px-4 py-3 font-mono text-xs">{r.date}</td>
                  <td className="px-4 py-3">{SCOPE_LABEL[r.scope]}</td>
                  <td className={cn("px-4 py-3 text-right font-mono font-medium", plClass(r.rate))}>
                    {formatPercent(r.rate)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{r.note}</td>
                  <td className="px-6 py-3 text-right">
                    <Button variant="ghost" size="icon" onClick={() => { deleteReturn(r.id); toast.success("已删除"); }}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
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

function ChartCard({
  title, data, hint,
}: { title: string; data: { label: string; rate: number; note?: string }[]; hint?: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 sm:p-5">
      <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1 mb-2">
        <h3 className="font-semibold">{title}</h3>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      <div className="h-64">
        {data.length === 0 ? (
          <div className="h-full grid place-items-center text-sm text-muted-foreground">暂无数据</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
              <Tooltip
                cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
                contentStyle={{
                  background: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(v: number) => [`${v.toFixed(2)}%`, "收益率"]}
              />
              <ReferenceLine y={0} stroke="hsl(var(--border))" />
              <Bar dataKey="rate" radius={[4, 4, 0, 0]}>
                {data.map((d, i) => (
                  <Cell key={i} fill={d.rate >= 0 ? "hsl(var(--profit))" : "hsl(var(--loss))"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function ReturnFormDialog() {
  const addReturn = useStore((s) => s.addReturn);
  const [open, setOpen] = useState(false);

  const [period, setPeriod] = useState<PeriodType>("day");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [scope, setScope] = useState<ScopeType>("all");
  const [rate, setRate] = useState("");
  const [note, setNote] = useState("");

  // Date input shape based on period
  const dateInputType = period === "day" ? "date" : period === "month" ? "month" : "text";
  const datePlaceholder =
    period === "week" ? "2025-W18" : period === "year" ? "2025" : undefined;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const r = parseFloat(rate);
    if (!isFinite(r)) { toast.error("请输入有效收益率"); return; }
    if (!date.trim()) { toast.error("请输入日期/周期标签"); return; }
    addReturn({ period, date: date.trim(), scope, rate: r, note });
    toast.success("已保存");
    setRate(""); setNote("");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="min-h-11 md:min-h-9"><Plus className="w-4 h-4 mr-2" />添加收益率</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>录入收益率</DialogTitle>
          <DialogDescription>记录指定周期的收益率数据</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>周期</Label>
              <Select value={period} onValueChange={(v) => setPeriod(v as PeriodType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">日</SelectItem>
                  <SelectItem value="week">周</SelectItem>
                  <SelectItem value="month">月</SelectItem>
                  <SelectItem value="year">年</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>资产范围</Label>
              <Select value={scope} onValueChange={(v) => setScope(v as ScopeType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="stock">美股</SelectItem>
                  <SelectItem value="crypto">加密</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>{period === "year" ? "年份（如 2025）" : period === "week" ? "周标签（如 2025-W18）" : period === "month" ? "月份" : "日期"}</Label>
            <Input
              type={dateInputType}
              value={date}
              placeholder={datePlaceholder}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>收益率（%，正负皆可）</Label>
            <Input type="number" step="any" value={rate} onChange={(e) => setRate(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>备注</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>取消</Button>
            <Button type="submit">保存</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
