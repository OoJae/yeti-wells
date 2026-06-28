/**
 * Yeti Wells backend: Enoki gas sponsorship + starter grant + admin-signed campaign/steward ops.
 * Run: node --env-file=.env index.ts   (from server/)
 *
 * Phase 9 hardening: helmet + rate limiting, /api/fund daily cap + funder circuit-breaker, all funder
 * txs serialized through one queue, the sim signer key comes from SIM_SEED_HEX (NOT an in-repo formula),
 * campaigns are created via create_project_v2 (validated + enclave-bound), and attestations go through the
 * cap-gated submit_attested_milestone_v3. Secrets come from env only (never committed — see .dockerignore).
 */
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import PQueue from 'p-queue';
import crypto from 'node:crypto';
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
const PACKAGE_ID = env('PACKAGE_ID'); // original publish — struct/event TYPE tags live here
// CALL targets (changed/new functions) live in the latest upgrade.
const CALL_PACKAGE_ID = process.env.PACKAGE_ID_V3 ?? process.env.PACKAGE_ID_V2 ?? PACKAGE_ID;
const GRANT_AMOUNT_MIST = BigInt(process.env.GRANT_AMOUNT_MIST ?? '100000000');
const FUND_DAILY_CAP_MIST = BigInt(process.env.FUND_DAILY_CAP_MIST ?? '3000000000'); // 3 SUI/day default
const FUNDER_MIN_BALANCE_MIST = BigInt(process.env.FUNDER_MIN_BALANCE_MIST ?? '200000000'); // keep >=0.2 SUI
const PORT = Number(process.env.PORT ?? 3001);
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN ?? 'http://localhost:5173';
const ADMIN_CAP_ID = env('ADMIN_CAP_ID');
const REGISTRY_ID = env('REGISTRY_ID');
const WALRUS_PUBLISHER = process.env.WALRUS_PUBLISHER ?? 'https://publisher.walrus-testnet.walrus.space';
const STEWARD_KEY = process.env.STEWARD_KEY ?? '';

const ENCLAVE_ID = process.env.ENCLAVE_ID ?? ''; // genuine Oyster/Nitro Enclave<AppWitness> (optional)
const ENCLAVE_URL = process.env.ENCLAVE_URL ?? ''; // live Oyster enclave; empty/unreachable => sim signer
const ENCLAVE_ID_SIM = process.env.ENCLAVE_ID_SIM ?? ''; // secret-seed dev Enclave<AppWitness>
const BIND_ENCLAVE_ID = ENCLAVE_ID || ENCLAVE_ID_SIM; // new campaigns bind to this enclave
const MILESTONE_INTENT = 1;

const enoki = new EnokiClient({ apiKey: env('ENOKI_SECRET_KEY') });
const sui = new SuiJsonRpcClient({ url: getJsonRpcFullnodeUrl(NETWORK) });
const funder = Ed25519Keypair.fromSecretKey(env('FUNDER_SECRET_KEY'));
const funderAddress = funder.getPublicKey().toSuiAddress();

// SEC-01: the dev/sim signer key is read from env (Railway-only) — NOT derived from an in-repo formula.
let _simKp: Ed25519Keypair | null = null;
function simKeypair(): Ed25519Keypair {
  if (_simKp) return _simKp;
  const hex = process.env.SIM_SEED_HEX;
  if (!hex) throw new Error('SIM_SEED_HEX not set (required for the sim attestation signer)');
  _simKp = Ed25519Keypair.fromSecretKey(new Uint8Array(Buffer.from(hex.replace(/^0x/, ''), 'hex')));
  return _simKp;
}

// BE-01: serialize every funder-signed tx so concurrent requests can't conflict on the gas coin.
const funderQueue = new PQueue({ concurrency: 1 });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function signFunder(tx: Transaction, options: Record<string, boolean>): Promise<any> {
  return funderQueue.add(async () => {
    const result = await sui.signAndExecuteTransaction({ signer: funder, transaction: tx, options });
    await sui.waitForTransaction({ digest: result.digest });
    return result;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as Promise<any>;
}

// Only these targets may be gas-sponsored (donate / repeat-donate / sync / refund are donor-driven).
const ALLOWED_MOVE_CALL_TARGETS = [
  `${CALL_PACKAGE_ID}::donation::donate`,
  `${CALL_PACKAGE_ID}::donation::donate_again`,
  `${CALL_PACKAGE_ID}::donation::refund`,
  `${CALL_PACKAGE_ID}::impact_nft::sync_impact`,
];

// BE-05: constant-time steward-key check (length-guarded so timingSafeEqual gets equal-length buffers).
function isSteward(req: express.Request): boolean {
  const provided = req.header('x-steward-key') ?? '';
  if (!STEWARD_KEY || provided.length !== STEWARD_KEY.length) return false;
  return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(STEWARD_KEY));
}

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

const sensorReadings = new Map<string, number>();
const SENSOR_DEFAULT = Number(process.env.SENSOR_DEFAULT ?? 100000);

type AttestResult = {
  signature: number[];
  timestampMs: number;
  litersReading: number;
  source: 'oyster-tee' | 'local-sim';
  enclaveId: string;
};

/**
 * Produce a TEE-signed milestone reading for `projectId`, signed by the enclave the project is BOUND to
 * (`boundEnclaveId`). If that's the genuine Oyster enclave AND it's reachable, use it; otherwise sign with
 * the secret-seed sim signer (whose pubkey is the registered `boundEnclaveId`). `release_milestone` on-chain
 * asserts the passed enclave == the project's bound enclave, so a mismatch can't release.
 */
async function enclaveAttest(
  milestoneIndex: number,
  projectId: string,
  litersReading: number,
  boundEnclaveId: string,
): Promise<AttestResult> {
  if (ENCLAVE_URL && ENCLAVE_ID && boundEnclaveId === ENCLAVE_ID) {
    try {
      const r = await fetch(`${ENCLAVE_URL}/process_data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload: { project_id: projectId, milestone_index: milestoneIndex } }),
        signal: AbortSignal.timeout(8000),
      });
      if (!r.ok) throw new Error(`enclave ${r.status}`);
      const j = (await r.json()) as {
        signature: string;
        response: { timestamp_ms: number; data: { liters_reading: number } };
      };
      return {
        signature: Array.from(Buffer.from(j.signature, 'hex')),
        timestampMs: Number(j.response.timestamp_ms),
        litersReading: Number(j.response.data.liters_reading),
        source: 'oyster-tee',
        enclaveId: ENCLAVE_ID,
      };
    } catch (e) {
      console.warn(`[attest] live Oyster enclave unreachable (${(e as Error).message}); using sim signer`);
    }
  }
  const timestampMs = Date.now();
  const bytes = IntentMessage.serialize({
    intent: MILESTONE_INTENT,
    timestamp_ms: BigInt(timestampMs),
    payload: {
      project_id: projectId,
      milestone_index: BigInt(milestoneIndex),
      liters_reading: BigInt(litersReading),
      timestamp_ms: BigInt(timestampMs),
    },
  }).toBytes();
  const sig = await simKeypair().sign(bytes);
  return { signature: Array.from(sig), timestampMs, litersReading, source: 'local-sim', enclaveId: boundEnclaveId };
}

// BE-06: Walrus upload with timeout + bounded retry on transient (429/5xx) failures.
async function uploadToWalrus(bytes: Uint8Array, mediaType?: string, epochs = 5): Promise<string> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(`${WALRUS_PUBLISHER}/v1/blobs?epochs=${epochs}`, {
        method: 'PUT',
        body: bytes,
        headers: mediaType ? { 'Content-Type': mediaType } : undefined,
        signal: AbortSignal.timeout(20000),
      });
      if (r.status === 429 || r.status >= 500) throw new Error(`Walrus publisher ${r.status}`);
      if (!r.ok) throw new Error(`Walrus publisher ${r.status}`);
      const j = (await r.json()) as {
        newlyCreated?: { blobObject?: { blobId?: string } };
        alreadyCertified?: { blobId?: string };
      };
      const blobId = j.newlyCreated?.blobObject?.blobId ?? j.alreadyCertified?.blobId;
      if (!blobId) throw new Error('Walrus: no blobId in response');
      return blobId;
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
  }
  throw new Error(`Walrus upload failed after retries: ${String((lastErr as Error)?.message ?? lastErr)}`);
}

// FE-07/BE: only accept real raster images (no SVG — avoids script-in-SVG); checked by magic bytes.
function sniffRasterImage(b: Uint8Array): boolean {
  if (b.length < 12) return false;
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return true; // PNG
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return true; // JPEG
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return true; // GIF
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[8] === 0x57 && b[9] === 0x45) return true; // WEBP
  return false;
}

const app = express();
app.set('trust proxy', 1); // Railway sits behind a proxy — needed for correct per-IP rate limiting
app.use(helmet());
app.use(cors({ origin: ALLOWED_ORIGIN }));
app.use(express.json({ limit: '6mb' }));
// Key by the real client IP (leftmost X-Forwarded-For) — Railway puts the app behind a proxy chain, so
// req.ip alone isn't stable. `validate:false` disables express-rate-limit's trust-proxy assertion.
const ipKey = (req: express.Request): string => {
  const xff = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim();
  return xff || req.ip || 'ip';
};
const limiter = (limit: number) =>
  rateLimit({ windowMs: 60_000, limit, keyGenerator: ipKey, validate: false, standardHeaders: 'draft-7', legacyHeaders: false });
app.use('/api/', limiter(150));
const fundLimiter = limiter(4);
const writeLimiter = limiter(6);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, network: NETWORK, funder: funderAddress, package: PACKAGE_ID, call: CALL_PACKAGE_ID });
});

// SEC-03: starter grant with a daily budget + funder low-balance circuit-breaker + per-IP rate limit.
let grantedDay = '';
let grantedTodayMist = 0n;
app.post('/api/fund', fundLimiter, async (req, res) => {
  try {
    const { address } = req.body ?? {};
    if (typeof address !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(address)) {
      return res.status(400).json({ error: 'valid address required' });
    }
    const { totalBalance } = await sui.getBalance({ owner: address });
    if (BigInt(totalBalance) >= GRANT_AMOUNT_MIST) {
      return res.json({ skipped: true, reason: 'already funded', balance: totalBalance });
    }
    const day = new Date().toISOString().slice(0, 10);
    if (day !== grantedDay) {
      grantedDay = day;
      grantedTodayMist = 0n;
    }
    if (grantedTodayMist + GRANT_AMOUNT_MIST > FUND_DAILY_CAP_MIST) {
      return res.status(429).json({ error: 'daily grant budget reached — try again tomorrow' });
    }
    const { totalBalance: funderBal } = await sui.getBalance({ owner: funderAddress });
    if (BigInt(funderBal) < FUNDER_MIN_BALANCE_MIST + GRANT_AMOUNT_MIST) {
      return res.status(503).json({ error: 'funding temporarily unavailable' });
    }
    const tx = new Transaction();
    const [coin] = tx.splitCoins(tx.gas, [GRANT_AMOUNT_MIST]);
    tx.transferObjects([coin], address);
    const result = await signFunder(tx, { showEffects: true });
    if (result.effects?.status?.status !== 'success') {
      return res.status(500).json({ error: 'grant failed', status: result.effects?.status });
    }
    grantedTodayMist += GRANT_AMOUNT_MIST;
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

// Open to any signed-in user: launch a campaign. The platform admin (funder) co-signs the AdminCap-gated
// create_project_v2 (validated + enclave-bound), with payout = the creator (organizer/beneficiary).
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
app.post('/api/create-campaign', writeLimiter, async (req, res) => {
  try {
    const { creator, name, location, description, imageBase64, fundingGoalMist, targetLiters, milestones } =
      req.body ?? {};

    if (typeof creator !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(creator)) {
      return res.status(400).json({ error: 'valid creator address required' });
    }
    const cleanName = (typeof name === 'string' ? name : '').normalize('NFKC').trim();
    if (!cleanName || cleanName.length > 100) return res.status(400).json({ error: 'name (1-100 chars) required' });
    if (typeof location !== 'string' || location.length > 100) return res.status(400).json({ error: 'invalid location' });
    if (typeof description !== 'string' || description.length > 1000) {
      return res.status(400).json({ error: 'invalid description' });
    }
    if (!BIND_ENCLAVE_ID) return res.status(500).json({ error: 'no enclave configured to bind' });

    const goal = BigInt(Math.max(0, Math.floor(Number(fundingGoalMist))));
    const target = Math.max(0, Math.floor(Number(targetLiters)));
    if (goal <= 0n) return res.status(400).json({ error: 'fundingGoalMist must be > 0' });
    if (target <= 0) return res.status(400).json({ error: 'targetLiters must be > 0' });
    if (!Array.isArray(milestones) || milestones.length < 1 || milestones.length > 8) {
      return res.status(400).json({ error: 'provide 1-8 milestones' });
    }

    const descs: string[] = [];
    const thresholds: bigint[] = [];
    const releases: bigint[] = [];
    let prevTh = -1;
    let sum = 0n;
    for (const m of milestones) {
      const d = String(m?.description ?? '').normalize('NFKC').trim();
      if (!d || d.length > 120) return res.status(400).json({ error: 'each milestone needs a description (<=120 chars)' });
      const th = Math.max(0, Math.floor(Number(m?.threshold)));
      const rl = BigInt(Math.max(0, Math.floor(Number(m?.release))));
      if (th > target) return res.status(400).json({ error: 'milestone threshold exceeds target liters' });
      if (th <= prevTh) return res.status(400).json({ error: 'milestone thresholds must strictly increase' });
      if (rl <= 0n) return res.status(400).json({ error: 'each milestone release must be > 0' });
      prevTh = th;
      sum += rl;
      descs.push(d);
      thresholds.push(BigInt(th));
      releases.push(rl);
    }
    if (sum > goal) return res.status(400).json({ error: 'milestone releases exceed funding goal' });

    let imageBlobId = '';
    if (typeof imageBase64 === 'string' && imageBase64.length > 0) {
      const bytes = new Uint8Array(Buffer.from(imageBase64, 'base64'));
      if (bytes.length > MAX_IMAGE_BYTES) return res.status(400).json({ error: 'cover image too large (max 4MB)' });
      if (!sniffRasterImage(bytes)) return res.status(400).json({ error: 'cover must be a PNG/JPEG/GIF/WebP image' });
      imageBlobId = await uploadToWalrus(bytes, 'image/*');
    }

    const tx = new Transaction();
    tx.moveCall({
      target: `${CALL_PACKAGE_ID}::project::create_project_v2`,
      arguments: [
        tx.object(ADMIN_CAP_ID),
        tx.object(REGISTRY_ID),
        tx.pure.string(cleanName),
        tx.pure.string(location.trim()),
        tx.pure.string(description.trim()),
        tx.pure.string(imageBlobId),
        tx.pure.u64(goal),
        tx.pure.u64(BigInt(target)),
        tx.pure.address(creator),
        tx.pure.vector('string', descs),
        tx.pure.vector('u64', thresholds),
        tx.pure.vector('u64', releases),
        tx.pure.id(BIND_ENCLAVE_ID),
      ],
    });
    const result = await signFunder(tx, { showObjectChanges: true, showEffects: true });
    if (result.effects?.status?.status !== 'success') {
      return res.status(500).json({ error: 'create_project failed', status: result.effects?.status });
    }
    const created = (result.objectChanges ?? []).find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (o: any) => o.type === 'created' && o.objectType.endsWith('::project::WaterProject'),
    );
    if (!created) return res.status(500).json({ error: 'could not find created WaterProject' });
    return res.json({ projectId: created.objectId, digest: result.digest, name: cleanName, imageBlobId });
  } catch (e) {
    console.error('create-campaign error', e);
    return res.status(500).json({ error: String((e as Error)?.message ?? e) });
  }
});

// Steward-only: upload an evidence file to Walrus and record its blob_id on-chain (admin-signed).
app.post('/api/steward/add-evidence', writeLimiter, async (req, res) => {
  try {
    if (!isSteward(req)) return res.status(401).json({ error: 'unauthorized' });
    const { projectId, dataBase64, mediaType, caption, milestoneIndex } = req.body ?? {};
    if (typeof projectId !== 'string' || !projectId.startsWith('0x')) {
      return res.status(400).json({ error: 'projectId required' });
    }
    if (typeof dataBase64 !== 'string' || typeof mediaType !== 'string') {
      return res.status(400).json({ error: 'dataBase64 and mediaType required' });
    }
    const bytes = new Uint8Array(Buffer.from(dataBase64, 'base64'));
    if (bytes.length > MAX_IMAGE_BYTES) return res.status(400).json({ error: 'evidence too large (max 4MB)' });
    const blobId = await uploadToWalrus(bytes, mediaType);

    const tx = new Transaction();
    tx.moveCall({
      target: `${CALL_PACKAGE_ID}::project::add_evidence`,
      arguments: [
        tx.object(ADMIN_CAP_ID),
        tx.object(projectId),
        tx.pure.string(blobId),
        tx.pure.string(mediaType),
        tx.pure.string(typeof caption === 'string' ? caption.slice(0, 200) : ''),
        tx.pure.u64(BigInt(Number(milestoneIndex) || 0)),
        tx.pure.u64(BigInt(Date.now())),
      ],
    });
    const result = await signFunder(tx, { showEffects: true });
    if (result.effects?.status?.status !== 'success') {
      return res.status(500).json({ error: 'add_evidence failed', status: result.effects?.status });
    }
    return res.json({ blobId, digest: result.digest });
  } catch (e) {
    console.error('add-evidence error', e);
    return res.status(500).json({ error: String((e as Error)?.message ?? e) });
  }
});

// Steward-only: cancel a fundraising campaign so donors can reclaim their share of remaining escrow.
app.post('/api/steward/cancel-project', writeLimiter, async (req, res) => {
  try {
    if (!isSteward(req)) return res.status(401).json({ error: 'unauthorized' });
    const projectId = String(req.body?.projectId ?? '');
    if (!projectId.startsWith('0x')) return res.status(400).json({ error: 'projectId required' });
    const tx = new Transaction();
    tx.moveCall({
      target: `${CALL_PACKAGE_ID}::project::cancel_project`,
      arguments: [tx.object(ADMIN_CAP_ID), tx.object(projectId)],
    });
    const result = await signFunder(tx, { showEffects: true });
    if (result.effects?.status?.status !== 'success') {
      return res.status(500).json({ error: 'cancel failed', status: result.effects?.status });
    }
    return res.json({ cancelled: true, digest: result.digest });
  } catch (e) {
    console.error('cancel-project error', e);
    return res.status(500).json({ error: String((e as Error)?.message ?? e) });
  }
});

// Mock flow-meter sensor (per project). Bump is steward-gated (BE-05).
app.get('/api/sensor', (req, res) => {
  const projectId = String(req.query.project ?? '');
  const liters = projectId && sensorReadings.has(projectId) ? sensorReadings.get(projectId)! : SENSOR_DEFAULT;
  res.json({ projectId, liters });
});
app.post('/api/sensor/bump', (req, res) => {
  if (!isSteward(req)) return res.status(401).json({ error: 'unauthorized' });
  const { projectId, liters } = req.body ?? {};
  const l = Number(liters);
  if (typeof projectId !== 'string' || !projectId.startsWith('0x') || Number.isNaN(l)) {
    return res.status(400).json({ error: 'projectId and liters required' });
  }
  if (sensorReadings.size > 5000) sensorReadings.clear(); // bound memory
  sensorReadings.set(projectId, l);
  res.json({ projectId, liters: l });
});

// Steward-only: TEE-signed reading -> submit on-chain (cap-gated v3) to release the milestone + advance liters.
app.post('/api/steward/run-attestation', writeLimiter, async (req, res) => {
  try {
    if (!isSteward(req)) return res.status(401).json({ error: 'unauthorized' });
    const projectId = String(req.body?.projectId ?? '');
    if (!projectId.startsWith('0x')) return res.status(400).json({ error: 'projectId required' });
    const milestoneIndex = Number(req.body?.milestoneIndex ?? 0);

    const obj = await sui.getObject({ id: projectId, options: { showContent: true } });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const f = (obj.data?.content as any)?.fields;
    if (!f) return res.status(404).json({ error: 'project not found' });
    const boundEnclaveId: string | null = f.enclave_id ?? null;
    if (!boundEnclaveId) return res.status(400).json({ error: 'project is not bound to an enclave; cannot attest' });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const milestones: any[] = f.milestones ?? [];
    if (milestoneIndex < 0 || milestoneIndex >= milestones.length) {
      return res.status(400).json({ error: `milestoneIndex out of range (0..${milestones.length - 1})` });
    }

    const override = req.body?.liters !== undefined ? Number(req.body.liters) : undefined;
    let litersReading: number;
    if (typeof override === 'number' && Number.isFinite(override) && override >= 0) litersReading = Math.floor(override);
    else if (sensorReadings.has(projectId)) litersReading = sensorReadings.get(projectId)!;
    else {
      const m = milestones[milestoneIndex];
      const th = Number((m?.fields ?? m)?.liters_threshold ?? 0); // threshold==0 is valid (BE-03)
      litersReading = th > 0 ? th : Number(f.target_liters ?? SENSOR_DEFAULT);
    }

    const att = await enclaveAttest(milestoneIndex, projectId, litersReading, boundEnclaveId);

    const tx = new Transaction();
    tx.moveCall({
      target: `${CALL_PACKAGE_ID}::attestation::submit_attested_milestone_v3`,
      arguments: [
        tx.object(ADMIN_CAP_ID),
        tx.object(projectId),
        tx.object(REGISTRY_ID),
        tx.object(att.enclaveId),
        tx.pure.u64(BigInt(att.timestampMs)),
        tx.pure.address(projectId),
        tx.pure.u64(BigInt(milestoneIndex)),
        tx.pure.u64(BigInt(att.litersReading)),
        tx.pure.vector('u8', att.signature),
      ],
    });
    const result = await signFunder(tx, { showEffects: true });
    if (result.effects?.status?.status !== 'success') {
      return res.status(500).json({ error: 'attestation failed', status: result.effects?.status });
    }
    return res.json({ digest: result.digest, milestoneIndex, litersReading: att.litersReading, source: att.source });
  } catch (e) {
    console.error('run-attestation error', e);
    return res.status(500).json({ error: String((e as Error)?.message ?? e) });
  }
});

app.listen(PORT, () => {
  console.log(`Yeti Wells backend on http://localhost:${PORT} (network=${NETWORK})`);
  console.log(
    `  funder=${funderAddress}  call-pkg=${CALL_PACKAGE_ID}` +
      `  bind-enclave=${BIND_ENCLAVE_ID || '(none)'}  attest=${ENCLAVE_URL && ENCLAVE_ID ? 'oyster-tee (sim fallback)' : 'sim signer'}`,
  );
});
