# Marlin Oyster setup guide (Yeti Wells — genuine TEE, no AWS account)

Phase 5's attestation already works on-chain (real Nautilus `verify_signature`); this gets you **genuine
hardware-attested PCRs** by running our enclave in a **Marlin Oyster** confidential VM (AWS Nitro under the hood)
— **without your own AWS account**. You do the deploy below (wallet + a few $ of USDC); then hand me **3 values**
(§6) and I register it on-chain + point the app at it.

## 0. Mental model
Oyster rents you a real **AWS-Nitro** enclave and gives an attestation document **rooted at the AWS Nitro root
key** → real PCRs you can verify with `oyster-cvm verify`. We deploy our **existing ed25519 Nautilus enclave**
(no rework) as a Docker image; it signs `MilestoneReport`s; our contract verifies them. You don't manage AWS —
Oyster does. Cost ≈ **$1–2** (per `--duration-in-minutes`; **stop = stop paying**).

| Thing | Where | Notes |
|---|---|---|
| Funded wallet | your keys | ~**1–2 USDC + ~0.001 ETH** (gas). Pays Oyster operators. |
| `oyster-cvm` CLI | your machine | deploys the Docker image to the Oyster marketplace |
| Enclave Docker image | your registry | built from our `enclave/yeti_wells_app/Dockerfile`; referenced by **digest** |

## 1. Wallet + funds
Two payment options (pick one):
- **USDC on Sui** (natural for us) — deploy with `--deployment sui`. Fund a Sui wallet with ~**1–2 USDC** (+ a
  little SUI for gas). Export its private key for `--wallet-private-key`.
- **Default (Arbitrum One)** — fund a wallet with ~**1 USDC + 0.001 ETH** on Arbitrum One.

(USDC is real money, but small. `--duration-in-minutes` caps the spend.)

## 2. Install the oyster-cvm CLI
Follow Marlin's quickstart: <https://docs.marlin.org/oyster/build-cvm/quickstart> (installs `oyster-cvm`).
Verify with `oyster-cvm --version`.

## 3. Build the enclave Docker image
```bash
git clone https://github.com/MystenLabs/nautilus && cd nautilus
# add the Yeti Wells app (same as docs/NAUTILUS.md §2):
mkdir -p src/nautilus-server/src/apps/yeti-wells
cp <this-repo>/enclave/yeti_wells_app/mod.rs                 src/nautilus-server/src/apps/yeti-wells/mod.rs
cp <this-repo>/enclave/yeti_wells_app/allowed_endpoints.yaml src/nautilus-server/src/apps/yeti-wells/allowed_endpoints.yaml
cp <this-repo>/enclave/yeti_wells_app/Dockerfile            src/nautilus-server/Dockerfile
# wire it (docs/NAUTILUS.md §2): lib.rs module + Cargo.toml `yeti-wells = []` feature
# set allowed_endpoints.yaml to your SENSOR_URL host (a feed returning { "liters": <u64> })

cd src/nautilus-server
docker build -t yeti-wells-enclave .
docker tag yeti-wells-enclave <registry>/yeti-wells-enclave:latest
docker push <registry>/yeti-wells-enclave:latest
DIGEST=$(docker inspect --format='{{index .RepoDigests 0}}' <registry>/yeti-wells-enclave:latest)
echo "$DIGEST"     # e.g. <registry>/yeti-wells-enclave@sha256:abc…
```
Put that digest into `enclave/yeti_wells_app/docker-compose.yml` (the `image:` line) and set `SENSOR_URL` there.
(Referencing by **digest** is what makes the PCRs reproducible.)

## 4. Deploy on Oyster
```bash
oyster-cvm deploy \
  --wallet-private-key $PRIVATE_KEY \
  --docker-compose <this-repo>/enclave/yeti_wells_app/docker-compose.yml \
  --instance-type c6g.xlarge \
  --duration-in-minutes 60 \
  --deployment sui            # omit for the Arbitrum-One default
```
The output includes the enclave's **public IP**. Our server listens on **:3000** (`network_mode: host`).

## 5. Verify + grab the values
```bash
oyster-cvm verify --enclave-ip <PUBLIC_IP>        # prints genuine PCR0 / PCR1 / PCR2 (and PCR16)
curl http://<PUBLIC_IP>:3000/health_check         # prints { "pk": "<enclave ed25519 pubkey hex>", … }
```

## 6. Hand me these 3 values
1. **Enclave URL** → `http://<PUBLIC_IP>:3000`
2. **Enclave ed25519 pubkey** (the `pk` from `/health_check`)
3. **PCR0 / PCR1 / PCR2** (from `oyster-cvm verify`)

## 7. I register it on-chain + wire the app
```bash
# (me) register the Oyster enclave's key as Enclave<AppWitness>:
PACKAGE_ID_V2=0xc59879ee5dbdc25d26619b3e50e68c907dce1fd5b621f508103f38cf70321605 \
ENCLAVE_CAP_ID=0x137c8df268a60eb2a1414c673eae93af025ba3d1925d8629741561b4af196c11 \
ADMIN_SECRET_KEY=<suiprivkey…> \
node register-enclave.ts --pubkey=<enclave_pubkey>
```
Then I set `ENCLAVE_ID=<new>` + `ENCLAVE_URL=http://<PUBLIC_IP>:3000` in `server/.env` and restart. The steward
**"Run attestation"** now calls the **genuine Oyster TEE** (`/process_data` → ed25519-signed IntentMessage), and
`submit_attested_milestone_v2` verifies it → releases escrow → fills the globe. We display the Oyster-verified
PCRs for credibility.

> Stronger option we may try: if Oyster's attestation document embeds our app's ephemeral key, we can instead use
> native `node register-enclave.ts` (PCRs + the live Nitro doc verified **on-chain** by `sui::nitro_attestation`).
> Either way it's ed25519 — no secp256k1 rework.

## 8. ⚠️ Stop when done (cost control)
The deployment auto-expires after `--duration-in-minutes`. To stop early / confirm:
```bash
oyster-cvm list --wallet <addr>      # find your deployment
oyster-cvm stop --enclave-ip <IP>    # (or let the duration lapse)
```
Redeploying the same image digest reproduces the same PCRs — you only re-register if the enclave's ephemeral key
changed (it regenerates on each boot; for a longer-lived demo, persist it via a volume like the sui-oyster-demo).

## Gotchas
- **Ephemeral key resets on reboot.** Register the pubkey from the *current* boot; if the enclave restarts, re-run §7 with the new pubkey.
- **`SENSOR_URL` must be reachable from the enclave** and listed in `allowed_endpoints.yaml` (egress is filtered).
- **Pin the base image / use the digest** so PCRs are reproducible across deploys.
- **The local sim is your backup** — with `ENCLAVE_URL` empty the same on-chain flow runs without Oyster (record a backup demo).

## Sources
- Marlin Oyster — quickstart / oyster-cvm: <https://docs.marlin.org/oyster/build-cvm/quickstart>
- Marlin — verify attestations (AWS-Nitro-rooted doc): <https://docs.marlin.org/oyster/build-cvm/guides/verify-attestations-oyster-cvm>
- Marlin × Sui Nautilus reference: <https://github.com/marlinprotocol/sui-oyster-demo>
- Our AWS-Nitro variant (same enclave app, different host): `docs/NAUTILUS.md`
