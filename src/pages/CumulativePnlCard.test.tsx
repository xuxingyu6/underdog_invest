import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CumulativePnlCard } from "@/pages/Holdings";
import type { CumulativePnl } from "@/lib/portfolio-pnl";

const sample: CumulativePnl = {
  unrealized: -870.07,
  realized: 1158.89,
  total: 288.82,
  holdingCost: 16850.34,
  soldCost: 2410.96,
  investedCost: 19261.3,
  totalPct: 1.5,
};

describe("CumulativePnlCard", () => {
  it("shows the total, percent pill, and the two split rows", () => {
    render(
      <TooltipProvider>
        <CumulativePnlCard pnl={sample} />
      </TooltipProvider>,
    );

    expect(screen.getByText("累计盈亏")).toBeInTheDocument();
    expect(screen.getByText("+$288.82")).toBeInTheDocument();
    expect(screen.getByText("+1.50%")).toBeInTheDocument();
    expect(screen.getByText("浮动盈亏")).toBeInTheDocument();
    expect(screen.getByText("-$870.07")).toBeInTheDocument();
    expect(screen.getByText("已实现盈亏")).toBeInTheDocument();
    expect(screen.getByText("+$1,158.89")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "累计盈亏说明" })).toHaveAccessibleDescription(
      "累计盈亏 = 浮动盈亏（当前市值 − 持仓成本）+ 已实现盈亏（卖出部分）；百分比 = 累计盈亏 ÷ 总投入成本",
    );
  });
});
