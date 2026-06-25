import { MIST_PER_SUI } from "../config";

export function mistToSui(mist: string | number | bigint, dp = 2): string {
  const n = Number(BigInt(mist ?? 0)) / MIST_PER_SUI;
  return n.toLocaleString(undefined, { maximumFractionDigits: dp });
}

export function suiToMist(sui: number): bigint {
  return BigInt(Math.round(sui * MIST_PER_SUI));
}

export function shortAddr(a?: string | null): string {
  if (!a) return "";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function num(v: string | number | bigint | undefined): number {
  return Number(v ?? 0);
}

export function pct(part: number, whole: number): number {
  if (!whole) return 0;
  return Math.min(100, Math.round((part / whole) * 100));
}
