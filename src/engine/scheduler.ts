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

export function dayOf(instant: number): string { return formatIST(instant).slice(0, 10); }
export function nextDay(date: string): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + DAY_MS).toISOString().slice(0, 10);
}
export function at(date: string, hhmm: string): number { return parseIST(`${date}T${hhmm}`); }
export function add(time: number, mins: number): number { return time + mins * MINUTE_MS; }

/** Count inclusive local calendar dates between departure and return deadline. */
export function getCalendarDaysCount(depISO: string, retISO: string): number {
  const depDate = depISO.slice(0, 10);
  const retDate = retISO.slice(0, 10);
  const depTime = Date.parse(`${depDate}T00:00:00Z`);
  const retTime = Date.parse(`${retDate}T00:00:00Z`);
  return Math.round((retTime - depTime) / DAY_MS) + 1;
}

function checkConstraints(input: UserConstraints, destination: Destination): void {
  const departure = parseIST(input.departureDateTime);
  const deadline = parseIST(input.returnDeadlineDateTime);
  if (deadline <= departure) {
    throw new Error('Return time must be after departure time.');
  }
  const numDays = getCalendarDaysCount(input.departureDateTime, input.returnDeadlineDateTime);
  if (numDays < 1 || numDays > 4) {
    throw new Error('Trip window must cover between 1 and 4 calendar dates inclusive.');
  }
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
  const numDays = getCalendarDaysCount(input.departureDateTime, input.returnDeadlineDateTime);

  // Generate date strings for each day (1 to 4 calendar dates)
  const dayDates: string[] = [];
  let dCursor = dayOf(start);
  for (let i = 0; i < numDays; i++) {
    dayDates.push(dCursor);
    dCursor = nextDay(dCursor);
  }

  const p = PACE[input.pace];
  const violations: ConstraintViolation[] = [];
  const activityOutcomes: ActivityOutcome[] = [];
  const timeline: TimetableEntry[] = [];
  let sequence = 0;
  const push = (category: TimelineCategory, label: string, from: number, to: number,
    day: number, activityId?: string, isOptional?: boolean, isCustom?: boolean,
    originLabel?: string, destinationLabel?: string, isRestBuffer?: boolean): void => {
    if (to <= from) return;
    timeline.push({ id: `t${++sequence}`, category, label,
      startTime: formatIST(from), endTime: formatIST(to), day, activityId, isOptional, isCustom,
      originLabel, destinationLabel, isRestBuffer });
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

  // Outbound pitstop
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

  // Activity sorting & filtering
  const combinedActivities = [...destination.activities, ...(input.additionalActivities ?? [])];

  let sorted = [...combinedActivities];
  if (input.activityOrder && input.activityOrder.length > 0) {
    const orderMap = new Map(input.activityOrder.map((id, idx) => [id, idx]));
    sorted.sort((a, b) => {
      const idxA = orderMap.get(a.id);
      const idxB = orderMap.get(b.id);
      if (idxA !== undefined && idxB !== undefined) return idxA - idxB;
      if (idxA !== undefined) return -1;
      if (idxB !== undefined) return 1;
      return Number(a.isOptional) - Number(b.isOptional) || a.priority - b.priority;
    });
  } else {
    sorted.sort((a, b) =>
      Number(a.isOptional) - Number(b.isOptional) || a.priority - b.priority);
  }

  const enabled = sorted.filter(activity => {
    if (activity.isOptional && input.disabledActivityIds.includes(activity.id)) {
      activityOutcomes.push({ activityId: activity.id, status: 'omitted', reason: 'User removed optional activity.' });
      return false;
    }
    return true;
  });

  function getAttemptFailureReason(activity: Activity, cursor: number, date: string, endCap: number): string {
    const customization = input.activityCustomizations?.[activity.id];
    const durationMinutes = customization?.durationMinutes ?? activity.durationMinutes;
    const transferMinutes = customization?.transferMinutes !== undefined
      ? customization.transferMinutes
      : (input.transferAdjustments?.[activity.id] !== undefined
          ? input.transferAdjustments[activity.id]
          : activity.localTransferMinutes);

    if (customization?.startTime) {
      const explicitStart = customization.startTime.includes('T')
        ? parseIST(customization.startTime)
        : at(date, customization.startTime);
      const reqTransferStart = add(explicitStart, -transferMinutes);
      if (reqTransferStart < cursor) {
        return `Transfer needs to start at ${formatIST(reqTransferStart).slice(11)}, which conflicts with previous activity ending at ${formatIST(cursor).slice(11)}.`;
      }
      const opening = at(date, activity.openTime);
      const closing = at(date, activity.closeTime);
      const lastEntry = activity.lastEntryTime ? at(date, activity.lastEntryTime) : closing;
      if (explicitStart < opening) {
        return `Visit starts at ${formatIST(explicitStart).slice(11)}, which is before opening time ${activity.openTime}.`;
      }
      if (explicitStart > lastEntry) {
        return `Visit start at ${formatIST(explicitStart).slice(11)} is past last entry cutoff ${activity.lastEntryTime || activity.closeTime}.`;
      }
      if (add(explicitStart, durationMinutes) > closing) {
        return `Visit finishes at ${formatIST(add(explicitStart, durationMinutes)).slice(11)}, which is past closing time ${activity.closeTime}.`;
      }
      if (add(explicitStart, durationMinutes) > endCap) {
        return `Visit extends past scheduled day limit (${formatIST(endCap).slice(11)}).`;
      }
    }

    const transferEnd = add(cursor, transferMinutes);
    const opening = at(date, activity.openTime);
    const closing = at(date, activity.closeTime);
    const lastEntry = activity.lastEntryTime ? at(date, activity.lastEntryTime) : closing;
    const begin = Math.max(transferEnd, opening);
    const finish = add(begin, durationMinutes);
    if (cursor >= endCap) {
      return `Planning window for the day is already full (reached ${formatIST(endCap).slice(11)}).`;
    }
    if (begin > lastEntry) {
      return `Arrival at ${formatIST(begin).slice(11)} is past last entry cutoff ${activity.lastEntryTime || activity.closeTime}.`;
    }
    if (finish > closing) {
      return `Visit finishes at ${formatIST(finish).slice(11)}, which is past closing time ${activity.closeTime}.`;
    }
    if (finish > endCap) {
      return `Visit extends past scheduled day limit (${formatIST(endCap).slice(11)}).`;
    }
    return 'Operating or transfer constraint exceeded.';
  }

  function attempt(activity: Activity, cursor: number, date: string,
    endCap: number, day: number): number | undefined {
    if (cursor >= endCap) return undefined;

    const customization = input.activityCustomizations?.[activity.id];
    const durationMinutes = customization?.durationMinutes ?? activity.durationMinutes;
    const transferMinutes = customization?.transferMinutes !== undefined
      ? customization.transferMinutes
      : (input.transferAdjustments?.[activity.id] !== undefined
          ? input.transferAdjustments[activity.id]
          : activity.localTransferMinutes);

    const opening = at(date, activity.openTime);
    const closing = at(date, activity.closeTime);
    const lastEntry = activity.lastEntryTime ? at(date, activity.lastEntryTime) : closing;

    let transferStart = cursor;
    let begin: number;
    let finish: number;

    if (customization?.startTime) {
      const explicitStart = customization.startTime.includes('T')
        ? parseIST(customization.startTime)
        : at(date, customization.startTime);
      const reqTransferStart = add(explicitStart, -transferMinutes);

      if (reqTransferStart < cursor) {
        violation(
          'COLLISION_CONFLICT',
          'BLOCKER',
          `Cannot fit "${activity.name}": transfer needs to start at ${formatIST(reqTransferStart).slice(11)}, which conflicts with previous activity ending at ${formatIST(cursor).slice(11)}.`,
          activity.id
        );
        return undefined;
      }

      if (reqTransferStart > cursor) {
        // Preserve preceding free time between cursor and transfer start
        const dateStr = formatIST(cursor).slice(0, 10);
        const sunsetEpoch = at(dateStr, '18:15');
        if (cursor < sunsetEpoch && reqTransferStart > sunsetEpoch) {
          push('FREE', 'Daytime free time', cursor, sunsetEpoch, day);
          push('FREE', 'Evening free time', sunsetEpoch, reqTransferStart, day);
        } else if (reqTransferStart <= sunsetEpoch) {
          push('FREE', 'Daytime free time', cursor, reqTransferStart, day);
        } else {
          push('FREE', 'Evening free time', cursor, reqTransferStart, day);
        }
      }

      transferStart = reqTransferStart;
      begin = explicitStart;
      finish = add(begin, durationMinutes);

      if (begin < opening) {
        violation(
          'OPERATING_HOURS_CONFLICT',
          'BLOCKER',
          `"${activity.name}" opens at ${activity.openTime}, but requested visit starts at ${formatIST(begin).slice(11)}.`,
          activity.id
        );
        return undefined;
      }
      if (begin > lastEntry) {
        violation(
          'OPERATING_HOURS_CONFLICT',
          'BLOCKER',
          `Arrival at ${formatIST(begin).slice(11)} is past last entry cutoff ${activity.lastEntryTime || activity.closeTime} for ${activity.name}.`,
          activity.id
        );
        return undefined;
      }
      if (finish > closing) {
        violation(
          'OPERATING_HOURS_CONFLICT',
          'BLOCKER',
          `Visit for "${activity.name}" finishes at ${formatIST(finish).slice(11)}, which is past closing time ${activity.closeTime}.`,
          activity.id
        );
        return undefined;
      }
      if (finish > endCap) {
        violation(
          'OPERATING_HOURS_CONFLICT',
          'BLOCKER',
          `"${activity.name}" visit extends past scheduled day limit (${formatIST(endCap).slice(11)}).`,
          activity.id
        );
        return undefined;
      }
    } else {
      const transferEnd = add(cursor, transferMinutes);
      begin = Math.max(transferEnd, opening);
      finish = add(begin, durationMinutes);
      if (begin > lastEntry || finish > closing || finish > endCap) return undefined;
    }

    const prevEntry = [...timeline].reverse().find(t => t.day === day && t.category !== 'FREE');
    const originLabel = prevEntry ? prevEntry.label : (day === 1 ? 'Hotel check-in' : 'Hotel / Overnight stay');

    push('TRANSFER', `Local transfer to ${activity.name}`, transferStart, begin, day, activity.id, undefined, undefined, originLabel, activity.name);
    if (!customization?.startTime && add(cursor, transferMinutes) < begin) {
      push('WAIT', `Wait for ${activity.name} to open`, add(cursor, transferMinutes), begin, day, activity.id);
    }
    push('ACTIVITY', activity.name, begin, finish, day, activity.id, activity.isOptional);
    activityOutcomes.push({ activityId: activity.id, status: `day${day}` as any });

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
  let returnDeparture = 0;

  // ===== SINGLE-DAY ESCAPE (numDays === 1) =====
  if (numDays === 1) {
    const dayDate = dayDates[0];
    const latestReturnDeparture = add(deadline, -inboundMinutes);
    const preferredReturnDeparture = Math.min(at(dayDate, '17:00'), add(latestReturnDeparture, -120));

    let cursor = arrived;

    // Check if arrived is already past return departure deadline
    if (arrived > latestReturnDeparture) {
      violation('MISSED_DEADLINE', 'BLOCKER',
        `Outbound drive arrives at ${formatIST(arrived).slice(11)}, which is already after the latest return departure time ${formatIST(latestReturnDeparture).slice(11)}.`);
    }

    // Attempt activities on same day
    for (const activity of enabled) {
      const next = attempt(activity, cursor, dayDate, latestReturnDeparture, 1);
      if (next === undefined) {
        remaining.push(activity);
      } else {
        cursor = next;
      }
    }

    // Midday dining allowance if traveler is present during lunchtime
    const noonStart = at(dayDate, '12:30');
    if (arrived < noonStart && cursor < latestReturnDeparture) {
      const lunchStart = Math.max(cursor, noonStart);
      const lunchEnd = add(lunchStart, 45);
      if (lunchEnd <= latestReturnDeparture) {
        push('MEAL', 'Lunch (estimated)', lunchStart, lunchEnd, 1);
        cursor = lunchEnd;
      }
    }

    for (const activity of remaining) {
      activityOutcomes.push({
        activityId: activity.id,
        status: activity.isOptional ? 'omitted' : 'unavailable',
        reason: 'Cannot fit within single-day trip schedule before return departure.',
      });
      if (!activity.isOptional) {
        violation('REQUIRED_ACTIVITY_UNAVAILABLE', 'BLOCKER',
          `${activity.name} cannot fit on same-day trip before return deadline; consider an overnight stay.`, activity.id);
      }
    }

    returnDeparture = Math.max(preferredReturnDeparture, cursor);
  }

  // ===== MULTI-DAY ESCAPES (numDays >= 2) =====
  else {
    const day1 = dayDates[0];
    const restStart1 = at(day1, '22:00');
    const day1FreeEnd = at(day1, '21:00');

    if (arrived > restStart1) {
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

    // Day 1 activities:
    // Activities explicitly assigned to Day 1, or unassigned activities (defaulting to Day 1)
    const day1Activities = enabled.filter(a => {
      const assigned = input.activityDayAssignments?.[a.id];
      return assigned === undefined || assigned === 1;
    });
    const laterDayActivities = enabled.filter(a => {
      const assigned = input.activityDayAssignments?.[a.id];
      return assigned !== undefined && assigned > 1;
    });

    for (const activity of day1Activities) {
      const next = attempt(activity, day1Cursor, day1, day1FreeEnd, 1);
      if (next === undefined) {
        const isExplicitlyAssignedToDay1 = input.activityDayAssignments?.[activity.id] === 1;
        const failReason = getAttemptFailureReason(activity, day1Cursor, day1, day1FreeEnd);
        if (isExplicitlyAssignedToDay1) {
          violation('OPERATING_HOURS_CONFLICT', 'BLOCKER',
            `${activity.name} cannot fit on Day 1: ${failReason}`, activity.id);
          activityOutcomes.push({ activityId: activity.id, status: 'unavailable', reason: failReason });
        } else {
          remaining.push(activity);
        }
      } else {
        day1Cursor = next;
      }
    }

    remaining.push(...laterDayActivities);

    // Day 1 Dinner & Overnight Rest
    const dinnerStart = day1FreeEnd;
    const dinnerEnd = add(dinnerStart, p.eveningMealMinutes);
    if (day1Cursor > dinnerStart) {
      violation('REST_CONFLICT', 'BLOCKER', 'Day 1 activities/check-in extend past the evening meal anchor.');
    }
    push('MEAL', 'Dinner (estimated)', dinnerStart, dinnerEnd, 1);
    if (dinnerEnd > restStart1) {
      violation('REST_CONFLICT', 'BLOCKER', 'Dinner exceeds the 10 PM sleep anchor.');
    }
    const day2Wake = at(dayDates[1], '07:00');
    push('REST', 'Overnight rest', restStart1, day2Wake, 1);

    // ===== INTERMEDIATE DAYS (Days 2 to numDays - 1 for 3 or 4 day trips) =====
    if (numDays > 2) {
      for (let d = 2; d < numDays; d++) {
        const curDate = dayDates[d - 1];
        const nextDate = dayDates[d];
        const wakeTime = at(curDate, '07:00');
        const breakfastEnd = add(wakeTime, p.breakfastMinutes);
        push('MEAL', 'Breakfast (estimated)', wakeTime, breakfastEnd, d);

        let dCursorTime = breakfastEnd;
        const lunchStart = at(curDate, '12:30');
        const dFreeEnd = at(curDate, '21:00');
        const dRestStart = at(curDate, '22:00');

        // Attempt activities assigned to day d, plus unassigned activities in remaining
        const dayDActivities = remaining.filter(a => {
          const assigned = input.activityDayAssignments?.[a.id];
          return assigned === d || assigned === undefined;
        });
        const notTodayActivities = remaining.filter(a => {
          const assigned = input.activityDayAssignments?.[a.id];
          return assigned !== undefined && assigned !== d;
        });

        const stillRemaining: Activity[] = [];
        for (const activity of dayDActivities) {
          const next = attempt(activity, dCursorTime, curDate, dFreeEnd, d);
          if (next === undefined) {
            const isExplicitlyAssigned = input.activityDayAssignments?.[activity.id] === d;
            const failReason = getAttemptFailureReason(activity, dCursorTime, curDate, dFreeEnd);
            if (isExplicitlyAssigned) {
              violation('OPERATING_HOURS_CONFLICT', 'BLOCKER',
                `${activity.name} cannot fit on Day ${d}: ${failReason}`, activity.id);
              activityOutcomes.push({ activityId: activity.id, status: 'unavailable', reason: failReason });
            } else {
              stillRemaining.push(activity);
            }
          } else {
            dCursorTime = next;
          }
        }
        remaining.length = 0;
        remaining.push(...notTodayActivities, ...stillRemaining);

        // Schedule lunch on intermediate day
        const actualLunchStart = Math.max(dCursorTime, lunchStart);
        const actualLunchEnd = add(actualLunchStart, 45);
        if (actualLunchEnd <= dFreeEnd) {
          push('MEAL', 'Lunch (estimated)', actualLunchStart, actualLunchEnd, d);
          dCursorTime = actualLunchEnd;
        }

        // Intermediate Day Dinner & Overnight Rest
        const dDinnerEnd = add(dFreeEnd, p.eveningMealMinutes);
        push('MEAL', 'Dinner (estimated)', dFreeEnd, dDinnerEnd, d);
        const nextWake = at(nextDate, '07:00');
        push('REST', 'Overnight rest', dRestStart, nextWake, d);
      }
    }

    // ===== FINAL DAY (Day numDays) =====
    const finalDay = numDays;
    const finalDate = dayDates[finalDay - 1];
    const finalWake = at(finalDate, '07:00');
    const finalBreakfastEnd = add(finalWake, p.breakfastMinutes);
    push('MEAL', 'Breakfast (estimated)', finalWake, finalBreakfastEnd, finalDay);

    const latestReturnDeparture = add(deadline, -inboundMinutes);
    const preferredReturnDeparture = Math.min(at(finalDate, '15:00'),
      add(latestReturnDeparture, -120));

    let finalCursor = finalBreakfastEnd;
    let finalLunchDone = false;
    const finalLunchDuration = 45;
    const finalLunchStart = at(finalDate, '12:00');

    const takeLunch = (from: number): number => {
      const lStart = Math.max(from, finalLunchStart);
      const lEnd = add(lStart, finalLunchDuration);
      push('MEAL', 'Lunch (estimated)', lStart, lEnd, finalDay);
      finalLunchDone = true;
      return lEnd;
    };

    const finalDayActivities = remaining.filter(a => {
      const assigned = input.activityDayAssignments?.[a.id];
      return assigned === finalDay || assigned === undefined;
    });
    const invalidDayActivities = remaining.filter(a => {
      const assigned = input.activityDayAssignments?.[a.id];
      return assigned !== undefined && assigned !== finalDay;
    });

    for (const a of invalidDayActivities) {
      const assigned = input.activityDayAssignments?.[a.id];
      violation('INVALID_INPUT', 'BLOCKER',
        `${a.name} is assigned to Day ${assigned} which exceeds the ${numDays}-day trip duration.`, a.id);
      activityOutcomes.push({ activityId: a.id, status: 'unavailable', reason: `Trip has only ${numDays} days.` });
    }

    const finalRemaining: Activity[] = [];
    for (const activity of finalDayActivities) {
      const endCap = activity.isOptional ? preferredReturnDeparture : latestReturnDeparture;
      const transferMinutes = input.transferAdjustments?.[activity.id] !== undefined
        ? input.transferAdjustments[activity.id]
        : activity.localTransferMinutes;
      const earliestStart = Math.max(add(finalCursor, transferMinutes), at(finalDate, activity.openTime));
      if (!finalLunchDone && earliestStart >= finalLunchStart &&
          add(Math.max(finalCursor, finalLunchStart), finalLunchDuration) < endCap) {
        finalCursor = takeLunch(finalCursor);
      }
      const next = attempt(activity, finalCursor, finalDate, endCap, finalDay);
      if (next === undefined) {
        const isExplicit = input.activityDayAssignments?.[activity.id] === finalDay;
        const failReason = getAttemptFailureReason(activity, finalCursor, finalDate, endCap);
        if (isExplicit) {
          violation('OPERATING_HOURS_CONFLICT', 'BLOCKER',
            `${activity.name} cannot fit on Day ${finalDay}: ${failReason}`, activity.id);
          activityOutcomes.push({ activityId: activity.id, status: 'unavailable', reason: failReason });
        } else {
          finalRemaining.push(activity);
        }
      } else {
        finalCursor = next;
      }
    }

    for (const activity of finalRemaining) {
      activityOutcomes.push({
        activityId: activity.id,
        status: activity.isOptional ? 'omitted' : 'unavailable',
        reason: 'Full visit cannot fit within the planning windows across trip days.',
      });
      if (!activity.isOptional) {
        const dataQualifier = activity.openingHoursEvidence.level === 'official'
          ? 'published opening hours' : 'unverified planning hours';
        violation('REQUIRED_ACTIVITY_UNAVAILABLE', 'BLOCKER',
          `${activity.name} cannot fit using ${dataQualifier}; verify before travel.`, activity.id);
      }
    }

    if (!finalLunchDone && preferredReturnDeparture > add(finalLunchStart, finalLunchDuration) &&
        finalCursor < latestReturnDeparture) {
      const lStart = Math.max(finalCursor, finalLunchStart);
      if (add(lStart, finalLunchDuration) <= latestReturnDeparture) {
        finalCursor = takeLunch(finalCursor);
      }
    }

    returnDeparture = Math.max(preferredReturnDeparture, finalCursor);
  }

  // ===== RETURN LEG (On Final Day) =====
  const finalDayIndex = numDays;
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

    push('DRIVE', `Return drive towards Bengaluru (Leg 1, incl. ${retLeg1Buffer}m buffer)`, returnDeparture, retStopArrival, finalDayIndex);
    push(
      'PITSTOP',
      `${returnStop.name} (${returnStop.dwellMinutes}m dwell + ${returnStop.detourMinutes}m detour)`,
      retStopArrival,
      retStopDeparture,
      finalDayIndex
    );
    push('DRIVE', `Return to Bengaluru (Leg 2, incl. ${retLeg2Buffer}m buffer)`, retStopDeparture, homeArrival, finalDayIndex);
  } else {
    homeArrival = add(returnDeparture, inboundMinutes);
    push('DRIVE', `Return to Bengaluru (incl. ${driveContingency}m planning buffer)`,
      returnDeparture, homeArrival, finalDayIndex);
  }

  const margin = Math.round((deadline - homeArrival) / MINUTE_MS);
  if (margin < 0) {
    violation('MISSED_DEADLINE', 'BLOCKER',
      `Estimated home arrival ${formatIST(homeArrival)} is ${-margin} minutes after the requested deadline.`);
  }

  // Route restrictions check (e.g. Bandipur night curfew)
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

  // Advisories for assumption-level operating hours
  for (const activity of enabled) {
    if (activity.openingHoursEvidence.level === 'assumption') {
      violation('UNVERIFIED_OPENING_HOURS', 'ADVISORY',
        `${activity.name} operating hours are a planning assumption; verify before travel.`, activity.id);
    }
  }

  const customActivities = [...(input.customActivities ?? [])];

  // Free leisure blocks: generated per day for daytime unallocated hours.
  // Inserts user-planned custom activities into available free slots and calculates remaining slack time.
  function makeFreeBlocks(from: number, to: number, day: number): number {
    if (to <= from) return 0;
    const occupied = timeline
      .filter(item => item.day === day && item.category !== 'FREE')
      .map(item => [Math.max(from, parseIST(item.startTime)), Math.min(to, parseIST(item.endTime))] as const)
      .filter(([a, b]) => b > a).sort((a, b) => a[0] - b[0]);

    const rawWindows: Array<{ begin: number; end: number }> = [];
    let cursor = from;
    for (const [begin, end] of occupied) {
      if (begin > cursor) {
        rawWindows.push({ begin: cursor, end: begin });
      }
      cursor = Math.max(cursor, end);
    }
    if (cursor < to) {
      rawWindows.push({ begin: cursor, end: to });
    }

    let freeMinutes = 0;
    const dayCustoms = customActivities.filter(ca => ca.day === day);

    for (const win of rawWindows) {
      let winCursor = win.begin;
      const winEnd = win.end;

      // Find matching custom activities for this slot (by slotStart or next available)
      while (dayCustoms.length > 0 && winEnd > winCursor) {
        const matchingIdx = dayCustoms.findIndex(ca => {
          if (!ca.durationMinutes || ca.durationMinutes <= 0) return false;
          if (ca.slotStart) {
            const visitEpoch = parseIST(ca.slotStart);
            const trMins = ca.transferMinutes ?? 0;
            const trStart = add(visitEpoch, -trMins);
            return (trStart >= winCursor && trStart < winEnd) || (visitEpoch >= winCursor && visitEpoch < winEnd);
          }
          return true;
        });

        if (matchingIdx === -1) break;

        const [matching] = dayCustoms.splice(matchingIdx, 1);
        // Also remove from outer customActivities
        const outerIdx = customActivities.indexOf(matching);
        if (outerIdx !== -1) customActivities.splice(outerIdx, 1);

        const transferMins = matching.transferMinutes ?? 0;
        let visitStartEpoch: number;
        let transferStartEpoch: number;

        if (matching.slotStart) {
          const reqEpoch = parseIST(matching.slotStart);
          if (reqEpoch === winCursor) {
            // Anchored to the start of the free window: transfer starts at window start
            transferStartEpoch = winCursor;
            visitStartEpoch = add(transferStartEpoch, transferMins);
          } else {
            // Explicit user-chosen visit start time
            visitStartEpoch = reqEpoch;
            transferStartEpoch = add(visitStartEpoch, -transferMins);
          }
        } else {
          transferStartEpoch = winCursor;
          visitStartEpoch = add(transferStartEpoch, transferMins);
        }

        const visitEndEpoch = add(visitStartEpoch, matching.durationMinutes);
        const dateStr = formatIST(visitStartEpoch).slice(0, 10);

        // Check 1: Collision with previous activity
        if (transferStartEpoch < winCursor) {
          violation(
            'COLLISION_CONFLICT',
            'BLOCKER',
            `Cannot fit "${matching.name}": transfer needs to start at ${formatIST(transferStartEpoch).slice(11)}, which conflicts with previous activity ending at ${formatIST(winCursor).slice(11)}.`,
            matching.id
          );
          continue;
        }

        // Check 2: Exceeding window boundary
        if (visitEndEpoch > winEnd) {
          violation(
            'OPERATING_HOURS_CONFLICT',
            'BLOCKER',
            `Cannot fit "${matching.name}": visit finishes at ${formatIST(visitEndEpoch).slice(11)}, which exceeds the available free window (ending at ${formatIST(winEnd).slice(11)}).`,
            matching.id
          );
          continue;
        }

        // Check 3: Operating hours if provided
        if (matching.openTime) {
          const openEpoch = at(dateStr, matching.openTime);
          if (visitStartEpoch < openEpoch) {
            violation(
              'OPERATING_HOURS_CONFLICT',
              'BLOCKER',
              `"${matching.name}" opens at ${matching.openTime}, but requested visit starts at ${formatIST(visitStartEpoch).slice(11)}.`,
              matching.id
            );
            continue;
          }
        }
        if (matching.closeTime) {
          const closeEpoch = at(dateStr, matching.closeTime);
          if (visitEndEpoch > closeEpoch) {
            violation(
              'OPERATING_HOURS_CONFLICT',
              'BLOCKER',
              `"${matching.name}" closes at ${matching.closeTime}, but requested visit ends at ${formatIST(visitEndEpoch).slice(11)}.`,
              matching.id
            );
            continue;
          }
        }
        if (matching.lastEntryTime) {
          const lastEntryEpoch = at(dateStr, matching.lastEntryTime);
          if (visitStartEpoch > lastEntryEpoch) {
            violation(
              'OPERATING_HOURS_CONFLICT',
              'BLOCKER',
              `Visit start at ${formatIST(visitStartEpoch).slice(11)} is past last entry cutoff ${matching.lastEntryTime} for "${matching.name}".`,
              matching.id
            );
            continue;
          }
        }

        // If requested transfer start time is after winCursor, preserve preceding free time
        if (transferStartEpoch > winCursor) {
          const sunsetEpoch = at(dateStr, '18:15');
          if (winCursor < sunsetEpoch && transferStartEpoch > sunsetEpoch) {
            push('FREE', 'Daytime free time', winCursor, sunsetEpoch, day);
            push('FREE', 'Evening free time', sunsetEpoch, transferStartEpoch, day);
          } else if (transferStartEpoch <= sunsetEpoch) {
            push('FREE', 'Daytime free time', winCursor, transferStartEpoch, day);
          } else {
            push('FREE', 'Evening free time', winCursor, transferStartEpoch, day);
          }
          freeMinutes += (transferStartEpoch - winCursor) / MINUTE_MS;
          winCursor = transferStartEpoch;
        }

        // Push transfer if transferMins > 0
        if (transferMins > 0) {
          const prevEntry = [...timeline].reverse().find(t => t.day === day && t.category !== 'FREE');
          const originLabel = prevEntry ? prevEntry.label : (day === 1 ? 'Hotel check-in' : 'Hotel / Overnight stay');
          push('TRANSFER', `Local transfer to ${matching.name}`, transferStartEpoch, visitStartEpoch, day, matching.id, undefined, undefined, originLabel, matching.name);
        }

        // Push activity or rest buffer
        const isRest = Boolean(
          matching.isRestBuffer ||
          matching.name.toLowerCase().includes('buffer') ||
          matching.name.toLowerCase().includes('rest') ||
          matching.name.toLowerCase().includes('downtime')
        );
        const cat: TimelineCategory = isRest ? 'REST' : 'ACTIVITY';
        push(cat, matching.name, visitStartEpoch, visitEndEpoch, day, matching.id, true, true, undefined, undefined, isRest);
        winCursor = visitEndEpoch;
      }

      if (winEnd > winCursor) {
        const dateStr = formatIST(winCursor).slice(0, 10);
        const sunsetEpoch = at(dateStr, '18:15');

        if (winCursor < sunsetEpoch && winEnd > sunsetEpoch) {
          push('FREE', 'Daytime free time', winCursor, sunsetEpoch, day);
          push('FREE', 'Evening free time', sunsetEpoch, winEnd, day);
        } else if (winEnd <= sunsetEpoch) {
          push('FREE', 'Daytime free time', winCursor, winEnd, day);
        } else {
          push('FREE', 'Evening free time', winCursor, winEnd, day);
        }
        freeMinutes += (winEnd - winCursor) / MINUTE_MS;
      }
    }

    return Math.round(freeMinutes);
  }

  let totalSlackMinutes = 0;
  if (numDays === 1) {
    totalSlackMinutes += makeFreeBlocks(Math.max(arrived, at(dayDates[0], '07:00')), returnDeparture, 1);
  } else {
    // Day 1
    totalSlackMinutes += makeFreeBlocks(Math.max(arrived, at(dayDates[0], '07:00')), at(dayDates[0], '21:00'), 1);
    // Intermediate days
    for (let d = 2; d < numDays; d++) {
      totalSlackMinutes += makeFreeBlocks(at(dayDates[d - 1], '07:00'), at(dayDates[d - 1], '21:00'), d);
    }
    // Final day
    totalSlackMinutes += makeFreeBlocks(at(dayDates[numDays - 1], '07:00'), Math.min(returnDeparture, at(dayDates[numDays - 1], '21:00')), numDays);
  }
  const destinationSlackMinutes = totalSlackMinutes;

  // Check for any unplaced custom activities
  for (const ca of customActivities) {
    const timeLabel = ca.slotStart ? ca.slotStart.slice(11) : 'unspecified';
    violation(
      'COLLISION_CONFLICT',
      'BLOCKER',
      `Cannot fit "${ca.name}" at requested time ${timeLabel}: conflicts with previously scheduled activities or trip milestones.`,
      ca.id
    );
    activityOutcomes.push({
      activityId: ca.id,
      status: 'unavailable',
      reason: 'Collides with scheduled activities or falls outside available free windows.',
    });
  }

  timeline.sort((a, b) => parseIST(a.startTime) - parseIST(b.startTime));

  const customActivitiesCost = (input.customActivities ?? []).reduce(
    (sum, ca) => sum + (ca.costPerPersonINR ?? 0),
    0
  );

  const ticketPerPerson = enabled
    .filter(activity => activityOutcomes.some(outcome => outcome.activityId === activity.id &&
      outcome.status !== 'omitted' && outcome.status !== 'unavailable'))
    .reduce((sum, activity) => sum + activity.costPerPersonINR, 0) + customActivitiesCost;

  // Number of overnight stays is (numDays - 1)
  const numNights = Math.max(0, numDays - 1);
  const hotelTotalINR = destination.approximateOneNightStayINR * numNights * Math.ceil(input.partySize / 2);

  const estimatedTripTotalINR = destination.approximateRoundTripFuelINR +
    destination.approximateRoundTripTollsINR + hotelTotalINR +
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
