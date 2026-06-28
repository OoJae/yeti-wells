#!/usr/bin/env bash
# Yeti Wells — ONE-COMMAND genuine Oyster TEE go-live for the judging window.
#
# Deploys a fresh Marlin Oyster (AWS-Nitro) enclave from the published reproducible EIF, registers its
# ephemeral key on Sui testnet, and points the live Railway backend at it. The backend AUTO-FALLS-BACK to
# the proven sim signer if the enclave is ever down, so the demo never breaks.
#
#   Usage:  ./scripts/oyster-golive.sh [DURATION_MINUTES]
#   Default duration 5040 min (3.5 days, ~$8 USDC). Run ~June 30 to cover the submission window.
#   Needs ~$10 USDC + ~0.3 SUI in the oyster-payer wallet (.oyster-wallet).
set -euo pipefail
DURATION="${1:-5040}"
REPO="/Users/oluwademilade/Desktop/Yeti Wells"
GH_EIF="https://github.com/OoJae/yeti-wells-eif/releases/download/v1/image.eif"
COMPOSE="$REPO/enclave/yeti_wells_app/docker-compose.yml"
PAYER="0x7d5cbcddf7b1bfdce442ea574620c12900b21c2ecf95f53ca37b6b5d8f52777e"
USDC_TYPE="0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC"
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/bin:/bin:$PATH"
PK="$(tr -d '\n[:space:]' < "$REPO/.oyster-wallet")"

echo "[golive] 1/5 consolidating USDC into one fresh coin (avoids oyster-cvm's coin-selection bug)..."
DEP="$(cd "$REPO/server" && node --input-type=module -e '
import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from "@mysten/sui/jsonRpc";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import fs from "fs";
const kp = Ed25519Keypair.fromSecretKey(fs.readFileSync("../.oyster-wallet","utf8").trim());
const me = kp.getPublicKey().toSuiAddress();
const c = new SuiJsonRpcClient({ url: getJsonRpcFullnodeUrl("mainnet") });
const coins = (await c.getCoins({ owner: me, coinType: process.env.UT })).data;
if (coins.length === 0) {
  console.error("[golive] ERROR: oyster-payer "+me+" holds 0 USDC — fund it (~$10 USDC + ~0.3 SUI) before go-live.");
  process.exit(1);
}
coins.sort((a,b)=>Number(b.balance)-Number(a.balance));
let keep = coins[0].coinObjectId;
if (coins.length > 1) {
  const tx = new Transaction();
  tx.mergeCoins(tx.object(keep), coins.slice(1).map(x=>tx.object(x.coinObjectId)));
  const r = await c.signAndExecuteTransaction({ signer: kp, transaction: tx });
  await c.waitForTransaction({ digest: r.digest });
}
console.log(keep);
' UT="$USDC_TYPE")"
echo "[golive]     deposit coin: $DEP"
sleep 8  # let the operator gRPC node sync the merged coin version

echo "[golive] 2/5 deploying Oyster enclave (c6g.xlarge, ${DURATION}min)..."
oyster-cvm deploy --deployment sui --wallet-private-key "$PK" --arch arm64 \
  --image-url "$GH_EIF" --docker-compose "$COMPOSE" \
  --instance-type c6g.xlarge --region ap-south-1 --enclave-memory 6144 --enclave-cpu 2 \
  --duration-in-minutes "$DURATION" --usdc-coin "$DEP" 2>&1 | tee /tmp/golive-deploy.log
IP="$(grep -oE 'Enclave is ready! IP address: [0-9.]+' /tmp/golive-deploy.log | grep -oE '[0-9.]+$' | tail -1)"
[ -z "$IP" ] && { echo "[golive] ERROR: no enclave IP (check /tmp/golive-deploy.log)"; exit 1; }
echo "[golive]     enclave IP: $IP"

echo "[golive] 3/5 fetching enclave ed25519 pubkey..."
PUBKEY="$(curl -fsS --max-time 20 "http://$IP:3000/health_check" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>console.log(JSON.parse(d).pk))')"
echo "[golive]     pubkey: $PUBKEY"

echo "[golive] 4/5 registering enclave on testnet..."
NEWENC="$(cd "$REPO/scripts" && set -a && . "$REPO/server/.env" && set +a && ADMIN_SECRET_KEY="$FUNDER_SECRET_KEY" \
  node register-enclave.ts --pubkey="$PUBKEY" 2>&1 | grep -oE '0x[0-9a-f]{64}' | head -1)"
[ -z "$NEWENC" ] && { echo "[golive] ERROR: registration failed"; exit 1; }
echo "[golive]     ENCLAVE_ID: $NEWENC"

echo "[golive] 5/5 pointing Railway backend at the live enclave..."
cd "$REPO/server"
railway variables --set "ENCLAVE_URL=http://$IP:3000" --set "ENCLAVE_ID=$NEWENC" --service yeti-wells-backend --skip-deploys
railway up --detach --service yeti-wells-backend

echo ""
echo "[golive] ✅ DONE — backend now attests via the GENUINE Oyster TEE."
echo "         enclave   : http://$IP:3000   ENCLAVE_ID=$NEWENC"
echo "         verify    : oyster-cvm verify --enclave-ip $IP   (expect PCR0 92c6021a…, AWS-Nitro root)"
echo "         (auto-falls-back to the sim signer if the enclave ever drops)"
