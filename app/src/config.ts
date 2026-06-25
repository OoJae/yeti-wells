// Public runtime config (from app/.env.local; VITE_ vars are safe in the browser).
const env = import.meta.env;

export const config = {
  network: (env.VITE_SUI_NETWORK ?? "testnet") as "testnet" | "mainnet" | "devnet",
  packageId: env.VITE_PACKAGE_ID as string,
  registryId: env.VITE_REGISTRY_ID as string,
  waterProjectId: env.VITE_WATER_PROJECT_ID as string,
  enokiPublicKey: env.VITE_ENOKI_PUBLIC_KEY as string,
  googleClientId: env.VITE_GOOGLE_CLIENT_ID as string,
  apiUrl: (env.VITE_API_URL ?? "http://localhost:3001") as string,
  walrusAggregator: (env.VITE_WALRUS_AGGREGATOR ?? "https://aggregator.walrus-testnet.walrus.space") as string,
};

/** Public Walrus aggregator URL to read a blob (usable as an <img src>). */
export const walrusBlobUrl = (blobId: string) => `${config.walrusAggregator}/v1/blobs/${blobId}`;

export const MIST_PER_SUI = 1_000_000_000;

export const IMPACT_NFT_TYPE = `${config.packageId}::impact_nft::ImpactNFT`;
export const DONATE_TARGET = `${config.packageId}::donation::donate`;
export const DONATE_AGAIN_TARGET = `${config.packageId}::donation::donate_again`;
export const SYNC_TARGET = `${config.packageId}::impact_nft::sync_impact`;

export const TIER_LABELS = ["Spring", "Stream", "River", "Glacier"] as const;
