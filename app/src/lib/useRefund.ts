import { Transaction } from "@mysten/sui/transactions";
import { useSuiClient, useCurrentAccount, useSignTransaction } from "@mysten/dapp-kit";
import { toBase64 } from "@mysten/sui/utils";
import { execute, sponsor } from "./api";
import { config, REFUND_TARGET } from "../config";

/**
 * Gasless refund on a CANCELLED campaign: returns the donor's share of remaining escrow and burns the
 * soulbound NFT. Same sponsor -> sign -> execute flow as donate. The NFT is consumed by value on-chain.
 */
export function useRefund() {
  const client = useSuiClient();
  const account = useCurrentAccount();
  const { mutateAsync: signTransaction } = useSignTransaction();

  return async function refund(projectId: string, nftId: string): Promise<string> {
    if (!account) throw new Error("Sign in first");

    const tx = new Transaction();
    tx.setSender(account.address);
    tx.moveCall({
      target: REFUND_TARGET,
      arguments: [tx.object(projectId), tx.object(config.registryId), tx.object(nftId)],
    });

    const kindBytes = await tx.build({ client, onlyTransactionKind: true });
    const { bytes, digest } = await sponsor(toBase64(kindBytes), account.address);
    const signed = await signTransaction({ transaction: bytes });
    const res = await execute(digest, signed.signature);
    await client.waitForTransaction({ digest: res.digest });
    return res.digest;
  };
}
