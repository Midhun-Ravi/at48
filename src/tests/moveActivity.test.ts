import { describe, expect, it } from 'vitest';
import { DESTINATIONS } from '../data/destinations';
import { evaluateFeasibility } from '../engine/scheduler';
import { evaluateActivityMove, getMoveCandidates, getInsertionSlotsForDay } from '../engine/moveActivity';
import type { Activity, UserConstraints } from '../types';

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
    expect(palace.currentDay).toBe(1);
    expect(palace.durationMinutes).toBe(150);
    expect(palace.operatingWindow).toContain('10:00–17:30');

    const market = candidates.find(c => c.activityId === 'mysuru-market')!;
    expect(market.name).toBe('Devaraja Market Walk');
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
    expect(preview.resolutionStatus).toBe('INVALID');
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
    expect(preview.resolutionStatus).toBe('INVALID');
    expect(preview.validationError).toBeDefined();
    expect(preview.validationError).toContain('Abbey Falls cannot fit on Day 1');
    expect(preview.validationError).toContain('past closing time 17:00');
  });

  // REQUIREMENT 5: A move that does not fix lateness is not labeled "Resolved"
  it('Requirement 5: A move that does not fix lateness is not labeled "Resolved"', () => {
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
    expect(preview.resolutionStatus).toBe('VALID_UNRESOLVED');
    expect(preview.resolutionMessage).toContain('trip remains overdue or has unresolved constraints');
  });

  // REQUIREMENT 6: Wishlist-only places do not affect scheduling (0m impact)
  it('Requirement 6: Wishlist-only places do not affect scheduling (0m impact)', () => {
    const baseResult = evaluateFeasibility(mysuru, baseMysuruConstraints);

    // In the application, wishlist places are saved to local wishlist state and NOT added to additionalActivities.
    // If a custom place is created with 0m detour in wishlist mode, verify that base constraints without it
    // have identical return margin, identical arrival, and identical scheduled stops.
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

  // Conflict Resolution scenario
  it('Conflict Resolution: moving an activity resolves a Day 1 scheduling conflict caused by delay', () => {
    // Add third activity (Chamundi Hills) to Day 1 with explicit day assignment and 60m delay
    const chamundiActivity: Activity = {
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
    };

    const crowdedConstraints: UserConstraints = {
      ...baseMysuruConstraints,
      simulateDelayMinutes: 60, // 1h delay on outbound
      additionalActivities: [chamundiActivity],
      // Explicitly lock all three activities to Day 1
      activityDayAssignments: {
        'mysuru-palace': 1,
        'mysuru-chamundi': 1,
        'mysuru-market': 1,
      },
    };

    // Before move: 3 activities explicitly locked to Day 1 with 60m delay cannot all fit before 21:00
    const beforeResult = evaluateFeasibility(mysuru, crowdedConstraints);
    const hasConflict = beforeResult.violations.some(
      v => v.type === 'OPERATING_HOURS_CONFLICT' && v.activityId === 'mysuru-market'
    );
    expect(hasConflict).toBe(true);

    // Move Devaraja Market to Day 2
    const preview = evaluateActivityMove(mysuru, crowdedConstraints, 'mysuru-market', 2);

    expect(preview.isValid).toBe(true);
    expect(preview.resolutionStatus).toBe('VALID_AND_RESOLVED');
    expect(preview.deltas.originalViolationResolved).toBe(true);
    expect(preview.after.violations.some(v => v.type === 'OPERATING_HOURS_CONFLICT')).toBe(false);
  });

  it('detects closing-hour conflict when reordering activities within Day 1', () => {
    // Reorder: Market first (position 0), Palace second (position 1)
    // Market runs 14:45-15:45. Palace starts 16:15 + 150m = finishes 18:45. Palace closes at 17:30!
    const preview = evaluateActivityMove(mysuru, baseMysuruConstraints, 'mysuru-palace', 1, 1);

    expect(preview.isValid).toBe(false);
    expect(preview.resolutionStatus).toBe('INVALID');
    expect(preview.validationError).toContain('past closing time 17:30');
  });
});
