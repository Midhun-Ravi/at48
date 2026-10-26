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
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-semibold uppercase tracking-wider text-[#5A7184]">
          Starting Point (Bengaluru)
        </label>
        <button
          type="button"
          onClick={handleUseCurrentLocation}
          className="flex items-center gap-1 text-[11px] font-bold text-[#176EA8] hover:underline cursor-pointer"
        >
          <span>🎯</span> Use Current Location
        </button>
      </div>

      {gpsStatus && (
        <div className="rounded-lg bg-[#DDF0F6] border border-[#176EA8]/30 px-3 py-1.5 text-[11px] text-[#176EA8]">
          {gpsStatus}
        </div>
      )}

      {/* Origin Selector dropdown/cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {BENGALURU_PRESETS.map(preset => {
          const isSelected = activeOrigin === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => handleSelect(preset.id)}
              className={`flex items-start justify-between rounded-xl border p-2.5 text-left transition-all cursor-pointer ${
                isSelected
                  ? 'border-[#176EA8] bg-[#DDF0F6] text-[#193953] shadow-xs'
                  : 'border-[#E1ECF2] bg-[#F4F9FC] text-[#5A7184] hover:border-slate-300'
              }`}
            >
              <div className="min-w-0 pr-2">
                <span className="block text-xs font-bold text-[#193953] truncate">{preset.name}</span>
                <span className="block text-[10px] text-[#5A7184]">{preset.area}</span>
              </div>
              {'isDemo' in preset && preset.isDemo && (
                <span className="rounded bg-[#FF9870]/20 text-[#193953] border border-[#FF9870]/40 px-1.5 py-0.5 text-[9px] font-black uppercase flex-shrink-0">
                  Demo
                </span>
              )}
            </button>
          );
        })}
      </div>

      <p className="text-[11px] text-[#5A7184]">
        📍 All route baselines ground at <strong>MG Road (Central Bengaluru)</strong>. Add driving adjustments in Step 2 if departing from outer suburbs.
      </p>

      {/* Out of Bengaluru Alert Modal */}
      {showOutOfAreaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl border border-[#E1ECF2] bg-white p-5 text-[#193953] shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-3xl">⚠️</span>
              <div>
                <h4 className="text-base font-bold text-[#193953]">Outside Bengaluru</h4>
                <p className="text-xs text-[#5A7184]">Location outside Bengaluru metro region.</p>
              </div>
            </div>
            <p className="text-xs text-[#5A7184] leading-relaxed">
              @48 is currently calibrated strictly for <strong>Bengaluru departures</strong>. We've set your starting point to the central <strong>MG Road baseline</strong> for realistic driving calculations.
            </p>
            <button
              type="button"
              onClick={() => setShowOutOfAreaModal(false)}
              className="w-full rounded-xl bg-[#176EA8] py-2.5 text-xs font-bold text-white hover:bg-[#135a8a] transition-colors cursor-pointer"
            >
              Understood, use Bengaluru baseline
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
