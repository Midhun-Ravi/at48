import { useState, useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import type { Dispatch, SetStateAction } from 'react';
import type { UserConstraints } from '../types';
import { getDestination } from '../data/destinations';
import { getCompatiblePitstops } from '../data/pitstops.js';
import { evaluateFeasibility, parseIST } from '../engine/scheduler';
import { getDestinationImage, getPlaceImage } from '../data/images';
import ProgressBar from '../components/ProgressBar';
import { saveTrip } from '../utils/savedTrips';
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
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Parse shareable query parameters if present
  const parsedTrip = useMemo(() => {
    if (!searchParams || searchParams.toString().length === 0) return null;
    return parseShareableTrip(searchParams, id ?? '');
  }, [searchParams, id]);

  // Defensive fallback if invalid or corrupted URL parameters
  if (parsedTrip && !parsedTrip.valid) {
    return (
      <div className="mx-auto max-w-xl space-y-4 rounded-2xl border border-red-500/40 bg-red-950/40 p-6 text-center text-red-200">
        <div className="text-3xl">⚠️</div>
        <h2 className="text-xl font-bold text-red-100">Trip Link Could Not Be Loaded</h2>
        <p className="text-sm text-red-300">{parsedTrip.error}</p>
        <p className="text-xs text-red-400">
          The link may be corrupted, truncated, or contains out-of-range travel dates.
        </p>
        <div className="pt-2">
          <Link
            to="/"
            className="inline-block rounded-xl bg-[#2962FF] px-5 py-3 text-sm font-bold text-white hover:bg-blue-600 transition-colors"
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
      <div className="mx-auto max-w-xl space-y-4 py-8 text-center text-slate-200">
        <p className="text-lg font-bold text-white">Unknown destination.</p>
        <Link to="/compare" className="text-blue-400 underline font-semibold">
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

  // Evaluate feasibility using the deterministic engine
  const r = evaluateFeasibility(dest, activeInputs);

  const availableDays = Array.from(new Set(r.timeline.map(t => t.day))).sort((a, b) => a - b);

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

  const handleSaveTrip = () => {
    const shareUrl = buildShareableTripUrl(dest.id, activeInputs);
    saveTrip({
      destinationId: dest.id,
      destinationName: dest.name,
      routeName: dest.routeName,
      departureDateTime: activeInputs.departureDateTime,
      returnDeadlineDateTime: activeInputs.returnDeadlineDateTime,
      pace: activeInputs.pace,
      partySize: activeInputs.partySize,
      perPersonBudgetINR: activeInputs.perPersonBudgetINR,
      planningMode: activeInputs.planningMode,
      organizerName: activeInputs.organizerName,
      shareUrl,
    });
    setSavedSuccess(true);
    showToast('Trip saved to this device! Reopen anytime from "My Trip".');
  };

  const googleMapsDirectionsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent('MG Road, Bengaluru')}&destination=${encodeURIComponent(dest.name + ', India')}&travelmode=driving`;

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      {/* 4-part segmented progress meter */}
      <ProgressBar currentStep={4} />

      {/* Top Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to={editUrl}
          className="inline-flex items-center text-xs font-semibold text-blue-400 hover:underline"
        >
          ← Edit Itinerary (Screen 3)
        </Link>
        <span className="rounded-full bg-blue-500/20 border border-blue-500/30 px-3 py-1 text-xs font-bold text-blue-300">
          Ready to Hit the Road
        </span>
      </div>

      {/* Screen Title */}
      <div>
        <h1 className="text-3xl font-extrabold text-white">Ready to hit the road?</h1>
        <p className="mt-1 text-sm text-slate-300">
          Everything is set! Check your final itinerary snapshot, save on this device, and share with your crew.
        </p>
      </div>

      {/* Section A: Trip Overview Hero Card */}
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-[#20252E] shadow-lg">
        {/* Destination Hero Photo with Fixed Aspect Ratio */}
        <div className="relative aspect-[16/9] sm:aspect-[21/9] w-full bg-slate-900 overflow-hidden">
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
            <div className="flex h-full w-full items-center justify-center bg-slate-800 text-4xl">
              🏞️
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
          <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between text-white">
            <div>
              <span className="rounded-full bg-[#2962FF] px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider backdrop-blur-sm">
                {isGroup ? 'Group Escape' : 'Solo Road Trip'}
              </span>
              <h2 className="mt-1 text-2xl sm:text-3xl font-black">{dest.name}</h2>
            </div>
            {heroImage && (
              <span className="text-[10px] text-white/80 bg-black/60 px-2 py-0.5 rounded backdrop-blur-sm">
                Photo: {heroImage.author} · {heroImage.license}
              </span>
            )}
          </div>
        </div>

        {/* Core Trip Parameters Grid */}
        <div className="p-5 sm:p-6 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs border-t border-slate-800 bg-[#15191F]">
          <div>
            <span className="block text-slate-400 font-medium">Organizer</span>
            <strong className="text-sm font-bold text-white">
              {organizerName || (isGroup ? 'Trip Organizer' : 'Solo Traveler')}
            </strong>
          </div>
          <div>
            <span className="block text-slate-400 font-medium">Party Size</span>
            <strong className="text-sm font-bold text-white">
              {activeInputs.partySize} {activeInputs.partySize === 1 ? 'traveler' : 'travelers'}
            </strong>
          </div>
          <div>
            <span className="block text-slate-400 font-medium">Travel Pace</span>
            <strong className="text-sm font-bold text-white capitalize">
              {activeInputs.pace}
            </strong>
          </div>
          <div>
            <span className="block text-slate-400 font-medium">Target Budget</span>
            <strong className="text-sm font-bold text-white">
              ₹{activeInputs.perPersonBudgetINR.toLocaleString('en-IN')}/person
            </strong>
          </div>
        </div>

        {/* Travel Window Times */}
        <div className="p-5 sm:p-6 border-t border-slate-800 grid sm:grid-cols-2 gap-4 text-sm bg-[#20252E]">
          <div className="rounded-xl border border-slate-700 bg-[#15191F] p-3.5">
            <span className="block text-xs font-semibold uppercase text-blue-400">Leave Bengaluru</span>
            <strong className="mt-1 block text-white">
              {formatReadableDateTime(activeInputs.departureDateTime)} (IST)
            </strong>
            <span className="text-xs text-slate-400">Origin: MG Road reference corridor</span>
          </div>
          <div className="rounded-xl border border-slate-700 bg-[#15191F] p-3.5">
            <span className="block text-xs font-semibold uppercase text-blue-400">Must Be Home By</span>
            <strong className="mt-1 block text-white">
              {formatReadableDateTime(activeInputs.returnDeadlineDateTime)} (IST)
            </strong>
            <span className="text-xs text-slate-400">
              Expected arrival: {formatReadableDateTime(r.homeArrivalTime)}
            </span>
          </div>
        </div>
      </div>

      {/* Section B: Feasibility Verdict Card */}
      <div className="rounded-2xl border border-slate-800 bg-[#20252E] p-6 text-white shadow-lg space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="rounded-full bg-blue-500/20 border border-blue-500/30 px-3 py-1 text-xs font-bold uppercase tracking-wider text-blue-300">
            Feasibility Verdict
          </span>
          <span className="text-xs text-slate-400">MG Road reference</span>
        </div>

        <div>
          <p className="text-3xl font-black tracking-tight">{r.rating}</p>
          <p className="mt-1 text-sm text-slate-300">{r.ratingExplanation}</p>
        </div>

        <div className="grid grid-cols-2 gap-4 border-t border-slate-800 pt-4 text-sm">
          <div>
            <p className="text-xs text-slate-400">Usable destination free time</p>
            <strong className="text-2xl font-black text-white">
              {formatDuration(r.destinationSlackMinutes)}
            </strong>
          </div>
          <div>
            <p className="text-xs text-slate-400">Return deadline margin</p>
            <strong
              className={`text-2xl font-black ${
                r.returnDeadlineMarginMinutes < 0 ? 'text-red-400' : 'text-emerald-400'
              }`}
            >
              {formatDuration(r.returnDeadlineMarginMinutes, true)}
            </strong>
          </div>
        </div>

        <div className="border-t border-slate-800 pt-3 text-xs text-slate-300 space-y-1">
          <p>
            Expected home: <strong>{formatReadableDateTime(r.homeArrivalTime)} (IST)</strong>
          </p>
          <p>
            Estimated cost: <strong>₹{r.estimatedCostPerPersonINR.toLocaleString('en-IN')}/person</strong> (₹{r.estimatedTripTotalINR.toLocaleString('en-IN')} total for party of {activeInputs.partySize})
          </p>
        </div>
      </div>

      {/* Section C: Route & Stop Highlights with External Links */}
      <div className="space-y-4 rounded-2xl border border-slate-800 bg-[#20252E] p-5 sm:p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white">Route & Landmark Destinations</h2>
          <a
            href={googleMapsDirectionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-bold text-blue-400 hover:underline"
          >
            Open in Google Maps ↗
          </a>
        </div>

        {/* Selected Pitstop Highlight */}
        {selectedStops.length > 0 && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-950/20 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <span className="font-bold text-amber-300 text-xs uppercase tracking-wider">
                ☕ Highway Pitstop
              </span>
              <span className="rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 text-[11px] font-bold">
                Maddur Tiffanys
              </span>
            </div>
            {selectedStops.map(stop => (
              <div key={stop.id} className="flex gap-3 items-center">
                <div className="text-xs text-slate-300 flex-1">
                  <strong className="block text-sm text-white">{stop.name}</strong>
                  <p className="text-slate-400 mt-0.5">
                    Est. Dwell: {stop.dwellMinutes}m · Detour: {stop.detourMinutes}m (+{stop.dwellMinutes + stop.detourMinutes}m total)
                  </p>
                </div>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(stop.name)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg bg-[#292F39] px-3 py-1.5 text-xs font-bold text-blue-300 hover:text-white transition-colors"
                >
                  Directions ↗
                </a>
              </div>
            ))}
          </div>
        )}

        {/* Planned Attractions */}
        <div className="space-y-2">
          <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
            Planned Attractions & Landmarks
          </span>
          <div className="grid gap-2 sm:grid-cols-2">
            {dest.activities.map(a => {
              const isSkipped = activeInputs.disabledActivityIds.includes(a.id);
              const aImg = getPlaceImage(a.id);
              return (
                <div
                  key={a.id}
                  className={`flex items-center gap-3 rounded-xl border p-2.5 text-xs ${
                    isSkipped ? 'border-slate-800 bg-[#15191F]/60 opacity-60' : 'border-slate-700 bg-[#15191F]'
                  }`}
                >
                  {aImg && (
                    <img
                      src={aImg.src}
                      alt={aImg.alt}
                      className="h-10 w-10 rounded-lg object-cover flex-shrink-0"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <strong className="block text-white truncate">{a.name}</strong>
                    <span className="text-slate-400">
                      {isSkipped ? 'Skipped' : `${formatDuration(a.durationMinutes)} planned visit`}
                    </span>
                  </div>
                  {!isSkipped && (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(a.name + ', ' + dest.name)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded bg-[#292F39] px-2 py-1 text-[10px] font-bold text-blue-400 hover:text-white transition-colors"
                      title="Search landmark on Google Maps"
                    >
                      Map ↗
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Section D: Day-by-Day Itinerary Review Card */}
      <div className="space-y-5 rounded-2xl border border-slate-800 bg-[#20252E] p-5 sm:p-6 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-white">Day-by-Day Itinerary Review</h2>
            <p className="text-xs text-slate-400">
              Hour-by-hour breakdown of highway driving, stops, and leisure windows.
            </p>
          </div>
          <span className="rounded-full bg-blue-500/20 border border-blue-500/30 px-3 py-1 text-xs font-bold text-blue-300">
            Verified Engine Schedule
          </span>
        </div>

        {/* Day-by-Day Itinerary Cards (Dynamic 1 to 4 Days) */}
        {availableDays.map(day => {
          const items = r.timeline.filter(t => t.day === day && t.category !== 'REST');
          const dayDate = r.timeline.find(t => t.day === day)?.startTime;
          return (
            <div key={day} className="rounded-xl border border-slate-800 bg-[#15191F] p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <h3 className="text-sm font-extrabold text-white uppercase tracking-wide">
                  Day {day} {dayDate && <span className="text-xs font-normal text-slate-400 lowercase">· {formatReadableDate(dayDate)}</span>}
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
                          ? 'border-emerald-500/30 bg-emerald-950/20 text-emerald-200 font-medium'
                          : isPitstop
                          ? 'border-amber-500/40 bg-amber-950/30 text-amber-200 font-semibold'
                          : isDrive
                          ? 'border-blue-500/30 bg-blue-950/20 text-blue-200'
                          : isActivity
                          ? 'border-purple-500/30 bg-purple-950/20 text-purple-200'
                          : 'border-slate-800 bg-[#20252E] text-slate-200'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <span className="font-semibold text-white">{item.label}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 text-slate-400">
                        <span>
                          {formatTimelineTime(item.startTime)} - {formatTimelineTime(item.endTime)}
                        </span>
                        <span className="font-bold text-slate-300">({formatDuration(duration)})</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Expandable Plain-Text Preview for Copying */}
        <details className="group border-t border-slate-800 pt-3">
          <summary className="cursor-pointer text-xs font-bold text-blue-400 hover:text-blue-300 select-none flex items-center justify-between">
            <span>Show plain-text messaging preview</span>
            <span className="group-open:rotate-180 transition-transform">▼</span>
          </summary>
          <div className="mt-3">
            <pre className="max-h-56 overflow-y-auto whitespace-pre-wrap rounded-xl border border-slate-800 bg-[#15191F] p-4 text-xs text-slate-300 font-mono leading-relaxed">
              {summaryText}
            </pre>
          </div>
        </details>
      </div>

      {/* Section E: Save & Share Actions */}
      <div className="space-y-4 rounded-2xl border border-blue-500/40 bg-[#20252E] p-5 sm:p-6 shadow-lg">
        <div>
          <h2 className="text-base font-bold text-white">Save & Share Trip</h2>
          <p className="text-xs text-slate-400">
            Save this itinerary to your browser storage, or share with your crew via WhatsApp.
          </p>
        </div>

        {/* Primary Action Buttons: Save My Trip & Copy Share Link */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={handleSaveTrip}
            className={`w-full flex items-center justify-center gap-2 rounded-xl py-3.5 px-4 text-sm font-bold text-white shadow-md transition-all cursor-pointer ${
              savedSuccess
                ? 'bg-emerald-600 hover:bg-emerald-700'
                : 'bg-[#2962FF] hover:bg-blue-600'
            }`}
          >
            <span>{savedSuccess ? '✓' : '💾'}</span>
            <span>{savedSuccess ? 'Saved to My Trip!' : 'Save My Trip (This Device)'}</span>
          </button>

          <button
            onClick={handleCopyTripLink}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-[#292F39] py-3.5 px-4 text-sm font-bold text-white shadow-md hover:bg-slate-700 active:scale-[0.99] transition-all cursor-pointer"
          >
            <span>🔗</span>
            <span>Share Trip (Copy Link)</span>
          </button>
        </div>

        {/* WhatsApp Sharing Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
          <button
            onClick={handleShareInviteWhatsApp}
            className="flex items-center justify-center gap-2 rounded-xl bg-[#25D366] px-3.5 py-3 text-xs font-bold text-white shadow-md hover:bg-[#20ba5a] active:scale-[0.99] transition-all cursor-pointer"
          >
            <span>💬</span> WhatsApp Invite
          </button>
          <button
            onClick={handleCopySummary}
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-[#15191F] px-3.5 py-3 text-xs font-bold text-slate-200 hover:text-white shadow-sm hover:bg-slate-800 active:scale-[0.99] transition-all cursor-pointer"
          >
            <span>📋</span> Copy Text Summary
          </button>
          <button
            onClick={handleShareSummaryWhatsApp}
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-[#15191F] px-3.5 py-3 text-xs font-bold text-slate-200 hover:text-white shadow-sm hover:bg-slate-800 active:scale-[0.99] transition-all cursor-pointer"
          >
            <span>💬</span> WhatsApp Summary
          </button>
        </div>

        {/* Local Storage Disclosure */}
        <p className="text-[11px] text-slate-400 bg-[#15191F] p-3 rounded-xl border border-slate-800 leading-relaxed">
          ℹ️ <strong>Account-Free Storage:</strong> "Save My Trip" bookmarks your plan locally in this browser. No login or account required. Clearing browser cache will remove it. To share across devices or with your crew, use the WhatsApp invitation link.
        </p>

        {/* Toast confirmation feedback */}
        {toastMessage && (
          <p
            role="status"
            className="text-center text-sm font-semibold text-blue-400 animate-fade-in py-1"
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
