import { describe, expect, it } from 'vitest';
import { DESTINATIONS } from '../data/destinations';
import { getPlacesForDestination, ROUTE_PLACES } from '../data/routePlaces';
import { getCompatiblePitstops } from '../data/pitstops';

describe('Interactive Trip Map & Route Places Grounding', () => {
  it('all route places have verified numeric coordinates and official OSM sources', () => {
    expect(ROUTE_PLACES.length).toBeGreaterThan(10);
    for (const place of ROUTE_PLACES) {
      expect(typeof place.latitude).toBe('number');
      expect(typeof place.longitude).toBe('number');
      // South India bounds: Lat ~11.0 to 14.0, Lon ~75.0 to 78.5
      expect(place.latitude).toBeGreaterThan(11.0);
      expect(place.latitude).toBeLessThan(14.0);
      expect(place.longitude).toBeGreaterThan(75.0);
      expect(place.longitude).toBeLessThan(78.5);

      expect(place.verificationStatus).toBe('verified');
      expect(place.sourceUrl).toContain('openstreetmap.org');
    }
  });

  it('contains reference origin at MG Road Bengaluru for all four destinations', () => {
    const origin = ROUTE_PLACES.find(p => p.id === 'origin-bengaluru');
    expect(origin).toBeDefined();
    expect(origin?.latitude).toBeCloseTo(12.9756, 3);
    expect(origin?.longitude).toBeCloseTo(77.6066, 3);

    for (const d of DESTINATIONS) {
      const places = getPlacesForDestination(d.id);
      expect(places.some(p => p.id === 'origin-bengaluru')).toBe(true);
    }
  });

  it('retrieves all verified Mysuru places including Palace, Market, and Maddur Tiffanys', () => {
    const mysuruPlaces = getPlacesForDestination('mysuru');
    const placeIds = mysuruPlaces.map(p => p.id);

    expect(placeIds).toContain('origin-bengaluru');
    expect(placeIds).toContain('dest-mysuru');
    expect(placeIds).toContain('place-mysuru-palace');
    expect(placeIds).toContain('place-mysuru-market');
    expect(placeIds).toContain('pitstop-maddur-tiffanys');
    expect(placeIds).toContain('stay-mysuru-central');
  });

  it('pitstops compatibility scope is restricted strictly to MVP destinations (no unsupported IDs)', () => {
    const compatibleStops = getCompatiblePitstops('mysuru');
    expect(compatibleStops.length).toBeGreaterThanOrEqual(1);
    expect(compatibleStops.some(s => s.id === 'maddur-tiffanys')).toBe(true);

    // Ensure unsupported destinations (such as wayanad) are NOT present
    for (const stop of compatibleStops) {
      expect(stop.compatibleDestinationIds).not.toContain('wayanad');
      for (const destId of stop.compatibleDestinationIds) {
        expect(DESTINATIONS.some(d => d.id === destId)).toBe(true);
      }
    }
  });

  it('does not display Maddur Tiffanys for Nandi Hills (northern corridor)', () => {
    const nandiPlaces = getPlacesForDestination('nandi-hills');
    expect(nandiPlaces.some(p => p.id === 'pitstop-maddur-tiffanys')).toBe(false);
  });
});
