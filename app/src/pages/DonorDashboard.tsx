import { useState } from "react";
import { Link } from "react-router-dom";
import { Droplets, Loader2 } from "lucide-react";
import { Button } from "../components/ui/button";
import { ImpactOrb } from "../components/ImpactOrb";
import { useGoogleAuth } from "../lib/auth";
import { useMyNfts, useProjects, type ProjectView } from "../lib/queries";
import { computeImpact } from "../lib/impact";
import { mistToSui } from "../lib/format";
import { TIER_LABELS } from "../config";

export function DonorDashboard() {
  const { account, signIn, canSignIn } = useGoogleAuth();
  const { nfts, isPending } = useMyNfts();
  const { projects } = useProjects();
  const byId = new Map<string, ProjectView>(projects.map((p) => [p.id, p]));
  const [copied, setCopied] = useState(false);

  if (!account) {
    return (
      <main className="mx-auto max-w-md px-4 py-20 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-sui/15 text-sui">
          <Droplets className="h-7 w-7" />
        </div>
        <h1 className="font-display text-2xl font-bold">Your impact</h1>
        <p className="mt-2 text-sm text-muted-foreground">Sign in to see the campaigns you've funded.</p>
        <Button onClick={signIn} disabled={!canSignIn} className="mt-6">Sign in with Google</Button>
      </main>
    );
  }

  const cards = nfts
    .map((nft) => ({ nft, project: byId.get(nft.projectId) }))
    .filter((x): x is { nft: (typeof nfts)[number]; project: ProjectView } => !!x.project)
    .map((x, i) => ({ ...x, c: computeImpact(x.project, x.nft.donatedMist), seed: i * 1.3 }));

  // Derive all totals from the joined set so the stats stay consistent with the visible gallery.
  const totalDonated = cards.reduce((s, x) => s + BigInt(x.nft.donatedMist ?? 0), 0n);
  const totalLiters = cards.reduce((s, x) => s + Number(x.c.attributed), 0);
  const highestTier = cards.reduce((m, x) => Math.max(m, x.c.tier), 0);

  const onShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked */
    }
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-[clamp(28px,4vw,52px)] pb-16">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
        <div>
          <div className="mb-3 font-mono text-xs tracking-[0.16em] text-sui">YOUR&nbsp;SOULBOUND&nbsp;COLLECTION</div>
          <h1 className="font-display text-[clamp(2rem,4.2vw,3.2rem)] font-extrabold leading-none tracking-tight">Your impact, alive on-chain.</h1>
          <p className="mt-3 max-w-[52ch] leading-snug text-muted-foreground">
            One soulbound Impact NFT for every campaign you've funded. Each fills with verified water as proven liters
            arrive — they rise, but never drain.
          </p>
        </div>
        <Button onClick={onShare} className="whitespace-nowrap">{copied ? "✓ Link copied" : "⤴ Share my impact"}</Button>
      </div>

      <div className="mb-9 grid grid-cols-2 gap-3.5 md:grid-cols-4">
        <StatCard value={mistToSui(totalDonated)} label="SUI DONATED" />
        <StatCard value={totalLiters.toLocaleString()} label="LITERS ATTRIBUTED" accent />
        <StatCard value={String(cards.length)} label="CAMPAIGNS FUNDED" />
        <StatCard value={TIER_LABELS[highestTier] ?? "Spring"} label="HIGHEST TIER" frost />
      </div>

      {isPending && nfts.length === 0 ? (
        <div className="flex items-center gap-2 py-16 font-mono text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading your impact…
        </div>
      ) : cards.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center">
          <p className="text-sm text-muted-foreground">You haven't funded a campaign yet.</p>
          <Link to="/campaigns" className="mt-3 inline-block"><Button size="sm">Browse campaigns</Button></Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {cards.map(({ nft, project, c, seed }) => (
            <Link
              key={nft.id}
              to={`/c/${project.id}`}
              className="flex flex-col items-center gap-3.5 rounded-xl border border-border bg-card p-5 transition-all duration-300 hover:-translate-y-1 hover:border-sui/40"
            >
              <div className="relative h-[150px] w-[150px]">
                <div className="yw-globe-glow absolute inset-0 rounded-full" />
                <ImpactOrb fillPercent={c.fillPercent} tier={c.tier} size={150} seed={seed} />
                <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-background/60 px-2 py-0.5 font-mono text-[10px]" style={{ color: c.tier >= 3 ? "#9EE6FF" : "#5CC8FF" }}>
                  {c.tierLabel}
                </span>
              </div>
              <div className="text-center">
                <div className="line-clamp-1 font-display text-base font-bold tracking-tight">{project.name}</div>
                <div className="mt-1 font-mono text-[11px] text-muted-foreground">{project.location}</div>
              </div>
              <div className="grid w-full grid-cols-3 gap-2 border-t border-border pt-3.5 text-center">
                <CardStat value={mistToSui(nft.donatedMist)} label="SUI" />
                <CardStat value={Number(c.attributed).toLocaleString()} label="LITERS" accent />
                <CardStat value={`${c.fillPercent}%`} label="FILLED" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}

function StatCard({ value, label, accent, frost }: { value: string; label: string; accent?: boolean; frost?: boolean }) {
  return (
    <div
      className="rounded-xl border border-border bg-card p-5"
      style={frost ? { borderColor: "rgba(158,230,255,.28)", background: "linear-gradient(160deg,rgba(158,230,255,.08),#0B1320)" } : undefined}
    >
      <div className={`font-display text-[clamp(1.6rem,3vw,2.3rem)] font-extrabold tracking-tight ${accent ? "text-sui" : frost ? "text-frost" : ""}`}>{value}</div>
      <div className="mt-1.5 font-mono text-[10.5px] tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}

function CardStat({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <div>
      <div className={`font-bold ${accent ? "text-sui" : ""}`}>{value}</div>
      <div className="mt-0.5 font-mono text-[9px] text-dim2">{label}</div>
    </div>
  );
}
