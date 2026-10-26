import { Link, useSearchParams } from 'react-router';
import { useMemo, type Dispatch, type SetStateAction } from 'react';
import type { UserConstraints, PacePreference } from '../types';
import { formatDuration } from '../utils/formatters';
import { getDestinationImage } from '../data/images';
import ProgressBar from '../components/ProgressBar';
import { getCalendarDaysCount, parseIST } from '../engine/scheduler';
import { getDestinationRecommendations } from '../engine/recommendations';
import { buildShareableParams } from '../utils/tripShare';

type Props = { inputs: UserConstraints; setInputs: Dispatch<SetStateAction<UserConstraints>> };

const PACE_EXPLANATIONS: Record<PacePreference, { title: string; desc: string }> = {
  relaxed: {
    title: 'Relaxed Pace',
    desc: 'Schedules only top-priority highlights. Reserves 90m for arrival & check-in, 60m for breakfast, and ample free time.',
  },
  balanced: {
    title: 'Balanced Pace (Recommended)',
    desc: 'Schedules key signature landmarks with sensible 75m arrival meal, 45m breakfast, and reliable travel buffers.',
  },
  packed: {
    title: 'Packed Pace',
    desc: 'Maximizes attraction visits fitting within operating hours. Uses compact 60m check-in and 30m meals. Watch for fatigue.',
  },
};

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

  const handlePaceChange = (pace: PacePreference) => {
    setInputs(prev => ({ ...prev, pace }));
  };

  const [searchParams] = useSearchParams();

  // If query params are present, defensively merge into activeInputs
  const activeInputs = useMemo<UserConstraints>(() => {
    const dep = searchParams.get('dep');
    const ret = searchParams.get('ret');
    if (!dep || !ret) return inputs;

    const party = parseInt(searchParams.get('party') || '', 10);
    const budget = parseInt(searchParams.get('budget') || '', 10);
    const rawPace = searchParams.get('pace');
    const pace = rawPace === 'relaxed' || rawPace === 'packed' ? rawPace : inputs.pace;

    return {
      ...inputs,
      departureDateTime: dep,
      returnDeadlineDateTime: ret,
      partySize: !isNaN(party) && party >= 1 && party <= 10 ? party : inputs.partySize,
      perPersonBudgetINR: !isNaN(budget) && budget >= 500 ? budget : inputs.perPersonBudgetINR,
      pace: pace as PacePreference,
    };
  }, [searchParams, inputs]);

  const numDays = getCalendarDaysCount(activeInputs.departureDateTime, activeInputs.returnDeadlineDateTime);
  const durationHours = Math.round(
    (parseIST(activeInputs.returnDeadlineDateTime) - parseIST(activeInputs.departureDateTime)) / 3600_000
  );

  const allRecommendations = getDestinationRecommendations(activeInputs);
  const verifiedRecs = allRecommendations.filter(r => r.isVerified && r.destination && r.feasibility);
  const candidateRecs = allRecommendations.filter(r => !r.isVerified);

  return (
    <section className="space-y-6">
      {/* 4-part segmented progress meter */}
      <ProgressBar currentStep={2} />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white">
            Where should we escape to?
          </h1>
          <p className="mt-1 text-sm text-slate-300">
            Intelligent recommendations for your <strong className="text-white">{numDays} calendar date(s)</strong> ({durationHours} hours). Usable leisure and return margins computed deterministically.
          </p>
        </div>
        <Link to="/plan" className="text-xs font-semibold text-blue-400 hover:underline">
          ← Edit dates & budget
        </Link>
      </div>

      {/* Travel Pace Selector (with dynamic explanation) */}
      <div className="rounded-2xl border border-slate-800 bg-[#20252E] p-4 sm:p-5 shadow-lg space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Travel Pace
          </span>
          <span className="text-xs font-bold text-blue-400">
            {PACE_EXPLANATIONS[inputs.pace].title}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {(['relaxed', 'balanced', 'packed'] as const).map(p => (
            <button
              key={p}
              type="button"
              onClick={() => handlePaceChange(p)}
              className={`rounded-xl border py-2.5 px-3 text-xs sm:text-sm capitalize font-bold transition-all cursor-pointer ${
                inputs.pace === p
                  ? 'border-[#2962FF] bg-[#2962FF] text-white shadow-md shadow-[#2962FF]/40'
                  : 'border-slate-700 bg-[#15191F] text-slate-300 hover:border-slate-600'
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        <p className="text-xs text-slate-300 leading-relaxed bg-[#15191F] p-3 rounded-xl border border-slate-800">
          ℹ️ {PACE_EXPLANATIONS[inputs.pace].desc}
        </p>
      </div>

      {/* Baseline disclosure banner */}
      <div className="flex items-center gap-3 rounded-2xl border border-blue-900/40 bg-blue-950/20 p-4 text-xs text-slate-300">
        <span className="text-base flex-shrink-0">📍</span>
        <p className="leading-relaxed">
          <strong>Baseline disclosure:</strong> Driving times are planning estimates from MG Road, Bengaluru with 20% safety contingency. Adjust each destination card independently below if your starting area requires more or less driving time.
        </p>
      </div>

      {/* Verified Destination Comparison Cards (Sorted by Duration-Aware Recommendation) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white">
            Verified Itineraries ({verifiedRecs.length})
          </h2>
          <span className="text-xs text-slate-400">
            Ranked for {numDays}-day getaway
          </span>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {verifiedRecs.map(rec => {
            const d = rec.destination!;
            const r = rec.feasibility!;
            const adj = getAdj(d.id);
            const img = getDestinationImage(d.id);

            const ratingBadgeColor =
              r.rating === 'Comfortable'
                ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/40'
                : r.rating === 'Tight'
                ? 'bg-amber-950/60 text-amber-300 border border-amber-500/40'
                : 'bg-red-950/60 text-red-300 border border-red-500/40';

            return (
              <article
                key={d.id}
                className="flex flex-col justify-between rounded-2xl border border-slate-800 bg-[#20252E] p-5 shadow-lg transition-all hover:border-slate-700"
              >
                <div className="space-y-4">
                  {/* Destination Hero Photograph with Fixed Aspect Ratio */}
                  <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl bg-slate-900 shadow-inner">
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
                      <div className="flex h-full w-full items-center justify-center bg-slate-800 text-3xl">
                        🏞️
                      </div>
                    )}
                    {img && (
                      <div className="absolute bottom-2 right-2 rounded bg-black/75 px-2 py-0.5 text-[10px] text-white/95 backdrop-blur-sm pointer-events-none">
                        Photo: {img.author} · {img.license}
                      </div>
                    )}
                  </div>

                  {/* Title & Badges */}
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h2 className="text-xl font-bold text-white">{d.name}</h2>
                      <div className="flex items-center gap-1.5">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${rec.tierBadgeClass}`}>
                          {rec.tierLabel}
                        </span>
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${ratingBadgeColor}`}>
                          {r.rating}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs font-semibold text-blue-400">
                      {d.routeName} · {d.oneWayDistanceKm} km
                    </p>
                  </div>

                  {/* Why Recommended Callout */}
                  <div className="rounded-xl border border-blue-900/30 bg-blue-950/20 p-3 text-xs text-slate-300 leading-relaxed">
                    <strong className="text-blue-300 block mb-0.5">Why this fits your trip:</strong>
                    {rec.whyRecommended}
                  </div>

                  {/* Feasibility Metrics Box */}
                  <div className="grid grid-cols-2 gap-2 rounded-xl bg-[#15191F] p-3 text-xs border border-slate-800">
                    <div>
                      <span className="text-[11px] text-slate-400 block">Usable Leisure Time</span>
                      <strong className="text-base text-white">
                        {formatDuration(r.destinationSlackMinutes)}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400 block">Return Deadline Margin</span>
                      <strong
                        className={`text-base ${
                          r.returnDeadlineMarginMinutes >= 60
                            ? 'text-emerald-400'
                            : r.returnDeadlineMarginMinutes >= 0
                            ? 'text-amber-400'
                            : 'text-red-400'
                        }`}
                      >
                        {formatDuration(r.returnDeadlineMarginMinutes)}
                      </strong>
                    </div>
                  </div>

                  {/* Driving Time & Adjustment */}
                  <div className="space-y-2 rounded-xl bg-[#15191F] p-3 text-xs border border-slate-800">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-slate-400 block">Estimated One-Way Drive:</span>
                        <strong className="text-sm text-white">
                          {formatDuration(r.outboundDriveMinutes)}
                        </strong>
                        <span className="text-[10px] text-slate-500 block">
                          (Baseline: {formatDuration(d.baselineOneWayDriveMinutes)} + 20% buffer{adj !== 0 ? ` ${adj > 0 ? `+${adj}` : adj}m adj` : ''})
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => updateAdj(d.id, -15)}
                          disabled={adj <= -60}
                          className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#292F39] text-xs font-bold text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          title="Reduce driving time by 15m"
                        >
                          −15
                        </button>
                        <span className="w-10 text-center text-xs font-bold text-blue-400">
                          {adj > 0 ? `+${adj}m` : adj < 0 ? `${adj}m` : '0m'}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateAdj(d.id, 15)}
                          disabled={adj >= 120}
                          className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#292F39] text-xs font-bold text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          title="Add 15m extra driving buffer"
                        >
                          +15
                        </button>
                      </div>
                    </div>

                    <details className="text-[11px] text-slate-400 pt-1 border-t border-slate-800">
                      <summary className="cursor-pointer text-blue-400 hover:underline">
                        Why adjust driving time? ▼
                      </summary>
                      <p className="mt-1 text-slate-300 leading-relaxed">
                        Baseline driving assumes departure from Central Bengaluru (MG Road). If you're starting from Whitefield or North Bengaluru, add +30m to +45m to reflect city traffic before hitting the highway.
                      </p>
                    </details>
                  </div>

                  {/* Night Curfew Warning if Applicable */}
                  {d.routeRestriction && (
                    <div className="rounded-xl border border-amber-500/30 bg-amber-950/30 p-2.5 text-xs text-amber-200">
                      ⚠️ <strong>Night Curfew:</strong> {d.routeRestriction.name} ({d.routeRestriction.startTime}–{d.routeRestriction.endTime} closure).
                    </div>
                  )}
                </div>

                {/* Action Button */}
                <div className="mt-5 pt-3 border-t border-slate-800">
                  <Link
                    to={`/schedule/${d.id}?${buildShareableParams(d.id, activeInputs).toString()}`}
                    className="block w-full text-center rounded-xl bg-[#2962FF] py-3 text-sm font-bold text-white shadow-md shadow-[#2962FF]/40 hover:bg-blue-600 active:scale-[0.99] transition-all cursor-pointer"
                  >
                    Customize Schedule →
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      {/* Candidate Destinations in Curation Section */}
      <div className="space-y-4 rounded-2xl border border-slate-800 bg-[#20252E] p-5 sm:p-6 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-base font-bold text-white">
              Destinations in Curation ({candidateRecs.length} Upcoming)
            </h2>
            <p className="text-xs text-slate-400">
              Undergoing editorial field verification. Route geometries mapped from Bengaluru; verified schedules coming soon.
            </p>
          </div>
          <span className="rounded-full bg-slate-800 border border-slate-700 px-3 py-1 text-xs font-semibold text-slate-300">
            Field Verification
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {candidateRecs.map(c => (
            <div
              key={c.id}
              className="flex flex-col justify-between rounded-xl border border-slate-800 bg-[#15191F] p-3.5 text-xs space-y-2.5"
            >
              <div>
                <div className="flex items-start justify-between gap-1">
                  <strong className="text-sm font-bold text-white">{c.name}</strong>
                  <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 flex-shrink-0">
                    {c.approxDriveLabel}
                  </span>
                </div>
                <span className="block text-[11px] text-blue-400 mt-0.5">{c.routeName}</span>
                <p className="mt-2 text-slate-300 text-[11px] leading-relaxed">
                  {c.highlights}
                </p>
              </div>

              <div className="pt-2 border-t border-slate-800/80">
                <span className="inline-block rounded-md bg-amber-950/40 border border-amber-500/30 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                  In Curation · Insufficient Verified Data
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
