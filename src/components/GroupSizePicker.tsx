import React from 'react';
import TactileButton from './ui/TactileButton';

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
      <div className="rounded-2xl border border-[#EADBCE] bg-[#FAF2EB] p-4 text-xs text-[#6B7C77] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">👤</span>
          <div>
            <span className="font-bold text-[#344F48] block">Solo Traveler (1 person)</span>
            <span className="text-[11px] text-[#6B7C77]">Modeled with single room & personal vehicle/car share</span>
          </div>
        </div>
        <span className="rounded-lg bg-[#F8E1D2] px-2.5 py-1 text-xs font-bold text-[#C65B32]">
          Solo Mode
        </span>
      </div>
    );
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (!Number.isNaN(val) && val >= 1) {
      onChange(val);
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (Number.isNaN(val) || val < 1) {
      onChange(2);
    }
  };

  // Vehicle capacity classification
  const getVehicleArrangement = (size: number) => {
    if (size <= 4) {
      return {
        type: '1 Standard Car (Hatchback/Sedan)',
        badge: 'Single Car',
        badgeColor: 'bg-emerald-50 text-[#0E8A50] border-emerald-200',
        note: 'Fits up to 4 adults comfortably. Standard 1x fuel and toll calculations apply.',
        vehicleCount: 1,
      };
    }
    if (size <= 6) {
      return {
        type: '1 Large SUV (6-Seater)',
        badge: 'Large SUV',
        badgeColor: 'bg-blue-50 text-[#176EA8] border-blue-200',
        note: 'Single large vehicle arrangement (e.g. Innova / Safari). 1x vehicle fuel and toll calculations apply.',
        vehicleCount: 1,
      };
    }
    const vehiclesNeeded = Math.ceil(size / 5);
    return {
      type: `${vehiclesNeeded} Vehicles (Multi-Car Convoy or Tempo Traveller)`,
      badge: `${vehiclesNeeded} Vehicles / Tempo`,
      badgeColor: 'bg-amber-50 text-[#D97706] border-amber-200',
      note: `For groups of ${size}, models ${vehiclesNeeded} vehicles or a 12/17-seater Tempo Traveller. Fuel and toll allowances scale accordingly.`,
      vehicleCount: vehiclesNeeded,
    };
  };

  const vehicleInfo = getVehicleArrangement(partySize);

  return (
    <div className="space-y-3.5 rounded-2xl border border-[#EADBCE] bg-[#FAF2EB] p-4 sm:p-5 text-[#344F48] shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="text-xs font-black uppercase tracking-wider text-[#6B7C77]">
            Group Size & Vehicle Capacity
          </span>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-2xl sm:text-3xl font-black text-[#344F48]">{partySize}</span>
            <span className="text-xs sm:text-sm font-bold text-[#C65B32]">
              {partySize === 1 ? 'traveler' : 'travelers in group'}
            </span>
          </div>
        </div>

        {/* Plus / Minus & Direct Number Input Controls */}
        <div className="flex items-center gap-2">
          <TactileButton
            variant="secondary"
            size="sm"
            onClick={() => onChange(Math.max(1, partySize - 1))}
            disabled={partySize <= 1}
            aria-label="Decrease group size"
            className="!px-3 !py-1 text-base font-black"
          >
            −
          </TactileButton>

          <input
            type="number"
            min={1}
            value={partySize}
            onChange={handleInputChange}
            onBlur={handleBlur}
            aria-label="Group size numeric input"
            className="w-16 rounded-xl border border-[#EADBCE] bg-white py-1.5 text-center text-sm font-black text-[#344F48] focus:border-[#C65B32] focus:outline-none shadow-2xs"
          />

          <TactileButton
            variant="secondary"
            size="sm"
            onClick={() => onChange(partySize + 1)}
            aria-label="Increase group size"
            className="!px-3 !py-1 text-base font-black"
          >
            +
          </TactileButton>
        </div>
      </div>

      {/* Quick Selection Presets */}
      <div className="flex flex-wrap gap-1.5 pt-1">
        {[2, 4, 6, 8, 10, 12].map(preset => (
          <button
            key={preset}
            type="button"
            onClick={() => onChange(preset)}
            className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
              partySize === preset
                ? 'bg-[#C65B32] text-white shadow-xs'
                : 'bg-white border border-[#EADBCE] text-[#6B7C77] hover:bg-[#F8E1D2]/60'
            }`}
          >
            {preset} {preset === 4 ? '(Car)' : preset === 6 ? '(SUV)' : preset >= 8 ? '(Tempo)' : ''}
          </button>
        ))}
      </div>

      {/* Vehicle Capacity Modeling Card */}
      <div className="rounded-xl bg-white border border-[#EADBCE] p-3 text-xs space-y-1.5 shadow-2xs">
        <div className="flex items-center justify-between">
          <span className="font-bold text-[#344F48] flex items-center gap-1.5">
            <span>🚗</span>
            <span>{vehicleInfo.type}</span>
          </span>
          <span className={`rounded-md border px-2 py-0.5 text-[10px] font-black uppercase ${vehicleInfo.badgeColor}`}>
            {vehicleInfo.badge}
          </span>
        </div>
        <p className="text-[11px] text-[#6B7C77] leading-relaxed">
          {vehicleInfo.note}
        </p>
        <div className="pt-1 border-t border-[#EADBCE] flex justify-between text-[10px] text-[#6B7C77]">
          <span>Estimated hotel rooms: {Math.ceil(partySize / 2)} (twin sharing)</span>
          <span>Vehicles modeled: {vehicleInfo.vehicleCount}</span>
        </div>
      </div>
    </div>
  );
}
