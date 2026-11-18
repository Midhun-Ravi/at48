import { describe, expect, it } from 'vitest';
import {
  PROTOTYPE_DESTINATIONS,
  INITIAL_MYSURU_SCHEDULE,
  DISCOVER_PLACES_MYSURU,
} from '../prototype/prototypeData';

describe('@48 V2.1 Prototype Data & Scenario Verification', () => {
  it('includes 4 verified destinations with 2-column comparison data', () => {
    expect(PROTOTYPE_DESTINATIONS).toHaveLength(4);
    const destIds = PROTOTYPE_DESTINATIONS.map(d => d.id);
    expect(destIds).toContain('mysuru');
    expect(destIds).toContain('coorg-madikeri');
    expect(destIds).toContain('nandi-hills');
    expect(destIds).toContain('ooty');
  });

  it('uses authentic local Wikimedia Commons photographs without foreign fallbacks', () => {
    const mysuru = PROTOTYPE_DESTINATIONS.find(d => d.id === 'mysuru')!;
    expect(mysuru.imageSrc).toBe('/images/destinations/mysuru.jpg');
    expect(mysuru.imageAuthor).toBe('Ramesh NG');
    expect(mysuru.imageLicense).toBe('CC BY-SA 2.0');
    expect(mysuru.imageAlt).toContain('Mysore Palace');

    const coorg = PROTOTYPE_DESTINATIONS.find(d => d.id === 'coorg-madikeri')!;
    expect(coorg.imageSrc).toBe('/images/destinations/coorg-madikeri.jpg');
    expect(coorg.imageAuthor).toBe('Shanmugamp7');
    expect(coorg.imageAlt).toContain('Abbey Falls');
  });

  it('strictly distinguishes daylight sightseeing from evening leisure and total free time', () => {
    const mysuru = PROTOTYPE_DESTINATIONS.find(d => d.id === 'mysuru')!;
    // Total free time: 501m (8h 21m)
    expect(mysuru.totalFreeTimeMinutes).toBe(501);
    // Daylight sightseeing: 366m (6h 06m)
    expect(mysuru.daylightSightseeingMinutes).toBe(366);
    // Evening leisure (post-sunset 18:45-21:00): 135m (2h 15m)
    expect(mysuru.unallocatedEveningMinutes).toBe(135);
    // Math integrity check: daylight + evening = total free time
    expect(mysuru.daylightSightseeingMinutes + mysuru.unallocatedEveningMinutes).toBe(
      mysuru.totalFreeTimeMinutes
    );
  });

  it('grounds Mysuru 2-day metrics in verified scheduler calculations', () => {
    const mysuru = PROTOTYPE_DESTINATIONS.find(d => d.id === 'mysuru')!;
    expect(mysuru.drivingBaseMinutes).toBe(195);
    expect(mysuru.drivingBufferMinutes).toBe(39); // 20% buffer
    expect(mysuru.drivingTimeFormatted).toBe('3h 54m');
    expect(mysuru.returnBufferMinutes).toBe(120); // +2h 00m
    expect(mysuru.outboundDeparture).toBe('Sat 08:00 IST');
    expect(mysuru.day1Arrival).toBe('Sat 11:54 IST');
    expect(mysuru.day2ReturnDeparture).toBe('Sun 14:36 IST');
    expect(mysuru.homeArrival).toBe('Sun 18:30 IST');
    expect(mysuru.returnDeadline).toBe('Sun 20:30 IST');
  });

  it('validates initial Mysuru schedule items and verified coordinates', () => {
    expect(INITIAL_MYSURU_SCHEDULE).toHaveLength(2);
    const palace = INITIAL_MYSURU_SCHEDULE.find(s => s.id === 'mysuru-palace')!;
    expect(palace.costINR).toBe(120); // Official entrance ticket
    expect(palace.durationMinutes).toBe(150);
    expect(palace.coordinates).toEqual([12.3051, 76.6551]);

    const market = INITIAL_MYSURU_SCHEDULE.find(s => s.id === 'mysuru-market')!;
    expect(market.costINR).toBe(0); // Free bazaar walk
    expect(market.durationMinutes).toBe(60);
    expect(market.coordinates).toEqual([12.3117, 76.6508]);
  });

  it('curates discover places with verified corridor detours and operating windows', () => {
    expect(DISCOVER_PLACES_MYSURU.length).toBeGreaterThanOrEqual(4);
    const mylari = DISCOVER_PLACES_MYSURU.find(p => p.id === 'place-mylari')!;
    expect(mylari.name).toContain('Vinayaka Mylari');
    expect(mylari.category).toBe('food');
    expect(mylari.estimatedDetourMinutes).toBe(10);
    expect(mylari.operatingHours).toContain('06:30');

    const chamundi = DISCOVER_PLACES_MYSURU.find(p => p.id === 'place-chamundi')!;
    expect(chamundi.category).toBe('sightseeing');
    expect(chamundi.estimatedDetourMinutes).toBe(25);
  });
});
