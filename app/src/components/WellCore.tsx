import { useEffect, useRef, type RefObject } from "react";

/**
 * The landing "well core" — a tall capsule of rising water with a floating Yeti, drawn on canvas (ported
 * from the brand design). `fillRef` (0..1, the scroll-driven target, updated imperatively so scrolling
 * doesn't re-render React) is lerped smoothly; the % readout + the "VERIFIED BY TEE" seal update from the
 * lerped value. Fills the height of its (sticky) parent.
 */
export function WellCore({ fillRef, label = "WELL CORE №01", sublabel = "KIBERA · SOLAR BOREHOLE" }: {
  fillRef: RefObject<number>;
  label?: string;
  sublabel?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pctRef = useRef<HTMLSpanElement>(null);
  const sealRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let raf = 0;
    let phase = 0;
    let water = 0.1;
    let cw = 1, ch = 1;
    const bubbles = Array.from({ length: 16 }, () => ({
      x: Math.random(), y: Math.random(), r: 0.6 + Math.random() * 2.2,
      sp: 0.0012 + Math.random() * 0.0026, drift: (Math.random() - 0.5) * 0.0006,
    }));

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cw = w; ch = h;
    };
    resize();
    window.addEventListener("resize", resize, { passive: true });

    const drawYeti = (cx: number, surfaceY: number, tubeW: number) => {
      const R = tubeW * 0.19;
      const bob = reduced ? 0 : Math.sin(phase) * 4;
      const cy = surfaceY - R * 0.18 + bob;
      const tilt = reduced ? 0 : Math.sin(phase * 0.7) * 0.05;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(tilt);
      ctx.save(); ctx.globalAlpha = 0.12; ctx.scale(1, -1);
      ctx.beginPath(); ctx.ellipse(0, R * 1.3, R * 0.95, R * 1.05, 0, 0, Math.PI * 2); ctx.fillStyle = "#EAF6FF"; ctx.fill();
      ctx.restore();
      ctx.fillStyle = "#EAF6FF";
      ctx.beginPath(); ctx.ellipse(-R * 0.62, -R * 0.7, R * 0.26, R * 0.3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(R * 0.62, -R * 0.7, R * 0.26, R * 0.3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(0, 0, R * 0.95, R * 1.06, 0, 0, Math.PI * 2); ctx.fillStyle = "#EDF6FF"; ctx.fill();
      const rim = ctx.createRadialGradient(-R * 0.3, -R * 0.3, 1, -R * 0.3, -R * 0.3, R * 1.1);
      rim.addColorStop(0, "rgba(255,255,255,0.5)"); rim.addColorStop(1, "rgba(255,255,255,0)");
      ctx.beginPath(); ctx.ellipse(-R * 0.18, -R * 0.12, R * 0.7, R * 0.8, 0, 0, Math.PI * 2); ctx.fillStyle = rim; ctx.fill();
      ctx.fillStyle = "#0A1622";
      ctx.beginPath(); ctx.ellipse(-R * 0.34, -R * 0.06, R * 0.12, R * 0.16, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(R * 0.34, -R * 0.06, R * 0.12, R * 0.16, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.beginPath(); ctx.arc(-R * 0.3, -R * 0.12, R * 0.04, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(R * 0.38, -R * 0.12, R * 0.04, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#0A1622"; ctx.lineWidth = Math.max(1.2, R * 0.05); ctx.lineCap = "round";
      ctx.beginPath(); ctx.arc(0, R * 0.12, R * 0.32, 0.18 * Math.PI, 0.82 * Math.PI); ctx.stroke();
      ctx.fillStyle = "rgba(120,200,255,0.35)";
      ctx.beginPath(); ctx.arc(-R * 0.5, R * 0.16, R * 0.12, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(R * 0.5, R * 0.16, R * 0.12, 0, Math.PI * 2); ctx.fill();
      ctx.save();
      ctx.beginPath(); ctx.rect(-R * 1.2, R * 0.18 - bob, R * 2.4, R * 2); ctx.clip();
      ctx.beginPath(); ctx.ellipse(0, 0, R * 0.97, R * 1.08, 0, 0, Math.PI * 2); ctx.fillStyle = "rgba(60,150,220,0.32)"; ctx.fill();
      ctx.restore();
      ctx.restore();
    };

    const draw = () => {
      const W = cw, H = ch;
      ctx.clearRect(0, 0, W, H);
      const tubeW = Math.min(W * 0.66, 300);
      const tx = (W - tubeW) / 2;
      const top = H * 0.05, bot = H * 0.88, tubeH = bot - top;
      const r = tubeW / 2;
      const waterTop = bot - water * tubeH;

      const g0 = ctx.createRadialGradient(W / 2, H * 0.42, 10, W / 2, H * 0.42, tubeW * 1.5);
      g0.addColorStop(0, "rgba(28,108,178,0.2)"); g0.addColorStop(1, "rgba(28,108,178,0)");
      ctx.fillStyle = g0; ctx.fillRect(0, 0, W, H);

      const tubePath = () => {
        ctx.beginPath();
        ctx.moveTo(tx, top + r);
        ctx.arc(tx + r, top + r, r, Math.PI, 0);
        ctx.lineTo(tx + tubeW, bot - r);
        ctx.arc(tx + r, bot - r, r, 0, Math.PI);
        ctx.closePath();
      };

      ctx.save(); tubePath(); ctx.clip();
      const inner = ctx.createLinearGradient(0, top, 0, bot);
      inner.addColorStop(0, "rgba(16,26,42,0.5)"); inner.addColorStop(1, "rgba(6,11,20,0.82)");
      ctx.fillStyle = inner; ctx.fillRect(tx, top, tubeW, tubeH);
      const vol = ctx.createLinearGradient(tx, 0, tx + tubeW, 0);
      vol.addColorStop(0, "rgba(150,205,255,0.16)"); vol.addColorStop(0.5, "rgba(150,205,255,0)"); vol.addColorStop(1, "rgba(150,205,255,0.11)");
      ctx.fillStyle = vol; ctx.fillRect(tx, top, tubeW, tubeH);
      ctx.restore();

      ctx.save(); tubePath(); ctx.clip();
      const wg = ctx.createLinearGradient(0, waterTop, 0, bot);
      wg.addColorStop(0, "#7FD8FF"); wg.addColorStop(0.12, "#5CC8FF"); wg.addColorStop(0.6, "#2C86C8"); wg.addColorStop(1, "#103E66");
      ctx.fillStyle = wg; ctx.fillRect(tx, waterTop, tubeW, bot - waterTop);
      const amp = reduced ? 0 : 5;
      ctx.beginPath(); ctx.moveTo(tx, waterTop);
      for (let x = 0; x <= tubeW; x += 6) {
        const xn = x / tubeW;
        const y = waterTop + Math.sin(xn * Math.PI * 3 + phase) * amp + Math.sin(xn * Math.PI * 7 - phase * 1.4) * amp * 0.45;
        ctx.lineTo(tx + x, y);
      }
      ctx.lineTo(tx + tubeW, bot); ctx.lineTo(tx, bot); ctx.closePath();
      ctx.fillStyle = wg; ctx.fill();
      ctx.beginPath();
      for (let x = 0; x <= tubeW; x += 6) {
        const xn = x / tubeW;
        const y = waterTop + Math.sin(xn * Math.PI * 3 + phase) * amp + Math.sin(xn * Math.PI * 7 - phase * 1.4) * amp * 0.45;
        if (x === 0) ctx.moveTo(tx + x, y); else ctx.lineTo(tx + x, y);
      }
      ctx.strokeStyle = "rgba(220,245,255,0.7)"; ctx.lineWidth = 1.5; ctx.stroke();
      for (let i = 0; i < 3; i++) {
        const yy = waterTop + (bot - waterTop) * (0.18 + i * 0.26) + Math.sin(phase * 0.8 + i) * 6;
        ctx.fillStyle = "rgba(180,230,255,0.06)"; ctx.fillRect(tx, yy, tubeW, 2.5);
      }
      bubbles.forEach((b) => {
        if (!reduced) { b.y -= b.sp; b.x += b.drift; }
        if (b.y < 0) { b.y = 1; b.x = Math.random(); }
        const by = bot - b.y * (bot - waterTop);
        if (by > waterTop + 2) {
          const bx = tx + (0.12 + b.x * 0.76) * tubeW;
          ctx.beginPath(); ctx.arc(bx, by, b.r, 0, Math.PI * 2); ctx.fillStyle = "rgba(225,245,255,0.35)"; ctx.fill();
        }
      });
      drawYeti(tx + tubeW / 2, waterTop, tubeW);
      ctx.restore();

      ctx.fillStyle = "rgba(126,146,168,0.5)"; ctx.strokeStyle = "rgba(126,146,168,0.28)";
      for (let i = 0; i <= 10; i++) {
        const ty2 = top + (tubeH * i) / 10;
        const len = i % 5 === 0 ? 14 : 8;
        ctx.beginPath(); ctx.moveTo(tx + tubeW - 2, ty2); ctx.lineTo(tx + tubeW - 2 - len, ty2); ctx.lineWidth = 1; ctx.stroke();
      }

      ctx.save(); tubePath(); ctx.clip();
      const capTop = ctx.createLinearGradient(0, top, 0, top + r * 1.3);
      capTop.addColorStop(0, "rgba(222,243,255,0.24)"); capTop.addColorStop(1, "rgba(222,243,255,0)");
      ctx.fillStyle = capTop; ctx.fillRect(tx, top, tubeW, r * 1.4);
      const spec = ctx.createLinearGradient(tx, 0, tx + tubeW * 0.45, 0);
      spec.addColorStop(0, "rgba(255,255,255,0.18)"); spec.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = spec; ctx.fillRect(tx, top, tubeW * 0.45, tubeH);
      const spec2 = ctx.createLinearGradient(tx + tubeW * 0.78, 0, tx + tubeW, 0);
      spec2.addColorStop(0, "rgba(255,255,255,0)"); spec2.addColorStop(1, "rgba(255,255,255,0.12)");
      ctx.fillStyle = spec2; ctx.fillRect(tx + tubeW * 0.78, top, tubeW * 0.22, tubeH);
      ctx.restore();
      tubePath(); ctx.strokeStyle = "rgba(92,200,255,0.16)"; ctx.lineWidth = 5; ctx.stroke();
      tubePath(); ctx.strokeStyle = "rgba(196,228,255,0.5)"; ctx.lineWidth = 1.6; ctx.stroke();
    };

    const loop = () => {
      water += (Math.max(0, Math.min(1, fillRef.current ?? 0.1)) - water) * (reduced ? 1 : 0.075);
      if (!reduced) phase += 0.018;
      draw();
      if (pctRef.current) pctRef.current.textContent = Math.round(water * 100) + "%";
      if (sealRef.current) sealRef.current.style.opacity = water > 0.9 ? "1" : "0";
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }} />
      <div className="pointer-events-none absolute left-5 top-24 font-mono text-[10.5px] leading-relaxed tracking-[0.12em] text-muted-foreground">
        {label}
        <br />
        <span className="text-dim2">{sublabel}</span>
      </div>
      <div
        ref={sealRef}
        className="pointer-events-none absolute right-5 top-24 flex items-center gap-1.5 rounded-sm border border-brass/40 px-2 py-1 font-mono text-[10px] tracking-[0.1em] text-brass opacity-0 transition-opacity duration-500"
      >
        ✓ VERIFIED BY TEE
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-9 flex flex-col items-center gap-0.5">
        <span ref={pctRef} className="font-display text-5xl font-extrabold leading-none tracking-tight text-foreground">8%</span>
        <span className="font-mono text-[10.5px] tracking-[0.14em] text-sui">VERIFIED WATER</span>
      </div>
    </div>
  );
}
