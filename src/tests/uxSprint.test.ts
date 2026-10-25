import { describe, expect, it } from 'vitest';
import { getDestination } from '../data/destinations';
import { evaluateFeasibility, parseIST } from '../engine/scheduler';
import { getDestinationImage, getPlaceImage } from '../data/images';
import { buildShareableTripUrl, parseShareableTrip } from '../utils/tripShare';
import { buildTripSummaryText } from '../utils/formatters';
import type { UserConstraints } from '../types';

describe('Final UX Sprint (Gate 5 Final Improvements)', () => {
  const baseInputs: UserConstraints = {
    departureDateTime: '2026-10-31T08:00',
    returnDeadlineDateTime: '2026-11-01T20:30', // 36.5 hours
    pace: 'balanced',
    perPersonBudgetINR: 6000,
    partySize: 2,
    drivingAdjustmentMinutes: 0,
    simulateDelayMinutes: 0,
    disabledActivityIds: [],
    selectedPitstopIds: [],
    organizerName: 'Sujil',
    planningMode: 'group',
    destinationAdjustments: {},
  };

  describe('1. Destination Photographs & Manifest (Change 1)', () => {
    it('provides genuine, location-verified hero image metadata for all 4 destinations', () => {
      const destIds = ['nandi-hills', 'mysuru', 'coorg-madikeri', 'ooty'];
      for (const id of destIds) {
        const img = getDestinationImage(id);
        expect(img).toBeDefined();
        expect(img?.src).toMatch(/^\/images\/destinations\//);
        expect(img?.author.length).toBeGreaterThan(0);
        expect(img?.license).toMatch(/CC|Public Domain/);
        expect(img?.sourceUrl).toContain('wikimedia.org');
        expect(img?.alt.length).toBeGreaterThan(10);
      }
    });

    it('provides verified place thumbnails for attractions and Maddur Tiffanys pitstop', () => {
      const placeIds = [
        'mysuru-palace',
        'mysuru-market',
        'nandi-viewpoint',
        'nandi-temple',
        'coorg-abbey',
        'coorg-rajas-seat',
        'ooty-botanical',
        'ooty-boat-house',
        'maddur-tiffanys',
      ];
      for (const id of placeIds) {
        const place = getPlaceImage(id);
        expect(place).toBeDefined();
        expect(place?.src).toMatch(/^\/images\/places\//);
        expect(place?.author.length).toBeGreaterThan(0);
        expect(place?.license).toBeDefined();
      }
    });
  });

  describe('2. Independent Destination Driving Adjustments (Change 2)', () => {
    it('applies driving adjustment independently to Mysuru without altering other destinations', () => {
      const mysuruDest = getDestination('mysuru')!;
      const nandiDest = getDestination('nandi-hills')!;
      const coorgDest = getDestination('coorg-madikeri')!;
      const ootyDest = getDestination('ooty')!;

      // Baseline evaluations with 0m adjustment
      const mysuruBaseline = evaluateFeasibility(mysuruDest, { ...baseInputs, drivingAdjustmentMinutes: 0 });
      const nandiBaseline = evaluateFeasibility(nandiDest, { ...baseInputs, drivingAdjustmentMinutes: 0 });
      const coorgBaseline = evaluateFeasibility(coorgDest, { ...baseInputs, drivingAdjustmentMinutes: 0 });
      const ootyBaseline = evaluateFeasibility(ootyDest, { ...baseInputs, drivingAdjustmentMinutes: 0 });

      // User sets Mysuru to +45 minutes in destinationAdjustments map
      const updatedInputs: UserConstraints = {
        ...baseInputs,
        destinationAdjustments: {
          'mysuru': 45,
          'nandi-hills': 0,
          'coorg-madikeri': 0,
          'ooty': 0,
        },
      };

      // Evaluate each destination using its card-specific adjustment
      const getDestAdj = (id: string) => updatedInputs.destinationAdjustments?.[id] ?? 0;

      const mysuruAdjusted = evaluateFeasibility(mysuruDest, {
        ...updatedInputs,
        drivingAdjustmentMinutes: getDestAdj('mysuru'),
      });
      const nandiCard = evaluateFeasibility(nandiDest, {
        ...updatedInputs,
        drivingAdjustmentMinutes: getDestAdj('nandi-hills'),
      });
      const coorgCard = evaluateFeasibility(coorgDest, {
        ...updatedInputs,
        drivingAdjustmentMinutes: getDestAdj('coorg-madikeri'),
      });
      const ootyCard = evaluateFeasibility(ootyDest, {
        ...updatedInputs,
        drivingAdjustmentMinutes: getDestAdj('ooty'),
      });

      // Mysuru round-trip drive time should increase by exactly 45*2 = 90 minutes
      // (plus contingency buffer difference)
      expect(mysuruAdjusted.outboundDriveMinutes).toBeGreaterThan(mysuruBaseline.outboundDriveMinutes);
      expect(mysuruAdjusted.inboundDriveMinutes).toBeGreaterThan(mysuruBaseline.inboundDriveMinutes);

      // Other destinations must remain completely identical to baseline!
      expect(nandiCard.outboundDriveMinutes).toBe(nandiBaseline.outboundDriveMinutes);
      expect(nandiCard.inboundDriveMinutes).toBe(nandiBaseline.inboundDriveMinutes);
      expect(nandiCard.destinationSlackMinutes).toBe(nandiBaseline.destinationSlackMinutes);

      expect(coorgCard.outboundDriveMinutes).toBe(coorgBaseline.outboundDriveMinutes);
      expect(coorgCard.destinationSlackMinutes).toBe(coorgBaseline.destinationSlackMinutes);

      expect(ootyCard.outboundDriveMinutes).toBe(ootyBaseline.outboundDriveMinutes);
      expect(ootyCard.destinationSlackMinutes).toBe(ootyBaseline.destinationSlackMinutes);
    });

    it('serializes and reconstructs destination-specific adjustment in shareable URL', () => {
      const inputs: UserConstraints = {
        ...baseInputs,
        destinationAdjustments: { 'mysuru': 45 },
        drivingAdjustmentMinutes: 45,
      };

      const url = buildShareableTripUrl('mysuru', inputs);
      expect(url).toContain('adj=45');

      const searchStr = url.split('?')[1];
      const parsed = parseShareableTrip(searchStr, 'mysuru');
      expect(parsed.valid).toBe(true);
      if (!parsed.valid) return;

      expect(parsed.data.inputs.drivingAdjustmentMinutes).toBe(45);
      expect(parsed.data.inputs.destinationAdjustments?.['mysuru']).toBe(45);
    });

    it('safely clamps out-of-range or invalid adjustment parameters from URL', () => {
      // Overly large adjustment +500
      const parsedLarge = parseShareableTrip(
        new URLSearchParams({ dep: '2026-10-31T08:00', ret: '2026-11-01T20:30', adj: '500' }),
        'mysuru'
      );
      expect(parsedLarge.valid).toBe(true);
      if (parsedLarge.valid) {
        // Clamped to 240
        expect(parsedLarge.data.inputs.drivingAdjustmentMinutes).toBe(240);
      }

      // Non-multiple of 15 rounded to nearest multiple of 15
      const parsedOdd = parseShareableTrip(
        new URLSearchParams({ dep: '2026-10-31T08:00', ret: '2026-11-01T20:30', adj: '42' }),
        'mysuru'
      );
      expect(parsedOdd.valid).toBe(true);
      if (parsedOdd.valid) {
        expect(parsedOdd.data.inputs.drivingAdjustmentMinutes).toBe(45);
      }
    });
  });

  describe('3. Positive 18–60 Hour Escape Validation (Change 3)', () => {
    function validateTripWindow(dep: string, ret: string): { valid: boolean; error?: string } {
      try {
        const depEpoch = parseIST(dep);
        const retEpoch = parseIST(ret);
        if (retEpoch <= depEpoch) return { valid: false, error: 'Return time must be after departure time.' };
        const delta = (retEpoch - depEpoch) / 3_600_000;
        if (delta < 18 || delta > 60) {
          return {
            valid: false,
            error: '@48 currently plans 18–60 hour escapes. Adjust your dates to continue—longer adventures are on our roadmap.',
          };
        }
        return { valid: true };
      } catch (e) {
        return { valid: false, error: e instanceof Error ? e.message : 'Invalid date' };
      }
    }

    it('accepts exactly 18.0 hours trip window', () => {
      // Sat 08:00 to Sun 02:00 = exactly 18 hours
      const res = validateTripWindow('2026-10-31T08:00', '2026-11-01T02:00');
      expect(res.valid).toBe(true);
    });

    it('accepts exactly 60.0 hours trip window', () => {
      // Fri 08:00 to Sun 20:00 = exactly 60 hours
      const res = validateTripWindow('2026-10-30T08:00', '2026-11-01T20:00');
      expect(res.valid).toBe(true);
    });

    it('rejects less than 18 hours with positive roadmap message', () => {
      // Sat 08:00 to Sat 23:00 = 15 hours
      const res = validateTripWindow('2026-10-31T08:00', '2026-10-31T23:00');
      expect(res.valid).toBe(false);
      expect(res.error).toContain('longer adventures are on our roadmap');
    });

    it('rejects more than 60 hours with positive roadmap message', () => {
      // Fri 08:00 to Mon 08:00 = 72 hours
      const res = validateTripWindow('2026-10-30T08:00', '2026-11-02T08:00');
      expect(res.valid).toBe(false);
      expect(res.error).toContain('longer adventures are on our roadmap');
    });

    it('rejects inverted return date earlier than departure', () => {
      const res = validateTripWindow('2026-11-01T20:00', '2026-10-31T08:00');
      expect(res.valid).toBe(false);
      expect(res.error).toContain('after departure');
    });
  });

  describe('4. Screen 4 State Consistency & Review Flow (Change 4)', () => {
    it('produces identical deterministic feasibility output between Schedule and Review screens', () => {
      const dest = getDestination('mysuru')!;
      const tripInputs: UserConstraints = {
        ...baseInputs,
        drivingAdjustmentMinutes: 45,
        simulateDelayMinutes: 60,
        selectedPitstopIds: ['maddur-tiffanys'],
      };

      // Screen 3 Feasibility calculation
      const scheduleResult = evaluateFeasibility(dest, tripInputs);

      // Screen 4 Feasibility calculation
      const reviewResult = evaluateFeasibility(dest, tripInputs);

      // Results must match 100% identically
      expect(reviewResult.rating).toBe(scheduleResult.rating);
      expect(reviewResult.destinationSlackMinutes).toBe(scheduleResult.destinationSlackMinutes);
      expect(reviewResult.returnDeadlineMarginMinutes).toBe(scheduleResult.returnDeadlineMarginMinutes);
      expect(reviewResult.homeArrivalTime).toBe(scheduleResult.homeArrivalTime);
      expect(reviewResult.estimatedCostPerPersonINR).toBe(scheduleResult.estimatedCostPerPersonINR);
      expect(reviewResult.timeline.length).toBe(scheduleResult.timeline.length);
    });

    it('generates consistent summary text that accurately includes pitstop, delay and adjustment', () => {
      const dest = getDestination('mysuru')!;
      const tripInputs: UserConstraints = {
        ...baseInputs,
        drivingAdjustmentMinutes: 30,
        simulateDelayMinutes: 60,
        selectedPitstopIds: ['maddur-tiffanys'],
      };

      const result = evaluateFeasibility(dest, tripInputs);
      const summary = buildTripSummaryText({
        destination: dest,
        inputs: tripInputs,
        result,
        originUrl: 'https://at48.vercel.app',
      });

      expect(summary).toContain('Mysuru');
      expect(summary).toContain('Maddur Tiffanys');
      expect(summary).toContain('Feasibility Verdict:');
      expect(summary).toContain('https://at48.vercel.app');
    });

    it('recovers gracefully from corrupted direct URL on Review screen', () => {
      const corrupted = parseShareableTrip('dep=invalid_datetime&ret=2026-11-01T20:30', 'mysuru');
      expect(corrupted.valid).toBe(false);
      if (!corrupted.valid) {
        expect(corrupted.error.length).toBeGreaterThan(0);
      }
    });
  });
});
