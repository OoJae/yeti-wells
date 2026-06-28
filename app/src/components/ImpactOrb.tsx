import { useEffect, useRef } from "react";

/**
 * The Impact NFT globe — an HTML-canvas orb of rising water with a floating Yeti, ported from the brand
 * design. Drop-in replacement for the old SVG WaterGlobe: same `{ fillPercent, tier?, size }` API.
 * `seed` varies the bubble pattern per orb (for galleries). Water stays cyan; tier is shown by the caller.
 */
export function ImpactOrb({
  fillPercent,
  size = 200,
  seed = 0,
}: {
  fillPercent: number; // 0..100
  tier?: number;
  size?: number;
  seed?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const targetRef = useRef(fillPercent);
  targetRef.current = fillPercent;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let raf = 0;
    let phase = seed;
    let cw = size;
    let ch = size;
    // lerped water level 0..1 (so a donation visibly raises the globe)
    let water = Math.max(0.1, Math.min(0.94, (targetRef.current / 100) * 0.94));
    const bubbles = Array.from({ length: 14 }, () => ({
      a: Math.random() * Math.PI * 2,
      rr: Math.random(),
      y: Math.random(),
      r: 0.5 + Math.random() * 1.8,
      sp: 0.0016 + Math.random() * 0.003,
    }));

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth || size;
      const h = canvas.clientHeight || size;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cw = w;
      ch = h;
    };
    resize();
    window.addEventListener("resize", resize, { passive: true });

    const drawYeti = (cx: number, surfaceY: number, R: number, ph: number) => {
      const r = R * 0.26;
      const bob = reduced ? 0 : Math.sin(ph) * 3;
      const cyy = surfaceY - r * 0.16 + bob;
      const tilt = reduced ? 0 : Math.sin(ph * 0.7) * 0.05;
      ctx.save();
      ctx.translate(cx, cyy);
      ctx.rotate(tilt);
      ctx.fillStyle = "#EDF6FF";
      ctx.beginPath(); ctx.ellipse(-r * 0.6, -r * 0.7, r * 0.26, r * 0.3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(r * 0.6, -r * 0.7, r * 0.26, r * 0.3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(0, 0, r * 0.95, r * 1.06, 0, 0, Math.PI * 2); ctx.fillStyle = "#EDF6FF"; ctx.fill();
      const rim = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 1, -r * 0.3, -r * 0.3, r * 1.1);
      rim.addColorStop(0, "rgba(255,255,255,0.5)"); rim.addColorStop(1, "rgba(255,255,255,0)");
      ctx.beginPath(); ctx.ellipse(-r * 0.18, -r * 0.12, r * 0.7, r * 0.8, 0, 0, Math.PI * 2); ctx.fillStyle = rim; ctx.fill();
      ctx.fillStyle = "#0A1622";
      ctx.beginPath(); ctx.ellipse(-r * 0.34, -r * 0.06, r * 0.12, r * 0.16, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(r * 0.34, -r * 0.06, r * 0.12, r * 0.16, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.beginPath(); ctx.arc(-r * 0.3, -r * 0.12, r * 0.04, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(r * 0.38, -r * 0.12, r * 0.04, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#0A1622"; ctx.lineWidth = Math.max(1.1, r * 0.05); ctx.lineCap = "round";
      ctx.beginPath(); ctx.arc(0, r * 0.12, r * 0.32, 0.18 * Math.PI, 0.82 * Math.PI); ctx.stroke();
      ctx.fillStyle = "rgba(120,200,255,0.35)";
      ctx.beginPath(); ctx.arc(-r * 0.5, r * 0.16, r * 0.12, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(r * 0.5, r * 0.16, r * 0.12, 0, Math.PI * 2); ctx.fill();
      ctx.save();
      ctx.beginPath(); ctx.rect(-r * 1.2, r * 0.18 - bob, r * 2.4, r * 2.2); ctx.clip();
      ctx.beginPath(); ctx.ellipse(0, 0, r * 0.97, r * 1.08, 0, 0, Math.PI * 2); ctx.fillStyle = "rgba(60,150,220,0.32)"; ctx.fill();
      ctx.restore();
      ctx.restore();
    };

    const draw = () => {
      const W = cw, H = ch;
      const target = Math.max(0.1, Math.min(0.94, (targetRef.current / 100) * 0.94));
      water += (target - water) * (reduced ? 1 : 0.08);
      ctx.clearRect(0, 0, W, H);
      const cx = W / 2, cy = H / 2, R = Math.min(W, H) / 2 - 3;

      const og = ctx.createRadialGradient(cx, cy, R * 0.6, cx, cy, R * 1.3);
      og.addColorStop(0, "rgba(40,130,200,0.22)"); og.addColorStop(1, "rgba(40,130,200,0)");
      ctx.fillStyle = og; ctx.beginPath(); ctx.arc(cx, cy, R * 1.3, 0, Math.PI * 2); ctx.fill();

      ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip();
      const base = ctx.createLinearGradient(0, cy - R, 0, cy + R);
      base.addColorStop(0, "rgba(18,28,44,0.7)"); base.addColorStop(1, "rgba(6,11,20,0.92)");
      ctx.fillStyle = base; ctx.fillRect(cx - R, cy - R, R * 2, R * 2);

      const waterTop = cy + R - water * (2 * R);
      const wg = ctx.createLinearGradient(0, waterTop, 0, cy + R);
      wg.addColorStop(0, "#7FD8FF"); wg.addColorStop(0.14, "#5CC8FF"); wg.addColorStop(0.6, "#2C86C8"); wg.addColorStop(1, "#103E66");
      const amp = reduced ? 0 : 4;
      ctx.beginPath(); ctx.moveTo(cx - R, waterTop);
      for (let x = -R; x <= R; x += 6) {
        const xn = (x + R) / (2 * R);
        const y = waterTop + Math.sin(xn * Math.PI * 3 + phase) * amp + Math.sin(xn * Math.PI * 7 - phase * 1.3) * amp * 0.4;
        ctx.lineTo(cx + x, y);
      }
      ctx.lineTo(cx + R, cy + R); ctx.lineTo(cx - R, cy + R); ctx.closePath();
      ctx.fillStyle = wg; ctx.fill();
      ctx.beginPath();
      for (let x = -R; x <= R; x += 6) {
        const xn = (x + R) / (2 * R);
        const y = waterTop + Math.sin(xn * Math.PI * 3 + phase) * amp + Math.sin(xn * Math.PI * 7 - phase * 1.3) * amp * 0.4;
        if (x === -R) ctx.moveTo(cx + x, y); else ctx.lineTo(cx + x, y);
      }
      ctx.strokeStyle = "rgba(220,245,255,0.7)"; ctx.lineWidth = 1.3; ctx.stroke();

      bubbles.forEach((b) => {
        const by = cy + R - (((b.y + seed * 0.13) % 1)) * (cy + R - waterTop);
        const bx = cx + Math.cos(b.a + seed) * R * 0.62 * b.rr;
        if (by > waterTop + 2 && (bx - cx) * (bx - cx) + (by - cy) * (by - cy) < R * R * 0.9) {
          ctx.beginPath(); ctx.arc(bx, by, b.r, 0, Math.PI * 2); ctx.fillStyle = "rgba(225,245,255,0.3)"; ctx.fill();
        }
      });
      if (!reduced) bubbles.forEach((b) => { b.y -= b.sp; if (b.y < 0) b.y = 1; });

      drawYeti(cx, waterTop, R, phase);

      const is = ctx.createRadialGradient(cx, cy, R * 0.55, cx, cy, R);
      is.addColorStop(0, "rgba(0,0,0,0)"); is.addColorStop(1, "rgba(0,0,0,0.4)");
      ctx.fillStyle = is; ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
      const sp = ctx.createRadialGradient(cx - R * 0.4, cy - R * 0.5, 1, cx - R * 0.4, cy - R * 0.5, R * 0.9);
      sp.addColorStop(0, "rgba(255,255,255,0.22)"); sp.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = sp; ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
      ctx.restore();

      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.strokeStyle = "rgba(92,200,255,0.18)"; ctx.lineWidth = 5; ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.strokeStyle = "rgba(200,230,255,0.55)"; ctx.lineWidth = 1.4; ctx.stroke();
    };

    const loop = () => {
      if (!reduced) phase += 0.02;
      draw();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [size, seed]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: size, height: size, display: "block" }}
      role="img"
      aria-label={`Impact globe, ${Math.round(fillPercent)}% full`}
    />
  );
}
