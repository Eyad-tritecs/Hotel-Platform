/* Simulated unit tests for the Rate Plans & Pricing engine in assets/js/app.js.

     Room Type  →  Rate Plan  →  Pricing Period  →  Daily Prices

   Same plain-Node + vm-sandbox approach as room-assignment.test.js (no test
   framework, no build step, matching the rest of this prototype):

     node tests/rate-plans.test.js

   The most important thing these tests protect is scenario 14: introducing rate
   plans must not have moved a single existing reservation's price, and repricing
   a plan afterwards must not move one either. */

var fs = require('fs');
var path = require('path');
var vm = require('vm');

function makeLocalStorage() {
  var store = {};
  return {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    setItem: function (k, v) { store[k] = String(v); },
    removeItem: function (k) { delete store[k]; }
  };
}

function loadPG() {
  var code = fs.readFileSync(path.join(__dirname, '..', 'assets', 'js', 'app.js'), 'utf8');
  var sandbox = { window: {}, localStorage: makeLocalStorage(), console: console };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: 'app.js' });
  return sandbox.window.PG;
}

var passed = 0, failed = 0;
function assert(name, cond) {
  if (cond) { passed++; }
  else { failed++; console.log('FAIL: ' + name); }
}
function assertEqual(name, actual, expected) {
  var ok = JSON.stringify(actual) === JSON.stringify(expected);
  assert(name + ' (got ' + JSON.stringify(actual) + ', expected ' + JSON.stringify(expected) + ')', ok);
}

var PG = loadPG();

/* ------------------------------------------------------------------ */
/* Test 1 — Model shape: a room type holds many plans, a plan holds     */
/* many named periods. (Acceptance scenarios 2 and 3.)                  */
/* ------------------------------------------------------------------ */
(function testModelShape() {
  var s = PG.getState();
  var stdPlans = PG.ratePlansForType(s, 'std');
  assert('a room type can hold multiple rate plans', stdPlans.length >= 2);

  var multiPeriod = s.ratePlans.filter(function (p) { return (p.periods || []).length >= 2; });
  assert('a rate plan can hold multiple named pricing periods', multiPeriod.length >= 1);

  var allNamed = s.ratePlans.every(function (p) {
    return (p.periods || []).every(function (pp) { return !!pp.name && !!pp.startDate && !!pp.endDate; });
  });
  assert('every pricing period has a name, a start date and an end date', allNamed);

  var defaults = {};
  s.ratePlans.forEach(function (p) { if (p.isDefault) defaults[p.roomTypeId] = (defaults[p.roomTypeId] || 0) + 1; });
  var oneEach = s.roomTypes.every(function (rt) { return defaults[rt.id] === 1; });
  assert('exactly one default plan per room type, so a bare price question has one answer', oneEach);
})();

/* ------------------------------------------------------------------ */
/* Test 2 — Resolution order: manual override beats period, period      */
/* beats base. Every resolved price reports which layer produced it.    */
/* (Acceptance scenario 10's labelling requirement.)                    */
/* ------------------------------------------------------------------ */
(function testResolutionOrder() {
  var s = PG.getState();
  // Non-Refundable's "Standard Season" covers today at a flat 90.
  var period = PG.resolvePrice(s, 'std', 'rp-std-nr', PG.TODAY);
  assertEqual('period pricing wins over the base calendar', period.price, 90);
  assertEqual('…and is labelled as a period override', period.source, 'period');
  assertEqual('…and names the period responsible', period.periodName, 'Standard Season');

  // The default plan has no period covering today, so it falls through to base.
  var base = PG.resolvePrice(s, 'std', 'rp-std-flex', PG.TODAY);
  assertEqual('a plan with no covering period falls back to base price', base.source, 'base');
  assertEqual('…and matches the base calendar exactly', base.price, PG.basePriceFor(s, 'std', PG.TODAY));

  s.rateOverrides[PG.overrideKey('std', 'rp-std-nr', PG.TODAY)] = 77;
  var manual = PG.resolvePrice(s, 'std', 'rp-std-nr', PG.TODAY);
  assertEqual('a manual override beats the pricing period', manual.price, 77);
  assertEqual('…and is labelled as a manual override', manual.source, 'manual');
})();

/* ------------------------------------------------------------------ */
/* Test 3 — Pricing modes: one price for all selected days, vs. a       */
/* different price per weekday. (Acceptance scenarios 5, 6 and 7.)      */
/* ------------------------------------------------------------------ */
(function testPricingModes() {
  var s = PG.getState();
  // "same" mode — Non-Refundable prices every selected day identically.
  var sameDates = PG.dateRange(PG.TODAY, PG.addDays(PG.TODAY, 7));
  var allSame = sameDates.every(function (d) { return PG.resolvePrice(s, 'std', 'rp-std-nr', d).price === 90; });
  assert('same-price mode applies one price to every selected day', allSame);

  // "byday" mode — Breakfast Included prices Thu/Fri above the rest.
  var bb = PG.ratePlanById(s, 'rp-std-bb');
  var thu = sameDates.find(function (d) { return PG.dayOfWeek(d) === 4; });
  var mon = sameDates.find(function (d) { return PG.dayOfWeek(d) === 1; });
  assertEqual('per-day mode prices Thursday from its own weekday slot', PG.resolvePrice(s, 'std', bb.id, thu).price, 145);
  assertEqual('per-day mode prices Monday from its own weekday slot', PG.resolvePrice(s, 'std', bb.id, mon).price, 120);

  // Day-of-week restriction: Corporate is Sun–Thu only.
  var corp = PG.ratePlanById(s, 'rp-dlx-corp');
  assertEqual('a period only prices the weekdays it selected', corp.periods[0].daysOfWeek, [0, 1, 2, 3, 4]);
})();

/* ------------------------------------------------------------------ */
/* Test 4 — Missing prices are identified, never shown as zero, and     */
/* block the plan from being sold. (Acceptance scenario 10.)            */
/* ------------------------------------------------------------------ */
(function testMissingPrices() {
  var s = PG.getState();
  // Corporate Rate sells only inside its periods, which exclude Fri/Sat.
  var range = PG.dateRange(PG.addDays(PG.TODAY, 30), PG.addDays(PG.TODAY, 44));
  var friday = range.find(function (d) { return PG.dayOfWeek(d) === 5; });
  var r = PG.resolvePrice(s, 'dlx', 'rp-dlx-corp', friday);
  assertEqual('an uncovered day on a strict plan has no price', r.price, null);
  assertEqual('…and is labelled Missing Price rather than $0', r.label, 'Missing Price');
  assert('…and is never silently reported as zero', r.price !== 0);

  var sunday = range.find(function (d) { return PG.dayOfWeek(d) === 0; });
  var badStay = PG.validateRatePlanForStay(s, 'dlx', 'rp-dlx-corp', friday, PG.addDays(friday, 2));
  assert('a stay covering an unpriced night is refused', badStay.ok === false);
  assert('…with a reason that names the missing dates', /has no price for/.test(badStay.reason));

  var goodStay = PG.validateRatePlanForStay(s, 'dlx', 'rp-dlx-corp', sunday, PG.addDays(sunday, 2));
  assert('a stay entirely inside the priced weekdays is allowed', goodStay.ok === true);
})();

/* ------------------------------------------------------------------ */
/* Test 5 — Inactive plans and wrong-room-type plans are refused.       */
/* ------------------------------------------------------------------ */
(function testPlanValidity() {
  var s = PG.getState();
  var inactive = PG.validateRatePlanForStay(s, 'std', 'rp-std-early', PG.addDays(PG.TODAY, 40), PG.addDays(PG.TODAY, 42));
  assert('an inactive plan cannot be used for a new reservation', inactive.ok === false);
  assert('…with a reason naming the plan', /inactive/.test(inactive.reason));

  var wrongType = PG.validateRatePlanForStay(s, 'std', 'rp-dlx-flex', PG.TODAY, PG.addDays(PG.TODAY, 2));
  assert('a plan belonging to another room type is refused', wrongType.ok === false);
})();

/* ------------------------------------------------------------------ */
/* Test 6 — Overlap rule: two ACTIVE periods on one plan may not claim  */
/* the same night, but may share dates if they share no weekday.        */
/* (Acceptance scenario 9.)                                             */
/* ------------------------------------------------------------------ */
(function testOverlaps() {
  var s = PG.getState();
  var plan = PG.ratePlanById(s, 'rp-fam-weekend');
  var weekendPremium = plan.periods.find(function (p) { return p.name === 'Weekend Premium'; });

  var sameDatesNoSharedDay = PG.overlappingPeriods(plan, weekendPremium, weekendPremium.id);
  assertEqual('periods sharing dates but no weekday do not conflict', sameDatesNoSharedDay.length, 0);

  var allDays = { startDate: PG.TODAY, endDate: PG.addDays(PG.TODAY, 10), daysOfWeek: [0, 1, 2, 3, 4, 5, 6], active: true };
  var conflicts = PG.overlappingPeriods(plan, allDays, null);
  assert('an all-days period conflicts with both existing weekday-split periods', conflicts.length === 2);

  var disjointDates = { startDate: PG.addDays(PG.TODAY, 400), endDate: PG.addDays(PG.TODAY, 430), daysOfWeek: [0, 1, 2, 3, 4, 5, 6], active: true };
  assertEqual('a period outside every existing date range does not conflict', PG.overlappingPeriods(plan, disjointDates, null).length, 0);

  var switchedOff = { startDate: PG.TODAY, endDate: PG.addDays(PG.TODAY, 10), daysOfWeek: [0, 1, 2, 3, 4, 5, 6], active: false };
  assertEqual('an inactive period never conflicts with anything', PG.overlappingPeriods(plan, switchedOff, null).length, 0);
})();

/* ------------------------------------------------------------------ */
/* Test 7 — Period time states drive the Active/Upcoming/Expired badges. */
/* ------------------------------------------------------------------ */
(function testPeriodStates() {
  var s = PG.getState();
  var plan = PG.ratePlanById(s, 'rp-fam-weekend');
  var byName = {};
  plan.periods.forEach(function (p) { byName[p.name] = PG.periodTimeState(p); });
  assertEqual('a period covering today reads as active', byName['Weekend Premium'], 'active');
  assertEqual('a period entirely in the past reads as expired', byName['Eid Holiday 2026'], 'expired');

  var future = PG.ratePlanById(s, 'rp-std-flex').periods[0];
  assertEqual('a period entirely in the future reads as upcoming', PG.periodTimeState(future), 'upcoming');
})();

/* ------------------------------------------------------------------ */
/* Test 8 — Multi-period stays produce a per-period nightly breakdown.   */
/* (Acceptance scenario 13.)                                            */
/* ------------------------------------------------------------------ */
(function testMultiPeriodBreakdown() {
  var s = PG.getState();
  // Weekend Offer splits the week: Sun–Wed at 165, Thu–Sat at 195.
  var start = PG.dateRange(PG.addDays(PG.TODAY, 7), PG.addDays(PG.TODAY, 21))
    .find(function (d) { return PG.dayOfWeek(d) === 3; }); // start on a Wednesday
  var bd = PG.nightlyBreakdown(s, 'fam', 'rp-fam-weekend', start, PG.addDays(start, 4));
  assertEqual('a stay crossing two periods reports one group per period', bd.groups.length, 2);
  assert('…each group names its pricing period', bd.groups.every(function (g) { return !!g.label; }));
  assertEqual('…and the nightly prices sum to the stay subtotal',
    bd.subtotal, bd.nights.reduce(function (a, n) { return a + n.price; }, 0));

  var single = PG.nightlyBreakdown(s, 'std', 'rp-std-nr', PG.TODAY, PG.addDays(PG.TODAY, 3));
  assertEqual('a stay inside one period reports a single group', single.groups.length, 1);
  assertEqual('…priced at that period’s rate for every night', single.subtotal, 270);
})();

/* ------------------------------------------------------------------ */
/* Test 9 — THE REGRESSION GUARD. Introducing rate plans must not have  */
/* moved any seeded reservation's price, and repricing a plan           */
/* afterwards must not move one either. (Acceptance scenario 14.)       */
/* ------------------------------------------------------------------ */
(function testBookedPriceIsFrozen() {
  var s = PG.getState();

  // Every seeded reservation carries a complete booked-price snapshot.
  var allSnapped = s.reservations.every(function (r) {
    var nights = PG.dateRange(r.checkIn, r.checkOut);
    return r.rooms.every(function (room) {
      return room.nightly && nights.every(function (d) { return room.nightly[d] != null; });
    });
  });
  assert('every seeded reservation item carries a full booked-price snapshot', allSnapped);

  // Known-good totals from before rate plans existed.
  assertEqual('RES-10245 keeps its pre-rate-plan room subtotal', PG.reservationRoomCharges(s, s.reservations.find(function (r) { return r.id === 'RES-10245'; })), 1170);
  assertEqual('RES-10246 keeps its pre-rate-plan room subtotal', PG.reservationRoomCharges(s, s.reservations.find(function (r) { return r.id === 'RES-10246'; })), 260);
  assertEqual('RES-10247 keeps its pre-rate-plan room subtotal', PG.reservationRoomCharges(s, s.reservations.find(function (r) { return r.id === 'RES-10247'; })), 150);
  assertEqual('RES-10248 keeps its pre-rate-plan room subtotal', PG.reservationRoomCharges(s, s.reservations.find(function (r) { return r.id === 'RES-10248'; })), 200);

  // Now aggressively reprice every plan those reservations are booked on, the way
  // an operator editing a pricing period would, and confirm nothing on the books moves.
  var before = {};
  s.reservations.forEach(function (r) { before[r.id] = PG.reservationTotal(s, r); });

  s.ratePlans.forEach(function (p) {
    p.periods = [{
      id: 'pp-test-blanket', name: 'Test Reprice', startDate: PG.addDays(PG.TODAY, -400), endDate: PG.addDays(PG.TODAY, 400),
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6], mode: 'same', prices: { same: 999 }, active: true
    }];
  });
  s.rates = {}; // and blow away the base calendar too, for good measure

  var stillFrozen = s.reservations.every(function (r) { return PG.reservationTotal(s, r) === before[r.id]; });
  assert('repricing every rate plan to $999 does not move any existing reservation total', stillFrozen);

  // A NEW reservation on the same plan does pick up the new price — the snapshot
  // protects what is booked, it does not freeze the plan itself.
  var fresh = PG.resolvePrice(s, 'std', 'rp-std-flex', PG.TODAY);
  assertEqual('…while a fresh price lookup does reflect the new rate', fresh.price, 999);
})();

/* ------------------------------------------------------------------ */
/* Test 10 — snapshotRoomItemPricing is what moves a booked price, and  */
/* only when called explicitly (the reservation Edit flow).             */
/* ------------------------------------------------------------------ */
(function testExplicitResnapshot() {
  var s = PG.getState();
  var res = s.reservations.find(function (r) { return r.id === 'RES-10246'; });
  var room = res.rooms[0];
  var originalTotal = PG.reservationRoomCharges(s, res);

  var plan = PG.ratePlanById(s, room.ratePlanId);
  plan.periods = [{
    id: 'pp-test-2', name: 'Test Season', startDate: PG.addDays(PG.TODAY, -400), endDate: PG.addDays(PG.TODAY, 400),
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6], mode: 'same', prices: { same: 500 }, active: true
  }];
  assertEqual('the booked price still holds after the plan is repriced', PG.reservationRoomCharges(s, res), originalTotal);

  PG.snapshotRoomItemPricing(s, room, res.checkIn, res.checkOut);
  var nights = PG.dateRange(res.checkIn, res.checkOut).length;
  assertEqual('an explicit re-snapshot is what adopts the new price', PG.reservationRoomCharges(s, res), 500 * nights);
})();

/* ------------------------------------------------------------------ */
/* Test 11 — periodAffectedDates powers "this change affects N nights".  */
/* ------------------------------------------------------------------ */
(function testAffectedDates() {
  var weekOnly = { startDate: '2026-09-01', endDate: '2026-09-14', daysOfWeek: [0, 1, 2, 3, 4, 5, 6] };
  assertEqual('an all-days fortnight affects 14 nights', PG.periodAffectedDates(weekOnly).length, 14);

  var thuFriOnly = { startDate: '2026-09-01', endDate: '2026-09-14', daysOfWeek: [4, 5] };
  assertEqual('a Thu/Fri-only fortnight affects 4 nights', PG.periodAffectedDates(thuFriOnly).length, 4);

  var backwards = { startDate: '2026-09-14', endDate: '2026-09-01', daysOfWeek: [0, 1, 2, 3, 4, 5, 6] };
  assertEqual('an inverted date range affects nothing rather than looping', PG.periodAffectedDates(backwards).length, 0);
})();

/* ------------------------------------------------------------------ */
console.log('\n' + passed + ' passed, ' + failed + ' failed.');
if (failed) { process.exit(1); }
