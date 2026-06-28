/// TEE attestation — the trustless milestone-release headline.
///
/// Phase 5: `submit_attested_milestone_v2` verifies a **Nautilus IntentMessage signature** from a registered
/// `enclave::Enclave<AppWitness>` (genuine AWS Nitro attestation via `enclave::register_enclave`, or a
/// dev-registered key via `enclave::register_enclave_dev` for local simulation / demo backup), then releases the
/// milestone's escrow and advances delivered liters. The Phase-1 `submit_attested_milestone` (raw ed25519 over a
/// bare BCS `MilestoneReport`) is kept for back-compat. BCS layout of `MilestoneReport` (and the IntentMessage
/// wrapper) must stay byte-identical to the Rust enclave + the local signer.
module yeti_wells::attestation;

use sui::bcs;
use yeti_wells::registry::{Self, AdminCap, Registry};
use yeti_wells::project::{Self, WaterProject};
use yeti_wells::events;
use yeti_wells::enclave;
use yeti_wells::enclave_app::AppWitness;

const E_BAD_SIGNATURE: u64 = 0;
const E_WRONG_PROJECT: u64 = 1;
const E_BELOW_THRESHOLD: u64 = 2;
const E_ALREADY_RELEASED: u64 = 3;
const E_INDEX_OOB: u64 = 5;
const E_WRONG_ENCLAVE: u64 = 6;
const E_DEPRECATED: u64 = 7;

/// Intent-scope byte for MilestoneReport signatures — MUST match the enclave/signer side.
const MILESTONE_INTENT: u8 = 1;

/// Phase-1 simulated enclave identity (raw pubkey). Superseded by `enclave::Enclave<AppWitness>` in v2.
public struct Enclave has key {
    id: UID,
    pcr0: vector<u8>,
    pcr1: vector<u8>,
    pcr2: vector<u8>,
    public_key: vector<u8>,
}

/// Move mirror of the Rust enclave report struct. BCS field ORDER + TYPES are load-bearing.
public struct MilestoneReport has copy, drop {
    project_id: address,
    milestone_index: u64,
    liters_reading: u64,
    timestamp_ms: u64,
}

// --- Phase 5: real Nautilus IntentMessage verification ---

/// Verify a Nautilus IntentMessage(MilestoneReport) signature from a registered enclave, then release escrow
/// and advance delivered liters. `enc` is a `enclave::Enclave<AppWitness>` registered via real attestation
/// (`register_enclave`) or, for local sim/backup, `register_enclave_dev`.
public fun submit_attested_milestone_v2(
    project: &mut WaterProject,
    registry: &mut Registry,
    enc: &enclave::Enclave<AppWitness>,
    timestamp_ms: u64,
    project_id: address,
    milestone_index: u64,
    liters_reading: u64,
    signature: vector<u8>,
    ctx: &mut TxContext,
) {
    let report = MilestoneReport { project_id, milestone_index, liters_reading, timestamp_ms };
    assert!(
        enclave::verify_signature<AppWitness, MilestoneReport>(
            enc,
            MILESTONE_INTENT,
            timestamp_ms,
            report,
            &signature,
        ),
        E_BAD_SIGNATURE,
    );
    release_milestone(project, registry, object::id(enc), project_id, milestone_index, liters_reading, timestamp_ms, ctx);
}

/// Cap-gated attestation (defense-in-depth, SEC-01): same enclave-signature verification as v2, but only
/// the platform (holding `AdminCap`) can submit — so even a leaked enclave signature alone cannot move
/// escrow. The backend uses this path. The enclave signature still proves the reading is TEE-attested.
public fun submit_attested_milestone_v3(
    _admin: &AdminCap,
    project: &mut WaterProject,
    registry: &mut Registry,
    enc: &enclave::Enclave<AppWitness>,
    timestamp_ms: u64,
    project_id: address,
    milestone_index: u64,
    liters_reading: u64,
    signature: vector<u8>,
    ctx: &mut TxContext,
) {
    let report = MilestoneReport { project_id, milestone_index, liters_reading, timestamp_ms };
    assert!(
        enclave::verify_signature<AppWitness, MilestoneReport>(
            enc,
            MILESTONE_INTENT,
            timestamp_ms,
            report,
            &signature,
        ),
        E_BAD_SIGNATURE,
    );
    release_milestone(project, registry, object::id(enc), project_id, milestone_index, liters_reading, timestamp_ms, ctx);
}

// --- Phase 1: simulated raw-ed25519 path — DEPRECATED (INFO-01). ---
// Kept only because a public function can't be removed in a compatible upgrade; the body now aborts so the
// pre-Phase-9 unbound / public-seed raw-ed25519 release path can never be used again.

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

public fun submit_attested_milestone(
    _project: &mut WaterProject,
    _registry: &mut Registry,
    _enclave: &Enclave,
    _payload: vector<u8>,
    _signature: vector<u8>,
    _ctx: &mut TxContext,
) {
    abort E_DEPRECATED
}

// --- shared release path ---

fun release_milestone(
    project: &mut WaterProject,
    registry: &mut Registry,
    enclave_obj_id: ID,
    project_id: address,
    milestone_index: u64,
    liters_reading: u64,
    timestamp_ms: u64,
    ctx: &mut TxContext,
) {
    assert!(project_id == object::id_address(project), E_WRONG_PROJECT);
    // SEC-01: the signing enclave MUST be the one bound to this project (at create_project_v2 / set_enclave).
    // An unbound project (enclave_id == none) can never release — safe by default.
    assert!(project::enclave_id(project) == option::some(enclave_obj_id), E_WRONG_ENCLAVE);
    assert!(milestone_index < project::milestone_count(project), E_INDEX_OOB);
    assert!(!project::milestone_released(project, milestone_index), E_ALREADY_RELEASED);
    assert!(liters_reading >= project::milestone_threshold(project, milestone_index), E_BELOW_THRESHOLD);

    // SEC-02 clamp: never abort an under-funded milestone; release whatever escrow holds (the remainder is
    // reclaimable by donors via `donation::refund` if the project is later cancelled).
    let nominal = project::milestone_release(project, milestone_index);
    let avail = project::escrow_value(project);
    let release_mist = if (nominal <= avail) { nominal } else { avail };
    let coin = project::take_release(project, release_mist, ctx);
    transfer::public_transfer(coin, project::payout(project));

    project::mark_milestone_released(project, milestone_index, timestamp_ms);
    let delta = project::set_delivered(project, liters_reading);
    registry::add_delivered(registry, delta);

    events::emit_milestone_attested(
        object::id(project),
        milestone_index,
        liters_reading,
        release_mist,
        project::payout(project),
        timestamp_ms,
    );
    events::emit_milestone_attested_v2(
        object::id(project),
        milestone_index,
        liters_reading,
        release_mist,
        project::payout(project),
        timestamp_ms,
        enclave_obj_id,
    );
}

// --- test-only helpers ---

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

/// IntentMessage(MilestoneReport) BCS bytes — Move half of the Rust/TS↔Move serde parity check.
#[test_only]
public fun encode_intent_for_testing(
    project_id: address,
    milestone_index: u64,
    liters_reading: u64,
    timestamp_ms: u64,
): vector<u8> {
    let report = MilestoneReport { project_id, milestone_index, liters_reading, timestamp_ms };
    let msg = enclave::create_intent_message(MILESTONE_INTENT, timestamp_ms, report);
    bcs::to_bytes(&msg)
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
