/**
 * Seed a demo Yeti Wells water project on testnet via a single PTB calling
 * `project::create_project`. Run AFTER publishing the package.
 *
 * Required env:
 *   PACKAGE_ID, REGISTRY_ID, ADMIN_CAP_ID, ADMIN_SECRET_KEY (suiprivkey1...)
 * Optional env:
 *   PAYOUT_ADDRESS (defaults to the admin address), SUI_RPC (defaults to testnet fullnode)
 *
 * Get the admin key:  sui keytool export --key-identity $(sui client active-address) --json
 *   then export ADMIN_SECRET_KEY=<exportedPrivateKey>
 *
 * Run:  node seed.ts   (Node 24+ runs TS natively)
 */
import { Transaction } from '@mysten/sui/transactions';
// v2 SDK: the JSON-RPC client moved to `@mysten/sui/jsonRpc` (SuiClient -> SuiJsonRpcClient).
// We use JSON-RPC here for its `objectChanges` result shape (vs gRPC's changedObjects union).
import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from '@mysten/sui/jsonRpc';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { writeFileSync } from 'node:fs';

function req(key: string): string {
  const v = process.env[key];
  if (!v) {
    console.error(`Missing required env var: ${key}`);
    process.exit(1);
  }
  return v;
}

const PACKAGE_ID = req('PACKAGE_ID');
const REGISTRY_ID = req('REGISTRY_ID');
const ADMIN_CAP_ID = req('ADMIN_CAP_ID');
const SECRET = req('ADMIN_SECRET_KEY');
const RPC = process.env.SUI_RPC || getJsonRpcFullnodeUrl('testnet');

const keypair = Ed25519Keypair.fromSecretKey(SECRET);
const sender = keypair.getPublicKey().toSuiAddress();
const payout = process.env.PAYOUT_ADDRESS || sender;
const client = new SuiJsonRpcClient({ url: RPC });

const tx = new Transaction();
tx.moveCall({
  target: `${PACKAGE_ID}::project::create_project`,
  arguments: [
    tx.object(ADMIN_CAP_ID),
    tx.object(REGISTRY_ID),
    tx.pure.string('Kibera Borehole #1'),
    tx.pure.string('Nairobi, KE'),
    tx.pure.string('Solar-powered borehole serving ~1,200 people with clean water.'),
    tx.pure.string(''), // image_blob_id (Walrus) — placeholder until Phase 4
    tx.pure.u64(1_000_000_000n), // funding goal: 1 SUI (testnet-affordable demo)
    tx.pure.u64(100_000n), // target liters
    tx.pure.address(payout),
    tx.pure.vector('string', ['Drill borehole', 'Deliver 50,000 L', 'Project complete']),
    tx.pure.vector('u64', [0n, 50_000n, 100_000n]), // liter thresholds
    tx.pure.vector('u64', [200_000_000n, 300_000_000n, 500_000_000n]), // releases (sum = goal)
  ],
});

const result = await client.signAndExecuteTransaction({
  signer: keypair,
  transaction: tx,
  options: { showObjectChanges: true, showEffects: true },
});

await client.waitForTransaction({ digest: result.digest });

const status = result.effects?.status?.status;
if (status !== 'success') {
  console.error('Seed tx failed:', JSON.stringify(result.effects?.status));
  process.exit(1);
}

const created = (result.objectChanges ?? []).find(
  (o): o is Extract<typeof o, { type: 'created' }> =>
    o.type === 'created' && o.objectType.endsWith('::project::WaterProject'),
);

if (!created) {
  console.error('Could not find created WaterProject in objectChanges');
  process.exit(1);
}

const out = {
  network: 'testnet',
  packageId: PACKAGE_ID,
  registryId: REGISTRY_ID,
  waterProjectId: created.objectId,
  digest: result.digest,
  seededAt: new Date().toISOString(),
};
writeFileSync(new URL('./.seeded.json', import.meta.url), JSON.stringify(out, null, 2) + '\n');

console.log('✅ Seeded demo project');
console.log('   WATER_PROJECT_ID =', created.objectId);
console.log('   digest           =', result.digest);
console.log('   wrote scripts/.seeded.json');
