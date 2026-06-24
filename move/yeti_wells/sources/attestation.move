/// TEE attestation: the trustless milestone-release headline.
///
/// PHASE 1 STATUS: the signature-verification + BCS-decode + escrow-release path is REAL. Enclave
/// registration is a simulation (`register_enclave_dev` takes a raw ed25519 pubkey). Phase 5 swaps in
/// `register_enclave` backed by the native `sui::nitro_attestation` module (verifies the AWS Nitro
/// attestation document and pins PCRs) — see CLAUDE.md. The `MilestoneReport` BCS layout below must
/// stay byte-identical to the Rust enclave struct (peel order = serialize order).
module yeti_wells::attestation;

use sui::bcs;
use sui::ed25519;
use yeti_wells::registry::{Self, AdminCap, Registry};
use yeti_wells::project::{Self, WaterProject};
use yeti_wells::events;

const E_BAD_SIGNATURE: u64 = 0;
const E_WRONG_PROJECT: u64 = 1;
const E_BELOW_THRESHOLD: u64 = 2;
const E_ALREADY_RELEASED: u64 = 3;
const E_TRAILING_BYTES: u64 = 4;
const E_INDEX_OOB: u64 = 5;

/// Registered enclave identity. Shared so any `submit_attested_milestone` PTB can reference it.
public struct Enclave has key {
    id: UID,
    pcr0: vector<u8>,
    pcr1: vector<u8>,
    pcr2: vector<u8>,
    public_key: vector<u8>, // ed25519 signing pubkey (32 bytes)
}

/// Move mirror of the Rust enclave struct. BCS field ORDER + TYPES are load-bearing.
public struct MilestoneReport has copy, drop {
    project_id: address,
    milestone_index: u64,
    liters_reading: u64,
    timestamp_ms: u64,
}

/// PHASE 1 simulation: admin registers an enclave directly from a known ed25519 pubkey.
public fun register_enclave_dev(
    _admin: &AdminCap,
    pcr0: vector<u8>,
    pcr1: vector<u8>,
    pcr2: vector<u8>,
    public_key: vector<u8>,
    ctx: &mut TxContext,
) {
    transfer::share_object(Enclave { id: object::new(ctx), pcr0, pcr1, pcr2, public_key });
}

/// Verify a signed reading, release the milestone's escrow to the payout, advance delivered liters.
public fun submit_attested_milestone(
    project: &mut WaterProject,
    registry: &mut Registry,
    enclave: &Enclave,
    payload: vector<u8>,
    signature: vector<u8>,
    ctx: &mut TxContext,
) {
    // a. Verify signature. ARG ORDER: (signature, public_key, msg).
    assert!(ed25519::ed25519_verify(&signature, &enclave.public_key, &payload), E_BAD_SIGNATURE);

    // b. BCS-decode in the exact serialization order; reject any trailing bytes.
    let mut reader = bcs::new(payload);
    let project_id = reader.peel_address();
    let milestone_index = reader.peel_u64();
    let liters_reading = reader.peel_u64();
    let timestamp_ms = reader.peel_u64();
    assert!(reader.into_remainder_bytes().is_empty(), E_TRAILING_BYTES);

    // c. The report must be for THIS project.
    assert!(project_id == object::id_address(project), E_WRONG_PROJECT);

    // d. Milestone must exist, be unreleased, and the reading must meet the threshold.
    assert!(milestone_index < project::milestone_count(project), E_INDEX_OOB);
    assert!(!project::milestone_released(project, milestone_index), E_ALREADY_RELEASED);
    assert!(liters_reading >= project::milestone_threshold(project, milestone_index), E_BELOW_THRESHOLD);

    // e. Release the milestone's escrow to the implementation partner.
    let release_mist = project::milestone_release(project, milestone_index);
    let coin = project::take_release(project, release_mist, ctx);
    transfer::public_transfer(coin, project::payout(project));

    // f. Mark released, advance delivered liters, update the global counter.
    project::mark_milestone_released(project, milestone_index, timestamp_ms);
    let delta = project::set_delivered(project, liters_reading);
    registry::add_delivered(registry, delta);

    // g. Emit.
    events::emit_milestone_attested(
        object::id(project),
        milestone_index,
        liters_reading,
        release_mist,
        project::payout(project),
        timestamp_ms,
    );
}

// --- test-only helpers ---

/// Build the BCS payload the enclave would sign (Move half of the Rust<->Move serde parity check).
#[test_only]
public fun encode_report_for_testing(
    project_id: address,
    milestone_index: u64,
    liters_reading: u64,
    timestamp_ms: u64,
): vector<u8> {
    let report = MilestoneReport { project_id, milestone_index, liters_reading, timestamp_ms };
    bcs::to_bytes(&report)
}

#[test_only]
public fun register_enclave_for_testing(public_key: vector<u8>, ctx: &mut TxContext) {
    transfer::share_object(Enclave {
        id: object::new(ctx),
        pcr0: vector[],
        pcr1: vector[],
        pcr2: vector[],
        public_key,
    });
}
