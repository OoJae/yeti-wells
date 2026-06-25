import { useSuiClientQuery, useCurrentAccount } from "@mysten/dapp-kit";
import { config, IMPACT_NFT_TYPE } from "../config";

/* eslint-disable @typescript-eslint/no-explicit-any */
const fields = (data: any): any => data?.data?.content?.fields;

export interface EvidenceView {
  blobId: string;
  mediaType: string;
  caption: string;
  milestoneIndex: number;
  timestampMs: string;
}

export interface ProjectView {
  name: string;
  location: string;
  description: string;
  raisedMist: string;
  deliveredLiters: string;
  targetLiters: string;
  fundingGoalMist: string;
  status: number;
  payout: string;
  evidence: EvidenceView[];
}

export function useProject() {
  const q = useSuiClientQuery(
    "getObject",
    { id: config.waterProjectId, options: { showContent: true } },
    { refetchInterval: 5000 },
  );
  const f = fields(q.data);
  const project: ProjectView | null = f
    ? {
        name: f.name,
        location: f.location,
        description: f.description,
        raisedMist: f.raised_mist,
        deliveredLiters: f.delivered_liters,
        targetLiters: f.target_liters,
        fundingGoalMist: f.funding_goal_mist,
        status: Number(f.status),
        payout: f.payout,
        evidence: (f.evidence ?? []).map((e: any) => {
          const x = e?.fields ?? e;
          return {
            blobId: x.blob_id,
            mediaType: x.media_type,
            caption: x.caption,
            milestoneIndex: Number(x.milestone_index),
            timestampMs: String(x.timestamp_ms),
          };
        }),
      }
    : null;
  return { ...q, project };
}

export function useRegistry() {
  const q = useSuiClientQuery(
    "getObject",
    { id: config.registryId, options: { showContent: true } },
    { refetchInterval: 5000 },
  );
  const f = fields(q.data);
  return {
    ...q,
    totalDeliveredLiters: (f?.total_delivered_liters ?? "0") as string,
    totalRaisedMist: (f?.total_raised_mist ?? "0") as string,
    projectCount: (f?.project_count ?? "0") as string,
  };
}

export interface NftView {
  id: string;
  donatedMist: string;
  litersAttributed: string;
  xp: string;
  tier: number;
  projectId: string;
}

export function useMyNft() {
  const account = useCurrentAccount();
  const q = useSuiClientQuery(
    "getOwnedObjects",
    {
      owner: account?.address ?? "",
      filter: { StructType: IMPACT_NFT_TYPE },
      options: { showContent: true },
    },
    { enabled: !!account, refetchInterval: 5000 },
  );
  const obj: any = q.data?.data?.[0];
  const f = obj?.data?.content?.fields;
  const nft: NftView | null = f
    ? {
        id: obj.data.objectId,
        donatedMist: f.donated_mist,
        litersAttributed: f.liters_attributed,
        xp: f.xp,
        tier: Number(f.tier),
        projectId: f.project_id,
      }
    : null;
  return { ...q, nft };
}
