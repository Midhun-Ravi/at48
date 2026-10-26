import { getDestination } from '../data/destinations.js';
import { getCompatiblePitstops } from '../data/pitstops.js';
import { parseIST } from '../engine/scheduler.js';
import { formatReadableDate, formatReadableDateTime } from './formatters.js';
import type { PacePreference, UserConstraints } from '../types.js';

export const MAX_NAME_LENGTH = 40;
export const MAX_URL_PAYLOAD_LENGTH = 2048;
export const CURRENT_SCHEMA_VERSION = 1;

export const SUPPORTED_DESTINATIONS = ['mysuru', 'ooty', 'coorg-madikeri', 'nandi-hills'] as const;
export type SupportedDestinationId = typeof SUPPORTED_DESTINATIONS[number];

/** Clean an input display name while user is actively typing (strips tags & control chars, limits length, preserves typing spaces). */
export function cleanInputDisplayName(name: string | null | undefined): string {
  if (!name) return '';
  return name
    .replace(/<[^>]*>/g, '') // remove HTML tags
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // remove control chars
    .slice(0, MAX_NAME_LENGTH);
}

/** Sanitize an organizer or guest display name for final submission/URLs (strips tags, control characters, trims whitespace, limits length). */
export function sanitizeDisplayName(name: string | null | undefined): string {
  if (!name) return '';
  return cleanInputDisplayName(name).trim();
}

/** Build compact URLSearchParams for sharing trip state without serializing derived calculations. */
export function buildShareableParams(
  destinationId: string,
  inputs: UserConstraints
): URLSearchParams {
  const params = new URLSearchParams();

  params.set('v', String(CURRENT_SCHEMA_VERSION));

  const org = sanitizeDisplayName(inputs.organizerName);
  if (org) {
    params.set('org', org);
  }

  const mode = inputs.planningMode ?? (org ? 'group' : 'solo');
  params.set('mode', mode);

  if (inputs.partySize && inputs.partySize !== 2) {
    params.set('party', String(inputs.partySize));
  }

  params.set('dep', inputs.departureDateTime);
  params.set('ret', inputs.returnDeadlineDateTime);
  params.set('pace', inputs.pace);
  params.set('budget', String(inputs.perPersonBudgetINR));

  const adj = inputs.destinationAdjustments?.[destinationId] ?? inputs.drivingAdjustmentMinutes ?? 0;
  if (adj !== 0) {
    params.set('adj', String(adj));
  }

  if (inputs.simulateDelayMinutes === 60) {
    params.set('delay', '60');
  }

  // Filter to only compatible pitstops for this destination
  const compatibleStops = getCompatiblePitstops(destinationId).map(s => s.id);
  const selectedStops = (inputs.selectedPitstopIds ?? []).filter(id => compatibleStops.includes(id));
  if (selectedStops.length > 0) {
    params.set('stops', selectedStops.join(','));
  }

  if (inputs.disabledActivityIds && inputs.disabledActivityIds.length > 0) {
    params.set('skip', inputs.disabledActivityIds.join(','));
  }

  return params;
}

/** Generate a complete shareable URL using the given base or deployed origin. */
export function buildShareableTripUrl(
  destinationId: string,
  inputs: UserConstraints,
  baseUrl?: string
): string {
  const origin = baseUrl
    ? baseUrl.replace(/\/+$/, '')
    : typeof window !== 'undefined'
    ? window.location.origin
    : 'https://at48.vercel.app';

  const params = buildShareableParams(destinationId, inputs);
  return `${origin}/schedule/${encodeURIComponent(destinationId)}?${params.toString()}`;
}

export interface ReconstructedTrip {
  destinationId: string;
  inputs: UserConstraints;
  organizerName: string;
  planningMode: 'solo' | 'group';
  isGuestView: boolean;
  schemaVersion: number;
}

export type ParseTripResult =
  | {
      valid: true;
      data: ReconstructedTrip;
    }
  | {
      valid: false;
      error: string;
    };

/** Defensively parse and validate URL query parameters into a reconstructed UserConstraints. */
export function parseShareableTrip(
  searchParamsInput: URLSearchParams | string,
  destinationId: string
): ParseTripResult {
  try {
    // Convert to URLSearchParams safely
    let searchParams: URLSearchParams;
    let rawQuery = '';

    if (typeof searchParamsInput === 'string') {
      rawQuery = searchParamsInput.startsWith('?')
        ? searchParamsInput.slice(1)
        : searchParamsInput;
      if (rawQuery.length > MAX_URL_PAYLOAD_LENGTH) {
        return { valid: false, error: 'Trip URL payload exceeds safe size limits.' };
      }
      searchParams = new URLSearchParams(rawQuery);
    } else {
      searchParams = searchParamsInput;
      rawQuery = searchParams.toString();
      if (rawQuery.length > MAX_URL_PAYLOAD_LENGTH) {
        return { valid: false, error: 'Trip URL payload exceeds safe size limits.' };
      }
    }

    // 1. Destination validation
    if (!destinationId || !SUPPORTED_DESTINATIONS.includes(destinationId as SupportedDestinationId)) {
      return {
        valid: false,
        error: `Destination "${destinationId}" is unsupported or invalid. Only verified Bengaluru getaways (Mysuru, Ooty, Coorg, Nandi Hills) are supported.`,
      };
    }

    const dest = getDestination(destinationId);
    if (!dest) {
      return { valid: false, error: `Destination "${destinationId}" could not be loaded.` };
    }

    // 2. Dates validation
    const dep = searchParams.get('dep');
    const ret = searchParams.get('ret');

    if (!dep || !ret) {
      return { valid: false, error: 'Missing departure or return date parameters in trip link.' };
    }

    if (dep.length > 30 || ret.length > 30) {
      return { valid: false, error: 'Malformed date parameters in trip link.' };
    }

    let depEpoch: number;
    let retEpoch: number;

    try {
      depEpoch = parseIST(dep);
      retEpoch = parseIST(ret);
    } catch (e) {
      return {
        valid: false,
        error: e instanceof Error ? e.message : 'Invalid trip departure or return date format.',
      };
    }

    if (retEpoch <= depEpoch) {
      return { valid: false, error: 'Return deadline must be after trip departure.' };
    }

    const durationHours = (retEpoch - depEpoch) / 3_600_000;
    if (durationHours < 12 || durationHours > 84) {
      return {
        valid: false,
        error: `Trip duration (${Math.round(durationHours)}h) is outside the supported weekend window of 12 to 84 hours.`,
      };
    }

    // 3. Organizer name & planning mode
    const rawOrg = searchParams.get('org');
    const organizerName = sanitizeDisplayName(rawOrg);
    const rawMode = searchParams.get('mode');
    const planningMode: 'solo' | 'group' = rawMode === 'solo' ? 'solo' : 'group';

    // Guest view is active when an organizer name is present or group invitation parameters exist
    const isGuestView = Boolean(organizerName || searchParams.has('org') || searchParams.has('v'));

    // 4. Pace preference
    const rawPace = (searchParams.get('pace') || '').toLowerCase();
    let pace: PacePreference = 'balanced';
    if (rawPace === 'relaxed') pace = 'relaxed';
    else if (rawPace === 'packed') pace = 'packed';
    else if (rawPace === 'moderate' || rawPace === 'balanced') pace = 'balanced';

    // 5. Budget per person (supports presets and custom whole-number amounts from ₹500 to ₹100,000)
    const rawBudget = (searchParams.get('budget') || '').toLowerCase().trim();
    let perPersonBudgetINR = 6000;
    if (rawBudget === '3000' || rawBudget === 'backpacker') perPersonBudgetINR = 3000;
    else if (rawBudget === '6000' || rawBudget === 'moderate') perPersonBudgetINR = 6000;
    else if (rawBudget === '10000' || rawBudget === 'comfort') perPersonBudgetINR = 10000;
    else if (rawBudget) {
      const parsedBudget = parseInt(rawBudget.replace(/^₹/, ''), 10);
      if (!Number.isNaN(parsedBudget) && parsedBudget >= 500 && parsedBudget <= 100000) {
        perPersonBudgetINR = Math.round(parsedBudget);
      }
    }

    // 6. Party size
    const rawParty = searchParams.get('party');
    let partySize = 2;
    if (rawParty) {
      const parsedParty = parseInt(rawParty, 10);
      if (!Number.isNaN(parsedParty) && parsedParty >= 1 && parsedParty <= 20) {
        partySize = parsedParty;
      }
    }

    // 7. Driving adjustment minutes
    const rawAdj = searchParams.get('adj');
    let drivingAdjustmentMinutes = 0;
    if (rawAdj) {
      const parsedAdj = parseInt(rawAdj, 10);
      if (!Number.isNaN(parsedAdj)) {
        // Clamp to [-120, +240] and round to nearest 15
        const clamped = Math.max(-120, Math.min(240, parsedAdj));
        drivingAdjustmentMinutes = Math.round(clamped / 15) * 15;
      }
    }

    // 8. One-hour delay
    const rawDelay = searchParams.get('delay');
    const simulateDelayMinutes: 0 | 60 =
      rawDelay === '60' || rawDelay === '1' || rawDelay === 'true' ? 60 : 0;

    // 9. Selected Pitstops (must be compatible with this destination)
    const rawStops = searchParams.get('stops');
    const compatiblePitstopIds = getCompatiblePitstops(destinationId).map(s => s.id);
    let selectedPitstopIds: string[] = [];

    if (rawStops) {
      const candidateIds = rawStops
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
      // Filter strictly to compatible stops
      selectedPitstopIds = candidateIds.filter(id => compatiblePitstopIds.includes(id));
    }

    // 10. Disabled optional activities
    const rawSkip = searchParams.get('skip');
    const validOptionalActivityIds = dest.activities
      .filter(a => a.isOptional)
      .map(a => a.id);
    let disabledActivityIds: string[] = [];

    if (rawSkip) {
      const candidateSkips = rawSkip
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
      disabledActivityIds = candidateSkips.filter(id =>
        validOptionalActivityIds.includes(id)
      );
    }

    // Schema version
    const schemaVersion = parseInt(searchParams.get('v') || '1', 10) || 1;

    const reconstructedInputs: UserConstraints = {
      departureDateTime: dep,
      returnDeadlineDateTime: ret,
      pace,
      perPersonBudgetINR,
      partySize,
      drivingAdjustmentMinutes,
      simulateDelayMinutes,
      disabledActivityIds,
      selectedPitstopIds,
      organizerName: organizerName || undefined,
      planningMode,
      destinationAdjustments: { [destinationId]: drivingAdjustmentMinutes },
    };

    return {
      valid: true,
      data: {
        destinationId,
        inputs: reconstructedInputs,
        organizerName,
        planningMode,
        isGuestView,
        schemaVersion,
      },
    };
  } catch (err) {
    return {
      valid: false,
      error: err instanceof Error ? err.message : 'Failed to parse trip link.',
    };
  }
}

/** Build human-friendly WhatsApp invitation message containing destination, dates, organizer, and trip snapshot URL. */
export function buildWhatsAppInvitationMessage({
  destinationName,
  inputs,
  tripUrl,
}: {
  destinationName: string;
  inputs: UserConstraints;
  tripUrl: string;
}): string {
  const org = sanitizeDisplayName(inputs.organizerName) || 'Trip Organizer';
  const depFormatted = formatReadableDateTime(inputs.departureDateTime);
  const retFormatted = formatReadableDateTime(inputs.returnDeadlineDateTime);

  const lines = [
    `🚗 Road Trip Invitation to ${destinationName} with ${org}!`,
    '',
    `🗓 Dates: ${depFormatted} → ${retFormatted} (IST)`,
    `📍 Route: Bengaluru → ${destinationName}`,
  ];

  if (inputs.selectedPitstopIds && inputs.selectedPitstopIds.length > 0) {
    lines.push(`☕ Curated highway pitstop included`);
  }

  lines.push(
    '',
    'Explore the interactive map, itinerary, and feasibility check:',
    tripUrl,
    '',
    '💬 Shared trip snapshot. Reply on WhatsApp to RSVP and confirm your spot!'
  );

  return lines.join('\n');
}

/** Build honest WhatsApp RSVP message from guest to organizer. */
export function buildWhatsAppRSVPMessage({
  organizerName,
  guestName,
  destinationName,
  departureDateTime,
  returnDeadlineDateTime,
  tripUrl,
}: {
  organizerName: string;
  guestName: string;
  destinationName: string;
  departureDateTime: string;
  returnDeadlineDateTime: string;
  tripUrl: string;
}): string {
  const cleanOrg = sanitizeDisplayName(organizerName) || 'Organizer';
  const cleanGuest = sanitizeDisplayName(guestName) || 'Traveler';
  const depDate = formatReadableDate(departureDateTime);
  const retDate = formatReadableDate(returnDeadlineDateTime);

  return [
    `Hey ${cleanOrg}, count me in for the ${destinationName} road trip (${depDate} - ${retDate})! 🎉`,
    '',
    'Here is the trip plan we are following:',
    tripUrl,
    '',
    `- ${cleanGuest}`,
  ].join('\n');
}
