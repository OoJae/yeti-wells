import { Droplets } from "lucide-react";
import { useRegistry } from "../lib/queries";

export function Landing() {
  const { totalDeliveredLiters, totalRaisedMist } = useRegistry();

  return (
    <section className="mx-auto max-w-5xl px-4 pt-12 pb-6 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-sui/15 text-sui">
        <Droplets className="h-7 w-7" />
      </div>
      <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl">
        Every drop, <span className="text-sui">provable.</span>
      </h1>
      <p className="mx-auto mt-4 max-w-2xl text-balance text-muted-foreground">
        Donations sit in on-chain escrow and release only when a Trusted Execution Environment proves
        real water was delivered. Sign in with Google, give in one tap, pay zero gas — and watch your
        soulbound Impact NFT fill with verified water.
      </p>

      <div className="mx-auto mt-8 grid max-w-md grid-cols-2 gap-4">
        <div className="rounded-xl border bg-card p-4">
          <div className="text-3xl font-bold tabular-nums text-sui">
            {Number(totalDeliveredLiters).toLocaleString()}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">liters verified on-chain</div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="text-3xl font-bold tabular-nums">
            {(Number(totalRaisedMist) / 1e9).toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">SUI raised</div>
        </div>
      </div>
    </section>
  );
}
