import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { useProject } from "../lib/queries";
import { mistToSui, num, pct, shortAddr } from "../lib/format";
import { DonatePanel } from "./DonatePanel";
import { StatusBadge } from "./StatusBadge";
import { CoverImage } from "./CoverImage";
import { CheckCircle2, Circle, ShieldAlert } from "lucide-react";

function Bar({ value }: { value: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
      <div className="h-full rounded-full bg-sui transition-all" style={{ width: `${value}%` }} />
    </div>
  );
}

export function ProjectCard({ projectId }: { projectId: string }) {
  const { project, isPending } = useProject(projectId);

  if (!project) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          {isPending ? "Loading project…" : "Project not found."}
        </CardContent>
      </Card>
    );
  }

  const raised = num(project.raisedMist);
  const goal = num(project.fundingGoalMist);
  const delivered = num(project.deliveredLiters);
  const target = num(project.targetLiters);

  return (
    <Card className="overflow-hidden">
      {project.imageBlobId && (
        <CoverImage blobId={project.imageBlobId} alt={project.name} className="h-44 w-full" />
      )}
      <CardHeader>
        <CardTitle className="flex items-start justify-between gap-2">
          <span>{project.name}</span>
          <StatusBadge delivered={delivered} target={target} status={project.status} />
        </CardTitle>
        <CardDescription>{project.location}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{project.description}</p>

        {/* FE-01: who receives released funds + an open-marketplace caution. */}
        <div className="rounded-lg border border-dashed bg-card/40 p-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Funds release to (organizer)</span>
            <a
              href={`https://suiscan.xyz/testnet/account/${project.payout}`}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-sui hover:underline"
            >
              {shortAddr(project.payout)}
            </a>
          </div>
          <div className="mt-1.5 flex items-start gap-1.5 text-muted-foreground">
            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>Anyone can launch a campaign — verify the organizer before donating. Escrow releases only on TEE-attested delivery.</span>
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Raised</span>
            <span>
              {mistToSui(project.raisedMist)} / {mistToSui(project.fundingGoalMist)} SUI
            </span>
          </div>
          <Bar value={pct(raised, goal)} />
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Verified delivered</span>
            <span>
              {delivered.toLocaleString()} / {target.toLocaleString()} L
            </span>
          </div>
          <Bar value={pct(delivered, target)} />
        </div>

        {project.milestones.length > 0 && (
          <div className="space-y-1.5 rounded-lg border bg-card/40 p-3">
            <div className="text-xs font-medium text-muted-foreground">Milestones</div>
            {project.milestones.map((m) => (
              <div key={m.index} className="flex items-center gap-2 text-sm">
                {m.released ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-sui" />
                ) : (
                  <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <span className={m.released ? "text-foreground" : "text-muted-foreground"}>{m.description}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {m.litersThreshold.toLocaleString()} L · {mistToSui(m.releaseMist)} SUI
                </span>
              </div>
            ))}
          </div>
        )}

        <DonatePanel projectId={projectId} />
      </CardContent>
    </Card>
  );
}
