// Adapted from MystenLabs/nautilus `move/enclave/sources/enclave.move`.
// Copyright (c), Mysten Labs, Inc. — SPDX-License-Identifier: Apache-2.0
//
// Vendored into the yeti_wells package (single-package compatible upgrade) and extended with a
// `register_enclave_dev` path for local simulation / demo backup. Production registration uses the
// native `register_enclave` with a genuine AWS Nitro attestation document (verifies PCRs on-chain).
module yeti_wells::enclave;

use std::bcs;
use std::string::String;
use sui::ed25519;
use sui::nitro_attestation::NitroAttestationDocument;

use fun to_pcrs as NitroAttestationDocument.to_pcrs;

const EInvalidPCRs: u64 = 0;
const EInvalidConfigVersion: u64 = 1;
const EInvalidCap: u64 = 2;
const EInvalidOwner: u64 = 3;

// PCR0: enclave image · PCR1: kernel · PCR2: application
public struct Pcrs(vector<u8>, vector<u8>, vector<u8>) has copy, drop, store;

public struct EnclaveConfig<phantom T> has key {
    id: UID,
    name: String,
    pcrs: Pcrs,
    capability_id: ID,
    version: u64,
}

public struct Enclave<phantom T> has key {
    id: UID,
    pk: vector<u8>,
    config_version: u64,
    owner: address,
}

public struct Cap<phantom T> has key, store {
    id: UID,
}

public struct IntentMessage<T: drop> has copy, drop {
    intent: u8,
    timestamp_ms: u64,
    payload: T,
}

public fun new_cap<T: drop>(_: T, ctx: &mut TxContext): Cap<T> {
    Cap { id: object::new(ctx) }
}

public fun create_enclave_config<T: drop>(
    cap: &Cap<T>,
    name: String,
    pcr0: vector<u8>,
    pcr1: vector<u8>,
    pcr2: vector<u8>,
    ctx: &mut TxContext,
) {
    let enclave_config = EnclaveConfig<T> {
        id: object::new(ctx),
        name,
        pcrs: Pcrs(pcr0, pcr1, pcr2),
        capability_id: cap.id.to_inner(),
        version: 0,
    };
    transfer::share_object(enclave_config);
}

/// Production: verify a genuine AWS Nitro attestation document, assert its PCRs match the config,
/// and register the enclave's public key on-chain.
public fun register_enclave<T>(
    enclave_config: &EnclaveConfig<T>,
    document: NitroAttestationDocument,
    ctx: &mut TxContext,
) {
    let pk = enclave_config.load_pk(&document);
    transfer::share_object(Enclave<T> {
        id: object::new(ctx),
        pk,
        config_version: enclave_config.version,
        owner: ctx.sender(),
    });
}

/// SIM/TEST ONLY: register an enclave directly from a raw ed25519 pubkey, gated by the `Cap` (no
/// hardware attestation). For local development and as a demo backup; NOT a security guarantee.
public fun register_enclave_dev<T>(_cap: &Cap<T>, pk: vector<u8>, ctx: &mut TxContext) {
    transfer::share_object(Enclave<T> {
        id: object::new(ctx),
        pk,
        config_version: 0,
        owner: ctx.sender(),
    });
}

public fun verify_signature<T, P: drop>(
    enclave: &Enclave<T>,
    intent_scope: u8,
    timestamp_ms: u64,
    payload: P,
    signature: &vector<u8>,
): bool {
    let intent_message = create_intent_message(intent_scope, timestamp_ms, payload);
    let bytes = bcs::to_bytes(&intent_message);
    ed25519::ed25519_verify(signature, &enclave.pk, &bytes)
}

public fun update_pcrs<T: drop>(
    config: &mut EnclaveConfig<T>,
    cap: &Cap<T>,
    pcr0: vector<u8>,
    pcr1: vector<u8>,
    pcr2: vector<u8>,
) {
    cap.assert_is_valid_for_config(config);
    config.pcrs = Pcrs(pcr0, pcr1, pcr2);
    config.version = config.version + 1;
}

public fun update_name<T: drop>(config: &mut EnclaveConfig<T>, cap: &Cap<T>, name: String) {
    cap.assert_is_valid_for_config(config);
    config.name = name;
}

public fun pcr0<T>(config: &EnclaveConfig<T>): &vector<u8> { &config.pcrs.0 }
public fun pcr1<T>(config: &EnclaveConfig<T>): &vector<u8> { &config.pcrs.1 }
public fun pcr2<T>(config: &EnclaveConfig<T>): &vector<u8> { &config.pcrs.2 }
public fun pk<T>(enclave: &Enclave<T>): &vector<u8> { &enclave.pk }

public fun destroy_old_enclave<T>(e: Enclave<T>, config: &EnclaveConfig<T>) {
    assert!(e.config_version < config.version, EInvalidConfigVersion);
    let Enclave { id, .. } = e;
    id.delete();
}

public fun deploy_old_enclave_by_owner<T>(e: Enclave<T>, ctx: &mut TxContext) {
    assert!(e.owner == ctx.sender(), EInvalidOwner);
    let Enclave { id, .. } = e;
    id.delete();
}

public fun create_intent_message<P: drop>(intent: u8, timestamp_ms: u64, payload: P): IntentMessage<P> {
    IntentMessage { intent, timestamp_ms, payload }
}

fun assert_is_valid_for_config<T>(cap: &Cap<T>, enclave_config: &EnclaveConfig<T>) {
    assert!(cap.id.to_inner() == enclave_config.capability_id, EInvalidCap);
}

fun load_pk<T>(enclave_config: &EnclaveConfig<T>, document: &NitroAttestationDocument): vector<u8> {
    assert!(document.to_pcrs() == enclave_config.pcrs, EInvalidPCRs);
    (*document.public_key()).destroy_some()
}

fun to_pcrs(document: &NitroAttestationDocument): Pcrs {
    let pcrs = document.pcrs();
    Pcrs(*pcrs[0].value(), *pcrs[1].value(), *pcrs[2].value())
}

#[test_only]
public fun destroy_for_testing<T>(enclave: Enclave<T>) {
    let Enclave { id, .. } = enclave;
    id.delete();
}
