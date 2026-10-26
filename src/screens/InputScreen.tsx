import { useState } from 'react';
import { useNavigate } from 'react-router';
import type { Dispatch, SetStateAction } from 'react';
import type { UserConstraints } from '../types';
import { parseIST, getCalendarDaysCount } from '../engine/scheduler';
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

      const numDays = getCalendarDaysCount(inputs.departureDateTime, inputs.returnDeadlineDateTime);
      if (numDays < 1 || numDays > 4) {
        throw new Error(
          'Please select travel dates spanning 1 to 4 calendar dates. Trips covering 5 or more calendar dates are outside this prototype.'
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
        <h1 className="text-3xl font-extrabold text-[#193953]">
          When are we hitting the road?
        </h1>
        <p className="mt-2 text-sm text-[#5A7184]">
          Set your real limits. We'll compare four weekend escapes by usable time, not just distance.
        </p>
      </div>

      <div className="space-y-5 rounded-2xl border border-[#E1ECF2] bg-white p-5 shadow-sm">
        {/* Planning Mode: Group vs Solo */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-[#5A7184]">
            Planning Mode
          </label>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => modify({ planningMode: 'group', partySize: inputs.partySize === 1 ? 2 : inputs.partySize })}
              className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition-all cursor-pointer ${
                isGroup
                  ? 'border-[#176EA8] bg-[#DDF0F6] text-[#176EA8] font-bold shadow-xs'
                  : 'border-[#E1ECF2] bg-[#F4F9FC] text-[#5A7184] hover:border-slate-300'
              }`}
            >
              👥 Group
            </button>
            <button
              type="button"
              onClick={() => modify({ planningMode: 'solo', partySize: 1 })}
              className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition-all cursor-pointer ${
                !isGroup
                  ? 'border-[#176EA8] bg-[#DDF0F6] text-[#176EA8] font-bold shadow-xs'
                  : 'border-[#E1ECF2] bg-[#F4F9FC] text-[#5A7184] hover:border-slate-300'
              }`}
            >
              🎒 Solo
            </button>
          </div>
        </div>

        {/* Organizer Display Name */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-[#5A7184]">
            Organizer Name {isGroup ? '' : '(Optional)'}
          </label>
          <input
            type="text"
            maxLength={40}
            placeholder={isGroup ? 'e.g. Sujil Kumar' : 'Your name'}
            className="mt-1.5 block w-full rounded-xl border border-[#E1ECF2] bg-[#F4F9FC] p-3 text-sm text-[#193953] placeholder:text-[#5A7184]/60 focus:border-[#176EA8] focus:bg-white focus:outline-none transition-colors"
            value={inputs.organizerName ?? ''}
            onChange={e => modify({ organizerName: cleanInputDisplayName(e.target.value) })}
            onBlur={e => modify({ organizerName: sanitizeDisplayName(e.target.value) })}
          />
          <span className="mt-1 block text-[11px] text-[#5A7184]">
            {isGroup
              ? 'Used in shareable invitation links and WhatsApp RSVPs.'
              : 'Appears on your itinerary summary.'}
          </span>
        </div>

        {/* Origin Starting Area Picker */}
        <OriginPicker />

        {/* Departure and Return Day Chips */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-[#5A7184] mb-2">
            Trip Dates & Times (1 to 4 Calendar Days)
          </label>
          <DayChipPicker
            departureDateTime={inputs.departureDateTime}
            returnDeadlineDateTime={inputs.returnDeadlineDateTime}
            onChange={handleDateChange}
          />
        </div>

        {/* Actionable date validation feedback */}
        {error && (
          <div className="rounded-xl bg-red-50 p-3.5 border border-red-200 text-xs text-red-700 leading-relaxed" role="alert">
            <span className="font-bold text-red-800">Notice:</span> {error}
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
        className="w-full rounded-xl bg-[#176EA8] px-4 py-4 font-bold text-white shadow-md shadow-[#176EA8]/20 hover:bg-[#135a8a] active:scale-[0.99] transition-all cursor-pointer text-base"
      >
        Run Reality Check →
      </button>
    </section>
  );
}
