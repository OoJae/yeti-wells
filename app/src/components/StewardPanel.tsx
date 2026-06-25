import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { addEvidence } from "../lib/api";

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

export function StewardPanel() {
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [milestone, setMilestone] = useState(0);
  const [stewardKey, setStewardKey] = useState(() => localStorage.getItem("yw_steward_key") ?? "");
  const [status, setStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");

  const onSubmit = async () => {
    if (!file) return;
    setStatus("uploading");
    setMsg("");
    try {
      localStorage.setItem("yw_steward_key", stewardKey);
      const { base64, mediaType } = await fileToBase64(file);
      const r = await addEvidence({ dataBase64: base64, mediaType, caption, milestoneIndex: milestone }, stewardKey);
      setStatus("done");
      setMsg(r.blobId);
      setFile(null);
      setCaption("");
      qc.invalidateQueries();
    } catch (e) {
      setStatus("error");
      setMsg(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="text-base">Steward — add evidence</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
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
            placeholder="Milestone"
          />
          <input
            value={stewardKey}
            onChange={(e) => setStewardKey(e.target.value)}
            placeholder="Steward key"
            type="password"
            className="flex-1 rounded-md border bg-background px-3 py-1.5 text-sm"
          />
        </div>
        <Button className="w-full" disabled={!file || !stewardKey} loading={status === "uploading"} onClick={onSubmit}>
          {status === "uploading" ? "Uploading to Walrus…" : "Upload evidence"}
        </Button>
        {status === "done" && (
          <p className="text-xs text-sui">✅ Stored on Walrus — blob {msg.slice(0, 10)}… recorded on-chain</p>
        )}
        {status === "error" && <p className="break-all text-xs text-destructive-foreground">{msg}</p>}
      </CardContent>
    </Card>
  );
}
