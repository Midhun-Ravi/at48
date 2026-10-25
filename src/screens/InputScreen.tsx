import { useState } from 'react';
import { useNavigate } from 'react-router';
import type { Dispatch, SetStateAction } from 'react';
import type { UserConstraints } from '../types';
import { parseIST } from '../engine/scheduler';
import { cleanInputDisplayName, sanitizeDisplayName } from '../utils/tripShare';

type Props = { inputs: UserConstraints; setInputs: Dispatch<SetStateAction<UserConstraints>> };

export default function InputScreen({ inputs, setInputs }: Props) {
  const nav = useNavigate();
  const [error, setError] = useState('');

  // Track custom budget state
  const isPresetBudget = [3000, 6000, 10000].includes(inputs.perPersonBudgetINR);
  const [isCustomBudget, setIsCustomBudget] = useState(!isPresetBudget);
  const [customBudgetStr, setCustomBudgetStr] = useState(
    !isPresetBudget ? String(inputs.perPersonBudgetINR) : ''
  );

  const modify = (patch: Partial<UserConstraints>) => {
    setError('');
    setInputs(old => ({ ...old, ...patch }));
  };

  const handleCustomBudgetChange = (val: string) => {
    // Allow typing only digits
    const cleaned = val.replace(/[^0-9]/g, '');
    setCustomBudgetStr(cleaned);
    if (cleaned) {
      const num = parseInt(cleaned, 10);
      if (!Number.isNaN(num) && num >= 500 && num <= 100000) {
        modify({ perPersonBudgetINR: num });
      }
    }
  };

  const handleCustomBudgetBlur = () => {
    if (!customBudgetStr) {
      // Revert to default 6000 if empty
      setCustomBudgetStr('6000');
      modify({ perPersonBudgetINR: 6000 });
      return;
    }
    const num = parseInt(customBudgetStr, 10);
    if (Number.isNaN(num) || num < 500) {
      setCustomBudgetStr('500');
      modify({ perPersonBudgetINR: 500 });
    } else if (num > 100000) {
      setCustomBudgetStr('100000');
      modify({ perPersonBudgetINR: 100000 });
    } else {
      setCustomBudgetStr(String(num));
      modify({ perPersonBudgetINR: num });
    }
  };

  const proceed = () => {
    try {
      const depEpoch = parseIST(inputs.departureDateTime);
      const retEpoch = parseIST(inputs.returnDeadlineDateTime);

      if (retEpoch <= depEpoch) {
        throw new Error('Return time must be after departure time.');
      }

      const delta = (retEpoch - depEpoch) / 3_600_000;
      if (delta < 18 || delta > 60) {
        throw new Error(
          '@48 currently plans 18–60 hour escapes. Adjust your dates to continue—longer adventures are on our roadmap.'
        );
      }

      if (inputs.organizerName && inputs.organizerName.trim().length > 40) {
        throw new Error('Organizer name must be 40 characters or fewer.');
      }

      if (inputs.perPersonBudgetINR < 500 || inputs.perPersonBudgetINR > 100000) {
        throw new Error('Please enter a per-person budget between ₹500 and ₹1,00,000.');
      }

      // Normalize organizer name on submit
      const cleanName = sanitizeDisplayName(inputs.organizerName);
      modify({ organizerName: cleanName });

      setError('');
      nav('/compare');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid date');
    }
  };

  const isGroup = (inputs.planningMode ?? 'group') === 'group';

  return (
    <section className="mx-auto max-w-xl space-y-6">
      <div>
        <div className="text-sm font-semibold uppercase tracking-widest text-teal-700">Step 1 / 4</div>
        <h1 className="mt-2 text-3xl font-extrabold text-slate-900">Make your weekend fit.</h1>
        <p className="mt-2 text-slate-600">
          Set your real limits. We'll compare four weekend escapes by usable time, not just distance.
        </p>
      </div>

      <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        {/* Planning Mode: Group vs Solo */}
        <div>
          <label className="block text-sm font-semibold text-slate-900">Planning Mode</label>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => modify({ planningMode: 'group' })}
              className={`rounded-lg border px-3 py-2.5 text-sm font-semibold transition-all ${
                isGroup
                  ? 'border-teal-800 bg-teal-50 text-teal-950 font-bold shadow-sm'
                  : 'border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              👥 Private Group
            </button>
            <button
              type="button"
              onClick={() => modify({ planningMode: 'solo', partySize: 1 })}
              className={`rounded-lg border px-3 py-2.5 text-sm font-semibold transition-all ${
                !isGroup
                  ? 'border-teal-800 bg-teal-50 text-teal-950 font-bold shadow-sm'
                  : 'border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              🎒 Solo Trip
            </button>
          </div>
        </div>

        {/* Organizer Display Name */}
        <label className="block text-sm font-semibold text-slate-900">
          Organizer Name {isGroup ? '' : '(Optional)'}
          <input
            type="text"
            maxLength={40}
            placeholder={isGroup ? 'e.g. Sujil Kumar' : 'Your name'}
            className="mt-2 block w-full rounded-lg border border-slate-300 p-3 text-sm focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
            value={inputs.organizerName ?? ''}
            onChange={e => modify({ organizerName: cleanInputDisplayName(e.target.value) })}
            onBlur={e => modify({ organizerName: sanitizeDisplayName(e.target.value) })}
          />
          <span className="mt-1 block text-xs text-slate-500">
            {isGroup
              ? 'Used in shareable invitation links and WhatsApp RSVPs.'
              : 'Appears on your itinerary summary.'}
          </span>
        </label>

        {/* Positive Explanatory Messaging Box */}
        <div className="rounded-xl border border-teal-200 bg-teal-50/70 p-4 text-xs text-teal-950">
          <div className="flex items-center gap-2 font-bold text-teal-900 text-sm">
            <span>🗺️</span>
            <span>Big adventures are on our roadmap!</span>
          </div>
          <p className="mt-1 text-teal-800 leading-relaxed">
            For now, @48 helps you plan realistic short escapes lasting 18 to 60 hours. Choose your departure and return times within this range to get started.
          </p>
        </div>

        {/* Departure and Return Dates */}
        <div className="space-y-4">
          <label className="block text-sm font-semibold text-slate-900">
            Leave Bengaluru
            <input
              type="datetime-local"
              className="mt-2 block w-full rounded-lg border border-slate-300 p-3 text-sm"
              value={inputs.departureDateTime}
              onChange={e => modify({ departureDateTime: e.target.value })}
            />
          </label>

          <label className="block text-sm font-semibold text-slate-900">
            Must be home by
            <input
              type="datetime-local"
              className="mt-2 block w-full rounded-lg border border-slate-300 p-3 text-sm"
              value={inputs.returnDeadlineDateTime}
              onChange={e => modify({ returnDeadlineDateTime: e.target.value })}
            />
          </label>
        </div>

        {/* Actionable date validation feedback right near the date inputs */}
        {error && (
          <div className="rounded-lg bg-red-50 p-3.5 border border-red-200 text-xs text-red-800 leading-relaxed" role="alert">
            <span className="font-bold text-red-900">Notice:</span> {error}
          </div>
        )}

        {/* Travel Pace */}
        <div>
          <div className="mb-2 text-sm font-semibold text-slate-900">Travel pace</div>
          <div className="grid grid-cols-3 gap-2">
            {(['relaxed', 'balanced', 'packed'] as const).map(p => (
              <button
                key={p}
                type="button"
                onClick={() => modify({ pace: p })}
                className={`rounded-lg border px-2 py-3 text-sm capitalize transition-all ${
                  inputs.pace === p
                    ? 'border-teal-800 bg-teal-50 font-bold text-teal-950 shadow-sm'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Budget Per Person */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-slate-900">Budget per person</span>
            <span className="text-xs font-bold text-teal-800">
              Selected: ₹{inputs.perPersonBudgetINR.toLocaleString('en-IN')}
            </span>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {[3000, 6000, 10000].map(v => (
              <button
                key={v}
                type="button"
                onClick={() => {
                  setIsCustomBudget(false);
                  modify({ perPersonBudgetINR: v });
                }}
                className={`rounded-lg border px-2 py-3 text-xs sm:text-sm transition-all ${
                  !isCustomBudget && inputs.perPersonBudgetINR === v
                    ? 'border-teal-800 bg-teal-50 font-bold text-teal-950 shadow-sm'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                ₹{v.toLocaleString('en-IN')}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setIsCustomBudget(true);
                if ([3000, 6000, 10000].includes(inputs.perPersonBudgetINR)) {
                  setCustomBudgetStr('');
                } else {
                  setCustomBudgetStr(String(inputs.perPersonBudgetINR));
                }
              }}
              className={`rounded-lg border px-2 py-3 text-xs sm:text-sm font-semibold transition-all ${
                isCustomBudget || ![3000, 6000, 10000].includes(inputs.perPersonBudgetINR)
                  ? 'border-teal-800 bg-teal-50 font-bold text-teal-950 shadow-sm'
                  : 'border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              Custom
            </button>
          </div>

          {(isCustomBudget || ![3000, 6000, 10000].includes(inputs.perPersonBudgetINR)) && (
            <div className="mt-3 rounded-xl border border-teal-200 bg-teal-50/60 p-3.5 space-y-1.5">
              <label className="block text-xs font-semibold text-slate-800">
                Custom amount per person (₹)
                <div className="relative mt-1">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-sm font-bold text-slate-600">
                    ₹
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="e.g. 4500"
                    value={customBudgetStr}
                    onChange={e => handleCustomBudgetChange(e.target.value)}
                    onBlur={handleCustomBudgetBlur}
                    className="block w-full rounded-lg border border-slate-300 pl-8 pr-3 py-2 text-sm font-bold text-slate-900 bg-white focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
                  />
                </div>
              </label>
              <p className="text-[11px] text-slate-500">
                Enter whole-number budget from ₹500 to ₹1,00,000. Used for affordability warnings.
              </p>
            </div>
          )}
        </div>

        {/* Party Size (if Group) */}
        {isGroup && (
          <div>
            <div className="mb-2 text-sm font-semibold text-slate-900">Group Party Size</div>
            <div className="grid grid-cols-5 gap-2">
              {[2, 3, 4, 5, 6].map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => modify({ partySize: n })}
                  className={`rounded-lg border px-2 py-2.5 text-sm transition-all ${
                    inputs.partySize === n
                      ? 'border-teal-800 bg-teal-50 font-bold text-teal-950 shadow-sm'
                      : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {n} {n === 1 ? 'person' : 'people'}
                </button>
              ))}
            </div>
          </div>
        )}

        <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900 leading-relaxed">
          Origin: MG Road, Bengaluru (reference). On the next screen you can adjust each one-way estimate independently for your starting area.
        </p>
      </div>

      <button
        type="button"
        onClick={proceed}
        className="w-full rounded-xl bg-[#0d6350] px-4 py-4 font-bold text-white shadow-sm hover:bg-[#0b4b3d] active:scale-[0.99] transition-all cursor-pointer"
      >
        Run Reality Check →
      </button>
    </section>
  );
}
