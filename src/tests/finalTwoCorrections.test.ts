import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { parseShareableTrip, buildShareableParams, buildShareableTripUrl, buildWhatsAppRSVPMessage } from '../utils/tripShare';
import { evaluateFeasibility } from '../engine/scheduler';
import { getDestination } from '../data/destinations';
import type { UserConstraints } from '../types';

describe('Final Two Corrections: Pace Removal & Page 4 Single Destination RSVP', () => {
  it('1. verifies CompareScreen has removed user-facing Travel Pace Preference section', () => {
    const compareSrc = fs.readFileSync(path.resolve(__dirname, '../screens/CompareScreen.tsx'), 'utf8');

    // User-facing buttons and explanatory copy must not be present
    expect(compareSrc).not.toContain('Travel Pace Preference');
    expect(compareSrc).not.toContain('🌿 Relaxed');
    expect(compareSrc).not.toContain('⚡ Packed');
    expect(compareSrc).not.toContain('Adjusts allocated duration at attractions');
    expect(compareSrc).not.toContain('PACE_EXPLANATIONS');
    expect(compareSrc).not.toContain('handlePaceChange');
  });

  it('2. verifies ScheduleScreen (Page 3) has removed the Trip Invitation and RSVP form', () => {
    const scheduleSrc = fs.readFileSync(path.resolve(__dirname, '../screens/ScheduleScreen.tsx'), 'utf8');

    // Page 3 must not contain the removed invitation elements
    expect(scheduleSrc).not.toContain('You’ve been invited on a road trip!');
    expect(scheduleSrc).not.toContain('Your Name to RSVP');
    expect(scheduleSrc).not.toContain('Join Trip & Send RSVP via WhatsApp');
    expect(scheduleSrc).not.toContain('handleGuestRSVP');
  });

  it('3. verifies ReviewScreen (Page 4) is the single destination containing Guest RSVP', () => {
    const reviewSrc = fs.readFileSync(path.resolve(__dirname, '../screens/ReviewScreen.tsx'), 'utf8');

    // Page 4 must contain the Trip Invitation & Guest RSVP functionality
    expect(reviewSrc).toContain('Trip Invitation & RSVP');
    expect(reviewSrc).toContain('Your Name to RSVP');
    expect(reviewSrc).toContain('Join Trip & Send RSVP via WhatsApp');
    expect(reviewSrc).toContain('handleGuestRSVP');
    expect(reviewSrc).toContain('buildWhatsAppRSVPMessage');
  });

  it('4. proves existing shared links with pace values parse safely without errors', () => {
    const paces = ['relaxed', 'balanced', 'packed', 'unknown-pace', ''];
    for (const p of paces) {
      const params = new URLSearchParams({
        dep: '2026-10-31T08:00',
        ret: '2026-11-01T20:30',
        pace: p,
      });

      const parsed = parseShareableTrip(params, 'mysuru');
      expect(parsed.valid).toBe(true);
      if (!parsed.valid) continue;

      if (p === 'relaxed') {
        expect(parsed.data.inputs.pace).toBe('relaxed');
      } else if (p === 'packed') {
        expect(parsed.data.inputs.pace).toBe('packed');
      } else {
        expect(parsed.data.inputs.pace).toBe('balanced');
      }

      // Feasibility evaluation succeeds
      const dest = getDestination('mysuru')!;
      const result = evaluateFeasibility(dest, parsed.data.inputs);
      expect(result.rating).toMatch(/Comfortable|Tight|Not Recommended/);
      expect(result.timeline.length).toBeGreaterThan(0);
    }
  });

  it('5. proves all 4 supported destinations produce complete schedules in default balanced mode', () => {
    const supported = ['mysuru', 'coorg-madikeri', 'ooty', 'nandi-hills'];
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

    for (const id of supported) {
      const dest = getDestination(id);
      expect(dest).toBeDefined();
      if (!dest) continue;

      const result = evaluateFeasibility(dest, inputs);
      expect(result.rating).toMatch(/Comfortable|Tight|Not Recommended/);
      expect(result.timeline.length).toBeGreaterThan(0);
      expect(result.destinationSlackMinutes).toBeGreaterThanOrEqual(0);
    }
  });

  it('6. verifies guest invitation link preserved when opening Page 3 and passing to Page 4', () => {
    const baseInputs: UserConstraints = {
      departureDateTime: '2026-10-31T07:00',
      returnDeadlineDateTime: '2026-11-02T20:30',
      pace: 'balanced',
      perPersonBudgetINR: 8000,
      partySize: 3,
      drivingAdjustmentMinutes: 0,
      simulateDelayMinutes: 0,
      disabledActivityIds: [],
      organizerName: 'Priya',
      planningMode: 'group',
      selectedPitstopIds: ['maddur-tiffanys'],
    };

    const scheduleUrl = buildShareableTripUrl('coorg-madikeri', baseInputs);
    expect(scheduleUrl).toContain('/schedule/coorg-madikeri?');
    expect(scheduleUrl).toContain('org=Priya');

    const searchStr = scheduleUrl.split('?')[1];
    const parsed = parseShareableTrip(searchStr, 'coorg-madikeri');
    expect(parsed.valid).toBe(true);
    if (!parsed.valid) return;

    expect(parsed.data.isGuestView).toBe(true);
    expect(parsed.data.organizerName).toBe('Priya');

    // Forwarding to Page 4 review preserves all parameters
    const reviewParams = buildShareableParams('coorg-madikeri', parsed.data.inputs);
    expect(reviewParams.get('org')).toBe('Priya');
    expect(reviewParams.get('mode')).toBe('group');
    expect(reviewParams.get('stops')).toBe('maddur-tiffanys');

    // WhatsApp RSVP message generation works cleanly
    const rsvpMsg = buildWhatsAppRSVPMessage({
      destinationName: 'Coorg (Madikeri)',
      departureDateTime: parsed.data.inputs.departureDateTime,
      returnDeadlineDateTime: parsed.data.inputs.returnDeadlineDateTime,
      organizerName: parsed.data.organizerName,
      guestName: 'Karthik',
      tripUrl: scheduleUrl,
    });

    expect(rsvpMsg).toContain('Hey Priya, count me in for the Coorg (Madikeri) road trip');
    expect(rsvpMsg).toContain('- Karthik');
  });
});
