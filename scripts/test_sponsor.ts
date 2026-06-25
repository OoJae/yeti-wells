/**
 * Validate the Enoki sponsored-tx plumbing end-to-end WITHOUT the frontend:
 * build a whitelisted `sync_impact` call -> /api/sponsor -> sign -> /api/execute.
 * Uses the admin keypair (which already owns an ImpactNFT from the on-chain e2e) as the "user".
 *
 * Run: node test_sponsor.ts   (needs the backend running on :3001)
 * Env: PACKAGE_ID, WATER_PROJECT_ID, ADMIN_SECRET_KEY, API_URL(optional)
 */
import { Transaction } from '@mysten/sui/transactions';
import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from '@mysten/sui/jsonRpc';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { fromBase64, toBase64 } from '@mysten/sui/utils';

const PKG = process.env.PACKAGE_ID!;
const PROJECT = process.env.WATER_PROJECT_ID!;
const API = process.env.API_URL ?? 'http://localhost:3001';
const kp = Ed25519Keypair.fromSecretKey(process.env.ADMIN_SECRET_KEY!);
const sender = kp.getPublicKey().toSuiAddress();
const client = new SuiJsonRpcClient({ url: getJsonRpcFullnodeUrl('testnet') });

// Find the sender's ImpactNFT (minted during the earlier e2e).
const owned = await client.getOwnedObjects({
  owner: sender,
  filter: { StructType: `${PKG}::impact_nft::ImpactNFT` },
  options: { showType: true },
});
const nftId = owned.data[0]?.data?.objectId;
if (!nftId) throw new Error('sender owns no ImpactNFT — run scripts/e2e.ts first');
console.log('user:', sender, '\nnft :', nftId);

// 1) Build the whitelisted call as transaction-kind bytes.
const tx = new Transaction();
tx.setSender(sender);
tx.moveCall({ target: `${PKG}::impact_nft::sync_impact`, arguments: [tx.object(nftId), tx.object(PROJECT)] });
const kindBytes = await tx.build({ client, onlyTransactionKind: true });
const transactionKindBytes = toBase64(kindBytes);

// 2) Sponsor.
const sponsorRes = await fetch(`${API}/api/sponsor`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ transactionKindBytes, sender }),
}).then((r) => r.json());
if (!sponsorRes.bytes) throw new Error('sponsor failed: ' + JSON.stringify(sponsorRes));
console.log('sponsored digest:', sponsorRes.digest);

// 3) User signs the sponsored bytes.
const { signature } = await kp.signTransaction(fromBase64(sponsorRes.bytes));

// 4) Execute.
const execRes = await fetch(`${API}/api/execute`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ digest: sponsorRes.digest, signature }),
}).then((r) => r.json());
if (!execRes.digest) throw new Error('execute failed: ' + JSON.stringify(execRes));

await client.waitForTransaction({ digest: execRes.digest });
const fx = await client.getTransactionBlock({ digest: execRes.digest, options: { showEffects: true } });
console.log('executed digest:', execRes.digest, 'status:', fx.effects?.status?.status);
console.log(fx.effects?.status?.status === 'success'
  ? '\n✅ Enoki sponsor → sign → execute plumbing works (gasless, user paid no gas)'
  : '\n✗ tx failed');
