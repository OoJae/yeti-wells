/**
 * The Impact NFT centerpiece: a Yeti snow globe that fills with water as verified liters arrive.
 * Pure/presentational — driven by `fillPercent` (0..100) and `tier` (0..3). The water rises smoothly
 * (CSS transition on the water group's translateY) with two animated sine-wave surfaces (ripple).
 */
interface WaterGlobeProps {
  fillPercent: number;
  tier: number;
  size?: number;
}

// Globe geometry in viewBox units.
const CX = 100;
const CY = 100;
const R = 82;
const BOTTOM = CY + R; // 182

// Tier-tinted water [light, deep].
const WATER_BY_TIER: [string, string][] = [
  ["#8ad4ff", "#3aa0e0"], // 0 Spring
  ["#5cc0ff", "#2b86d6"], // 1 Stream
  ["#49a8f2", "#1f6fc7"], // 2 River
  ["#9af0ff", "#2bb6d9"], // 3 Glacier (icy bright)
];

function buildWave(amp: number): string {
  const w = 40; // wavelength — matches the translateX keyframe for seamless looping
  let d = "M -60 0";
  for (let x = -60; x < 260; x += w) {
    d += ` q ${w / 4} ${-amp} ${w / 2} 0 t ${w / 2} 0`;
  }
  d += " L 260 220 L -60 220 Z";
  return d;
}

const WAVE = buildWave(7);

export function WaterGlobe({ fillPercent, tier, size = 200 }: WaterGlobeProps) {
  const fill = Math.max(0, Math.min(100, fillPercent));
  const waterTopY = BOTTOM - (fill / 100) * (R * 2); // surface y in viewBox units
  const [light, deep] = WATER_BY_TIER[Math.max(0, Math.min(3, tier))];

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 210"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={`Impact globe, ${Math.round(fill)}% full`}
    >
      <defs>
        <clipPath id="yw-globe-clip">
          <circle cx={CX} cy={CY} r={R - 3} />
        </clipPath>
        <linearGradient id="yw-water" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={light} />
          <stop offset="1" stopColor={deep} />
        </linearGradient>
        <radialGradient id="yw-glass" cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.18" />
          <stop offset="0.6" stopColor="#bfe6ff" stopOpacity="0.04" />
          <stop offset="1" stopColor="#0a0a0a" stopOpacity="0.25" />
        </radialGradient>
        <linearGradient id="yw-base" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a4656" />
          <stop offset="1" stopColor="#1b2330" />
        </linearGradient>
      </defs>

      {/* Pedestal */}
      <path d="M64 176 H136 L150 202 H50 Z" fill="url(#yw-base)" stroke="#0c1118" strokeWidth="1.5" />
      <ellipse cx={CX} cy="176" rx="38" ry="7" fill="#2a3340" />

      {/* Glass sphere backing */}
      <circle cx={CX} cy={CY} r={R} fill="url(#yw-glass)" />

      {/* Interior */}
      <g clipPath="url(#yw-globe-clip)">
        {/* Snow floor */}
        <ellipse cx={CX} cy={BOTTOM - 12} rx={R} ry="26" fill="#e8f4ff" opacity="0.9" />
        <ellipse cx={CX} cy={BOTTOM - 6} rx={R} ry="20" fill="#ffffff" />

        {/* Yeti silhouette (gets submerged as water rises) */}
        <g>
          {/* body */}
          <path
            d="M70 168 C66 132 72 108 100 108 C128 108 134 132 130 168 Z"
            fill="#eaf6ff"
            stroke="#cfe6f7"
            strokeWidth="1"
          />
          {/* arms */}
          <ellipse cx="69" cy="146" rx="8" ry="16" fill="#eaf6ff" />
          <ellipse cx="131" cy="146" rx="8" ry="16" fill="#eaf6ff" />
          {/* face patch */}
          <ellipse cx="100" cy="132" rx="20" ry="18" fill="#ffffff" />
          {/* eyes */}
          <circle cx="92" cy="130" r="3.2" fill="#22303f" />
          <circle cx="108" cy="130" r="3.2" fill="#22303f" />
          {/* cheeks */}
          <circle cx="86" cy="139" r="3" fill="#bfe3ff" opacity="0.8" />
          <circle cx="114" cy="139" r="3" fill="#bfe3ff" opacity="0.8" />
          {/* mouth */}
          <path d="M95 140 q5 4 10 0" stroke="#22303f" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        </g>

        {/* Water — translated to the surface height; rises smoothly via CSS transition */}
        <g
          style={{
            transform: `translateY(${waterTopY}px)`,
            transition: "transform 1200ms cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        >
          <path className="yw-wave-back" d={WAVE} fill="url(#yw-water)" opacity="0.45" />
          <path className="yw-wave-front" d={WAVE} fill="url(#yw-water)" opacity="0.8" />
        </g>
      </g>

      {/* Frost rim + glass highlight (on top of everything) */}
      <circle cx={CX} cy={CY} r={R} fill="none" stroke="#bfe6ff" strokeWidth="2.5" opacity="0.85" />
      <circle cx={CX} cy={CY} r={R - 1.5} fill="none" stroke="#ffffff" strokeWidth="1" opacity="0.25" />
      <path d={`M${CX - 40} ${CY - 58} A 70 70 0 0 1 ${CX + 44} ${CY - 52}`} stroke="#ffffff" strokeWidth="3" strokeLinecap="round" opacity="0.35" fill="none" />

      {/* snow specks */}
      <circle cx="74" cy="56" r="1.6" fill="#ffffff" opacity="0.8" />
      <circle cx="126" cy="64" r="1.3" fill="#ffffff" opacity="0.7" />
      <circle cx="138" cy="104" r="1.5" fill="#ffffff" opacity="0.6" />
    </svg>
  );
}
