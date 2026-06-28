import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2, ImagePlus, Droplets } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { useGoogleAuth } from "../lib/auth";
import { createCampaign } from "../lib/api";
import { suiToMist } from "../lib/format";

interface MilestoneRow {
  description: string;
  thresholdLiters: number;
  releaseSui: number;
}

const DEFAULT_MILESTONES: MilestoneRow[] = [
  { description: "Project kickoff", thresholdLiters: 0, releaseSui: 0.3 },
  { description: "Halfway delivered", thresholdLiters: 25000, releaseSui: 0.3 },
  { description: "Fully delivered", thresholdLiters: 50000, releaseSui: 0.4 },
];

function fileToBase64(file: File): Promise<{ base64: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve({ base64: result.slice(result.indexOf(",") + 1), mediaType: file.type || "application/octet-stream" });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const field = "w-full rounded-md border bg-background px-3 py-2 text-sm";
const label = "text-sm font-medium";

export function CreateCampaign() {
  const { account, signIn, canSignIn } = useGoogleAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [goalSui, setGoalSui] = useState(1);
  const [targetLiters, setTargetLiters] = useState(50000);
  const [milestones, setMilestones] = useState<MilestoneRow[]>(DEFAULT_MILESTONES);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>("");

  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");
  const [error, setError] = useState("");

  const releaseTotal = milestones.reduce((s, m) => s + (Number(m.releaseSui) || 0), 0);
  const releaseMismatch = Math.abs(releaseTotal - goalSui) > 1e-9;
  // FE-05: mirror the on-chain create_project_v2 rules so the form can't ship an invalid schedule.
  const thresholdsOk = milestones.every(
    (m, i) =>
      m.thresholdLiters >= 0 &&
      m.thresholdLiters <= targetLiters &&
      (i === 0 || m.thresholdLiters > milestones[i - 1].thresholdLiters),
  );
  const releasesPositive = milestones.every((m) => Number(m.releaseSui) > 0);

  const setMilestone = (i: number, patch: Partial<MilestoneRow>) =>
    setMilestones((ms) => ms.map((m, j) => (j === i ? { ...m, ...patch } : m)));
  const addMilestone = () =>
    setMilestones((ms) => (ms.length >= 8 ? ms : [...ms, { description: "", thresholdLiters: targetLiters, releaseSui: 0 }]));
  const removeMilestone = (i: number) => setMilestones((ms) => ms.filter((_, j) => j !== i));

  const onFile = (f: File | null) => {
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : "");
  };

  const valid =
    !!account &&
    name.trim().length > 0 &&
    goalSui > 0 &&
    targetLiters > 0 &&
    milestones.length > 0 &&
    milestones.every((m) => m.description.trim().length > 0) &&
    thresholdsOk &&
    releasesPositive &&
    !releaseMismatch; // releases must sum to the goal

  const onSubmit = async () => {
    if (!account || !valid) return;
    setStatus("submitting");
    setError("");
    try {
      let imageBase64: string | undefined;
      if (file) imageBase64 = (await fileToBase64(file)).base64;
      const res = await createCampaign({
        creator: account.address,
        name: name.trim(),
        location: location.trim(),
        description: description.trim(),
        imageBase64,
        fundingGoalMist: suiToMist(goalSui).toString(),
        targetLiters: String(Math.round(targetLiters)),
        milestones: milestones.map((m) => ({
          description: m.description.trim(),
          threshold: Math.round(m.thresholdLiters),
          release: suiToMist(m.releaseSui).toString(),
        })),
      });
      navigate(`/c/${res.projectId}`);
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  if (!account) {
    return (
      <main className="mx-auto max-w-md px-4 py-20 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-sui/15 text-sui">
          <Droplets className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-bold">Start a water campaign</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in with Google to launch a campaign. Funds you raise sit in on-chain escrow and release to you only as
          TEE-verified water is delivered.
        </p>
        <Button onClick={signIn} disabled={!canSignIn} className="mt-6">
          Sign in with Google
        </Button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold">Start a campaign</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          You are the organizer — released milestone funds pay out to your address. Donors give gaslessly and mint a
          soulbound Impact NFT that fills as verified water is delivered.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Campaign details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <div className={label}>Name</div>
            <input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Kibera Borehole #2" maxLength={100} />
          </div>
          <div className="space-y-1.5">
            <div className={label}>Location</div>
            <input className={field} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Nairobi, KE" maxLength={100} />
          </div>
          <div className="space-y-1.5">
            <div className={label}>Description</div>
            <textarea className={`${field} min-h-20`} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What will this campaign fund, and who does it serve?" maxLength={1000} />
          </div>

          <div className="space-y-1.5">
            <div className={label}>Cover image (stored on Walrus)</div>
            <label className="flex cursor-pointer items-center gap-3 rounded-md border border-dashed p-3 text-sm text-muted-foreground hover:bg-accent">
              <ImagePlus className="h-5 w-5" />
              {file ? file.name : "Choose an image…"}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
            </label>
            {preview && <img src={preview} alt="cover preview" className="h-40 w-full rounded-md object-cover" />}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <div className={label}>Funding goal (SUI)</div>
              <input type="number" min={0} step="0.1" className={field} value={goalSui} onChange={(e) => setGoalSui(Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <div className={label}>Target liters</div>
              <input type="number" min={0} step="1000" className={field} value={targetLiters} onChange={(e) => setTargetLiters(Number(e.target.value))} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            <span>Milestones</span>
            <span className={`text-xs font-normal ${releaseMismatch ? "text-destructive-foreground" : "text-muted-foreground"}`}>
              releases {releaseTotal.toFixed(2)} / {goalSui} SUI
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Escrow releases tranche-by-tranche as delivered liters cross each threshold (verified by the TEE). Releases
            should sum to your funding goal.
          </p>
          {milestones.map((m, i) => (
            <div key={i} className="grid grid-cols-[1fr_auto] items-end gap-2 rounded-lg border bg-card/40 p-3">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_120px_120px]">
                <input className={field} placeholder={`Milestone ${i + 1} description`} value={m.description} onChange={(e) => setMilestone(i, { description: e.target.value })} maxLength={120} />
                <input className={field} type="number" min={0} placeholder="liters" value={m.thresholdLiters} onChange={(e) => setMilestone(i, { thresholdLiters: Number(e.target.value) })} title="Liters threshold" />
                <input className={field} type="number" min={0} step="0.1" placeholder="SUI" value={m.releaseSui} onChange={(e) => setMilestone(i, { releaseSui: Number(e.target.value) })} title="Release (SUI)" />
              </div>
              <button onClick={() => removeMilestone(i)} disabled={milestones.length <= 1} aria-label={`Remove milestone ${i + 1}`} className="rounded-md p-2 text-muted-foreground hover:bg-accent disabled:opacity-30" title="Remove milestone">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addMilestone} disabled={milestones.length >= 8}>
            <Plus className="h-4 w-4" /> Add milestone
          </Button>
        </CardContent>
      </Card>

      {releaseMismatch && (
        <p className="text-xs text-destructive-foreground">
          Milestone releases total {releaseTotal.toFixed(2)} SUI but must sum exactly to your goal of {goalSui} SUI.
        </p>
      )}
      {!thresholdsOk && (
        <p className="text-xs text-destructive-foreground">
          Milestone liter thresholds must strictly increase and stay at or below your target of {targetLiters.toLocaleString()} L.
        </p>
      )}
      {status === "error" && <p className="break-all text-sm text-destructive-foreground">{error}</p>}

      <Button className="w-full" loading={status === "submitting"} disabled={!valid || status === "submitting"} onClick={onSubmit}>
        {status === "submitting" ? "Launching campaign…" : "Launch campaign"}
      </Button>
    </main>
  );
}
