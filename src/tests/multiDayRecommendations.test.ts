import { describe, it, expect } from 'vitest';
import { evaluateFeasibility, getCalendarDaysCount } from '../engine/scheduler';
import { getDestination } from '../data/destinations';
import { getDestinationRecommendations, CANDIDATE_DESTINATIONS } from '../engine/recommendations';
import { buildShareableParams, parseShareableTrip } from '../utils/tripShare';
import type { UserConstraints } from '../types';

describe('Checkpoint 1: Multi-Day Feasibility Engine & Smart Destination Recommendations', () => {
  const baseConstraints: UserConstraints = {
    departureDateTime: '2026-10-31T06:00',
    returnDeadlineDateTime: '2026-10-31T20:30',
    pace: 'balanced',
    perPersonBudgetINR: 6000,
    partySize: 2,
    drivingAdjustmentMinutes: 0,
    simulateDelayMinutes: 0,
    disabledActivityIds: [],
    selectedPitstopIds: [],
  };

  // ==========================================
  // Test A: Same-day nearby escape (1 calendar date)
  // ==========================================
  describe('Test A: Same-day nearby escape (Nandi Hills, 1 calendar day)', () => {
    const sameDayInputs: UserConstraints = {
      ...baseConstraints,
      departureDateTime: '2026-10-31T06:00',
      returnDeadlineDateTime: '2026-10-31T20:30', // 14.5 hours, same day
    };

    it('accurately identifies trip as 1 calendar date', () => {
      const numDays = getCalendarDaysCount(sameDayInputs.departureDateTime, sameDayInputs.returnDeadlineDateTime);
      expect(numDays).toBe(1);
    });

    it('schedules Nandi Hills as a single-day timetable without overnight rest or hotel nights', () => {
      const dest = getDestination('nandi-hills')!;
      const result = evaluateFeasibility(dest, sameDayInputs);

      expect(result.rating).not.toBe('Not Recommended');
      expect(result.destinationSlackMinutes).toBeGreaterThan(0);
      expect(result.returnDeadlineMarginMinutes).toBeGreaterThanOrEqual(0);

      // Must be Day 1 only
      const days = new Set(result.timeline.map(t => t.day));
      expect(days.has(1)).toBe(true);
      expect(days.has(2)).toBe(false);

      // No overnight rest block for same day trip
      const restBlocks = result.timeline.filter(t => t.category === 'REST');
      expect(restBlocks.length).toBe(0);

      // Hotel cost must be 0 for 0 nights
      // Trip total = roundTripFuel (1200) + tolls (230) + tickets (20 * 2 = 40) = 1470
      expect(result.estimatedTripTotalINR).toBe(1200 + 230 + 40);
    });

    it('ranks Nandi Hills as Top Recommendation for 1-day trip, and rejects 500km+ round-trip destinations', () => {
      const recs = getDestinationRecommendations(sameDayInputs);
      const nandi = recs.find(r => r.id === 'nandi-hills')!;
      const mysuru = recs.find(r => r.id === 'mysuru')!;
      const coorg = recs.find(r => r.id === 'coorg-madikeri')!;
      const ooty = recs.find(r => r.id === 'ooty')!;

      expect(nandi.tier).toBe('RECOMMENDED');
      expect(nandi.tierLabel).toBe('Top Recommendation');
      expect(nandi.whyRecommended).toContain('62 km');

      expect(mysuru.tier).toBe('TIGHT');
      expect(coorg.tier).toBe('NOT_RECOMMENDED');
      expect(ooty.tier).toBe('NOT_RECOMMENDED');
    });
  });

  // ==========================================
  // Test B: Existing 2-day journey (Mysuru regression preservation)
  // ==========================================
  describe('Test B: Existing 2-day journey (Mysuru regression preservation)', () => {
    const twoDayInputs: UserConstraints = {
      ...baseConstraints,
      departureDateTime: '2026-10-31T08:00',
      returnDeadlineDateTime: '2026-11-01T20:00', // 36 hours, 2 calendar dates
    };

    it('evaluates Mysuru as 2 calendar dates with Day 1 and Day 2 timetable and 1 hotel night', () => {
      const numDays = getCalendarDaysCount(twoDayInputs.departureDateTime, twoDayInputs.returnDeadlineDateTime);
      expect(numDays).toBe(2);

      const dest = getDestination('mysuru')!;
      const result = evaluateFeasibility(dest, twoDayInputs);

      expect(result.rating).toBe('Comfortable');
      expect(result.destinationSlackMinutes).toBeGreaterThan(120);

      // Contains Day 1 and Day 2
      const day1Items = result.timeline.filter(t => t.day === 1);
      const day2Items = result.timeline.filter(t => t.day === 2);
      expect(day1Items.length).toBeGreaterThan(0);
      expect(day2Items.length).toBeGreaterThan(0);

      // Check-in and overnight rest on Day 1
      expect(day1Items.some(t => t.category === 'CHECK_IN')).toBe(true);
      expect(day1Items.some(t => t.category === 'REST')).toBe(true);

      // Day 2 breakfast and return drive
      expect(day2Items.some(t => t.label.includes('Breakfast'))).toBe(true);
      expect(day2Items.some(t => t.category === 'DRIVE')).toBe(true);

      // Hotel cost: 1 night for party of 2 (1 room) = ₹3,800
      // Trip total = 2800 fuel + 660 tolls + 3800 stay + 240 palace tickets = 7500
      expect(result.estimatedTripTotalINR).toBe(2800 + 660 + 3800 + 240);
    });

    it('ranks Mysuru as Top Recommendation for a standard 2-day weekend', () => {
      const recs = getDestinationRecommendations(twoDayInputs);
      const mysuru = recs.find(r => r.id === 'mysuru')!;
      expect(mysuru.tier).toBe('RECOMMENDED');
      expect(mysuru.tierLabel).toBe('Top Recommendation');
    });
  });

  // ==========================================
  // Test C: 60.5-hour journey (3 calendar days, formerly blocked by 60h cap)
  // ==========================================
  describe('Test C: 60.5-hour journey (3 calendar dates, Oct 29 08:00 to Oct 31 20:30)', () => {
    const threeDayInputs: UserConstraints = {
      ...baseConstraints,
      departureDateTime: '2026-10-29T08:00',
      returnDeadlineDateTime: '2026-10-31T20:30', // 60.5 hours spanning 3 calendar dates
    };

    it('accurately identifies 60.5-hour window as 3 calendar dates', () => {
      const numDays = getCalendarDaysCount(threeDayInputs.departureDateTime, threeDayInputs.returnDeadlineDateTime);
      expect(numDays).toBe(3);
    });

    it('schedules Coorg across 3 days with complete Day 2 intermediate leisure, meals, and rest', () => {
      const dest = getDestination('coorg-madikeri')!;
      const result = evaluateFeasibility(dest, threeDayInputs);

      expect(result.rating).toBe('Comfortable');
      expect(result.returnDeadlineMarginMinutes).toBeGreaterThanOrEqual(0);

      // Timeline has Days 1, 2, 3
      const days = new Set(result.timeline.map(t => t.day));
      expect(days.has(1)).toBe(true);
      expect(days.has(2)).toBe(true);
      expect(days.has(3)).toBe(true);

      // Intermediate Day 2 verification
      const day2Items = result.timeline.filter(t => t.day === 2);
      expect(day2Items.some(t => t.label.includes('Breakfast'))).toBe(true);
      expect(day2Items.some(t => t.label.includes('Lunch'))).toBe(true);
      expect(day2Items.some(t => t.label.includes('Dinner'))).toBe(true);
      expect(day2Items.some(t => t.category === 'REST')).toBe(true);

      // Unallocated daytime hours honestly tagged as FREE
      const day2Free = day2Items.filter(t => t.category === 'FREE');
      expect(day2Free.length).toBeGreaterThan(0);

      // Hotel cost: 2 nights for party of 2 (1 room) = ₹4,500 * 2 = ₹9,000
      // Trip total = 4800 fuel + 660 tolls + 9000 stay + (50+40)*2 tickets (180) = 14,640
      expect(result.estimatedTripTotalINR).toBe(4800 + 660 + 9000 + 180);
    });

    it('ranks Coorg and Ooty as Top Recommendations for 3-day window', () => {
      const recs = getDestinationRecommendations(threeDayInputs);
      const coorg = recs.find(r => r.id === 'coorg-madikeri')!;
      const ooty = recs.find(r => r.id === 'ooty')!;
      const nandi = recs.find(r => r.id === 'nandi-hills')!;

      expect(coorg.tier).toBe('RECOMMENDED');
      expect(ooty.tier).toBe('RECOMMENDED');
      expect(nandi.tier).toBe('NOT_RECOMMENDED');
      expect(nandi.tierLabel).toBe('Better for Short Trips');
    });
  });

  // ==========================================
  // Test D: Four-day journey (Fri to Mon, 4 calendar dates)
  // ==========================================
  describe('Test D: Four-day journey (Fri to Mon, 4 calendar dates)', () => {
    const fourDayInputs: UserConstraints = {
      ...baseConstraints,
      departureDateTime: '2026-10-30T07:00',
      returnDeadlineDateTime: '2026-11-02T20:30', // 85.5 hours, 4 calendar dates
      perPersonBudgetINR: 15000,
    };

    it('accurately identifies Fri-to-Mon window across month boundary as 4 calendar dates', () => {
      const numDays = getCalendarDaysCount(fourDayInputs.departureDateTime, fourDayInputs.returnDeadlineDateTime);
      expect(numDays).toBe(4);
    });

    it('schedules Ooty across 4 days with 2 full intermediate days (Days 2 & 3) and 3 hotel nights', () => {
      const dest = getDestination('ooty')!;
      const result = evaluateFeasibility(dest, fourDayInputs);

      expect(result.returnDeadlineMarginMinutes).toBeGreaterThanOrEqual(0);

      // Timeline has Days 1, 2, 3, 4
      const days = new Set(result.timeline.map(t => t.day));
      expect(days.has(1)).toBe(true);
      expect(days.has(2)).toBe(true);
      expect(days.has(3)).toBe(true);
      expect(days.has(4)).toBe(true);

      // Days 2 and 3 both have breakfast, meals, rest, and free leisure
      for (const d of [2, 3]) {
        const dItems = result.timeline.filter(t => t.day === d);
        expect(dItems.some(t => t.label.includes('Breakfast'))).toBe(true);
        expect(dItems.some(t => t.category === 'REST')).toBe(true);
        expect(dItems.some(t => t.category === 'FREE')).toBe(true);
      }

      // Hotel cost: 3 nights = ₹5,000 * 3 = ₹15,000
      expect(result.estimatedTripTotalINR).toBe(5600 + 750 + 15000 + 160);
    });

    it('ranks Ooty and Coorg as Top Recommendations for 4-day escape', () => {
      const recs = getDestinationRecommendations(fourDayInputs);
      const ooty = recs.find(r => r.id === 'ooty')!;
      const coorg = recs.find(r => r.id === 'coorg-madikeri')!;

      expect(ooty.tier).toBe('RECOMMENDED');
      expect(ooty.tierLabel).toBe('Top Recommendation');
      expect(coorg.tier).toBe('RECOMMENDED');
    });
  });

  // ==========================================
  // Test E: Tight schedule warning & curfew verification
  // ==========================================
  describe('Test E: Tight schedule warning & Bandipur curfew', () => {
    it('detects tight schedule or night curfew advisory when Ooty is attempted in a tight window', () => {
      const tightOotyInputs: UserConstraints = {
        ...baseConstraints,
        departureDateTime: '2026-10-31T12:00',
        returnDeadlineDateTime: '2026-11-01T14:00', // Only 26 hours for a 7.75h drive each way
      };

      const dest = getDestination('ooty')!;
      const result = evaluateFeasibility(dest, tightOotyInputs);

      // In a 26 hour window with 15.5 hours of driving, destination slack or deadline margin is breached
      expect(
        result.rating === 'Not Recommended' ||
        result.rating === 'Tight' ||
        result.violations.some(v => v.type === 'POTENTIAL_NIGHT_CURFEW' || v.type === 'MISSED_DEADLINE')
      ).toBe(true);
    });
  });

  // ==========================================
  // Test F: Incognito sharing across 4 days
  // ==========================================
  describe('Test F: Incognito sharing across 4 days', () => {
    it('serializes 4-day trip parameters and reconstructs identically in guest context', () => {
      const fourDayInputs: UserConstraints = {
        departureDateTime: '2026-10-30T07:00',
        returnDeadlineDateTime: '2026-11-02T20:30',
        pace: 'relaxed',
        perPersonBudgetINR: 12500,
        partySize: 4,
        drivingAdjustmentMinutes: 30,
        simulateDelayMinutes: 0,
        disabledActivityIds: ['ooty-doddabetta'],
        selectedPitstopIds: ['maddur-tiffanys'],
        organizerName: 'Sujil',
        planningMode: 'group',
      };

      const params = buildShareableParams('ooty', fourDayInputs);
      const guestParsed = parseShareableTrip(params, 'ooty');

      expect(guestParsed.valid).toBe(true);
      if (!guestParsed.valid) return;

      expect(guestParsed.data.inputs.departureDateTime).toBe('2026-10-30T07:00');
      expect(guestParsed.data.inputs.returnDeadlineDateTime).toBe('2026-11-02T20:30');
      expect(guestParsed.data.inputs.perPersonBudgetINR).toBe(12500);
      expect(guestParsed.data.inputs.partySize).toBe(4);
      expect(guestParsed.data.inputs.drivingAdjustmentMinutes).toBe(30);
      expect(guestParsed.data.inputs.disabledActivityIds).toEqual(['ooty-doddabetta']);
      expect(guestParsed.data.inputs.selectedPitstopIds).toEqual(['maddur-tiffanys']);
      expect(guestParsed.data.organizerName).toBe('Sujil');
      expect(guestParsed.data.isGuestView).toBe(true);

      // Deterministic feasibility recalculation produces 4-day timetable
      const dest = getDestination('ooty')!;
      const recResult = evaluateFeasibility(dest, guestParsed.data.inputs);
      const days = new Set(recResult.timeline.map(t => t.day));
      expect(days.size).toBe(4);
    });

    it('rejects trips exceeding 4 calendar dates cleanly', () => {
      const fiveDayParams = new URLSearchParams({
        dep: '2026-10-28T08:00',
        ret: '2026-11-02T20:00', // 6 calendar dates
      });

      const parsed = parseShareableTrip(fiveDayParams, 'ooty');
      expect(parsed.valid).toBe(false);
      if (!parsed.valid) {
        expect(parsed.error).toContain('outside the supported range of 1 to 4');
      }
    });

    it('rejects inverted travel dates cleanly', () => {
      const invertedParams = new URLSearchParams({
        dep: '2026-11-02T08:00',
        ret: '2026-10-31T20:00',
      });

      const parsed = parseShareableTrip(invertedParams, 'mysuru');
      expect(parsed.valid).toBe(false);
      if (!parsed.valid) {
        expect(parsed.error).toContain('Return deadline must be after trip departure.');
      }
    });
  });

  // ==========================================
  // Test G: Recommendation differences across 1, 2, and 4-day windows
  // ==========================================
  describe('Test G: Recommendation differences across 1, 2, and 4-day windows', () => {
    it('adapts recommendations dynamically based on trip duration', () => {
      // 1-Day Trip
      const recs1 = getDestinationRecommendations({
        ...baseConstraints,
        departureDateTime: '2026-10-31T06:00',
        returnDeadlineDateTime: '2026-10-31T20:30',
      });
      expect(recs1[0].id).toBe('nandi-hills');
      expect(recs1[0].tier).toBe('RECOMMENDED');

      // 2-Day Trip
      const recs2 = getDestinationRecommendations({
        ...baseConstraints,
        departureDateTime: '2026-10-31T08:00',
        returnDeadlineDateTime: '2026-11-01T20:00',
      });
      expect(recs2[0].id).toBe('mysuru');
      expect(recs2[0].tier).toBe('RECOMMENDED');

      // 4-Day Trip
      const recs4 = getDestinationRecommendations({
        ...baseConstraints,
        departureDateTime: '2026-10-30T07:00',
        returnDeadlineDateTime: '2026-11-02T20:00',
      });
      const topIds4 = [recs4[0].id, recs4[1].id];
      expect(topIds4).toContain('ooty');
      expect(topIds4).toContain('coorg-madikeri');
    });

    it('includes all 8 catalog candidate destinations in honest curation tier', () => {
      expect(CANDIDATE_DESTINATIONS.length).toBe(8);
      const expectedCandidateIds = [
        'kabini',
        'sakleshpur',
        'chikmagalur',
        'yelagiri',
        'wayanad',
        'hampi',
        'pondicherry',
        'gokarna',
      ];
      for (const id of expectedCandidateIds) {
        expect(CANDIDATE_DESTINATIONS.some(c => c.id === id)).toBe(true);
      }

      const recs = getDestinationRecommendations(baseConstraints);
      const inCuration = recs.filter(r => !r.isVerified);
      expect(inCuration.length).toBe(8);
      for (const c of inCuration) {
        expect(c.tier).toBe('IN_CURATION');
        expect(c.tierLabel).toContain('In Curation');
      }
    });
  });
});
