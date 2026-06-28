import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { addEvidence, runAttestation, cancelCampaign } from "../lib/api";

function fileToBase64(file: File): Promise<{ base64: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string; // data:<mime>;base64,<data>
      resolve({
        base64: result.slice(result.indexOf(",") + 1),
        mediaType: file.type || "application/octet-stream",
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function StewardPanel({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const [stewardKey, setStewardKey] = useState(() => localStorage.getItem("yw_steward_key") ?? "");

  // Evidence
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [milestone, setMilestone] = useState(0);
  const [evStatus, setEvStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [evMsg, setEvMsg] = useState("");

  // Attestation
  const [attMilestone, setAttMilestone] = useState(1);
  const [attStatus, setAttStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [attMsg, setAttMsg] = useState("");

  const saveKey = () => localStorage.setItem("yw_steward_key", stewardKey);

  const onUpload = async () => {
    if (!file) return;
    setEvStatus("uploading");
    setEvMsg("");
    try {
      saveKey();
      const { base64, mediaType } = await fileToBase64(file);
      const r = await addEvidence(
        { projectId, dataBase64: base64, mediaType, caption, milestoneIndex: milestone },
        stewardKey,
      );
      setEvStatus("done");
      setEvMsg(r.blobId);
      setFile(null);
      setCaption("");
      qc.invalidateQueries();
    } catch (e) {
      setEvStatus("error");
      setEvMsg(e instanceof Error ? e.message : String(e));
    }
  };

  const [cancelStatus, setCancelStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [cancelMsg, setCancelMsg] = useState("");
  const onCancel = async () => {
    if (!confirm("Cancel this campaign? Donors will be able to reclaim their share of remaining escrow.")) return;
    setCancelStatus("running");
    setCancelMsg("");
    try {
      saveKey();
      const r = await cancelCampaign(projectId, stewardKey);
      setCancelStatus("done");
      setCancelMsg(r.digest);
      qc.invalidateQueries();
    } catch (e) {
      setCancelStatus("error");
      setCancelMsg(e instanceof Error ? e.message : String(e));
    }
  };

  const onAttest = async () => {
    setAttStatus("running");
    setAttMsg("");
    try {
      saveKey();
      const r = await runAttestation(projectId, attMilestone, stewardKey);
      setAttStatus("done");
      setAttMsg(`${r.source} · ${r.litersReading.toLocaleString()} L · ${r.digest.slice(0, 10)}…`);
      qc.invalidateQueries();
    } catch (e) {
      setAttStatus("error");
      setAttMsg(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="text-base">Steward console</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <input
          value={stewardKey}
          onChange={(e) => setStewardKey(e.target.value)}
          placeholder="Steward key"
          type="password"
          className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
        />

        {/* TEE attestation */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-sm font-medium">
            <ShieldCheck className="h-4 w-4 text-sui" /> Run TEE attestation (Nautilus)
          </div>
          <p className="text-xs text-muted-foreground">
            The enclave reads the flow-meter, signs a MilestoneReport, and the chain verifies it before releasing escrow.
          </p>
          <div className="flex gap-2">
            <input
              type="number"
              min={0}
              value={attMilestone}
              onChange={(e) => setAttMilestone(Number(e.target.value))}
              className="w-28 rounded-md border bg-background px-3 py-1.5 text-sm"
              title="Milestone index"
            />
            <Button className="flex-1" disabled={!stewardKey} loading={attStatus === "running"} onClick={onAttest}>
              {attStatus === "running" ? "Attesting…" : "Run attestation"}
            </Button>
          </div>
          {attStatus === "done" && <p className="text-xs text-sui">✅ Verified &amp; released — {attMsg}</p>}
          {attStatus === "error" && <p className="break-all text-xs text-destructive-foreground">{attMsg}</p>}
        </div>

        {/* Evidence */}
        <div className="space-y-2 border-t pt-4">
          <div className="text-sm font-medium">Add evidence (Walrus)</div>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-foreground"
          />
          <input
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Caption (e.g. Borehole completed)"
            className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
          />
          <div className="flex gap-2">
            <input
              type="number"
              min={0}
              value={milestone}
              onChange={(e) => setMilestone(Number(e.target.value))}
              className="w-28 rounded-md border bg-background px-3 py-1.5 text-sm"
              title="Milestone index"
            />
            <Button className="flex-1" disabled={!file || !stewardKey} loading={evStatus === "uploading"} onClick={onUpload}>
              {evStatus === "uploading" ? "Uploading to Walrus…" : "Upload evidence"}
            </Button>
          </div>
          {evStatus === "done" && (
            <p className="text-xs text-sui">✅ Stored on Walrus — blob {evMsg.slice(0, 10)}… recorded on-chain</p>
          )}
          {evStatus === "error" && <p className="break-all text-xs text-destructive-foreground">{evMsg}</p>}
        </div>

        {/* Cancel campaign -> enables donor refunds */}
        <div className="space-y-2 border-t pt-4">
          <div className="text-sm font-medium">Cancel campaign</div>
          <p className="text-xs text-muted-foreground">
            Marks the campaign cancelled so donors can reclaim their share of remaining escrow. Irreversible.
          </p>
          <Button
            variant="outline"
            className="w-full"
            disabled={!stewardKey}
            loading={cancelStatus === "running"}
            onClick={onCancel}
          >
            {cancelStatus === "running" ? "Cancelling…" : "Cancel campaign"}
          </Button>
          {cancelStatus === "done" && <p className="text-xs text-sui">✅ Cancelled — {cancelMsg.slice(0, 10)}…</p>}
          {cancelStatus === "error" && <p className="break-all text-xs text-destructive-foreground">{cancelMsg}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
