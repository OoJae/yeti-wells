import { useEffect, useRef, useState } from "react";
import {
  useConnectWallet,
  useCurrentAccount,
  useDisconnectWallet,
  useWallets,
} from "@mysten/dapp-kit";
import { isEnokiWallet } from "@mysten/enoki";
import { fundAddress } from "./api";

/** Google (zkLogin) sign-in via the registered Enoki wallet. */
export function useGoogleAuth() {
  const wallets = useWallets();
  const account = useCurrentAccount();
  const { mutate: connect, isPending } = useConnectWallet();
  const { mutate: disconnect } = useDisconnectWallet();

  const googleWallet = wallets.find((w) => isEnokiWallet(w) && w.provider === "google");

  return {
    account,
    canSignIn: !!googleWallet,
    isPending,
    signIn: () => {
      if (googleWallet) connect({ wallet: googleWallet });
    },
    signOut: () => disconnect(),
  };
}

/** On first sign-in, request a one-time starter grant so the new address can donate. */
export function useAutoFund() {
  const account = useCurrentAccount();
  const requested = useRef<Set<string>>(new Set());
  const [funding, setFunding] = useState(false);

  useEffect(() => {
    const addr = account?.address;
    if (!addr || requested.current.has(addr)) return;
    requested.current.add(addr);
    setFunding(true);
    fundAddress(addr)
      .catch((e) => console.warn("starter grant failed", e))
      .finally(() => setFunding(false));
  }, [account?.address]);

  return funding;
}
