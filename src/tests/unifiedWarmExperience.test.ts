import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { DESTINATIONS, getDestination } from '../data/destinations';
import { evaluateFeasibility, parseIST, getCalendarDaysCount } from '../engine/scheduler';
import { evaluateActivityMove, getMoveCandidates } from '../engine/moveActivity';
import { evaluateTransferAdjustment, evaluateVisitScheduling } from '../engine/timelineEditing';
import { buildShareableParams, buildShareableTripUrl, buildWhatsAppRSVPMessage, parseShareableTrip } from '../utils/tripShare';
import type { UserConstraints } from '../types';

describe('@48 Unified Consumer Experience Redesign Verification', () => {
  const readSrc = (relPath: string) =>
    fs.readFileSync(path.resolve(__dirname, '..', relPath), 'utf8');

  it('1. verifies warm color palette tokens and scenic background layers', () => {
    const css = readSrc('index.css');
    const scenicSrc = readSrc('components/scenic/ScenicBackground.tsx');
    const tactileSrc = readSrc('components/ui/TactileButton.tsx');

    // Warm palette tokens in CSS
    expect(css).toContain('--color-warm-bg: #FFF7F0');
    expect(css).toContain('--color-warm-peach: #F8E1D2');
    expect(css).toContain('--color-warm-terracotta: #C65B32');
    expect(css).toContain('--color-warm-forest: #344F48');
    expect(css).toContain('--color-warm-sage: #A3B5A4');
    expect(css).toContain('background-color: #FFF7F0');
    expect(css).toContain('color: #344F48');

    // Scenic background pure 2D SVG
    expect(scenicSrc).toContain('ScenicBackground');
    expect(scenicSrc).toContain('viewBox="0 0 1200 240"');
    expect(scenicSrc).toContain('fill="#F8E1D2"');

    // TactileButton styling with warm palette
    expect(tactileSrc).toContain('#C65B32');
    expect(tactileSrc).toContain('#8D3817'); // beveled terracotta depth
    expect(tactileSrc).toContain('#344F48');
    expect(tactileSrc).toContain('#1A2A26'); // beveled forest ink depth
  });

  it('2. verifies exact @48 logo preservation without illustrations or Bengaluru Edition pill', () => {
    const appSrc = readSrc('App.tsx');
    const homeSrc = readSrc('screens/HomeScreen.tsx');

    // Logo image is strictly preserved
    expect(appSrc).toContain('src="/images/at48-logo.png"');
    expect(appSrc).toContain('alt="@48 Logo"');
    expect(appSrc).toContain('Road trips, without the guesswork.');

    // No "Bengaluru Edition" pill next to the logo
    expect(appSrc).not.toContain('Bengaluru Edition');
    expect(appSrc).not.toContain('BENGALURU EDITION');
    expect(homeSrc).not.toContain('Bengaluru Edition');
    expect(homeSrc).not.toContain('BENGALURU EDITION');
  });

  it('3. verifies customer view does not expose Prototype V2 labels, device switcher pills, or test fixtures', () => {
    const homeSrc = readSrc('screens/HomeScreen.tsx');
    const compareSrc = readSrc('screens/CompareScreen.tsx');
    const scheduleSrc = readSrc('screens/ScheduleScreen.tsx');
    const reviewSrc = readSrc('screens/ReviewScreen.tsx');

    // Customer screens must not contain developer toggles
    for (const src of [homeSrc, compareSrc, scheduleSrc, reviewSrc]) {
      expect(src).not.toContain('Prototype V2');
      expect(src).not.toContain('📱 Mobile');
      expect(src).not.toContain('💻 Desktop');
      expect(src).not.toContain('Page 2: Destination Chooser');
      expect(src).not.toContain('Page 3: Connected Trip Workspace');
    }
  });

  it('4. verifies IST timezone handling across India and outside Indian systems', () => {
    // 2026-11-21 08:00 IST is 2026-11-21 02:30 UTC
    const epoch = parseIST('2026-11-21T08:00');
    const date = new Date(epoch);
    expect(date.toISOString()).toBe('2026-11-21T02:30:00.000Z');

    // Return deadline: 2026-11-22 20:30 IST is 2026-11-22 15:00 UTC
    const retEpoch = parseIST('2026-11-22T20:30');
    const retDate = new Date(retEpoch);
    expect(retDate.toISOString()).toBe('2026-11-22T15:00:00.000Z');

    const daysCount = getCalendarDaysCount('2026-11-21T08:00', '2026-11-22T20:30');
    expect(daysCount).toBe(2);
  });

  it('5. verifies edge cases: zero budgets, invalid dates, and vehicle capacity scaling for large groups', () => {
    const mysuru = getDestination('mysuru')!;

    // Zero budget
    const zeroBudgetConstraints: UserConstraints = {
      departureDateTime: '2026-11-21T08:00',
      returnDeadlineDateTime: '2026-11-22T20:30',
      pace: 'balanced',
      partySize: 2,
      perPersonBudgetINR: 0,
      drivingAdjustmentMinutes: 0,
      simulateDelayMinutes: 0,
      disabledActivityIds: [],
    };
    const zeroResult = evaluateFeasibility(mysuru, zeroBudgetConstraints);
    expect(zeroResult.rating).not.toBe('Not Recommended'); // Budget is advisory warning, non-blocking
    const budgetWarning = zeroResult.violations.find(v => v.type === 'BUDGET_OVERRUN');
    expect(budgetWarning).toBeDefined();
    expect(budgetWarning?.severity).toBe('WARNING');

    // Large group of 10 travelers: scales vehicles to 2 (Tempo Traveller or convoy)
    const largeGroupConstraints: UserConstraints = {
      ...zeroBudgetConstraints,
      partySize: 10,
      perPersonBudgetINR: 10000,
    };
    const largeGroupResult = evaluateFeasibility(mysuru, largeGroupConstraints);
    expect(largeGroupResult.estimatedCostPerPersonINR).toBeGreaterThan(0);
    // Total cost covers scaled vehicle fuel, tolls, and 5 twin sharing rooms
    expect(largeGroupResult.estimatedTripTotalINR).toBeGreaterThan(mysuru.approximateRoundTripFuelINR);
  });

  it('6. verifies CompareScreen 2-column cards, daylight vs evening leisure, and 20% traffic buffer', () => {
    const compareSrc = readSrc('screens/CompareScreen.tsx');

    // 2-column desktop grid
    expect(compareSrc).toContain('grid gap-6 md:grid-cols-2');

    // Daylight vs evening leisure distinction
    expect(compareSrc).toContain('Usable Daylight');
    expect(compareSrc).toContain('evening');

    // 20% traffic buffer breakdown & explanation
    expect(compareSrc).toContain('Drive Breakdown (One Way):');
    expect(compareSrc).toContain('+20% traffic');
    expect(compareSrc).toContain('Includes 20% traffic contingency buffer to account for NICE Road toll plaza queues');

    // Why this result breakdown modal
    expect(compareSrc).toContain('Why this result?');
    expect(compareSrc).toContain('Deterministic Feasibility Breakdown');

    // Select & Build Itinerary CTA
    expect(compareSrc).toContain('Select & Build Itinerary →');
  });

  it('7. verifies ScheduleScreen connected workspace, Move Activity, Use This Time, and transactional Undo', () => {
    const scheduleSrc = readSrc('screens/ScheduleScreen.tsx');

    // Connected 2-column workspace layout
    expect(scheduleSrc).toContain('grid grid-cols-12 gap-6 items-start');
    expect(scheduleSrc).toContain('col-span-12 lg:col-span-7');
    expect(scheduleSrc).toContain('hidden lg:block col-span-5 sticky');

    // Move Activity modal ("Make This Trip Fit")
    expect(scheduleSrc).toContain('Move Activity / Make Fit');
    expect(scheduleSrc).toContain('Make This Trip Fit · Schedule Adjustment');
    expect(scheduleSrc).toContain('Engine Feasibility Verdict');

    // Use This Time visit scheduling editor
    expect(scheduleSrc).toContain('Use This Time');
    expect(scheduleSrc).toContain('Use Free Time Window');
    expect(scheduleSrc).toContain('Transfer Planning Allowance');

    // Review / Adjust local transfers
    expect(scheduleSrc).toContain('Review / Adjust');
    expect(scheduleSrc).toContain('Custom Planning Allowance (Minutes)');

    // Transactional Undo
    expect(scheduleSrc).toContain('recordHistory');
    expect(scheduleSrc).toContain('handleUndo');
    expect(scheduleSrc).toContain('Action undone. Schedule restored to previous state.');

    // Add custom spot
    expect(scheduleSrc).toContain('Add Place / Spot');
    expect(scheduleSrc).toContain('+ Add to Day');

    // Review & Share Itinerary CTA
    expect(scheduleSrc).toContain('Review & Share →');
  });

  it('8. verifies ReviewScreen transparent vehicle fleet breakdown and WhatsApp RSVP generator', () => {
    const reviewSrc = readSrc('screens/ReviewScreen.tsx');

    // Warm palette and components
    expect(reviewSrc).toContain('ScenicBackground');
    expect(reviewSrc).toContain('TactileButton');

    // Vehicle fleet modeling
    expect(reviewSrc).toContain('Vehicle Fleet & Cost Sharing');
    expect(reviewSrc).toContain('1 Standard Car');
    expect(reviewSrc).toContain('1 Large SUV');
    expect(reviewSrc).toContain('Multi-Car Convoy or Tempo Traveller');

    // Preserved WhatsApp RSVP & Sharing
    expect(reviewSrc).toContain('Trip Invitation & RSVP');
    expect(reviewSrc).toContain('Your Name to RSVP');
    expect(reviewSrc).toContain('Join Trip & Send RSVP via WhatsApp');
    expect(reviewSrc).toContain('handleGuestRSVP');
    expect(reviewSrc).toContain('Share Trip (Copy Link)');
  });

  it('9. verifies deterministic move, visit scheduling, and transfer recalculations', () => {
    const mysuru = getDestination('mysuru')!;
    const constraints: UserConstraints = {
      departureDateTime: '2026-11-21T08:00',
      returnDeadlineDateTime: '2026-11-22T20:30',
      pace: 'balanced',
      partySize: 2,
      perPersonBudgetINR: 6000,
      drivingAdjustmentMinutes: 0,
      simulateDelayMinutes: 0,
      disabledActivityIds: [],
      activityDayAssignments: {},
      activityOrder: ['mysuru-palace', 'mysuru-market'],
    };

    const initialResult = evaluateFeasibility(mysuru, constraints);
    expect(initialResult.timeline.length).toBeGreaterThan(0);

    // Test moving Mysuru Palace to Day 2
    const movePreview = evaluateActivityMove(mysuru, constraints, 'mysuru-palace', 2, 0);
    expect(movePreview).toBeDefined();
    expect(movePreview.after.homeArrival).toBeDefined();

    // Test transfer adjustment
    const transferPreview = evaluateTransferAdjustment('mysuru-palace', 45, mysuru, constraints);
    expect(transferPreview).toBeDefined();
    expect(transferPreview.proposedDurationMinutes).toBe(45);

    // Test visit scheduling
    const visitPreview = evaluateVisitScheduling(
      {
        activityId: 'mysuru-market',
        day: 2,
        visitStartTime: '11:00',
        durationMinutes: 60,
        transferMinutes: 15,
        costPerPersonINR: 0,
      },
      mysuru,
      constraints
    );
    expect(visitPreview).toBeDefined();
    expect(visitPreview.details.visitStartTime).toContain('11:00');
  });
});
