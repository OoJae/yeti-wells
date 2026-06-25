import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { useMyNft, useProject } from "../lib/queries";
import { TIER_LABELS } from "../config";
import { mistToSui, num, pct } from "../lib/format";

export function ImpactNftCard() {
  const { nft } = useMyNft();
  const { project } = useProject();

  if (!nft) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Your Impact NFT</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Donate to mint your soulbound Impact NFT. It fills with water as TEE-verified liters are delivered.
        </CardContent>
      </Card>
    );
  }

  const fill = pct(num(nft.litersAttributed), num(project?.targetLiters));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your Impact NFT</CardTitle>
      </CardHeader>
      <CardContent className="flex gap-5">
        {/* Simple water-fill jar; the animated SVG centerpiece lands in Phase 3. */}
        <div className="relative h-28 w-20 shrink-0 overflow-hidden rounded-b-xl rounded-t-md border-2 border-sui/40 bg-secondary/40">
          <div
            className="absolute bottom-0 left-0 w-full bg-sui/70 transition-all duration-700"
            style={{ height: `${Math.max(6, fill)}%` }}
          />
          <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold">
            {fill}%
          </div>
        </div>
        <div className="space-y-1 text-sm">
          <div className="text-lg font-semibold">
            {TIER_LABELS[nft.tier] ?? "Spring"}{" "}
            <span className="text-sm font-normal text-muted-foreground">· tier {nft.tier}</span>
          </div>
          <div className="text-muted-foreground">
            Donated: <span className="text-foreground">{mistToSui(nft.donatedMist)} SUI</span>
          </div>
          <div className="text-muted-foreground">
            Liters attributed:{" "}
            <span className="text-foreground">{num(nft.litersAttributed).toLocaleString()}</span>
          </div>
          <div className="text-muted-foreground">
            XP: <span className="text-foreground">{num(nft.xp).toLocaleString()}</span>
          </div>
          <div className="mt-2 inline-block rounded bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
            Soulbound · non-transferable
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
