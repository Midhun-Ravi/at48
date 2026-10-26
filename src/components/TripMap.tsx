import { useEffect, useMemo, useState } from 'react';
import L from 'leaflet';
import type { LatLngBoundsExpression } from 'leaflet';
import { CircleMarker, MapContainer, Popup, TileLayer, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

import type { Destination, FeasibilityResult, UserConstraints } from '../types';
import { getPlacesForDestination, type RoutePlace } from '../data/routePlaces';
import { formatDuration, formatTimelineTime } from '../utils/formatters';

interface TripMapProps {
  destination: Destination;
  inputs: UserConstraints;
  result: FeasibilityResult;
  onTogglePitstop?: (pitstopId: string) => void;
}

interface RouteState {
  status: 'idle' | 'loading' | 'success' | 'fallback';
  geometry: Array<[number, number]> | null;
  distanceKm: number | null;
  durationMinutes: number | null;
  error?: string;
}

/**
 * Bounds fitter that automatically updates the Leaflet viewport
 * whenever the selected destination, stops, or route geometry changes.
 */
function MapFitter({ bounds }: { bounds: LatLngBoundsExpression }) {
  const map = useMap();
  useEffect(() => {
    if (bounds) {
      map.fitBounds(bounds, { padding: [35, 35], maxZoom: 13 });
    }
  }, [map, bounds]);
  return null;
}

export default function TripMap({
  destination,
  inputs,
  result,
  onTogglePitstop,
}: TripMapProps) {
  const [tileError, setTileError] = useState(false);
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [routeState, setRouteState] = useState<RouteState>({
    status: 'idle',
    geometry: null,
    distanceKm: null,
    durationMinutes: null,
  });

  const places = useMemo(() => getPlacesForDestination(destination.id), [destination.id]);
  const selectedPitstops = inputs.selectedPitstopIds ?? [];

  // Determine key ordered waypoints: origin -> selected pitstops -> destination
  const waypoints = useMemo<RoutePlace[]>(() => {
    const list: RoutePlace[] = [];
    const origin = places.find(p => p.type === 'origin');
    if (origin) list.push(origin);

    for (const stopId of selectedPitstops) {
      const stop = places.find(p => p.pitstopId === stopId);
      if (stop) list.push(stop);
    }

    const destPlace = places.find(p => p.type === 'destination');
    if (destPlace) list.push(destPlace);

    return list;
  }, [places, selectedPitstops]);

  // Fetch road-following route from OSRM demo API with graceful offline fallback
  useEffect(() => {
    if (waypoints.length < 2) return;

    let isMounted = true;
    const controller = new AbortController();

    const fetchRoute = async () => {
      setRouteState(prev => ({ ...prev, status: 'loading' }));
      try {
        const coordsStr = waypoints.map(w => `${w.longitude},${w.latitude}`).join(';');
        const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${coordsStr}?overview=full&geometries=geojson`;

        const response = await fetch(osrmUrl, {
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        });

        if (!response.ok) {
          throw new Error(`OSRM API error: HTTP ${response.status}`);
        }

        const data = await response.json();
        const route = data.routes?.[0];

        if (!route?.geometry?.coordinates) {
          throw new Error('No route geometry returned');
        }

        // Coordinates from GeoJSON are [lon, lat]; Leaflet expects [lat, lon]
        const latLngs: Array<[number, number]> = route.geometry.coordinates.map(
          ([lon, lat]: [number, number]) => [lat, lon] as [number, number]
        );

        if (isMounted) {
          setRouteState({
            status: 'success',
            geometry: latLngs,
            distanceKm: Math.round(route.distance / 1000),
            durationMinutes: Math.round(route.duration / 60),
          });
        }
      } catch (err: unknown) {
        if (!isMounted) return;
        // On network error, sandbox block, or API down: fall back safely to verified coordinate markers
        setRouteState({
          status: 'fallback',
          geometry: null,
          distanceKm: null,
          durationMinutes: null,
          error: err instanceof Error ? err.message : 'Offline or provider unavailable',
        });
      }
    };

    fetchRoute();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [waypoints]);

  // Calculate bounding box for all relevant markers and road geometry
  const bounds = useMemo<LatLngBoundsExpression>(() => {
    if (routeState.geometry && routeState.geometry.length > 0) {
      return L.latLngBounds(routeState.geometry);
    }
    if (places.length === 0) {
      return [
        [12.9756, 77.6066],
        [12.3052, 76.6552],
      ];
    }
    const coords = places.map(p => [p.latitude, p.longitude] as [number, number]);
    return L.latLngBounds(coords);
  }, [places, routeState.geometry]);

  // Construct official Google Maps directions URL with active waypoints
  const googleMapsUrl = useMemo(() => {
    const origin = encodeURIComponent('MG Road, Bengaluru, Karnataka, India');
    const dest = encodeURIComponent(`${destination.name}, Karnataka, India`);
    const waypointStops: string[] = [];

    // Add selected pitstop coordinates as official waypoints
    for (const stopId of selectedPitstops) {
      const stopPlace = places.find(p => p.pitstopId === stopId);
      if (stopPlace) {
        waypointStops.push(`${stopPlace.latitude},${stopPlace.longitude}`);
      }
    }

    let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}&travelmode=driving`;
    if (waypointStops.length > 0) {
      url += `&waypoints=${encodeURIComponent(waypointStops.join('|'))}`;
    }
    return url;
  }, [destination.name, selectedPitstops, places]);

  return (
    <div className="space-y-3 rounded-2xl border border-[#E1ECF2] bg-white p-4 sm:p-5 shadow-sm text-[#193953]">
      {/* Header and Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-[#193953]">Interactive Trip Route & Stops</h2>
            <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
              Verified Pins
            </span>
            {routeState.status === 'success' && (
              <span className="rounded-full bg-[#DDF0F6] border border-[#176EA8]/30 px-2.5 py-0.5 text-xs font-bold text-[#176EA8]">
                🛣️ Road Geometry
              </span>
            )}
          </div>
          <p className="text-xs text-[#5A7184]">
            Geographically grounded markers for origin, destination, attractions, and highway stops.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <div className="inline-flex rounded-lg border border-[#E1ECF2] bg-[#F4F9FC] p-0.5">
            <button
              onClick={() => setViewMode('map')}
              className={`rounded-md px-3 py-1 font-semibold transition-all cursor-pointer ${
                viewMode === 'map' ? 'bg-[#176EA8] text-white shadow-xs' : 'text-[#5A7184] hover:text-[#193953]'
              }`}
            >
              Map View
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`rounded-md px-3 py-1 font-semibold transition-all cursor-pointer ${
                viewMode === 'list' ? 'bg-[#176EA8] text-white shadow-xs' : 'text-[#5A7184] hover:text-[#193953]'
              }`}
            >
              Stop List
            </button>
          </div>
        </div>
      </div>

      {/* Road Geometry or Fallback Notification Badge */}
      {routeState.status === 'success' && routeState.distanceKm && (
        <div className="rounded-xl bg-[#DDF0F6] border border-[#176EA8]/20 p-2.5 text-xs text-[#193953] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>🛣️</span>
            <span>
              <strong>Road Route via OSRM:</strong> ~{routeState.distanceKm} km · ~{formatDuration(routeState.durationMinutes ?? 0)} driving time
            </span>
          </div>
          <span className="text-[11px] text-[#5A7184]">OpenStreetMap Road Graph</span>
        </div>
      )}

      {routeState.status === 'fallback' && (
        <div className="rounded-xl bg-[#F4F9FC] border border-[#E1ECF2] p-2.5 text-xs text-[#5A7184] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>📍</span>
            <span>
              <strong>Verified Waypoint Pins Active:</strong> Road routing service unavailable or offline; open Google Maps for step-by-step turn guidance.
            </span>
          </div>
        </div>
      )}

      {/* Map View */}
      {viewMode === 'map' && !tileError && (
        <div className="relative w-full overflow-hidden rounded-xl border border-[#E1ECF2] bg-[#F4F9FC]">
          <div className="h-72 sm:h-96 w-full">
            <MapContainer
              bounds={bounds}
              scrollWheelZoom={false}
              className="h-full w-full z-0 text-[#193953]"
              style={{ minHeight: '280px' }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                maxZoom={19}
                eventHandlers={{
                  tileerror: () => setTileError(true),
                }}
              />

              <MapFitter bounds={bounds} />

              {/* Road-following Polyline when OSRM geometry is available */}
              {routeState.geometry && (
                <Polyline
                  positions={routeState.geometry}
                  pathOptions={{
                    color: '#176EA8',
                    weight: 4.5,
                    opacity: 0.85,
                    lineJoin: 'round',
                  }}
                />
              )}

              {places.map(place => {
                const isPitstop = place.type === 'pitstop';
                const isSelectedPitstop = isPitstop && place.pitstopId && selectedPitstops.includes(place.pitstopId);
                const isOrigin = place.type === 'origin';
                const isDestination = place.type === 'destination';
                const isStay = place.type === 'stay';
                const isAttraction = place.type === 'attraction';

                // Look up scheduled timetable block if applicable
                const scheduledEntry = result.timeline.find(t => {
                  if (place.activityId && t.activityId === place.activityId) return true;
                  if (place.pitstopId && t.category === 'PITSTOP' && t.label.includes(place.shortName)) return true;
                  return false;
                });

                // Distinct CircleMarker styling per place type using Coastal Explorer palette
                let color = '#5A7184';
                let fillColor = '#E1ECF2';
                let radius = 8;
                let fillOpacity = 0.9;

                if (isOrigin) {
                  color = '#065f46';
                  fillColor = '#10b981';
                  radius = 10;
                } else if (isDestination) {
                  color = '#176EA8';
                  fillColor = '#193953';
                  radius = 11;
                } else if (isPitstop) {
                  color = isSelectedPitstop ? '#b45309' : '#5A7184';
                  fillColor = isSelectedPitstop ? '#FF9870' : '#E1ECF2';
                  radius = isSelectedPitstop ? 10 : 7;
                  fillOpacity = isSelectedPitstop ? 0.95 : 0.7;
                } else if (isAttraction) {
                  color = '#6d28d9';
                  fillColor = '#a855f7';
                  radius = 9;
                } else if (isStay) {
                  color = '#0e7490';
                  fillColor = '#06b6d4';
                  radius = 8;
                }

                return (
                  <CircleMarker
                    key={place.id}
                    center={[place.latitude, place.longitude]}
                    radius={radius}
                    pathOptions={{
                      color,
                      fillColor,
                      fillOpacity,
                      weight: 2.5,
                    }}
                  >
                    <Popup className="at48-marker-popup">
                      <div className="p-1 space-y-1.5 max-w-xs text-xs text-slate-800">
                        <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-1">
                          <strong className="font-bold text-slate-900 text-sm leading-tight">{place.name}</strong>
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                              isOrigin
                                ? 'bg-emerald-100 text-emerald-800'
                                : isDestination
                                ? 'bg-blue-100 text-blue-800'
                                : isPitstop
                                ? 'bg-amber-100 text-amber-900'
                                : isStay
                                ? 'bg-cyan-100 text-cyan-800'
                                : 'bg-purple-100 text-purple-800'
                            }`}
                          >
                            {place.type}
                          </span>
                        </div>

                        {place.description && <p className="text-slate-600">{place.description}</p>}

                        {scheduledEntry && (
                          <div className="rounded bg-slate-50 border border-slate-200 p-1.5 text-[11px]">
                            <span className="font-semibold text-slate-700">Scheduled Time: </span>
                            <strong>
                              {formatTimelineTime(scheduledEntry.startTime)} → {formatTimelineTime(scheduledEntry.endTime)}
                            </strong>
                          </div>
                        )}

                        {place.address && (
                          <p className="text-[11px] text-slate-500">📍 {place.address}</p>
                        )}

                        <div className="pt-1 flex flex-col gap-1.5">
                          {isPitstop && place.pitstopId && onTogglePitstop && (
                            <button
                              onClick={() => onTogglePitstop(place.pitstopId!)}
                              className={`w-full rounded-md px-2.5 py-1.5 font-bold text-xs transition-colors cursor-pointer ${
                                isSelectedPitstop
                                  ? 'border border-amber-600 bg-amber-600 text-white hover:bg-amber-700'
                                  : 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-100'
                              }`}
                            >
                              {isSelectedPitstop ? '✓ Included (Click to Remove)' : '+ Add Stop to Trip'}
                            </button>
                          )}

                          <a
                            href={place.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] text-blue-600 hover:underline"
                          >
                            View OpenStreetMap Source ↗
                          </a>
                        </div>
                      </div>
                    </Popup>
                  </CircleMarker>
                );
              })}
            </MapContainer>
          </div>
        </div>
      )}

      {/* Fallback View if Tile Error or List Mode */}
      {(viewMode === 'list' || tileError) && (
        <div className="space-y-2 rounded-xl border border-[#E1ECF2] bg-[#F4F9FC] p-3 text-xs">
          {tileError && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-2 text-amber-800 mb-2">
              ⚠️ Map tiles are currently unavailable offline. Showing verified coordinate stop list below:
            </div>
          )}

          <div className="divide-y divide-[#E1ECF2]">
            {places.map(place => {
              const isPitstop = place.type === 'pitstop';
              const isSelected = isPitstop && place.pitstopId && selectedPitstops.includes(place.pitstopId);

              return (
                <div key={place.id} className="py-2.5 flex items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <strong className="text-sm font-bold text-[#193953]">{place.name}</strong>
                      <span className="rounded bg-white border border-[#E1ECF2] px-1.5 py-0.2 text-[10px] uppercase font-bold text-[#5A7184]">
                        {place.type}
                      </span>
                      {isSelected && (
                        <span className="rounded bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.2 text-[10px] font-bold">
                          Selected Pitstop
                        </span>
                      )}
                    </div>
                    {place.address && <p className="text-[11px] text-[#5A7184]">{place.address}</p>}
                    <p className="text-[10px] text-[#5A7184]">
                      Coordinates: {place.latitude.toFixed(4)}°N, {place.longitude.toFixed(4)}°E ·{' '}
                      <a
                        href={place.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#176EA8] underline"
                      >
                        OSM Source
                      </a>
                    </p>
                  </div>

                  {isPitstop && place.pitstopId && onTogglePitstop && (
                    <button
                      onClick={() => onTogglePitstop(place.pitstopId!)}
                      className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-amber-600 text-white hover:bg-amber-700'
                          : 'bg-white border border-[#E1ECF2] text-[#193953] hover:bg-slate-50'
                      }`}
                    >
                      {isSelected ? '✓ Remove' : '+ Add'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Footer Directions Link */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[#E1ECF2] text-xs">
        <span className="text-[#5A7184]">
          {places.length} verified places mapped along the {destination.routeName} corridor.
        </span>

        <a
          href={googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-bold text-[#176EA8] hover:underline flex items-center gap-1"
        >
          <span>🗺️</span> Open Google Maps Directions ({waypoints.length} stops) ↗
        </a>
      </div>
    </div>
  );
}
