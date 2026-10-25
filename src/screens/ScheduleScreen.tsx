import { useState } from 'react';
import { Link, useParams } from 'react-router';
import type { Dispatch, SetStateAction } from 'react';
import type { UserConstraints } from '../types';
import { getDestination } from '../data/destinations';
import { evaluateFeasibility } from '../engine/scheduler';

type Props = { inputs: UserConstraints; setInputs: Dispatch<SetStateAction<UserConstraints>> };
export default function ScheduleScreen({ inputs, setInputs }: Props) {
  const { id } = useParams();
  const [copied, setCopied] = useState('');
  const dest = getDestination(id ?? '');
  if (!dest) return <p>Unknown destination. <Link to="/compare" className="underline">Back to comparison</Link></p>;
  const r = evaluateFeasibility(dest,inputs);
  const maps = 'https://www.google.com/maps/dir/?api=1&origin=' + encodeURIComponent('MG Road, Bengaluru') + '&destination=' + encodeURIComponent(dest.name + ', India') + '&travelmode=driving';
  const share = async () => {
    const summary = `@48 — ${dest.name}\nLeave: ${inputs.departureDateTime} IST\nReturn by: ${inputs.returnDeadlineDateTime} IST\nVerdict: ${r.rating}\nDestination slack: ${r.destinationSlackMinutes}m | Return margin: ${r.returnDeadlineMarginMinutes}m\nEstimated cost/person: ₹${r.estimatedCostPerPersonINR}\nPlanning estimates only; verify route & attraction hours.\n${window.location.origin}`;
    try { await navigator.clipboard.writeText(summary); setCopied('Summary copied!'); }
    catch { setCopied('Clipboard unavailable. Select and copy the summary below.'); window.prompt('Copy your @48 plan:', summary); }
  };
  return <section className="mx-auto max-w-3xl space-y-5">
    <Link to="/compare" className="text-sm font-semibold text-teal-700 underline">← Compare destinations</Link>
    <div><p className="text-sm font-semibold uppercase tracking-widest text-teal-700">Step 3 / 3</p><h1 className="mt-2 text-3xl font-extrabold">{dest.name}: your weekend</h1><p className="mt-1 text-sm text-slate-600">Plan estimates in IST, not a live tracker.</p></div>
    <div className="rounded-xl bg-[#0d352f] p-5 text-white">
      <p className="text-xl font-bold">{r.rating}</p><p className="mt-1 text-sm text-emerald-100">{r.ratingExplanation}</p>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><p className="text-emerald-200">Usable free time</p><strong className="text-xl">{r.destinationSlackMinutes} min</strong></div><div><p className="text-emerald-200">Return margin</p><strong className="text-xl">{r.returnDeadlineMarginMinutes} min</strong></div></div>
      <p className="mt-3 text-sm">Expected home: {r.homeArrivalTime.replace('T',' ')} IST · ₹{r.estimatedCostPerPersonINR.toLocaleString('en-IN')}/person estimated</p>
    </div>
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <label className="flex items-center gap-3 font-semibold"><input type="checkbox" checked={inputs.simulateDelayMinutes===60} onChange={e=>setInputs(s=>({...s,simulateDelayMinutes:e.target.checked?60:0}))}/>
        Simulate +1 hour outbound delay
      </label>
      {dest.activities.filter(a=>a.isOptional).map(a=><label key={a.id} className="flex items-center gap-3 text-sm"><input type="checkbox" checked={!inputs.disabledActivityIds.includes(a.id)} onChange={e=>setInputs(s=>({...s,disabledActivityIds:e.target.checked?s.disabledActivityIds.filter(i=>i!==a.id):[...s.disabledActivityIds,a.id]}))}/>
        Include optional: {a.name}
      </label>)}
    </div>
    {r.violations.length>0 && <div className="space-y-2">{r.violations.map((v,i)=><p key={i} className={`rounded-lg border p-3 text-sm ${v.severity==='BLOCKER'?'border-red-200 bg-red-50 text-red-800':'border-amber-200 bg-amber-50 text-amber-900'}`}><strong>{v.severity}:</strong> {v.message}</p>)}</div>}
    {([1,2] as const).map(day=><div key={day} className="space-y-3"><h2 className="text-xl font-bold">Day {day}</h2><div className="space-y-2">{r.timeline.filter(t=>t.day===day).map(entry=><div key={entry.id} className={`rounded-lg border p-3 text-sm ${entry.category==='FREE'?'border-emerald-200 bg-emerald-50':'border-slate-200 bg-white'}`}><div className="flex flex-wrap justify-between gap-2"><strong>{entry.label}</strong><span className="text-slate-500">{entry.category}</span></div><p className="mt-1 text-slate-600">{entry.startTime.replace('T',' ')} → {entry.endTime.replace('T',' ')}</p></div>)}</div></div>)}
    <button onClick={share} className="w-full rounded-xl bg-[#0d6350] px-4 py-4 font-bold text-white">Copy WhatsApp Trip Summary</button>
    {copied && <p role="status" className="text-sm text-teal-700">{copied}</p>}
    <a href={maps} target="_blank" rel="noopener noreferrer" className="block text-center text-sm font-semibold text-teal-700 underline">Open route in Google Maps ↗</a>
    <p className="text-xs text-slate-500">Cost assumes 2 travelers sharing a car and room. Meals and personal expenses excluded. Route durations and most costs are unverified planning estimates.</p>
  </section>;
}
