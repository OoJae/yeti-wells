/**
 * Seed demo evidence: fetch a couple of real photos, store them on Walrus (public testnet publisher),
 * and record their blob_ids on-chain via project::add_evidence (admin-signed). Populates the gallery.
 *
 * Env: PACKAGE_ID, ADMIN_CAP_ID, WATER_PROJECT_ID, ADMIN_SECRET_KEY, [WALRUS_PUBLISHER]
 * Run: node upload-evidence.ts
 */
import { Transaction } from "@mysten/sui/transactions";
import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from "@mysten/sui/jsonRpc";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";

function req(k: string): string {
  const v = process.env[k];
  if (!v) {
    console.error("Missing env " + k);
    process.exit(1);
  }
  return v;
}

const PACKAGE_ID = req("PACKAGE_ID");
const ADMIN_CAP_ID = req("ADMIN_CAP_ID");
const WATER_PROJECT_ID = req("WATER_PROJECT_ID");
const PUBLISHER = process.env.WALRUS_PUBLISHER ?? "https://publisher.walrus-testnet.walrus.space";
const kp = Ed25519Keypair.fromSecretKey(req("ADMIN_SECRET_KEY"));
const client = new SuiJsonRpcClient({ url: getJsonRpcFullnodeUrl("testnet") });

const EVIDENCE = [
  { seed: "kibera-borehole", caption: "Borehole drilling underway — Kibera site", milestone: 0 },
  { seed: "flowmeter-reading", caption: "Flow-meter reading: 60,000 L delivered", milestone: 1 },
];

async function uploadToWalrus(bytes: Uint8Array, epochs = 5): Promise<string> {
  const r = await fetch(`${PUBLISHER}/v1/blobs?epochs=${epochs}`, { method: "PUT", body: bytes });
  if (!r.ok) throw new Error(`Walrus publisher ${r.status}`);
  const j = (await r.json()) as {
    newlyCreated?: { blobObject?: { blobId?: string } };
    alreadyCertified?: { blobId?: string };
  };
  const blobId = j.newlyCreated?.blobObject?.blobId ?? j.alreadyCertified?.blobId;
  if (!blobId) throw new Error("Walrus: no blobId");
  return blobId;
}

const records: { blobId: string; caption: string; milestone: number }[] = [];
for (const e of EVIDENCE) {
  const img = await fetch(`https://picsum.photos/seed/${e.seed}/800/520`);
  const bytes = new Uint8Array(await img.arrayBuffer());
  const blobId = await uploadToWalrus(bytes);
  console.log(`uploaded "${e.caption}" -> ${blobId} (${bytes.length} bytes)`);
  records.push({ blobId, caption: e.caption, milestone: e.milestone });
}

const tx = new Transaction();
for (const r of records) {
  tx.moveCall({
    target: `${PACKAGE_ID}::project::add_evidence`,
    arguments: [
      tx.object(ADMIN_CAP_ID),
      tx.object(WATER_PROJECT_ID),
      tx.pure.string(r.blobId),
      tx.pure.string("image/jpeg"),
      tx.pure.string(r.caption),
      tx.pure.u64(BigInt(r.milestone)),
      tx.pure.u64(BigInt(1_700_000_000_000 + r.milestone)),
    ],
  });
}
const result = await client.signAndExecuteTransaction({
  signer: kp,
  transaction: tx,
  options: { showEffects: true },
});
await client.waitForTransaction({ digest: result.digest });
console.log("add_evidence status:", result.effects?.status?.status, "digest:", result.digest);
console.log(result.effects?.status?.status === "success" ? "✅ evidence recorded on-chain" : "✗ failed");
