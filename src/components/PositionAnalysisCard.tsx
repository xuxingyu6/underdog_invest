import { useMemo, useState } from "react";
import type { PricedHolding } from "@/hooks/use-priced-holdings";
import { ASSET_TYPE_COLOR, type AssetType } from "@/lib/types";
import { formatMoney } from "@/lib/format";
import {
  buildPositionAnalysis,
  collapseRows,
  type PositionRow,
} from "@/lib/position-analysis";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";

const MAX_ITEMS = 5;

function fmtPct(value: number): string {
  return isFinite(value) ? `${value.toFixed(2)}%` : "0.00%";
}

interface Props {
  type: Extract<AssetType, "stock" | "crypto">;
  priced: PricedHolding[];
}

export function PositionAnalysisCard({ type, priced }: Props) {
  const [expanded, setExpanded] = useState(false);
  const analysis = useMemo(() => buildPositionAnalysis(priced, type), [priced, type]);
  const collapsed = useMemo(
    () => collapseRows(analysis.assets, MAX_ITEMS, expanded),
    [analysis.assets, expanded],
  );

  const isStock = type === "stock";
  const title = isStock ? "美股仓位" : "加密货币仓位";
  const totalLabel = isStock ? "美股总资金" : "加密总资金";
  const assetLabel = isStock ? "股票" : "加密";
  const emptyText = isStock ? "暂无美股持仓" : "暂无加密货币持仓";
  const assetColor = ASSET_TYPE_COLOR[type];
  const cashColor = ASSET_TYPE_COLOR.cash;

  const hasAssets = analysis.assets.length > 0;
  const isEmpty = !hasAssets && analysis.cashValue <= 0;
  const cashRow: PositionRow = {
    key: "cash",
    label: "现金",
    marketValue: analysis.cashValue,
    pct: analysis.cashPct,
  };

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-start justify-between gap-4">
        <h3 className="font-semibold">{title}</h3>
        <div className="text-right">
          <div className="text-xs text-muted-foreground">{totalLabel}</div>
          <div className="text-xl font-mono font-semibold mt-0.5">
            {formatMoney(analysis.totalFunds)}
          </div>
        </div>
      </div>

      {isEmpty ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          {emptyText}
        </div>
      ) : (
        <>
          <p className="mt-5 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">
              {assetLabel}仓位 {fmtPct(analysis.assetPct)}
            </span>
            <span> · 现金 {fmtPct(analysis.cashPct)}</span>
          </p>

          <div className="mt-2.5 flex h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full"
              style={{ width: `${analysis.assetPct}%`, backgroundColor: assetColor }}
            />
            <div
              className="h-full"
              style={{ width: `${analysis.cashPct}%`, backgroundColor: cashColor }}
            />
          </div>

          <div className="mt-5 space-y-3.5">
            {collapsed.rows.map((row) => (
              <PositionRowView key={row.key} row={row} color={assetColor} />
            ))}
            <PositionRowView row={cashRow} color={cashColor} />
          </div>

          {collapsed.hasMore && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-3 w-full text-muted-foreground hover:text-foreground"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? (
                <>
                  <ChevronUp className="w-4 h-4 mr-1.5" />
                  收起
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4 mr-1.5" />
                  查看全部（{collapsed.hiddenCount}）
                </>
              )}
            </Button>
          )}
        </>
      )}
    </div>
  );
}

function PositionRowView({ row, color }: { row: PositionRow; color: string }) {
  const width = isFinite(row.pct) ? Math.max(0, Math.min(100, row.pct)) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0 flex items-baseline gap-2">
          <span className="text-sm font-medium truncate">{row.label}</span>
          {row.sublabel && (
            <span className="text-xs text-muted-foreground truncate">
              {row.sublabel}
            </span>
          )}
        </div>
        <div className="flex items-baseline gap-3 shrink-0">
          <span className="text-xs font-mono text-muted-foreground">
            {formatMoney(row.marketValue)}
          </span>
          <span className="text-sm font-mono font-medium w-[54px] text-right">
            {fmtPct(row.pct)}
          </span>
        </div>
      </div>
      <div className="mt-1.5 h-1 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${width}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}
