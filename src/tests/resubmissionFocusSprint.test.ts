import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { evaluateFeasibility, getCalendarDaysCount, parseIST } from '../engine/scheduler';
import { getDestination } from '../data/destinations';
import { getDestinationRecommendations } from '../engine/recommendations';
import {
  buildShareableTripUrl,
  buildWhatsAppRSVPMessage,
  parseShareableTrip,
} from '../utils/tripShare';
import { saveTrip, getSavedTrips, deleteSavedTrip } from '../utils/savedTrips';
import type { UserConstraints } from '../types';

describe('Resubmission Product Focus Sprint (Gates 1-8)', () => {
  // 1. Same-day Nandi Hills trip
  it('1. evaluates same-day Nandi Hills trip with valid feasibility and return margin', () => {
    const inputs: UserConstraints = {
      departureDateTime: '2026-10-31T06:00',
      returnDeadlineDateTime: '2026-10-31T19:30',
      pace: 'balanced',
      perPersonBudgetINR: 2000,
      partySize: 2,
      drivingAdjustmentMinutes: 0,
      simulateDelayMinutes: 0,
      disabledActivityIds: [],
    };

    expect(getCalendarDaysCount(inputs.departureDateTime, inputs.returnDeadlineDateTime)).toBe(1);

    const dest = getDestination('nandi-hills')!;
    const result = evaluateFeasibility(dest, inputs);

    expect(result.rating).toMatch(/Comfortable|Tight/);
    expect(result.destinationSlackMinutes).toBeGreaterThan(0);
    expect(result.returnDeadlineMarginMinutes).toBeGreaterThan(0);
    expect(parseIST(result.homeArrivalTime)).toBeLessThanOrEqual(parseIST(inputs.returnDeadlineDateTime));
  });

  // 2. Two-day Mysuru trip
  it('2. evaluates two-day Mysuru trip with complete schedule and return deadline margin', () => {
    const inputs: UserConstraints = {
      departureDateTime: '2026-10-31T08:00',
      returnDeadlineDateTime: '2026-11-01T20:30',
      pace: 'balanced',
      perPersonBudgetINR: 6000,
      partySize: 2,
      drivingAdjustmentMinutes: 0,
      simulateDelayMinutes: 0,
      disabledActivityIds: [],
    };

    expect(getCalendarDaysCount(inputs.departureDateTime, inputs.returnDeadlineDateTime)).toBe(2);

    const dest = getDestination('mysuru')!;
    const result = evaluateFeasibility(dest, inputs);

    expect(result.rating).toBe('Comfortable');
    const daysInTimeline = new Set(result.timeline.map(t => t.day));
    expect(daysInTimeline.has(1)).toBe(true);
    expect(daysInTimeline.has(2)).toBe(true);
    expect(result.returnDeadlineMarginMinutes).toBeGreaterThan(0);
  });

  // 3. Three-day Coorg trip
  it('3. evaluates three-day Coorg trip across Western Ghats corridor', () => {
    const inputs: UserConstraints = {
      departureDateTime: '2026-10-31T06:00',
      returnDeadlineDateTime: '2026-11-02T20:30',
      pace: 'balanced',
      perPersonBudgetINR: 9000,
      partySize: 4,
      drivingAdjustmentMinutes: 0,
      simulateDelayMinutes: 0,
      disabledActivityIds: [],
    };

    expect(getCalendarDaysCount(inputs.departureDateTime, inputs.returnDeadlineDateTime)).toBe(3);

    const dest = getDestination('coorg-madikeri')!;
    const result = evaluateFeasibility(dest, inputs);

    expect(result.rating).toBe('Comfortable');
    const daysInTimeline = new Set(result.timeline.map(t => t.day));
    expect(daysInTimeline.has(1)).toBe(true);
    expect(daysInTimeline.has(2)).toBe(true);
    expect(daysInTimeline.has(3)).toBe(true);
    expect(result.destinationSlackMinutes).toBeGreaterThan(0);
  });

  // 4. Four-day Ooty trip
  it('4. evaluates four-day Ooty trip accounting for Bandipur corridor constraints', () => {
    const inputs: UserConstraints = {
      departureDateTime: '2026-10-30T06:00',
      returnDeadlineDateTime: '2026-11-02T20:30',
      pace: 'balanced',
      perPersonBudgetINR: 12000,
      partySize: 2,
      drivingAdjustmentMinutes: 0,
      simulateDelayMinutes: 0,
      disabledActivityIds: [],
    };

    expect(getCalendarDaysCount(inputs.departureDateTime, inputs.returnDeadlineDateTime)).toBe(4);

    const dest = getDestination('ooty')!;
    const result = evaluateFeasibility(dest, inputs);

    expect(result.rating).toBe('Comfortable');
    const daysInTimeline = new Set(result.timeline.map(t => t.day));
    expect(daysInTimeline.has(1)).toBe(true);
    expect(daysInTimeline.has(2)).toBe(true);
    expect(daysInTimeline.has(3)).toBe(true);
    expect(daysInTimeline.has(4)).toBe(true);
    expect(dest.routeRestriction?.name).toContain('Bandipur');
  });

  // 5. Comfortable, Tight, and Not Recommended outcomes
  it('5. produces Comfortable, Tight, and Not Recommended ratings deterministically', () => {
    const dest = getDestination('mysuru')!;

    // Comfortable: Generous 2-day window
    const comfortable = evaluateFeasibility(dest, {
      departureDateTime: '2026-10-31T07:00',
      returnDeadlineDateTime: '2026-11-01T21:30',
      pace: 'balanced',
      perPersonBudgetINR: 6000,
      partySize: 2,
      drivingAdjustmentMinutes: 0,
      simulateDelayMinutes: 0,
      disabledActivityIds: [],
    });
    expect(comfortable.rating).toBe('Comfortable');
    expect(comfortable.returnDeadlineMarginMinutes).toBeGreaterThanOrEqual(60);

    // Tight: Constrained departure and early return
    const tight = evaluateFeasibility(dest, {
      departureDateTime: '2026-10-31T09:30',
      returnDeadlineDateTime: '2026-10-31T22:30',
      pace: 'balanced',
      perPersonBudgetINR: 6000,
      partySize: 2,
      drivingAdjustmentMinutes: 0,
      simulateDelayMinutes: 0,
      disabledActivityIds: [],
    });
    expect(tight.rating).toBe('Tight');
    expect(tight.returnDeadlineMarginMinutes).toBeLessThan(60);

    // Not Recommended: Impossible window (departure 16:00, return 20:00 on same day for 300km roundtrip)
    const notRecommended = evaluateFeasibility(dest, {
      departureDateTime: '2026-10-31T16:00',
      returnDeadlineDateTime: '2026-10-31T20:00',
      pace: 'balanced',
      perPersonBudgetINR: 6000,
      partySize: 2,
      drivingAdjustmentMinutes: 0,
      simulateDelayMinutes: 0,
      disabledActivityIds: [],
    });
    expect(notRecommended.rating).toBe('Not Recommended');
    expect(notRecommended.returnDeadlineMarginMinutes).toBeLessThan(0);
  });

  // 6. Manual driving-time adjustment and downstream calculations
  it('6. recalculates one-way drive, leisure slack, and return margin on driving adjustment', () => {
    const dest = getDestination('mysuru')!;
    const baseInputs: UserConstraints = {
      departureDateTime: '2026-10-31T08:00',
      returnDeadlineDateTime: '2026-11-01T20:30',
      pace: 'balanced',
      perPersonBudgetINR: 6000,
      partySize: 2,
      drivingAdjustmentMinutes: 0,
      simulateDelayMinutes: 0,
      disabledActivityIds: [],
    };

    const baseResult = evaluateFeasibility(dest, baseInputs);

    // Apply +45m driving adjustment (models heavy highway bottleneck)
    const delayedResult = evaluateFeasibility(dest, {
      ...baseInputs,
      drivingAdjustmentMinutes: 45,
    });

    // Outbound drive should increase: (195+45)*1.2 = 288 vs 195*1.2 = 234 (+54m)
    expect(delayedResult.outboundDriveMinutes).toBe(288);
    expect(delayedResult.outboundDriveMinutes).toBeGreaterThan(baseResult.outboundDriveMinutes);
    expect(delayedResult.inboundDriveMinutes).toBe(288);
    expect(delayedResult.inboundDriveMinutes).toBeGreaterThan(baseResult.inboundDriveMinutes);

    // Leisure slack at destination is reduced because extra driving consumes available daytime
    expect(delayedResult.destinationSlackMinutes).toBeLessThan(baseResult.destinationSlackMinutes);

    // Test deadline scenario where return departure must shift significantly earlier to preserve safe arrival
    const tightBase = evaluateFeasibility(dest, {
      ...baseInputs,
      returnDeadlineDateTime: '2026-11-01T17:00',
      drivingAdjustmentMinutes: 0,
    });
    const tightDelayed = evaluateFeasibility(dest, {
      ...baseInputs,
      returnDeadlineDateTime: '2026-11-01T17:00',
      drivingAdjustmentMinutes: 45,
    });
    // In delayed case, return departure is forced 54m earlier (10:12 vs 11:06)
    const baseReturnEntry = tightBase.timeline.find(t => t.category === 'DRIVE' && t.day === 2)!;
    const delayedReturnEntry = tightDelayed.timeline.find(t => t.category === 'DRIVE' && t.day === 2)!;
    const baseDepartMs = parseIST(baseReturnEntry.startTime);
    const delayedDepartMs = parseIST(delayedReturnEntry.startTime);
    expect(delayedDepartMs).toBeLessThan(baseDepartMs);
    expect(Math.round((baseDepartMs - delayedDepartMs) / 60_000)).toBe(54);
  });

  // 7. Pitstop insertion/removal without double-counting meal time
  it('7. pitstop replaces arrival dining allowance without double-counting meal time', () => {
    const dest = getDestination('mysuru')!;
    const withPitstop: UserConstraints = {
      departureDateTime: '2026-10-24T08:30',
      returnDeadlineDateTime: '2026-10-25T20:30',
      pace: 'balanced',
      perPersonBudgetINR: 6000,
      partySize: 2,
      drivingAdjustmentMinutes: 45,
      simulateDelayMinutes: 0,
      disabledActivityIds: [],
      selectedPitstopIds: ['maddur-tiffanys'], // dwell: 30m, detour: 10m (total 40m, replaces 45m arrival meal)
    };

    const rWith = evaluateFeasibility(dest, withPitstop);

    // Verify Maddur Tiffanys block is in timeline
    const pitstopItem = rWith.timeline.find(t => t.category === 'PITSTOP');
    expect(pitstopItem).toBeDefined();
    expect(pitstopItem?.label).toContain('Maddur Tiffanys');

    // Check-in dining allowance is streamlined to 30m because meal was taken at pitstop
    const checkin = rWith.timeline.find(t => t.category === 'CHECK_IN');
    expect(checkin?.label).toContain('meal taken at pitstop');
    expect((parseIST(checkin!.endTime) - parseIST(checkin!.startTime)) / 60_000).toBe(30);
  });

  // 8. Return-margin accuracy
  it('8. calculates exact return deadline margin and accurately flags negative margins', () => {
    const dest = getDestination('mysuru')!;
    const inputs: UserConstraints = {
      departureDateTime: '2026-10-31T08:00',
      returnDeadlineDateTime: '2026-11-01T20:30',
      pace: 'balanced',
      perPersonBudgetINR: 6000,
      partySize: 2,
      drivingAdjustmentMinutes: 0,
      simulateDelayMinutes: 0,
      disabledActivityIds: [],
    };

    const result = evaluateFeasibility(dest, inputs);
    const expectedMargin = Math.round(
      (parseIST(inputs.returnDeadlineDateTime) - parseIST(result.homeArrivalTime)) / 60_000
    );
    expect(result.returnDeadlineMarginMinutes).toBe(expectedMargin);
  });

  // 9. Existing saved trips behavior
  it('9. preserves local trip saving and retrieval without account requirements', () => {
    const store = new Map<string, string>();
    const mockLocalStorage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, val: string) => store.set(key, val),
      removeItem: (key: string) => store.delete(key),
      clear: () => store.clear(),
    };
    (globalThis as any).localStorage = mockLocalStorage;
    (globalThis as any).window = globalThis;

    const saved = saveTrip({
      destinationId: 'mysuru',
      destinationName: 'Mysuru',
      routeName: 'Mysuru Expressway',
      departureDateTime: '2026-10-31T08:00',
      returnDeadlineDateTime: '2026-11-01T20:30',
      pace: 'balanced',
      partySize: 3,
      perPersonBudgetINR: 7500,
      shareUrl: 'https://at48.vercel.app/schedule/mysuru?v=1',
    });

    expect(saved).toBeDefined();
    expect(saved.destinationId).toBe('mysuru');

    const loaded = getSavedTrips();
    expect(loaded.length).toBeGreaterThan(0);
    expect(loaded[0].destinationId).toBe('mysuru');
    expect(loaded[0].partySize).toBe(3);
    expect(loaded[0].perPersonBudgetINR).toBe(7500);

    deleteSavedTrip(saved.id);
    expect(getSavedTrips().length).toBe(0);
  });

  // 10. Existing invitation links and guest access
  it('10. reconstructs trip from shared link and creates valid WhatsApp RSVP message', () => {
    const inputs: UserConstraints = {
      departureDateTime: '2026-10-31T08:00',
      returnDeadlineDateTime: '2026-11-01T20:30',
      pace: 'balanced',
      perPersonBudgetINR: 6000,
      partySize: 2,
      drivingAdjustmentMinutes: 0,
      simulateDelayMinutes: 0,
      disabledActivityIds: [],
      organizerName: 'Sujil',
      planningMode: 'group',
    };

    const shareUrl = buildShareableTripUrl('mysuru', inputs, 'https://at48.vercel.app');
    expect(shareUrl).toContain('/schedule/mysuru?');
    expect(shareUrl).toContain('org=Sujil');

    const searchParams = shareUrl.split('?')[1];
    const parsed = parseShareableTrip(searchParams, 'mysuru');
    expect(parsed.valid).toBe(true);
    if (!parsed.valid) return;

    expect(parsed.data.isGuestView).toBe(true);
    expect(parsed.data.organizerName).toBe('Sujil');

    const rsvpMsg = buildWhatsAppRSVPMessage({
      organizerName: parsed.data.organizerName,
      guestName: 'Roshan',
      destinationName: 'Mysuru',
      departureDateTime: parsed.data.inputs.departureDateTime,
      returnDeadlineDateTime: parsed.data.inputs.returnDeadlineDateTime,
      tripUrl: shareUrl,
    });

    expect(rsvpMsg).toContain('Hey Sujil, count me in for the Mysuru road trip');
    expect(rsvpMsg).toContain('- Roshan');
  });

  // 11. Codebase Audit: GATE 2, GATE 3, GATE 4, GATE 5, GATE 6 Verification
  it('11. verifies UI modifications across Page 2, Page 3, and Page 4', () => {
    const compareSrc = fs.readFileSync(path.resolve(__dirname, '../screens/CompareScreen.tsx'), 'utf8');
    const scheduleSrc = fs.readFileSync(path.resolve(__dirname, '../screens/ScheduleScreen.tsx'), 'utf8');
    const reviewSrc = fs.readFileSync(path.resolve(__dirname, '../screens/ReviewScreen.tsx'), 'utf8');

    // GATE 2: 8 candidate destination cards removed from CompareScreen UI
    expect(compareSrc).not.toContain('More escapes to explore');
    expect(compareSrc).not.toContain('candidateRecs.map');

    // GATE 3: Return feasibility is hero on CompareScreen
    expect(compareSrc).toContain('Will I return before my deadline?');
    expect(compareSrc).toContain('Usable Destination Leisure Time');
    expect(compareSrc).toContain('projected late');
    expect(scheduleSrc).toContain('projected late');

    // GATE 4: "What if the drive takes longer?" section with before/after comparison
    expect(compareSrc).toContain('What if the drive takes longer?');
    expect(compareSrc).toContain('Add extra travel time to see how it affects your itinerary and return deadline.');
    expect(compareSrc).toContain('Planning scenario · Not live GPS');
    expect(compareSrc).toContain('Trade-Off Impact of');

    // GATE 5: ScheduleScreen has focused feasibility and driving delay trade-offs
    expect(scheduleSrc).toContain('What if the drive takes longer?');
    expect(scheduleSrc).toContain('Add extra travel time to see how it affects your itinerary and return deadline.');
    expect(scheduleSrc).not.toContain('Weather Forecast: Outside 5-day predictive horizon');

    // GATE 6: ReviewScreen prioritizes Share Trip and answers all core questions
    expect(reviewSrc).toContain('Share Trip (Copy Link)');
    expect(reviewSrc).toContain('Save Trip (This Device)');
    expect(reviewSrc).toContain('Trip Invitation & RSVP');
  });

  // 12. Clearance Scenario 1: All four schedulable destinations remain available across 1, 2, 3, and 4 day durations
  it('12. keeps all four schedulable destinations available across different selected trip lengths without hard restrictions', () => {
    const durations = [
      { dep: '2026-10-31T06:00', ret: '2026-10-31T20:30' },
      { dep: '2026-10-31T08:00', ret: '2026-11-01T20:30' },
      { dep: '2026-10-31T07:00', ret: '2026-11-02T20:30' },
      { dep: '2026-10-31T06:00', ret: '2026-11-03T20:30' },
    ];

    for (const { dep, ret } of durations) {
      const inputs: UserConstraints = {
        departureDateTime: dep,
        returnDeadlineDateTime: ret,
        pace: 'balanced',
        perPersonBudgetINR: 6000,
        partySize: 2,
        drivingAdjustmentMinutes: 0,
        simulateDelayMinutes: 0,
        disabledActivityIds: [],
      };

      const recs = getDestinationRecommendations(inputs);
      const verified = recs.filter(r => r.isVerified && r.destination && r.feasibility);

      // Must always contain all 4 destinations
      expect(verified).toHaveLength(4);
      const ids = verified.map(v => v.id);
      expect(ids).toContain('nandi-hills');
      expect(ids).toContain('mysuru');
      expect(ids).toContain('coorg-madikeri');
      expect(ids).toContain('ooty');

      // Recommended durations do not act as hard restrictions: each has a complete feasibility result
      for (const item of verified) {
        expect(item.feasibility).toBeDefined();
        expect(item.feasibility?.timeline.length).toBeGreaterThan(0);
        expect(item.feasibility?.rating).toMatch(/Comfortable|Tight|Not Recommended/);
      }
    }
  });

  // 13. Clearance Scenario 2: 2-day Mysuru trip with +60m driving allowance recalculates itinerary and return deadline
  it('13. recalculates itinerary, leisure time, and return deadline for 2-day Mysuru with +60m driving allowance', () => {
    const dest = getDestination('mysuru')!;
    const baseInputs: UserConstraints = {
      departureDateTime: '2026-10-31T08:00',
      returnDeadlineDateTime: '2026-11-01T20:30',
      pace: 'balanced',
      perPersonBudgetINR: 6000,
      partySize: 2,
      drivingAdjustmentMinutes: 0,
      simulateDelayMinutes: 0,
      disabledActivityIds: [],
    };

    const baseResult = evaluateFeasibility(dest, baseInputs);

    // Apply +60 minutes driving allowance
    const adjustedResult = evaluateFeasibility(dest, {
      ...baseInputs,
      drivingAdjustmentMinutes: 60,
    });

    // 195 baseline + 60 adjustment = 255. 255 * 1.2 (20% contingency) = 306m
    expect(adjustedResult.outboundDriveMinutes).toBe(306);
    expect(adjustedResult.inboundDriveMinutes).toBe(306);
    expect(adjustedResult.outboundDriveMinutes).toBeGreaterThan(baseResult.outboundDriveMinutes);

    // Feasible leisure slack is reduced because extra driving consumes available daylight
    expect(adjustedResult.destinationSlackMinutes).toBeLessThan(baseResult.destinationSlackMinutes);

    // In delayed schedule, return departure shifts earlier to preserve safe home arrival
    const baseReturnEntry = baseResult.timeline.find(t => t.category === 'DRIVE' && t.day === 2)!;
    const adjReturnEntry = adjustedResult.timeline.find(t => t.category === 'DRIVE' && t.day === 2)!;
    const baseDepartMs = parseIST(baseReturnEntry.startTime);
    const adjDepartMs = parseIST(adjReturnEntry.startTime);
    expect(adjDepartMs).toBeLessThan(baseDepartMs);
    // (255*1.2) - (195*1.2) = 306 - 234 = 72m earlier departure
    expect(Math.round((baseDepartMs - adjDepartMs) / 60_000)).toBe(72);

    // For a tight deadline where arrival is projected late, verify negative margin calculation
    const tightDelayed = evaluateFeasibility(dest, {
      ...baseInputs,
      returnDeadlineDateTime: '2026-11-01T12:00',
      drivingAdjustmentMinutes: 60,
    });
    expect(tightDelayed.returnDeadlineMarginMinutes).toBeLessThan(0);
    expect(tightDelayed.rating).toBe('Not Recommended');
  });

  // 14. Clearance Scenario 3: Shared trip URLs with custom activities, saved trips, and guest RSVP remain functional
  it('14. verifies shared trip URLs with custom activities, saved trips, and guest RSVP functionality', () => {
    const inputsWithCustom: UserConstraints = {
      departureDateTime: '2026-10-31T08:00',
      returnDeadlineDateTime: '2026-11-01T20:30',
      pace: 'balanced',
      perPersonBudgetINR: 7000,
      partySize: 3,
      drivingAdjustmentMinutes: 30,
      simulateDelayMinutes: 0,
      disabledActivityIds: [],
      selectedPitstopIds: ['maddur-tiffanys'],
      organizerName: 'Anita',
      planningMode: 'group',
      customActivities: [
        {
          id: 'custom-1',
          name: 'Mysore Silk Saree Shopping',
          durationMinutes: 90,
          costPerPersonINR: 500,
          day: 1,
        },
      ],
    };

    // Serialize to URL
    const url = buildShareableTripUrl('mysuru', inputsWithCustom, 'https://at48.vercel.app');
    const queryString = url.split('?')[1];
    expect(queryString).toContain('ca=');
    expect(queryString).toContain('org=Anita');

    // Parse URL back
    const parsed = parseShareableTrip(queryString, 'mysuru');
    expect(parsed.valid).toBe(true);
    if (!parsed.valid) return;

    expect(parsed.data.organizerName).toBe('Anita');
    expect(parsed.data.isGuestView).toBe(true);
    expect(parsed.data.inputs.customActivities).toHaveLength(1);
    expect(parsed.data.inputs.customActivities?.[0].name).toBe('Mysore Silk Saree Shopping');
    expect(parsed.data.inputs.selectedPitstopIds).toContain('maddur-tiffanys');

    // Verify scheduled with custom activity present
    const dest = getDestination('mysuru')!;
    const feasibility = evaluateFeasibility(dest, parsed.data.inputs);
    const customEntry = feasibility.timeline.find(t => t.label === 'Mysore Silk Saree Shopping');
    expect(customEntry).toBeDefined();
    expect(customEntry?.isCustom).toBe(true);

    // Verify local save & retrieve
    const saved = saveTrip({
      destinationId: 'mysuru',
      destinationName: dest.name,
      routeName: dest.routeName,
      departureDateTime: parsed.data.inputs.departureDateTime,
      returnDeadlineDateTime: parsed.data.inputs.returnDeadlineDateTime,
      pace: parsed.data.inputs.pace,
      partySize: parsed.data.inputs.partySize,
      perPersonBudgetINR: parsed.data.inputs.perPersonBudgetINR,
      organizerName: parsed.data.organizerName,
      planningMode: parsed.data.planningMode,
      shareUrl: url,
    });
    expect(saved).toBeDefined();
    const retrieved = getSavedTrips();
    expect(retrieved.some(t => t.id === saved.id)).toBe(true);

    // Verify WhatsApp RSVP message generation
    const rsvpMessage = buildWhatsAppRSVPMessage({
      organizerName: 'Anita',
      guestName: 'Kavita',
      destinationName: 'Mysuru',
      departureDateTime: parsed.data.inputs.departureDateTime,
      returnDeadlineDateTime: parsed.data.inputs.returnDeadlineDateTime,
      tripUrl: url,
    });
    expect(rsvpMessage).toContain('Hey Anita, count me in for the Mysuru road trip');
    expect(rsvpMessage).toContain('- Kavita');
  });
});
