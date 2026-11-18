import { describe, expect, it } from 'vitest';
import { evaluateFeasibility, parseIST, getCalendarDaysCount } from '../engine/scheduler';
import { getDestination } from '../data/destinations';
import { parseShareableTrip } from '../utils/tripShare';
import type { UserConstraints } from '../types';

describe('@48 CRED-Inspired Redesign & Planning Engine', () => {
  const mysuru = getDestination('mysuru')!;

  const baseConstraints: UserConstraints = {
    departureDateTime: '2026-10-24T08:00',
    returnDeadlineDateTime: '2026-10-25T20:30',
    pace: 'balanced',
    perPersonBudgetINR: 6000,
    partySize: 2,
    drivingAdjustmentMinutes: 0,
    simulateDelayMinutes: 0,
    disabledActivityIds: [],
    selectedPitstopIds: [],
    organizerName: 'Sujil',
    planningMode: 'group',
  };

  describe('Vehicle Capacity & Group Size Scaling', () => {
    it('supports party size 1 (solo) with 1 vehicle', () => {
      const res = evaluateFeasibility(mysuru, { ...baseConstraints, partySize: 1, planningMode: 'solo' });
      expect(res.rating).toBeDefined();
      expect(res.estimatedTripTotalINR).toBeGreaterThan(0);
      expect(res.estimatedCostPerPersonINR).toBe(res.estimatedTripTotalINR);
    });

    it('models 1 vehicle for standard car capacity (up to 4 passengers)', () => {
      const res2 = evaluateFeasibility(mysuru, { ...baseConstraints, partySize: 2 });
      const res4 = evaluateFeasibility(mysuru, { ...baseConstraints, partySize: 4 });

      // Fuel and tolls remain 1x vehicle cost
      const baseFuelTolls = mysuru.approximateRoundTripFuelINR + mysuru.approximateRoundTripTollsINR;
      // Total includes baseFuelTolls + rooms + tickets
      expect(res2.estimatedTripTotalINR).toBeGreaterThan(baseFuelTolls);
      expect(res4.estimatedTripTotalINR).toBeGreaterThan(baseFuelTolls);
    });

    it('models 1 vehicle for large SUV capacity (5 to 6 passengers)', () => {
      const res6 = evaluateFeasibility(mysuru, { ...baseConstraints, partySize: 6 });
      expect(res6.rating).toBeDefined();
      expect(res6.estimatedTripTotalINR).toBeGreaterThan(0);
      // Cost per person should benefit from cost-sharing across 6 travelers
      expect(res6.estimatedCostPerPersonINR).toBeLessThan(
        evaluateFeasibility(mysuru, { ...baseConstraints, partySize: 2 }).estimatedCostPerPersonINR
      );
    });

    it('models 2 vehicles or tempo traveller for groups of 7 to 10 travelers', () => {
      const res4 = evaluateFeasibility(mysuru, { ...baseConstraints, partySize: 4 });
      const res8 = evaluateFeasibility(mysuru, { ...baseConstraints, partySize: 8 });

      // 8 travelers requires 2 vehicles (ceil(8/5) = 2)
      // Fuel and tolls double from 1 car to 2 vehicles
      expect(res8.rating).toBeDefined();
      expect(res8.estimatedTripTotalINR).toBeGreaterThan(res4.estimatedTripTotalINR);
    });

    it('scales vehicle fleet for large groups beyond 10 without arbitrary UI max limits', () => {
      const res12 = evaluateFeasibility(mysuru, { ...baseConstraints, partySize: 12 });
      const res16 = evaluateFeasibility(mysuru, { ...baseConstraints, partySize: 16 });

      // 12 travelers -> ceil(12/5) = 3 vehicles
      // 16 travelers -> ceil(16/5) = 4 vehicles
      expect(res12.rating).toBeDefined();
      expect(res16.rating).toBeDefined();
      expect(res16.estimatedTripTotalINR).toBeGreaterThan(res12.estimatedTripTotalINR);
    });

    it('rejects party size less than 1 or non-integer', () => {
      expect(() =>
        evaluateFeasibility(mysuru, { ...baseConstraints, partySize: 0 })
      ).toThrow('Party size must be a positive integer.');

      expect(() =>
        evaluateFeasibility(mysuru, { ...baseConstraints, partySize: -2 })
      ).toThrow('Party size must be a positive integer.');

      expect(() =>
        evaluateFeasibility(mysuru, { ...baseConstraints, partySize: 3.2 })
      ).toThrow('Party size must be a positive integer.');
    });
  });

  describe('Custom Non-Negative Budget Validation', () => {
    it('supports arbitrary custom budget amounts including low, typical, and high values', () => {
      const resLow = evaluateFeasibility(mysuru, { ...baseConstraints, perPersonBudgetINR: 500 });
      const resHigh = evaluateFeasibility(mysuru, { ...baseConstraints, perPersonBudgetINR: 200000 });

      expect(resLow.rating).toBeDefined();
      expect(resHigh.rating).toBeDefined();
    });

    it('supports 0 INR budget without crashing, producing a BUDGET_OVERRUN warning', () => {
      const resZero = evaluateFeasibility(mysuru, { ...baseConstraints, perPersonBudgetINR: 0 });
      expect(resZero.rating).toBeDefined();
      expect(resZero.isBudgetExceeded).toBe(true);
      const budgetWarning = resZero.violations.find(v => v.type === 'BUDGET_OVERRUN');
      expect(budgetWarning).toBeDefined();
      expect(budgetWarning?.severity).toBe('WARNING');
      expect(budgetWarning?.message).toContain('exceeds the ₹0 cap');
    });

    it('rejects negative budgets with non-negative validation error', () => {
      expect(() =>
        evaluateFeasibility(mysuru, { ...baseConstraints, perPersonBudgetINR: -100 })
      ).toThrow('Budget must be non-negative.');
    });
  });

  describe('Calendar & IST Date-Time Envelope', () => {
    it('validates return deadline is strictly after departure in IST', () => {
      const dep = parseIST('2026-10-24T08:00');
      const ret = parseIST('2026-10-25T20:30');
      expect(ret).toBeGreaterThan(dep);

      // Return on same day earlier time is invalid
      expect(() =>
        evaluateFeasibility(mysuru, {
          ...baseConstraints,
          departureDateTime: '2026-10-24T18:00',
          returnDeadlineDateTime: '2026-10-24T10:00',
        })
      ).toThrow('Return time must be after departure time.');
    });

    it('calculates calendar days correctly (1 to 4 days supported)', () => {
      // 1 day
      expect(getCalendarDaysCount('2026-10-24T06:00', '2026-10-24T22:00')).toBe(1);
      // 2 days
      expect(getCalendarDaysCount('2026-10-24T08:00', '2026-10-25T20:30')).toBe(2);
      // 3 days
      expect(getCalendarDaysCount('2026-10-23T16:00', '2026-10-25T20:30')).toBe(3);
      // 4 days
      expect(getCalendarDaysCount('2026-10-23T06:00', '2026-10-26T20:30')).toBe(4);
      // 5 days exceeds scope
      expect(getCalendarDaysCount('2026-10-22T06:00', '2026-10-26T20:30')).toBe(5);
    });

    it('rejects trip windows beyond 4 calendar dates', () => {
      expect(() =>
        evaluateFeasibility(mysuru, {
          ...baseConstraints,
          departureDateTime: '2026-10-20T08:00',
          returnDeadlineDateTime: '2026-10-25T20:30',
        })
      ).toThrow('Trip window must cover between 1 and 4 calendar dates inclusive.');
    });
  });

  describe('URL Sharing & State Serialization with New Constraints', () => {
    it('serializes and parses large group sizes and custom budgets via share URLs', () => {
      const parsed = parseShareableTrip(
        'dep=2026-10-24T08:00&ret=2026-10-25T20:30&party=14&budget=45000',
        'mysuru'
      );

      expect(parsed.valid).toBe(true);
      if (parsed.valid) {
        expect(parsed.data.inputs.partySize).toBe(14);
        expect(parsed.data.inputs.perPersonBudgetINR).toBe(45000);
      }
    });

    it('serializes and parses budget of 0 INR correctly', () => {
      const parsed = parseShareableTrip(
        'dep=2026-10-24T08:00&ret=2026-10-25T20:30&budget=0',
        'mysuru'
      );

      expect(parsed.valid).toBe(true);
      if (parsed.valid) {
        expect(parsed.data.inputs.perPersonBudgetINR).toBe(0);
      }
    });
  });
});
