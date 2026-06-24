/// Centralized event payloads for the Yeti Wells protocol.
/// Sibling modules emit via the `public(package)` helpers so `sui::event` stays in one place
/// and event field shapes live in a single source of truth.
module yeti_wells::events;

use sui::event;

public struct ProjectCreated has copy, drop {
    project_id: ID,
    steward: address,
    funding_goal_mist: u64,
    target_liters: u64,
}

public struct DonationEvent has copy, drop {
    donor: address,
    project_id: ID,
    amount_mist: u64,
    new_raised_mist: u64,
    nft_id: ID,
    first_time: bool,
}

public struct ImpactGrew has copy, drop {
    nft_id: ID,
    project_id: ID,
    liters_attributed: u64,
    xp: u64,
    tier: u8,
}

public struct MilestoneAttested has copy, drop {
    project_id: ID,
    milestone_index: u64,
    liters_reading: u64,
    released_mist: u64,
    payout: address,
    timestamp_ms: u64,
}

public(package) fun emit_project_created(
    project_id: ID,
    steward: address,
    funding_goal_mist: u64,
    target_liters: u64,
) {
    event::emit(ProjectCreated { project_id, steward, funding_goal_mist, target_liters });
}

public(package) fun emit_donation(
    donor: address,
    project_id: ID,
    amount_mist: u64,
    new_raised_mist: u64,
    nft_id: ID,
    first_time: bool,
) {
    event::emit(DonationEvent { donor, project_id, amount_mist, new_raised_mist, nft_id, first_time });
}

public(package) fun emit_impact_grew(
    nft_id: ID,
    project_id: ID,
    liters_attributed: u64,
    xp: u64,
    tier: u8,
) {
    event::emit(ImpactGrew { nft_id, project_id, liters_attributed, xp, tier });
}

public(package) fun emit_milestone_attested(
    project_id: ID,
    milestone_index: u64,
    liters_reading: u64,
    released_mist: u64,
    payout: address,
    timestamp_ms: u64,
) {
    event::emit(MilestoneAttested {
        project_id,
        milestone_index,
        liters_reading,
        released_mist,
        payout,
        timestamp_ms,
    });
}
