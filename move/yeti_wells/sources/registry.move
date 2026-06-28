/// Global protocol registry + admin capability.
/// `Registry` is a shared object holding global stats (the frontend's live counters).
/// `AdminCap` is the steward capability minted to the deployer at publish.
module yeti_wells::registry;

/// Steward / admin capability. `key + store` so it can be held and transferred to the deployer.
public struct AdminCap has key, store {
    id: UID,
}

const E_UNDERFLOW: u64 = 0;

/// Shared global registry of protocol-wide stats.
public struct Registry has key {
    id: UID,
    total_delivered_liters: u64,
    total_raised_mist: u64,
    project_count: u64,
}

/// Runs once at publish: share the Registry, grant the AdminCap to the deployer.
fun init(ctx: &mut TxContext) {
    transfer::share_object(Registry {
        id: object::new(ctx),
        total_delivered_liters: 0,
        total_raised_mist: 0,
        project_count: 0,
    });
    transfer::transfer(AdminCap { id: object::new(ctx) }, ctx.sender());
}

// --- package-internal accounting mutators (called by project / donation / attestation) ---

public(package) fun bump_project_count(reg: &mut Registry): u64 {
    reg.project_count = reg.project_count + 1;
    reg.project_count
}

public(package) fun add_raised(reg: &mut Registry, amount: u64) {
    reg.total_raised_mist = reg.total_raised_mist + amount;
}

/// Reverse `add_raised` (used by donation::refund when a cancelled project returns escrow).
public(package) fun sub_raised(reg: &mut Registry, amount: u64) {
    assert!(reg.total_raised_mist >= amount, E_UNDERFLOW);
    reg.total_raised_mist = reg.total_raised_mist - amount;
}

public(package) fun add_delivered(reg: &mut Registry, delta: u64) {
    reg.total_delivered_liters = reg.total_delivered_liters + delta;
}

// --- public reads (frontend global counters) ---

public fun total_delivered_liters(reg: &Registry): u64 { reg.total_delivered_liters }

public fun total_raised_mist(reg: &Registry): u64 { reg.total_raised_mist }

public fun project_count(reg: &Registry): u64 { reg.project_count }

// --- test-only helpers ---

#[test_only]
public fun init_for_testing(ctx: &mut TxContext) { init(ctx) }

#[test_only]
public fun new_for_testing(ctx: &mut TxContext): Registry {
    Registry { id: object::new(ctx), total_delivered_liters: 0, total_raised_mist: 0, project_count: 0 }
}

#[test_only]
public fun new_admin_for_testing(ctx: &mut TxContext): AdminCap {
    AdminCap { id: object::new(ctx) }
}

#[test_only]
public fun destroy_registry_for_testing(reg: Registry) {
    let Registry { id, .. } = reg;
    object::delete(id);
}

#[test_only]
public fun destroy_admin_for_testing(cap: AdminCap) {
    let AdminCap { id } = cap;
    object::delete(id);
}
