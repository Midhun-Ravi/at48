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
] as const;

export default function BudgetPicker({ budgetINR, onChange }: BudgetPickerProps) {
  const [inputVal, setInputVal] = useState(String(budgetINR));
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    setInputVal(String(budgetINR));
    setPulse(true);
    const timer = setTimeout(() => setPulse(false), 300);
    return () => clearTimeout(timer);
  }, [budgetINR]);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const num = parseInt(e.target.value, 10);
    if (!Number.isNaN(num)) {
      onChange(num);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    setInputVal(raw);
    if (raw) {
      const num = parseInt(raw, 10);
      if (!Number.isNaN(num) && num >= 500 && num <= 100000) {
        onChange(num);
      }
    }
  };

  const handleInputBlur = () => {
    if (!inputVal) {
      onChange(6000);
      setInputVal('6000');
      return;
    }
    const num = parseInt(inputVal, 10);
    if (Number.isNaN(num) || num < 500) {
      onChange(500);
      setInputVal('500');
    } else if (num > 100000) {
      onChange(100000);
      setInputVal('100000');
    } else {
      onChange(num);
      setInputVal(String(num));
    }
  };

  return (
    <div className="space-y-3.5 rounded-xl border border-[#E1ECF2] bg-[#F4F9FC] p-4 text-[#193953]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="text-xs font-semibold text-[#5A7184] uppercase tracking-wider">
            Budget Cap (Per Person)
          </span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-xl font-bold text-[#176EA8]">₹</span>
            <span
              className={`text-2xl font-black text-[#193953] transition-transform duration-200 ${
                pulse ? 'scale-110 text-[#176EA8]' : 'scale-100'
              }`}
            >
              {budgetINR.toLocaleString('en-IN')}
            </span>
            <span className="text-xs font-semibold text-[#5A7184]">/ person</span>
          </div>
        </div>

        {/* Direct numeric input for precision */}
        <div className="flex items-center gap-1.5">
          <label htmlFor="budget-input" className="text-xs text-[#5A7184]">
            Custom: ₹
          </label>
          <input
            id="budget-input"
            type="text"
            inputMode="numeric"
            value={inputVal}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            aria-label="Custom per-person budget in rupees"
            className="w-24 rounded-lg border border-[#E1ECF2] bg-white px-2.5 py-1 text-right text-xs font-bold text-[#193953] focus:border-[#176EA8] focus:outline-none"
          />
        </div>
      </div>

      {/* Preset Chip Buttons */}
      <div className="grid grid-cols-4 gap-2">
        {PRESETS.map(preset => {
          const isSelected = budgetINR === preset.val;
          return (
            <button
              key={preset.val}
              type="button"
              onClick={() => onChange(preset.val)}
              className={`rounded-lg border px-2 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                isSelected
                  ? 'border-[#176EA8] bg-[#176EA8] text-white shadow-xs'
                  : 'border-[#E1ECF2] bg-white text-[#5A7184] hover:border-[#176EA8]/40 hover:text-[#193953]'
              }`}
            >
              {preset.label}
            </button>
          );
        })}
      </div>

      {/* Smooth slider */}
      <div className="space-y-1">
        <input
          type="range"
          min={1000}
          max={30000}
          step={500}
          value={Math.min(30000, Math.max(1000, budgetINR))}
          onChange={handleSliderChange}
          aria-label="Budget per person slider"
          className="w-full h-2 rounded-lg bg-[#E1ECF2] accent-[#176EA8] cursor-pointer"
        />
        <div className="flex justify-between text-[10px] text-[#5A7184] font-medium px-0.5">
          <span>₹1,000 (Day trip)</span>
          <span>₹6,000 (Standard)</span>
          <span>₹15,000</span>
          <span>₹30,000+ (Luxury)</span>
        </div>
      </div>
    </div>
  );
}
