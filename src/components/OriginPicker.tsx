import { useState } from 'react';

interface OriginPickerProps {
  selectedOrigin?: string;
  onSelectOrigin?: (origin: string) => void;
}

interface OriginPreset {
  id: string;
  name: string;
  sublabel: string;
  isDemo?: boolean;
  lat: number;
  lng: number;
}

const BENGALURU_PRESETS: OriginPreset[] = [
  {
    id: 'mg-road',
    name: 'MG Road, Bengaluru',
    sublabel: 'Baseline reference hub (Central)',
    lat: 12.9756,
    lng: 77.6066,
  },
  {
    id: 'koramangala',
    name: 'Koramangala, Bengaluru — Demo Location',
    sublabel: 'Pre-calibrated test starting point for non-local explorers',
    isDemo: true,
    lat: 12.9352,
    lng: 77.6245,
  },
  {
    id: 'indiranagar',
    name: 'Indiranagar, Bengaluru',
    sublabel: 'East Bengaluru corridor',
    lat: 12.9784,
    lng: 77.6408,
  },
  {
    id: 'whitefield',
    name: 'Whitefield, Bengaluru',
    sublabel: 'East outer corridor / ITPL',
    lat: 12.9698,
    lng: 77.7500,
  },
  {
    id: 'electronic-city',
    name: 'Electronic City, Bengaluru',
    sublabel: 'South corridor / Hosur Road toll plaza',
    lat: 12.8452,
    lng: 77.6602,
  },
  {
    id: 'hebbal',
    name: 'Hebbal, Bengaluru',
    sublabel: 'North corridor / Airport highway & NH44',
    lat: 13.0358,
    lng: 77.5970,
  },
];

function findNearestPreset(lat: number, lng: number): OriginPreset {
  let closest = BENGALURU_PRESETS[0];
  let minDistance = Infinity;

  for (const preset of BENGALURU_PRESETS) {
    if (preset.isDemo) continue; // Match against genuine corridors
    const d = Math.hypot(lat - preset.lat, lng - preset.lng);
    if (d < minDistance) {
      minDistance = d;
      closest = preset;
    }
  }
  return closest;
}

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
      setGpsStatus('Location access unavailable. Using default starting point (MG Road, Bengaluru).');
      handleSelect('mg-road');
      return;
    }

    setGpsStatus('Detecting your location...');
    navigator.geolocation.getCurrentPosition(
      position => {
        const { latitude, longitude } = position.coords;
        // Bengaluru bounding box roughly: Lat 12.75 to 13.25 N, Lon 77.35 to 77.85 E
        const isInsideBengaluru =
          latitude >= 12.75 && latitude <= 13.25 && longitude >= 77.35 && longitude <= 77.85;

        if (isInsideBengaluru) {
          const nearest = findNearestPreset(latitude, longitude);
          setGpsStatus(
            `Detected inside Bengaluru (${latitude.toFixed(2)}°N, ${longitude.toFixed(2)}°E). Mapped to closest corridor: ${nearest.name}.`
          );
          handleSelect(nearest.id);
        } else {
          setGpsStatus(null);
          handleSelect('koramangala');
          setShowOutOfAreaModal(true);
        }
      },
      error => {
        if (error.code === error.PERMISSION_DENIED) {
          setGpsStatus('Location access permission was denied. Using default starting point (MG Road, Bengaluru).');
        } else {
          setGpsStatus('Location access unavailable. Using default starting point (MG Road, Bengaluru).');
        }
        handleSelect('mg-road');
      },
      { timeout: 7000 }
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-bold uppercase tracking-wider text-[#5A7184]">
          Starting Point (Bengaluru)
        </label>
        <button
          type="button"
          onClick={handleUseCurrentLocation}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-[#176EA8] hover:text-[#135A8A] hover:underline cursor-pointer"
        >
          <span>🎯</span> Use current location
        </button>
      </div>

      {gpsStatus && (
        <div className="rounded-xl bg-[#DDF0F6] border border-[#BAE3F1] px-3.5 py-2 text-xs text-[#193953] flex items-start gap-2 shadow-xs">
          <span className="text-[#176EA8] mt-0.5">ℹ️</span>
          <p className="leading-relaxed">{gpsStatus}</p>
        </div>
      )}

      {/* Preset origin cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {BENGALURU_PRESETS.map(preset => {
          const isSelected = activeOrigin === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => handleSelect(preset.id)}
              className={`flex items-start justify-between rounded-xl border p-3 text-left transition-all cursor-pointer ${
                isSelected
                  ? 'border-[#176EA8] bg-[#DDF0F6] text-[#193953] shadow-xs ring-1 ring-[#176EA8]'
                  : 'border-[#E1ECF2] bg-white text-[#5A7184] hover:border-[#176EA8]/40 hover:bg-[#F4F9FC]'
              }`}
            >
              <div className="min-w-0 pr-2">
                <span className="block text-xs font-bold text-[#193953] truncate">{preset.name}</span>
                <span className="block text-[11px] text-[#5A7184] mt-0.5 leading-snug">{preset.sublabel}</span>
              </div>
              {preset.isDemo && (
                <span className="rounded-full bg-[#FF9870]/20 text-[#193953] border border-[#FF9870]/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider flex-shrink-0">
                  Demo
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="rounded-xl border border-[#E1ECF2] bg-white/70 p-3 text-[11px] text-[#5A7184] space-y-1">
        <p className="font-semibold text-[#193953]">
          Drive times are estimated from your selected starting point using standard Bengaluru highway corridors with typical weekend traffic buffers (+20%).
        </p>
        <p>
          Need to fine-tune for your specific neighbourhood? You can adjust driving time ±15 to 45 minutes on the next screen.
        </p>
      </div>

      {/* Out-of-Area Friendly Modal */}
      {showOutOfAreaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl border border-[#E1ECF2] bg-white p-5 text-[#193953] shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <span className="text-3xl p-1 bg-[#DDF0F6] rounded-xl border border-[#BAE3F1]">🧭</span>
              <div>
                <h4 className="text-base font-bold text-[#193953]">You appear to be outside Bengaluru</h4>
                <p className="text-xs text-[#5A7184] mt-0.5">
                  @48 currently plans road trips departing from Bengaluru.
                </p>
              </div>
            </div>

            <p className="text-xs text-[#5A7184] leading-relaxed">
              We&apos;ve set your starting point to our demo location (<strong>Koramangala, Bengaluru — Demo Location</strong>) so you can explore how our feasibility and scheduling engine works.
            </p>

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowOutOfAreaModal(false)}
                className="flex-1 rounded-xl bg-[#176EA8] py-2.5 px-3 text-xs font-bold text-white hover:bg-[#135A8A] transition-colors cursor-pointer shadow-xs"
              >
                Keep Koramangala (Demo)
              </button>
              <button
                type="button"
                onClick={() => {
                  handleSelect('mg-road');
                  setShowOutOfAreaModal(false);
                }}
                className="flex-1 rounded-xl border border-[#E1ECF2] bg-[#F4F9FC] py-2.5 px-3 text-xs font-bold text-[#193953] hover:bg-white transition-colors cursor-pointer"
              >
                Choose another Bengaluru hub
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
