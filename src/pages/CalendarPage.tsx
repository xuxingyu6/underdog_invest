import { useState, useMemo } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import type { ScopeType } from "@/lib/types";
import { formatPercent, formatSignedMoney, heatColor, heatTextColor, plClass } from "@/lib/format";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { useComputedReturns, type DailyPoint } from "@/hooks/use-computed-returns";
import { usePricedHoldings } from "@/hooks/use-priced-holdings";
import { AssetTypeBadge } from "@/components/AssetTypeBadge";

const SCOPES: ScopeType[] = ["all", "stock", "crypto"];
const SCOPE_LABEL: Record<ScopeType, string> = { all: "全部", stock: "美股", crypto: "加密" };
const MONTH_NAMES = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];

export default function CalendarPage() {
  const [scope, setScope] = useState<ScopeType>("all");
  const [view, setView] = useState<"month" | "year">("month");
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const { dailyMap, monthMap } = useComputedReturns(scope);

  return (
    <AppLayout title="收益日历" subtitle="基于持仓与价格历史自动计算收益">
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Tabs value={scope} onValueChange={(v) => setScope(v as ScopeType)}>
          <TabsList>
            {SCOPES.map((s) => <TabsTrigger key={s} value={s}>{SCOPE_LABEL[s]}</TabsTrigger>)}
          </TabsList>
        </Tabs>

        <Tabs value={view} onValueChange={(v) => setView(v as "month" | "year")}>
          <TabsList>
            <TabsTrigger value="month">月度日历</TabsTrigger>
            <TabsTrigger value="year">年度概览</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="icon" className="min-h-11 min-w-11" aria-label="上一页" onClick={() => {
            if (view === "month") {
              if (month === 0) { setMonth(11); setYear(year - 1); } else setMonth(month - 1);
            } else setYear(year - 1);
          }}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="px-4 py-1.5 text-sm font-medium font-mono min-w-[120px] text-center">
            {view === "month" ? `${year} 年 ${MONTH_NAMES[month]}` : `${year} 年`}
          </div>
          <Button variant="outline" size="icon" className="min-h-11 min-w-11" aria-label="下一页" onClick={() => {
            if (view === "month") {
              if (month === 11) { setMonth(0); setYear(year + 1); } else setMonth(month + 1);
            } else setYear(year + 1);
          }}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {view === "month" ? (
        <MonthHeatmap year={year} month={month} dailyMap={dailyMap} scope={scope} />
      ) : (
        <YearHeatmap year={year} monthMap={monthMap} onSelectMonth={(m) => { setMonth(m); setView("month"); }} />
      )}

      <Legend className="mt-6" />
      <p className="text-xs text-muted-foreground mt-3">
        收益数据由「持仓」和「交易记录」结合每日价格快照自动计算。每次刷新价格会记录当日快照，无快照的日期显示为灰色。
      </p>
    </AppLayout>
  );
}

function MonthHeatmap({
  year, month, dailyMap, scope,
}: {
  year: number; month: number;
  dailyMap: Record<string, DailyPoint>;
  scope: ScopeType;
}) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const firstDay = new Date(year, month, 1);
  const startWeekday = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: ({ date: string; day: number } | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const mm = String(month + 1).padStart(2, "0");
    const dd = String(d).padStart(2, "0");
    cells.push({ date: `${year}-${mm}-${dd}`, day: d });
  }

  return (
    <TooltipProvider delayDuration={100}>
      <div className="bg-card border border-border rounded-xl p-3 sm:p-6">
        <div className="grid grid-cols-7 gap-1 sm:gap-1.5 text-xs text-muted-foreground mb-2">
          {["日", "一", "二", "三", "四", "五", "六"].map((w) => (
            <div key={w} className="text-center">{w}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
          {cells.map((c, i) => {
            if (!c) return <div key={i} className="h-12 sm:h-[96px]" />;
            const entry = dailyMap[c.date];
            const rate = entry?.rate;
            const fill = heatColor(rate);
            const textColor = heatTextColor(rate);
            return (
              <Tooltip key={i}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => entry && setSelectedDate(c.date)}
                    className={cn(
                      "h-12 sm:h-[96px] rounded-md sm:rounded-lg p-1 sm:p-2 flex flex-col overflow-hidden transition-all border border-border/50 min-w-0",
                      entry ? "cursor-pointer hover:shadow-md sm:hover:scale-[1.02]" : "cursor-default",
                    )}
                    style={{ backgroundColor: fill }}
                  >
                    <span className={cn(
                      "text-[10px] sm:text-[11px] font-mono self-start",
                      entry ? textColor : "text-muted-foreground",
                    )}>
                      {c.day}
                    </span>
                    {entry && (
                      <>
                        <div className={cn("hidden sm:block leading-tight text-center mt-auto", textColor)}>
                          <div className="text-xs font-mono font-medium">
                            {formatSignedMoney(entry.pnl, 2)}
                          </div>
                          <div className="text-[11px] font-mono">
                            {formatPercent(entry.rate, 2)}
                          </div>
                        </div>
                        <div className={cn("sm:hidden text-[9px] font-mono mt-auto leading-none truncate", textColor)}>
                          {formatPercent(entry.rate, 0)}
                        </div>
                      </>
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  <div className="font-mono">{c.date}</div>
                  {entry ? (
                    <div className={cn("font-mono mt-0.5", plClass(entry.pnl))}>
                      {formatSignedMoney(entry.pnl)} · {formatPercent(entry.rate)}
                    </div>
                  ) : (
                    <div className="text-muted-foreground">无数据</div>
                  )}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </div>

      <DayDetailDialog
        date={selectedDate}
        entry={selectedDate ? dailyMap[selectedDate] : undefined}
        scope={scope}
        onClose={() => setSelectedDate(null)}
      />
    </TooltipProvider>
  );
}

function DayDetailDialog({
  date, entry, scope, onClose,
}: {
  date: string | null;
  entry?: DailyPoint;
  scope: ScopeType;
  onClose: () => void;
}) {
  const { priced } = usePricedHoldings();

  const breakdown = useMemo(() => {
    if (!entry || !priced.length) return [];
    return priced
      .filter((h): h is NonNullable<typeof h> => !!h && h.type !== "cash" && h.marketValue > 0)
      .filter((h) => {
        if (scope === "all") return true;
        return h.type === scope;
      })
      .map((h) => ({
        symbol: h.symbol,
        name: h.name ?? "",
        type: h.type,
        quantity: h.quantity,
        avgCost: h.avgCost,
        currentPrice: h.currentPrice,
        pnl: (h.currentPrice - h.avgCost) * h.quantity,
        pnlPct: h.avgCost > 0 ? ((h.currentPrice - h.avgCost) / h.avgCost) * 100 : 0,
        marketValue: h.marketValue,
      }))
      .sort((a, b) => b.pnl - a.pnl);
  }, [entry, priced, scope]);

  if (!date || !entry) return null;

  return (
    <Dialog open={!!date} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="font-mono text-lg">{date}</DialogTitle>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
          <DialogDescription>当日各持仓的盈亏明细</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Summary */}
          <div className={cn(
            "rounded-lg p-4 text-center",
            plClass(entry.pnl),
            entry.pnl >= 0 ? "bg-green-50 dark:bg-green-950/30" : "bg-red-50 dark:bg-red-950/30",
          )}>
            <div className="text-2xl font-mono font-bold">
              {formatSignedMoney(entry.pnl, 2)}
            </div>
            <div className="text-sm font-mono mt-1">
              {formatPercent(entry.rate, 2)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              持仓市值 {formatSignedMoney(entry.marketValue, 2)}
            </div>
          </div>

          {/* Breakdown */}
          <div>
            <h4 className="text-sm font-medium mb-2">各标的盈亏</h4>
            <div className="space-y-2">
              {breakdown.map((item) => (
                <div key={item.symbol} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div className="flex items-center gap-2">
                    <AssetTypeBadge type={item.type} />
                    <div>
                      <div className="font-medium text-sm">{item.symbol}</div>
                      {item.name && <div className="text-xs text-muted-foreground">{item.name}</div>}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={cn("text-sm font-mono font-medium", plClass(item.pnl))}>
                      {formatSignedMoney(item.pnl, 2)}
                    </div>
                    <div className={cn("text-xs font-mono", plClass(item.pnlPct))}>
                      {formatPercent(item.pnlPct, 2)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function YearHeatmap({
  year, monthMap, onSelectMonth,
}: {
  year: number;
  monthMap: Record<string, { rate: number; pnl: number; days: number }>;
  onSelectMonth: (m: number) => void;
}) {
  return (
    <TooltipProvider delayDuration={100}>
      <div className="bg-card border border-border rounded-xl p-3 sm:p-6">
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-3">
          {Array.from({ length: 12 }).map((_, m) => {
            const key = `${year}-${String(m + 1).padStart(2, "0")}`;
            const entry = monthMap[key];
            const rate = entry?.rate;
            return (
              <Tooltip key={m}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onSelectMonth(m)}
                    className="aspect-[4/3] rounded-lg p-3 text-left flex flex-col justify-between transition-transform hover:scale-105 border border-border/50"
                    style={{ backgroundColor: heatColor(rate) }}
                  >
                    <span className={cn("text-sm font-medium", entry ? "text-white/95" : "text-muted-foreground")}>
                      {MONTH_NAMES[m]}
                    </span>
                    {entry ? (
                      <span className="text-base font-mono font-semibold text-white/95">
                        {formatPercent(rate!, 2)}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">无数据</span>
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  <div className="font-mono">{year} 年 {MONTH_NAMES[m]}</div>
                  {entry ? (
                    <>
                      <div className={cn("font-mono mt-0.5", plClass(entry.rate))}>
                        {formatSignedMoney(entry.pnl)} · {formatPercent(entry.rate)}
                      </div>
                      <div className="text-muted-foreground mt-0.5">{entry.days} 个交易日</div>
                    </>
                  ) : (
                    <div className="text-muted-foreground">无数据</div>
                  )}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </div>
    </TooltipProvider>
  );
}

function Legend({ className }: { className?: string }) {
  const items: { label: string; color: string }[] = [
    { label: "大涨 > +5%", color: "hsl(var(--heat-up-strong))" },
    { label: "中涨 +1%~5%", color: "hsl(var(--heat-up-mid))" },
    { label: "小涨 0%~1%", color: "hsl(var(--heat-up-mild))" },
    { label: "小跌 0%~-1%", color: "hsl(var(--heat-down-mild))" },
    { label: "中跌 -1%~-5%", color: "hsl(var(--heat-down-mid))" },
    { label: "大跌 < -5%", color: "hsl(var(--heat-down-strong))" },
    { label: "无数据", color: "hsl(var(--heat-empty))" },
  ];
  return (
    <div className={cn("flex flex-wrap items-center gap-3 text-xs text-muted-foreground", className)}>
      {items.map((it) => (
        <div key={it.label} className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm border border-border/50" style={{ backgroundColor: it.color }} />
          <span>{it.label}</span>
        </div>
      ))}
    </div>
  );
}
