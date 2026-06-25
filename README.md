# 🧊 Yeti Wells

**Verifiable proof-of-impact giving on Sui.** Every donation funds a real water project, every liter
delivered is *cryptographically proven* (not self-reported), and every donor holds a living, soulbound
**Impact NFT** that fills with water as proof arrives.

> Replace "trust us" with "verify it yourself." Donations sit in on-chain **escrow** and release
> milestone-by-milestone only when a **Nautilus TEE** signs an attestation that a real-world threshold
> (liters from a flow meter) was crossed. Evidence is stored immutably on **Walrus**. Donors sign in with
> **Google (zkLogin)** — no seed phrase — and pay **zero gas** (sponsored transactions).

Built for the **CLAY Hackathon** (Code Like A Yeti) on the full Sui Stack.

## Architecture

```
  Frontend (React/Vite/Tailwind/dApp Kit)
        │  Google sign-in (zkLogin) · one-tap gasless donate · animated Impact NFT
        ▼
  ┌── Enoki (zkLogin + gas sponsorship) ──┐   ┌── Walrus (evidence blobs) ──┐
  │   App backend (/sponsor, /execute)    │   └──────────────┬──────────────┘
  └───────────────┬───────────────────────┘                  │ blob ids on-chain
                  │ calls enclave                             │
                  ▼                                           │
        Nautilus enclave (Rust, TEE) ── signs MilestoneReport (BCS + Ed25519)
                  │ payload + signature
                  ▼
  ┌──────────────────────────────────────────────────────────────────────┐
  │  Sui Move package `yeti_wells`                                         │
  │  registry · project (inline escrow) · donation · impact_nft (soulbound)│
  │  · attestation — verifies enclave sig vs registered PCRs → releases     │
  │    escrow → advances delivered_liters                                   │
  └──────────────────────────────────────────────────────────────────────┘
```

> _Architecture diagram (polished) — TODO Phase 7._

## Trust model

The chain advances `delivered_liters` and releases escrow **only** after verifying an Ed25519 signature
from a **registered enclave** (whose PCR code-measurements are stored on-chain) over a **BCS-encoded
`MilestoneReport`**. Any change to the enclave code changes its PCRs and breaks verification — so the
release is trustless, not self-reported.

## Monorepo
- `move/yeti_wells/` — Move package (registry, project, donation, impact_nft, attestation, events)
- `app/` — React + Vite + Tailwind frontend (dApp Kit; Enoki + Walrus in later phases)
- `server/` — Node/TS backend (Enoki sponsor, mock sensor feed)
- `enclave/` — Nautilus Rust app (Phase 5)
- `scripts/` — deploy, seed, helpers

## Run (testnet)
```bash
# Toolchain (suiup): https://github.com/MystenLabs/suiup
suiup install sui@testnet

# Move package
cd move/yeti_wells && sui move build && sui move test
sui client publish        # record the Package ID below

# Frontend
cd app && pnpm install && pnpm dev
```

## Deployed (testnet)
| Key | Value |
|---|---|
| Package ID | `0xa2090b3f15a42375b239a835d83bc86a3c1e4b4c76142529491236bc8d93d66a` |
| Registry (shared) | `0x12e8905da2765dafc7362888e9309d8a8e94a9c745afafbc288887c6967157d9` |
| Demo WaterProject | `0x75c3992a51fd620a66b4efe4bd81a4b2967c7f62bfb8a0a6a58c103ce006dcfb` |

Full ID list + build log in [`PROGRESS.md`](PROGRESS.md).

## Status
Phase 0 (foundations) ✅ · Phase 1 (core Move protocol) ✅ — 25 Move tests green (90% coverage),
full donate → TEE-attested release → NFT-fills loop verified on-chain. Phase 2 (frontend + gasless
zkLogin donate) is next. See [`PROGRESS.md`](PROGRESS.md).
