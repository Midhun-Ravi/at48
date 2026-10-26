import { getPitstop } from '../data/pitstops.js';
import type {
  Activity, ActivityOutcome, ConstraintViolation, Destination,
  FeasibilityRating, FeasibilityResult, Pitstop, TimetableEntry, TimelineCategory, UserConstraints,
} from '../types';

/**
 * Pure deterministic MVP scheduler. All input wall-clock values are Asia/Kolkata.
 * It does NOT access the device clock, network, GPS or browser timezone.
 * Estimate data and attraction assumptions live in data/destinations.ts.
 */
const IST_OFFSET_MINUTES = 330;
const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;

const PACE = {
  relaxed: { arrivalMealCheckinMinutes: 90, breakfastMinutes: 60, eveningMealMinutes: 60 },
  balanced: { arrivalMealCheckinMinutes: 75, breakfastMinutes: 45, eveningMealMinutes: 45 },
  packed: { arrivalMealCheckinMinutes: 60, breakfastMinutes: 30, eveningMealMinutes: 30 },
} as const;

/** Parse YYYY-MM-DDTHH:mm as an IST wall clock rather than device-local time. */
export function parseIST(value: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error('Use YYYY-MM-DDTHH:mm (Asia/Kolkata).');
  const [, ys, ms, ds, hs, mins] = match;
  const [y, m, d, h, minute] = [ys, ms, ds, hs, mins].map(Number);
  const time = Date.UTC(y, m - 1, d, h, minute) - IST_OFFSET_MINUTES * MINUTE_MS;
  if (formatIST(time) !== value) throw new Error(`Invalid IST date or time: ${value}`);
  return time;
}

/** Format an epoch timestamp as YYYY-MM-DDTHH:mm in fixed IST. */
export function formatIST(epoch: number): string {
  return new Date(epoch + IST_OFFSET_MINUTES * MINUTE_MS).toISOString().slice(0, 16);
}

function dayOf(instant: number): string { return formatIST(instant).slice(0, 10); }
function nextDay(date: string): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + DAY_MS).toISOString().slice(0, 10);
}
function at(date: string, hhmm: string): number { return parseIST(`${date}T${hhmm}`); }
function add(time: number, mins: number): number { return time + mins * MINUTE_MS; }

function checkConstraints(input: UserConstraints, destination: Destination): void {
  const departure = parseIST(input.departureDateTime);
  const deadline = parseIST(input.returnDeadlineDateTime);
  const hours = (deadline - departure) / 3_600_000;
  if (hours < 18 || hours > 60) throw new Error('Trip window must be between 18 and 60 hours.');
  if (!['relaxed', 'balanced', 'packed'].includes(input.pace)) throw new Error('Invalid pace.');
  if (!Number.isInteger(input.partySize) || input.partySize < 1 || input.partySize > 10) throw new Error('Party size must be 1–10.');
  if (input.perPersonBudgetINR <= 0 || !Number.isFinite(input.perPersonBudgetINR)) throw new Error('Budget must be positive.');
  if (!Number.isInteger(input.drivingAdjustmentMinutes) || input.drivingAdjustmentMinutes < -60 ||
    input.drivingAdjustmentMinutes > 120 || input.drivingAdjustmentMinutes % 15 !== 0)
    throw new Error('Driving adjustment must be −60 to +120 in 15-minute increments.');
  if (input.simulateDelayMinutes !== 0 && input.simulateDelayMinutes !== 60)
    throw new Error('Delay scenario must be 0 or 60 minutes.');
  if (destination.baselineOneWayDriveMinutes + input.drivingAdjustmentMinutes <= 0)
    throw new Error('Adjusted driving time must be positive.');
}

export function evaluateFeasibility(
  destination: Destination, input: UserConstraints,
): FeasibilityResult {
  checkConstraints(input, destination);
  const start = parseIST(input.departureDateTime);
  const deadline = parseIST(input.returnDeadlineDateTime);
  const day1 = dayOf(start);
  const day2 = nextDay(day1);
  const p = PACE[input.pace];
  const violations: ConstraintViolation[] = [];
  const activityOutcomes: ActivityOutcome[] = [];
  const timeline: TimetableEntry[] = [];
  let sequence = 0;
  const push = (category: TimelineCategory, label: string, from: number, to: number,
    day: 1 | 2, activityId?: string, isOptional?: boolean): void => {
    if (to <= from) return;
    timeline.push({ id: `t${++sequence}`, category, label,
      startTime: formatIST(from), endTime: formatIST(to), day, activityId, isOptional });
  };
  const violation = (type: ConstraintViolation['type'], severity: ConstraintViolation['severity'],
    message: string, activityId?: string): void => {
    violations.push({ type, severity, message, activityId });
  };

  // One contingency on each leg. Explicit 60-minute scenario affects outbound only.
  const adjustedOneWay = destination.baselineOneWayDriveMinutes + input.drivingAdjustmentMinutes;
  const driveContingency = Math.round(adjustedOneWay * 0.20);
  const outboundMinutes = adjustedOneWay + driveContingency + input.simulateDelayMinutes;
  const inboundMinutes = adjustedOneWay + driveContingency;

  // Curated highway pitstops resolution
  const selectedStopIds = input.selectedPitstopIds ?? [];
  const validStops: Pitstop[] = [];
  for (const id of selectedStopIds) {
    const s = getPitstop(id);
    if (!s || !s.compatibleDestinationIds.includes(destination.id)) {
      violation('INVALID_INPUT', 'ADVISORY', `Selected pitstop "${id}" is not applicable to route ${destination.name}; ignored.`);
    } else {
      validStops.push(s);
    }
  }

  // Outbound pitstop (at most one on outbound leg in initial experience)
  const outboundStop = validStops.find(s => s.applicableLeg === 'outbound' || s.applicableLeg === 'both');
  let arrived: number;
  let outboundStopDwellAndDetour = 0;

  if (outboundStop) {
    outboundStopDwellAndDetour = outboundStop.dwellMinutes + outboundStop.detourMinutes;
    const ratio = Math.max(0.1, Math.min(0.9, outboundStop.positionRatio));
    const leg1Drive = Math.round(adjustedOneWay * ratio);
    const leg1Buffer = Math.round(driveContingency * ratio);
    const leg1Total = leg1Drive + leg1Buffer;

    const stopArrival = add(start, leg1Total);
    const stopDeparture = add(stopArrival, outboundStopDwellAndDetour);

    const leg2Drive = adjustedOneWay - leg1Drive;
    const leg2Buffer = driveContingency - leg1Buffer;
    const leg2Total = leg2Drive + leg2Buffer + input.simulateDelayMinutes;
    arrived = add(stopDeparture, leg2Total);

    push('DRIVE', `Drive towards ${destination.name} (Leg 1, incl. ${leg1Buffer}m buffer)`, start, stopArrival, 1);
    push(
      'PITSTOP',
      `${outboundStop.name} (${outboundStop.dwellMinutes}m dwell + ${outboundStop.detourMinutes}m detour)`,
      stopArrival,
      stopDeparture,
      1
    );
    push('DRIVE', `Drive to ${destination.name} (Leg 2, incl. ${leg2Buffer}m buffer)`, stopDeparture, arrived, 1);
  } else {
    arrived = add(start, outboundMinutes);
    push('DRIVE', `Drive to ${destination.name} (incl. ${driveContingency}m planning buffer)`, start, arrived, 1);
  }

  const restStart = at(day1, '22:00');
  const day1FreeEnd = at(day1, '21:00');
  const day2Wake = at(day2, '07:00');
  const day2LunchStart = at(day2, '12:00');

  if (arrived > restStart) {
    violation('REST_CONFLICT', 'BLOCKER', 'Outbound arrival conflicts with the 10 PM overnight-rest anchor.');
  }

  let day1Cursor = arrived;
  const checkInEarliest = at(day1, '13:00');
  if (day1Cursor < checkInEarliest) {
    push('WAIT', 'Waiting for 1 PM check-in assumption', day1Cursor, checkInEarliest, 1);
    day1Cursor = checkInEarliest;
  }
  const checkinDuration = outboundStop?.replacesArrivalMeal
    ? Math.max(30, p.arrivalMealCheckinMinutes - 45)
    : p.arrivalMealCheckinMinutes;
  const checkinLabel = outboundStop?.replacesArrivalMeal
    ? 'Hotel check-in & freshen up (meal taken at pitstop)'
    : 'Meal & hotel check-in (estimated)';
  const afterCheckin = add(day1Cursor, checkinDuration);
  push('CHECK_IN', checkinLabel, day1Cursor, afterCheckin, 1);
  day1Cursor = afterCheckin;

  const sorted = [...destination.activities].sort((a, b) =>
    Number(a.isOptional) - Number(b.isOptional) || a.priority - b.priority);
  const enabled = sorted.filter(activity => {
    if (activity.isOptional && input.disabledActivityIds.includes(activity.id)) {
      activityOutcomes.push({ activityId: activity.id, status: 'omitted', reason: 'User removed optional activity.' });
      return false;
    }
    return true;
  });

  function attempt(activity: Activity, cursor: number, date: string,
    endCap: number, day: 1 | 2): number | undefined {
    if (cursor >= endCap) return undefined;
    const transferEnd = add(cursor, activity.localTransferMinutes);
    const opening = at(date, activity.openTime);
    const closing = at(date, activity.closeTime);
    const lastEntry = activity.lastEntryTime ? at(date, activity.lastEntryTime) : closing;
    let begin = Math.max(transferEnd, opening);
    let finish = add(begin, activity.durationMinutes);
    if (begin > lastEntry || finish > closing || finish > endCap) return undefined;
    push('TRANSFER', `Local transfer to ${activity.name}`, cursor, transferEnd, day);
    push('WAIT', `Wait for ${activity.name} to open`, transferEnd, begin, day);
    push('ACTIVITY', activity.name, begin, finish, day, activity.id, activity.isOptional);
    activityOutcomes.push({ activityId: activity.id, status: day === 1 ? 'day1' : 'day2' });

    // Flag near-closing risk when visit concludes with under 30 minutes of margin before closing
    const closingMargin = Math.round((closing - finish) / MINUTE_MS);
    if (closingMargin < 30) {
      violation(
        'UNVERIFIED_OPENING_HOURS',
        'ADVISORY',
        `Tight closing margin: ${activity.name} visit finishes at ${formatIST(finish).slice(11)} against ${activity.closeTime} closing—only ${closingMargin}m margin. Operational cutoff or entrance delay risk; verify last entry before travel.`,
        activity.id
      );
    }

    return finish;
  }

  const remaining: Activity[] = [];
  for (const activity of enabled) {
    const next = attempt(activity, day1Cursor, day1, day1FreeEnd, 1);
    if (next === undefined) remaining.push(activity);
    else day1Cursor = next;
  }

  // A deterministic dinner + rest anchor; durations from the selected pace.
  const dinnerStart = day1FreeEnd;
  const dinnerEnd = add(dinnerStart, p.eveningMealMinutes);
  if (day1Cursor > dinnerStart) {
    violation('REST_CONFLICT', 'BLOCKER', 'Day 1 activities/check-in extend past the evening meal anchor.');
  }
  push('MEAL', 'Dinner (estimated)', dinnerStart, dinnerEnd, 1);
  if (dinnerEnd > restStart) {
    violation('REST_CONFLICT', 'BLOCKER', 'Dinner exceeds the 10 PM sleep anchor.');
  }
  push('REST', 'Overnight rest', restStart, day2Wake, 1);

  const latestReturnDeparture = add(deadline, -inboundMinutes);
  const preferredReturnDeparture = Math.min(at(day2, '15:00'),
    add(latestReturnDeparture, -120));
  let day2Cursor = add(day2Wake, p.breakfastMinutes);
  push('MEAL', 'Breakfast (estimated)', day2Wake, day2Cursor, 2);

  // Lunch may follow a morning activity rather than forcing it to begin
  // after a rigid noon anchor. Never overlap lunch and an attraction.
  let day2LunchDone = false;
  const lunchDuration = 45;
  const takeLunch = (from: number): number => {
    const lunchStart = Math.max(from, day2LunchStart);
    const lunchEnd = add(lunchStart, lunchDuration);
    push('MEAL', 'Lunch (estimated)', lunchStart, lunchEnd, 2);
    day2LunchDone = true;
    return lunchEnd;
  };

  for (const activity of remaining) {
    // Required activity may consume the planned 120-minute return reserve, but
    // it may NEVER extend past the actual hard return departure deadline.
    const endCap = activity.isOptional ? preferredReturnDeparture : latestReturnDeparture;
    const earliestStart = Math.max(add(day2Cursor, activity.localTransferMinutes), at(day2, activity.openTime));
    if (!day2LunchDone && earliestStart >= day2LunchStart &&
        add(Math.max(day2Cursor, day2LunchStart), lunchDuration) < endCap) {
      day2Cursor = takeLunch(day2Cursor);
    }
    const next = attempt(activity, day2Cursor, day2, endCap, 2);
    if (next === undefined) {
      activityOutcomes.push({ activityId: activity.id,
        status: activity.isOptional ? 'omitted' : 'unavailable',
        reason: 'Full visit cannot fit on Day 1 or Day 2 within the planning windows.' });
      if (!activity.isOptional) {
        const dataQualifier = activity.openingHoursEvidence.level === 'official'
          ? 'published opening hours' : 'unverified planning hours';
        violation('REQUIRED_ACTIVITY_UNAVAILABLE', 'BLOCKER',
          `${activity.name} cannot fit on either day using ${dataQualifier}; verify before travel.`, activity.id);
      }
    } else {
      day2Cursor = next;
    }
  }

  // If still at the destination past noon, reserve a real lunch period.
  // If the traveler must leave before noon, a road stop is already covered
  // by the declared driving contingency rather than double-counted.
  if (!day2LunchDone && preferredReturnDeparture > add(day2LunchStart, lunchDuration) &&
      day2Cursor < latestReturnDeparture) {
    const lunchStart = Math.max(day2Cursor, day2LunchStart);
    if (add(lunchStart, lunchDuration) <= latestReturnDeparture) {
      day2Cursor = takeLunch(day2Cursor);
    }
  }

  // A required late activity can push the preferred departure later, reducing
  // the return margin. Optional removal does not automatically change the
  // return margin unless the return leg's start truly changes.
  const returnDeparture = Math.max(preferredReturnDeparture, day2Cursor);

  // Return pitstop (if configured for return and distinct from outbound)
  const returnStop = validStops.find(s => s.applicableLeg === 'return' || (s.applicableLeg === 'both' && s.id !== outboundStop?.id));
  let homeArrival: number;

  if (returnStop) {
    const returnStopDuration = returnStop.dwellMinutes + returnStop.detourMinutes;
    const retRatio = Math.max(0.1, Math.min(0.9, 1 - returnStop.positionRatio));
    const retLeg1Drive = Math.round(adjustedOneWay * retRatio);
    const retLeg1Buffer = Math.round(driveContingency * retRatio);
    const retLeg1Total = retLeg1Drive + retLeg1Buffer;

    const retStopArrival = add(returnDeparture, retLeg1Total);
    const retStopDeparture = add(retStopArrival, returnStopDuration);

    const retLeg2Drive = adjustedOneWay - retLeg1Drive;
    const retLeg2Buffer = driveContingency - retLeg1Buffer;
    const retLeg2Total = retLeg2Drive + retLeg2Buffer;
    homeArrival = add(retStopDeparture, retLeg2Total);

    push('DRIVE', `Return drive towards Bengaluru (Leg 1, incl. ${retLeg1Buffer}m buffer)`, returnDeparture, retStopArrival, 2);
    push(
      'PITSTOP',
      `${returnStop.name} (${returnStop.dwellMinutes}m dwell + ${returnStop.detourMinutes}m detour)`,
      retStopArrival,
      retStopDeparture,
      2
    );
    push('DRIVE', `Return to Bengaluru (Leg 2, incl. ${retLeg2Buffer}m buffer)`, retStopDeparture, homeArrival, 2);
  } else {
    homeArrival = add(returnDeparture, inboundMinutes);
    push('DRIVE', `Return to Bengaluru (incl. ${driveContingency}m planning buffer)`,
      returnDeparture, homeArrival, 2);
  }

  const margin = Math.round((deadline - homeArrival) / MINUTE_MS);
  if (margin < 0) {
    violation('MISSED_DEADLINE', 'BLOCKER',
      `Estimated home arrival ${formatIST(homeArrival)} is ${-margin} minutes after the requested deadline.`);
  }

  if (destination.routeRestriction) {
    const r = destination.routeRestriction;
    const check = (legStart: number, offset: number, name: string) => {
      const crossing = add(legStart, offset);
      const leaving = add(crossing, r.checkpointTraversalMinutes);
      const local = (epoch: number) => formatIST(epoch).slice(11, 16);
      const closedAt = (epoch: number) => {
        const clock = local(epoch);
        return r.startTime <= r.endTime
          ? clock >= r.startTime && clock < r.endTime
          : clock >= r.startTime || clock < r.endTime;
      };
      if (closedAt(crossing) || closedAt(add(leaving, -1))) {
        violation('POTENTIAL_NIGHT_CURFEW', 'ADVISORY',
          `${name} provisional ${r.name} crossing ${formatIST(crossing)} may overlap 21:00–06:00 restriction. ` +
          `Checkpoint offsets are unverified; check the live route and authorities.`);
      }
    };
    const outboundCrossingBase = outboundStop ? add(start, outboundStopDwellAndDetour) : start;
    check(outboundCrossingBase, r.outboundCheckpointOffsetMinutes, 'Outbound');
    check(returnDeparture, r.inboundCheckpointOffsetMinutes, 'Return');
  }

  // Warn on important assumptions, while keeping verified opening-hour
  // conflicts separate from assumed timing uncertainties.
  for (const activity of enabled) {
    if (activity.openingHoursEvidence.level === 'assumption') {
      violation('UNVERIFIED_OPENING_HOURS', 'ADVISORY',
        `${activity.name} operating hours are a planning assumption; verify before travel.`, activity.id);
    }
  }

  // Free leisure is the actual uncovered usable destination time, rather than
  // the difference between home-arrival and the user's return deadline.
  function makeFreeBlocks(from: number, to: number, day: 1 | 2): number {
    if (to <= from) return 0;
    const occupied = timeline
      .filter(item => item.day === day && item.category !== 'FREE')
      .map(item => [Math.max(from, parseIST(item.startTime)), Math.min(to, parseIST(item.endTime))] as const)
      .filter(([a, b]) => b > a).sort((a, b) => a[0] - b[0]);
    let cursor = from;
    let free = 0;
    for (const [begin, end] of occupied) {
      if (begin > cursor) {
        push('FREE', 'Unallocated usable time', cursor, begin, day);
        free += (begin - cursor) / MINUTE_MS;
      }
      cursor = Math.max(cursor, end);
    }
    if (cursor < to) {
      push('FREE', 'Unallocated usable time', cursor, to, day);
      free += (to - cursor) / MINUTE_MS;
    }
    return Math.round(free);
  }
  const destinationSlackMinutes =
    makeFreeBlocks(Math.max(arrived, at(day1, '07:00')), day1FreeEnd, 1) +
    makeFreeBlocks(day2Wake, Math.min(returnDeparture, at(day2, '21:00')), 2);

  timeline.sort((a, b) => parseIST(a.startTime) - parseIST(b.startTime));

  const ticketPerPerson = enabled
    .filter(activity => activityOutcomes.some(outcome => outcome.activityId === activity.id &&
      (outcome.status === 'day1' || outcome.status === 'day2')))
    .reduce((sum, activity) => sum + activity.costPerPersonINR, 0);
  const estimatedTripTotalINR = destination.approximateRoundTripFuelINR +
    destination.approximateRoundTripTollsINR + destination.approximateOneNightStayINR +
    ticketPerPerson * input.partySize;
  const estimatedCostPerPersonINR = Math.round(estimatedTripTotalINR / input.partySize);
  const isBudgetExceeded = estimatedCostPerPersonINR > input.perPersonBudgetINR;
  if (isBudgetExceeded) violation('BUDGET_OVERRUN', 'WARNING',
    `Estimated ₹${estimatedCostPerPersonINR}/person exceeds the ₹${input.perPersonBudgetINR} cap. ` +
    'Not a live price; meals and personal expenses excluded.');

  const hardBlocker = violations.find(v => v.severity === 'BLOCKER');
  let rating: FeasibilityRating;
  let ratingExplanation: string;
  if (hardBlocker || margin < 0) {
    rating = 'Not Recommended';
    ratingExplanation = hardBlocker?.message ?? 'Home arrival exceeds the return deadline.';
  } else if (destinationSlackMinutes < 120 || margin < 120) {
    rating = 'Tight';
    ratingExplanation = 'Less than two hours of usable destination time or return margin.';
  } else {
    rating = 'Comfortable';
    ratingExplanation = 'At least two hours of destination free time and home-arrival margin; estimates are not live traffic.';
  }

  return {
    destinationId: destination.id, rating, ratingExplanation,
    destinationSlackMinutes, returnDeadlineMarginMinutes: margin,
    homeArrivalTime: formatIST(homeArrival),
    outboundDriveMinutes: outboundMinutes, inboundDriveMinutes: inboundMinutes,
    estimatedTripTotalINR, estimatedCostPerPersonINR, isBudgetExceeded,
    violations, activityOutcomes, timeline,
  };
}
