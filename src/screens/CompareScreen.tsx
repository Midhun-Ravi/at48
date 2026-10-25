import { Link } from 'react-router';
import type { Dispatch, SetStateAction } from 'react';
import type { UserConstraints } from '../types';
import { DESTINATIONS } from '../data/destinations';
import { evaluateFeasibility } from '../engine/scheduler';

type Props = { inputs: UserConstraints; setInputs: Dispatch<SetStateAction<UserConstraints>> };
export default function CompareScreen({ inputs, setInputs }: Props) {
  return <section className="space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-sm font-semibold uppercase tracking-widest text-teal-700">Step 2 / 3</p>
        <h1 className="mt-2 text-3xl font-extrabold">Your reality check</h1>
        <p className="mt-1 text-slate-600">Four destinations, one real weekend. Drive times are estimates, not live traffic.</p></div>
      <Link to="/" className="text-sm font-semibold text-teal-700 underline">Edit dates</Link>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
      <div><p className="font-semibold">Starting outside MG Road?</p><p className="text-sm text-slate-600">Adjust the estimated one-way drive for your origin; the adjustment applies to all four destinations.</p></div>
      <div className="flex items-center gap-3">
        <button aria-label="Subtract 15 minutes" className="rounded-lg border bg-white px-4 py-2 font-bold" disabled={inputs.drivingAdjustmentMinutes<=-60} onClick={()=>setInputs(s=>({...s,drivingAdjustmentMinutes:s.drivingAdjustmentMinutes-15}))}>−</button>
        <span className="w-20 text-center font-bold">{inputs.drivingAdjustmentMinutes>0?'+':''}{inputs.drivingAdjustmentMinutes} min</span>
        <button aria-label="Add 15 minutes" className="rounded-lg border bg-white px-4 py-2 font-bold" disabled={inputs.drivingAdjustmentMinutes>=120} onClick={()=>setInputs(s=>({...s,drivingAdjustmentMinutes:s.drivingAdjustmentMinutes+15}))}>+</button>
      </div>
    </div>
    <div className="grid gap-4 md:grid-cols-2">
      {DESTINATIONS.map(d=>{
        const r=evaluateFeasibility(d,inputs);
        const color=r.rating==='Comfortable'?'bg-emerald-100 text-emerald-900':r.rating==='Tight'?'bg-amber-100 text-amber-900':'bg-red-100 text-red-900';
        return <article key={d.id} className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-xl font-bold">{d.name}</h2><span className={`rounded-full px-3 py-1 text-xs font-bold ${color}`}>{r.rating}</span></div>
          <p className="text-xs text-slate-500">{d.routeName} · MG Road reference</p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <p><span className="block text-xs text-slate-500">Round-trip driving</span><strong>{Math.round((r.outboundDriveMinutes+r.inboundDriveMinutes)/60*10)/10} h</strong></p>
            <p><span className="block text-xs text-slate-500">Usable free time</span><strong>{r.destinationSlackMinutes} min</strong></p>
            <p><span className="block text-xs text-slate-500">Return margin</span><strong>{r.returnDeadlineMarginMinutes} min</strong></p>
            <p><span className="block text-xs text-slate-500">Est. cost/person</span><strong>₹{r.estimatedCostPerPersonINR.toLocaleString('en-IN')}</strong></p>
          </div>
          <p className="text-sm text-slate-700">{r.ratingExplanation}</p>
          {r.isBudgetExceeded && <p className="rounded-lg bg-amber-50 p-2 text-xs font-semibold text-amber-900">Above Budget — non-blocking warning</p>}
          <Link to={`/schedule/${d.id}`} className="mt-auto block rounded-lg bg-[#0d6350] px-4 py-3 text-center text-sm font-bold text-white">View Timeline →</Link>
        </article>;
      })}
    </div>
  </section>;
}
