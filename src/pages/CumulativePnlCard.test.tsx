import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { formatPercent } from "@/lib/format";
import { CumulativePnlCard } from "@/pages/Holdings";
import type { CumulativePnl } from "@/lib/portfolio-pnl";

const sample: CumulativePnl = {
  unrealized: -870.07,
  unrealizedPct: (-870.07 / 16850.34) * 100,
  realized: 1158.89,
  total: 288.82,
  holdingCost: 16850.34,
  soldCost: 2410.96,
  investedCost: 19261.3,
  totalPct: 1.5,
};

const HINT =
  "累计盈亏 = 浮动盈亏（当前市值 − 持仓成本）+ 已实现盈亏（卖出部分）；百分比 = 累计盈亏 ÷ 总投入成本；浮动盈亏百分比 = 浮动盈亏 ÷ 当前持仓成本（与「持仓成本」相同）";

function renderCard(pnl: CumulativePnl) {
  return render(
    <TooltipProvider>
      <CumulativePnlCard pnl={pnl} />
    </TooltipProvider>,
  );
}

describe("CumulativePnlCard", () => {
  it("shows the total, percent pill, and the two split rows", () => {
    renderCard(sample);

    expect(screen.getByText("累计盈亏")).toBeInTheDocument();
    expect(screen.getByText("+$288.82")).toBeInTheDocument();
    expect(screen.getByText("+1.50%")).toBeInTheDocument();
    expect(screen.getByText("浮动盈亏")).toBeInTheDocument();
    expect(screen.getByText("-$870.07")).toBeInTheDocument();
    expect(screen.getByText("已实现盈亏")).toBeInTheDocument();
    expect(screen.getByText("+$1,158.89")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "累计盈亏说明" })).toHaveAccessibleDescription(HINT);
  });

  it("shows the floating P&L percent against current holding cost on the same row", () => {
    renderCard(sample);

    const floating = screen.getByText("浮动盈亏").closest("div");
    const floatingPct = formatPercent((sample.unrealized / sample.holdingCost) * 100);
    expect(floating).toHaveTextContent(`-$870.07 (${floatingPct})`);
    expect(floatingPct).toBe("-5.16%");
    expect(screen.getByText(`(${floatingPct})`)).toHaveClass("text-[11px]");
    expect(screen.getByText("-$870.07").parentElement).toHaveClass("text-loss");

    const realized = screen.getByText("已实现盈亏").closest("div");
    expect(realized).toHaveTextContent("+$1,158.89");
    expect(realized?.textContent).not.toMatch(/%/);
  });

  it("omits the floating percent when holding cost is zero and leaves realized as an amount", () => {
    renderCard({
      ...sample,
      unrealized: 25,
      unrealizedPct: null,
      realized: 40,
      total: 65,
      holdingCost: 0,
      soldCost: 10,
      investedCost: 10,
      totalPct: 650,
    });

    const floating = screen.getByText("浮动盈亏").closest("div");
    expect(floating).toHaveTextContent("+$25.00");
    expect(floating?.textContent).not.toMatch(/%/);

    const realized = screen.getByText("已实现盈亏").closest("div");
    expect(realized).toHaveTextContent("+$40.00");
    expect(realized?.textContent).not.toMatch(/%/);
  });
});
