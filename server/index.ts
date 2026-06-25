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

const app = express();
app.use(cors({ origin: ALLOWED_ORIGIN }));
app.use(express.json({ limit: '1mb' }));

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

app.listen(PORT, () => {
  console.log(`Yeti Wells backend on http://localhost:${PORT} (network=${NETWORK})`);
  console.log(`  funder=${funderAddress}`);
});
