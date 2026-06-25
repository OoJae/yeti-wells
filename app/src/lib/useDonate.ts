import { Transaction, coinWithBalance } from "@mysten/sui/transactions";
import { useSuiClient, useCurrentAccount, useSignTransaction } from "@mysten/dapp-kit";
import { toBase64 } from "@mysten/sui/utils";
import { execute, sponsor } from "./api";
import { config, DONATE_AGAIN_TARGET, DONATE_TARGET } from "../config";

/**
 * Gasless donate: build the move call with the donor's OWN coins as `payment` (NEVER tx.gas — that's
 * the sponsor's), get transaction-kind bytes, sponsor via Enoki, sign with the connected wallet, execute.
 * If the donor already holds an ImpactNFT for this project, route to donate_again.
 */
export function useDonate() {
  const client = useSuiClient();
  const account = useCurrentAccount();
  const { mutateAsync: signTransaction } = useSignTransaction();

  return async function donate(amountMist: bigint, existingNftId?: string | null): Promise<string> {
    if (!account) throw new Error("Sign in first");

    const tx = new Transaction();
    tx.setSender(account.address);
    const payment = coinWithBalance({ balance: amountMist });

    if (existingNftId) {
      tx.moveCall({
        target: DONATE_AGAIN_TARGET,
        arguments: [tx.object(config.waterProjectId), tx.object(config.registryId), tx.object(existingNftId), payment],
      });
    } else {
      tx.moveCall({
        target: DONATE_TARGET,
        arguments: [tx.object(config.waterProjectId), tx.object(config.registryId), payment],
      });
    }

    const kindBytes = await tx.build({ client, onlyTransactionKind: true });
    const { bytes, digest } = await sponsor(toBase64(kindBytes), account.address);

    // Sign the sponsored bytes with the connected (Enoki) wallet.
    const signed = await signTransaction({ transaction: bytes });
    const res = await execute(digest, signed.signature);
    await client.waitForTransaction({ digest: res.digest });
    return res.digest;
  };
}
