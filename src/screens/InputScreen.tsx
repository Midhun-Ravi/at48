import { useState } from 'react';
import { useNavigate } from 'react-router';
import type { Dispatch, SetStateAction } from 'react';
import type { UserConstraints } from '../types';
import { parseIST, getCalendarDaysCount } from '../engine/scheduler';
import { cleanInputDisplayName, sanitizeDisplayName } from '../utils/tripShare';
import ProgressBar from '../components/ProgressBar';
import MonthCalendarPicker from '../components/MonthCalendarPicker';
import GroupSizePicker from '../components/GroupSizePicker';
import BudgetPicker from '../components/BudgetPicker';
import OriginPicker from '../components/OriginPicker';
import TactileButton from '../components/ui/TactileButton';

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
        throw new Error('Return time must be after departure time in Indian Standard Time (IST).');
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

      if (!Number.isInteger(inputs.partySize) || inputs.partySize < 1) {
        throw new Error('Please enter a party size of at least 1 traveler.');
      }

      if (inputs.perPersonBudgetINR < 0 || !Number.isFinite(inputs.perPersonBudgetINR)) {
        throw new Error('Please enter a valid non-negative per-person budget.');
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
    <section className="mx-auto max-w-xl space-y-5 sm:space-y-6 w-full min-w-0">
      {/* 4-part segmented progress meter */}
      <ProgressBar currentStep={1} />

      <div className="text-center sm:text-left space-y-1">
        <h1 className="text-xl sm:text-3xl font-black text-[#193953] tracking-tight leading-snug">
          When are we hitting the road?
        </h1>
        <p className="text-xs sm:text-sm text-[#5A7184]">
          Set your real limits. We'll compare four weekend escapes by usable time, not just distance.
        </p>
      </div>

      <div className="space-y-4 sm:space-y-5 rounded-2xl sm:rounded-3xl border border-[#CBDDE9] bg-white p-3.5 sm:p-6 shadow-sm">
        {/* Planning Mode: Group vs Solo */}
        <div>
          <label className="block text-xs font-black uppercase tracking-wider text-[#5A7184]">
            Planning Mode
          </label>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <TactileButton
              variant={isGroup ? 'primary' : 'secondary'}
              size="md"
              onClick={() => modify({ planningMode: 'group', partySize: inputs.partySize === 1 ? 2 : inputs.partySize })}
              className="w-full justify-center"
            >
              👥 Group
            </TactileButton>

            <TactileButton
              variant={!isGroup ? 'primary' : 'secondary'}
              size="md"
              onClick={() => modify({ planningMode: 'solo', partySize: 1 })}
              className="w-full justify-center"
            >
              🎒 Solo
            </TactileButton>
          </div>
        </div>

        {/* Organizer Display Name */}
        <div>
          <label className="block text-xs font-black uppercase tracking-wider text-[#5A7184]">
            Organizer Name {isGroup ? '' : '(Optional)'}
          </label>
          <input
            type="text"
            maxLength={40}
            placeholder={isGroup ? 'e.g. Sujil Kumar' : 'Your name'}
            className="mt-1.5 block w-full rounded-xl border border-[#CBDDE9] bg-[#F4F9FC] p-3 text-sm text-[#193953] placeholder:text-[#5A7184]/60 focus:border-[#176EA8] focus:bg-white focus:outline-none transition-colors shadow-2xs"
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

        {/* Month Calendar Picker */}
        <div>
          <label className="block text-xs font-black uppercase tracking-wider text-[#5A7184] mb-2">
            Trip Dates & Times (1 to 4 Calendar Days)
          </label>
          <MonthCalendarPicker
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

      <TactileButton
        variant="primary"
        size="lg"
        fullWidth
        onClick={proceed}
        className="text-base"
      >
        Run Reality Check →
      </TactileButton>
    </section>
  );
}
