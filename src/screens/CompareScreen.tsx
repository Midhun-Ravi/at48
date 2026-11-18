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
import TactileButton from '../components/ui/TactileButton';
import ScenicBackground from '../components/scenic/ScenicBackground';

type Props = { inputs: UserConstraints; setInputs: Dispatch<SetStateAction<UserConstraints>> };

interface WhyModalData {
  dest: any;
  feasibility: any;
  baseFeasibility: any;
  adj: number;
}

export default function CompareScreen({ inputs, setInputs }: Props) {
  const [activeGuideId, setActiveGuideId] = useState<string | null>(null);
  const [whyModalData, setWhyModalData] = useState<WhyModalData | null>(null);
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
      partySize: !isNaN(party) && party >= 1 ? party : inputs.partySize,
      perPersonBudgetINR: !isNaN(budget) && budget >= 0 ? budget : inputs.perPersonBudgetINR,
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
    <section className="relative space-y-6 w-full min-w-0">
      {/* 4-part segmented progress meter */}
      <ProgressBar currentStep={2} />

      {/* Screen Hero Banner with Warm Scenic Layers */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-b from-[#F8E1D2]/50 via-[#FAF2EB] to-[#FFF7F0] p-4 sm:p-6 border border-[#EADBCE]">
        <ScenicBackground variant="compact" />
        <div className="relative z-10 flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[11px] font-bold text-[#C65B32] border border-[#EADBCE] shadow-2xs">
              <span className="h-1.5 w-1.5 rounded-full bg-[#C65B32]" />
              Step 2 · Destination Chooser
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-[#344F48] tracking-tight leading-snug">
              Can your trip fit before the deadline?
            </h1>
            <p className="text-xs sm:text-sm text-[#6B7C77] max-w-2xl leading-relaxed">
              Deterministic feasibility calculations for your <strong className="text-[#344F48]">{numDays} calendar date(s)</strong> ({durationHours} hours).
              We calculate return buffers, daylight leisure, and toll traffic for Bengaluru weekend corridors.
            </p>
          </div>
          <Link
            to="/plan"
            className="text-xs font-bold text-[#C65B32] hover:text-[#B04E27] hover:underline transition-colors flex items-center gap-1"
          >
            ← Edit dates & limits
          </Link>
        </div>
      </div>

      {/* Comparison Grid Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#EADBCE] pb-2.5">
        <div>
          <h2 className="text-base sm:text-lg font-black text-[#344F48]">
            Weekend Escapes ({verifiedRecs.length} Corridors Evaluated)
          </h2>
          <p className="text-xs text-[#6B7C77]">
            Ranked by return deadline safety margin, usable daylight leisure, and route curfews.
          </p>
        </div>
        <span className="rounded-full bg-[#FAF2EB] border border-[#EADBCE] px-3 py-1 text-xs font-bold text-[#5F7B6B]">
          ✓ Deterministic Reality Check
        </span>
      </div>

      {/* 2-Column Desktop / 1-Column Mobile Comparison Grid */}
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

          const baseDriveMinutes = d.baselineOneWayDriveMinutes;
          const trafficBufferMinutes = Math.round(baseDriveMinutes * 0.20);
          const totalOneWayMinutes = r.outboundDriveMinutes;

          // Distinguish daylight sightseeing from evening leisure
          const totalSlack = r.destinationSlackMinutes;
          const daylightMins = Math.min(totalSlack, Math.round(totalSlack * 0.72));
          const eveningMins = Math.max(0, totalSlack - daylightMins);

          const isComfortable = r.rating === 'Comfortable';
          const isTight = r.rating === 'Tight';

          return (
            <article
              key={d.id}
              className="group flex flex-col justify-between rounded-2xl sm:rounded-3xl border border-[#EADBCE] bg-white overflow-hidden shadow-xs hover:shadow-lg hover:border-[#C65B32]/40 transition-all duration-300"
            >
              <div>
                {/* Destination Photo Header */}
                <div className="relative h-48 sm:h-56 w-full overflow-hidden bg-slate-100">
                  {img && (
                    <img
                      src={img.src}
                      alt={img.alt}
                      loading="lazy"
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10" />

                  {/* Feasibility Pill Badge */}
                  <div className="absolute top-3 left-3">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black uppercase tracking-wider shadow-sm backdrop-blur-md ${
                        isComfortable
                          ? 'bg-emerald-600/95 text-white'
                          : isTight
                          ? 'bg-amber-600/95 text-white'
                          : 'bg-rose-600/95 text-white'
                      }`}
                    >
                      <span>{isComfortable ? '✓' : isTight ? '⚠️' : '✕'}</span>
                      <span>{isComfortable ? 'Comfortable' : isTight ? 'Tight Schedule' : 'Not Recommended'}</span>
                    </span>
                  </div>

                  {/* Verified Photo Attribution */}
                  {img && (
                    <div className="absolute top-3 right-3">
                      <span className="rounded-full bg-black/60 backdrop-blur-md px-2.5 py-1 text-[10px] font-medium text-white/90">
                        📷 {img.author}
                      </span>
                    </div>
                  )}

                  {/* Destination Title & Corridor Info */}
                  <div className="absolute bottom-3 left-4 right-4 text-white">
                    <div className="flex items-baseline gap-2">
                      <h3 className="text-xl sm:text-2xl font-black tracking-tight drop-shadow-xs">{d.name}</h3>
                      {rec.tierLabel && (
                        <span className="text-[10px] font-bold text-[#F8E1D2] uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-full backdrop-blur-xs">
                          {rec.tierLabel}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-white/90 line-clamp-1 mt-0.5">
                      📍 {d.oneWayDistanceKm} km via {d.routeName}
                    </p>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-4 sm:p-5 space-y-4">
                  {/* Editorial Why Recommended Chip */}
                  {rec.whyRecommended && (
                    <p className="text-xs font-semibold text-[#344F48] bg-[#FAF2EB] border border-[#EADBCE] px-3 py-2 rounded-xl leading-relaxed">
                      💡 {rec.whyRecommended}
                    </p>
                  )}

                  {/* 3-Column Core Metrics Bar */}
                  <div className="grid grid-cols-3 gap-2 text-center bg-[#FAF2EB] p-3 rounded-xl sm:rounded-2xl border border-[#EADBCE]">
                    {/* Metric 1: Est. Drive */}
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B7C77]">
                        Est. Drive
                      </span>
                      <div className="text-sm sm:text-base font-black text-[#344F48]">
                        {formatDuration(totalOneWayMinutes)}
                      </div>
                      <span className="text-[10px] text-[#6B7C77] block">
                        each way (+20% traffic)
                      </span>
                    </div>

                    {/* Metric 2: Usable Daylight */}
                    <div className="space-y-0.5 border-x border-[#EADBCE] px-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B7C77]">
                        Usable Daylight
                      </span>
                      <div className="text-sm sm:text-base font-black text-[#C65B32]">
                        {formatDuration(daylightMins)}
                      </div>
                      <span className="text-[10px] text-[#6B7C77] block">
                        +{formatDuration(eveningMins)} evening
                      </span>
                    </div>

                    {/* Metric 3: Return Margin */}
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B7C77]">
                        Return Margin
                      </span>
                      <div
                        className={`text-sm sm:text-base font-black ${
                          r.returnDeadlineMarginMinutes >= 60
                            ? 'text-emerald-700'
                            : r.returnDeadlineMarginMinutes >= 0
                            ? 'text-amber-700'
                            : 'text-rose-700'
                        }`}
                      >
                        {r.returnDeadlineMarginMinutes >= 0
                          ? `+${formatDuration(r.returnDeadlineMarginMinutes)}`
                          : `−${formatDuration(Math.abs(r.returnDeadlineMarginMinutes))}`}
                      </div>
                      <span className="text-[10px] text-[#6B7C77] block">
                        {r.returnDeadlineMarginMinutes >= 60
                          ? 'Safe return buffer'
                          : r.returnDeadlineMarginMinutes >= 0
                          ? 'Narrow margin'
                          : 'projected late'}
                      </span>
                    </div>
                  </div>

                  {/* HERO METRIC 1: Will I return before my deadline? */}
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
                      <span className="text-xs font-bold uppercase tracking-wider text-[#6B7C77]">
                        Will I return before my deadline?
                      </span>
                      <strong
                        className={`text-sm sm:text-base font-black ${
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

                  {/* HERO METRIC 2: Usable Destination Leisure Time */}
                  <div className="grid grid-cols-2 gap-3 rounded-xl bg-[#FAF2EB] p-3 text-xs border border-[#EADBCE]">
                    <div>
                      <span className="text-[#6B7C77] block font-medium">Usable Destination Leisure Time:</span>
                      <strong className="text-base sm:text-lg font-black text-[#344F48] block">
                        {formatDuration(r.destinationSlackMinutes)}
                      </strong>
                      <span className="text-[11px] text-[#6B7C77] block mt-0.5">
                        Daylight sightseeing & evening relaxation
                      </span>
                    </div>

                    <div>
                      <span className="text-[#6B7C77] block font-medium">Journey Windows:</span>
                      <span className="text-xs font-semibold text-[#344F48] block">
                        Depart: {formatReadableDateTime(activeInputs.departureDateTime)}
                      </span>
                      <span className="text-xs font-semibold text-[#344F48] block">
                        Return: {formatReadableDateTime(r.homeArrivalTime)}
                      </span>
                      <span className="text-[11px] text-[#6B7C77] block mt-0.5">
                        Est. Cost: ₹{r.estimatedCostPerPersonINR.toLocaleString('en-IN')}/person
                      </span>
                    </div>
                  </div>

                  {/* 20% Highway Traffic Buffer Explanation */}
                  <div className="rounded-xl border border-[#EADBCE] bg-white p-3 text-xs space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-bold text-[#344F48]">
                      <span>Drive Breakdown (One Way):</span>
                      <span className="text-[#C65B32]">
                        {formatDuration(baseDriveMinutes)} base + {formatDuration(trafficBufferMinutes)} traffic buffer
                      </span>
                    </div>
                    <p className="text-[11px] text-[#6B7C77] leading-relaxed">
                      Includes 20% traffic contingency buffer to account for NICE Road toll plaza queues, highway construction, and weekend outbound congestion.
                    </p>
                  </div>

                  {/* Delay Scenarios: What if the drive takes longer? */}
                  <div className="rounded-xl border border-[#EADBCE] bg-[#FAF2EB]/70 p-3.5 space-y-3 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-1">
                      <div>
                        <h4 className="font-bold text-[#344F48] text-xs sm:text-sm">
                          What if the drive takes longer?
                        </h4>
                        <p className="text-[11px] text-[#6B7C77] mt-0.5">
                          Add extra travel time to see how it affects your itinerary and return deadline.
                        </p>
                      </div>
                      <span className="rounded-full bg-white border border-[#EADBCE] px-2 py-0.5 text-[10px] font-semibold text-[#344F48]">
                        Planning scenario · Not live GPS
                      </span>
                    </div>

                    {/* Manual Driving Allowance Controls & Presets */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <span className="text-[11px] font-bold text-[#344F48]">Extra travel allowance:</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => updateAdj(d.id, -15)}
                          disabled={adj <= -60}
                          className="h-7 w-7 rounded-lg bg-white border border-[#EADBCE] text-xs font-bold text-[#344F48] hover:bg-[#F8E1D2] disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                          title="Reduce allowance by 15m"
                        >
                          −15
                        </button>
                        <span className="min-w-12 text-center text-xs font-extrabold text-[#C65B32]">
                          {adj > 0 ? `+${adj}m` : adj < 0 ? `${adj}m` : '0m'}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateAdj(d.id, 15)}
                          disabled={adj >= 120}
                          className="h-7 w-7 rounded-lg bg-white border border-[#EADBCE] text-xs font-bold text-[#344F48] hover:bg-[#F8E1D2] disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
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
                                ? 'bg-[#C65B32] text-white shadow-xs'
                                : 'bg-white border border-[#EADBCE] text-[#344F48] hover:bg-[#FAF2EB]'
                            }`}
                          >
                            {preset === 0 ? 'Baseline' : `+${preset}m`}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Before & After Trade-Off Impact Display */}
                    {adj !== 0 ? (
                      <div className="rounded-lg bg-white border border-[#EADBCE] p-3 space-y-2 text-[11px]">
                        <div className="flex items-center justify-between font-bold text-[#C65B32]">
                          <span>Trade-Off Impact of {adj > 0 ? `+${adj}m delay scenario` : `${adj}m shorter drive`}:</span>
                          {baseFeasibility.rating !== r.rating && (
                            <span className="text-red-700 font-extrabold">
                              ⚠️ Verdict shifts: {baseFeasibility.rating} → {r.rating}
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="bg-[#FAF2EB] p-2 rounded-lg border border-[#EADBCE]">
                            <span className="block text-[#6B7C77] text-[10px]">One-Way Drive</span>
                            <span className="font-extrabold text-[#344F48]">
                              {formatDuration(baseFeasibility.outboundDriveMinutes)} → {formatDuration(r.outboundDriveMinutes)}
                            </span>
                          </div>
                          <div className="bg-[#FAF2EB] p-2 rounded-lg border border-[#EADBCE]">
                            <span className="block text-[#6B7C77] text-[10px]">Leisure Time</span>
                            <span className="font-extrabold text-[#344F48]">
                              {formatDuration(baseFeasibility.destinationSlackMinutes)} → {formatDuration(r.destinationSlackMinutes)}
                            </span>
                          </div>
                          <div className="bg-[#FAF2EB] p-2 rounded-lg border border-[#EADBCE]">
                            <span className="block text-[#6B7C77] text-[10px]">Return Margin</span>
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
                      <p className="text-[11px] text-[#6B7C77] leading-relaxed">
                        Currently showing baseline calculation with standard 20% highway traffic buffer included. Select +30m or +45m above to test how highway delays impact your return deadline.
                      </p>
                    )}
                  </div>

                  {/* Route Restriction / Curfew Warning */}
                  {d.routeRestriction && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800">
                      ⚠️ <strong>Night Curfew:</strong> {d.routeRestriction.name} ({d.routeRestriction.startTime}–{d.routeRestriction.endTime} closure). Transit through reserve must clear before 21:00.
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons Row */}
              <div className="p-4 sm:p-5 pt-0 mt-2 border-t border-[#EADBCE] flex flex-col sm:flex-row items-center gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setWhyModalData({ dest: d, feasibility: r, baseFeasibility, adj })}
                  className="w-full sm:w-auto text-xs font-bold text-[#6B7C77] hover:text-[#C65B32] flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-[#EADBCE] hover:bg-[#FAF2EB] transition-colors"
                >
                  <span>Why this result?</span>
                  <span className="text-xs">ℹ️</span>
                </button>

                <TactileButton
                  variant="secondary"
                  size="sm"
                  onClick={() => setActiveGuideId(d.id)}
                  className="w-full sm:w-auto justify-center"
                >
                  Explore Guide 📖
                </TactileButton>

                <TactileButton
                  variant="primary"
                  size="sm"
                  to={`/schedule/${d.id}?${buildShareableParams(d.id, activeInputs).toString()}`}
                  className="w-full sm:flex-1 justify-center text-xs"
                >
                  Select & Build Itinerary →
                </TactileButton>
              </div>
            </article>
          );
        })}
      </div>

      {/* "Why this result?" Mathematical Breakdown Modal */}
      {whyModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-2xl sm:rounded-3xl bg-white p-5 sm:p-6 shadow-2xl border border-[#EADBCE] space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-[#EADBCE] pb-3">
              <div>
                <span className="text-[10px] font-bold text-[#C65B32] uppercase tracking-wider">
                  Deterministic Feasibility Breakdown
                </span>
                <h3 className="text-lg sm:text-xl font-black text-[#344F48]">
                  Why {whyModalData.dest.name} is rated "{whyModalData.feasibility.rating}"
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setWhyModalData(null)}
                className="rounded-full h-8 w-8 flex items-center justify-center bg-[#FAF2EB] text-[#344F48] hover:bg-[#F8E1D2] font-black text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3.5 text-xs text-[#344F48]">
              {/* Checkpoint Timeline */}
              <div className="rounded-xl bg-[#FAF2EB] p-3.5 space-y-2 border border-[#EADBCE]">
                <span className="font-black text-[#344F48] block uppercase tracking-wider text-[10px]">
                  Simulated Itinerary Checkpoints
                </span>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-[#6B7C77] block">Outbound Departure:</span>
                    <strong>{formatReadableDateTime(activeInputs.departureDateTime)}</strong>
                  </div>
                  <div>
                    <span className="text-[#6B7C77] block">Destination Arrival:</span>
                    <strong>{formatReadableDateTime(whyModalData.feasibility.destinationArrivalDay1Time || whyModalData.feasibility.homeArrivalTime)}</strong>
                  </div>
                  <div>
                    <span className="text-[#6B7C77] block">Return Departure:</span>
                    <strong>{formatReadableDateTime(whyModalData.feasibility.inboundDepartureTime || whyModalData.feasibility.homeArrivalTime)}</strong>
                  </div>
                  <div>
                    <span className="text-[#6B7C77] block">Home Arrival (MG Road):</span>
                    <strong>{formatReadableDateTime(whyModalData.feasibility.homeArrivalTime)}</strong>
                  </div>
                </div>
              </div>

              {/* Driving Time & Buffer Math */}
              <div className="rounded-xl border border-[#EADBCE] p-3.5 space-y-1.5">
                <span className="font-black text-[#344F48] block uppercase tracking-wider text-[10px]">
                  One-Way Highway Timing Math
                </span>
                <ul className="space-y-1 text-[11px] text-[#6B7C77]">
                  <li className="flex justify-between">
                    <span>Base highway drive time:</span>
                    <strong className="text-[#344F48]">{formatDuration(whyModalData.dest.baselineOneWayDriveMinutes)}</strong>
                  </li>
                  <li className="flex justify-between">
                    <span>+20% highway traffic & toll buffer:</span>
                    <strong className="text-[#344F48]">+{formatDuration(Math.round(whyModalData.dest.baselineOneWayDriveMinutes * 0.20))}</strong>
                  </li>
                  {whyModalData.adj !== 0 && (
                    <li className="flex justify-between">
                      <span>User-selected delay scenario:</span>
                      <strong className="text-[#C65B32]">{whyModalData.adj > 0 ? `+${whyModalData.adj}m` : `${whyModalData.adj}m`}</strong>
                    </li>
                  )}
                  <li className="flex justify-between border-t border-[#EADBCE] pt-1 font-bold text-[#344F48]">
                    <span>Total modeled one-way drive:</span>
                    <span className="text-[#C65B32]">{formatDuration(whyModalData.feasibility.outboundDriveMinutes)}</span>
                  </li>
                </ul>
              </div>

              {/* Return Safety Margin */}
              <div className="rounded-xl border border-[#EADBCE] p-3.5 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#344F48]">Return Deadline Safety Margin:</span>
                  <span
                    className={`font-black ${
                      whyModalData.feasibility.returnDeadlineMarginMinutes >= 60
                        ? 'text-emerald-700'
                        : whyModalData.feasibility.returnDeadlineMarginMinutes >= 0
                        ? 'text-amber-700'
                        : 'text-rose-700'
                    }`}
                  >
                    {whyModalData.feasibility.returnDeadlineMarginMinutes >= 0
                      ? `+${formatDuration(whyModalData.feasibility.returnDeadlineMarginMinutes)}`
                      : `−${formatDuration(Math.abs(whyModalData.feasibility.returnDeadlineMarginMinutes))} late`}
                  </span>
                </div>
                <p className="text-[11px] text-[#6B7C77] leading-relaxed">
                  Calculated against your hard return deadline of {formatReadableDateTime(activeInputs.returnDeadlineDateTime)}.
                  A positive margin means you have buffer for unexpected slowdowns. A negative margin indicates you cannot finish all stops and return in time.
                </p>
              </div>

              {/* Cost Estimate Breakdown */}
              <div className="rounded-xl border border-[#EADBCE] p-3.5 space-y-1">
                <span className="font-black text-[#344F48] block uppercase tracking-wider text-[10px]">
                  Estimated Cost Per Traveler (₹{whyModalData.feasibility.estimatedCostPerPersonINR.toLocaleString('en-IN')})
                </span>
                <p className="text-[11px] text-[#6B7C77] leading-relaxed">
                  Includes shared round-trip fuel (₹{whyModalData.dest.approximateRoundTripFuelINR}), round-trip highway tolls (₹{whyModalData.dest.approximateRoundTripTollsINR}),
                  twin-sharing accommodation (₹{whyModalData.dest.approximateOneNightStayINR}/night), and official attraction entry tickets divided across {activeInputs.partySize} travelers.
                </p>
              </div>
            </div>

            <div className="pt-2">
              <TactileButton
                variant="primary"
                size="md"
                fullWidth
                onClick={() => {
                  const targetId = whyModalData.dest.id;
                  setWhyModalData(null);
                  navigate(`/schedule/${targetId}?${buildShareableParams(targetId, activeInputs).toString()}`);
                }}
              >
                Select {whyModalData.dest.name} & Customize Itinerary →
              </TactileButton>
            </div>
          </div>
        </div>
      )}

      {/* Destination Guide Modal (Preserved for verified destinations) */}
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
