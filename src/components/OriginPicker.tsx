import { useState } from 'react';

interface OriginPickerProps {
  selectedOrigin?: string;
  onSelectOrigin?: (origin: string) => void;
}

export default function OriginPicker({
  selectedOrigin = 'koramangala',
  onSelectOrigin,
}: OriginPickerProps) {
  const [activeOrigin, setActiveOrigin] = useState(selectedOrigin);
  const [detectedCoords, setDetectedCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsStatus, setGpsStatus] = useState<string | null>(null);
  const [showOutOfAreaModal, setShowOutOfAreaModal] = useState(false);

  const handleSelect = (id: string) => {
    setActiveOrigin(id);
    onSelectOrigin?.(id);
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setGpsStatus('Location access unavailable on this device. Using Koramangala Demo Location.');
      handleSelect('koramangala');
      return;
    }

    setGpsStatus('Detecting your location...');
    navigator.geolocation.getCurrentPosition(
      position => {
        const { latitude, longitude } = position.coords;
        // Bengaluru metropolitan bounding box roughly: Lat 12.75 to 13.25 N, Lon 77.35 to 77.85 E
        const isInsideBengaluru =
          latitude >= 12.75 && latitude <= 13.25 && longitude >= 77.35 && longitude <= 77.85;

        if (isInsideBengaluru) {
          setDetectedCoords({ lat: latitude, lng: longitude });
          setGpsStatus(
            `Detected inside Bengaluru (${latitude.toFixed(2)}°N, ${longitude.toFixed(2)}°E).`
          );
          handleSelect('current-location');
        } else {
          setGpsStatus(null);
          handleSelect('koramangala');
          setShowOutOfAreaModal(true);
        }
      },
      error => {
        if (error.code === error.PERMISSION_DENIED) {
          setGpsStatus('Location access permission was denied. Using Koramangala Demo Location.');
        } else {
          setGpsStatus('Location access unavailable. Using Koramangala Demo Location.');
        }
        handleSelect('koramangala');
      },
      { timeout: 7000 }
    );
  };

  const isCurrentLoc = activeOrigin === 'current-location' && detectedCoords;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="block text-xs font-bold uppercase tracking-wider text-[#6B7C77]">
          Starting Point (Bengaluru)
        </label>
        <button
          type="button"
          onClick={handleUseCurrentLocation}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-[#C65B32] hover:text-[#B04E27] hover:underline cursor-pointer"
        >
          <span>🎯</span> Use current location
        </button>
      </div>

      {gpsStatus && (
        <div className="rounded-xl bg-[#FAF2EB] border border-[#EADBCE] px-3.5 py-2 text-xs text-[#344F48] flex items-start gap-2 shadow-2xs">
          <span className="text-[#C65B32] mt-0.5">ℹ️</span>
          <p className="leading-relaxed">{gpsStatus}</p>
        </div>
      )}

      {/* Exactly ONE Visible Starting Point Card */}
      <div>
        {isCurrentLoc ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-[#C65B32] bg-[#FAF2EB] p-4 text-[#344F48] shadow-xs ring-1 ring-[#C65B32]">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-base">📍</span>
                <strong className="text-sm font-bold text-[#344F48]">Current Location (Bengaluru)</strong>
                <span className="rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                  Verified GPS
                </span>
              </div>
              <p className="text-xs text-[#6B7C77]">
                Detected at {detectedCoords.lat.toFixed(3)}°N, {detectedCoords.lng.toFixed(3)}°E · Bengaluru Service Area
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setDetectedCoords(null);
                setGpsStatus(null);
                handleSelect('koramangala');
              }}
              className="text-xs font-bold text-[#C65B32] hover:underline self-start sm:self-auto cursor-pointer"
            >
              Reset to Demo Origin
            </button>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-[#EADBCE] bg-[#FAF2EB] p-4 text-[#344F48] shadow-xs ring-1 ring-[#EADBCE]">
            <div className="space-y-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-base">📍</span>
                <strong className="text-sm font-bold text-[#344F48] break-words">
                  Koramangala, Bengaluru
                </strong>
                <span className="rounded-full bg-[#C65B32] text-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                  Demo Origin
                </span>
              </div>
              <p className="text-xs text-[#6B7C77]">
                Use this sample Bengaluru starting point to experience @48.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-[#EADBCE] bg-white p-3 text-[11px] text-[#6B7C77] space-y-1">
        <p className="font-semibold text-[#344F48]">
          Drive times are estimated from Bengaluru using standard highway corridors with typical weekend traffic buffers (+20%).
        </p>
        <p>
          Need to fine-tune for your specific neighbourhood? You can adjust driving time ±15 to 45 minutes on the next screen.
        </p>
      </div>

      {/* Out-of-Area Friendly Modal */}
      {showOutOfAreaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl border border-[#EADBCE] bg-white p-6 text-[#344F48] shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <span className="text-3xl p-2 bg-[#FAF2EB] rounded-xl border border-[#EADBCE]">🧭</span>
              <div>
                <h4 className="text-base font-bold text-[#344F48]">You appear to be outside Bengaluru</h4>
                <p className="text-xs text-[#6B7C77] mt-0.5">
                  @48 currently supports Bengaluru road-trip planning.
                </p>
              </div>
            </div>

            <p className="text-xs text-[#6B7C77] leading-relaxed">
              @48 currently supports Bengaluru road-trip planning. For now, try the <strong>Koramangala Demo Location</strong> to explore the experience.
            </p>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  handleSelect('koramangala');
                  setShowOutOfAreaModal(false);
                }}
                className="w-full rounded-xl bg-[#C65B32] py-2.5 px-4 text-xs font-bold text-white hover:bg-[#B04E27] transition-colors cursor-pointer shadow-xs"
              >
                Try Koramangala Demo Location →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
