/// Water projects: the funded campaigns. Each `WaterProject` is a shared object that holds its
/// OWN escrow (`Balance<SUI>`) and its OWN donor index (`Table<address, ID>`) — see CLAUDE.md
/// locked decisions (inline escrow, hard one-NFT-per-donor). `delivered_liters` is advanced ONLY
/// by a verified attestation (see `attestation` module); donors/donations only grow `raised_mist`.
module yeti_wells::project;

use std::string::String;
use sui::balance::{Self, Balance};
use sui::coin::{Self, Coin};
use sui::sui::SUI;
use sui::table::{Self, Table};
use yeti_wells::registry::{Self, AdminCap, Registry};
use yeti_wells::events;

const E_BAD_MILESTONES: u64 = 0;

/// Status codes.
const STATUS_FUNDRAISING: u8 = 0;

public struct WaterProject has key {
    id: UID,
    name: String,
    location: String,
    description: String,
    image_blob_id: String,            // Walrus blob id (placeholder until Phase 4)
    funding_goal_mist: u64,
    target_liters: u64,
    raised_mist: u64,                 // grows on every donation
    delivered_liters: u64,            // advanced ONLY by verified attestation
    status: u8,
    steward: address,
    payout: address,                  // implementation-partner address for released funds
    enclave_id: Option<ID>,           // set in Phase 5 once an enclave is registered
    milestones: vector<Milestone>,
    evidence: vector<EvidenceRef>,
    escrow: Balance<SUI>,             // DECISION: inline escrow
    donors: Table<address, ID>,       // DECISION: hard one-NFT-per-donor index (donor -> ImpactNFT id)
}

public struct Milestone has store {
    index: u64,
    description: String,
    liters_threshold: u64,            // delivered_liters must reach this
    release_mist: u64,                // escrow released to payout on attestation
    released: bool,
    evidence_blob_id: Option<String>,
    attested_at_ms: Option<u64>,
}

public struct EvidenceRef has store {
    blob_id: String,
    media_type: String,
    caption: String,
    milestone_index: u64,
    timestamp_ms: u64,
}

// --- ADMIN entry functions ---

/// Create a water project. Milestones are supplied as three parallel vectors (PTB / seed-friendly).
public fun create_project(
    _admin: &AdminCap,
    registry: &mut Registry,
    name: String,
    location: String,
    description: String,
    image_blob_id: String,
    funding_goal_mist: u64,
    target_liters: u64,
    payout: address,
    mut milestone_descriptions: vector<String>,
    mut milestone_thresholds: vector<u64>,
    mut milestone_releases: vector<u64>,
    ctx: &mut TxContext,
) {
    let n = milestone_descriptions.length();
    assert!(n == milestone_thresholds.length() && n == milestone_releases.length(), E_BAD_MILESTONES);

    // Reverse so popping from the back yields logical index 0,1,2,... in order.
    milestone_descriptions.reverse();
    milestone_thresholds.reverse();
    milestone_releases.reverse();
    let mut milestones = vector[];
    let mut i = 0;
    while (i < n) {
        milestones.push_back(Milestone {
            index: i,
            description: milestone_descriptions.pop_back(),
            liters_threshold: milestone_thresholds.pop_back(),
            release_mist: milestone_releases.pop_back(),
            released: false,
            evidence_blob_id: option::none(),
            attested_at_ms: option::none(),
        });
        i = i + 1;
    };
    milestone_descriptions.destroy_empty();
    milestone_thresholds.destroy_empty();
    milestone_releases.destroy_empty();

    let steward = ctx.sender();
    let project = WaterProject {
        id: object::new(ctx),
        name,
        location,
        description,
        image_blob_id,
        funding_goal_mist,
        target_liters,
        raised_mist: 0,
        delivered_liters: 0,
        status: STATUS_FUNDRAISING,
        steward,
        payout,
        enclave_id: option::none(),
        milestones,
        evidence: vector[],
        escrow: balance::zero<SUI>(),
        donors: table::new<address, ID>(ctx),
    };
    let pid = object::id(&project);
    registry::bump_project_count(registry);
    events::emit_project_created(pid, steward, funding_goal_mist, target_liters);
    transfer::share_object(project);
}

/// Attach an evidence reference (Walrus blob id) to a project.
public fun add_evidence(
    _admin: &AdminCap,
    project: &mut WaterProject,
    blob_id: String,
    media_type: String,
    caption: String,
    milestone_index: u64,
    timestamp_ms: u64,
) {
    project.evidence.push_back(EvidenceRef { blob_id, media_type, caption, milestone_index, timestamp_ms });
}

/// Bind a registered enclave to this project (Phase 5).
public fun set_enclave(_admin: &AdminCap, project: &mut WaterProject, enclave_id: ID) {
    project.enclave_id = option::some(enclave_id);
}

// --- package-internal mutators (donation / attestation) ---

/// Escrow a balance and grow `raised_mist`.
public(package) fun deposit(project: &mut WaterProject, b: Balance<SUI>) {
    let amt = balance::value(&b);
    project.escrow.join(b);
    project.raised_mist = project.raised_mist + amt;
}

/// Take a coin of `amount` out of escrow (milestone release).
public(package) fun take_release(project: &mut WaterProject, amount: u64, ctx: &mut TxContext): Coin<SUI> {
    coin::take(&mut project.escrow, amount, ctx)
}

/// Record that a donor now holds an ImpactNFT for this project.
public(package) fun register_donor(project: &mut WaterProject, donor: address, nft_id: ID) {
    project.donors.add(donor, nft_id);
}

public(package) fun mark_milestone_released(project: &mut WaterProject, idx: u64, ts_ms: u64) {
    let m = &mut project.milestones[idx];
    m.released = true;
    m.attested_at_ms = option::some(ts_ms);
}

/// Advance delivered liters to `liters` if higher; returns the delta added (for registry accounting).
public(package) fun set_delivered(project: &mut WaterProject, liters: u64): u64 {
    if (liters > project.delivered_liters) {
        let delta = liters - project.delivered_liters;
        project.delivered_liters = liters;
        delta
    } else {
        0
    }
}

public(package) fun milestone_threshold(project: &WaterProject, idx: u64): u64 {
    project.milestones[idx].liters_threshold
}

public(package) fun milestone_release(project: &WaterProject, idx: u64): u64 {
    project.milestones[idx].release_mist
}

public(package) fun milestone_released(project: &WaterProject, idx: u64): bool {
    project.milestones[idx].released
}

// --- public reads ---

public fun id(p: &WaterProject): ID { object::id(p) }

public fun has_donor(p: &WaterProject, donor: address): bool { p.donors.contains(donor) }

public fun raised_mist(p: &WaterProject): u64 { p.raised_mist }

public fun delivered_liters(p: &WaterProject): u64 { p.delivered_liters }

public fun target_liters(p: &WaterProject): u64 { p.target_liters }

public fun funding_goal_mist(p: &WaterProject): u64 { p.funding_goal_mist }

public fun escrow_value(p: &WaterProject): u64 { balance::value(&p.escrow) }

public fun milestone_count(p: &WaterProject): u64 { p.milestones.length() }

public fun payout(p: &WaterProject): address { p.payout }

public fun steward(p: &WaterProject): address { p.steward }

public fun status(p: &WaterProject): u8 { p.status }

public fun enclave_id(p: &WaterProject): Option<ID> { p.enclave_id }

// --- test-only helpers ---

#[test_only]
public fun create_for_testing(
    registry: &mut Registry,
    funding_goal_mist: u64,
    target_liters: u64,
    payout: address,
    ctx: &mut TxContext,
) {
    let cap = registry::new_admin_for_testing(ctx);
    create_project(
        &cap, registry,
        std::string::utf8(b"Test Project"),
        std::string::utf8(b"Testland"),
        std::string::utf8(b"A test water project"),
        std::string::utf8(b"blob"),
        funding_goal_mist, target_liters, payout,
        vector[std::string::utf8(b"M0"), std::string::utf8(b"M1")],
        vector[0, target_liters],
        vector[funding_goal_mist / 2, funding_goal_mist / 2],
        ctx,
    );
    registry::destroy_admin_for_testing(cap);
}
