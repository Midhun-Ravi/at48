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
      <div className="rounded-xl border border-[#E1ECF2] bg-[#F4F9FC] p-3 text-xs text-[#5A7184] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">👤</span>
          <span className="font-semibold text-[#193953]">Solo Traveler (1 person)</span>
        </div>
        <span className="text-[11px] font-semibold text-[#176EA8]">Fixed for solo mode</span>
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
    <div className="space-y-3 rounded-xl border border-[#E1ECF2] bg-[#F4F9FC] p-4 text-[#193953]">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold text-[#5A7184] uppercase tracking-wider">Party Size</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-[#193953]">{partySize}</span>
            <span className="text-sm font-semibold text-[#176EA8]">
              {partySize === 1 ? 'traveler' : 'travelers in group'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onChange(Math.max(2, partySize - 1))}
            disabled={partySize <= 2}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-white border border-[#E1ECF2] text-base font-bold text-[#193953] hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
            title="Decrease group size"
          >
            −
          </button>
          <button
            type="button"
            onClick={() => onChange(Math.min(10, partySize + 1))}
            disabled={partySize >= 10}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-white border border-[#E1ECF2] text-base font-bold text-[#193953] hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
            title="Increase group size"
          >
            +
          </button>
        </div>
      </div>

      {/* Slider for quick thumb adjustments */}
      <div className="space-y-1">
        <input
          type="range"
          min={2}
          max={10}
          step={1}
          value={partySize}
          onChange={handleSliderChange}
          aria-label="Party size slider"
          className="w-full h-2 rounded-lg bg-[#E1ECF2] accent-[#176EA8] cursor-pointer"
        />
        <div className="flex justify-between text-[10px] text-[#5A7184] font-medium px-0.5">
          <span>2 (Couple/Duo)</span>
          <span>4 (Car full)</span>
          <span>6 (SUV)</span>
          <span>10 (Van/Convoy)</span>
        </div>
      </div>

      <div className="rounded-lg bg-white border border-[#E1ECF2] p-2.5 text-[11px] text-[#5A7184] leading-relaxed">
        💡 <strong>Cost-sharing:</strong> Hotel rooms & fuel/toll costs are shared across all {partySize} travelers, directly lowering your calculated per-person expense.
      </div>
    </div>
  );
}
