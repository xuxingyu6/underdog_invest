import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { getHistory } from "@/lib/priceHistory";
import { buildComputedReturns, type DailyPoint } from "@/lib/returns-engine";
import type { ScopeType } from "@/lib/types";

export type { DailyPoint };

function todayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function useComputedReturns(scope: ScopeType) {
  const trades = useStore((s) => s.trades);
  const holdings = useStore((s) => s.holdings);

  return useMemo(() => {
    const history = getHistory();
    return buildComputedReturns({
      trades,
      holdings,
      history,
      scope,
      today: todayKey(),
    });
  }, [trades, holdings, scope]);
}
