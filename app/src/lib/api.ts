import { config } from "../config";

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${config.apiUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error ?? `${path} failed`);
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

/** Steward-only: upload an evidence file to Walrus + record its blob_id on-chain. */
export async function addEvidence(
  payload: { dataBase64: string; mediaType: string; caption: string; milestoneIndex: number },
  stewardKey: string,
): Promise<{ blobId: string; digest: string }> {
  const res = await fetch(`${config.apiUrl}/api/steward/add-evidence`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-steward-key": stewardKey },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error ?? "add-evidence failed");
  return json as { blobId: string; digest: string };
}
