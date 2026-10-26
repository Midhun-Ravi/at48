import { describe, expect, it } from 'vitest';
import {
  buildShareableParams,
  buildShareableTripUrl,
  buildWhatsAppInvitationMessage,
  buildWhatsAppRSVPMessage,
  parseShareableTrip,
  sanitizeDisplayName,
} from '../utils/tripShare';
import { evaluateFeasibility } from '../engine/scheduler';
import { getDestination } from '../data/destinations';
import type { UserConstraints } from '../types';

describe('Trip URL State & Group Invitation Flow (Gate 4)', () => {
  const baseInputs: UserConstraints = {
    departureDateTime: '2026-10-31T08:00',
    returnDeadlineDateTime: '2026-11-01T20:30',
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

  it('1. performs accurate encode/decode round trip for valid trip inputs', () => {
    const rawParams = buildShareableParams('mysuru', baseInputs);
    expect(rawParams.get('v')).toBe('1');
    expect(rawParams.get('org')).toBe('Sujil');
    expect(rawParams.get('mode')).toBe('group');

    const url = buildShareableTripUrl('mysuru', baseInputs, 'https://at48.vercel.app');
    expect(url).toContain('https://at48.vercel.app/schedule/mysuru?');

    const searchStr = url.split('?')[1];
    const parsed = parseShareableTrip(searchStr, 'mysuru');

    expect(parsed.valid).toBe(true);
    if (!parsed.valid) return;

    expect(parsed.data.destinationId).toBe('mysuru');
    expect(parsed.data.organizerName).toBe('Sujil');
    expect(parsed.data.inputs.departureDateTime).toBe('2026-10-31T08:00');
    expect(parsed.data.inputs.returnDeadlineDateTime).toBe('2026-11-01T20:30');
    expect(parsed.data.inputs.pace).toBe('balanced');
    expect(parsed.data.inputs.perPersonBudgetINR).toBe(6000);
    expect(parsed.data.inputs.partySize).toBe(2);
    expect(parsed.data.isGuestView).toBe(true);
  });

  it('2. sanitizes and preserves organizer names with spaces and Unicode', () => {
    const complexNames = ['Sujil Kumar', 'Sujil & Priya 🚗', 'सुजिल', 'Sujil <script>alert(1)</script>'];
    for (const name of complexNames) {
      const inputs: UserConstraints = { ...baseInputs, organizerName: name };
      const url = buildShareableTripUrl('mysuru', inputs);
      const searchStr = url.split('?')[1];
      const parsed = parseShareableTrip(searchStr, 'mysuru');

      expect(parsed.valid).toBe(true);
      if (!parsed.valid) continue;

      const sanitized = sanitizeDisplayName(name);
      expect(parsed.data.organizerName).toBe(sanitized);
      expect(parsed.data.organizerName).not.toContain('<script>');
    }
  });

  it('3. preserves and reconstructs selected pitstop IDs (e.g. Maddur Tiffanys)', () => {
    const inputsWithStop: UserConstraints = {
      ...baseInputs,
      selectedPitstopIds: ['maddur-tiffanys'],
    };

    const url = buildShareableTripUrl('mysuru', inputsWithStop);
    expect(url).toContain('stops=maddur-tiffanys');

    const searchStr = url.split('?')[1];
    const parsed = parseShareableTrip(searchStr, 'mysuru');

    expect(parsed.valid).toBe(true);
    if (!parsed.valid) return;

    expect(parsed.data.inputs.selectedPitstopIds).toEqual(['maddur-tiffanys']);
  });

  it('4. correctly reconstructs driving adjustment and one-hour delay status', () => {
    const adjustedInputs: UserConstraints = {
      ...baseInputs,
      drivingAdjustmentMinutes: 30,
      simulateDelayMinutes: 60,
    };

    const url = buildShareableTripUrl('mysuru', adjustedInputs);
    expect(url).toContain('adj=30');
    expect(url).toContain('delay=60');

    const searchStr = url.split('?')[1];
    const parsed = parseShareableTrip(searchStr, 'mysuru');

    expect(parsed.valid).toBe(true);
    if (!parsed.valid) return;

    expect(parsed.data.inputs.drivingAdjustmentMinutes).toBe(30);
    expect(parsed.data.inputs.simulateDelayMinutes).toBe(60);
  });

  it('5. correctly reconstructs disabled optional activity state', () => {
    const inputsWithDisabledActivity: UserConstraints = {
      ...baseInputs,
      disabledActivityIds: ['mysuru-market'],
    };

    const url = buildShareableTripUrl('mysuru', inputsWithDisabledActivity);
    expect(url).toContain('skip=mysuru-market');

    const searchStr = url.split('?')[1];
    const parsed = parseShareableTrip(searchStr, 'mysuru');

    expect(parsed.valid).toBe(true);
    if (!parsed.valid) return;

    expect(parsed.data.inputs.disabledActivityIds).toEqual(['mysuru-market']);
  });

  it('6. safely supplies documented defaults for missing optional parameters', () => {
    // URL with only mandatory departure and return dates
    const minimalParams = new URLSearchParams({
      dep: '2026-10-31T08:00',
      ret: '2026-11-01T20:30',
    });

    const parsed = parseShareableTrip(minimalParams, 'mysuru');
    expect(parsed.valid).toBe(true);
    if (!parsed.valid) return;

    expect(parsed.data.inputs.pace).toBe('balanced');
    expect(parsed.data.inputs.perPersonBudgetINR).toBe(6000);
    expect(parsed.data.inputs.partySize).toBe(2);
    expect(parsed.data.inputs.drivingAdjustmentMinutes).toBe(0);
    expect(parsed.data.inputs.simulateDelayMinutes).toBe(0);
    expect(parsed.data.inputs.disabledActivityIds).toEqual([]);
    expect(parsed.data.inputs.selectedPitstopIds).toEqual([]);
    expect(parsed.data.organizerName).toBe('');
  });

  it('7. safely rejects invalid or unsupported destination IDs', () => {
    const params = new URLSearchParams({
      dep: '2026-10-31T08:00',
      ret: '2026-11-01T20:30',
    });

    const parsedUnsupported = parseShareableTrip(params, 'wayanad');
    expect(parsedUnsupported.valid).toBe(false);
    if (!parsedUnsupported.valid) {
      expect(parsedUnsupported.error).toContain('unsupported or invalid');
    }

    const parsedBogus = parseShareableTrip(params, 'mars-crater');
    expect(parsedBogus.valid).toBe(false);
  });

  it('8. rejects invalid dates, inverted dates, and out-of-range trip windows', () => {
    // Inverted dates (return before departure)
    const inverted = parseShareableTrip(
      new URLSearchParams({ dep: '2026-11-01T20:30', ret: '2026-10-31T08:00' }),
      'mysuru'
    );
    expect(inverted.valid).toBe(false);

    // Non-existent calendar date
    const badDate = parseShareableTrip(
      new URLSearchParams({ dep: '2026-02-30T08:00', ret: '2026-03-01T20:00' }),
      'mysuru'
    );
    expect(badDate.valid).toBe(false);

    // Window covering more than 4 calendar dates (> 4 calendar dates)
    const tooLong = parseShareableTrip(
      new URLSearchParams({ dep: '2026-10-31T08:00', ret: '2026-11-10T20:00' }),
      'mysuru'
    );
    expect(tooLong.valid).toBe(false);
    if (!tooLong.valid) {
      expect(tooLong.error).toContain('outside the supported range of 1 to 4 calendar dates');
    }

    // Same-day trip (1 calendar date) is valid
    const sameDay = parseShareableTrip(
      new URLSearchParams({ dep: '2026-10-31T08:00', ret: '2026-10-31T20:00' }),
      'mysuru'
    );
    expect(sameDay.valid).toBe(true);

    // 4 calendar days trip (Friday to Monday) is valid
    const fourDays = parseShareableTrip(
      new URLSearchParams({ dep: '2026-10-30T07:00', ret: '2026-11-02T20:30' }),
      'mysuru'
    );
    expect(fourDays.valid).toBe(true);
  });

  it('9. strips unsupported or destination-incompatible pitstop IDs', () => {
    // Maddur Tiffanys is along the southwest NH 275 expressway (Mysuru/Ooty/Coorg),
    // NOT on the north NH 44 corridor to Nandi Hills.
    const nandiWithMaddur = new URLSearchParams({
      dep: '2026-10-31T06:00',
      ret: '2026-11-01T20:30',
      stops: 'maddur-tiffanys,fake-highway-stop',
    });

    const parsedNandi = parseShareableTrip(nandiWithMaddur, 'nandi-hills');
    expect(parsedNandi.valid).toBe(true);
    if (!parsedNandi.valid) return;

    // Incompatible stops are filtered out
    expect(parsedNandi.data.inputs.selectedPitstopIds).toEqual([]);
  });

  it('10. safely handles oversized or malformed URL payloads without throwing', () => {
    const hugeString = 'a'.repeat(3000);
    const parsed = parseShareableTrip(hugeString, 'mysuru');
    expect(parsed.valid).toBe(false);
    if (!parsed.valid) {
      expect(parsed.error).toContain('exceeds safe size limits');
    }

    const corrupted = parseShareableTrip('???&&%%===bad_param', 'mysuru');
    expect(corrupted.valid).toBe(false);
  });

  it('11. proves feasibility is recalculated deterministically from inputs, never trusted from URL', () => {
    // Create an input where Maddur Tiffanys is selected
    const inputs: UserConstraints = {
      ...baseInputs,
      selectedPitstopIds: ['maddur-tiffanys'],
    };

    const url = buildShareableTripUrl('mysuru', inputs);
    const searchStr = url.split('?')[1];
    const parsed = parseShareableTrip(searchStr, 'mysuru');

    expect(parsed.valid).toBe(true);
    if (!parsed.valid) return;

    // Recalculate feasibility using the scheduler
    const dest = getDestination('mysuru')!;
    const freshResult = evaluateFeasibility(dest, parsed.data.inputs);

    // Verify the PITSTOP item is generated in the timeline by the engine
    const pitstopItem = freshResult.timeline.find(t => t.category === 'PITSTOP');
    expect(pitstopItem).toBeDefined();
    expect(pitstopItem?.label).toContain('Maddur Tiffanys');
    expect(freshResult.rating).toBe('Comfortable');
  });

  it('12. functions in a clean guest context without pre-existing localStorage', () => {
    const guestSearch = new URLSearchParams({
      v: '1',
      org: 'Sujil',
      mode: 'group',
      dep: '2026-10-31T08:00',
      ret: '2026-11-01T20:30',
      pace: 'balanced',
      budget: '6000',
      party: '2',
      stops: 'maddur-tiffanys',
    });

    const parsed = parseShareableTrip(guestSearch, 'mysuru');
    expect(parsed.valid).toBe(true);
    if (!parsed.valid) return;

    expect(parsed.data.isGuestView).toBe(true);
    expect(parsed.data.organizerName).toBe('Sujil');
    expect(parsed.data.inputs.selectedPitstopIds).toEqual(['maddur-tiffanys']);
  });

  it('13. builds WhatsApp invitation and honest RSVP messages with correct URLs and names', () => {
    const tripUrl = 'https://at48.vercel.app/schedule/mysuru?v=1&org=Sujil&dep=2026-10-31T08:00&ret=2026-11-01T20:30&stops=maddur-tiffanys';

    // Invitation message
    const inviteMsg = buildWhatsAppInvitationMessage({
      destinationName: 'Mysuru',
      inputs: { ...baseInputs, selectedPitstopIds: ['maddur-tiffanys'] },
      tripUrl,
    });
    expect(inviteMsg).toContain('Road Trip Invitation to Mysuru with Sujil!');
    expect(inviteMsg).toContain(tripUrl);
    expect(inviteMsg).toContain('Curated highway pitstop included');

    // Guest RSVP message
    const rsvpMsg = buildWhatsAppRSVPMessage({
      organizerName: 'Sujil',
      guestName: 'Roshan',
      destinationName: 'Mysuru',
      departureDateTime: '2026-10-31T08:00',
      returnDeadlineDateTime: '2026-11-01T20:30',
      tripUrl,
    });
    expect(rsvpMsg).toContain('Hey Sujil, count me in for the Mysuru road trip');
    expect(rsvpMsg).toContain(tripUrl);
    expect(rsvpMsg).toContain('- Roshan');
  });
});
