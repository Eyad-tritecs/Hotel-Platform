/* Palestine Grand Hotel — Admin Platform Prototype
   Shared shell, seed data, and state engine. No backend — localStorage simulates persistence. */

(function (global) {
  "use strict";

  var STORAGE_KEY = "pg_hotel_admin_state_v1";
  var TODAY = "2026-08-23"; // fixed "today" for reproducible demo data

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

    var customers = [
      { id: "cus-1", name: "Ahmad Khalil", phone: "+970 59 123 4567", email: "ahmad.khalil@example.com", nationality: "Palestinian", notes: "" },
      { id: "cus-2", name: "Sara Ali", phone: "+970 56 234 5678", email: "sara.ali@example.com", nationality: "Palestinian", notes: "Prefers high floor." },
      { id: "cus-3", name: "Omar Hassan", phone: "+962 79 345 6789", email: "omar.hassan@example.com", nationality: "Jordanian", notes: "" }
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
          { roomTypeId: "dlx", qty: 2, ratePlanName: "Flexible + Breakfast" },
          { roomTypeId: "fam", qty: 1, ratePlanName: "Flexible + Breakfast" }
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
          { roomTypeId: "std", qty: 1 }
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
        paymentStatus: "Link Sent",
        paymentMethod: "Payment Link",
        rooms: [{ roomTypeId: "fam", qty: 1 }],
        taxAmount: 0,
        feeAmount: 0,
        notes: "Booked through Al-Quds Travel Agency.",
        paymentLinkSentAt: TODAY + "T08:07",
        activity: [
          { ts: TODAY + "T08:05", text: "Reservation created via Travel Agency by Hotel Admin." },
          { ts: TODAY + "T08:07", text: "Payment link generated and sent to guest." }
        ]
      }
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
        phone: "+970 2 274 1000",
        email: "reservations@palestinegrand.com",
        checkInTime: "14:00",
        checkOutTime: "12:00",
        timezone: "GMT+2 (Asia/Hebron)",
        starRating: 4,
        status: "Active",
        policySummary: "Free cancellation up to 24 hours before arrival. Standard check-in is 14:00 and check-out is 12:00. Full payment is due at check-in unless the reservation was prepaid via Payment Link."
      },
      roomTypes: roomTypes,
      rates: rates,
      inventoryOverrides: {}, // key "roomTypeId|date" -> {stopSell:true, reason}
      dateAdjustments: {}, // key "roomTypeId|date" -> cumulative sellable-quantity delta for that date
      adjustments: [], // manual sellable-quantity adjustments
      customers: customers,
      reservations: reservations,
      nextResId: 10248,
      ratePlans: [
        { id: "rp1", name: "Flexible Room Only", roomTypeId: "std", mealPlan: "Room Only", startDate: TODAY, endDate: addDays(TODAY, 90), price: 100, currency: "USD", active: true },
        { id: "rp2", name: "Flexible + Breakfast", roomTypeId: "dlx", mealPlan: "Breakfast Included", startDate: TODAY, endDate: addDays(TODAY, 90), price: 120, currency: "USD", active: true },
        { id: "rp3", name: "Weekend Rate", roomTypeId: "fam", mealPlan: "Breakfast Included", startDate: TODAY, endDate: addDays(TODAY, 90), price: 150, currency: "USD", active: true }
      ],
      audit: [
        { ts: TODAY + "T08:05", actor: "Hotel Admin", action: "Reservation Created", details: "RES-10247 created via Travel Agency." },
        { ts: TODAY + "T08:07", actor: "Hotel Admin", action: "Payment Link Sent", details: "Payment link sent for RES-10247." },
        { ts: TODAY + "T09:14", actor: "Hotel Admin", action: "Reservation Created", details: "RES-10245 created via Phone." },
        { ts: TODAY + "T11:40", actor: "Hotel Admin", action: "Reservation Created", details: "RES-10246 created via WhatsApp." }
      ]
    };
  }

  /* ---------------------------------------------------------------- */
  /* State persistence                                                  */
  /* ---------------------------------------------------------------- */
  function getState() {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      var seed = buildSeed();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
      return seed;
    }
    try {
      return JSON.parse(raw);
    } catch (e) {
      var seed2 = buildSeed();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seed2));
      return seed2;
    }
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
    return '<span class="badge ' + (PAY_BADGE[status] || "badge-gray") + '"><span class="badge-dot"></span>' + status + "</span>";
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
  var NAV = [
    { section: "Hotel Management", items: [
      { key: "hotel-profile", label: "Hotel Profile", href: "hotel-profile.html", icon: "building" },
      { key: "room-types", label: "Room Types", href: "room-types.html", icon: "bed" },
      { key: "rates", label: "Rates", href: "rates.html", icon: "tag" },
      { key: "availability", label: "Availability & Inventory", href: "availability-inventory.html", icon: "calendar" }
    ]},
    { section: "Reservations", items: [
      { key: "reservations", label: "Reservations", href: "reservations.html", icon: "list" },
      { key: "new-reservation", label: "New Reservation", href: "new-reservation.html", icon: "plus" }
    ]},
    { section: "Payments", items: [
      { key: "payments", label: "Payments", href: "payments.html", icon: "card" }
    ]},
    { section: "Settings", items: [
      { key: "policies", label: "Hotel Policies", href: "hotel-policies.html", icon: "shield" },
      { key: "taxes", label: "Taxes & Fees", href: "taxes-fees.html", icon: "percent" },
      { key: "payment-config", label: "Payment Configuration", href: "payment-configuration.html", icon: "settings" }
    ]},
    { section: "Administration", items: [
      { key: "users", label: "Users", href: "users.html", icon: "user" },
      { key: "roles", label: "Roles", href: "roles.html", icon: "layers" },
      { key: "permissions", label: "Permissions", href: "permissions.html", icon: "lock" },
      { key: "audit", label: "Audit", href: "audit.html", icon: "clock" }
    ]}
  ];

  var ICONS = {
    building: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 21V5a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v16"/><path d="M14 21v-6h6v6"/><path d="M8 7h.01M11 7h.01M8 10h.01M11 10h.01M8 13h.01M11 13h.01"/></svg>',
    bed: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 18v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6"/><path d="M3 18v2M21 18v2M3 12V8a1 1 0 0 1 1-1h6v5"/></svg>',
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
    clock: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>'
  };

  function renderSidebar(activeKey) {
    var html = '<aside class="pg-sidebar">';
    html += '<div class="pg-sidebar-brand"><div class="logo-badge">PG</div><div><div class="brand-text">Palestine Grand</div><div class="brand-sub">Hotel Admin Platform</div></div></div>';
    html += '<div class="pg-sidebar-tenant"><div><div class="t-name">Palestine Grand Hotel</div><div class="t-role">Pilot Tenant &middot; Hotel Admin</div></div><span class="chev">&#9662;</span></div>';
    html += '<nav class="pg-nav">';
    NAV.forEach(function (sec) {
      html += '<div class="pg-nav-section"><div class="pg-nav-section-title">' + sec.section + "</div>";
      sec.items.forEach(function (it) {
        html += '<a class="pg-nav-item' + (it.key === activeKey ? " active" : "") + '" href="' + it.href + '"><span class="ic">' + ICONS[it.icon] + '</span><span>' + it.label + "</span></a>";
      });
      html += "</div>";
    });
    html += "</nav></aside>";
    return html;
  }

  function renderHeader(crumbs) {
    var crumbHtml = crumbs.map(function (c, i) {
      return i === crumbs.length - 1 ? "<b>" + esc(c) + "</b>" : esc(c);
    }).join(' <span>/</span> ');
    var html = '<header class="pg-header">';
    html += '<div class="pg-header-left"><div class="pg-breadcrumb">' + crumbHtml + "</div></div>";
    html += '<div class="pg-header-right">';
    html += '<a class="pg-header-btn" href="new-reservation.html">' + ICONS.plus + " New Reservation</a>";
    html += '<button class="pg-header-btn" id="pg-reset-btn" title="Reset all prototype data back to the seeded demo state">&#8635; Reset Demo Data</button>';
    html += '<div class="pg-user"><div class="avatar">HA</div><div><div class="u-name">Hotel Admin</div><div class="u-role">Palestine Grand Hotel</div></div></div>';
    html += "</div></header>";
    return html;
  }

  function mount(activeKey, crumbs) {
    var root = document.getElementById("pg-app");
    root.className = "pg-shell";
    root.innerHTML = renderSidebar(activeKey) + '<div class="pg-main">' + renderHeader(crumbs) + '<main class="pg-content" id="pg-page"></main></div>';
    document.getElementById("pg-reset-btn").addEventListener("click", function () {
      if (confirm("Reset all prototype data to the original seeded demo state? This clears any reservations, edits, or inventory changes you made.")) {
        resetState();
        toast("Demo data has been reset.", "success");
        setTimeout(function () { location.reload(); }, 400);
      }
    });
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
  /* Public API                                                         */
  /* ---------------------------------------------------------------- */
  global.PG = {
    TODAY: TODAY,
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
    statusBadge: statusBadge,
    payBadge: payBadge,
    esc: esc,
    occupancyLabel: occupancyLabel,
    toast: toast,
    mount: mount,
    openModal: openModal,
    closeModal: closeModal
  };
})(window);
