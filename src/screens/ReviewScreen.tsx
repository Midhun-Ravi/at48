import { useState, useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import type { Dispatch, SetStateAction } from 'react';
import type { UserConstraints } from '../types';
import { getDestination } from '../data/destinations';
import { getCompatiblePitstops } from '../data/pitstops.js';
import { evaluateFeasibility, parseIST } from '../engine/scheduler';
import { getDestinationImage, getPlaceImage } from '../data/images';
import {
  buildTripSummaryText,
  buildWhatsAppShareUrl,
  formatDuration,
  formatReadableDate,
  formatReadableDateTime,
  formatTimelineTime,
} from '../utils/formatters';
import {
  buildShareableParams,
  buildShareableTripUrl,
  buildWhatsAppInvitationMessage,
  parseShareableTrip,
} from '../utils/tripShare';

type Props = { inputs: UserConstraints; setInputs: Dispatch<SetStateAction<UserConstraints>> };

export default function ReviewScreen({ inputs }: Props) {
  const { id } = useParams();
  const [searchParams] = useSearchParams();

  const [toastMessage, setToastMessage] = useState('');

  // Parse shareable query parameters if present
  const parsedTrip = useMemo(() => {
    if (!searchParams || searchParams.toString().length === 0) return null;
    return parseShareableTrip(searchParams, id ?? '');
  }, [searchParams, id]);

  // Defensive fallback if invalid or corrupted URL parameters
  if (parsedTrip && !parsedTrip.valid) {
    return (
      <div className="mx-auto max-w-xl space-y-4 rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
        <div className="text-3xl">⚠️</div>
        <h2 className="text-xl font-bold text-red-900">Trip Link Could Not Be Loaded</h2>
        <p className="text-sm text-red-700">{parsedTrip.error}</p>
        <p className="text-xs text-red-600">
          The link may be corrupted, truncated, or contains out-of-range travel dates.
        </p>
        <div className="pt-2">
          <Link
            to="/"
            className="inline-block rounded-xl bg-teal-800 px-5 py-3 text-sm font-bold text-white hover:bg-teal-900 transition-colors"
          >
            ← Create a new trip
          </Link>
        </div>
      </div>
    );
  }

  const dest = getDestination(id ?? '');
  if (!dest) {
    return (
      <div className="mx-auto max-w-xl space-y-4 py-8 text-center">
        <p className="text-lg font-bold text-slate-800">Unknown destination.</p>
        <Link to="/compare" className="text-teal-700 underline font-semibold">
          ← Back to comparison
        </Link>
      </div>
    );
  }

  // Active inputs: Reconstructed from validated URL parameters if present; otherwise use app inputs
  const activeInputs = parsedTrip?.valid ? parsedTrip.data.inputs : inputs;
  const organizerName = parsedTrip?.valid
    ? parsedTrip.data.organizerName
    : activeInputs.organizerName || '';
  const isGroup = (activeInputs.planningMode ?? 'group') === 'group';

  // Evaluate feasibility using the exact deterministic engine (NEVER re-implement or mock)
  const r = evaluateFeasibility(dest, activeInputs);

  const day1Start = r.timeline.find(t => t.day === 1)?.startTime;
  const day2Start = r.timeline.find(t => t.day === 2)?.startTime;

  const heroImage = getDestinationImage(dest.id);
  const compatibleStops = getCompatiblePitstops(dest.id);
  const selectedStops = compatibleStops.filter(s =>
    (activeInputs.selectedPitstopIds ?? []).includes(s.id)
  );

  const shareParams = buildShareableParams(dest.id, activeInputs);
  const editUrl = `/schedule/${dest.id}?${shareParams.toString()}`;

  const summaryText = buildTripSummaryText({
    destination: dest,
    inputs: activeInputs,
    result: r,
    originUrl: typeof window !== 'undefined' ? window.location.origin : undefined,
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 4000);
  };

  const handleCopyTripLink = async () => {
    const shareUrl = buildShareableTripUrl(dest.id, activeInputs);
    try {
      await navigator.clipboard.writeText(shareUrl);
      showToast('Trip invitation link copied to clipboard!');
    } catch {
      window.prompt('Copy trip invitation link:', shareUrl);
      showToast('Trip link ready to copy.');
    }
  };

  const handleShareInviteWhatsApp = () => {
    const shareUrl = buildShareableTripUrl(dest.id, activeInputs);
    const msg = buildWhatsAppInvitationMessage({
      destinationName: dest.name,
      inputs: activeInputs,
      tripUrl: shareUrl,
    });
    const url = buildWhatsAppShareUrl(msg);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleCopySummary = async () => {
    try {
      await navigator.clipboard.writeText(summaryText);
      showToast('Trip summary text copied to clipboard!');
    } catch {
      window.prompt('Copy trip summary:', summaryText);
      showToast('Trip summary ready to copy.');
    }
  };

  const handleShareSummaryWhatsApp = () => {
    const url = buildWhatsAppShareUrl(summaryText);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const isLocalhost =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      {/* Top Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to={editUrl}
          className="inline-flex items-center text-sm font-semibold text-teal-700 hover:underline"
        >
          ← Edit Itinerary
        </Link>
        <span className="rounded-full bg-teal-50 border border-teal-200 px-3 py-1 text-xs font-bold text-teal-800">
          Ready to Share
        </span>
      </div>

      {/* Screen Title */}
      <div>
        <div className="text-sm font-semibold uppercase tracking-widest text-teal-700">Step 4 / 4</div>
        <h1 className="mt-1 text-3xl font-extrabold text-slate-900">Review & Share Your Trip</h1>
        <p className="mt-1 text-sm text-slate-600">
          Everything is set! Check your final itinerary snapshot and share with your travel crew.
        </p>
      </div>

      {/* Section A: Trip Overview Hero Card */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {/* Destination Hero Photo with Fixed Aspect Ratio */}
        <div className="relative aspect-[16/9] sm:aspect-[21/9] w-full bg-slate-100 overflow-hidden">
          {heroImage ? (
            <img
              src={heroImage.src}
              alt={heroImage.alt}
              loading="lazy"
              className="h-full w-full object-cover"
              onError={e => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-teal-900/10 text-4xl">
              🏞️
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between text-white">
            <div>
              <span className="rounded-full bg-emerald-500/80 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider backdrop-blur-sm">
                {isGroup ? 'Group Escape' : 'Solo Road Trip'}
              </span>
              <h2 className="mt-1 text-2xl sm:text-3xl font-black">{dest.name}</h2>
            </div>
            {heroImage && (
              <span className="text-[10px] text-white/80 bg-black/50 px-2 py-0.5 rounded backdrop-blur-sm">
                Photo: {heroImage.author} · {heroImage.license}
              </span>
            )}
          </div>
        </div>

        {/* Core Trip Parameters Grid */}
        <div className="p-5 sm:p-6 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs border-t border-slate-100 bg-slate-50/50">
          <div>
            <span className="block text-slate-500 font-medium">Organizer</span>
            <strong className="text-sm font-bold text-slate-900">
              {organizerName || (isGroup ? 'Trip Organizer' : 'Solo Traveler')}
            </strong>
          </div>
          <div>
            <span className="block text-slate-500 font-medium">Party Size</span>
            <strong className="text-sm font-bold text-slate-900">
              {activeInputs.partySize} {activeInputs.partySize === 1 ? 'traveler' : 'travelers'}
            </strong>
          </div>
          <div>
            <span className="block text-slate-500 font-medium">Travel Pace</span>
            <strong className="text-sm font-bold text-slate-900 capitalize">
              {activeInputs.pace}
            </strong>
          </div>
          <div>
            <span className="block text-slate-500 font-medium">Target Budget</span>
            <strong className="text-sm font-bold text-slate-900">
              ₹{activeInputs.perPersonBudgetINR.toLocaleString('en-IN')}/person
            </strong>
          </div>
        </div>

        {/* Travel Window Times */}
        <div className="p-5 sm:p-6 border-t border-slate-200 grid sm:grid-cols-2 gap-4 text-sm">
          <div className="rounded-xl border border-slate-200 bg-white p-3.5">
            <span className="block text-xs font-semibold uppercase text-teal-800">Leave Bengaluru</span>
            <strong className="mt-1 block text-slate-900">
              {formatReadableDateTime(activeInputs.departureDateTime)} (IST)
            </strong>
            <span className="text-xs text-slate-500">Origin: MG Road reference</span>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3.5">
            <span className="block text-xs font-semibold uppercase text-teal-800">Must Be Home By</span>
            <strong className="mt-1 block text-slate-900">
              {formatReadableDateTime(activeInputs.returnDeadlineDateTime)} (IST)
            </strong>
            <span className="text-xs text-slate-500">
              Expected arrival: {formatReadableDateTime(r.homeArrivalTime)}
            </span>
          </div>
        </div>
      </div>

      {/* Section B: Route & Planning Highlights */}
      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">Route & Planning Assumptions</h2>

        <div className="grid gap-3 text-xs sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-1">
            <span className="font-semibold text-slate-700">Driving Corridor:</span>
            <p className="text-slate-900 font-medium">{dest.routeName}</p>
            <p className="text-slate-500">{dest.oneWayDistanceKm} km each way from MG Road</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-1">
            <span className="font-semibold text-slate-700">Origin Adjustment:</span>
            <p className="text-slate-900 font-medium">
              {activeInputs.drivingAdjustmentMinutes === 0
                ? '0m (Standard MG Road baseline)'
                : `${formatDuration(activeInputs.drivingAdjustmentMinutes, true)} one-way adjustment`}
            </p>
            <p className="text-slate-500">
              {activeInputs.simulateDelayMinutes === 60
                ? '⚠️ Outbound +1h delay simulation active'
                : '✓ On-time outbound departure'}
            </p>
          </div>
        </div>

        {/* Selected Pitstop Highlight */}
        {selectedStops.length > 0 ? (
          <div className="rounded-xl border border-amber-300 bg-amber-50/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <span className="font-bold text-amber-950 text-xs uppercase tracking-wider">
                ☕ Selected Highway Pitstop
              </span>
              <span className="rounded bg-amber-200 px-2 py-0.5 text-[11px] font-bold text-amber-900">
                PITSTOP Block Included
              </span>
            </div>
            {selectedStops.map(stop => {
              const stopImg = getPlaceImage(stop.id);
              return (
                <div key={stop.id} className="flex gap-3 items-center">
                  {stopImg && (
                    <img
                      src={stopImg.src}
                      alt={stopImg.alt}
                      className="h-14 w-14 rounded-lg object-cover flex-shrink-0 border border-amber-200"
                    />
                  )}
                  <div className="text-xs text-amber-950">
                    <strong className="block text-sm">{stop.name}</strong>
                    <p className="text-slate-700 mt-0.5">
                      Est. Dwell: {stop.dwellMinutes}m · Detour: {stop.detourMinutes}m (+{stop.dwellMinutes + stop.detourMinutes}m total)
                    </p>
                    {stop.replacesArrivalMeal && (
                      <p className="text-[11px] text-teal-800 font-medium mt-0.5">
                        ✓ Replaces redundant 45m hotel arrival lunch allowance.
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            Direct journey (no highway pitstops selected).
          </p>
        )}

        {/* Attraction summary */}
        <div>
          <span className="block text-xs font-bold text-slate-800 mb-2">Planned Attractions:</span>
          <div className="grid gap-2 sm:grid-cols-2">
            {dest.activities.map(a => {
              const isSkipped = activeInputs.disabledActivityIds.includes(a.id);
              const aImg = getPlaceImage(a.id);
              return (
                <div
                  key={a.id}
                  className={`flex items-center gap-3 rounded-lg border p-2.5 text-xs ${
                    isSkipped ? 'border-slate-200 bg-slate-100/60 opacity-60' : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  {aImg && (
                    <img
                      src={aImg.src}
                      alt={aImg.alt}
                      className="h-10 w-10 rounded-md object-cover flex-shrink-0"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <strong className="block text-slate-900 truncate">{a.name}</strong>
                    <span className="text-slate-500">
                      {isSkipped ? 'Optional attraction skipped' : `${formatDuration(a.durationMinutes)} planned visit`}
                    </span>
                  </div>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                      isSkipped ? 'bg-slate-200 text-slate-600' : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {isSkipped ? 'Skipped' : 'Included'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Section C: Feasibility Result Card */}
      <div className="rounded-2xl bg-[#0d352f] p-6 text-white shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="rounded-full bg-emerald-900/60 px-3 py-1 text-xs font-bold uppercase tracking-wider text-emerald-200">
            Feasibility Verdict
          </span>
          <span className="text-xs text-emerald-200">MG Road reference</span>
        </div>

        <div>
          <p className="text-3xl font-black tracking-tight">{r.rating}</p>
          <p className="mt-1 text-sm text-emerald-100">{r.ratingExplanation}</p>
        </div>

        <div className="grid grid-cols-2 gap-4 border-t border-emerald-900/50 pt-4 text-sm">
          <div>
            <p className="text-xs text-emerald-300">Usable destination free time</p>
            <strong className="text-2xl font-black text-white">
              {formatDuration(r.destinationSlackMinutes)}
            </strong>
          </div>
          <div>
            <p className="text-xs text-emerald-300">Return deadline margin</p>
            <strong
              className={`text-2xl font-black ${
                r.returnDeadlineMarginMinutes < 0 ? 'text-red-300' : 'text-white'
              }`}
            >
              {formatDuration(r.returnDeadlineMarginMinutes, true)}
            </strong>
          </div>
        </div>

        <div className="border-t border-emerald-900/50 pt-3 text-xs text-emerald-200 space-y-1">
          <p>
            Expected home: <strong>{formatReadableDateTime(r.homeArrivalTime)} (IST)</strong>
          </p>
          <p>
            Estimated cost: <strong>₹{r.estimatedCostPerPersonINR.toLocaleString('en-IN')}/person</strong> (₹{r.estimatedTripTotalINR.toLocaleString('en-IN')} total for party of {activeInputs.partySize})
          </p>
        </div>

        {/* Violations / Advisories if any */}
        {r.violations.length > 0 && (
          <div className="border-t border-emerald-900/50 pt-3 space-y-2">
            {r.violations.map((v, i) => (
              <div
                key={i}
                className={`rounded-lg p-2.5 text-xs font-medium ${
                  v.severity === 'BLOCKER'
                    ? 'bg-red-950/80 text-red-200 border border-red-800'
                    : 'bg-amber-950/80 text-amber-200 border border-amber-800'
                }`}
              >
                <strong>{v.severity}:</strong> {v.message}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section D: Day-by-Day Itinerary & Visual Summary */}
      <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Day-by-Day Itinerary Review</h2>
            <p className="text-xs text-slate-500">
              Clear breakdown of driving legs, scheduled stops, and destination leisure time.
            </p>
          </div>
          <span className="rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-bold text-emerald-800">
            Verified Itinerary
          </span>
        </div>

        {/* Day 1 & Day 2 Visual Sections */}
        {([1, 2] as const).map(day => {
          const items = r.timeline.filter(t => t.day === day && t.category !== 'REST');
          const dayDate = day === 1 ? day1Start : day2Start;
          return (
            <div key={day} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wide">
                  Day {day} {dayDate && <span className="text-xs font-normal text-slate-500 lowercase">· {formatReadableDate(dayDate)}</span>}
                </h3>
                <span className="text-[11px] font-semibold text-slate-500">
                  {items.length} segments
                </span>
              </div>

              <div className="space-y-2">
                {items.map(item => {
                  const isPitstop = item.category === 'PITSTOP';
                  const isFree = item.category === 'FREE';
                  const isDrive = item.category === 'DRIVE';
                  const isActivity = item.category === 'ACTIVITY';
                  const duration = Math.round((parseIST(item.endTime) - parseIST(item.startTime)) / 60_000);

                  return (
                    <div
                      key={item.id}
                      className={`flex items-center justify-between gap-3 rounded-lg border p-2.5 text-xs transition-colors ${
                        isFree
                          ? 'border-emerald-200 bg-emerald-50/80 text-emerald-950 font-medium'
                          : isPitstop
                          ? 'border-amber-300 bg-amber-50 text-amber-950 font-semibold'
                          : isDrive
                          ? 'border-blue-100 bg-blue-50/60 text-blue-950'
                          : isActivity
                          ? 'border-purple-100 bg-purple-50/50 text-purple-950'
                          : 'border-slate-200 bg-white text-slate-800'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <span className="font-semibold">{item.label}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 text-slate-600">
                        <span>
                          {formatTimelineTime(item.startTime)} - {formatTimelineTime(item.endTime)}
                        </span>
                        <span className="font-bold text-slate-800">({formatDuration(duration)})</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Expandable Plain-Text Preview for Copying */}
        <details className="group border-t border-slate-200 pt-3">
          <summary className="cursor-pointer text-xs font-bold text-teal-800 hover:text-teal-950 select-none flex items-center justify-between">
            <span>Show plain-text messaging preview</span>
            <span className="text-teal-600 group-open:rotate-180 transition-transform">▼</span>
          </summary>
          <div className="mt-3">
            <pre className="max-h-56 overflow-y-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-800 font-sans leading-relaxed">
              {summaryText}
            </pre>
          </div>
        </details>
      </div>

      {/* Section E: Sharing & Review Actions */}
      <div className="space-y-4 rounded-2xl border border-teal-300 bg-white p-5 sm:p-6 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Share Trip With Friends</h2>
          <p className="text-xs text-slate-500">
            Invite your crew to view this interactive snapshot or send readable WhatsApp text.
          </p>
        </div>

        {isLocalhost && (
          <p className="rounded-lg bg-amber-50 p-2.5 text-xs text-amber-900">
            ⚠️ <strong>Local environment detected:</strong> Links generated on localhost will only work on this machine. Deploy to Vercel for cross-device links.
          </p>
        )}

        <p className="text-xs text-slate-500 italic">
          Shared trip snapshot. Changes are not synchronized automatically.
        </p>

        {/* Primary CTA */}
        <button
          onClick={handleCopyTripLink}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#0d6350] px-5 py-4 text-base font-bold text-white shadow-md hover:bg-[#0b4b3d] active:scale-[0.99] transition-all cursor-pointer"
        >
          <span>🔗</span> Share Trip With Friends (Copy Link)
        </button>

        {/* Secondary Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
          <button
            onClick={handleShareInviteWhatsApp}
            className="flex items-center justify-center gap-2 rounded-xl bg-[#25D366] px-3.5 py-3 text-xs font-bold text-white shadow-sm hover:bg-[#20ba5a] active:scale-[0.99] transition-all cursor-pointer"
          >
            <span>💬</span> WhatsApp Invite
          </button>
          <button
            onClick={handleCopySummary}
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-xs font-bold text-slate-800 shadow-sm hover:bg-slate-50 active:scale-[0.99] transition-all cursor-pointer"
          >
            <span>📋</span> Copy Summary Text
          </button>
          <button
            onClick={handleShareSummaryWhatsApp}
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-xs font-bold text-slate-800 shadow-sm hover:bg-slate-50 active:scale-[0.99] transition-all cursor-pointer"
          >
            <span>💬</span> WhatsApp Summary
          </button>
        </div>

        {/* Edit My Trip Back Link */}
        <div className="pt-2 text-center border-t border-slate-100">
          <Link
            to={editUrl}
            className="inline-flex items-center gap-1 text-sm font-semibold text-teal-800 hover:underline"
          >
            ← Edit My Trip (return to Screen 3)
          </Link>
        </div>

        {/* Toast confirmation feedback */}
        {toastMessage && (
          <p
            role="status"
            className="text-center text-sm font-semibold text-teal-700 animate-fade-in py-1"
          >
            ✓ {toastMessage}
          </p>
        )}
      </div>

      <p className="text-center text-xs text-slate-500">
        Cost assumes {activeInputs.partySize} travelers sharing a car and room. Meals and personal expenses excluded. Route durations and most costs are unverified planning estimates.
      </p>
    </section>
  );
}
