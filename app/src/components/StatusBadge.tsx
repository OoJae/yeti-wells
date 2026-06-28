/** Derived campaign status, from on-chain delivered/target liters. */
export type CampaignStatus = "fundraising" | "delivering" | "delivered";

export function campaignStatus(delivered: number, target: number): CampaignStatus {
  if (target > 0 && delivered >= target) return "delivered";
  if (delivered > 0) return "delivering";
  return "fundraising";
}

const STYLES: Record<CampaignStatus, { label: string; cls: string }> = {
  fundraising: { label: "Fundraising", cls: "bg-secondary text-muted-foreground" },
  delivering: { label: "Delivering", cls: "bg-sui/15 text-sui" },
  delivered: { label: "Fully delivered", cls: "bg-sui/25 text-sui" },
};

export function StatusBadge({
  delivered,
  target,
  status: _status,
}: {
  delivered: number;
  target: number;
  status?: number;
}) {
  const s = STYLES[campaignStatus(delivered, target)];
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${s.cls}`}>{s.label}</span>
  );
}
