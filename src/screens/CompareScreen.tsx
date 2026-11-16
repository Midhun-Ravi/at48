import { useState, useMemo, type Dispatch, type SetStateAction } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import type { UserConstraints, PacePreference } from '../types';
import { formatDuration, formatReadableDateTime } from '../utils/formatters';
import { getDestinationImage } from '../data/images';
import ProgressBar from '../components/ProgressBar';
import DestinationGuideModal from '../components/DestinationGuideModal';
import { getDestinationGuide } from '../data/destinationGuides';
import { getCalendarDaysCount, parseIST, evaluateFeasibility } from '../engine/scheduler';
import { getDestinationRecommendations } from '../engine/recommendations';
import { buildShareableParams } from '../utils/tripShare';

type Props = { inputs: UserConstraints; setInputs: Dispatch<SetStateAction<UserConstraints>> };

export default function CompareScreen({ inputs, setInputs }: Props) {
  const [activeGuideId, setActiveGuideId] = useState<string | null>(null);
  const navigate = useNavigate();
  const adjustments = inputs.destinationAdjustments ?? {};
  const getAdj = (destId: string) => adjustments[destId] ?? 0;

  const setExactAdj = (destId: string, value: number) => {
    const next = Math.max(-60, Math.min(120, value));
    setInputs(prev => ({
      ...prev,
      destinationAdjustments: {
        ...(prev.destinationAdjustments ?? {}),
        [destId]: next,
      },
    }));
  };

  const updateAdj = (destId: string, delta: number) => {
    const current = getAdj(destId);
    setExactAdj(destId, current + delta);
  };

  const [searchParams] = useSearchParams();

  // If query params are present, defensively merge into activeInputs
  const activeInputs = useMemo<UserConstraints>(() => {
    const dep = searchParams.get('dep');
    const ret = searchParams.get('ret');
    if (!dep || !ret) {
      return {
        ...inputs,
        pace: inputs.pace || 'balanced',
      };
    }

    const party = parseInt(searchParams.get('party') || '', 10);
    const budget = parseInt(searchParams.get('budget') || '', 10);
    const rawPace = searchParams.get('pace');
    const pace = rawPace === 'relaxed' || rawPace === 'packed' || rawPace === 'balanced' ? rawPace : (inputs.pace || 'balanced');

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
  // GATE 2: Show only the 4 destinations that support complete feasibility calculations
  const verifiedRecs = allRecommendations.filter(r => r.isVerified && r.destination && r.feasibility);

  return (
    <section className="space-y-6">
      {/* 4-part segmented progress meter */}
      <ProgressBar currentStep={2} />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-[#193953]">
            Can your trip fit before the deadline?
          </h1>
          <p className="mt-1 text-sm text-[#5A7184]">
            Deterministic feasibility calculations for your <strong className="text-[#193953]">{numDays} calendar date(s)</strong> ({durationHours} hours). Evaluated against Bangalore traffic buffers and return deadlines.
          </p>
        </div>
        <Link to="/plan" className="text-xs font-semibold text-[#176EA8] hover:underline">
          ← Edit dates & budget
        </Link>
      </div>

      {/* Verified Destination Feasibility Cards (Gate 2: Exclusively the 4 schedulable destinations) */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E1ECF2] pb-2">
          <div>
            <h2 className="text-lg font-bold text-[#193953]">
              Weekend Trip Feasibility ({verifiedRecs.length} Destinations)
            </h2>
            <p className="text-xs text-[#5A7184]">
              Prioritized by return deadline safety margin, usable daylight leisure time, and route curfew constraints.
            </p>
          </div>
          <span className="rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-bold text-emerald-800">
            ✓ Deterministic Reality Check
          </span>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {verifiedRecs.map(rec => {
            const d = rec.destination!;
            const r = rec.feasibility!;
            const img = getDestinationImage(d.id);
            const adj = getAdj(d.id);

            // Calculate baseline feasibility (0 driving adjustment) to show clear before/after trade-offs
            const baseFeasibility = adj !== 0
              ? evaluateFeasibility(d, { ...activeInputs, drivingAdjustmentMinutes: 0 })
              : r;

            return (
              <article
                key={d.id}
                className="flex flex-col justify-between rounded-2xl border border-[#E1ECF2] bg-white p-5 shadow-sm transition-all hover:shadow-md space-y-4"
              >
                <div className="space-y-4">
                  {/* Card Header & Feasibility Verdict (Hero Question 1: Can I complete this trip?) */}
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-xl font-black text-[#193953]">{d.name}</h3>
                          {rec.tierLabel && (
                            <span className="rounded-md bg-[#176EA8] text-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                              {rec.tierLabel}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[#5A7184] mt-0.5">
                          📍 {d.oneWayDistanceKm} km · {d.routeName}
                        </p>
                      </div>

                      {/* Prominent Feasibility Verdict Badge */}
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-extrabold border shadow-2xs ${
                          r.rating === 'Comfortable'
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                            : r.rating === 'Tight'
                            ? 'bg-amber-50 border-amber-300 text-amber-800'
                            : 'bg-red-50 border-red-300 text-red-800'
                        }`}
                      >
                        <span>{r.rating === 'Comfortable' ? '✓' : r.rating === 'Tight' ? '⚠️' : '❌'}</span>
                        <span>{r.rating === 'Comfortable' ? 'Comfortable' : r.rating === 'Tight' ? 'Tight Schedule' : 'Not Recommended'}</span>
                      </span>
                    </div>

                    {rec.whyRecommended && (
                      <p className="mt-2 text-xs font-medium text-[#176EA8] bg-[#DDF0F6] px-2.5 py-1.5 rounded-lg leading-relaxed">
                        {rec.whyRecommended}
                      </p>
                    )}
                  </div>

                  {/* Destination Photography */}
                  {img && (
                    <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl bg-slate-100 shadow-inner">
                      <img
                        src={img.src}
                        alt={img.alt}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
                      />
                      <div className="absolute top-2.5 right-2.5 rounded-full bg-black/60 backdrop-blur-xs px-2.5 py-0.5 text-[10px] font-semibold text-white">
                        ~{formatDuration(r.outboundDriveMinutes)} drive each way
                      </div>
                      <div className="absolute bottom-2 left-2 rounded-md bg-black/60 backdrop-blur-xs px-2 py-0.5 text-[9px] font-medium text-white/90">
                        Photo: {img.author}
                      </div>
                    </div>
                  )}

                  {/* HERO METRIC 1: Will I return before my deadline? (Gate 3) */}
                  <div
                    className={`rounded-xl border p-3.5 space-y-1.5 transition-colors ${
                      r.returnDeadlineMarginMinutes >= 60
                        ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                        : r.returnDeadlineMarginMinutes >= 0
                        ? 'bg-amber-50/80 border-amber-200 text-amber-950'
                        : 'bg-red-50/80 border-red-200 text-red-950'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#5A7184]">
                        Will I return before my deadline?
                      </span>
                      <strong
                        className={`text-base font-black ${
                          r.returnDeadlineMarginMinutes >= 60
                            ? 'text-emerald-700'
                            : r.returnDeadlineMarginMinutes >= 0
                            ? 'text-amber-700'
                            : 'text-red-700'
                        }`}
                      >
                        {r.returnDeadlineMarginMinutes >= 0
                          ? `+${formatDuration(r.returnDeadlineMarginMinutes)} margin`
                          : `−${formatDuration(Math.abs(r.returnDeadlineMarginMinutes))} projected late`}
                      </strong>
                    </div>

                    {/* Clear, explicit explanation of positive and negative return margins */}
                    <p className="text-xs leading-relaxed font-medium">
                      {r.returnDeadlineMarginMinutes >= 60 ? (
                        <>
                          <strong className="text-emerald-800">✓ Safe return buffer:</strong> You arrive back in Bengaluru around{' '}
                          <strong>{formatReadableDateTime(r.homeArrivalTime)}</strong>, comfortably ahead of your{' '}
                          <strong>{formatReadableDateTime(activeInputs.returnDeadlineDateTime)}</strong> return deadline.
                        </>
                      ) : r.returnDeadlineMarginMinutes >= 0 ? (
                        <>
                          <strong className="text-amber-800">⚠️ Narrow buffer:</strong> You arrive back in Bengaluru around{' '}
                          <strong>{formatReadableDateTime(r.homeArrivalTime)}</strong>, leaving only{' '}
                          <strong>{formatDuration(r.returnDeadlineMarginMinutes)}</strong> before your deadline. Highway slowdowns risk arriving late.
                        </>
                      ) : (
                        <>
                          <strong className="text-red-800">❌ Return deadline missed by {formatDuration(Math.abs(r.returnDeadlineMarginMinutes))}:</strong> Expected return arrival is{' '}
                          <strong>{formatReadableDateTime(r.homeArrivalTime)}</strong>, which exceeds your{' '}
                          <strong>{formatReadableDateTime(activeInputs.returnDeadlineDateTime)}</strong> return deadline. You need an earlier departure or later deadline.
                        </>
                      )}
                    </p>
                  </div>

                  {/* HERO METRIC 2: How much time can I enjoy at the destination? (Gate 3) */}
                  <div className="grid grid-cols-2 gap-3 rounded-xl bg-[#F4F9FC] p-3 text-xs border border-[#E1ECF2]">
                    <div>
                      <span className="text-[#5A7184] block font-medium">Usable Destination Leisure Time:</span>
                      <strong className="text-lg font-black text-[#193953] block">
                        {formatDuration(r.destinationSlackMinutes)}
                      </strong>
                      <span className="text-[11px] text-[#5A7184] block mt-0.5">
                        Daylight hours for sightseeing & relaxation
                      </span>
                    </div>

                    <div>
                      <span className="text-[#5A7184] block font-medium">Journey Windows:</span>
                      <span className="text-xs font-semibold text-[#193953] block">
                        Depart: {formatReadableDateTime(activeInputs.departureDateTime)}
                      </span>
                      <span className="text-xs font-semibold text-[#193953] block">
                        Return: {formatReadableDateTime(r.homeArrivalTime)}
                      </span>
                      <span className="text-[11px] text-[#5A7184] block mt-0.5">
                        Est. Cost: ₹{r.estimatedCostPerPersonINR.toLocaleString('en-IN')}/person
                      </span>
                    </div>
                  </div>

                  {/* GATE 4: What if the drive takes longer? (Driving-delay trade-offs) */}
                  <div className="rounded-xl border border-[#BAE3F1] bg-[#DDF0F6]/50 p-4 space-y-3 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-1">
                      <div>
                        <h4 className="font-bold text-[#193953] text-sm">
                          What if the drive takes longer?
                        </h4>
                        <p className="text-[11px] text-[#5A7184] mt-0.5">
                          Add extra travel time to see how it affects your itinerary and return deadline.
                        </p>
                      </div>
                      <span className="rounded-full bg-white border border-[#BAE3F1] px-2 py-0.5 text-[10px] font-semibold text-[#176EA8]">
                        Planning scenario · Not live GPS
                      </span>
                    </div>

                    {/* Manual Driving Allowance Controls & Presets */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <span className="text-[11px] font-bold text-[#193953]">Extra travel allowance:</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => updateAdj(d.id, -15)}
                          disabled={adj <= -60}
                          className="h-7 w-7 rounded-lg bg-white border border-[#E1ECF2] text-xs font-bold text-[#193953] hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                          title="Reduce allowance by 15m"
                        >
                          −15
                        </button>
                        <span className="min-w-12 text-center text-xs font-extrabold text-[#176EA8]">
                          {adj > 0 ? `+${adj}m` : adj < 0 ? `${adj}m` : '0m'}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateAdj(d.id, 15)}
                          disabled={adj >= 120}
                          className="h-7 w-7 rounded-lg bg-white border border-[#E1ECF2] text-xs font-bold text-[#193953] hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                          title="Add 15m delay allowance"
                        >
                          +15
                        </button>
                      </div>

                      {/* Quick Scenario Presets */}
                      <div className="flex items-center gap-1.5 ml-auto">
                        {([0, 30, 45, 60] as const).map(preset => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setExactAdj(d.id, preset)}
                            className={`rounded-lg px-2.5 py-1 text-[11px] font-bold cursor-pointer transition-colors ${
                              adj === preset
                                ? 'bg-[#176EA8] text-white shadow-xs'
                                : 'bg-white border border-[#BAE3F1] text-[#193953] hover:bg-slate-100'
                            }`}
                          >
                            {preset === 0 ? 'Baseline' : `+${preset}m`}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Before & After Trade-Off Impact Display (Gate 4 & Gate 9) */}
                    {adj !== 0 ? (
                      <div className="rounded-lg bg-white border border-[#BAE3F1] p-3 space-y-2 text-[11px]">
                        <div className="flex items-center justify-between font-bold text-[#176EA8]">
                          <span>Trade-Off Impact of {adj > 0 ? `+${adj}m delay scenario` : `${adj}m shorter drive`}:</span>
                          {baseFeasibility.rating !== r.rating && (
                            <span className="text-red-700 font-extrabold">
                              ⚠️ Verdict shifts: {baseFeasibility.rating} → {r.rating}
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="bg-[#F4F9FC] p-2 rounded-lg border border-[#E1ECF2]">
                            <span className="block text-[#5A7184] text-[10px]">One-Way Drive</span>
                            <span className="font-extrabold text-[#193953]">
                              {formatDuration(baseFeasibility.outboundDriveMinutes)} → {formatDuration(r.outboundDriveMinutes)}
                            </span>
                          </div>
                          <div className="bg-[#F4F9FC] p-2 rounded-lg border border-[#E1ECF2]">
                            <span className="block text-[#5A7184] text-[10px]">Leisure Time</span>
                            <span className="font-extrabold text-[#193953]">
                              {formatDuration(baseFeasibility.destinationSlackMinutes)} → {formatDuration(r.destinationSlackMinutes)}
                            </span>
                          </div>
                          <div className="bg-[#F4F9FC] p-2 rounded-lg border border-[#E1ECF2]">
                            <span className="block text-[#5A7184] text-[10px]">Return Margin</span>
                            <span
                              className={`font-extrabold ${
                                r.returnDeadlineMarginMinutes >= 60
                                  ? 'text-emerald-700'
                                  : r.returnDeadlineMarginMinutes >= 0
                                  ? 'text-amber-700'
                                  : 'text-red-700'
                              }`}
                            >
                              {formatDuration(baseFeasibility.returnDeadlineMarginMinutes, true)} → {formatDuration(r.returnDeadlineMarginMinutes, true)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-[11px] text-[#5A7184] leading-relaxed">
                        Currently showing baseline calculation with standard 20% highway traffic buffer included. Select +30m or +45m above to test how highway delays impact your return deadline.
                      </p>
                    )}
                  </div>

                  {/* Night Curfew Warning if Applicable */}
                  {d.routeRestriction && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800">
                      ⚠️ <strong>Night Curfew:</strong> {d.routeRestriction.name} ({d.routeRestriction.startTime}–{d.routeRestriction.endTime} closure). Transit through reserve must clear before 21:00.
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="mt-5 pt-3 border-t border-[#E1ECF2] flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveGuideId(d.id)}
                    className="rounded-xl border border-[#BAE3F1] bg-[#DDF0F6] px-4 py-2.5 text-xs font-bold text-[#176EA8] hover:bg-[#cbe8f3] transition-colors cursor-pointer"
                  >
                    Explore Guide 📖
                  </button>
                  <Link
                    to={`/schedule/${d.id}?${buildShareableParams(d.id, activeInputs).toString()}`}
                    className="flex-1 text-center rounded-xl bg-[#176EA8] py-2.5 px-4 text-xs font-bold text-white shadow-xs hover:bg-[#135a8a] active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center"
                  >
                    Customize Schedule →
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      {/* Destination Guide Modal (Preserved for the 4 verified destinations) */}
      <DestinationGuideModal
        guide={activeGuideId ? getDestinationGuide(activeGuideId, numDays, activeInputs.pace) : null}
        onClose={() => setActiveGuideId(null)}
        onSelectDestination={destId => {
          setActiveGuideId(null);
          navigate(`/schedule/${destId}?${buildShareableParams(destId, activeInputs).toString()}`);
        }}
      />
    </section>
  );
}
