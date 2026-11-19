import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { evaluateFeasibility, getCalendarDaysCount } from '../engine/scheduler';
import { DESTINATIONS } from '../data/destinations';
import { getDestinationRecommendations } from '../engine/recommendations';
import type { UserConstraints } from '../types';

describe('@48 Page 2 Visual & UX Correction — Calm Comparison Redesign', () => {
  const readSrc = (relPath: string) =>
    fs.readFileSync(path.resolve(__dirname, '..', relPath), 'utf8');

  it('1. verifies CompareScreen card structure has primary CTA "Explore This Trip" and secondary "Why this result? / Trip details"', () => {
    const compareSrc = readSrc('screens/CompareScreen.tsx');

    // Primary CTA: Explore This Trip
    expect(compareSrc).toContain('Explore This Trip →');

    // Secondary Expandable Action
    expect(compareSrc).toContain('Why this result? / Trip details');
    expect(compareSrc).toContain('aria-expanded={isExpanded}');

    // 2-column desktop layout
    expect(compareSrc).toContain('grid gap-6 md:grid-cols-2');
  });

  it('2. verifies CompareScreen displays the 3 prominent metrics in the card default view', () => {
    const compareSrc = readSrc('screens/CompareScreen.tsx');

    // Three prominent metrics
    expect(compareSrc).toContain('One-Way Drive');
    expect(compareSrc).toContain('Sightseeing');
    expect(compareSrc).toContain('Return Margin');

    // Plain-language feasibility explanation verdicts
    expect(compareSrc).toContain('On schedule:');
    expect(compareSrc).toContain('Narrow buffer:');
    expect(compareSrc).toContain('Projected late:');
  });

  it('3. verifies verbose technical details, delay what-if simulations, and drive arithmetic are moved into expandable details', () => {
    const compareSrc = readSrc('screens/CompareScreen.tsx');

    // Expandable details container
    expect(compareSrc).toContain('{isExpanded && (');

    // Delay what-if simulation inside details
    expect(compareSrc).toContain('What if the drive takes longer?');
    expect(compareSrc).toContain('Planning scenario · Not live GPS');
    expect(compareSrc).toContain('Extra travel allowance:');
    expect(compareSrc).toContain('Trade-Off Impact of');

    // Drive breakdown and 20% contingency buffer
    expect(compareSrc).toContain('Drive Breakdown (One Way):');
    expect(compareSrc).toContain('Includes 20% traffic contingency buffer to account for NICE Road toll plaza queues');

    // Checkpoint timeline and departure/return repetitions
    expect(compareSrc).toContain('Will I return before my deadline?');
    expect(compareSrc).toContain('Depart Bangalore:');
    expect(compareSrc).toContain('Return Arrival:');
  });

  it('4. verifies engine integrity with evaluateFeasibility and destinationAdjustments', () => {
    const mysuru = DESTINATIONS.find(d => d.id === 'mysuru')!;
    expect(mysuru).toBeDefined();

    const baselineConstraints: UserConstraints = {
      departureDateTime: '2026-10-17T06:00',
      returnDeadlineDateTime: '2026-10-18T22:00',
      partySize: 2,
      perPersonBudgetINR: 8000,
      pace: 'balanced',
      simulateDelayMinutes: 0,
      drivingAdjustmentMinutes: 0,
      disabledActivityIds: [],
      destinationAdjustments: {
        mysuru: 45,
      },
    };

    // Baseline feasibility with 0 extra delay
    const baseFeasibility = evaluateFeasibility(mysuru, {
      ...baselineConstraints,
      drivingAdjustmentMinutes: 0,
    });
    const expectedBaseOutbound = mysuru.baselineOneWayDriveMinutes + Math.round(mysuru.baselineOneWayDriveMinutes * 0.20);
    expect(baseFeasibility.outboundDriveMinutes).toBe(expectedBaseOutbound);

    // Feasibility with +45 min delay adjustment (affects base + 20% buffer on adjusted base)
    const adjustedFeasibility = evaluateFeasibility(mysuru, {
      ...baselineConstraints,
      drivingAdjustmentMinutes: 45,
    });
    const expectedAdjustedBase = mysuru.baselineOneWayDriveMinutes + 45;
    const expectedAdjustedOutbound = expectedAdjustedBase + Math.round(expectedAdjustedBase * 0.20);
    expect(adjustedFeasibility.outboundDriveMinutes).toBe(expectedAdjustedOutbound);
    expect(adjustedFeasibility.returnDeadlineMarginMinutes).toBeLessThan(baseFeasibility.returnDeadlineMarginMinutes);
    expect(adjustedFeasibility.homeArrivalTime).not.toBe(baseFeasibility.homeArrivalTime);
  });

  it('5. verifies recommendations return verified corridors and correct day counts', () => {
    const testConstraints: UserConstraints = {
      departureDateTime: '2026-10-17T06:00',
      returnDeadlineDateTime: '2026-10-18T21:00',
      partySize: 4,
      perPersonBudgetINR: 10000,
      pace: 'balanced',
      simulateDelayMinutes: 0,
      drivingAdjustmentMinutes: 0,
      disabledActivityIds: [],
    };

    const days = getCalendarDaysCount(testConstraints.departureDateTime, testConstraints.returnDeadlineDateTime);
    expect(days).toBe(2);

    const recs = getDestinationRecommendations(testConstraints);
    const verified = recs.filter(r => r.isVerified && r.destination && r.feasibility);
    expect(verified.length).toBe(4);

    const destIds = verified.map(v => v.destination?.id);
    expect(destIds).toContain('mysuru');
    expect(destIds).toContain('coorg-madikeri');
    expect(destIds).toContain('nandi-hills');
    expect(destIds).toContain('ooty');
  });
});
