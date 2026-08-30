/* Palestine Grand Hotel — Hotel Reservation and Basic Room Operations Platform Prototype
   Shared shell, seed data, and state engine. No backend — localStorage simulates persistence. */

(function (global) {
  "use strict";

  var STORAGE_KEY = "pg_hotel_admin_state_v1";
  var TODAY = "2026-08-23"; // fixed "today" for reproducible demo data

  var REF = {
    countries: ["Palestine", "Jordan", "Egypt", "Lebanon", "United Arab Emirates", "Saudi Arabia", "United States", "United Kingdom"],
    citiesByCountry: {
      "Palestine": ["Bethlehem", "Ramallah", "Jerusalem", "Nablus", "Hebron", "Gaza"],
      "Jordan": ["Amman", "Petra", "Aqaba"],
      "Egypt": ["Cairo", "Alexandria", "Sharm El Sheikh"],
      "Lebanon": ["Beirut"],
      "United Arab Emirates": ["Dubai", "Abu Dhabi"],
      "Saudi Arabia": ["Riyadh", "Jeddah", "Mecca"],
      "United States": ["New York", "Los Angeles"],
      "United Kingdom": ["London", "Manchester"]
    },
    currencies: ["USD", "EUR", "JOD", "GBP", "AED", "SAR", "EGP"],
    timezones: ["GMT+2 (Asia/Hebron)", "GMT+3 (Asia/Amman)", "GMT+1 (Europe/London)", "GMT+0 (UTC)", "GMT+4 (Asia/Dubai)"],
    phoneCodes: ["+970", "+962", "+20", "+961", "+971", "+966", "+1", "+44"]
  };

  /* ---------------------------------------------------------------- */
  /* Date helpers                                                      */
  /* ---------------------------------------------------------------- */
  // All date math is done in UTC via Date.UTC so it is immune to the host's local timezone —
  // parsing "YYYY-MM-DDT00:00:00" as local time can silently roll the date backward/forward
  // depending on the runtime's UTC offset, which previously caused dateRange() to loop forever.
  function toUtcDate(dateStr) {
    var p = dateStr.split("-").map(Number);
    return new Date(Date.UTC(p[0], p[1] - 1, p[2]));
  }
  function addDays(dateStr, n) {
    var d = toUtcDate(dateStr);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }
  function fmtDate(dateStr, opts) {
    var d = toUtcDate(dateStr);
    var o = Object.assign({ timeZone: "UTC" }, opts || { month: "short", day: "numeric", year: "numeric" });
    return d.toLocaleDateString("en-US", o);
  }
  function fmtDateShort(dateStr) {
    return fmtDate(dateStr, { month: "short", day: "numeric" });
  }
  function weekdayOf(dateStr, opts) {
    var d = toUtcDate(dateStr);
    return d.toLocaleDateString("en-US", Object.assign({ timeZone: "UTC" }, opts || { weekday: "short" }));
  }
  function dayOfWeek(dateStr) {
    return toUtcDate(dateStr).getUTCDay();
  }
  function nightsBetween(a, b) {
    return Math.round((toUtcDate(b) - toUtcDate(a)) / 86400000);
  }
  function dateRange(startStr, endStrExclusive) {
    var out = [];
    var cur = startStr;
    while (cur < endStrExclusive) {
      out.push(cur);
      cur = addDays(cur, 1);
    }
    return out;
  }
  function nowIso() {
    return TODAY + "T" + new Date().toTimeString().slice(0, 5);
  }
  function fmtMoney(n) {
    return "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  /* ---------------------------------------------------------------- */
  /* Seed data                                                         */
  /* ---------------------------------------------------------------- */
  function buildSeed() {
    var roomTypes = [
      { id: "std", name: "Standard Room", code: "STD", sellable: 10, baseCapacity: 10, maxAdults: 2, maxChildren: 0, bed: "1 Queen Bed", baseRate: 100, active: true, desc: "Comfortable entry-level room with modern amenities, ideal for solo travelers and couples." },
      { id: "dlx", name: "Deluxe Room", code: "DLX", sellable: 6, baseCapacity: 6, maxAdults: 2, maxChildren: 1, bed: "1 King Bed", baseRate: 120, active: true, desc: "Spacious upgraded room with premium furnishings and city views." },
      { id: "fam", name: "Family Room", code: "FAM", sellable: 4, baseCapacity: 4, maxAdults: 2, maxChildren: 2, bed: "1 Queen + 2 Single Beds", baseRate: 150, active: true, desc: "Generous layout designed for families, with separate sleeping areas." }
    ];

    var rates = {};
    roomTypes.forEach(function (rt) {
      rates[rt.id] = {};
      dateRange(addDays(TODAY, -2), addDays(TODAY, 30)).forEach(function (d, i) {
        var dow = toUtcDate(d).getUTCDay();
        var weekend = dow === 4 || dow === 5; // Thu/Fri weekend markup (regional)
        rates[rt.id][d] = rt.baseRate + (weekend ? 20 : 0);
      });
    });
    // Fixed nightly rate for Sara Ali's RES-10246 scenario so 2 nights totals exactly $260.
    rates.std["2026-08-22"] = 130;
    rates.std["2026-08-23"] = 130;
    // Fixed nightly rates for Ahmad Khalil's RES-10245 scenario (Deluxe $720, Family $450 over 3 nights).
    ["2026-08-20","2026-08-21","2026-08-22"].forEach(function(d){ rates.dlx[d] = 120; rates.fam[d] = 150; });

    // Guests are hotel customers — kept conceptually and technically separate from
    // state.users (hotel/platform staff accounts, managed on users.html). Never merge
    // these two collections or reuse this shape for a staff account.
    var customers = [
      { id: "cus-1", name: "Ahmad Khalil", phone: "+970 59 123 4567", email: "ahmad.khalil@example.com", nationality: "Palestinian",
        preferredLanguage: "Arabic", idRef: "PSE-778812345", communicationPreference: "WhatsApp", consentMarketing: true,
        roomPreferences: "", accessibilityNeeds: "", important: false, notes: "" },
      { id: "cus-2", name: "Sara Ali", phone: "+970 56 234 5678", email: "sara.ali@example.com", nationality: "Palestinian",
        preferredLanguage: "Arabic", idRef: "PSE-556690012", communicationPreference: "Phone", consentMarketing: false,
        roomPreferences: "Prefers high floor, away from the elevator.", accessibilityNeeds: "", important: true, notes: "Requested late check-out on a previous stay." },
      { id: "cus-3", name: "Omar Hassan", phone: "+962 79 345 6789", email: "omar.hassan@example.com", nationality: "Jordanian",
        preferredLanguage: "English", idRef: "JOR-223345678", communicationPreference: "Email", consentMarketing: true,
        roomPreferences: "", accessibilityNeeds: "Wheelchair accessible room required.", important: false, notes: "" },
      { id: "cus-4", name: "Layla Nasser", phone: "+970 59 876 5432", email: "layla.nasser@example.com", nationality: "Palestinian",
        preferredLanguage: "Arabic", idRef: "PSE-990011223", communicationPreference: "WhatsApp", consentMarketing: false,
        roomPreferences: "", accessibilityNeeds: "", important: false, notes: "" }
    ];

    var reservations = [
      {
        id: "RES-10245",
        customerId: "cus-1",
        source: "Phone",
        createdAt: TODAY + "T10:15",
        checkIn: "2026-08-20",
        checkOut: "2026-08-23",
        status: "Confirmed",
        paymentStatus: "Paid",
        paymentMethod: "Payment Link",
        rooms: [
          { id: "RES-10245-itm-1", roomTypeId: "dlx", qty: 2, ratePlanName: "Flexible + Breakfast", adults: 2, children: 0 },
          { id: "RES-10245-itm-2", roomTypeId: "fam", qty: 1, ratePlanName: "Flexible + Breakfast", adults: 2, children: 2 }
        ],
        notes: "Guest requested early check-in if possible.",
        taxAmount: 50,
        feeAmount: 20,
        transactionRef: "PAY-2026-45892",
        paymentLinkUrl: "https://pay.example.com/RES-10245",
        paymentLinkGeneratedAt: TODAY + "T10:17",
        paymentPaidAt: TODAY + "T10:24",
        activity: [
          { ts: TODAY + "T10:15", text: "Reservation created via Phone by Hotel Admin." },
          { ts: TODAY + "T10:17", text: "Payment Link generated." },
          { ts: TODAY + "T10:18", text: "Payment Link sent via Email." },
          { ts: TODAY + "T10:24", text: "Payment received — Transaction Ref: PAY-2026-45892." },
          { ts: TODAY + "T10:24", text: "Reservation confirmed." }
        ]
      },
      {
        id: "RES-10246",
        customerId: "cus-2",
        source: "Phone",
        createdAt: TODAY + "T11:40",
        checkIn: "2026-08-22",
        checkOut: "2026-08-24",
        status: "Confirmed",
        paymentStatus: "Pay on Arrival",
        paymentMethod: "Pay on Arrival",
        rooms: [
          { id: "RES-10246-itm-1", roomTypeId: "std", qty: 1, adults: 2, children: 0 }
        ],
        taxAmount: 0,
        feeAmount: 0,
        notes: "Short two-night stay.",
        activity: [
          { ts: TODAY + "T11:40", text: "Reservation created via Phone by Hotel Admin." },
          { ts: TODAY + "T11:41", text: "Payment method set to Pay on Arrival." },
          { ts: TODAY + "T11:41", text: "Reservation confirmed." }
        ]
      },
      {
        id: "RES-10247",
        customerId: "cus-3",
        source: "Travel Agency",
        createdAt: TODAY + "T08:05",
        checkIn: addDays(TODAY, 1),
        checkOut: addDays(TODAY, 2),
        status: "Pending Payment",
        paymentStatus: "Expired",
        paymentMethod: "Payment Link",
        rooms: [{ id: "RES-10247-itm-1", roomTypeId: "fam", qty: 1, adults: 2, children: 1 }],
        taxAmount: 0,
        feeAmount: 0,
        notes: "Booked through Al-Quds Travel Agency.",
        paymentLinkUrl: "https://pay.example.com/RES-10247",
        paymentLinkGeneratedAt: addDays(TODAY, -1) + "T08:07",
        paymentLinkExpiresAt: TODAY + "T08:07",
        activity: [
          { ts: addDays(TODAY, -1) + "T08:05", text: "Reservation created via Travel Agency by Hotel Admin." },
          { ts: addDays(TODAY, -1) + "T08:07", text: "Payment Link generated." },
          { ts: addDays(TODAY, -1) + "T08:08", text: "Payment Link sent via Email." },
          { ts: TODAY + "T08:07", text: "Payment link expired without payment." }
        ]
      },
      {
        id: "RES-10248",
        customerId: "cus-4",
        source: "Phone",
        createdAt: TODAY + "T09:30",
        checkIn: addDays(TODAY, 1),
        checkOut: addDays(TODAY, 3),
        status: "Pending Payment",
        paymentStatus: "Payment Required",
        paymentMethod: "Pay on Arrival",
        rooms: [{ id: "RES-10248-itm-1", roomTypeId: "std", qty: 1, adults: 2, children: 0 }],
        taxAmount: 0,
        feeAmount: 0,
        notes: "",
        activity: [
          { ts: TODAY + "T09:30", text: "Reservation created via Phone by Hotel Admin." },
          { ts: TODAY + "T09:31", text: "Room 103 held for this reservation." }
        ]
      }
    ];

    var PROPERTY_ID = "PGH-001";

    // Physical rooms: the operational allocation layer beneath room-type commercial
    // inventory. Counts are seeded close to (but deliberately not always exactly equal
    // to) each room type's `sellable` figure — a room can be active in the building but
    // temporarily non-sellable (Out of Order/Out of Service/Inactive), which is why the
    // two layers are tracked separately rather than one being computed from the other
    // yet. See README §9.
    var physicalRooms = [
      { id: "std-101", propertyId: PROPERTY_ID, roomTypeId: "std", roomNumber: "101", building: "Main Building", floor: 1, bedConfiguration: "1 Queen Bed", view: "Old City View", accessibilityFeatures: [], connectingRoomIds: [], notes: "", isActive: true, isSellable: true, operationalStatus: "Available" },
      { id: "std-102", propertyId: PROPERTY_ID, roomTypeId: "std", roomNumber: "102", building: "Main Building", floor: 1, bedConfiguration: "1 Queen Bed", view: "Courtyard View", accessibilityFeatures: [], connectingRoomIds: [], notes: "", isActive: true, isSellable: true, operationalStatus: "Available" },
      { id: "std-103", propertyId: PROPERTY_ID, roomTypeId: "std", roomNumber: "103", building: "Main Building", floor: 1, bedConfiguration: "1 Queen Bed", view: "Old City View", accessibilityFeatures: [], connectingRoomIds: ["std-104"], notes: "Connects to Room 104.", isActive: true, isSellable: true, operationalStatus: "Available" },
      { id: "std-104", propertyId: PROPERTY_ID, roomTypeId: "std", roomNumber: "104", building: "Main Building", floor: 1, bedConfiguration: "1 Queen Bed", view: "Old City View", accessibilityFeatures: [], connectingRoomIds: ["std-103"], notes: "Connects to Room 103.", isActive: true, isSellable: true, operationalStatus: "Available" },
      { id: "std-105", propertyId: PROPERTY_ID, roomTypeId: "std", roomNumber: "105", building: "Main Building", floor: 1, bedConfiguration: "2 Single Beds", view: "Courtyard View", accessibilityFeatures: ["Wheelchair Accessible", "Grab Bars"], connectingRoomIds: [], notes: "ADA-compliant accessible room.", isActive: true, isSellable: true, operationalStatus: "Available" },
      { id: "std-201", propertyId: PROPERTY_ID, roomTypeId: "std", roomNumber: "201", building: "Main Building", floor: 2, bedConfiguration: "1 Queen Bed", view: "Garden View", accessibilityFeatures: [], connectingRoomIds: [], notes: "", isActive: true, isSellable: true, operationalStatus: "Available" },
      { id: "std-202", propertyId: PROPERTY_ID, roomTypeId: "std", roomNumber: "202", building: "Main Building", floor: 2, bedConfiguration: "1 Queen Bed", view: "Garden View", accessibilityFeatures: [], connectingRoomIds: [], notes: "Held for a walk-in currently at the desk.", isActive: true, isSellable: true, operationalStatus: "Held" },
      { id: "std-203", propertyId: PROPERTY_ID, roomTypeId: "std", roomNumber: "203", building: "Main Building", floor: 2, bedConfiguration: "1 Queen Bed", view: "Old City View", accessibilityFeatures: [], connectingRoomIds: [], notes: "", isActive: true, isSellable: true, operationalStatus: "Available" },
      { id: "std-204", propertyId: PROPERTY_ID, roomTypeId: "std", roomNumber: "204", building: "Main Building", floor: 2, bedConfiguration: "1 Queen Bed", view: "Old City View", accessibilityFeatures: [], connectingRoomIds: [], notes: "Plumbing leak reported " + addDays(TODAY, -2) + "; maintenance pending.", isActive: true, isSellable: false, operationalStatus: "Out of Order" },
      { id: "std-205", propertyId: PROPERTY_ID, roomTypeId: "std", roomNumber: "205", building: "Main Building", floor: 2, bedConfiguration: "1 Queen Bed", view: "Garden View", accessibilityFeatures: [], connectingRoomIds: [], notes: "Temporarily removed from inventory pending refurbishment.", isActive: false, isSellable: false, operationalStatus: "Inactive" },

      { id: "dlx-301", propertyId: PROPERTY_ID, roomTypeId: "dlx", roomNumber: "301", building: "Main Building", floor: 3, bedConfiguration: "1 King Bed", view: "Old City View", accessibilityFeatures: [], connectingRoomIds: [], notes: "", isActive: true, isSellable: true, operationalStatus: "Available" },
      { id: "dlx-302", propertyId: PROPERTY_ID, roomTypeId: "dlx", roomNumber: "302", building: "Main Building", floor: 3, bedConfiguration: "1 King Bed", view: "Courtyard View", accessibilityFeatures: [], connectingRoomIds: ["dlx-303"], notes: "Connects to Room 303.", isActive: true, isSellable: true, operationalStatus: "Available" },
      { id: "dlx-303", propertyId: PROPERTY_ID, roomTypeId: "dlx", roomNumber: "303", building: "Main Building", floor: 3, bedConfiguration: "1 King Bed", view: "Courtyard View", accessibilityFeatures: [], connectingRoomIds: ["dlx-302"], notes: "Connects to Room 302.", isActive: true, isSellable: true, operationalStatus: "Available" },
      { id: "dlx-304", propertyId: PROPERTY_ID, roomTypeId: "dlx", roomNumber: "304", building: "Main Building", floor: 3, bedConfiguration: "1 King Bed", view: "Garden View", accessibilityFeatures: [], connectingRoomIds: [], notes: "", isActive: true, isSellable: true, operationalStatus: "Available" },
      { id: "dlx-305", propertyId: PROPERTY_ID, roomTypeId: "dlx", roomNumber: "305", building: "Main Building", floor: 3, bedConfiguration: "1 King Bed", view: "Old City View", accessibilityFeatures: [], connectingRoomIds: [], notes: "", isActive: true, isSellable: true, operationalStatus: "Available" },
      { id: "dlx-306", propertyId: PROPERTY_ID, roomTypeId: "dlx", roomNumber: "306", building: "Main Building", floor: 3, bedConfiguration: "1 King Bed", view: "Garden View", accessibilityFeatures: [], connectingRoomIds: [], notes: "Extended out-of-service window — HVAC replacement scheduled.", isActive: true, isSellable: false, operationalStatus: "Out of Service" },

      { id: "fam-401", propertyId: PROPERTY_ID, roomTypeId: "fam", roomNumber: "401", building: "Main Building", floor: 4, bedConfiguration: "1 Queen + 2 Single Beds", view: "Old City View", accessibilityFeatures: [], connectingRoomIds: [], notes: "", isActive: true, isSellable: true, operationalStatus: "Available" },
      { id: "fam-402", propertyId: PROPERTY_ID, roomTypeId: "fam", roomNumber: "402", building: "Main Building", floor: 4, bedConfiguration: "1 Queen + 2 Single Beds", view: "Garden View", accessibilityFeatures: [], connectingRoomIds: [], notes: "", isActive: true, isSellable: true, operationalStatus: "Available" },
      { id: "fam-403", propertyId: PROPERTY_ID, roomTypeId: "fam", roomNumber: "403", building: "Main Building", floor: 4, bedConfiguration: "1 Queen + 2 Single Beds", view: "Courtyard View", accessibilityFeatures: [], connectingRoomIds: [], notes: "", isActive: true, isSellable: true, operationalStatus: "Available" },
      { id: "fam-404", propertyId: PROPERTY_ID, roomTypeId: "fam", roomNumber: "404", building: "Main Building", floor: 4, bedConfiguration: "1 Queen + 2 Single Beds", view: "Old City View", accessibilityFeatures: [], connectingRoomIds: [], notes: "", isActive: true, isSellable: true, operationalStatus: "Available" }
    ];

    // Room assignments connect each reservation's room items to specific physical
    // rooms. A reservation that isn't yet Confirmed/Paid gets a "Held" (tentative)
    // assignment rather than "Assigned" — mirrors the Reservation/Payment status split.
    var roomAssignments = [
      { id: "asn-1", propertyId: PROPERTY_ID, reservationId: "RES-10245", reservationItemId: "RES-10245-itm-1", physicalRoomId: "dlx-301", arrivalDate: "2026-08-20", departureDate: "2026-08-23", assignmentStatus: "Assigned", assignedAt: TODAY + "T10:20", assignedBy: "Hotel Admin", changeReason: "" },
      { id: "asn-2", propertyId: PROPERTY_ID, reservationId: "RES-10245", reservationItemId: "RES-10245-itm-1", physicalRoomId: "dlx-302", arrivalDate: "2026-08-20", departureDate: "2026-08-23", assignmentStatus: "Assigned", assignedAt: TODAY + "T10:20", assignedBy: "Hotel Admin", changeReason: "" },
      { id: "asn-3", propertyId: PROPERTY_ID, reservationId: "RES-10245", reservationItemId: "RES-10245-itm-2", physicalRoomId: "fam-401", arrivalDate: "2026-08-20", departureDate: "2026-08-23", assignmentStatus: "Assigned", assignedAt: TODAY + "T10:20", assignedBy: "Hotel Admin", changeReason: "" },
      { id: "asn-4", propertyId: PROPERTY_ID, reservationId: "RES-10246", reservationItemId: "RES-10246-itm-1", physicalRoomId: "std-101", arrivalDate: "2026-08-22", departureDate: "2026-08-24", assignmentStatus: "Assigned", assignedAt: TODAY + "T11:41", assignedBy: "Hotel Admin", changeReason: "" },
      // holdExpiresAt demonstrates the temporary-hold mechanism (see releaseExpiredHolds):
      // asn-5's expiry mirrors RES-10247's own paymentLinkExpiresAt (already in the past),
      // so it self-heals — its physical room is auto-released the moment any page loads,
      // demonstrating "automatic release after expiry" out of the box. asn-6 is given a
      // same-day-but-later expiry so it demos as a still-active, not-yet-expired hold.
      { id: "asn-5", propertyId: PROPERTY_ID, reservationId: "RES-10247", reservationItemId: "RES-10247-itm-1", physicalRoomId: "fam-402", arrivalDate: addDays(TODAY, 1), departureDate: addDays(TODAY, 2), assignmentStatus: "Held", assignedAt: addDays(TODAY, -1) + "T08:05", assignedBy: "Hotel Admin", changeReason: "Tentative hold pending payment confirmation.", holdExpiresAt: TODAY + "T08:07" },
      { id: "asn-6", propertyId: PROPERTY_ID, reservationId: "RES-10248", reservationItemId: "RES-10248-itm-1", physicalRoomId: "std-103", arrivalDate: addDays(TODAY, 1), departureDate: addDays(TODAY, 3), assignmentStatus: "Held", assignedAt: TODAY + "T09:31", assignedBy: "Hotel Admin", changeReason: "", holdExpiresAt: TODAY + "T23:59" }
    ];

    // Room blocks: operational holds against a physical room independent of any
    // reservation (maintenance, deep cleaning, etc.). blk-3 is a deliberate data
    // conflict — it overlaps asn-5's tentative hold on the same room — left in as a
    // realistic example of the kind of clash a future room-assignment UI must surface.
    var roomBlocks = [
      { id: "blk-1", propertyId: PROPERTY_ID, physicalRoomId: "std-204", startDate: addDays(TODAY, -2), endDate: addDays(TODAY, 3), type: "Out of Order", reason: "Plumbing leak repair", notes: "Awaiting plumber parts.", createdAt: addDays(TODAY, -2) + "T09:00", createdBy: "Hotel Admin" },
      { id: "blk-2", propertyId: PROPERTY_ID, physicalRoomId: "dlx-306", startDate: TODAY, endDate: addDays(TODAY, 45), type: "Out of Service", reason: "HVAC replacement", notes: "Extended out-of-service window.", createdAt: TODAY + "T08:30", createdBy: "Hotel Admin" },
      { id: "blk-3", propertyId: PROPERTY_ID, physicalRoomId: "fam-402", startDate: addDays(TODAY, 1), endDate: addDays(TODAY, 3), type: "Management Hold", reason: "Deep cleaning scheduled", notes: "Conflicts with the tentative hold for RES-10247 on the same room — needs manual resolution.", createdAt: addDays(TODAY, -1) + "T07:50", createdBy: "Hotel Admin" }
    ];

    return {
      seededAt: TODAY,
      hotel: {
        name: "Palestine Grand Hotel",
        legalName: "Palestine Grand Hotel Ltd.",
        propertyCode: "PGH-001",
        currency: "USD",
        city: "Bethlehem",
        country: "Palestine",
        address: "Manger Street 12, Bethlehem, Palestine",
        phoneCode: "+970",
        phone: "2 274 1000",
        email: "reservations@palestinegrand.com",
        checkInTime: "14:00",
        checkOutTime: "12:00",
        timezone: "GMT+2 (Asia/Hebron)",
        starRating: 4,
        status: "Active",
        policySummary: "Free cancellation up to 24 hours before arrival. Standard check-in is 14:00 and check-out is 12:00. Full payment is due at check-in unless the reservation was prepaid via Payment Link."
      },
      roomTypes: roomTypes,
      physicalRooms: physicalRooms,
      roomAssignments: roomAssignments,
      roomBlocks: roomBlocks,
      rates: rates,
      bedConfigs: ["1 Queen Bed", "1 King Bed", "1 Queen + 2 Single Beds", "2 Single Beds", "2 Double Beds"],
      mealPlans: ["Room Only", "Breakfast Included", "Half Board", "Full Board"],
      inventoryOverrides: {}, // key "roomTypeId|date" -> {stopSell:true, reason}
      dateAdjustments: {}, // key "roomTypeId|date" -> cumulative sellable-quantity delta for that date
      adjustments: [], // manual sellable-quantity adjustments
      customers: customers,
      reservations: reservations,
      nextResId: 10249,
      ratePlans: [
        { id: "rp1", name: "Flexible Room Only", roomTypeId: "std", mealPlan: "Room Only", startDate: TODAY, endDate: addDays(TODAY, 90), price: 100, currency: "USD", active: true },
        { id: "rp2", name: "Flexible + Breakfast", roomTypeId: "dlx", mealPlan: "Breakfast Included", startDate: TODAY, endDate: addDays(TODAY, 90), price: 120, currency: "USD", active: true },
        { id: "rp3", name: "Weekend Rate", roomTypeId: "fam", mealPlan: "Breakfast Included", startDate: TODAY, endDate: addDays(TODAY, 90), price: 150, currency: "USD", active: true }
      ],
      // Real, configurable tax/fee engine (see computePricing) — replaces what used to be
      // a hardcoded 4% tax + $20 fee scattered across new-reservation.html and
      // reservation-detail.html. Seeded so the hotel-default-applied set (VAT + City
      // Tourism Fee) reproduces that exact prior total, keeping existing seeded
      // reservations' stored pricing snapshots numerically consistent with a fresh
      // calculation. Municipality Tax and Service Charge are configured-but-inactive
      // samples demonstrating a percentage tax and a percentage fee that aren't applied
      // by default. `effectiveFrom`/`effectiveTo` (nullable) gate a charge to a date range.
      taxesFees: [
        { id: "tf-vat", name: "VAT", kind: "Tax", calcType: "Percentage", value: 4, appliesByDefault: true, active: true, effectiveFrom: null, effectiveTo: null },
        { id: "tf-muni", name: "Municipality Tax", kind: "Tax", calcType: "Percentage", value: 2, appliesByDefault: false, active: false, effectiveFrom: null, effectiveTo: null },
        { id: "tf-service", name: "Service Charge", kind: "Fee", calcType: "Percentage", value: 5, appliesByDefault: false, active: false, effectiveFrom: null, effectiveTo: null },
        { id: "tf-tourism", name: "City Tourism Fee", kind: "Fee", calcType: "Fixed", value: 20, appliesByDefault: true, active: true, effectiveFrom: null, effectiveTo: null }
      ],
      audit: [
        { ts: TODAY + "T08:05", actor: "Hotel Admin", action: "Reservation Created", details: "RES-10247 created via Travel Agency." },
        { ts: TODAY + "T08:07", actor: "Hotel Admin", action: "Payment Link Sent", details: "Payment link sent for RES-10247." },
        { ts: TODAY + "T09:14", actor: "Hotel Admin", action: "Reservation Created", details: "RES-10245 created via Phone." },
        { ts: TODAY + "T11:40", actor: "Hotel Admin", action: "Reservation Created", details: "RES-10246 created via WhatsApp." },
        { ts: TODAY + "T09:30", actor: "Hotel Admin", action: "Reservation Created", details: "RES-10248 created via Phone. Room 103 held." }
      ]
    };
  }

  /* ---------------------------------------------------------------- */
  /* State persistence                                                  */
  /* ---------------------------------------------------------------- */
  function getState() {
    var raw = localStorage.getItem(STORAGE_KEY);
    var state, dirty;
    if (!raw) {
      state = buildSeed();
      dirty = true;
    } else {
      try {
        state = JSON.parse(raw);
        // Migration: browsers with state saved before a field was introduced (e.g.
        // bedConfigs, mealPlans, dateAdjustments) would otherwise crash every page
        // that reads it. Backfill any missing top-level keys from a fresh seed
        // without touching the user's existing reservations/edits.
        var fresh = buildSeed();
        dirty = false;
        Object.keys(fresh).forEach(function (k) {
          if (!(k in state)) { state[k] = fresh[k]; dirty = true; }
        });
      } catch (e) {
        state = buildSeed();
        dirty = true;
      }
    }
    // Temporary-hold expiry check runs on every read (see releaseExpiredHolds) — the
    // simplest realistic simulation of "automatic release" available to a backend-less,
    // localStorage-only prototype: no reservation ever holds a physical room past its
    // holdExpiresAt for longer than the time until the next page load/read.
    if (releaseExpiredHolds(state)) dirty = true;
    if (dirty) localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return state;
  }
  function setState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
  function resetState() {
    localStorage.removeItem(STORAGE_KEY);
    return getState();
  }
  function addAudit(action, details, actor) {
    var s = getState();
    s.audit.unshift({ ts: nowIso(), actor: actor || "Hotel Admin", action: action, details: details });
    setState(s);
  }

  /* ---------------------------------------------------------------- */
  /* Temporary holds — a Held roomAssignment (Draft/Pending Payment           */
  /* reservation) carries its own holdExpiresAt. Releasing it on expiry is    */
  /* the physical-layer half of "automatic release after expiry"; nothing     */
  /* else about the reservation record changes, so history is preserved.     */
  /* ---------------------------------------------------------------- */
  var HOLD_MINUTES = 30;
  function holdExpiryFromNow() {
    var d = new Date(nowIso() + ":00Z");
    d.setUTCMinutes(d.getUTCMinutes() + HOLD_MINUTES);
    return d.toISOString().slice(0, 16);
  }
  // Cancels any Held assignment whose holdExpiresAt has passed, restoring its room to
  // availability. Guarded by the same assignmentStatus!=='Cancelled'-style idempotency
  // every other release path in this codebase uses (see reservation-detail.html's
  // cancellation handler) — re-running this against the same state a second time finds
  // nothing left to release, so availability is never double-restored. Returns whether
  // anything changed, so callers only persist when there's an actual change to save.
  function releaseExpiredHolds(state) {
    var now = nowIso();
    var changed = false;
    (state.roomAssignments || []).forEach(function (a) {
      if (a.assignmentStatus !== "Held" || !a.holdExpiresAt || a.holdExpiresAt > now) return;
      a.assignmentStatus = "Cancelled";
      changed = true;
      var res = (state.reservations || []).find(function (r) { return r.id === a.reservationId; });
      if (res) {
        var pr = (state.physicalRooms || []).find(function (p) { return p.id === a.physicalRoomId; });
        res.activity.push({ ts: now, text: "Temporary hold on Room " + (pr ? pr.roomNumber : a.physicalRoomId) + " expired and was automatically released." });
      }
    });
    return changed;
  }

  /* ---------------------------------------------------------------- */
  /* Availability engine                                                */
  /* ---------------------------------------------------------------- */
  function isStopSell(state, roomTypeId, dateStr) {
    var o = state.inventoryOverrides[roomTypeId + "|" + dateStr];
    return !!(o && o.stopSell);
  }
  function bookedCount(state, roomTypeId, dateStr) {
    var n = 0;
    state.reservations.forEach(function (r) {
      if (r.status === "Cancelled") return;
      if (dateStr < r.checkIn || dateStr >= r.checkOut) return;
      r.rooms.forEach(function (room) {
        if (room.roomTypeId === roomTypeId) n += room.qty;
      });
    });
    return n;
  }
  function dateAdjustmentFor(state, roomTypeId, dateStr) {
    return (state.dateAdjustments && state.dateAdjustments[roomTypeId + "|" + dateStr]) || 0;
  }
  function computeAvailability(state, roomTypeId, dateStr) {
    var rt = state.roomTypes.find(function (r) { return r.id === roomTypeId; });
    var sellable = rt.sellable + dateAdjustmentFor(state, roomTypeId, dateStr);
    var booked = bookedCount(state, roomTypeId, dateStr);
    var stop = isStopSell(state, roomTypeId, dateStr);
    var available = stop ? 0 : Math.max(0, sellable - booked);
    return { sellable: sellable, booked: booked, available: available, stopSell: stop };
  }
  // Checks whether qty rooms of roomTypeId are available for every night in [checkIn, checkOut)
  function validateAvailability(state, roomTypeId, checkIn, checkOut, qty) {
    var nights = dateRange(checkIn, checkOut);
    var problems = [];
    nights.forEach(function (d) {
      var a = computeAvailability(state, roomTypeId, d);
      if (a.available < qty) {
        problems.push({ date: d, available: a.available, stopSell: a.stopSell });
      }
    });
    return { ok: problems.length === 0, problems: problems, nights: nights };
  }
  function rateFor(state, roomTypeId, dateStr) {
    var table = state.rates[roomTypeId] || {};
    if (table[dateStr] != null) return table[dateStr];
    var rt = state.roomTypes.find(function (r) { return r.id === roomTypeId; });
    return rt ? rt.baseRate : 0;
  }

  /* ---------------------------------------------------------------- */
  /* Taxes & Fees engine — the single source of truth for tax/fee amounts,    */
  /* replacing what used to be a hardcoded 4% tax + $20 fee duplicated across */
  /* new-reservation.html and reservation-detail.html. See state.taxesFees.  */
  /* ---------------------------------------------------------------- */
  function taxFeeIsEffective(tf, dateStr) {
    if (tf.effectiveFrom && dateStr < tf.effectiveFrom) return false;
    if (tf.effectiveTo && dateStr > tf.effectiveTo) return false;
    return true;
  }
  // roomCharges: pre-tax room subtotal for the whole stay. refDate: the date effective-date
  // windows are checked against — callers pass the reservation's checkIn date. Only charges
  // that are both `active` and `appliesByDefault` (this MVP has no per-reservation override —
  // every reservation gets the hotel's default charge set) are included.
  function computePricing(state, roomCharges, refDate) {
    var date = refDate || TODAY;
    var breakdown = [];
    var taxAmount = 0, feeAmount = 0;
    (state.taxesFees || []).forEach(function (tf) {
      if (!tf.active || !tf.appliesByDefault) return;
      if (!taxFeeIsEffective(tf, date)) return;
      var amount = tf.calcType === "Percentage" ? Math.round(roomCharges * (tf.value / 100) * 100) / 100 : tf.value;
      if (tf.kind === "Tax") taxAmount += amount; else feeAmount += amount;
      breakdown.push({ id: tf.id, name: tf.name, kind: tf.kind, calcType: tf.calcType, value: tf.value, amount: amount });
    });
    taxAmount = Math.round(taxAmount * 100) / 100;
    feeAmount = Math.round(feeAmount * 100) / 100;
    return { taxAmount: taxAmount, feeAmount: feeAmount, total: roomCharges + taxAmount + feeAmount, breakdown: breakdown };
  }

  /* ---------------------------------------------------------------- */
  /* Physical rooms — the operational allocation layer beneath room-type      */
  /* commercial inventory. Room-type `sellable` remains the authoritative     */
  /* commercial availability figure for now (see README §9); these helpers    */
  /* let a future assignment UI check physical-room eligibility without      */
  /* allowing more assignments than physically exist for a date.             */
  /* ---------------------------------------------------------------- */
  function physicalRoomsForType(state, roomTypeId) {
    return (state.physicalRooms || []).filter(function (pr) { return pr.roomTypeId === roomTypeId; });
  }
  function physicalRoomBlockOn(state, physicalRoomId, dateStr) {
    return (state.roomBlocks || []).find(function (b) {
      return b.physicalRoomId === physicalRoomId && dateStr >= b.startDate && dateStr < b.endDate;
    }) || null;
  }
  function isPhysicalRoomBlocked(state, physicalRoomId, dateStr) {
    return !!physicalRoomBlockOn(state, physicalRoomId, dateStr);
  }
  function isPhysicalRoomAssigned(state, physicalRoomId, dateStr, excludeAssignmentId) {
    return (state.roomAssignments || []).some(function (a) {
      if (a.id === excludeAssignmentId) return false;
      if (a.assignmentStatus === "Cancelled") return false;
      return a.physicalRoomId === physicalRoomId && dateStr >= a.arrivalDate && dateStr < a.departureDate;
    });
  }
  function assignmentsForRoom(state, physicalRoomId) {
    return (state.roomAssignments || []).filter(function (a) { return a.physicalRoomId === physicalRoomId && a.assignmentStatus !== "Cancelled"; });
  }
  // Any non-Cancelled assignment on this room whose stay overlaps [start, endExclusive) —
  // used by the Block Room flow to detect a block/reservation conflict before saving.
  function assignmentsOverlapping(state, physicalRoomId, start, endExclusive) {
    return assignmentsForRoom(state, physicalRoomId).filter(function (a) {
      return a.arrivalDate < endExclusive && a.departureDate > start;
    });
  }
  function currentOrNextAssignment(state, physicalRoomId, todayStr) {
    var today = todayStr || TODAY;
    var list = assignmentsForRoom(state, physicalRoomId).slice().sort(function (a, b) { return a.arrivalDate < b.arrivalDate ? -1 : 1; });
    var current = list.find(function (a) { return a.arrivalDate <= today && a.departureDate > today; });
    if (current) return { assignment: current, when: "current" };
    var next = list.find(function (a) { return a.arrivalDate > today; });
    return next ? { assignment: next, when: "next" } : null;
  }
  function upcomingAssignmentsForRoom(state, physicalRoomId, todayStr) {
    var today = todayStr || TODAY;
    return assignmentsForRoom(state, physicalRoomId).filter(function (a) { return a.departureDate > today; })
      .sort(function (a, b) { return a.arrivalDate < b.arrivalDate ? -1 : 1; });
  }
  // Block type determines the derived status while a block is active — Out of Order /
  // Out of Service map straight through; Management Hold and Other read as "Held".
  var BLOCK_TYPE_STATUS = { "Out of Order": "Out of Order", "Out of Service": "Out of Service", "Management Hold": "Held", "Other": "Held" };
  // The status a room shows on a given date. "Reserved" is always derived from a live
  // assignment, never stored — per product rule, housekeeping states (Clean/Dirty/etc.)
  // are intentionally out of MVP scope.
  function roomStatusOn(state, physicalRoomId, dateStr) {
    var room = (state.physicalRooms || []).find(function (pr) { return pr.id === physicalRoomId; });
    if (!room) return null;
    if (!room.isActive) return "Inactive";
    if (isPhysicalRoomAssigned(state, physicalRoomId, dateStr)) return "Reserved";
    var blk = physicalRoomBlockOn(state, physicalRoomId, dateStr);
    if (blk) return BLOCK_TYPE_STATUS[blk.type] || "Out of Order";
    return room.operationalStatus || "Available";
  }
  function eligiblePhysicalRooms(state, roomTypeId, dateStr) {
    return physicalRoomsForType(state, roomTypeId).filter(function (pr) {
      return pr.isActive && pr.isSellable && !isPhysicalRoomBlocked(state, pr.id, dateStr) && !isPhysicalRoomAssigned(state, pr.id, dateStr);
    });
  }
  function eligiblePhysicalRoomCount(state, roomTypeId, dateStr) {
    return eligiblePhysicalRooms(state, roomTypeId, dateStr).length;
  }
  // Active + sellable physical rooms of this type, independent of any date (blocks and
  // assignments are date-specific and excluded here) — the physical-layer capacity ceiling
  // that a manual sellable-inventory increase is not allowed to exceed (see
  // availability-inventory.html's Adjust Inventory save handler).
  function activeSellablePhysicalCount(state, roomTypeId) {
    return physicalRoomsForType(state, roomTypeId).filter(function (pr) { return pr.isActive && pr.isSellable; }).length;
  }
  // A fuller, admin-facing accounting of why a room type's availability on one date is what
  // it is — every input computeAvailability() folds into a single number, laid out
  // separately: physical-layer capacity/blocks cross-referenced against the commercial
  // layer's confirmed/held commitments, manual adjustment, and Stop Sell. Additive only —
  // does not change computeAvailability()'s own formula or any caller of it.
  function availabilityBreakdown(state, roomTypeId, dateStr) {
    var rt = state.roomTypes.find(function (r) { return r.id === roomTypeId; });
    var typeRooms = physicalRoomsForType(state, roomTypeId);
    var activeSellablePhysical = typeRooms.filter(function (pr) { return pr.isActive && pr.isSellable; }).length;
    var blockedPhysical = typeRooms.filter(function (pr) {
      var blk = physicalRoomBlockOn(state, pr.id, dateStr);
      return blk && blk.type !== "Other";
    }).length;
    var confirmedCommitted = 0, heldCommitted = 0;
    (state.roomAssignments || []).forEach(function (a) {
      if (a.assignmentStatus === "Cancelled") return;
      if (dateStr < a.arrivalDate || dateStr >= a.departureDate) return;
      var pr = state.physicalRooms.find(function (p) { return p.id === a.physicalRoomId; });
      if (!pr || pr.roomTypeId !== roomTypeId) return;
      if (a.assignmentStatus === "Assigned") confirmedCommitted++;
      else if (a.assignmentStatus === "Held") heldCommitted++;
    });
    var manualAdjustment = dateAdjustmentFor(state, roomTypeId, dateStr);
    var stopSellEntry = state.inventoryOverrides[roomTypeId + "|" + dateStr] || null;
    var commercial = computeAvailability(state, roomTypeId, dateStr);
    return {
      roomTypeId: roomTypeId, date: dateStr,
      activeSellablePhysical: activeSellablePhysical,
      blockedPhysical: blockedPhysical,
      confirmedCommitted: confirmedCommitted,
      heldCommitted: heldCommitted,
      configuredSellable: rt.sellable,
      manualAdjustment: manualAdjustment,
      stopSell: !!stopSellEntry,
      stopSellReason: stopSellEntry ? stopSellEntry.reason : null,
      finalAvailable: commercial.available
    };
  }
  // Guards against confirming more room assignments than physically exist for the
  // stay — the physical-layer counterpart to validateAvailability's commercial check.
  // No overbooking is permitted at this layer in the MVP.
  function validateRoomAssignmentCapacity(state, roomTypeId, checkIn, checkOut, qty) {
    var nights = dateRange(checkIn, checkOut);
    var problems = [];
    nights.forEach(function (d) {
      var n = eligiblePhysicalRoomCount(state, roomTypeId, d);
      if (n < qty) problems.push({ date: d, eligible: n });
    });
    return { ok: problems.length === 0, problems: problems, nights: nights };
  }
  var ROOM_STATUS_BADGE = {
    "Available": "badge-green",
    "Reserved": "badge-blue",
    "Held": "badge-yellow",
    "Out of Order": "badge-red",
    "Out of Service": "badge-red",
    "Inactive": "badge-gray"
  };
  function roomStatusBadge(status) {
    return '<span class="badge ' + (ROOM_STATUS_BADGE[status] || "badge-gray") + '"><span class="badge-dot"></span>' + status + "</span>";
  }

  /* ---------------------------------------------------------------- */
  /* Room assignment recommendation engine                                    */
  /* Deterministic and rule-based on purpose — no AI, no optimization solver. */
  /* Drives auto-assignment in New Reservation and the Change Room drawer.    */
  /* ---------------------------------------------------------------- */

  // Whole-stay eligibility for ONE physical room. Per product rule, a Management
  // Hold/Out of Order/Out of Service block disqualifies a room; an "Other" block does
  // not (that block type is informational only in this MVP — see README §4.7).
  function roomEligibleForStay(state, room, checkIn, checkOut, excludeAssignmentId) {
    if (!room.isActive || !room.isSellable) return false;
    return dateRange(checkIn, checkOut).every(function (d) {
      if (isPhysicalRoomAssigned(state, room.id, d, excludeAssignmentId)) return false;
      var blk = physicalRoomBlockOn(state, room.id, d);
      if (blk && blk.type !== "Other") return false;
      return true;
    });
  }
  // A required attribute (currently: accessibility features) is a hard filter — a room
  // that doesn't have every required feature is not eligible, not just lower-ranked.
  function roomMeetsRequirements(room, prefs) {
    if (!prefs || !prefs.requireAccessibility || !prefs.requireAccessibility.length) return true;
    return prefs.requireAccessibility.every(function (a) { return (room.accessibilityFeatures || []).indexOf(a) > -1; });
  }
  // Short, non-sensitive category for why a specific room can't be picked — never
  // exposes a block's free-text reason/notes, only its type.
  function roomIneligibilityReason(state, room, checkIn, checkOut, prefs, excludeAssignmentId) {
    if (!room.isActive) return "Inactive";
    if (!room.isSellable) return "Not Sellable";
    var reason = null;
    dateRange(checkIn, checkOut).some(function (d) {
      if (isPhysicalRoomAssigned(state, room.id, d, excludeAssignmentId)) { reason = "Reserved"; return true; }
      var blk = physicalRoomBlockOn(state, room.id, d);
      if (blk && blk.type === "Out of Order") { reason = "Out of Order"; return true; }
      if (blk && blk.type === "Out of Service") { reason = "Out of Service"; return true; }
      if (blk && blk.type === "Management Hold") { reason = "Held"; return true; }
      return false;
    });
    if (reason) return reason;
    if (!roomMeetsRequirements(room, prefs)) return "Attribute Mismatch";
    return null; // eligible
  }
  function eligiblePhysicalRoomsForStay(state, roomTypeId, checkIn, checkOut, opts) {
    opts = opts || {};
    var excludeRoomIds = opts.excludeRoomIds || [];
    return physicalRoomsForType(state, roomTypeId).filter(function (room) {
      if (excludeRoomIds.indexOf(room.id) > -1) return false;
      if (!roomEligibleForStay(state, room, checkIn, checkOut, opts.excludeAssignmentId)) return false;
      return roomMeetsRequirements(room, opts.preferences || opts);
    });
  }
  // How many soft preferences (bed configuration, connecting-room capability) a room
  // matches — used only for ranking, never to exclude a room.
  function roomPreferenceMatchCount(room, prefs) {
    if (!prefs) return 0;
    var n = 0;
    if (prefs.bedConfiguration && room.bedConfiguration === prefs.bedConfiguration) n++;
    if (prefs.requireConnecting && room.connectingRoomIds && room.connectingRoomIds.length) n++;
    return n;
  }
  // Priority 3: prefer a room with no assignment/block landing on the night right
  // before arrival or on the departure night itself — i.e. no immediately adjacent
  // operational constraint that complicates turnover.
  function roomAdjacencyScore(state, room, checkIn, checkOut) {
    var score = 0;
    [addDays(checkIn, -1), checkOut].forEach(function (d) {
      if (!isPhysicalRoomAssigned(state, room.id, d) && !physicalRoomBlockOn(state, room.id, d)) score++;
    });
    return score;
  }
  function roomNumberSortValue(room) {
    var n = parseInt(room.roomNumber, 10);
    return isNaN(n) ? null : n;
  }
  // Deterministic ranking, most-recommended first: (2) preference match count,
  // (3) adjacency score, (4) lowest room number as the final, predictable tie-breaker.
  function rankRoomsForAssignment(state, rooms, checkIn, checkOut, prefs) {
    return rooms.slice().sort(function (a, b) {
      var pa = roomPreferenceMatchCount(a, prefs), pb = roomPreferenceMatchCount(b, prefs);
      if (pa !== pb) return pb - pa;
      var aa = roomAdjacencyScore(state, a, checkIn, checkOut), ab = roomAdjacencyScore(state, b, checkIn, checkOut);
      if (aa !== ab) return ab - aa;
      var na = roomNumberSortValue(a), nb = roomNumberSortValue(b);
      if (na != null && nb != null && na !== nb) return na - nb;
      return a.roomNumber < b.roomNumber ? -1 : (a.roomNumber > b.roomNumber ? 1 : 0);
    });
  }
  function findConnectingPair(rooms) {
    for (var i = 0; i < rooms.length; i++) {
      for (var j = i + 1; j < rooms.length; j++) {
        var a = rooms[i], b = rooms[j];
        if ((a.connectingRoomIds || []).indexOf(b.id) > -1 || (b.connectingRoomIds || []).indexOf(a.id) > -1) return [a, b];
      }
    }
    return null;
  }
  // Auto-assigns up to `request.qty` distinct physical rooms for one reservation item.
  // request: { roomTypeId, checkIn, checkOut, qty, requireAccessibility, bedConfiguration,
  //            requireConnecting, keepRoomIds, excludeRoomIds, excludeAssignmentId }
  // Priority 1 (retain existing assignment across an edit) is applied first: any room in
  // keepRoomIds that is still eligible is kept before any new recommendation runs.
  // Returns { assignedRoomIds, shortfall } — shortfall > 0 means not enough eligible
  // rooms exist; callers must block confirmation rather than overbook.
  function autoAssignRoomsForItem(state, request) {
    var prefs = { requireAccessibility: request.requireAccessibility, bedConfiguration: request.bedConfiguration, requireConnecting: request.requireConnecting };
    var excludeRoomIds = (request.excludeRoomIds || []).slice();
    var assigned = [];

    (request.keepRoomIds || []).forEach(function (id) {
      if (assigned.length >= request.qty) return;
      if (excludeRoomIds.indexOf(id) > -1 || assigned.indexOf(id) > -1) return;
      var room = physicalRoomsForType(state, request.roomTypeId).find(function (r) { return r.id === id; });
      if (!room) return;
      if (!roomEligibleForStay(state, room, request.checkIn, request.checkOut, request.excludeAssignmentId)) return;
      if (!roomMeetsRequirements(room, prefs)) return;
      assigned.push(id);
    });

    if (assigned.length < request.qty) {
      var pool = eligiblePhysicalRoomsForStay(state, request.roomTypeId, request.checkIn, request.checkOut, {
        excludeRoomIds: excludeRoomIds.concat(assigned), excludeAssignmentId: request.excludeAssignmentId, preferences: prefs
      });
      var ranked = rankRoomsForAssignment(state, pool, request.checkIn, request.checkOut, prefs);
      if (prefs.requireConnecting && (request.qty - assigned.length) >= 2) {
        var pair = findConnectingPair(ranked);
        if (pair) {
          ranked = pair.concat(ranked.filter(function (r) { return r.id !== pair[0].id && r.id !== pair[1].id; }));
        }
      }
      ranked.forEach(function (room) {
        if (assigned.length >= request.qty) return;
        assigned.push(room.id);
      });
    }

    return { assignedRoomIds: assigned, shortfall: Math.max(0, request.qty - assigned.length) };
  }

  /* ---------------------------------------------------------------- */
  /* Reservation date-change impact — shared by operations-calendar.html's   */
  /* drag-to-move/resize interactions (Physical Rooms and the Operations      */
  /* Calendar must not duplicate this business rule between them). Stay      */
  /* dates are reservation-level, shared across every room item (README      */
  /* §4.3 rule 3), so any date change necessarily applies to the whole        */
  /* reservation — every item is revalidated, not just the dragged bar's.    */
  /* ---------------------------------------------------------------- */
  function computeDateChangeImpact(state, reservationId, newCheckIn, newCheckOut) {
    var res = state.reservations.find(function (r) { return r.id === reservationId; });
    if (!res) return null;
    var validDates = newCheckOut > newCheckIn;
    // A state clone with this reservation's own current commitment removed, so the
    // revalidation checks a genuinely free slot rather than being blocked by (or coasting
    // on) the booking it is itself in the middle of changing — same technique as
    // reservation-detail.html's Edit drawer.
    var exclSelf = Object.assign({}, state, {
      reservations: state.reservations.filter(function (r) { return r.id !== reservationId; }),
      roomAssignments: state.roomAssignments.filter(function (a) { return a.reservationId !== reservationId; })
    });
    var items = res.rooms.map(function (room) {
      var origRoomIds = state.roomAssignments.filter(function (a) { return a.reservationItemId === room.id && a.assignmentStatus !== "Cancelled"; }).map(function (a) { return a.physicalRoomId; });
      var avail = validDates ? validateAvailability(exclSelf, room.roomTypeId, newCheckIn, newCheckOut, room.qty) : { ok: false, problems: [] };
      var others = [];
      res.rooms.forEach(function (o) {
        if (o.id === room.id) return;
        state.roomAssignments.filter(function (a) { return a.reservationItemId === o.id && a.assignmentStatus !== "Cancelled"; }).forEach(function (a) { others.push(a.physicalRoomId); });
      });
      var assignResult = validDates ? autoAssignRoomsForItem(exclSelf, {
        roomTypeId: room.roomTypeId, checkIn: newCheckIn, checkOut: newCheckOut, qty: room.qty,
        requireAccessibility: room.requireAccessibility ? ["Wheelchair Accessible"] : [],
        bedConfiguration: room.bedConfigPref || null, requireConnecting: room.qty > 1 && !!room.requireConnecting,
        keepRoomIds: origRoomIds, excludeRoomIds: others
      }) : { assignedRoomIds: [], shortfall: room.qty };
      var subtotal = 0;
      if (validDates) dateRange(newCheckIn, newCheckOut).forEach(function (d) { subtotal += rateFor(state, room.roomTypeId, d) * room.qty; });
      return { itemId: room.id, roomTypeId: room.roomTypeId, qty: room.qty, origRoomIds: origRoomIds, avail: avail, assignedRoomIds: assignResult.assignedRoomIds, shortfall: assignResult.shortfall, subtotal: subtotal };
    });
    var roomCharges = items.reduce(function (a, it) { return a + it.subtotal; }, 0);
    var pricing = computePricing(state, roomCharges, newCheckIn);
    var oldRoomCharges = 0;
    dateRange(res.checkIn, res.checkOut).forEach(function (d) { res.rooms.forEach(function (room) { oldRoomCharges += rateFor(state, room.roomTypeId, d) * room.qty; }); });
    var oldPricing = computePricing(state, oldRoomCharges, res.checkIn);
    var ok = validDates && items.every(function (it) { return it.avail.ok && it.shortfall === 0; });
    return {
      reservationId: reservationId, oldCheckIn: res.checkIn, oldCheckOut: res.checkOut, newCheckIn: newCheckIn, newCheckOut: newCheckOut,
      items: items, validDates: validDates, ok: ok,
      oldNights: nightsBetween(res.checkIn, res.checkOut), newNights: validDates ? nightsBetween(newCheckIn, newCheckOut) : 0,
      roomCharges: roomCharges, taxAmount: pricing.taxAmount, feeAmount: pricing.feeAmount, total: roomCharges + pricing.taxAmount + pricing.feeAmount,
      oldRoomCharges: oldRoomCharges, oldTaxAmount: oldPricing.taxAmount, oldFeeAmount: oldPricing.feeAmount, oldTotal: oldRoomCharges + oldPricing.taxAmount + oldPricing.feeAmount
    };
  }
  // Applies an already-confirmed, already-revalidated impact (see computeDateChangeImpact)
  // atomically: cancels every old assignment for this reservation's items and creates fresh
  // ones, updates dates/pricing, and logs one detailed activity/audit entry. Callers must
  // re-fetch fresh state and re-run computeDateChangeImpact immediately before calling this —
  // exactly the same revalidate-right-before-write convention every other mutate path here uses.
  function applyDateChangeImpact(impact, actor) {
    var st = getState();
    var idx = st.reservations.findIndex(function (r) { return r.id === impact.reservationId; });
    var liveR = st.reservations[idx];
    var assignmentStatus = liveR.status === "Confirmed" ? "Assigned" : "Held";
    var holdExp = assignmentStatus === "Held" ? ((liveR.paymentLinkExpiresAt && liveR.paymentStatus === "Link Sent") ? liveR.paymentLinkExpiresAt : holdExpiryFromNow()) : null;
    var asnCounter = 0;
    impact.items.forEach(function (it) {
      st.roomAssignments.forEach(function (a) { if (a.reservationItemId === it.itemId && a.assignmentStatus !== "Cancelled") a.assignmentStatus = "Cancelled"; });
      it.assignedRoomIds.forEach(function (rid) {
        asnCounter++;
        st.roomAssignments.push({
          id: "asn-" + Date.now() + "-" + asnCounter, propertyId: st.hotel.propertyCode, reservationId: impact.reservationId, reservationItemId: it.itemId,
          physicalRoomId: rid, arrivalDate: impact.newCheckIn, departureDate: impact.newCheckOut, assignmentStatus: assignmentStatus,
          assignedAt: nowIso(), assignedBy: actor, changeReason: "Moved via Operations Calendar", holdExpiresAt: holdExp
        });
      });
    });
    liveR.checkIn = impact.newCheckIn;
    liveR.checkOut = impact.newCheckOut;
    liveR.taxAmount = impact.taxAmount;
    liveR.feeAmount = impact.feeAmount;
    var note = "Stay dates changed from " + fmtDateShort(impact.oldCheckIn) + "–" + fmtDateShort(impact.oldCheckOut) + " to " + fmtDateShort(impact.newCheckIn) + "–" + fmtDateShort(impact.newCheckOut) + " via Operations Calendar by " + actor + ".";
    liveR.activity.push({ ts: nowIso(), text: note });
    setState(st);
    addAudit("Reservation Dates Changed", impact.reservationId + " — " + note);
  }

  /* ---------------------------------------------------------------- */
  /* Payment-link lifecycle + refund recording — shared by                    */
  /* reservation-detail.html's Payment section and payments.html's Payment    */
  /* Details drawer, so both surfaces mutate a reservation's payment fields   */
  /* through one implementation. This MVP has exactly two payment methods     */
  /* (Pay on Arrival, Payment Link) and only full Refund Pending → Refunded   */
  /* recording — no partial refunds, split tender, or gateway reconciliation. */
  /* ---------------------------------------------------------------- */
  function generatePaymentLink(state, reservationId, hours, channels) {
    var r = state.reservations.find(function (x) { return x.id === reservationId; });
    if (!r) return null;
    r.paymentLinkUrl = "https://pay.example.com/" + r.id;
    r.paymentLinkGeneratedAt = nowIso();
    var expiryDate = new Date(nowIso() + ":00Z");
    expiryDate.setUTCHours(expiryDate.getUTCHours() + (hours || 24));
    r.paymentLinkExpiresAt = expiryDate.toISOString().slice(0, 16);
    r.paymentStatus = "Link Sent";
    r.status = "Pending Payment";
    r.activity.push({ ts: nowIso(), text: "Payment Link generated." });
    var via = (channels || []).join(" & ");
    r.activity.push({ ts: nowIso(), text: "Payment Link sent" + (via ? " via " + via : "") + "." });
    return r;
  }
  // outcome: "paid" | "failed" | "expired"
  function recordPaymentOutcome(state, reservationId, outcome, actor) {
    var r = state.reservations.find(function (x) { return x.id === reservationId; });
    if (!r) return null;
    if (outcome === "paid") {
      r.paymentPaidAt = nowIso();
      r.transactionRef = "PAY-" + new Date().getFullYear() + "-" + Math.floor(10000 + Math.random() * 89999);
      r.paymentStatus = "Paid";
      r.status = "Confirmed";
      r.activity.push({ ts: nowIso(), text: "Payment successful — Transaction Ref: " + r.transactionRef + "." });
      r.activity.push({ ts: nowIso(), text: "Reservation confirmed." });
    } else if (outcome === "failed") {
      r.paymentStatus = "Failed";
      r.activity.push({ ts: nowIso(), text: "Payment attempt failed." });
    } else if (outcome === "expired") {
      r.paymentStatus = "Expired";
      r.activity.push({ ts: nowIso(), text: "Payment link expired without payment." });
    }
    return r;
  }
  // Only ever moves Refund Pending → Refunded (see file header comment) — never called
  // directly to mutate state; always go through renderRecordRefundModal so a reason is
  // always required and the confirmation step is never skipped.
  function recordRefund(state, reservationId, reason, actor) {
    var r = state.reservations.find(function (x) { return x.id === reservationId; });
    if (!r) return null;
    if (r.paymentStatus !== "Refund Pending") throw new Error("Only a Refund Pending payment can be marked Refunded.");
    r.paymentStatus = "Refunded";
    r.activity.push({ ts: nowIso(), text: "Refund recorded by " + actor + ". Reason: " + reason + "." });
    return r;
  }
  var recordRefundModalEl = null;
  function ensureRecordRefundModal() {
    if (recordRefundModalEl) return recordRefundModalEl;
    recordRefundModalEl = document.createElement("div");
    recordRefundModalEl.className = "pg-modal-overlay";
    recordRefundModalEl.id = "pgRecordRefundModal";
    document.body.appendChild(recordRefundModalEl);
    return recordRefundModalEl;
  }
  // opts: { reservationId, onRecorded(reservation) }
  function renderRecordRefundModal(opts) {
    var state = getState();
    var el = ensureRecordRefundModal();
    var r = state.reservations.find(function (x) { return x.id === opts.reservationId; });
    if (!r) { toast("Reservation not found.", "danger"); return; }
    if (r.paymentStatus !== "Refund Pending") { toast("This reservation is not awaiting a refund.", "danger"); return; }
    var cust = state.customers.find(function (c) { return c.id === r.customerId; });
    el.innerHTML = '<div class="pg-modal">' +
      '<div class="pg-modal-header"><h3>Record Refund</h3><button class="pg-modal-close" id="pgrr-close">&times;</button></div>' +
      '<div class="pg-modal-body">' +
        '<div class="form-group"><div class="form-label">Reservation</div><div style="font-size:13px;font-weight:600;">' + r.id + (cust ? " — " + esc(cust.name) : "") + "</div></div>" +
        '<div class="form-group"><div class="form-label">Original Payment</div><div style="font-size:13px;font-weight:600;">' + esc(r.paymentMethod || "—") + (r.transactionRef ? " · " + esc(r.transactionRef) : "") + "</div></div>" +
        (opts.amountLabel ? '<div class="form-group"><div class="form-label">Amount</div><div style="font-size:15px;font-weight:800;">' + esc(opts.amountLabel) + "</div></div>" : "") +
        '<div class="form-group"><label class="form-label">Refund Reason <span class="opt">(required)</span></label><textarea class="form-control" id="pgrr-reason" placeholder="e.g. Guest cancellation, duplicate charge"></textarea><div class="field-error" id="pgrr-err"></div></div>' +
        '<div class="help-note help-note-warning">This prototype has no real payment gateway — confirming records the refund as completed in the system. It does not move real funds.</div>' +
      "</div>" +
      '<div class="pg-modal-footer"><button class="btn btn-light" id="pgrr-cancel">Cancel</button><button class="btn btn-danger" id="pgrr-confirm">Confirm Refund</button></div>' +
    "</div>";
    el.querySelector("#pgrr-close").addEventListener("click", function () { closeModal("pgRecordRefundModal"); });
    el.querySelector("#pgrr-cancel").addEventListener("click", function () { closeModal("pgRecordRefundModal"); });
    el.querySelector("#pgrr-confirm").addEventListener("click", function () {
      var reason = document.getElementById("pgrr-reason").value.trim();
      if (!reason) { document.getElementById("pgrr-err").textContent = "A reason is required to record a refund."; toast("A reason is required to record a refund.", "danger"); return; }
      try {
        var fresh = getState();
        var updated = recordRefund(fresh, opts.reservationId, reason, CURRENT_ROLE);
        setState(fresh);
        addAudit("Refund Recorded", opts.reservationId + " — refund recorded. Reason: " + reason + ".");
        toast("Refund recorded.", "success");
        closeModal("pgRecordRefundModal");
        if (opts.onRecorded) opts.onRecorded(updated);
      } catch (e) {
        toast(e.message || "Failed to record the refund. Please try again.", "danger");
      }
    });
    openModal("pgRecordRefundModal");
  }

  /* ---------------------------------------------------------------- */
  /* CSV export — shared by every report page (see reservation-reports.html, */
  /* inventory-reports.html, payment-reports.html) so each report's export   */
  /* button is one call, not a hand-rolled CSV builder per page.             */
  /* ---------------------------------------------------------------- */
  function csvCell(v) {
    v = v == null ? "" : String(v);
    if (/[",\n]/.test(v)) v = '"' + v.replace(/"/g, '""') + '"';
    return v;
  }
  function exportCsv(filename, headers, rows) {
    var lines = [headers.map(csvCell).join(",")];
    rows.forEach(function (row) { lines.push(row.map(csvCell).join(",")); });
    var blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  /* ---------------------------------------------------------------- */
  /* Formatting helpers                                                 */
  /* ---------------------------------------------------------------- */
  var STATUS_BADGE = {
    "Draft": "badge-gray",
    "Pending Payment": "badge-yellow",
    "Confirmed": "badge-green",
    "Cancelled": "badge-red",
    "Completed": "badge-blue",
    "No Show": "badge-red"
  };
  var PAY_BADGE = {
    "Pay on Arrival": "badge-blue",
    "Payment Required": "badge-yellow",
    "Link Sent": "badge-purple",
    "Paid": "badge-green",
    "Failed": "badge-red",
    "Expired": "badge-gray",
    "Refund Pending": "badge-yellow",
    "Refunded": "badge-gray"
  };
  function statusBadge(status) {
    return '<span class="badge ' + (STATUS_BADGE[status] || "badge-gray") + '"><span class="badge-dot"></span>' + status + "</span>";
  }
  function payBadge(status) {
    return '<span class="badge badge-outline ' + (PAY_BADGE[status] || "badge-gray") + '"><span class="badge-dot"></span>' + status + "</span>";
  }
  function esc(s) {
    var d = document.createElement("div");
    d.innerText = s == null ? "" : s;
    return d.innerHTML;
  }
  function occupancyLabel(rt) {
    var out = rt.maxAdults + " Adult" + (rt.maxAdults === 1 ? "" : "s");
    if (rt.maxChildren) out += " + " + rt.maxChildren + " Child" + (rt.maxChildren === 1 ? "" : "ren");
    return out;
  }

  /* ---------------------------------------------------------------- */
  /* Toasts                                                             */
  /* ---------------------------------------------------------------- */
  function ensureToastHost() {
    var host = document.querySelector(".pg-toast");
    if (!host) {
      host = document.createElement("div");
      host.className = "pg-toast";
      document.body.appendChild(host);
    }
    return host;
  }
  function toast(msg, type) {
    var host = ensureToastHost();
    var el = document.createElement("div");
    el.className = "pg-toast-item " + (type || "success");
    el.innerHTML = msg;
    host.appendChild(el);
    setTimeout(function () {
      el.style.transition = "opacity .25s";
      el.style.opacity = "0";
      setTimeout(function () { el.remove(); }, 250);
    }, 3200);
  }

  /* ---------------------------------------------------------------- */
  /* Sidebar / Header shell                                             */
  /* ---------------------------------------------------------------- */
  var CURRENT_ROLE = "Hotel Admin"; // this prototype's persona; "Platform Super Admin" would also see Hotels

  var NAV = [
    { section: "Hotel Management", items: [
      { key: "dashboard", label: "Dashboard", href: "index.html", icon: "grid" },
      { key: "operations-calendar", label: "Operations Calendar", href: "operations-calendar.html", icon: "calendar" },
      { key: "hotel-profile", label: "Hotel Profile", href: "hotel-profile.html", icon: "building" },
      { key: "room-types", label: "Room Types", href: "room-types.html", icon: "bed" },
      { key: "physical-rooms", label: "Physical Rooms", href: "physical-rooms.html", icon: "door" },
      { key: "rates", label: "Rates", href: "rates.html", icon: "tag" },
      // Hidden by product decision: Operations Calendar is now the primary availability/inventory
      // workspace. The page, its route, and all its logic are fully intact — only nav visibility
      // is toggled, reusing the same `hidden` mechanism a future prompt can flip back at any time
      // (same pattern as `superAdminOnly` below, filtered alongside it in renderSidebar).
      { key: "availability", label: "Availability & Inventory", href: "availability-inventory.html", icon: "calendar", hidden: true }
    ]},
    { section: "Reservations", items: [
      { key: "reservations", label: "Reservations", href: "reservations.html", icon: "list" },
      { key: "new-reservation", label: "New Reservation", href: "new-reservation.html", icon: "plus" },
      { key: "guests", label: "Guests", href: "guests.html", icon: "user" }
    ]},
    { section: "Payments", items: [
      { key: "payments", label: "Payments", href: "payments.html", icon: "card" }
    ]},
    { section: "Reports", items: [
      { key: "reservation-reports", label: "Reservation Reports", href: "reservation-reports.html", icon: "chart" },
      { key: "inventory-reports", label: "Inventory Reports", href: "inventory-reports.html", icon: "chart" },
      { key: "payment-reports", label: "Payment Reports", href: "payment-reports.html", icon: "chart" }
    ]},
    { section: "Settings", items: [
      { key: "policies", label: "Hotel Policies", href: "hotel-policies.html", icon: "shield" },
      { key: "taxes", label: "Taxes & Fees", href: "taxes-fees.html", icon: "percent" },
      { key: "payment-config", label: "Payment Configuration", href: "payment-configuration.html", icon: "settings" }
    ]},
    { section: "Administration", items: [
      { key: "hotels", label: "Hotels", href: "hotels.html", icon: "building", superAdminOnly: true },
      { key: "users", label: "Users", href: "users.html", icon: "user" },
      { key: "roles", label: "Roles", href: "roles.html", icon: "layers" },
      { key: "permissions", label: "Permissions", href: "permissions.html", icon: "lock" },
      { key: "audit", label: "Audit", href: "audit.html", icon: "clock" }
    ]}
  ];

  var ICONS = {
    building: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 21V5a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v16"/><path d="M14 21v-6h6v6"/><path d="M8 7h.01M11 7h.01M8 10h.01M11 10h.01M8 13h.01M11 13h.01"/></svg>',
    grid: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/></svg>',
    chart: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 20V10M12 20V4M20 20v-7"/><path d="M2 20h20"/></svg>',
    bed: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 18v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6"/><path d="M3 18v2M21 18v2M3 12V8a1 1 0 0 1 1-1h6v5"/></svg>',
    door: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="2.5" width="14" height="19" rx="1.2"/><path d="M15 12h.01"/></svg>',
    tag: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20.6 12.6 12 21.2 2.8 12 11.4 3.4H20a1 1 0 0 1 1 1v8.2Z"/><circle cx="15.5" cy="8.5" r="1.3" fill="currentColor" stroke="none"/></svg>',
    calendar: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>',
    list: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 5v14M5 12h14"/></svg>',
    card: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>',
    shield: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3 4 6v6c0 5 3.5 7.7 8 9 4.5-1.3 8-4 8-9V6l-8-3Z"/></svg>',
    percent: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M19 5 5 19M7 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm10 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/></svg>',
    settings: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.6V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.6 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.6 1Z"/></svg>',
    user: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 5-6 8-6s6.5 2 8 6"/></svg>',
    layers: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 17l9 5 9-5"/></svg>',
    lock: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 1 1 8 0v4"/></svg>',
    clock: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>',
    play: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M10 8.5v7l6-3.5-6-3.5Z" fill="currentColor" stroke="none"/></svg>'
  };

  function renderSidebar(activeKey) {
    var html = '<aside class="pg-sidebar">';
    html += '<div class="pg-sidebar-brand"><div class="logo-badge">PG</div><div><div class="brand-text">Palestine Grand</div><div class="brand-sub">Hotel Admin Platform</div></div></div>';
    html += '<div class="pg-sidebar-tenant"><div><div class="t-name">Palestine Grand Hotel</div><div class="t-role">Pilot Tenant &middot; Hotel Admin</div></div><span class="chev">&#9662;</span></div>';
    html += '<nav class="pg-nav">';
    NAV.forEach(function (sec) {
      var visibleItems = sec.items.filter(function (it) { return !it.hidden && (!it.superAdminOnly || CURRENT_ROLE === "Platform Super Admin"); });
      if (!visibleItems.length) return;
      html += '<div class="pg-nav-section"><div class="pg-nav-section-title">' + sec.section + "</div>";
      visibleItems.forEach(function (it) {
        html += '<a class="pg-nav-item' + (it.key === activeKey ? " active" : "") + '" href="' + it.href + '"><span class="ic">' + ICONS[it.icon] + '</span><span>' + it.label + "</span></a>";
      });
      html += "</div>";
    });
    html += "</nav></aside>";
    return html;
  }

  var CRUMB_LINKS = {
    "Dashboard": "index.html", "Operations Calendar": "operations-calendar.html", "Hotel Management": "hotel-profile.html", "Room Types": "room-types.html",
    "Physical Rooms": "physical-rooms.html", "Rates": "rates.html", "Availability & Inventory": "availability-inventory.html", "Reservations": "reservations.html",
    "New Reservation": "new-reservation.html", "Guests": "guests.html", "Guided Journey": "demo-journey.html", "Payments": "payments.html",
    "Reports": "reservation-reports.html", "Settings": "hotel-policies.html", "Hotel Policies": "hotel-policies.html", "Taxes & Fees": "taxes-fees.html",
    "Payment Configuration": "payment-configuration.html", "Administration": "users.html", "Hotels": "hotels.html", "Users": "users.html",
    "Roles": "roles.html", "Permissions": "permissions.html", "Audit": "audit.html"
  };
  function renderHeader(crumbs, activeKey) {
    var crumbHtml = crumbs.map(function (c, i) {
      var isFirst = i === 0, isLast = i === crumbs.length - 1;
      if (isLast) return "<b>" + esc(c) + "</b>";
      if (isFirst) return esc(c); // section label — never a link
      var href = CRUMB_LINKS[c];
      return href ? '<a href="' + href + '">' + esc(c) + "</a>" : esc(c);
    }).join(' <span>/</span> ');
    var html = '<header class="pg-header">';
    html += '<div class="pg-header-left">';
    html += '<div class="pg-property-ctx" title="Current property — this pilot has a single hotel, so no switcher is shown">' + ICONS.building + '<span>Palestine Grand Hotel</span></div>';
    html += '<div class="pg-breadcrumb">' + crumbHtml + "</div></div>";
    html += '<div class="pg-gsearch">' +
      '<input class="pg-gsearch-input" id="pg-gsearch-input" placeholder="Search reservations, guests, rooms, payments…" autocomplete="off" aria-label="Global search">' +
      '<div class="pg-gsearch-panel" id="pg-gsearch-panel"></div>' +
    "</div>";
    html += '<div class="pg-header-right">';
    if (activeKey === "reservations") {
      html += '<a class="pg-header-btn" href="reservations-ar.html" title="Switch this screen to Arabic (RTL)">&#1575;&#1604;&#1593;&#1585;&#1576;&#1610;&#1577; (AR)</a>';
    }
    html += '<a class="pg-header-btn" href="new-reservation.html">' + ICONS.plus + " New Reservation</a>";
    html += '<button class="pg-header-btn" id="pg-reset-btn" title="Reset all prototype data back to the seeded demo state">&#8635; Reset Demo Data</button>';
    html += '<div class="pg-user"><div class="avatar">HA</div><div><div class="u-name">Hotel Admin</div><div class="u-role">Palestine Grand Hotel</div></div></div>';
    html += "</div></header>";
    return html;
  }

  /* ---------------------------------------------------------------- */
  /* Global search — header search box present on every page (rendered by   */
  /* renderHeader/mount). Searches reservations, guests, physical rooms      */
  /* (by number or room type name), and payments (by transaction ref) —     */
  /* grouped, capped per group, and opened via the same detail pages/deep-   */
  /* link drawers every other cross-page link in this app already uses.     */
  /* ---------------------------------------------------------------- */
  var RECENT_SEARCH_KEY = "pg_recent_searches_v1";
  var GSEARCH_LIMIT = 6;
  function globalSearch(state, query) {
    var q = (query || "").trim().toLowerCase();
    if (!q) return { reservations: [], guests: [], rooms: [], payments: [] };
    var qDigits = q.replace(/\D/g, "");
    var reservations = state.reservations.filter(function (r) {
      var c = state.customers.find(function (x) { return x.id === r.customerId; });
      var hay = [r.id, c ? c.name : ""].join(" ").toLowerCase();
      return hay.indexOf(q) > -1;
    }).slice(0, GSEARCH_LIMIT);
    var guests = state.customers.filter(function (c) {
      var hay = [c.name, c.email].join(" ").toLowerCase();
      var phoneMatch = qDigits && (c.phone || "").replace(/\D/g, "").indexOf(qDigits) > -1;
      return hay.indexOf(q) > -1 || phoneMatch;
    }).slice(0, GSEARCH_LIMIT);
    var rooms = state.physicalRooms.filter(function (pr) {
      var rt = state.roomTypes.find(function (x) { return x.id === pr.roomTypeId; });
      var hay = [pr.roomNumber, rt ? rt.name : ""].join(" ").toLowerCase();
      return hay.indexOf(q) > -1;
    }).slice(0, GSEARCH_LIMIT);
    var payments = state.reservations.filter(function (r) {
      return r.transactionRef && r.transactionRef.toLowerCase().indexOf(q) > -1;
    }).slice(0, GSEARCH_LIMIT);
    return { reservations: reservations, guests: guests, rooms: rooms, payments: payments };
  }
  function recentSearches() {
    try { return JSON.parse(localStorage.getItem(RECENT_SEARCH_KEY) || "[]"); } catch (e) { return []; }
  }
  function pushRecentSearch(q) {
    q = (q || "").trim();
    if (!q) return;
    try {
      var list = recentSearches().filter(function (x) { return x.toLowerCase() !== q.toLowerCase(); });
      list.unshift(q);
      localStorage.setItem(RECENT_SEARCH_KEY, JSON.stringify(list.slice(0, 5)));
    } catch (e) { /* localStorage unavailable — recent searches simply won't persist */ }
  }
  function wireGlobalSearch() {
    var input = document.getElementById("pg-gsearch-input");
    var panel = document.getElementById("pg-gsearch-panel");
    if (!input || !panel) return;
    var flat = []; // flattened, in display order, for keyboard navigation
    var hi = -1;

    function resultRow(kind, id, main, sub) {
      return { kind: kind, id: id, main: main, sub: sub };
    }
    function buildFlat(query) {
      var st = getState();
      var res = globalSearch(st, query);
      var out = [];
      res.reservations.forEach(function (r) {
        var c = st.customers.find(function (x) { return x.id === r.customerId; });
        out.push(resultRow("reservation", r.id, r.id + " — " + (c ? c.name : "Guest"), r.status + " · " + fmtDateShort(r.checkIn) + "–" + fmtDateShort(r.checkOut)));
      });
      res.guests.forEach(function (c) {
        out.push(resultRow("guest", c.id, c.name, (c.phone || "—") + " · " + (c.email || "—")));
      });
      res.rooms.forEach(function (pr) {
        var rt = st.roomTypes.find(function (x) { return x.id === pr.roomTypeId; });
        out.push(resultRow("room", pr.id, "Room " + pr.roomNumber, (rt ? rt.name : "") + " · Floor " + pr.floor));
      });
      res.payments.forEach(function (r) {
        var c = st.customers.find(function (x) { return x.id === r.customerId; });
        out.push(resultRow("payment", r.id, r.transactionRef, r.id + (c ? " · " + c.name : "") + " · " + r.paymentStatus));
      });
      return out;
    }
    function openResult(item) {
      pushRecentSearch(input.value);
      if (item.kind === "reservation") location.href = "reservation-detail.html?id=" + item.id;
      else if (item.kind === "guest") location.href = "guest-detail.html?id=" + item.id;
      else if (item.kind === "room") location.href = "physical-rooms.html?room=" + item.id;
      else if (item.kind === "payment") location.href = "payments.html?id=" + item.id;
    }
    function renderPanel() {
      var q = input.value.trim();
      if (!q) {
        var recents = recentSearches();
        if (!recents.length) { panel.innerHTML = '<div class="pg-gsearch-empty">Start typing to search reservations, guests, rooms, or payments.</div>'; flat = []; hi = -1; panel.classList.add("show"); return; }
        panel.innerHTML = '<div class="pg-gsearch-recent"><span class="pg-gsearch-group-title" style="padding:0;">Recent Searches</span></div>' +
          '<div style="padding:0 14px 10px;">' + recents.map(function (rterm) { return '<span class="pg-gsearch-recent-chip" data-recent="' + esc(rterm) + '">' + esc(rterm) + "</span>"; }).join("") + "</div>";
        panel.querySelectorAll("[data-recent]").forEach(function (chip) {
          chip.addEventListener("click", function () { input.value = chip.dataset.recent; input.dispatchEvent(new Event("input")); input.focus(); });
        });
        flat = []; hi = -1;
        panel.classList.add("show");
        return;
      }
      flat = buildFlat(q);
      hi = -1;
      if (!flat.length) { panel.innerHTML = '<div class="pg-gsearch-empty">No matches for "' + esc(q) + '".</div>'; panel.classList.add("show"); return; }
      var groups = [["reservation", "Reservations"], ["guest", "Guests"], ["room", "Rooms"], ["payment", "Payments"]];
      var html = "";
      groups.forEach(function (g) {
        var items = flat.filter(function (it) { return it.kind === g[0]; });
        if (!items.length) return;
        html += '<div class="pg-gsearch-group-title">' + g[1] + "</div>";
        items.forEach(function (it) {
          var idx = flat.indexOf(it);
          html += '<div class="pg-gsearch-item" data-idx="' + idx + '"><span class="gs-main">' + esc(it.main) + '</span><span class="gs-sub">' + esc(it.sub) + "</span></div>";
        });
      });
      panel.innerHTML = html;
      panel.querySelectorAll(".pg-gsearch-item").forEach(function (el) {
        el.addEventListener("mousedown", function (e) { e.preventDefault(); openResult(flat[+el.dataset.idx]); });
      });
      panel.classList.add("show");
      setHighlight(0); // first result pre-highlighted so Enter opens it immediately, without requiring an arrow key first
    }
    function setHighlight(newHi) {
      var items = panel.querySelectorAll(".pg-gsearch-item");
      if (!items.length) return;
      hi = Math.max(0, Math.min(items.length - 1, newHi));
      items.forEach(function (el, i) { el.classList.toggle("hi", i === hi); });
      items[hi].scrollIntoView({ block: "nearest" });
    }
    input.addEventListener("focus", renderPanel);
    input.addEventListener("input", renderPanel);
    input.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") { e.preventDefault(); setHighlight(hi + 1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setHighlight(hi - 1); }
      else if (e.key === "Enter") { e.preventDefault(); if (hi > -1 && flat[hi]) openResult(flat[hi]); }
      else if (e.key === "Escape") { panel.classList.remove("show"); input.blur(); }
    });
    document.addEventListener("click", function (e) {
      if (!e.target.closest(".pg-gsearch")) panel.classList.remove("show");
    });
  }

  function mount(activeKey, crumbs) {
    var root = document.getElementById("pg-app");
    root.className = "pg-shell";
    root.innerHTML = renderSidebar(activeKey) + '<div class="pg-main">' + renderHeader(crumbs, activeKey) + '<main class="pg-content" id="pg-page"></main></div>';
    document.getElementById("pg-reset-btn").addEventListener("click", function () {
      if (confirm("Reset all prototype data to the original seeded demo state? This clears any reservations, edits, or inventory changes you made.")) {
        resetState();
        toast("Demo data has been reset.", "success");
        setTimeout(function () { location.reload(); }, 400);
      }
    });
    wireGlobalSearch();
    return document.getElementById("pg-page");
  }

  /* ---------------------------------------------------------------- */
  /* Modal helper                                                       */
  /* ---------------------------------------------------------------- */
  function openModal(id) {
    document.getElementById(id).classList.add("show");
  }
  function closeModal(id) {
    document.getElementById(id).classList.remove("show");
  }

  /* ---------------------------------------------------------------- */
  /* Custom Select — progressively enhances native <select class="form-control">   */
  /* elements into a styled dropdown. The native <select> stays in the DOM         */
  /* (hidden) so existing code that reads .value / listens for "change" keeps      */
  /* working untouched — enhancement is purely visual.                            */
  /* ---------------------------------------------------------------- */
  function enhanceSelects(root) {
    (root || document).querySelectorAll("select.form-control").forEach(function (sel) {
      if (sel.closest(".pg-select")) return; // already enhanced
      var wrap = document.createElement("div");
      wrap.className = "pg-select" + (sel.disabled ? " disabled" : "");
      sel.parentNode.insertBefore(wrap, sel);
      wrap.appendChild(sel);
      sel.classList.add("pg-select-native");
      var trigger = document.createElement("div");
      trigger.className = "pg-select-trigger";
      var menu = document.createElement("div");
      menu.className = "pg-select-menu";
      wrap.appendChild(trigger);
      wrap.appendChild(menu);

      function renderOptions() {
        menu.innerHTML = "";
        Array.prototype.forEach.call(sel.options, function (opt, i) {
          var row = document.createElement("div");
          row.className = "pg-select-option" + (i === sel.selectedIndex ? " selected" : "");
          row.textContent = opt.textContent;
          row.addEventListener("mousedown", function (e) {
            e.preventDefault();
            sel.selectedIndex = i;
            sel.dispatchEvent(new Event("change", { bubbles: true }));
            closeMenu();
          });
          menu.appendChild(row);
        });
      }
      function syncTrigger() {
        var opt = sel.options[sel.selectedIndex];
        trigger.textContent = opt ? opt.textContent : "";
      }
      function openMenu() {
        if (sel.disabled) return;
        document.querySelectorAll(".pg-select.open").forEach(function (w) { if (w !== wrap) { w.classList.remove("open"); w.querySelector(".pg-select-menu").classList.remove("show"); } });
        renderOptions();
        menu.classList.add("show");
        wrap.classList.add("open");
      }
      function closeMenu() {
        menu.classList.remove("show");
        wrap.classList.remove("open");
      }
      trigger.addEventListener("click", function () {
        wrap.classList.contains("open") ? closeMenu() : openMenu();
      });
      sel.addEventListener("change", syncTrigger);
      document.addEventListener("click", function (e) {
        if (!wrap.contains(e.target)) closeMenu();
      });
      syncTrigger();
    });
  }

  /* Managed-list dropdown: a select-style control backed by an editable list of
     strings (e.g. Bed Configurations, Meal Plans) with inline "+ Add New" and a
     delete (x) per option. Renders into `container`; calls onChange(value) when
     the selection changes, and persists list add/remove via getList/setList. */
  function renderManagedSelect(container, opts) {
    var current = opts.value;
    var wrap = document.createElement("div");
    wrap.className = "pg-select";
    var trigger = document.createElement("div");
    trigger.className = "pg-select-trigger";
    var menu = document.createElement("div");
    menu.className = "pg-select-menu";
    wrap.appendChild(trigger);
    wrap.appendChild(menu);
    container.innerHTML = "";
    container.appendChild(wrap);

    function syncTrigger() { trigger.textContent = current || "Select…"; }
    function renderMenu() {
      menu.innerHTML = "";
      opts.getList().forEach(function (item) {
        var row = document.createElement("div");
        row.className = "pg-select-option" + (item === current ? " selected" : "");
        var label = document.createElement("span");
        label.textContent = item;
        row.appendChild(label);
        var del = document.createElement("span");
        del.className = "del";
        del.textContent = "×";
        del.title = "Remove this option";
        del.addEventListener("mousedown", function (e) {
          e.preventDefault(); e.stopPropagation();
          if (opts.getList().length <= 1) { toast("At least one option must remain.", "danger"); return; }
          if (!confirm('Remove "' + item + '" from this list?')) return;
          var list = opts.getList().filter(function (x) { return x !== item; });
          opts.setList(list);
          if (current === item) { current = list[0]; opts.onChange(current); syncTrigger(); }
          renderMenu();
        });
        row.appendChild(del);
        row.addEventListener("mousedown", function (e) {
          if (e.target === del) return;
          e.preventDefault();
          current = item;
          syncTrigger();
          opts.onChange(current);
          closeMenu();
        });
        menu.appendChild(row);
      });
      var addRow = document.createElement("div");
      addRow.className = "pg-select-add";
      addRow.textContent = "+ Add New…";
      addRow.addEventListener("mousedown", function (e) {
        e.preventDefault();
        var formRow = document.createElement("div");
        formRow.className = "pg-select-add-form";
        formRow.innerHTML = '<input type="text" placeholder="' + (opts.placeholder || "New option") + '"><button type="button">Add</button>';
        addRow.replaceWith(formRow);
        var input = formRow.querySelector("input");
        input.focus();
        function commit() {
          var v = input.value.trim();
          if (!v) return;
          var list = opts.getList();
          if (list.indexOf(v) === -1) { list.push(v); opts.setList(list); }
          current = v;
          syncTrigger();
          opts.onChange(current);
          renderMenu();
        }
        formRow.querySelector("button").addEventListener("mousedown", function (e) { e.preventDefault(); commit(); });
        input.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); commit(); } });
      });
      menu.appendChild(addRow);
    }
    function openMenu() {
      document.querySelectorAll(".pg-select.open").forEach(function (w) { if (w !== wrap) { w.classList.remove("open"); w.querySelector(".pg-select-menu").classList.remove("show"); } });
      renderMenu();
      menu.classList.add("show");
      wrap.classList.add("open");
    }
    function closeMenu() { menu.classList.remove("show"); wrap.classList.remove("open"); }
    trigger.addEventListener("click", function () { wrap.classList.contains("open") ? closeMenu() : openMenu(); });
    document.addEventListener("click", function (e) { if (!wrap.contains(e.target)) closeMenu(); });
    syncTrigger();
  }

  /* ---------------------------------------------------------------- */
  /* Change Room drawer — a structured, filterable room picker shared by New       */
  /* Reservation and Reservation Detail. Never an unstructured <select>: there is  */
  /* too much per-room information (floor, bed, view, accessibility, connecting,   */
  /* eligibility) to compare in a dropdown.                                        */
  /* opts: { roomTypeId, checkIn, checkOut, preferences, currentRoomId,            */
  /*         excludeRoomIds, excludeAssignmentId, title, summaryLabel, summarySub, */
  /*         onConfirm(newRoomId) }                                                */
  /* ---------------------------------------------------------------- */
  var changeRoomDrawerEl = null;
  function ensureChangeRoomDrawer() {
    if (changeRoomDrawerEl) return changeRoomDrawerEl;
    changeRoomDrawerEl = document.createElement("div");
    changeRoomDrawerEl.className = "pg-drawer-overlay";
    changeRoomDrawerEl.id = "pgChangeRoomDrawer";
    document.body.appendChild(changeRoomDrawerEl);
    return changeRoomDrawerEl;
  }
  function uniqueValues(arr) {
    var out = [];
    arr.forEach(function (v) { if (v != null && v !== "" && out.indexOf(v) === -1) out.push(v); });
    return out;
  }
  function renderChangeRoomDrawer(opts) {
    var state = getState();
    var el = ensureChangeRoomDrawer();
    var allRooms = physicalRoomsForType(state, opts.roomTypeId);
    var prefs = opts.preferences || {};
    var filters = { q: "", floor: "all", view: "all", bed: "all", access: "all", connecting: "all" };
    var pendingRoomId = null;

    function rowsData() {
      return allRooms.map(function (room) {
        var isCurrent = room.id === opts.currentRoomId;
        var usedElsewhere = !isCurrent && (opts.excludeRoomIds || []).indexOf(room.id) > -1;
        var trueReason = usedElsewhere ? "Assigned to another room in this reservation" : roomIneligibilityReason(state, room, opts.checkIn, opts.checkOut, prefs, opts.excludeAssignmentId);
        // The currently assigned room is never disabled (it's already picked), but its
        // reason still surfaces as a "Needs Attention" note if it has since become ineligible.
        return { room: room, isCurrent: isCurrent, reason: isCurrent ? null : trueReason, needsAttention: isCurrent ? trueReason : null, prefMatch: roomPreferenceMatchCount(room, prefs) };
      });
    }
    function passesFilters(row) {
      var r = row.room;
      if (filters.q && r.roomNumber.toLowerCase().indexOf(filters.q) === -1) return false;
      if (filters.floor !== "all" && String(r.floor) !== filters.floor) return false;
      if (filters.view !== "all" && r.view !== filters.view) return false;
      if (filters.bed !== "all" && r.bedConfiguration !== filters.bed) return false;
      if (filters.access !== "all" && (r.accessibilityFeatures || []).indexOf(filters.access) === -1) return false;
      if (filters.connecting === "yes" && !(r.connectingRoomIds && r.connectingRoomIds.length)) return false;
      return true;
    }
    function sortedRows() {
      var rows = rowsData().filter(passesFilters);
      var eligible = rows.filter(function (r) { return !r.reason; });
      var ineligible = rows.filter(function (r) { return r.reason; });
      var rankedRooms = rankRoomsForAssignment(state, eligible.map(function (r) { return r.room; }), opts.checkIn, opts.checkOut, prefs);
      var rankedEligible = rankedRooms.map(function (room) { return eligible.find(function (r) { return r.room.id === room.id; }); });
      ineligible.sort(function (a, b) { return a.room.roomNumber < b.room.roomNumber ? -1 : 1; });
      return rankedEligible.concat(ineligible);
    }

    function optionsFor(field) {
      return uniqueValues(allRooms.map(function (r) { return field === "access" ? null : r[field]; })).sort();
    }
    var floorOpts = uniqueValues(allRooms.map(function (r) { return r.floor; })).sort(function (a, b) { return a - b; });
    var viewOpts = uniqueValues(allRooms.map(function (r) { return r.view; })).sort();
    var bedOpts = uniqueValues(allRooms.map(function (r) { return r.bedConfiguration; })).sort();
    var accessOpts = uniqueValues(allRooms.reduce(function (a, r) { return a.concat(r.accessibilityFeatures || []); }, [])).sort();

    function renderChip(text) { return '<span class="chip">' + esc(text) + "</span>"; }
    function renderRoomRow(row) {
      var r = row.room;
      var disabled = !!row.reason;
      var badges = "";
      if (row.isCurrent) {
        badges += '<span class="badge badge-blue"><span class="badge-dot"></span>Currently Assigned</span> ';
        if (row.needsAttention) badges += '<span class="badge badge-red"><span class="badge-dot"></span>Needs Attention: ' + esc(row.needsAttention) + "</span>";
      }
      else if (!disabled && row.prefMatch > 0) badges += '<span class="badge badge-green"><span class="badge-dot"></span>Matches Preference</span> ';
      else if (!disabled) badges += '<span class="badge badge-gray"><span class="badge-dot"></span>Recommended</span> ';
      if (disabled) badges += '<span class="badge badge-red"><span class="badge-dot"></span>' + esc(row.reason) + "</span>";
      var attrBits = [r.view, r.bedConfiguration].concat(r.accessibilityFeatures || []);
      if (r.connectingRoomIds && r.connectingRoomIds.length) {
        var nums = r.connectingRoomIds.map(function (id) { var pr = allRooms.find(function (x) { return x.id === id; }) || state.physicalRooms.find(function (x) { return x.id === id; }); return pr ? pr.roomNumber : id; });
        attrBits.push("Connects: " + nums.join(", "));
      }
      return '<div class="crd-room' + (disabled ? " disabled" : "") + (pendingRoomId === r.id ? " selected" : "") + '" data-room-id="' + r.id + '">' +
        '<div class="crd-room-top"><strong>Room ' + esc(r.roomNumber) + "</strong><span class=\"muted text-sm\">Floor " + r.floor + "</span></div>" +
        '<div style="margin:6px 0;">' + badges + "</div>" +
        '<div class="crd-attrs">' + attrBits.map(renderChip).join("") + "</div>" +
      "</div>";
    }

    function renderList() {
      var rows = sortedRows();
      var listEl = el.querySelector("#crd-list");
      if (!rows.length) { listEl.innerHTML = '<div class="empty-state">No rooms match these filters.</div>'; return; }
      listEl.innerHTML = rows.map(renderRoomRow).join("");
      listEl.querySelectorAll(".crd-room:not(.disabled)").forEach(function (card) {
        card.addEventListener("click", function () {
          var id = card.dataset.roomId;
          pendingRoomId = (id === opts.currentRoomId) ? null : id;
          renderList();
          renderImpact();
        });
      });
    }
    function renderImpact() {
      var box = el.querySelector("#crd-impact");
      var confirmBtn = el.querySelector("#crd-confirm");
      if (!pendingRoomId) { box.innerHTML = ""; confirmBtn.disabled = true; return; }
      var newRoom = allRooms.find(function (r) { return r.id === pendingRoomId; });
      var oldRoom = opts.currentRoomId ? (allRooms.find(function (r) { return r.id === opts.currentRoomId; }) || state.physicalRooms.find(function (r) { return r.id === opts.currentRoomId; })) : null;
      box.innerHTML = '<div class="help-note" style="margin-top:14px;">' +
        (oldRoom ? "Room " + esc(oldRoom.roomNumber) + " will be replaced by Room " + esc(newRoom.roomNumber) + "." : "Room " + esc(newRoom.roomNumber) + " will be assigned.") +
        " Pricing and dates are unchanged." +
      "</div>";
      confirmBtn.disabled = false;
    }

    el.innerHTML = '<div class="pg-drawer">' +
      '<div class="pg-drawer-header"><div><h3>' + esc(opts.title || "Change Room") + '</h3>' +
        (opts.summaryLabel ? '<div class="muted text-sm">' + esc(opts.summaryLabel) + (opts.summarySub ? " &middot; " + esc(opts.summarySub) : "") + "</div>" : "") +
      '</div><button class="pg-modal-close" id="crd-close">&times;</button></div>' +
      '<div class="pg-drawer-body">' +
        '<input class="form-control" id="crd-search" placeholder="Search by room number" style="margin-bottom:12px;">' +
        '<div class="crd-filters">' +
          '<select class="form-control" id="crd-floor"><option value="all">All Floors</option>' + floorOpts.map(function (f) { return '<option value="' + f + '">Floor ' + f + "</option>"; }).join("") + "</select>" +
          '<select class="form-control" id="crd-view"><option value="all">All Views</option>' + viewOpts.map(function (v) { return '<option value="' + esc(v) + '">' + esc(v) + "</option>"; }).join("") + "</select>" +
          '<select class="form-control" id="crd-bed"><option value="all">All Bed Configs</option>' + bedOpts.map(function (b) { return '<option value="' + esc(b) + '">' + esc(b) + "</option>"; }).join("") + "</select>" +
          '<select class="form-control" id="crd-access"><option value="all">All Accessibility</option>' + accessOpts.map(function (a) { return '<option value="' + esc(a) + '">' + esc(a) + "</option>"; }).join("") + "</select>" +
          '<select class="form-control" id="crd-connecting"><option value="all">Connecting: Any</option><option value="yes">Has Connecting Room</option></select>' +
        "</div>" +
        '<div id="crd-list" style="margin-top:14px;display:flex;flex-direction:column;gap:8px;max-height:calc(100vh - 400px);overflow-y:auto;"></div>' +
        '<div id="crd-impact"></div>' +
      "</div>" +
      '<div class="pg-drawer-footer"><button class="btn btn-light" id="crd-cancel">Cancel</button><button class="btn btn-primary" id="crd-confirm" disabled>Confirm Room Change</button></div>' +
    "</div>";
    enhanceSelects(el);
    pendingRoomId = null;
    renderList();
    renderImpact();

    el.querySelector("#crd-close").addEventListener("click", function () { closeModal("pgChangeRoomDrawer"); });
    el.querySelector("#crd-cancel").addEventListener("click", function () { closeModal("pgChangeRoomDrawer"); });
    el.querySelector("#crd-search").addEventListener("input", function () { filters.q = this.value.trim().toLowerCase(); renderList(); });
    el.querySelector("#crd-floor").addEventListener("change", function () { filters.floor = this.value; renderList(); });
    el.querySelector("#crd-view").addEventListener("change", function () { filters.view = this.value; renderList(); });
    el.querySelector("#crd-bed").addEventListener("change", function () { filters.bed = this.value; renderList(); });
    el.querySelector("#crd-access").addEventListener("change", function () { filters.access = this.value; renderList(); });
    el.querySelector("#crd-connecting").addEventListener("change", function () { filters.connecting = this.value; renderList(); });
    el.querySelector("#crd-confirm").addEventListener("click", function () {
      if (!pendingRoomId) return;
      var chosen = pendingRoomId;
      closeModal("pgChangeRoomDrawer");
      opts.onConfirm(chosen);
    });
    openModal("pgChangeRoomDrawer");
  }

  /* ---------------------------------------------------------------- */
  /* Room Block create modal — shared by physical-rooms.html's Block Room     */
  /* action and operations-calendar.html's drag-to-create-block interaction   */
  /* and per-row Block quick action, so both surfaces use one implementation  */
  /* of the same conflict-check/confirm/audit rules (§ "Do not duplicate      */
  /* business rules" between Physical Rooms and the Operations Calendar).     */
  /* opts: { physicalRoomId, defaultStart, defaultEnd (YYYY-MM-DD, inclusive),*/
  /*         onSaved(block) }                                                 */
  /* ---------------------------------------------------------------- */
  var BLOCK_TYPES = ["Out of Order", "Out of Service", "Management Hold", "Other"];
  var blockRoomModalEl = null;
  function ensureBlockRoomModal() {
    if (blockRoomModalEl) return blockRoomModalEl;
    blockRoomModalEl = document.createElement("div");
    blockRoomModalEl.className = "pg-modal-overlay";
    blockRoomModalEl.id = "pgBlockRoomModal";
    document.body.appendChild(blockRoomModalEl);
    return blockRoomModalEl;
  }
  function renderBlockRoomModal(opts) {
    var state = getState();
    var el = ensureBlockRoomModal();
    var room = state.physicalRooms.find(function (p) { return p.id === opts.physicalRoomId; });
    if (!room) { toast("Room not found.", "danger"); return; }
    var rt = state.roomTypes.find(function (r) { return r.id === room.roomTypeId; });
    var typeOptions = BLOCK_TYPES.map(function (t) { return '<option value="' + t + '">' + t + "</option>"; }).join("");

    el.innerHTML = '<div class="pg-modal">' +
      '<div class="pg-modal-header"><h3>Block Room</h3><button class="pg-modal-close" id="pgbr-close">&times;</button></div>' +
      '<div class="pg-modal-body">' +
        '<div class="form-group"><label class="form-label">Room</label><input class="form-control" value="Room ' + esc(room.roomNumber) + " — " + esc(rt ? rt.name : "") + '" disabled></div>' +
        '<div class="form-group"><label class="form-label">Block Type</label><select class="form-control" id="pgbr-type">' + typeOptions + "</select></div>" +
        '<div class="grid-2">' +
          '<div class="form-group"><label class="form-label">Start Date</label><input type="date" class="form-control" id="pgbr-start" value="' + (opts.defaultStart || TODAY) + '"></div>' +
          '<div class="form-group"><label class="form-label">End Date</label><input type="date" class="form-control" id="pgbr-end" value="' + (opts.defaultEnd || opts.defaultStart || TODAY) + '"></div>' +
        "</div>" +
        '<div class="form-group"><label class="form-label">Reason <span class="opt">(required)</span></label><input class="form-control" id="pgbr-reason" placeholder="e.g. Plumbing repair, deep cleaning"></div>' +
        '<div class="form-group"><label class="form-label">Notes <span class="opt">(optional)</span></label><textarea class="form-control" id="pgbr-notes"></textarea></div>' +
        '<div id="pgbr-impact"></div>' +
        '<div id="pgbr-conflict"></div>' +
      "</div>" +
      '<div class="pg-modal-footer"><button class="btn btn-light" id="pgbr-cancel">Cancel</button><button class="btn btn-danger" id="pgbr-save">Block Room</button></div>' +
    "</div>";
    enhanceSelects(el);

    function refreshImpact() {
      var type = document.getElementById("pgbr-type").value;
      var destructive = type === "Out of Order" || type === "Out of Service";
      var box = document.getElementById("pgbr-impact");
      box.className = "help-note " + (destructive ? "help-note-danger" : "help-note-warning");
      box.textContent = destructive
        ? "This will remove Room " + room.roomNumber + " from sellable availability for the selected dates."
        : "This will place a temporary hold on Room " + room.roomNumber + ", outside normal sale, for the selected dates.";
    }
    function checkConflicts() {
      var fresh = getState();
      var start = document.getElementById("pgbr-start").value, endIncl = document.getElementById("pgbr-end").value;
      var box = document.getElementById("pgbr-conflict"), saveBtn = document.getElementById("pgbr-save");
      if (!start || !endIncl || endIncl < start) { box.innerHTML = ""; saveBtn.disabled = false; return; }
      var endExclusive = addDays(endIncl, 1);
      var overlapping = assignmentsOverlapping(fresh, room.id, start, endExclusive);
      if (!overlapping.length) { box.innerHTML = ""; saveBtn.disabled = false; return; }
      var rows = overlapping.map(function (a) {
        var res = fresh.reservations.find(function (r) { return r.id === a.reservationId; });
        var cust = res ? fresh.customers.find(function (c) { return c.id === res.customerId; }) : null;
        return '<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid rgba(0,0,0,.08);font-size:12.5px;gap:8px;">' +
          "<span><a href=\"reservation-detail.html?id=" + a.reservationId + "\" target=\"_blank\">" + a.reservationId + "</a>" + (cust ? " · " + esc(cust.name) : "") +
            '<div class="muted text-sm">' + fmtDateShort(a.arrivalDate) + "–" + fmtDateShort(a.departureDate) + (a.assignmentStatus === "Held" ? " · Held" : "") + "</div></span>" +
          '<button type="button" class="btn btn-outline btn-sm pgbr-conflict-change" data-assignment="' + a.id + '">Change Room</button>' +
        "</div>";
      }).join("");
      box.innerHTML = '<div class="help-note help-note-danger" style="margin-top:12px;flex-direction:column;align-items:stretch;">' +
        '<div style="font-weight:700;margin-bottom:6px;">Room ' + esc(room.roomNumber) + " cannot be blocked from " + fmtDateShort(start) + " to " + fmtDateShort(endIncl) + " — it conflicts with " + overlapping.length + " existing assignment" + (overlapping.length === 1 ? "" : "s") + ".</div>" +
        rows +
        '<div style="margin-top:8px;">Resolve or reassign the affected reservation' + (overlapping.length === 1 ? "" : "s") + " before applying this block." + "</div>" +
      "</div>";
      saveBtn.disabled = true;
      box.querySelectorAll(".pgbr-conflict-change").forEach(function (btn) {
        btn.addEventListener("click", function () {
          openChangeRoomForBlockConflict(btn.dataset.assignment, checkConflicts);
        });
      });
    }
    // Shares the exact revalidate-then-swap logic every other Change Room call site uses.
    function openChangeRoomForBlockConflict(assignmentId, onDone) {
      var fresh = getState();
      var a = fresh.roomAssignments.find(function (x) { return x.id === assignmentId; });
      var res = fresh.reservations.find(function (r) { return r.id === a.reservationId; });
      var item = res.rooms.find(function (x) { return x.id === a.reservationItemId; });
      var cust = fresh.customers.find(function (c) { return c.id === res.customerId; });
      var otherRoomIds = [];
      res.rooms.forEach(function (it) {
        if (it.id === item.id) return;
        fresh.roomAssignments.filter(function (x) { return x.reservationItemId === it.id && x.assignmentStatus !== "Cancelled"; }).forEach(function (x) { otherRoomIds.push(x.physicalRoomId); });
      });
      renderChangeRoomDrawer({
        roomTypeId: item.roomTypeId, checkIn: a.arrivalDate, checkOut: a.departureDate,
        preferences: {}, currentRoomId: a.physicalRoomId, excludeRoomIds: otherRoomIds, excludeAssignmentId: a.id,
        title: "Change Room", summaryLabel: res.id + " · " + (cust ? cust.name : "Guest"),
        summarySub: fmtDateShort(a.arrivalDate) + " – " + fmtDateShort(a.departureDate),
        onConfirm: function (newRoomId) {
          try {
            var st2 = getState();
            var newRoom = st2.physicalRooms.find(function (p) { return p.id === newRoomId; });
            if (!newRoom || !roomEligibleForStay(st2, newRoom, a.arrivalDate, a.departureDate, a.id)) {
              toast("That room is no longer available — the previous assignment has been kept.", "danger");
              return;
            }
            var oldRoom = st2.physicalRooms.find(function (p) { return p.id === a.physicalRoomId; });
            var rec = st2.roomAssignments.find(function (x) { return x.id === assignmentId; });
            rec.physicalRoomId = newRoomId; rec.assignedAt = nowIso(); rec.assignedBy = CURRENT_ROLE;
            var idx = st2.reservations.findIndex(function (r) { return r.id === res.id; });
            st2.reservations[idx].activity.push({ ts: nowIso(), text: "Room changed from " + (oldRoom ? oldRoom.roomNumber : "—") + " to " + newRoom.roomNumber + " while resolving a block conflict." });
            setState(st2);
            addAudit("Room Assignment Changed", res.id + " — room changed from " + (oldRoom ? oldRoom.roomNumber : "—") + " to " + newRoom.roomNumber + " (resolving a block conflict).");
            toast("Room " + newRoom.roomNumber + " assigned.", "success");
            if (onDone) onDone();
          } catch (e) {
            toast("Failed to save changes — the previous room assignment has been kept.", "danger");
          }
        }
      });
    }

    document.getElementById("pgbr-close").addEventListener("click", function () { closeModal("pgBlockRoomModal"); });
    document.getElementById("pgbr-cancel").addEventListener("click", function () { closeModal("pgBlockRoomModal"); });
    document.getElementById("pgbr-type").addEventListener("change", refreshImpact);
    document.getElementById("pgbr-start").addEventListener("change", checkConflicts);
    document.getElementById("pgbr-end").addEventListener("change", checkConflicts);
    refreshImpact();
    checkConflicts();

    document.getElementById("pgbr-save").addEventListener("click", function () {
      var type = document.getElementById("pgbr-type").value;
      var start = document.getElementById("pgbr-start").value;
      var endIncl = document.getElementById("pgbr-end").value;
      var reason = document.getElementById("pgbr-reason").value.trim();
      var notes = document.getElementById("pgbr-notes").value.trim();
      if (!start || !endIncl || endIncl < start) { toast("Please choose a valid date range.", "danger"); return; }
      if (!reason) { toast("A reason is required to block a room.", "danger"); return; }
      var endExclusive = addDays(endIncl, 1);
      try {
        var fresh = getState();
        // Revalidate immediately before saving — state may have changed since the modal opened.
        var overlapping = assignmentsOverlapping(fresh, room.id, start, endExclusive);
        if (overlapping.length) { toast("Resolve or reassign the affected reservation(s) before applying this block.", "danger"); return; }
        var block = {
          id: "blk-" + Date.now(), propertyId: fresh.hotel.propertyCode, physicalRoomId: room.id,
          startDate: start, endDate: endExclusive, type: type, reason: reason, notes: notes,
          createdAt: nowIso(), createdBy: CURRENT_ROLE
        };
        fresh.roomBlocks.push(block);
        setState(fresh);
        addAudit("Physical Room Blocked", "Room " + room.roomNumber + " blocked (" + type + "), " + fmtDateShort(start) + " to " + fmtDateShort(endIncl) + ". Reason: " + reason + ".");
        toast("Room " + room.roomNumber + " blocked for the selected dates.", "warn");
        closeModal("pgBlockRoomModal");
        if (opts.onSaved) opts.onSaved(block);
      } catch (e) {
        toast("Failed to save changes. Please try again.", "danger");
      }
    });
    openModal("pgBlockRoomModal");
  }

  /* ---------------------------------------------------------------- */
  /* Guest (customer) Add/Edit drawer — shared by guests.html and             */
  /* guest-detail.html. Guests are hotel customers, kept technically and      */
  /* conceptually separate from state.users (staff accounts).                */
  /* opts: { editingId (string|null), onSaved(guestId) }                      */
  /* ---------------------------------------------------------------- */
  var GUEST_LANGUAGES = ["Arabic", "English", "Other"];
  var GUEST_COMM_PREFS = ["Email", "Phone", "WhatsApp", "SMS"];
  var guestDrawerEl = null;
  function ensureGuestDrawer() {
    if (guestDrawerEl) return guestDrawerEl;
    guestDrawerEl = document.createElement("div");
    guestDrawerEl.className = "pg-drawer-overlay";
    guestDrawerEl.id = "pgGuestDrawer";
    document.body.appendChild(guestDrawerEl);
    return guestDrawerEl;
  }
  function normPhoneForMatch(p) { return (p || "").replace(/\D/g, ""); }
  function normEmailForMatch(e) { return (e || "").trim().toLowerCase(); }
  function renderGuestDrawer(opts) {
    var state = getState();
    var el = ensureGuestDrawer();
    var editingId = opts.editingId || null;
    var cust = editingId ? state.customers.find(function (c) { return c.id === editingId; }) : null;
    var duplicateConfirmed = false;

    var langOptions = GUEST_LANGUAGES.map(function (l) { return '<option value="' + l + '"' + (cust && cust.preferredLanguage === l ? " selected" : "") + '>' + l + "</option>"; }).join("");
    var commOptions = GUEST_COMM_PREFS.map(function (c) { return '<option value="' + c + '"' + (cust && cust.communicationPreference === c ? " selected" : "") + '>' + c + "</option>"; }).join("");
    var natOptions = REF.countries.map(function (c) { return '<option value="' + c + '"' + (cust && cust.nationality === c ? " selected" : "") + '>' + c + "</option>"; }).join("");

    el.innerHTML = '<div class="pg-drawer">' +
      '<div class="pg-drawer-header"><h3>' + (cust ? "Edit Guest" : "Add Guest") + '</h3><button class="pg-modal-close" onclick="PG.closeModal(\'pgGuestDrawer\')">&times;</button></div>' +
      '<div class="pg-drawer-body">' +
        '<div class="form-group"><label class="form-label">Full Name <span class="opt">(required)</span></label><input class="form-control" id="pgg-name" value="' + (cust ? esc(cust.name) : "") + '"><div class="field-error" id="pgg-err-name"></div></div>' +
        '<div class="grid-2">' +
          '<div class="form-group"><label class="form-label">Phone <span class="opt">(required)</span></label><input class="form-control" id="pgg-phone" value="' + (cust ? esc(cust.phone) : "") + '"><div class="field-error" id="pgg-err-phone"></div></div>' +
          '<div class="form-group"><label class="form-label">Email <span class="opt">(optional)</span></label><input class="form-control" id="pgg-email" value="' + (cust ? esc(cust.email || "") : "") + '"></div>' +
          '<div class="form-group"><label class="form-label">Nationality</label><select class="form-control" id="pgg-nationality"><option value="">—</option>' + natOptions + "</select></div>" +
          '<div class="form-group"><label class="form-label">Preferred Language</label><select class="form-control" id="pgg-language">' + langOptions + "</select></div>" +
          '<div class="form-group"><label class="form-label">Identification Reference <span class="opt">(optional)</span></label><input class="form-control" id="pgg-idref" value="' + (cust ? esc(cust.idRef || "") : "") + '"></div>' +
          '<div class="form-group"><label class="form-label">Communication Preference</label><select class="form-control" id="pgg-commpref">' + commOptions + "</select></div>" +
        "</div>" +
        '<div class="form-check"><input type="checkbox" id="pgg-consent"' + (cust && cust.consentMarketing ? " checked" : "") + '><label class="form-label" style="margin:0;" for="pgg-consent">Consents to marketing communications</label></div>' +
        '<div class="form-check" style="margin-top:10px;"><input type="checkbox" id="pgg-important"' + (cust && cust.important ? " checked" : "") + '><label class="form-label" style="margin:0;" for="pgg-important">Mark as Important / VIP</label></div>' +
        '<div class="form-group" style="margin-top:16px;"><label class="form-label">Room &amp; Stay Preferences <span class="opt">(optional)</span></label><textarea class="form-control" id="pgg-roomprefs">' + (cust ? esc(cust.roomPreferences || "") : "") + "</textarea></div>" +
        '<div class="form-group"><label class="form-label">Accessibility Needs <span class="opt">(optional)</span></label><textarea class="form-control" id="pgg-access">' + (cust ? esc(cust.accessibilityNeeds || "") : "") + "</textarea></div>" +
        '<div class="form-group"><label class="form-label">Internal Notes <span class="opt">(optional)</span></label><textarea class="form-control" id="pgg-notes">' + (cust ? esc(cust.notes || "") : "") + "</textarea></div>" +
        '<div id="pgg-dup-warning"></div>' +
      "</div>" +
      '<div class="pg-drawer-footer"><button class="btn btn-light" onclick="PG.closeModal(\'pgGuestDrawer\')">Cancel</button><button class="btn btn-primary" id="pgg-save">' + (cust ? "Save Changes" : "Add Guest") + "</button></div>" +
    "</div>";
    enhanceSelects(el);

    function findDuplicate(phone, email) {
      var np = normPhoneForMatch(phone), ne = normEmailForMatch(email);
      var fresh = getState();
      return fresh.customers.find(function (c) {
        if (c.id === editingId) return false;
        if (np && normPhoneForMatch(c.phone) === np) return true;
        if (ne && normEmailForMatch(c.email) === ne) return true;
        return false;
      }) || null;
    }
    function showDuplicateWarning(dup) {
      var box = document.getElementById("pgg-dup-warning");
      box.innerHTML = '<div class="help-note help-note-warning" style="margin-top:14px;flex-direction:column;align-items:stretch;">' +
        '<div style="font-weight:700;margin-bottom:6px;">&#9888; Possible duplicate guest</div>' +
        "<div>This phone or email closely matches an existing guest profile:</div>" +
        '<div style="border:1px solid var(--pg-border);border-radius:8px;padding:10px 12px;margin-top:10px;background:#fff;"><strong>' + esc(dup.name) + '</strong><div class="muted text-sm">' + esc(dup.phone || "—") + " &middot; " + esc(dup.email || "—") + "</div></div>" +
        '<div style="display:flex;gap:8px;margin-top:10px;">' +
          '<button type="button" class="btn btn-outline btn-sm" id="pgg-dup-use">Use Existing Guest</button>' +
          '<button type="button" class="btn btn-primary btn-sm" id="pgg-dup-continue">Continue Creating New Guest</button>' +
        "</div>" +
      "</div>";
      document.getElementById("pgg-dup-use").addEventListener("click", function () {
        closeModal("pgGuestDrawer");
        opts.onSaved(dup.id, { usedExisting: true });
      });
      document.getElementById("pgg-dup-continue").addEventListener("click", function () {
        duplicateConfirmed = true;
        box.innerHTML = "";
        save();
      });
    }
    function save() {
      document.getElementById("pgg-err-name").textContent = "";
      document.getElementById("pgg-err-phone").textContent = "";
      document.getElementById("pgg-name").classList.remove("error");
      document.getElementById("pgg-phone").classList.remove("error");

      var name = document.getElementById("pgg-name").value.trim();
      var phone = document.getElementById("pgg-phone").value.trim();
      var hasError = false;
      if (!name) { document.getElementById("pgg-err-name").textContent = "Full name is required."; document.getElementById("pgg-name").classList.add("error"); hasError = true; }
      if (!phone) { document.getElementById("pgg-err-phone").textContent = "Phone is required."; document.getElementById("pgg-phone").classList.add("error"); hasError = true; }
      if (hasError) { toast("Please fix the highlighted fields.", "danger"); return; }

      var email = document.getElementById("pgg-email").value.trim();
      if (!duplicateConfirmed) {
        var dup = findDuplicate(phone, email);
        if (dup) { showDuplicateWarning(dup); return; }
      }

      var data = {
        name: name, phone: phone, email: email,
        nationality: document.getElementById("pgg-nationality").value,
        preferredLanguage: document.getElementById("pgg-language").value,
        idRef: document.getElementById("pgg-idref").value.trim(),
        communicationPreference: document.getElementById("pgg-commpref").value,
        consentMarketing: document.getElementById("pgg-consent").checked,
        important: document.getElementById("pgg-important").checked,
        roomPreferences: document.getElementById("pgg-roomprefs").value.trim(),
        accessibilityNeeds: document.getElementById("pgg-access").value.trim(),
        notes: document.getElementById("pgg-notes").value.trim()
      };

      try {
        var st = getState();
        var resultId;
        if (editingId) {
          var idx = st.customers.findIndex(function (c) { return c.id === editingId; });
          st.customers[idx] = Object.assign({}, st.customers[idx], data);
          resultId = editingId;
          setState(st);
          addAudit("Guest Updated", name + "'s profile was updated.");
          toast("Guest updated.", "success");
        } else {
          resultId = "cus-" + Date.now();
          st.customers.push(Object.assign({ id: resultId }, data));
          setState(st);
          addAudit("Guest Created", name + " added as a new guest.");
          toast("Guest added.", "success");
        }
        closeModal("pgGuestDrawer");
        opts.onSaved(resultId, { usedExisting: false });
      } catch (e) {
        toast("Failed to save changes. Please try again.", "danger");
      }
    }
    document.getElementById("pgg-save").addEventListener("click", save);
    openModal("pgGuestDrawer");
  }

  /* ---------------------------------------------------------------- */
  /* Delete Guest — shared confirm modal, used identically by                */
  /* guests.html's row menu and guest-detail.html's More menu. Permanent     */
  /* deletion is only offered when the guest has zero reservations (which    */
  /* transitively covers payments and any reservation-linked activity) and   */
  /* no non-profile audit trail; guest identity/history frozen inside past   */
  /* reservations (Reservation.customerId, guest names copied into activity  */
  /* text, etc.) is never touched by this — only state.customers is.        */
  /* opts: { guestId, canManage, onDeleted(guestId) }                        */
  /* ---------------------------------------------------------------- */
  function guestLinkedDataSummary(state, guestId) {
    var cust = state.customers.find(function (c) { return c.id === guestId; });
    var reservations = state.reservations.filter(function (r) { return r.customerId === guestId; });
    // "Guest Created"/"Guest Updated" are bookkeeping for the profile itself (and will be
    // superseded by the "Guest Deleted" entry this same action writes) — they don't count
    // as the kind of historical/linked record that should block deletion. Anything else
    // mentioning the guest's name (reservation activity, payments, other operational audit)
    // does.
    var nonProfileAudit = (state.audit || []).filter(function (a) {
      if (a.action === "Guest Created" || a.action === "Guest Updated") return false;
      return cust && a.details && a.details.indexOf(cust.name) > -1;
    });
    return { reservationCount: reservations.length, auditCount: nonProfileAudit.length, blocked: reservations.length > 0 || nonProfileAudit.length > 0 };
  }
  var deleteGuestModalEl = null;
  function ensureDeleteGuestModal() {
    if (deleteGuestModalEl) return deleteGuestModalEl;
    deleteGuestModalEl = document.createElement("div");
    deleteGuestModalEl.className = "pg-modal-overlay";
    deleteGuestModalEl.id = "pgDeleteGuestModal";
    document.body.appendChild(deleteGuestModalEl);
    return deleteGuestModalEl;
  }
  function renderDeleteGuestModal(opts) {
    var state = getState();
    var el = ensureDeleteGuestModal();
    var cust = state.customers.find(function (c) { return c.id === opts.guestId; });
    if (!cust) { toast("Guest not found — it may have already been deleted.", "danger"); return; }

    // Permission-denied state — defensive; both call sites already hide the Delete action
    // itself when the viewer can't manage guests, so this only fires if invoked directly.
    if (!opts.canManage) {
      el.innerHTML = '<div class="pg-modal"><div class="pg-modal-header"><h3>Delete Guest</h3><button class="pg-modal-close" id="pgdg-close">&times;</button></div>' +
        '<div class="pg-modal-body"><div class="help-note help-note-danger">You don’t have permission to delete guests. Contact a Hotel Admin to request access.</div></div>' +
        '<div class="pg-modal-footer"><button class="btn btn-primary" id="pgdg-close2">Close</button></div></div>';
      el.querySelector("#pgdg-close").addEventListener("click", function () { closeModal("pgDeleteGuestModal"); });
      el.querySelector("#pgdg-close2").addEventListener("click", function () { closeModal("pgDeleteGuestModal"); });
      openModal("pgDeleteGuestModal");
      return;
    }

    var linked = guestLinkedDataSummary(state, opts.guestId);

    // Deletion-blocked state — explain why, and point at the alternative if one exists.
    // No archive/deactivate feature exists for guests in this prototype (only Physical
    // Rooms has an Active/Inactive lifecycle) — per instructions, this does not invent one;
    // it simply says the profile has to stay to preserve reservation/activity history.
    if (linked.blocked) {
      var reasonBits = [];
      if (linked.reservationCount) reasonBits.push(linked.reservationCount + " reservation" + (linked.reservationCount === 1 ? "" : "s") + " (including any payments)");
      if (linked.auditCount) reasonBits.push(linked.auditCount + " recorded activity/audit entr" + (linked.auditCount === 1 ? "y" : "ies"));
      el.innerHTML = '<div class="pg-modal"><div class="pg-modal-header"><h3>Delete Guest</h3><button class="pg-modal-close" id="pgdg-close">&times;</button></div>' +
        '<div class="pg-modal-body">' +
          '<div class="help-note help-note-danger" style="flex-direction:column;align-items:stretch;">' +
            "<div style=\"font-weight:700;margin-bottom:6px;\">&#9888; " + esc(cust.name) + " cannot be permanently deleted.</div>" +
            "<div>This guest has " + reasonBits.join(" and ") + " on file. Deleting a guest with reservation, payment, or activity history would permanently corrupt those records.</div>" +
          "</div>" +
          '<div class="help-note" style="margin-top:12px;">There is no archive/deactivate option for guests in this prototype — the profile must remain on file to preserve that history. You can still edit the profile, or view it from the guest’s reservations.</div>' +
        "</div>" +
        '<div class="pg-modal-footer"><button class="btn btn-primary" id="pgdg-close2">Close</button></div></div>';
      el.querySelector("#pgdg-close").addEventListener("click", function () { closeModal("pgDeleteGuestModal"); });
      el.querySelector("#pgdg-close2").addEventListener("click", function () { closeModal("pgDeleteGuestModal"); });
      openModal("pgDeleteGuestModal");
      return;
    }

    // Confirm state — deletion is actually permitted.
    el.innerHTML = '<div class="pg-modal"><div class="pg-modal-header"><h3>Delete Guest</h3><button class="pg-modal-close" id="pgdg-close">&times;</button></div>' +
      '<div class="pg-modal-body">' +
        '<div class="help-note help-note-danger" style="flex-direction:column;align-items:stretch;">' +
          "<div>You are about to permanently delete <strong>" + esc(cust.name) + "</strong>.</div>" +
          "<div style=\"margin-top:6px;\">This action cannot be undone.</div>" +
        "</div>" +
        '<div class="text-sm muted" style="margin-top:10px;">This guest has no reservations, payments, or recorded activity on file.</div>' +
        '<div id="pgdg-status" style="margin-top:12px;"></div>' +
      "</div>" +
      '<div class="pg-modal-footer"><button class="btn btn-light" id="pgdg-cancel">Cancel</button><button class="btn btn-danger" id="pgdg-confirm">Delete Guest</button></div></div>';

    function setButtonsDisabled(disabled) {
      el.querySelector("#pgdg-cancel").disabled = disabled;
      el.querySelector("#pgdg-confirm").disabled = disabled;
      el.querySelector("#pgdg-close").style.visibility = disabled ? "hidden" : "visible";
    }
    el.querySelector("#pgdg-close").addEventListener("click", function () { closeModal("pgDeleteGuestModal"); });
    el.querySelector("#pgdg-cancel").addEventListener("click", function () { closeModal("pgDeleteGuestModal"); });
    el.querySelector("#pgdg-confirm").addEventListener("click", function () {
      setButtonsDisabled(true);
      document.getElementById("pgdg-status").innerHTML = '<div class="help-note">Deleting guest…</div>';
      // Simulated latency, consistent with every other mutate-then-refresh action in this
      // prototype (e.g. reservation-detail.html's save()) — gives the loading state a beat
      // to actually be visible rather than resolving instantly.
      setTimeout(function () {
        try {
          var fresh = getState();
          var idx = fresh.customers.findIndex(function (c) { return c.id === opts.guestId; });
          if (idx === -1) throw new Error("Guest no longer exists.");
          // Re-check immediately before writing — state may have changed since the modal
          // opened (e.g. a reservation was created for this guest in another tab).
          var recheck = guestLinkedDataSummary(fresh, opts.guestId);
          if (recheck.blocked) throw new Error("This guest now has linked records and can no longer be deleted.");
          var removedName = fresh.customers[idx].name;
          fresh.customers.splice(idx, 1);
          setState(fresh);
          addAudit("Guest Deleted", removedName + "’s guest profile was permanently deleted by " + CURRENT_ROLE + ".");
          toast("Guest deleted.", "success");
          closeModal("pgDeleteGuestModal");
          opts.onDeleted(opts.guestId);
        } catch (e) {
          setButtonsDisabled(false);
          document.getElementById("pgdg-status").innerHTML = '<div class="help-note help-note-danger">Failed to delete guest' + (e && e.message ? ' — ' + esc(e.message) : '') + '. Please try again.</div>';
          toast("Failed to delete guest. Please try again.", "danger");
        }
      }, 500);
    });
    openModal("pgDeleteGuestModal");
  }

  /* ---------------------------------------------------------------- */
  /* Public API                                                         */
  /* ---------------------------------------------------------------- */
  global.PG = {
    TODAY: TODAY,
    CURRENT_ROLE: CURRENT_ROLE,
    addDays: addDays,
    fmtDate: fmtDate,
    fmtDateShort: fmtDateShort,
    weekdayOf: weekdayOf,
    dayOfWeek: dayOfWeek,
    nightsBetween: nightsBetween,
    dateRange: dateRange,
    nowIso: nowIso,
    fmtMoney: fmtMoney,
    getState: getState,
    setState: setState,
    resetState: resetState,
    addAudit: addAudit,
    computeAvailability: computeAvailability,
    dateAdjustmentFor: dateAdjustmentFor,
    validateAvailability: validateAvailability,
    bookedCount: bookedCount,
    isStopSell: isStopSell,
    rateFor: rateFor,
    computePricing: computePricing,
    activeSellablePhysicalCount: activeSellablePhysicalCount,
    availabilityBreakdown: availabilityBreakdown,
    HOLD_MINUTES: HOLD_MINUTES,
    holdExpiryFromNow: holdExpiryFromNow,
    releaseExpiredHolds: releaseExpiredHolds,
    physicalRoomsForType: physicalRoomsForType,
    isPhysicalRoomBlocked: isPhysicalRoomBlocked,
    isPhysicalRoomAssigned: isPhysicalRoomAssigned,
    physicalRoomBlockOn: physicalRoomBlockOn,
    assignmentsForRoom: assignmentsForRoom,
    assignmentsOverlapping: assignmentsOverlapping,
    currentOrNextAssignment: currentOrNextAssignment,
    upcomingAssignmentsForRoom: upcomingAssignmentsForRoom,
    roomStatusOn: roomStatusOn,
    eligiblePhysicalRooms: eligiblePhysicalRooms,
    eligiblePhysicalRoomCount: eligiblePhysicalRoomCount,
    validateRoomAssignmentCapacity: validateRoomAssignmentCapacity,
    roomStatusBadge: roomStatusBadge,
    roomEligibleForStay: roomEligibleForStay,
    roomMeetsRequirements: roomMeetsRequirements,
    roomIneligibilityReason: roomIneligibilityReason,
    eligiblePhysicalRoomsForStay: eligiblePhysicalRoomsForStay,
    rankRoomsForAssignment: rankRoomsForAssignment,
    autoAssignRoomsForItem: autoAssignRoomsForItem,
    computeDateChangeImpact: computeDateChangeImpact,
    applyDateChangeImpact: applyDateChangeImpact,
    generatePaymentLink: generatePaymentLink,
    recordPaymentOutcome: recordPaymentOutcome,
    renderRecordRefundModal: renderRecordRefundModal,
    globalSearch: globalSearch,
    exportCsv: exportCsv,
    renderChangeRoomDrawer: renderChangeRoomDrawer,
    renderBlockRoomModal: renderBlockRoomModal,
    renderGuestDrawer: renderGuestDrawer,
    renderDeleteGuestModal: renderDeleteGuestModal,
    statusBadge: statusBadge,
    payBadge: payBadge,
    esc: esc,
    occupancyLabel: occupancyLabel,
    toast: toast,
    mount: mount,
    openModal: openModal,
    closeModal: closeModal,
    enhanceSelects: enhanceSelects,
    renderManagedSelect: renderManagedSelect,
    REF: REF
  };
})(window);
