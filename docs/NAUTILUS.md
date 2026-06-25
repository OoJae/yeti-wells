# Yeti Wells — Nautilus TEE runbook (genuine AWS Nitro PCRs)

The attestation loop already works locally with a **simulated** enclave (real ed25519 IntentMessage signing,
dev-registered, verified on-chain). This runbook upgrades it to a **genuine AWS Nitro enclave** with
hardware-attested PCRs. It's your hands-on ops on **your AWS account** (a Mac can't run a Nitro enclave).

**Cost:** the Nitro Enclave feature is free; you pay for the EC2 host (needs ≥4 vCPU — free tier doesn't qualify),
~**$0.17–0.20/hr** (e.g. `m5.xlarge`). Spin up → build → register → record → **terminate** ≈ **$1–2**. PCRs are
reproducible, so you can terminate and relaunch later. **The last step is "terminate the instance."**

Deployed context (testnet): upgraded package (v2) `0xc59879ee5dbdc25d26619b3e50e68c907dce1fd5b621f508103f38cf70321605`,
enclave Cap `0x137c8df268a60eb2a1414c673eae93af025ba3d1925d8629741561b4af196c11`,
witness type `…::enclave_app::AppWitness`.

## 1. Launch a Nitro-capable EC2
- AMI: Amazon Linux 2023 · type: **m5.xlarge** (4 vCPU) · **Advanced details → Nitro Enclave: Enable**.
- Security group: inbound 22 (SSH from your IP) and **3000** (the enclave server, from your IP).
- SSH in, then:
```bash
sudo dnf install -y aws-nitro-enclaves-cli aws-nitro-enclaves-cli-devel docker git make gcc openssl-devel
sudo usermod -aG ne ec2-user && sudo usermod -aG docker ec2-user
sudo systemctl enable --now docker nitro-enclaves-allocator.service
curl https://sh.rustup.rs -sSf | sh -s -- -y && source "$HOME/.cargo/env"
# allocate enclave resources (>= 2 vCPU, ~2GB) in /etc/nitro_enclaves/allocator.yaml, then:
sudo systemctl restart nitro-enclaves-allocator.service
# log out/in so the group changes take effect
```

## 2. Clone Nautilus + add the Yeti Wells app
```bash
git clone https://github.com/MystenLabs/nautilus && cd nautilus
mkdir -p src/nautilus-server/src/apps/yeti-wells
# copy the two files from this repo's enclave/yeti_wells_app/ :
#   mod.rs                -> src/nautilus-server/src/apps/yeti-wells/mod.rs
#   allowed_endpoints.yaml-> src/nautilus-server/src/apps/yeti-wells/allowed_endpoints.yaml
```
Wire it (3 small edits in `src/nautilus-server/`):
- `src/lib.rs` → in `mod apps { … }` add:
  ```rust
  #[cfg(feature = "yeti-wells")]
  #[path = "yeti-wells/mod.rs"]
  pub mod yeti_wells;
  ```
  and in `pub mod app { … }` add:
  ```rust
  #[cfg(feature = "yeti-wells")]
  pub use crate::apps::yeti_wells::*;
  ```
- `Cargo.toml` → under `[features]` add: `yeti-wells = []`
- No `main.rs` change needed — just run with a dummy `API_KEY` (our app ignores it) and a real `SENSOR_URL`.

Set `allowed_endpoints.yaml` to the host of your flow-meter feed (`SENSOR_URL`), which must return `{ "liters": <u64> }`.

## 3. Build the EIF + capture PCRs
```bash
make ENCLAVE_APP=yeti-wells            # builds out/nitro.eif (reproducible StageX/Docker build)
cat out/nitro.pcrs                     # PCR0 (image), PCR1 (kernel), PCR2 (application)
```
Record PCR0/PCR1/PCR2. (`make run-debug` exists for logs but yields ZERO PCRs — never register those.)

## 4. Run + expose the enclave
```bash
export SENSOR_URL="https://<your-flow-meter>/reading"   # returns { "liters": 100000 }
export API_KEY=unused
sudo make run                                            # runs the enclave; server on vsock
# forward vsock -> TCP :3000 (parent) per the repo's expose_enclave.sh / socat, then verify:
curl http://localhost:3000/health_check                  # returns the enclave pubkey
curl http://localhost:3000/get_attestation               # returns { attestation: <hex> }
```

## 5. Register the genuine enclave on-chain
From **this repo** (`scripts/`), with the admin keypair env, the captured PCRs, and the enclave URL:
```bash
export PACKAGE_ID_V2=0xc59879ee5dbdc25d26619b3e50e68c907dce1fd5b621f508103f38cf70321605
export ENCLAVE_CAP_ID=0x137c8df268a60eb2a1414c673eae93af025ba3d1925d8629741561b4af196c11
export ADMIN_SECRET_KEY=<suiprivkey…>          # the deployer/admin (holds the Cap)
export PCR0=<…> PCR1=<…> PCR2=<…>              # from out/nitro.pcrs
export ENCLAVE_URL=http://<EC2_PUBLIC_IP>:3000
node register-enclave.ts                        # create_enclave_config(real PCRs) + register_enclave(live doc)
```
It prints `ENCLAVE_CONFIG_ID` + `ENCLAVE_ID`. This verifies the AWS attestation document on-chain (native
`sui::nitro_attestation`), asserts the PCRs match, and stores the enclave pubkey — genuine hardware attestation.

## 6. Point the app at the real enclave
In `server/.env` set:
```
ENCLAVE_ID=<the real ENCLAVE_ID from step 5>
ENCLAVE_URL=http://<EC2_PUBLIC_IP>:3000
```
Restart the backend. Now the steward **"Run attestation"** calls the genuine Nitro enclave (`/process_data`),
and `submit_attested_milestone_v2` verifies its signature against the hardware-attested PCRs before releasing
escrow + filling the globe.

## 7. ⚠️ TERMINATE the instance
```bash
# from your laptop:
aws ec2 terminate-instances --instance-ids <id>
```
Leaving an m5.xlarge running is ~$140/mo. Done now → ~$1–2. To demo again later, relaunch and rebuild (PCRs
reproduce identically, so the on-chain `EnclaveConfig` still matches — you only re-run `register_enclave`).

## Notes
- **BCS parity** is locked: `enclave/yeti_wells_app/mod.rs` `test_serde`, `move/.../attestation_tests::test_v2_intent_serde`,
  and `scripts/gen_attestation_vector.ts` all assert the same IntentMessage bytes. `cargo test --features yeti-wells`
  on the EC2 runs the Rust half.
- **Fallback:** if AWS is flaky on demo day, the local sim signer (`ENCLAVE_URL` empty) reproduces the exact same
  on-chain flow — record the backup demo with it.
