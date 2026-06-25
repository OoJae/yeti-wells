/**
 * Yeti Wells backend: Enoki gas sponsorship + fresh-user starter grant.
 * Run: node --env-file=.env index.ts   (from server/)
 *
 * Routes:
 *   POST /api/fund    { address }                    -> grant ~0.1 testnet SUI if the address is empty
 *   POST /api/sponsor { transactionKindBytes, sender } -> Enoki sponsored tx -> { bytes, digest }
 *   POST /api/execute { digest, signature }          -> submit -> { digest }
 *
 * Secrets come from server/.env (git-ignored): ENOKI_SECRET_KEY, FUNDER_SECRET_KEY.
 */
import express from 'express';
import cors from 'cors';
import { EnokiClient } from '@mysten/enoki';
import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from '@mysten/sui/jsonRpc';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { bcs } from '@mysten/sui/bcs';

const env = (k: string): string => {
  const v = process.env[k];
  if (!v) throw new Error(`Missing env var: ${k}`);
  return v;
};

const NETWORK = (process.env.SUI_NETWORK ?? 'testnet') as 'testnet' | 'mainnet' | 'devnet';
const PACKAGE_ID = env('PACKAGE_ID');
const GRANT_AMOUNT_MIST = BigInt(process.env.GRANT_AMOUNT_MIST ?? '100000000');
const PORT = Number(process.env.PORT ?? 3001);
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN ?? 'http://localhost:5173';
const ADMIN_CAP_ID = env('ADMIN_CAP_ID');
const WATER_PROJECT_ID = env('WATER_PROJECT_ID');
const WALRUS_PUBLISHER = process.env.WALRUS_PUBLISHER ?? 'https://publisher.walrus-testnet.walrus.space';
const STEWARD_KEY = process.env.STEWARD_KEY ?? '';

const enoki = new EnokiClient({ apiKey: env('ENOKI_SECRET_KEY') });
const sui = new SuiJsonRpcClient({ url: getJsonRpcFullnodeUrl(NETWORK) });
const funder = Ed25519Keypair.fromSecretKey(env('FUNDER_SECRET_KEY'));
const funderAddress = funder.getPublicKey().toSuiAddress();

// Only these targets may be gas-sponsored.
const ALLOWED_MOVE_CALL_TARGETS = [
  `${PACKAGE_ID}::donation::donate`,
  `${PACKAGE_ID}::donation::donate_again`,
  `${PACKAGE_ID}::impact_nft::sync_impact`,
];

// --- Phase 5: Nautilus attestation ---
const PACKAGE_ID_V2 = process.env.PACKAGE_ID_V2 ?? PACKAGE_ID; // upgraded pkg id (Phase-5 fn targets)
const REGISTRY_ID = env('REGISTRY_ID');
const ENCLAVE_ID = process.env.ENCLAVE_ID ?? '';
const ENCLAVE_URL = process.env.ENCLAVE_URL ?? ''; // set => real AWS Nitro enclave; empty => local sim signer
const MILESTONE_INTENT = 1;

// Local simulated-enclave key — same fixed seed as the on-chain dev enclave + gen_attestation_vector.
const enclaveKp = (() => {
  const seed = new Uint8Array(32);
  for (let i = 0; i < 32; i++) seed[i] = (i * 7 + 13) & 0xff;
  return Ed25519Keypair.fromSecretKey(seed);
})();

// IntentMessage(MilestoneReport) — byte-identical to the Move + Rust structs.
const MilestoneReport = bcs.struct('MilestoneReport', {
  project_id: bcs.Address,
  milestone_index: bcs.u64(),
  liters_reading: bcs.u64(),
  timestamp_ms: bcs.u64(),
});
const IntentMessage = bcs.struct('IntentMessage', {
  intent: bcs.u8(),
  timestamp_ms: bcs.u64(),
  payload: MilestoneReport,
});

// Mock flow-meter; defaults to the project target so an attestation fills the globe to 100%.
let sensorLiters = Number(process.env.SENSOR_DEFAULT ?? 100000);

/** Produce a TEE-signed milestone reading: the real AWS enclave if ENCLAVE_URL is set, else the local sim signer. */
async function enclaveAttest(
  milestoneIndex: number,
): Promise<{ signature: number[]; timestampMs: number; litersReading: number }> {
  if (ENCLAVE_URL) {
    const r = await fetch(`${ENCLAVE_URL}/process_data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload: { project_id: WATER_PROJECT_ID, milestone_index: milestoneIndex } }),
    });
    if (!r.ok) throw new Error(`enclave ${r.status}`);
    // Nautilus ProcessedDataResponse: { response: IntentMessage{ timestamp_ms, data: MilestoneReport }, signature }.
    const j = (await r.json()) as {
      signature: string;
      response: { timestamp_ms: number; data: { liters_reading: number } };
    };
    return {
      signature: Array.from(Buffer.from(j.signature, 'hex')),
      timestampMs: Number(j.response.timestamp_ms),
      litersReading: Number(j.response.data.liters_reading),
    };
  }
  const timestampMs = Date.now();
  const litersReading = sensorLiters;
  const bytes = IntentMessage.serialize({
    intent: MILESTONE_INTENT,
    timestamp_ms: BigInt(timestampMs),
    payload: {
      project_id: WATER_PROJECT_ID,
      milestone_index: BigInt(milestoneIndex),
      liters_reading: BigInt(litersReading),
      timestamp_ms: BigInt(timestampMs),
    },
  }).toBytes();
  const sig = await enclaveKp.sign(bytes);
  return { signature: Array.from(sig), timestampMs, litersReading };
}

// Upload raw bytes to the public Walrus testnet publisher; returns the blobId (no WAL needed).
async function uploadToWalrus(bytes: Uint8Array, epochs = 5): Promise<string> {
  const r = await fetch(`${WALRUS_PUBLISHER}/v1/blobs?epochs=${epochs}`, { method: 'PUT', body: bytes });
  if (!r.ok) throw new Error(`Walrus publisher ${r.status}`);
  const j = (await r.json()) as {
    newlyCreated?: { blobObject?: { blobId?: string } };
    alreadyCertified?: { blobId?: string };
  };
  const blobId = j.newlyCreated?.blobObject?.blobId ?? j.alreadyCertified?.blobId;
  if (!blobId) throw new Error('Walrus: no blobId in response');
  return blobId;
}

const app = express();
app.use(cors({ origin: ALLOWED_ORIGIN }));
app.use(express.json({ limit: '12mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, network: NETWORK, funder: funderAddress, package: PACKAGE_ID });
});

// Starter grant: give a fresh zkLogin address enough SUI to make a donation (gas is sponsored separately).
app.post('/api/fund', async (req, res) => {
  try {
    const { address } = req.body ?? {};
    if (typeof address !== 'string' || !address.startsWith('0x')) {
      return res.status(400).json({ error: 'address required' });
    }
    // Idempotent: skip if the address already has at least the grant amount.
    const { totalBalance } = await sui.getBalance({ owner: address });
    if (BigInt(totalBalance) >= GRANT_AMOUNT_MIST) {
      return res.json({ skipped: true, reason: 'already funded', balance: totalBalance });
    }
    const tx = new Transaction();
    const [coin] = tx.splitCoins(tx.gas, [GRANT_AMOUNT_MIST]);
    tx.transferObjects([coin], address);
    const result = await sui.signAndExecuteTransaction({
      signer: funder,
      transaction: tx,
      options: { showEffects: true },
    });
    await sui.waitForTransaction({ digest: result.digest });
    if (result.effects?.status?.status !== 'success') {
      return res.status(500).json({ error: 'grant failed', status: result.effects?.status });
    }
    return res.json({ funded: true, digest: result.digest, amountMist: GRANT_AMOUNT_MIST.toString() });
  } catch (e) {
    console.error('fund error', e);
    return res.status(500).json({ error: String((e as Error)?.message ?? e) });
  }
});

// Enoki sponsorship: wrap the user's transaction-kind bytes into a gas-sponsored transaction.
app.post('/api/sponsor', async (req, res) => {
  try {
    const { transactionKindBytes, sender } = req.body ?? {};
    if (typeof transactionKindBytes !== 'string' || typeof sender !== 'string') {
      return res.status(400).json({ error: 'transactionKindBytes and sender required' });
    }
    const sponsored = await enoki.createSponsoredTransaction({
      network: NETWORK,
      transactionKindBytes,
      sender,
      allowedAddresses: [sender],
      allowedMoveCallTargets: ALLOWED_MOVE_CALL_TARGETS,
    });
    return res.json({ bytes: sponsored.bytes, digest: sponsored.digest });
  } catch (e) {
    console.error('sponsor error', e);
    return res.status(500).json({ error: String((e as Error)?.message ?? e) });
  }
});

// Submit the user-signed sponsored transaction.
app.post('/api/execute', async (req, res) => {
  try {
    const { digest, signature } = req.body ?? {};
    if (typeof digest !== 'string' || typeof signature !== 'string') {
      return res.status(400).json({ error: 'digest and signature required' });
    }
    const result = await enoki.executeSponsoredTransaction({ digest, signature });
    return res.json({ digest: result.digest });
  } catch (e) {
    console.error('execute error', e);
    return res.status(500).json({ error: String((e as Error)?.message ?? e) });
  }
});

// Steward-only: upload an evidence file to Walrus and record its blob_id on-chain (admin-signed).
app.post('/api/steward/add-evidence', async (req, res) => {
  try {
    if (!STEWARD_KEY || req.header('x-steward-key') !== STEWARD_KEY) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    const { dataBase64, mediaType, caption, milestoneIndex } = req.body ?? {};
    if (typeof dataBase64 !== 'string' || typeof mediaType !== 'string') {
      return res.status(400).json({ error: 'dataBase64 and mediaType required' });
    }
    const bytes = new Uint8Array(Buffer.from(dataBase64, 'base64'));
    const blobId = await uploadToWalrus(bytes);

    const tx = new Transaction();
    tx.moveCall({
      target: `${PACKAGE_ID}::project::add_evidence`,
      arguments: [
        tx.object(ADMIN_CAP_ID),
        tx.object(WATER_PROJECT_ID),
        tx.pure.string(blobId),
        tx.pure.string(mediaType),
        tx.pure.string(typeof caption === 'string' ? caption : ''),
        tx.pure.u64(BigInt(Number(milestoneIndex) || 0)),
        tx.pure.u64(BigInt(Date.now())),
      ],
    });
    const result = await sui.signAndExecuteTransaction({
      signer: funder,
      transaction: tx,
      options: { showEffects: true },
    });
    await sui.waitForTransaction({ digest: result.digest });
    if (result.effects?.status?.status !== 'success') {
      return res.status(500).json({ error: 'add_evidence failed', status: result.effects?.status });
    }
    return res.json({ blobId, digest: result.digest });
  } catch (e) {
    console.error('add-evidence error', e);
    return res.status(500).json({ error: String((e as Error)?.message ?? e) });
  }
});

// Mock flow-meter sensor.
app.get('/api/sensor', (_req, res) => res.json({ liters: sensorLiters }));
app.post('/api/sensor/bump', (req, res) => {
  const l = Number(req.body?.liters);
  if (!Number.isNaN(l)) sensorLiters = l;
  res.json({ liters: sensorLiters });
});

// Steward-only: get a TEE-signed reading (enclave) and submit it on-chain to release the milestone + advance liters.
app.post('/api/steward/run-attestation', async (req, res) => {
  try {
    if (!STEWARD_KEY || req.header('x-steward-key') !== STEWARD_KEY) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    if (!ENCLAVE_ID) return res.status(500).json({ error: 'ENCLAVE_ID not set — register the enclave first' });
    const milestoneIndex = Number(req.body?.milestoneIndex ?? 1);
    const att = await enclaveAttest(milestoneIndex);

    const tx = new Transaction();
    tx.moveCall({
      target: `${PACKAGE_ID_V2}::attestation::submit_attested_milestone_v2`,
      arguments: [
        tx.object(WATER_PROJECT_ID),
        tx.object(REGISTRY_ID),
        tx.object(ENCLAVE_ID),
        tx.pure.u64(BigInt(att.timestampMs)),
        tx.pure.address(WATER_PROJECT_ID),
        tx.pure.u64(BigInt(milestoneIndex)),
        tx.pure.u64(BigInt(att.litersReading)),
        tx.pure.vector('u8', att.signature),
      ],
    });
    const result = await sui.signAndExecuteTransaction({
      signer: funder,
      transaction: tx,
      options: { showEffects: true },
    });
    await sui.waitForTransaction({ digest: result.digest });
    if (result.effects?.status?.status !== 'success') {
      return res.status(500).json({ error: 'attestation failed', status: result.effects?.status });
    }
    return res.json({
      digest: result.digest,
      milestoneIndex,
      litersReading: att.litersReading,
      source: ENCLAVE_URL ? 'aws-nitro' : 'local-sim',
    });
  } catch (e) {
    console.error('run-attestation error', e);
    return res.status(500).json({ error: String((e as Error)?.message ?? e) });
  }
});

app.listen(PORT, () => {
  console.log(`Yeti Wells backend on http://localhost:${PORT} (network=${NETWORK})`);
  console.log(`  funder=${funderAddress}  enclave=${ENCLAVE_ID || '(unset)'}  source=${ENCLAVE_URL ? 'aws-nitro' : 'local-sim'}`);
});
