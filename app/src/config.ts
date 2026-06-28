// Public runtime config (from app/.env.local; VITE_ vars are safe in the browser).
const env = import.meta.env;

// A Sui upgrade keeps the ORIGINAL package id for struct/event TYPE tags, but mints a NEW id for calling
// changed/new functions. So: `packageId` (original) is used for IMPACT_NFT_TYPE + the event types, and
// `callPackageId` (the latest upgrade) is used for every Move CALL target. They differ after an upgrade.
const PACKAGE_ID = env.VITE_PACKAGE_ID as string;

export const config = {
  network: (env.VITE_SUI_NETWORK ?? "testnet") as "testnet" | "mainnet" | "devnet",
  packageId: PACKAGE_ID,
  callPackageId: (env.VITE_CALL_PACKAGE_ID ?? PACKAGE_ID) as string,
  registryId: env.VITE_REGISTRY_ID as string,
  enokiPublicKey: env.VITE_ENOKI_PUBLIC_KEY as string,
  googleClientId: env.VITE_GOOGLE_CLIENT_ID as string,
  apiUrl: (env.VITE_API_URL ?? "http://localhost:3001") as string,
  walrusAggregator: (env.VITE_WALRUS_AGGREGATOR ?? "https://aggregator.walrus-testnet.walrus.space") as string,
  // The genuine AWS-Nitro enclave object id (if any). A milestone attested by THIS enclave is shown as
  // "Verified by TEE (AWS Nitro)"; anything else is "Released (demo signer)". (FE-02)
  genuineEnclaveId: (env.VITE_GENUINE_ENCLAVE_ID ?? "") as string,
};

/** Demo/test campaigns to hide from Browse (OPS-03 curation). Comma-separated object ids. */
export const PROJECT_DENYLIST = new Set(
  ((env.VITE_PROJECT_DENYLIST ?? "") as string)
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
);

/** Public Walrus aggregator URL to read a blob (usable as an <img src>). */
export const walrusBlobUrl = (blobId: string) => `${config.walrusAggregator}/v1/blobs/${blobId}`;

export const MIST_PER_SUI = 1_000_000_000;

// Struct/event TYPE tags — stay at the ORIGINAL package id across upgrades.
export const IMPACT_NFT_TYPE = `${config.packageId}::impact_nft::ImpactNFT`;
export const PROJECT_CREATED_EVENT = `${config.packageId}::events::ProjectCreated`;
export const DONATION_EVENT = `${config.packageId}::events::DonationEvent`;
export const MILESTONE_ATTESTED_EVENT = `${config.packageId}::events::MilestoneAttested`;
export const MILESTONE_ATTESTED_V2_EVENT = `${config.packageId}::events::MilestoneAttestedV2`;

// Move CALL targets — must point at the LATEST upgrade (callPackageId).
export const DONATE_TARGET = `${config.callPackageId}::donation::donate`;
export const DONATE_AGAIN_TARGET = `${config.callPackageId}::donation::donate_again`;
export const REFUND_TARGET = `${config.callPackageId}::donation::refund`;
export const SYNC_TARGET = `${config.callPackageId}::impact_nft::sync_impact`;

export const TIER_LABELS = ["Spring", "Stream", "River", "Glacier"] as const;
