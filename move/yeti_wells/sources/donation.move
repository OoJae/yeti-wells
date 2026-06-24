/// Donations: the two value-flow entry points (the targets whitelisted for Enoki sponsorship).
/// Escrow + accounting are delegated to `project`; minting to `impact_nft`. One Impact NFT per
/// donor per project is HARD-enforced via the project's `donors` table.
module yeti_wells::donation;

use sui::coin::{Self, Coin};
use sui::sui::SUI;
use yeti_wells::registry::{Self, Registry};
use yeti_wells::project::{Self, WaterProject};
use yeti_wells::impact_nft::{Self, ImpactNFT};
use yeti_wells::events;

const E_ZERO_DONATION: u64 = 0;
const E_ALREADY_DONATED: u64 = 1;
const E_NFT_OWNER_MISMATCH: u64 = 2;
const E_NFT_PROJECT_MISMATCH: u64 = 3;

/// First donation by a donor who does NOT yet hold an ImpactNFT for this project.
/// Mints exactly one soulbound ImpactNFT and records the donor in the project's index.
public fun donate(
    project: &mut WaterProject,
    registry: &mut Registry,
    payment: Coin<SUI>,
    ctx: &mut TxContext,
) {
    let amount = coin::value(&payment);
    assert!(amount > 0, E_ZERO_DONATION);
    let donor = ctx.sender();
    assert!(!project::has_donor(project, donor), E_ALREADY_DONATED);

    project::deposit(project, coin::into_balance(payment));
    registry::add_raised(registry, amount);

    let nft = impact_nft::mint(donor, project::id(project), amount, ctx);
    let nft_id = object::id(&nft);
    project::register_donor(project, donor, nft_id);
    impact_nft::send_soulbound(nft, donor);

    events::emit_donation(donor, project::id(project), amount, project::raised_mist(project), nft_id, true);
}

/// Repeat donation: the donor passes their existing ImpactNFT (owned object) to be updated.
public fun donate_again(
    project: &mut WaterProject,
    registry: &mut Registry,
    nft: &mut ImpactNFT,
    payment: Coin<SUI>,
    ctx: &mut TxContext,
) {
    let amount = coin::value(&payment);
    assert!(amount > 0, E_ZERO_DONATION);
    let donor = ctx.sender();
    assert!(impact_nft::owner(nft) == donor, E_NFT_OWNER_MISMATCH);
    assert!(impact_nft::project_id(nft) == project::id(project), E_NFT_PROJECT_MISMATCH);

    project::deposit(project, coin::into_balance(payment));
    registry::add_raised(registry, amount);
    impact_nft::add_donation(nft, amount);

    events::emit_donation(
        donor,
        project::id(project),
        amount,
        project::raised_mist(project),
        object::id(nft),
        false,
    );
}
