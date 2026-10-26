import { useState, useMemo, type Dispatch, type SetStateAction } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import type { UserConstraints, PacePreference } from '../types';
import { formatDuration } from '../utils/formatters';
import { getDestinationImage } from '../data/images';
import ProgressBar from '../components/ProgressBar';
import DestinationGuideModal from '../components/DestinationGuideModal';
import { getDestinationGuide } from '../data/destinationGuides';
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
  const [activeGuideId, setActiveGuideId] = useState<string | null>(null);
  const navigate = useNavigate();
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
          <h1 className="text-3xl font-extrabold text-[#193953]">
            Where should we escape to?
          </h1>
          <p className="mt-1 text-sm text-[#5A7184]">
            Intelligent recommendations for your <strong className="text-[#193953]">{numDays} calendar date(s)</strong> ({durationHours} hours). Usable leisure and return margins computed deterministically.
          </p>
        </div>
        <Link to="/plan" className="text-xs font-semibold text-[#176EA8] hover:underline">
          ← Edit dates & budget
        </Link>
      </div>

      {/* Travel Pace Selector (with dynamic explanation) */}
      <div className="rounded-2xl border border-[#E1ECF2] bg-white p-4 sm:p-5 shadow-sm space-y-3">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-[#5A7184]">
            Travel Pace Preference
          </span>
          <p className="text-xs text-[#5A7184] mt-0.5">
            Adjusts allocated duration at attractions, arrival dining times, and morning departure schedules.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {(['relaxed', 'balanced', 'packed'] as const).map(p => {
            const isSelected = activeInputs.pace === p;
            return (
              <button
                key={p}
                type="button"
                onClick={() => handlePaceChange(p)}
                className={`rounded-xl border px-3 py-2.5 text-xs font-bold capitalize transition-all cursor-pointer ${
                  isSelected
                    ? 'border-[#176EA8] bg-[#176EA8] text-white shadow-xs'
                    : 'border-[#E1ECF2] bg-[#F4F9FC] text-[#5A7184] hover:border-slate-300 hover:text-[#193953]'
                }`}
              >
                {p === 'relaxed' ? '🌿 Relaxed' : p === 'balanced' ? '⚖️ Balanced' : '⚡ Packed'}
              </button>
            );
          })}
        </div>

        {/* Dynamic Contextual Pace Explanation Banner */}
        <div className="rounded-xl bg-[#DDF0F6] border border-[#176EA8]/20 p-3 text-xs text-[#193953] leading-relaxed">
          <strong className="text-[#176EA8]">{PACE_EXPLANATIONS[activeInputs.pace].title}:</strong>{' '}
          {PACE_EXPLANATIONS[activeInputs.pace].desc}
        </div>
      </div>

      {/* Verified Destination Comparison Cards (Ranked Deterministically) */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E1ECF2] pb-2">
          <div>
            <h2 className="text-lg font-bold text-[#193953]">
              Verified Weekend Destinations ({verifiedRecs.length} Schedulable)
            </h2>
            <p className="text-xs text-[#5A7184]">
              Ranked dynamically by usable daylight leisure time and comfortable return buffers.
            </p>
          </div>
          <span className="rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-bold text-emerald-800">
            ✓ Deterministic Calculations
          </span>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {verifiedRecs.map(rec => {
            const d = rec.destination!;
            const r = rec.feasibility!;
            const img = getDestinationImage(d.id);
            const adj = getAdj(d.id);

            return (
              <article
                key={d.id}
                className="flex flex-col justify-between rounded-2xl border border-[#E1ECF2] bg-white p-5 shadow-sm transition-all hover:shadow-md"
              >
                <div className="space-y-4">
                  {/* Card Header with Badges */}
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
                        <p className="text-xs text-[#5A7184] mt-0.5">{d.routeName}</p>
                      </div>

                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-bold border ${
                          r.rating === 'Comfortable'
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                            : r.rating === 'Tight'
                            ? 'bg-amber-50 border-amber-200 text-amber-800'
                            : 'bg-red-50 border-red-200 text-red-800'
                        }`}
                      >
                        {r.rating}
                      </span>
                    </div>

                    {rec.whyRecommended && (
                      <p className="mt-2 text-xs font-semibold text-[#176EA8] bg-[#DDF0F6] px-2.5 py-1 rounded-lg">
                        {rec.whyRecommended}
                      </p>
                    )}
                  </div>

                  {/* Destination Photography */}
                  {img && (
                    <div className="relative h-44 w-full overflow-hidden rounded-xl bg-slate-100 shadow-inner">
                      <img
                        src={img.src}
                        alt={img.alt}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
                      />
                      <div className="absolute bottom-2 left-2 rounded-md bg-black/60 backdrop-blur-xs px-2 py-0.5 text-[10px] font-medium text-white">
                        📍 {d.oneWayDistanceKm} km from Bengaluru (MG Road)
                      </div>
                    </div>
                  )}

                  {/* Key Metrics Grid */}
                  <div className="grid grid-cols-2 gap-3 rounded-xl bg-[#F4F9FC] p-3 text-xs border border-[#E1ECF2]">
                    <div>
                      <span className="text-[#5A7184] block">Usable Leisure Time:</span>
                      <strong className="text-base text-[#193953]">
                        {formatDuration(r.destinationSlackMinutes)}
                      </strong>
                    </div>

                    <div>
                      <span className="text-[#5A7184] block">Return Deadline Margin:</span>
                      <strong
                        className={`text-base ${
                          r.returnDeadlineMarginMinutes >= 60
                            ? 'text-emerald-700'
                            : r.returnDeadlineMarginMinutes >= 0
                            ? 'text-amber-700'
                            : 'text-red-700'
                        }`}
                      >
                        {formatDuration(r.returnDeadlineMarginMinutes)}
                      </strong>
                    </div>
                  </div>

                  {/* Driving Time & Adjustment */}
                  <div className="space-y-2 rounded-xl bg-[#F4F9FC] p-3 text-xs border border-[#E1ECF2]">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-[#5A7184] block">Estimated One-Way Drive:</span>
                        <strong className="text-sm text-[#193953]">
                          {formatDuration(r.outboundDriveMinutes)}
                        </strong>
                        <span className="text-[10px] text-[#5A7184] block">
                          (Baseline: {formatDuration(d.baselineOneWayDriveMinutes)} + 20% buffer{adj !== 0 ? ` ${adj > 0 ? `+${adj}` : adj}m adj` : ''})
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => updateAdj(d.id, -15)}
                          disabled={adj <= -60}
                          className="flex h-7 w-7 items-center justify-center rounded-lg bg-white border border-[#E1ECF2] text-xs font-bold text-[#193953] hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                          title="Reduce driving time by 15m"
                        >
                          −15
                        </button>
                        <span className="w-10 text-center text-xs font-bold text-[#176EA8]">
                          {adj > 0 ? `+${adj}m` : adj < 0 ? `${adj}m` : '0m'}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateAdj(d.id, 15)}
                          disabled={adj >= 120}
                          className="flex h-7 w-7 items-center justify-center rounded-lg bg-white border border-[#E1ECF2] text-xs font-bold text-[#193953] hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                          title="Add 15m extra driving buffer"
                        >
                          +15
                        </button>
                      </div>
                    </div>

                    <details className="text-[11px] text-[#5A7184] pt-1 border-t border-[#E1ECF2]">
                      <summary className="cursor-pointer text-[#176EA8] hover:underline">
                        Why adjust driving time? ▼
                      </summary>
                      <p className="mt-1 text-[#5A7184] leading-relaxed">
                        Baseline driving assumes departure from Central Bengaluru (MG Road). If you're starting from Whitefield or North Bengaluru, add +30m to +45m to reflect city traffic before hitting the highway.
                      </p>
                    </details>
                  </div>

                  {/* Night Curfew Warning if Applicable */}
                  {d.routeRestriction && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800">
                      ⚠️ <strong>Night Curfew:</strong> {d.routeRestriction.name} ({d.routeRestriction.startTime}–{d.routeRestriction.endTime} closure).
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

      {/* More escapes to explore Section (Gate 3 & Gate 4) */}
      <div className="space-y-5 rounded-2xl border border-[#E1ECF2] bg-white p-5 sm:p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E1ECF2] pb-3">
          <div>
            <h2 className="text-lg font-bold text-[#193953]">
              More escapes to explore
            </h2>
            <p className="text-xs text-[#5A7184] mt-0.5">
              Discover scenic drives, heritage towns, hill stations and coastal getaways worth adding to your next trip.
            </p>
          </div>
          <span className="rounded-full bg-[#DDF0F6] border border-[#BAE3F1] px-3 py-1 text-xs font-bold text-[#176EA8]">
            {candidateRecs.length} Curated Escapes
          </span>
        </div>

        {/* Responsive Grid of Destination Inspiration Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
          {candidateRecs.map(c => {
            const img = getDestinationImage(c.id);
            const guide = getDestinationGuide(c.id, numDays, activeInputs.pace);

            return (
              <div
                key={c.id}
                className="flex flex-col justify-between rounded-2xl border border-[#E1ECF2] bg-[#F4F9FC]/70 p-4 transition-all hover:bg-white hover:border-[#BAE3F1] hover:shadow-sm"
              >
                <div className="space-y-3">
                  {/* Photo thumbnail */}
                  {img && (
                    <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl bg-slate-100 shadow-inner">
                      <img
                        src={img.src}
                        alt={img.alt}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
                      />
                      <div className="absolute top-2.5 right-2.5 rounded-full bg-black/60 backdrop-blur-xs px-2.5 py-0.5 text-[10px] font-semibold text-white">
                        {c.approxDriveLabel} drive
                      </div>
                      <div className="absolute bottom-2 left-2 rounded-md bg-black/60 backdrop-blur-xs px-2 py-0.5 text-[9px] font-medium text-white/90">
                        Photo: {img.author}
                      </div>
                    </div>
                  )}

                  {/* Header info */}
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-base font-bold text-[#193953]">{c.name}</h3>
                      <span className="rounded-full bg-[#DDF0F6] border border-[#BAE3F1] px-2 py-0.5 text-[10px] font-bold text-[#176EA8] whitespace-nowrap">
                        {guide.idealDuration}
                      </span>
                    </div>
                    <p className="text-xs text-[#5A7184] mt-0.5">{c.routeName}</p>
                  </div>

                  {/* Highlights / Why Go */}
                  <p className="text-xs text-[#193953] leading-relaxed font-medium">
                    {c.highlights}
                  </p>

                  {/* Friendly status badge */}
                  <div>
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-[#E1ECF2] px-2.5 py-1 text-[11px] font-semibold text-[#5A7184]">
                      <span className="h-2 w-2 rounded-full bg-[#FF9870]" />
                      Trip inspiration — Detailed scheduling not yet available
                    </span>
                  </div>

                  {/* Honest drive estimate disclaimer */}
                  <p className="text-[10px] text-[#5A7184] leading-relaxed italic border-t border-[#E1ECF2] pt-2">
                    * ~{c.approxDriveLabel} from Bengaluru depending on traffic and route conditions.
                  </p>
                </div>

                {/* Explore Guide Button */}
                <div className="mt-4 pt-3 border-t border-[#E1ECF2]">
                  <button
                    type="button"
                    onClick={() => setActiveGuideId(c.id)}
                    className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-[#BAE3F1] bg-white py-2 text-xs font-bold text-[#176EA8] hover:bg-[#DDF0F6] active:scale-[0.99] transition-all cursor-pointer shadow-2xs"
                  >
                    <span>Explore Guide</span>
                    <span>→</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Destination Guide Modal (Gates 3 & 5) */}
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
