import { useState } from 'react';
import { useNavigate } from 'react-router';
import type { Dispatch, SetStateAction } from 'react';
import type { UserConstraints } from '../types';
import { parseIST } from '../engine/scheduler';

type Props = { inputs: UserConstraints; setInputs: Dispatch<SetStateAction<UserConstraints>> };
export default function InputScreen({ inputs, setInputs }: Props) {
  const nav = useNavigate();
  const [error, setError] = useState('');
  const modify = (patch: Partial<UserConstraints>) => setInputs(old => ({ ...old, ...patch }));
  const proceed = () => {
    try {
      const delta = (parseIST(inputs.returnDeadlineDateTime) - parseIST(inputs.departureDateTime)) / 3_600_000;
      if (delta < 18 || delta > 60) throw new Error('Choose a trip window between 18 and 60 hours.');
      setError(''); nav('/compare');
    } catch (e) { setError(e instanceof Error ? e.message : 'Invalid date'); }
  };
  return <section className="mx-auto max-w-xl space-y-6">
    <div><div className="text-sm font-semibold uppercase tracking-widest text-teal-700">Step 1 / 3</div>
      <h1 className="mt-2 text-3xl font-extrabold">Make your weekend fit.</h1>
      <p className="mt-2 text-slate-600">Set your real limits. We'll compare four weekend escapes by usable time, not just distance.</p></div>
    <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <label className="block text-sm font-semibold">Leave Bengaluru
        <input type="datetime-local" className="mt-2 block w-full rounded-lg border border-slate-300 p-3" value={inputs.departureDateTime} onChange={e => modify({ departureDateTime: e.target.value })}/>
      </label>
      <label className="block text-sm font-semibold">Must be home by
        <input type="datetime-local" className="mt-2 block w-full rounded-lg border border-slate-300 p-3" value={inputs.returnDeadlineDateTime} onChange={e => modify({ returnDeadlineDateTime: e.target.value })}/>
      </label>
      <div><div className="mb-2 text-sm font-semibold">Travel pace</div><div className="grid grid-cols-3 gap-2">
        {(['relaxed','balanced','packed'] as const).map(p => <button key={p} onClick={() => modify({pace:p})} className={`rounded-lg border px-2 py-3 text-sm capitalize ${inputs.pace===p?'border-teal-800 bg-teal-50 font-bold':'border-slate-200'}`}>{p}</button>)}
      </div></div>
      <div><div className="mb-2 text-sm font-semibold">Budget per person</div><div className="grid grid-cols-3 gap-2">
        {[3000,6000,10000].map(v=><button key={v} onClick={()=>modify({perPersonBudgetINR:v})} className={`rounded-lg border px-2 py-3 text-sm ${inputs.perPersonBudgetINR===v?'border-teal-800 bg-teal-50 font-bold':'border-slate-200'}`}>₹{v.toLocaleString('en-IN')}</button>)}
      </div></div>
      <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">Origin: MG Road, Bengaluru (reference). On the next screen you can adjust each one-way estimate for your starting area. Party size is 2.</p>
    </div>
    {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}
    <button onClick={proceed} className="w-full rounded-xl bg-[#0d6350] px-4 py-4 font-bold text-white hover:bg-[#0b4b3d]">Run Reality Check →</button>
  </section>;
}
