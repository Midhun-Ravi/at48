import { useEffect, useMemo } from 'react';
import { MapContainer, Marker, Polyline, Popup, TileLayer, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { ScheduledActivity } from './prototypeData';

// Fix default Leaflet icon paths in bundlers if standard markers are used
const createCustomIcon = (number: number | string, color: string = '#176EA8', isHighlighted: boolean = false) => {
  const size = isHighlighted ? 36 : 30;
  return L.divIcon({
    className: 'custom-map-pin',
    html: `
      <div style="
        background-color: ${color};
        color: white;
        width: ${size}px;
        height: ${size}px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 800;
        font-size: ${isHighlighted ? '14px' : '12px'};
        border: 2.5px solid white;
        box-shadow: 0 4px 10px rgba(0,0,0,${isHighlighted ? '0.45' : '0.25'});
        transform: translate(-50%, -50%);
        transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        cursor: pointer;
      ">
        ${number}
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
};

function MapFitter({ bounds }: { bounds: L.LatLngBoundsExpression }) {
  const map = useMap();
  useEffect(() => {
    if (bounds) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }
  }, [map, bounds]);
  return null;
}

interface PrototypeMapProps {
  scheduledActivities: ScheduledActivity[];
  activeHoverId: string | null;
  onSelectActivity?: (id: string) => void;
  heightClass?: string;
}

// Expressway corridor reference waypoints (NH 275 verified route)
const HIGHWAY_CORRIDOR_COORDS: Array<[number, number]> = [
  [12.9756, 77.6066], // Bengaluru MG Road
  [12.8750, 77.4950], // Kengeri / NICE Junction
  [12.7980, 77.3820], // Bidadi
  [12.7200, 77.2800], // Ramanagara
  [12.6500, 77.1950], // Channapatna
  [12.6233, 77.0984], // Maddur Tiffanys
  [12.5240, 76.8960], // Mandya
  [12.4180, 76.6950], // Srirangapatna
  [12.3051, 76.6551], // Mysuru Palace
];

export default function PrototypeMap({
  scheduledActivities,
  activeHoverId,
  onSelectActivity,
  heightClass = 'h-full min-h-[420px]',
}: PrototypeMapProps) {
  // Filter activities that have valid coordinates
  const validStops = useMemo(() => {
    return scheduledActivities.filter(a => a.coordinates && a.coordinates.length === 2);
  }, [scheduledActivities]);

  // Calculate dynamic bounds including Origin and all active stops
  const bounds = useMemo<L.LatLngBoundsExpression>(() => {
    const latLngs: Array<[number, number]> = [
      [12.9756, 77.6066], // Origin
      ...validStops.map(s => s.coordinates),
    ];
    return L.latLngBounds(latLngs);
  }, [validStops]);

  // Center coordinate around Mysuru
  const defaultCenter: [number, number] = [12.3051, 76.6551];

  return (
    <div className={`relative w-full rounded-2xl overflow-hidden border border-[#E1ECF2] shadow-sm bg-[#EBF3F8] ${heightClass}`}>
      {/* Map Control Bar Overlay */}
      <div className="absolute top-3 left-3 z-[1000] bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-[#E1ECF2] shadow-xs text-xs flex items-center gap-2">
        <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
        <span className="font-bold text-[#193953]">Live Corridor Map</span>
        <span className="text-[#5A7184] text-[11px]">· {validStops.length} stops scheduled</span>
      </div>

      <MapContainer
        center={defaultCenter}
        zoom={12}
        scrollWheelZoom={false}
        className="w-full h-full z-0"
        style={{ minHeight: '380px' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={18}
        />

        <MapFitter bounds={bounds} />

        {/* NH 275 Corridor Route Polyline */}
        <Polyline
          positions={HIGHWAY_CORRIDOR_COORDS}
          pathOptions={{
            color: '#176EA8',
            weight: 4,
            opacity: 0.7,
            dashArray: '6, 8',
          }}
        />

        {/* Origin Marker */}
        <Marker
          position={[12.9756, 77.6066]}
          icon={createCustomIcon('★', '#0E4871', activeHoverId === 'origin')}
        >
          <Tooltip direction="top" offset={[0, -10]} opacity={1}>
            <div className="font-semibold text-xs">Origin: MG Road Bengaluru</div>
            <div className="text-[10px] text-gray-500">Departure: Sat 08:00 IST</div>
          </Tooltip>
        </Marker>

        {/* Scheduled Stops Pins */}
        {validStops.map((stop, index) => {
          const isHovered = activeHoverId === stop.id;
          const pinColor = stop.category === 'food' ? '#E67E22' : isHovered ? '#0E4871' : '#176EA8';

          return (
            <Marker
              key={stop.id}
              position={stop.coordinates}
              icon={createCustomIcon(index + 1, pinColor, isHovered)}
              eventHandlers={{
                click: () => onSelectActivity && onSelectActivity(stop.id),
              }}
            >
              <Tooltip direction="top" offset={[0, -15]} opacity={1}>
                <div className="p-1">
                  <div className="font-bold text-xs text-[#193953]">
                    #{index + 1} {stop.name}
                  </div>
                  <div className="text-[11px] text-[#5A7184]">
                    {stop.startTime}–{stop.endTime} ({stop.durationMinutes}m) · {stop.locationName}
                  </div>
                  {stop.costINR > 0 ? (
                    <div className="text-[10px] font-semibold text-emerald-700">Official Entry: ₹{stop.costINR}</div>
                  ) : (
                    <div className="text-[10px] font-semibold text-sky-700">Free Access</div>
                  )}
                </div>
              </Tooltip>

              <Popup>
                <div className="p-1 text-xs space-y-1">
                  <div className="font-bold text-sm text-[#193953]">{stop.name}</div>
                  <div className="text-[#5A7184]">{stop.locationName}</div>
                  <div className="font-semibold text-emerald-700">
                    Day {stop.day} · {stop.startTime}–{stop.endTime}
                  </div>
                  {stop.notes && <p className="text-[11px] text-gray-600">{stop.notes}</p>}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Legend at bottom right */}
      <div className="absolute bottom-3 right-3 z-[1000] bg-white/90 backdrop-blur-sm px-2.5 py-1.5 rounded-lg border border-[#E1ECF2] shadow-xs text-[10px] text-[#5A7184] flex items-center gap-3">
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-[#0E4871]"></span>
          <span>Origin</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-[#176EA8]"></span>
          <span>Attraction</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-[#E67E22]"></span>
          <span>Food</span>
        </div>
      </div>
    </div>
  );
}
