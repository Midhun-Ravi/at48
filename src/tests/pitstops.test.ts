import { describe, expect, it } from 'vitest';
import { DESTINATIONS } from '../data/destinations';
import { evaluateFeasibility, parseIST } from '../engine/scheduler';
import type { UserConstraints } from '../types';

const destination = (id: string) => DESTINATIONS.find(d => d.id === id)!;

const base: UserConstraints = {
  departureDateTime: '2026-10-24T08:30',
  returnDeadlineDateTime: '2026-10-25T20:30',
  pace: 'balanced',
  perPersonBudgetINR: 6000,
  partySize: 2,
  drivingAdjustmentMinutes: 45,
  simulateDelayMinutes: 0,
  disabledActivityIds: [],
  selectedPitstopIds: [],
};

describe('Curated Highway Pitstops & Stop-Aware Scheduling Engine', () => {
  it('1. zero stops preserves existing baseline results exactly', () => {
    const mysuru = destination('mysuru');
    const withoutStops = evaluateFeasibility(mysuru, base);
    const withEmptyStops = evaluateFeasibility(mysuru, { ...base, selectedPitstopIds: [] });
    const withUndefinedStops = evaluateFeasibility(mysuru, { ...base, selectedPitstopIds: undefined });

    expect(withEmptyStops).toEqual(withoutStops);
    expect(withUndefinedStops).toEqual(withoutStops);
  });

  it('2. outbound pitstop inserts a correctly timed PITSTOP block', () => {
    const mysuru = destination('mysuru');
    const r = evaluateFeasibility(mysuru, { ...base, selectedPitstopIds: ['maddur-tiffanys'] });
    const stopBlock = r.timeline.find(t => t.category === 'PITSTOP');

    expect(stopBlock).toBeDefined();
    expect(stopBlock?.label).toContain('Maddur Tiffanys');
    // Dwell 30 + Detour 10 = 40 minutes duration
    const startMs = parseIST(stopBlock!.startTime);
    const endMs = parseIST(stopBlock!.endTime);
    expect((endMs - startMs) / 60_000).toBe(40);
  });

  it('3. added dwell and detour time shifts destination arrival correctly', () => {
    const mysuru = destination('mysuru');
    const baseResult = evaluateFeasibility(mysuru, base);
    const withStop = evaluateFeasibility(mysuru, { ...base, selectedPitstopIds: ['maddur-tiffanys'] });

    const baseArrivalEntry = baseResult.timeline.find(t => t.category === 'DRIVE' && t.day === 1)!;
    const stopLeg2Entry = withStop.timeline.filter(t => t.category === 'DRIVE' && t.day === 1)[1]!;

    const baseArrivalMs = parseIST(baseArrivalEntry.endTime);
    const stopArrivalMs = parseIST(stopLeg2Entry.endTime);
    // Arrival at destination shifts by exactly 40 minutes (30m dwell + 10m detour)
    expect((stopArrivalMs - baseArrivalMs) / 60_000).toBe(40);
  });

  it('4. fixed check-in waiting absorbs delays when arrival is before 1 PM', () => {
    const mysuru = destination('mysuru');
    // Departure at 08:00 with 0 adjustment: baseline arrival at 11:54 (195 + 39m buffer = 234 min = 3h 54m)
    const earlyBase: UserConstraints = {
      ...base,
      departureDateTime: '2026-10-24T08:00',
      drivingAdjustmentMinutes: 0,
    };
    const withoutStop = evaluateFeasibility(mysuru, earlyBase);
    const withStop = evaluateFeasibility(mysuru, { ...earlyBase, selectedPitstopIds: ['maddur-tiffanys'] });

    // Without stop: arrives at 11:54, waits 66m until 13:00 check-in
    const waitWithout = withoutStop.timeline.find(t => t.category === 'WAIT' && t.day === 1);
    expect(waitWithout).toBeDefined();
    expect((parseIST(waitWithout!.endTime) - parseIST(waitWithout!.startTime)) / 60_000).toBe(66);

    // With stop (40 min): arrives at 12:34, waits 26m until 13:00 check-in
    const waitWith = withStop.timeline.find(t => t.category === 'WAIT' && t.day === 1);
    expect(waitWith).toBeDefined();
    expect((parseIST(waitWith!.endTime) - parseIST(waitWith!.startTime)) / 60_000).toBe(26);

    // Both check-ins begin at exactly 13:00 (waiting window absorbed 40m of stop time)
    expect(waitWithout!.endTime).toBe(waitWith!.endTime);
  });

  it('5. attraction operating hour cutoffs and gate closures interact with stop scheduling', () => {
    const mysuru = destination('mysuru');
    // At return deadline 15:30, without pitstop Mysore Palace cannot fit on Day 1 before 17:30 closing
    // and cannot fit on Day 2 before return departure, causing REQUIRED_ACTIVITY_UNAVAILABLE.
    const deadline1530: UserConstraints = {
      ...base,
      departureDateTime: '2026-10-24T08:30',
      returnDeadlineDateTime: '2026-10-25T15:30',
    };
    const rWithout = evaluateFeasibility(mysuru, deadline1530);
    const rWith = evaluateFeasibility(mysuru, { ...deadline1530, selectedPitstopIds: ['maddur-tiffanys'] });

    expect(rWithout.rating).toBe('Not Recommended');
    expect(rWithout.activityOutcomes.find(a => a.activityId === 'mysuru-palace')?.status).toBe('unavailable');
    // With streamlined check-in after highway tiffin, Palace fits on Day 1 before 17:30 closing:
    expect(rWith.activityOutcomes.find(a => a.activityId === 'mysuru-palace')?.status).toBe('day1');
    expect(rWith.rating).not.toBe('Not Recommended');
  });

  it('6. does not double count driving contingency buffer or meal allowances', () => {
    const mysuru = destination('mysuru');
    const r = evaluateFeasibility(mysuru, { ...base, selectedPitstopIds: ['maddur-tiffanys'] });

    // Pure driving contingency is preserved (288m total = (195+45)*1.2)
    expect(r.outboundDriveMinutes).toBe(288);
    const drives = r.timeline.filter(t => t.category === 'DRIVE' && t.day === 1);
    expect(drives.length).toBe(2);

    // Check-in meal is streamlined because midday meal was taken at pitstop
    const checkin = r.timeline.find(t => t.category === 'CHECK_IN');
    expect(checkin?.label).toContain('meal taken at pitstop');
    expect((parseIST(checkin!.endTime) - parseIST(checkin!.startTime)) / 60_000).toBe(30);
  });

  it('7. invalid or incompatible stops are handled safely without crashing', () => {
    const mysuru = destination('mysuru');
    const r = evaluateFeasibility(mysuru, {
      ...base,
      selectedPitstopIds: ['invalid-non-existent-stop', 'maddur-tiffanys'],
    });

    expect(r.timeline.some(t => t.category === 'PITSTOP')).toBe(true);
    expect(r.violations.some(v => v.type === 'INVALID_INPUT' && v.message.includes('invalid-non-existent-stop'))).toBe(true);
  });

  it('8. existing budget and return calculations remain correct', () => {
    const mysuru = destination('mysuru');
    const baseResult = evaluateFeasibility(mysuru, base);
    const withStop = evaluateFeasibility(mysuru, { ...base, selectedPitstopIds: ['maddur-tiffanys'] });

    expect(withStop.estimatedCostPerPersonINR).toBe(baseResult.estimatedCostPerPersonINR);
    expect(withStop.estimatedTripTotalINR).toBe(baseResult.estimatedTripTotalINR);
  });

  it('9. optional activity toggles and 1-hour delay remain compatible with pitstops', () => {
    const mysuru = destination('mysuru');
    const r = evaluateFeasibility(mysuru, {
      ...base,
      simulateDelayMinutes: 60,
      disabledActivityIds: ['mysuru-market'],
      selectedPitstopIds: ['maddur-tiffanys'],
    });

    expect(r.timeline.some(t => t.category === 'PITSTOP')).toBe(true);
    expect(r.activityOutcomes.find(o => o.activityId === 'mysuru-market')?.status).toBe('omitted');
  });
});
