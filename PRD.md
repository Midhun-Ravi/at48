# Product Requirements Document — @48 (Bengaluru Edition)

**Tagline:** The Weekend Reality Checker  
**Version:** 1.1 — Locked Buildathon MVP | **Date:** 23 October 2026  
**Status:** Product requirements approved; implementation, data verification, and user testing pending  
**Repository:** `at48` | **Package:** `at48-web` | **Deployment:** Vercel

## 1. Problem and value proposition

Bengaluru residents planning short self-drive weekend trips often compare destinations using point-to-point drive times without accounting for late departures, travel uncertainty, stops, rest, attraction operating windows, and a firm return deadline. A trip that looks achievable can leave little useful leisure time or make a must-visit attraction impossible.

**For:** Bengaluru weekend road travelers with a fixed departure and return window.  
**@48 helps them:** compare four destinations by a transparent, adjustable time budget and see how a delay or removed activity changes the plan.  
**Differentiator:** A constraint-aware, interactive *reality check*—not generic attraction recommendations or live traffic forecasting.

**Lead research case:** Sujil, a 29-year-old fitness trainer in Kasavanahalli, reported leaving Bengaluru around 8:30 AM after Saturday work and reaching Abbey Falls too late to enter during a Coorg trip. Additional reported cases concern a Bandipur route restriction (Roshan) and late return from Mysuru (Kiran). Preserve interview notes and participant consent; these are user-reported experiences, not independently verified event records.

**Job-to-be-Done:** “When I can only leave after work and must be home by Sunday evening, help me decide whether a weekend destination and its activities fit, so I avoid a rushed or wasted trip.”

## 2. One journey and MVP scope

**Flow:** Enter constraints → Compare destination feasibility → Inspect and adjust a two-day plan → Copy/share or open the route.

**Four curated destinations:** Nandi Hills, Mysuru, Madikeri (Coorg), Ooty. Reference travel estimates start at **MG Road, Bengaluru**, use a declared route, and are *planning estimates*, not live traffic data. Each destination/activity record must retain its estimate or opening-hour source, verification date, and assumptions.

**P0:** Three mobile-first screens; date/time constraints; relaxed/balanced/packed pace where the setting has a real scheduling effect; per-person budget presets; four destination comparisons; adjustable one-way driving estimate; deterministic two-day schedule; attraction-window checks and Day 2 rollover; explicit free-time and return-margin metrics; a +60-minute outbound delay scenario; optional-activity removal; budget warning; Maps link; copyable summary; public Vercel deployment.

**Not in MVP:** Login, saved accounts, live traffic/GPS, user-generated destinations, travel bookings, payments, chat assistant, drag-and-drop editing, real-time pricing, nationwide search, notifications.

## 3. Screens

**Screen 1 — Plan (`/`)**  
Select departure and latest return *date and time* (default: upcoming Saturday 8:00 AM and Sunday 8:30 PM, IST), pace, and per-person budget cap (**₹3,000 / ₹6,000 / ₹10,000**). Show **MG Road baseline** prominently. Reject invalid or reversed date ranges. **Primary action:** *Run Reality Check*.

**Screen 2 — Compare (`/compare`)**  
Show four destination cards with estimated one-way and round-trip driving, `destinationSlackMinutes`, `returnDeadlineMarginMinutes`, estimated cost/person, feasibility explanation, and budget warning. Let the user adjust the reference **one-way** drive by **−60 to +120 minutes in 15-minute steps** (including Sujil's +45-minute scenario). Recompute results immediately. **Primary action per card:** *View Timeline*.

**Screen 3 — Timeline (`/schedule/:id`)**  
Show dated Day 1/Day 2 chronological blocks (drives, breaks, meals, check-in, activities, local transfers, overnight rest, available time). Provide a **+1-hour outbound-delay toggle** and simple **remove/restore optional activity** controls. Show why an activity cannot fit, a return-time warning, and applicable route advisories. **Primary action:** *Copy WhatsApp Summary*. Secondary link: *Open Route in Google Maps*.

## 4. Engine contract and feasibility

Use pure, tested TypeScript functions and explicit `Asia/Kolkata` time handling; do not rely on the browser's local timezone.

- **`destinationSlackMinutes`:** Unallocated *usable* time at the destination after scheduled activities, local travel, meals/check-in and rest; exclude unusable overnight time. This is **not** the difference between the return deadline and arrival home.
- **`returnDeadlineMarginMinutes`:** User's latest acceptable home-arrival time **minus** computed home-arrival time. Negative means late.
- **Driving:** Start with a sourced baseline for each direction, apply the user's driving adjustment, then a **20% driving-time contingency** (a declared planning assumption, *not* a verified traffic forecast). The +60-minute scenario is an additional outbound delay. Account for stops separately and avoid double-counting.
- **Activities:** Validate the **entire visit interval**, including any published last-entry rule; wait until opening if needed. If a required visit will not fit on Day 1, attempt Day 2 before declaring a blocker. Skip or flag optional activities explicitly. Respect meals, travel between stops, minimum overnight rest, and the return deadline. Recalculate the actual schedule whenever a control changes.
- **Ooty / Bandipur:** Model provisional checkpoint crossing offsets of **T+270 minutes outbound** and **T+90 minutes inbound**, measured from the start of the relevant driving leg. These are **unverified planning offsets**. Surface a **potential night-curfew advisory** when estimated crossing conflicts with the published restriction; do **not** claim a verified restriction breach from unverified offsets. A verified crossing model can promote this to a blocker.
- **Feasibility:** **Comfortable** = no hard blockers, destination slack ≥120 min, and return margin ≥120 min. **Tight** = no blockers, both metrics nonnegative, but one below 120 min. **Not Recommended** = negative return margin, required attraction impossible across both days, or confirmed hard route violation. Thresholds are MVP assumptions, not scientifically calibrated fatigue scores. Clearly explain which condition determines the result.
- **Budget:** Default **two travelers sharing one vehicle and one room**. `estimatedTripTotalINR = roundTripFuel + roundTripTolls + oneNightStay + (ticketCostPerPerson × partySize)` (plus any other explicitly included expense). `costPerPerson = estimatedTripTotalINR / partySize`. Compare with the selected per-person cap and show a **non-blocking `BUDGET_OVERRUN`** warning. Disclose excluded costs (e.g., meals) and that estimates are not live quotes. Fuel, tolls, and lodging figures require sources or visibly declared assumptions; the **20% drive-time buffer does not inflate costs automatically**.

## 5. Technical delivery

**Stack:** React + Vite + TypeScript + Tailwind CSS; client-side state, curated TypeScript data, no database or authentication. **GitHub:** `at48`, approved document committed as root `PRD.md`. **Vercel:** public deployment with single-page-app fallback for direct routes and refreshes. Public branding and metadata use **@48 — The Weekend Reality Checker**; npm package identifier uses `at48-web`.

## 6. Acceptance tests / definition of done

1. User inputs produce a valid two-day itinerary in IST; invalid date ranges show actionable errors.
2. The **Sujil** 8:30 AM departure with **+45 minutes** adjustment generates a *computed* Coorg schedule; an Abbey Falls conflict is shown only if the complete visit cannot fit on either day. Do not hard-code an expected red badge.
3. A visit beginning before closing but ending after closing is rejected/rescheduled; last-entry rules are applied if verified.
4. Adding +60 minutes of outbound delay propagates through downstream entries and recalculates both time metrics and the rating.
5. Removing an optional activity increases usable free time; the return margin changes **only when the return leg is actually rescheduled**.
6. A trip missing the user's return deadline is flagged **Not Recommended**. Budget overrun is a separate non-blocking warning.
7. Bandipur warnings distinguish *assumed crossing estimates* from verified hard restrictions.
8. All destination data has visible provenance; automated engine tests and production build pass.
9. The full journey works at **375px** mobile width, on desktop, in incognito, and after direct-route refresh; buttons, Maps URLs and copy action function.
10. Three to five independent people complete usability tests; feedback, friction and at least one resulting product change are recorded honestly.

## 7. Success, go-to-market, and submission

**Activation target (not yet measured):** first understandable feasibility verdict in **under 60 seconds**. **Engagement target (not yet measured):** **≥70%** of test users try a feasibility control. Track independent task completion, comprehension, schedule errors, and trust in assumptions. Guardrail: no unsupported live-traffic or opening-hour claim.

**First users:** direct invitations to known Bengaluru road travelers, friends/colleagues and HelloPM peers. **Referral:** WhatsApp-shareable plan. **Retention hypothesis:** use again when planning another short trip. **Potential future revenue:** relevant stay/activity affiliate commissions; no monetization in MVP.

**HelloPM deadline:** **October 26, 2026, 11:00 PM IST.** Submit a public Vercel link, GitHub source with this PRD, ~10-slide PDF pitch deck beginning with an evidence-backed user story, and **3–5 real user-test records with documented iteration**. Judge against seven 5-point pillars: problem clarity, scope, working product, UX, innovation, helpfulness, demo/GTM.

**Status:** Scope approved. Source verification, implementation, tests, deployment and user feedback are not complete until evidenced.
