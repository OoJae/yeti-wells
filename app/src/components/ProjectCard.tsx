import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { useProject } from "../lib/queries";
import { mistToSui, num, pct } from "../lib/format";
import { DonatePanel } from "./DonatePanel";

function Bar({ value }: { value: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
      <div className="h-full rounded-full bg-sui transition-all" style={{ width: `${value}%` }} />
    </div>
  );
}

export function ProjectCard() {
  const { project, isPending } = useProject();

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
    <Card>
      <CardHeader>
        <CardTitle>{project.name}</CardTitle>
        <CardDescription>{project.location}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{project.description}</p>

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

        <DonatePanel />
      </CardContent>
    </Card>
  );
}
