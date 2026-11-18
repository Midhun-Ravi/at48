import React, { useState, useEffect } from 'react';

interface BudgetPickerProps {
  budgetINR: number;
  onChange: (val: number) => void;
}

const PRESETS = [
  { val: 3000, label: '₹3,000' },
  { val: 6000, label: '₹6,000' },
  { val: 10000, label: '₹10,000' },
  { val: 15000, label: '₹15,000' },
  { val: 25000, label: '₹25,000' },
] as const;

export default function BudgetPicker({ budgetINR, onChange }: BudgetPickerProps) {
  const [inputVal, setInputVal] = useState(String(budgetINR));

  useEffect(() => {
    setInputVal(String(budgetINR));
  }, [budgetINR]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    setInputVal(raw);
    if (raw !== '') {
      const num = parseInt(raw, 10);
      if (!Number.isNaN(num) && num >= 0) {
        onChange(num);
      }
    }
  };

  const handleInputBlur = () => {
    if (!inputVal || inputVal.trim() === '') {
      onChange(0);
      setInputVal('0');
      return;
    }
    const num = parseInt(inputVal, 10);
    if (Number.isNaN(num) || num < 0) {
      onChange(0);
      setInputVal('0');
    } else {
      onChange(num);
      setInputVal(String(num));
    }
  };

  return (
    <div className="space-y-3.5 rounded-2xl border border-[#EADBCE] bg-[#FAF2EB] p-4 sm:p-5 text-[#344F48] shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="text-xs font-black uppercase tracking-wider text-[#6B7C77]">
            Budget Cap (Per Person)
          </span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-xl font-bold text-[#C65B32]">₹</span>
            <span className="text-2xl sm:text-3xl font-black text-[#344F48]">
              {budgetINR.toLocaleString('en-IN')}
            </span>
            <span className="text-xs font-semibold text-[#6B7C77]">/ traveler</span>
          </div>
        </div>

        {/* Custom amount direct input */}
        <div className="flex items-center gap-1.5">
          <label htmlFor="budget-input" className="text-xs font-bold text-[#6B7C77]">
            Custom: ₹
          </label>
          <input
            id="budget-input"
            type="text"
            inputMode="numeric"
            value={inputVal}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            placeholder="0"
            aria-label="Custom per-person budget in rupees"
            className="w-28 rounded-xl border border-[#EADBCE] bg-white px-3 py-1.5 text-right text-sm font-black text-[#344F48] focus:border-[#C65B32] focus:outline-none shadow-2xs"
          />
        </div>
      </div>

      {/* Quick Budget Presets */}
      <div className="flex flex-wrap gap-1.5 pt-1">
        {PRESETS.map(preset => (
          <button
            key={preset.val}
            type="button"
            onClick={() => onChange(preset.val)}
            className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
              budgetINR === preset.val
                ? 'bg-[#C65B32] text-white shadow-xs'
                : 'bg-white border border-[#EADBCE] text-[#6B7C77] hover:bg-[#F8E1D2]/60'
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* Advisory explanation */}
      <div className="rounded-xl bg-white border border-[#EADBCE] p-3 text-xs text-[#6B7C77] leading-relaxed shadow-2xs">
        💡 <strong>Soft Reality Check:</strong> Budget caps are non-blocking advisory limits.
        If estimated fuel, tolls, stays, and entry tickets exceed your target, @48 shows a clear
        budget breakdown and advisory warning instead of preventing trip planning.
      </div>
    </div>
  );
}
