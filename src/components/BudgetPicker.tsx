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
    <div className="space-y-4 rounded-xl border border-slate-700/60 bg-[#20252E] p-4 text-slate-100">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Budget Per Person
          </span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span
              className={`text-2xl font-black text-white transition-transform ${
                pulse ? 'scale-105 text-[#2962FF]' : ''
              }`}
            >
              ₹{budgetINR.toLocaleString('en-IN')}
            </span>
            <span className="text-xs font-semibold text-slate-400">/ traveler</span>
          </div>
        </div>

        {/* Editable numeric input */}
        <div className="relative w-32">
          <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 text-xs font-bold text-slate-400 pointer-events-none">
            ₹
          </span>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={inputVal}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            className="w-full rounded-lg border border-slate-700 bg-[#15191F] pl-6 pr-2.5 py-1.5 text-right text-xs font-bold text-white focus:border-[#2962FF] focus:outline-none"
            aria-label="Direct budget input in Indian Rupees"
          />
        </div>
      </div>

      {/* Tactile Accessible Slider: ₹1,000 to ₹30,000 with step ₹500 */}
      <div>
        <input
          type="range"
          min={1000}
          max={30000}
          step={500}
          value={Math.min(30000, Math.max(1000, budgetINR))}
          onChange={handleSliderChange}
          className="w-full accent-[#2962FF] cursor-pointer"
          aria-label="Per-person budget slider"
        />
        <div className="flex justify-between text-[10px] font-semibold text-slate-400 mt-1">
          <span>₹1,000 (Min)</span>
          <span>₹10,000</span>
          <span>₹20,000</span>
          <span>₹30,000 (Max)</span>
        </div>
      </div>

      {/* Preset Landmark Chips */}
      <div className="grid grid-cols-4 gap-2 pt-1 border-t border-slate-800">
        {PRESETS.map(p => (
          <button
            key={p.val}
            type="button"
            onClick={() => onChange(p.val)}
            className={`rounded-lg py-1.5 px-2 text-xs font-semibold border transition-all cursor-pointer ${
              budgetINR === p.val
                ? 'border-[#2962FF] bg-[#2962FF] text-white shadow-sm font-bold'
                : 'border-slate-700 bg-[#15191F] text-slate-300 hover:border-slate-500'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}
