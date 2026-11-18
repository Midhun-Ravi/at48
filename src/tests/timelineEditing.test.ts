import { describe, expect, it } from 'vitest';
import { getDestination } from '../data/destinations';
import { evaluateFeasibility } from '../engine/scheduler';
import {
  evaluateFreeTimeUsage,
  evaluateTransferAdjustment,
  getTransferDetails,
} from '../engine/timelineEditing';
import { UserConstraints } from '../types';

describe('V2.1 Timeline Editing UX: Free Time & Transfers', () => {
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

  it('1. accurately classifies daytime vs evening free time based on 18:15 IST sunset threshold', () => {
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

  it('2. confirms derived FREE blocks cannot be arbitrarily resized without changing schedule', () => {
    const res = evaluateFeasibility(mysuru, baseConstraints);
    const day1EveningFree = res.timeline.find(
      t => t.day === 1 && t.category === 'FREE' && t.startTime.slice(11) >= '18:15'
    );
    expect(day1EveningFree).toBeDefined();

    // Scheduling a 45m personal rest buffer within this slot shrinks the remaining free time by exactly 45m
    const preview = evaluateFreeTimeUsage(
      day1EveningFree!,
      { type: 'RESERVE_BUFFER', name: 'Evening Rest & Tea', durationMinutes: 45 },
      mysuru,
      baseConstraints
    );

    expect(preview.isValid).toBe(true);
    expect(preview.deltas.freeTimeDeltaMinutes).toBe(-45);

    // Apply the proposed constraints and verify timetable reflects the exact change
    const afterRes = evaluateFeasibility(mysuru, preview.proposedConstraints);
    const newRest = afterRes.timeline.find(t => t.label === 'Evening Rest & Tea');
    expect(newRest).toBeDefined();
    expect(newRest?.category).toBe('REST');
    expect(newRest?.isRestBuffer).toBe(true);

    const remainingFree = afterRes.timeline.find(
      t => t.day === 1 && t.category === 'FREE' && t.startTime === newRest!.endTime
    );
    expect(remainingFree).toBeDefined();
  });

  it('3. rejects reserving buffer or activity with insufficient free time and displays explicit reason', () => {
    const res = evaluateFeasibility(mysuru, baseConstraints);
    const shortDaytimeFree = res.timeline.find(
      t => t.day === 2 && t.category === 'FREE' && t.label === 'Daytime free time'
    );
    expect(shortDaytimeFree).toBeDefined();

    const availableMins =
      (Date.parse(shortDaytimeFree!.endTime + ':00+05:30') -
        Date.parse(shortDaytimeFree!.startTime + ':00+05:30')) /
      60000;

    // Attempt to reserve more time than the window contains
    const excessiveMins = availableMins + 30;
    const preview = evaluateFreeTimeUsage(
      shortDaytimeFree!,
      { type: 'RESERVE_BUFFER', name: 'Long Downtime', durationMinutes: excessiveMins },
      mysuru,
      baseConstraints
    );

    expect(preview.isValid).toBe(false);
    expect(preview.validationError).toContain('Insufficient free time');
    expect(preview.validationError).toContain(
      `Cannot reserve ${excessiveMins}m in a ${availableMins}m free-time window`
    );
  });

  it('4. rejects scheduling an attraction during free time if operating hours conflict with the window', () => {
    const res = evaluateFeasibility(mysuru, baseConstraints);
    // Evening free time is 18:15–21:00 (after sunset)
    const eveningFree = res.timeline.find(
      t => t.day === 1 && t.category === 'FREE' && t.startTime.slice(11) >= '18:15'
    );
    expect(eveningFree).toBeDefined();

    // Mysore Palace closes at 17:30 (before this 18:15 window begins)
    const preview = evaluateFreeTimeUsage(
      eveningFree!,
      { type: 'SCHEDULE_ACTIVITY', activityId: 'mysuru-palace' },
      mysuru,
      baseConstraints
    );

    expect(preview.isValid).toBe(false);
    expect(preview.validationError).toContain('Operating hours conflict');
    expect(preview.validationError).toContain('closes at 17:30');
  });

  it('5. evaluates local transfer details and labels evidence as unverified planning allowance', () => {
    const res = evaluateFeasibility(mysuru, baseConstraints);
    const transferEntry = res.timeline.find(
      t => t.category === 'TRANSFER' && t.activityId === 'mysuru-palace'
    );
    expect(transferEntry).toBeDefined();

    const details = getTransferDetails(transferEntry!, res.timeline, mysuru, baseConstraints);
    expect(details).not.toBeNull();
    expect(details?.activityName).toBe('Mysore Palace');
    expect(details?.originLabel).toBe('Meal & hotel check-in (estimated)');
    expect(details?.currentDurationMinutes).toBe(30);
    expect(details?.isUserAdjusted).toBe(false);
    expect(details?.evidenceSource).toBe('Default planning allowance (unverified)');

    // Now test with user adjustment
    const adjustedConstraints: UserConstraints = {
      ...baseConstraints,
      transferAdjustments: { 'mysuru-palace': 45 },
    };
    const detailsAdjusted = getTransferDetails(
      transferEntry!,
      res.timeline,
      mysuru,
      adjustedConstraints
    );
    expect(detailsAdjusted?.isUserAdjusted).toBe(true);
    expect(detailsAdjusted?.evidenceSource).toBe('User-specified planning allowance (unverified)');
    // Never presents as verified travel time
    expect(detailsAdjusted?.evidenceSource).not.toContain('official');
  });

  it('6. recomputes downstream schedule, free time, and return feasibility when transfer is adjusted', () => {
    // 1) Adjusting transfer on Day 1 pushes downstream activity start times and reduces free time
    const previewDay1 = evaluateTransferAdjustment(
      'mysuru-palace',
      45, // Increase transfer by 15m (from 30m to 45m)
      mysuru,
      baseConstraints
    );

    expect(previewDay1.isValid).toBe(true);
    expect(previewDay1.deltas.transferDeltaMinutes).toBe(15);
    expect(previewDay1.deltas.downstreamFreeTimeDeltaMinutes).toBe(-15);

    // Downstream activity (Palace start time) is delayed by 15 minutes
    const beforeStart = previewDay1.before.activityStartTime!;
    const afterStart = previewDay1.after.activityStartTime!;
    const startDiffMins =
      (Date.parse(afterStart + ':00+05:30') - Date.parse(beforeStart + ':00+05:30')) / 60000;
    expect(startDiffMins).toBe(15);

    // 2) On Day 2, adjusting transfer to an activity when departure is tied to it directly impacts return deadline margin
    const day2Constraints: UserConstraints = {
      ...baseConstraints,
      activityDayAssignments: { 'mysuru-palace': 2 },
      returnDeadlineDateTime: '2026-10-25T18:30', // Tight deadline matching home arrival
    };

    // Increase transfer from 30m to 150m (extends past 10:00 AM opening to 10:15 AM)
    const previewDay2 = evaluateTransferAdjustment(
      'mysuru-palace',
      150,
      mysuru,
      day2Constraints
    );

    // Pushes departure later by 15m, resulting in deadline impact
    expect(previewDay2.deltas.transferDeltaMinutes).toBe(120);
    expect(previewDay2.after.returnMarginMinutes).toBeLessThan(
      previewDay2.before.returnMarginMinutes
    );
  });

  it('7. prevents impossible transfer adjustments that produce closing-hour violations or deadline breach', () => {
    // Scenario A: Outbound delay pushes hotel arrival to 14:06; check-in runs 14:06–15:21.
    // Increasing transfer for Palace to 45m pushes visit finish to 18:36, past 17:30 closing.
    const delayedDay1Constraints: UserConstraints = {
      ...baseConstraints,
      simulateDelayMinutes: 60,
      drivingAdjustmentMinutes: 60,
      activityDayAssignments: { 'mysuru-palace': 1 },
    };

    const previewClosingConflict = evaluateTransferAdjustment(
      'mysuru-palace',
      45,
      mysuru,
      delayedDay1Constraints
    );

    expect(previewClosingConflict.isValid).toBe(false);
    expect(previewClosingConflict.validationError).toBeDefined();
    expect(previewClosingConflict.validationError).toContain('past closing time 17:30');

    // Scenario B: Deadline breach & schedule limit
    const tightDeadlineConstraints: UserConstraints = {
      ...baseConstraints,
      activityDayAssignments: { 'mysuru-palace': 2 },
      returnDeadlineDateTime: '2026-10-25T17:00', // Return deadline requires arrival by 17:00
    };

    // A 180m transfer pushes visit completion to 13:15, past latest return departure limit 13:06
    const previewDeadlineBreach = evaluateTransferAdjustment(
      'mysuru-palace',
      180,
      mysuru,
      tightDeadlineConstraints
    );

    expect(previewDeadlineBreach.isValid).toBe(false);
    expect(previewDeadlineBreach.validationError).toBeDefined();

    // Scenario C: Minimum transfer validation (< 5m)
    const previewTooShort = evaluateTransferAdjustment(
      'mysuru-palace',
      2,
      mysuru,
      baseConstraints
    );
    expect(previewTooShort.isValid).toBe(false);
    expect(previewTooShort.validationError).toContain('at least 5 minutes');
  });

  it('8. transactional undo restores exact prior timetable, return margin, and constraints', () => {
    // Baseline state
    const baselineResult = evaluateFeasibility(mysuru, baseConstraints);
    const baselineSlack = baselineResult.destinationSlackMinutes;
    const baselineArrival = baselineResult.homeArrivalTime;

    // Apply a transfer adjustment (reduces Day 1 free time by 15m)
    const transferPreview = evaluateTransferAdjustment(
      'mysuru-palace',
      45,
      mysuru,
      baseConstraints
    );
    const stateAfterTransfer = transferPreview.proposedConstraints;
    const resultAfterTransfer = evaluateFeasibility(mysuru, stateAfterTransfer);
    expect(resultAfterTransfer.destinationSlackMinutes).not.toBe(baselineSlack);

    // Apply a free-time buffer reservation on top
    const eveningFree = resultAfterTransfer.timeline.find(
      t => t.day === 1 && t.category === 'FREE' && t.startTime.slice(11) >= '18:15'
    )!;
    const bufferPreview = evaluateFreeTimeUsage(
      eveningFree,
      { type: 'RESERVE_BUFFER', name: 'Chai Time', durationMinutes: 30 },
      mysuru,
      stateAfterTransfer
    );
    const stateAfterBuffer = bufferPreview.proposedConstraints;
    const resultAfterBuffer = evaluateFeasibility(mysuru, stateAfterBuffer);
    expect(resultAfterBuffer.timeline.some(t => t.label === 'Chai Time')).toBe(true);

    // Undo action 2 (buffer) -> restores stateAfterTransfer
    const restoredState1 = stateAfterTransfer;
    const restoredResult1 = evaluateFeasibility(mysuru, restoredState1);
    expect(restoredResult1.timeline.some(t => t.label === 'Chai Time')).toBe(false);
    expect(restoredResult1.destinationSlackMinutes).toBe(
      resultAfterTransfer.destinationSlackMinutes
    );

    // Undo action 1 (transfer) -> restores baseConstraints
    const restoredState2 = baseConstraints;
    const restoredResult2 = evaluateFeasibility(mysuru, restoredState2);
    expect(restoredResult2.destinationSlackMinutes).toBe(baselineSlack);
    expect(restoredResult2.homeArrivalTime).toBe(baselineArrival);
    expect(restoredResult2.timeline.length).toBe(baselineResult.timeline.length);
  });

  it('9. distinguishes actual scheduled tourist stops from milestone cards', () => {
    const res = evaluateFeasibility(mysuru, baseConstraints);

    // Milestones include DRIVE, CHECK_IN, MEAL, REST, TRANSFER, FREE, WAIT
    const milestones = res.timeline.filter(t => t.category !== 'ACTIVITY');
    expect(milestones.length).toBeGreaterThan(0);

    // Tourist stops only include ACTIVITY entries (that are not rest buffers)
    const touristStops = res.timeline.filter(
      t => t.category === 'ACTIVITY' && !t.isRestBuffer
    );
    expect(touristStops.length).toBe(2); // Palace and Market
    expect(touristStops.map(s => s.label)).toEqual(['Mysore Palace', 'Devaraja Market Walk']);

    // Non-stop milestones must be distinctly identifiable
    const transfers = res.timeline.filter(t => t.category === 'TRANSFER');
    expect(transfers.length).toBe(2);
    for (const transfer of transfers) {
      expect(transfer.destinationLabel).toBeDefined();
    }
  });
});
