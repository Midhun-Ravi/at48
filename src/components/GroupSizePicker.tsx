import React from 'react';

interface GroupSizePickerProps {
  partySize: number;
  isGroup: boolean;
  onChange: (size: number) => void;
}

export default function GroupSizePicker({
  partySize,
  isGroup,
  onChange,
}: GroupSizePickerProps) {
  if (!isGroup) {
    return (
      <div className="rounded-xl border border-slate-700/60 bg-[#20252E] p-3 text-xs text-slate-300 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">👤</span>
          <span className="font-semibold text-white">Solo Traveler (1 person)</span>
        </div>
        <span className="text-[11px] text-blue-400">Fixed for solo mode</span>
      </div>
    );
  }

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (!Number.isNaN(val) && val >= 2 && val <= 10) {
      onChange(val);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-slate-700/60 bg-[#20252E] p-4 text-slate-100">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Party Size</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-white">{partySize}</span>
            <span className="text-sm font-semibold text-blue-400">
              {partySize === 1 ? 'traveler' : 'travelers in group'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onChange(Math.max(2, partySize - 1))}
            disabled={partySize <= 2}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#292F39] text-base font-bold text-slate-200 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Decrease group size"
          >
            −
          </button>
          <button
            type="button"
            onClick={() => onChange(Math.min(10, partySize + 1))}
            disabled={partySize >= 10}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#292F39] text-base font-bold text-slate-200 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Increase group size"
          >
            +
          </button>
        </div>
      </div>

      {/* Human Silhouette Icons (wrap as necessary) */}
      <div className="flex flex-wrap items-center gap-2 pt-1 pb-1">
        {Array.from({ length: partySize }).map((_, idx) => (
          <div
            key={idx}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[#2962FF]/20 border border-[#2962FF]/40 text-[#2962FF] animate-scaleIn transition-all"
            title={`Traveler ${idx + 1}`}
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        ))}
      </div>

      {/* Tactile Accessible Slider (2 to 10) */}
      <div className="pt-2">
        <input
          type="range"
          min={2}
          max={10}
          step={1}
          value={partySize}
          onChange={handleSliderChange}
          className="w-full accent-[#2962FF] cursor-pointer"
          aria-label="Group Party Size Slider"
        />
        <div className="flex justify-between text-[10px] font-semibold text-slate-400 mt-1">
          <span>2 (Pair)</span>
          <span>4 (Sedan)</span>
          <span>7 (SUV)</span>
          <span>10 (Van/Convoy)</span>
        </div>
      </div>
    </div>
  );
}
