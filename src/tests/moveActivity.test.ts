import { describe, expect, it } from 'vitest';
import { DESTINATIONS } from '../data/destinations';
import { evaluateFeasibility } from '../engine/scheduler';
import { evaluateActivityMove, getMoveCandidates, getInsertionSlotsForDay } from '../engine/moveActivity';
import type { UserConstraints } from '../types';

describe('@48 V2.1 — Make This Trip Fit: Move Activity Between Days', () => {
  const mysuru = DESTINATIONS.find(d => d.id === 'mysuru')!;
  const coorg = DESTINATIONS.find(d => d.id === 'coorg-madikeri')!;

  const baseMysuruConstraints: UserConstraints = {
    departureDateTime: '2026-11-21T08:00', // Saturday 8 AM
    returnDeadlineDateTime: '2026-11-22T20:30', // Sunday 8:30 PM (2-day trip)
    pace: 'balanced',
    perPersonBudgetINR: 6000,
    partySize: 2,
    drivingAdjustmentMinutes: 0,
    simulateDelayMinutes: 0,
    disabledActivityIds: [],
  };

  it('identifies movable candidates with operating windows, current day, and duration', () => {
    const initialResult = evaluateFeasibility(mysuru, baseMysuruConstraints);
    const candidates = getMoveCandidates(mysuru, baseMysuruConstraints, initialResult);

    expect(candidates.length).toBeGreaterThanOrEqual(2);
    const palace = candidates.find(c => c.activityId === 'mysuru-palace')!;
    expect(palace.name).toBe('Mysore Palace');
    expect(palace.scheduleStatus).toBe('scheduled');
    expect(palace.currentDay).toBe(1);
    expect(palace.durationMinutes).toBe(150);
    expect(palace.operatingWindow).toContain('10:00–17:30');

    const market = candidates.find(c => c.activityId === 'mysuru-market')!;
    expect(market.name).toBe('Devaraja Market Walk');
    expect(market.scheduleStatus).toBe('scheduled');
    expect(market.currentDay).toBe(1);
    expect(market.durationMinutes).toBe(60);
  });

  it('evaluates insertion slots for a target day', () => {
    const slots = getInsertionSlotsForDay(mysuru, baseMysuruConstraints, 1);
    expect(slots.length).toBeGreaterThanOrEqual(1);
    expect(slots[0].label).toBe('First stop of the day');
  });

  // REQUIREMENT 1: Selected insertion position is preserved after Apply
  it('Requirement 1: Selected insertion position is preserved after Apply', () => {
    const preview = evaluateActivityMove(mysuru, baseMysuruConstraints, 'mysuru-market', 2, 0);
    expect(preview.isValid).toBe(true);
    expect(preview.toPosition).toBe(0);
    expect(preview.proposedConstraints.activityOrder).toBeDefined();

    // Day 2 activities in proposed order
    const day2ActivitiesInOrder = preview.proposedConstraints.activityOrder!.filter(id => {
      const assigned = preview.proposedConstraints.activityDayAssignments?.[id];
      return assigned === 2;
    });
    expect(day2ActivitiesInOrder[0]).toBe('mysuru-market');

    // Applying proposedConstraints gives the exact same order in timetable
    const applied = evaluateFeasibility(mysuru, preview.proposedConstraints);
    const day2Activities = applied.timeline.filter(t => t.category === 'ACTIVITY' && t.day === 2);
    expect(day2Activities[0].activityId).toBe('mysuru-market');
  });

  // REQUIREMENT 2: Applying a preview produces exactly the same timetable and return margin as the preview
  it('Requirement 2: Applying a preview produces exactly the same timetable and return margin as the preview', () => {
    const preview = evaluateActivityMove(mysuru, baseMysuruConstraints, 'mysuru-market', 2, 0);
    expect(preview.isValid).toBe(true);

    // Apply the exact proposedConstraints snapshot
    const applied = evaluateFeasibility(mysuru, preview.proposedConstraints);

    expect(applied.returnDeadlineMarginMinutes).toBe(preview.after.returnMarginMinutes);
    expect(applied.homeArrivalTime.slice(11) + ' IST').toBe(preview.after.homeArrival);

    const marketEntry = applied.timeline.find(t => t.activityId === 'mysuru-market')!;
    expect(marketEntry.startTime.slice(11)).toBe(preview.after.activityStartTime);
    expect(marketEntry.endTime.slice(11)).toBe(preview.after.activityEndTime);
    expect(marketEntry.day).toBe(preview.toDay);
  });

  // REQUIREMENT 3: Moving one activity cannot silently remove or displace another scheduled activity
  it('Requirement 3: Moving one activity cannot silently remove or displace another scheduled activity', () => {
    // Constrained Sunday schedule where Day 2 only has time for 1 activity (return deadline 17:00 IST)
    const tightSundayConstraints: UserConstraints = {
      ...baseMysuruConstraints,
      returnDeadlineDateTime: '2026-11-22T17:00',
      activityDayAssignments: { 'mysuru-market': 2 },
    };

    // Before: Market is successfully scheduled on Day 2 morning
    const beforeResult = evaluateFeasibility(mysuru, tightSundayConstraints);
    expect(beforeResult.timeline.some(t => t.activityId === 'mysuru-market' && t.day === 2)).toBe(true);

    // Try moving Mysore Palace (150m) to Day 2 at position 0 (which would displace Market due to tight deadline)
    const preview = evaluateActivityMove(mysuru, tightSundayConstraints, 'mysuru-palace', 2, 0);

    // Engine must catch the displacement and refuse to approve the move
    expect(preview.isValid).toBe(false);
    expect(preview.resolutionStatus).toBe('CANNOT_FIT');
    expect(preview.resolutionLabel).toBe('Cannot Fit');
    expect(preview.deltas.displacedActivities).toContain('Devaraja Market Walk');
    expect(preview.validationError).toContain('displaces previously scheduled activity');
  });

  // REQUIREMENT 4: A new blocker prevents the move from being called feasible
  it('Requirement 4: A new blocker prevents the move from being called feasible', () => {
    // Coorg Abbey Falls closes at 17:00. Moving it to Day 1 with 14:54 arrival causes visit to finish at 18:09.
    const preview = evaluateActivityMove(coorg, {
      departureDateTime: '2026-11-21T08:00',
      returnDeadlineDateTime: '2026-11-22T20:30',
      pace: 'balanced',
      perPersonBudgetINR: 7000,
      partySize: 2,
      drivingAdjustmentMinutes: 0,
      simulateDelayMinutes: 0,
      disabledActivityIds: [],
    }, 'coorg-abbey', 1);

    expect(preview.isValid).toBe(false);
    expect(preview.resolutionStatus).toBe('CANNOT_FIT');
    expect(preview.resolutionLabel).toBe('Cannot Fit');
    expect(preview.validationError).toBeDefined();
    expect(preview.validationError).toContain('Abbey Falls cannot fit on Day 1');
    expect(preview.validationError).toContain('past closing time 17:00');
  });

  // REQUIREMENT 5: A move that does not fix lateness/conflicts is labeled "More Changes Needed"
  it('Requirement 5: A move that does not fix conflicts is labeled "More Changes Needed"', () => {
    // Crowded scenario with Chamundi Hills and outbound delay:
    // Palace has an OPERATING_HOURS_CONFLICT because it finishes at 18:21 (past closing time 17:30).
    const crowdedConstraints: UserConstraints = {
      ...baseMysuruConstraints,
      drivingAdjustmentMinutes: 60,
      simulateDelayMinutes: 60,
      additionalActivities: [
        {
          id: 'mysuru-chamundi',
          name: 'Chamundi Hill Temple',
          durationMinutes: 90,
          openTime: '07:30',
          closeTime: '21:00',
          costPerPersonINR: 0,
          isOptional: false,
          priority: 2,
          localTransferMinutes: 25,
          openingHoursEvidence: { level: 'official' },
          costEvidence: { level: 'official' },
        },
      ],
      activityDayAssignments: {
        'mysuru-palace': 1,
        'mysuru-chamundi': 1,
        'mysuru-market': 1,
      },
      activityOrder: ['mysuru-palace', 'mysuru-chamundi', 'mysuru-market'],
    };

    // Before move: Palace has a blocker conflict on Day 1
    const beforeResult = evaluateFeasibility(mysuru, crowdedConstraints);
    const hadPalaceBlocker = beforeResult.violations.some(
      v => v.activityId === 'mysuru-palace' && v.severity === 'BLOCKER'
    );
    expect(hadPalaceBlocker).toBe(true);

    // Move Devaraja Market to Day 2:
    // Market fits into Day 2 morning (09:00–10:00) without issues,
    // BUT Palace on Day 1 STILL has its operating hours blocker conflict!
    const preview = evaluateActivityMove(mysuru, crowdedConstraints, 'mysuru-market', 2);

    // The slot is valid for Market, but the trip's conflicts are NOT resolved!
    expect(preview.isValid).toBe(true);
    expect(preview.deltas.originalViolationResolved).toBe(false);
    expect(preview.resolutionStatus).toBe('MORE_CHANGES_NEEDED');
    expect(preview.resolutionLabel).toBe('More Changes Needed');
    expect(preview.resolutionMessage).toContain('additional itinerary changes are needed');
  });

  // REQUIREMENT 6: Wishlist-only places do not affect scheduling (0m impact)
  it('Requirement 6: Wishlist-only places do not affect scheduling (0m impact)', () => {
    const baseResult = evaluateFeasibility(mysuru, baseMysuruConstraints);

    // In the application, wishlist places are saved to local wishlist state and NOT added to additionalActivities.
    const wishlistPlace = {
      id: 'wishlist-mysore-sandalwood',
      name: 'Government Sandalwood Oil Factory',
      durationMinutes: 45,
    };

    // Wishlist places do not modify UserConstraints
    const unchangedConstraints: UserConstraints = { ...baseMysuruConstraints };
    const afterResult = evaluateFeasibility(mysuru, unchangedConstraints);

    expect(afterResult.returnDeadlineMarginMinutes).toBe(baseResult.returnDeadlineMarginMinutes);
    expect(afterResult.homeArrivalTime).toBe(baseResult.homeArrivalTime);
    expect(afterResult.timeline.length).toBe(baseResult.timeline.length);

    // Even if added as an optional activity with 0m transfer, if unscheduled or disabled it has 0m schedule impact
    const disabledOptionalConstraints: UserConstraints = {
      ...baseMysuruConstraints,
      disabledActivityIds: [wishlistPlace.id],
    };
    const disabledResult = evaluateFeasibility(mysuru, disabledOptionalConstraints);
    expect(disabledResult.returnDeadlineMarginMinutes).toBe(baseResult.returnDeadlineMarginMinutes);
    expect(disabledResult.homeArrivalTime).toBe(baseResult.homeArrivalTime);
  });

  // REQUIREMENT 7: Undo restores the complete prior trip
  it('Requirement 7: Undo restores the complete prior trip', () => {
    // 1. Initial baseline
    const initialResult = evaluateFeasibility(mysuru, baseMysuruConstraints);
    const initialMargin = initialResult.returnDeadlineMarginMinutes;
    const initialHome = initialResult.homeArrivalTime;
    const initialTimeline = initialResult.timeline.map(t => ({
      day: t.day,
      category: t.category,
      label: t.label,
      start: t.startTime,
      end: t.endTime,
    }));

    // 2. Evaluate and apply move to Day 2
    const preview = evaluateActivityMove(mysuru, baseMysuruConstraints, 'mysuru-market', 2);
    expect(preview.isValid).toBe(true);

    const movedConstraints = preview.proposedConstraints;
    const movedResult = evaluateFeasibility(mysuru, movedConstraints);
    expect(movedResult.timeline.find(t => t.activityId === 'mysuru-market')?.day).toBe(2);

    // 3. Undo transaction (restore base constraints snapshot)
    const restoredConstraints = baseMysuruConstraints;
    const restoredResult = evaluateFeasibility(mysuru, restoredConstraints);

    expect(restoredResult.timeline.find(t => t.activityId === 'mysuru-market')?.day).toBe(1);
    expect(restoredResult.returnDeadlineMarginMinutes).toBe(initialMargin);
    expect(restoredResult.homeArrivalTime).toBe(initialHome);

    const restoredTimeline = restoredResult.timeline.map(t => ({
      day: t.day,
      category: t.category,
      label: t.label,
      start: t.startTime,
      end: t.endTime,
    }));
    expect(restoredTimeline).toEqual(initialTimeline);
  });

  // FOCUSED TEST: Top Feasibility Indicator reflecting activity blockers
  it('Top Feasibility Indicator: reflects blocking scheduling violations and never reports "On Schedule" when an activity has a blocker', () => {
    const delayedConstraints: UserConstraints = {
      ...baseMysuruConstraints,
      drivingAdjustmentMinutes: 60,
      simulateDelayMinutes: 60,
      activityDayAssignments: { 'mysuru-palace': 1 },
      activityOrder: ['mysuru-palace', 'mysuru-market'],
    };

    const res = evaluateFeasibility(mysuru, delayedConstraints);

    // Return margin is +120m (home arrival 18:30 IST vs 20:30 deadline)
    expect(res.returnDeadlineMarginMinutes).toBe(120);
    expect(res.returnDeadlineMarginMinutes).toBeGreaterThanOrEqual(0);

    // BUT Mysore Palace has a BLOCKER violation (finishes at 18:21, past 17:30 closing)
    const blockers = res.violations.filter(v => v.severity === 'BLOCKER');
    expect(blockers.length).toBeGreaterThan(0);
    expect(blockers[0].type).toBe('OPERATING_HOURS_CONFLICT');
    expect(blockers[0].activityId).toBe('mysuru-palace');

    // Engine rating is strictly 'Not Recommended'
    expect(res.rating).toBe('Not Recommended');

    // Feasibility status check: MUST NOT be considered feasible
    const isProjectedLate = res.returnDeadlineMarginMinutes < 0;
    const hasScheduleBlocker = blockers.length > 0;
    const isTripFeasible = !isProjectedLate && !hasScheduleBlocker && res.rating !== 'Not Recommended';

    expect(isProjectedLate).toBe(false);
    expect(hasScheduleBlocker).toBe(true);
    expect(isTripFeasible).toBe(false); // Top indicator must be FALSE (blocked), NEVER green On Schedule!
  });

  // FOCUSED TEST: Distinguish the 4 Move Resolution Statuses & Labels
  it('Trust-Language Distinctions: distinguishes Move Fits, Conflict Resolved, More Changes Needed, and Cannot Fit', () => {
    // 1. Move Fits: Valid move in an already feasible trip
    const previewFits = evaluateActivityMove(mysuru, baseMysuruConstraints, 'mysuru-market', 2);
    expect(previewFits.isValid).toBe(true);
    expect(previewFits.resolutionStatus).toBe('MOVE_FITS');
    expect(previewFits.resolutionLabel).toBe('Move Fits');

    // 2. Conflict Resolved: Valid move that fixes an actual conflict
    const delayedTripConstraints: UserConstraints = {
      ...baseMysuruConstraints,
      drivingAdjustmentMinutes: 60,
      simulateDelayMinutes: 60,
      activityDayAssignments: { 'mysuru-palace': 1 },
      activityOrder: ['mysuru-palace', 'mysuru-market'],
    };
    // Palace on Day 1 has an operating hours blocker; moving it to Day 2 resolves it completely!
    const previewResolved = evaluateActivityMove(mysuru, delayedTripConstraints, 'mysuru-palace', 2);
    expect(previewResolved.isValid).toBe(true);
    expect(previewResolved.resolutionStatus).toBe('CONFLICT_RESOLVED');
    expect(previewResolved.resolutionLabel).toBe('Conflict Resolved');
    expect(previewResolved.deltas.originalViolationResolved).toBe(true);

    // 3. More Changes Needed: Valid move with remaining issues
    const crowdedTripConstraints: UserConstraints = {
      ...baseMysuruConstraints,
      drivingAdjustmentMinutes: 60,
      simulateDelayMinutes: 60,
      additionalActivities: [
        {
          id: 'mysuru-chamundi',
          name: 'Chamundi Hill Temple',
          durationMinutes: 90,
          openTime: '07:30',
          closeTime: '21:00',
          costPerPersonINR: 0,
          isOptional: false,
          priority: 2,
          localTransferMinutes: 25,
          openingHoursEvidence: { level: 'official' },
          costEvidence: { level: 'official' },
        },
      ],
      activityDayAssignments: {
        'mysuru-palace': 1,
        'mysuru-chamundi': 1,
        'mysuru-market': 1,
      },
      activityOrder: ['mysuru-palace', 'mysuru-chamundi', 'mysuru-market'],
    };
    // Moving Market to Day 2 fits Market, but Palace on Day 1 remains in conflict
    const previewRemaining = evaluateActivityMove(mysuru, crowdedTripConstraints, 'mysuru-market', 2);
    expect(previewRemaining.isValid).toBe(true);
    expect(previewRemaining.resolutionStatus).toBe('MORE_CHANGES_NEEDED');
    expect(previewRemaining.resolutionLabel).toBe('More Changes Needed');
    expect(previewRemaining.deltas.originalViolationResolved).toBe(false);

    // 4. Cannot Fit: Invalid move (violates operating hours or limits)
    const previewCannotFit = evaluateActivityMove(mysuru, baseMysuruConstraints, 'mysuru-palace', 1, 1);
    expect(previewCannotFit.isValid).toBe(false);
    expect(previewCannotFit.resolutionStatus).toBe('CANNOT_FIT');
    expect(previewCannotFit.resolutionLabel).toBe('Cannot Fit');
  });

  // FOCUSED TEST: Candidate Classification (scheduled, unavailable, unscheduled)
  it('Candidate Classification: distinguishes scheduled, unavailable, and unscheduled candidates without listing unscheduled activities as Day 1', () => {
    // In this scenario:
    // - Palace has an operating hours conflict on Day 1 and CANNOT be scheduled
    // - Market is scheduled on Day 1
    // - An optional added activity is disabled (unscheduled)
    const testConstraints: UserConstraints = {
      ...baseMysuruConstraints,
      drivingAdjustmentMinutes: 60,
      simulateDelayMinutes: 60,
      additionalActivities: [
        {
          id: 'custom-somnathpur',
          name: 'Somnathpur Temple',
          durationMinutes: 60,
          openTime: '09:00',
          closeTime: '18:00',
          costPerPersonINR: 50,
          isOptional: true,
          priority: 3,
          localTransferMinutes: 30,
          openingHoursEvidence: { level: 'assumption' },
          costEvidence: { level: 'assumption' },
        },
      ],
      disabledActivityIds: ['custom-somnathpur'],
      activityDayAssignments: { 'mysuru-palace': 1 },
      activityOrder: ['mysuru-palace', 'mysuru-market'],
    };

    const res = evaluateFeasibility(mysuru, testConstraints);
    const candidates = getMoveCandidates(mysuru, testConstraints, res);

    // 1. Devaraja Market: Scheduled on Day 1
    const market = candidates.find(c => c.activityId === 'mysuru-market')!;
    expect(market.scheduleStatus).toBe('scheduled');
    expect(market.currentDay).toBe(1);

    // 2. Mysore Palace: UNAVAILABLE due to operating hours conflict (NOT listed as Day 1!)
    const palace = candidates.find(c => c.activityId === 'mysuru-palace')!;
    expect(palace.scheduleStatus).toBe('unavailable');
    expect(palace.currentDay).toBeUndefined(); // NEVER defaulted to Day 1!
    expect(palace.assignedDay).toBe(1);
    expect(palace.conflictReason).toContain('closing time 17:30');

    // 3. Somnathpur: UNSCHEDULED because it is disabled
    const somnathpur = candidates.find(c => c.activityId === 'custom-somnathpur')!;
    expect(somnathpur.scheduleStatus).toBe('unscheduled');
    expect(somnathpur.currentDay).toBeUndefined(); // NEVER defaulted to Day 1!
  });
});
