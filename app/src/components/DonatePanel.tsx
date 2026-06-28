import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "./ui/button";
import { useDonate } from "../lib/useDonate";
import { useAutoFund, useGoogleAuth } from "../lib/auth";
import { useMyNft } from "../lib/queries";
import { suiToMist } from "../lib/format";

const PRESETS = [0.05, 0.1, 0.2];

export function DonatePanel({ projectId }: { projectId: string }) {
  const { account, signIn, canSignIn } = useGoogleAuth();
  const funding = useAutoFund();
  const { nft } = useMyNft(projectId);
  const donate = useDonate();
  const qc = useQueryClient();

  const [amount, setAmount] = useState(0.05);
  const [status, setStatus] = useState<"idle" | "pending" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");

  if (!account) {
    return (
      <Button onClick={signIn} disabled={!canSignIn} className="w-full">
        Sign in with Google to donate
      </Button>
    );
  }

  const onDonate = async () => {
    setStatus("pending");
    setMsg("");
    try {
      const digest = await donate(projectId, suiToMist(amount), nft?.id);
      setStatus("done");
      setMsg(digest);
      qc.invalidateQueries();
    } catch (e) {
      setStatus("error");
      setMsg(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="space-y-3 border-t pt-4">
      <div className="grid grid-cols-3 gap-2">
        {PRESETS.map((p) => (
          <Button
            key={p}
            variant={amount === p ? "default" : "outline"}
            size="sm"
            onClick={() => setAmount(p)}
          >
            {p} SUI
          </Button>
        ))}
      </div>
      <Button className="w-full" loading={status === "pending" || funding} onClick={onDonate}>
        {funding ? "Preparing your wallet…" : nft ? `Add ${amount} SUI` : `Donate ${amount} SUI`}
      </Button>
      {status === "done" && (
        <p className="text-xs text-sui">✅ Donated — tx {msg.slice(0, 10)}…</p>
      )}
      {status === "error" && <p className="break-all text-xs text-destructive-foreground">{msg}</p>}
      <p className="text-center text-xs text-muted-foreground">
        Zero gas — sponsored. {nft ? "Tops up your Impact NFT." : "Mints your soulbound Impact NFT."}
      </p>
    </div>
  );
}
