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

  it('Scenario 1: executes a valid move of Devaraja Market from Day 1 to Day 2', () => {
    const preview = evaluateActivityMove(mysuru, baseMysuruConstraints, 'mysuru-market', 2);

    expect(preview.isValid).toBe(true);
    expect(preview.fromDay).toBe(1);
    expect(preview.toDay).toBe(2);

    // Before: Day 1 (17:45-18:45)
    expect(preview.before.activityStartTime).toBe('17:45');
    expect(preview.before.activityEndTime).toBe('18:45');
    expect(preview.before.homeArrival).toBe('18:30 IST');
    expect(preview.before.returnMarginMinutes).toBe(120);

    // After: Scheduled on Day 2 morning (09:00-10:00)
    expect(preview.after.activityStartTime).toBe('09:00');
    expect(preview.after.activityEndTime).toBe('10:00');
    expect(preview.after.homeArrival).toBe('18:30 IST');
    expect(preview.after.returnMarginMinutes).toBe(120);

    // Additional travel allowance: 30m transfer to market
    expect(preview.deltas.additionalTravelAllowanceMinutes).toBe(30);
    expect(preview.deltas.newConflicts).toHaveLength(0);
  });

  it('Scenario 2: moving an activity resolves a Day 1 scheduling conflict caused by delay', () => {
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
    expect(preview.deltas.originalViolationResolved).toBe(true);
    expect(preview.after.violations.some(v => v.type === 'OPERATING_HOURS_CONFLICT')).toBe(false);
  });

  it('Scenario 3: rejects an invalid move when operating hours are violated (Abbey Falls to Day 1)', () => {
    const baseCoorgConstraints: UserConstraints = {
      departureDateTime: '2026-11-21T08:00',
      returnDeadlineDateTime: '2026-11-22T20:30',
      pace: 'balanced',
      perPersonBudgetINR: 7000,
      partySize: 2,
      drivingAdjustmentMinutes: 0,
      simulateDelayMinutes: 0,
      disabledActivityIds: [],
    };

    // In Coorg, Abbey Falls closes at 17:00. Outbound arrival 14:54 + checkin 16:09 + transfer 16:39 + 90m = 18:09.
    // Moving Abbey Falls to Day 1 cannot fit!
    const preview = evaluateActivityMove(coorg, baseCoorgConstraints, 'coorg-abbey', 1);

    expect(preview.isValid).toBe(false);
    expect(preview.validationError).toBeDefined();
    expect(preview.validationError).toContain('Abbey Falls cannot fit on Day 1');
    expect(preview.validationError).toContain('past closing time 17:00');
  });

  it('Scenario 4: demonstrates deterministic return margin reduction and invalid slot when an extensive activity delays Sunday departure past deadline', () => {
    // Tight return deadline at 16:00 IST on Sunday (latest return departure = 12:06 IST)
    const tightConstraints: UserConstraints = {
      ...baseMysuruConstraints,
      returnDeadlineDateTime: '2026-11-22T16:00',
    };

    // Moving Mysore Palace (150m visit + 30m transfer, opens 10:00 -> finishes 12:30) to Day 2
    // Finishes at 12:30 which exceeds 12:06 departure limit!
    const preview = evaluateActivityMove(mysuru, tightConstraints, 'mysuru-palace', 2);

    expect(preview.isValid).toBe(false);
    expect(preview.validationError).toContain('Mysore Palace cannot fit on Day 2');
    expect(preview.validationError).toContain('extends past scheduled day limit');
  });

  it('Scenario 5: detects closing-hour conflict when reordering activities within Day 1', () => {
    // Reorder: Market first (position 0), Palace second (position 1)
    // Market runs 14:45-15:45. Palace starts 16:15 + 150m = finishes 18:45. Palace closes at 17:30!
    const preview = evaluateActivityMove(mysuru, baseMysuruConstraints, 'mysuru-palace', 1, 1);

    expect(preview.isValid).toBe(false);
    expect(preview.validationError).toContain('past closing time 17:30');
  });

  it('Scenario 6: preserves full transaction integrity and supports exact Undo', () => {
    // 1. Initial baseline
    const initialResult = evaluateFeasibility(mysuru, baseMysuruConstraints);
    const initialMargin = initialResult.returnDeadlineMarginMinutes;
    const initialHome = initialResult.homeArrivalTime;

    // 2. Apply move to Day 2
    const movedConstraints: UserConstraints = {
      ...baseMysuruConstraints,
      activityDayAssignments: { 'mysuru-market': 2 },
    };
    const movedResult = evaluateFeasibility(mysuru, movedConstraints);
    expect(movedResult.timeline.find(t => t.activityId === 'mysuru-market')?.day).toBe(2);

    // 3. Undo move (restore original constraints)
    const restoredConstraints: UserConstraints = {
      ...baseMysuruConstraints,
      activityDayAssignments: {},
    };
    const restoredResult = evaluateFeasibility(mysuru, restoredConstraints);
    expect(restoredResult.timeline.find(t => t.activityId === 'mysuru-market')?.day).toBe(1);
    expect(restoredResult.returnDeadlineMarginMinutes).toBe(initialMargin);
    expect(restoredResult.homeArrivalTime).toBe(initialHome);
  });
});
