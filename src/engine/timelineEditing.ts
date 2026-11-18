import {
  CustomPlannedActivity,
  Destination,
  TimetableEntry,
  UserConstraints,
} from '../types';
import { add, at, evaluateFeasibility, formatIST, parseIST } from './scheduler';

const MINUTE_MS = 60 * 1000;

export interface TransferDetails {
  activityId: string;
  activityName: string;
  originLabel: string;
  destinationLabel: string;
  currentDurationMinutes: number;
  isUserAdjusted: boolean;
  evidenceSource: string;
}

export interface TransferAdjustmentPreview {
  activityId: string;
  activityName: string;
  originLabel: string;
  destinationLabel: string;
  currentDurationMinutes: number;
  proposedDurationMinutes: number;
  isValid: boolean;
  validationError?: string;
  isUserAdjusted: boolean;
  evidenceSource: string;
  proposedConstraints: UserConstraints;
  before: {
    homeArrival: string;
    returnMarginMinutes: number;
    activityStartTime?: string;
    activityEndTime?: string;
    isFeasible: boolean;
  };
  after: {
    homeArrival: string;
    returnMarginMinutes: number;
    activityStartTime?: string;
    activityEndTime?: string;
    isFeasible: boolean;
  };
  deltas: {
    transferDeltaMinutes: number;
    marginDeltaMinutes: number;
    homeArrivalDeltaMinutes: number;
    downstreamFreeTimeDeltaMinutes: number;
    displacedActivities: string[];
  };
}

export type FreeTimeAction =
  | { type: 'RESERVE_BUFFER'; name: string; durationMinutes: number }
  | { type: 'SCHEDULE_ACTIVITY'; activityId: string }
  | {
      type: 'ADD_CUSTOM_PLACE';
      name: string;
      durationMinutes: number;
      transferMinutes: number;
      costPerPersonINR?: number;
    };

export interface FreeTimeUsagePreview {
  action: FreeTimeAction;
  freeWindow: {
    startTime: string;
    endTime: string;
    durationMinutes: number;
    day: number;
    label: string;
  };
  isValid: boolean;
  validationError?: string;
  proposedConstraints: UserConstraints;
  before: {
    homeArrival: string;
    returnMarginMinutes: number;
    remainingFreeMinutes: number;
    isFeasible: boolean;
  };
  after: {
    homeArrival: string;
    returnMarginMinutes: number;
    remainingFreeMinutes: number;
    isFeasible: boolean;
  };
  deltas: {
    marginDeltaMinutes: number;
    homeArrivalDeltaMinutes: number;
    freeTimeDeltaMinutes: number;
  };
}

/**
 * Extracts origin, destination, duration and evidence for a local transfer entry.
 */
export function getTransferDetails(
  entry: TimetableEntry,
  timeline: TimetableEntry[],
  destination: Destination,
  constraints: UserConstraints
): TransferDetails | null {
  if (entry.category !== 'TRANSFER' || !entry.activityId) return null;

  const allActivities = [...destination.activities, ...(constraints.additionalActivities ?? [])];
  const activity = allActivities.find(a => a.id === entry.activityId);
  const activityName = activity?.name ?? entry.label.replace(/^Local transfer to\s+/, '');

  const isUserAdjusted = constraints.transferAdjustments?.[entry.activityId] !== undefined;
  const currentDurationMinutes = Math.round(
    (parseIST(entry.endTime) - parseIST(entry.startTime)) / MINUTE_MS
  );

  const evidenceSource = isUserAdjusted
    ? 'User-specified planning allowance (unverified)'
    : 'Default planning allowance (unverified)';

  // Find the immediately preceding non-free timeline item for accurate origin
  let originLabel = entry.originLabel;
  if (!originLabel) {
    const sorted = [...timeline].sort((a, b) => parseIST(a.startTime) - parseIST(b.startTime));
    const entryIdx = sorted.findIndex(t => t.id === entry.id);
    if (entryIdx > 0) {
      for (let i = entryIdx - 1; i >= 0; i--) {
        if (sorted[i].day === entry.day && sorted[i].category !== 'FREE') {
          originLabel = sorted[i].label;
          break;
        }
      }
    }
    if (!originLabel) {
      originLabel = entry.day === 1 ? 'Hotel check-in' : 'Hotel / Overnight stay';
    }
  }

  return {
    activityId: entry.activityId,
    activityName,
    originLabel,
    destinationLabel: activityName,
    currentDurationMinutes,
    isUserAdjusted,
    evidenceSource,
  };
}

/**
 * Evaluates a proposed user-specified transfer allowance against the full trip schedule.
 * Enforces minimum transfer, operating windows, return constraints and detects impossible adjustments.
 */
export function evaluateTransferAdjustment(
  activityId: string,
  proposedDurationMinutes: number,
  destination: Destination,
  constraints: UserConstraints
): TransferAdjustmentPreview {
  const allActivities = [...destination.activities, ...(constraints.additionalActivities ?? [])];
  const activity = allActivities.find(a => a.id === activityId);
  const activityName = activity?.name ?? activityId;

  const currentDurationMinutes =
    constraints.transferAdjustments?.[activityId] ??
    activity?.localTransferMinutes ??
    30;

  const baselineResult = evaluateFeasibility(destination, constraints);
  const baselineActivity = baselineResult.timeline.find(
    t => t.activityId === activityId && t.category === 'ACTIVITY'
  );
  const isBaselineFeasible =
    baselineResult.returnDeadlineMarginMinutes >= 0 &&
    !baselineResult.violations.some(v => v.severity === 'BLOCKER');

  const baselinePreviewState = {
    homeArrival: baselineResult.homeArrivalTime,
    returnMarginMinutes: baselineResult.returnDeadlineMarginMinutes,
    activityStartTime: baselineActivity?.startTime,
    activityEndTime: baselineActivity?.endTime,
    isFeasible: isBaselineFeasible,
  };

  const evidenceSource = 'User-specified planning allowance (unverified)';

  // Enforce minimum transfer allowance
  if (proposedDurationMinutes < 5) {
    return {
      activityId,
      activityName,
      originLabel: 'Previous stop',
      destinationLabel: activityName,
      currentDurationMinutes,
      proposedDurationMinutes,
      isValid: false,
      validationError: 'Transfer allowance must be at least 5 minutes for local transit.',
      isUserAdjusted: true,
      evidenceSource,
      proposedConstraints: constraints,
      before: baselinePreviewState,
      after: baselinePreviewState,
      deltas: {
        transferDeltaMinutes: 0,
        marginDeltaMinutes: 0,
        homeArrivalDeltaMinutes: 0,
        downstreamFreeTimeDeltaMinutes: 0,
        displacedActivities: [],
      },
    };
  }

  if (proposedDurationMinutes > 180) {
    return {
      activityId,
      activityName,
      originLabel: 'Previous stop',
      destinationLabel: activityName,
      currentDurationMinutes,
      proposedDurationMinutes,
      isValid: false,
      validationError: 'Transfer allowance cannot exceed 180 minutes.',
      isUserAdjusted: true,
      evidenceSource,
      proposedConstraints: constraints,
      before: baselinePreviewState,
      after: baselinePreviewState,
      deltas: {
        transferDeltaMinutes: 0,
        marginDeltaMinutes: 0,
        homeArrivalDeltaMinutes: 0,
        downstreamFreeTimeDeltaMinutes: 0,
        displacedActivities: [],
      },
    };
  }

  // Construct proposed constraints
  const nextTransferAdjustments = {
    ...(constraints.transferAdjustments ?? {}),
    [activityId]: proposedDurationMinutes,
  };

  const proposedConstraints: UserConstraints = {
    ...constraints,
    transferAdjustments: nextTransferAdjustments,
  };

  const proposedResult = evaluateFeasibility(destination, proposedConstraints);
  const proposedActivity = proposedResult.timeline.find(
    t => t.activityId === activityId && t.category === 'ACTIVITY'
  );

  // Compare scheduled activities before and after to prevent silent displacement
  const beforeScheduledActivityIds = baselineResult.timeline
    .filter(t => t.category === 'ACTIVITY' && !t.isRestBuffer && t.activityId)
    .map(t => t.activityId!);

  const afterScheduledActivityIds = proposedResult.timeline
    .filter(t => t.category === 'ACTIVITY' && !t.isRestBuffer && t.activityId)
    .map(t => t.activityId!);

  const displacedActivityIds = beforeScheduledActivityIds.filter(
    id => !afterScheduledActivityIds.includes(id)
  );
  const displacedActivityNames = displacedActivityIds.map(id => {
    const act = allActivities.find(a => a.id === id);
    return act?.name ?? id;
  });

  // Check for silent shortening of scheduled activities
  let shortenedActivityName: string | undefined;
  let shortenedOrigMins = 0;
  let shortenedNewMins = 0;
  for (const afterEntry of proposedResult.timeline.filter(t => t.category === 'ACTIVITY' && !t.isRestBuffer && t.activityId)) {
    const origAct = allActivities.find(a => a.id === afterEntry.activityId);
    if (origAct) {
      const actualDuration = Math.round(
        (parseIST(afterEntry.endTime) - parseIST(afterEntry.startTime)) / MINUTE_MS
      );
      if (actualDuration < origAct.durationMinutes) {
        shortenedActivityName = origAct.name;
        shortenedOrigMins = origAct.durationMinutes;
        shortenedNewMins = actualDuration;
        break;
      }
    }
  }

  // Detect newly introduced blocker violations
  const baselineBlockerSignatures = new Set(
    baselineResult.violations
      .filter(v => v.severity === 'BLOCKER')
      .map(v => `${v.type}:${v.activityId ?? ''}`)
  );
  const newBlockers = proposedResult.violations.filter(
    v => v.severity === 'BLOCKER' && !baselineBlockerSignatures.has(`${v.type}:${v.activityId ?? ''}`)
  );

  let isValid = true;
  let validationError: string | undefined;

  if (displacedActivityNames.length > 0) {
    isValid = false;
    validationError = `Cannot apply transfer adjustment: Displaces previously scheduled stop "${displacedActivityNames.join(', ')}". Increasing transfer leaves insufficient time for this activity.`;
  } else if (shortenedActivityName) {
    isValid = false;
    validationError = `Cannot apply transfer adjustment: Silently shortens "${shortenedActivityName}" from ${shortenedOrigMins}m to ${shortenedNewMins}m.`;
  } else if (newBlockers.length > 0) {
    isValid = false;
    validationError = `Cannot apply transfer adjustment: Introduces new scheduling conflict: ${newBlockers[0].message}`;
  } else if (proposedResult.violations.some(v => v.severity === 'BLOCKER')) {
    const blocker = proposedResult.violations.find(v => v.severity === 'BLOCKER');
    isValid = false;
    validationError = `Cannot apply adjustment: ${blocker?.message}`;
  } else if (proposedResult.returnDeadlineMarginMinutes < 0) {
    isValid = false;
    validationError = `Cannot apply adjustment: Delays return arrival (${proposedResult.homeArrivalTime.slice(11)}) past deadline (${constraints.returnDeadlineDateTime.slice(11)}).`;
  }

  const baselineFreeMins = baselineResult.destinationSlackMinutes;
  const proposedFreeMins = proposedResult.destinationSlackMinutes;

  return {
    activityId,
    activityName,
    originLabel: 'Previous stop',
    destinationLabel: activityName,
    currentDurationMinutes,
    proposedDurationMinutes,
    isValid,
    validationError,
    isUserAdjusted: true,
    evidenceSource,
    proposedConstraints,
    before: baselinePreviewState,
    after: {
      homeArrival: proposedResult.homeArrivalTime,
      returnMarginMinutes: proposedResult.returnDeadlineMarginMinutes,
      activityStartTime: proposedActivity?.startTime,
      activityEndTime: proposedActivity?.endTime,
      isFeasible: proposedResult.returnDeadlineMarginMinutes >= 0 && isValid,
    },
    deltas: {
      transferDeltaMinutes: proposedDurationMinutes - currentDurationMinutes,
      marginDeltaMinutes:
        proposedResult.returnDeadlineMarginMinutes - baselineResult.returnDeadlineMarginMinutes,
      homeArrivalDeltaMinutes: Math.round(
        (parseIST(proposedResult.homeArrivalTime) - parseIST(baselineResult.homeArrivalTime)) /
          MINUTE_MS
      ),
      downstreamFreeTimeDeltaMinutes: proposedFreeMins - baselineFreeMins,
      displacedActivities: displacedActivityNames,
    },
  };
}

/**
 * Evaluates scheduling an activity or reserving a personal rest buffer inside a free-time window.
 * Enforces opening hours, visit duration, local transfers and return constraints.
 */
export function evaluateFreeTimeUsage(
  freeEntry: TimetableEntry,
  action: FreeTimeAction,
  destination: Destination,
  constraints: UserConstraints
): FreeTimeUsagePreview {
  const windowStartEpoch = parseIST(freeEntry.startTime);
  const windowEndEpoch = parseIST(freeEntry.endTime);
  const availableSlotMinutes = Math.round((windowEndEpoch - windowStartEpoch) / MINUTE_MS);

  const baselineResult = evaluateFeasibility(destination, constraints);
  const isBaselineFeasible =
    baselineResult.returnDeadlineMarginMinutes >= 0 &&
    !baselineResult.violations.some(v => v.severity === 'BLOCKER');

  const freeWindowMeta = {
    startTime: freeEntry.startTime,
    endTime: freeEntry.endTime,
    durationMinutes: availableSlotMinutes,
    day: freeEntry.day,
    label: freeEntry.label,
  };

  const baselineState = {
    homeArrival: baselineResult.homeArrivalTime,
    returnMarginMinutes: baselineResult.returnDeadlineMarginMinutes,
    remainingFreeMinutes: availableSlotMinutes,
    isFeasible: isBaselineFeasible,
  };

  // Case 1: Reserve Rest / Personal Buffer
  if (action.type === 'RESERVE_BUFFER') {
    if (action.durationMinutes <= 0) {
      return {
        action,
        freeWindow: freeWindowMeta,
        isValid: false,
        validationError: 'Reserved buffer duration must be greater than 0 minutes.',
        proposedConstraints: constraints,
        before: baselineState,
        after: baselineState,
        deltas: { marginDeltaMinutes: 0, homeArrivalDeltaMinutes: 0, freeTimeDeltaMinutes: 0 },
      };
    }

    if (action.durationMinutes > availableSlotMinutes) {
      return {
        action,
        freeWindow: freeWindowMeta,
        isValid: false,
        validationError: `Insufficient free time: Cannot reserve ${action.durationMinutes}m in a ${availableSlotMinutes}m free-time window.`,
        proposedConstraints: constraints,
        before: baselineState,
        after: baselineState,
        deltas: { marginDeltaMinutes: 0, homeArrivalDeltaMinutes: 0, freeTimeDeltaMinutes: 0 },
      };
    }

    const newCustomBuffer = {
      id: `custom-buffer-${Date.now()}`,
      day: freeEntry.day,
      name: action.name.trim() || `Reserved Rest Buffer (${action.durationMinutes}m)`,
      durationMinutes: action.durationMinutes,
      slotStart: freeEntry.startTime,
      isRestBuffer: true,
    };

    const proposedConstraints: UserConstraints = {
      ...constraints,
      customActivities: [...(constraints.customActivities ?? []), newCustomBuffer],
    };

    const proposedResult = evaluateFeasibility(destination, proposedConstraints);
    const blocker = proposedResult.violations.find(v => v.severity === 'BLOCKER');

    const remainingFree = availableSlotMinutes - action.durationMinutes;

    return {
      action,
      freeWindow: freeWindowMeta,
      isValid: !blocker,
      validationError: blocker ? `Cannot reserve buffer: ${blocker.message}` : undefined,
      proposedConstraints,
      before: baselineState,
      after: {
        homeArrival: proposedResult.homeArrivalTime,
        returnMarginMinutes: proposedResult.returnDeadlineMarginMinutes,
        remainingFreeMinutes: Math.max(0, remainingFree),
        isFeasible: proposedResult.returnDeadlineMarginMinutes >= 0 && !blocker,
      },
      deltas: {
        marginDeltaMinutes:
          proposedResult.returnDeadlineMarginMinutes - baselineResult.returnDeadlineMarginMinutes,
        homeArrivalDeltaMinutes: Math.round(
          (parseIST(proposedResult.homeArrivalTime) - parseIST(baselineResult.homeArrivalTime)) /
            MINUTE_MS
        ),
        freeTimeDeltaMinutes: -action.durationMinutes,
      },
    };
  }

  // Case 2: Schedule Activity into Free Time
  if (action.type === 'SCHEDULE_ACTIVITY') {
    const allActivities = [...destination.activities, ...(constraints.additionalActivities ?? [])];
    const activity = allActivities.find(a => a.id === action.activityId);

    if (!activity) {
      return {
        action,
        freeWindow: freeWindowMeta,
        isValid: false,
        validationError: `Activity not found: ${action.activityId}`,
        proposedConstraints: constraints,
        before: baselineState,
        after: baselineState,
        deltas: { marginDeltaMinutes: 0, homeArrivalDeltaMinutes: 0, freeTimeDeltaMinutes: 0 },
      };
    }

    const transferMinutes =
      constraints.transferAdjustments?.[activity.id] ?? activity.localTransferMinutes;
    const totalRequiredMinutes = activity.durationMinutes + transferMinutes;

    // Check 0: Already scheduled on this day
    const alreadyScheduledOnThisDay = baselineResult.timeline.some(
      t => t.activityId === activity.id && t.day === freeEntry.day && t.category === 'ACTIVITY'
    );
    if (alreadyScheduledOnThisDay) {
      return {
        action,
        freeWindow: freeWindowMeta,
        isValid: false,
        validationError: `"${activity.name}" is already scheduled on Day ${freeEntry.day}. Choose an unscheduled activity or move it using "Move Day".`,
        proposedConstraints: constraints,
        before: baselineState,
        after: baselineState,
        deltas: { marginDeltaMinutes: 0, homeArrivalDeltaMinutes: 0, freeTimeDeltaMinutes: 0 },
      };
    }

    // Check 1: Operating hours vs window
    const windowDate = freeEntry.startTime.slice(0, 10);
    const windowStartTime = freeEntry.startTime.slice(11, 16);
    const windowEndTime = freeEntry.endTime.slice(11, 16);

    // If attraction closes before window even starts
    if (activity.closeTime <= windowStartTime) {
      return {
        action,
        freeWindow: freeWindowMeta,
        isValid: false,
        validationError: `Operating hours conflict: "${activity.name}" closes at ${activity.closeTime}, which is before this ${windowStartTime}–${windowEndTime} free-time window.`,
        proposedConstraints: constraints,
        before: baselineState,
        after: baselineState,
        deltas: { marginDeltaMinutes: 0, homeArrivalDeltaMinutes: 0, freeTimeDeltaMinutes: 0 },
      };
    }

    const projectedTransferEndEpoch = windowStartEpoch + transferMinutes * MINUTE_MS;
    const projectedTransferEndClock = formatIST(projectedTransferEndEpoch).slice(11, 16);

    if (activity.lastEntryTime && projectedTransferEndClock > activity.lastEntryTime) {
      return {
        action,
        freeWindow: freeWindowMeta,
        isValid: false,
        validationError: `Operating hours conflict: Last entry for "${activity.name}" is ${activity.lastEntryTime}, but arrival in this window would be ${projectedTransferEndClock}.`,
        proposedConstraints: constraints,
        before: baselineState,
        after: baselineState,
        deltas: { marginDeltaMinutes: 0, homeArrivalDeltaMinutes: 0, freeTimeDeltaMinutes: 0 },
      };
    }

    // Check 2: Insufficient free time
    if (totalRequiredMinutes > availableSlotMinutes) {
      return {
        action,
        freeWindow: freeWindowMeta,
        isValid: false,
        validationError: `Insufficient free time: "${activity.name}" requires ${totalRequiredMinutes}m (${activity.durationMinutes}m visit + ${transferMinutes}m transfer), but this window only has ${availableSlotMinutes}m.`,
        proposedConstraints: constraints,
        before: baselineState,
        after: baselineState,
        deltas: { marginDeltaMinutes: 0, homeArrivalDeltaMinutes: 0, freeTimeDeltaMinutes: 0 },
      };
    }

    const visitStartEpoch = Math.max(
      projectedTransferEndEpoch,
      parseIST(`${windowDate}T${activity.openTime}`)
    );
    const visitEndEpoch = visitStartEpoch + activity.durationMinutes * MINUTE_MS;
    const visitEndClock = formatIST(visitEndEpoch).slice(11, 16);

    if (visitEndClock > activity.closeTime) {
      return {
        action,
        freeWindow: freeWindowMeta,
        isValid: false,
        validationError: `Operating hours conflict: "${activity.name}" closes at ${activity.closeTime}. Visit would finish at ${visitEndClock}, which is past closing time.`,
        proposedConstraints: constraints,
        before: baselineState,
        after: baselineState,
        deltas: { marginDeltaMinutes: 0, homeArrivalDeltaMinutes: 0, freeTimeDeltaMinutes: 0 },
      };
    }

    // Build proposed constraints
    const nextDisabled = (constraints.disabledActivityIds ?? []).filter(id => id !== activity.id);
    const nextDayAssignments = {
      ...(constraints.activityDayAssignments ?? {}),
      [activity.id]: freeEntry.day,
    };

    // Reorder activity to be adjacent to this free slot if possible
    let nextOrder = [...(constraints.activityOrder ?? destination.activities.map(a => a.id))];
    if (!nextOrder.includes(activity.id)) {
      nextOrder.push(activity.id);
    }

    const proposedConstraints: UserConstraints = {
      ...constraints,
      disabledActivityIds: nextDisabled,
      activityDayAssignments: nextDayAssignments,
      activityOrder: nextOrder,
    };

    const proposedResult = evaluateFeasibility(destination, proposedConstraints);
    const blocker = proposedResult.violations.find(v => v.severity === 'BLOCKER');

    let isValid = !blocker;
    let validationError: string | undefined;

    if (blocker) {
      isValid = false;
      validationError = `Cannot schedule activity: ${blocker.message}`;
    } else if (proposedResult.returnDeadlineMarginMinutes < 0) {
      isValid = false;
      validationError = `Cannot schedule activity: Delays return home past the return deadline (${proposedResult.homeArrivalTime.slice(11)} vs ${constraints.returnDeadlineDateTime.slice(11)}).`;
    }

    const scheduledActivity = proposedResult.timeline.find(
      t => t.activityId === activity.id && t.category === 'ACTIVITY'
    );
    if (!scheduledActivity && isValid) {
      isValid = false;
      validationError = `Cannot schedule "${activity.name}" into Day ${freeEntry.day}: Does not fit inside available timeline slots.`;
    }

    return {
      action,
      freeWindow: freeWindowMeta,
      isValid,
      validationError,
      proposedConstraints,
      before: baselineState,
      after: {
        homeArrival: proposedResult.homeArrivalTime,
        returnMarginMinutes: proposedResult.returnDeadlineMarginMinutes,
        remainingFreeMinutes: Math.max(0, availableSlotMinutes - totalRequiredMinutes),
        isFeasible: proposedResult.returnDeadlineMarginMinutes >= 0 && !blocker,
      },
      deltas: {
        marginDeltaMinutes:
          proposedResult.returnDeadlineMarginMinutes - baselineResult.returnDeadlineMarginMinutes,
        homeArrivalDeltaMinutes: Math.round(
          (parseIST(proposedResult.homeArrivalTime) - parseIST(baselineResult.homeArrivalTime)) /
            MINUTE_MS
        ),
        freeTimeDeltaMinutes: -totalRequiredMinutes,
      },
    };
  }

  // Case 3: Add Custom Place into Free Time
  if (action.type === 'ADD_CUSTOM_PLACE') {
    if (action.durationMinutes <= 0) {
      return {
        action,
        freeWindow: freeWindowMeta,
        isValid: false,
        validationError: 'Place duration must be greater than 0 minutes.',
        proposedConstraints: constraints,
        before: baselineState,
        after: baselineState,
        deltas: { marginDeltaMinutes: 0, homeArrivalDeltaMinutes: 0, freeTimeDeltaMinutes: 0 },
      };
    }

    if (!action.transferMinutes || action.transferMinutes < 5) {
      return {
        action,
        freeWindow: freeWindowMeta,
        isValid: false,
        validationError: 'An explicit planning allowance (minimum 5 minutes) is required for custom location transit.',
        proposedConstraints: constraints,
        before: baselineState,
        after: baselineState,
        deltas: { marginDeltaMinutes: 0, homeArrivalDeltaMinutes: 0, freeTimeDeltaMinutes: 0 },
      };
    }

    const totalRequired = action.durationMinutes + action.transferMinutes;
    if (totalRequired > availableSlotMinutes) {
      return {
        action,
        freeWindow: freeWindowMeta,
        isValid: false,
        validationError: `Insufficient free time: "${action.name}" requires ${totalRequired}m (${action.durationMinutes}m visit + ${action.transferMinutes}m transfer allowance), but this window only has ${availableSlotMinutes}m available.`,
        proposedConstraints: constraints,
        before: baselineState,
        after: baselineState,
        deltas: { marginDeltaMinutes: 0, homeArrivalDeltaMinutes: 0, freeTimeDeltaMinutes: 0 },
      };
    }

    const newCustom: CustomPlannedActivity = {
      id: `custom-act-${Date.now()}`,
      day: freeEntry.day,
      name: action.name.trim() || 'Custom Stop',
      durationMinutes: action.durationMinutes,
      transferMinutes: action.transferMinutes,
      costPerPersonINR: action.costPerPersonINR ?? 0,
      slotStart: freeEntry.startTime,
    };

    const proposedConstraints: UserConstraints = {
      ...constraints,
      customActivities: [...(constraints.customActivities ?? []), newCustom],
    };

    const proposedResult = evaluateFeasibility(destination, proposedConstraints);
    const blocker = proposedResult.violations.find(v => v.severity === 'BLOCKER');

    return {
      action,
      freeWindow: freeWindowMeta,
      isValid: !blocker,
      validationError: blocker ? `Cannot schedule custom place: ${blocker.message}` : undefined,
      proposedConstraints,
      before: baselineState,
      after: {
        homeArrival: proposedResult.homeArrivalTime,
        returnMarginMinutes: proposedResult.returnDeadlineMarginMinutes,
        remainingFreeMinutes: Math.max(0, availableSlotMinutes - totalRequired),
        isFeasible: proposedResult.returnDeadlineMarginMinutes >= 0 && !blocker,
      },
      deltas: {
        marginDeltaMinutes:
          proposedResult.returnDeadlineMarginMinutes - baselineResult.returnDeadlineMarginMinutes,
        homeArrivalDeltaMinutes: Math.round(
          (parseIST(proposedResult.homeArrivalTime) - parseIST(baselineResult.homeArrivalTime)) /
            MINUTE_MS
        ),
        freeTimeDeltaMinutes: -totalRequired,
      },
    };
  }

  return {
    action,
    freeWindow: freeWindowMeta,
    isValid: false,
    validationError: 'Unknown free time action.',
    proposedConstraints: constraints,
    before: baselineState,
    after: baselineState,
    deltas: { marginDeltaMinutes: 0, homeArrivalDeltaMinutes: 0, freeTimeDeltaMinutes: 0 },
  };
}

export interface AlternativeValidTime {
  startTime: string; // HH:mm
  label: string; // e.g. "17:30 (Day 1 Daytime)"
  day: number;
}

export interface VisitSchedulingParams {
  activityId?: string; // catalog activity ID if existing
  customId?: string; // custom activity ID if editing existing custom place
  name: string;
  day: number;
  visitStartTime: string; // HH:mm or YYYY-MM-DDTHH:mm
  durationMinutes: number;
  transferMinutes: number;
  costPerPersonINR?: number;
  openTime?: string;
  closeTime?: string;
  lastEntryTime?: string;
  isRestBuffer?: boolean;
}

export interface VisitSchedulingPreview {
  params: VisitSchedulingParams;
  isValid: boolean;
  validationError?: string;
  alternativeTimes: AlternativeValidTime[];
  proposedConstraints: UserConstraints;
  details: {
    activityName: string;
    day: number;
    transferStartTime: string;
    transferEndTime: string;
    visitStartTime: string;
    visitEndTime: string;
    precedingFreeTime?: { startTime: string; endTime: string; durationMinutes: number };
    followingFreeTime?: { startTime: string; endTime: string; durationMinutes: number };
  };
  before: {
    homeArrival: string;
    returnMarginMinutes: number;
    destinationSlackMinutes: number;
    isFeasible: boolean;
  };
  after: {
    homeArrival: string;
    returnMarginMinutes: number;
    destinationSlackMinutes: number;
    isFeasible: boolean;
  };
  deltas: {
    marginDeltaMinutes: number;
    homeArrivalDeltaMinutes: number;
    freeTimeDeltaMinutes: number;
    displacedActivities: string[];
  };
}

/**
 * Scans the schedule for valid alternative start times on a target day.
 */
export function findAlternativeValidTimes(
  day: number,
  durationMinutes: number,
  transferMinutes: number,
  destination: Destination,
  constraints: UserConstraints,
  openTime?: string,
  closeTime?: string,
  lastEntryTime?: string,
  excludeActivityId?: string
): AlternativeValidTime[] {
  const tempConstraints: UserConstraints = {
    ...constraints,
    disabledActivityIds: excludeActivityId
      ? [...constraints.disabledActivityIds, excludeActivityId]
      : constraints.disabledActivityIds,
    customActivities: (constraints.customActivities ?? []).filter(
      ca => ca.id !== excludeActivityId
    ),
  };

  const baseline = evaluateFeasibility(destination, tempConstraints);
  const freeWindows = baseline.timeline.filter(t => t.day === day && t.category === 'FREE');

  const suggestions: AlternativeValidTime[] = [];
  const totalNeeded = durationMinutes + transferMinutes;

  for (const win of freeWindows) {
    const winStartEpoch = parseIST(win.startTime);
    const winEndEpoch = parseIST(win.endTime);
    const dateStr = win.startTime.slice(0, 10);

    const winDurationMins = Math.round((winEndEpoch - winStartEpoch) / MINUTE_MS);
    if (winDurationMins < totalNeeded) continue;

    const earliestVisitStartEpoch = add(winStartEpoch, transferMinutes);
    let effectiveEarliest = earliestVisitStartEpoch;
    if (openTime) {
      const openEpoch = at(dateStr, openTime);
      effectiveEarliest = Math.max(effectiveEarliest, openEpoch);
    }

    let effectiveLatestVisitEnd = winEndEpoch;
    if (closeTime) {
      const closeEpoch = at(dateStr, closeTime);
      effectiveLatestVisitEnd = Math.min(effectiveLatestVisitEnd, closeEpoch);
    }

    let effectiveLatestVisitStart = add(effectiveLatestVisitEnd, -durationMinutes);
    if (lastEntryTime) {
      const lastEntryEpoch = at(dateStr, lastEntryTime);
      effectiveLatestVisitStart = Math.min(effectiveLatestVisitStart, lastEntryEpoch);
    }

    if (effectiveEarliest <= effectiveLatestVisitStart) {
      let cursor = effectiveEarliest;
      while (cursor <= effectiveLatestVisitStart && suggestions.length < 4) {
        const timeStr = formatIST(cursor).slice(11, 16);
        const label = `${timeStr} (Day ${day} ${timeStr >= '18:15' ? 'Evening' : 'Daytime'})`;
        if (!suggestions.some(s => s.startTime === timeStr)) {
          suggestions.push({ startTime: timeStr, label, day });
        }
        cursor = add(cursor, 30);
      }
    }
  }

  return suggestions;
}

/**
 * Traveler-Controlled Visit Scheduling Engine
 * Evaluates explicit user-chosen day, start time, visit duration and transfer allowance.
 * Enforces opening hours, collisions, anti-displacement and return deadline feasibility.
 */
export function evaluateVisitScheduling(
  params: VisitSchedulingParams,
  destination: Destination,
  constraints: UserConstraints
): VisitSchedulingPreview {
  const allActivities = [...destination.activities, ...(constraints.additionalActivities ?? [])];
  const catalogActivity = params.activityId ? allActivities.find(a => a.id === params.activityId) : undefined;
  const activityName = catalogActivity?.name ?? params.name;

  const baselineResult = evaluateFeasibility(destination, constraints);
  const baselineSlack = baselineResult.destinationSlackMinutes;
  const isBaselineFeasible =
    baselineResult.returnDeadlineMarginMinutes >= 0 &&
    !baselineResult.violations.some(v => v.severity === 'BLOCKER');

  const baselineState = {
    homeArrival: baselineResult.homeArrivalTime,
    returnMarginMinutes: baselineResult.returnDeadlineMarginMinutes,
    destinationSlackMinutes: baselineSlack,
    isFeasible: isBaselineFeasible,
  };

  const depDate = constraints.departureDateTime.slice(0, 10);
  const dayEntry = baselineResult.timeline.find(t => t.day === params.day);
  const dayDate = dayEntry
    ? dayEntry.startTime.slice(0, 10)
    : new Date(Date.parse(`${depDate}T00:00:00Z`) + (params.day - 1) * 86400000).toISOString().slice(0, 10);
  const visitStartTimeIso = params.visitStartTime.includes('T')
    ? params.visitStartTime
    : `${dayDate}T${params.visitStartTime}`;

  const visitStartEpoch = parseIST(visitStartTimeIso);
  const transferMinutes = Math.max(0, params.transferMinutes);
  const transferStartEpoch = add(visitStartEpoch, -transferMinutes);
  const visitEndEpoch = add(visitStartEpoch, params.durationMinutes);

  const transferStartTime = formatIST(transferStartEpoch);
  const transferEndTime = formatIST(visitStartEpoch);
  const visitStartTime = formatIST(visitStartEpoch);
  const visitEndTime = formatIST(visitEndEpoch);

  const defaultDetails = {
    activityName,
    day: params.day,
    transferStartTime,
    transferEndTime,
    visitStartTime,
    visitEndTime,
  };

  // 1. Duration validation
  const minDuration = params.isRestBuffer ? 10 : 15;
  if (params.durationMinutes < minDuration) {
    const alternativeTimes = findAlternativeValidTimes(
      params.day,
      minDuration,
      transferMinutes,
      destination,
      constraints,
      params.openTime ?? catalogActivity?.openTime,
      params.closeTime ?? catalogActivity?.closeTime,
      params.lastEntryTime ?? catalogActivity?.lastEntryTime,
      params.activityId ?? params.customId
    );
    return {
      params,
      isValid: false,
      validationError: `Visit duration must be at least ${minDuration} minutes.`,
      alternativeTimes,
      proposedConstraints: constraints,
      details: defaultDetails,
      before: baselineState,
      after: baselineState,
      deltas: { marginDeltaMinutes: 0, homeArrivalDeltaMinutes: 0, freeTimeDeltaMinutes: 0, displacedActivities: [] },
    };
  }

  // 2. Transfer allowance validation
  if (!params.isRestBuffer && params.transferMinutes < 5) {
    const alternativeTimes = findAlternativeValidTimes(
      params.day,
      params.durationMinutes,
      5,
      destination,
      constraints,
      params.openTime ?? catalogActivity?.openTime,
      params.closeTime ?? catalogActivity?.closeTime,
      params.lastEntryTime ?? catalogActivity?.lastEntryTime,
      params.activityId ?? params.customId
    );
    return {
      params,
      isValid: false,
      validationError: 'An explicit planning allowance (minimum 5 minutes) is required for transit.',
      alternativeTimes,
      proposedConstraints: constraints,
      details: defaultDetails,
      before: baselineState,
      after: baselineState,
      deltas: { marginDeltaMinutes: 0, homeArrivalDeltaMinutes: 0, freeTimeDeltaMinutes: 0, displacedActivities: [] },
    };
  }

  // 3. Construct proposed constraints
  let proposedConstraints: UserConstraints;

  if (params.activityId) {
    const nextCustomizations = {
      ...(constraints.activityCustomizations ?? {}),
      [params.activityId]: {
        day: params.day,
        startTime: visitStartTimeIso,
        durationMinutes: params.durationMinutes,
        transferMinutes: params.transferMinutes,
      },
    };
    const nextDayAssignments = {
      ...(constraints.activityDayAssignments ?? {}),
      [params.activityId]: params.day,
    };
    let nextOrder = constraints.activityOrder ? [...constraints.activityOrder] : allActivities.map(a => a.id);
    if (!nextOrder.includes(params.activityId)) {
      nextOrder.push(params.activityId);
    }
    const nextDisabled = constraints.disabledActivityIds.filter(id => id !== params.activityId);

    proposedConstraints = {
      ...constraints,
      disabledActivityIds: nextDisabled,
      activityDayAssignments: nextDayAssignments,
      activityCustomizations: nextCustomizations,
      activityOrder: nextOrder,
    };
  } else {
    const customId = params.customId || `custom-act-${Date.now()}`;
    const newCustom: CustomPlannedActivity = {
      id: customId,
      day: params.day,
      name: params.name.trim() || 'Custom Stop',
      durationMinutes: params.durationMinutes,
      transferMinutes: params.transferMinutes,
      costPerPersonINR: params.costPerPersonINR ?? 0,
      slotStart: visitStartTimeIso,
      openTime: params.openTime,
      closeTime: params.closeTime,
      lastEntryTime: params.lastEntryTime,
      isRestBuffer: params.isRestBuffer,
    };

    const existingCustoms = (constraints.customActivities ?? []).filter(ca => ca.id !== customId);
    proposedConstraints = {
      ...constraints,
      customActivities: [...existingCustoms, newCustom],
    };
  }

  // 4. Run engine feasibility check
  const proposedResult = evaluateFeasibility(destination, proposedConstraints);

  // Compare scheduled activities before and after to prevent silent displacement
  const beforeScheduledActivityIds = baselineResult.timeline
    .filter(t => t.category === 'ACTIVITY' && !t.isRestBuffer && t.activityId)
    .map(t => t.activityId!);

  const afterScheduledActivityIds = proposedResult.timeline
    .filter(t => t.category === 'ACTIVITY' && !t.isRestBuffer && t.activityId)
    .map(t => t.activityId!);

  const displacedActivityIds = beforeScheduledActivityIds.filter(
    id => !afterScheduledActivityIds.includes(id) && id !== params.activityId
  );
  const displacedActivityNames = displacedActivityIds.map(id => {
    const act = allActivities.find(a => a.id === id);
    return act?.name ?? id;
  });

  const blocker = proposedResult.violations.find(v => v.severity === 'BLOCKER');

  let isValid = true;
  let validationError: string | undefined;

  if (displacedActivityNames.length > 0) {
    isValid = false;
    validationError = `Cannot apply schedule: Displaces previously scheduled stop "${displacedActivityNames.join(', ')}".`;
  } else if (blocker) {
    isValid = false;
    validationError = blocker.message;
  } else if (proposedResult.returnDeadlineMarginMinutes < 0) {
    isValid = false;
    validationError = `Return departure is delayed past deadline: return arrival is ${proposedResult.homeArrivalTime.slice(11)} against requested deadline ${constraints.returnDeadlineDateTime.slice(11)}.`;
  }

  const alternativeTimes = !isValid
    ? findAlternativeValidTimes(
        params.day,
        params.durationMinutes,
        params.transferMinutes,
        destination,
        constraints,
        params.openTime ?? catalogActivity?.openTime,
        params.closeTime ?? catalogActivity?.closeTime,
        params.lastEntryTime ?? catalogActivity?.lastEntryTime,
        params.activityId ?? params.customId
      )
    : [];

  // Extract preceding and following free time on target day
  const precedingFree = proposedResult.timeline.find(
    t => t.day === params.day && t.category === 'FREE' && t.endTime === transferStartTime
  );
  const followingFree = proposedResult.timeline.find(
    t => t.day === params.day && t.category === 'FREE' && t.startTime === visitEndTime
  );

  const precedingFreeTime = precedingFree
    ? {
        startTime: precedingFree.startTime,
        endTime: precedingFree.endTime,
        durationMinutes: Math.round(
          (parseIST(precedingFree.endTime) - parseIST(precedingFree.startTime)) / MINUTE_MS
        ),
      }
    : undefined;

  const followingFreeTime = followingFree
    ? {
        startTime: followingFree.startTime,
        endTime: followingFree.endTime,
        durationMinutes: Math.round(
          (parseIST(followingFree.endTime) - parseIST(followingFree.startTime)) / MINUTE_MS
        ),
      }
    : undefined;

  const proposedSlack = proposedResult.destinationSlackMinutes;

  return {
    params,
    isValid,
    validationError,
    alternativeTimes,
    proposedConstraints,
    details: {
      activityName,
      day: params.day,
      transferStartTime,
      transferEndTime,
      visitStartTime,
      visitEndTime,
      precedingFreeTime,
      followingFreeTime,
    },
    before: baselineState,
    after: {
      homeArrival: proposedResult.homeArrivalTime,
      returnMarginMinutes: proposedResult.returnDeadlineMarginMinutes,
      destinationSlackMinutes: proposedSlack,
      isFeasible: proposedResult.returnDeadlineMarginMinutes >= 0 && !blocker,
    },
    deltas: {
      marginDeltaMinutes:
        proposedResult.returnDeadlineMarginMinutes - baselineResult.returnDeadlineMarginMinutes,
      homeArrivalDeltaMinutes: Math.round(
        (parseIST(proposedResult.homeArrivalTime) - parseIST(baselineResult.homeArrivalTime)) /
          MINUTE_MS
      ),
      freeTimeDeltaMinutes: proposedSlack - baselineSlack,
      displacedActivities: displacedActivityNames,
    },
  };
}
