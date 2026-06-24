#[test_only]
module yeti_wells::project_tests;

use sui::test_scenario as ts;
use std::string;
use yeti_wells::registry::{Self, Registry, AdminCap};
use yeti_wells::project::{Self, WaterProject};

const ADMIN: address = @0xAD;
const PAYOUT: address = @0xBEEF;

fun s(b: vector<u8>): string::String { string::utf8(b) }

#[test]
fun test_create_project() {
    let mut scenario = ts::begin(ADMIN);
    registry::init_for_testing(ts::ctx(&mut scenario));
    ts::next_tx(&mut scenario, ADMIN);
    {
        let mut reg = ts::take_shared<Registry>(&scenario);
        let cap = ts::take_from_sender<AdminCap>(&scenario);
        project::create_project(
            &cap, &mut reg,
            s(b"Kibera Borehole"), s(b"Nairobi, KE"), s(b"Solar borehole"), s(b"blob123"),
            5_000_000_000, 100_000, PAYOUT,
            vector[s(b"Drill"), s(b"Half"), s(b"Done")],
            vector[0, 50_000, 100_000],
            vector[1_000_000_000, 2_000_000_000, 2_000_000_000],
            ts::ctx(&mut scenario),
        );
        assert!(registry::project_count(&reg) == 1, 0);
        ts::return_to_sender(&scenario, cap);
        ts::return_shared(reg);
    };
    ts::next_tx(&mut scenario, ADMIN);
    {
        let proj = ts::take_shared<WaterProject>(&scenario);
        assert!(project::raised_mist(&proj) == 0, 1);
        assert!(project::delivered_liters(&proj) == 0, 2);
        assert!(project::escrow_value(&proj) == 0, 3);
        assert!(project::milestone_count(&proj) == 3, 4);
        assert!(project::target_liters(&proj) == 100_000, 5);
        assert!(project::funding_goal_mist(&proj) == 5_000_000_000, 6);
        assert!(project::payout(&proj) == PAYOUT, 7);
        assert!(project::steward(&proj) == ADMIN, 8);
        // milestones preserved order (index 1 -> threshold 50_000)
        assert!(project::milestone_threshold(&proj, 1) == 50_000, 9);
        assert!(project::milestone_release(&proj, 2) == 2_000_000_000, 10);
        assert!(!project::milestone_released(&proj, 0), 11);
        assert!(project::enclave_id(&proj).is_none(), 12);
        assert!(!project::has_donor(&proj, PAYOUT), 13);
        ts::return_shared(proj);
    };
    ts::end(scenario);
}

#[test]
#[expected_failure(abort_code = project::E_BAD_MILESTONES)]
fun test_create_project_bad_milestones() {
    let mut scenario = ts::begin(ADMIN);
    registry::init_for_testing(ts::ctx(&mut scenario));
    ts::next_tx(&mut scenario, ADMIN);
    let mut reg = ts::take_shared<Registry>(&scenario);
    let cap = ts::take_from_sender<AdminCap>(&scenario);
    // 1 description but 2 thresholds -> mismatch
    project::create_project(
        &cap, &mut reg,
        s(b"x"), s(b"y"), s(b"z"), s(b"b"),
        1, 1, PAYOUT,
        vector[s(b"only-one")],
        vector[0, 1],
        vector[1],
        ts::ctx(&mut scenario),
    );
    // Unreachable at runtime (the call above aborts), but required for the type-checker.
    ts::return_to_sender(&scenario, cap);
    ts::return_shared(reg);
    ts::end(scenario);
}

#[test]
fun test_add_evidence_and_set_enclave() {
    let mut scenario = ts::begin(ADMIN);
    registry::init_for_testing(ts::ctx(&mut scenario));
    ts::next_tx(&mut scenario, ADMIN);
    {
        let mut reg = ts::take_shared<Registry>(&scenario);
        project::create_for_testing(&mut reg, 1_000_000_000, 10_000, PAYOUT, ts::ctx(&mut scenario));
        ts::return_shared(reg);
    };
    ts::next_tx(&mut scenario, ADMIN);
    {
        let mut proj = ts::take_shared<WaterProject>(&scenario);
        let cap = registry::new_admin_for_testing(ts::ctx(&mut scenario));
        project::add_evidence(
            &cap, &mut proj,
            s(b"evblob"), s(b"image/jpeg"), s(b"borehole photo"), 0, 1234,
        );
        // set_enclave with a fresh dummy ID derived from a throwaway UID
        let dummy = object::new(ts::ctx(&mut scenario));
        let dummy_id = object::uid_to_inner(&dummy);
        project::set_enclave(&cap, &mut proj, dummy_id);
        assert!(proj.enclave_id().is_some(), 0);
        object::delete(dummy);
        registry::destroy_admin_for_testing(cap);
        ts::return_shared(proj);
    };
    ts::end(scenario);
}
