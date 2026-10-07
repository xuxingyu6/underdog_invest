import type { Trade } from "@/lib/types";

export interface CumulativePnl {
  /** 浮动盈亏：当前持仓市值 − 当前持仓成本 */
  unrealized: number;
  /**
   * 浮动盈亏 / 当前持仓成本，百分数。
   * 分母与「持仓成本」卡片相同。持仓成本不大于 0 时为 null，界面不显示百分比。
   */
  unrealizedPct: number | null;
  /** 已实现盈亏：全部卖出交易的 realizedPnl 之和 */
  realized: number;
  /** 累计盈亏 = 浮动盈亏 + 已实现盈亏 */
  total: number;
  /** 当前持仓成本，与「持仓成本」卡片相同 */
  holdingCost: number;
  /** 已卖出份额的成本 = Σ (卖出成交额 − 该笔已实现盈亏) */
  soldCost: number;
  /**
   * 总投入成本 = 当前持仓成本 + 已卖出份额的成本。
   * 累计盈亏比例 = 累计盈亏 / 总投入成本。
   */
  investedCost: number;
  /** 累计盈亏 / 总投入成本，百分数。总成本为 0 时为 0。 */
  totalPct: number;
}

/**
 * 累计盈亏.
 *
 * 浮动盈亏 = 当前持仓市值 − 当前持仓成本.
 * 当前持仓成本与「持仓成本」卡片相同（各持仓 avgCost × 数量，含现金）。
 * 现金的市值与成本相等，浮动盈亏为 0。
 *
 * 已实现盈亏 = 所有 action 为 sell 的交易的 realizedPnl 之和。
 * 这包含部分卖出和已清仓。已卖出页的总已实现盈亏也是这些交易的合计，
 * 因此这里按交易求和，不会把剩余持仓再算一遍。
 * 缺少或非有限的 realizedPnl 按 0 计。
 *
 * 已卖出份额的成本 = Σ (price × quantity − realizedPnl)，
 * 即该笔卖出当时使用的成本。只有 realizedPnl 为有限数时才计入，
 * 避免把未知成本当成成交额。
 *
 * 累计盈亏 = 浮动盈亏 + 已实现盈亏.
 * 累计盈亏比例 = 累计盈亏 / (当前持仓成本 + 已卖出份额的成本).
 * 浮动盈亏比例 = 浮动盈亏 / 当前持仓成本，不含已卖出份额的成本.
 * 当前持仓成本不大于 0 时不计算浮动盈亏比例.
 */
export function computeCumulativePnl({
  marketValue,
  holdingCost,
  trades,
}: {
  marketValue: number;
  holdingCost: number;
  trades: Pick<Trade, "action" | "price" | "quantity" | "realizedPnl">[];
}): CumulativePnl {
  const unrealized = marketValue - holdingCost;
  let realized = 0;
  let soldCost = 0;

  for (const trade of trades) {
    if (trade.action !== "sell") continue;
    const proceeds = trade.quantity * trade.price;
    const pnl = trade.realizedPnl;
    if (typeof pnl === "number" && Number.isFinite(pnl) && Number.isFinite(proceeds)) {
      realized += pnl;
      soldCost += proceeds - pnl;
    }
  }

  const total = unrealized + realized;
  const investedCost = holdingCost + soldCost;
  const totalPct = investedCost > 0 ? (total / investedCost) * 100 : 0;
  const unrealizedRatio = holdingCost > 0 ? (unrealized / holdingCost) * 100 : null;
  const unrealizedPct = unrealizedRatio != null && Number.isFinite(unrealizedRatio) ? unrealizedRatio : null;

  return {
    unrealized,
    unrealizedPct,
    realized,
    total,
    holdingCost,
    soldCost,
    investedCost,
    totalPct,
  };
}
