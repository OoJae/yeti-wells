import { useSuiClientQuery, useSuiClient, useCurrentAccount } from "@mysten/dapp-kit";
import { useQuery } from "@tanstack/react-query";
import {
  config,
  IMPACT_NFT_TYPE,
  PROJECT_CREATED_EVENT,
  DONATION_EVENT,
  MILESTONE_ATTESTED_V2_EVENT,
  PROJECT_DENYLIST,
} from "../config";

/* eslint-disable @typescript-eslint/no-explicit-any */
const fields = (data: any): any => data?.data?.content?.fields;

/** Page through queryEvents (50/page max) up to `cap`, so Browse/leaderboards don't silently truncate (FE-03). */
async function queryAllEvents(client: any, eventType: string, cap: number): Promise<any[]> {
  const out: any[] = [];
  let cursor: any = null;
  for (let i = 0; i < 30 && out.length < cap; i++) {
    const page = await client.queryEvents({ query: { MoveEventType: eventType }, cursor, limit: 50, order: "descending" });
    out.push(...(page.data ?? []));
    if (!page.hasNextPage || !page.nextCursor) break;
    cursor = page.nextCursor;
  }
  return out;
}

/** multiGetObjects in chunks of 50 (the RPC per-call cap). */
async function multiGet(client: any, ids: string[]): Promise<any[]> {
  const out: any[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const r = await client.multiGetObjects({ ids: ids.slice(i, i + 50), options: { showContent: true } });
    out.push(...r);
  }
  return out;
}

export interface EvidenceView {
  blobId: string;
  mediaType: string;
  caption: string;
  milestoneIndex: number;
  timestampMs: string;
}

export interface MilestoneView {
  index: number;
  description: string;
  litersThreshold: number;
  releaseMist: string;
  released: boolean;
}

export interface ProjectView {
  id: string;
  name: string;
  location: string;
  description: string;
  imageBlobId: string;
  raisedMist: string;
  deliveredLiters: string;
  targetLiters: string;
  fundingGoalMist: string;
  status: number;
  payout: string;
  steward: string;
  evidence: EvidenceView[];
  milestones: MilestoneView[];
}

/** Map a getObject / multiGetObjects element (`{ data: { objectId, content: { fields } } }`) to a ProjectView. */
function mapProjectObj(obj: any): ProjectView | null {
  const f = obj?.data?.content?.fields;
  if (!f) return null;
  return {
    id: obj.data.objectId,
    name: f.name,
    location: f.location,
    description: f.description,
    imageBlobId: f.image_blob_id ?? "",
    raisedMist: f.raised_mist,
    deliveredLiters: f.delivered_liters,
    targetLiters: f.target_liters,
    fundingGoalMist: f.funding_goal_mist,
    status: Number(f.status),
    payout: f.payout,
    steward: f.steward,
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
    milestones: (f.milestones ?? []).map((m: any) => {
      const x = m?.fields ?? m;
      return {
        index: Number(x.index),
        description: x.description,
        litersThreshold: Number(x.liters_threshold),
        releaseMist: String(x.release_mist),
        released: !!x.released,
      };
    }),
  };
}

/** A single campaign by id (used by the detail page + cards). */
export function useProject(projectId: string) {
  const q = useSuiClientQuery(
    "getObject",
    { id: projectId, options: { showContent: true } },
    { refetchInterval: 5000, enabled: !!projectId },
  );
  return { ...q, project: mapProjectObj(q.data) };
}

/** All campaigns: enumerate ProjectCreated events (paginated), drop denylisted demos, fetch each object. */
export function useProjects() {
  const client = useSuiClient();
  const ev = useQuery({
    queryKey: ["yw-project-events"],
    queryFn: () => queryAllEvents(client, PROJECT_CREATED_EVENT, 1000),
    refetchInterval: 10000,
  });
  const ids = [
    ...new Set(
      ((ev.data ?? []) as any[]).map((e) => e.parsedJson?.project_id as string | undefined).filter((id): id is string => !!id),
    ),
  ].filter((id) => !PROJECT_DENYLIST.has(id.toLowerCase()));

  const objs = useQuery({
    queryKey: ["yw-project-objs", ids.join(",")],
    queryFn: () => multiGet(client, ids),
    enabled: ids.length > 0,
    refetchInterval: 8000,
  });
  const projects = ((objs.data ?? []) as any[]).map(mapProjectObj).filter((p): p is ProjectView => !!p);
  return {
    projects,
    isPending: ev.isPending || (ids.length > 0 && objs.isPending),
    error: ev.error ?? objs.error,
  };
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

function mapNft(obj: any): NftView | null {
  const f = obj?.data?.content?.fields;
  if (!f) return null;
  return {
    id: obj.data.objectId,
    donatedMist: f.donated_mist,
    litersAttributed: f.liters_attributed,
    xp: f.xp,
    tier: Number(f.tier),
    projectId: f.project_id,
  };
}

/** Every Impact NFT the connected donor holds (one per project they've given to). */
export function useMyNfts() {
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
  const nfts = ((q.data?.data ?? []) as any[]).map(mapNft).filter((n): n is NftView => !!n);
  return { ...q, nfts };
}

/**
 * The donor's NFT FOR A SPECIFIC PROJECT (a donor can hold one NFT per project). Selecting any NFT
 * would route repeat-donations to donate_again with a mismatched NFT → E_NFT_PROJECT_MISMATCH;
 * null => donate() mints one.
 */
export function useMyNft(projectId: string) {
  const { nfts, ...rest } = useMyNfts();
  const nft = nfts.find((n) => n.projectId === projectId) ?? null;
  return { ...rest, nft };
}

export interface DonationView {
  donor: string;
  amountMist: string;
  projectId: string;
  firstTime: boolean;
  txDigest?: string;
}

export interface SupporterRow {
  donor: string;
  totalMist: bigint;
  count: number;
}

/** DonationEvents (optionally for one project) + a top-supporters leaderboard aggregated by donor. */
export function useDonations(projectId?: string) {
  const client = useSuiClient();
  const q = useQuery({
    queryKey: ["yw-donation-events"],
    queryFn: () => queryAllEvents(client, DONATION_EVENT, 2000),
    refetchInterval: 10000,
  });
  const all = ((q.data ?? []) as any[]).map((e) => ({
    donor: e.parsedJson?.donor as string,
    amountMist: String(e.parsedJson?.amount_mist ?? "0"),
    projectId: e.parsedJson?.project_id as string,
    firstTime: !!e.parsedJson?.first_time,
    txDigest: e.id?.txDigest as string | undefined,
  })) as DonationView[];
  const donations = projectId ? all.filter((d) => d.projectId === projectId) : all;

  const byDonor = new Map<string, SupporterRow>();
  for (const d of donations) {
    const row = byDonor.get(d.donor) ?? { donor: d.donor, totalMist: 0n, count: 0 };
    row.totalMist += BigInt(d.amountMist ?? 0);
    row.count += 1;
    byDonor.set(d.donor, row);
  }
  const leaderboard = [...byDonor.values()].sort((a, b) => (b.totalMist > a.totalMist ? 1 : b.totalMist < a.totalMist ? -1 : 0));
  return { ...q, donations, leaderboard };
}

/** Latest milestone attestation FOR a project, with the signing enclave id (for genuine-vs-demo provenance). */
export function useLatestAttestationV2(projectId: string) {
  const client = useSuiClient();
  const q = useQuery({
    queryKey: ["yw-attest-v2"],
    queryFn: () => queryAllEvents(client, MILESTONE_ATTESTED_V2_EVENT, 500),
    refetchInterval: 8000,
  });
  const match = ((q.data ?? []) as any[]).find((e) => e.parsedJson?.project_id === projectId);
  return {
    txDigest: match?.id?.txDigest as string | undefined,
    enclaveId: match?.parsedJson?.enclave_id as string | undefined,
  };
}
