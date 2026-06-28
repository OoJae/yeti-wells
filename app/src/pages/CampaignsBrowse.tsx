import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, Plus, Loader2 } from "lucide-react";
import { CampaignCard } from "../components/CampaignCard";
import { Leaderboard } from "../components/Leaderboard";
import { Button } from "../components/ui/button";
import { useProjects, useRegistry } from "../lib/queries";
import { num, mistToSui } from "../lib/format";
import { campaignStatus, type CampaignStatus } from "../components/StatusBadge";

type SortKey = "newest" | "raised" | "delivered" | "progress";
const STATUS_TABS: { key: "all" | CampaignStatus; label: string }[] = [
  { key: "all", label: "All" },
  { key: "fundraising", label: "Fundraising" },
  { key: "delivering", label: "Delivering" },
  { key: "delivered", label: "Delivered" },
];

export function CampaignsBrowse() {
  const { projects, isPending, error } = useProjects();
  const { totalDeliveredLiters, totalRaisedMist } = useRegistry();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | CampaignStatus>("all");
  const [sort, setSort] = useState<SortKey>("newest");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = projects.filter((p) => {
      const matchesText =
        !needle ||
        p.name.toLowerCase().includes(needle) ||
        p.location.toLowerCase().includes(needle) ||
        p.description.toLowerCase().includes(needle);
      const st = campaignStatus(num(p.deliveredLiters), num(p.targetLiters));
      return matchesText && (status === "all" || st === status);
    });
    const sorted = [...list];
    if (sort === "raised") sorted.sort((a, b) => num(b.raisedMist) - num(a.raisedMist));
    else if (sort === "delivered") sorted.sort((a, b) => num(b.deliveredLiters) - num(a.deliveredLiters));
    else if (sort === "progress")
      sorted.sort(
        (a, b) =>
          num(b.deliveredLiters) / Math.max(1, num(b.targetLiters)) -
          num(a.deliveredLiters) / Math.max(1, num(a.targetLiters)),
      );
    return sorted;
  }, [projects, q, status, sort]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-[clamp(24px,3.5vw,44px)] pb-16">
      {/* header + stats */}
      <div className="mb-8">
        <div className="mb-3 font-mono text-xs tracking-[0.16em] text-sui">OPEN&nbsp;CAMPAIGNS</div>
        <h1 className="font-display text-[clamp(1.9rem,4vw,3rem)] font-extrabold leading-none tracking-tight">Standout wells. Standing proof.</h1>
        <div className="mt-6 flex flex-wrap gap-3.5 font-mono text-xs">
          <Stat value={num(totalDeliveredLiters).toLocaleString()} label="LITERS VERIFIED" accent />
          <Stat value={mistToSui(totalRaisedMist)} label="SUI RAISED" />
          <Stat value={String(projects.length)} label="CAMPAIGNS" />
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
        <section className="space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search campaigns by name or place…"
                className="w-full rounded-md border border-border bg-card py-2 pl-9 pr-3 text-sm"
              />
            </div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="rounded-md border border-border bg-card px-3 py-2 font-mono text-xs"
            >
              <option value="newest">Newest</option>
              <option value="raised">Most raised</option>
              <option value="delivered">Most delivered</option>
              <option value="progress">Closest to goal</option>
            </select>
          </div>

          <div className="flex flex-wrap gap-2">
            {STATUS_TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setStatus(t.key)}
                className={`rounded-sm px-3 py-1.5 font-mono text-[11px] tracking-wide transition-colors ${
                  status === t.key ? "border border-sui/30 bg-sui/10 text-sui" : "border border-border bg-card text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {error && projects.length === 0 ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 py-16 text-center">
              <p className="text-sm text-destructive-foreground">Couldn't load campaigns from the network.</p>
              <Button size="sm" className="mt-3" onClick={() => window.location.reload()}>Retry</Button>
            </div>
          ) : isPending && projects.length === 0 ? (
            <div className="flex items-center gap-2 py-16 font-mono text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading campaigns…
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border py-16 text-center">
              <p className="text-sm text-muted-foreground">No campaigns match your search.</p>
              <Link to="/create" className="mt-3 inline-block"><Button size="sm"><Plus className="h-4 w-4" /> Start a campaign</Button></Link>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((p) => (
                <CampaignCard key={p.id} project={p} />
              ))}
            </div>
          )}
        </section>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Link to="/create" className="block">
            <Button className="w-full"><Plus className="h-4 w-4" /> Start a campaign</Button>
          </Link>
          <Leaderboard limit={8} />
          <div className="rounded-lg border border-border bg-deep2 p-4 font-mono text-[11px] leading-relaxed text-muted-foreground">
            <div className="mb-2 tracking-[0.12em] text-dim2">↗ HOW IT WORKS</div>
            Escrow releases milestone-by-milestone only when a registered TEE attests delivered liters on-chain.
          </div>
        </aside>
      </div>
    </main>
  );
}

function Stat({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-card px-5 py-3.5">
      <div className={`font-display text-2xl font-extrabold tracking-tight ${accent ? "text-sui" : ""}`}>{value}</div>
      <div className="mt-1 tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}
