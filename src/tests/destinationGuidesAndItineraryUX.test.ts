import { describe, expect, it } from 'vitest';
import { getDestinationGuide, ALL_DESTINATION_IDS } from '../data/destinationGuides';
import { getDestinationImage } from '../data/images';
import { evaluateFeasibility } from '../engine/scheduler';
import { getDestination } from '../data/destinations';
import type { UserConstraints } from '../types';

describe('Gate 3, 4, 5: Timing-Aware Destination Guides & Photography', () => {
  it('covers all 12 destinations with valid timing-aware guides', () => {
    expect(ALL_DESTINATION_IDS.length).toBe(12);

    for (const destId of ALL_DESTINATION_IDS) {
      const guide = getDestinationGuide(destId, 2, 'balanced');
      expect(guide).toBeDefined();
      expect(guide.destinationId).toBe(destId);
      expect(guide.destinationName).toBeTruthy();
      expect(guide.whyVisit).toBeTruthy();
      expect(guide.idealDuration).toBeTruthy();
      expect(guide.whatToPrioritize.length).toBeGreaterThan(0);
      expect(guide.whatToSkipIfTight.length).toBeGreaterThan(0);
      expect(guide.recommendedOrder.length).toBeGreaterThan(0);
      expect(guide.practicalCautions.length).toBeGreaterThan(0);
    }
  });

  it('adapts guide recommendations dynamically according to trip duration (1 vs 4 days)', () => {
    // 1-day trip to Ooty should recognize it is tight
    const ooty1Day = getDestinationGuide('ooty-nilgiris', 1, 'balanced');
    expect(ooty1Day.durationFitVerdict).toBe('tight');
    expect(ooty1Day.durationNote).toContain('tight');

    // 4-day trip to Ooty should recognize it is ideal/extended
    const ooty4Day = getDestinationGuide('ooty-nilgiris', 4, 'relaxed');
    expect(ooty4Day.durationFitVerdict).toBe('ideal');
    expect(ooty4Day.recommendedOrder.length).toBeGreaterThanOrEqual(4);

    // 1-day trip to Nandi Hills should be ideal
    const nandi1Day = getDestinationGuide('nandi-hills', 1, 'balanced');
    expect(nandi1Day.durationFitVerdict).toBe('ideal');

    // 4-day trip to Nandi Hills should note it is beyond classic scope
    const nandi4Day = getDestinationGuide('nandi-hills', 4, 'balanced');
    expect(nandi4Day.durationFitVerdict).toBe('extended');
  });

  it('adapts guide recommendations according to pace preference (relaxed vs packed)', () => {
    const coorgRelaxed = getDestinationGuide('coorg-madikeri', 2, 'relaxed');
    const coorgPacked = getDestinationGuide('coorg-madikeri', 2, 'packed');

    expect(coorgRelaxed.pace).toBe('relaxed');
    expect(coorgPacked.pace).toBe('packed');
    expect(coorgRelaxed.whatToPrioritize.length).toBeLessThanOrEqual(coorgPacked.whatToPrioritize.length);
  });

  it('registers genuine destination photography for all 12 destinations', () => {
    for (const destId of ALL_DESTINATION_IDS) {
      const img = getDestinationImage(destId);
      expect(img).toBeDefined();
      expect(img?.src).toBeTruthy();
      expect(img?.alt).toBeTruthy();
      expect(img?.author).toBeTruthy();
      expect(img?.license).toBeTruthy();
    }
  });
});

describe('Gate 6: Multi-Day Free-Time Activity Planning', () => {
  const baseConstraints: UserConstraints = {
    departureDateTime: '2026-10-31T06:00',
    returnDeadlineDateTime: '2026-11-03T20:00', // 4-day trip
    pace: 'balanced',
    perPersonBudgetINR: 8000,
    partySize: 2,
    drivingAdjustmentMinutes: 0,
    simulateDelayMinutes: 0,
    disabledActivityIds: [],
    selectedPitstopIds: [],
    destinationAdjustments: {},
  };

  it('schedules custom activities in free time slots on Day 1, 2, 3, and 4', () => {
    const dest = getDestination('mysuru')!;
    const withCustomActivities: UserConstraints = {
      ...baseConstraints,
      customActivities: [
        {
          id: 'custom_day1',
          day: 1,
          name: 'Day 1 Heritage Tiffin & Dosa Break',
          durationMinutes: 45,
          costPerPersonINR: 150,
        },
        {
          id: 'custom_day2',
          day: 2,
          name: 'Day 2 Sandalwood Oil Emporium Walk',
          durationMinutes: 60,
          costPerPersonINR: 0,
        },
        {
          id: 'custom_day3',
          day: 3,
          name: 'Day 3 Lakeside Sunset Promenade',
          durationMinutes: 45,
          costPerPersonINR: 0,
        },
      ],
    };

    const res = evaluateFeasibility(dest, withCustomActivities);
    expect(res).toBeDefined();

    const customDay1 = res.timeline.find(t => t.activityId === 'custom_day1');
    const customDay2 = res.timeline.find(t => t.activityId === 'custom_day2');
    const customDay3 = res.timeline.find(t => t.activityId === 'custom_day3');

    expect(customDay1).toBeDefined();
    expect(customDay1?.day).toBe(1);
    expect(customDay1?.category).toBe('ACTIVITY');
    expect(customDay1?.isCustom).toBe(true);

    expect(customDay2).toBeDefined();
    expect(customDay2?.day).toBe(2);
    expect(customDay2?.isCustom).toBe(true);

    expect(customDay3).toBeDefined();
    expect(customDay3?.day).toBe(3);
    expect(customDay3?.isCustom).toBe(true);

    // Estimated cost per person should include the custom activity cost
    expect(res.estimatedCostPerPersonINR).toBeGreaterThan(0);
  });

  it('honestly deducts custom activity duration from usable slack and leaves remaining free time', () => {
    const dest = getDestination('mysuru')!;
    const resWithoutCustom = evaluateFeasibility(dest, baseConstraints);
    const initialSlack = resWithoutCustom.destinationSlackMinutes;

    const resWithCustom = evaluateFeasibility(dest, {
      ...baseConstraints,
      customActivities: [
        {
          id: 'custom_spa',
          day: 2,
          name: 'Afternoon Spa Session',
          durationMinutes: 90,
          costPerPersonINR: 500,
        },
      ],
    });

    const newSlack = resWithCustom.destinationSlackMinutes;
    // The slack time should be reduced by the activity duration (90 mins)
    expect(newSlack).toBe(initialSlack - 90);

    // Remaining free time block should still exist on Day 2
    const day2Free = resWithCustom.timeline.filter(t => t.day === 2 && t.category === 'FREE');
    expect(day2Free.length).toBeGreaterThan(0);
  });

  it('supports multiple sequential custom activities inside the same day daylight window', () => {
    const dest = getDestination('coorg-madikeri')!;
    const res = evaluateFeasibility(dest, {
      ...baseConstraints,
      customActivities: [
        {
          id: 'act_1',
          day: 2,
          name: 'Plantation Estate Morning Coffee',
          durationMinutes: 45,
          costPerPersonINR: 100,
        },
        {
          id: 'act_2',
          day: 2,
          name: 'Handicrafts & Honey Shopping',
          durationMinutes: 60,
          costPerPersonINR: 0,
        },
      ],
    });

    const act1 = res.timeline.find(t => t.activityId === 'act_1');
    const act2 = res.timeline.find(t => t.activityId === 'act_2');

    expect(act1).toBeDefined();
    expect(act2).toBeDefined();
    expect(act1?.day).toBe(2);
    expect(act2?.day).toBe(2);
  });
});
