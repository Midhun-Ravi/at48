import type { Destination, Evidence } from '../types';

const ASSUMPTION = (note: string): Evidence => ({ level: 'assumption', note });
const OFFICIAL = (sourceUrl: string, note?: string): Evidence => ({
  level: 'official', sourceUrl, checkedOn: '2026-10-24', note,
});

// IMPORTANT: drive times/distances and all prices below are DECLARED PLANNING
// ASSUMPTIONS inherited from PRD; NOT traffic API results or live quotes.
// Attraction opening hours marked official were checked against the linked source.
export const DESTINATIONS: Destination[] = [
  {
    id: 'nandi-hills', name: 'Nandi Hills', oneWayDistanceKm: 62,
    baselineOneWayDriveMinutes: 105, routeName: 'NH 44 / Bellary Road',
    drivingEvidence: ASSUMPTION('105 min MG Road one-way planning baseline; check Maps before travel.'),
    approximateRoundTripFuelINR: 1200, approximateRoundTripTollsINR: 230,
    approximateOneNightStayINR: 3500,
    pricingEvidence: ASSUMPTION('Fuel, toll and one-night stay are illustrative INR estimates, not live quotes.'),
    activities: [
      {
        id: 'nandi-viewpoint', name: 'Nandi Hills Viewpoint', durationMinutes: 120,
        openTime: '06:00', closeTime: '18:00', costPerPersonINR: 20,
        isOptional: false, priority: 1, localTransferMinutes: 15,
        openingHoursEvidence: OFFICIAL('https://karnatakatourism.org/en/attractions/nandi-hills/', 'Tourism site lists 06:00–18:00.'),
        costEvidence: ASSUMPTION('₹20 used as illustrative ticket; check current fee.'),
      },
      {
        id: 'nandi-temple', name: 'Bhoga Nandeeshwara Temple', durationMinutes: 60,
        openTime: '06:00', closeTime: '19:00', costPerPersonINR: 0,
        isOptional: true, priority: 2, localTransferMinutes: 30,
        openingHoursEvidence: ASSUMPTION('Hours not verified for this release.'),
        costEvidence: ASSUMPTION('Assumed free entry; verify before travel.'),
      },
    ],
  },
  {
    id: 'mysuru', name: 'Mysuru', oneWayDistanceKm: 145,
    baselineOneWayDriveMinutes: 195, routeName: 'NH 275 / Bengaluru–Mysuru Expressway',
    drivingEvidence: ASSUMPTION('195 min MG Road one-way planning baseline; route is not a live ETA.'),
    approximateRoundTripFuelINR: 2800, approximateRoundTripTollsINR: 660,
    approximateOneNightStayINR: 3800,
    pricingEvidence: ASSUMPTION('Fuel, toll and stay estimates from planning draft; not live quotes.'),
    activities: [
      {
        id: 'mysuru-palace', name: 'Mysore Palace', durationMinutes: 150,
        openTime: '10:00', closeTime: '17:30', lastEntryTime: '17:00',
        costPerPersonINR: 120, isOptional: false, priority: 1, localTransferMinutes: 30,
        openingHoursEvidence: OFFICIAL('https://karnatakatourism.org/en/attractions/mysuru-palace/', '10:00–17:30; last entry 17:00.'),
        costEvidence: ASSUMPTION('Tourism page contains conflicting fee figures; ₹120 is a provisional planning estimate.'),
      },
      {
        id: 'mysuru-market', name: 'Devaraja Market Walk', durationMinutes: 60,
        openTime: '09:00', closeTime: '20:00', costPerPersonINR: 0,
        isOptional: true, priority: 2, localTransferMinutes: 30,
        openingHoursEvidence: ASSUMPTION('Market visit 09:00–20:00 is a planning window, not verified official hours.'),
        costEvidence: ASSUMPTION('Free walk; purchases excluded.'),
      },
    ],
  },
  {
    id: 'coorg-madikeri', name: 'Coorg / Madikeri', oneWayDistanceKm: 252,
    baselineOneWayDriveMinutes: 345, routeName: 'NH 275 via Mysuru and Kushalnagar',
    drivingEvidence: ASSUMPTION('345 min one-way MG Road planning baseline; not real-time traffic.'),
    approximateRoundTripFuelINR: 4800, approximateRoundTripTollsINR: 660,
    approximateOneNightStayINR: 4500,
    pricingEvidence: ASSUMPTION('Fuel, toll and stay are illustrative estimates.'),
    activities: [
      {
        id: 'coorg-abbey', name: 'Abbey Falls', durationMinutes: 90,
        openTime: '09:00', closeTime: '17:00', costPerPersonINR: 50,
        isOptional: false, priority: 1, localTransferMinutes: 30,
        openingHoursEvidence: OFFICIAL('https://karnatakatourism.org/en/attractions/abbey-falls', 'Entry open 09:00–17:00; ticket counter cutoff not verified.'),
        costEvidence: ASSUMPTION('₹50 assumed; verify actual entry fee.'),
      },
      {
        id: 'coorg-raja', name: "Raja's Seat", durationMinutes: 60,
        openTime: '09:00', closeTime: '20:00', costPerPersonINR: 40,
        isOptional: true, priority: 2, localTransferMinutes: 30,
        openingHoursEvidence: OFFICIAL('https://karnatakatourism.org/en/destinations/coorg/', 'Destination page lists 09:00–20:00.'),
        costEvidence: ASSUMPTION('₹40 is an illustrative entry fee.'),
      },
    ],
  },
  {
    id: 'ooty', name: 'Ooty', oneWayDistanceKm: 275,
    baselineOneWayDriveMinutes: 465, routeName: 'NH 275 → NH 766 / Bandipur → Nilgiris',
    drivingEvidence: ASSUMPTION('465 min one-way MG Road planning estimate; not a live ETA.'),
    approximateRoundTripFuelINR: 5600, approximateRoundTripTollsINR: 750,
    approximateOneNightStayINR: 5000,
    pricingEvidence: ASSUMPTION('Fuel, toll and stay costs are illustrative, not live prices.'),
    activities: [
      {
        id: 'ooty-botanical', name: 'Government Botanical Garden', durationMinutes: 120,
        openTime: '07:00', closeTime: '18:30', costPerPersonINR: 50,
        isOptional: false, priority: 1, localTransferMinutes: 30,
        openingHoursEvidence: ASSUMPTION('Garden existence verified, but 07:00–18:30 hours NOT verified from official district listing.'),
        costEvidence: ASSUMPTION('₹50 planning estimate; verify current fees.'),
      },
      {
        id: 'ooty-doddabetta', name: 'Doddabetta Peak Viewpoint', durationMinutes: 90,
        openTime: '09:00', closeTime: '18:00', costPerPersonINR: 30,
        isOptional: true, priority: 2, localTransferMinutes: 45,
        openingHoursEvidence: ASSUMPTION('09:00–18:00 unverified planning hours.'),
        costEvidence: ASSUMPTION('₹30 illustrative ticket.'),
      },
    ],
    routeRestriction: {
      name: 'Bandipur nighttime road restriction',
      startTime: '21:00', endTime: '06:00',
      outboundCheckpointOffsetMinutes: 270, inboundCheckpointOffsetMinutes: 90,
      checkpointTraversalMinutes: 60,
      offsetEvidence: ASSUMPTION('T+270 / T+90 and 60-minute transit are unverified checkpoint estimates; advisory only.'),
      restrictionEvidence: OFFICIAL('https://karnatakatourism.org/en/attractions/bandipura-wildlife-sanctuary/', 'Road restricted from 21:00 to 06:00.'),
    },
  },
];

export const getDestination = (id: string): Destination | undefined =>
  DESTINATIONS.find((destination) => destination.id === id);
