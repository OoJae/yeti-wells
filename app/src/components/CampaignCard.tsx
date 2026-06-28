import { Link } from "react-router-dom";
import type { ProjectView } from "../lib/queries";
import { mistToSui, num, pct, shortAddr } from "../lib/format";
import { campaignStatus } from "./StatusBadge";
import { CoverImage } from "./CoverImage";

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  fundraising: { label: "FUNDRAISING", color: "text-muted-foreground" },
  delivering: { label: "DELIVERING", color: "text-sui" },
  delivered: { label: "FULLY DELIVERED", color: "text-frost" },
};

export function CampaignCard({ project }: { project: ProjectView }) {
  const raised = num(project.raisedMist);
  const goal = num(project.fundingGoalMist);
  const delivered = num(project.deliveredLiters);
  const target = num(project.targetLiters);
  const st = STATUS_LABEL[campaignStatus(delivered, target)];

  return (
    <Link
      to={`/c/${project.id}`}
      className="group flex flex-col overflow-hidden rounded-lg border border-border bg-card transition-all duration-300 hover:-translate-y-[3px] hover:border-sui/40"
    >
      <div className="relative h-36 w-full overflow-hidden" style={{ background: "linear-gradient(135deg,#0E2238,#091522)" }}>
        {project.imageBlobId ? (
          <CoverImage blobId={project.imageBlobId} alt={project.name} className="h-full w-full transition-transform duration-300 group-hover:scale-105" />
        ) : (
          <div className="absolute inset-0" style={{ backgroundImage: "repeating-linear-gradient(125deg,rgba(92,200,255,.06) 0 2px,transparent 2px 13px)" }} />
        )}
        <span className={`absolute left-3 top-3 rounded-sm border border-border bg-background/55 px-2 py-1 font-mono text-[10px] tracking-wide ${st.color}`}>
          {st.label}
        </span>
        {delivered > 0 && (
          <span className="absolute right-3 top-3 flex items-center gap-1.5 rounded-sm border border-sui/30 bg-sui/10 px-2 py-1 font-mono text-[10px] text-sui">
            <span className="h-1.5 w-1.5 rounded-full bg-sui" style={{ boxShadow: "0 0 8px #5CC8FF" }} />TEE
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h3 className="line-clamp-1 font-display text-[1.05rem] font-bold tracking-tight">{project.name}</h3>
          <div className="mt-1 flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
            <span className="h-[5px] w-[5px] rounded-full bg-sui" /> <span className="line-clamp-1">{project.location}</span>
          </div>
          <div className="mt-1 font-mono text-[10.5px] text-dim2">funds → {shortAddr(project.payout)}</div>
        </div>

        <div className="mt-auto flex flex-col gap-3">
          <div>
            <div className="mb-1.5 flex justify-between gap-2 font-mono text-[10px] text-muted-foreground">
              <span>RAISED</span>
              <span className="text-foreground">{mistToSui(project.raisedMist)} / {mistToSui(project.fundingGoalMist)} SUI</span>
            </div>
            <div className="h-1 overflow-hidden rounded bg-secondary"><div className="h-full rounded bg-foreground transition-all" style={{ width: `${pct(raised, goal)}%` }} /></div>
          </div>
          <div>
            <div className="mb-1.5 flex justify-between gap-2 font-mono text-[10px] text-muted-foreground">
              <span>VERIFIED&nbsp;DELIVERED</span>
              <span className={delivered > 0 ? "text-sui" : "text-dim2"}>{delivered.toLocaleString()} / {target.toLocaleString()} L</span>
            </div>
            <div className="h-1 overflow-hidden rounded bg-secondary">
              <div className="h-full rounded transition-all" style={{ width: `${pct(delivered, target)}%`, background: delivered > 0 ? "linear-gradient(90deg,#1C6CB2,#5CC8FF)" : "#566678" }} />
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
