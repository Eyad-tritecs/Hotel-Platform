# Palestine Grand Hotel — Hotel Reservation and Basic Room Operations Platform (Prototype)

**Live site:** https://eyad-tritecs.github.io/Hotel-Platform/
**Repository:** https://github.com/Eyad-tritecs/Hotel-Platform (owner account: `Eyad-tritecs`)
**Status:** Actively evolving clickable prototype, no backend, no build step.

This document exists so a **new chat session** (or a new developer) can pick up this project with full context, without needing to re-read the entire conversation history that produced it. Read this file first before making any further changes.

---

## 1. What this project is

A **clickable, browser-based prototype** of a B2B, multi-tenant, admin-first Hotel Reservation and Basic Room Operations Platform, built for a single pilot hotel: **Palestine Grand Hotel** (Bethlehem, Palestine, USD currency). It is designed to let Product, Engineering, and business stakeholders understand the MVP scope by *navigating* realistic workflows rather than reading a spec document.

It is **not** a real product: there is no server, no database, no authentication, and no real payment processing. All "backend" behavior is simulated client-side (see §4).

### 1.1 Product positioning (do not violate these constraints)

- B2B, admin-first, desktop-first, multi-tenant platform (this prototype models **one tenant**: Palestine Grand Hotel).
- Operated from a Hotel Admin Panel — **for hotel staff**, not guests.
- Visual language: **Metronic-style** enterprise admin UI (dark navy sidebar, white content, card-based layout, top header).
- **Physical rooms are inside the MVP** (as of the room-operations scope update): a lightweight operational layer beneath room-type commercial inventory — see §4.6. Full front-desk and housekeeping functionality (check-in/out workflows, housekeeping status boards, maintenance ticketing) remains **outside** the MVP.

### 1.2 Explicitly out of scope — do not build these

A customer-facing booking website or mobile app; OTA integrations (Booking.com, Expedia, Agoda, Hotels.com, Trip.com) or OTA sync; PMS/CRS/Channel Manager integrations; outbound ARI; Check-in/Check-out as a workflow; housekeeping; maintenance ticketing; POS/restaurant management; folios/full accounting; payroll/HR; CRM marketing; loyalty; gift cards; advanced promotions/revenue management; advanced BI; AI features; complex group booking / rooming lists; complex split payments; overbooking.

These exclusions have been **explicitly and repeatedly audited** against the codebase (grepped for banned terms) — see commit `292f6b3` for the audit methodology. Any future work must preserve this boundary.

---

## 2. How to run it locally

No build step, no `npm install` for the app itself (it's static HTML/CSS/JS). You only need a static file server because the app uses `fetch`-free but path-relative navigation and `localStorage`, which behaves inconsistently under `file://`.

The repo includes `.claude/launch.json` wired for the `Claude_Browser` preview tools:

```json
{
  "configurations": [
    { "name": "hotel-prototype", "runtimeExecutable": "npx", "runtimeArgs": ["--yes", "serve", "-l", "8791", "."], "port": 8791 }
  ]
}
```

Manually, from the project root:

```bash
npx serve -l 8791 .
```

Then open `http://localhost:8791/index.html`.

**Important:** `serve.json` at the project root sets `{"cleanUrls": false}`. Without this, the `serve` package strips query strings when redirecting `page.html` → `page`, which silently breaks every link that passes data via `?id=...` (reservation detail, room-type edit, etc.). Do not remove `serve.json`.

### 2.1 Deployment

Deployed via **GitHub Pages** from the `main` branch root (no build step — GitHub Pages serves the static files directly). Every `git push` to `main` redeploys automatically within roughly a minute. There is no staging environment; `main` is live.

```bash
git add -A && git commit -m "..." && git push
```

GitHub CLI (`gh`) is authenticated locally as `Eyad-tritecs`. Do not re-authenticate a different account without the user's explicit instruction (this has happened once before, deliberately, at the user's request).

---

## 3. Tech stack and architectural approach

- **Plain HTML + vanilla JS (ES5-leaning syntax, `var`/`function`, no build tooling, no framework, no JSX/TSX).** Every page is a standalone `.html` file with an inline `<script>` block. There is no bundler — what you write is what ships.
- **One shared stylesheet:** `assets/css/style.css` — the entire design system (see §6).
- **One shared script:** `assets/js/app.js` — state engine, seed data, shared UI shell, and a small reusable component library, exposed as the global `PG` object (see §5).
- **Persistence:** `localStorage`, under the single key `pg_hotel_admin_state_v1`. There is no server. "Saving" a reservation, adjusting inventory, etc. all just mutate a JSON blob in `localStorage`.
- **Fonts:** Google Fonts `Inter` (and `Tajawal` for the Arabic screen), loaded via `<link>` in each page's `<head>`.

### 3.1 Why this approach

The prototype needs to *feel* like a real connected system (creating a reservation actually reduces availability elsewhere; cancelling actually restores it) without any backend. A shared `localStorage`-backed state object accessed through a small set of pure functions (`PG.getState()`, `PG.setState()`, `PG.computeAvailability()`, etc.) achieves that cheaply. Every page calls `PG.getState()` fresh at the top of its script and re-reads it after any mutation, so cross-page consistency is automatic.

---

## 4. The state engine (`assets/js/app.js`)

### 4.1 Seed data and schema migration

`buildSeed()` returns the full initial state object. `getState()`:

1. If no `localStorage` entry exists, seeds fresh and returns it.
2. If one exists, `JSON.parse`s it, then **backfills any top-level key that exists in a fresh seed but not in the parsed object** (this is a schema-migration safety net — see §4.4). This was a real bug fixed in commit `07c7269`: without it, any browser holding state saved before a new top-level field was introduced (e.g. `bedConfigs`, `mealPlans`) would throw and silently break the entire page.

**When you add a new top-level field to the seed state, you get migration for free — no extra code needed.** When you add a new *nested* field (e.g. a new property on each reservation, like `taxAmount`), existing reservations in a user's saved state will simply have that field as `undefined`; guard for that in reading code (e.g. `r.taxAmount != null ? r.taxAmount : <fallback>`), as done throughout the codebase.

### 4.2 State shape (top-level keys)

```
{
  seededAt, hotel, roomTypes, physicalRooms, roomAssignments, roomBlocks,
  rates, bedConfigs, mealPlans,
  inventoryOverrides, dateAdjustments, adjustments,
  customers, reservations, nextResId, ratePlans, audit
}
```

- **`hotel`** — single tenant profile object: `name, legalName, propertyCode, currency, city, country, address, phoneCode, phone, email, checkInTime, checkOutTime, timezone, starRating, status, policySummary`.
- **`roomTypes`** — array of `{ id, name, code, sellable, baseCapacity, maxAdults, maxChildren, bed, baseRate, active, desc }`. `sellable` is the *current* count (mutated by adjustments); `baseCapacity` is the original seeded count, kept immutable so the UI can show "Configured Capacity" vs. "Authorized Adjustments" as a diff.
- **`physicalRooms`**, **`roomAssignments`**, **`roomBlocks`** — the physical-room operational layer, introduced alongside the room-operations scope update. See §4.6.
- **`rates`** — `{ [roomTypeId]: { [date]: price } }`, a per-date calendar used by `PG.rateFor()`. This is the actual pricing engine for computing reservation totals — **not** the same thing as `ratePlans` (see below), which is an admin-facing display concept.
- **`ratePlans`** — array of `{ id, name, roomTypeId, mealPlan, startDate, endDate, price, currency, active }`. These are shown in the Rates screen and picked in the New Reservation wizard's Rate Plan dropdown, but the *actual* price used in totals still comes from the `rates` calendar via `PG.rateFor()`. (This is a known inconsistency — see §9.)
- **`bedConfigs`**, **`mealPlans`** — flat string arrays, user-editable via the "managed select" component (§6.4). Seeded with a handful of common values.
- **`inventoryOverrides`** — `{ "roomTypeId|date": { stopSell: true, reason } }`. Presence of a key = Stop Sell is active for that room type + date.
- **`dateAdjustments`** — `{ "roomTypeId|date": numericDelta }`. Additive per-date sellable-quantity adjustment (from the Adjust Inventory drawer's Increase/Decrease actions), layered on top of `roomTypes[].sellable`.
- **`adjustments`** — audit-style log of inventory adjustment actions (separate from the general `audit` array; used nowhere in the UI currently except as a data trail — candidate for a future "Inventory Reports" screen).
- **`customers`** — array of `{ id, name, phone, email, nationality, notes }`. No login/auth concept.
- **`reservations`** — see §4.3.
- **`nextResId`** — integer counter for generating `RES-#####` IDs.
- **`audit`** — global audit trail array of `{ ts, actor, action, details }`, shown on the Audit page and used to power some Dashboard alerts.

### 4.3 Reservation object shape

```js
{
  id: "RES-10245",
  customerId, source, createdAt, checkIn, checkOut,
  status,            // Draft | Pending Payment | Confirmed | Cancelled | Completed | No Show
  paymentStatus,     // Pay on Arrival | Payment Required | Link Sent | Paid | Failed | Expired | Refund Pending | Refunded
  paymentMethod,     // "Pay on Arrival" | "Payment Link"
  rooms: [ { id, roomTypeId, qty, adults, children, ratePlanName } ],  // one or more "Reservation Items"; `id` (e.g. "RES-10245-itm-1") is what RoomAssignment.reservationItemId points to
  taxAmount, feeAmount,   // stored at creation time so Reservation Detail's pricing always matches what was shown when booked
  notes,
  transactionRef, paymentLinkUrl, paymentLinkGeneratedAt, paymentLinkExpiresAt, paymentPaidAt,  // payment-link lifecycle fields, populated as the flow progresses
  activity: [ { ts, text } ]   // per-reservation timeline, shown in Reservation Detail's Activity/Audit section
}
```

**Domain rules this shape encodes (do not break these):**
1. One reservation → one or more Reservation Items (`rooms[]`).
2. Each item carries Room Type, Quantity, Rate Plan (name), Occupancy (adults/children), and its price is derivable via `PG.rateFor()`.
3. Stay dates (`checkIn`/`checkOut`) are **reservation-level, shared across all items** — this is a deliberate MVP simplification (a guest books one trip with possibly multiple room types, all for the same date range). Do not silently change this to per-item dates without discussing it — it would be a significant architecture change.
4. Payment (`paymentMethod`, `paymentStatus`, `transactionRef`, etc.) belongs to the **whole reservation**, never to an individual item.
5. `status` (Reservation Status) and `paymentStatus` (Payment Status) are **separate fields, kept visually distinct** (see §6.3) but correlated by business logic (e.g. cancelling a Paid reservation sets `paymentStatus` to `Refund Pending`).
6. Occupancy (`adults`/`children`) per item is **derived, not user-entered** — computed from the room type's `maxAdults`/`maxChildren` × quantity in the New Reservation wizard, and is read-only in the UI. This was a deliberate change (see commit history around the "New Reservation" rework).
7. Each reservation item has a stable `id` (a nested field, so it's `undefined` on reservations saved before this was added — guard accordingly). `RoomAssignment.reservationItemId` references it, connecting a commercial Reservation Item to one or more physical rooms.

### 4.4 Availability & pricing engine

- `PG.computeAvailability(state, roomTypeId, dateStr)` → `{ sellable, booked, available, stopSell }`. `sellable` = `roomTypes[].sellable` + `dateAdjustments[key]`. `booked` = sum of `qty` across all non-Cancelled reservations whose `[checkIn, checkOut)` includes that date. `available` = 0 if `stopSell`, else `max(0, sellable - booked)`.
- `PG.validateAvailability(state, roomTypeId, checkIn, checkOut, qty)` → checks every night in the range, returns `{ ok, problems, nights }`. This is what blocks the New Reservation wizard from proceeding when inventory is insufficient.
- `PG.bookedCount()`, `PG.isStopSell()`, `PG.rateFor()` are the lower-level primitives the above are built from.
- **Inventory is always computed live from `reservations` + `inventoryOverrides` + `dateAdjustments`** — there is no separately-maintained "booked count" that could drift out of sync. This is why creating/cancelling a reservation is immediately reflected everywhere (Dashboard, Availability grid, etc.) without any extra bookkeeping.

### 4.5 Date handling — a hard-won lesson

**All date math (`PG.addDays`, `PG.dateRange`, `PG.fmtDate`, etc.) is implemented in UTC via `Date.UTC(...)`, never via local-time `Date` parsing.** This was a real, painful bug (commit history around "Fix state migration..." mentions it, but the actual root-cause fix was in an earlier session): parsing `"2026-08-23T00:00:00"` as local time and then calling `.toISOString()` can silently roll the date backward or forward depending on the host machine's UTC offset. In one sandboxed browser environment this caused an *infinite loop* in `dateRange()` that crashed the whole page. **Never reintroduce local-time date parsing anywhere in this codebase.** Always go through the `PG.*` date helpers.

### 4.6 Physical rooms — the operational allocation layer

Physical rooms sit **beneath** room-type commercial inventory as a second, connected layer:

- **Room-type inventory** (`roomTypes[].sellable`, `rates`, `inventoryOverrides`, `dateAdjustments`) is the **commercial** availability and pricing layer — unchanged by this update, still what `PG.computeAvailability()`/`PG.validateAvailability()` operate on, and still what the New Reservation wizard checks before letting a booking proceed.
- **Physical-room assignment** (`physicalRooms`, `roomAssignments`, `roomBlocks`) is the **operational** allocation layer: which actual room fulfills which reservation item, for which date range.

**`physicalRooms`** — array of `{ id, propertyId, roomTypeId, roomNumber, building, floor, bedConfiguration, view, accessibilityFeatures, connectingRoomIds, notes, isActive, isSellable, operationalStatus }`. `operationalStatus` is the room's **stored, manually-set** baseline state — one of `Available | Held | Out of Order | Out of Service | Inactive`. `Reserved` is never stored; it's always derived live from a covering `roomAssignment` (see `PG.roomStatusOn()`). Housekeeping states (**Clean/Dirty/Inspected/Checked In/Checked Out/Occupied**) are deliberately excluded — out of MVP scope per §1.2.

**`roomAssignments`** — array of `{ id, propertyId, reservationId, reservationItemId, physicalRoomId, arrivalDate, departureDate, assignmentStatus, assignedAt, assignedBy, changeReason }`. `assignmentStatus` is currently `Assigned` (confirmed) | `Held` (tentative, used while the reservation itself isn't yet Confirmed/Paid) | `Cancelled`. One reservation item with `qty > 1` has one `roomAssignment` per physical room (e.g. RES-10245's `dlx` item, qty 2, has two assignment rows).

**`roomBlocks`** — array of `{ id, propertyId, physicalRoomId, startDate, endDate, type, reason, notes, createdAt, createdBy }`. An operational hold against a specific physical room independent of any reservation (maintenance, deep cleaning, etc.). `blk-3` in the seed data is a **deliberate conflict** — it overlaps `asn-5`'s tentative hold on the same room (`fam-402`) — and is what the Reservation Detail "Needs Attention" flag (see §4.7) surfaces automatically on RES-10247 out of the box; it's a live demonstration of that flow, not just a data-layer artifact anymore.

**Engine helpers** (`assets/js/app.js`): `PG.physicalRoomsForType()`, `PG.isPhysicalRoomBlocked()`, `PG.isPhysicalRoomAssigned()`, `PG.roomStatusOn()`, `PG.eligiblePhysicalRooms()` / `PG.eligiblePhysicalRoomCount()` (active + sellable + unblocked + unassigned rooms of a type on a date), and `PG.validateRoomAssignmentCapacity()` (the physical-layer counterpart to `PG.validateAvailability()` — blocks confirming more assignments than eligible physical rooms exist for the stay; **no overbooking** at this layer).

**Known, intentional gap:** `physicalRooms` counts (active + sellable) don't always numerically equal `roomTypes[].sellable` yet — e.g. Standard has 10 physical rooms but only 8 are currently active+sellable (one Out of Order, one Inactive). The two layers are not yet unified into a single source of truth. Do not silently "fix" this mismatch — it's seeded deliberately to demonstrate the layering.

**`physical-rooms.html`** (see §8) manages this layer directly — add/edit rooms, block rooms, activate/deactivate. New Reservation and Reservation Detail now assign specific rooms too — see §4.7.

### 4.7 Room-assignment recommendation engine (deterministic — no AI, no optimization solver)

A room type selection in New Reservation now **auto-assigns** a physical room by default — "Book without assigning a room" is not offered as an option anywhere. The engine lives in `assets/js/app.js` and is exercised directly by `tests/room-assignment.test.js` (§10a).

- **Eligibility** (`PG.roomEligibleForStay(state, room, checkIn, checkOut, excludeAssignmentId)`): a room qualifies only if it's active + sellable, has no overlapping non-Cancelled `roomAssignment` for any night of the stay, and has no overlapping `roomBlock` of type `Out of Order`, `Out of Service`, or `Management Hold`. **A block of type `Other` does not disqualify a room** — an explicit, deliberate MVP carve-out (that block type is informational only). `PG.roomMeetsRequirements()` layers a hard filter on top for *required* attributes — currently just the "Requires Wheelchair Accessible Room" checkbox in New Reservation, which maps to `requireAccessibility: ['Wheelchair Accessible']`.
- **Priority** (`PG.rankRoomsForAssignment()`), most-recommended first: (1) retaining an already-assigned room across an edit is handled *before* ranking even runs, in `PG.autoAssignRoomsForItem()` — a kept room only drops out if it's no longer eligible; (2) preference match count (bed configuration, connecting-room request); (3) `PG.roomAdjacencyScore()` — prefers a room with no assignment/block landing on the night before arrival or on the departure night, ahead of; (4) lowest room number, the final deterministic tie-breaker. A qty≥2 item with "Request Connecting Rooms" checked additionally tries to seat a mutually-connecting pair first (`PG.findConnectingPair()`), a light heuristic, not a solver.
- **`PG.autoAssignRoomsForItem(state, request)`** → `{ assignedRoomIds, shortfall }`. Never assigns the same physical room twice within one call, and honors `request.excludeRoomIds` so sibling items in the same multi-room reservation can't collide. `shortfall > 0` means demand exceeds eligible supply — the UI must block confirmation, never overbook.
- **`PG.roomIneligibilityReason()`** returns a short, **non-sensitive** category only — `Reserved | Out of Order | Out of Service | Held | Attribute Mismatch | Inactive | Not Sellable` — never a block's free-text `reason`/`notes` field. This is what both the wizard's "no availability" messaging and the Change Room drawer's disabled-room labels use; a block's actual reason text (e.g. "Plumbing leak repair") is deliberately never shown to reservation-flow staff.
- **`PG.renderChangeRoomDrawer(opts)`** — the shared, structured room picker (a right-side drawer, never a plain `<select>`) used by both New Reservation and Reservation Detail. Ranks eligible rooms first, lists ineligible ones disabled with a reason badge, marks the currently-assigned room, supports search + floor/view/bed/accessibility/connecting filters, and requires picking a new room before showing an impact summary and enabling Confirm. Its DOM (`#pgChangeRoomDrawer`) and CSS (`.crd-*`, `.chip` in `style.css`) are created lazily and reused across opens on a page.
- **Unassign Room** is a secondary, permission-controlled action (gated on `PG.CURRENT_ROLE`, same dead-code-today pattern as `physical-rooms.html`) available only from Reservation Detail — never offered during the New Reservation flow. It requires a reason, sets the assignment's `assignmentStatus` to `Cancelled` (never deletes the record — preserves audit history), and Reservation Detail shows a persistent `help-note-danger` banner on that reservation until every unit has a room again.
- **Needs Attention:** Reservation Detail independently re-checks every live assignment's room against `PG.roomEligibleForStay()` on every render. If a room was blocked *after* being assigned, the assignment is flagged in place (no silent reassignment) with a "Needs Attention" badge, and the same Change Room drawer is used to pick a replacement — the flagged room still shows in the list (marked "Currently Assigned" + its ineligibility reason) so staff can see exactly what changed.
- Reservation items now round-trip a `roomAssignment` per physical room at save time in `new-reservation.html`'s `createReservation()`: `Confirmed` reservations get `Assigned` records, `Draft`/`Pending Payment` get tentative `Held` ones — same convention as the seed data.

---

## 5. Shared UI shell (`PG.mount`, sidebar, header)

Every page's `<body>` is just `<div id="pg-app"></div>` + `<script src="assets/js/app.js"></script>` + an inline `<script>`. The inline script calls:

```js
var page = PG.mount("<nav-key>", ["Crumb 1", "Crumb 2", ...]);
```

`PG.mount()`:
- Renders the sidebar (`renderSidebar`) using the `NAV` array (see §7 for current structure), highlighting the item whose `key` matches the first argument.
- Renders the header (`renderHeader`) with the breadcrumb trail and the shared header buttons (New Reservation, Reset Demo Data, and — only on the Reservations page — the Arabic toggle).
- Returns the `<main id="pg-page">` element; the page's script builds an HTML string and assigns it to `page.innerHTML`.

### 5.1 Breadcrumb linking rule

**Only a *middle* breadcrumb crumb is ever a clickable link.** The first crumb (section label, e.g. "Hotel Management") and the last crumb (current page) are always plain text. This was an explicit, deliberate fix (commit `07c7269`) after the user pointed out the opposite behavior was wrong. `CRUMB_LINKS` in `app.js` maps known crumb label strings to their `.html` file. When adding a new page, pass crumbs like `["Section", "List Page Name", "Current Sub-Page"]` for a 3-level trail (middle one links back to the list), or just `["Section", "Page Name"]` for a top-level page (zero links, matches the Hotel Profile pattern). Reservation Detail deliberately passes `["Reservations", "Reservations", "Reservation Detail"]` (the section label and the list-page label are both literally "Reservations", by design, per explicit user instruction).

### 5.2 Property-context control

The header also renders a `.pg-property-ctx` pill showing "Palestine Grand Hotel" with a building icon, to the left of the breadcrumb. Per spec: single-property users (this whole prototype, currently) see just the name, no switcher. A multi-property switcher was never built — there is only one tenant/property in this prototype.

### 5.3 Role gating

`CURRENT_ROLE` (currently hardcoded to `"Hotel Admin"`) in `app.js` gates `NAV` items flagged `superAdminOnly: true` (currently only "Hotels"). There is no login screen or role switcher UI — this is a hardcoded persona. If a future prompt asks for a role switcher, this is the variable to wire up.

---

## 6. Design system components (`assets/css/style.css`)

The visual language is **Metronic-inspired**: dark navy sidebar (`--pg-sidebar-bg: #1e2129`), white content area, primary blue `--pg-primary: #1B84FF`, card-based layout with `border-radius: 8px`, dense operational tables. All design tokens are CSS custom properties on `:root` — check there before hardcoding a color.

### 6.1 Core components (all shared, all in `style.css` unless noted)

| Component | Classes | Notes |
|---|---|---|
| Buttons | `.btn .btn-primary/-light/-outline/-success/-danger/-danger-outline`, `.btn-sm`, `.btn-block` | Hover states explicitly re-declare label color (a global `a:hover` rule has higher specificity than `.btn-primary`'s base color and was silently making button labels disappear on hover — fixed, don't remove those hover color declarations). |
| Cards | `.card .card-header .card-body .card-footer` | `.card-body.no-pad` for edge-to-edge tables. |
| Tables | `table.dt` | Dense operational table style. |
| Badges | `.badge .badge-gray/-blue/-green/-yellow/-red/-purple`, `.badge-dot`, `.badge-outline` | **Reservation Status uses solid badges; Payment Status always adds `.badge-outline`** (outlined, not filled) so the two are visually distinguishable even when they share a color semantic. Use `PG.statusBadge(status)` / `PG.payBadge(status)` — never hand-roll a badge. |
| Alerts | `.help-note` (default = info/blue), `.help-note-warning/-danger/-success` | Use these instead of inline `style="background:..."` — that was the pattern before it got formalized (commit `c7df2cc`). |
| Modals | `.pg-modal-overlay.show > .pg-modal` with `.pg-modal-header/-body/-footer` | Opened/closed via `PG.openModal(id)` / `PG.closeModal(id)`, which just toggle the `.show` class. Use for **confirmations** (Cancel Reservation, Stop Sell, Reopen). |
| Drawers | `.pg-drawer-overlay.show > .pg-drawer` with `.pg-drawer-header/-body/-footer` | Same open/close mechanics as Modal (same `PG.openModal`/`closeModal`, just different overlay class). Use for **longer forms** (currently only Adjust Inventory). RTL-aware (`html[dir="rtl"]` flips the slide direction). |
| Toasts | `PG.toast(message, type)` | `type` ∈ `success/warn/danger`. Auto-dismisses. |
| Tabs | `.pg-tabs .pg-tab.active` | Defined in CSS but not currently used anywhere — Reservation Detail uses numbered structured sections instead (an explicitly-allowed alternative per an earlier prompt). Available if a future screen wants literal tabs. |
| Stepper | `.pg-steps .pg-step.active/.done`, `.pg-step-connector.done` | Used by New Reservation's 4-step wizard. Connector lines are **dedicated flex elements between steps**, not an absolutely-positioned `::after` — the latter used to visually overlap step labels (fixed in `67a80b9`). |
| Timeline | `.timeline .t-item` | Used by Reservation Detail's Activity/Audit section. |
| Empty states | `.empty-state` | Used across list/table pages when a filter yields no rows. |
| Custom dropdowns | see §6.2 | Replaces native `<select>` app-wide. |

### 6.2 Custom Select engine (`PG.enhanceSelects(root)`)

Native `<select class="form-control">` elements are **progressively enhanced** into a styled dropdown (`.pg-select > .pg-select-trigger + .pg-select-menu`). The trick: the native `<select>` stays in the DOM (visually hidden via `position:absolute; opacity:0`), so **any existing code that reads `.value` or listens for `"change"` keeps working untouched** — enhancement is purely visual. Clicking a custom option sets `nativeSelect.value` and dispatches a real `"change"` event.

**Critical gotcha:** if you ever set `.value` on an enhanced select *programmatically* (not through user click), you **must** also do `el.dispatchEvent(new Event('change'))` afterward, or the custom dropdown's visible trigger label will silently show the wrong text while the underlying value is actually correct. This exact bug was found and fixed twice (Availability page's Stop Sell modal and Adjust Inventory drawer, commit `07c7269`) — watch for it in any new code that pre-fills a select.

Call `PG.enhanceSelects(container)` once after any `innerHTML` assignment that includes `<select class="form-control">` elements — including inside dynamically-created modals/drawers appended to `document.body`, and after any re-render that rebuilds selects (e.g. New Reservation's item cards).

### 6.3 Managed-list dropdown (`PG.renderManagedSelect(container, opts)`)

A from-scratch (not select-wrapping) dropdown for editable string lists — currently used for **Bed Configuration** (`state.bedConfigs`) and **Meal Plan** (`state.mealPlans`). Supports inline "+ Add New…" (reveals a text input in the menu) and a per-option "×" delete (with a native `confirm()` and a "can't delete the last one" guard). `opts` = `{ value, getList(), setList(list), onChange(v), placeholder }`. If a future prompt asks for another user-managed reference list (e.g. cancellation reasons, adjustment reasons — those are currently hardcoded arrays), reuse this component rather than inventing a new pattern.

### 6.4 Status badge color semantics (audited, keep consistent)

| Status | Class | Meaning |
|---|---|---|
| Confirmed, Paid | `.badge-green` | Positive |
| Cancelled, Failed | `.badge-red` | Destructive |
| Pending Payment, Payment Required, Refund Pending | `.badge-yellow` | Warning |
| Expired, Refunded, Draft | `.badge-gray` | Neutral |
| Link Sent | `.badge-purple` | Info (payment-link-specific state) |
| Pay on Arrival | `.badge-blue` | Info |

---

## 7. Current navigation structure

Defined in `NAV` in `app.js`. **Most recently restructured** (room-operations scope update) so the old "Overview" section is folded into "Hotel Management" and Physical Rooms is added:

```
Hotel Management  → Dashboard (index.html), Operations Calendar (operations-calendar.html — NOT YET BUILT),
                     Hotel Profile, Room Types, Physical Rooms (physical-rooms.html), Rates, Availability & Inventory
Reservations      → Reservations, New Reservation, Guests (guests.html — NOT YET BUILT)
Payments          → Payments
Reports           → Reservation Reports, Inventory Reports, Payment Reports (ALL THREE — NOT YET BUILT)
Settings          → Hotel Policies, Taxes & Fees, Payment Configuration
Administration    → Hotels (hotels.html — NOT YET BUILT, super-admin-only), Users, Roles, Permissions, Audit
```

**The nav links to five pages that do not exist yet** (`physical-rooms.html` was built in the room-operations-management-UI prompt). This is intentional, following the same "don't build every screen from one prompt" sequencing established earlier in the project. Expect follow-up prompts to build: `operations-calendar.html`, `guests.html`, `reservation-reports.html`, `inventory-reports.html`, `payment-reports.html`, `hotels.html`. When you build them, just create the file at that exact filename and the nav + breadcrumb linking will work automatically (add the new labels to `CRUMB_LINKS` too).

The old "Guided Journey" nav item was removed from the sidebar in this restructure (it's not in the new spec's nav list) but the page (`demo-journey.html`) still exists and is still linked from the Dashboard's Quick Operations panel — don't delete it.

---

## 8. Page-by-page reference

| File | Purpose | Notes |
|---|---|---|
| `index.html` | **Dashboard / Overview** | Fully rebuilt as an operational workspace — every number is computed live from state (not hardcoded). Includes a real "Attention Required" alert engine (expiring payment links, failed payments, low availability, active Stop Sell, stale drafts >24h), dismissible where appropriate. Deep-links into `reservations.html`/`payments.html` via query params. |
| `hotel-profile.html` | Tenant profile, editable | Country/City/Currency/Timezone are dropdowns (`PG.REF`); phone has a separate country-code dropdown. |
| `room-types.html` | Room type list | Table with View/Edit actions + Add. |
| `room-type-form.html` | Create/edit/view/**delete** a room type | Bed Configuration uses the managed-select component. Delete removes associated `rates[id]`, `ratePlans`, `physicalRooms`, `roomAssignments`, and `roomBlocks` referencing it. |
| `physical-rooms.html` | **Physical Rooms management** | Dense table (not cards) — Room Number, Room Type, Building/Floor, Bed Config, Key Attributes, Today's Status, Current/Next Reservation, Active State, Actions. Building/Floor/Bed Config/Key Attributes collapse below 1100–1500px; Room Number and Room Type never collapse. Summary strip (Total/Active & Sellable/Reserved Today/Blocked Today/Inactive) reuses the shared `.kpi` tile, not the dashboard's local `.sum-card`. Add/Edit is a **Drawer** (Bed Configuration reuses the managed-select component; Connecting Rooms are kept mutual on save — selecting A→B also links B→A). Room Details is a separate, fully-rebuilt-per-open **Drawer**. Block Room is a **Modal** that live-previews conflicting `roomAssignments` as dates change and hard-disables Save while any non-Cancelled assignment overlaps (see §9) — Out of Order/Out of Service show a destructive (red) impact note, Management Hold/Other show a warning (yellow) one. No delete action anywhere — Activate/Deactivate is the only lifecycle control, and deactivating also clears `isSellable`. Gated by a `CAN_MANAGE` check on `PG.CURRENT_ROLE` (always true today — see §5.3) that renders a permission-denied panel instead, demonstrating a state with no live trigger yet. |
| `rates.html` | Rate Plan list | Table with Edit action + Add. |
| `rate-plan-form.html` | Create/edit/**delete** a rate plan | Meal Plan uses managed-select; Currency is a dropdown; shows a live warning if price < the room type's base rate; does not hard-block saving on that warning. |
| `availability-inventory.html` | Live availability grid + Stop Sell/Reopen/Adjust Inventory | Grid cells are clickable (`tbody .av-cell` only — header cells intentionally excluded, see §9 history). Adjust Inventory is a **Drawer**; Stop Sell/Reopen are **Modals**, each pre-filling from the currently-selected cell. |
| `reservations.html` | Reservations worklist | Search + 5 filters (status, payment status, source, arrival, departure) + Clear Filters. Supports `?arrival=/?departure=/?status=/?payStatus=/?source=` query prefiltering. Has the Arabic toggle header button (only page that does). |
| `reservations-ar.html` | **The single representative Arabic (RTL) screen** | A from-scratch Arabic mirror of the Reservations worklist (own hand-written sidebar/header in Arabic, not `PG.mount`). Deliberately the *only* Arabic screen — do not build more without being asked ("representative only, do not duplicate the entire prototype"). Row click navigates to the (English) `reservation-detail.html`. |
| `new-reservation.html` | **New Reservation — 4-step guided wizard** | Steps: Guest & Source → Stay & Rooms → Pricing & Payment → Review & Save. See §8.1 for detail. Supports `?demo=ahmad-whatsapp` to pre-fill the Guided Journey scenario. Step 2 **auto-assigns a physical room** per unit the moment a room type/quantity/date/preference changes (§4.7) — no "book without assigning a room" option exists. Each assigned unit shows a summary card (room number, floor, bed, view, accessibility, dates) with a **Change Room** button opening `PG.renderChangeRoomDrawer()`. A shortfall (not enough eligible physical rooms) blocks Next/Confirm with an explanatory message, distinct from the pre-existing commercial-availability message. |
| `reservation-detail.html` | Reservation detail | 6 numbered sections (Summary, Guest, Room Items, Pricing, Payment, Activity/Audit). Header shows both Status and Payment badges + Cancel + More menu. Cancel opens a Modal with a live before/after inventory visual. Payment card logic branches on `paymentStatus` (Payment Required → Generate; Link Sent → Resend only, no redundant "Send"; Expired → Regenerate only; Failed → Generate New Link only — redundant "Resend" buttons were deliberately removed per user feedback). Room Items (Section 3) now shows each unit's assigned physical room with **Change Room** and a permission-gated **Unassign Room** (requires a reason, sets the assignment `Cancelled` rather than deleting it); a persistent banner appears while any unit is unassigned. Re-checks every live assignment's eligibility on render and flags a room **Needs Attention** if it was blocked after assignment, without ever silently reassigning (§4.7). |
| `payments.html` | Payments worklist | Status filter dropdown + `?status=` query support. |
| `hotel-policies.html`, `taxes-fees.html`, `payment-configuration.html` | Settings, mostly read-only/lightweight | Explicitly kept lightweight per the original brief ("reuses standard platform capabilities"). |
| `users.html`, `roles.html`, `permissions.html`, `audit.html` | Administration | Lightweight by design, except Audit which reads the real `state.audit` log. |
| `demo-journey.html` | **Guided Journey** — a 7-phase clickable walkthrough of one full scenario (Ahmad Khalil, WhatsApp booking → payment → cancellation) | Not in primary nav anymore (see §7) but linked from the Dashboard. Opens `new-reservation.html?demo=ahmad-whatsapp` and other screens in new tabs so the checklist stays visible. |

### 8.1 New Reservation wizard — key behaviors to preserve

- **Nothing is pre-selected.** `wizard.source`, `wizard.customerId`, `wizard.paymentMethod` all start `null`. Summary rows only render once the user has actually made that choice (fixed after user feedback: "some data appears before they are selected in the flow"). "Next" is blocked with a toast until the required field for that step is chosen.
- Guest step has **search (name/phone) + sort (Newest/Alphabetical) + pagination** over `state.customers` (see `renderCustList()`).
- Room items: Adults/Children are **read-only**, computed as `roomType.maxAdults/maxChildren × qty` — the user cannot edit them directly (fixed after user feedback).
- A **"Simulate: Availability Changed (Demo)"** button on Step 2 applies a real Stop Sell to the first item's room type/date, so proceeding to Review genuinely triggers the "availability changed" warning (this is real logic reacting to real state, not a scripted fake).
- The "Continue" button was renamed to **"Next →"** per user feedback.
- Continue button label is literally `id="nextBtn"` — same ID reused across steps.
- Each item also carries `requireAccessibility` (bool, hard filter → `['Wheelchair Accessible']`), `bedConfigPref` (soft ranking preference), and — only shown once qty>1 — `requireConnecting` (soft preference). `recomputeAssignments()` re-runs `PG.autoAssignRoomsForItem()` for every item whenever any of these, the room type, quantity, or the reservation's dates change, always excluding rooms already picked by sibling items.

---

## 9. Known issues / deliberate simplifications (read before "fixing" these)

- **`ratePlans` vs. `rates` calendar duplication.** Rate Plans (admin-facing, has a name/meal plan/date range) and the `rates` per-date calendar (the actual pricing engine) are two separate structures that aren't fully unified. A rate plan's `price` is shown in the New Reservation wizard's dropdown, but the *actual* charged amount still comes from `PG.rateFor()` reading the `rates` calendar. This works fine for the seeded data because they were kept numerically consistent by hand, but it's not architecturally single-sourced. If a future prompt asks for real rate-plan-driven pricing, this needs unifying.
- **Family Room has no "Flexible + Breakfast" rate plan** — only "Weekend Rate" (`$150`). The Guided Journey's Step 7 text says "Family Room — Flexible + Breakfast" but the actual rate plan name shown will be "Weekend Rate". Numbers are all correct; only the plan *label* doesn't match the illustrative example text. Known and accepted, not yet fixed.
- **Reservation dates are reservation-level, not per-item** (§4.3, rule 3) — intentional MVP simplification, do not "fix" without discussion.
- **Occupancy is derived, not stored as a user preference** — if a room type's `maxAdults`/`maxChildren` changes after a reservation was made, existing reservations keep their originally-computed occupancy (correct — it's a snapshot, not a live join).
- **No login/auth/role-switcher UI** — `CURRENT_ROLE` is a hardcoded constant.
- **Physical Rooms UI (`physical-rooms.html`) and the room-assignment engine (§4.7) both exist now**, but `physicalRooms` active+sellable counts still don't always numerically equal `roomTypes[].sellable` — the two inventory layers aren't unified into one source of truth (see §4.6).
- **Block Room's conflict check treats "Held" and "Assigned" assignments the same** — both block a new room block from saving. A future prompt may want holds to be overridable while confirmed assignments stay hard blocks.
- **Room-assignment preferences are minimal by design** — only "Requires Wheelchair Accessible Room" (hard filter), a bed configuration dropdown, and "Request Connecting Rooms" (both soft ranking preferences) exist in New Reservation. There's no UI for other accessibility features or arbitrary attribute requirements; extend `item.requireAccessibility` from a bool to a list if a future prompt asks for more.
- **The connecting-pair heuristic (`PG.findConnectingPair()`) is a simple pairwise scan**, not a general solver — it only ever tries to seat one connected pair per item; for qty>2 with connecting requested, remaining units are filled by normal ranking regardless of connectivity.
- **GitHub Pages caches aggressively.** When testing changes right after a push, hard-refresh (Ctrl/Cmd+Shift+R) — a stale service-worker-free browser cache has caused "my change isn't showing" confusion at least once.
- **Browser-automation quirk (dev environment only):** the Claude Browser preview tool's `computer` (screenshot) action is flaky in this sandbox and frequently times out with "the Browser pane is not displayed". When verifying UI changes in an agent session, prefer `javascript_tool`-based DOM/state assertions over screenshots — they're reliable; screenshots are not. Also: the `serve` dev server caches 301 redirects in the *browser's* HTTP cache even after `serve.json` is fixed — use a `?cb=N` cache-busting query param when re-testing a URL you've hit before in the same session.

---

## 10. Working conventions established over this project (please follow them)

1. **Always run a syntax check before considering a change done.** Pattern used throughout: extract each modified file's inline `<script>` content via a small Node one-liner and run `node --check` on it (and always `node --check` on `assets/js/app.js` directly). Catches typos before they ever hit the browser.
2. **Verify in the actual browser, not just by reading the code.** Use the `Claude_Browser` MCP tools (`preview_start` with the `hotel-prototype` launch config, then `navigate` + `javascript_tool` to assert real DOM/state). Always `localStorage.clear()` at the start of a test pass to get clean seed data, and again at the end before committing, so the repo's live demo always starts from a clean, seeded state.
3. **One commit per logical change, pushed immediately**, with a detailed commit message explaining *why*, not just *what* (see `git log` — messages are intentionally thorough, since they double as a changelog). Never batch unrelated fixes into one commit if avoidable.
4. **Minimum-footprint edits.** Use the `Edit` tool for targeted changes; only rewrite a whole file with `Write` when the change is genuinely pervasive throughout that file (as happened with `new-reservation.html` a few times).
5. **When the user reports a bug, find the actual root cause before patching symptoms.** Several "simple" bug reports turned out to have one shared root cause (e.g. the missing-schema-migration bug explained three unrelated-seeming symptoms at once). Investigate with `Grep`/`Read` before guessing.
6. **Preserve everything not explicitly touched.** This project has accumulated a lot of interlocking detail across many prompts — never regenerate a whole page "for consistency" unless asked; targeted edits only.
7. **No emojis, no unnecessary comments in code.** Comments are reserved for non-obvious *why* (see the date-handling and custom-select gotcha comments in `app.js` as the model to follow).
8. **This README should be kept up to date.** If you make a structural change (new shared component, new state field, new convention), update the relevant section here in the same commit.
9. **Pure engine logic gets simulated unit tests under `tests/`**, run with plain Node (no test framework, no build step) — see `tests/room-assignment.test.js`: `node tests/room-assignment.test.js`. It loads `assets/js/app.js` into a `vm` sandbox stubbing `window`/`localStorage` (app.js is a browser IIFE, not a CommonJS module) and asserts against `PG.*` directly. Add to this file — don't invent a second test convention — when adding new engine logic worth locking down.

---

## 11. Suggested next steps (not yet requested, but foreseeable)

Based on the nav structure already wired in but not yet built:

- `operations-calendar.html` — an operational calendar; originally scoped to room-type inventory only, but now that `physicalRooms`/`roomAssignments` exist it could reasonably surface per-room detail too — confirm scope in the prompt that builds it. It's also the other place (besides Reservation Detail) the room-operations spec named for Unassign Room — not yet wired since the page doesn't exist.
- `guests.html` — a Guests directory (likely: list of `state.customers`, search, maybe a guest detail/history view).
- An actual **"Unassigned queue" view** — Reservation Detail's persistent warning banner and the audit trail are the only places an unassigned unit currently surfaces; there's no dedicated list of every reservation with an unassigned room across the property yet.
- `reservation-reports.html`, `inventory-reports.html`, `payment-reports.html` — reporting views; `state.audit` and `state.adjustments` already contain data that could feed Inventory Reports.
- `hotels.html` — a Platform Super Admin-only tenant list (would need `CURRENT_ROLE` toggled to `"Platform Super Admin"` to view/test).

Do not build these speculatively — wait for the corresponding prompt, per the user's own stated sequencing.

---

## 12. Quick orientation checklist for a new chat session

1. Read this file in full.
2. `git log --oneline` to see the exact chronological history (commit messages are detailed changelogs).
3. Read `assets/js/app.js` top-to-bottom once — it's the single source of truth for data shape, shared components, and navigation.
4. Check the live site (`https://eyad-tritecs.github.io/Hotel-Platform/`) to see current real-world state, or run locally per §2.
5. Before changing anything, check §9 (known issues/deliberate simplifications) so you don't "fix" something that was a deliberate decision.
