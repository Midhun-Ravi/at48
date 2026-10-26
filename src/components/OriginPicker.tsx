import { useState } from 'react';

interface OriginPickerProps {
  selectedOrigin?: string;
  onSelectOrigin?: (origin: string) => void;
}

const BENGALURU_PRESETS = [
  { id: 'mg-road', name: 'MG Road / Central Bengaluru (Baseline Reference)', area: 'Central' },
  { id: 'koramangala', name: 'Koramangala 4th Block (Demo Starting Point)', area: 'South-East', isDemo: true },
  { id: 'indiranagar', name: 'Indiranagar 100ft Road', area: 'East' },
  { id: 'whitefield', name: 'Whitefield / ITPL Hub', area: 'East Outer' },
  { id: 'electronic-city', name: 'Electronic City Toll Plaza', area: 'South' },
  { id: 'hebbal', name: 'Hebbal Flyover', area: 'North' },
] as const;

export default function OriginPicker({
  selectedOrigin = 'mg-road',
  onSelectOrigin,
}: OriginPickerProps) {
  const [activeOrigin, setActiveOrigin] = useState(selectedOrigin);
  const [gpsStatus, setGpsStatus] = useState<string | null>(null);
  const [showOutOfAreaModal, setShowOutOfAreaModal] = useState(false);

  const handleSelect = (id: string) => {
    setActiveOrigin(id);
    onSelectOrigin?.(id);
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setGpsStatus('Geolocation not supported by this browser.');
      return;
    }

    setGpsStatus('Locating your position...');
    navigator.geolocation.getCurrentPosition(
      position => {
        const { latitude, longitude } = position.coords;
        // Bengaluru bounding box roughly: Lat 12.75 - 13.25, Lon 77.35 - 77.85
        const isInsideBengaluru =
          latitude >= 12.75 && latitude <= 13.25 && longitude >= 77.35 && longitude <= 77.85;

        if (isInsideBengaluru) {
          setGpsStatus(`Detected Bengaluru location (${latitude.toFixed(3)}°N, ${longitude.toFixed(3)}°E)`);
          handleSelect('mg-road');
        } else {
          setGpsStatus(null);
          setShowOutOfAreaModal(true);
        }
      },
      error => {
        if (error.code === error.PERMISSION_DENIED) {
          setGpsStatus('Location access permission was not granted. Using Bengaluru reference origin.');
        } else {
          setGpsStatus('Unable to determine location. Using Bengaluru reference origin.');
        }
      },
      { timeout: 8000 }
    );
  };

  return (
    <div className="space-y-3 rounded-xl border border-slate-700/60 bg-[#20252E] p-4 text-slate-100">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Where are we starting from?
          </span>
          <p className="text-xs text-slate-300 mt-0.5">
            Select your starting corridor in Bengaluru
          </p>
        </div>

        <button
          type="button"
          onClick={handleUseCurrentLocation}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#292F39] hover:bg-slate-700 border border-slate-600 px-2.5 py-1 text-xs font-semibold text-slate-200 hover:text-white transition-colors cursor-pointer"
        >
          <span>🎯</span>
          <span>My Location</span>
        </button>
      </div>

      {gpsStatus && (
        <div className="rounded-lg bg-blue-950/40 border border-blue-500/30 p-2 text-[11px] text-blue-200">
          {gpsStatus}
        </div>
      )}

      {/* Preset selection dropdown */}
      <div className="relative">
        <select
          value={activeOrigin}
          onChange={e => handleSelect(e.target.value)}
          className="w-full rounded-lg border border-slate-700 bg-[#15191F] px-3 py-2 text-xs font-bold text-white focus:border-[#2962FF] focus:outline-none cursor-pointer"
        >
          {BENGALURU_PRESETS.map(p => (
            <option key={p.id} value={p.id} className="bg-[#15191F] text-white">
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
        <span>Reference Corridor: MG Road</span>
        <button
          type="button"
          onClick={() => handleSelect('koramangala')}
          className="text-blue-400 hover:underline font-semibold cursor-pointer"
        >
          Try Sample Koramangala Demo →
        </button>
      </div>

      {/* Out of area modal */}
      {showOutOfAreaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-[#15191F] p-5 text-center text-slate-100 shadow-2xl space-y-3">
            <span className="text-3xl">📍</span>
            <h4 className="text-base font-bold text-white">We're starting in Bengaluru!</h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              It looks like you're outside our currently supported Bengaluru area. Try a demo trip using Koramangala, or select a Bengaluru departure corridor.
            </p>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  handleSelect('koramangala');
                  setShowOutOfAreaModal(false);
                }}
                className="flex-1 rounded-lg bg-[#2962FF] py-2 text-xs font-bold text-white hover:bg-blue-600 transition-colors"
              >
                Use Koramangala Demo
              </button>
              <button
                type="button"
                onClick={() => setShowOutOfAreaModal(false)}
                className="rounded-lg bg-[#292F39] px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
