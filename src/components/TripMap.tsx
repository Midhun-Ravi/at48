import { useEffect, useMemo, useState } from 'react';
import L from 'leaflet';
import type { LatLngBoundsExpression } from 'leaflet';
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

import type { Destination, FeasibilityResult, UserConstraints } from '../types';
import { getPlacesForDestination } from '../data/routePlaces';
import { formatTimelineTime } from '../utils/formatters';

interface TripMapProps {
  destination: Destination;
  inputs: UserConstraints;
  result: FeasibilityResult;
  onTogglePitstop?: (pitstopId: string) => void;
}

/**
 * Bounds fitter that automatically updates the Leaflet viewport
 * whenever the selected destination or stops change.
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

  const places = useMemo(() => getPlacesForDestination(destination.id), [destination.id]);
  const selectedPitstops = inputs.selectedPitstopIds ?? [];

  // Calculate bounding box for all relevant markers
  const bounds = useMemo<LatLngBoundsExpression>(() => {
    if (places.length === 0) {
      return [
        [12.9756, 77.6066],
        [12.3052, 76.6552],
      ];
    }
    const coords = places.map(p => [p.latitude, p.longitude] as [number, number]);
    return L.latLngBounds(coords);
  }, [places]);

  // Construct official Google Maps directions URL with active waypoints
  const googleMapsUrl = useMemo(() => {
    const origin = encodeURIComponent('MG Road, Bengaluru, Karnataka, India');
    const dest = encodeURIComponent(`${destination.name}, Karnataka, India`);
    const waypoints: string[] = [];

    // Add selected pitstop coordinates as official waypoints
    for (const stopId of selectedPitstops) {
      const stopPlace = places.find(p => p.pitstopId === stopId);
      if (stopPlace) {
        waypoints.push(`${stopPlace.latitude},${stopPlace.longitude}`);
      }
    }

    let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}&travelmode=driving`;
    if (waypoints.length > 0) {
      url += `&waypoints=${encodeURIComponent(waypoints.join('|'))}`;
    }
    return url;
  }, [destination.name, selectedPitstops, places]);

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
      {/* Header and Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900">Interactive Trip Route & Stops</h2>
            <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
              Verified Pins
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Geographically grounded markers for origin, destination, attractions, and highway stops.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5">
            <button
              onClick={() => setViewMode('map')}
              className={`rounded-md px-3 py-1 font-semibold transition-all ${
                viewMode === 'map' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Map View
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`rounded-md px-3 py-1 font-semibold transition-all ${
                viewMode === 'list' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Stop List
            </button>
          </div>
        </div>
      </div>

      {/* Map View */}
      {viewMode === 'map' && !tileError && (
        <div className="relative w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
          <div className="h-72 sm:h-96 w-full">
            <MapContainer
              bounds={bounds}
              scrollWheelZoom={false}
              className="h-full w-full z-0 text-slate-800"
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

                // Distinct CircleMarker styling per place type
                let color = '#475569';
                let fillColor = '#64748b';
                let radius = 8;
                let fillOpacity = 0.85;

                if (isOrigin) {
                  color = '#065f46';
                  fillColor = '#10b981';
                  radius = 10;
                } else if (isDestination) {
                  color = '#1e3a8a';
                  fillColor = '#3b82f6';
                  radius = 11;
                } else if (isPitstop) {
                  color = isSelectedPitstop ? '#b45309' : '#94a3b8';
                  fillColor = isSelectedPitstop ? '#f59e0b' : '#cbd5e1';
                  radius = isSelectedPitstop ? 10 : 7;
                  fillOpacity = isSelectedPitstop ? 0.95 : 0.6;
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
                            className="text-center font-semibold text-teal-700 hover:underline text-[11px]"
                          >
                            OpenStreetMap Reference ↗
                          </a>
                        </div>
                      </div>
                    </Popup>
                  </CircleMarker>
                );
              })}
            </MapContainer>
          </div>

          <div className="bg-slate-50/90 px-3 py-1.5 text-[11px] text-slate-500 flex flex-wrap items-center justify-between border-t border-slate-200">
            <span>Scroll zoom disabled on mobile touch. Use + / − buttons to zoom.</span>
            <span>OSM Normal Interactive Tiles</span>
          </div>
        </div>
      )}

      {/* Fallback View or List Mode */}
      {(viewMode === 'list' || tileError) && (
        <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
          {tileError && (
            <p className="rounded-lg bg-amber-50 p-2.5 text-xs text-amber-900 border border-amber-200 mb-2">
              Note: Map tiles could not be loaded. Displaying verified coordinate waypoint list below.
            </p>
          )}

          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Verified Trip Waypoints ({places.length} Places)
          </div>

          <div className="space-y-2 max-h-80 overflow-y-auto">
            {places.map(p => {
              const isSelected = p.pitstopId && selectedPitstops.includes(p.pitstopId);
              return (
                <div key={p.id} className="rounded-lg border border-slate-200 bg-white p-3 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <strong className="text-slate-900">{p.name}</strong>
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                      {p.type.toUpperCase()}
                    </span>
                  </div>
                  <p className="mt-1 text-slate-500">
                    Coords: {p.latitude.toFixed(4)}° N, {p.longitude.toFixed(4)}° E ·{' '}
                    <a href={p.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-teal-700 underline">
                      OSM Source ↗
                    </a>
                  </p>
                  {p.pitstopId && onTogglePitstop && (
                    <button
                      onClick={() => onTogglePitstop(p.pitstopId!)}
                      className={`mt-2 rounded px-2.5 py-1 text-[11px] font-bold ${
                        isSelected ? 'bg-amber-600 text-white' : 'border border-slate-300 bg-white text-slate-800'
                      }`}
                    >
                      {isSelected ? '✓ Pitstop Selected' : '+ Select Pitstop'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Map Legend & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3 text-slate-600">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-full bg-emerald-500 border border-emerald-700"></span>
            Origin
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-full bg-blue-500 border border-blue-800"></span>
            Destination
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-full bg-amber-500 border border-amber-700"></span>
            Pitstop ({selectedPitstops.length > 0 ? 'Selected' : 'Available'})
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-full bg-purple-500 border border-purple-800"></span>
            Attractions
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-full bg-cyan-500 border border-cyan-800"></span>
            Stay Zone
          </span>
        </div>

        <a
          href={googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-xl bg-teal-50 border border-teal-200 px-3.5 py-2 font-bold text-teal-900 hover:bg-teal-100 transition-colors cursor-pointer"
        >
          <span>🗺️</span> Open Directions in Google Maps ↗
        </a>
      </div>
    </div>
  );
}
