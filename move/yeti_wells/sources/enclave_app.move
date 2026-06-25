/// The Yeti Wells enclave application identity. `ENCLAVE_APP` is the type parameter `T` for the generic
/// Nautilus `enclave::{Enclave, EnclaveConfig, Cap}`. `bootstrap` (admin) mints the enclave `Cap` once after
/// the package upgrade; the steward then creates an `EnclaveConfig` + registers the enclave (dev or real).
module yeti_wells::enclave_app;

use yeti_wells::enclave::{Self, Cap};
use yeti_wells::registry::AdminCap;

/// Witness type identifying this app's enclave (the `T` in `Enclave<T>`).
/// Named `AppWitness` (not the uppercased module name) so it's a plain witness we can mint via `bootstrap`,
/// not a one-time witness that only `init` could create.
public struct AppWitness has drop {}

/// One-time bootstrap: mint the enclave capability and send it to the admin/steward.
public fun bootstrap(_: &AdminCap, ctx: &mut TxContext) {
    transfer::public_transfer(enclave::new_cap(AppWitness {}, ctx), ctx.sender());
}

#[test_only]
public fun new_cap_for_testing(ctx: &mut TxContext): Cap<AppWitness> {
    enclave::new_cap(AppWitness {}, ctx)
}
