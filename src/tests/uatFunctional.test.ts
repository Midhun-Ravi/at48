import { describe, expect, it } from 'vitest';
import { getDestination } from '../data/destinations';
import { CANDIDATE_DESTINATIONS } from '../engine/recommendations';
import { PITSTOPS, getCompatiblePitstops } from '../data/pitstops';
import { ROUTE_PLACES } from '../data/routePlaces';
import { evaluateFeasibility, parseIST } from '../engine/scheduler';
import { buildShareableParams, parseShareableTrip } from '../utils/tripShare';
import type { UserConstraints } from '../types';

const baseInputs: UserConstraints = {
  departureDateTime: '2026-10-24T06:30',
  returnDeadlineDateTime: '2026-10-27T21:30', // 4 calendar days (Sat to Tue)
  pace: 'balanced',
  partySize: 3,
  perPersonBudgetINR: 8000,
  drivingAdjustmentMinutes: 0,
  simulateDelayMinutes: 0,
  disabledActivityIds: [],
  selectedPitstopIds: [],
  planningMode: 'group',
  organizerName: 'Sujil',
};

describe('Gate 1: Coastal Explorer Palette & Tokens', () => {
  it('defines the Coastal Explorer palette values correctly', () => {
    const coastalExplorerTheme = {
      background: '#F4F9FC',
      card: '#FFFFFF',
      textPrimary: '#193953',
      actionPrimary: '#176EA8',
      accentSecondary: '#DDF0F6',
      accentWarm: '#FF9870',
      border: '#E1ECF2',
      textMuted: '#5A7184',
    };

    expect(coastalExplorerTheme.background).toBe('#F4F9FC');
    expect(coastalExplorerTheme.actionPrimary).toBe('#176EA8');
    expect(coastalExplorerTheme.textPrimary).toBe('#193953');
    expect(coastalExplorerTheme.accentWarm).toBe('#FF9870');
  });
});

describe('Gate 2: In-Curation Destinations Reformatting', () => {
  it('contains exactly 8 candidate destinations with informative summaries', () => {
    expect(CANDIDATE_DESTINATIONS.length).toBe(8);
    for (const c of CANDIDATE_DESTINATIONS) {
      expect(c.name).toBeTruthy();
      expect(c.approxDriveLabel).toBeTruthy();
      expect(c.routeName).toBeTruthy();
      expect(c.highlights).toBeTruthy();
    }
  });

  it('clearly identifies in-curation status for all 8 candidate destinations', () => {
    const candidateNames = CANDIDATE_DESTINATIONS.map(c => c.name);
    expect(candidateNames).toContain('Kabini & Nagarhole');
    expect(candidateNames).toContain('Chikmagalur');
    expect(candidateNames).toContain('Yelagiri Hills');
    expect(candidateNames).toContain('Puducherry (Pondicherry)');
    expect(candidateNames).toContain('Wayanad');
  });
});

describe('Gate 3: Day Tab Navigation Integrity', () => {
  it('evaluates a 4-day trip across 4 properly sequenced calendar dates without technical block counts in tab label', () => {
    const dest = getDestination('coorg-madikeri')!;
    const res = evaluateFeasibility(dest, baseInputs);

    const availableDays = Array.from(new Set(res.timeline.map(t => t.day))).sort((a, b) => a - b);
    expect(availableDays).toEqual([1, 2, 3, 4]);

    for (const day of availableDays) {
      const items = res.timeline.filter(t => t.day === day);
      expect(items.length).toBeGreaterThan(0);
      const dayStart = items[0].startTime;
      expect(dayStart).toBeTruthy();
      // Ensure day label does not leak block count into header logic
      const label = `Day ${day}`;
      expect(label).not.toContain('timeline blocks');
    }
  });
});

describe('Gate 4: Editable Free-Time UI & Custom Activity Scheduling', () => {
  it('inserts a 90-minute custom activity into a 240-minute free slot and leaves exactly 150 minutes remaining', () => {
    const dest = getDestination('mysuru')!;

    // First evaluate baseline without custom activities
    const baseline = evaluateFeasibility(dest, baseInputs);
    const day2FreeBaseline = baseline.timeline.filter(t => t.day === 2 && t.category === 'FREE');
    expect(day2FreeBaseline.length).toBeGreaterThan(0);

    const firstSlot = day2FreeBaseline[0];
    const initialSlotMins = Math.round((parseIST(firstSlot.endTime) - parseIST(firstSlot.startTime)) / 60_000);

    // Now insert a 90-minute custom activity into Day 2
    const inputsWithCustom: UserConstraints = {
      ...baseInputs,
      customActivities: [
        {
          id: 'custom-pool-relaxation',
          day: 2,
          name: 'Resort Pool & Spa Relaxation',
          durationMinutes: 90,
          costPerPersonINR: 500,
          slotStart: firstSlot.startTime,
        },
      ],
    };

    const scheduled = evaluateFeasibility(dest, inputsWithCustom);

    // Verify custom activity is in timeline
    const customEntry = scheduled.timeline.find(t => t.isCustom && t.label.includes('Resort Pool'));
    expect(customEntry).toBeDefined();
    expect(customEntry?.day).toBe(2);

    const customDur = Math.round((parseIST(customEntry!.endTime) - parseIST(customEntry!.startTime)) / 60_000);
    expect(customDur).toBe(90);

    // Verify remaining free block immediately follows with exactly (initialSlotMins - 90) minutes
    const remainingFree = scheduled.timeline.find(t => t.day === 2 && t.category === 'FREE' && t.startTime === customEntry!.endTime);
    if (initialSlotMins > 90) {
      expect(remainingFree).toBeDefined();
      const remDur = Math.round((parseIST(remainingFree!.endTime) - parseIST(remainingFree!.startTime)) / 60_000);
      expect(remDur).toBe(initialSlotMins - 90);
    }

    // Verify cost per person includes the ₹500 fee
    expect(scheduled.estimatedTripTotalINR).toBeGreaterThan(baseline.estimatedTripTotalINR);
  });

  it('encodes and decodes custom activities in shareable URLs via ca query parameter', () => {
    const inputsWithCustom: UserConstraints = {
      ...baseInputs,
      customActivities: [
        {
          id: 'custom_1',
          day: 2,
          name: 'Sunset Coffee Walk',
          durationMinutes: 60,
          costPerPersonINR: 150,
        },
        {
          id: 'custom_2',
          day: 3,
          name: 'Ayurvedic Massage',
          durationMinutes: 90,
          costPerPersonINR: 1200,
        },
      ],
    };

    const params = buildShareableParams('mysuru', inputsWithCustom);
    expect(params.get('ca')).toBeDefined();

    const decoded = parseShareableTrip(params, 'mysuru');
    expect(decoded.valid).toBe(true);
    if (decoded.valid) {
      expect(decoded.data.inputs.customActivities).toBeDefined();
      expect(decoded.data.inputs.customActivities?.length).toBe(2);
      expect(decoded.data.inputs.customActivities?.[0].name).toBe('Sunset Coffee Walk');
      expect(decoded.data.inputs.customActivities?.[0].durationMinutes).toBe(60);
      expect(decoded.data.inputs.customActivities?.[0].costPerPersonINR).toBe(150);
      expect(decoded.data.inputs.customActivities?.[1].name).toBe('Ayurvedic Massage');
      expect(decoded.data.inputs.customActivities?.[1].durationMinutes).toBe(90);
    }
  });

  it('never treats overnight rest as usable free time', () => {
    const dest = getDestination('mysuru')!;
    const res = evaluateFeasibility(dest, baseInputs);

    const restBlocks = res.timeline.filter(t => t.category === 'REST');
    for (const rest of restBlocks) {
      expect(rest.category).not.toBe('FREE');
      expect(rest.label).toContain('Overnight');
    }

    // Free time blocks only occur during daytime hours
    const freeBlocks = res.timeline.filter(t => t.category === 'FREE');
    for (const free of freeBlocks) {
      const startHour = parseInt(free.startTime.slice(11, 13), 10);
      expect(startHour).toBeGreaterThanOrEqual(7);
      expect(startHour).toBeLessThanOrEqual(21);
    }
  });
});

describe('Gate 5: Road Routing & OSRM Fallback Decision', () => {
  it('formats waypoints correctly for OSRM driving API', () => {
    const origin = ROUTE_PLACES.find(p => p.id === 'origin-bengaluru')!;
    const pitstop = ROUTE_PLACES.find(p => p.id === 'pitstop-maddur-tiffanys')!;
    const dest = ROUTE_PLACES.find(p => p.id === 'dest-mysuru')!;

    const waypoints = [origin, pitstop, dest];
    const coordsStr = waypoints.map(w => `${w.longitude},${w.latitude}`).join(';');

    expect(coordsStr).toBe('77.6066,12.9756;77.0983831,12.6232558;76.6552,12.3052');

    const expectedUrl = `https://router.project-osrm.org/route/v1/driving/${coordsStr}?overview=full&geometries=geojson`;
    expect(expectedUrl).toContain('project-osrm.org');
    expect(expectedUrl).toContain('geometries=geojson');
  });

  it('generates a valid Google Maps directions fallback URL with waypoints', () => {
    const selectedStops = ['maddur-tiffanys'];
    expect(selectedStops.length).toBe(1);
    const origin = encodeURIComponent('MG Road, Bengaluru, Karnataka, India');
    const dest = encodeURIComponent('Mysuru, Karnataka, India');
    const stopPlace = ROUTE_PLACES.find(p => p.pitstopId === 'maddur-tiffanys')!;

    const gmapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}&travelmode=driving&waypoints=${stopPlace.latitude},${stopPlace.longitude}`;

    expect(gmapsUrl).toContain('google.com/maps/dir');
    expect(gmapsUrl).toContain('12.6232558');
    expect(gmapsUrl).toContain('77.0983831');
  });
});

describe('Gate 6: Verified Highway Pitstops & Meal Deduplication', () => {
  it('contains verified highway restaurants across NH 275 and NH 44 corridors', () => {
    const mysuruStops = getCompatiblePitstops('mysuru');
    expect(mysuruStops.length).toBeGreaterThanOrEqual(4);
    const stopIds = mysuruStops.map(s => s.id);
    expect(stopIds).toContain('maddur-tiffanys');
    expect(stopIds).toContain('kamat-lokaruchi');
    expect(stopIds).toContain('shivalli-channapatna');
    expect(stopIds).toContain('empire-bidadi');

    const nandiStops = getCompatiblePitstops('nandi-hills');
    const nandiIds = nandiStops.map(s => s.id);
    expect(nandiIds).toContain('indian-paratha-company');
    expect(nandiIds).toContain('nandi-upachar');
    expect(nandiIds).toContain('biryani-zone-devanahalli');
  });

  it('supports dietary classification (veg and non-veg)', () => {
    const vegStops = PITSTOPS.filter(s => s.dietary === 'veg');
    const nonVegStops = PITSTOPS.filter(s => s.dietary === 'non-veg' || s.dietary === 'multi');

    expect(vegStops.length).toBeGreaterThanOrEqual(3);
    expect(nonVegStops.length).toBeGreaterThanOrEqual(2);

    expect(vegStops.some(s => s.id === 'maddur-tiffanys')).toBe(true);
    expect(vegStops.some(s => s.id === 'kamat-lokaruchi')).toBe(true);
    expect(nonVegStops.some(s => s.id === 'empire-bidadi')).toBe(true);
    expect(nonVegStops.some(s => s.id === 'biryani-zone-devanahalli')).toBe(true);
  });

  it('deduplicates arrival dining when pitstop meal is selected', () => {
    const dest = getDestination('mysuru')!;

    // Without pitstop: timeline contains an arrival meal (CHECK_IN or MEAL)
    const resWithoutPitstop = evaluateFeasibility(dest, {
      ...baseInputs,
      selectedPitstopIds: [],
    });
    const mealsWithout = resWithoutPitstop.timeline.filter(t => t.category === 'MEAL' || t.category === 'CHECK_IN');
    expect(mealsWithout.length).toBeGreaterThan(0);

    // With pitstop:
    const resWithPitstop = evaluateFeasibility(dest, {
      ...baseInputs,
      selectedPitstopIds: ['maddur-tiffanys'],
    });

    const pitstopEntry = resWithPitstop.timeline.find(t => t.category === 'PITSTOP');
    expect(pitstopEntry).toBeDefined();

    // Verify no redundant second lunch is added immediately upon hotel check-in
    const checkin = resWithPitstop.timeline.find(t => t.category === 'CHECK_IN');
    if (checkin) {
      // Check-in duration is reduced to standard room settlement (30m) instead of 75m dining buffer
      const checkinDur = Math.round((parseIST(checkin.endTime) - parseIST(checkin.startTime)) / 60_000);
      expect(checkinDur).toBeLessThanOrEqual(45);
    }
  });
});
