import { describe, expect, it } from 'vitest';
import { DESTINATIONS } from '../data/destinations';
import { evaluateFeasibility, formatIST, parseIST } from '../engine/scheduler';
import type { UserConstraints } from '../types';

const destination = (id: string) => DESTINATIONS.find(d => d.id === id)!;
const base: UserConstraints = {
  departureDateTime: '2026-10-24T08:30', returnDeadlineDateTime: '2026-10-25T20:30',
  pace: 'balanced', perPersonBudgetINR: 6000, partySize: 2,
  drivingAdjustmentMinutes: 45, simulateDelayMinutes: 0, disabledActivityIds: [],
};

describe('@48 deterministic feasibility engine', () => {
  it('handles IST in a device-timezone-independent way', () => {
    expect(formatIST(parseIST('2026-10-25T07:00'))).toBe('2026-10-25T07:00');
    expect(formatIST(parseIST('2026-10-24T23:45') + 30*60_000)).toBe('2026-10-25T00:15');
  });
  it('rejects non-existent dates and inverted trip windows', () => {
    expect(() => parseIST('2026-02-30T08:00')).toThrow();
    expect(() => evaluateFeasibility(destination('mysuru'), {...base, returnDeadlineDateTime:'2026-10-24T08:00'})).toThrow();
  });
  it('supports +45 minute origin adjustment and 20% driving contingency', () => {
    const r = evaluateFeasibility(destination('mysuru'), base);
    expect(r.outboundDriveMinutes).toBe(288); // (195+45)*1.2
    expect(r.inboundDriveMinutes).toBe(288);
  });
  it('rolls Abbey Falls to Sunday if Saturday schedule cannot fit', () => {
    const r = evaluateFeasibility(destination('coorg-madikeri'), base);
    expect(r.activityOutcomes.find(o=>o.activityId==='coorg-abbey')?.status).toBe('day2');
    expect(r.violations.some(v=>v.type==='REQUIRED_ACTIVITY_UNAVAILABLE')).toBe(false);
  });
  it('validates full attraction duration and last-entry restrictions', () => {
    const late = evaluateFeasibility(destination('mysuru'), {...base,departureDateTime:'2026-10-24T11:30'});
    const palace = late.timeline.find(t=>t.activityId==='mysuru-palace');
    expect(palace, 'Palace activity should be scheduled in timeline').toBeDefined();
    if (!palace) {
      throw new Error('Palace activity was not scheduled');
    }
    expect(palace.day).toBe(2);
    expect(palace.endTime.slice(11) <= '17:30').toBe(true);
  });
  it('one hour outbound delay affects the itinerary and drive time', () => {
    const before = evaluateFeasibility(destination('mysuru'), base);
    const after = evaluateFeasibility(destination('mysuru'), {...base,simulateDelayMinutes:60});
    expect(after.outboundDriveMinutes - before.outboundDriveMinutes).toBe(60);
    expect(after.timeline[0].endTime).not.toEqual(before.timeline[0].endTime);
  });
  it('optional removal updates free time and ticket cost but not necessarily the return margin', () => {
    const before = evaluateFeasibility(destination('coorg-madikeri'), base);
    const after = evaluateFeasibility(destination('coorg-madikeri'), {...base,disabledActivityIds:['coorg-raja']});
    expect(after.destinationSlackMinutes).toBeGreaterThan(before.destinationSlackMinutes);
    expect(after.estimatedTripTotalINR).toBeLessThan(before.estimatedTripTotalINR);
    if (after.homeArrivalTime === before.homeArrivalTime)
      expect(after.returnDeadlineMarginMinutes).toBe(before.returnDeadlineMarginMinutes);
  });
  it('flags impossible return deadlines as Not Recommended', () => {
    const r = evaluateFeasibility(destination('ooty'), {...base,returnDeadlineDateTime:'2026-10-25T14:00'});
    expect(r.rating).toBe('Not Recommended');
    expect(r.violations.some(v=>v.severity==='BLOCKER')).toBe(true);
  });
  it('budget overrun is non-blocking', () => {
    const r = evaluateFeasibility(destination('ooty'), {...base,perPersonBudgetINR:3000});
    expect(r.isBudgetExceeded).toBe(true);
    expect(r.violations.find(v=>v.type==='BUDGET_OVERRUN')?.severity).toBe('WARNING');
  });
  it('Bandipur provisional crossing generates advisory, not a fake confirmed breach', () => {
    const r = evaluateFeasibility(destination('ooty'), {
      ...base,departureDateTime:'2026-10-24T17:00',returnDeadlineDateTime:'2026-10-25T23:00',
    });
    expect(r.violations.some(v=>v.type==='POTENTIAL_NIGHT_CURFEW' && v.severity==='ADVISORY')).toBe(true);
  });
  it('each scheduled ACTIVITY lies fully inside the recorded hours', () => {
    for (const d of DESTINATIONS) {
      const r = evaluateFeasibility(d, base);
      for (const item of r.timeline.filter(t=>t.category==='ACTIVITY')) {
        const activity = d.activities.find(a=>a.id===item.activityId)!;
        expect(item.startTime.slice(11) >= activity.openTime).toBe(true);
        expect(item.endTime.slice(11) <= activity.closeTime).toBe(true);
      }
    }
  });
});
