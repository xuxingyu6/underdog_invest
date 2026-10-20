import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { PricedHolding } from "@/hooks/use-priced-holdings";
import {
  aggregateStockSectors,
  formatShownSectorSum,
  sectorColor,
  sectorSliceLabel,
} from "@/lib/sector-allocation";
import { cn } from "@/lib/utils";

interface Props {
  priced: PricedHolding[];
}

export function SectorAllocation({ priced }: Props) {
  const allocation = useMemo(() => aggregateStockSectors(priced), [priced]);
  const { slices } = allocation;
  const shownSum = formatShownSectorSum(slices.map((slice) => slice.pct));
  const hasStocks = priced.some((row) => row?.type === "stock");

  return (
    <div className="min-w-0">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold shrink-0">板块配置</h3>
        {slices.length > 0 && (
          <p className="text-xs text-muted-foreground text-right leading-5">
            占股票总仓位 {shownSum} 的比重
          </p>
        )}
      </div>

      {slices.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          {hasStocks ? "股票市值为 0，暂时无法计算板块比重" : "暂无股票持仓"}
        </p>
      ) : (
        <>
          <div
            className="mt-4 flex h-12 w-full overflow-hidden rounded-full"
            role="img"
            aria-label={slices.map((slice) => sectorSliceLabel(slice.name, slice.pct)).join("，")}
          >
            {slices.map((slice, index) => (
              <SectorSegment
                key={slice.name}
                label={sectorSliceLabel(slice.name, slice.pct)}
                color={sectorColor(index)}
                weight={slice.marketValue}
              />
            ))}
          </div>

          <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
            {slices.map((slice, index) => (
              <li key={slice.name} className="flex items-center gap-2 min-w-0 text-sm">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                  style={{ backgroundColor: sectorColor(index) }}
                  aria-hidden
                />
                <span className="truncate">{sectorSliceLabel(slice.name, slice.pct)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function SectorSegment({
  label,
  color,
  weight,
}: {
  label: string;
  color: string;
  weight: number;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [showText, setShowText] = useState(false);

  useLayoutEffect(() => {
    const box = boxRef.current;
    const text = textRef.current;
    if (!box || !text) return;

    const update = () => {
      setShowText(text.scrollWidth <= box.clientWidth);
    };
    update();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", update);
      return () => window.removeEventListener("resize", update);
    }
    const observer = new ResizeObserver(update);
    observer.observe(box);
    return () => observer.disconnect();
  }, [label]);

  return (
    <div
      ref={boxRef}
      className="relative flex h-full min-w-0 items-center justify-center overflow-hidden"
      style={{ flexGrow: weight, flexBasis: 0, backgroundColor: color }}
      title={label}
    >
      <span
        ref={textRef}
        className="invisible absolute whitespace-nowrap px-3 text-sm font-medium"
        aria-hidden
      >
        {label}
      </span>
      <span
        className={cn(
          "absolute inset-0 flex items-center justify-center whitespace-nowrap px-3 text-sm font-medium text-white",
          showText ? "visible" : "invisible",
        )}
        style={{ textShadow: "0 1px 2px rgb(0 0 0 / 0.45)" }}
        aria-hidden={!showText}
      >
        {label}
      </span>
    </div>
  );
}
