/** @48 domain contract — all time inputs/outputs are local Asia/Kolkata wall-clock strings. */
export type PacePreference = 'relaxed' | 'balanced' | 'packed';
export type FeasibilityRating = 'Comfortable' | 'Tight' | 'Not Recommended';
export type EvidenceLevel = 'official' | 'assumption';

export interface Evidence {
  level: EvidenceLevel;
  sourceUrl?: string;
  checkedOn?: string; // YYYY-MM-DD; only use when a source was actually checked
  note?: string;
}

export interface UserConstraints {
  departureDateTime: string; // YYYY-MM-DDTHH:mm interpreted as IST
  returnDeadlineDateTime: string; // YYYY-MM-DDTHH:mm interpreted as IST
  pace: PacePreference;
  perPersonBudgetINR: number; // preset 3000 | 6000 | 10000
  partySize: number; // default 2; UI may keep this fixed
  drivingAdjustmentMinutes: number; // -60 through +120, multiples of 15
  simulateDelayMinutes: 0 | 60; // outbound only
  disabledActivityIds: string[]; // only optional activities may be disabled
  selectedPitstopIds?: string[]; // IDs of curated highway stops to include
  organizerName?: string; // display name e.g. "Sujil" (max 40 chars)
  planningMode?: 'solo' | 'group'; // default 'group'
}

export interface Activity {
  id: string;
  name: string;
  durationMinutes: number;
  openTime: string; // HH:mm, IST
  closeTime: string; // HH:mm, IST
  lastEntryTime?: string; // HH:mm; only if sourced
  costPerPersonINR: number;
  isOptional: boolean;
  priority: number;
  localTransferMinutes: number; // time to reach attraction from previous activity
  openingHoursEvidence: Evidence;
  costEvidence: Evidence;
}

export interface RouteRestriction {
  name: string;
  startTime: string; // local time when passage is closed
  endTime: string; // local time when passage reopens
  outboundCheckpointOffsetMinutes: number;
  inboundCheckpointOffsetMinutes: number;
  checkpointTraversalMinutes: number;
  offsetEvidence: Evidence;
  restrictionEvidence: Evidence;
}

export interface Destination {
  id: string;
  name: string;
  oneWayDistanceKm: number;
  baselineOneWayDriveMinutes: number;
  routeName: string;
  drivingEvidence: Evidence;
  approximateRoundTripFuelINR: number;
  approximateRoundTripTollsINR: number;
  approximateOneNightStayINR: number; // shared room
  pricingEvidence: Evidence;
  activities: Activity[];
  routeRestriction?: RouteRestriction;
}

export type TimelineCategory =
  | 'DRIVE' | 'CHECK_IN' | 'MEAL' | 'ACTIVITY' | 'TRANSFER'
  | 'REST' | 'WAIT' | 'FREE' | 'PITSTOP';

export interface PitstopLocation {
  address: string;
  latitude: number;
  longitude: number;
  osmNodeId?: number;
  osmUrl: string;
  verified: boolean;
}

export type PitstopCategory = 'food' | 'cafe' | 'fuel' | 'rest';
export type PitstopLeg = 'outbound' | 'return' | 'both';

export interface Pitstop {
  id: string;
  name: string;
  shortName: string;
  category: PitstopCategory;
  categoryLabel: string;
  description: string;
  location: PitstopLocation;
  compatibleDestinationIds: string[];
  applicableLeg: PitstopLeg;
  positionRatio: number; // 0.0 to 1.0 along the driving leg
  dwellMinutes: number; // estimated stop dwell time
  detourMinutes: number; // estimated detour / slip-road access time
  replacesArrivalMeal?: boolean; // if true on outbound, reduces redundant check-in meal
  timingEvidence: Evidence;
  locationEvidence: Evidence;
}

export interface TimetableEntry {
  id: string;
  category: TimelineCategory;
  label: string;
  startTime: string; // YYYY-MM-DDTHH:mm IST
  endTime: string;
  day: 1 | 2;
  activityId?: string;
  isOptional?: boolean;
}

export type ViolationType =
  | 'INVALID_INPUT' | 'REQUIRED_ACTIVITY_UNAVAILABLE'
  | 'MISSED_DEADLINE' | 'REST_CONFLICT'
  | 'POTENTIAL_NIGHT_CURFEW' | 'BUDGET_OVERRUN'
  | 'UNVERIFIED_OPENING_HOURS';
export interface ConstraintViolation {
  type: ViolationType;
  severity: 'BLOCKER' | 'ADVISORY' | 'WARNING';
  message: string;
  activityId?: string;
}

export interface ActivityOutcome {
  activityId: string;
  status: 'day1' | 'day2' | 'omitted' | 'unavailable';
  reason?: string;
}

export interface FeasibilityResult {
  destinationId: string;
  rating: FeasibilityRating;
  ratingExplanation: string;
  destinationSlackMinutes: number;
  returnDeadlineMarginMinutes: number;
  homeArrivalTime: string;
  outboundDriveMinutes: number; // includes contingency and optional delay
  inboundDriveMinutes: number; // includes contingency
  estimatedTripTotalINR: number;
  estimatedCostPerPersonINR: number;
  isBudgetExceeded: boolean;
  violations: ConstraintViolation[];
  activityOutcomes: ActivityOutcome[];
  timeline: TimetableEntry[];
}
