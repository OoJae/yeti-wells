import { Transaction } from "@mysten/sui/transactions";
import { useSuiClient, useCurrentAccount, useSignTransaction } from "@mysten/dapp-kit";
import { toBase64 } from "@mysten/sui/utils";
import { execute, sponsor } from "./api";
import { config, SYNC_TARGET } from "../config";

/**
 * Gasless `sync_impact`: recompute the donor's NFT (liters/xp/tier) from the project's on-chain truth.
 * Same sponsor → sign → execute flow as donate, but no coin/payment. zkLogin signs silently (no popup).
 */
export function useSyncImpact() {
  const client = useSuiClient();
  const account = useCurrentAccount();
  const { mutateAsync: signTransaction } = useSignTransaction();

  return async function sync(nftId: string): Promise<string> {
    if (!account) throw new Error("Sign in first");

    const tx = new Transaction();
    tx.setSender(account.address);
    tx.moveCall({
      target: SYNC_TARGET,
      arguments: [tx.object(nftId), tx.object(config.waterProjectId)],
    });

    const kindBytes = await tx.build({ client, onlyTransactionKind: true });
    const { bytes, digest } = await sponsor(toBase64(kindBytes), account.address);
    const signed = await signTransaction({ transaction: bytes });
    const res = await execute(digest, signed.signature);
    await client.waitForTransaction({ digest: res.digest });
    return res.digest;
  };
}
