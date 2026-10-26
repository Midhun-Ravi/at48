import { useState } from 'react';
import { useNavigate } from 'react-router';
import type { Dispatch, SetStateAction } from 'react';
import type { UserConstraints } from '../types';
import { parseIST } from '../engine/scheduler';
import { cleanInputDisplayName, sanitizeDisplayName } from '../utils/tripShare';
import ProgressBar from '../components/ProgressBar';
import DayChipPicker from '../components/DayChipPicker';
import GroupSizePicker from '../components/GroupSizePicker';
import BudgetPicker from '../components/BudgetPicker';
import OriginPicker from '../components/OriginPicker';

type Props = { inputs: UserConstraints; setInputs: Dispatch<SetStateAction<UserConstraints>> };

export default function InputScreen({ inputs, setInputs }: Props) {
  const nav = useNavigate();
  const [error, setError] = useState('');

  const modify = (patch: Partial<UserConstraints>) => {
    setError('');
    setInputs(old => ({ ...old, ...patch }));
  };

  const handleDateChange = (departure: string, returnDeadline: string) => {
    setError('');
    setInputs(old => ({
      ...old,
      departureDateTime: departure,
      returnDeadlineDateTime: returnDeadline,
    }));
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
      {/* 4-part segmented progress meter */}
      <ProgressBar currentStep={1} />

      <div>
        <h1 className="text-3xl font-extrabold text-white">
          When are we hitting the road?
        </h1>
        <p className="mt-2 text-sm text-slate-300">
          Set your real limits. We'll compare four weekend escapes by usable time, not just distance.
        </p>
      </div>

      <div className="space-y-5 rounded-2xl border border-slate-800 bg-[#20252E] p-5 shadow-lg">
        {/* Planning Mode: Group vs Solo */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
            Planning Mode
          </label>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => modify({ planningMode: 'group', partySize: inputs.partySize === 1 ? 2 : inputs.partySize })}
              className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition-all cursor-pointer ${
                isGroup
                  ? 'border-[#2962FF] bg-[#2962FF]/20 text-white font-bold shadow-sm'
                  : 'border-slate-700 bg-[#15191F] text-slate-400 hover:border-slate-600'
              }`}
            >
              👥 Group
            </button>
            <button
              type="button"
              onClick={() => modify({ planningMode: 'solo', partySize: 1 })}
              className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition-all cursor-pointer ${
                !isGroup
                  ? 'border-[#2962FF] bg-[#2962FF]/20 text-white font-bold shadow-sm'
                  : 'border-slate-700 bg-[#15191F] text-slate-400 hover:border-slate-600'
              }`}
            >
              🎒 Solo
            </button>
          </div>
        </div>

        {/* Organizer Display Name */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
            Organizer Name {isGroup ? '' : '(Optional)'}
          </label>
          <input
            type="text"
            maxLength={40}
            placeholder={isGroup ? 'e.g. Sujil Kumar' : 'Your name'}
            className="mt-1.5 block w-full rounded-xl border border-slate-700 bg-[#15191F] p-3 text-sm text-white focus:border-[#2962FF] focus:outline-none"
            value={inputs.organizerName ?? ''}
            onChange={e => modify({ organizerName: cleanInputDisplayName(e.target.value) })}
            onBlur={e => modify({ organizerName: sanitizeDisplayName(e.target.value) })}
          />
          <span className="mt-1 block text-[11px] text-slate-400">
            {isGroup
              ? 'Used in shareable invitation links and WhatsApp RSVPs.'
              : 'Appears on your itinerary summary.'}
          </span>
        </div>

        {/* Origin Starting Area Picker */}
        <OriginPicker />

        {/* Departure and Return Day Chips */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
            Trip Dates & Times (18–60h Window)
          </label>
          <DayChipPicker
            departureDateTime={inputs.departureDateTime}
            returnDeadlineDateTime={inputs.returnDeadlineDateTime}
            onChange={handleDateChange}
          />
        </div>

        {/* Actionable date validation feedback right near the date inputs */}
        {error && (
          <div className="rounded-xl bg-red-950/40 p-3.5 border border-red-500/40 text-xs text-red-200 leading-relaxed" role="alert">
            <span className="font-bold text-red-300">Notice:</span> {error}
          </div>
        )}

        {/* Party Size Picker */}
        <GroupSizePicker
          partySize={inputs.partySize}
          isGroup={isGroup}
          onChange={size => modify({ partySize: size })}
        />

        {/* Budget Per Person Picker */}
        <BudgetPicker
          budgetINR={inputs.perPersonBudgetINR}
          onChange={budget => modify({ perPersonBudgetINR: budget })}
        />
      </div>

      <button
        type="button"
        onClick={proceed}
        className="w-full rounded-xl bg-[#2962FF] px-4 py-4 font-bold text-white shadow-lg shadow-[#2962FF]/40 hover:bg-blue-600 active:scale-[0.99] transition-all cursor-pointer text-base"
      >
        Run Reality Check →
      </button>
    </section>
  );
}
