
import type { PricedHolding } from "@/hooks/use-priced-holdings";

/**
 * 计算指定日期的总收益和收益率
 * @param pricedHoldings - 包含实时价格的持仓列表
 * @returns 当天的总收益和收益率
 */
export function calculateDailyReturn(pricedHoldings: PricedHolding[]): { dailyReturn: number; dailyReturnRate: number } {
  if (!pricedHoldings || pricedHoldings.length === 0) {
    return { dailyReturn: 0, dailyReturnRate: 0 };
  }

  // 1. 计算当天的总收益 (Daily Return)
  // 每日收益 = Σ (每个持仓的24小时价格变化 * 数量)
  const dailyReturn = pricedHoldings.reduce((total, holding) => {
    // 现金没有价格变化
    if (holding.type === 'cash') {
      return total;
    }
    const priceChangeAmount = holding.priceChange24h * holding.quantity;
    return total + priceChangeAmount;
  }, 0);

  // 2. 计算昨天的总市值 (Previous Day's Total Market Value)
  // 昨天的市值 = 今天的市值 - 今天的价格变化
  const todayMarketValue = pricedHoldings.reduce((total, holding) => total + holding.marketValue, 0);
  const previousDayMarketValue = todayMarketValue - dailyReturn;

  // 3. 计算当天的收益率 (Daily Return Rate)
  // 收益率 = 当天收益 / 昨天收盘时的总市值
  const dailyReturnRate = previousDayMarketValue > 0 ? (dailyReturn / previousDayMarketValue) * 100 : 0;

  return { dailyReturn, dailyReturnRate };
}
