# Palestine Grand Hotel — Hotel Reservation and Basic Room Operations Platform (Prototype)

**Live site:** https://eyad-tritecs.github.io/Hotel-Platform/
**Repository:** https://github.com/Eyad-tritecs/Hotel-Platform (owner account: `Eyad-tritecs`)
**Status:** Actively evolving clickable prototype. No backend, no build step, no real data persistence beyond the browser.

This document exists so a **new chat session** (or a new developer) can pick up this project with full context, without re-reading the conversation history that produced it. **Read this file in full before making any changes.** It is the single source of truth for scope, architecture, conventions, and the reasoning behind non-obvious decisions — keep it current (see §10.8).

---

## Table of contents

1. [Project overview](#1-project-overview)
2. [Running it locally & deployment](#2-running-it-locally--deployment)
3. [Tech stack and architecture](#3-tech-stack-and-architecture)
4. [The state engine (`assets/js/app.js`)](#4-the-state-engine-assetsjsappjs)
5. [Shared UI shell](#5-shared-ui-shell-pgmount-sidebar-header)
6. [Design system components](#6-design-system-components-assetscssstylecss)
7. [Navigation structure](#7-current-navigation-structure)
8. [Page-by-page reference](#8-page-by-page-reference)
9. [Known issues / deliberate simplifications](#9-known-issues--deliberate-simplifications-read-before-fixing-these)
10. [Working conventions](#10-working-conventions-established-over-this-project-please-follow-them)
11. [Suggested next steps](#11-suggested-next-steps-not-yet-requested-but-foreseeable)
12. [Quick-start checklist for a new session](#12-quick-start-checklist-for-a-new-chat-session)

---

## 1. Project overview

### 1.1 What this is

A **clickable, browser-based prototype** of a B2B, multi-tenant, admin-first Hotel Reservation and Basic Room Operations Platform, built for a single pilot hotel: **Palestine Grand Hotel** (Bethlehem, Palestine, USD currency). It exists to let Product, Engineering, and business stakeholders understand the MVP scope by *navigating* realistic workflows rather than reading a spec document.

It is **not** a real product: there is no server, no database, no authentication, and no real payment processing. Every "backend" behavior — creating a reservation, adjusting inventory, assigning a room, generating a payment link — is simulated client-side against a single JSON blob in `localStorage` (see §4).

### 1.2 Product positioning (do not violate these constraints)

- B2B, admin-first, desktop-first, multi-tenant platform (this prototype models **one tenant**: Palestine Grand Hotel).
- Operated from a Hotel Admin Panel — **for hotel staff**, not guests.
- Visual language: **Metronic 8 Bootstrap Demo 1 (Light, LTR)** conventions — dark aside, white header, light canvas, page toolbar, underline tabs, pale-bordered cards, dashed table rows (§6.0).
- **Physical rooms are inside the MVP**: a real operational allocation layer beneath room-type commercial inventory (§4.6–4.7). Full front-desk and housekeeping functionality (Check-In/Check-Out workflows, housekeeping status boards, maintenance ticketing) remains **outside** the MVP.

### 1.3 Explicitly out of scope — do not build these

A customer-facing booking website or mobile app; OTA integrations (Booking.com, Expedia, Agoda, Hotels.com, Trip.com) or OTA sync; PMS/CRS/Channel Manager integrations; outbound ARI; Check-in/Check-out as a workflow; housekeeping; maintenance ticketing; POS/restaurant management; folios/full accounting; payroll/HR; CRM marketing; loyalty; gift cards; advanced promotions/revenue management; advanced BI; AI features; complex group booking / rooming lists; complex split payments; overbooking.

These exclusions have been **explicitly and repeatedly audited** against the codebase (grepped for banned terms) — see commit `292f6b3` for the audit methodology. Any future work must preserve this boundary.

### 1.4 Feature set at a glance

What's actually built and working today, grouped by module (see §8 for the full page-by-page reference):

- **Hotel setup** — tenant profile, room types (CRUD), and a real, configurable Taxes & Fees engine (percentage/fixed, tax/fee, default applicability, optional effective dates) feeding pricing everywhere.
- **Rate Plans & Pricing** — many rate plans per room type, each priced through **named pricing periods** ("Summer Season 2027", "Weekend Premium") with one price for all selected days or a different price per weekday. A Price Calendar shows every plan × date and labels where each number came from (base price, period override, or a one-off manual price); overlapping periods are refused by name; a booked reservation's price can never be moved by a later rate change (§4.4b).
- **Physical rooms** — individual room records (number, floor, bed, view, accessibility, connecting rooms), room blocks (Out of Order / Out of Service / Management Hold / Other), activate/deactivate, all with conflict-safe guardrails (§4.6).
- **Reservations** — a 4-step guided wizard with **automatic physical-room assignment** (no manual room picking required, but always changeable), multi-room support, a structured Change Room drawer, an Edit/Reschedule drawer with before/after impact revalidation, temporary room holds with automatic expiry release, cancellation, and a full payment-link lifecycle simulation (generate/send/resend/expire/mark-paid).
- **Availability & Inventory** — a live commercial availability grid with Stop Sell/Reopen/Adjust Inventory, plus an admin-only "View Breakdown" panel connecting the commercial (room-type) and physical (room-block/assignment) layers behind each number.
- **Operations Calendar** — a Mews-style (inspiration only, not a copy) daily timeline: every physical room as a row, every night as a column, reservation/hold/block bars, live conflict detection, filters, and search.
- **Guests** — a CRM-lite directory and full guest profile (Overview/Reservations/Payments/Activity tabs), kept technically and conceptually separate from staff accounts, with non-blocking duplicate detection on add.
- **Dashboard** — a live operational workspace: real "Attention Required" alerts (expiring links, failed payments, low availability, assignment conflicts, rooms out of order, stale drafts), today's arrivals, recent reservations, upcoming occupancy.
- **Administration & Settings** — lightweight-by-design Users/Roles/Permissions pages, a real Audit log, Hotel Policies / Payment Configuration.
- **Arabic (RTL)** — one representative fully-translated screen (`reservations-ar.html`), deliberately not a full localization, backed by generic `html[dir="rtl"]` mirroring in `style.css` (drawers, modals, tables, sidebar, and — added in this pass — the Operations Calendar's sticky chrome) that any future Arabic screen can drop into (§5.6).
- **Named permissions, audit, and property scoping** — `PG.PERMISSIONS`/`PG.hasPermission()` (§5.3) gate specific actions (not just whole pages) across Physical Rooms, Operations Calendar, Guests, Rates, Payments, and Reports; every relevant record carries a `propertyId` (§5.2); `audit` entries carry structured `module`/`recordId`/`previousValue`/`newValue`/`reason` fields for a representative set of actions across those same modules (§4.2).
- **Modal/drawer accessibility** — focus trapping, ARIA roles/labels, and Escape-to-close, built once into `PG.openModal`/`PG.closeModal` so every modal and drawer in the app gets it automatically (§5.5).
- **A Guided Journey demo** — a scripted, 7-phase walkthrough of one booking scenario for stakeholder demos.

**Intentionally not yet built** (nav links exist, page doesn't — see §7): `hotels.html` (Platform Super Admin tenant list).
- **Reports** — three lightweight report hubs (Reservation/Inventory/Payment Reports, §8.7), each a card list over several compact reports (filters + KPI tiles + an operational table + CSV export), not a BI product.
- **Global search** — a header search box present on every page (§5.4), grouped by Reservations/Guests/Rooms/Payments, keyboard-navigable, with per-viewer recent searches.
- **Saved operational views** — one-click predefined filters (Today's Arrivals/Departures, Unassigned Reservations, Payment Issues, Blocked Rooms) on the Dashboard, linking into the query params those pages already understand.

---

## 2. Running it locally & deployment

### 2.1 Local development

No build step, no `npm install` for the app itself — it's static HTML/CSS/JS. You only need a static file server because the app uses path-relative navigation and `localStorage`, both of which behave inconsistently under `file://`.

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

**Important:** `serve.json` at the project root sets `{"cleanUrls": false}`. Without this, the `serve` package strips query strings when redirecting `page.html` → `page`, which silently breaks every link that passes data via `?id=...` (reservation detail, room-type edit, the many `?rt=`/`?room=`/`?date=`/`?customer=` prefill links, etc.). **Do not remove `serve.json`.**

### 2.2 Deployment

Deployed via **GitHub Pages** from the `main` branch root — no build step, GitHub Pages serves the static files directly. Every `git push` to `main` redeploys automatically within roughly a minute. There is no staging environment; `main` is live.

```bash
git add -A && git commit -m "..." && git push
```

GitHub CLI (`gh`) is authenticated locally as `Eyad-tritecs`. Do not re-authenticate a different account without the user's explicit instruction.

**GitHub Pages caches aggressively.** When testing changes right after a push, hard-refresh (Ctrl/Cmd+Shift+R). The `serve` dev server also caches 301 redirects in the *browser's* HTTP cache even after `serve.json` is fixed — use a `?cb=N` cache-busting query param when re-testing a URL you've already hit once in the same session.

---

## 3. Tech stack and architecture

### 3.1 Stack

- **Plain HTML + vanilla JS (ES5-leaning syntax, `var`/`function`, no build tooling, no framework, no JSX/TSX).** Every page is a standalone `.html` file with an inline `<script>` block. There is no bundler — what you write is what ships.
- **One shared stylesheet:** `assets/css/style.css` — the entire design system (§6).
- **One shared script:** `assets/js/app.js` — state engine, seed data, shared UI shell, and a reusable component library, exposed as the global `PG` object (§4–5).
- **Persistence:** `localStorage`, under the single key `pg_hotel_admin_state_v1`. There is no server. "Saving" anything just mutates a JSON blob in `localStorage`.
- **Fonts:** Google Fonts `Inter` (and `Tajawal` for the Arabic screen), loaded via `<link>` in each page's `<head>`.
- **Tests:** plain-Node scripts under `tests/`, no framework (§10.9).

### 3.2 Why this approach

The prototype needs to *feel* like a real connected system — creating a reservation actually reduces availability elsewhere and assigns a physical room; cancelling actually restores both — without any backend. A shared `localStorage`-backed state object accessed through a small set of pure functions (`PG.getState()`, `PG.setState()`, `PG.computeAvailability()`, `PG.autoAssignRoomsForItem()`, etc.) achieves that cheaply. Every page calls `PG.getState()` fresh at the top of its script and re-reads it after any mutation, so cross-page consistency is automatic — there is no client-side cache to invalidate.

### 3.3 Project structure

```
/
├── index.html                    Dashboard
├── operations-calendar.html      Daily room-control timeline
├── hotel-profile.html            Tenant profile
├── room-types.html / room-type-form.html
├── physical-rooms.html           Physical room management
├── rates.html / rate-plan-form.html
├── availability-inventory.html   Commercial availability grid
├── reservations.html / reservations-ar.html (Arabic)
├── new-reservation.html          4-step booking wizard
├── guests.html / guest-detail.html
├── reservation-detail.html
├── payments.html
├── reservation-reports.html / inventory-reports.html / payment-reports.html
├── hotel-policies.html / taxes-fees.html / payment-configuration.html
├── users.html / roles.html / permissions.html / audit.html
├── demo-journey.html             Guided stakeholder demo
├── assets/
│   ├── css/style.css             The entire design system
│   └── js/app.js                 State engine + shared component library (global `PG`)
├── tests/
│   ├── room-assignment.test.js   Plain-Node engine tests (room assignment)
│   └── rate-plans.test.js        Plain-Node engine tests (rate plans & pricing)
├── serve.json                    { cleanUrls: false } — required, see §2.1
└── .claude/launch.json           Dev-server config for the Claude_Browser preview tool
```

Every `.html` file follows the same skeleton: `<div id="pg-app"></div>` + `<script src="assets/js/app.js"></script>` + one inline `<script>` that calls `PG.mount()` and builds the page (§5).

---

## 4. The state engine (`assets/js/app.js`)

### 4.1 Seed data and schema migration

`buildSeed()` returns the full initial state object. `getState()`:

1. If no `localStorage` entry exists, seeds fresh and returns it.
2. If one exists, `JSON.parse`s it, then **backfills any top-level key that exists in a fresh seed but not in the parsed object.** This is a schema-migration safety net: without it, any browser holding state saved before a new top-level field was introduced would throw and silently break the entire page.

**Adding a new top-level field to the seed state gets migration for free — no extra code needed.** Adding a new *nested* field (e.g. a new property on each reservation) means existing saved objects will have that field as `undefined`; guard for that in reading code (e.g. `r.taxAmount != null ? r.taxAmount : <fallback>`), as done throughout the codebase.

### 4.2 State shape (top-level keys)

```
{
  seededAt, hotel, roomTypes, physicalRooms, roomAssignments, roomBlocks,
  rates, rateOverrides, bedConfigs, mealPlans, taxesFees,
  inventoryOverrides, dateAdjustments, adjustments,
  customers, reservations, nextResId, ratePlans, audit
}
```

- **`hotel`** — single tenant profile object: `name, legalName, propertyCode, currency, city, country, address, phoneCode, phone, email, checkInTime, checkOutTime, timezone, starRating, status, policySummary`.
- **`roomTypes`** — array of `{ id, name, code, sellable, baseCapacity, maxAdults, maxChildren, bed, baseRate, active, desc }`. `sellable` is the *current* count (mutated by adjustments); `baseCapacity` is the original seeded count, kept immutable so the UI can show "Configured Capacity" vs. "Authorized Adjustments" as a diff. A normal manual increase adjustment can never push `sellable` past `PG.activeSellablePhysicalCount(state, roomTypeId)` — enforced in `availability-inventory.html`'s Adjust Inventory save handler (no overbooking in this MVP).
- **`physicalRooms`**, **`roomAssignments`**, **`roomBlocks`** — the physical-room operational layer. See §4.6. `roomAssignments[]` items with `assignmentStatus: "Held"` carry an optional `holdExpiresAt` (nested field — see §4.7's temporary-hold note).
- **`rates`** — `{ [roomTypeId]: { [date]: price } }`, a per-date calendar. This is now the **base-price layer** — the bottom of the three-layer price resolution described in §4.4b, and the fallback a rate plan uses on any date none of its pricing periods covers. It is the original pre-rate-plan pricing model, kept intact, which is why introducing rate plans moved no existing reservation's price.
- **`ratePlans`** — array of `{ id, propertyId, roomTypeId, name, code, mealPlan, description, active, isDefault, strictPeriodPricing?, createdAt, updatedAt, periods: [...] }`. A rate plan is a **commercial offer attached to one room type** — its name, meal plan, and whether it can be sold. It carries **no dates and no price of its own**; those live in its `periods`. Do not reintroduce a flat `startDate`/`endDate`/`price` on a plan (that was the pre-§4.4b model). Each **Pricing Period** is `{ id, name, startDate, endDate, daysOfWeek: [0..6], mode: "same"|"byday", prices, active, createdAt, updatedAt }` — a *named* date range ("Summer Season 2027", "Weekend Premium", "Eid Holiday") so a whole season can be found and edited as one unit instead of date by date. `mode: "same"` stores one price in `prices.same`; `mode: "byday"` stores one per weekday index in `prices["0"]`…`prices["6"]`. Exactly one plan per room type has `isDefault: true`. `strictPeriodPricing: true` means the plan sells **only** inside its periods and never falls back to the base price — that is what makes `Missing Price` a reachable state rather than a theoretical one.
- **`bedConfigs`**, **`mealPlans`** — flat string arrays, user-editable via the managed-select component (§6.3).
- **`taxesFees`** — array of `{ id, name, kind, calcType, value, appliesByDefault, active, effectiveFrom, effectiveTo }`. `kind` is `"Tax"` or `"Fee"`; `calcType` is `"Percentage"` (of the room subtotal) or `"Fixed"` (a flat amount per stay). `effectiveFrom`/`effectiveTo` are nullable date strings gating the charge to a date range. Managed on `taxes-fees.html`; the **only** consumer of pricing anywhere in the app is `PG.computePricing(state, roomCharges, refDate)`, which sums every charge that is both `active` and `appliesByDefault` (and, if set, effective on `refDate`) into `{taxAmount, feeAmount, total, breakdown}`. There is no per-reservation override in this MVP — every reservation gets the hotel's one default charge set.
- **`rateOverrides`** — `{ "roomTypeId|ratePlanId|date": price }`. A one-off price typed directly into a single Price Calendar cell; the most specific of the three pricing layers (§4.4b). Seeded empty.
- **`inventoryOverrides`** — `{ "roomTypeId|date": { stopSell: true, reason } }`. Presence of a key = Stop Sell is active for that room type + date.
- **`dateAdjustments`** — `{ "roomTypeId|date": numericDelta }`. Additive per-date sellable-quantity adjustment, layered on top of `roomTypes[].sellable`.
- **`adjustments`** — audit-style log of inventory adjustment actions (separate from the general `audit` array; a candidate data source for a future Inventory Reports screen).
- **`customers`** — the **Guests** module's data, kept technically and conceptually separate from staff accounts (`users.html` is a lightweight, static admin page with no backing `state.users` collection — never add one that reuses this shape). Array of `{ id, name, phone, email, nationality, preferredLanguage, idRef, communicationPreference, consentMarketing, roomPreferences, accessibilityNeeds, important, notes }`. `idRef` (an identification/passport reference) is masked in the UI — only the last 4 characters shown outside the Add/Edit drawer. No login/auth concept — a guest is a booking subject, not an account.
- **`reservations`** — see §4.3.
- **`nextResId`** — integer counter for generating `RES-#####` IDs.
- **`audit`** — global audit trail array of `{ ts, actor, action, details, property, module?, recordId?, previousValue?, newValue?, reason? }` (the last four are nested/optional — only entries written since this schema was added carry them; older/seeded entries just have the first four), shown on the Audit page and used to power Dashboard alerts and per-entity Activity tabs (Guests, Physical Rooms). Always written through **`PG.addAudit(action, details, actor, opts)`** — `opts` is optional and backward-compatible, so every pre-existing 3-arg call site still works unchanged; `property` defaults to the current property automatically. `audit.html` filters by Module/Action/date range and renders `previousValue → newValue` and `reason` inline when present.

### 4.3 Reservation object shape

```js
{
  id: "RES-10245",
  customerId, source, createdAt, checkIn, checkOut,
  status,            // Draft | Pending Payment | Confirmed | Cancelled | Completed | No Show
  paymentStatus,     // Pay on Arrival | Payment Required | Link Sent | Paid | Failed | Expired | Refund Pending | Refunded
  paymentMethod,     // "Pay on Arrival" | "Payment Link"
  rooms: [ { id, roomTypeId, qty, adults, children, ratePlanName, requireAccessibility, bedConfigPref, requireConnecting } ],  // one or more "Reservation Items"; `id` (e.g. "RES-10245-itm-1") is what RoomAssignment.reservationItemId points to. The last three fields are nested/optional — undefined on reservations created before Reservation Detail's Edit flow existed, or never edited since; guard accordingly (e.g. `!!room.requireAccessibility`). They record the room-requirement preferences last used to (re)validate this item's physical-room assignment.
  taxAmount, feeAmount,   // recalculated whenever the reservation is edited (Reservation Detail's Edit flow), so this always matches what was last shown to the guest/staff, not necessarily the original booking-time price
  notes,   // INTERNAL ONLY — staff notes (preferences, accessibility, operational instructions, follow-up), shown in Reservation Detail's own Notes section, never surfaced in any customer-facing text
  transactionRef, paymentLinkUrl, paymentLinkGeneratedAt, paymentLinkExpiresAt, paymentPaidAt,  // payment-link lifecycle fields, populated as the flow progresses
  activity: [ { ts, text } ]   // per-reservation timeline, shown in Reservation Detail's Activity/Audit section
}
```

**Domain rules this shape encodes (do not break these):**

1. One reservation → one or more Reservation Items (`rooms[]`).
2. Each item carries Room Type, Quantity, Rate Plan (name), Occupancy (adults/children), and its price is derivable via `PG.rateFor()`.
3. Stay dates (`checkIn`/`checkOut`) are **reservation-level, shared across all items** — a deliberate MVP simplification (a guest books one trip with possibly multiple room types, all for the same date range). Do not silently change this to per-item dates without discussing it — it's a significant architecture change.
4. Payment (`paymentMethod`, `paymentStatus`, `transactionRef`, etc.) belongs to the **whole reservation**, never to an individual item.
5. `status` (Reservation Status) and `paymentStatus` (Payment Status) are **separate fields, kept visually distinct** (§6.4) but correlated by business logic (e.g. cancelling a Paid reservation sets `paymentStatus` to `Refund Pending`).
6. Occupancy (`adults`/`children`) per item is **derived, not user-entered** — computed from the room type's `maxAdults`/`maxChildren` × quantity in the New Reservation wizard, and read-only in the UI.
7. Each reservation item has a stable `id` (a nested field — `undefined` on reservations saved before this was added; guard accordingly). `RoomAssignment.reservationItemId` references it, connecting a commercial Reservation Item to one or more physical rooms.

### 4.4 Availability & pricing engine (commercial layer)

- `PG.computeAvailability(state, roomTypeId, dateStr)` → `{ sellable, booked, available, stopSell }`. `sellable` = `roomTypes[].sellable` + `dateAdjustments[key]`. `booked` = sum of `qty` across all non-Cancelled reservations whose `[checkIn, checkOut)` includes that date. `available` = 0 if `stopSell`, else `max(0, sellable - booked)`.
- `PG.validateAvailability(state, roomTypeId, checkIn, checkOut, qty)` → checks every night in the range, returns `{ ok, problems, nights }`. This is what blocks the New Reservation wizard from proceeding when commercial inventory is insufficient.
- `PG.bookedCount()`, `PG.isStopSell()`, `PG.rateFor()` are the lower-level primitives the above are built from.
- **Inventory is always computed live from `reservations` + `inventoryOverrides` + `dateAdjustments`** — there is no separately-maintained "booked count" that could drift out of sync.

### 4.4b Rate Plans & Pricing engine

```
Room Type  →  Rate Plan  →  Pricing Period  →  Daily Prices
```

**A price is resolved by (Room Type + Rate Plan + Date), never by (Room Type + Date) alone** — two plans on the same room type can legitimately price the same night differently, which is the whole reason this layer exists.

**`PG.resolvePrice(state, roomTypeId, ratePlanId, dateStr)`** is the single resolver. It walks three layers, most specific first, and always reports **which layer produced the number** so no screen ever displays a price it cannot explain:

| # | Layer | Source | `source` / `label` |
|---|---|---|---|
| 1 | **Manual Override** | `state.rateOverrides["rtId\|planId\|date"]` — a one-off price typed into one Price Calendar cell | `manual` / "Manual Override" |
| 2 | **Period Override** | the plan's active pricing period covering that date **whose `daysOfWeek` includes that date's weekday** | `period` / "Period Override" |
| 3 | **Plan Base Price** | `ratePlan.basePrice` — the plan's own default nightly rate, edited on the Rate Plans tab. Skipped entirely when the plan is `strictPeriodPricing` | `base` / "Base Price" |
| 4 | **Room Type Rate** | `state.rates[rtId][date]`, falling back to `roomTypes[].baseRate` — only reached by a plan that has no base price of its own | `base` / "Room Type Rate" |
| — | **nothing** | no layer produced a price | `missing` / "Missing Price" |

A `missing` price is **never** rendered as `$0`; it renders as "No price" and blocks the plan from being sold on that date.

**Scope — where a plan may be sold.** A plan always belongs to **one room type** (that is what keeps `PG.rateFor()` and the reservation flow unambiguous), and then either sells across every room of that type or is narrowed to specific physical rooms:

```
scope: "roomType"  →  every room of plan.roomTypeId
scope: "rooms"     →  only plan.physicalRoomIds (all of that same type)
```

"Breakfast Included — Rooms 101–105" is the narrowed form. **Narrowing never crosses room types**, so a room can never be offered a plan priced for a different type. `PG.ratePlansForRoom(state, roomId, activeOnly)` is the room-level question; `PG.planScopeRooms()` and `PG.planScopeLabel()` render it (the label collapses contiguous room numbers into ranges via `PG.summarizeRoomNumbers()`). `PG.validateRatePlanForStay()` takes an optional 6th `physicalRoomId` and refuses an out-of-scope room by name. Inactive and non-sellable rooms cannot be selected as targets at all.

**Engine surface:** `basePriceFor`, `ratePlansForType`, `ratePlansForRoom`, `defaultRatePlanFor`, `ratePlanById`, `planScopeLabel`, `planScopeRooms`, `summarizeRoomNumbers`, `periodTimeState` (active/upcoming/expired/inactive), `periodCoversDate`, `periodPriceForDate`, `overrideKey`, `resolvePrice`, `nightlyBreakdown`, `validateRatePlanForStay`, `overlappingPeriods`, `periodAffectedDates`. All exercised directly by `tests/rate-plans.test.js` (§10.9).

**`PG.rateFor(state, roomTypeId, dateStr)` still exists and still works** — it is now a thin shim that resolves against the room type's **default** plan, which is exactly what a bare (roomType, date) question always implicitly meant. Every pre-existing call site kept working unchanged.

**Overlap rule (no priority field exists):** two **active** periods on one plan may not both claim the same night. `PG.overlappingPeriods(plan, candidate, excludeId)` returns the conflicting periods so the editor can *name* them rather than just refusing. Periods that share dates but share **no weekday** are fine — that is exactly how "Weekend Premium (Thu–Sat)" and "Midweek Family (Sun–Wed)" are meant to coexist on one plan, and the seed data ships that pair to prove it.

**Booked-price snapshots — the rule that protects existing reservations.** Each reservation room item carries `ratePlanId` plus `nightly: { date: price }`, written at booking time. **`PG.roomItemCharge` / `PG.reservationRoomCharges` / `PG.reservationTotal`** are the only places a reservation's money is computed; they prefer the snapshot and fall back to a live resolve only for pre-snapshot data. **`PG.snapshotRoomItemPricing(state, room, checkIn, checkOut)` is the only thing that moves a booked price**, and it is called from exactly two places: `new-reservation.html`'s `createReservation()` and `reservation-detail.html`'s Edit flow. Consequence: repricing a rate plan, editing a pricing period, or deactivating a plan **cannot** change what an existing guest was quoted. `tests/rate-plans.test.js` guards this by repricing every plan to $999, wiping the base calendar, and asserting all four seeded reservation totals are unmoved.

**Two seeding rules that must be preserved:**

1. **The Thu/Fri weekend markup lives in a named "Weekend Premium" pricing period on each default plan**, not buried in the per-date `rates` calendar. That is the whole point of the model: a recurring price rule should be a named, editable object an operator can see, not an invisible per-date number. Do not push it back into `state.rates`.
2. **The seeded reservations carry explicit booked-price snapshots** (`BOOKED_NIGHTLY` at the end of `buildSeed()`), written at the rates in force when each booking was taken — deliberately *not* derived from today's rate plans. This keeps the demo's historical totals stable (RES-10245 = 1170, RES-10246 = 260, RES-10247 = 150, RES-10248 = 200) **and** ships a visible "booked price differs from today's price" case, which Reservation Detail surfaces rather than hides.

**Schema migration:** `getState()` carries a *nested* migration for `ratePlans` (scope, `physicalRoomIds`, `basePrice`, `currency`, `periods`). Top-level backfill cannot help there — the `ratePlans` key already exists but its shape changed — and without it a browser holding older state renders every plan with a blank price and no scope.

### 4.5 Date handling — a hard-won lesson

**All date math (`PG.addDays`, `PG.dateRange`, `PG.fmtDate`, etc.) is implemented in UTC via `Date.UTC(...)`, never via local-time `Date` parsing.** Parsing `"2026-08-23T00:00:00"` as local time and then calling `.toISOString()` can silently roll the date backward or forward depending on the host machine's UTC offset — this once caused an *infinite loop* in `dateRange()` that crashed the whole page. **Never reintroduce local-time date parsing anywhere in this codebase.** Always go through the `PG.*` date helpers.

### 4.6 Physical rooms — the operational allocation layer

Physical rooms sit **beneath** room-type commercial inventory as a second, connected layer:

- **Room-type inventory** (`roomTypes[].sellable`, `rates`, `inventoryOverrides`, `dateAdjustments`) is the **commercial** availability and pricing layer — what `PG.computeAvailability()`/`PG.validateAvailability()` operate on, and what the New Reservation wizard checks first.
- **Physical-room assignment** (`physicalRooms`, `roomAssignments`, `roomBlocks`) is the **operational** allocation layer: which actual room fulfills which reservation item, for which date range.

**`physicalRooms`** — array of `{ id, propertyId, roomTypeId, roomNumber, building, floor, bedConfiguration, view, accessibilityFeatures, connectingRoomIds, notes, isActive, isSellable, operationalStatus }`. `operationalStatus` is the room's **stored, manually-set** baseline state — one of `Available | Held | Out of Order | Out of Service | Inactive`. `Reserved` is never stored; it's always derived live from a covering `roomAssignment` (`PG.roomStatusOn()`). Housekeeping states (Clean/Dirty/Inspected/Checked In/Checked Out/Occupied) are deliberately excluded — out of MVP scope (§1.3).

**`roomAssignments`** — array of `{ id, propertyId, reservationId, reservationItemId, physicalRoomId, arrivalDate, departureDate, assignmentStatus, assignedAt, assignedBy, changeReason }`. `assignmentStatus` is `Assigned` (Confirmed reservation) | `Held` (tentative, Draft/Pending Payment) | `Cancelled`. A reservation item with `qty > 1` has one `roomAssignment` per physical room.

**`roomBlocks`** — array of `{ id, propertyId, physicalRoomId, startDate, endDate, type, reason, notes, createdAt, createdBy }`. `type` is one of `Out of Order | Out of Service | Management Hold | Other`. An operational hold against a specific physical room independent of any reservation. New blocks can no longer be *created* to overlap an active assignment (§4.7's blocking rule) — the one exception, `blk-3` in the seed data, is a **deliberate, permanent conflict** left in on purpose to demonstrate the "Needs Attention" flag and the calendar's conflict-bar styling out of the box (see §9).

**Engine helpers:** `PG.physicalRoomsForType()`, `PG.isPhysicalRoomBlocked()`, `PG.isPhysicalRoomAssigned()`, `PG.physicalRoomBlockOn()`, `PG.roomStatusOn()`, `PG.eligiblePhysicalRooms()` / `PG.eligiblePhysicalRoomCount()`, `PG.assignmentsForRoom()`, `PG.assignmentsOverlapping()`, `PG.currentOrNextAssignment()`, `PG.upcomingAssignmentsForRoom()`, and `PG.validateRoomAssignmentCapacity()` (the physical-layer counterpart to `PG.validateAvailability()` — no overbooking at this layer).

**Known, intentional gap:** `physicalRooms` counts (active + sellable) don't always numerically equal `roomTypes[].sellable` — e.g. Standard has 10 physical rooms but only 8 are currently active+sellable (one Out of Order, one Inactive). The two layers are not yet unified into a single source of truth. Do not silently "fix" this mismatch — it's seeded deliberately to demonstrate the layering (§9).

`physical-rooms.html` manages this layer directly (add/edit rooms, block rooms, activate/deactivate). New Reservation, Reservation Detail, and Operations Calendar all assign specific rooms too — see §4.7.

### 4.7 Room-assignment recommendation engine (deterministic — no AI, no optimization solver)

Selecting a room type in New Reservation **auto-assigns** a physical room by default — "Book without assigning a room" is not offered anywhere. The engine lives in `assets/js/app.js` and is exercised directly by `tests/room-assignment.test.js` (§10.9).

**Core invariant — no "Unassigned" state exists anywhere in this product.** Every active (non-Cancelled/Expired/Completed/No Show) reservation item always has a real `roomAssignment`: `Held` while the reservation is Draft/Pending Payment, `Assigned` once it's Confirmed. There is no `Unassigned` status, no unassigned queue/lane, and no "Unassign Room" action anywhere — a room can only ever move to a *different* eligible room (Change Room) or be released entirely by cancelling/expiring the reservation, which cancels its assignment(s) as an inseparable part of that same action. A reservation can never be created, saved, or confirmed without a specific eligible physical room for every unit.

> **This was a real, corrected mistake, not a style choice.** An earlier iteration briefly introduced a full Unassigned Reservations concept (a calendar lane, an Assigned/Unassigned filter, an "Unassign Room" action, a legend item, and seed data with a roomless reservation). It was identified as a misread of the intended business rule and completely removed in a follow-up correction. **Do not reintroduce any "unassigned" concept without an explicit, unambiguous instruction to do so.** If you ever see the word "unassigned" reappear in a diff, treat it as a likely regression.

- **Eligibility** (`PG.roomEligibleForStay(state, room, checkIn, checkOut, excludeAssignmentId)`): a room qualifies only if it's active + sellable, has no overlapping non-Cancelled `roomAssignment` for any night of the stay, and has no overlapping `roomBlock` of type `Out of Order`, `Out of Service`, or `Management Hold`. **A block of type `Other` does not disqualify a room** — an explicit, deliberate MVP carve-out (that block type is informational only). `PG.roomMeetsRequirements()` layers a hard filter on top for *required* attributes — currently just the "Requires Wheelchair Accessible Room" checkbox, mapping to `requireAccessibility: ['Wheelchair Accessible']`.
- **Priority** (`PG.rankRoomsForAssignment()`), most-recommended first: **(1)** retaining an already-assigned room across an edit is handled *before* ranking even runs, in `PG.autoAssignRoomsForItem()` — a kept room only drops out if it's no longer eligible; **(2)** preference match count (bed configuration, connecting-room request); **(3)** `PG.roomAdjacencyScore()` — prefers a room with no assignment/block landing on the night before arrival or the departure night; **(4)** lowest room number, the final deterministic tie-breaker. A qty≥2 item with "Request Connecting Rooms" checked additionally tries to seat a mutually-connecting pair first (`PG.findConnectingPair()`) — a light heuristic, not a solver.
- **`PG.autoAssignRoomsForItem(state, request)`** → `{ assignedRoomIds, shortfall }`. Never assigns the same physical room twice within one call, and honors `request.excludeRoomIds` so sibling items in the same multi-room reservation can't collide. `shortfall > 0` means demand exceeds eligible supply — the UI must block confirmation, never overbook.
- **`PG.roomIneligibilityReason()`** returns a short, **non-sensitive** category only — `Reserved | Out of Order | Out of Service | Held | Attribute Mismatch | Inactive | Not Sellable` — never a block's free-text `reason`/`notes` field.
- **`PG.renderChangeRoomDrawer(opts)`** — the shared, structured room picker (a right-side drawer, never a plain `<select>`) used by New Reservation, Reservation Detail, Operations Calendar, and Physical Rooms' conflict-resolution flows. Ranks eligible rooms first, lists ineligible ones disabled with a reason badge, marks the currently-assigned room, supports search + floor/view/bed/accessibility/connecting filters, and requires picking a new room before showing an impact summary and enabling Confirm. Its DOM (`#pgChangeRoomDrawer`) and CSS (`.crd-*`, `.chip`) are created lazily and reused across opens on a page.
- **Needs Attention** is the only "something's wrong" state — it never falls back to "unassigned." Reservation Detail and Operations Calendar independently re-check every live assignment's room against `PG.roomEligibleForStay()` on every render. If a room was blocked *after* being assigned, the assignment is flagged in place (no silent reassignment), and the same Change Room drawer picks a replacement. A reservation item that somehow has zero assignments (only reachable via pre-correction legacy `localStorage` data) renders the same way, with an "Assign Room" action instead of "Change Room" — an explicit self-heal path, not a supported ongoing state.
- **Change Room / Assign Room are atomic and fail-safe.** Every call site revalidates the chosen room against fresh state (`PG.roomEligibleForStay()`) immediately before writing, wraps the mutate-then-`PG.setState()` sequence in `try/catch`, and only mutates in-memory state *after* revalidation passes — a stale pick, a mid-flight change, or a thrown error all leave the previous assignment exactly as it was, with a toast explaining what happened. Every change records who, when, old room, new room, and (when resolving a block conflict) the reason, in both `roomAssignment.assignedAt/assignedBy` and the reservation's `activity[]` + global `audit[]`.
- Reservations round-trip a `roomAssignment` per physical room at save time in `new-reservation.html`'s `createReservation()` — the wizard already blocks Next/Confirm on any shortfall. `Confirmed` reservations get `Assigned` records; `Draft`/`Pending Payment` get tentative `Held` ones.
- **Blocking or deactivating a room that has an active assignment or hold is refused, not silently allowed.** `physical-rooms.html`'s Block Room modal and Deactivate action, and `operations-calendar.html`'s Edit Block modal, all check for overlap before saving: if anything overlaps, the affected reservation(s) are listed with an inline **Change Room** button right there in the conflict/blocked modal, Save/Deactivate stays disabled, and the action only proceeds once every affected reservation has been moved off the room.

### 4.8 Temporary holds — automatic release simulation

A `Held` `roomAssignment` (i.e. any Draft/Pending Payment reservation's tentative room) carries an optional `holdExpiresAt`. `PG.HOLD_MINUTES` (30) and `PG.holdExpiryFromNow()` set it when a Held assignment is created (`new-reservation.html`'s `createReservation()`, and `reservation-detail.html`'s Assign Room / Edit-save paths); it's kept in step with the reservation's own `paymentLinkExpiresAt` once a payment link has been sent (`reservation-detail.html`'s `holdExpiryForReservation()`, wired into Generate/Resend Payment Link). **`PG.releaseExpiredHolds(state)`** — a pure, idempotent mutation (guarded the same way cancellation guards its own release, by only acting on `assignmentStatus==='Held'`) — cancels any Held assignment past its `holdExpiresAt`, restoring its room to availability and logging a line to the reservation's own `activity[]`. This is called from **inside `PG.getState()` itself**, on every read, the same way schema-migration backfill already is — the simplest realistic "automatic release after expiry" a backend-less, localStorage-only prototype can offer, since there is no real timer/server to run one on a schedule. A reservation whose hold expires this way surfaces through the existing **Needs Attention** self-heal path (§4.7) — nothing new to learn there, and never a silent reassignment. Seed data demonstrates both states out of the box: `RES-10247`'s hold (`asn-5`) is already expired and self-heals the moment any page loads; `RES-10248`'s (`asn-6`) is not.

---

## 5. Shared UI shell (`PG.mount`, sidebar, header)

Every page's `<body>` is just `<div id="pg-app"></div>` + `<script src="assets/js/app.js"></script>` + an inline `<script>`. The inline script calls:

```js
var page = PG.mount("<nav-key>", ["Crumb 1", "Crumb 2", ...]);
```

`PG.mount()`:
- Renders the sidebar (`renderSidebar`) using the `NAV` array (§7), highlighting the item whose `key` matches the first argument.
- Renders the header (`renderHeader`) with the breadcrumb trail and shared header buttons (New Reservation, Reset Demo Data, and — only on the Reservations page — the Arabic toggle).
- Returns the `<main id="pg-page">` element; the page's script builds an HTML string and assigns it to `page.innerHTML`.

### 5.1 Breadcrumb linking rule

**Only a *middle* breadcrumb crumb is ever a clickable link.** The first crumb (section label) and the last crumb (current page) are always plain text. `CRUMB_LINKS` in `app.js` maps known crumb label strings to their `.html` file. When adding a new page, pass crumbs like `["Section", "List Page Name", "Current Sub-Page"]` for a 3-level trail, or `["Section", "Page Name"]` for a top-level page. Reservation Detail deliberately passes `["Reservations", "Reservations", "Reservation Detail"]` (the section label and the list-page label are both literally "Reservations", by design).

### 5.2 Property-context control

The header renders a `.pg-property-ctx` pill showing "Palestine Grand Hotel" with a building icon, to the left of the breadcrumb. Single-property users (this whole prototype) see just the name, no switcher — a multi-property switcher was never built, since building working switcher UI for a permanently single-property MVP would be unused complexity, not a real requirement.

**Data-model scoping:** every record type a multi-property deployment would need to partition — `roomTypes`, `physicalRooms`, `roomAssignments`, `roomBlocks`, `customers`, `reservations`, `ratePlans`, `taxesFees`, and `audit` entries — carries a `propertyId` field (`"PGH-001"` for every seeded record today, via the `PROPERTY_ID` constant at the top of `buildSeed()`). No page currently *filters* by it (there is only one property to filter to), but the field exists on every relevant record now, so a second property could be added and scoped correctly without a data-migration pass. `PG.addAudit()`'s `property` field defaults to `state.hotel.propertyCode` automatically (see §4.2).

### 5.3 Role gating and named permissions

`CURRENT_ROLE` (hardcoded to `"Hotel Admin"`, exported as `PG.CURRENT_ROLE`) gates `NAV` items flagged `superAdminOnly: true` (currently only "Hotels"). **`PG.PERMISSIONS`** is a `{ permissionKey: [roleName, ...] }` map of 15 named permissions (`view_physical_rooms`, `manage_physical_rooms`, `block_rooms`, `view_operations_calendar`, `assign_rooms`, `unassign_rooms`, `view_guests`, `manage_guests`, `view_guest_payment_history`, `view_rates`, `manage_rates`, `view_payments`, `record_refunds`, `view_reports`, `export_reports`), and **`PG.hasPermission(key)`** checks whether `CURRENT_ROLE` holds one. `permissions.html` renders this map directly (grouped by module) rather than a decorative sample table, so it can never drift from what pages actually check. Both existing roles hold every permission today — this prototype has never distinguished them beyond `superAdminOnly` — so wiring pages to `hasPermission()` changed no observable behavior, only what becomes possible once a narrower role (e.g. a read-only Front Desk role) is ever added; there is still no login screen or role-switcher UI to select one.

**`unassign_rooms` is granted to nobody and checked nowhere.** No Unassign Room action exists anywhere in this app by design (§4.7's core invariant) — the permission key exists purely so the matrix documents that this capability is deliberately absent, not merely forgotten. Do not wire it to anything.

**Each gated page follows the same pattern** `physical-rooms.html`/`operations-calendar.html`/`guests.html`/`guest-detail.html` already established (a `CAN_VIEW`/`CAN_MANAGE`-style `var` computed once from `hasPermission()`, action markup conditionally includes buttons only when the relevant permission is true, and a final `if (!CAN_VIEW) { page.innerHTML = <permission-denied panel> } else { init(); }`) — extended in this pass to `rates.html`, `payments.html`, and the three report pages, which previously had no gating at all. Pages whose script isn't wrapped in an `init()` function place the `if (!CAN_VIEW)` override as the **very last statement**, so it overwrites whatever the rest of the script already built — functionally equivalent to the `init()` pattern, chosen there to avoid a large restructuring risk. Every granular action a permission gates (Block Room vs. general room management, Record Refund vs. general payment viewing, Export vs. viewing a report, etc.) hides its own button/control when the specific permission is false — it's not just one blanket page-level gate.

### 5.4 Global search (header)

`renderHeader()` renders a `.pg-gsearch` search box on **every** page (it's part of the shared header, not a per-page feature), wired up by `wireGlobalSearch()` inside `mount()` — so it needs no per-page setup. **`PG.globalSearch(state, query)`** is the single search primitive: substring match (case-insensitive) across reservation ID + guest name (→ *Reservations*), guest name/email/phone (→ *Guests*), physical room number + room type name (→ *Rooms*), and `transactionRef` (→ *Payments*), each group capped at 6 results. The dropdown groups results in that order, supports Arrow Up/Down + Enter (the first result is pre-highlighted so Enter works without an arrow key first) + Escape, and opening a result navigates straight to the right page — `reservation-detail.html?id=`, `guest-detail.html?id=`, `physical-rooms.html?room=` (opens that room's Details drawer via the existing deep link), or `payments.html?id=` (opens that reservation's Payment Details drawer via the existing deep link) — never a generic search-results page. **Recent searches** are the one piece of UI state that lives outside `state` entirely: a small array in its own `localStorage` key (`pg_recent_searches_v1`, capped at 5, newest first), read/written by `recentSearches()`/`pushRecentSearch()` — deliberately not part of the main `pg_hotel_admin_state_v1` blob since it's a per-viewer convenience, not business data, and "Reset Demo Data" should not need to touch it.

### 5.5 Modal/drawer accessibility (focus trap, ARIA, Escape)

`PG.openModal(id)`/`PG.closeModal(id)` are the **only** way any modal or drawer in this app opens/closes — every one of them (Change Room, Add/Edit Guest, Delete Guest, Block Room, Record Refund, Payment Details, filter panels, etc.) funnels through these two functions, so fixing accessibility here fixed it everywhere at once rather than per-component. `openModal()` now: sets `role="dialog"`, `aria-modal="true"`, and `aria-labelledby` pointing at the dialog's own first heading; moves focus to the first focusable element inside (or the dialog box itself if none exist); and installs a `keydown` listener that traps Tab/Shift+Tab inside the dialog and closes it on Escape. `closeModal()` removes that listener and restores focus to whatever element had focus before the dialog opened. This is a targeted fix (the single highest-leverage shared choke point) rather than an exhaustive per-page accessibility audit — table headers, calendar accessible names, status-badge contrast, etc. were not separately re-audited in this pass beyond what already existed.

### 5.6 RTL infrastructure

RTL support predates this pass (drawer mirroring, sidebar, table text-alignment, and badge-dot rules already existed in `style.css`'s `html[dir="rtl"]` block) and was extended, not rebuilt: new `html[dir="rtl"]` rules were added for Operations Calendar's sticky/absolutely-positioned elements (`.opc-corner`, `.opc-room-info`, `.opc-group-header`, `.opc-quickadd`, `.opc-block-btn`) and for `.more-menu` alignment. **Deliberately not mirrored:** the Operations Calendar's date-timeline bar/cell positioning, which is computed as JS pixel offsets from the earliest visible date, not CSS float/margin — flipping that is a real timeline-semantics change (which end of the timeline is "first"), not a CSS swap, and risks a worse-than-LTR result if rushed; see the code comment above those rules in `style.css`. **`reservations-ar.html` remains the only full Arabic-translated page** (§1.4) — this pass did not hand-translate the other screens named in the cross-cutting-controls request (Dashboard, Reservation drawer, Change Room drawer, Physical Rooms table, Guests, New Reservation, Payments); it only ensured the shared components those screens already use (drawers, modals, tables, the calendar's non-timeline chrome) mirror correctly if/when Arabic content is dropped into them.

---

## 6. Design system components (`assets/css/style.css`)

### 6.0 Visual system — Metronic 8 Demo 1 (Light, LTR)

The whole stylesheet is calibrated to **Metronic 8 Bootstrap Demo 1, Light LTR**. The single most important thing to understand before touching it: **Metronic's light theme carries hierarchy in type weight and muted text, not in boxes.** Surfaces are separated by a very pale `#F1F1F4` hairline and almost no shadow. An earlier build of this app used a much darker `#e4e6ef` border everywhere and read as a grid of outlined rectangles; the fix was the neutral ramp, not more spacing.

Structural pieces that define the look — change these only deliberately:

| Piece | Implementation | Why it matters |
|---|---|---|
| **Dark aside** | `.pg-sidebar` `#1E1E2D`, active item = filled `#1B1B29` panel + a 4px primary bullet on the leading edge | Demo 1's signature. Not an inset box-shadow bar. |
| **Page toolbar** | `.pg-page-head` — title, subtitle and the page's **primary action**, on the canvas, above the cards, closed by a hairline | This is what stops primary actions from being buried inside the first card. Every page uses it. |
| **Underline tabs** | `.pg-tabs` / `.pg-tab` — one continuous hairline under the row, 2px primary underline on the active tab, muted inactive labels, optional `.tab-count` badge | Replaces boxed tabs, which read as a row of disabled buttons and hid the active state. **Never reintroduce per-tab borders or gaps.** |
| **Cards** | `--pg-radius: 10px`, `1px solid #F1F1F4`, `0 3px 4px rgba(0,0,0,.03)` | Restraint is the point. |
| **Tables** | `table.dt` — uppercase muted headers, **dashed** row separators (`1px dashed`) | Metronic's `table-row-dashed`; what makes a dense operational table read as light. |
| **Badges** | Pale tinted surface + coloured label, `--pg-radius-sm: 7px` — a rounded rectangle, **not** a pill, always with a dot or icon | Status never depends on colour alone. |
| **Buttons** | Five levels only: `.btn-primary` / `.btn-outline` / `.btn-light` / `.btn-icon` (ghost) / `.btn-danger`, all 38px tall (`.btn-sm` 32px) | Don't invent a sixth. |
| **Header** | Context + breadcrumb left, global search centre, help / notifications / user menu right | Product and demo actions (New Reservation, Reset Demo Data) were removed from here — they competed with each page's own primary action. Reset Demo Data now lives in the user menu. |

All design tokens are CSS custom properties on `:root` — check there before hardcoding a colour, radius or shadow.

### 6.1 Core components

| Component | Classes | Notes |
|---|---|---|
| Buttons | `.btn .btn-primary/-light/-outline/-success/-danger/-danger-outline`, `.btn-sm`, `.btn-block` | Hover states explicitly re-declare label color (a global `a:hover` rule has higher specificity and would otherwise make labels disappear on hover — don't remove those declarations). |
| Cards | `.card .card-header .card-body .card-footer` | `.card-body.no-pad` for edge-to-edge tables. |
| Tables | `table.dt` | Dense operational table style, used everywhere lists are shown. |
| Badges | `.badge .badge-gray/-blue/-green/-yellow/-red/-purple`, `.badge-dot`, `.badge-outline` | **Reservation Status uses solid badges; Payment Status always adds `.badge-outline`** so the two stay visually distinguishable even when they share a color semantic. Use `PG.statusBadge(status)` / `PG.payBadge(status)` / `PG.roomStatusBadge(status)` — never hand-roll a badge. |
| Alerts | `.help-note` (default = info/blue), `.help-note-warning/-danger/-success` | Use these instead of inline `style="background:..."`. |
| Modals | `.pg-modal-overlay.show > .pg-modal` with `.pg-modal-header/-body/-footer` | Opened/closed via `PG.openModal(id)` / `PG.closeModal(id)`. Use for **confirmations** (Cancel Reservation, Stop Sell, Block Room, Unassign-style flows). |
| Drawers | `.pg-drawer-overlay.show > .pg-drawer` with `.pg-drawer-header/-body/-footer` | Same open/close mechanics as Modal. Use for **longer forms and pickers** (Adjust Inventory, Add/Edit Room, Change Room, Add/Edit Guest, Filters). RTL-aware. |
| Toasts | `PG.toast(message, type)` | `type` ∈ `success/warn/danger`. Auto-dismisses. |
| Tabs | `.pg-tabs .pg-tab.active` | Used by `guest-detail.html` (Overview/Reservations/Payments/Activity) — a single content `<div>` re-rendered per click, not four DOM subtrees. Reservation Detail still uses numbered structured sections instead of tabs (an explicitly-allowed alternative). |
| Stepper | `.pg-steps .pg-step.active/.done`, `.pg-step-connector.done` | Used by New Reservation's 4-step wizard. Connector lines are dedicated flex elements between steps, not an absolutely-positioned `::after`. |
| Timeline | `.timeline .t-item` | Used by Reservation Detail, Physical Rooms, and Guest Detail's Activity sections. |
| Chips (attribute) | `.chip` | Small **read-only** attribute tags (room view, bed config, accessibility features) — shared across Physical Rooms and the Change Room drawer. Not a control. |
| Segmented control | `PG.segmented(name, options, active, opts)` + `PG.wireSegmented(root, name, onChange)` | **2–4 short mutually exclusive choices** — 7/14/30 Days, Same Price / Different Price by Day, Active / Inactive, Percentage / Fixed. Renders as a real `role="radiogroup"`. Used by the Price Calendar, Operations Calendar, Rate Plan form, and Physical Rooms' filter drawer. |
| Filter chips | `PG.filterChips(name, options, active, opts)` + `PG.wireChips(root, name, onChange)` | **Common one-click filters** (room type, status). Supports `multi` and per-chip `count`. Replaces the low-count `<select>`s that used to sit in toolbars. |
| Applied-filter chips | `PG.appliedChips([{key,label,value}])` | Reports back what an *advanced filter drawer* is currently narrowing, each removable via `[data-remove-filter]`. Filters set in a drawer must never become invisible state. |
| Searchable combobox | `PG.renderCombobox(container, opts)` | **Long entity lists** (guests, physical rooms, rate plans, reservations). Type-to-filter, arrow/Enter/Escape keys, results carry supporting context (`sub`), ineligible options render disabled with a `reason`. |
| Search input | `.pg-searchwrap > .ic + .form-control` | Search-first toolbars. Uses `inset-inline-start` so the icon lands correctly in RTL with no extra rule. |
| Overflow menu | `.more-wrap > .more-btn + .more-menu` | Secondary row actions. Lives in `style.css` (not per-page) so every table's row menu is literally the same component; `.more-menu button.danger` for destructive items. |
| Empty states | `.empty-state` | Used across list/table pages when a filter yields no rows, or a dataset is genuinely empty. |
| Custom dropdowns | see §6.2 | Styles native `<select>` app-wide. **This is now the fallback, not the default** — pick the control from the shape of the choice: 2–4 exclusive options → segmented; common filters → chips; a long entity list → combobox; a `<select>` only for a genuinely long, non-searchable, single-pick list. |
| Icons | `PG.icon(name, size)` over the `ICONS` map | **One consistent SVG line style** (24-box, 1.8 stroke). Never paste an emoji or Unicode dingbat in as a functional control or status glyph. Icons whose meaning depends on real-world direction (chevrons) take `.ic-dir` so they mirror in RTL; icons whose meaning does not (search, filter, calendar, money, check, alert) must **not** mirror. |

### 6.2 Custom Select engine (`PG.enhanceSelects(root)`)

Native `<select class="form-control">` elements are **progressively enhanced** into a styled dropdown (`.pg-select > .pg-select-trigger + .pg-select-menu`). The native `<select>` stays in the DOM (visually hidden), so **any existing code that reads `.value` or listens for `"change"` keeps working untouched** — enhancement is purely visual.

**Critical gotcha:** if you ever set `.value` on an enhanced select *programmatically* (not through user click), you **must** also do `el.dispatchEvent(new Event('change'))` afterward, or the custom dropdown's visible trigger label will silently show the wrong text while the underlying value is actually correct. This bug has been found and fixed multiple times across the project — watch for it in any new code that pre-fills a select.

Call `PG.enhanceSelects(container)` once after any `innerHTML` assignment that includes `<select class="form-control">` elements — including inside dynamically-created modals/drawers, and after any re-render that rebuilds selects.

### 6.3 Managed-list dropdown (`PG.renderManagedSelect(container, opts)`)

A from-scratch (not select-wrapping) dropdown for editable string lists — used for **Bed Configuration** (`state.bedConfigs`) and **Meal Plan** (`state.mealPlans`). Supports inline "+ Add New…" and a per-option "×" delete (with a native `confirm()` and a "can't delete the last one" guard). `opts` = `{ value, getList(), setList(list), onChange(v), placeholder }`. Reuse this component for any future user-managed reference list rather than inventing a new pattern.

### 6.4 Status badge color semantics (audited, keep consistent)

| Status | Class | Meaning |
|---|---|---|
| Confirmed, Paid, Available | `.badge-green` | Positive |
| Cancelled, Failed | `.badge-red` | Destructive |
| Pending Payment, Payment Required, Refund Pending, Held | `.badge-yellow` | Warning |
| Expired, Refunded, Draft, Inactive | `.badge-gray` | Neutral |
| Link Sent, Important (guest flag) | `.badge-purple` | Info / distinguishing flag |
| Pay on Arrival, Reserved | `.badge-blue` | Info |

---

## 7. Current navigation structure

Defined in the `NAV` array in `app.js`:

```
Hotel Management  → Dashboard (index.html), Operations Calendar (operations-calendar.html),
                     Hotel Profile, Room Types, Physical Rooms (physical-rooms.html),
                     Rates, [Availability & Inventory — hidden, see below]
Reservations      → Reservations, New Reservation, Guests (guests.html)
Payments          → Payments
Reports           → Reservation Reports, Inventory Reports, Payment Reports
Settings          → Hotel Policies, Taxes & Fees, Payment Configuration
Administration    → Hotels (hotels.html — NOT YET BUILT, super-admin-only), Users, Roles, Permissions, Audit
```

**The nav still links to one page that doesn't exist yet:** `hotels.html`. This is intentional — screens get built incrementally, one focused prompt at a time, not all at once. When you build it, just create the file at that exact filename and the nav + breadcrumb linking will work automatically (add the new label to `CRUMB_LINKS` too).

**`Availability & Inventory` is hidden from the sidebar, not removed.** By product decision, the Operations Calendar (§8.2/§8.5) is now the primary availability/inventory workspace; `availability-inventory.html`, its route, and every bit of its logic are fully intact and directly reachable by URL — only its `NAV` entry is toggled via a `hidden: true` flag (`renderSidebar()` filters `!it.hidden`, the same spot `superAdminOnly` is already filtered), reusing that existing visibility mechanism rather than adding a new one. It's also been unlinked from the Dashboard's shortcuts/alerts, `reservation-detail.html`'s More menu, and `reservations-ar.html`'s own hand-written sidebar (all now point at the Operations Calendar instead). Flip `hidden` back to `false` (or delete the key) to restore it to the nav — nothing else needs to change. Don't create a second, competing entry point for editing availability/inventory outside the Operations Calendar and this dormant page.

The old "Guided Journey" nav item was removed from the sidebar in an earlier restructure, but the page (`demo-journey.html`) still exists and is still linked from the Dashboard's Quick Operations panel — don't delete it.

---

## 8. Page-by-page reference

| File | Purpose | Notes |
|---|---|---|
| `index.html` | **Dashboard / Overview** | Every number computed live from state. "Attention Required" alert engine covers expiring payment links, failed payments, low availability, active Stop Sell, stale drafts >24h, **Assignment Conflicts** (a physical room with overlapping active assignments/blocks — links to Operations Calendar), and **Rooms Out of Order** (links to Physical Rooms). Today's Arrivals and Recent Reservations show each reservation's assigned physical room number(s) (`assignedRoomsLabel()`), never just a room count. Deep-links into `reservations.html`/`payments.html` via query params. |
| `operations-calendar.html` | **Operations Calendar — the main daily room-control workspace** | See §8.2. Split-view: a scrollable timeline grid (sticky date header, sticky room column, physical rooms as rows grouped under collapsible room-type headers) plus a right-side drawer for whatever's selected. Every active reservation is guaranteed a physical room, so it renders on exactly that room's row — there is no "unassigned" lane. |
| `hotel-profile.html` | Tenant profile, editable | Country/City/Currency/Timezone are dropdowns (`PG.REF`); phone has a separate country-code dropdown. |
| `room-types.html` | Room type list | Table with View/Edit actions + Add. |
| `room-type-form.html` | Create/edit/view/**delete** a room type | Bed Configuration uses the managed-select component. Delete cascades to associated `rates[id]`, `ratePlans`, `physicalRooms`, `roomAssignments`, and `roomBlocks`. |
| `physical-rooms.html` | **Physical Rooms management — room-focused operations, connected to the same logic as the Operations Calendar** | Dense table (not cards) — Room Number, Room Type, Building/Floor, Bed Config, Key Attributes, Today's Status, Current/Next Reservation, Active State, Actions; lower-priority columns collapse below 1100–1500px. Summary strip (Total/Active & Sellable/Reserved Today/Blocked Today/Inactive). Add/Edit is a **Drawer** (Connecting Rooms kept mutual on save; also sets the room's `operationalStatus` baseline — the only place that's editable). Room Details is a separate, rebuilt-per-open **Drawer**, whose footer adds **Create Reservation** (prefilled via `new-reservation.html?rt=&room=&date=`, same as the Operations Calendar's empty-cell/quick-add) alongside Edit and **Block Room**; both the row's More menu and the Details drawer offer Create Reservation, Block Room, and View on Operations Calendar (`?room=<id>` deep link, §8.2). **Block Room opens `PG.renderBlockRoomModal()`** — the exact same shared modal the Operations Calendar's drag-to-create-block and per-row Block quick action use, not a page-local duplicate; it live-previews conflicting assignments and lists each with an inline **Change Room** button — Save stays disabled until every conflict is resolved. Deactivate runs the same conflict check. No delete action anywhere — Activate/Deactivate is the only lifecycle control. |
| `rates.html` | **Rate Plans & Pricing** — exactly two underline tabs: **Rate Plans** and **Pricing Periods** | See §8.5. File name stays `rates.html` so every existing deep link keeps working. **Rate Plans** = a worklist (plan, applies-to, base price, current period, status, last updated) with an Add/Edit drawer sectioned Basic information / Target scope / Base price. **Pricing Periods** = a worklist over every period in the property (period, plan, applies-to, dates, price with delta-vs-base, nights, status) with its own drawer. The **Price Calendar** is a modal opened *from a plan* — it answers "why is this night this price" about a plan you are already looking at, which is not a top-level job. Deep links: `?tab=periods`, `?plan=<id>`, `?plan=<id>&period=<id>`, `?plan=<id>&edit=1`, `?new=1`. |
| `rate-plan-form.html` | **Retired route, kept alive as a redirect** | Rate plans are now created and edited in a drawer on the Rate Plans tab. This page redirects to `rates.html?tab=plans&plan=<id>&edit=1` (or `&new=1`) so old bookmarks and links still resolve. Do not rebuild a full-page plan form here. |
| `availability-inventory.html` | Live commercial availability grid + Stop Sell/Reopen/Adjust Inventory | Grid cells are clickable (`tbody .av-cell` only). Adjust Inventory is a **Drawer**; Stop Sell/Reopen are **Modals**, each pre-filling from the selected cell. The selected cell's detail card has a **View Breakdown** toggle (§8.5) showing the full physical-room-connected accounting behind the one Available Quantity number. Adjust Inventory's "Increase" can never push sellable inventory past the room type's active+sellable physical-room count. |
| `reservations.html` | Reservations worklist | Search + 5 filters (status, payment status, source, arrival, departure) + Clear Filters. Supports `?arrival=/?departure=/?status=/?payStatus=/?source=` query prefiltering. Has the Arabic toggle header button (only page that does). |
| `guests.html` | **Guests directory** | Dense searchable table (not a card gallery) — Guest Name, Phone/Email, Nationality (collapses below 1300px), Preferred Language, Upcoming Reservation, Last Stay, Total Reservations, Notes indicator, Actions. Filters: search (name/phone/email/`idRef`), Has Upcoming/Has Past Reservations, Important/VIP, Communication Language, Last Stay date range, Clear Filters. Add/Edit is `PG.renderGuestDrawer()` (§8.3). |
| `guest-detail.html` | **Guest profile — full page, not a modal**, since a guest has several related datasets staff move between | See §8.3. Header: name, contact, preferred language, Important badge, Edit Guest, Create Reservation (`new-reservation.html?customer=`). Tabs: Overview, Reservations, Payments, Activity. |
| `reservations-ar.html` | **The single representative Arabic (RTL) screen** | A from-scratch Arabic mirror of the Reservations worklist (own hand-written sidebar/header, not `PG.mount`). Deliberately the *only* Arabic screen. Row click navigates to the (English) `reservation-detail.html`. |
| `new-reservation.html` | **New Reservation — 4-step guided wizard** | Steps: Guest & Source → Stay & Rooms → Pricing & Payment → Review & Save. See §8.1. Supports `?demo=ahmad-whatsapp` (Guided Journey), `?rt=&room=&date=` (Operations Calendar empty-cell click), and `?customer=` (Guests "Create Reservation") prefills. Step 2 **auto-assigns a physical room** per unit the moment room type/quantity/date/preference changes — no "book without assigning a room" option exists. Each assigned unit shows a summary card with a **Change Room** button. A shortfall blocks Next/Confirm with an explanatory message, distinct from the commercial-availability message. |
| `reservation-detail.html` | **Reservation detail — the hub connecting physical-room, guest, pricing, payment, and activity data for one reservation** | See §8.4. 6 numbered sections (Stay & Room Assignments, Guest Details, Pricing & Taxes, Notes, Payment, Activity) plus a summary header (guest/dates/total/status badges + primary actions). Payment card logic branches on `paymentStatus` (Payment Required → Generate; Link Sent → Resend only; Expired → Regenerate only; Failed → Generate New Link only). Room Items show each unit's assigned room with **Change Room** only — no Unassign action. Flags a room **Needs Attention** prominently (header badge + inline row) if it was blocked after assignment; an "Assign Room" fallback only appears for legacy pre-correction data with zero assignments. |
| `payments.html` | **Payments worklist — filterable table + a right-side Payment Details drawer** | See §8.6. Columns: Payment/Transaction Ref, Reservation #, Guest, Method, Amount + currency, Status, Created, Updated (`lastTouched()` — the reservation's own last `activity[]` timestamp; there's no separate `updatedAt` field). Filters: search (reservation #/guest/payment ref), Status, Method, Created date range, Property (single-property, disabled — no switcher exists). No amount-range filter — that capability doesn't exist anywhere else in the app yet, so none was added here either. Supports `?status=` (existing) and `?id=<reservationId>` (new — opens straight to that reservation's drawer; used by Dashboard's payment exception alerts). |
| `taxes-fees.html` | **Taxes & Fees — real, configurable charges wired into pricing** | See §8.5. CRUD over `state.taxesFees` (Add Charge / Edit **Drawer**): Percentage or Fixed, Tax or Fee, Applies by Default + Active toggles, optional Effective From/To. A live "Example Pricing Breakdown" sidebar card shows exactly what `PG.computePricing()` would charge on a $100 room subtotal today. No delete — same Active/Inactive-only lifecycle convention as Physical Rooms. |
| `hotel-policies.html`, `payment-configuration.html` | Settings, mostly read-only/lightweight | Explicitly kept lightweight per the original brief. |
| `users.html`, `roles.html`, `permissions.html`, `audit.html` | Administration | Lightweight by design, except Audit, which reads the real `state.audit` log. |
| `reservation-reports.html`, `inventory-reports.html`, `payment-reports.html` | **Reports — a card grid + one inline report viewer per hub**, see §8.7 | 5/3/2 reports respectively. Every report: Property (disabled) + date-range + relevant secondary filters, KPI tiles where useful, an operational table as the primary result, and **Export CSV**. `?report=`/`?from=`/`?to=`/`?status=` query params select a report and its filters on load (used by Dashboard's Saved Views). |
| `demo-journey.html` | **Guided Journey** — a 7-phase clickable walkthrough of one scenario (Ahmad Khalil, WhatsApp booking → payment → cancellation) | Not in primary nav (§7) but linked from the Dashboard. Opens `new-reservation.html?demo=ahmad-whatsapp` and other screens in new tabs so the checklist stays visible. |

### 8.1 New Reservation wizard — key behaviors to preserve

- **Nothing is pre-selected.** `wizard.source`, `wizard.customerId`, `wizard.paymentMethod` all start `null`. Summary rows only render once the user has actually made that choice. "Next" is blocked with a toast until the required field for that step is chosen.
- **Guest step is search-first over the Guests module, not an inline form.** `wizard` holds only `customerId` — there is no separate "new customer" mode/shape anymore. A combobox (`#guestSearchInput` / `#guestComboMenu`) searches `state.customers` by name/phone/email (shows the 5 most-recently-added guests when empty), and each result line shows contact details plus a last-stay/upcoming-reservation context line (`guestContextLine()`). Selecting a result sets `wizard.customerId` and swaps in a compact, non-sensitive summary card (`renderGuestStep()` — name, phone, email, preferred language, Important/Accessibility flags, View Profile, Change Guest); it deliberately never shows `idRef`. **"+ Add New Guest"** opens the shared `PG.renderGuestDrawer()` (same duplicate-detection flow as `guests.html`) as an overlay — `onSaved` just sets `wizard.customerId` and re-renders the guest step in place, so Step 2/3 selections (rooms, rates, dates, payment) are untouched.
- Room items: Adults/Children are **read-only**, computed as `roomType.maxAdults/maxChildren × qty` — labeled "Occupants" and explicitly noted as headcounts only, not individual guest profiles (no per-occupant identity data model exists in this MVP).
- A **"Simulate: Availability Changed (Demo)"** button on Step 2 applies a real Stop Sell, so proceeding to Review genuinely triggers the "availability changed" warning — real logic reacting to real state, not a scripted fake.
- The "Continue" button is labeled **"Next →"**, with `id="nextBtn"` reused across steps.
- Each item also carries `requireAccessibility` (bool, hard filter), `bedConfigPref` (soft ranking preference), and — only shown once qty>1 — `requireConnecting` (soft preference). `recomputeAssignments()` re-runs `PG.autoAssignRoomsForItem()` for every item whenever any of these, the room type, quantity, or the reservation's dates change, always excluding rooms already picked by sibling items.
- **The selected guest's `accessibilityNeeds` connects to physical-room assignment, but never silently.** If the guest has non-empty `accessibilityNeeds` and not every item already requires an accessible room, Step 2 shows a dismissible banner (`renderAccessibilityBanner()`) with **"Require Accessible Rooms & Review."** Clicking it sets `requireAccessibility = true` on every item but deliberately does **not** call `recomputeAssignments()` — an already-assigned room that stops qualifying is flagged **Needs Attention** in place (`slotNeedsAttention()`), with the reason shown and a **"Review & Replace Room"** button that opens the normal `PG.renderChangeRoomDrawer()` (ranked recommendation + impact preview + explicit Confirm). `anyNeedsAttention()` blocks advancing past Step 2 (and blocks final save) until every flagged slot is resolved this way, so a stale/mismatched room can never ride through to Review and get swapped out by its recompute unnoticed.
- Supports `?rt=<roomTypeId>&room=<physicalRoomId>&date=<YYYY-MM-DD>` for Operations Calendar's "click an empty cell" interaction, and `?customer=<guestId>` for Guests' "Create Reservation": prefills a single-unit item and/or the existing guest, then asks the engine to *keep* the clicked room specifically (`keepRoomIds`) if one was given — falling back gracefully if it's since become ineligible.

### 8.2 Operations Calendar — key behaviors to preserve

Interaction pattern only loosely modeled on Mews-style hotel operations calendars (no branding, copy, or pixel-for-pixel layout copied) — a split view: a horizontal timeline grid on the main area, and a right-side drawer for whichever reservation or room block is selected. The main grid stays visible and scrolled-in-place behind the drawer (an overlay, not a route change) so staff never lose date/room context.

- **Grid mechanics are hand-built, not a `<table>`.** Each room row is a flex container: a `position:sticky; left:0` `.opc-room-info` cell plus a `position:relative` `.opc-track` holding absolutely-positioned `.opc-cell` backgrounds (for empty-cell clicks) and `.opc-bar` elements (reservations/blocks) computed from date-index × `CELL_W` (90px/night). The header row is `position:sticky; top:0`. Bars always paint above cells in the DOM (cells render first) — never reorder that without checking real click hit-testing.
- **Bar geometry communicates the exclusive checkout date**: a bar's right edge lands exactly at the boundary between the last occupied night's cell and the departure-day cell. A bar clipped by the visible window gets a flat edge + a `«`/`»` marker instead of a rounded corner.
- **Conflict detection is real, not styled-in.** `barsForRoom()` flags any two bars on the same physical room whose `[start,end)` ranges overlap — the seeded `blk-3` vs. `asn-5` conflict on `fam-402` (§4.6, §9) is the one live, out-of-the-box demonstration of the `.opc-bar.conflict` styling (thick red outline + hazard stripes + a warning icon). Every other combination of assignments/blocks is now prevented at write time.
- **Status/type is never color-only.** Every bar variant pairs a background tint with a distinct `border-style` (solid = confirmed/firm, dashed = tentative/hold, dotted = "Other" block) plus icons and a full-sentence `aria-label`.
- **Change Room / Assign Room reuse `PG.renderChangeRoomDrawer()`** — this page never reimplements a room picker. Cancel Reservation is an *inline* reveal inside the Reservation drawer (reason + Confirm/Keep), a deliberate scope reduction versus `reservation-detail.html`'s full before/after-inventory modal. "Open/Edit Reservation" and "Open Payment" all link to `reservation-detail.html`. There is no Check In / Check Out action anywhere, and no Unassign Room action anywhere.
- **Editing a Room Block here can't be saved into a conflict either** — its conflict box lists every affected reservation with its own inline **Change Room** button, exactly like `PG.renderBlockRoomModal()` (see below).
- **Clicking an empty cell (no drag) never fires for `!CAN_MANAGE`**, and only navigates to `new-reservation.html?rt=&room=&date=` — it never creates a reservation directly from the calendar.
- **Save failures are handled with real `try/catch`** around every `PG.setState()` call, not a scripted/random failure generator.
- **This is now the primary workspace for availability, inventory, reservation dates, physical-room assignment, and room blocks** — see §1.4/§7 for `availability-inventory.html` being hidden (not removed) in favor of this page.
- **`?room=<physicalRoomId>` deep-links here** (from `physical-rooms.html`'s "View on Operations Calendar") — expands that room's group if collapsed, scrolls its row into view, and flashes it briefly.
- **Each Room Type group header shows a live summary** (`groupSummary()`): Active & Sellable, Reserved, Held, Blocked (physical-layer counts, all for `PG.TODAY`) and Available/Remaining Sellable (from `PG.computeAvailability`, the commercial layer) side by side, plus a Stop Sell badge and the manual adjustment delta when either is active on `PG.TODAY`. A **Manage Availability** button opens a compact modal (scoped to the current view's first date) exposing the *existing* Stop Sell and manual-adjustment actions inline — same `state.inventoryOverrides`/`state.dateAdjustments` writes and the same `PG.activeSellablePhysicalCount()` cap `availability-inventory.html` enforces, not a second implementation of the rule.
- **Drag interactions on reservation bars** (`attachDragHandlers()`, delegated once on the persistent `#opcGrid` node so it survives every re-render): dragging a bar's **body** moves the whole stay (same duration, snapped to whole days); dragging its **left/right edge** (10px hit zone) resizes arrival/departure independently; dragging a bar **onto a different room's row** doesn't attempt a bespoke drop-target validator — it opens the existing `openChangeRoomFor()` (the same Change Room drawer as the click-based flow), so room-change validation is never duplicated. None of these save anything by themselves: a dashed `.opc-drag-ghost` preview snaps to the day grid while dragging, and releasing (if actually moved — a same-click with no movement still opens the reservation drawer as before) opens a **Confirm Date Change** modal built from `PG.computeDateChangeImpact()` showing guest/reservation#/room(s)/arrival/departure/nights/room charges/taxes/fees/total, each old value with a `→ new value` only where it actually changed, and a note when the reservation has multiple room items that the date change (dates are reservation-level, §4.3 rule 3) applies to the whole reservation, not just the dragged bar. Confirm re-revalidates via a fresh `computeDateChangeImpact()` immediately before calling `PG.applyDateChangeImpact()`; Cancel or a failed save just calls `renderGrid()` — nothing was ever written, so the original bar position is simply redrawn from state.
- **Drag interactions on room blocks**: body-drag moves a block (same room, same duration); edge-drag resizes one boundary. Release opens a **Confirm Block Change** modal showing old → new dates and, if the new range overlaps a live assignment, the same conflict list + inline **Change Room** buttons as `PG.renderBlockRoomModal()`/`openEditBlockModal()` — Confirm stays disabled until every conflict is resolved. Moving a block to a *different room* by dragging is not implemented (Edit Block doesn't support that either) — a deliberate, documented scope limit.
- **Dragging across empty cells on a room's row (not a single click) opens `PG.renderBlockRoomModal()`** prefilled with the dragged date range and that room — the range-select itself never saves anything; the modal's own required Reason + conflict-check + Confirm still gate the actual write.
- **Every drag path is gated by `CAN_MANAGE`** at the top of the single delegated `mousedown` listener — a viewer without permission gets the exact same click-to-view behavior as before, no drag/resize affordance at all. The non-drag equivalents already on the page (Change Room, Edit Block, and the new Manage Availability) plus `reservation-detail.html`'s Edit Reservation drawer (Edit Dates) cover every drag gesture with a menu-driven alternative using the identical validation/confirm/audit path.

### 8.3 Guests module — key behaviors to preserve

- **`PG.renderGuestDrawer(opts)`** (`opts: { editingId, onSaved(guestId, {usedExisting}) }`) is the single shared Add/Edit Guest drawer, used identically by `guests.html` and `guest-detail.html`. It owns validation (Full Name + Phone required, inline `field-error` divs, entered data untouched on a failed save), duplicate detection, and persistence.
- **Duplicate detection is phone/email fuzzy-matched, never blocking, and never auto-merges.** A match shows a warning panel with the existing guest's name/phone/email and two explicit choices: **Use Existing Guest** (navigates to that profile — nothing is created) or **Continue Creating New Guest** (saves anyway). There is no automatic merge path.
- **`onSaved`'s `usedExisting` flag** lets each caller react differently: `guests.html` re-renders its table (or navigates to the existing profile on the duplicate path); `guest-detail.html` re-fetches state and re-renders in place either way.
- **Guest Detail tabs are a single `#tabContent` div re-rendered on click** — `activeTab` drives `renderTabContent()`, and `render()` fully rebuilds the page on every Edit Guest save to keep the header's Important badge/contact line in sync.
- **"Timing" on the Reservations tab (`timingFor()`) derives Upcoming / Active Now / Completed / Cancelled / No Show from `status` + today's date** — no stored "phase" field, and no Check-In/Check-Out actions, only a read-only classification.
- **The Payments tab is a projection**, not a separate collection — it reads the same reservation fields the Payment section on `reservation-detail.html` does.
- **Activity tab entries are filtered from the global `state.audit` log** by guest name or any of the guest's reservation IDs appearing in `details` — same pattern as `physical-rooms.html`'s and `reservation-detail.html`'s per-entity activity.
- **Identification reference masking** shows only the last 4 characters outside the Add/Edit drawer's own input field.
- `new-reservation.html` supports `?customer=<guestId>` (composable with `?rt=&room=&date=`) to prefill an existing guest from "Create Reservation".
- **`PG.renderDeleteGuestModal(opts)`** (`opts: { guestId, canManage, onDeleted(guestId) }`) is the single shared Delete Guest confirm modal, used identically by `guests.html`'s row More menu and `guest-detail.html`'s own (new) More menu next to Edit Guest/Create Reservation — added there without rearranging those two buttons. **Permanent deletion is only offered when `guestLinkedDataSummary()` finds zero reservations for that guest and no *non-profile* audit entries mentioning their name** — `"Guest Created"`/`"Guest Updated"` entries don't count (every guest has those from the moment they're added; counting them would make deletion impossible for anyone), but reservations, the payments/activity that ride along with them, and any other audit trail do. A blocked deletion explains why in the modal itself and points out there is no archive/deactivate feature for guests to fall back to (only Physical Rooms has an Active/Inactive lifecycle) — per instruction, none was invented for this. An allowed deletion re-checks the same condition against fresh state immediately before writing (same revalidate-right-before-mutate convention as Change Room), only removes the `state.customers` record (a reservation's own `customerId`/name references are **never** touched — this is exactly why zero-reservations is the gate, not a stylistic choice), and logs a `"Guest Deleted"` audit entry. Requires `CAN_MANAGE`; the modal itself also renders a permission-denied state defensively if ever opened without it.
- **The Notes column on `guests.html` opens a read-only "View Note" modal on click** instead of only a title-attribute tooltip — lets staff read a guest's internal note without leaving the list or opening the full profile.

### 8.4 Reservation Detail — key behaviors to preserve

- **Header is a real summary, not just a title.** Alongside the ID and status/payment badges (plus a red "Room Assignment Needs Attention" badge when `anyItemNeedsAttention()` is true — the same self-heal condition §4.7 describes, surfaced at the top of the page, never buried in Activity), it shows Primary Guest, Arrival, Departure, and Total (`.head-meta`). Primary actions (`Edit Reservation`, `Cancel Reservation`, and the More menu's `Mark as Completed`/`Mark as No Show`) are gated by both `canManage()`/`CAN_MANAGE` (permissions) and reservation status — none of them render for a terminal reservation (Cancelled/Completed/No Show).
- **Six sections, not one long form:** Stay & Room Assignments, Guest Details, Pricing & Taxes, Notes, Payment (right column), Activity. Each Room Item's assignment row shows room type (the item card title), physical room number + floor, key attributes as chips (view/bed configuration/accessibility features, via `roomAttrChips()`), that assignment's own arrival/departure dates, an assignment-status badge (`assignBadge()` — Assigned=green, Held=yellow), and Change Room. A missing or ineligible assignment renders a `.needs-attention` row with an explicit reason, plus a section-level warning banner — not a note in Activity.
- **Notes is internal-only and clearly labeled as such.** `r.notes` (see §4.3) is edited inline (view/edit toggle, no separate drawer) with a fixed help note stating it is never shown to the guest or included in customer-facing confirmations. Saving pushes its own `activity`/`audit` entry ("Internal notes updated by ...").
- **Edit Reservation is a drawer that revalidates before it lets you save anything.** `openEditDrawer()` seeds an `editState` clone (dates + per-item roomTypeId/qty/requireAccessibility/bedConfigPref/requireConnecting) and re-renders on every field change via `computeEditPlan()`, which: (1) revalidates commercial availability with `PG.validateAvailability()` and (2) revalidates every physical-room assignment with `PG.autoAssignRoomsForItem()` — both run against `stateExcludingSelf()`, a cloned state with this reservation's own reservation/assignment records removed, so an edit is checked as if against a genuinely free slot rather than being blocked by (or silently coasting on) its own existing commitment. `keepRoomIds` is always this item's current rooms, so a still-eligible room is kept; only a now-ineligible one gets replaced by the engine's normal ranked recommendation. The drawer body's "Before / After Impact Summary" (dates, room type, quantity, room number(s), per-item and grand total) is recomputed live and is never skipped — **Confirm & Save Changes is disabled** whenever any item has an availability problem or an assignment shortfall, and nothing is written to state until that button is explicitly clicked. Saving cancels every old `roomAssignment` for the edited items and creates fresh ones (mirroring the cancel-then-recreate pattern already used elsewhere), recalculates `taxAmount`/`feeAmount`, and logs one detailed `activity`/`audit` entry describing exactly what changed (dates, room type, quantity, room number(s), pricing) — or "no material changes" if the user opened and closed the drawer without changing anything.
- **Mark as Completed / Mark as No Show are the only post-stay status actions** — both require an explicit confirmation modal (`openStatusActionConfirm()`) and log the acting user and timestamp in `activity`/`audit`. There is deliberately no Checked-In/Checked-Out workflow (§1.3, §9) — these two actions are terminal status transitions only, available solely from `Confirmed`.
- **Cancellation is unchanged in mechanics but now also surfaces refund implications up front**: the confirm step shows a help note when the reservation is `Paid` (cancelling will set `Refund Pending`) or has an outstanding/sent payment link (nothing to refund). Reason is still required; every physical-room assignment is still cancelled exactly once (`assignmentStatus!=='Cancelled'` guard) alongside the reservation itself, and commercial inventory is derived live so it is never double-restored.

### 8.5 Availability & Inventory, Rate Plans & Pricing, and Taxes & Fees — key behaviors to preserve

- **`PG.availabilityBreakdown(state, roomTypeId, dateStr)` is purely additive** — it does not change `PG.computeAvailability()`'s own formula or any of its existing callers, it just lays the same inputs out separately for admins: active+sellable physical-room count, physical-room blocks overlapping that date (cross-referencing `roomBlocks` — the room-block-to-availability link this section exists to demonstrate), confirmed vs. held commitments (cross-referencing live `roomAssignments`, not just the commercial `bookedCount`), the manual adjustment, and Stop Sell — ending at the same final number. `availability-inventory.html`'s detail card shows the simple view by default and only reveals this via an explicit **View Breakdown** toggle, per the "understandable without exposing a complicated formula by default" requirement.
- **No manual increase can out-run physical capacity.** `PG.activeSellablePhysicalCount(state, roomTypeId)` (active+sellable physical rooms of that type, independent of date) is the ceiling `availability-inventory.html`'s Adjust Inventory drawer checks an "increase" against — across every date in the selected range — before writing anything; a would-be violation blocks the whole save with an explanatory toast. "Decrease"/"Block"/"Restore" are never capped this way. Note the current seed data already has every room type's configured `sellable` at or above its physical cap (§4.6/§9's documented gap), so no "Increase" will succeed until physical capacity is raised first — that's the constraint working as intended, not a bug.
- **The Price Calendar never lets you type into the grid.** Clicking a cell opens a **Price Detail drawer** that first *explains* the number (room type, rate plan, date, pricing period, price source, the room type's base price) and only then offers actions: edit the named pricing period behind it, add a pricing period covering that date, or set a one-off price for that single cell. This is the §6.5 requirement that a price cell must open the rate plan and pricing period behind it — the user should never have to hunt for where a price came from.
- **One Pricing Period editor serves both create and edit.** Period name (required — it is how the period is found again later), start/end dates, day-of-week chips, a **Same Price for Selected Days / Different Price by Day** segmented control, the price input(s), and a live preview showing the resolved dates, weekdays, per-day prices, **how many nights the change affects**, the period's active/upcoming/expired state, and any overlap conflict *by name*. Save stays disabled until every validation passes, and revalidates against fresh state immediately before writing — a concurrent edit fails the save with the original period untouched. Per-day mode has Copy-first / Copy-to-weekdays / Copy-to-weekend / Clear helpers so nobody retypes the same number seven times.
- **Repricing never reaches an existing reservation.** See §4.4b's booked-price snapshot rule — this is the single most important invariant of this module, and `tests/rate-plans.test.js` guards it.
- **`PG.computePricing(state, roomCharges, refDate)` is the only place tax/fee math happens.** `new-reservation.html`'s `pricingBreakdown()` and `reservation-detail.html`'s `taxAmount()`/`feeAmount()` fallbacks and Edit-drawer recalculation all call it — there is no second hardcoded formula anywhere. A reservation's `taxAmount`/`feeAmount` are still a **stored snapshot** taken at creation/last-edit time (§4.3) so historical pricing never silently drifts when `state.taxesFees` changes later; only a fresh creation or an explicit Edit recalculates. `taxes-fees.html` has no delete action (Active/Inactive only, same convention as Physical Rooms) and its own "Example Pricing Breakdown" card is just `PG.computePricing()` called on a fixed $100 example — the same function, not a separate illustration.
- Every pricing-period change, rate-plan change, one-off price, inventory adjustment, Stop Sell/Reopen, and tax/fee change writes one structured `audit` entry (`'Pricing Period Created'`/`'Pricing Period Updated'`, `'Rate Plan Created'`/`'Updated'`/`'Activated'`/`'Deactivated'`/`'Deleted'`, `'Rate Changed'`, `'Inventory Adjusted'`, `'Stop Sell Applied'`/`'Inventory Reopened'`, `'Tax/Fee Changed'`) carrying module, record id, and previous→new values (§4.2) — consistent with every other mutation in this codebase.
- **A rate plan referenced by a reservation can be deactivated but never deleted.** The Rate Plans worklist checks `rooms[].ratePlanId` across every reservation; when anything depends on the plan, the Delete action is present-but-disabled with the reason, and the confirmation modal explains that deactivating is the correct move (it stops new sales while existing bookings keep their booked price).

### 8.6 Payments — key behaviors to preserve

- **Still exactly two payment methods (Pay on Arrival, Payment Link) and no separate `state.payments` collection.** A "payment" is still just the payment-related fields already on a reservation (`paymentMethod`, `paymentStatus`, `transactionRef`, `paymentLinkUrl`/`GeneratedAt`/`ExpiresAt`, `paymentPaidAt`) — `payments.html` is a worklist *view* over `state.reservations`, the same architecture the old version already used, just with more columns/filters and a drawer instead of a bare table.
- **`PG.generatePaymentLink()`, `PG.recordPaymentOutcome()`, and `PG.renderRecordRefundModal()`/`PG.recordRefund()` are the only places payment-link and refund mutations happen** — `reservation-detail.html`'s Payment section (Generate/Regenerate/Resend Link, Simulate Payment Success/Failed/Link Expired, Mark as Refunded) and `payments.html`'s Payment Details drawer (Generate/Resend Link, Record Refund) both call these instead of each maintaining its own copy of the field-setting logic. `generatePaymentLink`/`recordPaymentOutcome` take a `state`-shaped object and find-then-mutate the matching reservation *by reference* — callers on `reservation-detail.html` exploit this by passing `{reservations:[r]}` (its own already-loaded, already-`save()`-bound reservation object) rather than a full state, so the existing `save()`/hold-sync/reload plumbing there is untouched.
- **Refunds are still full-only: `Refund Pending` → `Refunded`, nothing else.** `PG.recordRefund()` throws if the reservation isn't currently `Refund Pending`, so `renderRecordRefundModal()` — the *only* supported entry point, both pages route "Mark as Refunded"/"Record Refund" through it — can't be used to invent a refund out of thin air. It shows the original payment (method + transaction ref) and amount, requires a typed reason (blocked client-side and re-toasted if empty), states plainly that this prototype has no real payment gateway and is only recording the outcome, and on confirm writes one `activity` entry on the reservation *and* one `audit` entry (`'Refund Recorded'`) — never just one or the other.
- **The Payment Details drawer's Timeline is sourced from the reservation's own `activity[]`**, filtered to payment-related text (`paymentTimeline()`) — not a fabricated/separate event log. There is deliberately no "Opened" step anywhere: this prototype has no link-click tracking to source one from, so it simply never appears rather than being invented. Failure/expiry reason is likewise just the matching real `activity` entry, not a structured field that doesn't exist.
- **Dashboard payment exceptions** (`index.html`'s alert loop) cover Payment Link Expiring-soon (≤6h, existing), Failed (existing), and three additions — **Expired** (every one, not deduped, since it's already a rare terminal state), **Refund Pending** (every one — these need action), and **Payment Required** older than 24h (age-gated and `dedupeKey`'d like the existing Stale Draft alert, so a reservation that simply hasn't had its link generated yet in the last few minutes doesn't clutter the list). All payment alerts link to `payments.html?id=<reservationId>`, which opens straight to that reservation's Payment Details drawer.
- **The Operations Calendar was already correctly scoped here and needed no change**: `openReservationDrawer()` already shows the full `PG.payBadge(res.paymentStatus)` in its Payment section, and bars themselves only ever carry a small warning icon for the `Failed`/`Expired`/`Refund Pending` exception set (`payException` in `renderBarHtml()`) — full status detail lives in the drawer, never crowding the bar itself.

### 8.7 Reports and Saved Views — key behaviors to preserve

- **Three report *hubs*, ten reports, no tenth/eleventh HTML file.** `reservation-reports.html` (Arrivals, Departures, Reservations by Status, Cancellations and No Shows, Unassigned Reservations), `inventory-reports.html` (Occupancy, Room Availability and Utilization, Blocked Rooms), and `payment-reports.html` (Revenue Summary, Payments by Status) each render a card grid at the top; clicking a card swaps which report renders below (filters + KPI tiles + an operational table) in the same card — there's no separate route per report. This is deliberate: "lightweight MVP reports," not a BI product with a page per metric.
- **Every report reads directly from `PG.getState()`** the same way every other page does — there is no separate reporting datastore, cache, or precomputed rollup, so a report is never stale relative to the rest of the app and always agrees with what `payments.html`/`reservations.html`/`physical-rooms.html` show for the same records.
- **`PG.exportCsv(filename, headers, rows)`** is the one CSV export implementation every report's "Export CSV" button calls — it isn't a real download in every environment (relies on a `Blob` + `<a download>` click), consistent with this being a static prototype rather than a server-backed export pipeline.
- **"Unassigned Reservations" is a diagnostic report, not a UI concept.** It lists any active reservation item with fewer physical-room assignments than its quantity — the same self-heal condition Reservation Detail already flags as "Needs Attention" (§4.7) — and its own copy states plainly this should always be empty in normal operation. It is **not** a lane, filter, or status anywhere else, and must never be treated as license to reintroduce one (§4.7, §9).
- **Every report's filters include a disabled single-option Property selector** (this pilot has one property, no switcher — same convention as the header's property pill) and a date range where relevant; no report has an amount-range filter, since that capability doesn't exist anywhere else in the app and wasn't invented here either.
- **Saved Views on the Dashboard are just links with query params**, not a new saved-view feature: `reservation-reports.html?report=arrivals&from=&to=`, `?report=departures&from=&to=`, `?report=unassigned`, `payments.html?status=Issues` (a new pseudo-status meaning Failed ∪ Expired ∪ Refund Pending, handled in `filteredRows()` alongside the existing "Payment Required" ∪ "Link Sent" grouping), and `inventory-reports.html?report=blocked&from=&to=`. Every report page reads `?report=`/`?from=`/`?to=`/`?status=` on load and calls the same `selectReport()`/`render()` a card click would. Custom user-created saved views were deliberately not built (see §11) — the five predefined ones above are what was asked for.

---

## 9. Known issues / deliberate simplifications (read before "fixing" these)

- ~~**`ratePlans` vs. `rates` calendar duplication.**~~ **RESOLVED.** Rate plans and the per-date calendar are now one model: a plan's *named pricing periods* price the dates, and the `rates` calendar became the base-price fallback layer beneath them. `PG.resolvePrice()` is the single source of truth and `PG.rateFor()` is a shim over it. See §4.4b. The rate-plan dropdown in New Reservation now shows the *actual* resolved price, not a decorative flat number.
- **Family Room has no "Flexible + Breakfast" rate plan** — only "Weekend Rate" (`$150`). The Guided Journey's Step 7 text says "Family Room — Flexible + Breakfast" but the actual rate plan name shown will be "Weekend Rate". Numbers are correct; only the plan *label* doesn't match the illustrative example text. Known and accepted.
- **Reservation dates are reservation-level, not per-item** (§4.3, rule 3) — intentional MVP simplification, do not "fix" without discussion.
- **Occupancy is derived, not stored as a user preference** — if a room type's `maxAdults`/`maxChildren` changes after a reservation was made, existing reservations keep their originally-computed occupancy (correct — it's a snapshot, not a live join).
- **No login/auth/role-switcher UI** — `CURRENT_ROLE` is a hardcoded constant (§5.3).
- **`physicalRooms` active+sellable counts still don't always numerically equal `roomTypes[].sellable`** — the two inventory layers aren't unified into one source of truth (§4.6).
- **No "Unassigned" state exists anywhere, by design (§4.7).** An earlier iteration briefly had one (a calendar lane, an Assigned/Unassigned filter, an "Unassign Room" action, a legend item, seed data with a roomless reservation) — it was a genuine misread of the intended business rule and was completely removed, including migrating the one seed reservation that had no room (`RES-10248` now holds `std-103`). **Do not reintroduce this without an explicit, unambiguous instruction.**
- **Legacy/pre-correction `localStorage` data could still have a roomless active reservation item** if it was saved before the above correction shipped. Every relevant screen treats that as a "Needs Attention" self-heal case with an "Assign Room" action — never a separate "unassigned" label or lane.
- **Block Room's conflict check treats "Held" and "Assigned" assignments the same** — both block a new room block from saving. A future prompt may want holds to be overridable while confirmed assignments stay hard blocks.
- **Room-assignment preferences are minimal by design** — only "Requires Wheelchair Accessible Room" (hard filter), a bed configuration dropdown, and "Request Connecting Rooms" (soft ranking preferences) exist in New Reservation. Extend `item.requireAccessibility` from a bool to a list if a future prompt asks for more attribute types.
- **The connecting-pair heuristic (`PG.findConnectingPair()`) is a simple pairwise scan**, not a general solver — it only ever tries to seat one connected pair per item; for qty>2 with connecting requested, remaining units are filled by normal ranking regardless of connectivity.
- **Operations Calendar's density is a single "balanced operational" mode** — a comfortable/compact toggle was explicitly skippable (no existing table-density pattern to reuse) and wasn't built.
- **GitHub Pages caches aggressively** and the `serve` dev server caches 301 redirects in the browser's HTTP cache — see §2.2 for the workaround.
- **Browser-automation quirk (dev environment only):** the Claude Browser preview tool's `computer` (screenshot) action is flaky in this sandbox and frequently times out with "the Browser pane is not displayed". Prefer `javascript_tool`-based DOM/state assertions over screenshots when verifying UI changes in an agent session — they're reliable; screenshots are not.

---

## 10. Working conventions established over this project (please follow them)

1. **Always run a syntax check before considering a change done.** Extract each modified file's inline `<script>` content via a small Node one-liner and run `node --check`/`new Function(code)` on it (and always `node --check` on `assets/js/app.js` directly). Catches typos before they ever hit the browser.
2. **Verify in the actual browser, not just by reading the code.** Use the `Claude_Browser` MCP tools (`preview_start` with the `hotel-prototype` launch config, then `navigate` + `javascript_tool` to assert real DOM/state). Always `localStorage.clear()` at the start of a test pass to get clean seed data, and again at the end before committing, so the repo's live demo always starts from a clean, seeded state.
3. **One commit per logical change, pushed immediately**, with a detailed commit message explaining *why*, not just *what* (see `git log` — messages are intentionally thorough, since they double as a changelog). Never batch unrelated fixes into one commit if avoidable.
4. **Minimum-footprint edits.** Use the `Edit` tool for targeted changes; only rewrite a whole file with `Write` when the change is genuinely pervasive throughout that file.
5. **When the user reports a bug, find the actual root cause before patching symptoms.** Several "simple" bug reports have turned out to share one root cause. Investigate with `Grep`/`Read` before guessing.
6. **Preserve everything not explicitly touched.** This project has accumulated a lot of interlocking detail across many prompts — never regenerate a whole page "for consistency" unless asked; targeted edits only.
7. **No emojis, no unnecessary comments in code.** Comments are reserved for non-obvious *why* (see the date-handling and custom-select gotcha comments in `app.js` as the model to follow).
8. **This README should be kept up to date.** If you make a structural change (new shared component, new state field, new convention, new page), update the relevant section here in the same commit.
9. **Pure engine logic gets simulated unit tests under `tests/`**, run with plain Node (no test framework, no build step):

   ```bash
   node tests/room-assignment.test.js && node tests/rate-plans.test.js
   ```

   Each loads `assets/js/app.js` into a `vm` sandbox stubbing `window`/`localStorage` (app.js is a browser IIFE, not a CommonJS module) and asserts against `PG.*` directly. One file per engine — extend the matching file rather than inventing a third test convention. `rate-plans.test.js`'s Test 9 is the load-bearing one: it reprices every rate plan and wipes the base calendar, then asserts all four seeded reservation totals are unmoved. **If that test ever fails, a booked price is leaking — fix the leak, don't relax the test.**
10. **A recurring pitfall in "permission-gate then init()" pages:** `function init(){}` declarations are hoisted, so calling `init()` early doesn't throw — but any `var CONST = [...]` declared *after* that call is still `undefined` when `init()` actually runs (only the declaration is hoisted, not the assignment). This has caused a silent `Cannot read properties of undefined` crash twice already (`physical-rooms.html`, `operations-calendar.html`). **Always place the `if (!CAN_MANAGE) {...} else { init(); }` gate as the very last thing in the script**, after every top-level `var`/`function` the init path depends on.

---

## 11. Suggested next steps (not yet requested, but foreseeable)

Based on the nav structure already wired in but not yet built:

- `hotels.html` — a Platform Super Admin-only tenant list (would need `CURRENT_ROLE` toggled to `"Platform Super Admin"` to view/test).
- Custom, user-created saved views (beyond the five predefined ones in §8.7) — deliberately deferred as out of MVP scope when the Reports/search work was built.

Do not build these speculatively — wait for the corresponding prompt, per the user's own stated sequencing.

---

## 12. Quick-start checklist for a new chat session

1. Read this file in full.
2. `git log --oneline` to see the exact chronological history (commit messages are detailed changelogs).
3. Read `assets/js/app.js` top-to-bottom once — it's the single source of truth for data shape, shared components (`PG.render*Drawer`, badges, date helpers), and navigation.
4. Check the live site (`https://eyad-tritecs.github.io/Hotel-Platform/`) to see current real-world state, or run locally per §2.1.
5. Run `node tests/room-assignment.test.js && node tests/rate-plans.test.js` to confirm both engines are passing before you start (expect 19 and 48).
6. Before changing anything, check §9 (known issues/deliberate simplifications) so you don't "fix" something that was a deliberate decision — and re-read the **"no Unassigned state" invariant in §4.7** specifically, since it has been accidentally reintroduced once already.
