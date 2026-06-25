import { useEffect, useRef, useState } from "react";
import { useCurrentAccount, useSuiClientQuery } from "@mysten/dapp-kit";
import { useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, Share2, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { WaterGlobe } from "./WaterGlobe";
import { useMyNft, useProject } from "../lib/queries";
import { useSyncImpact } from "../lib/useSyncImpact";
import { computeImpact, tierRange } from "../lib/impact";
import { config, TIER_LABELS } from "../config";
import { mistToSui } from "../lib/format";

function TierBar({ percent }: { percent: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
      <div className="h-full rounded-full bg-sui transition-all duration-700" style={{ width: `${percent}%` }} />
    </div>
  );
}

/** Latest TEE attestation tx for the project, for the "Verified by TEE" link. */
function useLatestAttestation() {
  const q = useSuiClientQuery(
    "queryEvents",
    {
      query: { MoveEventType: `${config.packageId}::events::MilestoneAttested` },
      limit: 1,
      order: "descending",
    },
    { refetchInterval: 8000 },
  );
  return q.data?.data?.[0]?.id?.txDigest as string | undefined;
}

export function ImpactNftCard() {
  const account = useCurrentAccount();
  const { nft } = useMyNft();
  const { project } = useProject();
  const syncImpact = useSyncImpact();
  const qc = useQueryClient();
  const attestationTx = useLatestAttestation();

  const [syncing, setSyncing] = useState(false);
  const lastKey = useRef("");

  // Auto-sync: when the on-chain NFT lags the computed truth (just donated, or delivered liters grew),
  // run a silent sponsored sync_impact once per (nft, delivered, raised). This is the "water rises" magic.
  useEffect(() => {
    if (!nft || !project || !account) return;
    const computed = computeImpact(project, nft.donatedMist);
    const key = `${nft.id}:${project.deliveredLiters}:${project.raisedMist}`;
    if (computed.attributed !== BigInt(nft.litersAttributed) && lastKey.current !== key) {
      lastKey.current = key;
      setSyncing(true);
      syncImpact(nft.id)
        .then(() => qc.invalidateQueries())
        .catch(() => {
          lastKey.current = ""; // allow retry on failure
        })
        .finally(() => setSyncing(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nft?.id, nft?.litersAttributed, project?.deliveredLiters, project?.raisedMist, account?.address]);

  // Signed-out / before first donation: show the empty globe.
  if (!nft || !project) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Your Impact NFT</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-3 py-4">
          <div className="yw-globe-glow rounded-full">
            <WaterGlobe fillPercent={0} tier={0} size={200} />
          </div>
          <p className="text-center text-sm text-muted-foreground">
            Sign in &amp; donate to mint your soulbound globe — it fills with water as TEE-verified liters are delivered.
          </p>
        </CardContent>
      </Card>
    );
  }

  const c = computeImpact(project, nft.donatedMist);
  const { to } = tierRange(c.tier);
  const shareText = `I'm funding verifiable clean water with Yeti Wells on Sui — ${Number(c.attributed).toLocaleString()} liters delivered on my behalf, proven by a TEE. 🧊💧`;
  const shareHref = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(window.location.origin)}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Your Impact NFT</span>
          {syncing && (
            <span className="flex items-center gap-1 text-xs font-normal text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> syncing
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col items-center gap-2">
          <div key={Math.round(c.fillPercent)} className="yw-globe-glow yw-pop rounded-full">
            <WaterGlobe fillPercent={c.fillPercent} tier={c.tier} size={208} />
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold tabular-nums text-sui">{c.fillPercent}%</div>
            <div className="text-xs text-muted-foreground">filled with verified water</div>
          </div>
        </div>

        {/* Tier + XP */}
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between">
            <span className="text-lg font-semibold">{c.tierLabel}</span>
            <span className="text-xs text-muted-foreground">
              {to === null ? "Max tier" : `Next: ${TIER_LABELS[c.tier + 1]} at ${to.toLocaleString()} XP`}
            </span>
          </div>
          <TierBar percent={c.tierProgressPercent} />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg border bg-card/50 p-2">
            <div className="text-sm font-semibold tabular-nums">{mistToSui(nft.donatedMist)}</div>
            <div className="text-[10px] text-muted-foreground">SUI donated</div>
          </div>
          <div className="rounded-lg border bg-card/50 p-2">
            <div className="text-sm font-semibold tabular-nums text-sui">{Number(c.attributed).toLocaleString()}</div>
            <div className="text-[10px] text-muted-foreground">liters attributed</div>
          </div>
          <div className="rounded-lg border bg-card/50 p-2">
            <div className="text-sm font-semibold tabular-nums">{Number(c.xp).toLocaleString()}</div>
            <div className="text-[10px] text-muted-foreground">XP</div>
          </div>
        </div>

        {/* Badges + share */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          {Number(project.deliveredLiters) > 0 ? (
            <a
              href={attestationTx ? `https://suiscan.xyz/testnet/tx/${attestationTx}` : `https://suiscan.xyz/testnet/object/${config.waterProjectId}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full bg-sui/15 px-2.5 py-1 text-xs font-medium text-sui hover:bg-sui/25"
            >
              <ShieldCheck className="h-3.5 w-3.5" /> Verified by TEE
            </a>
          ) : (
            <span className="rounded-full bg-secondary px-2.5 py-1 text-xs text-muted-foreground">Awaiting attestation</span>
          )}
          <div className="flex items-center gap-2">
            <span className="rounded bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">Soulbound</span>
            <a
              href={shareHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs hover:bg-accent"
            >
              <Share2 className="h-3.5 w-3.5" /> Share
            </a>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
