/* Simulated unit tests for the room-assignment recommendation engine in assets/js/app.js.
   No test framework / build step, matching the rest of this prototype — plain Node + a
   tiny assert helper, runnable with:

     node tests/room-assignment.test.js

   app.js is a browser IIFE that attaches PG to `window` and talks to a bare `localStorage`
   global, so it's loaded into a vm sandbox that stubs both rather than required as a
   CommonJS module. */

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

var passed = 0, failed = 0, failures = [];
function assert(name, cond) {
  if (cond) { passed++; }
  else { failed++; failures.push(name); console.log('FAIL: ' + name); }
}
function assertEqual(name, actual, expected) {
  var ok = JSON.stringify(actual) === JSON.stringify(expected);
  assert(name + ' (got ' + JSON.stringify(actual) + ', expected ' + JSON.stringify(expected) + ')', ok);
}
function assertArraysSameSet(name, actual, expected) {
  var a = actual.slice().sort(), e = expected.slice().sort();
  assertEqual(name, a, e);
}

var PG = loadPG();

/* ------------------------------------------------------------------ */
/* Test 1 — Overlapping dates: a room already assigned for overlapping */
/* dates is not eligible, and never appears in an auto-assignment.      */
/* ------------------------------------------------------------------ */
(function testOverlappingDates() {
  var state = PG.getState();
  // Seed data: dlx-301 and dlx-302 are Assigned to RES-10245 for 2026-08-20 .. 2026-08-23.
  var dlx301 = state.physicalRooms.find(function (r) { return r.id === 'dlx-301'; });
  assert('overlap: dlx-301 ineligible for a stay overlapping its existing assignment',
    PG.roomEligibleForStay(state, dlx301, '2026-08-21', '2026-08-24') === false);
  assert('overlap: dlx-301 ineligible for a stay fully inside its existing assignment',
    PG.roomEligibleForStay(state, dlx301, '2026-08-21', '2026-08-22') === false);

  var result = PG.autoAssignRoomsForItem(state, {
    roomTypeId: 'dlx', checkIn: '2026-08-21', checkOut: '2026-08-24', qty: 1,
    requireAccessibility: [], bedConfiguration: null, requireConnecting: false, keepRoomIds: [], excludeRoomIds: []
  });
  assert('overlap: auto-assignment never picks a room with an overlapping assignment',
    result.assignedRoomIds.indexOf('dlx-301') === -1 && result.assignedRoomIds.indexOf('dlx-302') === -1);
  assert('overlap: auto-assignment still succeeds using a different eligible room', result.shortfall === 0 && result.assignedRoomIds.length === 1);
})();

/* ------------------------------------------------------------------ */
/* Test 2 — Adjacent dates: a room is eligible the moment its prior     */
/* assignment's exclusive checkout date arrives (no off-by-one), and    */
/* ranking prefers a room with no adjacent-day conflict over one that   */
/* has one, ahead of the room-number tie-breaker.                       */
/* ------------------------------------------------------------------ */
(function testAdjacentDates() {
  var state = PG.getState();
  var dlx301 = state.physicalRooms.find(function (r) { return r.id === 'dlx-301'; });
  // dlx-301's existing assignment is 2026-08-20 .. 2026-08-23 (exclusive). A new stay
  // starting exactly on the old checkout date must be allowed — no phantom overlap.
  assert('adjacent: room becomes eligible exactly on its prior assignment\'s checkout date',
    PG.roomEligibleForStay(state, dlx301, '2026-08-23', '2026-08-25') === true);

  var dlx304 = state.physicalRooms.find(function (r) { return r.id === 'dlx-304'; });
  var ranked = PG.rankRoomsForAssignment(state, [dlx301, dlx304], '2026-08-23', '2026-08-25', {});
  // dlx-301 has a booking ending the day before this stay's check-in (adjacent turnover);
  // dlx-304 has no adjacent constraint at all. Despite "301" sorting before "304" on the
  // room-number tie-breaker, adjacency (priority 3) must be evaluated first.
  assertEqual('adjacent: room with no adjacent conflict ranks ahead of the room-number tie-breaker', ranked[0].id, 'dlx-304');
})();

/* ------------------------------------------------------------------ */
/* Test 3 — Blocked rooms: Out of Order / Out of Service / Management   */
/* Hold disqualify a room; an "Other" block does not (explicit MVP      */
/* carve-out).                                                          */
/* ------------------------------------------------------------------ */
(function testBlockedRooms() {
  var state = PG.getState();
  var target = state.physicalRooms.find(function (r) { return r.id === 'fam-403'; }); // otherwise-free seeded room
  state.roomBlocks.push({ id: 'test-blk-1', propertyId: state.hotel.propertyCode, physicalRoomId: 'fam-403', startDate: '2026-09-01', endDate: '2026-09-05', type: 'Management Hold', reason: 'test', notes: '', createdAt: PG.nowIso(), createdBy: 'test' });
  assert('blocked: Management Hold disqualifies a room for overlapping dates',
    PG.roomEligibleForStay(state, target, '2026-09-02', '2026-09-03') === false);
  assertEqual('blocked: ineligibility reason for a Management Hold reads "Held" (never the free-text reason/notes)',
    PG.roomIneligibilityReason(state, target, '2026-09-02', '2026-09-03', {}), 'Held');

  var target2 = state.physicalRooms.find(function (r) { return r.id === 'fam-404'; });
  state.roomBlocks.push({ id: 'test-blk-2', propertyId: state.hotel.propertyCode, physicalRoomId: 'fam-404', startDate: '2026-09-01', endDate: '2026-09-05', type: 'Other', reason: 'test', notes: '', createdAt: PG.nowIso(), createdBy: 'test' });
  assert('blocked: an "Other" block does not disqualify a room (explicit MVP carve-out)',
    PG.roomEligibleForStay(state, target2, '2026-09-02', '2026-09-03') === true);

  // Out of Order / Out of Service already exist in the seed data (std-204, dlx-306).
  var std204 = state.physicalRooms.find(function (r) { return r.id === 'std-204'; });
  assert('blocked: seeded Out of Order room is ineligible on a date inside its block window',
    PG.roomEligibleForStay(state, std204, PG.TODAY, PG.addDays(PG.TODAY, 1)) === false);
})();

/* ------------------------------------------------------------------ */
/* Test 4 — Multi-room uniqueness: qty > 1 never assigns the same       */
/* physical room twice, and honors excludeRoomIds from sibling items.   */
/* ------------------------------------------------------------------ */
(function testMultiRoomUniqueness() {
  var state = PG.getState();
  var result = PG.autoAssignRoomsForItem(state, {
    roomTypeId: 'dlx', checkIn: '2026-09-10', checkOut: '2026-09-12', qty: 3,
    requireAccessibility: [], bedConfiguration: null, requireConnecting: false, keepRoomIds: [], excludeRoomIds: []
  });
  assertEqual('multi-room: assigns exactly the requested quantity when enough rooms exist', result.assignedRoomIds.length, 3);
  var unique = PG.eligiblePhysicalRoomsForStay(state, 'dlx', '2026-09-10', '2026-09-12', {});
  assert('multi-room: no duplicate room ids in a single assignment', new Set(result.assignedRoomIds).size === result.assignedRoomIds.length);

  var second = PG.autoAssignRoomsForItem(state, {
    roomTypeId: 'dlx', checkIn: '2026-09-10', checkOut: '2026-09-12', qty: 1,
    requireAccessibility: [], bedConfiguration: null, requireConnecting: false, keepRoomIds: [], excludeRoomIds: result.assignedRoomIds
  });
  assert('multi-room: excludeRoomIds keeps a sibling item from reusing an already-assigned room',
    result.assignedRoomIds.indexOf(second.assignedRoomIds[0]) === -1);
})();

/* ------------------------------------------------------------------ */
/* Test 5 — Retained assignment after edit: priority 1 keeps an already */
/* assigned room across a date/detail change when it remains eligible,  */
/* even if a "better" ranked room exists.                               */
/* ------------------------------------------------------------------ */
(function testRetainedAssignment() {
  var state = PG.getState();
  var first = PG.autoAssignRoomsForItem(state, {
    roomTypeId: 'std', checkIn: '2026-09-15', checkOut: '2026-09-17', qty: 1,
    requireAccessibility: [], bedConfiguration: null, requireConnecting: false, keepRoomIds: [], excludeRoomIds: []
  });
  var keptId = first.assignedRoomIds[0];
  // Widen the stay by a night — the same room must still come back, not a re-ranked pick.
  var second = PG.autoAssignRoomsForItem(state, {
    roomTypeId: 'std', checkIn: '2026-09-15', checkOut: '2026-09-18', qty: 1,
    requireAccessibility: [], bedConfiguration: null, requireConnecting: false, keepRoomIds: [keptId], excludeRoomIds: []
  });
  assertEqual('retained: previously assigned room is kept across a date change when still eligible', second.assignedRoomIds[0], keptId);

  // Now block that exact room for part of the new range — it must no longer be retained.
  state.roomBlocks.push({ id: 'test-blk-3', propertyId: state.hotel.propertyCode, physicalRoomId: keptId, startDate: '2026-09-16', endDate: '2026-09-19', type: 'Out of Order', reason: 'test', notes: '', createdAt: PG.nowIso(), createdBy: 'test' });
  var third = PG.autoAssignRoomsForItem(state, {
    roomTypeId: 'std', checkIn: '2026-09-15', checkOut: '2026-09-18', qty: 1,
    requireAccessibility: [], bedConfiguration: null, requireConnecting: false, keepRoomIds: [keptId], excludeRoomIds: []
  });
  assert('retained: a kept room that becomes ineligible is dropped, not force-kept', third.assignedRoomIds.indexOf(keptId) === -1);
  assertEqual('retained: a replacement is still found automatically when the kept room drops out', third.shortfall, 0);
})();

/* ------------------------------------------------------------------ */
/* Test 6 — No-availability: when demand exceeds eligible physical      */
/* rooms, the engine reports a shortfall instead of overbooking.        */
/* ------------------------------------------------------------------ */
(function testNoAvailability() {
  var state = PG.getState();
  // Family Room has exactly 4 physical rooms in the seed data.
  var result = PG.autoAssignRoomsForItem(state, {
    roomTypeId: 'fam', checkIn: '2026-10-01', checkOut: '2026-10-03', qty: 5,
    requireAccessibility: [], bedConfiguration: null, requireConnecting: false, keepRoomIds: [], excludeRoomIds: []
  });
  assert('no-availability: never assigns more rooms than physically exist', result.assignedRoomIds.length <= 4);
  assert('no-availability: reports a positive shortfall instead of overbooking', result.shortfall === 5 - result.assignedRoomIds.length && result.shortfall > 0);

  var capacity = PG.validateRoomAssignmentCapacity(state, 'fam', '2026-10-01', '2026-10-03', 5);
  assert('no-availability: validateRoomAssignmentCapacity agrees the request cannot be satisfied', capacity.ok === false);
})();

/* ------------------------------------------------------------------ */
console.log('\n' + passed + ' passed, ' + failed + ' failed.');
if (failed) { process.exit(1); }
