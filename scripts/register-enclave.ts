/**
 * Register the Yeti Wells enclave on-chain.
 *
 *   node register-enclave.ts --dev     -> SIM/BACKUP: register the local signer's pubkey via
 *                                          enclave::register_enclave_dev (no hardware attestation).
 *   node register-enclave.ts           -> REAL (AWS): create_enclave_config(real PCRs) + register_enclave
 *                                          with the live Nitro attestation document (see docs/NAUTILUS.md).
 *
 * Env: PACKAGE_ID_V2, ENCLAVE_CAP_ID, ADMIN_SECRET_KEY ; real mode also: ENCLAVE_URL.
 */
import { Transaction } from "@mysten/sui/transactions";
import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from "@mysten/sui/jsonRpc";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";

function req(k: string): string {
  const v = process.env[k];
  if (!v) { console.error("Missing env " + k); process.exit(1); }
  return v;
}

const PKG_V2 = req("PACKAGE_ID_V2");
const CAP_ID = req("ENCLAVE_CAP_ID");
const admin = Ed25519Keypair.fromSecretKey(req("ADMIN_SECRET_KEY"));
const client = new SuiJsonRpcClient({ url: getJsonRpcFullnodeUrl("testnet") });
const APP_WITNESS = `${PKG_V2}::enclave_app::AppWitness`;
const dev = process.argv.includes("--dev");

/** Fixed simulated-enclave ed25519 key (same seed as the backend signer + gen_attestation_vector). */
function localEnclaveKeypair(): Ed25519Keypair {
  const seed = new Uint8Array(32);
  for (let i = 0; i < 32; i++) seed[i] = (i * 7 + 13) & 0xff;
  return Ed25519Keypair.fromSecretKey(seed);
}

if (!dev) {
  // REAL (AWS Nitro) registration: create the EnclaveConfig with genuine PCRs, then verify the live
  // attestation document on-chain and register the enclave's pubkey. Env: ENCLAVE_URL, PCR0, PCR1, PCR2.
  const ENCLAVE_URL = req("ENCLAVE_URL");
  const pcr = (k: string) => Array.from(Buffer.from(req(k).replace(/^0x/, ""), "hex"));
  const pcr0 = pcr("PCR0"), pcr1 = pcr("PCR1"), pcr2 = pcr("PCR2");

  // 1) create_enclave_config(cap, name, pcr0, pcr1, pcr2)
  const tx1 = new Transaction();
  tx1.moveCall({
    target: `${PKG_V2}::enclave::create_enclave_config`,
    typeArguments: [APP_WITNESS],
    arguments: [
      tx1.object(CAP_ID),
      tx1.pure.string("yeti-wells enclave"),
      tx1.pure.vector("u8", pcr0),
      tx1.pure.vector("u8", pcr1),
      tx1.pure.vector("u8", pcr2),
    ],
  });
  const r1 = await client.signAndExecuteTransaction({ signer: admin, transaction: tx1, options: { showObjectChanges: true } });
  await client.waitForTransaction({ digest: r1.digest });
  const cfg = (r1.objectChanges ?? []).find(
    (o): o is Extract<typeof o, { type: "created" }> => o.type === "created" && o.objectType.includes("::enclave::EnclaveConfig<"),
  );
  if (!cfg) { console.error("no EnclaveConfig created"); process.exit(1); }
  console.log("EnclaveConfig:", cfg.objectId);

  // 2) fetch the live attestation document, verify on-chain, and register the enclave
  const att = (await (await fetch(`${ENCLAVE_URL}/get_attestation`)).json()) as { attestation: string };
  const docBytes = Array.from(Buffer.from(att.attestation.replace(/^0x/, ""), "hex"));
  const tx2 = new Transaction();
  const doc = tx2.moveCall({
    target: "0x2::nitro_attestation::load_nitro_attestation",
    arguments: [tx2.pure.vector("u8", docBytes), tx2.object("0x6")], // 0x6 = Clock
  });
  tx2.moveCall({
    target: `${PKG_V2}::enclave::register_enclave`,
    typeArguments: [APP_WITNESS],
    arguments: [tx2.object(cfg.objectId), doc],
  });
  const r2 = await client.signAndExecuteTransaction({ signer: admin, transaction: tx2, options: { showObjectChanges: true } });
  await client.waitForTransaction({ digest: r2.digest });
  const enc = (r2.objectChanges ?? []).find(
    (o): o is Extract<typeof o, { type: "created" }> => o.type === "created" && o.objectType.includes("::enclave::Enclave<"),
  );
  console.log("✅ REAL enclave registered (genuine PCRs)");
  console.log("   ENCLAVE_CONFIG_ID =", cfg.objectId);
  console.log("   ENCLAVE_ID        =", enc?.objectId);
  console.log("→ set ENCLAVE_ID + ENCLAVE_URL in server/.env, then restart the backend");
  process.exit(0);
}

// --- dev/sim registration ---
const pubkey = localEnclaveKeypair().getPublicKey().toRawBytes();
const tx = new Transaction();
tx.moveCall({
  target: `${PKG_V2}::enclave::register_enclave_dev`,
  typeArguments: [APP_WITNESS],
  arguments: [tx.object(CAP_ID), tx.pure.vector("u8", Array.from(pubkey))],
});
const res = await client.signAndExecuteTransaction({
  signer: admin,
  transaction: tx,
  options: { showEffects: true, showObjectChanges: true },
});
await client.waitForTransaction({ digest: res.digest });
if (res.effects?.status?.status !== "success") {
  console.error("register_enclave_dev failed:", JSON.stringify(res.effects?.status));
  process.exit(1);
}
const enc = (res.objectChanges ?? []).find(
  (o): o is Extract<typeof o, { type: "created" }> =>
    o.type === "created" && o.objectType.includes("::enclave::Enclave<"),
);
console.log("✅ dev enclave registered");
console.log("   ENCLAVE_ID =", enc?.objectId);
console.log("   pubkey     =", Buffer.from(pubkey).toString("hex"));
console.log("   digest     =", res.digest);
console.log("→ set ENCLAVE_ID in server/.env");
