import { useEffect, useRef, useState } from "react";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, ShieldQuestion, Share2, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { WaterGlobe } from "./WaterGlobe";
import { useMyNft, useProject, useLatestAttestationV2 } from "../lib/queries";
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

export function ImpactNftCard({ projectId }: { projectId: string }) {
  const account = useCurrentAccount();
  const { nft } = useMyNft(projectId);
  const { project } = useProject(projectId);
  const syncImpact = useSyncImpact();
  const qc = useQueryClient();
  const { txDigest: attestationTx, enclaveId: attEnclave } = useLatestAttestationV2(projectId);

  const [syncing, setSyncing] = useState(false);
  const lastKey = useRef("");
  const failedKeys = useRef<Set<string>>(new Set());

  // Auto-sync only when on-chain is STALE-LOW (delivered grew): on-chain liters_attributed is monotonic, so
  // a later diluting donation never needs a sync-down. FE-04: a hard failure is remembered (no retry loop).
  useEffect(() => {
    if (!nft || !project || !account) return;
    const computed = computeImpact(project, nft.donatedMist);
    const key = `${nft.id}:${project.deliveredLiters}`;
    if (computed.attributed > BigInt(nft.litersAttributed) && lastKey.current !== key && !failedKeys.current.has(key)) {
      lastKey.current = key;
      setSyncing(true);
      syncImpact(nft.id, projectId)
        .then(() => qc.invalidateQueries())
        .catch((e) => {
          failedKeys.current.add(key); // don't loop on a persistent failure
          console.warn("auto-sync failed", e);
        })
        .finally(() => setSyncing(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nft?.id, nft?.litersAttributed, project?.deliveredLiters, account?.address]);

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
  // ECON-02 display: never show LESS than the monotonic on-chain value (a later donor must not visibly un-fill us).
  const attributed = c.attributed > BigInt(nft.litersAttributed) ? c.attributed : BigInt(nft.litersAttributed);
  // FE-02: only a milestone attested by the genuine (PCR-verified) enclave is "Verified by TEE (AWS Nitro)".
  const genuine = !!config.genuineEnclaveId && attEnclave === config.genuineEnclaveId;
  const shareText = `I'm funding ${project.name} with Yeti Wells on Sui — ${Number(attributed).toLocaleString()} liters of clean water delivered on my behalf, on-chain. 🧊💧 Join me:`;
  // Referral deep link to this campaign (carries the donor's address as ?ref=).
  const campaignUrl = `${window.location.origin}/c/${projectId}?ref=${account?.address ?? ""}`;
  const shareHref = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(campaignUrl)}`;

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
            <div className="text-sm font-semibold tabular-nums text-sui">{Number(attributed).toLocaleString()}</div>
            <div className="text-[10px] text-muted-foreground">liters attributed</div>
          </div>
          <div className="rounded-lg border bg-card/50 p-2">
            <div className="text-sm font-semibold tabular-nums">{Number(attributed).toLocaleString()}</div>
            <div className="text-[10px] text-muted-foreground">XP</div>
          </div>
        </div>

        {/* Badges + share — provenance-aware (FE-02): genuine TEE vs demo signer */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          {Number(project.deliveredLiters) > 0 ? (
            genuine ? (
              <a
                href={attestationTx ? `https://suiscan.xyz/testnet/tx/${attestationTx}` : `https://suiscan.xyz/testnet/object/${projectId}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full bg-sui/15 px-2.5 py-1 text-xs font-medium text-sui hover:bg-sui/25"
                title="Released after a genuine AWS-Nitro TEE attestation"
              >
                <ShieldCheck className="h-3.5 w-3.5" /> Verified by TEE (AWS Nitro)
              </a>
            ) : (
              <a
                href={attestationTx ? `https://suiscan.xyz/testnet/tx/${attestationTx}` : `https://suiscan.xyz/testnet/object/${projectId}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-600 hover:bg-amber-500/25"
                title="Released by the demo signer in this deployment (not genuine TEE hardware). The on-chain ed25519 verification is real; the signing key is a software key for the judging window."
              >
                <ShieldQuestion className="h-3.5 w-3.5" /> Released (demo signer)
              </a>
            )
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
