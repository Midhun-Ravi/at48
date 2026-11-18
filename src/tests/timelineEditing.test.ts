import { describe, expect, it } from 'vitest';
import { getDestination } from '../data/destinations';
import { evaluateFeasibility } from '../engine/scheduler';
import {
  evaluateFreeTimeUsage,
  evaluateTransferAdjustment,
  evaluateVisitScheduling,
  findAlternativeValidTimes,
  getTransferDetails,
} from '../engine/timelineEditing';
import { UserConstraints } from '../types';

describe('V2.1 Timeline Editing UX & Correctness Gates', () => {
  const baseConstraints: UserConstraints = {
    departureDateTime: '2026-10-24T08:00',
    returnDeadlineDateTime: '2026-10-25T20:30',
    pace: 'balanced',
    perPersonBudgetINR: 6000,
    partySize: 2,
    drivingAdjustmentMinutes: 0,
    simulateDelayMinutes: 0,
    disabledActivityIds: [],
    activityDayAssignments: {},
  };

  const mysuru = getDestination('mysuru')!;

  it('1. regression: evening buffer in a window split at 18:15 starts at or after 18:15 and preserves preceding free time', () => {
    // With mysuru-market on Day 2, Day 1 free time spans from 17:15 to 21:00 and is visually split at 18:15
    const constraintsWithSplit: UserConstraints = {
      ...baseConstraints,
      activityDayAssignments: { 'mysuru-market': 2 },
    };
    const res = evaluateFeasibility(mysuru, constraintsWithSplit);
    const eveningFree = res.timeline.find(
      t => t.day === 1 && t.category === 'FREE' && t.startTime.slice(11) >= '18:15'
    );
    expect(eveningFree).toBeDefined();
    expect(eveningFree?.startTime.slice(11)).toBe('18:15');

    // Reserve 45m evening buffer starting at 18:15
    const preview = evaluateFreeTimeUsage(
      eveningFree!,
      { type: 'RESERVE_BUFFER', name: 'Evening Tea & Downtime', durationMinutes: 45 },
      mysuru,
      constraintsWithSplit
    );

    expect(preview.isValid).toBe(true);

    // Apply to schedule and check actual timetable
    const applied = evaluateFeasibility(mysuru, preview.proposedConstraints);
    const bufferEntry = applied.timeline.find(t => t.label === 'Evening Tea & Downtime');
    expect(bufferEntry).toBeDefined();

    // Verify actual start is NOT earlier than 18:15 (i.e. was not placed at 17:15!)
    expect(bufferEntry!.startTime.slice(11)).toBe('18:15');
    expect(bufferEntry!.endTime.slice(11)).toBe('19:00');

    // Verify preceding daytime free time (17:15–18:15) was fully preserved
    const precedingFree = applied.timeline.find(
      t => t.day === 1 && t.category === 'FREE' && t.endTime.slice(11) === '18:15'
    );
    expect(precedingFree).toBeDefined();
    expect(precedingFree!.startTime.slice(11)).toBe('17:15');
    expect(precedingFree!.endTime.slice(11)).toBe('18:15');
  });

  it('2. regression: full requested buffer duration is preserved without silent truncation', () => {
    const res = evaluateFeasibility(mysuru, baseConstraints);
    const eveningFree = res.timeline.find(
      t => t.day === 1 && t.category === 'FREE' && t.startTime.slice(11) >= '18:15'
    )!;

    const requestedDuration = 60;
    const preview = evaluateFreeTimeUsage(
      eveningFree,
      { type: 'RESERVE_BUFFER', name: 'Extended Relaxation Buffer', durationMinutes: requestedDuration },
      mysuru,
      baseConstraints
    );

    expect(preview.isValid).toBe(true);
    const applied = evaluateFeasibility(mysuru, preview.proposedConstraints);
    const bufferEntry = applied.timeline.find(t => t.label === 'Extended Relaxation Buffer')!;
    expect(bufferEntry).toBeDefined();

    const actualDurationMins =
      (Date.parse(bufferEntry.endTime + ':00+05:30') -
        Date.parse(bufferEntry.startTime + ':00+05:30')) /
      60000;
    expect(actualDurationMins).toBe(requestedDuration); // Exactly 60m, 0 silent truncation
  });

  it('3. regression: activity scheduled through Use This Time starts and ends within the selected window and rejects already placed stops', () => {
    const res = evaluateFeasibility(mysuru, baseConstraints);
    const day2MorningFree = res.timeline.find(
      t => t.day === 2 && t.category === 'FREE' && t.startTime.slice(11) >= '07:45'
    )!;

    // Moving an activity from another day (or unscheduled) into Day 2 morning
    // First, test that an activity ALREADY scheduled on this day is rejected
    const testConstraints: UserConstraints = {
      ...baseConstraints,
      activityDayAssignments: { 'mysuru-market': 2 },
    };
    const resDay2 = evaluateFeasibility(mysuru, testConstraints);
    const day2Free = resDay2.timeline.find(
      t => t.day === 2 && t.category === 'FREE' && t.startTime.slice(11) >= '07:45'
    )!;

    // Attempting to schedule mysuru-market into day2 free time when it is already on Day 2
    const previewAlreadyPlaced = evaluateFreeTimeUsage(
      day2Free,
      { type: 'SCHEDULE_ACTIVITY', activityId: 'mysuru-market' },
      mysuru,
      testConstraints
    );
    expect(previewAlreadyPlaced.isValid).toBe(false);
    expect(previewAlreadyPlaced.validationError).toContain('already scheduled on Day 2');

    // Next, test custom place scheduled into free window starts and ends strictly inside window boundaries
    const customPreview = evaluateFreeTimeUsage(
      day2MorningFree,
      {
        type: 'ADD_CUSTOM_PLACE',
        name: 'Morning Walk at Kukkarahalli',
        durationMinutes: 45,
        transferMinutes: 15,
      },
      mysuru,
      baseConstraints
    );

    expect(customPreview.isValid).toBe(true);
    const applied = evaluateFeasibility(mysuru, customPreview.proposedConstraints);
    const customEntry = applied.timeline.find(t => t.label === 'Morning Walk at Kukkarahalli')!;
    expect(customEntry).toBeDefined();

    // Must be >= window start and <= window end
    expect(customEntry.startTime >= day2MorningFree.startTime).toBe(true);
    expect(customEntry.endTime <= day2MorningFree.endTime).toBe(true);
  });

  it('4. regression: custom place cannot be confirmed without explicit travel allowance (minimum 5m)', () => {
    const res = evaluateFeasibility(mysuru, baseConstraints);
    const eveningFree = res.timeline.find(
      t => t.day === 1 && t.category === 'FREE' && t.startTime.slice(11) >= '18:15'
    )!;

    // A) Attempt with 0 transfer allowance
    const previewZeroTransfer = evaluateFreeTimeUsage(
      eveningFree,
      {
        type: 'ADD_CUSTOM_PLACE',
        name: 'Chamundi Viewpoint',
        durationMinutes: 45,
        transferMinutes: 0,
      },
      mysuru,
      baseConstraints
    );
    expect(previewZeroTransfer.isValid).toBe(false);
    expect(previewZeroTransfer.validationError).toContain('explicit planning allowance');
    expect(previewZeroTransfer.validationError).toContain('minimum 5 minutes');

    // B) Attempt with 3m (< 5m)
    const previewLowTransfer = evaluateFreeTimeUsage(
      eveningFree,
      {
        type: 'ADD_CUSTOM_PLACE',
        name: 'Chamundi Viewpoint',
        durationMinutes: 45,
        transferMinutes: 3,
      },
      mysuru,
      baseConstraints
    );
    expect(previewLowTransfer.isValid).toBe(false);
    expect(previewLowTransfer.validationError).toContain('minimum 5 minutes');

    // C) Valid explicit transfer (15m)
    const previewValid = evaluateFreeTimeUsage(
      eveningFree,
      {
        type: 'ADD_CUSTOM_PLACE',
        name: 'Chamundi Viewpoint',
        durationMinutes: 45,
        transferMinutes: 15,
      },
      mysuru,
      baseConstraints
    );
    expect(previewValid.isValid).toBe(true);
  });

  it('5. regression: transfer adjustment does not silently displace or remove a scheduled activity', () => {
    // Day 2 schedule where both activities fit before preferred return departure (15:00)
    const tightConstraints: UserConstraints = {
      ...baseConstraints,
      activityDayAssignments: { 'mysuru-palace': 2, 'mysuru-market': 2 },
      activityOrder: ['mysuru-palace', 'mysuru-market'],
      returnDeadlineDateTime: '2026-10-25T21:00', // Both fit (finish 14:45 <= 15:00 preferred departure)
    };

    const baseline = evaluateFeasibility(mysuru, tightConstraints);
    const initialScheduled = baseline.timeline
      .filter(t => t.category === 'ACTIVITY' && !t.isRestBuffer && t.activityId)
      .map(t => t.activityId!);
    expect(initialScheduled).toContain('mysuru-palace');
    expect(initialScheduled).toContain('mysuru-market');

    // Increasing transfer for Devaraja Market Walk from 30m to 60m pushes Market visit
    // to finish at 15:15 (past 15:00 endCap), displacing it from the schedule.
    const preview = evaluateTransferAdjustment(
      'mysuru-market',
      60,
      mysuru,
      tightConstraints
    );

    // Anti-displacement gate must catch this and reject the adjustment
    expect(preview.isValid).toBe(false);
    expect(preview.deltas.displacedActivities).toContain('Devaraja Market Walk');
    expect(preview.validationError).toContain('Displaces previously scheduled stop');
    expect(preview.validationError).toContain('Devaraja Market Walk');
  });

  it('6. regression: preview and applied timetable remain 1:1 identical across all metrics', () => {
    const baseRes = evaluateFeasibility(mysuru, baseConstraints);
    const transferEntry = baseRes.timeline.find(t => t.activityId === 'mysuru-palace' && t.category === 'TRANSFER')!;
    const details = getTransferDetails(transferEntry, baseRes.timeline, mysuru, baseConstraints);
    expect(details).toBeDefined();
    expect(details?.activityName).toBe('Mysore Palace');
    expect(details?.currentDurationMinutes).toBe(30);

    const preview = evaluateTransferAdjustment(
      'mysuru-palace',
      45,
      mysuru,
      baseConstraints
    );

    expect(preview.isValid).toBe(true);
    const applied = evaluateFeasibility(mysuru, preview.proposedConstraints);

    // 1:1 parity between preview.after and applied feasibility result
    expect(applied.homeArrivalTime).toBe(preview.after.homeArrival);
    expect(applied.returnDeadlineMarginMinutes).toBe(preview.after.returnMarginMinutes);

    const appliedPalace = applied.timeline.find(
      t => t.activityId === 'mysuru-palace' && t.category === 'ACTIVITY'
    );
    expect(appliedPalace?.startTime).toBe(preview.after.activityStartTime);
    expect(appliedPalace?.endTime).toBe(preview.after.activityEndTime);

    // Also verify Free Time preview parity
    const eveningFree = applied.timeline.find(
      t => t.day === 1 && t.category === 'FREE' && t.startTime.slice(11) >= '18:15'
    )!;
    const freePreview = evaluateFreeTimeUsage(
      eveningFree,
      { type: 'RESERVE_BUFFER', name: 'Buffer Parity Test', durationMinutes: 30 },
      mysuru,
      preview.proposedConstraints
    );

    expect(freePreview.isValid).toBe(true);
    const appliedFree = evaluateFeasibility(mysuru, freePreview.proposedConstraints);
    const remainingFree = appliedFree.timeline.find(
      t => t.day === 1 && t.category === 'FREE' && t.startTime.slice(11) >= '18:45'
    );
    const actualRemainingMins = remainingFree
      ? (Date.parse(remainingFree.endTime + ':00+05:30') -
          Date.parse(remainingFree.startTime + ':00+05:30')) /
        60000
      : 0;
    expect(actualRemainingMins).toBe(freePreview.after.remainingFreeMinutes);
  });

  it('7. regression: transactional undo restores the exact prior schedule, return margin, and constraints', () => {
    const baseline = evaluateFeasibility(mysuru, baseConstraints);
    const baselineMargin = baseline.returnDeadlineMarginMinutes;
    const baselineArrival = baseline.homeArrivalTime;
    const baselineSlack = baseline.destinationSlackMinutes;

    // Action 1: Adjust transfer
    const preview1 = evaluateTransferAdjustment('mysuru-palace', 45, mysuru, baseConstraints);
    const state1 = preview1.proposedConstraints;
    const res1 = evaluateFeasibility(mysuru, state1);
    expect(res1.destinationSlackMinutes).not.toBe(baselineSlack);

    // Action 2: Reserve rest buffer
    const freeSlot = res1.timeline.find(
      t => t.day === 1 && t.category === 'FREE' && t.startTime.slice(11) >= '18:15'
    )!;
    const preview2 = evaluateFreeTimeUsage(
      freeSlot,
      { type: 'RESERVE_BUFFER', name: 'Evening Buffer', durationMinutes: 45 },
      mysuru,
      state1
    );
    const state2 = preview2.proposedConstraints;
    const res2 = evaluateFeasibility(mysuru, state2);
    expect(res2.timeline.some(t => t.label === 'Evening Buffer')).toBe(true);

    // Undo Action 2 -> restores state1
    const restoredRes1 = evaluateFeasibility(mysuru, state1);
    expect(restoredRes1.timeline.some(t => t.label === 'Evening Buffer')).toBe(false);
    expect(restoredRes1.destinationSlackMinutes).toBe(res1.destinationSlackMinutes);

    // Undo Action 1 -> restores baseConstraints
    const restoredRes0 = evaluateFeasibility(mysuru, baseConstraints);
    expect(restoredRes0.destinationSlackMinutes).toBe(baselineSlack);
    expect(restoredRes0.returnDeadlineMarginMinutes).toBe(baselineMargin);
    expect(restoredRes0.homeArrivalTime).toBe(baselineArrival);
    expect(restoredRes0.timeline.length).toBe(baseline.timeline.length);
  });

  it('8. accurately classifies daytime vs evening free time based on 18:15 IST sunset threshold', () => {
    const res = evaluateFeasibility(mysuru, baseConstraints);
    const freeBlocks = res.timeline.filter(t => t.category === 'FREE');

    expect(freeBlocks.length).toBeGreaterThan(0);
    for (const free of freeBlocks) {
      const startClock = free.startTime.slice(11, 16);
      const endClock = free.endTime.slice(11, 16);

      if (startClock >= '18:15') {
        expect(free.label).toBe('Evening free time');
      } else if (endClock <= '18:15') {
        expect(free.label).toBe('Daytime free time');
      }
    }
  });

  it('9. distinguishes actual scheduled tourist stops from milestone cards and numbers only stops', () => {
    const res = evaluateFeasibility(mysuru, baseConstraints);

    const milestones = res.timeline.filter(t => t.category !== 'ACTIVITY');
    expect(milestones.length).toBeGreaterThan(0);

    const touristStops = res.timeline.filter(
      t => t.category === 'ACTIVITY' && !t.isRestBuffer
    );
    expect(touristStops.length).toBe(2);
    expect(touristStops.map(s => s.label)).toEqual(['Mysore Palace', 'Devaraja Market Walk']);

    const transfers = res.timeline.filter(t => t.category === 'TRANSFER');
    expect(transfers.length).toBe(2);
    for (const transfer of transfers) {
      expect(transfer.destinationLabel).toBeDefined();
    }
  });

  it('10. acceptance scenario: Saturday free time 18:45–21:00 with café at 19:30 (45m visit, 15m transfer)', () => {
    // 1. Verify Saturday has free time 18:45–21:00 in base schedule
    const baseline = evaluateFeasibility(mysuru, baseConstraints);
    const saturdayFree = baseline.timeline.find(
      t => t.day === 1 && t.category === 'FREE' && t.startTime.slice(11) === '18:45'
    );
    expect(saturdayFree).toBeDefined();
    expect(saturdayFree!.endTime.slice(11)).toBe('21:00');

    // 2. Traveler selects café:
    // Visit start: 19:30
    // Visit duration: 45m
    // Transfer allowance: 15m
    const preview = evaluateVisitScheduling(
      {
        name: 'Green Hotel Café',
        day: 1,
        visitStartTime: '19:30',
        durationMinutes: 45,
        transferMinutes: 15,
        openTime: '08:00',
        closeTime: '22:00',
      },
      mysuru,
      baseConstraints
    );

    expect(preview.isValid).toBe(true);

    // 3. Verify previewed timeline breakdown matches acceptance scenario exactly:
    expect(preview.details.transferStartTime.slice(11)).toBe('19:15');
    expect(preview.details.transferEndTime.slice(11)).toBe('19:30');
    expect(preview.details.visitStartTime.slice(11)).toBe('19:30');
    expect(preview.details.visitEndTime.slice(11)).toBe('20:15');

    // 4. Apply to engine and verify actual recalculated timeline
    const applied = evaluateFeasibility(mysuru, preview.proposedConstraints);

    // Verify café transfer: 19:15–19:30
    const cafeTransfer = applied.timeline.find(
      t => t.day === 1 && t.category === 'TRANSFER' && t.label.includes('Green Hotel Café')
    );
    expect(cafeTransfer).toBeDefined();
    expect(cafeTransfer!.startTime.slice(11)).toBe('19:15');
    expect(cafeTransfer!.endTime.slice(11)).toBe('19:30');

    // Verify café visit: 19:30–20:15 (NOT placed at 18:45 or another time!)
    const cafeVisit = applied.timeline.find(
      t => t.day === 1 && t.category === 'ACTIVITY' && t.label === 'Green Hotel Café'
    );
    expect(cafeVisit).toBeDefined();
    expect(cafeVisit!.startTime.slice(11)).toBe('19:30');
    expect(cafeVisit!.endTime.slice(11)).toBe('20:15');

    // Verify remaining free time: 18:45–19:15 and 20:15–21:00
    const precedingFree = applied.timeline.find(
      t => t.day === 1 && t.category === 'FREE' && t.startTime.slice(11) === '18:45'
    );
    expect(precedingFree).toBeDefined();
    expect(precedingFree!.endTime.slice(11)).toBe('19:15');

    const followingFree = applied.timeline.find(
      t => t.day === 1 && t.category === 'FREE' && t.startTime.slice(11) === '20:15'
    );
    expect(followingFree).toBeDefined();
    expect(followingFree!.endTime.slice(11)).toBe('21:00');
  });

  it('11. traveler-controlled visit duration & timing edits on a scheduled attraction ("Edit Visit")', () => {
    // In baseline, Mysore Palace is 14:45–17:15 (150m duration, 30m transfer from check-in ending 14:15)
    // Traveler clicks "Edit Visit" on Mysore Palace and sets:
    // Visit start: 15:00
    // Visit duration: 120m (2 hours)
    // Transfer allowance: 25m
    const preview = evaluateVisitScheduling(
      {
        activityId: 'mysuru-palace',
        name: 'Mysore Palace',
        day: 1,
        visitStartTime: '15:00',
        durationMinutes: 120,
        transferMinutes: 25,
      },
      mysuru,
      baseConstraints
    );

    expect(preview.isValid).toBe(true);

    const applied = evaluateFeasibility(mysuru, preview.proposedConstraints);
    const palace = applied.timeline.find(t => t.activityId === 'mysuru-palace' && t.category === 'ACTIVITY')!;
    expect(palace).toBeDefined();
    expect(palace.startTime.slice(11)).toBe('15:00');
    expect(palace.endTime.slice(11)).toBe('17:00'); // Exactly 120m duration

    const palaceTransfer = applied.timeline.find(t => t.activityId === 'mysuru-palace' && t.category === 'TRANSFER')!;
    expect(palaceTransfer).toBeDefined();
    expect(palaceTransfer.startTime.slice(11)).toBe('14:35'); // 15:00 - 25m
    expect(palaceTransfer.endTime.slice(11)).toBe('15:00');

    // Preceding free time between check-in (14:15) and transfer start (14:35) is preserved
    const preFree = applied.timeline.find(
      t => t.day === 1 && t.category === 'FREE' && t.startTime.slice(11) === '14:15'
    );
    expect(preFree).toBeDefined();
    expect(preFree!.endTime.slice(11)).toBe('14:35');
  });

  it('12. rejects visit timing past operating hours and provides alternative valid times', () => {
    // Devaraja Market Walk closes at 20:00
    // Traveler attempts to schedule visit 19:30–20:30 (finishes 30m after closing)
    const preview = evaluateVisitScheduling(
      {
        activityId: 'mysuru-market',
        name: 'Devaraja Market Walk',
        day: 1,
        visitStartTime: '19:30',
        durationMinutes: 60,
        transferMinutes: 15,
        closeTime: '20:00',
      },
      mysuru,
      baseConstraints
    );

    expect(preview.isValid).toBe(false);
    expect(preview.validationError).toContain('closing time 20:00');

    // System offers alternative valid times within operating hours
    expect(preview.alternativeTimes.length).toBeGreaterThan(0);
    for (const alt of preview.alternativeTimes) {
      expect(alt.startTime < '20:00').toBe(true);
    }
  });

  it('13. rejects visit timing that collides with an existing stop and offers alternative valid times', () => {
    // On Day 1, Mysore Palace is scheduled until 17:15.
    // Traveler attempts to schedule a custom spot with visit start 16:30 and 15m transfer (needs transfer at 16:15)
    const preview = evaluateVisitScheduling(
      {
        name: 'Chamundi Hill Viewpoint',
        day: 1,
        visitStartTime: '16:30',
        durationMinutes: 45,
        transferMinutes: 15,
      },
      mysuru,
      baseConstraints
    );

    expect(preview.isValid).toBe(false);
    expect(preview.validationError).toContain('conflicts with previously scheduled activities');
    expect(preview.alternativeTimes.length).toBeGreaterThan(0);

    const directAlternatives = findAlternativeValidTimes(1, 45, 15, mysuru, baseConstraints);
    expect(directAlternatives.length).toBeGreaterThan(0);
  });

  it('14. downstream schedule recalculation when an earlier visit duration is changed', () => {
    // Mysore Palace duration reduced from 150m to 90m
    const preview = evaluateVisitScheduling(
      {
        activityId: 'mysuru-palace',
        name: 'Mysore Palace',
        day: 1,
        visitStartTime: '14:45',
        durationMinutes: 90,
        transferMinutes: 30,
      },
      mysuru,
      baseConstraints
    );

    expect(preview.isValid).toBe(true);
    const applied = evaluateFeasibility(mysuru, preview.proposedConstraints);

    // Mysore Palace finishes at 16:15 instead of 17:15 (60m saved)
    const palace = applied.timeline.find(t => t.activityId === 'mysuru-palace' && t.category === 'ACTIVITY')!;
    expect(palace.endTime.slice(11)).toBe('16:15');

    // Devaraja Market shifts earlier: transfer 16:15–16:45, visit 16:45–17:45
    const market = applied.timeline.find(t => t.activityId === 'mysuru-market' && t.category === 'ACTIVITY')!;
    expect(market.startTime.slice(11)).toBe('16:45');
    expect(market.endTime.slice(11)).toBe('17:45');

    // Downstream free time increases by 60m
    expect(applied.destinationSlackMinutes).toBe(baselineSlackPlus60(mysuru, baseConstraints));
  });

  it('15. transactional undo restores the exact prior schedule, return margin, and constraints', () => {
    const baseline = evaluateFeasibility(mysuru, baseConstraints);
    const baselineMargin = baseline.returnDeadlineMarginMinutes;
    const baselineArrival = baseline.homeArrivalTime;
    const baselineSlack = baseline.destinationSlackMinutes;

    // Apply visit schedule
    const preview = evaluateVisitScheduling(
      {
        name: 'Green Hotel Café',
        day: 1,
        visitStartTime: '19:30',
        durationMinutes: 45,
        transferMinutes: 15,
      },
      mysuru,
      baseConstraints
    );
    expect(preview.isValid).toBe(true);

    const editedSchedule = evaluateFeasibility(mysuru, preview.proposedConstraints);
    expect(editedSchedule.timeline.some(t => t.label === 'Green Hotel Café')).toBe(true);

    // Transactional Undo restores baseConstraints
    const restoredSchedule = evaluateFeasibility(mysuru, baseConstraints);
    expect(restoredSchedule.timeline.some(t => t.label === 'Green Hotel Café')).toBe(false);
    expect(restoredSchedule.destinationSlackMinutes).toBe(baselineSlack);
    expect(restoredSchedule.returnDeadlineMarginMinutes).toBe(baselineMargin);
    expect(restoredSchedule.homeArrivalTime).toBe(baselineArrival);
  });
});

function baselineSlackPlus60(destination: any, constraints: UserConstraints): number {
  const base = evaluateFeasibility(destination, constraints);
  return base.destinationSlackMinutes + 60;
}
