import { Trophy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { useDonations } from "../lib/queries";
import { mistToSui, shortAddr } from "../lib/format";

const MEDALS = ["🥇", "🥈", "🥉"];

/** Top supporters by total donated, aggregated from on-chain DonationEvents. Pass a projectId to scope it. */
export function Leaderboard({ projectId, limit = 5 }: { projectId?: string; limit?: number }) {
  const { leaderboard } = useDonations(projectId);
  const rows = leaderboard.slice(0, limit);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Trophy className="h-4 w-4 text-sui" />
          {projectId ? "Top supporters" : "Top supporters (all campaigns)"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No donations yet — be the first.</p>
        ) : (
          <ol className="space-y-2">
            {rows.map((r, i) => (
              <li key={r.donor} className="flex items-center gap-3 text-sm">
                <span className="w-5 text-center">{MEDALS[i] ?? i + 1}</span>
                <span className="font-mono text-xs text-muted-foreground">{shortAddr(r.donor)}</span>
                <span className="ml-auto font-semibold tabular-nums text-sui">{mistToSui(r.totalMist)} SUI</span>
                <span className="w-12 text-right text-[11px] text-muted-foreground">
                  {r.count} gift{r.count === 1 ? "" : "s"}
                </span>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
