/// The soulbound Impact NFT. Each donor holds ONE per project (enforced in `donation`).
///
/// SOULBOUND: `ImpactNFT` has `key` ONLY (no `store`) and the module exposes NO transfer entry fn,
/// so it can never be `public_transfer`'d. Minting is `public(package)` — only `donation` can mint.
/// `sync_impact` is the O(1) pull-model update each donor calls to refresh their NFT from on-chain truth.
module yeti_wells::impact_nft;

use std::string;
use sui::display;
use sui::package;
use yeti_wells::project::{Self, WaterProject};
use yeti_wells::events;

/// One-time witness for the Publisher / Display claim.
public struct IMPACT_NFT has drop {}

/// SOULBOUND donor receipt. `key` only — never `store`.
public struct ImpactNFT has key {
    id: UID,
    owner: address,
    project_id: ID,
    donated_mist: u64,
    liters_attributed: u64,
    xp: u64,
    tier: u8,
    minted_at_ms: u64,
}

const E_PROJECT_MISMATCH: u64 = 0;

// XP tier thresholds (1 XP per attributed liter).
const TIER1_XP: u64 = 100;
const TIER2_XP: u64 = 1_000;
const TIER3_XP: u64 = 10_000;

/// Runs once at publish: claim Publisher, register a Display so wallets render the NFT.
fun init(otw: IMPACT_NFT, ctx: &mut TxContext) {
    let publisher = package::claim(otw, ctx);
    let mut disp = display::new_with_fields<ImpactNFT>(
        &publisher,
        vector[
            string::utf8(b"name"),
            string::utf8(b"description"),
            string::utf8(b"image_url"),
            string::utf8(b"project_id"),
            string::utf8(b"tier"),
            string::utf8(b"liters"),
        ],
        vector[
            string::utf8(b"Yeti Wells Impact"),
            string::utf8(b"A soulbound proof-of-impact NFT that fills with verified water."),
            // {field} substitution; {id} is the object id. SVG renderer wired in Phase 3.
            string::utf8(b"https://render.yetiwells.xyz/nft/{id}.svg"),
            string::utf8(b"{project_id}"),
            string::utf8(b"{tier}"),
            string::utf8(b"{liters_attributed}"),
        ],
        ctx,
    );
    display::update_version(&mut disp); // REQUIRED for the Display to take effect
    transfer::public_transfer(publisher, ctx.sender());
    transfer::public_transfer(disp, ctx.sender());
}

// --- package-internal mint / mutate (only `donation` may call) ---

public(package) fun mint(owner: address, project_id: ID, amount: u64, ctx: &mut TxContext): ImpactNFT {
    ImpactNFT {
        id: object::new(ctx),
        owner,
        project_id,
        donated_mist: amount,
        liters_attributed: 0,
        xp: 0,
        tier: 0,
        minted_at_ms: ctx.epoch_timestamp_ms(),
    }
}

/// Soulbound transfer: `transfer::transfer` requires only `key` and is callable ONLY from this module.
public(package) fun send_soulbound(nft: ImpactNFT, to: address) {
    transfer::transfer(nft, to);
}

public(package) fun add_donation(nft: &mut ImpactNFT, amount: u64) {
    nft.donated_mist = nft.donated_mist + amount;
}

// --- donor-callable lazy sync (O(1); NEVER loops over donors) ---

/// Refresh this NFT's attributed liters / XP / tier from the project's current on-chain truth.
public fun sync_impact(nft: &mut ImpactNFT, project: &WaterProject) {
    assert!(project::id(project) == nft.project_id, E_PROJECT_MISMATCH);
    let delivered = project::delivered_liters(project);
    let raised = project::raised_mist(project);
    // u128 intermediate: `delivered * donated` overflows u64 at mist scale (1 SUI = 1e9 mist).
    let computed = if (raised == 0) {
        0
    } else {
        (((delivered as u128) * (nft.donated_mist as u128)) / (raised as u128)) as u64
    };
    // MONOTONIC: never let a later donation (which grows `raised`) shrink an earlier donor's attributed
    // liters/XP/tier — the Impact NFT must never visibly un-fill. Favor the donor; never regress.
    let attributed = if (computed > nft.liters_attributed) { computed } else { nft.liters_attributed };
    nft.liters_attributed = attributed;
    nft.xp = attributed; // 1 XP per attributed liter (tunable)
    nft.tier = tier_for(attributed);
    events::emit_impact_grew(object::id(nft), nft.project_id, attributed, nft.xp, nft.tier);
}

/// Destroy a soulbound NFT. `public(package)` so ONLY `donation::refund` can call it (preserves the
/// soulbound invariant — no `store`, no transfer, the only exit is a refund on a cancelled project).
public(package) fun burn(nft: ImpactNFT) {
    let ImpactNFT { id, .. } = nft;
    object::delete(id);
}

fun tier_for(xp: u64): u8 {
    if (xp >= TIER3_XP) { 3 } else if (xp >= TIER2_XP) { 2 } else if (xp >= TIER1_XP) { 1 } else { 0 }
}

// --- reads ---

public fun owner(nft: &ImpactNFT): address { nft.owner }

public fun project_id(nft: &ImpactNFT): ID { nft.project_id }

public fun donated_mist(nft: &ImpactNFT): u64 { nft.donated_mist }

public fun liters_attributed(nft: &ImpactNFT): u64 { nft.liters_attributed }

public fun xp(nft: &ImpactNFT): u64 { nft.xp }

public fun tier(nft: &ImpactNFT): u8 { nft.tier }

// --- test-only helpers ---

#[test_only]
public fun mint_for_testing(owner: address, project_id: ID, amount: u64, ctx: &mut TxContext): ImpactNFT {
    mint(owner, project_id, amount, ctx)
}

#[test_only]
public fun tier_for_testing(xp: u64): u8 { tier_for(xp) }

#[test_only]
public fun burn_for_testing(nft: ImpactNFT) {
    let ImpactNFT { id, .. } = nft;
    object::delete(id);
}
