#[test_only]
module yeti_wells::donation_tests;

use sui::test_scenario as ts;
use sui::coin;
use sui::sui::SUI;
use yeti_wells::registry::{Self, Registry, AdminCap};
use yeti_wells::project::{Self, WaterProject};
use yeti_wells::impact_nft::{Self, ImpactNFT};
use yeti_wells::donation;

const ADMIN: address = @0xAD;
const ALICE: address = @0xA11CE;
const BOB: address = @0xB0B;
const PAYOUT: address = @0xBEEF;

fun setup(): ts::Scenario {
    let mut sc = ts::begin(ADMIN);
    registry::init_for_testing(ts::ctx(&mut sc));
    ts::next_tx(&mut sc, ADMIN);
    let mut reg = ts::take_shared<Registry>(&sc);
    project::create_for_testing(&mut reg, 10_000_000_000, 100_000, PAYOUT, ts::ctx(&mut sc));
    ts::return_shared(reg);
    sc
}

#[test]
fun test_donate_first_time() {
    let mut sc = setup();
    ts::next_tx(&mut sc, ALICE);
    {
        let mut reg = ts::take_shared<Registry>(&sc);
        let mut proj = ts::take_shared<WaterProject>(&sc);
        let c = coin::mint_for_testing<SUI>(1000, ts::ctx(&mut sc));
        donation::donate(&mut proj, &mut reg, c, ts::ctx(&mut sc));
        assert!(project::raised_mist(&proj) == 1000, 0);
        assert!(project::escrow_value(&proj) == 1000, 1);
        assert!(registry::total_raised_mist(&reg) == 1000, 2);
        assert!(project::has_donor(&proj, ALICE), 3);
        ts::return_shared(proj);
        ts::return_shared(reg);
    };
    // The soulbound NFT was transferred to Alice.
    ts::next_tx(&mut sc, ALICE);
    {
        let nft = ts::take_from_sender<ImpactNFT>(&sc);
        assert!(impact_nft::owner(&nft) == ALICE, 4);
        assert!(impact_nft::donated_mist(&nft) == 1000, 5);
        assert!(impact_nft::liters_attributed(&nft) == 0, 6);
        ts::return_to_sender(&sc, nft);
    };
    ts::end(sc);
}

#[test]
fun test_donate_again_updates_same_nft() {
    let mut sc = setup();
    ts::next_tx(&mut sc, ALICE);
    {
        let mut reg = ts::take_shared<Registry>(&sc);
        let mut proj = ts::take_shared<WaterProject>(&sc);
        let c = coin::mint_for_testing<SUI>(1000, ts::ctx(&mut sc));
        donation::donate(&mut proj, &mut reg, c, ts::ctx(&mut sc));
        ts::return_shared(proj);
        ts::return_shared(reg);
    };
    ts::next_tx(&mut sc, ALICE);
    {
        let mut reg = ts::take_shared<Registry>(&sc);
        let mut proj = ts::take_shared<WaterProject>(&sc);
        let mut nft = ts::take_from_sender<ImpactNFT>(&sc);
        let c = coin::mint_for_testing<SUI>(500, ts::ctx(&mut sc));
        donation::donate_again(&mut proj, &mut reg, &mut nft, c, ts::ctx(&mut sc));
        assert!(impact_nft::donated_mist(&nft) == 1500, 0);
        assert!(project::raised_mist(&proj) == 1500, 1);
        assert!(project::escrow_value(&proj) == 1500, 2);
        ts::return_to_sender(&sc, nft);
        ts::return_shared(proj);
        ts::return_shared(reg);
    };
    ts::end(sc);
}

#[test]
#[expected_failure(abort_code = donation::E_ALREADY_DONATED)]
fun test_donate_twice_aborts() {
    let mut sc = setup();
    ts::next_tx(&mut sc, ALICE);
    {
        let mut reg = ts::take_shared<Registry>(&sc);
        let mut proj = ts::take_shared<WaterProject>(&sc);
        let c = coin::mint_for_testing<SUI>(1000, ts::ctx(&mut sc));
        donation::donate(&mut proj, &mut reg, c, ts::ctx(&mut sc));
        ts::return_shared(proj);
        ts::return_shared(reg);
    };
    ts::next_tx(&mut sc, ALICE);
    {
        let mut reg = ts::take_shared<Registry>(&sc);
        let mut proj = ts::take_shared<WaterProject>(&sc);
        let c = coin::mint_for_testing<SUI>(500, ts::ctx(&mut sc));
        donation::donate(&mut proj, &mut reg, c, ts::ctx(&mut sc)); // aborts: already donated
        ts::return_shared(proj);
        ts::return_shared(reg);
    };
    ts::end(sc);
}

#[test]
#[expected_failure(abort_code = donation::E_ZERO_DONATION)]
fun test_donate_zero_aborts() {
    let mut sc = setup();
    ts::next_tx(&mut sc, ALICE);
    let mut reg = ts::take_shared<Registry>(&sc);
    let mut proj = ts::take_shared<WaterProject>(&sc);
    let c = coin::mint_for_testing<SUI>(0, ts::ctx(&mut sc));
    donation::donate(&mut proj, &mut reg, c, ts::ctx(&mut sc)); // aborts: zero
    ts::return_shared(proj);
    ts::return_shared(reg);
    ts::end(sc);
}

#[test]
#[expected_failure(abort_code = donation::E_NFT_OWNER_MISMATCH)]
fun test_donate_again_wrong_owner_aborts() {
    let mut sc = setup();
    ts::next_tx(&mut sc, ALICE);
    {
        let mut reg = ts::take_shared<Registry>(&sc);
        let mut proj = ts::take_shared<WaterProject>(&sc);
        let c = coin::mint_for_testing<SUI>(1000, ts::ctx(&mut sc));
        donation::donate(&mut proj, &mut reg, c, ts::ctx(&mut sc));
        ts::return_shared(proj);
        ts::return_shared(reg);
    };
    // Bob tries to top up Alice's NFT.
    ts::next_tx(&mut sc, BOB);
    {
        let mut reg = ts::take_shared<Registry>(&sc);
        let mut proj = ts::take_shared<WaterProject>(&sc);
        let mut nft = ts::take_from_address<ImpactNFT>(&sc, ALICE);
        let c = coin::mint_for_testing<SUI>(500, ts::ctx(&mut sc));
        donation::donate_again(&mut proj, &mut reg, &mut nft, c, ts::ctx(&mut sc)); // aborts: owner mismatch
        ts::return_to_address(ALICE, nft);
        ts::return_shared(proj);
        ts::return_shared(reg);
    };
    ts::end(sc);
}

#[test]
#[expected_failure(abort_code = donation::E_NFT_PROJECT_MISMATCH)]
fun test_donate_again_wrong_project_aborts() {
    let mut sc = setup();
    ts::next_tx(&mut sc, ALICE);
    {
        let mut reg = ts::take_shared<Registry>(&sc);
        let mut proj = ts::take_shared<WaterProject>(&sc);
        // Alice holds an NFT minted for a different (fake) project id.
        let fake_uid = object::new(ts::ctx(&mut sc));
        let fake_pid = object::uid_to_inner(&fake_uid);
        object::delete(fake_uid);
        let mut nft = impact_nft::mint_for_testing(ALICE, fake_pid, 1000, ts::ctx(&mut sc));
        let c = coin::mint_for_testing<SUI>(500, ts::ctx(&mut sc));
        donation::donate_again(&mut proj, &mut reg, &mut nft, c, ts::ctx(&mut sc)); // aborts: project mismatch
        impact_nft::burn_for_testing(nft);
        ts::return_shared(proj);
        ts::return_shared(reg);
    };
    ts::end(sc);
}

// === Phase 9: SEC-02 refund / cancel ===

fun donor_donates(sc: &mut ts::Scenario, who: address, amount: u64) {
    ts::next_tx(sc, who);
    let mut reg = ts::take_shared<Registry>(sc);
    let mut proj = ts::take_shared<WaterProject>(sc);
    let c = coin::mint_for_testing<SUI>(amount, ts::ctx(sc));
    donation::donate(&mut proj, &mut reg, c, ts::ctx(sc));
    ts::return_shared(proj);
    ts::return_shared(reg);
}

#[test]
fun test_refund_after_cancel_pro_rata() {
    let mut sc = setup(); // goal 10 SUI, payout PAYOUT; ADMIN holds AdminCap from init
    donor_donates(&mut sc, ALICE, 4_000_000_000);
    donor_donates(&mut sc, BOB, 6_000_000_000);
    // Admin cancels.
    ts::next_tx(&mut sc, ADMIN);
    {
        let cap = ts::take_from_sender<AdminCap>(&sc);
        let mut proj = ts::take_shared<WaterProject>(&sc);
        project::cancel_project(&cap, &mut proj);
        ts::return_to_sender(&sc, cap);
        ts::return_shared(proj);
    };
    // Alice refunds: nothing released, so full 4 SUI back; escrow 10->6, raised 10->6.
    ts::next_tx(&mut sc, ALICE);
    {
        let mut reg = ts::take_shared<Registry>(&sc);
        let mut proj = ts::take_shared<WaterProject>(&sc);
        let nft = ts::take_from_sender<ImpactNFT>(&sc);
        donation::refund(&mut proj, &mut reg, nft, ts::ctx(&mut sc));
        assert!(project::raised_mist(&proj) == 6_000_000_000, 0);
        assert!(project::escrow_value(&proj) == 6_000_000_000, 1);
        assert!(!project::has_donor(&proj, ALICE), 2);
        ts::return_shared(proj);
        ts::return_shared(reg);
    };
    ts::next_tx(&mut sc, ALICE);
    {
        let paid = ts::take_from_sender<coin::Coin<SUI>>(&sc);
        assert!(coin::value(&paid) == 4_000_000_000, 3);
        ts::return_to_sender(&sc, paid);
    };
    // Bob refunds: 6 SUI * 6/6 = full 6 SUI; escrow -> 0, raised -> 0 (order-independent fairness).
    ts::next_tx(&mut sc, BOB);
    {
        let mut reg = ts::take_shared<Registry>(&sc);
        let mut proj = ts::take_shared<WaterProject>(&sc);
        let nft = ts::take_from_sender<ImpactNFT>(&sc);
        donation::refund(&mut proj, &mut reg, nft, ts::ctx(&mut sc));
        assert!(project::escrow_value(&proj) == 0, 4);
        assert!(project::raised_mist(&proj) == 0, 5);
        ts::return_shared(proj);
        ts::return_shared(reg);
    };
    ts::end(sc);
}

#[test]
#[expected_failure(abort_code = donation::E_NOT_CANCELLED)]
fun test_refund_requires_cancel() {
    let mut sc = setup();
    donor_donates(&mut sc, ALICE, 1_000_000_000);
    ts::next_tx(&mut sc, ALICE);
    {
        let mut reg = ts::take_shared<Registry>(&sc);
        let mut proj = ts::take_shared<WaterProject>(&sc);
        let nft = ts::take_from_sender<ImpactNFT>(&sc);
        donation::refund(&mut proj, &mut reg, nft, ts::ctx(&mut sc)); // not cancelled -> abort
        ts::return_shared(proj);
        ts::return_shared(reg);
    };
    ts::end(sc);
}
