import { useEffect, useMemo, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { WellCore } from "../components/WellCore";
import { YetiMark } from "../components/YetiMark";
import { useGoogleAuth } from "../lib/auth";
import { useProjects, useRegistry } from "../lib/queries";
import { mistToSui, num, pct } from "../lib/format";

const kicker = "font-mono text-xs tracking-[0.16em]";

export function Landing() {
  const navigate = useNavigate();
  const { account, signIn } = useGoogleAuth();
  const { totalDeliveredLiters } = useRegistry();
  const { projects } = useProjects();

  const fillRef = useRef(0.08);
  const railFillRef = useRef<HTMLDivElement>(null);
  const railHeadRef = useRef<HTMLDivElement>(null);
  const depthRef = useRef<HTMLSpanElement>(null);
  const counterRef = useRef<HTMLSpanElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const howRef = useRef<HTMLElement>(null);
  const campaignsRef = useRef<HTMLElement>(null);
  const verifyRef = useRef<HTMLElement>(null);

  // Featured campaign = the most-delivered live campaign (the showcase), with a static fallback.
  const featured = useMemo(
    () => [...projects].sort((a, b) => num(b.deliveredLiters) - num(a.deliveredLiters))[0],
    [projects],
  );

  const onSignIn = () => (account ? navigate("/campaigns") : signIn());
  const scrollTo = (ref: React.RefObject<HTMLElement | null>) => () =>
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  // Imperative scroll → fill (no React re-render per frame).
  useEffect(() => {
    const maxDepth = 118;
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const prog = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      fillRef.current = 0.1 + 0.9 * prog;
      if (railFillRef.current) railFillRef.current.style.height = 8 + prog * 88 + "%";
      if (railHeadRef.current) railHeadRef.current.style.top = 8 + prog * 88 + "%";
      if (depthRef.current) depthRef.current.textContent = String(Math.round(prog * maxDepth)).padStart(2, "0") + " m";
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Hero count-up to the real on-chain total; reveal-on-scroll for [data-reveal].
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const target = Math.max(0, num(totalDeliveredLiters));
    const el = counterRef.current;
    if (el) {
      if (reduced || target === 0) el.textContent = target.toLocaleString();
      else {
        const t0 = performance.now();
        const step = (t: number) => {
          const k = Math.min(1, (t - t0) / 1600);
          el.textContent = Math.round(target * (1 - Math.pow(1 - k, 3))).toLocaleString();
          if (k < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }
    }
    const nodes = rootRef.current ? Array.from(rootRef.current.querySelectorAll<HTMLElement>("[data-reveal]")) : [];
    if (reduced || !("IntersectionObserver" in window)) {
      nodes.forEach((n) => (n.style.opacity = "1"));
      return;
    }
    nodes.forEach((n) => (n.style.opacity = "0"));
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            (e.target as HTMLElement).style.opacity = "";
            e.target.classList.add("yw-reveal");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.18 },
    );
    nodes.forEach((n) => io.observe(n));
    const fallback = setTimeout(() => nodes.forEach((n) => (n.style.opacity = "1")), 2500);
    return () => {
      io.disconnect();
      clearTimeout(fallback);
    };
  }, [totalDeliveredLiters]);

  const featuredRaised = featured ? pct(num(featured.raisedMist), num(featured.fundingGoalMist)) : 55;
  const featuredDelivered = featured ? pct(num(featured.deliveredLiters), num(featured.targetLiters)) : 100;

  return (
    <div ref={rootRef} className="relative bg-background text-foreground">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[1]"
        style={{
          background:
            "radial-gradient(120% 80% at 80% 0%,rgba(28,108,178,.16),transparent 55%),radial-gradient(90% 60% at 0% 100%,rgba(92,200,255,.06),transparent 60%)",
        }}
      />

      {/* marketing header */}
      <header className="fixed inset-x-0 top-0 z-[60] flex items-center justify-between gap-5 px-[clamp(18px,4vw,44px)] py-4 backdrop-blur-md"
        style={{ background: "linear-gradient(180deg,rgba(4,7,13,.82),rgba(4,7,13,0))" }}>
        <Link to="/" className="flex items-center gap-2.5">
          <YetiMark size={30} />
          <span className="font-mono text-sm font-bold tracking-[0.14em]">YETI&nbsp;WELLS</span>
        </Link>
        <nav className="hidden items-center gap-7 font-mono text-xs tracking-wide text-muted-foreground md:flex">
          <button onClick={scrollTo(howRef)} className="transition-colors hover:text-foreground">HOW IT WORKS</button>
          <button onClick={scrollTo(campaignsRef)} className="transition-colors hover:text-foreground">CAMPAIGNS</button>
          <button onClick={scrollTo(verifyRef)} className="transition-colors hover:text-foreground">VERIFY</button>
        </nav>
        <Link to="/campaigns" className="rounded-sm bg-primary px-4 py-2 font-mono text-xs font-bold tracking-wide text-primary-foreground">
          OPEN&nbsp;APP&nbsp;↗
        </Link>
      </header>

      {/* left depth rail */}
      <div className="pointer-events-none fixed bottom-0 left-0 top-0 z-40 hidden w-[74px] flex-col items-center px-0 pb-10 pt-24 lg:flex">
        <div className="relative w-0.5 flex-1" style={{ background: "linear-gradient(180deg,transparent,#172333 8%,#172333 92%,transparent)" }}>
          <div ref={railFillRef} className="absolute -left-px top-0 w-1 rounded" style={{ height: "8%", background: "linear-gradient(180deg,#5CC8FF,#1C6CB2)", boxShadow: "0 0 14px rgba(92,200,255,.6)" }} />
          <div ref={railHeadRef} className="absolute left-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1.5" style={{ top: "8%" }}>
            <span ref={depthRef} className="whitespace-nowrap rounded-sm border border-border bg-background px-1.5 py-0.5 font-mono text-[11px] font-bold text-sui">00 m</span>
            <span className="h-2.5 w-2.5 rounded-full bg-sui" style={{ boxShadow: "0 0 12px rgba(92,200,255,.9)" }} />
          </div>
        </div>
        <div className="mt-4 font-mono text-[9.5px] tracking-[0.34em] text-dim2" style={{ writingMode: "vertical-rl" }}>BOREHOLE&nbsp;DEPTH</div>
      </div>

      <div className="relative z-[5] mx-auto grid max-w-[1560px] grid-cols-1 pl-0 md:grid-cols-[minmax(0,1fr)_clamp(340px,40vw,560px)] md:pl-[clamp(74px,7vw,128px)]">
        <main className="col-start-1 min-w-0 px-[clamp(20px,3.2vw,52px)]">
          {/* hero */}
          <section className="flex min-h-screen flex-col justify-center py-[118px]">
            <div data-reveal className={`${kicker} mb-6 flex items-center gap-3 text-sui`}>
              <span className="inline-block h-px w-6 bg-sui" />VERIFIABLE&nbsp;PROOF-OF-IMPACT&nbsp;GIVING&nbsp;·&nbsp;ON&nbsp;SUI
            </div>
            <h1 data-reveal className="mb-7 font-display text-[clamp(2.7rem,6.7vw,5.7rem)] font-extrabold leading-[0.96] tracking-[-0.035em] text-balance">
              Proof you can<br />watch <span className="text-sui">rise.</span>
            </h1>
            <p data-reveal className="mb-9 max-w-[48ch] text-[clamp(1.02rem,1.18vw,1.24rem)] leading-relaxed text-muted-foreground">
              Give once to a clean-water campaign. Your money sits in on-chain escrow and releases{" "}
              <em className="not-italic text-foreground">only</em> when a tamper-proof machine signs that real liters
              were delivered — and your soulbound Impact NFT fills with verified water as it happens.
            </p>
            <div data-reveal className="mb-12 flex flex-wrap items-center gap-3.5">
              <button onClick={onSignIn} className="flex items-center gap-2.5 rounded-md bg-primary px-5 py-3.5 font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5">
                <span className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-full bg-primary-foreground font-mono text-[11px] font-bold text-primary">G</span>
                {account ? "Open the app" : "Sign in with Google"}
              </button>
              <button onClick={scrollTo(howRef)} className="rounded-md border border-border px-5 py-3.5 font-mono text-[13px] transition-colors hover:border-sui">
                See how proof works&nbsp;↓
              </button>
            </div>
            <div data-reveal className="flex flex-wrap items-baseline gap-x-3.5 gap-y-1.5 font-mono text-[13px] text-muted-foreground">
              <span className="text-[17px] font-bold text-foreground"><span ref={counterRef}>0</span>&nbsp;L</span>
              <span>proven on-chain</span><span className="text-border">/</span><span>0 gas</span>
              <span className="text-border">/</span><span>0 seed phrases</span>
            </div>
          </section>

          {/* thesis */}
          <section className="flex min-h-[92vh] flex-col justify-center py-[70px]">
            <div data-reveal className={`${kicker} mb-7 text-dim2`}>00&nbsp;—&nbsp;THE&nbsp;PROBLEM</div>
            <h2 data-reveal className="mb-7 max-w-[18ch] font-display text-[clamp(1.9rem,3.9vw,3.3rem)] font-bold leading-tight tracking-tight">
              Most giving asks you to trust a dashboard.
            </h2>
            <p data-reveal className="max-w-[54ch] text-[clamp(1.04rem,1.2vw,1.28rem)] leading-relaxed text-muted-foreground">
              You send money and <em className="italic text-foreground">hope</em> it became clean water. Yeti Wells
              closes that box with math. Donations release milestone-by-milestone — never on a promise, only on a
              cryptographic proof a real-world threshold was crossed. Not "trust us." Verify it yourself, on-chain.
            </p>
          </section>

          {/* how */}
          <section ref={howRef} className="flex min-h-screen flex-col justify-center py-20">
            <div data-reveal className={`${kicker} mb-4 text-sui`}>HOW&nbsp;PROOF&nbsp;WORKS&nbsp;·&nbsp;FOUR&nbsp;STEPS</div>
            <h2 data-reveal className="mb-12 max-w-[20ch] font-display text-[clamp(1.8rem,3.6vw,3rem)] font-bold leading-tight tracking-tight">
              From one tap to verified water.
            </h2>
            <div className="grid grid-cols-1 gap-px overflow-hidden rounded border border-border bg-border sm:grid-cols-2">
              {[
                ["01", "Give, gasless", "Sign in with Google (zkLogin). Donate in one tap. Enoki sponsors the gas — you never see a seed phrase, a wallet install, or a fee."],
                ["02", "A machine reads reality", "A registered TEE enclave reads the flow-meter and signs a milestone report with a key bound to its exact code — its measurements (PCRs) live on-chain."],
                ["03", "The chain verifies, escrow releases", "Move verifies the signature against the bound enclave. Change the code and the proof breaks. Funds release to the field partner; delivered liters advance."],
                ["04", "Your proof fills", "Your soulbound Impact NFT syncs from on-chain truth and fills with verified water. It can never be transferred — and never un-fills."],
              ].map(([n, t, d]) => (
                <div key={n} data-reveal className="flex min-h-[200px] flex-col bg-background p-[clamp(24px,2.4vw,34px)]">
                  <div className="mb-4 font-mono text-[13px] font-bold text-sui">{n}</div>
                  <div className="mb-3 font-display text-[1.18rem] font-semibold tracking-tight">{t}</div>
                  <p className="text-[0.97rem] leading-relaxed text-muted-foreground">{d}</p>
                </div>
              ))}
            </div>
          </section>

          {/* campaigns */}
          <section ref={campaignsRef} className="flex min-h-screen flex-col justify-center py-20">
            <div data-reveal className={`${kicker} mb-4 text-sui`}>OPEN&nbsp;CAMPAIGNS&nbsp;·&nbsp;ANYONE&nbsp;CAN&nbsp;LAUNCH&nbsp;ONE</div>
            <h2 data-reveal className="mb-10 max-w-[18ch] font-display text-[clamp(1.8rem,3.6vw,3rem)] font-bold leading-tight tracking-tight">
              Standout wells. Standing proof.
            </h2>
            <div data-reveal className="overflow-hidden rounded-md border border-border bg-card">
              <div className="relative h-[clamp(180px,26vw,300px)] overflow-hidden" style={{ background: "linear-gradient(135deg,#0E2238,#0A1828)" }}>
                <div className="absolute inset-0" style={{ backgroundImage: "repeating-linear-gradient(125deg,rgba(92,200,255,.07) 0 2px,transparent 2px 13px)" }} />
                <div className="absolute right-3.5 top-3.5 flex items-center gap-1.5 rounded-sm border border-sui/30 bg-sui/10 px-2.5 py-1 font-mono text-[10.5px] text-sui">
                  <span className="h-1.5 w-1.5 rounded-full bg-sui" style={{ boxShadow: "0 0 8px #5CC8FF" }} />TEE-VERIFIED
                </div>
              </div>
              <div className="p-[clamp(22px,2.6vw,34px)]">
                <div className="mb-3.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1.5">
                  <h3 className="font-display text-[clamp(1.25rem,2vw,1.7rem)] font-bold tracking-tight">{featured?.name ?? "Kibera Borehole №1"}</h3>
                  <span className="font-mono text-xs text-muted-foreground">{(featured?.location ?? "Nairobi, KE").toUpperCase()}</span>
                </div>
                <p className="mb-6 max-w-[52ch] leading-relaxed text-muted-foreground">
                  {featured?.description ?? "Solar-powered borehole serving ~1,200 people. Every milestone released only after a TEE-signed flow-meter reading cleared on-chain."}
                </p>
                <div className="mb-6 flex flex-col gap-4">
                  <div>
                    <div className="mb-2 flex justify-between font-mono text-xs text-muted-foreground">
                      <span>RAISED</span>
                      <span className="text-foreground">{featured ? `${mistToSui(featured.raisedMist)} / ${mistToSui(featured.fundingGoalMist)} SUI` : "0.55 / 1 SUI"}</span>
                    </div>
                    <div className="h-[5px] overflow-hidden rounded bg-secondary"><div className="h-full rounded bg-foreground transition-all duration-1000" style={{ width: `${featuredRaised}%` }} /></div>
                  </div>
                  <div>
                    <div className="mb-2 flex justify-between font-mono text-xs text-muted-foreground">
                      <span>VERIFIED&nbsp;DELIVERED</span>
                      <span className="text-sui">{featured ? `${num(featured.deliveredLiters).toLocaleString()} / ${num(featured.targetLiters).toLocaleString()} L` : "100,000 / 100,000 L"}</span>
                    </div>
                    <div className="h-[5px] overflow-hidden rounded bg-secondary"><div className="h-full rounded transition-all duration-1000" style={{ width: `${featuredDelivered}%`, background: "linear-gradient(90deg,#1C6CB2,#5CC8FF)", boxShadow: "0 0 12px rgba(92,200,255,.5)" }} /></div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2.5">
                  <button onClick={() => navigate(featured ? `/c/${featured.id}` : "/campaigns")} className="rounded-md bg-sui px-5 py-3 font-semibold text-background transition-transform hover:-translate-y-0.5">Donate · zero gas</button>
                  <Link to="/campaigns" className="rounded-md border border-border px-5 py-3 font-mono text-xs transition-colors hover:border-sui">Inspect the proof ↗</Link>
                </div>
              </div>
            </div>
            <div data-reveal className="mt-3.5 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <Link to="/campaigns" className="rounded-md border border-border bg-deep2 p-6 transition-colors hover:border-sui/40">
                <div className="mb-2.5 font-mono text-[11px] text-dim2">↗&nbsp;MARKETPLACE</div>
                <div className="mb-1.5 font-display text-[1.05rem] font-semibold">Browse every campaign</div>
                <p className="text-[0.92rem] leading-snug text-muted-foreground">Search, sort by liters proven, and give to any open well.</p>
              </Link>
              <Link to="/create" className="rounded-md border border-border bg-deep2 p-6 transition-colors hover:border-brass/40">
                <div className="mb-2.5 font-mono text-[11px] text-brass">+&nbsp;LAUNCH</div>
                <div className="mb-1.5 font-display text-[1.05rem] font-semibold">Start your own well</div>
                <p className="text-[0.92rem] leading-snug text-muted-foreground">Anyone signed in can launch a campaign — funds route to your address.</p>
              </Link>
            </div>
          </section>

          {/* nft */}
          <section className="flex min-h-screen flex-col justify-center py-20">
            <div data-reveal className={`${kicker} mb-4 text-sui`}>THE&nbsp;LIVING&nbsp;PROOF&nbsp;·&nbsp;SOULBOUND</div>
            <h2 data-reveal className="mb-7 max-w-[16ch] font-display text-[clamp(1.8rem,3.6vw,3rem)] font-bold leading-tight tracking-tight">A drop that becomes a glacier.</h2>
            <p data-reveal className="mb-10 max-w-[52ch] text-[clamp(1.02rem,1.18vw,1.24rem)] leading-relaxed text-muted-foreground">
              One Impact NFT per donor per campaign, bound to you forever. It fills with verified water as proven
              liters arrive, earns XP, and climbs a glacial tier ladder. It is monotonic — it can rise, but never drain.
            </p>
            <div data-reveal className="flex flex-wrap gap-3.5">
              {[
                ["CURRENT TIER", "River", "NEXT · GLACIER @ 10,000 XP", "text-sui"],
                ["FILL STATE", "100%", "VERIFIED WATER", "text-foreground"],
                ["LITERS ATTRIBUTED", "9,090", "YOUR SHARE, ON-CHAIN", "text-foreground"],
              ].map(([l, v, s, c]) => (
                <div key={l} className="min-w-[150px] flex-1 rounded-md border border-border bg-deep2 p-6">
                  <div className="mb-3.5 font-mono text-[11px] text-dim2">{l}</div>
                  <div className={`mb-1.5 font-display text-2xl font-bold ${c}`}>{v}</div>
                  <div className="font-mono text-[11px] text-muted-foreground">{s}</div>
                </div>
              ))}
            </div>
          </section>

          {/* verify */}
          <section ref={verifyRef} className="flex min-h-screen flex-col justify-center py-20">
            <div data-reveal className={`${kicker} mb-4 text-brass`}>DON'T&nbsp;TRUST.&nbsp;VERIFY.</div>
            <h2 data-reveal className="mb-7 max-w-[16ch] font-display text-[clamp(1.8rem,3.6vw,3rem)] font-bold leading-tight tracking-tight">Every liter has a receipt.</h2>
            <p data-reveal className="mb-9 max-w-[52ch] text-[1.06rem] leading-relaxed text-muted-foreground">
              Evidence photos and meter logs live immutably on Walrus. Each release links to its attestation
              transaction on Suiscan. The badge is honest: <span className="text-sui">Verified by TEE (AWS Nitro)</span>{" "}
              only when genuine hardware signed — otherwise <span className="text-brass">Released (demo signer)</span>.
            </p>
            <div data-reveal className="overflow-hidden rounded-md border border-border font-mono text-[12.5px]" style={{ background: "#060B14" }}>
              <div className="flex justify-between border-b border-border px-5 py-3 text-dim2"><span>ATTESTATION&nbsp;RECEIPT</span><span className="text-sui">● LIVE&nbsp;ON&nbsp;TESTNET</span></div>
              <div className="flex flex-col gap-2.5 px-5 pb-3.5 pt-1.5">
                {[
                  ["milestone_release_tx", "9xnbMKBR…UxiSBV ↗", "text-foreground"],
                  ["signer == project.enclave_id", "TRUE", "text-sui"],
                  ["ed25519_verify(report)", "PASS", "text-sui"],
                  ["delivered_liters", "+40,000 → 100,000", "text-foreground"],
                  ["evidence_blob (walrus)", "community handover ↗", "text-foreground"],
                ].map(([k, v, c]) => (
                  <div key={k} className="flex flex-wrap justify-between gap-3.5 text-muted-foreground"><span>{k}</span><span className={c}>{v}</span></div>
                ))}
              </div>
            </div>
          </section>
        </main>

        {/* sticky well-core stage */}
        <div className="col-start-1 min-w-0 md:col-start-2">
          <div className="sticky top-0 block h-[56vh] w-full md:h-screen">
            <WellCore fillRef={fillRef} />
          </div>
        </div>
      </div>

      {/* footer */}
      <footer className="relative z-[5] mt-10 border-t border-border px-[clamp(22px,5vw,80px)] pb-11 pt-[clamp(56px,8vw,110px)]" style={{ background: "linear-gradient(180deg,#04070D,#06101C)" }}>
        <div className="mx-auto grid max-w-[1280px] grid-cols-1 items-end gap-12 md:grid-cols-[1.4fr_1fr]">
          <div>
            <div className="mb-6 flex items-center gap-3.5">
              <YetiMark size={44} />
              <span className="font-mono text-lg font-bold tracking-[0.14em]">YETI&nbsp;WELLS</span>
            </div>
            <div className="mb-6 font-display text-[clamp(2rem,5vw,3.6rem)] font-bold leading-none tracking-tight">
              Every drop, <span className="text-sui">provable.</span>
            </div>
            <button onClick={onSignIn} className="inline-flex items-center gap-2.5 rounded-md bg-primary px-5 py-3.5 font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5">
              <span className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-full bg-primary-foreground font-mono text-[11px] font-bold text-primary">G</span>
              {account ? "Open the app" : "Sign in with Google"}
            </button>
          </div>
          <div className="font-mono text-xs leading-loose text-muted-foreground">
            <div className="mb-3.5 tracking-[0.14em] text-dim2">BUILT&nbsp;ON&nbsp;THE&nbsp;SUI&nbsp;STACK</div>
            <div className="flex flex-wrap gap-2">
              {["MOVE", "zkLOGIN", "ENOKI", "WALRUS", "NAUTILUS"].map((b) => (
                <span key={b} className="rounded-sm border border-border px-2.5 py-1">{b}</span>
              ))}
            </div>
            <div className="mt-6 text-dim2">© 2026 · TESTNET · VERIFY IT YOURSELF</div>
          </div>
        </div>
      </footer>
    </div>
  );
}
