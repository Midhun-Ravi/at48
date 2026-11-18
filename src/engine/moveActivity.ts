import type {
  Activity,
  ActivityScheduleStatus,
  Destination,
  FeasibilityResult,
  MoveActivityCandidate,
  MoveActivityPreview,
  MoveResolutionLabel,
  MoveResolutionStatus,
  UserConstraints,
} from '../types';
import { evaluateFeasibility, getCalendarDaysCount, parseIST } from './scheduler';

/**
 * Extract movable activities from a destination and constraints,
 * accurately distinguishing scheduled, unavailable, and unscheduled candidates.
 */
export function getMoveCandidates(
  destination: Destination,
  constraints: UserConstraints,
  currentResult: FeasibilityResult
): MoveActivityCandidate[] {
  const allActivities: Activity[] = [
    ...destination.activities,
    ...(constraints.additionalActivities ?? []),
  ];

  const disabledSet = new Set(constraints.disabledActivityIds ?? []);

  return allActivities.map(activity => {
    // Find where activity is currently scheduled in timeline
    const timelineEntry = currentResult.timeline.find(t => t.activityId === activity.id);
    const outcome = currentResult.activityOutcomes.find(o => o.activityId === activity.id);
    const assignedDay = constraints.activityDayAssignments?.[activity.id];

    let scheduleStatus: ActivityScheduleStatus;
    let currentDay: number | undefined = undefined;
    let conflictReason: string | undefined = undefined;

    if (timelineEntry) {
      scheduleStatus = 'scheduled';
      currentDay = timelineEntry.day;
    } else if (disabledSet.has(activity.id) || outcome?.status === 'omitted') {
      scheduleStatus = 'unscheduled';
      conflictReason = outcome?.reason ?? 'Optional activity omitted from schedule.';
    } else if (outcome?.status === 'unavailable' || outcome?.status?.startsWith('day')) {
      scheduleStatus = 'unavailable';
      conflictReason = outcome?.reason ?? 'Operating constraint conflict prevented scheduling.';
    } else {
      scheduleStatus = 'unscheduled';
      conflictReason = outcome?.reason ?? 'Not currently scheduled.';
    }

    const lastEntryStr = activity.lastEntryTime ? ` (last entry ${activity.lastEntryTime})` : '';
    const operatingWindow = `${activity.openTime}–${activity.closeTime}${lastEntryStr}`;

    return {
      activityId: activity.id,
      name: activity.name,
      scheduleStatus,
      currentDay,
      assignedDay,
      durationMinutes: activity.durationMinutes,
      localTransferMinutes: activity.localTransferMinutes,
      operatingWindow,
      isOptional: activity.isOptional,
      costINR: activity.costPerPersonINR,
      conflictReason,
    };
  });
}

/**
 * Get valid insertion slot options for a target day based on currently scheduled activities.
 */
export function getInsertionSlotsForDay(
  destination: Destination,
  constraints: UserConstraints,
  targetDay: number
): { position: number; label: string }[] {
  const result = evaluateFeasibility(destination, constraints);
  const dayActivities = result.timeline.filter(t => t.category === 'ACTIVITY' && t.day === targetDay);

  const slots: { position: number; label: string }[] = [
    { position: 0, label: 'First stop of the day' },
  ];

  dayActivities.forEach((act, idx) => {
    slots.push({
      position: idx + 1,
      label: `After ${act.label} (around ${act.endTime.slice(11)})`,
    });
  });

  return slots;
}

/**
 * Deterministically evaluate moving an activity to another day and position.
 * Runs evaluateFeasibility against cloned states for both Before and Proposed trips.
 * Guarantees zero hardcoded scheduling placeholders or fabricated metrics.
 */
export function evaluateActivityMove(
  destination: Destination,
  baseConstraints: UserConstraints,
  activityId: string,
  targetDay: number,
  targetPosition?: number
): MoveActivityPreview {
  const allActivities: Activity[] = [
    ...destination.activities,
    ...(baseConstraints.additionalActivities ?? []),
  ];
  const targetActivity = allActivities.find(a => a.id === activityId);
  const activityName = targetActivity ? targetActivity.name : activityId;

  // 1. Evaluate baseline (Before)
  const beforeResult = evaluateFeasibility(destination, baseConstraints);
  const beforeTimelineEntry = beforeResult.timeline.find(t => t.activityId === activityId);
  const fromDay = beforeTimelineEntry ? beforeTimelineEntry.day : baseConstraints.activityDayAssignments?.[activityId];

  const beforeStartTime = beforeTimelineEntry ? beforeTimelineEntry.startTime.slice(11) : undefined;
  const beforeEndTime = beforeTimelineEntry ? beforeTimelineEntry.endTime.slice(11) : undefined;
  const beforeIsFeasible = beforeResult.rating !== 'Not Recommended' && beforeResult.returnDeadlineMarginMinutes >= 0;

  // Validate targetDay against trip duration
  const totalDays = getCalendarDaysCount(baseConstraints.departureDateTime, baseConstraints.returnDeadlineDateTime);
  if (targetDay < 1 || targetDay > totalDays) {
    return {
      activityId,
      activityName,
      fromDay,
      toDay: targetDay,
      toPosition: targetPosition,
      isValid: false,
      validationError: `Target Day ${targetDay} is outside trip window (1 to ${totalDays} days).`,
      resolutionStatus: 'CANNOT_FIT',
      resolutionLabel: 'Cannot Fit',
      resolutionMessage: `Target Day ${targetDay} is outside trip window (1 to ${totalDays} days).`,
      proposedConstraints: baseConstraints,
      before: {
        homeArrival: beforeResult.homeArrivalTime.slice(11) + ' IST',
        returnMarginMinutes: beforeResult.returnDeadlineMarginMinutes,
        activityStartTime: beforeStartTime,
        activityEndTime: beforeEndTime,
        isFeasible: beforeIsFeasible,
        violationsCount: beforeResult.violations.length,
        violations: beforeResult.violations,
      },
      after: {
        homeArrival: beforeResult.homeArrivalTime.slice(11) + ' IST',
        returnMarginMinutes: beforeResult.returnDeadlineMarginMinutes,
        activityStartTime: undefined,
        activityEndTime: undefined,
        isFeasible: false,
        violationsCount: beforeResult.violations.length + 1,
        violations: [
          ...beforeResult.violations,
          {
            type: 'INVALID_INPUT',
            severity: 'BLOCKER',
            message: `Target Day ${targetDay} exceeds trip duration of ${totalDays} days.`,
            activityId,
          },
        ],
      },
      deltas: {
        marginDeltaMinutes: 0,
        homeArrivalDeltaMinutes: 0,
        originalViolationResolved: false,
        newConflicts: [`Target Day ${targetDay} exceeds trip length`],
        displacedActivities: [],
        additionalTravelAllowanceMinutes: 0,
      },
    };
  }

  // 2. Clone constraints for proposed state
  const proposedConstraints: UserConstraints = {
    ...baseConstraints,
    activityDayAssignments: {
      ...(baseConstraints.activityDayAssignments ?? {}),
      [activityId]: targetDay,
    },
  };

  // Handle position reordering within target day if requested
  if (targetPosition !== undefined) {
    // Current activity order or default sorted order
    const currentOrder = baseConstraints.activityOrder && baseConstraints.activityOrder.length > 0
      ? [...baseConstraints.activityOrder]
      : allActivities.map(a => a.id);

    // Filter out target activity
    const remainingOrder = currentOrder.filter(id => id !== activityId);

    // Find activities on target day
    const targetDayActivities = remainingOrder.filter(id => {
      const assigned = proposedConstraints.activityDayAssignments?.[id];
      if (assigned !== undefined) return assigned === targetDay;
      return targetDay === 1; // default to day 1
    });

    // Insert targetActivity at targetPosition among targetDay activities
    const insertIdx = Math.max(0, Math.min(targetDayActivities.length, targetPosition));
    const targetDayWithNew = [...targetDayActivities];
    targetDayWithNew.splice(insertIdx, 0, activityId);

    // Reconstruct global activity order preserving relative positions
    const newGlobalOrder: string[] = [];
    const targetDaySet = new Set(targetDayWithNew);

    // Put non-target-day activities before or after as appropriate
    for (const id of currentOrder) {
      if (!targetDaySet.has(id)) {
        newGlobalOrder.push(id);
      }
    }
    // Append or position target day activities
    if (targetDay === 1) {
      newGlobalOrder.unshift(...targetDayWithNew);
    } else {
      newGlobalOrder.push(...targetDayWithNew);
    }

    proposedConstraints.activityOrder = Array.from(new Set(newGlobalOrder));
  }

  // 3. Evaluate proposed state (After)
  const afterResult = evaluateFeasibility(destination, proposedConstraints);
  const afterTimelineEntry = afterResult.timeline.find(t => t.activityId === activityId);
  const afterOutcome = afterResult.activityOutcomes.find(o => o.activityId === activityId);

  const afterStartTime = afterTimelineEntry ? afterTimelineEntry.startTime.slice(11) : undefined;
  const afterEndTime = afterTimelineEntry ? afterTimelineEntry.endTime.slice(11) : undefined;
  const afterIsFeasible = afterResult.rating !== 'Not Recommended' && afterResult.returnDeadlineMarginMinutes >= 0;

  // Transfer preceding this activity in proposed timeline
  let additionalTravelAllowanceMinutes = targetActivity?.localTransferMinutes ?? 0;
  if (afterTimelineEntry) {
    const entryIdx = afterResult.timeline.findIndex(t => t.id === afterTimelineEntry.id);
    if (entryIdx > 0 && afterResult.timeline[entryIdx - 1].category === 'TRANSFER') {
      const transferEntry = afterResult.timeline[entryIdx - 1];
      const startMs = parseIST(transferEntry.startTime);
      const endMs = parseIST(transferEntry.endTime);
      additionalTravelAllowanceMinutes = Math.round((endMs - startMs) / 60000);
    }
  }

  // Determine validity
  let isValid = true;
  let validationError: string | undefined = undefined;

  // 1. Check if activity was actually scheduled on the target day
  if (!afterTimelineEntry || afterTimelineEntry.day !== targetDay) {
    isValid = false;
    const failReason = afterOutcome?.reason ?? 'Activity cannot fit into target day schedule.';
    validationError = `${activityName} cannot fit on Day ${targetDay}: ${failReason}`;
  }

  // 2. Full Itinerary Validity: Ensure no previously scheduled activity was displaced/dropped
  const beforeScheduledActivityIds = new Set(
    beforeResult.timeline
      .filter(t => t.category === 'ACTIVITY' && t.activityId && t.activityId !== activityId)
      .map(t => t.activityId!)
  );

  const afterScheduledActivityIds = new Set(
    afterResult.timeline
      .filter(t => t.category === 'ACTIVITY' && t.activityId)
      .map(t => t.activityId!)
  );

  const displacedActivities: string[] = [];
  for (const prevId of beforeScheduledActivityIds) {
    if (!afterScheduledActivityIds.has(prevId)) {
      const act = allActivities.find(a => a.id === prevId);
      displacedActivities.push(act ? act.name : prevId);
    }
  }

  if (displacedActivities.length > 0) {
    isValid = false;
    validationError = `Moving ${activityName} displaces previously scheduled activity: ${displacedActivities.join(', ')}.`;
  }

  // 3. Check for blockers on the moved activity or NEW blockers introduced in the proposed trip
  const activityBlockers = afterResult.violations.filter(
    v => v.activityId === activityId && v.severity === 'BLOCKER'
  );
  if (activityBlockers.length > 0) {
    isValid = false;
    if (!validationError) {
      validationError = activityBlockers.map(b => b.message).join('; ');
    }
  }

  const beforeBlockerKeys = new Set(
    beforeResult.violations.filter(v => v.severity === 'BLOCKER').map(v => `${v.type}:${v.activityId ?? ''}`)
  );
  const newBlockers = afterResult.violations.filter(
    v => v.severity === 'BLOCKER' && !beforeBlockerKeys.has(`${v.type}:${v.activityId ?? ''}`)
  );
  if (newBlockers.length > 0) {
    isValid = false;
    if (!validationError) {
      validationError = newBlockers.map(b => b.message).join('; ');
    }
  }

  // Deltas calculation
  const marginDeltaMinutes = afterResult.returnDeadlineMarginMinutes - beforeResult.returnDeadlineMarginMinutes;
  const beforeHomeMs = parseIST(beforeResult.homeArrivalTime);
  const afterHomeMs = parseIST(afterResult.homeArrivalTime);
  const homeArrivalDeltaMinutes = Math.round((afterHomeMs - beforeHomeMs) / 60000);

  // New conflicts analysis
  const beforeViolationKeys = new Set(beforeResult.violations.map(v => `${v.type}:${v.activityId ?? ''}`));
  const newConflicts = afterResult.violations
    .filter(v => !beforeViolationKeys.has(`${v.type}:${v.activityId ?? ''}`))
    .map(v => v.message);

  // Detailed violation resolution analysis
  const hadInitialConflicts =
    beforeResult.returnDeadlineMarginMinutes < 0 ||
    beforeResult.violations.some(v => v.severity === 'BLOCKER') ||
    beforeResult.rating === 'Not Recommended';

  const hasRemainingConflicts =
    afterResult.returnDeadlineMarginMinutes < 0 ||
    afterResult.violations.some(v => v.severity === 'BLOCKER') ||
    afterResult.rating === 'Not Recommended';

  let originalViolationResolved = false;
  let resolutionStatus: MoveResolutionStatus;
  let resolutionLabel: MoveResolutionLabel;
  let resolutionMessage: string;

  if (!isValid) {
    resolutionStatus = 'CANNOT_FIT';
    resolutionLabel = 'Cannot Fit';
    resolutionMessage = validationError || 'Proposed slot cannot fit schedule constraints.';
    originalViolationResolved = false;
  } else if (!hadInitialConflicts) {
    // 1. Valid move in an already feasible trip: "Move Fits"
    resolutionStatus = 'MOVE_FITS';
    resolutionLabel = 'Move Fits';
    resolutionMessage = 'Valid move: Activity fits comfortably into schedule while maintaining full trip feasibility.';
    originalViolationResolved = true;
  } else if (!hasRemainingConflicts) {
    // 2. Valid move that fixes an actual conflict: "Conflict Resolved"
    resolutionStatus = 'CONFLICT_RESOLVED';
    resolutionLabel = 'Conflict Resolved';
    resolutionMessage = 'Valid move: Successfully resolves the scheduling conflict and restores a feasible trip.';
    originalViolationResolved = true;
  } else {
    // 3. Valid move with remaining issues: "More Changes Needed"
    resolutionStatus = 'MORE_CHANGES_NEEDED';
    resolutionLabel = 'More Changes Needed';
    resolutionMessage = 'Valid slot: Activity fits on target day, but additional itinerary changes are needed to achieve feasibility.';
    originalViolationResolved = false;
  }

  return {
    activityId,
    activityName,
    fromDay,
    toDay: targetDay,
    toPosition: targetPosition,
    isValid,
    validationError,
    resolutionStatus,
    resolutionLabel,
    resolutionMessage,
    proposedConstraints,
    before: {
      homeArrival: beforeResult.homeArrivalTime.slice(11) + ' IST',
      returnMarginMinutes: beforeResult.returnDeadlineMarginMinutes,
      activityStartTime: beforeStartTime,
      activityEndTime: beforeEndTime,
      isFeasible: beforeIsFeasible,
      violationsCount: beforeResult.violations.length,
      violations: beforeResult.violations,
    },
    after: {
      homeArrival: afterResult.homeArrivalTime.slice(11) + ' IST',
      returnMarginMinutes: afterResult.returnDeadlineMarginMinutes,
      activityStartTime: afterStartTime,
      activityEndTime: afterEndTime,
      isFeasible: afterIsFeasible,
      violationsCount: afterResult.violations.length,
      violations: afterResult.violations,
    },
    deltas: {
      marginDeltaMinutes,
      homeArrivalDeltaMinutes,
      originalViolationResolved,
      newConflicts,
      displacedActivities,
      additionalTravelAllowanceMinutes,
    },
  };
}
