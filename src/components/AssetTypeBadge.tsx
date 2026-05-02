import { ASSET_TYPE_LABELS, type AssetType } from "@/lib/types";
import { cn } from "@/lib/utils";

const STYLES: Record<AssetType, string> = {
  stock: "bg-asset-stock/15 text-asset-stock border-asset-stock/30",
  crypto: "bg-asset-crypto/15 text-asset-crypto border-asset-crypto/30",
  gold: "bg-asset-gold/15 text-asset-gold border-asset-gold/30",
  bond: "bg-asset-bond/15 text-asset-bond border-asset-bond/30",
  cash: "bg-asset-cash/15 text-asset-cash border-asset-cash/30",
  other: "bg-muted text-muted-foreground border-border",
};

export function AssetTypeBadge({ type }: { type: AssetType }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border",
        STYLES[type],
      )}
    >
      {ASSET_TYPE_LABELS[type]}
    </span>
  );
}
