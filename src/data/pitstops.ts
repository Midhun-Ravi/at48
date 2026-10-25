import type { Pitstop } from '../types';

/**
 * Curated, verified highway pitstops along major travel corridors from Bengaluru.
 * All geographic locations are verified via official mappings (OpenStreetMap / verified business registries).
 * Dwell and detour times are explicitly documented planning estimates.
 */
export const PITSTOPS: Pitstop[] = [
  {
    id: 'maddur-tiffanys',
    name: 'Maddur Tiffanys (Bengaluru–Mysuru Expressway / Old NH 275, Nidaghatta)',
    shortName: 'Maddur Tiffanys',
    category: 'food',
    categoryLabel: 'Legendary South Indian Tiffin & Vade',
    description:
      'Historic highway establishment established in 1949, world-famous for inventing Maddur Vade. Situated at the Nidaghatta/Maddur exit along the service road with dedicated parking and dining areas.',
    location: {
      address: 'Bengaluru - Mysuru Road (Old NH 275 / Service Road), Nidaghatta, Madduru Taluk, Mandya District, Karnataka 571433',
      latitude: 12.6232558,
      longitude: 77.0983831,
      osmNodeId: 14076079701,
      osmUrl: 'https://www.openstreetmap.org/node/14076079701',
      verified: true,
    },
    // The Mysuru expressway corridor serves Mysuru directly, and forms the first leg for Ooty and Coorg
    compatibleDestinationIds: ['mysuru', 'ooty', 'coorg-madikeri'],
    applicableLeg: 'both',
    positionRatio: 0.50, // Approx. 75 km from MG Road reference on the ~145 km corridor to Mysuru
    dwellMinutes: 30, // 30m estimated dining & restroom break
    detourMinutes: 10, // 10m estimated slip-road exit & re-entry to main expressway
    replacesArrivalMeal: true, // Meal taken on the way replaces redundant midday hotel arrival meal
    timingEvidence: {
      level: 'assumption',
      sourceUrl: 'https://maddurtiffanys.com',
      note: 'Dwell time (30m) and service road detour (10m) are planning assumptions. Published opening hours 06:00 - 22:30 IST.',
    },
    locationEvidence: {
      level: 'official',
      sourceUrl: 'https://www.openstreetmap.org/node/14076079701',
      checkedOn: '2026-10-25',
      note: 'Verified OpenStreetMap node 14076079701 (amenity=restaurant, name=Maddur Tiffanys) on Bengaluru - Mysuru Road, Nidaghatta.',
    },
  },
];

export function getPitstop(id: string): Pitstop | undefined {
  return PITSTOPS.find(p => p.id === id);
}

export function getCompatiblePitstops(destinationId: string): Pitstop[] {
  return PITSTOPS.filter(p => p.compatibleDestinationIds.includes(destinationId));
}
