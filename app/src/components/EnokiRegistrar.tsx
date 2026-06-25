import { useEffect } from "react";
import { useSuiClientContext } from "@mysten/dapp-kit";
import { isEnokiNetwork, registerEnokiWallets } from "@mysten/enoki";
import { config } from "../config";

/**
 * Registers Enoki zkLogin wallets (Google) into the dApp Kit wallet standard.
 * Renders nothing; must live inside <WalletProvider>. Re-registers when the network/client changes.
 */
export function EnokiRegistrar() {
  const { client, network } = useSuiClientContext();

  useEffect(() => {
    if (!isEnokiNetwork(network)) return;
    const { unregister } = registerEnokiWallets({
      apiKey: config.enokiPublicKey,
      client,
      network,
      providers: {
        google: { clientId: config.googleClientId },
      },
    });
    return unregister;
  }, [client, network]);

  return null;
}
