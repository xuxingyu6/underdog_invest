import { describe, expect, it } from "vitest";
import {
  SECTOR_PALETTE,
  aggregateStockSectors,
  displayedSectorTenths,
  formatSectorPct,
  formatShownSectorSum,
  normalizeSector,
  sectorColor,
  sectorName,
  type SectorHoldingInput,
} from "./sector-allocation";

function row(
  type: string,
  marketValue: number,
  sector?: string,
): SectorHoldingInput {
  return { type, marketValue, sector };
}

describe("normalizeSector", () => {
  it("trims free text and treats blank values as missing", () => {
    expect(normalizeSector("  太空  ")).toBe("太空");
    expect(normalizeSector("")).toBeUndefined();
    expect(normalizeSector("   ")).toBeUndefined();
    expect(normalizeSector(null)).toBeUndefined();
    expect(sectorName(undefined)).toBe("未分类");
    expect(sectorName("  AI基建 ")).toBe("AI基建");
  });
});

describe("aggregateStockSectors", () => {
  it("weights stock sectors by market value and ignores crypto and cash", () => {
    const result = aggregateStockSectors([
      row("stock", 300, "太空"),
      row("stock", 247, "  太空 "),
      row("stock", 453, "AI基建"),
      row("crypto", 50_000, "太空"),
      row("cash", 20_000, "现金"),
      row("gold", 9_000, "黄金"),
      row("stock", 0, "半导体"),
      row("stock", Number.NaN, "半导体"),
    ]);

    expect(result.totalMarketValue).toBe(1000);
    expect(result.slices.map((slice) => slice.name)).toEqual(["太空", "AI基建"]);
    expect(result.slices[0].marketValue).toBe(547);
    expect(result.slices[0].pct).toBeCloseTo(54.7, 8);
    expect(result.slices[1].marketValue).toBe(453);
    expect(result.slices[1].pct).toBeCloseTo(45.3, 8);
    expect(result.slices.reduce((sum, slice) => sum + slice.pct, 0)).toBeCloseTo(100, 8);
  });

  it("groups a missing sector as 未分类 and sorts by weight", () => {
    const result = aggregateStockSectors([
      row("stock", 100, ""),
      row("stock", 50, "   "),
      row("stock", 400, "太空"),
      row("stock", 200),
    ]);

    expect(result.slices.map((slice) => [slice.name, slice.marketValue])).toEqual([
      ["太空", 400],
      ["未分类", 350],
    ]);
  });

  it("breaks equal weights by sector name", () => {
    const result = aggregateStockSectors([
      row("stock", 100, "太空"),
      row("stock", 100, "AI基建"),
    ]);
    const expected = ["太空", "AI基建"].sort((a, b) => a.localeCompare(b, "zh"));
    expect(result.slices.map((slice) => slice.name)).toEqual(expected);
    expect(result.slices.every((slice) => slice.pct === 50)).toBe(true);
  });

  it("returns an empty allocation when there is no positive stock market value", () => {
    expect(aggregateStockSectors(null)).toEqual({ slices: [], totalMarketValue: 0 });
    expect(aggregateStockSectors([])).toEqual({ slices: [], totalMarketValue: 0 });
    expect(aggregateStockSectors([row("crypto", 10, "太空"), row("stock", 0, "太空")])).toEqual({
      slices: [],
      totalMarketValue: 0,
    });
  });
});

describe("displayed sector weights", () => {
  it("formats each slice to one decimal and sums those shown labels", () => {
    expect(formatSectorPct(54.74)).toBe("54.7%");
    expect(formatSectorPct(45.26)).toBe("45.3%");
    expect(formatShownSectorSum([54.74, 45.26])).toBe("100%");

    const thirds = [100 / 3, 100 / 3, 100 / 3];
    expect(thirds.map((pct) => displayedSectorTenths(pct))).toEqual([333, 333, 333]);
    expect(formatShownSectorSum(thirds)).toBe("99.9%");
  });
});

describe("sectorColor", () => {
  it("assigns a distinct palette color to each of the first sectors", () => {
    const colors = SECTOR_PALETTE.map((_, index) => sectorColor(index));
    expect(new Set(colors).size).toBe(SECTOR_PALETTE.length);
    expect(sectorColor(SECTOR_PALETTE.length)).toBe(sectorColor(0));
    expect(sectorColor(-1)).toBe(sectorColor(1));
  });
});
