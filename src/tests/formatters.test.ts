import { describe, expect, it } from 'vitest';
import { DESTINATIONS } from '../data/destinations';
import { evaluateFeasibility } from '../engine/scheduler';
import type { UserConstraints } from '../types';
import {
  buildTripSummaryText,
  buildWhatsAppShareUrl,
  formatDuration,
  formatReadableDate,
  formatReadableDateTime,
  formatTimelineTime,
} from '../utils/formatters';

describe('formatDuration', () => {
  it('formats zero minutes', () => {
    expect(formatDuration(0)).toBe('0m');
    expect(formatDuration(0, true)).toBe('+0m');
  });

  it('formats minutes under an hour', () => {
    expect(formatDuration(45)).toBe('45m');
    expect(formatDuration(45, true)).toBe('+45m');
  });

  it('formats exact hours', () => {
    expect(formatDuration(120)).toBe('2h');
    expect(formatDuration(60, true)).toBe('+1h');
  });

  it('formats hours and minutes combined', () => {
    expect(formatDuration(135)).toBe('2h 15m');
    expect(formatDuration(135, true)).toBe('+2h 15m');
  });

  it('formats negative durations correctly with sign', () => {
    expect(formatDuration(-45)).toBe('-45m');
    expect(formatDuration(-75)).toBe('-1h 15m');
    expect(formatDuration(-120, true)).toBe('-2h');
  });
});

describe('formatReadableDateTime and helpers', () => {
  it('formats IST date-time consistently without browser timezone skew', () => {
    expect(formatReadableDateTime('2026-10-24T08:30')).toBe('Sat, 24 Oct, 08:30 AM');
    expect(formatReadableDateTime('2026-10-25T20:30')).toBe('Sun, 25 Oct, 08:30 PM');
    expect(formatReadableDateTime('2026-10-25T00:00')).toBe('Sun, 25 Oct, 12:00 AM');
    expect(formatReadableDateTime('2026-10-25T12:00')).toBe('Sun, 25 Oct, 12:00 PM');
  });

  it('formats readable date only', () => {
    expect(formatReadableDate('2026-10-24T08:30')).toBe('Sat, 24 Oct');
    expect(formatReadableDate('2026-10-25')).toBe('Sun, 25 Oct');
  });

  it('formats timeline time only', () => {
    expect(formatTimelineTime('2026-10-24T08:30')).toBe('08:30 AM');
    expect(formatTimelineTime('2026-10-24T17:45')).toBe('05:45 PM');
  });
});

describe('buildTripSummaryText and WhatsApp sharing', () => {
  const base: UserConstraints = {
    departureDateTime: '2026-10-24T08:30',
    returnDeadlineDateTime: '2026-10-25T20:30',
    pace: 'balanced',
    perPersonBudgetINR: 6000,
    partySize: 2,
    drivingAdjustmentMinutes: 45,
    simulateDelayMinutes: 0,
    disabledActivityIds: [],
  };

  const mysuru = DESTINATIONS.find(d => d.id === 'mysuru')!;

  it('builds comprehensive trip summary using real engine output', () => {
    const result = evaluateFeasibility(mysuru, base);
    const summary = buildTripSummaryText({
      destination: mysuru,
      inputs: base,
      result,
      originUrl: 'https://at48.vercel.app',
    });

    expect(summary).toContain('@48 — The Weekend Reality Checker');
    expect(summary).toContain('Destination:* Mysuru');
    expect(summary).toContain('Departure: Sat, 24 Oct, 08:30 AM');
    expect(summary).toContain('Return Deadline: Sun, 25 Oct, 08:30 PM');
    expect(summary).toContain(`Verdict:* ${result.rating}`);
    expect(summary).toContain(`Usable Destination Free Time: ${formatDuration(result.destinationSlackMinutes)}`);
    expect(summary).toContain(`Return Deadline Margin: ${formatDuration(result.returnDeadlineMarginMinutes, true)}`);
    expect(summary).toContain('Origin drive adjustment: +45m');
    expect(summary).toContain('Itinerary Highlights:');
    expect(summary).toContain('Plan link: https://at48.vercel.app');
  });

  it('reflects simulated delay and optional activity exclusion dynamically', () => {
    const adjustedInputs: UserConstraints = {
      ...base,
      simulateDelayMinutes: 60,
      disabledActivityIds: ['mysuru-market'],
    };
    const result = evaluateFeasibility(mysuru, adjustedInputs);
    const summary = buildTripSummaryText({
      destination: mysuru,
      inputs: adjustedInputs,
      result,
    });

    expect(summary).toContain('Simulating +60m outbound delay');
    expect(summary).toContain('Skipped optional activities: Devaraja Market Walk');
  });

  it('generates a valid WhatsApp URL containing the encoded summary', () => {
    const result = evaluateFeasibility(mysuru, base);
    const summary = buildTripSummaryText({ destination: mysuru, inputs: base, result });
    const waUrl = buildWhatsAppShareUrl(summary);

    expect(waUrl.startsWith('https://api.whatsapp.com/send?text=')).toBe(true);
    expect(waUrl).toContain(encodeURIComponent('Destination:* Mysuru'));
  });
});
