import { describe, expect, it } from 'vitest';
import { getDestination } from '../data/destinations';
import { evaluateFeasibility, parseIST } from '../engine/scheduler';
import {
  cleanInputDisplayName,
  sanitizeDisplayName,
  buildShareableParams,
  buildShareableTripUrl,
  parseShareableTrip,
  buildWhatsAppInvitationMessage,
} from '../utils/tripShare';
import { buildTripSummaryText } from '../utils/formatters';
import type { UserConstraints } from '../types';

describe('Final User-Feedback UX Sprint', () => {
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
    organizerName: '',
    planningMode: 'group',
    destinationAdjustments: {},
  };

  describe('Change 2: Organizer Name Spacing & Unicode Handling', () => {
    it('preserves spaces during typing without premature trimming', () => {
      // Ammoos reported inability to type space after "Sujil"
      const whileTypingFirstSpace = cleanInputDisplayName('Sujil ');
      expect(whileTypingFirstSpace).toBe('Sujil ');

      const fullMultiWordName = cleanInputDisplayName('Sujil Kumar');
      expect(fullMultiWordName).toBe('Sujil Kumar');

      const achoosName = cleanInputDisplayName('Achoos Thomas');
      expect(achoosName).toBe('Achoos Thomas');

      const initialLetters = cleanInputDisplayName('A B');
      expect(initialLetters).toBe('A B');
    });

    it('sanitizes names on blur/submission by trimming outer whitespace while preserving internal spaces', () => {
      const sanitized = sanitizeDisplayName('  Sujil Kumar   ');
      expect(sanitized).toBe('Sujil Kumar');
    });

    it('strips dangerous HTML tags while preserving text content', () => {
      const dangerous = cleanInputDisplayName('<script>alert("hack")</script>Sujil Kumar');
      expect(dangerous).not.toContain('<script>');
      expect(dangerous).not.toContain('</script>');
      expect(dangerous).toContain('Sujil Kumar');
    });

    it('supports native Indian Unicode scripts', () => {
      const devanagari = cleanInputDisplayName('सुजिल कुमार');
      expect(devanagari).toBe('सुजिल कुमार');

      const kannada = cleanInputDisplayName('ಸುಜಿಲ್ ಕುಮಾರ್');
      expect(kannada).toBe('ಸುಜಿಲ್ ಕುಮಾರ್');
    });

    it('enforces maximum character length of 40', () => {
      const longName = 'A'.repeat(60);
      const cleaned = cleanInputDisplayName(longName);
      expect(cleaned.length).toBe(40);
    });
  });

  describe('Change 4: Customizable Per-Person Budget', () => {
    it('supports custom whole-number budgets such as ₹4,500 and ₹12,500', () => {
      const dest = getDestination('mysuru')!;

      // Custom budget of ₹4,500
      const inputs4500: UserConstraints = { ...baseInputs, perPersonBudgetINR: 4500 };
      const r4500 = evaluateFeasibility(dest, inputs4500);
      expect(r4500.estimatedCostPerPersonINR).toBe(3750);
      expect(r4500.isBudgetExceeded).toBe(false);

      // Custom budget of ₹3,500 (below Mysuru ₹3,750 cost)
      const inputs3500: UserConstraints = { ...baseInputs, perPersonBudgetINR: 3500 };
      const r3500 = evaluateFeasibility(dest, inputs3500);
      expect(r3500.isBudgetExceeded).toBe(true);
      // Non-blocking: rating remains Comfortable because budget overrun is non-blocking
      expect(r3500.rating).toBe('Comfortable');
    });

    it('preserves exact custom budget in shareable URL parameters', () => {
      const customInputs: UserConstraints = {
        ...baseInputs,
        perPersonBudgetINR: 4500,
        organizerName: 'Sujil Kumar',
      };

      const params = buildShareableParams('mysuru', customInputs);
      expect(params.get('budget')).toBe('4500');

      const parsed = parseShareableTrip(params.toString(), 'mysuru');
      expect(parsed.valid).toBe(true);
      if (parsed.valid) {
        expect(parsed.data.inputs.perPersonBudgetINR).toBe(4500);
        expect(parsed.data.inputs.organizerName).toBe('Sujil Kumar');
      }
    });

    it('preserves exact ₹12,500 custom budget without quantizing down to 10000', () => {
      const customInputs: UserConstraints = {
        ...baseInputs,
        perPersonBudgetINR: 12500,
      };

      const params = buildShareableParams('ooty', customInputs);
      expect(params.get('budget')).toBe('12500');

      const parsed = parseShareableTrip(params.toString(), 'ooty');
      expect(parsed.valid).toBe(true);
      if (parsed.valid) {
        expect(parsed.data.inputs.perPersonBudgetINR).toBe(12500);
      }
    });

    it('maintains backwards compatibility with legacy budget presets and keywords', () => {
      const presets = [
        { query: 'budget=3000', expected: 3000 },
        { query: 'budget=6000', expected: 6000 },
        { query: 'budget=10000', expected: 10000 },
        { query: 'budget=backpacker', expected: 3000 },
        { query: 'budget=moderate', expected: 6000 },
        { query: 'budget=comfort', expected: 10000 },
      ];

      for (const { query, expected } of presets) {
        const parsed = parseShareableTrip(`dep=2026-10-31T08:00&ret=2026-11-01T20:30&${query}`, 'mysuru');
        expect(parsed.valid).toBe(true);
        if (parsed.valid) {
          expect(parsed.data.inputs.perPersonBudgetINR).toBe(expected);
        }
      }
    });

    it('safely handles corrupted, negative or absurd budget values without crashing', () => {
      const invalidCases = [
        'budget=-500',
        'budget=not_a_number',
        'budget=99999999',
      ];

      for (const query of invalidCases) {
        const parsed = parseShareableTrip(`dep=2026-10-31T08:00&ret=2026-11-01T20:30&${query}`, 'mysuru');
        expect(parsed.valid).toBe(true);
        if (parsed.valid) {
          // Defaults safely to 6000
          expect(parsed.data.inputs.perPersonBudgetINR).toBe(6000);
        }
      }
    });
  });

  describe('Change 5: Attraction Customization Clarity', () => {
    it('recalculates timeline and decreases trip cost when optional activity is removed', () => {
      const dest = getDestination('mysuru')!;
      const optionalActivity = dest.activities.find(a => a.isOptional)!;
      expect(optionalActivity).toBeDefined();

      // With optional activity included
      const withActivity = evaluateFeasibility(dest, baseInputs);

      // With optional activity excluded
      const withoutActivity = evaluateFeasibility(dest, {
        ...baseInputs,
        disabledActivityIds: [optionalActivity.id],
      });

      // Destination free time increases
      expect(withoutActivity.destinationSlackMinutes).toBeGreaterThanOrEqual(withActivity.destinationSlackMinutes);
      // Cost per person decreases or stays same
      expect(withoutActivity.estimatedCostPerPersonINR).toBeLessThanOrEqual(withActivity.estimatedCostPerPersonINR);
    });
  });

  describe('Change 6: Timeline & Summary Readability', () => {
    it('produces human-readable summary text without raw JSON or developer syntax', () => {
      const dest = getDestination('mysuru')!;
      const tripInputs: UserConstraints = {
        ...baseInputs,
        organizerName: 'Sujil Kumar',
        perPersonBudgetINR: 4500,
        selectedPitstopIds: ['maddur-tiffanys'],
      };

      const result = evaluateFeasibility(dest, tripInputs);
      const summary = buildTripSummaryText({
        destination: dest,
        inputs: tripInputs,
        result,
        originUrl: 'https://at48.vercel.app',
      });

      expect(summary).toContain('Sujil Kumar');
      expect(summary).toContain('Mysuru');
      expect(summary).toContain('Maddur Tiffanys');
      expect(summary).toContain('₹4,500');
      expect(summary).not.toContain('{"');
      expect(summary).not.toContain('undefined');
      expect(summary).not.toContain('[object Object]');
    });

    it('generates WhatsApp invitation message containing organizer name and custom budget', () => {
      const dest = getDestination('mysuru')!;
      const tripInputs: UserConstraints = {
        ...baseInputs,
        organizerName: 'Sujil Kumar',
        perPersonBudgetINR: 4500,
      };

      const url = buildShareableTripUrl(dest.id, tripInputs);
      const msg = buildWhatsAppInvitationMessage({
        destinationName: dest.name,
        inputs: tripInputs,
        tripUrl: url,
      });

      expect(msg).toContain('Sujil Kumar');
      expect(msg).toContain('Mysuru');
      expect(msg).toContain('budget=4500');
    });
  });

  describe('60-Hour Window Smoke Test & PRD Modeling Horizon', () => {
    it('accepts and deterministically evaluates a full 60-hour long-weekend trip', () => {
      const dest = getDestination('coorg-madikeri')!;
      // 60-hour window: Saturday 06:00 to Monday 18:00
      const inputs60h: UserConstraints = {
        ...baseInputs,
        departureDateTime: '2026-10-31T06:00',
        returnDeadlineDateTime: '2026-11-02T18:00',
      };

      const depEpoch = parseIST(inputs60h.departureDateTime);
      const retEpoch = parseIST(inputs60h.returnDeadlineDateTime);
      const durationHours = (retEpoch - depEpoch) / 3_600_000;
      expect(durationHours).toBe(60);

      const result = evaluateFeasibility(dest, inputs60h);
      // Timeline generates Day 1 & Day 2 itinerary
      expect(result.timeline.length).toBeGreaterThan(0);
      // Extra return margin is credited generously because deadline is Monday evening
      expect(result.returnDeadlineMarginMinutes).toBeGreaterThan(120);
      expect(result.rating).toBe('Comfortable');
    });
  });
});
