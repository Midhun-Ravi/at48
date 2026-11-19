import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { getDestination } from '../data/destinations';
import { evaluateFeasibility } from '../engine/scheduler';
import {
  buildShareableParams,
  parseShareableTrip,
  buildWhatsAppInvitationMessage,
  buildWhatsAppRSVPMessage,
  sanitizeDisplayName,
} from '../utils/tripShare';
import type { UserConstraints } from '../types';

describe('Page 4 Calm Review & Release Readiness', () => {
  const reviewSrc = fs.readFileSync(path.resolve(__dirname, '../screens/ReviewScreen.tsx'), 'utf8');

  it('1. verifies Page 4 Calm Review hero, 3 primary facts bar, and action hierarchy', () => {
    // Hero with authentic photo, dates, group size, and feasibility
    expect(reviewSrc).toContain('ScenicBackground');
    expect(reviewSrc).toContain('TactileButton');
    expect(reviewSrc).toContain('dest.oneWayDistanceKm');
    expect(reviewSrc).toContain('activeInputs.perPersonBudgetINR');

    // 3 Primary Facts Bar immediately below Hero
    expect(reviewSrc).toContain('Expected Home Arrival');
    expect(reviewSrc).toContain('Return Deadline Margin');
    expect(reviewSrc).toContain('Estimated Cost Per Traveler');

    // Action Hierarchy: Save Trip, Share Trip, WhatsApp Invite
    expect(reviewSrc).toContain('Share Trip (Copy Link)');
    expect(reviewSrc).toContain('Save Trip (This Device)');
    expect(reviewSrc).toContain('WhatsApp Invite');
    expect(reviewSrc).toContain('Copy Text Summary');
  });

  it('2. verifies progressive disclosure accordions for fleet, timeline, places, and plain-text summary start collapsed', () => {
    // Progressive disclosure accordions
    expect(reviewSrc).toContain('Vehicle Fleet & Cost Sharing');
    expect(reviewSrc).toContain('Day-by-Day Itinerary Review');
    expect(reviewSrc).toContain('Route & Planned Places');
    expect(reviewSrc).toContain('Plain-Text Messaging Summary');

    // Confirm Vehicle Fleet and Day-by-Day Itinerary start collapsed by default (no open attribute)
    expect(reviewSrc).not.toContain('Section D: Progressive Disclosure Accordion 1 - Vehicle Fleet & Cost Sharing */}\n      <details className="group rounded-2xl sm:rounded-3xl border border-[#EADBCE] bg-white p-5 sm:p-6 shadow-sm" open>');
    expect(reviewSrc).not.toContain('Section E: Progressive Disclosure Accordion 2 - Day-by-Day Itinerary Review */}\n      <details className="group rounded-2xl sm:rounded-3xl border border-[#EADBCE] bg-white p-5 sm:p-6 shadow-sm" open>');

    // Vehicle fleet breakdown
    expect(reviewSrc).toContain('1 Standard Car');
    expect(reviewSrc).toContain('1 Large SUV');
    expect(reviewSrc).toContain('Multi-Car Convoy or Tempo Traveller');
    expect(reviewSrc).toContain('Round-Trip Fuel:');
    expect(reviewSrc).toContain('Highway Tolls:');
  });

  it('3. verifies honest planning assumption disclosures and transparent wording', () => {
    // Planning assumptions & disclosures
    expect(reviewSrc).toContain('Planning Assumptions & Disclosures');
    expect(reviewSrc).toContain('20% Driving Contingency');
    expect(reviewSrc).toContain('deterministic planning assumption, not live GPS traffic');
    expect(reviewSrc).toContain('Transparent Estimated Costs');
    expect(reviewSrc).toContain('Account-Free Device Storage');
    expect(reviewSrc).toContain('localStorage');
    expect(reviewSrc).toContain('Reference Corridor');
    expect(reviewSrc).toContain('Shareable Link Fidelity');
  });

  it('4. enforces honest WhatsApp RSVP handoff language and guest protection', () => {
    // Never claim "RSVP sent" on window.open
    expect(reviewSrc).toContain('WhatsApp opened. Send the message there to complete your RSVP.');
    expect(reviewSrc).not.toContain('RSVP sent via WhatsApp');

    // Guest protection note
    expect(reviewSrc).toContain('Guest actions on this link never modify the organizer\'s original trip schedule.');
    expect(reviewSrc).toContain('handleGuestRSVP');
    expect(reviewSrc).toContain('Your Name to RSVP');
    expect(reviewSrc).toContain('Join Trip & Send RSVP via WhatsApp');
  });

  it('5. enforces honest warning styling for Not Recommended / Blocker results', () => {
    // Must NOT show cheerful header when blocked or negative return margin
    expect(reviewSrc).toContain('isNotRecommended');
    expect(reviewSrc).toContain('Schedule requires adjustments');
    expect(reviewSrc).toContain('Critical Schedule Blockers');
    expect(reviewSrc).toContain('Missed Return Deadline');

    // Feasibility calculation verifies Not Recommended triggers proper flag
    const ooty = getDestination('ooty')!;
    const tightConstraints: UserConstraints = {
      departureDateTime: '2026-11-21T18:00', // late evening departure
      returnDeadlineDateTime: '2026-11-22T12:00', // impossible deadline
      pace: 'packed',
      partySize: 2,
      perPersonBudgetINR: 6000,
      drivingAdjustmentMinutes: 0,
      simulateDelayMinutes: 0,
      disabledActivityIds: [],
    };
    const r = evaluateFeasibility(ooty, tightConstraints);
    expect(r.rating).toBe('Not Recommended');
    expect(r.returnDeadlineMarginMinutes).toBeLessThan(0);
  });

  it('6. verifies complete shareable URL roundtrip and reconstruction fidelity for all customizations', () => {
    const destId = 'mysuru';
    const originalInputs: UserConstraints = {
      departureDateTime: '2026-11-21T07:00',
      returnDeadlineDateTime: '2026-11-22T21:00',
      pace: 'relaxed',
      partySize: 5,
      perPersonBudgetINR: 8500,
      drivingAdjustmentMinutes: 30,
      simulateDelayMinutes: 60,
      disabledActivityIds: ['mysuru-market'],
      selectedPitstopIds: ['maddur-tiffanys'],
      organizerName: 'Ananya & Rohan',
      planningMode: 'group',
      activityOrder: ['mysuru-market', 'mysuru-palace'],
      activityDayAssignments: {
        'mysuru-market': 1,
        'mysuru-palace': 2,
      },
      transferAdjustments: {
        'mysuru-palace': 30,
        'mysuru-market': 45,
      },
      activityCustomizations: {
        'mysuru-palace': {
          day: 1,
          startTime: '2026-11-21T15:00',
          durationMinutes: 90,
          transferMinutes: 25,
        },
      },
      customActivities: [
        {
          id: 'custom_1',
          day: 1,
          name: 'St Philomena Sunset Photography',
          durationMinutes: 75,
          costPerPersonINR: 0,
          slotStart: '2026-11-21T17:30',
        },
      ],
    };

    const params = buildShareableParams(destId, originalInputs);
    const parsed = parseShareableTrip(params, destId);

    expect(parsed.valid).toBe(true);
    if (!parsed.valid) return;

    expect(parsed.data.destinationId).toBe(destId);
    expect(parsed.data.organizerName).toBe('Ananya & Rohan');
    expect(parsed.data.isGuestView).toBe(true);
    expect(parsed.data.inputs.departureDateTime).toBe(originalInputs.departureDateTime);
    expect(parsed.data.inputs.returnDeadlineDateTime).toBe(originalInputs.returnDeadlineDateTime);
    expect(parsed.data.inputs.pace).toBe(originalInputs.pace);
    expect(parsed.data.inputs.partySize).toBe(5);
    expect(parsed.data.inputs.perPersonBudgetINR).toBe(8500);
    expect(parsed.data.inputs.drivingAdjustmentMinutes).toBe(30);
    expect(parsed.data.inputs.simulateDelayMinutes).toBe(60);
    expect(parsed.data.inputs.disabledActivityIds).toEqual(['mysuru-market']);
    expect(parsed.data.inputs.selectedPitstopIds).toEqual(['maddur-tiffanys']);

    // Custom planned activities
    expect(parsed.data.inputs.customActivities).toHaveLength(1);
    expect(parsed.data.inputs.customActivities![0].name).toBe('St Philomena Sunset Photography');
    expect(parsed.data.inputs.customActivities![0].durationMinutes).toBe(75);
    expect(parsed.data.inputs.customActivities![0].slotStart).toBe('2026-11-21T17:30');

    // Reordered activities
    expect(parsed.data.inputs.activityOrder).toEqual(['mysuru-market', 'mysuru-palace']);

    // Day assignments
    expect(parsed.data.inputs.activityDayAssignments).toEqual({
      'mysuru-market': 1,
      'mysuru-palace': 2,
    });

    // Transfer adjustments
    expect(parsed.data.inputs.transferAdjustments).toEqual({
      'mysuru-palace': 30,
      'mysuru-market': 45,
    });

    // Activity visit customizations
    expect(parsed.data.inputs.activityCustomizations).toEqual({
      'mysuru-palace': {
        day: 1,
        startTime: '2026-11-21T15:00',
        durationMinutes: 90,
        transferMinutes: 25,
      },
    });
  });

  it('7. handles corrupted or invalid shareable parameters defensively', () => {
    // Missing dates
    const badParams1 = new URLSearchParams({ v: '1', org: 'Test' });
    const res1 = parseShareableTrip(badParams1, 'mysuru');
    expect(res1.valid).toBe(false);

    // Return deadline before departure
    const badParams2 = new URLSearchParams({
      v: '1',
      dep: '2026-11-22T20:00',
      ret: '2026-11-21T08:00',
    });
    const res2 = parseShareableTrip(badParams2, 'mysuru');
    expect(res2.valid).toBe(false);

    // Unsupported destination
    const badParams3 = new URLSearchParams({
      v: '1',
      dep: '2026-11-21T08:00',
      ret: '2026-11-22T20:00',
    });
    const res3 = parseShareableTrip(badParams3, 'goa-unknown');
    expect(res3.valid).toBe(false);

    // Sanitization strips script/HTML tags
    expect(sanitizeDisplayName('<script>alert("hack")</script>Sujil')).toBe('alert("hack")Sujil');
  });

  it('8. verifies WhatsApp invitation and RSVP message builders', () => {
    const inviteMsg = buildWhatsAppInvitationMessage({
      destinationName: 'Mysuru Heritage Corridor',
      inputs: {
        departureDateTime: '2026-11-21T07:00',
        returnDeadlineDateTime: '2026-11-22T21:00',
        pace: 'balanced',
        partySize: 4,
        perPersonBudgetINR: 6000,
        drivingAdjustmentMinutes: 0,
        simulateDelayMinutes: 0,
        disabledActivityIds: [],
        organizerName: 'Deepa',
      },
      tripUrl: 'https://at48.vercel.app/review/mysuru?v=1',
    });

    expect(inviteMsg).toContain('Deepa');
    expect(inviteMsg).toContain('Mysuru Heritage Corridor');
    expect(inviteMsg).toContain('https://at48.vercel.app/review/mysuru?v=1');

    const rsvpMsg = buildWhatsAppRSVPMessage({
      organizerName: 'Deepa',
      guestName: 'Karthik',
      destinationName: 'Mysuru Heritage Corridor',
      departureDateTime: '2026-11-21T07:00',
      returnDeadlineDateTime: '2026-11-22T21:00',
      tripUrl: 'https://at48.vercel.app/review/mysuru?v=1',
    });

    expect(rsvpMsg).toContain('Hey Deepa');
    expect(rsvpMsg).toContain('count me in');
    expect(rsvpMsg).toContain('- Karthik');
  });
});
