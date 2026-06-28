import { Transaction } from "@mysten/sui/transactions";
import { useSuiClient, useCurrentAccount, useSignTransaction } from "@mysten/dapp-kit";
import { toBase64 } from "@mysten/sui/utils";
import { execute, sponsor } from "./api";
import { config, DONATE_AGAIN_TARGET, DONATE_TARGET } from "../config";

const SUI_TYPE = "0x2::sui::SUI";

/**
 * Gasless donate. The `payment` is split from the donor's OWN SUI coin object (NOT `tx.gas` — in a sponsored
 * tx that's the sponsor's coin, which Enoki rejects with "Cannot use GasCoin as a transaction argument").
 * We fetch the donor's SUI coins, merge them, and split the payment from that owned object. Then we sponsor
 * via Enoki, sign with the connected wallet, and execute. Repeats route to donate_again.
 */
export function useDonate() {
  const client = useSuiClient();
  const account = useCurrentAccount();
  const { mutateAsync: signTransaction } = useSignTransaction();

  return async function donate(
    projectId: string,
    amountMist: bigint,
    existingNftId?: string | null,
  ): Promise<string> {
    if (!account) throw new Error("Sign in first");

    const { data: coins } = await client.getCoins({ owner: account.address, coinType: SUI_TYPE });
    if (coins.length === 0) {
      throw new Error("No SUI yet — your starter grant is still landing. Try again in a moment.");
    }
    const total = coins.reduce((sum, c) => sum + BigInt(c.balance), 0n);
    if (total < amountMist) {
      throw new Error("Not enough SUI for that amount — pick a smaller amount.");
    }

    const tx = new Transaction();
    tx.setSender(account.address);

    // Use a donor-owned coin object for the payment (merge first so any coin set works).
    const primary = tx.object(coins[0].coinObjectId);
    if (coins.length > 1) {
      tx.mergeCoins(primary, coins.slice(1).map((c) => tx.object(c.coinObjectId)));
    }
    const [payment] = tx.splitCoins(primary, [amountMist]);

    if (existingNftId) {
      tx.moveCall({
        target: DONATE_AGAIN_TARGET,
        arguments: [tx.object(projectId), tx.object(config.registryId), tx.object(existingNftId), payment],
      });
    } else {
      tx.moveCall({
        target: DONATE_TARGET,
        arguments: [tx.object(projectId), tx.object(config.registryId), payment],
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
