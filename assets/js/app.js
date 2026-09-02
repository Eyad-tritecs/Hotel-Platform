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
    // Every property-scoped record (room types, physical rooms, assignments, blocks,
    // reservations, guests, rates/ratePlans, taxesFees, audit) carries this same
    // propertyId — this pilot only ever seeds one property, but every collection is
    // scoped consistently so a second property could be added later without a
    // data-model change, only a real property switcher UI (none exists yet — see
    // README §5.2/§10 and the header's single-property pill, which already gives every
    // page clear property context).
    var PROPERTY_ID = "PGH-001";
    // Property-scoped amenity catalog (§5). Three distinct scopes — 'property',
    // 'roomType', 'physicalRoom' — deliberately kept as separate items rather than one
    // shared list with a checkbox per level, so each host page's selector only ever
    // offers amenities that actually make sense there. Room View, Bed Configuration,
    // Operational Status, Room Type, Building and Floor stay their own dedicated
    // fields (see roomViews/bedConfigs/etc.) and are never catalog entries.
    var AMENITY_CATALOG = [
      { id: "am-parking", name: "Parking", category: "Parking and Transportation", scope: "property" },
      { id: "am-pool", name: "Swimming Pool", category: "Pool, Spa, and Wellness", scope: "property" },
      { id: "am-gym", name: "Gym", category: "Pool, Spa, and Wellness", scope: "property" },
      { id: "am-restaurant", name: "Restaurant", category: "Food and Beverage", scope: "property" },
      { id: "am-spa", name: "Spa", category: "Pool, Spa, and Wellness", scope: "property" },
      { id: "am-shuttle", name: "Airport Shuttle", category: "Parking and Transportation", scope: "property" },
      { id: "am-elevator", name: "Elevator", category: "General Guest Services", scope: "property" },
      { id: "am-reception", name: "Reception", category: "General Guest Services", scope: "property" },
      { id: "am-bizcenter", name: "Business Center", category: "Business Services", scope: "property" },
      { id: "am-wifi-common", name: "Common-area Wi-Fi", category: "Business Services", scope: "property" },
      { id: "am-meeting", name: "Meeting Facilities", category: "Business Services", scope: "property" },
      { id: "am-ev", name: "Electric Vehicle Charging", category: "Parking and Transportation", scope: "property" },

      { id: "am-ac", name: "Air Conditioning", category: "Room Features", scope: "roomType" },
      { id: "am-tv", name: "Television", category: "Entertainment", scope: "roomType" },
      { id: "am-wifi-room", name: "In-room Wi-Fi", category: "Room Features", scope: "roomType" },
      { id: "am-minibar", name: "Minibar", category: "Kitchen", scope: "roomType" },
      { id: "am-safe", name: "Safe", category: "Room Features", scope: "roomType" },
      { id: "am-privatebath", name: "Private Bathroom", category: "Bathroom", scope: "roomType" },
      { id: "am-hairdryer", name: "Hair Dryer", category: "Bathroom", scope: "roomType" },
      { id: "am-desk", name: "Work Desk", category: "Room Features", scope: "roomType" },
      { id: "am-balcony", name: "Balcony", category: "Room Features", scope: "roomType" },
      { id: "am-kitchenette", name: "Kitchenette", category: "Kitchen", scope: "roomType" },
      { id: "am-coffeemaker", name: "Coffee Maker", category: "Kitchen", scope: "roomType" },
      { id: "am-iron", name: "Iron", category: "Room Features", scope: "roomType" },
      { id: "am-phone", name: "Telephone", category: "Room Features", scope: "roomType" },
      { id: "am-toiletries", name: "Toiletries", category: "Bathroom", scope: "roomType" },

      { id: "am-accbath", name: "Accessible Bathroom", category: "Accessibility", scope: "physicalRoom" },
      { id: "am-connectdoor", name: "Connecting Door", category: "Room Features", scope: "physicalRoom" },
      { id: "am-corner", name: "Corner Room", category: "Room Features", scope: "physicalRoom" },
      { id: "am-nearelevator", name: "Near Elevator", category: "Room Features", scope: "physicalRoom" },
      { id: "am-quiet", name: "Quiet Location", category: "Room Features", scope: "physicalRoom" },
      { id: "am-renovated", name: "Recently Renovated", category: "Room Features", scope: "physicalRoom" },
      { id: "am-widedoor", name: "Extra-wide Door", category: "Accessibility", scope: "physicalRoom" },
      { id: "am-rollinshower", name: "Roll-in Shower", category: "Accessibility", scope: "physicalRoom" }
    ].map(function (a) {
      return { id: a.id, propertyId: PROPERTY_ID, name: a.name, nameLocalized: null, category: a.category,
        scope: a.scope, standard: true, active: true, iconKey: null,
        createdBy: "Hotel Admin", createdDate: TODAY, updatedBy: null, updatedDate: null };
    });
    var roomTypes = [
      { id: "std", propertyId: PROPERTY_ID, name: "Standard Room", code: "STD", sellable: 10, baseCapacity: 10, maxAdults: 2, maxChildren: 0, bed: "1 Queen Bed", baseRate: 100, active: true, desc: "Comfortable entry-level room with modern amenities, ideal for solo travelers and couples.",
        amenities: ["am-ac", "am-tv", "am-wifi-room", "am-safe", "am-privatebath", "am-hairdryer", "am-toiletries", "am-phone"] },
      { id: "dlx", propertyId: PROPERTY_ID, name: "Deluxe Room", code: "DLX", sellable: 6, baseCapacity: 6, maxAdults: 2, maxChildren: 1, bed: "1 King Bed", baseRate: 120, active: true, desc: "Spacious upgraded room with premium furnishings and city views.",
        amenities: ["am-ac", "am-tv", "am-wifi-room", "am-minibar", "am-safe", "am-privatebath", "am-hairdryer", "am-desk", "am-toiletries", "am-phone", "am-coffeemaker"] },
      { id: "fam", propertyId: PROPERTY_ID, name: "Family Room", code: "FAM", sellable: 4, baseCapacity: 4, maxAdults: 2, maxChildren: 2, bed: "1 Queen + 2 Single Beds", baseRate: 150, active: true, desc: "Generous layout designed for families, with separate sleeping areas.",
        amenities: ["am-ac", "am-tv", "am-wifi-room", "am-minibar", "am-safe", "am-privatebath", "am-hairdryer", "am-desk", "am-toiletries", "am-phone", "am-kitchenette"] }
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
      { id: "cus-1", propertyId: PROPERTY_ID, name: "Ahmad Khalil", phone: "+970 59 123 4567", email: "ahmad.khalil@example.com", nationality: "Palestinian",
        preferredLanguage: "Arabic", idRef: "PSE-778812345", communicationPreference: "WhatsApp", consentMarketing: true,
        roomPreferences: "", accessibilityNeeds: "", important: false, notes: "" },
      { id: "cus-2", propertyId: PROPERTY_ID, name: "Sara Ali", phone: "+970 56 234 5678", email: "sara.ali@example.com", nationality: "Palestinian",
        preferredLanguage: "Arabic", idRef: "PSE-556690012", communicationPreference: "Phone", consentMarketing: false,
        roomPreferences: "Prefers high floor, away from the elevator.", accessibilityNeeds: "", important: true, notes: "Requested late check-out on a previous stay." },
      { id: "cus-3", propertyId: PROPERTY_ID, name: "Omar Hassan", phone: "+962 79 345 6789", email: "omar.hassan@example.com", nationality: "Jordanian",
        preferredLanguage: "English", idRef: "JOR-223345678", communicationPreference: "Email", consentMarketing: true,
        roomPreferences: "", accessibilityNeeds: "Wheelchair accessible room required.", important: false, notes: "" },
      { id: "cus-4", propertyId: PROPERTY_ID, name: "Layla Nasser", phone: "+970 59 876 5432", email: "layla.nasser@example.com", nationality: "Palestinian",
        preferredLanguage: "Arabic", idRef: "PSE-990011223", communicationPreference: "WhatsApp", consentMarketing: false,
        roomPreferences: "", accessibilityNeeds: "", important: false, notes: "" }
    ];

    var reservations = [
      {
        id: "RES-10245", propertyId: PROPERTY_ID,
        customerId: "cus-1",
        source: "Phone",
        createdAt: TODAY + "T10:15",
        checkIn: "2026-08-20",
        checkOut: "2026-08-23",
        status: "Confirmed",
        paymentStatus: "Paid",
        paymentMethod: "Payment Link",
        rooms: [
          { id: "RES-10245-itm-1", roomTypeId: "dlx", qty: 2, ratePlanId: "rp-dlx-flex", adults: 2, children: 0 },
          { id: "RES-10245-itm-2", roomTypeId: "fam", qty: 1, ratePlanId: "rp-fam-flex", adults: 2, children: 2 }
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
        id: "RES-10246", propertyId: PROPERTY_ID,
        customerId: "cus-2",
        source: "Phone",
        createdAt: TODAY + "T11:40",
        checkIn: "2026-08-22",
        checkOut: "2026-08-24",
        status: "Confirmed",
        paymentStatus: "Pay on Arrival",
        paymentMethod: "Pay on Arrival",
        rooms: [
          { id: "RES-10246-itm-1", roomTypeId: "std", qty: 1, ratePlanId: "rp-std-flex", adults: 2, children: 0 }
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
        id: "RES-10247", propertyId: PROPERTY_ID,
        customerId: "cus-3",
        source: "Travel Agency",
        createdAt: TODAY + "T08:05",
        checkIn: addDays(TODAY, 1),
        checkOut: addDays(TODAY, 2),
        status: "Pending Payment",
        paymentStatus: "Expired",
        paymentMethod: "Payment Link",
        rooms: [{ id: "RES-10247-itm-1", roomTypeId: "fam", qty: 1, ratePlanId: "rp-fam-flex", adults: 2, children: 1 }],
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
        id: "RES-10248", propertyId: PROPERTY_ID,
        customerId: "cus-4",
        source: "Phone",
        createdAt: TODAY + "T09:30",
        checkIn: addDays(TODAY, 1),
        checkOut: addDays(TODAY, 3),
        status: "Pending Payment",
        paymentStatus: "Payment Required",
        paymentMethod: "Pay on Arrival",
        rooms: [{ id: "RES-10248-itm-1", roomTypeId: "std", qty: 1, ratePlanId: "rp-std-flex", adults: 2, children: 0 }],
        taxAmount: 0,
        feeAmount: 0,
        notes: "",
        activity: [
          { ts: TODAY + "T09:30", text: "Reservation created via Phone by Hotel Admin." },
          { ts: TODAY + "T09:31", text: "Room 103 held for this reservation." }
        ]
      }
    ];

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
      { id: "std-105", propertyId: PROPERTY_ID, roomTypeId: "std", roomNumber: "105", building: "Main Building", floor: 1, bedConfiguration: "2 Single Beds", view: "Courtyard View", accessibilityFeatures: ["Wheelchair Accessible", "Grab Bars"], features: ["am-accbath", "am-widedoor"], connectingRoomIds: [], notes: "ADA-compliant accessible room.", isActive: true, isSellable: true, operationalStatus: "Available" },
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
    // Every physical room not given exceptional features explicitly above just
    // inherits its Room Type's amenities with no extras — features defaults to [].
    physicalRooms.forEach(function (r) { if (!r.features) r.features = []; });

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

    var seed = {
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
        policySummary: "Free cancellation up to 24 hours before arrival. Standard check-in is 14:00 and check-out is 12:00. Full payment is due at check-in unless the reservation was prepaid via Payment Link.",
        amenities: ["am-parking", "am-pool", "am-gym", "am-restaurant", "am-wifi-common", "am-reception", "am-elevator", "am-shuttle"]
      },
      amenityCatalog: AMENITY_CATALOG,
      roomTypes: roomTypes,
      physicalRooms: physicalRooms,
      roomAssignments: roomAssignments,
      roomBlocks: roomBlocks,
      rates: rates,
      bedConfigs: ["1 Queen Bed", "1 King Bed", "1 Queen + 2 Single Beds", "2 Single Beds", "2 Double Beds"],
      // Reusable, property-scoped Room View options (§3). Seeded with every view
      // already used on a physical room below, plus the prototype's example set, so
      // nothing already assigned ever points at a missing option.
      roomViews: ["Old City View", "Courtyard View", "Garden View", "City View", "Sea View", "Pool View", "Mountain View", "No Specific View"],
      mealPlans: ["Room Only", "Breakfast Included", "Half Board", "Full Board"],
      inventoryOverrides: {}, // key "roomTypeId|date" -> {stopSell:true, reason}
      dateAdjustments: {}, // key "roomTypeId|date" -> cumulative sellable-quantity delta for that date
      adjustments: [], // manual sellable-quantity adjustments
      customers: customers,
      reservations: reservations,
      nextResId: 10249,
      // A one-off price typed into a single Price Calendar cell, keyed
      // "roomTypeId|ratePlanId|date". The most specific of the pricing layers
      // (see resolvePrice) — seeded empty, so nothing starts out "Manual".
      rateOverrides: {},

      // Rate Plans are commercial offers attached to a room type. Each carries its own
      // BASE PRICE — the default nightly rate used whenever no pricing period covers a
      // date — and a SCOPE that either sells across the whole room type or narrows to
      // specific physical rooms. Dates and overrides live in named pricing periods, never
      // on the plan itself (do NOT reintroduce a flat startDate/endDate on a plan).
      //
      //   scope: "roomType" → every room of plan.roomTypeId
      //   scope: "rooms"    → only plan.physicalRoomIds (all of that same type)
      //
      // The Thu/Fri weekend markup that used to be buried inside the per-date `rates`
      // calendar is now expressed where an operator can actually see and edit it: a named
      // "Weekend Premium" pricing period on each default plan. That is the whole point of
      // this model — a seasonal or weekly price rule should be a named, editable object,
      // not an invisible per-date number.
      ratePlans: [
        /* ---- Standard Room (base 100) --------------------------------------- */
        { id: "rp-std-flex", propertyId: PROPERTY_ID, roomTypeId: "std", scope: "roomType", physicalRoomIds: [],
          name: "Flexible Rate", code: "FLEX-STD", mealPlan: "Room Only", basePrice: 100, currency: "USD",
          description: "Fully flexible, free cancellation up to 24 hours before arrival.",
          active: true, isDefault: true, createdAt: addDays(TODAY, -60) + "T09:00:00.000Z", updatedAt: addDays(TODAY, -6) + "T11:20:00.000Z",
          periods: [
            { id: "pp-std-flex-weekend", name: "Weekend Premium", startDate: addDays(TODAY, -30), endDate: addDays(TODAY, 180),
              daysOfWeek: [4, 5], mode: "same", prices: { same: 120 }, active: true,
              createdAt: addDays(TODAY, -60) + "T09:02:00.000Z", updatedAt: addDays(TODAY, -6) + "T11:20:00.000Z" },
            { id: "pp-std-flex-summer", name: "The Summer Vacation", startDate: addDays(TODAY, 31), endDate: addDays(TODAY, 120),
              daysOfWeek: [0, 1, 2, 3, 6], mode: "same", prices: { same: 130 }, active: true,
              createdAt: addDays(TODAY, -20) + "T10:00:00.000Z", updatedAt: addDays(TODAY, -6) + "T11:20:00.000Z" }
          ] },
        // Narrowed scope: this offer is only sold on the ten first-floor Standard rooms.
        { id: "rp-std-bb", propertyId: PROPERTY_ID, roomTypeId: "std", scope: "rooms",
          physicalRoomIds: ["std-101","std-102","std-103","std-104","std-105","std-106","std-107","std-108","std-109","std-110"],
          name: "Breakfast Included", code: "BB-STD", mealPlan: "Breakfast Included", basePrice: 120, currency: "USD",
          description: "Includes full breakfast for all occupants. First-floor rooms only.",
          active: true, isDefault: false, createdAt: addDays(TODAY, -55) + "T12:00:00.000Z", updatedAt: addDays(TODAY, -9) + "T15:10:00.000Z",
          periods: [
            { id: "pp-std-bb-summer", name: "The Summer Vacation", startDate: addDays(TODAY, 31), endDate: addDays(TODAY, 120),
              daysOfWeek: [0, 1, 2, 3, 4, 5, 6], mode: "byday",
              prices: { "0": 145, "1": 145, "2": 145, "3": 145, "4": 170, "5": 170, "6": 150 }, active: true,
              createdAt: addDays(TODAY, -30) + "T12:00:00.000Z", updatedAt: addDays(TODAY, -9) + "T15:10:00.000Z" }
          ] },
        { id: "rp-std-nr", propertyId: PROPERTY_ID, roomTypeId: "std", scope: "roomType", physicalRoomIds: [],
          name: "Non-Refundable Rate", code: "NRF-STD", mealPlan: "Room Only", basePrice: 90, currency: "USD",
          description: "Lower rate in exchange for a non-refundable, non-changeable booking.",
          active: true, isDefault: false, createdAt: addDays(TODAY, -60) + "T09:05:00.000Z", updatedAt: addDays(TODAY, -14) + "T08:40:00.000Z",
          periods: [
            { id: "pp-std-nr-summer", name: "The Summer Vacation", startDate: addDays(TODAY, 31), endDate: addDays(TODAY, 120),
              daysOfWeek: [0, 1, 2, 3, 4, 5, 6], mode: "same", prices: { same: 115 }, active: true,
              createdAt: addDays(TODAY, -20) + "T09:05:00.000Z", updatedAt: addDays(TODAY, -14) + "T08:40:00.000Z" }
          ] },
        // Demonstrates the inactive-plan state: configured and priced, but not bookable.
        { id: "rp-std-early", propertyId: PROPERTY_ID, roomTypeId: "std", scope: "roomType", physicalRoomIds: [],
          name: "Early Bird Offer", code: "EB-STD", mealPlan: "Room Only", basePrice: 85, currency: "USD",
          description: "Advance-purchase offer — currently switched off.",
          active: false, isDefault: false, createdAt: addDays(TODAY, -40) + "T14:00:00.000Z", updatedAt: addDays(TODAY, -25) + "T14:00:00.000Z",
          periods: [] },

        /* ---- Deluxe Room (base 120) ----------------------------------------- */
        { id: "rp-dlx-flex", propertyId: PROPERTY_ID, roomTypeId: "dlx", scope: "roomType", physicalRoomIds: [],
          name: "Flexible Rate", code: "FLEX-DLX", mealPlan: "Room Only", basePrice: 120, currency: "USD",
          description: "Fully flexible, free cancellation up to 24 hours before arrival.",
          active: true, isDefault: true, createdAt: addDays(TODAY, -60) + "T09:10:00.000Z", updatedAt: addDays(TODAY, -6) + "T11:22:00.000Z",
          periods: [
            { id: "pp-dlx-flex-weekend", name: "Weekend Premium", startDate: addDays(TODAY, -30), endDate: addDays(TODAY, 180),
              daysOfWeek: [4, 5], mode: "same", prices: { same: 140 }, active: true,
              createdAt: addDays(TODAY, -60) + "T09:12:00.000Z", updatedAt: addDays(TODAY, -6) + "T11:22:00.000Z" },
            { id: "pp-dlx-flex-summer", name: "The Summer Vacation", startDate: addDays(TODAY, 31), endDate: addDays(TODAY, 120),
              daysOfWeek: [0, 1, 2, 3, 6], mode: "same", prices: { same: 155 }, active: true,
              createdAt: addDays(TODAY, -20) + "T10:05:00.000Z", updatedAt: addDays(TODAY, -6) + "T11:22:00.000Z" }
          ] },
        { id: "rp-dlx-bb", propertyId: PROPERTY_ID, roomTypeId: "dlx", scope: "roomType", physicalRoomIds: [],
          name: "Breakfast Included", code: "BB-DLX", mealPlan: "Breakfast Included", basePrice: 140, currency: "USD",
          description: "Includes full breakfast for all occupants.",
          active: true, isDefault: false, createdAt: addDays(TODAY, -55) + "T12:05:00.000Z", updatedAt: addDays(TODAY, -9) + "T15:12:00.000Z",
          periods: [
            { id: "pp-dlx-bb-summer", name: "The Summer Vacation", startDate: addDays(TODAY, 31), endDate: addDays(TODAY, 120),
              daysOfWeek: [0, 1, 2, 3, 4, 5, 6], mode: "byday",
              prices: { "0": 165, "1": 165, "2": 165, "3": 165, "4": 190, "5": 190, "6": 175 }, active: true,
              createdAt: addDays(TODAY, -30) + "T12:05:00.000Z", updatedAt: addDays(TODAY, -9) + "T15:12:00.000Z" }
          ] },
        // Sun–Thu only AND strict: Fri/Sat resolve to a real Missing Price state.
        { id: "rp-dlx-corp", propertyId: PROPERTY_ID, roomTypeId: "dlx", scope: "rooms",
          physicalRoomIds: ["dlx-301","dlx-302","dlx-303","dlx-304"],
          name: "Corporate Rate", code: "CORP-DLX", mealPlan: "Breakfast Included", basePrice: 105, currency: "USD",
          description: "Negotiated corporate rate. Business nights only (Sunday–Thursday), four contracted rooms.",
          active: true, isDefault: false, strictPeriodPricing: true,
          createdAt: addDays(TODAY, -45) + "T08:00:00.000Z", updatedAt: addDays(TODAY, -11) + "T09:30:00.000Z",
          periods: [
            { id: "pp-dlx-corp-2026", name: "Corporate Contract 2026", startDate: TODAY, endDate: addDays(TODAY, 120),
              daysOfWeek: [0, 1, 2, 3, 4], mode: "same", prices: { same: 105 }, active: true,
              createdAt: addDays(TODAY, -45) + "T08:00:00.000Z", updatedAt: addDays(TODAY, -11) + "T09:30:00.000Z" }
          ] },

        /* ---- Family Room (base 150) ----------------------------------------- */
        { id: "rp-fam-flex", propertyId: PROPERTY_ID, roomTypeId: "fam", scope: "roomType", physicalRoomIds: [],
          name: "Flexible Rate", code: "FLEX-FAM", mealPlan: "Room Only", basePrice: 150, currency: "USD",
          description: "Fully flexible, free cancellation up to 24 hours before arrival.",
          active: true, isDefault: true, createdAt: addDays(TODAY, -60) + "T09:15:00.000Z", updatedAt: addDays(TODAY, -6) + "T11:25:00.000Z",
          periods: [
            { id: "pp-fam-flex-weekend", name: "Weekend Premium", startDate: addDays(TODAY, -30), endDate: addDays(TODAY, 180),
              daysOfWeek: [4, 5], mode: "same", prices: { same: 170 }, active: true,
              createdAt: addDays(TODAY, -60) + "T09:17:00.000Z", updatedAt: addDays(TODAY, -6) + "T11:25:00.000Z" },
            { id: "pp-fam-flex-summer", name: "The Summer Vacation", startDate: addDays(TODAY, 31), endDate: addDays(TODAY, 120),
              daysOfWeek: [0, 1, 2, 3, 6], mode: "same", prices: { same: 185 }, active: true,
              createdAt: addDays(TODAY, -20) + "T10:10:00.000Z", updatedAt: addDays(TODAY, -6) + "T11:25:00.000Z" }
          ] },
        // Two periods that overlap on DATES but share no weekday — the legitimate
        // coexistence the overlap rule allows — plus an expired one for that state.
        { id: "rp-fam-weekend", propertyId: PROPERTY_ID, roomTypeId: "fam", scope: "roomType", physicalRoomIds: [],
          name: "Weekend Offer", code: "WKND-FAM", mealPlan: "Breakfast Included", basePrice: 165, currency: "USD",
          description: "Weekend family package including breakfast.",
          active: true, isDefault: false, createdAt: addDays(TODAY, -50) + "T16:00:00.000Z", updatedAt: addDays(TODAY, -4) + "T10:45:00.000Z",
          periods: [
            { id: "pp-fam-weekend-premium", name: "Weekend Premium", startDate: TODAY, endDate: addDays(TODAY, 120),
              daysOfWeek: [4, 5, 6], mode: "same", prices: { same: 195 }, active: true,
              createdAt: addDays(TODAY, -50) + "T16:00:00.000Z", updatedAt: addDays(TODAY, -4) + "T10:45:00.000Z" },
            { id: "pp-fam-weekend-eid", name: "Eid Holiday 2026", startDate: addDays(TODAY, -90), endDate: addDays(TODAY, -80),
              daysOfWeek: [0, 1, 2, 3, 4, 5, 6], mode: "same", prices: { same: 240 }, active: true,
              createdAt: addDays(TODAY, -120) + "T09:00:00.000Z", updatedAt: addDays(TODAY, -95) + "T09:00:00.000Z" }
          ] }
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
        { id: "tf-vat", propertyId: PROPERTY_ID, name: "VAT", kind: "Tax", calcType: "Percentage", value: 4, appliesByDefault: true, active: true, effectiveFrom: null, effectiveTo: null },
        { id: "tf-muni", propertyId: PROPERTY_ID, name: "Municipality Tax", kind: "Tax", calcType: "Percentage", value: 2, appliesByDefault: false, active: false, effectiveFrom: null, effectiveTo: null },
        { id: "tf-service", propertyId: PROPERTY_ID, name: "Service Charge", kind: "Fee", calcType: "Percentage", value: 5, appliesByDefault: false, active: false, effectiveFrom: null, effectiveTo: null },
        { id: "tf-tourism", propertyId: PROPERTY_ID, name: "City Tourism Fee", kind: "Fee", calcType: "Fixed", value: 20, appliesByDefault: true, active: true, effectiveFrom: null, effectiveTo: null }
      ],
      audit: [
        { ts: TODAY + "T08:05", actor: "Hotel Admin", action: "Reservation Created", details: "RES-10247 created via Travel Agency." },
        { ts: TODAY + "T08:07", actor: "Hotel Admin", action: "Payment Link Sent", details: "Payment link sent for RES-10247." },
        { ts: TODAY + "T09:14", actor: "Hotel Admin", action: "Reservation Created", details: "RES-10245 created via Phone." },
        { ts: TODAY + "T11:40", actor: "Hotel Admin", action: "Reservation Created", details: "RES-10246 created via WhatsApp." },
        { ts: TODAY + "T09:30", actor: "Hotel Admin", action: "Reservation Created", details: "RES-10248 created via Phone. Room 103 held." }
      ]
    };

    // Booked-price snapshots for the seeded reservations. These are written EXPLICITLY,
    // at the rates that were in force when each booking was taken — not derived from
    // today’s rate plans. That is the whole point of a snapshot: a reservation carries
    // the price it was sold at, and later rate-plan work cannot reach back and change it.
    // It also means the demo ships with a visible “booked price differs from today’s
    // price” case, which Reservation Detail surfaces rather than hides.
    var BOOKED_NIGHTLY = {
      "RES-10245-itm-1": 120,  // Deluxe, sold at the pre-Weekend-Premium flat rate
      "RES-10245-itm-2": 150,  // Family, same
      "RES-10246-itm-1": 130,  // Standard, sold on a since-retired promotional rate
      "RES-10247-itm-1": 150,
      "RES-10248-itm-1": 100
    };
    seed.reservations.forEach(function (res) {
      res.rooms.forEach(function (room) {
        var plan = ratePlanById(seed, room.ratePlanId);
        if (plan) room.ratePlanName = plan.name;
        var nightly = {};
        dateRange(res.checkIn, res.checkOut).forEach(function (d) { nightly[d] = BOOKED_NIGHTLY[room.id]; });
        room.nightly = nightly;
      });
    });
    return seed;
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

        // Nested migration for rate plans. Top-level backfill cannot help here — the
        // `ratePlans` key already exists, but its SHAPE changed when plans gained a
        // scope and their own base price. Without this, a browser holding older state
        // would render every plan with a blank price and no scope. Only missing fields
        // are filled; a plan the user actually edited keeps its own values.
        (state.ratePlans || []).forEach(function (p) {
          if (!p.scope) { p.scope = (p.physicalRoomIds && p.physicalRoomIds.length) ? "rooms" : "roomType"; dirty = true; }
          if (!p.physicalRoomIds) { p.physicalRoomIds = []; dirty = true; }
          if (p.basePrice == null) {
            // Fall back to whatever the room type charged — the layer these plans used
            // to resolve against before they carried a price of their own.
            var rt = (state.roomTypes || []).find(function (r) { return r.id === p.roomTypeId; });
            p.basePrice = rt ? rt.baseRate : 0;
            dirty = true;
          }
          if (!p.currency) { p.currency = "USD"; dirty = true; }
          if (!p.periods) { p.periods = []; dirty = true; }
        });

        // Nested migration for the amenities model (§5) — same reasoning as ratePlans
        // above: these keys may already exist on an object saved before the field was
        // added to it, so the top-level backfill loop never sees them missing.
        if (state.hotel && !state.hotel.amenities) { state.hotel.amenities = []; dirty = true; }
        (state.roomTypes || []).forEach(function (rt) { if (!rt.amenities) { rt.amenities = []; dirty = true; } });
        (state.physicalRooms || []).forEach(function (r) { if (!r.features) { r.features = []; dirty = true; } });
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
  // opts (all optional, backward-compatible — every pre-existing 3-arg call site still
  // works unchanged): { property, module, recordId, previousValue, newValue, reason }.
  // `property` defaults to the current property automatically so callers don't have to
  // pass it explicitly just to get property-scoped audit records (§ audit requirements —
  // every audit entry records actor, timestamp, property, module/record, action, and
  // (when supplied) previous/new value and reason).
  function addAudit(action, details, actor, opts) {
    var s = getState();
    opts = opts || {};
    var entry = { ts: nowIso(), actor: actor || CURRENT_ROLE, action: action, details: details, property: opts.property || (s.hotel && s.hotel.propertyCode) || null };
    if (opts.module != null) entry.module = opts.module;
    if (opts.recordId != null) entry.recordId = opts.recordId;
    if (opts.previousValue !== undefined) entry.previousValue = opts.previousValue;
    if (opts.newValue !== undefined) entry.newValue = opts.newValue;
    if (opts.reason) entry.reason = opts.reason;
    s.audit.unshift(entry);
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
  /* ================================================================ */
  /* Rate Plans & Pricing engine                                       */
  /*                                                                   */
  /*   Room Type  →  Rate Plan  →  Pricing Period  →  Daily Prices     */
  /*                                                                   */
  /* A price is resolved by (Room Type + Rate Plan + Date), never by    */
  /* (Room Type + Date) alone — two plans on the same room type can     */
  /* legitimately price the same night differently. Resolution walks    */
  /* three layers, most-specific first, and always reports which layer  */
  /* produced the number so the UI can label it honestly:               */
  /*                                                                   */
  /*   1. Manual Override — state.rateOverrides["rtId|planId|date"],    */
  /*      a one-off price typed directly into a Price Calendar cell.    */
  /*   2. Period Override — the plan's active Pricing Period covering   */
  /*      that date whose daysOfWeek includes that date's weekday.      */
  /*   3. Base Price     — state.rates[rtId][date], the pre-existing    */
  /*      per-date calendar, falling back to roomTypes[].baseRate.      */
  /*                                                                   */
  /* Layer 3 is the ORIGINAL pricing model, preserved intact as the     */
  /* fallback rule §6.10 asks for — which is also why introducing rate  */
  /* plans changed no existing reservation's price by a single cent.    */
  /* ================================================================ */

  // Layer 3. Also still exported on its own so callers that genuinely want the
  // room type's own baseline (the Price Calendar's "Base" reference row, the
  // Pricing Period editor's placeholder) can ask for it without a plan.
  function basePriceFor(state, roomTypeId, dateStr) {
    var table = (state.rates || {})[roomTypeId] || {};
    if (table[dateStr] != null) return table[dateStr];
    var rt = state.roomTypes.find(function (r) { return r.id === roomTypeId; });
    return rt ? rt.baseRate : 0;
  }

  function ratePlansForType(state, roomTypeId, activeOnly) {
    return (state.ratePlans || []).filter(function (p) {
      return p.roomTypeId === roomTypeId && (!activeOnly || p.active);
    });
  }

  /* Scope — a plan always belongs to ONE room type (that is what keeps the reservation
     flow and PG.rateFor() unambiguous), and then either sells across every room of that
     type or is narrowed to specific physical rooms:

       scope: "roomType"  → all rooms of plan.roomTypeId
       scope: "rooms"     → only plan.physicalRoomIds (all of which belong to that type)

     "Breakfast Included, Rooms 101–110" is the narrowed form. Narrowing never crosses
     room types, so a room can never be offered a plan priced for a different type. */
  function planScopeLabel(state, plan) {
    if (!plan) return "—";
    var rt = state.roomTypes.find(function (r) { return r.id === plan.roomTypeId; });
    var rtName = rt ? rt.name : plan.roomTypeId;
    if (plan.scope !== "rooms") return rtName;
    var nums = planScopeRooms(state, plan).map(function (r) { return r.roomNumber; });
    if (!nums.length) return rtName + " — no rooms selected";
    return "Rooms " + summarizeRoomNumbers(nums);
  }

  function planScopeRooms(state, plan) {
    if (!plan) return [];
    var all = (state.physicalRooms || []).filter(function (r) { return r.roomTypeId === plan.roomTypeId; });
    if (plan.scope !== "rooms") return all;
    var ids = plan.physicalRoomIds || [];
    return all.filter(function (r) { return ids.indexOf(r.id) > -1; });
  }

  // "101, 102, 103, 107" → "101–103, 107". Contiguous numeric runs collapse so a plan
  // covering ten rooms reads as a range instead of a wall of numbers.
  function summarizeRoomNumbers(nums) {
    var sorted = nums.slice().sort(function (a, b) { return Number(a) - Number(b); });
    var out = [], runStart = null, prev = null;
    function flush() {
      if (runStart == null) return;
      out.push(runStart === prev ? String(runStart) : runStart + "–" + prev);
    }
    sorted.forEach(function (n) {
      var v = Number(n);
      if (prev != null && v === Number(prev) + 1) { prev = n; return; }
      flush(); runStart = n; prev = n;
    });
    flush();
    return out.join(", ");
  }

  // Which plans may be sold for a SPECIFIC physical room — the room's type's plans,
  // minus any narrowed plan that does not list this room.
  function ratePlansForRoom(state, physicalRoomId, activeOnly) {
    var room = (state.physicalRooms || []).find(function (r) { return r.id === physicalRoomId; });
    if (!room) return [];
    return ratePlansForType(state, room.roomTypeId, activeOnly).filter(function (p) {
      return p.scope !== "rooms" || (p.physicalRoomIds || []).indexOf(physicalRoomId) > -1;
    });
  }

  // The plan a bare (roomType, date) price question resolves against — the one
  // flagged isDefault, else the first active plan, else the first plan at all.
  function defaultRatePlanFor(state, roomTypeId) {
    var plans = ratePlansForType(state, roomTypeId, false);
    return plans.find(function (p) { return p.isDefault && p.active; }) ||
      plans.find(function (p) { return p.isDefault; }) ||
      plans.find(function (p) { return p.active; }) ||
      plans[0] || null;
  }

  function ratePlanById(state, ratePlanId) {
    return (state.ratePlans || []).find(function (p) { return p.id === ratePlanId; }) || null;
  }

  // "active" | "upcoming" | "expired" — relative to TODAY, used for the state
  // badges §6.6 asks for on every period row.
  function periodTimeState(period) {
    if (period.active === false) return "inactive";
    if (TODAY < period.startDate) return "upcoming";
    if (TODAY > period.endDate) return "expired";
    return "active";
  }

  function periodCoversDate(period, dateStr) {
    if (period.active === false) return false;
    if (dateStr < period.startDate || dateStr > period.endDate) return false;
    var dow = dayOfWeek(dateStr);
    var days = period.daysOfWeek || [0, 1, 2, 3, 4, 5, 6];
    return days.indexOf(dow) > -1;
  }

  // A period in "same" mode carries one price for every selected day; in "byday"
  // mode it carries one price per weekday index. Either can legitimately be
  // missing a value — that surfaces as a Missing Price state, never as $0.
  function periodPriceForDate(period, dateStr) {
    var prices = period.prices || {};
    if (period.mode === "byday") {
      var v = prices[String(dayOfWeek(dateStr))];
      return v != null && v !== "" ? Number(v) : null;
    }
    return prices.same != null && prices.same !== "" ? Number(prices.same) : null;
  }

  function overrideKey(roomTypeId, ratePlanId, dateStr) {
    return roomTypeId + "|" + ratePlanId + "|" + dateStr;
  }

  // The single price resolver. Returns the number AND its provenance, so no screen
  // ever has to display a price it can't explain (§3 "recognition instead of recall").
  //   source: "manual" | "period" | "base" | "missing"
  function resolvePrice(state, roomTypeId, ratePlanId, dateStr) {
    var plan = ratePlanById(state, ratePlanId);
    var out = {
      price: null, source: "missing", label: "Missing Price",
      planId: ratePlanId, planName: plan ? plan.name : null, planActive: plan ? !!plan.active : false,
      periodId: null, periodName: null
    };
    if (!plan) return out;

    var ov = (state.rateOverrides || {})[overrideKey(roomTypeId, ratePlanId, dateStr)];
    if (ov != null) {
      out.price = Number(ov); out.source = "manual"; out.label = "Manual Override";
      return out;
    }
    var periods = plan.periods || [];
    for (var i = 0; i < periods.length; i++) {
      if (!periodCoversDate(periods[i], dateStr)) continue;
      var p = periodPriceForDate(periods[i], dateStr);
      if (p == null) continue; // period covers the date but has no price for that weekday
      out.price = p; out.source = "period"; out.label = "Period Override";
      out.periodId = periods[i].id; out.periodName = periods[i].name;
      return out;
    }
    // A plan flagged strictPeriodPricing sells ONLY inside its named periods and
    // never falls back to a base price. That's what makes Missing Price a real,
    // reachable state rather than a theoretical one: a contracted plan restricted
    // to Sun–Thu must not quietly sell Friday at the rack rate.
    if (plan.strictPeriodPricing) return out;

    // Layer 3 — the plan's OWN base price: the default nightly rate used whenever no
    // pricing period covers the date. This is the number the Rate Plans tab edits.
    if (plan.basePrice != null && Number(plan.basePrice) > 0) {
      out.price = Number(plan.basePrice); out.source = "base"; out.label = "Base Price";
      return out;
    }

    // Layer 4 — the room type's own per-date calendar, kept as the fallback for a plan
    // that has never been given a base price of its own.
    var base = basePriceFor(state, roomTypeId, dateStr);
    if (base != null && base > 0) {
      out.price = base; out.source = "base"; out.label = "Room Type Rate";
    }
    return out;
  }

  // Backward-compatible shim. Every pre-existing PG.rateFor() call site in the app
  // predates rate plans and asks a (roomType, date) question — it resolves against
  // the room type's default plan, which is exactly what it always effectively meant.
  function rateFor(state, roomTypeId, dateStr) {
    var plan = defaultRatePlanFor(state, roomTypeId);
    if (!plan) return basePriceFor(state, roomTypeId, dateStr);
    var r = resolvePrice(state, roomTypeId, plan.id, dateStr);
    return r.price != null ? r.price : 0;
  }

  // Per-night detail for one room item, plus the same nights grouped into the
  // pricing periods they fell into — that grouping is what lets New Reservation
  // show "this stay spans Standard Season and Weekend Premium" (§6.12).
  function nightlyBreakdown(state, roomTypeId, ratePlanId, checkIn, checkOut) {
    var nights = dateRange(checkIn, checkOut).map(function (d) {
      var r = resolvePrice(state, roomTypeId, ratePlanId, d);
      return { date: d, price: r.price, source: r.source, label: r.label, periodId: r.periodId, periodName: r.periodName };
    });
    var groups = [], byKey = {};
    nights.forEach(function (n) {
      var key = (n.periodId || n.source) + "|" + n.price;
      if (!byKey[key]) {
        byKey[key] = { label: n.periodName || n.label, source: n.source, price: n.price, nights: 0, dates: [] };
        groups.push(byKey[key]);
      }
      byKey[key].nights++; byKey[key].dates.push(n.date);
    });
    var missing = nights.filter(function (n) { return n.price == null; });
    var subtotal = nights.reduce(function (a, n) { return a + (n.price || 0); }, 0);
    return { nights: nights, groups: groups, missing: missing, subtotal: subtotal, complete: missing.length === 0 };
  }

  // Error prevention (§3): a reservation may never be confirmed against a plan that
  // is inactive, belongs to another room type, or has no price for one of its nights.
  function validateRatePlanForStay(state, roomTypeId, ratePlanId, checkIn, checkOut, physicalRoomId) {
    var plan = ratePlanById(state, ratePlanId);
    if (!plan) return { ok: false, reason: "This rate plan no longer exists.", missing: [] };
    if (plan.roomTypeId !== roomTypeId) return { ok: false, reason: "This rate plan belongs to a different room type.", missing: [] };
    if (physicalRoomId && plan.scope === "rooms" && (plan.physicalRoomIds || []).indexOf(physicalRoomId) === -1) {
      return { ok: false, reason: "“" + plan.name + "” is limited to specific rooms, and this room is not one of them.", missing: [] };
    }
    if (!plan.active) return { ok: false, reason: "“" + plan.name + "” is inactive and can’t be used for new reservations.", missing: [] };
    var bd = nightlyBreakdown(state, roomTypeId, ratePlanId, checkIn, checkOut);
    if (!bd.complete) {
      var missingDates = bd.missing.map(function (m) { return m.date; });
      return {
        ok: false, missing: missingDates,
        reason: "“" + plan.name + "” has no price for " + missingDates.length + " night" + (missingDates.length === 1 ? "" : "s") +
          " of this stay (" + missingDates.slice(0, 3).map(function (d) { return fmtDateShort(d); }).join(", ") +
          (missingDates.length > 3 ? ", …" : "") + ")."
      };
    }
    return { ok: true, reason: null, missing: [], breakdown: bd };
  }

  // §6.9 — two ACTIVE periods in the same plan may not overlap on both date range
  // AND weekday, because there is no priority field in this model to break the tie.
  // Returns the conflicting periods so the editor can name them rather than just
  // refusing. Periods that overlap on dates but share no weekday are fine (that's
  // exactly how "Weekdays" + "Weekend Premium" are meant to coexist).
  function overlappingPeriods(plan, candidate, excludePeriodId) {
    if (candidate.active === false) return [];
    var candDays = candidate.daysOfWeek || [0, 1, 2, 3, 4, 5, 6];
    return (plan.periods || []).filter(function (p) {
      if (p.id === excludePeriodId || p.active === false) return false;
      if (candidate.endDate < p.startDate || candidate.startDate > p.endDate) return false;
      var days = p.daysOfWeek || [0, 1, 2, 3, 4, 5, 6];
      return days.some(function (d) { return candDays.indexOf(d) > -1; });
    });
  }

  // Every date a period currently governs — what "this change affects N nights"
  // in the period editor's confirmation is counted from.
  function periodAffectedDates(period) {
    if (!period.startDate || !period.endDate || period.endDate < period.startDate) return [];
    return dateRange(period.startDate, addDays(period.endDate, 1)).filter(function (d) {
      var days = period.daysOfWeek || [0, 1, 2, 3, 4, 5, 6];
      return days.indexOf(dayOfWeek(d)) > -1;
    });
  }

  /* ---------------------------------------------------------------- */
  /* Booked-price snapshots                                            */
  /*                                                                   */
  /* §6.11 — changing a rate plan or pricing period must never silently */
  /* reprice a reservation that is already on the books. Reservation    */
  /* room items therefore carry a `nightly` map ({date: price}) written */
  /* at booking time and rewritten only through the explicit Edit flow. */
  /* This function is the ONE place a reservation's room subtotal is    */
  /* computed; it prefers the snapshot and falls back to a live resolve */
  /* only for reservations saved before snapshots existed.              */
  /* ---------------------------------------------------------------- */
  function roomItemCharge(state, res, room) {
    var nights = dateRange(res.checkIn, res.checkOut);
    var qty = room.qty || 1;
    if (room.nightly) {
      var snapTotal = 0, complete = true;
      nights.forEach(function (d) {
        if (room.nightly[d] == null) { complete = false; return; }
        snapTotal += Number(room.nightly[d]) * qty;
      });
      if (complete) return snapTotal;
    }
    var total = 0;
    nights.forEach(function (d) {
      var price = room.ratePlanId
        ? resolvePrice(state, room.roomTypeId, room.ratePlanId, d).price
        : rateFor(state, room.roomTypeId, d);
      total += (price || 0) * qty;
    });
    return total;
  }

  function reservationRoomCharges(state, res) {
    return (res.rooms || []).reduce(function (a, room) { return a + roomItemCharge(state, res, room); }, 0);
  }

  // Full booked total including the tax/fee amounts stored on the reservation.
  // Replaces the identical 3-line loop that used to be copy-pasted into eight pages.
  function reservationTotal(state, res) {
    return reservationRoomCharges(state, res) + (res.taxAmount || 0) + (res.feeAmount || 0);
  }

  // Writes today's resolved prices onto a room item as its booked snapshot.
  // Called at reservation creation and from the reservation Edit flow — never
  // implicitly, so a rate change elsewhere can't reach an existing booking.
  function snapshotRoomItemPricing(state, room, checkIn, checkOut) {
    var planId = room.ratePlanId || (defaultRatePlanFor(state, room.roomTypeId) || {}).id;
    room.ratePlanId = planId;
    var plan = ratePlanById(state, planId);
    if (plan) room.ratePlanName = plan.name;
    var nightly = {};
    dateRange(checkIn, checkOut).forEach(function (d) {
      var r = resolvePrice(state, room.roomTypeId, planId, d);
      if (r.price != null) nightly[d] = r.price;
    });
    room.nightly = nightly;
    return room;
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
        addAudit("Refund Recorded", opts.reservationId + " — refund recorded. Reason: " + reason + ".", null,
          { module: "Payments", recordId: opts.reservationId, previousValue: "Refund Pending", newValue: "Refunded", reason: reason });
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

  /* ---------------------------------------------------------------- */
  /* Named permissions — retains the existing two roles (no new roles      */
  /* added) but replaces the old blanket "is this role Hotel Admin or      */
  /* Platform Super Admin" boolean (CAN_MANAGE, still defined per-page for  */
  /* backward compatibility) with granular, named permissions any future    */
  /* role (e.g. a read-only Front Desk role) could be given a subset of.    */
  /* Both existing roles currently hold every permission — this prototype   */
  /* has never distinguished them beyond the superAdminOnly nav flag — so   */
  /* wiring pages to PG.hasPermission() changes no observable behavior      */
  /* today, only what's possible once a narrower role is ever added.        */
  /* "unassign_rooms" is intentionally granted to nobody and checked        */
  /* nowhere: no Unassign Room action exists anywhere in this app by        */
  /* design (README §4.7's core invariant) — the key exists only so the     */
  /* permission matrix documents that this capability is deliberately       */
  /* absent, not merely forgotten.                                          */
  /* ---------------------------------------------------------------- */
  var ALL_ROLES = ["Hotel Admin", "Platform Super Admin"];
  var PERMISSIONS = {
    view_physical_rooms: ALL_ROLES,
    manage_physical_rooms: ALL_ROLES, // create / edit / deactivate
    block_rooms: ALL_ROLES, // block / unblock
    view_operations_calendar: ALL_ROLES,
    assign_rooms: ALL_ROLES, // assign / change room
    unassign_rooms: [], // deliberately granted to no one — see comment above
    view_guests: ALL_ROLES,
    manage_guests: ALL_ROLES, // create / edit (and delete, guests.html §8.3)
    view_guest_payment_history: ALL_ROLES,
    view_rates: ALL_ROLES,
    manage_rates: ALL_ROLES,
    view_payments: ALL_ROLES,
    record_refunds: ALL_ROLES,
    view_reports: ALL_ROLES,
    export_reports: ALL_ROLES
  };
  function hasPermission(key) {
    var allowed = PERMISSIONS[key];
    return !!allowed && allowed.indexOf(CURRENT_ROLE) > -1;
  }

  /* Navigation reorganized per the "Reorganize the Complete Sidebar Navigation" spec:
     6 sections ordered by what the user is trying to DO — daily operations, then rooms
     & pricing setup (physical rooms are the foundation of room assignment, room types
     define the categories physical rooms belong to, rates/pricing are configured for
     room types or physical rooms — hence that exact order), then guests, then reading
     (reports), then hotel-level configuration, then platform administration.
     Availability & Inventory stays in this array carrying hidden:true so its route,
     files, components, state, mock data, and calculations remain fully intact while
     every access point to it (sidebar, search, shortcuts, breadcrumbs) disappears —
     same mechanism as superAdminOnly, filtered alongside it in renderSidebar(). */
  var NAV = [
    { section: "Hotel Operations", items: [
      { key: "dashboard", label: "Overview Dashboard", href: "index.html", icon: "grid" },
      { key: "operations-calendar", label: "Operations Calendar", href: "operations-calendar.html", icon: "calendar" },
      { key: "reservations", label: "Reservations", href: "reservations.html", icon: "list" },
      { key: "new-reservation", label: "New Reservation", href: "new-reservation.html", icon: "plus" },
      { key: "payments", label: "Payments", href: "payments.html", icon: "card" }
    ]},
    { section: "Rooms Management & Pricing", items: [
      { key: "physical-rooms", label: "Physical Rooms", href: "physical-rooms.html", icon: "bed" },
      { key: "room-types", label: "Room Types", href: "room-types.html", icon: "roomsGroup" },
      { key: "rates", label: "Rate Plans & Pricing", href: "rates.html", icon: "tag" },
      { key: "availability", label: "Availability & Inventory", href: "availability-inventory.html", icon: "calendar", hidden: true }
    ]},
    { section: "Guest Management", items: [
      { key: "guests", label: "Guests", href: "guests.html", icon: "user" }
    ]},
    { section: "Reports & Insights", items: [
      { key: "reservation-reports", label: "Reservation Reports", href: "reservation-reports.html", icon: "chart" },
      { key: "inventory-reports", label: "Inventory Reports", href: "inventory-reports.html", icon: "boxes" },
      { key: "payment-reports", label: "Payment Reports", href: "payment-reports.html", icon: "trend" }
    ]},
    { section: "Hotel Configuration", items: [
      { key: "hotel-profile", label: "Hotel Profile", href: "hotel-profile.html", icon: "building" },
      { key: "taxes", label: "Taxes & Fees", href: "taxes-fees.html", icon: "percent" },
      { key: "policies", label: "Hotel Policies", href: "hotel-policies.html", icon: "shield" },
      { key: "payment-config", label: "Payment Configuration", href: "payment-configuration.html", icon: "settings" }
    ]},
    { section: "Administration", items: [
      { key: "hotels", label: "Hotels", href: "hotels.html", icon: "building", superAdminOnly: true },
      { key: "users", label: "Users", href: "users.html", icon: "users" },
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
    play: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M10 8.5v7l6-3.5-6-3.5Z" fill="currentColor" stroke="none"/></svg>',
    /* Functional icons (§4). One consistent 24-box line style, 1.8 stroke, no fills
       except where a glyph genuinely needs one — added so nothing in this app has to
       fall back to an emoji or a Unicode dingbat for a real control or status. */
    search: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    filter: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 5h18l-7 8v6l-4 2v-8L3 5Z"/></svg>',
    chevronLeft: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 5-7 7 7 7"/></svg>',
    chevronRight: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 5 7 7-7 7"/></svg>',
    chevronDown: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="m5 9 7 7 7-7"/></svg>',
    refresh: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 4v5h-5"/></svg>',
    check: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2"><path d="m5 13 4.5 4.5L19 7"/></svg>',
    alert: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3.5 1.8 21h20.4L12 3.5Z"/><path d="M12 10v4.5M12 17.6h.01"/></svg>',
    info: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>',
    x: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    ban: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/></svg>',
    wrench: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M15.5 3.5a5.5 5.5 0 0 0-5 7.6L3.6 18a2 2 0 1 0 2.8 2.8l6.9-6.9a5.5 5.5 0 0 0 6.6-7.3l-3 3-2.5-2.5 3-3a5.5 5.5 0 0 0-1.9-.6Z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="6" y="4.5" width="4" height="15" rx="1"/><rect x="14" y="4.5" width="4" height="15" rx="1"/></svg>',
    money: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2.5v19M16.5 6.8c-.7-1.2-2.3-1.9-4.5-1.9-2.6 0-4.2 1.1-4.2 2.9 0 4.3 9 2.2 9 6.6 0 1.9-1.8 3.1-4.6 3.1-2.4 0-4.1-.8-4.9-2.1"/></svg>',
    trend: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m3 16 5.5-5.5 3.5 3.5L21 5"/><path d="M15 5h6v6"/></svg>',
    logIn: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 3h5a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1h-5"/><path d="M10 8 6 12l4 4M6 12h9"/></svg>',
    logOut: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M10 3H5a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h5"/><path d="m15 8 4 4-4 4M19 12H9"/></svg>',
    inbox: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 13h5l1.5 3h5L16 13h5"/><path d="M4.5 5h15l1.5 8v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-5l1.5-8Z"/></svg>',
    note: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 3h9l5 5v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"/><path d="M14 3v5h5M8 13h8M8 17h5"/></svg>',
    copy: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/></svg>',
    edit: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 20h4L20 8l-4-4L4 16v4Z"/><path d="m14 6 4 4"/></svg>',
    trash: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
    dots: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" stroke="none"><circle cx="12" cy="5" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="12" cy="19" r="1.7"/></svg>',
    spark: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/></svg>',
    bell: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M18 9a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6"/><path d="M13.7 20a1.9 1.9 0 0 1-3.4 0"/></svg>',
    grip: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" stroke="none"><circle cx="9" cy="6" r="1.4"/><circle cx="15" cy="6" r="1.4"/><circle cx="9" cy="12" r="1.4"/><circle cx="15" cy="12" r="1.4"/><circle cx="9" cy="18" r="1.4"/><circle cx="15" cy="18" r="1.4"/></svg>',
    lockClosed: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8.5 11V7.5a3.5 3.5 0 0 1 7 0V11"/></svg>',
    users: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="9" cy="8" r="3.4"/><path d="M2.5 20c1.2-3.4 3.9-5 6.5-5s5.3 1.6 6.5 5"/><path d="M16 5.2a3.4 3.4 0 0 1 0 6.6M18 15.4c1.7.7 3 2.2 3.6 4.6"/></svg>',
    roomsGroup: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2.5" y="6" width="7" height="7" rx="1"/><rect x="14.5" y="6" width="7" height="7" rx="1"/><rect x="8.5" y="15" width="7" height="6" rx="1"/></svg>',
    boxes: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3 4 7v10l8 4 8-4V7l-8-4Z"/><path d="M4 7l8 4 8-4M12 11v10"/></svg>'
  };

  // Inline an icon at an explicit size. Every functional control in this app should
  // reach for this rather than pasting an emoji or Unicode arrow into a string.
  function icon(name, size) {
    var svg = ICONS[name];
    if (!svg) return "";
    if (!size) return svg;
    return svg.replace('width="16" height="16"', 'width="' + size + '" height="' + size + '"');
  }

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
        html += '<a class="pg-nav-item' + (it.key === activeKey ? " active" : "") + '" href="' + it.href + '" title="' + esc(it.label) + '"><span class="ic">' + ICONS[it.icon] + '</span><span>' + it.label + "</span></a>";
      });
      html += "</div>";
    });
    html += "</nav></aside>";
    html += '<div class="pg-sidebar-backdrop" id="pg-sidebar-backdrop"></div>';
    return html;
  }

  var CRUMB_LINKS = {
    "Dashboard": "index.html", "Overview Dashboard": "index.html", "Operations Calendar": "operations-calendar.html", "Hotel Operations": "index.html",
    "Rooms Management & Pricing": "physical-rooms.html", "Hotel Configuration": "hotel-profile.html", "Room Types": "room-types.html",
    "Physical Rooms": "physical-rooms.html", "Rate Plans & Pricing": "rates.html", "Availability & Inventory": "availability-inventory.html", "Reservations": "reservations.html",
    "New Reservation": "new-reservation.html", "Guest Management": "guests.html", "Guests": "guests.html", "Guided Journey": "demo-journey.html", "Payments": "payments.html",
    "Reports & Insights": "reservation-reports.html", "Reports": "reservation-reports.html", "Settings": "hotel-policies.html", "Hotel Policies": "hotel-policies.html", "Taxes & Fees": "taxes-fees.html",
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

    /* Demo 1's header carries only: context on the left, global search in the middle,
       and utility icons plus the user on the right. The "+ New Reservation" and
       "Reset Demo Data" buttons that used to live here were product/demo actions
       competing with the page's own primary action — New Reservation now belongs to
       each page's toolbar, and Reset Demo Data moved into the user menu where a
       destructive demo-only control belongs. */
    var html = '<header class="pg-header">';
    html += '<div class="pg-header-left">';
    html += '<button class="btn-icon pg-sidebar-toggle" id="pg-sidebar-toggle" aria-label="Open navigation menu" aria-controls="pg-app" aria-expanded="false" title="Menu">' +
      '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h18M3 12h18M3 18h18"/></svg></button>';
    html += '<div class="pg-property-ctx" title="Current property — this pilot has a single hotel, so no switcher is shown">' + ICONS.building + '<span>Palestine Grand Hotel</span></div>';
    html += '<div class="pg-breadcrumb">' + crumbHtml + "</div></div>";
    html += '<div class="pg-gsearch">' +
      '<input class="pg-gsearch-input" id="pg-gsearch-input" placeholder="Search reservations, guests, rooms, payments, rate plans…" autocomplete="off" aria-label="Global search">' +
      '<div class="pg-gsearch-panel" id="pg-gsearch-panel"></div>' +
    "</div>";
    html += '<div class="pg-header-right">';
    if (activeKey === "reservations") {
      html += '<a class="btn btn-light btn-sm" href="reservations-ar.html" title="Switch this screen to Arabic (RTL)">&#1575;&#1604;&#1593;&#1585;&#1576;&#1610;&#1577; (AR)</a>';
    }
    html += '<button class="btn-icon" id="pg-help-btn" aria-label="Help & support" title="Help & support">' + ICONS.info + '</button>';
    html += '<button class="btn-icon" id="pg-notif-btn" aria-label="Notifications" title="Notifications">' +
      '<span class="pg-notif-wrap">' + ICONS.bell + '<span class="pg-notif-dot" aria-hidden="true"></span></span></button>';
    html += '<div class="pg-user" id="pg-user-menu-btn" tabindex="0" role="button" aria-haspopup="menu" aria-expanded="false">' +
      '<div class="avatar">HA</div>' +
      '<div class="u-meta"><div class="u-name">Hotel Admin</div><div class="u-role">Palestine Grand Hotel</div></div>' +
      '<span class="u-chev">' + ICONS.chevronDown + '</span>' +
      '<div class="pg-user-menu" id="pg-user-menu" role="menu">' +
        '<div class="um-head"><div class="avatar">HA</div><div><div class="u-name">Hotel Admin</div>' +
          '<div class="u-role">admin@palestinegrand.com</div></div></div>' +
        '<a href="permissions.html" role="menuitem">' + ICONS.lock + ' My Permissions</a>' +
        '<a href="audit.html" role="menuitem">' + ICONS.clock + ' Audit Log</a>' +
        '<a href="demo-journey.html" role="menuitem">' + ICONS.play + ' Guided Journey Demo</a>' +
        '<button type="button" id="pg-reset-btn" role="menuitem" class="danger">' + ICONS.refresh + ' Reset Demo Data</button>' +
      '</div>' +
    '</div>';
    html += "</div></header>";
    return html;
  }

  // The header account menu reuses the exact same body-portal mechanism as every
  // row "more actions" kebab (openMoreMenu/closeMoreMenu) instead of its own
  // absolute-positioned dropdown. That old approach anchored the menu inside
  // .pg-header's own stacking context, so a sibling sticky element elsewhere on the
  // page with an equal-or-higher z-index (the Operations Calendar's sticky grid, most
  // notably) could paint over it, and it was subject to any clipping ancestor.
  // Portaling to <body> as position:fixed — the same fix already proven for
  // .more-menu — makes it immune to both.
  function wireUserMenu() {
    var btn = document.getElementById("pg-user-menu-btn");
    var menu = document.getElementById("pg-user-menu");
    if (!btn || !menu) return;
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      openMoreMenu(btn, menu);
    });
    btn.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); btn.click(); }
    });
    ensureMenuPortalGlobalWired();
  }

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
    // Rate plans AND the named pricing periods inside them (§6.13) — the whole point
    // of naming a period is being able to find it again by that name later. A period
    // hit reports its own plan/room type/time state so the result row is self-explaining.
    var rateItems = [];
    (state.ratePlans || []).forEach(function (p) {
      var rt = state.roomTypes.find(function (x) { return x.id === p.roomTypeId; });
      var rtName = rt ? rt.name : p.roomTypeId;
      if ((p.name + " " + (p.code || "")).toLowerCase().indexOf(q) > -1) {
        rateItems.push({ kind: "plan", planId: p.id, name: p.name, roomTypeName: rtName, state: p.active ? "active" : "inactive" });
      }
      (p.periods || []).forEach(function (pp) {
        if (pp.name.toLowerCase().indexOf(q) > -1) {
          rateItems.push({ kind: "period", planId: p.id, periodId: pp.id, name: pp.name, planName: p.name, roomTypeName: rtName, state: periodTimeState(pp) });
        }
      });
    });
    return { reservations: reservations, guests: guests, rooms: rooms, payments: payments, ratePlans: rateItems.slice(0, GSEARCH_LIMIT) };
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
      (res.ratePlans || []).forEach(function (it) {
        var row = it.kind === "period"
          ? resultRow("rateplan", it.planId, it.name, "Pricing Period · " + it.planName + " · " + it.roomTypeName + " · " + it.state)
          : resultRow("rateplan", it.planId, it.name, "Rate Plan · " + it.roomTypeName + " · " + it.state);
        row.periodId = it.periodId || null;
        out.push(row);
      });
      return out;
    }
    function openResult(item) {
      pushRecentSearch(input.value);
      if (item.kind === "reservation") location.href = "reservation-detail.html?id=" + item.id;
      else if (item.kind === "guest") location.href = "guest-detail.html?id=" + item.id;
      else if (item.kind === "room") location.href = "physical-rooms.html?room=" + item.id;
      else if (item.kind === "payment") location.href = "payments.html?id=" + item.id;
      // Opens the plan's own detail drawer, and deep-links straight into the
      // pricing-period editor when the match was a period name (§6.13).
      else if (item.kind === "rateplan") location.href = "rates.html?plan=" + item.id + (item.periodId ? "&period=" + item.periodId : "");
    }
    function renderPanel() {
      var q = input.value.trim();
      if (!q) {
        var recents = recentSearches();
        if (!recents.length) { panel.innerHTML = '<div class="pg-gsearch-empty">Start typing to search reservations, guests, rooms, payments, or rate plans.</div>'; flat = []; hi = -1; panel.classList.add("show"); return; }
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
      var groups = [["reservation", "Reservations"], ["guest", "Guests"], ["room", "Rooms"], ["payment", "Payments"], ["rateplan", "Rate Plans & Pricing"]];
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
    wireUserMenu();
    wireSidebarToggle();
    return document.getElementById("pg-page");
  }

  /* Mobile off-canvas sidebar: the "<900px" drawer state has always existed in CSS
     (.pg-sidebar.open) but had no trigger anywhere in the app — this wires the header
     hamburger, a tap-outside backdrop, Escape, and nav-link taps up to that class so the
     drawer is actually reachable on phones/tablets, in both LTR and RTL. */
  function wireSidebarToggle() {
    var sidebar = document.querySelector(".pg-sidebar");
    var toggleBtn = document.getElementById("pg-sidebar-toggle");
    var backdrop = document.getElementById("pg-sidebar-backdrop");
    if (!sidebar || !toggleBtn || !backdrop) return;

    function closeSidebar() {
      sidebar.classList.remove("open");
      backdrop.classList.remove("show");
      toggleBtn.setAttribute("aria-expanded", "false");
    }
    function openSidebar() {
      sidebar.classList.add("open");
      backdrop.classList.add("show");
      toggleBtn.setAttribute("aria-expanded", "true");
    }
    toggleBtn.addEventListener("click", function () {
      if (sidebar.classList.contains("open")) closeSidebar(); else openSidebar();
    });
    backdrop.addEventListener("click", closeSidebar);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && sidebar.classList.contains("open")) closeSidebar();
    });
    sidebar.querySelectorAll(".pg-nav-item").forEach(function (link) {
      link.addEventListener("click", closeSidebar);
    });
  }

  /* ---------------------------------------------------------------- */
  /* Modal / drawer helper — every modal and drawer in the app (there are   */
  /* dozens, built inline per page) opens/closes through these two          */
  /* functions, so accessibility behavior fixed here applies everywhere     */
  /* automatically: focus moves into the dialog and is trapped there,       */
  /* Escape closes it, aria-modal/aria-labelledby are set from its own      */
  /* heading, and focus returns to whatever triggered it on close.          */
  /* ---------------------------------------------------------------- */
  function focusableEls(container) {
    if (!container) return [];
    return Array.prototype.slice.call(container.querySelectorAll(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )).filter(function (el) { return el.offsetParent !== null; });
  }
  function openModal(id) {
    var overlay = document.getElementById(id);
    if (!overlay) return;
    var lastFocused = document.activeElement;
    overlay.classList.add("show");
    var box = overlay.querySelector(".pg-modal, .pg-drawer") || overlay;
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    var heading = box.querySelector("h1, h2, h3");
    if (heading) {
      if (!heading.id) heading.id = id + "-title";
      box.setAttribute("aria-labelledby", heading.id);
    }
    var items = focusableEls(box);
    if (items.length) items[0].focus();
    else { box.setAttribute("tabindex", "-1"); box.focus(); }

    function onKeydown(e) {
      if (e.key === "Escape") { closeModal(id); return; }
      if (e.key !== "Tab") return;
      var current = focusableEls(box);
      if (!current.length) return;
      var first = current[0], last = current[current.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    overlay._pgTrap = onKeydown;
    overlay._pgLastFocused = lastFocused;
    document.addEventListener("keydown", onKeydown);
  }
  function closeModal(id) {
    var overlay = document.getElementById(id);
    if (!overlay) return;
    overlay.classList.remove("show");
    if (overlay._pgTrap) { document.removeEventListener("keydown", overlay._pgTrap); overlay._pgTrap = null; }
    var restore = overlay._pgLastFocused;
    if (restore && typeof restore.focus === "function" && document.contains(restore)) restore.focus();
    overlay._pgLastFocused = null;
  }

  /* ---------------------------------------------------------------- */
  /* Custom Select — progressively enhances native <select class="form-control">   */
  /* elements into a styled dropdown. The native <select> stays in the DOM         */
  /* (hidden) so existing code that reads .value / listens for "change" keeps      */
  /* working untouched — enhancement is purely visual.                            */
  /* ---------------------------------------------------------------- */
  /* ================================================================ */
  /* Shared control patterns (§5)                                      */
  /*                                                                   */
  /* The rule these encode: pick the control from the shape of the     */
  /* choice, not from habit. 2–4 short exclusive options → segmented.  */
  /* Common single-click filters → chips. A long entity list →         */
  /* searchable combobox. A <select> is now the fallback, not the      */
  /* default. All three are markup-string builders plus one delegated  */
  /* wire() call, matching how every other page in this app is built.  */
  /* ================================================================ */

  // options: [{value, label, icon?}] — renders as a real radio group so arrow
  // keys and screen readers behave, styled as a segmented control.
  function segmented(name, options, activeValue, opts) {
    opts = opts || {};
    var html = '<div class="pg-seg" role="radiogroup" data-seg="' + esc(name) + '"' +
      (opts.ariaLabel ? ' aria-label="' + esc(opts.ariaLabel) + '"' : "") + ">";
    options.forEach(function (o) {
      var on = String(o.value) === String(activeValue);
      html += '<button type="button" role="radio" aria-checked="' + (on ? "true" : "false") + '"' +
        ' class="pg-seg-btn' + (on ? " active" : "") + '" data-seg-value="' + esc(String(o.value)) + '"' +
        (o.title ? ' title="' + esc(o.title) + '"' : "") + ">" +
        (o.icon && ICONS[o.icon] ? '<span class="ic">' + ICONS[o.icon] + "</span>" : "") +
        "<span>" + esc(o.label) + "</span></button>";
    });
    return html + "</div>";
  }
  function wireSegmented(root, name, onChange) {
    var group = (root || document).querySelector('[data-seg="' + name + '"]');
    if (!group) return;
    group.addEventListener("click", function (e) {
      var btn = e.target.closest(".pg-seg-btn");
      if (!btn || btn.classList.contains("active")) return;
      group.querySelectorAll(".pg-seg-btn").forEach(function (b) {
        var on = b === btn;
        b.classList.toggle("active", on);
        b.setAttribute("aria-checked", on ? "true" : "false");
      });
      onChange(btn.dataset.segValue);
    });
  }

  // Single- or multi-select filter chips. `activeValues` is a single value for
  // single mode, or an array for multi mode.
  function filterChips(name, options, activeValues, opts) {
    opts = opts || {};
    var multi = !!opts.multi;
    var active = multi ? (activeValues || []) : [activeValues];
    var html = '<div class="pg-chips" data-chips="' + esc(name) + '"' +
      ' role="group"' + (opts.ariaLabel ? ' aria-label="' + esc(opts.ariaLabel) + '"' : "") + ">";
    options.forEach(function (o) {
      var on = active.map(String).indexOf(String(o.value)) > -1;
      html += '<button type="button" class="pg-chip' + (on ? " active" : "") + '"' +
        ' aria-pressed="' + (on ? "true" : "false") + '" data-chip-value="' + esc(String(o.value)) + '">' +
        esc(o.label) + (o.count != null ? ' <span class="pg-chip-count">' + o.count + "</span>" : "") + "</button>";
    });
    return html + "</div>";
  }
  function wireChips(root, name, onChange) {
    var group = (root || document).querySelector('[data-chips="' + name + '"]');
    if (!group) return;
    group.addEventListener("click", function (e) {
      var chip = e.target.closest(".pg-chip");
      if (!chip) return;
      onChange(chip.dataset.chipValue, chip);
    });
  }

  // Applied-filter summary chips, each removable — the visible record of what is
  // currently narrowing a list, so filters set in a drawer never become invisible
  // state the user has to remember (§3 "recognition instead of recall").
  // items: [{key, label, value}]
  function appliedChips(items) {
    if (!items || !items.length) return "";
    return '<div class="pg-applied-chips">' + items.map(function (it) {
      return '<span class="pg-applied-chip">' +
        '<span class="k">' + esc(it.label) + ":</span> " + esc(it.value) +
        '<button type="button" class="x" data-remove-filter="' + esc(it.key) + '" aria-label="Remove ' + esc(it.label) + ' filter">&times;</button></span>';
    }).join("") + "</div>";
  }

  /* Searchable combobox for long entity lists (guests, physical rooms, rate
     plans, reservations). Results carry supporting context, never just a name.
     opts: { items: [{id, label, sub, badge, disabled, reason}], value, placeholder,
             emptyText, ariaLabel, onSelect(id, item) } */
  function renderCombobox(container, opts) {
    if (!container) return null;
    var items = opts.items || [];
    var selected = items.find(function (i) { return i.id === opts.value; }) || null;
    var openList = false, hi = -1, filtered = items.slice();

    container.classList.add("pg-cbx");
    container.innerHTML =
      '<div class="pg-cbx-trigger" tabindex="0" role="combobox" aria-expanded="false" aria-haspopup="listbox"' +
        (opts.ariaLabel ? ' aria-label="' + esc(opts.ariaLabel) + '"' : "") + ">" +
        '<span class="pg-cbx-value"></span><span class="pg-cbx-caret">&#9662;</span></div>' +
      '<div class="pg-cbx-panel" role="listbox">' +
        '<div class="pg-cbx-searchwrap"><input class="pg-cbx-search form-control" type="text" placeholder="' +
          esc(opts.placeholder || "Search…") + '" aria-label="' + esc(opts.placeholder || "Search") + '"></div>' +
        '<div class="pg-cbx-list"></div>' +
      "</div>";

    var trigger = container.querySelector(".pg-cbx-trigger");
    var valueEl = container.querySelector(".pg-cbx-value");
    var panel = container.querySelector(".pg-cbx-panel");
    var search = container.querySelector(".pg-cbx-search");
    var list = container.querySelector(".pg-cbx-list");

    function paintValue() {
      valueEl.innerHTML = selected
        ? '<span class="v-main">' + esc(selected.label) + "</span>" + (selected.sub ? '<span class="v-sub">' + esc(selected.sub) + "</span>" : "")
        : '<span class="v-placeholder">' + esc(opts.placeholder || "Select…") + "</span>";
    }
    function paintList() {
      if (!filtered.length) {
        list.innerHTML = '<div class="pg-cbx-empty">' + esc(opts.emptyText || "No matches.") + "</div>";
        return;
      }
      list.innerHTML = filtered.map(function (it, i) {
        return '<div class="pg-cbx-option' + (it.disabled ? " disabled" : "") + (i === hi ? " hi" : "") +
          (selected && selected.id === it.id ? " selected" : "") + '" role="option"' +
          ' aria-selected="' + (selected && selected.id === it.id ? "true" : "false") + '" data-i="' + i + '">' +
          '<div class="o-main">' + esc(it.label) + (it.badge ? " " + it.badge : "") + "</div>" +
          (it.sub ? '<div class="o-sub">' + esc(it.sub) + "</div>" : "") +
          (it.disabled && it.reason ? '<div class="o-reason">' + esc(it.reason) + "</div>" : "") +
          "</div>";
      }).join("");
    }
    function applyFilter() {
      var q = search.value.trim().toLowerCase();
      filtered = !q ? items.slice() : items.filter(function (it) {
        return ((it.label || "") + " " + (it.sub || "")).toLowerCase().indexOf(q) > -1;
      });
      hi = filtered.findIndex(function (it) { return !it.disabled; });
      paintList();
    }
    function setOpen(v) {
      openList = v;
      container.classList.toggle("open", v);
      trigger.setAttribute("aria-expanded", v ? "true" : "false");
      if (v) { search.value = ""; applyFilter(); setTimeout(function () { search.focus(); }, 0); }
    }
    function choose(i) {
      var it = filtered[i];
      if (!it || it.disabled) return;
      selected = it; paintValue(); setOpen(false); trigger.focus();
      if (opts.onSelect) opts.onSelect(it.id, it);
    }

    trigger.addEventListener("click", function () { setOpen(!openList); });
    trigger.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") { e.preventDefault(); setOpen(true); }
    });
    search.addEventListener("input", applyFilter);
    search.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { e.preventDefault(); setOpen(false); trigger.focus(); return; }
      if (e.key === "Enter") { e.preventDefault(); choose(hi); return; }
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      e.preventDefault();
      var step = e.key === "ArrowDown" ? 1 : -1, n = filtered.length, guard = 0;
      do { hi = (hi + step + n) % n; guard++; } while (filtered[hi] && filtered[hi].disabled && guard <= n);
      paintList();
      var el = list.querySelector(".pg-cbx-option.hi");
      if (el) el.scrollIntoView({ block: "nearest" });
    });
    list.addEventListener("mousedown", function (e) {
      var row = e.target.closest(".pg-cbx-option");
      if (!row) return;
      e.preventDefault();
      choose(+row.dataset.i);
    });
    document.addEventListener("mousedown", function (e) {
      if (openList && !container.contains(e.target)) setOpen(false);
    });

    paintValue();
    return {
      setItems: function (next, keepValue) {
        items = next || [];
        if (!keepValue) selected = null;
        else selected = items.find(function (i) { return selected && i.id === selected.id; }) || null;
        paintValue(); applyFilter();
      },
      setValue: function (id) {
        selected = items.find(function (i) { return i.id === id; }) || null;
        paintValue();
      },
      getValue: function () { return selected ? selected.id : null; }
    };
  }

  /* ================================================================ */
  /* Shared row-action menu (".more-wrap > .more-btn + .more-menu")     */
  /*                                                                    */
  /* Every table's kebab menu in the app uses this ONE wiring function  */
  /* instead of a hand-rolled click-delegate per page. Two things it    */
  /* fixes that per-page copies kept re-introducing:                    */
  /*                                                                    */
  /*  1. Visual drift — every page restyled .more-menu locally instead  */
  /*     of using the shared component in style.css.                   */
  /*  2. Clipping — a menu absolutely-positioned inside a container     */
  /*     with `overflow-x:auto` gets its overflow-y implicitly forced   */
  /*     to `auto` too (a CSS rule, not a bug in any one page), so a    */
  /*     short table clips the dropdown and forces an inner scrollbar.  */
  /*     The fix is a portal: while open, the menu is reparented to     */
  /*     <body> with `position:fixed`, positioned from the trigger's    */
  /*     own bounding rect, and restored to its original DOM slot on    */
  /*     close — so listeners bound to it never need rebinding.         */
  /* ================================================================ */
  var MENU_PORTAL_OPEN = null; // { menu, btn, parent, next } — at most one open at a time
  function closeMoreMenu(restoreFocus) {
    if (!MENU_PORTAL_OPEN) return;
    var rec = MENU_PORTAL_OPEN;
    rec.menu.classList.remove("show");
    rec.menu.style.position = ""; rec.menu.style.top = ""; rec.menu.style.left = "";
    rec.menu.style.right = ""; rec.menu.style.bottom = ""; rec.menu.style.minWidth = "";
    rec.menu.removeAttribute("data-flipped");
    if (rec.parent) rec.parent.insertBefore(rec.menu, rec.next || null);
    rec.btn.setAttribute("aria-expanded", "false");
    MENU_PORTAL_OPEN = null;
    if (restoreFocus && rec.btn && document.contains(rec.btn)) rec.btn.focus();
  }
  function openMoreMenu(btn, menu) {
    if (MENU_PORTAL_OPEN && MENU_PORTAL_OPEN.menu === menu) { closeMoreMenu(true); return; }
    closeMoreMenu(false);
    var parent = menu.parentNode, next = menu.nextSibling;
    document.body.appendChild(menu);
    menu.classList.add("show");
    menu.style.position = "fixed";
    menu.style.minWidth = Math.max(190, btn.getBoundingClientRect().width) + "px";
    var r = btn.getBoundingClientRect();
    var mw = menu.offsetWidth || 210, mh = menu.offsetHeight || 200;
    var rtl = document.documentElement.dir === "rtl";
    // End-align under the trigger by default (matches the old `right:0` look);
    // flip to the opposite side if that would run off the viewport.
    var alignEnd = !rtl;
    var left = alignEnd ? r.right - mw : r.left;
    if (left < 6) left = 6;
    if (left + mw > window.innerWidth - 6) left = window.innerWidth - mw - 6;
    var top = r.bottom + 4, flipped = false;
    if (top + mh > window.innerHeight - 6 && r.top - mh - 4 >= 6) { top = r.top - mh - 4; flipped = true; }
    menu.style.left = left + "px"; menu.style.top = top + "px";
    if (flipped) menu.setAttribute("data-flipped", "true");
    btn.setAttribute("aria-expanded", "true");
    MENU_PORTAL_OPEN = { menu: menu, btn: btn, parent: parent, next: next };
    var first = menu.querySelector("a, button:not(:disabled)");
    if (first) first.focus();
  }
  // Attach once globally — every portaled menu in the app (row "more actions" kebabs
  // AND the header account menu, see wireUserMenu()) shares this one delegate rather
  // than each page/component registering its own document click/keydown/scroll
  // listeners. Called from both wireMoreMenus() and wireUserMenu() so it's live on
  // every page regardless of which portaled menus that page actually uses.
  var MORE_MENU_GLOBAL_WIRED = false;
  function ensureMenuPortalGlobalWired() {
    if (MORE_MENU_GLOBAL_WIRED) return;
    MORE_MENU_GLOBAL_WIRED = true;
    document.addEventListener("click", function () { closeMoreMenu(false); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeMoreMenu(true); });
    // A scroll anywhere on the page can leave a fixed-position portal menu visually
    // detached from the trigger it belongs to — closing is simpler and safer than
    // tracking every scrollable ancestor to reposition live.
    window.addEventListener("scroll", function () { closeMoreMenu(false); }, true);
    window.addEventListener("resize", function () { closeMoreMenu(false); });
  }
  function wireMoreMenus(root) {
    (root || document).querySelectorAll(".more-btn").forEach(function (btn) {
      if (btn.dataset.moreWired) return;
      btn.dataset.moreWired = "1";
      btn.setAttribute("aria-haspopup", "menu");
      btn.setAttribute("aria-expanded", "false");
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        var wrap = btn.closest(".more-wrap");
        var menu = wrap ? wrap.querySelector(".more-menu") : null;
        if (menu) openMoreMenu(btn, menu);
      });
    });
    ensureMenuPortalGlobalWired();
  }

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

  /* Reusable confirmation dialog (title + message + Cancel + a single labeled action,
     red only when opts.danger) — the same pg-modal shell every other confirm in this
     app already uses, just factored out so Room Views and Bed Configurations (and
     anything added later) don't each hand-roll their own copy. */
  var CONFIRM_MODAL_EL = null;
  function confirmDialog(opts) {
    if (!CONFIRM_MODAL_EL) {
      CONFIRM_MODAL_EL = document.createElement("div");
      CONFIRM_MODAL_EL.className = "pg-modal-overlay";
      CONFIRM_MODAL_EL.id = "pg-confirm-modal";
      document.body.appendChild(CONFIRM_MODAL_EL);
    }
    var el = CONFIRM_MODAL_EL;
    el.innerHTML = '<div class="pg-modal" style="width:420px;">' +
      '<div class="pg-modal-header"><h3>' + esc(opts.title) + '</h3><button class="pg-modal-close" id="pg-confirm-close">&times;</button></div>' +
      '<div class="pg-modal-body"><p style="margin:0;font-size:13px;color:var(--pg-gray-700);line-height:1.55;">' + esc(opts.message) + '</p></div>' +
      '<div class="pg-modal-footer"><button class="btn btn-light" id="pg-confirm-cancel">' + esc(opts.cancelLabel || "Cancel") + '</button>' +
      '<button class="btn ' + (opts.danger ? "btn-danger" : "btn-primary") + '" id="pg-confirm-ok">' + esc(opts.confirmLabel || "Confirm") + '</button></div>' +
    '</div>';
    function close() { closeModal("pg-confirm-modal"); }
    document.getElementById("pg-confirm-close").addEventListener("click", close);
    document.getElementById("pg-confirm-cancel").addEventListener("click", close);
    document.getElementById("pg-confirm-ok").addEventListener("click", function () { close(); opts.onConfirm(); });
    openModal("pg-confirm-modal");
  }

  /* Managed-list dropdown: a select-style control backed by an editable list of
     strings (Room Views, Bed Configurations, Meal Plans) with inline "+ Add New" and
     a delete icon per option. Renders into `container`; calls onChange(value) when
     the selection changes, and persists list add/remove via getList/setList.

     opts: { value, getList, setList, onChange, placeholder,
             entityLabel        — e.g. "View" / "Bed configuration", used in messages
             isUsedCount(item)  — optional; returns how many rooms use this option.
                                   Omit only for lists with no "assigned" concept.
             addedMessage, deletedMessage — exact toast text (spec wording differs:
                                   "View added successfully." vs "Bed configuration
                                   added successfully.")
             auditAction, auditModule     — passed straight to PG.addAudit() }
     Add validates: required, trimmed, no whitespace-only, max 60 chars, and a
     case-insensitive duplicate check against the current list — shown inline rather
     than silently failing. Delete is blocked (icon disabled, tooltip explains why)
     when isUsedCount(item) > 0, and otherwise goes through confirmDialog() rather
     than a native confirm(). */
  function renderManagedSelect(container, opts) {
    var current = opts.value;
    var entityLabel = opts.entityLabel || "option";
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
    function usedCount(item) { return opts.isUsedCount ? opts.isUsedCount(item) : 0; }
    function doDelete(item) {
      var list = opts.getList().filter(function (x) { return x !== item; });
      opts.setList(list);
      if (current === item) { current = list[0]; opts.onChange(current); syncTrigger(); }
      addAudit((opts.auditAction || entityLabel + " Deleted"), "“" + item + "” removed from the " + entityLabel.toLowerCase() + " list.", null, { module: opts.auditModule, previousValue: item, newValue: null });
      toast(opts.deletedMessage || (entityLabel + " deleted successfully."), "success");
      renderMenu();
    }
    function renderMenu() {
      menu.innerHTML = "";
      opts.getList().forEach(function (item) {
        var count = usedCount(item);
        var row = document.createElement("div");
        row.className = "pg-select-option" + (item === current ? " selected" : "");
        var label = document.createElement("span");
        label.textContent = item;
        row.appendChild(label);
        var del = document.createElement("span");
        del.className = "del" + (count > 0 ? " disabled" : "");
        del.textContent = "×";
        del.title = count > 0
          ? "This " + entityLabel.toLowerCase() + " is assigned to " + count + " room" + (count === 1 ? "" : "s") + " and cannot be deleted."
          : "Delete this " + entityLabel.toLowerCase();
        del.addEventListener("mousedown", function (e) {
          e.preventDefault(); e.stopPropagation();
          if (count > 0) { toast(del.title, "danger"); return; }
          if (opts.getList().length <= 1) { toast("At least one option must remain.", "danger"); return; }
          confirmDialog({
            title: "Delete " + entityLabel + "?",
            message: "Are you sure you want to delete “" + item + "”? It will no longer be available when creating or editing rooms.",
            confirmLabel: "Delete " + (opts.deleteButtonLabel || entityLabel),
            danger: true,
            onConfirm: function () { doDelete(item); }
          });
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
      addRow.textContent = "+ Add New " + entityLabel;
      addRow.addEventListener("mousedown", function (e) {
        e.preventDefault();
        var formRow = document.createElement("div");
        formRow.className = "pg-select-add-form";
        formRow.innerHTML = '<input type="text" placeholder="' + (opts.placeholder || "New option") + '" maxlength="60"><button type="button">Add</button>' +
          '<div class="pg-select-add-error" style="display:none;width:100%;color:var(--pg-danger);font-size:11.5px;margin-top:4px;"></div>';
        addRow.replaceWith(formRow);
        var input = formRow.querySelector("input");
        var errEl = formRow.querySelector(".pg-select-add-error");
        input.focus();
        function showError(msg) { errEl.textContent = msg; errEl.style.display = "block"; }
        function commit() {
          var raw = input.value;
          var v = raw.trim();
          if (!v) { showError("This field is required."); return; }
          if (v.length > 60) { showError("Maximum length is 60 characters."); return; }
          var list = opts.getList();
          var dup = list.some(function (x) { return x.toLowerCase() === v.toLowerCase(); });
          if (dup) { showError("This " + entityLabel.toLowerCase() + " already exists. Select it from the list."); return; }
          list = list.concat([v]);
          opts.setList(list);
          current = v;
          syncTrigger();
          opts.onChange(current);
          addAudit((opts.auditAction || entityLabel + " Added"), "“" + v + "” added to the " + entityLabel.toLowerCase() + " list.", null, { module: opts.auditModule, previousValue: null, newValue: v });
          toast(opts.addedMessage || (entityLabel + " added successfully."), "success");
          renderMenu();
        }
        formRow.querySelector("button").addEventListener("mousedown", function (e) { e.preventDefault(); commit(); });
        input.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); commit(); } });
        input.addEventListener("input", function () { errEl.style.display = "none"; });
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
  /* Amenity selector (§5) — one shared drawer for property, room-type, and         */
  /* physical-room amenity pickers. A long single <select> can't hold a scoped,      */
  /* categorized, growing catalog with custom entries, so this is a searchable,      */
  /* grouped, multi-select drawer instead: search box, category filter, "selected    */
  /* only" toggle, checkboxes grouped by category, removable selected chips, and an  */
  /* "Add Custom Amenity" mini-form — all working off a local draft so nothing is    */
  /* written to state until Apply.                                                   */
  /* opts: { scope: 'property'|'roomType'|'physicalRoom', title, helperText,         */
  /*         selectedIds, excludeIds (already-inherited, hidden from the picker),    */
  /*         onApply(newSelectedIds), auditModule }                                  */
  /* ---------------------------------------------------------------- */
  var amenitySelectorEl = null;
  function amenityCategoryOrder() {
    return ["General Guest Services", "Room Features", "Bathroom", "Food and Beverage", "Kitchen",
      "Entertainment", "Parking and Transportation", "Pool, Spa, and Wellness", "Family Services",
      "Business Services", "Accessibility", "Safety and Security", "Environment and Sustainability", "Custom"];
  }

  // Shared table-cell rendering for a list of amenity/feature ids: the same .chip
  // style as any other attribute chip in the app (Key Attributes, etc.), truncated to
  // `max` visible chips with a "+N" chip whose title lists the rest — so a table row
  // never grows tall just because a room happens to have a dozen amenities.
  function amenityChipsHtml(ids, max) {
    max = max || 4;
    if (!ids || !ids.length) return '<span class="muted text-sm">—</span>';
    var names = getState().amenityCatalog.filter(function (a) { return ids.indexOf(a.id) > -1; }).map(function (a) { return a.name; });
    if (!names.length) return '<span class="muted text-sm">—</span>';
    var visible = names.slice(0, max), rest = names.slice(max);
    var html = visible.map(function (n) { return '<span class="chip">' + esc(n) + '</span>'; }).join("");
    if (rest.length) html += '<span class="chip" title="' + esc(rest.join(", ")) + '">+' + rest.length + "</span>";
    return html;
  }
  function openAmenitySelector(opts) {
    if (!amenitySelectorEl) {
      amenitySelectorEl = document.createElement("div");
      amenitySelectorEl.className = "pg-drawer-overlay";
      amenitySelectorEl.id = "pg-amenity-selector";
      document.body.appendChild(amenitySelectorEl);
    }
    var el = amenitySelectorEl;
    var draft = (opts.selectedIds || []).slice();
    var search = "", categoryFilter = "all", selectedOnly = false;
    var excludeIds = opts.excludeIds || [];

    function catalogAll() {
      return getState().amenityCatalog.filter(function (a) { return a.active && a.scope === opts.scope && excludeIds.indexOf(a.id) === -1; });
    }
    function nameOf(id) { var a = catalogAll().find(function (x) { return x.id === id; }); return a ? a.name : id; }
    function visibleCatalog() {
      var q = search.trim().toLowerCase();
      return catalogAll().filter(function (a) {
        if (categoryFilter !== "all" && a.category !== categoryFilter) return false;
        if (selectedOnly && draft.indexOf(a.id) === -1) return false;
        if (q && a.name.toLowerCase().indexOf(q) === -1) return false;
        return true;
      });
    }
    function render() {
      var cats = amenityCategoryOrder().filter(function (c) { return catalogAll().some(function (a) { return a.category === c; }); });
      var catOptions = '<option value="all">All Categories</option>' + cats.map(function (c) { return '<option value="' + esc(c) + '"' + (categoryFilter === c ? " selected" : "") + '>' + esc(c) + "</option>"; }).join("");
      var visible = visibleCatalog();
      var groupsHtml = "";
      cats.forEach(function (c) {
        var items = visible.filter(function (a) { return a.category === c; });
        if (!items.length) return;
        groupsHtml += '<div class="am-group"><div class="am-group-title">' + esc(c) + '</div>' +
          items.map(function (a) {
            var checked = draft.indexOf(a.id) > -1;
            return '<label class="am-row"><input type="checkbox" class="am-check" data-id="' + a.id + '"' + (checked ? " checked" : "") + '><span>' + esc(a.name) + "</span></label>";
          }).join("") + "</div>";
      });
      if (!groupsHtml) groupsHtml = '<div class="text-sm muted" style="padding:20px 4px;text-align:center;">No amenities match your search.</div>';

      var chipsHtml = draft.length
        ? draft.map(function (id) { return '<span class="am-chip" data-id="' + id + '">' + esc(nameOf(id)) + '<button type="button" data-remove="' + id + '" aria-label="Remove ' + esc(nameOf(id)) + '">&times;</button></span>'; }).join("")
        : '<span class="text-sm muted">No amenities selected yet.</span>';

      el.innerHTML = '<div class="pg-drawer pg-drawer-wide">' +
        '<div class="pg-drawer-header"><h3>' + esc(opts.title || "Select Amenities") + '</h3><button class="pg-modal-close" id="am-close">&times;</button></div>' +
        '<div class="pg-drawer-body">' +
          (opts.helperText ? '<div class="help-note" style="margin-bottom:14px;">' + esc(opts.helperText) + "</div>" : "") +
          '<div class="am-toolbar">' +
            '<input type="search" class="form-control" id="am-search" placeholder="Search amenities…" value="' + esc(search) + '">' +
            '<select class="form-control" id="am-category">' + catOptions + "</select>" +
          "</div>" +
          '<label class="form-check" style="margin:10px 0 14px;"><input type="checkbox" id="am-selected-only"' + (selectedOnly ? " checked" : "") + '><span class="form-label" style="margin:0;">Selected only</span></label>' +
          '<div class="am-selected-chips">' + chipsHtml + "</div>" +
          '<div class="am-groups">' + groupsHtml + "</div>" +
          '<button type="button" class="btn btn-outline btn-sm am-add-custom-btn" id="am-add-custom" style="margin-top:14px;">' + icon("plus", 13) + " Add Custom Amenity</button>" +
          '<div id="am-custom-form"></div>' +
        "</div>" +
        '<div class="pg-drawer-footer"><button class="btn btn-light" id="am-cancel">Cancel</button><button class="btn btn-primary" id="am-apply">Apply<span class="am-count">' + draft.length + "</span></button></div>" +
      "</div>";
      PG_enhanceAmenityDrawerSelects();

      document.getElementById("am-close").addEventListener("click", close);
      document.getElementById("am-cancel").addEventListener("click", close);
      document.getElementById("am-search").addEventListener("input", function (e) { search = e.target.value; render(); focusSearch(); });
      document.getElementById("am-category").addEventListener("change", function (e) { categoryFilter = e.target.value; render(); });
      document.getElementById("am-selected-only").addEventListener("change", function (e) { selectedOnly = e.target.checked; render(); });
      el.querySelectorAll(".am-check").forEach(function (cb) {
        cb.addEventListener("change", function () {
          var id = cb.dataset.id;
          if (cb.checked) { if (draft.indexOf(id) === -1) draft.push(id); }
          else { draft = draft.filter(function (x) { return x !== id; }); }
          render();
        });
      });
      el.querySelectorAll("[data-remove]").forEach(function (btn) {
        btn.addEventListener("click", function () { draft = draft.filter(function (x) { return x !== btn.dataset.remove; }); render(); });
      });
      document.getElementById("am-add-custom").addEventListener("click", openCustomForm);
      document.getElementById("am-apply").addEventListener("click", function () { close(); opts.onApply(draft); });
    }
    function focusSearch() {
      var s = document.getElementById("am-search");
      if (s) { s.focus(); var v = s.value; s.value = ""; s.value = v; }
    }
    function openCustomForm() {
      var box = document.getElementById("am-custom-form");
      var scopeLabel = { property: "Property", roomType: "Room Type", physicalRoom: "Physical Room" }[opts.scope];
      box.innerHTML = '<div class="am-custom-form">' +
        '<div class="form-group"><label class="form-label">Amenity Name <span class="opt">(required)</span></label><input class="form-control" id="am-c-name" maxlength="60"></div>' +
        '<div class="form-group"><label class="form-label">Arabic / Localized Name <span class="opt">(optional)</span></label><input class="form-control" id="am-c-name-local"></div>' +
        '<div class="form-group"><label class="form-label">Category</label><select class="form-control" id="am-c-category">' +
          amenityCategoryOrder().map(function (c) { return '<option value="' + esc(c) + '">' + esc(c) + "</option>"; }).join("") +
        "</select></div>" +
        '<div class="form-group"><label class="form-label">Applies To</label><input class="form-control" value="' + esc(scopeLabel) + '" disabled></div>' +
        '<div class="pg-select-add-error" id="am-c-error" style="display:none;color:var(--pg-danger);font-size:11.5px;margin-bottom:8px;"></div>' +
        '<div style="display:flex;gap:8px;"><button type="button" class="btn btn-light btn-sm" id="am-c-cancel">Cancel</button><button type="button" class="btn btn-primary btn-sm" id="am-c-save">Add Amenity</button></div>' +
      "</div>";
      PG.enhanceSelects(box);
      document.getElementById("am-c-cancel").addEventListener("click", function () { box.innerHTML = ""; });
      document.getElementById("am-c-save").addEventListener("click", function () {
        var name = document.getElementById("am-c-name").value.trim();
        var errEl = document.getElementById("am-c-error");
        function showErr(m) { errEl.textContent = m; errEl.style.display = "block"; }
        if (!name) { showErr("Amenity name is required."); return; }
        if (name.length > 60) { showErr("Maximum length is 60 characters."); return; }
        var st = getState();
        var dup = st.amenityCatalog.find(function (a) { return a.scope === opts.scope && a.name.toLowerCase() === name.toLowerCase(); });
        if (dup) { showErr('An amenity named "' + dup.name + '" already exists for this scope. Select it from the list instead.'); return; }
        var category = document.getElementById("am-c-category").value;
        var localized = document.getElementById("am-c-name-local").value.trim();
        var newId = "am-custom-" + Date.now();
        st.amenityCatalog.push({ id: newId, propertyId: st.hotel.propertyCode, name: name, nameLocalized: localized || null,
          category: category, scope: opts.scope, standard: false, active: true, iconKey: null,
          createdBy: CURRENT_ROLE, createdDate: TODAY, updatedBy: null, updatedDate: null });
        setState(st);
        addAudit("Custom Amenity Created", "“" + name + "” added to the " + category + " category (" + opts.scope + ").", null, { module: opts.auditModule, newValue: name });
        draft.push(newId);
        toast("Custom amenity added.", "success");
        box.innerHTML = "";
        render();
      });
      document.getElementById("am-c-name").focus();
    }
    function close() { closeModal("pg-amenity-selector"); }
    render();
    openModal("pg-amenity-selector");
    // A page can jump straight to "Add Custom Amenity" (e.g. a quick-add shortcut
    // next to "Edit Amenities") instead of making the user open the picker first.
    if (opts.openCustomFormOnInit) openCustomForm();
  }
  // enhanceSelects only targets <select class="form-control">, and the amenity
  // drawer's category filter needs the same treatment as everywhere else in the app.
  function PG_enhanceAmenityDrawerSelects() { if (amenitySelectorEl) enhanceSelects(amenitySelectorEl); }

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
            addAudit("Room Assignment Changed", res.id + " — room changed from " + (oldRoom ? oldRoom.roomNumber : "—") + " to " + newRoom.roomNumber + " (resolving a block conflict).", null,
              { module: "Room Assignments", recordId: assignmentId, previousValue: oldRoom ? oldRoom.roomNumber : "—", newValue: newRoom.roomNumber, reason: "Resolving a block conflict" });
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
        addAudit("Physical Room Blocked", "Room " + room.roomNumber + " blocked (" + type + "), " + fmtDateShort(start) + " to " + fmtDateShort(endIncl) + ". Reason: " + reason + ".", null,
          { module: "Room Blocks", recordId: block.id, newValue: type + " " + start + "–" + endExclusive, reason: reason });
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
          addAudit("Guest Updated", name + "'s profile was updated.", null, { module: "Guests", recordId: resultId });
          toast("Guest updated.", "success");
        } else {
          resultId = "cus-" + Date.now();
          st.customers.push(Object.assign({ id: resultId }, data));
          setState(st);
          addAudit("Guest Created", name + " added as a new guest.", null, { module: "Guests", recordId: resultId, newValue: name });
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
          addAudit("Guest Deleted", removedName + "’s guest profile was permanently deleted by " + CURRENT_ROLE + ".", null, { module: "Guests", recordId: opts.guestId, previousValue: removedName, newValue: "deleted" });
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

  /* ================================================================ */
  /* Hotel Assistant — dummy provider behind a replaceable interface    */
  /*                                                                    */
  /* AssistantService                                                   */
  /*   ├── MockAssistantProvider   (wired up now — no network calls,    */
  /*   │     no API keys, mutates state through the SAME functions      */
  /*   │     every page's own forms already use)                       */
  /*   └── RealAssistantProvider   (future — swap ASSISTANT_CONFIG.mode */
  /*         to "live" and provide a matching .interpret/.validate/     */
  /*         .execute; the drawer UI below never changes)               */
  /*                                                                    */
  /* Every proposed change is a structured Command, never a direct DOM  */
  /* edit: {type, targetEntity, propertyId, userId, userRole,           */
  /* requiredPermissions, params, validation, confirmed, result, audit}.*/
  /* The UI walks Interpret → Clarify → Confirm → Apply and never       */
  /* mutates state on the first natural-language message alone.        */
  /* ================================================================ */
  var ASSISTANT_CONFIG = { assistantEnabled: true, assistantMode: "mock" };

  function buildCommand(type, params) {
    var st = getState();
    return {
      type: type,
      targetEntity: null,
      propertyId: (st.hotel && st.hotel.propertyCode) || null,
      userId: CURRENT_ROLE,
      userRole: CURRENT_ROLE,
      requiredPermissions: ASSISTANT_PERMS[type] || [],
      params: params || {},
      validation: { ok: null, errors: [] },
      confirmed: false,
      result: null,
      audit: null
    };
  }
  // The same named permissions every page already gates its own actions behind — the
  // assistant is never a side door around them.
  var ASSISTANT_PERMS = {
    createPhysicalRooms: ["manage_physical_rooms"], updatePhysicalRooms: ["manage_physical_rooms"],
    createRatePlan: ["manage_rates"], updateRatePlan: ["manage_rates"], createPricingPeriod: ["manage_rates"],
    createReservation: ["assign_rooms"], updateReservation: ["assign_rooms"],
    createRoomBlock: ["block_rooms"], navigateToPage: [], searchPlatform: []
  };

  // Pages intentionally hidden from navigation (currently just Availability &
  // Inventory) never surface as an assistant destination, matching every other
  // access point that was removed in §2.
  var ASSISTANT_NAV_MAP = [
    { rx: /pricing period/i, label: "Rate Plans & Pricing → Pricing Periods", href: "rates.html?tab=periods" },
    { rx: /rate plan/i, label: "Rate Plans & Pricing → Rate Plans", href: "rates.html?tab=plans" },
    { rx: /room attribute|bed configuration|accessib|connecting room/i, label: "Physical Rooms → Edit Room", href: "physical-rooms.html" },
    { rx: /room block|block.*room|out of order|out of service/i, label: "Physical Rooms or Operations Calendar → Add Room Block", href: "physical-rooms.html" },
    { rx: /operations calendar|room assignment|move.*room|calendar/i, label: "Operations Calendar", href: "operations-calendar.html" },
    { rx: /guest|customer/i, label: "Guests", href: "guests.html" },
    { rx: /payment|refund/i, label: "Payments", href: "payments.html" },
    { rx: /new reservation|book a room|create.*reservation/i, label: "New Reservation", href: "new-reservation.html" },
    { rx: /reservation/i, label: "Reservations", href: "reservations.html" },
    { rx: /tax|fee/i, label: "Hotel Configuration → Taxes & Fees", href: "taxes-fees.html" },
    { rx: /room type/i, label: "Room Types", href: "room-types.html" },
    { rx: /audit/i, label: "Administration → Audit", href: "audit.html" },
    { rx: /permission/i, label: "Administration → Permissions", href: "permissions.html" },
    { rx: /availability|inventory/i, label: "Operations Calendar (availability by physical room)", href: "operations-calendar.html" }
  ];

  var MONTHS = { jan:1,january:1,feb:2,february:2,mar:3,march:3,apr:4,april:4,may:5,jun:6,june:6,jul:7,july:7,
    aug:8,august:8,sep:9,sept:9,september:9,oct:10,october:10,nov:11,november:11,dec:12,december:12 };
  // "1 July to 30 September" / "10 September to 14 September" — this MVP's dates are
  // seeded in 2026, so a bare "1 July" resolves to the nearest occurrence at/after TODAY.
  function parseNaturalDateRange(text) {
    var rx = /(\d{1,2})\s+([a-zA-Z]+)\s*(?:to|-|–|until)\s*(\d{1,2})\s+([a-zA-Z]+)/i;
    var m = text.match(rx);
    if (!m) return null;
    var mo1 = MONTHS[m[2].toLowerCase()], mo2 = MONTHS[m[4].toLowerCase()];
    if (!mo1 || !mo2) return null;
    var year = Number(TODAY.slice(0, 4));
    function toIso(day, month) {
      var iso = year + "-" + String(month).padStart(2, "0") + "-" + String(day).padStart(2, "0");
      if (iso < TODAY) iso = (year + 1) + "-" + String(month).padStart(2, "0") + "-" + String(day).padStart(2, "0");
      return iso;
    }
    var start = toIso(Number(m[1]), mo1), end = toIso(Number(m[3]), mo2);
    return end > start ? { start: start, end: end } : null;
  }
  function parseRoomNumberRange(text) {
    var m = text.match(/(\d{2,4})\s*(?:to|-|–|through)\s*(\d{2,4})/);
    if (!m) return null;
    var lo = parseInt(m[1], 10), hi = parseInt(m[2], 10);
    if (isNaN(lo) || isNaN(hi) || hi < lo || hi - lo > 500) return null;
    var out = [];
    for (var n = lo; n <= hi; n++) out.push(String(n));
    return out;
  }
  function findRoomTypeByName(state, text) {
    var low = text.toLowerCase();
    return state.roomTypes.find(function (rt) { return low.indexOf(rt.name.toLowerCase()) > -1 || low.indexOf(rt.name.replace(/ Room$/i, "").toLowerCase()) > -1; }) || null;
  }
  function findMoneyAmount(text) {
    var m = text.match(/(\d+(?:\.\d+)?)\s*(usd|dollars?)?/i);
    return m ? Number(m[1]) : null;
  }

  /* ---------------------------------------------------------------- */
  /* MockAssistantProvider — interpret / validate / execute             */
  /* ---------------------------------------------------------------- */
  var MockAssistantProvider = {
    /* Step 1 — Understand the request. Returns a structured interpretation:
       {ok, command, preview:{intent,module,affected,dates,prices,quantity,missing[],impact},
        clarify:{question, quickChoices:[{label,value}], paramKey} | null, reply}         */
    interpret: function (text) {
      var st = getState();
      var t = (text || "").trim();
      var low = t.toLowerCase();

      // ---- Navigation / discoverability — answered directly, no command needed. ----
      if (/^(where|how do i|how can i|open|show me|take me to)\b/i.test(t) || /\bpage\b/i.test(t)) {
        var nav = ASSISTANT_NAV_MAP.find(function (n) { return n.rx.test(t); });
        if (nav) {
          return { ok: true, command: null, preview: null, clarify: null,
            reply: "You can do that here: <strong>" + esc(nav.label) + "</strong>.",
            navTarget: nav };
        }
      }

      // ---- Room block ----
      if (/\bblock\b/i.test(low) && /room/i.test(low)) {
        var range = parseRoomNumberRange(t);
        var reasonGuess = /maintenance|repair|renovat/i.test(low) ? "Out of Order"
          : /clean|hold/i.test(low) ? "Management Hold" : null;
        var cmd = buildCommand("createRoomBlock", { roomNumbers: range, reasonText: t, blockType: reasonGuess });
        var missing = [];
        if (!range || !range.length) missing.push("roomNumbers");
        if (!reasonGuess) missing.push("blockType");
        return {
          ok: true, command: cmd,
          preview: { intent: "Block physical rooms", module: "Physical Rooms",
            affected: range ? range.length + " room(s): " + range.join(", ") : "(rooms not recognized)",
            dates: null, prices: null, quantity: range ? range.length : null, missing: missing },
          clarify: !reasonGuess ? { question: "What type of block should this be?", paramKey: "blockType",
            quickChoices: [{label:"Out of Order",value:"Out of Order"},{label:"Out of Service",value:"Out of Service"},
              {label:"Management Hold",value:"Management Hold"},{label:"Other",value:"Other"}] }
            : (!range ? { question: "Which room numbers should be blocked? (e.g. 203 to 205)", paramKey: "roomNumbers", quickChoices: [] } : null),
          reply: null
        };
      }

      // ---- Physical rooms (bulk create) ----
      if (/\b(add|create)\b/i.test(low) && /\broom/i.test(low) && !/reservation/i.test(low) && !/block/i.test(low)) {
        var qtyMatch = t.match(/(\d+)\s+physical\s+rooms?/i);
        var range2 = parseRoomNumberRange(t);
        var rt = findRoomTypeByName(st, t);
        var bldMatch = t.match(/\b(?:in|across|at)\s+(?:the\s+)?([A-Z][A-Za-z0-9 ]{2,30}(?:Building|Wing|Tower))/);
        var building = bldMatch ? bldMatch[1].trim() : (st.physicalRooms[0] ? st.physicalRooms[0].building : null);
        var qty = qtyMatch ? Number(qtyMatch[1]) : (range2 ? range2.length : null);
        var cmd2 = buildCommand("createPhysicalRooms", { roomNumbers: range2, quantity: qty, roomTypeId: rt ? rt.id : null, building: building });
        var missing2 = [];
        if (!rt) missing2.push("roomType");
        if (!building) missing2.push("building");
        if (!range2 && !qty) missing2.push("quantity");
        return {
          ok: true, command: cmd2,
          preview: { intent: "Create physical rooms", module: "Physical Rooms",
            affected: range2 ? "Rooms " + range2[0] + "–" + range2[range2.length-1] : (qty ? qty + " new room(s)" : "(quantity not recognized)"),
            dates: null, prices: null, quantity: qty, missing: missing2 },
          clarify: !rt ? { question: "Which room type should be assigned?", paramKey: "roomTypeId",
              quickChoices: st.roomTypes.map(function(x){return {label:x.name, value:x.id};}) }
            : !building ? { question: "Which building should these rooms belong to?", paramKey: "building",
                quickChoices: distinctBuildings(st).map(function(b){return {label:b,value:b};}).concat([{label:"Main Building",value:"Main Building"}]) }
            : null,
          reply: null
        };
      }

      // ---- Rate plan creation ----
      if (/\b(rate plan|plan)\b/i.test(low) && /(base price|create|breakfast)/i.test(low) && !/pricing period/i.test(low)) {
        var range3 = parseRoomNumberRange(t);
        var price3 = findMoneyAmount(t.replace(/\b\d{2,4}\s*(?:to|-|–|through)\s*\d{2,4}\b/, ""));
        var meal = /breakfast/i.test(low) ? "Breakfast Included" : null;
        var rt3 = range3 ? roomTypeForNumbers(st, range3) : findRoomTypeByName(st, t);
        var cmd3 = buildCommand("createRatePlan", { name: meal || "New Rate Plan", mealPlan: meal || "Room Only",
          roomNumbers: range3, roomTypeId: rt3 ? rt3.id : null, basePrice: price3, currency: "USD" });
        var missing3 = [];
        if (!rt3) missing3.push("roomTypeId");
        if (price3 == null) missing3.push("basePrice");
        return {
          ok: true, command: cmd3,
          preview: { intent: "Create rate plan", module: "Rate Plans & Pricing",
            affected: range3 ? "Rooms " + range3[0] + "–" + range3[range3.length-1] : (rt3 ? rt3.name : "(room scope not recognized)"),
            dates: null, prices: price3 != null ? PG_fmtMoneySafe(price3) + " / night" : null, quantity: range3 ? range3.length : null, missing: missing3 },
          clarify: !rt3 ? { question: "Which room type should this rate plan apply to?", paramKey: "roomTypeId",
              quickChoices: st.roomTypes.map(function(x){return {label:x.name, value:x.id};}) }
            : (price3 == null ? { question: "What base price per night should this plan use, and in which currency?", paramKey: "basePrice", quickChoices: [{label:"USD 100",value:"100"},{label:"USD 120",value:"120"},{label:"USD 150",value:"150"}] } : null),
          reply: null
        };
      }

      // ---- Pricing period ----
      if (/pricing period/i.test(low) || (/season|holiday|vacation/i.test(low) && /price/i.test(low))) {
        var dr = parseNaturalDateRange(t);
        var price4 = findMoneyAmount(t);
        var nameMatch = t.match(/\b(?:the\s+)?([A-Z][a-zA-Z ]{3,30}?)\s+pricing period/i) || t.match(/create a\s+([A-Za-z ]{3,30}?)\s+pricing period/i);
        var name4 = nameMatch ? nameMatch[1].trim() : (/summer/i.test(low) ? "The Summer Vacation" : null);
        var cmd4 = buildCommand("createPricingPeriod", { name: name4, startDate: dr?dr.start:null, endDate: dr?dr.end:null, price: price4, ratePlanId: null });
        var missing4 = [];
        if (!name4) missing4.push("name");
        if (!dr) missing4.push("dates");
        if (price4 == null) missing4.push("price");
        missing4.push("ratePlanId");
        return {
          ok: true, command: cmd4,
          preview: { intent: "Create pricing period", module: "Rate Plans & Pricing",
            affected: "(select the rate plan to override)", dates: dr ? PG.fmtDateShort(dr.start)+" – "+PG.fmtDateShort(dr.end) : null,
            prices: price4 != null ? PG_fmtMoneySafe(price4) + " / night" : null, quantity: null, missing: missing4 },
          clarify: { question: "Which rate plan should this pricing period override?", paramKey: "ratePlanId",
            quickChoices: st.ratePlans.slice(0,6).map(function(p){return {label:p.name+" ("+ (st.roomTypes.find(function(r){return r.id===p.roomTypeId;})||{}).name +")", value:p.id};}) },
          reply: null
        };
      }

      // ---- Reservation ----
      if (/reservation/i.test(low) || /\bbook\b/i.test(low)) {
        var dr2 = parseNaturalDateRange(t);
        var adultsMatch = t.match(/(\d+|one|two|three|four)\s+adults?/i);
        var wordNum = {one:1,two:2,three:3,four:4};
        var adults = adultsMatch ? (wordNum[adultsMatch[1].toLowerCase()] || parseInt(adultsMatch[1],10)) : null;
        var cmd5 = buildCommand("createReservation", { checkIn: dr2?dr2.start:null, checkOut: dr2?dr2.end:null, adults: adults, customerId: null, roomTypeId: null, autoAssign: true });
        var missing5 = [];
        if (!dr2) missing5.push("dates");
        missing5.push("customerId");
        return {
          ok: true, command: cmd5,
          preview: { intent: "Create reservation", module: "Reservations",
            affected: "(select a guest)", dates: dr2 ? PG.fmtDateShort(dr2.start)+" – "+PG.fmtDateShort(dr2.end) : null,
            prices: null, quantity: adults, missing: missing5 },
          clarify: { question: "Which guest is this reservation for?", paramKey: "customerId",
            quickChoices: st.customers.slice(0,5).map(function(c){return {label:c.name, value:c.id};}) },
          reply: null
        };
      }

      return { ok: false, command: null, preview: null, clarify: null,
        reply: "I can help with: creating physical rooms, rate plans, pricing periods, reservations, and room blocks, or finding a page. Try something like “Block rooms 203 to 205 for maintenance.”" };
    },

    /* Step 3 (validate before showing the confirmation card) — reuses the SAME engine
       functions every real form on the page already validates against. */
    validate: function (command) {
      var st = getState();
      var p = command.params, errs = [];
      if (command.requiredPermissions.some(function (perm) { return !hasPermission(perm); })) {
        errs.push("You don’t have permission to perform this action.");
      }
      if (command.type === "createPhysicalRooms") {
        if (!p.roomTypeId) errs.push("A room type is required.");
        if (!p.building) errs.push("A building is required.");
        var nums = p.roomNumbers || (p.quantity ? autoNumberRange(st, p.roomTypeId, p.quantity) : null);
        if (!nums || !nums.length) errs.push("At least one room number is required.");
        else {
          var dupes = nums.filter(function (n) { return st.physicalRooms.some(function (r) { return r.roomNumber === n; }); });
          if (dupes.length) errs.push("Room number(s) already exist: " + dupes.join(", "));
        }
        command.params.resolvedNumbers = nums;
      } else if (command.type === "createRatePlan") {
        if (!p.roomTypeId) errs.push("A room type is required.");
        if (p.basePrice == null || !(Number(p.basePrice) > 0)) errs.push("A base price greater than 0 is required.");
        if (p.roomNumbers && p.roomNumbers.length) {
          var rt = st.roomTypes.find(function(x){return x.id===p.roomTypeId;});
          var missing = p.roomNumbers.filter(function(n){ return !st.physicalRooms.some(function(r){return r.roomTypeId===p.roomTypeId && r.roomNumber===n;}); });
          if (missing.length) errs.push("No " + (rt?rt.name:"matching") + " room numbered " + missing.join(", "));
        }
      } else if (command.type === "createPricingPeriod") {
        if (!p.ratePlanId) errs.push("A rate plan is required.");
        if (!p.name) errs.push("A period name is required.");
        if (!p.startDate || !p.endDate) errs.push("A valid date range is required.");
        if (p.price == null || !(Number(p.price) > 0)) errs.push("A price greater than 0 is required.");
        if (!errs.length) {
          var plan = ratePlanById(st, p.ratePlanId);
          var candidate = { startDate: p.startDate, endDate: p.endDate, daysOfWeek: [0,1,2,3,4,5,6], active: true };
          var overlaps = overlappingPeriods(plan, candidate, null);
          if (overlaps.length) errs.push("Overlaps existing period “" + overlaps[0].name + "” on this plan.");
        }
      } else if (command.type === "createReservation") {
        if (!p.customerId) errs.push("A guest is required.");
        if (!p.checkIn || !p.checkOut || p.checkOut <= p.checkIn) errs.push("A valid date range is required.");
        if (!p.roomTypeId) p.roomTypeId = st.roomTypes[0] ? st.roomTypes[0].id : null;
        if (!p.roomTypeId) errs.push("No room type available.");
        else {
          var avail = validateAvailability(st, p.roomTypeId, p.checkIn, p.checkOut, 1);
          if (!avail.ok) errs.push("Insufficient inventory for the selected dates.");
        }
      } else if (command.type === "createRoomBlock") {
        if (!p.roomNumbers || !p.roomNumbers.length) errs.push("At least one room number is required.");
        if (!p.blockType) errs.push("A block type is required.");
        if (p.roomNumbers) {
          var notFound = p.roomNumbers.filter(function(n){ return !st.physicalRooms.some(function(r){return r.roomNumber===n;}); });
          if (notFound.length) errs.push("No room numbered " + notFound.join(", "));
        }
      }
      command.validation = { ok: errs.length === 0, errors: errs };
      return command.validation;
    },

    /* Step 4 — apply, through the exact same state-mutating + audit path a real form
       uses. Mock mode only: no network, no external AI, no bypass of validation. */
    execute: function (command) {
      var st = getState();
      var p = command.params;
      try {
        if (command.type === "createPhysicalRooms") {
          var rt = st.roomTypes.find(function(x){return x.id===p.roomTypeId;});
          var nums = p.resolvedNumbers || p.roomNumbers;
          var created = [];
          nums.forEach(function (num) {
            var id = "room-" + Date.now() + "-" + num;
            st.physicalRooms.push({ id: id, propertyId: st.hotel.propertyCode, roomNumber: num, roomTypeId: p.roomTypeId,
              building: p.building, floor: Math.floor(Number(num) / 100) || 1, bedConfiguration: rt ? rt.bed : "1 Queen Bed",
              view: "", accessibilityFeatures: [], connectingRoomIds: [], notes: "Created via Hotel Assistant.",
              isActive: true, isSellable: true, operationalStatus: "Available" });
            created.push(id);
          });
          setState(st);
          addAudit("Physical Room Created", created.length + " room(s) created via Hotel Assistant: " + nums.join(", ") + " (" + (rt?rt.name:"") + ").", null,
            { module: "Physical Rooms", recordId: created.join(","), newValue: nums.join(",") });
          command.result = { ok: true, message: nums.length + " " + (rt?rt.name:"room") + "(s) were added successfully. Rooms " + nums[0] + "–" + nums[nums.length-1] + " are now visible in Physical Rooms.", link: { label: "Open Physical Rooms", href: "physical-rooms.html" } };
        } else if (command.type === "createRatePlan") {
          var id2 = "rp-" + Date.now();
          var scope = p.roomNumbers && p.roomNumbers.length ? "rooms" : "roomType";
          var physicalRoomIds = [];
          if (scope === "rooms") {
            physicalRoomIds = st.physicalRooms.filter(function(r){ return r.roomTypeId===p.roomTypeId && p.roomNumbers.indexOf(r.roomNumber)>-1; }).map(function(r){return r.id;});
          }
          st.ratePlans.push({ id: id2, propertyId: st.hotel.propertyCode, roomTypeId: p.roomTypeId, scope: scope, physicalRoomIds: physicalRoomIds,
            name: p.name, code: null, mealPlan: p.mealPlan || "Room Only", description: "Created via Hotel Assistant.",
            basePrice: Number(p.basePrice), currency: p.currency || "USD", active: true, isDefault: false, periods: [],
            createdAt: nowIso(), updatedAt: nowIso() });
          setState(st);
          addAudit("Rate Plan Created", p.name + " created via Hotel Assistant, base " + PG_fmtMoneySafe(p.basePrice) + "/night.", null,
            { module: "Rate Plans & Pricing", recordId: id2, newValue: p.name });
          command.result = { ok: true, message: "“" + p.name + "” was created at " + PG_fmtMoneySafe(p.basePrice) + " / night.", link: { label: "Open Rate Plans & Pricing", href: "rates.html?plan=" + id2 } };
        } else if (command.type === "createPricingPeriod") {
          var plan2 = ratePlanById(st, p.ratePlanId);
          var pid = "pp-" + Date.now();
          plan2.periods = plan2.periods || [];
          plan2.periods.push({ id: pid, name: p.name, startDate: p.startDate, endDate: p.endDate, daysOfWeek: [0,1,2,3,4,5,6],
            mode: "same", prices: { same: Number(p.price) }, active: true, createdAt: nowIso(), updatedAt: nowIso() });
          plan2.updatedAt = nowIso();
          setState(st);
          addAudit("Pricing Period Created", "“" + p.name + "” created on " + plan2.name + " via Hotel Assistant, " + PG_fmtMoneySafe(p.price) + "/night.", null,
            { module: "Rate Plans & Pricing", recordId: pid, newValue: p.name });
          command.result = { ok: true, message: "“" + p.name + "” was added to " + plan2.name + ".", link: { label: "Open Rate Plans & Pricing", href: "rates.html?plan=" + plan2.id + "&period=" + pid } };
        } else if (command.type === "createReservation") {
          var cust = st.customers.find(function(c){return c.id===p.customerId;});
          var rtRes = st.roomTypes.find(function(x){return x.id===p.roomTypeId;});
          var resId = "RES-" + st.nextResId; st.nextResId += 1;
          var assign = autoAssignRoomsForItem(st, { roomTypeId: p.roomTypeId, checkIn: p.checkIn, checkOut: p.checkOut, qty: 1,
            requireAccessibility: [], bedConfiguration: null, requireConnecting: false, keepRoomIds: [], excludeRoomIds: [] });
          if (assign.shortfall > 0) { command.result = { ok: false, message: "No eligible room could be assigned for these dates." }; return command.result; }
          var occ = { adults: rtRes.maxAdults, children: 0 };
          var room = { id: resId + "-itm-1", roomTypeId: p.roomTypeId, qty: 1, adults: p.adults || occ.adults, children: 0,
            ratePlanId: (defaultRatePlanFor(st, p.roomTypeId)||{}).id || null };
          snapshotRoomItemPricing(st, room, p.checkIn, p.checkOut);
          var roomCharges = roomItemCharge(st, { checkIn: p.checkIn, checkOut: p.checkOut }, room);
          var pricing = computePricing(st, roomCharges, p.checkIn);
          var reservation = { id: resId, customerId: p.customerId, source: "Admin / Direct Manual", createdAt: nowIso(),
            checkIn: p.checkIn, checkOut: p.checkOut, status: "Confirmed", paymentStatus: "Pay on Arrival", paymentMethod: "Pay on Arrival",
            rooms: [room], taxAmount: pricing.taxAmount, feeAmount: pricing.feeAmount, notes: "Created via Hotel Assistant.",
            activity: [{ ts: nowIso(), text: "Reservation created via Hotel Assistant." }] };
          st.reservations.push(reservation);
          assign.assignedRoomIds.forEach(function (roomId) {
            st.roomAssignments.push({ id: "asn-" + Date.now() + "-" + roomId, propertyId: st.hotel.propertyCode, reservationId: resId,
              reservationItemId: room.id, physicalRoomId: roomId, arrivalDate: p.checkIn, departureDate: p.checkOut,
              assignmentStatus: "Assigned", assignedAt: nowIso(), assignedBy: "Hotel Assistant", changeReason: "" });
          });
          setState(st);
          addAudit("Reservation Created", resId + " created via Hotel Assistant for " + (cust?cust.name:"guest") + ".", null,
            { module: "Reservations", recordId: resId, newValue: p.checkIn + "–" + p.checkOut });
          command.result = { ok: true, message: resId + " was created for " + (cust?cust.name:"the guest") + ", " + PG.fmtDateShort(p.checkIn) + " – " + PG.fmtDateShort(p.checkOut) + ".", link: { label: "Open Reservation", href: "reservation-detail.html?id=" + resId } };
        } else if (command.type === "createRoomBlock") {
          var rooms3 = st.physicalRooms.filter(function(r){ return p.roomNumbers.indexOf(r.roomNumber)>-1; });
          var created3 = [];
          rooms3.forEach(function (r) {
            var bid = "blk-" + Date.now() + "-" + r.roomNumber;
            st.roomBlocks.push({ id: bid, propertyId: st.hotel.propertyCode, physicalRoomId: r.id, startDate: TODAY, endDate: addDays(TODAY, 3),
              type: p.blockType, reason: p.reasonText || p.blockType, notes: "Created via Hotel Assistant.", createdAt: nowIso(), createdBy: "Hotel Assistant" });
            created3.push(r.roomNumber);
          });
          setState(st);
          addAudit("Physical Room Blocked", created3.length + " room(s) blocked via Hotel Assistant (" + p.blockType + "): " + created3.join(", ") + ".", null,
            { module: "Room Blocks", recordId: created3.join(","), newValue: p.blockType });
          command.result = { ok: true, message: created3.length + " room(s) blocked as " + p.blockType + ": " + created3.join(", ") + ".", link: { label: "Open Physical Rooms", href: "physical-rooms.html" } };
        } else {
          command.result = { ok: false, message: "This action isn’t supported yet." };
        }
      } catch (e) {
        command.result = { ok: false, message: "Couldn’t apply the change — " + (e && e.message ? e.message : "please try again.") };
      }
      command.audit = { user: CURRENT_ROLE, ts: nowIso(), module: command.type, command: command.type,
        before: null, after: command.result, result: command.result ? command.result.ok : false, reason: "Confirmed via Hotel Assistant" };
      return command.result;
    }
  };

  function distinctBuildings(state) {
    var seen = {}, out = [];
    state.physicalRooms.forEach(function (r) { if (!seen[r.building]) { seen[r.building] = true; out.push(r.building); } });
    return out;
  }
  function roomTypeForNumbers(state, nums) {
    var r = state.physicalRooms.find(function (x) { return nums.indexOf(x.roomNumber) > -1; });
    return r ? state.roomTypes.find(function (x) { return x.id === r.roomTypeId; }) : null;
  }
  function autoNumberRange(state, roomTypeId, qty) {
    var existing = state.physicalRooms.filter(function (r) { return r.roomTypeId === roomTypeId; }).map(function (r) { return parseInt(r.roomNumber, 10); });
    var start = (existing.length ? Math.max.apply(null, existing) : 100) + 1;
    var out = [];
    for (var i = 0; i < qty; i++) out.push(String(start + i));
    return out;
  }
  function PG_fmtMoneySafe(v) { return fmtMoney(Number(v) || 0); }

  var AssistantService = {
    provider: MockAssistantProvider, // swap to a RealAssistantProvider later; UI is unchanged
    interpret: function (text) { return this.provider.interpret(text); },
    validate: function (command) { return this.provider.validate(command); },
    execute: function (command) { return this.provider.execute(command); }
  };

  /* ================================================================ */
  /* Hotel Assistant UI — floating button + right-side drawer / mobile  */
  /* sheet. Mounted once per page via PG.mountHotelAssistant(module).   */
  /* ================================================================ */
  function mountHotelAssistant(moduleLabel) {
    if (!ASSISTANT_CONFIG.assistantEnabled) return;
    if (document.getElementById("pgAssistantBtn")) return; // idempotent if called twice

    var btn = document.createElement("button");
    btn.type = "button"; btn.id = "pgAssistantBtn"; btn.className = "pg-assistant-fab";
    btn.setAttribute("aria-label", "Ask Hotel Assistant");
    btn.innerHTML = ICONS.spark + '<span class="pg-assistant-fab-label">Ask Hotel Assistant</span>';
    document.body.appendChild(btn);

    var overlay = document.createElement("div");
    overlay.className = "pg-drawer-overlay"; overlay.id = "pgAssistantDrawer";
    document.body.appendChild(overlay);

    var convo = []; // {role:'user'|'assistant', html}
    var pendingCommand = null, pendingClarify = null, pendingPreview = null;
    var loading = false, errorMsg = null;

    function push(role, html) { convo.push({ role: role, html: html }); }
    function clearConvo() { convo = []; pendingCommand = null; pendingClarify = null; pendingPreview = null; errorMsg = null; render(); }

    function bubble(entry) {
      return '<div class="pg-asst-msg ' + entry.role + '">' + entry.html + '</div>';
    }
    function previewCard(preview) {
      var rows = [
        ["Intent", esc(preview.intent)], ["Module", esc(preview.module)], ["Affected", preview.affected || "—"],
        ["Dates", preview.dates || "—"], ["Price", preview.prices || "—"], ["Quantity", preview.quantity != null ? preview.quantity : "—"]
      ];
      return '<div class="pg-asst-card"><div class="pg-asst-card-title">' + icon("info",14) + ' Understood request</div>' +
        rows.map(function (r) { return '<div class="pg-asst-card-row"><span>' + r[0] + '</span><span>' + r[1] + '</span></div>'; }).join("") +
        (preview.missing && preview.missing.length ? '<div class="pg-asst-card-missing">' + icon("alert",13) + ' Missing: ' + preview.missing.join(", ") + '</div>' : '') +
      '</div>';
    }
    // Friendly field labels + id-to-name resolution so the confirmation card reads
    // "Room Type: Deluxe Room" rather than "roomTypeId: dlx".
    var ASST_PARAM_LABELS = { roomNumbers:"Room Numbers", quantity:"Quantity", roomTypeId:"Room Type", building:"Building",
      name:"Name", mealPlan:"Meal Plan", basePrice:"Base Price", currency:"Currency", startDate:"Start Date", endDate:"End Date",
      price:"Price", ratePlanId:"Rate Plan", checkIn:"Check-in", checkOut:"Check-out", adults:"Adults", customerId:"Guest",
      autoAssign:"Auto-Assign Room", blockType:"Block Type", reasonText:"Reason" };
    function friendlyParamValue(state, key, value) {
      if (key === "roomTypeId") { var rt = state.roomTypes.find(function (x) { return x.id === value; }); return rt ? rt.name : value; }
      if (key === "ratePlanId") { var p = ratePlanById(state, value); return p ? p.name : value; }
      if (key === "customerId") { var c = state.customers.find(function (x) { return x.id === value; }); return c ? c.name : value; }
      if (key === "roomNumbers" && Array.isArray(value)) return value.join(", ");
      if (key === "basePrice" || key === "price") return fmtMoney(Number(value));
      if (key === "checkIn" || key === "checkOut" || key === "startDate" || key === "endDate") return fmtDateShort(value);
      return String(value);
    }
    function confirmCard(command) {
      var v = command.validation, st2 = getState();
      var rows = Object.keys(command.params).filter(function(k){return command.params[k]!=null && k!=='resolvedNumbers';}).map(function (k) {
        return '<div class="pg-asst-card-row"><span>' + esc(ASST_PARAM_LABELS[k] || k) + '</span><span>' + esc(friendlyParamValue(st2, k, command.params[k])) + '</span></div>';
      }).join("");
      return '<div class="pg-asst-card">' +
        '<div class="pg-asst-card-title">' + icon("check",14) + ' Confirm this change</div>' + rows +
        (v.errors.length ? '<div class="pg-asst-card-missing">' + v.errors.map(esc).join("<br>") + '</div>' : '') +
        '<div class="pg-asst-card-actions">' +
          '<button class="btn btn-primary btn-sm" id="asstConfirm"' + (!v.ok ? ' disabled' : '') + '>' + icon("check",14) + ' Confirm and Apply</button>' +
          '<button class="btn btn-light btn-sm" id="asstEdit">Edit Request</button>' +
          '<button class="btn btn-light btn-sm" id="asstCancel">Cancel</button>' +
        '</div></div>';
    }

    function render() {
      var d = overlay;
      d.innerHTML = '<div class="pg-drawer pg-assistant-drawer">' +
        '<div class="pg-drawer-header"><div><h3>' + icon("spark",16) + ' Hotel Assistant</h3>' +
          '<div class="muted text-sm">' + esc(moduleLabel) + ' · dummy mode</div></div>' +
          '<div style="display:flex;gap:6px;">' +
            '<button class="btn-icon" id="asstClear" title="Clear conversation" aria-label="Clear conversation">' + icon("refresh",16) + '</button>' +
            '<button class="pg-modal-close" onclick="PG.closeModal(\'pgAssistantDrawer\')" aria-label="Close">' + icon("x",18) + '</button>' +
          '</div></div>' +
        '<div class="pg-drawer-body pg-asst-convo" id="asstConvo">' +
          (convo.length ? convo.map(bubble).join("") : '<div class="pg-asst-empty">' + icon("spark",22) +
            '<div>Ask me to create rooms, rate plans, pricing periods, reservations, or room blocks — or ask where to find something.</div></div>') +
          (loading ? '<div class="pg-asst-msg assistant"><span class="pg-asst-typing"><span></span><span></span><span></span></span></div>' : '') +
          (errorMsg ? '<div class="help-note help-note-danger">' + icon("alert",16) + '<div>' + esc(errorMsg) + '</div></div>' : '') +
        '</div>' +
        '<div class="pg-drawer-footer pg-asst-footer">' +
          (pendingClarify && pendingClarify.quickChoices && pendingClarify.quickChoices.length ?
            '<div class="pg-asst-chips">' + pendingClarify.quickChoices.map(function (c) {
              return '<button type="button" class="pg-chip" data-quick="' + esc(String(c.value)) + '">' + esc(c.label) + '</button>';
            }).join("") + '</div>' : '') +
          '<div class="pg-asst-inputrow">' +
            '<button class="btn-icon bordered" id="asstVoice" aria-label="Voice input (not available in this prototype)" title="Voice input — not available in this prototype" disabled>' + icon("note",16) + '</button>' +
            '<input class="form-control" id="asstInput" type="text" placeholder="' + (pendingClarify ? esc(pendingClarify.question) : "Ask the Hotel Assistant…") + '" aria-label="Message">' +
            '<button class="btn btn-primary btn-icon" id="asstSend" aria-label="Send">' + icon("plus",16) + '</button>' +
          '</div>' +
        '</div>' +
      '</div>';

      var convoBox = document.getElementById("asstConvo");
      convoBox.scrollTop = convoBox.scrollHeight;

      document.getElementById("asstClear").addEventListener("click", clearConvo);
      document.getElementById("asstSend").addEventListener("click", onSend);
      document.getElementById("asstInput").addEventListener("keydown", function (e) { if (e.key === "Enter") onSend(); });
      d.querySelectorAll("[data-quick]").forEach(function (b) {
        b.addEventListener("click", function () { onQuickChoice(b.dataset.quick); });
      });
      var confirmBtn = document.getElementById("asstConfirm");
      if (confirmBtn) confirmBtn.addEventListener("click", onConfirmApply);
      var editBtn = document.getElementById("asstEdit");
      if (editBtn) editBtn.addEventListener("click", function () { pendingCommand = null; pendingPreview = null; push("assistant", "No problem — tell me what to change."); render(); });
      var cancelBtn = document.getElementById("asstCancel");
      if (cancelBtn) cancelBtn.addEventListener("click", function () { pendingCommand = null; pendingClarify = null; pendingPreview = null; push("assistant", "Cancelled — nothing was changed."); render(); });
    }

    function onQuickChoice(value) {
      if (!pendingClarify || !pendingCommand) return;
      var choice = (pendingClarify.quickChoices || []).find(function (c) { return String(c.value) === value; });
      pendingCommand.params[pendingClarify.paramKey] = value;
      push("user", esc(choice ? choice.label : value));
      pendingClarify = null;
      afterAnswer();
    }

    function afterAnswer() {
      // Re-derive missing[] against the now-updated params and either ask the next
      // question or move to the confirmation card — never applies on the first message.
      var cmd = pendingCommand;
      var stillMissing = [];
      if (cmd.type === "createPhysicalRooms") {
        if (!cmd.params.roomTypeId) stillMissing.push({ q: "Which room type should be assigned?", key: "roomTypeId",
          choices: PG.getState().roomTypes.map(function (x) { return { label: x.name, value: x.id }; }) });
        else if (!cmd.params.building) stillMissing.push({ q: "Which building should these rooms belong to?", key: "building",
          choices: distinctBuildings(PG.getState()).map(function (b) { return { label: b, value: b }; }) });
      } else if (cmd.type === "createRatePlan") {
        if (!cmd.params.roomTypeId) stillMissing.push({ q: "Which room type should this rate plan apply to?", key: "roomTypeId",
          choices: PG.getState().roomTypes.map(function (x) { return { label: x.name, value: x.id }; }) });
        else if (cmd.params.basePrice == null) stillMissing.push({ q: "What base price per night (USD)?", key: "basePrice",
          choices: [{label:"100",value:"100"},{label:"120",value:"120"},{label:"150",value:"150"}] });
      } else if (cmd.type === "createPricingPeriod" && !cmd.params.ratePlanId) {
        stillMissing.push({ q: "Which rate plan should this pricing period override?", key: "ratePlanId",
          choices: PG.getState().ratePlans.slice(0,6).map(function (p) { return { label: p.name, value: p.id }; }) });
      } else if (cmd.type === "createReservation" && !cmd.params.customerId) {
        stillMissing.push({ q: "Which guest is this reservation for?", key: "customerId",
          choices: PG.getState().customers.slice(0,5).map(function (c) { return { label: c.name, value: c.id }; }) });
      } else if (cmd.type === "createRoomBlock" && !cmd.params.blockType) {
        stillMissing.push({ q: "What type of block should this be?", key: "blockType",
          choices: [{label:"Out of Order",value:"Out of Order"},{label:"Out of Service",value:"Out of Service"},{label:"Management Hold",value:"Management Hold"},{label:"Other",value:"Other"}] });
      }
      if (stillMissing.length) {
        var next = stillMissing[0];
        pendingClarify = { question: next.q, paramKey: next.key, quickChoices: next.choices };
        push("assistant", esc(next.q));
        render();
        return;
      }
      // Nothing left to ask — validate and show the confirmation card.
      var v = AssistantService.validate(cmd);
      push("assistant", confirmCard(cmd));
      render();
    }

    function onConfirmApply() {
      if (!pendingCommand || !pendingCommand.validation.ok) return;
      loading = true; render();
      setTimeout(function () {
        var cmd = pendingCommand;
        cmd.confirmed = true;
        var result = AssistantService.execute(cmd);
        loading = false;
        pendingCommand = null; pendingClarify = null; pendingPreview = null;
        if (result && result.ok) {
          push("assistant", '<div class="help-note help-note-success">' + icon("check",16) + '<div>' + esc(result.message) +
            (result.link ? ' <a href="' + result.link.href + '">' + esc(result.link.label) + '</a>' : '') + '</div></div>');
          // "Update the visible screen when the current mock architecture supports it"
          // (§7 step 4) — each host page that mounts the assistant assigns its own
          // table/summary re-render function to this global hook, if it has one.
          if (typeof window.pgAssistantRefresh === "function") { try { window.pgAssistantRefresh(); } catch (e) {} }
        } else {
          errorMsg = (result && result.message) || "Something went wrong applying this change.";
          push("assistant", '<div class="help-note help-note-danger">' + icon("alert",16) + '<div>' + esc(errorMsg) + '</div></div>');
        }
        render();
      }, 550);
    }

    function onSend() {
      var input = document.getElementById("asstInput");
      var text = input.value.trim();
      if (!text) return;
      push("user", esc(text));
      input.value = "";

      if (pendingClarify) {
        pendingCommand.params[pendingClarify.paramKey] = text;
        pendingClarify = null;
        afterAnswer();
        return;
      }

      loading = true; errorMsg = null; render();
      setTimeout(function () {
        var out = AssistantService.interpret(text);
        loading = false;
        if (out.navTarget) {
          push("assistant", out.reply + ' <a href="' + out.navTarget.href + '" id="asstNavLink">Open ' + esc(out.navTarget.label.split("→").pop().trim()) + '</a>');
          render();
          return;
        }
        if (!out.ok || !out.command) {
          push("assistant", esc(out.reply || "I didn’t understand that."));
          render();
          return;
        }
        pendingCommand = out.command; pendingPreview = out.preview; pendingClarify = out.clarify;
        push("assistant", previewCard(out.preview));
        if (out.clarify) {
          pendingClarify = out.clarify;
          push("assistant", esc(out.clarify.question));
          render();
        } else {
          afterAnswer();
        }
      }, 450);
    }

    btn.addEventListener("click", function () { render(); openModal("pgAssistantDrawer"); });

    // Never let the assistant cover a drawer/modal's own primary action — while any
    // other drawer or modal is open, shrink the FAB to icon-only rather than hide it
    // outright, so it stays reachable but out of the way (§7).
    function syncFabForOverlays() {
      var anyOtherOpen = Array.prototype.some.call(document.querySelectorAll(".pg-drawer-overlay.show, .pg-modal-overlay.show"),
        function (el) { return el.id !== "pgAssistantDrawer"; });
      btn.classList.toggle("compact", anyOtherOpen);
    }
    new MutationObserver(syncFabForOverlays).observe(document.body, { attributes: true, attributeFilter: ["class"], subtree: true });
  }

  /* ---------------------------------------------------------------- */
  /* Public API                                                         */
  /* ---------------------------------------------------------------- */
  global.PG = {
    TODAY: TODAY,
    CURRENT_ROLE: CURRENT_ROLE,
    PERMISSIONS: PERMISSIONS,
    hasPermission: hasPermission,
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
    basePriceFor: basePriceFor,
    ratePlansForType: ratePlansForType,
    ratePlansForRoom: ratePlansForRoom,
    planScopeLabel: planScopeLabel,
    planScopeRooms: planScopeRooms,
    summarizeRoomNumbers: summarizeRoomNumbers,
    defaultRatePlanFor: defaultRatePlanFor,
    ratePlanById: ratePlanById,
    periodTimeState: periodTimeState,
    periodCoversDate: periodCoversDate,
    periodPriceForDate: periodPriceForDate,
    overrideKey: overrideKey,
    resolvePrice: resolvePrice,
    nightlyBreakdown: nightlyBreakdown,
    validateRatePlanForStay: validateRatePlanForStay,
    overlappingPeriods: overlappingPeriods,
    periodAffectedDates: periodAffectedDates,
    roomItemCharge: roomItemCharge,
    reservationRoomCharges: reservationRoomCharges,
    reservationTotal: reservationTotal,
    snapshotRoomItemPricing: snapshotRoomItemPricing,
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
    ASSISTANT_CONFIG: ASSISTANT_CONFIG,
    AssistantService: AssistantService,
    mountHotelAssistant: mountHotelAssistant,
    wireMoreMenus: wireMoreMenus,
    closeMoreMenu: closeMoreMenu,
    renderManagedSelect: renderManagedSelect,
    confirmDialog: confirmDialog,
    openAmenitySelector: openAmenitySelector,
    amenityCategoryOrder: amenityCategoryOrder,
    amenityChipsHtml: amenityChipsHtml,
    segmented: segmented,
    wireSegmented: wireSegmented,
    filterChips: filterChips,
    wireChips: wireChips,
    appliedChips: appliedChips,
    renderCombobox: renderCombobox,
    icon: icon,
    REF: REF
  };
})(window);
