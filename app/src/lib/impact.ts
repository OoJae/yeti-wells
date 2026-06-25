// Pure impact math — mirrors yeti_wells::impact_nft (u128 intermediate) exactly so the UI matches on-chain.
import { TIER_LABELS } from "../config";

// XP tier thresholds — MUST match impact_nft.move (TIER1/2/3_XP).
const TIER1 = 100n;
const TIER2 = 1_000n;
const TIER3 = 10_000n;

export function tierFor(xp: bigint): number {
  if (xp >= TIER3) return 3;
  if (xp >= TIER2) return 2;
  if (xp >= TIER1) return 1;
  return 0;
}

/** Lower/upper XP bounds of a tier, for the progress bar. tier 3 is max (no upper bound). */
export function tierRange(tier: number): { from: bigint; to: bigint | null } {
  switch (tier) {
    case 0:
      return { from: 0n, to: TIER1 };
    case 1:
      return { from: TIER1, to: TIER2 };
    case 2:
      return { from: TIER2, to: TIER3 };
    default:
      return { from: TIER3, to: null };
  }
}

export interface ProjectImpactInputs {
  deliveredLiters: string | number | bigint;
  raisedMist: string | number | bigint;
  targetLiters: string | number | bigint;
}

export interface ComputedImpact {
  attributed: bigint; // donor's share of delivered liters
  xp: bigint;
  tier: number;
  tierLabel: string;
  fillPercent: number; // 0..100 — min(100, delivered/target); = donor's personal completion
  tierProgressPercent: number; // 0..100 within the current tier band
}

const big = (v: string | number | bigint): bigint => BigInt(v ?? 0);

export function computeImpact(p: ProjectImpactInputs, donatedMist: string | number | bigint): ComputedImpact {
  const delivered = big(p.deliveredLiters);
  const raised = big(p.raisedMist);
  const target = big(p.targetLiters);
  const donated = big(donatedMist);

  const attributed = raised > 0n ? (delivered * donated) / raised : 0n;
  const xp = attributed;
  const tier = tierFor(xp);

  const fillPercent =
    target > 0n ? Math.min(100, Number((delivered * 100n) / target)) : 0;

  const { from, to } = tierRange(tier);
  const tierProgressPercent =
    to === null ? 100 : Math.min(100, Number(((xp - from) * 100n) / (to - from)));

  return { attributed, xp, tier, tierLabel: TIER_LABELS[tier] ?? "Spring", fillPercent, tierProgressPercent };
}
