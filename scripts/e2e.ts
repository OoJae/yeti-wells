/**
 * On-chain end-to-end smoke test of the Yeti Wells Phase 1 loop (testnet):
 *   donate -> soulbound Impact NFT minted + escrow grows
 *   -> sync_impact (delivered 0 -> attributed 0)
 *   -> register dev enclave -> submit_attested_milestone (TEE sig verified, escrow released, liters advance)
 *   -> sync_impact (NFT fills)
 *
 * The admin acts as donor + steward + payout for this smoke test.
 * Env: PACKAGE_ID, REGISTRY_ID, ADMIN_CAP_ID, WATER_PROJECT_ID, ADMIN_SECRET_KEY
 * Run: node e2e.ts
 */
import { Transaction } from '@mysten/sui/transactions';
import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from '@mysten/sui/jsonRpc';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { bcs } from '@mysten/sui/bcs';

function req(k: string): string {
  const v = process.env[k];
  if (!v) { console.error('Missing env ' + k); process.exit(1); }
  return v;
}
const PKG = req('PACKAGE_ID');
const REGISTRY = req('REGISTRY_ID');
const ADMIN_CAP = req('ADMIN_CAP_ID');
const PROJECT = req('WATER_PROJECT_ID');
const admin = Ed25519Keypair.fromSecretKey(req('ADMIN_SECRET_KEY'));
const client = new SuiJsonRpcClient({ url: getJsonRpcFullnodeUrl('testnet') });
const me = admin.getPublicKey().toSuiAddress();

// Fixed enclave keypair (same seed as gen_attestation_vector.ts).
const seed = new Uint8Array(32);
for (let i = 0; i < 32; i++) seed[i] = (i * 7 + 13) & 0xff;
const enclaveKp = Ed25519Keypair.fromSecretKey(seed);
const enclavePub = enclaveKp.getPublicKey().toRawBytes();

const MilestoneReport = bcs.struct('MilestoneReport', {
  project_id: bcs.Address,
  milestone_index: bcs.u64(),
  liters_reading: bcs.u64(),
  timestamp_ms: bcs.u64(),
});

async function run(label: string, build: (tx: Transaction) => void) {
  const tx = new Transaction();
  build(tx);
  const res = await client.signAndExecuteTransaction({
    signer: admin, transaction: tx,
    options: { showEffects: true, showObjectChanges: true },
  });
  await client.waitForTransaction({ digest: res.digest });
  if (res.effects?.status?.status !== 'success') {
    console.error(`✗ ${label} FAILED:`, JSON.stringify(res.effects?.status));
    process.exit(1);
  }
  console.log(`✓ ${label}  (${res.digest})`);
  return res;
}

const DONATION = 300_000_000n; // 0.3 SUI

// 1) Donate
await run('donate 0.3 SUI', (tx) => {
  const [coin] = tx.splitCoins(tx.gas, [DONATION]);
  tx.moveCall({ target: `${PKG}::donation::donate`, arguments: [tx.object(PROJECT), tx.object(REGISTRY), coin] });
});

// find the minted soulbound NFT
const owned = await client.getOwnedObjects({
  owner: me, filter: { StructType: `${PKG}::impact_nft::ImpactNFT` }, options: { showType: true },
});
const nftId = owned.data[0]?.data?.objectId;
if (!nftId) { console.error('No ImpactNFT minted'); process.exit(1); }
console.log('  minted soulbound ImpactNFT:', nftId);

// 2) sync (pre-attestation)
await run('sync_impact (pre)', (tx) => {
  tx.moveCall({ target: `${PKG}::impact_nft::sync_impact`, arguments: [tx.object(nftId), tx.object(PROJECT)] });
});

// 3) register dev enclave
const reg = await run('register_enclave_dev', (tx) => {
  tx.moveCall({
    target: `${PKG}::attestation::register_enclave_dev`,
    arguments: [
      tx.object(ADMIN_CAP),
      tx.pure.vector('u8', []), tx.pure.vector('u8', []), tx.pure.vector('u8', []),
      tx.pure.vector('u8', Array.from(enclavePub)),
    ],
  });
});
const enclaveId = (reg.objectChanges ?? []).find(
  (o): o is Extract<typeof o, { type: 'created' }> =>
    o.type === 'created' && o.objectType.endsWith('::attestation::Enclave'),
)?.objectId;
if (!enclaveId) { console.error('No Enclave created'); process.exit(1); }
console.log('  registered enclave:', enclaveId);

// 4) build + sign the milestone report for the REAL project id, then submit
const payload = MilestoneReport.serialize({
  project_id: PROJECT, milestone_index: 0n, liters_reading: 60_000n, timestamp_ms: 1_000n,
}).toBytes();
const signature = await enclaveKp.sign(payload);

await run('submit_attested_milestone (TEE)', (tx) => {
  tx.moveCall({
    target: `${PKG}::attestation::submit_attested_milestone`,
    arguments: [
      tx.object(PROJECT), tx.object(REGISTRY), tx.object(enclaveId),
      tx.pure.vector('u8', Array.from(payload)),
      tx.pure.vector('u8', Array.from(signature)),
    ],
  });
});

// 5) sync (post-attestation) — NFT fills
await run('sync_impact (post)', (tx) => {
  tx.moveCall({ target: `${PKG}::impact_nft::sync_impact`, arguments: [tx.object(nftId), tx.object(PROJECT)] });
});

// read + report final state
const proj = await client.getObject({ id: PROJECT, options: { showContent: true } });
const nft = await client.getObject({ id: nftId, options: { showContent: true } });
const pf = (proj.data?.content as any)?.fields ?? {};
const nf = (nft.data?.content as any)?.fields ?? {};
console.log('\n=== final on-chain state ===');
console.log('project.raised_mist     =', pf.raised_mist);
console.log('project.delivered_liters=', pf.delivered_liters);
console.log('project.escrow          =', pf.escrow, '(0.3 donated - 0.2 released = 0.1 SUI)');
console.log('nft.liters_attributed   =', nf.liters_attributed);
console.log('nft.xp                  =', nf.xp);
console.log('nft.tier                =', nf.tier);
console.log('\n✅ e2e loop complete: donate → soulbound NFT → TEE-attested release → NFT filled');
