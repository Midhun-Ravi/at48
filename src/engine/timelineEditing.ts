import {
  Destination,
  TimetableEntry,
  UserConstraints,
} from '../types';
import { evaluateFeasibility, formatIST, parseIST } from './scheduler';

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
  };
}

export type FreeTimeAction =
  | { type: 'RESERVE_BUFFER'; name: string; durationMinutes: number }
  | { type: 'SCHEDULE_ACTIVITY'; activityId: string }
  | { type: 'ADD_CUSTOM_PLACE'; name: string; durationMinutes: number; costPerPersonINR?: number };

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

  // Check for blocker violations or operating hours conflicts introduced by the adjustment
  const blockerViolation = proposedResult.violations.find(v => v.severity === 'BLOCKER');
  let isValid = true;
  let validationError: string | undefined;

  if (blockerViolation) {
    isValid = false;
    validationError = `Cannot apply adjustment: ${blockerViolation.message}`;
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
      isFeasible: proposedResult.returnDeadlineMarginMinutes >= 0 && !blockerViolation,
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

    if (action.durationMinutes > availableSlotMinutes) {
      return {
        action,
        freeWindow: freeWindowMeta,
        isValid: false,
        validationError: `Insufficient free time: "${action.name}" requires ${action.durationMinutes}m, but this window only has ${availableSlotMinutes}m.`,
        proposedConstraints: constraints,
        before: baselineState,
        after: baselineState,
        deltas: { marginDeltaMinutes: 0, homeArrivalDeltaMinutes: 0, freeTimeDeltaMinutes: 0 },
      };
    }

    const newCustom = {
      id: `custom-act-${Date.now()}`,
      day: freeEntry.day,
      name: action.name.trim() || 'Custom Stop',
      durationMinutes: action.durationMinutes,
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
        remainingFreeMinutes: Math.max(0, availableSlotMinutes - action.durationMinutes),
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
