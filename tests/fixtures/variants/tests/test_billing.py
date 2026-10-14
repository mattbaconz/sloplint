# expect: TEST-002
import time

from billing import charge


def test_charge_sets_status():
    order = charge(4200)
    time.sleep(2)
    assert order.status == "paid"
