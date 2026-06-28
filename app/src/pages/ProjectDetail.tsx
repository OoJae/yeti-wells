import { useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Share2, Check, ExternalLink } from "lucide-react";
import { ProjectCard } from "../components/ProjectCard";
import { ImpactNftCard } from "../components/ImpactNftCard";
import { EvidenceGallery } from "../components/EvidenceGallery";
import { StewardPanel } from "../components/StewardPanel";
import { Leaderboard } from "../components/Leaderboard";
import { Button } from "../components/ui/button";
import { useProject, useMyNft } from "../lib/queries";
import { useRefund } from "../lib/useRefund";
import { useGoogleAuth } from "../lib/auth";
import { shortAddr } from "../lib/format";

const isValidId = (id: string) => /^0x[0-9a-f]{64}$/i.test(id);

function ShareButton({ projectId }: { projectId: string }) {
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}/c/${projectId}`;
  const onShare = async () => {
    try {
      if (navigator.share) await navigator.share({ title: "Yeti Wells campaign", url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }
    } catch {
      /* user dismissed share sheet */
    }
  };
  return (
    <button
      onClick={onShare}
      className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
    >
      {copied ? <Check className="h-4 w-4 text-sui" /> : <Share2 className="h-4 w-4" />}
      {copied ? "Link copied" : "Share"}
    </button>
  );
}

/** SEC-02 UX: on a cancelled campaign, let a donor reclaim their share of remaining escrow (burns the NFT). */
function RefundBanner({ projectId }: { projectId: string }) {
  const { account } = useGoogleAuth();
  const { nft } = useMyNft(projectId);
  const refund = useRefund();
  const qc = useQueryClient();
  const [status, setStatus] = useState<"idle" | "pending" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");

  const onRefund = async () => {
    if (!nft) return;
    setStatus("pending");
    setMsg("");
    try {
      const d = await refund(projectId, nft.id);
      setStatus("done");
      setMsg(d);
      qc.invalidateQueries();
    } catch (e) {
      setStatus("error");
      setMsg(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
      <div className="font-medium text-amber-600">This campaign was cancelled.</div>
      <p className="mt-1 text-muted-foreground">
        Donors can reclaim their share of the remaining escrow (any milestones already paid out are shared equally).
        Reclaiming burns your soulbound Impact NFT for this campaign.
      </p>
      {account && nft && status !== "done" && (
        <Button className="mt-2" size="sm" loading={status === "pending"} onClick={onRefund}>
          Reclaim my refund
        </Button>
      )}
      {status === "done" && <p className="mt-2 text-sui">✅ Refunded — tx {msg.slice(0, 10)}…</p>}
      {status === "error" && <p className="mt-2 break-all text-destructive-foreground">{msg}</p>}
      {account && !nft && status === "idle" && (
        <p className="mt-2 text-xs text-muted-foreground">No refundable donation found for this account.</p>
      )}
    </div>
  );
}

export function ProjectDetail() {
  const { projectId = "" } = useParams();
  const [params] = useSearchParams();
  const isSteward = params.get("steward") === "1";
  const rawRef = params.get("ref");
  const validRef = rawRef && isValidId(rawRef) ? rawRef : null;
  const { project, isPending } = useProject(projectId);

  if (!isValidId(projectId)) {
    return (
      <main className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="text-xl font-bold">Invalid campaign link</h1>
        <p className="mt-2 text-sm text-muted-foreground">That doesn't look like a valid campaign id.</p>
        <Link to="/" className="mt-5 inline-block text-sui underline">
          Browse all campaigns
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> All campaigns
        </Link>
        {project && (
          <div className="flex items-center gap-2">
            <a
              href={`https://suiscan.xyz/testnet/object/${projectId}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
            >
              <ExternalLink className="h-4 w-4" /> On-chain
            </a>
            <ShareButton projectId={projectId} />
          </div>
        )}
      </div>

      {validRef && (
        <div className="rounded-lg border border-sui/30 bg-sui/10 px-4 py-2 text-sm text-sui">
          You were invited by {shortAddr(validRef)} — donate to join their impact.
        </div>
      )}

      {!project && !isPending ? (
        <div className="rounded-xl border border-dashed py-16 text-center text-sm text-muted-foreground">
          Campaign not found. <Link to="/" className="text-sui underline">Browse all campaigns</Link>.
        </div>
      ) : (
        <>
          {project?.status === 2 && <RefundBanner projectId={projectId} />}
          <div className="grid items-start gap-6 md:grid-cols-2">
            <ProjectCard projectId={projectId} />
            <ImpactNftCard projectId={projectId} />
          </div>
          <div className="grid items-start gap-6 md:grid-cols-[1fr_320px]">
            <EvidenceGallery projectId={projectId} />
            <Leaderboard projectId={projectId} limit={6} />
          </div>
          {isSteward && <StewardPanel projectId={projectId} />}
        </>
      )}
    </main>
  );
}
