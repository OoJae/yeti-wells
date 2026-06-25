import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { useProject } from "../lib/queries";
import { walrusBlobUrl } from "../config";

export function EvidenceGallery() {
  const { project } = useProject();
  const evidence = project?.evidence ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Evidence</span>
          <span className="text-xs font-normal text-muted-foreground">immutable · stored on Walrus</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {evidence.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No evidence yet — the steward uploads geotagged photos and meter logs to Walrus as milestones complete.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {evidence.map((e) => (
              <a
                key={e.blobId}
                href={walrusBlobUrl(e.blobId)}
                target="_blank"
                rel="noreferrer"
                className="group block overflow-hidden rounded-lg border bg-card"
                title={e.caption}
              >
                <img
                  src={walrusBlobUrl(e.blobId)}
                  alt={e.caption}
                  loading="lazy"
                  className="h-28 w-full bg-secondary object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div className="space-y-0.5 p-2">
                  <div className="line-clamp-2 text-xs text-foreground">{e.caption}</div>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>Milestone {e.milestoneIndex}</span>
                    <span className="text-sui">↗ Walrus</span>
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
