# Product Requirements Document — @48 (Bengaluru Edition)

**Product:** @48 — Group Road-Trip Planning & Feasibility Hub (Bengaluru Edition)  
**Tagline:** The Weekend Reality Checker  
**Version:** 2.0 — Production Release (Controlled Pivot & Final UX Sprint) | **Date:** 25 October 2026  
**Status:** Shipped and Verified Live on Production (`https://at48.vercel.app`)  
**Repository:** `at48` | **Package:** `at48-web` | **Deployment:** Vercel (Auto-deployed from `main`)  
**Lead Rollback Baseline:** Commit `e4a0f8e` (Gate 4) / `94d0ece` (Initial Baseline)  

---

## 1. Problem and Value Proposition

Bengaluru residents planning self-drive weekend getaways frequently encounter deceptive travel expectations. Standard navigation tools show best-case, point-to-point drive times that ignore origin traffic delays, essential highway breaks, check-in delays, attraction operating windows, and firm return deadlines. A trip that appears feasible on paper often results in rushed driving, arriving after attraction gates close, or exhausting Sunday night returns.

Furthermore, coordinating road trips within private friend groups is plagued by disjointed chat threads, conflicting arrival expectations, and lack of clear itinerary consensus before booking.

**Target User:** Bengaluru weekend road travelers, organizers, and friend groups planning a short self-drive escape.  
**Value Proposition:** Deterministic, constraint-aware reality checking that compares four weekend escapes by usable free time and return deadlines, integrates verified highway stops and interactive route mapping, and enables seamless WhatsApp group invitation and RSVP without accounts or backends.  
**Differentiator:** Objective, math-grounded constraint modeling—not algorithmic crowd recommendations, opaque AI chat summaries, or live traffic forecasts.

### Anchor User Story (Lead Research Case)
Sujil, a 29-year-old fitness trainer living in Kasavanahalli, leaves Bengaluru on Saturday morning after a work session (~8:30 AM). Driving toward Coorg, standard navigation estimates 5.5 hours, but origin city crawl (+45m) and stops cause arrival after Abbey Falls' 5:00 PM entry cutoff. Similar documented pain points include Bandipur night-traffic curfews (Roshan) and late Sunday returns from Mysuru (Kiran).

**Job-to-be-Done:**  
> *"When our crew wants to escape Bengaluru for the weekend with fixed departure and return deadlines, give us an honest reality check on where we can realistically go, show us our true usable free time after driving and stops, and let me share the plan with my friends so everyone can RSVP in one click."*

---

## 2. Information Architecture & Four-Screen User Journey

The application is architected as a lightweight, mobile-first Single Page Application (SPA) with 4 focused screens and pure URL-based state sharing:

```
Screen 1: Plan (/)
      │
      ▼
Screen 2: Compare (/compare)
      │
      ▼
Screen 3: Schedule & Route Map (/schedule/:id) ◄── [Direct Guest Invitation Link]
      │                                                     │
      ▼                                                     ▼
Screen 4: Review & Share (/review/:id)              [WhatsApp Guest RSVP]
      │
      ▼
[Shareable Invitation URL / WhatsApp Plan Summary]
```

### Screen 1 — Plan (`/`) [Step 1 / 4]
- **Inputs:** Organizer display name (optional, max 40 chars), planning mode (**Private Group** vs. **Solo Trip**), departure date/time, latest return date/time, travel pace (**Relaxed**, **Balanced**, **Packed**), and budget cap per person (**₹3,000 / ₹6,000 / ₹10,000**).
- **Positive Roadmap Messaging:** Welcoming message box (*"Big adventures are on our roadmap! For now, @48 helps you plan realistic short escapes lasting 18 to 60 hours."*).
- **Validation:** Enforces 18.0 to 60.0 hours trip window in Indian Standard Time (IST, UTC+05:30). Rejects inverted or out-of-range dates with actionable guidance.
- **Primary CTA:** *Run Reality Check →* (navigates to `/compare`).

### Screen 2 — Reality Check & Destination Comparison (`/compare`) [Step 2 / 4]
- **Baseline Disclosure:** Prominent disclosure explaining driving estimates originate from MG Road, Bengaluru as the reference point.
- **Four Curated Escapes:** Nandi Hills (NH 44), Mysuru (NH 275 Expressway), Coorg / Madikeri (NH 275), and Ooty (NH 275 / NH 766 / Bandipur).
- **Verified Photographic Hero Cards:** Location-verified photographs with fixed 16:9 aspect ratio, lazy loading, and Creative Commons attribution pills.
- **Independent Driving Controls:** Each destination card features an independent driving offset stepper (**−60 to +120 minutes in 15-minute increments**) to model starting outside central Bengaluru without altering other destination estimates.
- **Key Metrics Displayed:** Round-trip driving time, usable destination free time (`destinationSlackMinutes`), return deadline margin (`returnDeadlineMarginMinutes`), estimated cost per person, and feasibility rating badge (**Comfortable**, **Tight**, **Not Recommended**).
- **Primary CTA per card:** *View Timeline →* (navigates to `/schedule/:id`).

### Screen 3 — Stop-Aware Timeline & Interactive Map (`/schedule/:id`) [Step 3 / 4]
- **Planned Stay Zone:** Informational badge indicating modeled stay area (e.g. Central Mysuru, 1:00 PM check-in modeled).
- **Interactive Trip Map:** Mobile-first Leaflet map using OpenStreetMap tiles with custom SVG CircleMarkers for Origin (MG Road, green), Destination (blue), Attractions (purple), and Pitstops (orange). Clean touch handling with explicit zoom controls.
- **Curated Highway Pitstops:** Verified stops along the corridor (e.g., **Maddur Tiffanys** on Bengaluru–Mysuru Expressway / Old NH 275, OSM node #14076079701). When selected, dynamically inserts an explicit `PITSTOP` timeline block, schedules 30m dwell + 10m detour, substitutes redundant hotel arrival lunch, and updates destination slack and return margin without double-counting travel buffers.
- **Itinerary Controls:** +1-hour outbound departure delay simulation checkbox; toggle optional attractions (e.g., Devaraja Market Walk) with instant timeline recalculation.
- **Chronological Timeline:** Day 1 and Day 2 chronological breakdown with place thumbnails, duration badges, operating hour checks, and overnight rest modeling.
- **Guest Invitation Tray:** Displays organizer invitation header (*"Sujil invited you to a road trip to Mysuru!"*) and instant WhatsApp RSVP button when visited via share link.
- **Primary CTA:** *Review My Trip →* (navigates to `/review/:id`).

### Screen 4 — Review & Share Hub (`/review/:id`) [Step 4 / 4]
- **Section A (Trip Overview):** Hero photograph with destination overlay, organizer metadata, party size, travel pace, target budget, and departure/return window.
- **Section B (Route & Planning Assumptions):** Driving corridor details, origin driving offset disclosure, selected highway pitstop badge with dwell/detour details, and planned attraction chips.
- **Section C (Feasibility Verdict):** Big-type verdict card with usable free time, return margin, expected home arrival timestamp, estimated total and per-person cost, and route/operating hour advisories.
- **Section D (Trip Summary Preview):** Plain-text monospace summary box with one-click copy button, formatted specifically for mobile messaging.
- **Section E (Social Sharing & Actions Tray):**
  - Primary CTA: *Share Trip With Friends (Copy Link)* — copies compact invitation URL (`/schedule/:id?...`).
  - *WhatsApp Invite* — opens WhatsApp with pre-filled invitation text and direct link.
  - *Copy Summary Text* — copies full itinerary text to clipboard with toast confirmation.
  - *WhatsApp Summary* — opens WhatsApp with full itinerary text.
  - Secondary Back Link: *← Edit My Trip (return to Screen 3)* — preserves all customized stops, delays, and adjustments.

---

## 3. Feasibility Engine & Mathematical Contract

All scheduling calculations are strictly deterministic pure TypeScript functions executed in `Asia/Kolkata` time (IST, UTC+05:30) with zero external API dependencies.

### Time Metrics
- **`destinationSlackMinutes`:** Total unallocated usable leisure time spent at the destination across daytime visiting hours, excluding driving, mandatory meals, hotel check-in (30m), scheduled attractions, local transfers, and overnight rest (10:00 PM – 7:00 AM).
- **`returnDeadlineMarginMinutes`:** User's firm return deadline timestamp **minus** computed home arrival time. A positive value indicates a safety buffer; a negative value flags a missed deadline.
- **Driving Leg Computation:**
  $$\text{LegDuration} = (\text{BaselineMinutes} + \text{DrivingAdjustment}) \times 1.20$$
  The 20% contingency is a planning buffer for highway friction, fueling, and minor traffic. It is never double-counted when explicit pitstops are added.
- **Pitstop Modeling:**
  $$\text{Leg 1 Duration} = (\text{BaselineMinutes} \times \text{CorridorSplitRatio} + \text{DrivingAdjustment}) \times 1.20$$
  $$\text{Stop Dwell \& Detour} = \text{DwellMinutes} + \text{DetourMinutes}$$
  $$\text{Leg 2 Duration} = (\text{BaselineMinutes} \times (1 - \text{CorridorSplitRatio})) \times 1.20$$
  When a meal stop is selected, redundant arrival lunch allowances are automatically deducted from destination dwell time.

### Supported Window (18–60 Hours) vs. Engine Horizon
- **Supported Input Window:** Screen 1 accepts departure and return deadlines between 18.0 hours (minimum realistic overnight escape) and 60.0 hours (extended long-weekend window).
- **Engine Horizon:** The deterministic itinerary models a classic 2-day weekend structure (Day 1 outbound & activities + Day 2 activities & return). Trips up to 60 hours are evaluated against the firm return deadline, with extra hours beyond Day 2 night appropriately credited to return deadline margin and available unallocated time.

### Feasibility Verdicts
- **Comfortable (Green):** Zero hard blockers, `destinationSlackMinutes` ≥ 120 min, and `returnDeadlineMarginMinutes` ≥ 120 min.
- **Tight (Amber):** Zero hard blockers, non-negative margins, but either slack or return margin is under 120 min.
- **Not Recommended (Red):** Negative return margin (home arrival exceeds deadline), mandatory attraction cannot fit across both days, or unresolvable route curfew.

### Bandipur / Ooty Corridor Rules
- Checkpoint crossing offsets modeled at T+270m outbound and T+90m inbound.
- Evaluated against the 9:00 PM – 6:00 AM national park closure. Flags explicit `BANDIPUR_CURFEW` warning if estimated passage conflicts with closure hours.

---

## 4. Technical Architecture & URL-Based State

### Client-Side Architecture
- **Framework:** React 19 + TypeScript + Vite 7 + Tailwind CSS v4.
- **Mapping:** Leaflet 1.9 + React Leaflet 5 + OpenStreetMap tile layer (no paid API keys or geolocation tracking required).
- **Zero Backend / Zero Authentication:** No database, cookies, or user tracking. Trip state is completely encoded into compact query parameters.

### URL Schema & State Serialization
Shareable invitation links use the format:
```
https://at48.vercel.app/schedule/:id?org=:organizer&mode=:mode&dep=:iso&ret=:iso&pace=:pace&budget=:int&adj=:int&delay=:0|60&stops=:stopId,...&skip=:actId,...
```
- Fully validated on initial load with fallback to defaults if parameters are corrupted or invalid.
- Cross-compatible between `/schedule/:id` (guest RSVP view) and `/review/:id` (organizer snapshot view).
- Generates clean WhatsApp intent links (`https://api.whatsapp.com/send?text=...`) for instant cross-platform group coordination.

---

## 5. Quality Assurance & Production Verification

- **Automated Vitest Suite:** 63/63 passing tests across 6 suites covering scheduler regression, pitstops, formatters, map pins, URL sharing, and UX sprint features.
- **Offline Engine Smoke Tests:** 11/11 passing tests in headless Node (`test:engine:offline`).
- **Production Build:** `tsc -b && vite build` completes in ~3.0s with 0 TypeScript errors and 0 Vite warnings.
- **Dependency Audit:** `npm audit --omit=dev` confirms 0 vulnerabilities.
- **Cross-Device QA:** Verified on Google Chrome (Desktop 1280px) and Mobile Viewport (360px) with zero horizontal overflow, full touch target accessibility, and active image fallbacks.
- **Deployment:** Live on Vercel at `https://at48.vercel.app` backed by GitHub repository `Midhun-Ravi/at48` on `main`.

---

## 6. Known Scope Boundaries & Next Steps

### Deliberate Non-Features (Maintained Out of Scope)
- No user authentication, accounts, or persistent cloud database.
- No live GPS location tracking or real-time traffic scraping.
- No payment gateway or direct hotel/activity booking.
- No real-time multi-user socket synchronization (replaced by pure WhatsApp share/RSVP).

### Remaining Pre-Submission Work
1. Real-user usability testing (3–5 diverse participants).
2. Compilation of user feedback logs and recorded friction points.
3. 10-slide executive pitch deck beginning with Sujil's Kasavanahalli user story.
4. Submission to HelloPM before October 26, 2026, 11:00 PM IST.
