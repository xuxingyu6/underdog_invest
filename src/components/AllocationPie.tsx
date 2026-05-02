import { useMemo, useState } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import type { PricedHolding } from "@/hooks/use-priced-holdings";
import { ASSET_TYPE_COLOR, ASSET_TYPE_LABELS, type AssetType } from "@/lib/types";
import { formatMoney, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Props {
  priced: PricedHolding[];
}

interface CategorySlice {
  type: AssetType;
  name: string;
  value: number;
  color: string;
  count: number;
  pct: number;
  displayPct: number;
}

const TYPE_ORDER: AssetType[] = ["stock", "crypto", "gold", "bond", "cash", "other"];

function largestRemainderMethod(rawPcts: { name: string; raw: number }[]): number[] {
  const floored = rawPcts.map((p) => ({ name: p.name, floor: Math.floor(p.raw), remainder: p.raw - Math.floor(p.raw) }));
  const sumFloored = floored.reduce((s, f) => s + f.floor, 0);
  const deficit = 100 - sumFloored;
  const sorted = [...floored].sort((a, b) => b.remainder - a.remainder);
  const adjusted = new Map<string, number>();
  floored.forEach((f) => adjusted.set(f.name, f.floor));
  for (let i = 0; i < deficit; i++) {
    const item = sorted[i % sorted.length];
    adjusted.set(item.name, (adjusted.get(item.name) ?? 0) + 1);
  }
  return rawPcts.map((p) => adjusted.get(p.name) ?? 0);
}

function renderExternalLabel(props: any) {
  const { cx, cy, midAngle, innerRadius, outerRadius, pct, index, name, value } = props;
  const displayPct = props.payload?.displayPct ?? Math.round(pct);
  if (displayPct < 5) return null;

  const RADIAN = Math.PI / 180;
  const outerR = outerRadius + 10;
  const labelR = outerRadius + 30;

  const midRad = -midAngle * RADIAN;
  const outerX = cx + outerR * Math.cos(midRad);
  const outerY = cy + outerR * Math.sin(midRad);
  const labelX = cx + labelR * Math.cos(midRad);
  const labelY = cy + labelR * Math.sin(midRad);

  const textAnchor = labelX > cx ? "start" : "end";

  return (
    <g>
      <line
        x1={outerX}
        y1={outerY}
        x2={labelX}
        y2={labelY}
        stroke="hsl(var(--muted-foreground))"
        strokeWidth={1}
        opacity={0.5}
      />
      <text
        x={labelX}
        y={labelY}
        fill="hsl(var(--foreground))"
        textAnchor={textAnchor}
        dominantBaseline="central"
        fontSize={12}
        fontWeight={500}
      >
        {`${name} ${displayPct}%`}
      </text>
    </g>
  );
}

export function AllocationPie({ priced }: Props) {
  const [activeType, setActiveType] = useState<AssetType | null>(null);

  const slices: CategorySlice[] = useMemo(() => {
    const total = TYPE_ORDER.reduce((s, t) => {
      const items = priced.filter((p) => p.type === t && p.marketValue > 0);
      return s + items.reduce((ss, p) => ss + p.marketValue, 0);
    }, 0);

    const raw = TYPE_ORDER
      .map((t) => {
        const items = priced.filter((p) => p.type === t && p.marketValue > 0);
        const value = items.reduce((s, p) => s + p.marketValue, 0);
        return {
          type: t,
          name: ASSET_TYPE_LABELS[t],
          value,
          color: ASSET_TYPE_COLOR[t],
          count: items.length,
          pct: total > 0 ? (value / total) * 100 : 0,
        };
      })
      .filter((s) => s.value > 0);

    const displayPcts = largestRemainderMethod(raw.map((s) => ({ name: s.name, raw: s.pct })));
    const displayMap = new Map<string, number>();
    raw.forEach((s, i) => displayMap.set(s.name, displayPcts[i]));

    return raw
      .map((s) => ({ ...s, displayPct: displayMap.get(s.name) ?? 0 }))
      .sort((a, b) => b.pct - a.pct);
  }, [priced]);

  const total = slices.reduce((s, x) => s + x.value, 0);
  const cellOpacity = (s: CategorySlice) => (activeType ? (s.type === activeType ? 1 : 0.25) : 0.95);
  const detail = activeType ? priced.filter((p) => p.type === activeType && p.marketValue > 0) : null;

  if (slices.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">
        暂无持仓数据，先添加几笔吧。
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="grid md:grid-cols-2 gap-6">
        <div className="h-72 relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={slices}
                dataKey="value"
                nameKey="name"
                innerRadius={70}
                outerRadius={110}
                paddingAngle={1}
                stroke="hsl(var(--card))"
                strokeWidth={2}
                onClick={(e: any) => {
                  const t = e?.payload?.type as AssetType | undefined;
                  setActiveType((cur) => (cur === t ? null : t ?? null));
                }}
                label={renderExternalLabel}
                labelLine={false}
              >
                {slices.map((s) => (
                  <Cell key={s.type} fill={s.color} fillOpacity={cellOpacity(s)} cursor="pointer" />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  color: "hsl(var(--popover-foreground))",
                  fontSize: 12,
                }}
                formatter={(value: number, _n: string, item: any) => {
                  const pct = total > 0 ? (value / total) * 100 : 0;
                  const c: CategorySlice = item.payload;
                  return [`${c.name} ${pct.toFixed(2)}%`, ""];
                }}
                labelFormatter={() => ""}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <div className="text-xs text-muted-foreground">总资产</div>
            <div className="text-xl font-mono font-semibold">{formatMoney(total)}</div>
          </div>
        </div>

        <div className="space-y-2 max-h-72 overflow-y-auto pr-2">
          {slices.map((s) => {
            const dim = activeType && s.type !== activeType;
            return (
              <button
                key={s.type}
                onClick={() => setActiveType((cur) => (cur === s.type ? null : s.type))}
                className={cn(
                  "w-full flex items-center justify-between text-left px-3 py-2 rounded-md transition-colors hover:bg-muted",
                  dim && "opacity-40",
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: s.color }} />
                  <span className="text-sm font-medium truncate">{s.name}</span>
                </div>
                <div className="font-mono text-sm shrink-0">
                  {s.displayPct}%
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-6 pt-6 border-t border-border">
        <div className="text-xs text-muted-foreground">总资产市值</div>
        <div className="text-2xl font-mono font-semibold mt-1">{formatMoney(total)}</div>
      </div>

      {detail && detail.length > 0 && (
        <div className="mt-6 pt-4 border-t border-border">
          <div className="text-sm font-medium mb-3">{ASSET_TYPE_LABELS[activeType!]} 明细</div>
          <div className="space-y-1.5">
            {detail.map((h) => {
              const pct = total > 0 ? (h.marketValue / total) * 100 : 0;
              return (
                <div key={h.id} className="flex justify-between text-sm font-mono">
                  <span className="truncate">{h.symbol}{h.name ? ` · ${h.name}` : ""}</span>
                  <span className="flex gap-3">
                    <span>{formatMoney(h.marketValue)}</span>
                    <span className="text-muted-foreground w-14 text-right">{formatPercent(pct)}</span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
