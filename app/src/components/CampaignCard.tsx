import { Link } from "react-router-dom";
import { MapPin } from "lucide-react";
import type { ProjectView } from "../lib/queries";
import { mistToSui, num, pct, shortAddr } from "../lib/format";
import { StatusBadge } from "./StatusBadge";
import { CoverImage } from "./CoverImage";

function MiniBar({ value, muted = false }: { value: number; muted?: boolean }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
      <div
        className={`h-full rounded-full ${muted ? "bg-muted-foreground/50" : "bg-sui"} transition-all`}
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

export function CampaignCard({ project }: { project: ProjectView }) {
  const raised = num(project.raisedMist);
  const goal = num(project.fundingGoalMist);
  const delivered = num(project.deliveredLiters);
  const target = num(project.targetLiters);

  return (
    <Link
      to={`/c/${project.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border bg-card text-card-foreground shadow transition-colors hover:border-sui/50"
    >
      <div className="relative h-36 w-full overflow-hidden bg-secondary">
        <CoverImage blobId={project.imageBlobId} alt={project.name} className="h-full w-full transition-transform duration-300 group-hover:scale-105" />
        <div className="absolute right-2 top-2">
          <StatusBadge delivered={delivered} target={target} status={project.status} />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h3 className="line-clamp-1 font-semibold leading-tight">{project.name}</h3>
          <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" /> <span className="line-clamp-1">{project.location}</span>
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            Funds → <span className="font-mono">{shortAddr(project.payout)}</span>
          </div>
        </div>

        <div className="mt-auto space-y-2">
          <div className="space-y-1">
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>Raised</span>
              <span>
                {mistToSui(project.raisedMist)} / {mistToSui(project.fundingGoalMist)} SUI
              </span>
            </div>
            <MiniBar value={pct(raised, goal)} />
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>Verified delivered</span>
              <span>
                {delivered.toLocaleString()} / {target.toLocaleString()} L
              </span>
            </div>
            <MiniBar value={pct(delivered, target)} muted={delivered === 0} />
          </div>
        </div>
      </div>
    </Link>
  );
}
