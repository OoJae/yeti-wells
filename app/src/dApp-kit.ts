import { createNetworkConfig } from "@mysten/dapp-kit";

// Legacy @mysten/dapp-kit network config (JSON-RPC). Testnet only for the demo.
const { networkConfig } = createNetworkConfig({
  testnet: { url: "https://fullnode.testnet.sui.io:443", network: "testnet" },
});

export { networkConfig };
