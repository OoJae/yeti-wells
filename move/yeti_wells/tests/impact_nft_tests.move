#[test_only]
module yeti_wells::impact_nft_tests;

use sui::test_scenario as ts;
use sui::balance;
use sui::sui::SUI;
use yeti_wells::registry::{Self, Registry};
use yeti_wells::project::{Self, WaterProject};
use yeti_wells::impact_nft;

const ADMIN: address = @0xAD;
const ALICE: address = @0xA11CE;
const BOB: address = @0xB0B;
const PAYOUT: address = @0xBEEF;

/// Create a project and leave the scenario at a tx boundary so the caller can take_shared it.
fun setup_project(goal: u64, target: u64): ts::Scenario {
    let mut sc = ts::begin(ADMIN);
    registry::init_for_testing(ts::ctx(&mut sc));
    ts::next_tx(&mut sc, ADMIN);
    let mut reg = ts::take_shared<Registry>(&sc);
    project::create_for_testing(&mut reg, goal, target, PAYOUT, ts::ctx(&mut sc));
    ts::return_shared(reg);
    sc
}

#[test]
fun test_sync_single_donor() {
    let mut sc = setup_project(10_000_000_000, 100_000);
    ts::next_tx(&mut sc, ALICE);
    {
        let mut proj = ts::take_shared<WaterProject>(&sc);
        project::deposit(&mut proj, balance::create_for_testing<SUI>(1000));
        let _ = project::set_delivered(&mut proj, 500);
        let mut nft = impact_nft::mint_for_testing(ALICE, project::id(&proj), 1000, ts::ctx(&mut sc));
        impact_nft::sync_impact(&mut nft, &proj);
        assert!(impact_nft::liters_attributed(&nft) == 500, 0);
        assert!(impact_nft::xp(&nft) == 500, 1);
        assert!(impact_nft::tier(&nft) == 1, 2);
        impact_nft::burn_for_testing(nft);
        ts::return_shared(proj);
    };
    ts::end(sc);
}

#[test]
fun test_sync_multiple_donors_independent() {
    let mut sc = setup_project(10_000_000_000, 100_000);
    ts::next_tx(&mut sc, ADMIN);
    {
        let mut proj = ts::take_shared<WaterProject>(&sc);
        project::deposit(&mut proj, balance::create_for_testing<SUI>(750));
        project::deposit(&mut proj, balance::create_for_testing<SUI>(250));
        let _ = project::set_delivered(&mut proj, 1000);
        let mut a = impact_nft::mint_for_testing(ALICE, project::id(&proj), 750, ts::ctx(&mut sc));
        let mut b = impact_nft::mint_for_testing(BOB, project::id(&proj), 250, ts::ctx(&mut sc));
        // Each donor syncs independently — proves O(1) per donor, no loop over donors.
        impact_nft::sync_impact(&mut a, &proj);
        impact_nft::sync_impact(&mut b, &proj);
        assert!(impact_nft::liters_attributed(&a) == 750, 0);
        assert!(impact_nft::liters_attributed(&b) == 250, 1);
        assert!(impact_nft::liters_attributed(&a) + impact_nft::liters_attributed(&b) == 1000, 2);
        impact_nft::burn_for_testing(a);
        impact_nft::burn_for_testing(b);
        ts::return_shared(proj);
    };
    ts::end(sc);
}

#[test]
fun test_sync_across_milestones_monotonic() {
    let mut sc = setup_project(10_000_000_000, 100_000);
    ts::next_tx(&mut sc, ALICE);
    {
        let mut proj = ts::take_shared<WaterProject>(&sc);
        project::deposit(&mut proj, balance::create_for_testing<SUI>(1000));
        let mut nft = impact_nft::mint_for_testing(ALICE, project::id(&proj), 1000, ts::ctx(&mut sc));
        impact_nft::sync_impact(&mut nft, &proj);
        assert!(impact_nft::liters_attributed(&nft) == 0, 0);
        let _ = project::set_delivered(&mut proj, 500);
        impact_nft::sync_impact(&mut nft, &proj);
        assert!(impact_nft::liters_attributed(&nft) == 500, 1);
        let _ = project::set_delivered(&mut proj, 1000);
        impact_nft::sync_impact(&mut nft, &proj);
        assert!(impact_nft::liters_attributed(&nft) == 1000, 2);
        impact_nft::burn_for_testing(nft);
        ts::return_shared(proj);
    };
    ts::end(sc);
}

#[test]
fun test_sync_div_by_zero_guard() {
    let mut sc = setup_project(10_000_000_000, 100_000);
    ts::next_tx(&mut sc, ALICE);
    {
        let mut proj = ts::take_shared<WaterProject>(&sc);
        let _ = project::set_delivered(&mut proj, 500); // raised stays 0
        let mut nft = impact_nft::mint_for_testing(ALICE, project::id(&proj), 100, ts::ctx(&mut sc));
        impact_nft::sync_impact(&mut nft, &proj);
        assert!(impact_nft::liters_attributed(&nft) == 0, 0);
        impact_nft::burn_for_testing(nft);
        ts::return_shared(proj);
    };
    ts::end(sc);
}

#[test]
fun test_sync_no_u64_overflow() {
    // 1e9 liters * 5e17 mist / 1e18 mist = 5e8 — the product overflows u64; the u128 intermediate fixes it.
    let mut sc = setup_project(2_000_000_000_000_000_000, 2_000_000_000);
    ts::next_tx(&mut sc, ALICE);
    {
        let mut proj = ts::take_shared<WaterProject>(&sc);
        project::deposit(&mut proj, balance::create_for_testing<SUI>(1_000_000_000_000_000_000));
        let _ = project::set_delivered(&mut proj, 1_000_000_000);
        let mut nft = impact_nft::mint_for_testing(ALICE, project::id(&proj), 500_000_000_000_000_000, ts::ctx(&mut sc));
        impact_nft::sync_impact(&mut nft, &proj);
        assert!(impact_nft::liters_attributed(&nft) == 500_000_000, 0);
        impact_nft::burn_for_testing(nft);
        ts::return_shared(proj);
    };
    ts::end(sc);
}

#[test]
#[expected_failure(abort_code = impact_nft::E_PROJECT_MISMATCH)]
fun test_sync_project_mismatch_aborts() {
    let mut sc = setup_project(10_000_000_000, 100_000);
    ts::next_tx(&mut sc, ALICE);
    {
        let mut proj = ts::take_shared<WaterProject>(&sc);
        let fake_uid = object::new(ts::ctx(&mut sc));
        let fake_pid = object::uid_to_inner(&fake_uid);
        object::delete(fake_uid);
        let mut nft = impact_nft::mint_for_testing(ALICE, fake_pid, 100, ts::ctx(&mut sc));
        impact_nft::sync_impact(&mut nft, &proj); // aborts
        impact_nft::burn_for_testing(nft);
        ts::return_shared(proj);
    };
    ts::end(sc);
}

#[test]
fun test_tier_thresholds() {
    assert!(impact_nft::tier_for_testing(0) == 0, 0);
    assert!(impact_nft::tier_for_testing(99) == 0, 1);
    assert!(impact_nft::tier_for_testing(100) == 1, 2);
    assert!(impact_nft::tier_for_testing(999) == 1, 3);
    assert!(impact_nft::tier_for_testing(1000) == 2, 4);
    assert!(impact_nft::tier_for_testing(9999) == 2, 5);
    assert!(impact_nft::tier_for_testing(10000) == 3, 6);
}
