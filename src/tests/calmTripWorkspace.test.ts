import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { evaluateFeasibility } from '../engine/scheduler';
import { getDestination } from '../data/destinations';
import { getMoveCandidates } from '../engine/moveActivity';
import { evaluateVisitScheduling } from '../engine/timelineEditing';
import type { UserConstraints } from '../types';

describe('@48 Page 3 Calm Trip Workspace Redesign (/schedule/:id)', () => {
  const readSrc = (relPath: string) =>
    fs.readFileSync(path.resolve(__dirname, '..', relPath), 'utf8');

  it('1. verifies Header layout has destination, dates, travelers, pace and editable trip summary', () => {
    const scheduleSrc = readSrc('screens/ScheduleScreen.tsx');

    // Header structure
    expect(scheduleSrc).toContain('Step 3 · Trip Workspace');
    expect(scheduleSrc).toContain('What should we explore along the way?');
    expect(scheduleSrc).toContain('Edit dates & limits ✎');
    expect(scheduleSrc).toContain('formatReadableDateTime(currentInputs.departureDateTime)');
    expect(scheduleSrc).toContain('currentInputs.partySize');
  });

  it('2. verifies sticky compact feasibility indicator with return margin, blockers, and Make Fit action', () => {
    const scheduleSrc = readSrc('screens/ScheduleScreen.tsx');

    // Sticky compact feasibility bar
    expect(scheduleSrc).toContain('sticky top-16 z-30');
    expect(scheduleSrc).toContain('Return Margin:');
    expect(scheduleSrc).toContain('Blocker Violation');
    expect(scheduleSrc).toContain('🔄 Move Activity / Make Fit');
    expect(scheduleSrc).toContain('Review & Share →');
  });

  it('3. verifies 2-column desktop layout with sticky Leaflet map and mobile collapsible toggle', () => {
    const scheduleSrc = readSrc('screens/ScheduleScreen.tsx');

    // Desktop 2-column layout
    expect(scheduleSrc).toContain('grid grid-cols-12 gap-6 items-start');
    expect(scheduleSrc).toContain('col-span-12 lg:col-span-7');
    expect(scheduleSrc).toContain('hidden lg:block col-span-5 sticky');
    expect(scheduleSrc).toContain('TripMap');

    // Mobile collapsible map
    expect(scheduleSrc).toContain('lg:hidden');
    expect(scheduleSrc).toContain('Show Map');
    expect(scheduleSrc).toContain('Hide Map');
  });

  it('4. verifies progressive disclosure for Pitstops and Delay Scenarios', () => {
    const scheduleSrc = readSrc('screens/ScheduleScreen.tsx');

    // Collapsible pitstops drawer
    expect(scheduleSrc).toContain('Verified Highway Pitstops');
    expect(scheduleSrc).toContain('isPitstopsOpen');
    expect(scheduleSrc).toContain('Dietary Preference:');

    // Collapsible delay scenarios drawer
    expect(scheduleSrc).toContain('What if the drive takes longer?');
    expect(scheduleSrc).toContain('isDelayScenarioOpen');
    expect(scheduleSrc).toContain('Extra travel allowance:');
  });

  it('5. verifies timeline actions (Edit, Move, Remove, Use This Time, Review/Adjust, Undo)', () => {
    const scheduleSrc = readSrc('screens/ScheduleScreen.tsx');

    // Action buttons in timeline
    expect(scheduleSrc).toContain('handleOpenVisitEditorForActivity');
    expect(scheduleSrc).toContain('handleOpenMoveModal');
    expect(scheduleSrc).toContain('Use This Time');
    expect(scheduleSrc).toContain('Review / Adjust');
    expect(scheduleSrc).toContain('handleUndo');
    expect(scheduleSrc).toContain('Action undone. Schedule restored to previous state.');
  });

  it('6. verifies deterministic feasibility calculations with activity move and visit scheduling', () => {
    const mysuru = getDestination('mysuru')!;
    expect(mysuru).toBeDefined();

    const testConstraints: UserConstraints = {
      departureDateTime: '2026-10-17T06:00',
      returnDeadlineDateTime: '2026-10-18T22:00',
      partySize: 2,
      perPersonBudgetINR: 8000,
      pace: 'balanced',
      simulateDelayMinutes: 0,
      drivingAdjustmentMinutes: 0,
      disabledActivityIds: [],
    };

    const initialResult = evaluateFeasibility(mysuru, testConstraints);
    expect(initialResult.rating).toBe('Comfortable');
    expect(initialResult.returnDeadlineMarginMinutes).toBeGreaterThan(0);

    // Candidates for move
    const candidates = getMoveCandidates(mysuru, testConstraints, initialResult);
    expect(candidates.length).toBeGreaterThan(0);

    // Visit scheduling simulation using an actual free slot
    const freeSlot = initialResult.timeline.find(t => t.category === 'FREE')!;
    expect(freeSlot).toBeDefined();

    const preview = evaluateVisitScheduling(
      {
        name: 'Personal Evening Buffer',
        day: freeSlot.day,
        visitStartTime: freeSlot.startTime.slice(11),
        durationMinutes: 30,
        transferMinutes: 0,
        costPerPersonINR: 0,
        isRestBuffer: true,
      },
      mysuru,
      testConstraints
    );

    expect(preview.isValid).toBe(true);
    expect(preview.proposedConstraints.customActivities?.length).toBe(1);
  });
});
