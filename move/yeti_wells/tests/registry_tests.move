#[test_only]
module yeti_wells::registry_tests;

use sui::test_scenario as ts;
use yeti_wells::registry::{Self, Registry, AdminCap};

const ADMIN: address = @0xAD;

#[test]
fun test_init_shares_registry_and_grants_admin() {
    let mut scenario = ts::begin(ADMIN);
    registry::init_for_testing(ts::ctx(&mut scenario));
    ts::next_tx(&mut scenario, ADMIN);
    {
        let reg = ts::take_shared<Registry>(&scenario);
        assert!(registry::total_delivered_liters(&reg) == 0, 0);
        assert!(registry::total_raised_mist(&reg) == 0, 1);
        assert!(registry::project_count(&reg) == 0, 2);
        ts::return_shared(reg);

        // AdminCap was granted to the deployer.
        let cap = ts::take_from_sender<AdminCap>(&scenario);
        ts::return_to_sender(&scenario, cap);
    };
    ts::end(scenario);
}

#[test]
fun test_accounting_mutators() {
    let mut scenario = ts::begin(ADMIN);
    let mut reg = registry::new_for_testing(ts::ctx(&mut scenario));

    assert!(registry::bump_project_count(&mut reg) == 1, 0);
    assert!(registry::bump_project_count(&mut reg) == 2, 1);
    assert!(registry::project_count(&reg) == 2, 2);

    registry::add_raised(&mut reg, 500);
    registry::add_raised(&mut reg, 250);
    assert!(registry::total_raised_mist(&reg) == 750, 3);

    registry::add_delivered(&mut reg, 1000);
    registry::add_delivered(&mut reg, 500);
    assert!(registry::total_delivered_liters(&reg) == 1500, 4);

    registry::destroy_registry_for_testing(reg);
    ts::end(scenario);
}
