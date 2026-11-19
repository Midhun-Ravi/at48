import { getDestination } from '../data/destinations.js';
import { getCompatiblePitstops } from '../data/pitstops.js';
import { parseIST, getCalendarDaysCount } from '../engine/scheduler.js';
import { formatReadableDate, formatReadableDateTime } from './formatters.js';
import type { ActivityVisitCustomization, CustomPlannedActivity, PacePreference, UserConstraints } from '../types.js';

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

  // User-planned custom activities in free-time slots
  if (inputs.customActivities && inputs.customActivities.length > 0) {
    try {
      const compact = inputs.customActivities
        .map(ca => `${ca.day}~${encodeURIComponent(ca.name)}~${ca.durationMinutes}~${ca.costPerPersonINR || 0}${ca.slotStart ? `~${ca.slotStart}` : ''}`)
        .join(';');
      params.set('ca', compact);
    } catch {}
  }

  const dest = getDestination(destinationId);
  const validActivityIds = dest ? dest.activities.map(a => a.id) : [];

  // User-specified activity order
  if (inputs.activityOrder && inputs.activityOrder.length > 0) {
    const validOrder = inputs.activityOrder.filter(id => validActivityIds.includes(id));
    if (validOrder.length > 0) {
      params.set('ord', validOrder.join(','));
    }
  }

  // Explicit activity day assignments
  if (inputs.activityDayAssignments && Object.keys(inputs.activityDayAssignments).length > 0) {
    const validDays = Object.entries(inputs.activityDayAssignments)
      .filter(([id, d]) => validActivityIds.includes(id) && d >= 1 && d <= 4)
      .map(([id, d]) => `${id}:${d}`);
    if (validDays.length > 0) {
      params.set('days', validDays.join(','));
    }
  }

  // User-specified transfer allowances per activity
  if (inputs.transferAdjustments && Object.keys(inputs.transferAdjustments).length > 0) {
    const validTrans = Object.entries(inputs.transferAdjustments)
      .filter(([id, mins]) => validActivityIds.includes(id) && typeof mins === 'number' && mins >= 0 && mins <= 300)
      .map(([id, mins]) => `${id}:${mins}`);
    if (validTrans.length > 0) {
      params.set('trans', validTrans.join(','));
    }
  }

  // Explicit activity visit customizations (custom visit start time, duration, transfer)
  if (inputs.activityCustomizations && Object.keys(inputs.activityCustomizations).length > 0) {
    const validCust = Object.entries(inputs.activityCustomizations)
      .filter(([id]) => validActivityIds.includes(id))
      .map(([id, c]) => `${id}~${c.day ?? ''}~${c.startTime ?? ''}~${c.durationMinutes ?? ''}~${c.transferMinutes ?? ''}`);
    if (validCust.length > 0) {
      params.set('cust', validCust.join(';'));
    }
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

    // Validate 1 to 4 calendar dates inclusive
    const numDays = getCalendarDaysCount(dep, ret);
    if (numDays < 1 || numDays > 4) {
      return {
        valid: false,
        error: `Trip window (${numDays} calendar dates) is outside the supported range of 1 to 4 calendar dates.`,
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

    // 5. Budget per person (supports presets and custom whole-number amounts from ₹0 upwards)
    const rawBudget = (searchParams.get('budget') || '').toLowerCase().trim();
    let perPersonBudgetINR = 6000;
    if (rawBudget === '3000' || rawBudget === 'backpacker') perPersonBudgetINR = 3000;
    else if (rawBudget === '6000' || rawBudget === 'moderate') perPersonBudgetINR = 6000;
    else if (rawBudget === '10000' || rawBudget === 'comfort') perPersonBudgetINR = 10000;
    else if (rawBudget) {
      const parsedBudget = parseInt(rawBudget.replace(/^₹/, ''), 10);
      if (!Number.isNaN(parsedBudget) && parsedBudget >= 0 && parsedBudget <= 1000000) {
        perPersonBudgetINR = Math.round(parsedBudget);
      }
    }

    // 6. Party size
    const rawParty = searchParams.get('party');
    let partySize = 2;
    if (rawParty) {
      const parsedParty = parseInt(rawParty, 10);
      if (!Number.isNaN(parsedParty) && parsedParty >= 1) {
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

    // 11. Custom planned activities in free slots
    const rawCustom = searchParams.get('ca');
    const customActivities: CustomPlannedActivity[] = [];
    if (rawCustom) {
      const parts = rawCustom.split(';').filter(Boolean);
      for (let i = 0; i < parts.length; i++) {
        const [dayStr, encName, durStr, costStr, slotStart] = parts[i].split('~');
        const day = parseInt(dayStr, 10);
        const name = decodeURIComponent(encName || '').slice(0, 60);
        const durationMinutes = parseInt(durStr, 10);
        const costPerPersonINR = parseInt(costStr || '0', 10);
        if (day >= 1 && day <= 4 && name && durationMinutes > 0 && durationMinutes <= 600) {
          let safeSlotStart: string | undefined = undefined;
          if (slotStart) {
            if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(slotStart)) {
              safeSlotStart = slotStart;
            } else if (/^\d{2}:\d{2}$/.test(slotStart)) {
              try {
                const depDate = new Date(parseIST(dep));
                depDate.setDate(depDate.getDate() + (day - 1));
                const yyyy = depDate.getFullYear();
                const mm = String(depDate.getMonth() + 1).padStart(2, '0');
                const dd = String(depDate.getDate()).padStart(2, '0');
                safeSlotStart = `${yyyy}-${mm}-${dd}T${slotStart}`;
              } catch {}
            }
          }

          customActivities.push({
            id: `custom_${i + 1}`,
            day,
            name,
            durationMinutes,
            costPerPersonINR: !isNaN(costPerPersonINR) ? costPerPersonINR : 0,
            slotStart: safeSlotStart,
          });
        }
      }
    }

    // 12. Activity ordering
    const rawOrd = searchParams.get('ord');
    const validActivityIds = dest.activities.map(a => a.id);
    let activityOrder: string[] | undefined = undefined;
    if (rawOrd) {
      const parsedOrder = rawOrd
        .split(',')
        .map(s => s.trim())
        .filter(id => validActivityIds.includes(id));
      if (parsedOrder.length > 0) {
        activityOrder = parsedOrder;
      }
    }

    // 13. Activity day assignments
    const rawDays = searchParams.get('days');
    let activityDayAssignments: Record<string, number> | undefined = undefined;
    if (rawDays) {
      const daysMap: Record<string, number> = {};
      for (const pair of rawDays.split(',').map(s => s.trim()).filter(Boolean)) {
        const [actId, dayStr] = pair.split(':');
        const dayNum = parseInt(dayStr, 10);
        if (validActivityIds.includes(actId) && dayNum >= 1 && dayNum <= 4) {
          daysMap[actId] = dayNum;
        }
      }
      if (Object.keys(daysMap).length > 0) {
        activityDayAssignments = daysMap;
      }
    }

    // 14. Transfer adjustments
    const rawTrans = searchParams.get('trans');
    let transferAdjustments: Record<string, number> | undefined = undefined;
    if (rawTrans) {
      const transMap: Record<string, number> = {};
      for (const pair of rawTrans.split(',').map(s => s.trim()).filter(Boolean)) {
        const [actId, minStr] = pair.split(':');
        const mins = parseInt(minStr, 10);
        if (validActivityIds.includes(actId) && !isNaN(mins) && mins >= 0 && mins <= 300) {
          transMap[actId] = mins;
        }
      }
      if (Object.keys(transMap).length > 0) {
        transferAdjustments = transMap;
      }
    }

    // 15. Activity visit customizations
    const rawCust = searchParams.get('cust');
    let activityCustomizations: Record<string, ActivityVisitCustomization> | undefined = undefined;
    if (rawCust) {
      const custMap: Record<string, ActivityVisitCustomization> = {};
      for (const item of rawCust.split(';').map(s => s.trim()).filter(Boolean)) {
        const [actId, dayStr, startTime, durStr, transStr] = item.split('~');
        if (validActivityIds.includes(actId)) {
          const cust: ActivityVisitCustomization = {};
          if (dayStr) {
            const d = parseInt(dayStr, 10);
            if (d >= 1 && d <= 4) cust.day = d;
          }
          if (startTime) {
            if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(startTime)) {
              cust.startTime = startTime;
            } else if (/^\d{2}:\d{2}$/.test(startTime)) {
              try {
                const targetDay = cust.day ?? 1;
                const depDate = new Date(parseIST(dep));
                depDate.setDate(depDate.getDate() + (targetDay - 1));
                const yyyy = depDate.getFullYear();
                const mm = String(depDate.getMonth() + 1).padStart(2, '0');
                const dd = String(depDate.getDate()).padStart(2, '0');
                cust.startTime = `${yyyy}-${mm}-${dd}T${startTime}`;
              } catch {}
            }
          }
          if (durStr) {
            const dur = parseInt(durStr, 10);
            if (!isNaN(dur) && dur > 0 && dur <= 600) cust.durationMinutes = dur;
          }
          if (transStr) {
            const tr = parseInt(transStr, 10);
            if (!isNaN(tr) && tr >= 0 && tr <= 300) cust.transferMinutes = tr;
          }
          if (Object.keys(cust).length > 0) {
            custMap[actId] = cust;
          }
        }
      }
      if (Object.keys(custMap).length > 0) {
        activityCustomizations = custMap;
      }
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
      customActivities: customActivities.length > 0 ? customActivities : undefined,
      activityOrder,
      activityDayAssignments,
      transferAdjustments,
      activityCustomizations,
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
