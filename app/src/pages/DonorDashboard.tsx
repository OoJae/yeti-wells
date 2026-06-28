import { Link } from "react-router-dom";
import { Droplets, Loader2 } from "lucide-react";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { WaterGlobe } from "../components/WaterGlobe";
import { useGoogleAuth } from "../lib/auth";
import { useMyNfts, useProjects, type ProjectView } from "../lib/queries";
import { computeImpact } from "../lib/impact";
import { mistToSui } from "../lib/format";

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl border bg-card p-4 text-center">
      <div className="text-2xl font-bold tabular-nums text-sui">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

export function DonorDashboard() {
  const { account, signIn, canSignIn } = useGoogleAuth();
  const { nfts, isPending } = useMyNfts();
  const { projects } = useProjects();
  const byId = new Map<string, ProjectView>(projects.map((p) => [p.id, p]));

  if (!account) {
    return (
      <main className="mx-auto max-w-md px-4 py-20 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-sui/15 text-sui">
          <Droplets className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-bold">Your impact</h1>
        <p className="mt-2 text-sm text-muted-foreground">Sign in to see the campaigns you've funded.</p>
        <Button onClick={signIn} disabled={!canSignIn} className="mt-6">
          Sign in with Google
        </Button>
      </main>
    );
  }

  const cards = nfts
    .map((nft) => ({ nft, project: byId.get(nft.projectId) }))
    .filter((x): x is { nft: (typeof nfts)[number]; project: ProjectView } => !!x.project)
    .map((x) => ({ ...x, c: computeImpact(x.project, x.nft.donatedMist) }));

  const totalDonated = nfts.reduce((s, n) => s + BigInt(n.donatedMist ?? 0), 0n);
  const totalLiters = cards.reduce((s, x) => s + Number(x.c.attributed), 0);

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold">Your impact</h1>
        <p className="mt-1 text-sm text-muted-foreground">Soulbound Impact NFTs from every campaign you've funded.</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Stat value={mistToSui(totalDonated)} label="SUI donated" />
        <Stat value={totalLiters.toLocaleString()} label="liters attributed" />
        <Stat value={String(cards.length)} label="campaigns funded" />
      </div>

      {isPending && nfts.length === 0 ? (
        <div className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading your impact…
        </div>
      ) : cards.length === 0 ? (
        <div className="rounded-xl border border-dashed py-16 text-center">
          <p className="text-sm text-muted-foreground">You haven't funded a campaign yet.</p>
          <Link to="/" className="mt-3 inline-block">
            <Button size="sm">Browse campaigns</Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map(({ nft, project, c }) => (
            <Link key={nft.id} to={`/c/${project.id}`}>
              <Card className="h-full transition-colors hover:border-sui/50">
                <CardContent className="flex flex-col items-center gap-3 p-5">
                  <div className="yw-globe-glow rounded-full">
                    <WaterGlobe fillPercent={c.fillPercent} tier={c.tier} size={150} />
                  </div>
                  <div className="text-center">
                    <div className="line-clamp-1 font-semibold">{project.name}</div>
                    <div className="text-xs text-muted-foreground">{project.location}</div>
                  </div>
                  <div className="grid w-full grid-cols-3 gap-2 text-center">
                    <div>
                      <div className="text-sm font-semibold tabular-nums">{mistToSui(nft.donatedMist)}</div>
                      <div className="text-[10px] text-muted-foreground">SUI</div>
                    </div>
                    <div>
                      <div className="text-sm font-semibold tabular-nums text-sui">
                        {Number(c.attributed).toLocaleString()}
                      </div>
                      <div className="text-[10px] text-muted-foreground">liters</div>
                    </div>
                    <div>
                      <div className="text-sm font-semibold tabular-nums">{c.tierLabel}</div>
                      <div className="text-[10px] text-muted-foreground">tier</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
