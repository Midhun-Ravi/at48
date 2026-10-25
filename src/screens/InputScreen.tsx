import { useState } from 'react';
import { useNavigate } from 'react-router';
import type { Dispatch, SetStateAction } from 'react';
import type { UserConstraints } from '../types';
import { parseIST } from '../engine/scheduler';
import { sanitizeDisplayName } from '../utils/tripShare';

type Props = { inputs: UserConstraints; setInputs: Dispatch<SetStateAction<UserConstraints>> };

export default function InputScreen({ inputs, setInputs }: Props) {
  const nav = useNavigate();
  const [error, setError] = useState('');
  const modify = (patch: Partial<UserConstraints>) => setInputs(old => ({ ...old, ...patch }));

  const proceed = () => {
    try {
      const delta = (parseIST(inputs.returnDeadlineDateTime) - parseIST(inputs.departureDateTime)) / 3_600_000;
      if (delta < 18 || delta > 60) throw new Error('Choose a trip window between 18 and 60 hours.');

      if (inputs.organizerName && inputs.organizerName.trim().length > 40) {
        throw new Error('Organizer name must be 40 characters or fewer.');
      }

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
        <div className="text-sm font-semibold uppercase tracking-widest text-teal-700">Step 1 / 3</div>
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
            placeholder={isGroup ? 'e.g. Sujil' : 'Your name'}
            className="mt-2 block w-full rounded-lg border border-slate-300 p-3 text-sm focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
            value={inputs.organizerName ?? ''}
            onChange={e => modify({ organizerName: sanitizeDisplayName(e.target.value) })}
          />
          <span className="mt-1 block text-xs text-slate-500">
            {isGroup
              ? 'Used in shareable invitation links and WhatsApp RSVPs.'
              : 'Appears on your itinerary summary.'}
          </span>
        </label>

        {/* Departure and Return Dates */}
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
          <div className="mb-2 text-sm font-semibold text-slate-900">Budget per person</div>
          <div className="grid grid-cols-3 gap-2">
            {[3000, 6000, 10000].map(v => (
              <button
                key={v}
                type="button"
                onClick={() => modify({ perPersonBudgetINR: v })}
                className={`rounded-lg border px-2 py-3 text-sm transition-all ${
                  inputs.perPersonBudgetINR === v
                    ? 'border-teal-800 bg-teal-50 font-bold text-teal-950 shadow-sm'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                ₹{v.toLocaleString('en-IN')}
              </button>
            ))}
          </div>
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
          Origin: MG Road, Bengaluru (reference). On the next screen you can adjust each one-way estimate for your starting area.
        </p>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

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
