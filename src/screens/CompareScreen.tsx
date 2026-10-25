import { Link } from 'react-router';
import type { Dispatch, SetStateAction } from 'react';
import type { UserConstraints } from '../types';
import { DESTINATIONS } from '../data/destinations';
import { evaluateFeasibility } from '../engine/scheduler';
import { formatDuration } from '../utils/formatters';
import { getDestinationImage } from '../data/images';

type Props = { inputs: UserConstraints; setInputs: Dispatch<SetStateAction<UserConstraints>> };

export default function CompareScreen({ inputs, setInputs }: Props) {
  const adjustments = inputs.destinationAdjustments ?? {};
  const getAdj = (destId: string) => adjustments[destId] ?? 0;

  const updateAdj = (destId: string, delta: number) => {
    const current = getAdj(destId);
    const next = Math.max(-60, Math.min(120, current + delta));
    setInputs(prev => ({
      ...prev,
      destinationAdjustments: {
        ...(prev.destinationAdjustments ?? {}),
        [destId]: next,
      },
    }));
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-teal-700">Step 2 / 4</p>
          <h1 className="mt-1 text-3xl font-extrabold text-slate-900">Your reality check</h1>
          <p className="mt-1 text-slate-600">
            Four destinations, one real weekend. Usable destination time computed deterministically.
          </p>
        </div>
        <Link to="/plan" className="text-sm font-semibold text-teal-700 hover:underline">
          ← Edit dates & budget
        </Link>
      </div>

      {/* Baseline disclosure banner */}
      <div className="flex items-center gap-3 rounded-xl border border-teal-200 bg-teal-50/70 p-4 text-xs text-teal-950">
        <span className="text-base flex-shrink-0">📍</span>
        <p className="leading-relaxed">
          <strong>Baseline disclosure:</strong> Driving times are planning estimates from MG Road, Bengaluru—not live traffic or your current location. Adjust each destination card independently below if your starting area requires more or less driving time.
        </p>
      </div>

      {/* Destination comparison cards */}
      <div className="grid gap-5 md:grid-cols-2">
        {DESTINATIONS.map(d => {
          const adj = getAdj(d.id);
          const destInputs: UserConstraints = {
            ...inputs,
            drivingAdjustmentMinutes: adj,
          };
          const r = evaluateFeasibility(d, destInputs);
          const img = getDestinationImage(d.id);

          const ratingBadgeColor =
            r.rating === 'Comfortable'
              ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
              : r.rating === 'Tight'
              ? 'bg-amber-100 text-amber-900 border border-amber-300'
              : 'bg-red-100 text-red-900 border border-red-300';

          return (
            <article
              key={d.id}
              className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              {/* Destination Hero Photograph with Fixed Aspect Ratio */}
              <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl bg-slate-100 shadow-inner">
                {img ? (
                  <img
                    src={img.src}
                    alt={img.alt}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
                    onError={e => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-teal-900/10 text-3xl">
                    🏞️
                  </div>
                )}
                {/* Photo attribution badge */}
                {img && (
                  <div className="absolute bottom-2 right-2 rounded bg-black/65 px-2 py-0.5 text-[10px] text-white/95 backdrop-blur-sm pointer-events-none">
                    Photo: {img.author} · {img.license}
                  </div>
                )}
              </div>

              {/* Title & Feasibility Rating */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-xl font-bold text-slate-900">{d.name}</h2>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${ratingBadgeColor}`}>
                  {r.rating}
                </span>
              </div>

              <p className="text-xs text-slate-500">
                {d.routeName} · {d.oneWayDistanceKm} km one-way · MG Road reference
              </p>

              {/* Independent Destination Driving Adjustment Control */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="block text-xs font-bold text-slate-800">Adjust driving estimate</span>
                    <span className="text-[11px] text-slate-500">One-way origin offset</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-label={`Decrease drive time for ${d.name} by 15 minutes`}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white font-bold text-slate-700 shadow-sm hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                      disabled={adj <= -60}
                      onClick={() => updateAdj(d.id, -15)}
                    >
                      −
                    </button>
                    <span className="w-14 text-center text-xs font-black text-slate-900">
                      {formatDuration(adj, true)}
                    </span>
                    <button
                      type="button"
                      aria-label={`Increase drive time for ${d.name} by 15 minutes`}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white font-bold text-slate-700 shadow-sm hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                      disabled={adj >= 120}
                      onClick={() => updateAdj(d.id, 15)}
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Accessible explanation for mobile and desktop */}
                <details className="group border-t border-slate-200/80 pt-2 text-[11px] text-slate-600">
                  <summary className="cursor-pointer font-semibold text-teal-800 hover:text-teal-950 select-none flex items-center gap-1">
                    <span>Why adjust this?</span>
                    <span className="text-[10px] text-teal-600 group-open:rotate-180 transition-transform">▼</span>
                  </summary>
                  <div className="mt-1.5 space-y-1 rounded-lg bg-white p-2.5 border border-slate-200/70 text-slate-600 leading-relaxed">
                    <p>
                      Starting from somewhere other than MG Road? Add or remove time from this destination's estimated drive. This is a planning adjustment, not live traffic.
                    </p>
                    <p className="font-semibold text-slate-800">
                      Example: +30 min means allowing an extra 30 minutes for the estimated one-way drive.
                    </p>
                  </div>
                </details>
              </div>

              {/* Metric Grid */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <p>
                  <span className="block text-xs text-slate-500">Round-trip driving</span>
                  <strong className="text-slate-900">
                    {formatDuration(r.outboundDriveMinutes + r.inboundDriveMinutes)}
                  </strong>
                </p>
                <p>
                  <span className="block text-xs text-slate-500">Usable free time</span>
                  <strong className="text-slate-900">{formatDuration(r.destinationSlackMinutes)}</strong>
                </p>
                <p>
                  <span className="block text-xs text-slate-500">Return margin</span>
                  <strong
                    className={
                      r.returnDeadlineMarginMinutes < 0 ? 'text-red-600 font-bold' : 'text-slate-900'
                    }
                  >
                    {formatDuration(r.returnDeadlineMarginMinutes, true)}
                  </strong>
                </p>
                <p>
                  <span className="block text-xs text-slate-500">Est. cost/person</span>
                  <strong className="text-slate-900">
                    ₹{r.estimatedCostPerPersonINR.toLocaleString('en-IN')}
                  </strong>
                </p>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">{r.ratingExplanation}</p>

              {r.isBudgetExceeded && (
                <p className="rounded-lg bg-amber-50 p-2 text-xs font-semibold text-amber-900">
                  Above Budget — non-blocking warning
                </p>
              )}

              <Link
                to={`/schedule/${d.id}`}
                onClick={() => setInputs(prev => ({ ...prev, drivingAdjustmentMinutes: adj }))}
                className="mt-auto block rounded-xl bg-[#0d6350] px-4 py-3.5 text-center text-sm font-bold text-white shadow-sm hover:bg-[#0b4b3d] active:scale-[0.99] transition-all"
              >
                View Timeline →
              </Link>
            </article>
          );
        })}
      </div>
    </section>
  );
}
