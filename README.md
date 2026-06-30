# 🧊 Yeti Wells

**Verifiable proof-of-impact giving on Sui.** Donate to a clean-water campaign in one tap, and watch a
soulbound **Impact NFT** fill with water as *cryptographically proven* liters are delivered — escrow
releases milestone-by-milestone **only** when a registered **TEE** signs that a real-world threshold was
crossed. No "trust us." **Verify it yourself, on-chain.**

> **▶️ Live demo:** https://dist-three-pi-58.vercel.app — sign in with Google, no seed phrase, zero gas.
> **Code:** https://github.com/OoJae/yeti-wells · Built for the **CLAY Hackathon** on the full Sui stack.

---

## Why it's different

Most "impact" platforms ask you to trust a dashboard. Yeti Wells makes impact **provable**:

- 💧 **Escrow released on proof, not promises.** Donations sit in on-chain escrow inside each campaign and
  release per milestone **only** after the chain verifies an Ed25519 signature from the campaign's bound
  enclave over a milestone reading. Change the enclave code → its PCRs change → verification breaks.
- 🔐 **Sign in with Google (zkLogin), pay zero gas.** Enoki handles zkLogin + sponsors every transaction —
  donors never see a seed phrase, a wallet install, or a gas fee.
- 🧊 **A soulbound Impact NFT that fills with water.** One per donor per campaign, `key`-only (can never be
  transferred). It visibly fills as TEE-verified liters arrive — and never un-fills (monotonic attribution).
- 🌍 **An open campaign marketplace.** Anyone signed-in can launch a campaign; donors browse, search, and give
  to any of them; evidence photos live immutably on **Walrus**; leaderboards come straight from on-chain events.
- ↩️ **Donor protection.** If a campaign is cancelled, donors reclaim their share of remaining escrow.

## Try it (60-second tour)

1. **Browse** campaigns at the [live demo](https://dist-three-pi-58.vercel.app) → open the showcase campaign.
2. **Sign in with Google** (zkLogin) and **Donate** — gasless. A soulbound Impact NFT mints to you.
3. Watch the **globe fill** as verified delivery advances, and open the **"Verified by TEE / Released (demo
   signer)"** badge to inspect the attestation on Suiscan.
4. **Start a campaign** (`/create`) → it appears in Browse for everyone, with funds routed to *your* address.
5. **My Impact** (`/me`) shows your globes across every campaign you've funded.

## Architecture

```
  Frontend — React 19 / Vite / Tailwind / dApp Kit / Enoki (app/)
     │   Google zkLogin · one-tap gasless donate · animated Impact NFT · browse/create/dashboard
     ▼
  ┌── Enoki (zkLogin + gas sponsorship) ─┐     ┌── Walrus (evidence + cover blobs) ──┐
  │  Backend (server/): /sponsor /execute │     └─────────────────┬───────────────────┘
  │  /fund /create-campaign /steward/*    │                       │ blob ids stored on-chain
  └───────────────┬───────────────────────┘                       │
                  │ relays an enclave-signed MilestoneReport       │
                  ▼                                                │
   TEE enclave (Rust / Nautilus on AWS-Nitro, or Marlin Oyster) ──┘
        signs IntentMessage(MilestoneReport)  [BCS + Ed25519]
                  │ reading + signature
                  ▼
  ┌────────────────────────────────────────────────────────────────────────────┐
  │  Sui Move package `yeti_wells`                                               │
  │  registry · project (inline escrow, milestones) · donation (donate/refund)  │
  │  impact_nft (soulbound) · enclave (PCR-gated keys) · attestation             │
  │  attestation::release_milestone — asserts signer == project.enclave_id,      │
  │  verifies the Ed25519 sig, releases escrow → advances delivered_liters       │
  └────────────────────────────────────────────────────────────────────────────┘
```

## Trust model

The chain advances `delivered_liters` and releases escrow **only** after verifying an Ed25519 signature
from the **enclave the campaign is bound to** — `release_milestone` asserts the signing enclave ==
`project.enclave_id`, over a **BCS-encoded, intent-prefixed `MilestoneReport`**. For a **genuine** enclave
registered via `register_enclave`, the key is bound to on-chain **PCR code-measurements**: any change to the
enclave code changes its PCRs and breaks verification, so the release is trustless, not self-reported.
A campaign can't be released by any *other* enclave, the legacy raw-ed25519 path is disabled, and submission
is additionally cap-gated (`submit_attested_milestone_v3`).

> ### ⚠️ Deployment mode (judging window)
> The genuine **AWS-Nitro TEE path was executed and is permanently provable on-chain** (a real
> hardware-attested enclave released a milestone; PCRs match the reproducible build) — tx
> [`9xnbMKBR…UxiSBV`](https://suiscan.xyz/testnet/tx/9xnbMKBR34RW58hkcFsT75JWYCUjnVTnYdY1fWUxiSBV). For the
> month-plus **judging window**, the live backend runs a **demo signer** (a software key kept only in the
> host's env, registered as a dev enclave) instead of renting hardware 24/7 — so milestones a judge triggers
> are **on-chain-verified Ed25519 but not PCR-attested**. The UI is honest about it: a release shows
> **"Verified by TEE (AWS Nitro)"** only when the genuine enclave signed, otherwise **"Released (demo
> signer)"**. Genuine hardware on demand: `scripts/oyster-golive.sh` (deploys + re-binds a live enclave).

## Tech stack

| Layer | Tech |
|---|---|
| Contracts | **Sui Move 2024** — inline `Balance<SUI>` escrow, soulbound NFTs, Nautilus `IntentMessage` verify |
| Identity / gas | **Enoki** zkLogin (Google) + sponsored transactions (donors pay no gas) |
| TEE | **Nautilus** (Rust) on **AWS Nitro**, deployable via **Marlin Oyster** — reproducible EIF, on-chain PCRs |
| Storage | **Walrus** (evidence photos + campaign cover images) |
| Frontend | **React 19 · Vite · Tailwind v4 · @mysten/dapp-kit · react-router** |
| Backend | **Node/TS · Express** (Enoki relay, admin-signed steward ops, rate-limited) |

## Monorepo

```
move/yeti_wells/   Move package — registry · project · donation · impact_nft · enclave · attestation · events (+ tests)
app/               React frontend — pages/ (browse, create, detail, dashboard), components/, lib/ (hooks)
server/            Node/TS backend — Enoki sponsor + starter grant + open create-campaign + steward ops
enclave/           Nautilus Rust app (TEE) + Oyster deploy config
scripts/           publish/seed/register-enclave/oyster-golive helpers + attestation test vectors
```

## Run locally

```bash
# 1) Toolchain (suiup): https://github.com/MystenLabs/suiup
suiup install sui@testnet

# 2) Move package — build + the full test suite (37 tests)
cd move/yeti_wells && sui move build && sui move test

# 3) Backend — copy the env template, fill in secrets, run
cd server && cp .env.example .env   # add ENOKI_SECRET_KEY, FUNDER_SECRET_KEY, SIM_SEED_HEX, ids
pnpm install && node --env-file=.env index.ts

# 4) Frontend — copy the env template, run the dev server
cd app && cp .env.local.example .env.local   # add the public VITE_* values
pnpm install && pnpm dev
```

`.env` / `.env.local` are git-ignored — only the `.example` templates are committed. Never commit keys.

## Deployed (testnet)

| Key | Value |
|---|---|
| Package (types/events — original) | `0xa2090b3f15a42375b239a835d83bc86a3c1e4b4c76142529491236bc8d93d66a` |
| Package (call targets — V3 upgrade) | `0xfa0cb1343829fd0748d18bf18f2c987d2124e895743b4629bd7ad90aba450fe1` |
| Registry (shared) | `0x12e8905da2765dafc7362888e9309d8a8e94a9c745afafbc288887c6967157d9` |
| Showcase campaign | `0x086d5d8b69fb0ea0440963899104fd8f32acdba96cdef956a84b4076521cb245` |
| Frontend (Vercel) | https://dist-three-pi-58.vercel.app |
| Backend (Railway) | https://yeti-wells-backend-production.up.railway.app |

> A compatible Sui upgrade keeps the **original** package id for struct/event *type tags* but mints a **new**
> id for calling changed/new functions — hence the two package ids above.

## Security & testing

- **37 Move unit tests** (happy + negative paths) — run `sui move test`. CI (`.github/workflows/ci.yml`)
  runs the Move tests + the frontend build on every push.
- The codebase went through an **adversarial security study** (multi-agent find → independent verify) that
  surfaced 29 issues; **all were remediated**. Highlights:
  enclave-bound milestone release (no forged attestations), donor refunds, validated campaign creation,
  monotonic Impact NFTs, rate-limiting + a funder spend cap, env-only secrets (`.dockerignore`), and an
  honest genuine-vs-demo TEE badge.
- Donations are paid from the donor's own coins; only `donate` / `donate_again` / `sync_impact` / `refund`
  are sponsorship-whitelisted; campaign creation + attestation are admin-co-signed.

