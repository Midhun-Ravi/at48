import type { Destination, FeasibilityResult, UserConstraints } from '../types';
import { DESTINATIONS } from '../data/destinations';
import { evaluateFeasibility, getCalendarDaysCount } from './scheduler';

export type RecommendationTier = 'RECOMMENDED' | 'VIABLE' | 'TIGHT' | 'NOT_RECOMMENDED' | 'IN_CURATION';

export interface DestinationRecommendation {
  id: string;
  name: string;
  oneWayDistanceKm: number;
  routeName: string;
  approxDriveMinutes: number;
  approxDriveLabel: string;
  tier: RecommendationTier;
  tierLabel: string;
  tierBadgeClass: string;
  whyRecommended: string;
  isVerified: boolean;
  destination?: Destination;
  feasibility?: FeasibilityResult;
  highlights?: string;
}

export interface CandidateDestinationData {
  id: string;
  name: string;
  oneWayDistanceKm: number;
  approxDriveMinutes: number;
  approxDriveLabel: string;
  routeName: string;
  highlights: string;
}

export const CANDIDATE_DESTINATIONS: CandidateDestinationData[] = [
  {
    id: 'kabini',
    name: 'Kabini & Nagarhole',
    oneWayDistanceKm: 215,
    approxDriveMinutes: 300,
    approxDriveLabel: '~5h',
    routeName: 'Mysuru Corridor · ~215 km',
    highlights: 'Wildlife safari corridor, forest reserve border & Kabini riverfront',
  },
  {
    id: 'sakleshpur',
    name: 'Sakleshpur',
    oneWayDistanceKm: 220,
    approxDriveMinutes: 270,
    approxDriveLabel: '~4.5h',
    routeName: 'NH 75 Hassan Highway · ~220 km',
    highlights: 'Manjarabad Star Fort, Bisle Ghat & misty Western Ghats ridges',
  },
  {
    id: 'chikmagalur',
    name: 'Chikmagalur',
    oneWayDistanceKm: 245,
    approxDriveMinutes: 300,
    approxDriveLabel: '~5h',
    routeName: 'Hassan Corridor · ~245 km',
    highlights: 'Mullayanagiri peak, Baba Budangiri & lush coffee estates',
  },
  {
    id: 'yelagiri',
    name: 'Yelagiri Hills',
    oneWayDistanceKm: 160,
    approxDriveMinutes: 210,
    approxDriveLabel: '~3.5h',
    routeName: 'NH 44 Krishnagiri Route · ~160 km',
    highlights: '14 scenic hairpin bends, peaceful Punganoor lake & rose gardens',
  },
  {
    id: 'wayanad',
    name: 'Wayanad',
    oneWayDistanceKm: 275,
    approxDriveMinutes: 390,
    approxDriveLabel: '~6.5h',
    routeName: 'Bandipur Forest Corridor · ~275 km',
    highlights: 'Edakkal Caves, Chembra Peak & evergreen tea estates',
  },
  {
    id: 'hampi',
    name: 'Hampi',
    oneWayDistanceKm: 340,
    approxDriveMinutes: 420,
    approxDriveLabel: '~7h',
    routeName: 'NH 48 / NH 50 Chitradurga Route · ~340 km',
    highlights: 'Vijayanagara UNESCO world heritage monuments & boulder landscapes',
  },
  {
    id: 'pondicherry',
    name: 'Puducherry (Pondicherry)',
    oneWayDistanceKm: 310,
    approxDriveMinutes: 390,
    approxDriveLabel: '~6.5h',
    routeName: 'Krishnagiri / Tiruvannamalai · ~310 km',
    highlights: 'French Quarter promenade, Auroville & Bay of Bengal beaches',
  },
  {
    id: 'gokarna',
    name: 'Gokarna',
    oneWayDistanceKm: 490,
    approxDriveMinutes: 570,
    approxDriveLabel: '~9.5h',
    routeName: 'NH 48 / Sirsi Route · ~490 km',
    highlights: 'Om Beach, Kudle Beach cliffs & coastal heritage temples',
  },
];

const TIER_ORDER: Record<RecommendationTier, number> = {
  RECOMMENDED: 1,
  VIABLE: 2,
  TIGHT: 3,
  NOT_RECOMMENDED: 4,
  IN_CURATION: 5,
};

/**
 * Computes duration-aware recommendations for all destinations.
 * Evaluates the 4 verified destinations deterministically with the scheduling engine,
 * assigning recommendations based on trip window duration (1 to 4 calendar days).
 * Attaches the 8 catalog candidate destinations in honest curation status.
 */
export function getDestinationRecommendations(
  inputs: UserConstraints
): DestinationRecommendation[] {
  const numDays = getCalendarDaysCount(inputs.departureDateTime, inputs.returnDeadlineDateTime);

  // 1. Process 4 verified destinations
  const verifiedRecs: DestinationRecommendation[] = DESTINATIONS.map(d => {
    const adj = inputs.destinationAdjustments?.[d.id] ?? 0;
    const destInputs: UserConstraints = {
      ...inputs,
      drivingAdjustmentMinutes: adj,
    };
    const feasibility = evaluateFeasibility(d, destInputs);

    let tier: RecommendationTier;
    let tierLabel: string;
    let badgeClass: string;
    let whyRecommended: string;

    if (numDays === 1) {
      // ===== SINGLE-DAY (SAME-DAY) TRIP =====
      if (d.id === 'nandi-hills') {
        tier = 'RECOMMENDED';
        tierLabel = 'Top Recommendation';
        badgeClass = 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/40';
        whyRecommended =
          'Perfect for a single-day escape. At only 62 km (~1.75h drive each way), it leaves plenty of daylight for sunrise viewpoints and temples without needing overnight lodging.';
      } else if (d.id === 'mysuru') {
        tier = 'TIGHT';
        tierLabel = 'Tight Day Trip';
        badgeClass = 'bg-amber-950/60 text-amber-300 border border-amber-500/40';
        whyRecommended =
          'Spanning 145 km each way via the Expressway, a same-day trip requires 6.5+ hours of round-trip driving. Feasible only with an early departure and late return, leaving compact time for the Palace.';
      } else if (d.id === 'coorg-madikeri') {
        tier = 'NOT_RECOMMENDED';
        tierLabel = 'Not Recommended for 1 Day';
        badgeClass = 'bg-red-950/60 text-red-300 border border-red-500/40';
        whyRecommended =
          'With ~11.5 hours of round-trip driving across 500+ km, a same-day trip is not recommended due to severe driver fatigue and insufficient daytime leisure. Best enjoyed over 2 to 4 days.';
      } else {
        // Ooty
        tier = 'NOT_RECOMMENDED';
        tierLabel = 'Not Recommended for 1 Day';
        badgeClass = 'bg-red-950/60 text-red-300 border border-red-500/40';
        whyRecommended =
          'Round-trip driving exceeds 15 hours and conflicts with the Bandipur forest night curfew (21:00–06:00). An overnight stay of at least 2–4 days is essential.';
      }
    } else if (numDays === 2) {
      // ===== 2-DAY WEEKEND (1 NIGHT) =====
      if (d.id === 'mysuru') {
        tier = 'RECOMMENDED';
        tierLabel = 'Top Recommendation';
        badgeClass = 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/40';
        whyRecommended =
          'The ideal 2-day weekend getaway. Quick 3-hour expressway drive leaves ample unhurried time for Mysore Palace, Chamundi Hills, and local markets with a comfortable single-night stay.';
      } else if (d.id === 'nandi-hills') {
        tier = 'VIABLE';
        tierLabel = 'Quick Escape';
        badgeClass = 'bg-blue-950/60 text-blue-300 border border-blue-500/40';
        whyRecommended =
          'Very close to Bengaluru (62 km). While easily completed in 1 day, an overnight stay offers a peaceful sunrise and relaxed morning.';
      } else if (d.id === 'coorg-madikeri') {
        tier = 'VIABLE';
        tierLabel = 'Viable Weekend Option';
        badgeClass = 'bg-blue-950/60 text-blue-300 border border-blue-500/40';
        whyRecommended =
          'A scenic 2-day coffee country getaway (~5.5h drive each way). Feasible with one overnight stay, though arriving by mid-afternoon leaves moderate time for Abbey Falls and Raja\'s Seat.';
      } else {
        // Ooty
        tier = 'TIGHT';
        tierLabel = 'Tight Weekend';
        badgeClass = 'bg-amber-950/60 text-amber-300 border border-amber-500/40';
        whyRecommended =
          'A demanding 6.5–7.5h mountain drive each way plus Nilgiris ghats. Doable for a quick 2-day visit, but Bandipur\'s 21:00 curfew requires careful departure timing. 3–4 days recommended.';
      }
    } else if (numDays === 3) {
      // ===== 3-DAY LONG WEEKEND (2 NIGHTS) =====
      if (d.id === 'coorg-madikeri') {
        tier = 'RECOMMENDED';
        tierLabel = 'Top Recommendation';
        badgeClass = 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/40';
        whyRecommended =
          'Outstanding fit for a 3-day holiday. The ~5.5h drive is easily amortized over 2 nights, providing a full unhurried intermediate day for plantation trails, waterfalls, and local Kodava cuisine.';
      } else if (d.id === 'ooty') {
        tier = 'RECOMMENDED';
        tierLabel = 'Top Recommendation';
        badgeClass = 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/40';
        whyRecommended =
          'Ideal duration for the Queen of Hill Stations. Having 3 days absorbs the 7-hour scenic drive and Bandipur transit, unlocking a full day for Doddabetta Peak, Botanical Gardens, and tea estates.';
      } else if (d.id === 'mysuru') {
        tier = 'VIABLE';
        tierLabel = 'Relaxed Slow Travel';
        badgeClass = 'bg-blue-950/60 text-blue-300 border border-blue-500/40';
        whyRecommended =
          'A very relaxed 3-day itinerary. Plenty of leisurely time for heritage sights, Ranganathittu Bird Sanctuary, and artisan markets without any highway rush.';
      } else {
        // Nandi Hills
        tier = 'NOT_RECOMMENDED';
        tierLabel = 'Better for Short Trips';
        badgeClass = 'bg-slate-800 text-slate-300 border border-slate-700';
        whyRecommended =
          'At only 62 km from Bengaluru, Nandi Hills is best suited for 1-day or 2-day visits. For a 3-day window, farther hill stations like Coorg or Ooty provide a much richer holiday.';
      }
    } else {
      // ===== 4-DAY EXTENDED HOLIDAY (3 NIGHTS) =====
      if (d.id === 'ooty') {
        tier = 'RECOMMENDED';
        tierLabel = 'Top Recommendation';
        badgeClass = 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/40';
        whyRecommended =
          'The ultimate 4-day Nilgiris retreat. Ample time to navigate the 36 hairpin bends and Bandipur corridor, with two complete intermediate days to explore Ooty, Coonoor, and Pykara lake.';
      } else if (d.id === 'coorg-madikeri') {
        tier = 'RECOMMENDED';
        tierLabel = 'Top Recommendation';
        badgeClass = 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/40';
        whyRecommended =
          'Superb 4-day immersion into South Coorg and Madikeri. Two full leisure days allow coffee plantation stays, Dubare Elephant Camp, Talacauvery, and Abbey Falls at an unhurried pace.';
      } else if (d.id === 'mysuru') {
        tier = 'VIABLE';
        tierLabel = 'Leisurely Heritage';
        badgeClass = 'bg-blue-950/60 text-blue-300 border border-blue-500/40';
        whyRecommended =
          'Offers an extensive exploration of Mysuru and surrounding heritage circuits (Srirangapatna, Somnathapura, and Kabini borders) with zero travel fatigue.';
      } else {
        // Nandi Hills
        tier = 'NOT_RECOMMENDED';
        tierLabel = 'Better for Short Trips';
        badgeClass = 'bg-slate-800 text-slate-300 border border-slate-700';
        whyRecommended =
          'Too close to Bengaluru (62 km) for a 4-day vacation. We strongly recommend choosing Coorg, Ooty, or other multi-day destinations for this extended window.';
      }
    }

    // Engine feasibility override
    if (feasibility.rating === 'Not Recommended') {
      tier = 'NOT_RECOMMENDED';
      tierLabel = 'Not Recommended (Infeasible)';
      badgeClass = 'bg-red-950/60 text-red-300 border border-red-500/40';
      whyRecommended = `${whyRecommended} Note: ${feasibility.ratingExplanation}`;
    } else if (feasibility.rating === 'Tight' && tier === 'RECOMMENDED') {
      tier = 'TIGHT';
      tierLabel = 'Tight Schedule';
      badgeClass = 'bg-amber-950/60 text-amber-300 border border-amber-500/40';
    }

    const driveHours = (d.baselineOneWayDriveMinutes / 60).toFixed(1);

    return {
      id: d.id,
      name: d.name,
      oneWayDistanceKm: d.oneWayDistanceKm,
      routeName: d.routeName,
      approxDriveMinutes: d.baselineOneWayDriveMinutes,
      approxDriveLabel: `~${driveHours}h`,
      tier,
      tierLabel,
      tierBadgeClass: badgeClass,
      whyRecommended,
      isVerified: true,
      destination: d,
      feasibility,
    };
  });

  // Sort verified recommendations by recommendation tier
  verifiedRecs.sort((a, b) => {
    const diff = TIER_ORDER[a.tier] - TIER_ORDER[b.tier];
    if (diff !== 0) return diff;
    // Tie-breaker: higher destination slack minutes first
    const slackA = a.feasibility?.destinationSlackMinutes ?? 0;
    const slackB = b.feasibility?.destinationSlackMinutes ?? 0;
    return slackB - slackA;
  });

  // 2. Candidate destinations in curation
  const candidateRecs: DestinationRecommendation[] = CANDIDATE_DESTINATIONS.map(c => ({
    id: c.id,
    name: c.name,
    oneWayDistanceKm: c.oneWayDistanceKm,
    routeName: c.routeName,
    approxDriveMinutes: c.approxDriveMinutes,
    approxDriveLabel: c.approxDriveLabel,
    tier: 'IN_CURATION',
    tierLabel: 'In Curation · Insufficient Verified Data',
    tierBadgeClass: 'bg-slate-800 text-slate-400 border border-slate-700',
    whyRecommended:
      'Route geometry and distances mapped from Bengaluru. Activity opening hours, admission tariffs, and hotel baselines are undergoing editorial field verification.',
    isVerified: false,
    highlights: c.highlights,
  }));

  return [...verifiedRecs, ...candidateRecs];
}
