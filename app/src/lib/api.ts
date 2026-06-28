import { config } from "../config";

/** Steward fetch with friendly network-error mapping (FE-06). */
async function stewardPost<T>(path: string, body: unknown, stewardKey: string): Promise<T> {
  return post<T>(path, body, { "x-steward-key": stewardKey });
}

async function post<T>(path: string, body: unknown, headers?: Record<string, string>): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${config.apiUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(headers ?? {}) },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Can't reach the server — check your connection and try again.");
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 429) throw new Error("Too many requests — please wait a moment and retry.");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    throw new Error((json as any)?.error ?? `${path} failed (${res.status})`);
  }
  return json as T;
}

/** Starter grant: give a fresh zkLogin address testnet SUI to donate with. Idempotent. */
export function fundAddress(address: string) {
  return post<{ funded?: boolean; skipped?: boolean; digest?: string }>("/api/fund", { address });
}

/** Wrap the user's transaction-kind bytes into an Enoki gas-sponsored transaction. */
export function sponsor(transactionKindBytes: string, sender: string) {
  return post<{ bytes: string; digest: string }>("/api/sponsor", { transactionKindBytes, sender });
}

/** Submit the user-signed sponsored transaction. */
export function execute(digest: string, signature: string) {
  return post<{ digest: string }>("/api/execute", { digest, signature });
}

export interface CreateCampaignInput {
  creator: string;
  name: string;
  location: string;
  description: string;
  imageBase64?: string;
  fundingGoalMist: string;
  targetLiters: string;
  milestones: { description: string; threshold: number; release: string }[];
}

/** Open to any signed-in user: launch a campaign. The backend admin co-signs create_project (payout = creator). */
export function createCampaign(input: CreateCampaignInput) {
  return post<{ projectId: string; digest: string; name: string; imageBlobId: string }>(
    "/api/create-campaign",
    input,
  );
}

/** Steward-only: upload an evidence file to Walrus + record its blob_id on-chain for a project. */
export function addEvidence(
  payload: { projectId: string; dataBase64: string; mediaType: string; caption: string; milestoneIndex: number },
  stewardKey: string,
) {
  return stewardPost<{ blobId: string; digest: string }>("/api/steward/add-evidence", payload, stewardKey);
}

/** Steward-only: run a TEE attestation for a project (releases a milestone + advances liters). */
export function runAttestation(
  projectId: string,
  milestoneIndex: number,
  stewardKey: string,
  liters?: number,
) {
  return stewardPost<{ digest: string; litersReading: number; source: string }>(
    "/api/steward/run-attestation",
    { projectId, milestoneIndex, liters },
    stewardKey,
  );
}

/** Steward-only: cancel a campaign so donors can reclaim their share of remaining escrow. */
export function cancelCampaign(projectId: string, stewardKey: string) {
  return stewardPost<{ cancelled: boolean; digest: string }>("/api/steward/cancel-project", { projectId }, stewardKey);
}
