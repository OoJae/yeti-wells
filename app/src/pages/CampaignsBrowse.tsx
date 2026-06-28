import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, Plus, Loader2 } from "lucide-react";
import { Landing } from "../components/Landing";
import { CampaignCard } from "../components/CampaignCard";
import { Leaderboard } from "../components/Leaderboard";
import { Button } from "../components/ui/button";
import { useProjects } from "../lib/queries";
import { num } from "../lib/format";
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
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | CampaignStatus>("all");
  const [sort, setSort] = useState<SortKey>("newest");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = projects.filter((p) => {
      const matchesText =
        !needle ||
        p.name.toLowerCase().includes(needle) ||
        p.location.toLowerCase().includes(needle) ||
        p.description.toLowerCase().includes(needle);
      const st = campaignStatus(num(p.deliveredLiters), num(p.targetLiters));
      return matchesText && (status === "all" || st === status);
    });
    list = [...list];
    if (sort === "raised") list.sort((a, b) => num(b.raisedMist) - num(a.raisedMist));
    else if (sort === "delivered") list.sort((a, b) => num(b.deliveredLiters) - num(a.deliveredLiters));
    else if (sort === "progress")
      list.sort(
        (a, b) =>
          num(b.deliveredLiters) / Math.max(1, num(b.targetLiters)) -
          num(a.deliveredLiters) / Math.max(1, num(a.targetLiters)),
      );
    // "newest" keeps the event-descending order from useProjects
    return list;
  }, [projects, q, status, sort]);

  return (
    <div>
      <Landing />
      <main className="mx-auto max-w-6xl px-4 pb-16">
        <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
          <section className="space-y-5">
            {/* Toolbar */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search campaigns by name or place…"
                  className="w-full rounded-md border bg-background py-2 pl-9 pr-3 text-sm"
                />
              </div>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="rounded-md border bg-background px-3 py-2 text-sm"
              >
                <option value="newest">Newest</option>
                <option value="raised">Most raised</option>
                <option value="delivered">Most delivered</option>
                <option value="progress">Closest to goal</option>
              </select>
            </div>

            {/* Status tabs */}
            <div className="flex flex-wrap gap-2">
              {STATUS_TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setStatus(t.key)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    status === t.key ? "bg-sui/20 text-sui" : "bg-secondary text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Grid */}
            {error && projects.length === 0 ? (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 py-16 text-center">
                <p className="text-sm text-destructive-foreground">Couldn't load campaigns from the network.</p>
                <Button size="sm" className="mt-3" onClick={() => window.location.reload()}>
                  Retry
                </Button>
              </div>
            ) : isPending && projects.length === 0 ? (
              <div className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading campaigns…
              </div>
            ) : filtered.length === 0 ? (
              <div className="rounded-xl border border-dashed py-16 text-center">
                <p className="text-sm text-muted-foreground">No campaigns match your search.</p>
                <Link to="/create" className="mt-3 inline-block">
                  <Button size="sm">
                    <Plus className="h-4 w-4" /> Start a campaign
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {filtered.map((p) => (
                  <CampaignCard key={p.id} project={p} />
                ))}
              </div>
            )}
          </section>

          {/* Sidebar */}
          <aside className="space-y-4">
            <Link to="/create" className="block">
              <Button className="w-full">
                <Plus className="h-4 w-4" /> Start a campaign
              </Button>
            </Link>
            <Leaderboard limit={8} />
          </aside>
        </div>
      </main>
    </div>
  );
}
