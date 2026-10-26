import { describe, expect, it, beforeEach } from 'vitest';
import { DESTINATIONS } from '../data/destinations';
import { evaluateFeasibility } from '../engine/scheduler';
import { getSavedTrips, saveTrip, deleteSavedTrip } from '../utils/savedTrips';
import type { UserConstraints } from '../types';

const destination = (id: string) => DESTINATIONS.find(d => d.id === id)!;

const baseConstraints: UserConstraints = {
  departureDateTime: '2026-10-31T07:00',
  returnDeadlineDateTime: '2026-11-01T20:30',
  pace: 'balanced',
  perPersonBudgetINR: 6000,
  partySize: 2,
  drivingAdjustmentMinutes: 0,
  simulateDelayMinutes: 0,
  disabledActivityIds: [],
  organizerName: 'Sujil Kumar',
  planningMode: 'group',
};

// Polyfill minimal localStorage for node environment
const storageStore: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (key: string) => storageStore[key] ?? null,
  setItem: (key: string, val: string) => {
    storageStore[key] = val;
  },
  removeItem: (key: string) => {
    delete storageStore[key];
  },
  clear: () => {
    Object.keys(storageStore).forEach(k => delete storageStore[k]);
  },
};

describe('Gate A Redesign Features & Invariants', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    // @ts-expect-error polyfill for node tests
    globalThis.localStorage = mockLocalStorage;
    // @ts-expect-error polyfill for node tests
    globalThis.window = { localStorage: mockLocalStorage };
  });

  describe('Party Size 1 to 10 Support', () => {
    it('successfully computes feasibility for party size 1 (solo)', () => {
      const r = evaluateFeasibility(destination('nandi-hills'), {
        ...baseConstraints,
        partySize: 1,
        planningMode: 'solo',
      });
      expect(r.rating).toBeDefined();
      expect(r.estimatedCostPerPersonINR).toBe(r.estimatedTripTotalINR);
    });

    it('successfully computes feasibility for party size 10 (group convoy)', () => {
      const r = evaluateFeasibility(destination('mysuru'), {
        ...baseConstraints,
        partySize: 10,
        planningMode: 'group',
      });
      expect(r.rating).toBeDefined();
      expect(r.estimatedCostPerPersonINR).toBeGreaterThan(0);
      expect(r.estimatedTripTotalINR).toBeGreaterThan(r.estimatedCostPerPersonINR);
    });

    it('rejects party size greater than 10', () => {
      expect(() =>
        evaluateFeasibility(destination('mysuru'), {
          ...baseConstraints,
          partySize: 11,
        })
      ).toThrow('Party size must be 1–10.');
    });

    it('rejects non-integer party size', () => {
      expect(() =>
        evaluateFeasibility(destination('mysuru'), {
          ...baseConstraints,
          partySize: 3.5,
        })
      ).toThrow('Party size must be 1–10.');
    });
  });

  describe('Account-Free Saved Trips Storage', () => {
    it('returns empty array when no trips are saved', () => {
      expect(getSavedTrips()).toEqual([]);
    });

    it('saves a trip to localStorage and retrieves it', () => {
      const saved = saveTrip({
        destinationId: 'mysuru',
        destinationName: 'Mysuru Heritage Corridor',
        routeName: 'Mysuru Expressway NH 275',
        departureDateTime: '2026-10-31T07:00',
        returnDeadlineDateTime: '2026-11-01T20:30',
        pace: 'balanced',
        partySize: 4,
        perPersonBudgetINR: 8000,
        planningMode: 'group',
        organizerName: 'Sujil Kumar',
        shareUrl: 'https://at48.vercel.app/schedule/mysuru?org=Sujil+Kumar',
      });

      expect(saved.id).toBeDefined();
      expect(saved.savedAt).toBeDefined();

      const all = getSavedTrips();
      expect(all.length).toBe(1);
      expect(all[0].destinationId).toBe('mysuru');
      expect(all[0].partySize).toBe(4);
      expect(all[0].organizerName).toBe('Sujil Kumar');
    });

    it('deletes a saved trip by id', () => {
      const trip1 = saveTrip({
        destinationId: 'mysuru',
        destinationName: 'Mysuru',
        routeName: 'NH 275',
        departureDateTime: '2026-10-31T07:00',
        returnDeadlineDateTime: '2026-11-01T20:30',
        pace: 'balanced',
        partySize: 2,
        perPersonBudgetINR: 6000,
        shareUrl: 'https://at48.vercel.app/schedule/mysuru',
      });

      const trip2 = saveTrip({
        destinationId: 'coorg-madikeri',
        destinationName: 'Coorg',
        routeName: 'NH 275',
        departureDateTime: '2026-10-31T07:00',
        returnDeadlineDateTime: '2026-11-01T20:30',
        pace: 'relaxed',
        partySize: 3,
        perPersonBudgetINR: 9000,
        shareUrl: 'https://at48.vercel.app/schedule/coorg-madikeri',
      });

      expect(getSavedTrips().length).toBe(2);

      const remaining = deleteSavedTrip(trip1.id);
      expect(remaining.length).toBe(1);
      expect(remaining[0].id).toBe(trip2.id);
      expect(getSavedTrips().length).toBe(1);
    });
  });

  describe('Budget Range & Landmarks', () => {
    it('supports budget values from ₹1,000 to ₹30,000', () => {
      const low = evaluateFeasibility(destination('nandi-hills'), {
        ...baseConstraints,
        perPersonBudgetINR: 1000,
      });
      expect(low.rating).toBeDefined();

      const high = evaluateFeasibility(destination('coorg-madikeri'), {
        ...baseConstraints,
        perPersonBudgetINR: 30000,
      });
      expect(high.rating).toBeDefined();
      expect(high.isBudgetExceeded).toBe(false);
    });
  });
});
