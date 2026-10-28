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
  buildWhatsAppRSVPMessage,
  cleanInputDisplayName,
  parseShareableTrip,
  sanitizeDisplayName,
} from '../utils/tripShare';

type Props = { inputs: UserConstraints; setInputs: Dispatch<SetStateAction<UserConstraints>> };

export default function ReviewScreen({ inputs }: Props) {
  const { id } = useParams();
  const [searchParams] = useSearchParams();

  const [toastMessage, setToastMessage] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [guestError, setGuestError] = useState('');
  const [rsvpSent, setRsvpSent] = useState(false);

  // Parse shareable query parameters if present
  const parsedTrip = useMemo(() => {
    if (!searchParams || searchParams.toString().length === 0) return null;
    return parseShareableTrip(searchParams, id ?? '');
  }, [searchParams, id]);

  // Defensive fallback if invalid or corrupted URL parameters
  if (parsedTrip && !parsedTrip.valid) {
    return (
      <div className="mx-auto max-w-xl space-y-4 rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-red-800">
        <div className="text-3xl">⚠️</div>
        <h2 className="text-xl font-bold text-red-900">Trip Link Could Not Be Loaded</h2>
        <p className="text-sm text-red-700">{parsedTrip.error}</p>
        <p className="text-xs text-red-600">
          The link may be corrupted, truncated, or contains out-of-range travel dates.
        </p>
        <div className="pt-2">
          <Link
            to="/"
            className="inline-block rounded-xl bg-[#176EA8] px-5 py-3 text-sm font-bold text-white hover:bg-[#135a8a] transition-colors"
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
      <div className="mx-auto max-w-xl space-y-4 py-8 text-center text-[#193953]">
        <p className="text-lg font-bold text-[#193953]">Unknown destination.</p>
        <Link to="/compare" className="text-[#176EA8] underline font-semibold">
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
  const isGuestView = Boolean(parsedTrip?.valid && parsedTrip.data.isGuestView);

  const handleGuestRSVP = () => {
    const cleanGuest = sanitizeDisplayName(guestName);
    if (!cleanGuest) {
      setGuestError('Please enter your name so the organizer knows who is joining.');
      return;
    }
    setGuestError('');

    const tripUrl = buildShareableTripUrl(dest.id, activeInputs);
    const text = buildWhatsAppRSVPMessage({
      destinationName: dest.name,
      departureDateTime: activeInputs.departureDateTime,
      returnDeadlineDateTime: activeInputs.returnDeadlineDateTime,
      organizerName: organizerName || 'the organizer',
      guestName: cleanGuest,
      tripUrl,
    });

    setRsvpSent(true);
    window.open(buildWhatsAppShareUrl(text), '_blank', 'noopener,noreferrer');
  };

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
          className="inline-flex items-center text-xs font-semibold text-[#176EA8] hover:underline"
        >
          ← Edit Itinerary (Screen 3)
        </Link>
        <span className="rounded-full bg-[#DDF0F6] border border-[#176EA8]/30 px-3 py-1 text-xs font-bold text-[#176EA8]">
          Ready to Hit the Road
        </span>
      </div>

      {/* Screen Title */}
      <div>
        <h1 className="text-3xl font-extrabold text-[#193953]">Ready to hit the road?</h1>
        <p className="mt-1 text-sm text-[#5A7184]">
          Everything is set! Check your final itinerary snapshot, save on this device, and share with your crew.
        </p>
      </div>

      {/* Guest Invitation & RSVP Panel on Page 4 */}
      {isGuestView && (
        <div className="rounded-2xl border-2 border-[#25D366]/40 bg-[#DDF0F6] p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="rounded-full bg-[#176EA8] text-white px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider">
                Trip Invitation & RSVP
              </span>
              <h2 className="text-xl font-black text-[#193953] mt-1.5">
                {organizerName ? `${organizerName} invited you on a road trip!` : 'You’ve been invited on a road trip!'}
              </h2>
              <p className="text-xs text-[#5A7184] mt-1">
                Explore the planned schedule for <strong>{dest.name}</strong>, highway pitstops, and budget before sending your RSVP.
              </p>
            </div>
            <span className="text-3xl">🚗</span>
          </div>

          <div className="rounded-xl bg-white border border-[#E1ECF2] p-3.5 text-xs space-y-1">
            <p>
              📅 <strong>Dates:</strong> {formatReadableDateTime(activeInputs.departureDateTime)} → {formatReadableDateTime(activeInputs.returnDeadlineDateTime)}
            </p>
            <p>
              👥 <strong>Crew Size:</strong> {activeInputs.partySize} travelers · <strong>Est. Cost:</strong> ₹{r.estimatedCostPerPersonINR.toLocaleString('en-IN')}/person
            </p>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-[#193953]">
              Your Name to RSVP
            </label>
            <input
              type="text"
              maxLength={40}
              placeholder="e.g. Arun or Priya"
              value={guestName}
              onChange={e => {
                setGuestError('');
                setGuestName(cleanInputDisplayName(e.target.value));
              }}
              className="w-full rounded-xl border border-[#E1ECF2] bg-white p-3 text-sm text-[#193953] placeholder:text-[#5A7184]/60 focus:border-[#176EA8] focus:outline-none"
            />
            {guestError && <p className="text-xs font-semibold text-red-700">{guestError}</p>}
          </div>

          <button
            type="button"
            onClick={handleGuestRSVP}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-3.5 font-bold text-white shadow-md hover:bg-[#20ba5a] active:scale-[0.99] transition-all cursor-pointer text-sm"
          >
            <span className="text-base">💬</span> Join Trip & Send RSVP via WhatsApp
          </button>

          {rsvpSent && (
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3.5 text-xs text-emerald-800 space-y-1">
              <p className="font-bold">✓ WhatsApp opened with your RSVP message.</p>
              <p>
                Send the message directly to {organizerName || 'the organizer'} to confirm your spot.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Section A: Trip Overview Hero Card */}
      <div className="overflow-hidden rounded-2xl border border-[#E1ECF2] bg-white shadow-sm">
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
            <div className="flex h-full w-full items-center justify-center bg-slate-100 text-4xl">
              🏞️
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
          <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between text-white">
            <div>
              <span className="rounded-full bg-[#176EA8] px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider backdrop-blur-xs">
                {isGroup ? 'Group Escape' : 'Solo Road Trip'}
              </span>
              <h2 className="mt-1 text-2xl sm:text-3xl font-black">{dest.name}</h2>
            </div>
            {heroImage && (
              <span className="text-[10px] text-white/80 bg-black/60 px-2 py-0.5 rounded backdrop-blur-xs">
                Photo: {heroImage.author} · {heroImage.license}
              </span>
            )}
          </div>
        </div>

        {/* Core Trip Parameters Grid */}
        <div className="p-5 sm:p-6 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs border-t border-[#E1ECF2] bg-[#F4F9FC]">
          <div>
            <span className="block text-[#5A7184] font-medium">Organizer</span>
            <strong className="text-sm font-bold text-[#193953]">
              {organizerName || (isGroup ? 'Trip Organizer' : 'Solo Traveler')}
            </strong>
          </div>
          <div>
            <span className="block text-[#5A7184] font-medium">Party Size</span>
            <strong className="text-sm font-bold text-[#193953]">
              {activeInputs.partySize} {activeInputs.partySize === 1 ? 'traveler' : 'travelers'}
            </strong>
          </div>
          <div>
            <span className="block text-[#5A7184] font-medium">Travel Pace</span>
            <strong className="text-sm font-bold text-[#193953] capitalize">
              {activeInputs.pace}
            </strong>
          </div>
          <div>
            <span className="block text-[#5A7184] font-medium">Target Budget</span>
            <strong className="text-sm font-bold text-[#193953]">
              ₹{activeInputs.perPersonBudgetINR.toLocaleString('en-IN')}/person
            </strong>
          </div>
        </div>

        {/* Travel Window Times */}
        <div className="p-5 sm:p-6 border-t border-[#E1ECF2] grid sm:grid-cols-2 gap-4 text-sm bg-white">
          <div className="rounded-xl border border-[#E1ECF2] bg-[#F4F9FC] p-3.5">
            <span className="block text-xs font-semibold uppercase text-[#176EA8]">Leave Bengaluru</span>
            <strong className="mt-1 block text-[#193953]">
              {formatReadableDateTime(activeInputs.departureDateTime)} (IST)
            </strong>
            <span className="text-xs text-[#5A7184]">Origin: MG Road reference corridor</span>
          </div>
          <div className="rounded-xl border border-[#E1ECF2] bg-[#F4F9FC] p-3.5">
            <span className="block text-xs font-semibold uppercase text-[#176EA8]">Must Be Home By</span>
            <strong className="mt-1 block text-[#193953]">
              {formatReadableDateTime(activeInputs.returnDeadlineDateTime)} (IST)
            </strong>
            <span className="text-xs text-[#5A7184]">
              Expected arrival: {formatReadableDateTime(r.homeArrivalTime)}
            </span>
          </div>
        </div>
      </div>

      {/* Section B: Feasibility Verdict Card */}
      <div className="rounded-2xl border border-[#E1ECF2] bg-white p-6 text-[#193953] shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="rounded-full bg-[#DDF0F6] border border-[#176EA8]/30 px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#176EA8]">
            Feasibility Verdict
          </span>
          <span className="text-xs text-[#5A7184]">MG Road reference origin</span>
        </div>

        <div>
          <p className="text-3xl font-black tracking-tight text-[#193953]">{r.rating}</p>
          <p className="mt-1 text-sm text-[#5A7184]">{r.ratingExplanation}</p>
        </div>

        <div className="grid grid-cols-2 gap-4 border-t border-[#E1ECF2] pt-4 text-sm">
          <div>
            <p className="text-xs text-[#5A7184]">Usable destination free time</p>
            <strong className="text-2xl font-black text-[#193953]">
              {formatDuration(r.destinationSlackMinutes)}
            </strong>
          </div>
          <div>
            <p className="text-xs text-[#5A7184]">Return deadline margin</p>
            <strong
              className={`text-2xl font-black ${
                r.returnDeadlineMarginMinutes < 0 ? 'text-red-700' : 'text-emerald-700'
              }`}
            >
              {formatDuration(r.returnDeadlineMarginMinutes, true)}
            </strong>
          </div>
        </div>

        <div className="border-t border-[#E1ECF2] pt-3 text-xs text-[#5A7184] space-y-1">
          <p>
            Expected home: <strong className="text-[#193953]">{formatReadableDateTime(r.homeArrivalTime)} (IST)</strong>
          </p>
          <p>
            Estimated cost: <strong className="text-[#193953]">₹{r.estimatedCostPerPersonINR.toLocaleString('en-IN')}/person</strong> (₹{r.estimatedTripTotalINR.toLocaleString('en-IN')} total for party of {activeInputs.partySize})
          </p>
        </div>
      </div>

      {/* Section C: Route & Stop Highlights with External Links */}
      <div className="space-y-4 rounded-2xl border border-[#E1ECF2] bg-white p-5 sm:p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-[#193953]">Route & Landmark Destinations</h2>
          <a
            href={googleMapsDirectionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-bold text-[#176EA8] hover:underline"
          >
            Open in Google Maps ↗
          </a>
        </div>

        {/* Selected Pitstop Highlight */}
        {selectedStops.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
              <span className="font-bold text-amber-900 text-xs uppercase tracking-wider">
                ☕ Selected Highway Pitstops
              </span>
              <span className="rounded bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 text-[11px] font-bold">
                {selectedStops.length} Stop{selectedStops.length > 1 ? 's' : ''}
              </span>
            </div>
            {selectedStops.map(stop => (
              <div key={stop.id} className="flex gap-3 items-center pt-1 border-t border-amber-200/50 first:border-t-0">
                <div className="text-xs text-[#5A7184] flex-1">
                  <strong className="block text-sm text-[#193953]">{stop.name}</strong>
                  <p className="mt-0.5">
                    Est. Dwell: {stop.dwellMinutes}m · Detour: {stop.detourMinutes}m (+{stop.dwellMinutes + stop.detourMinutes}m total)
                    {stop.replacesArrivalMeal && <span className="text-[#176EA8] ml-1 font-semibold">· Replaces arrival meal break</span>}
                  </p>
                </div>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(stop.name)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg bg-white border border-[#E1ECF2] px-3 py-1.5 text-xs font-bold text-[#176EA8] hover:bg-slate-50 transition-colors"
                >
                  Directions ↗
                </a>
              </div>
            ))}
          </div>
        )}

        {/* Planned Attractions & Custom Activities */}
        <div className="space-y-2">
          <span className="block text-xs font-bold text-[#5A7184] uppercase tracking-wider">
            Planned Attractions & Activities
          </span>
          <div className="grid gap-2 sm:grid-cols-2">
            {dest.activities.map(a => {
              const isSkipped = activeInputs.disabledActivityIds.includes(a.id);
              const aImg = getPlaceImage(a.id);
              return (
                <div
                  key={a.id}
                  className={`flex items-center gap-3 rounded-xl border p-2.5 text-xs ${
                    isSkipped ? 'border-[#E1ECF2] bg-[#F4F9FC] opacity-60' : 'border-[#E1ECF2] bg-white'
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
                    <strong className="block text-[#193953] truncate">{a.name}</strong>
                    <span className="text-[#5A7184]">
                      {isSkipped ? 'Skipped' : `${formatDuration(a.durationMinutes)} planned visit`}
                    </span>
                  </div>
                  {!isSkipped && (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(a.name + ', ' + dest.name)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded bg-[#F4F9FC] border border-[#E1ECF2] px-2 py-1 text-[10px] font-bold text-[#176EA8] hover:bg-slate-100 transition-colors"
                      title="Search landmark on Google Maps"
                    >
                      Map ↗
                    </a>
                  )}
                </div>
              );
            })}

            {/* Custom planned activities */}
            {(activeInputs.customActivities ?? []).map(ca => (
              <div
                key={ca.id}
                className="flex items-center gap-3 rounded-xl border border-[#176EA8]/30 bg-[#DDF0F6]/70 p-2.5 text-xs"
              >
                <div className="h-10 w-10 rounded-lg bg-[#176EA8] text-white flex items-center justify-center text-base font-bold flex-shrink-0">
                  ✨
                </div>
                <div className="min-w-0 flex-1">
                  <strong className="block text-[#193953] truncate">{ca.name}</strong>
                  <span className="text-[#176EA8] font-semibold">
                    Day {ca.day} · {ca.durationMinutes}m · {ca.costPerPersonINR ? `₹${ca.costPerPersonINR}` : 'Free'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Section D: Day-by-Day Itinerary Review Card */}
      <div className="space-y-5 rounded-2xl border border-[#E1ECF2] bg-white p-5 sm:p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-[#193953]">Day-by-Day Itinerary Review</h2>
            <p className="text-xs text-[#5A7184]">
              Hour-by-hour breakdown of highway driving, stops, and leisure windows.
            </p>
          </div>
          <span className="rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-bold text-emerald-800">
            Verified Engine Schedule
          </span>
        </div>

        {/* Day-by-Day Itinerary Cards (Dynamic 1 to 4 Days) */}
        {availableDays.map(day => {
          const items = r.timeline.filter(t => t.day === day && t.category !== 'REST');
          const dayDate = r.timeline.find(t => t.day === day)?.startTime;
          return (
            <div key={day} className="rounded-xl border border-[#E1ECF2] bg-[#F4F9FC] p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-[#E1ECF2] pb-2">
                <h3 className="text-sm font-extrabold text-[#193953] uppercase tracking-wide">
                  Day {day} {dayDate && <span className="text-xs font-normal text-[#5A7184] lowercase">· {formatReadableDate(dayDate)}</span>}
                </h3>
                <span className="text-[11px] font-semibold text-[#5A7184]">
                  {items.length} segments
                </span>
              </div>

              <div className="space-y-2">
                {items.map(item => {
                  const isPitstop = item.category === 'PITSTOP';
                  const isFree = item.category === 'FREE';
                  const isDrive = item.category === 'DRIVE';
                  const isActivity = item.category === 'ACTIVITY';
                  const isCustom = item.isCustom;
                  const duration = Math.round((parseIST(item.endTime) - parseIST(item.startTime)) / 60_000);

                  return (
                    <div
                      key={item.id}
                      className={`flex items-center justify-between gap-3 rounded-lg border p-2.5 text-xs transition-colors ${
                        isFree
                          ? 'border-emerald-200 bg-emerald-50/80 text-emerald-900 font-medium'
                          : isPitstop
                          ? 'border-amber-200 bg-amber-50/80 text-amber-900 font-semibold'
                          : isDrive
                          ? 'border-blue-200 bg-blue-50/80 text-blue-900'
                          : isCustom
                          ? 'border-[#176EA8]/40 bg-[#DDF0F6] text-[#193953] font-semibold'
                          : isActivity
                          ? 'border-purple-200 bg-purple-50/80 text-purple-900'
                          : 'border-[#E1ECF2] bg-white text-[#193953]'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <span className="font-semibold text-[#193953]">{item.label}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 text-[#5A7184]">
                        <span>
                          {formatTimelineTime(item.startTime)} - {formatTimelineTime(item.endTime)}
                        </span>
                        <span className="font-bold text-[#193953]">({formatDuration(duration)})</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Expandable Plain-Text Preview for Copying */}
        <details className="group border-t border-[#E1ECF2] pt-3">
          <summary className="cursor-pointer text-xs font-bold text-[#176EA8] hover:underline select-none flex items-center justify-between">
            <span>Show plain-text messaging preview</span>
            <span className="group-open:rotate-180 transition-transform">▼</span>
          </summary>
          <div className="mt-3">
            <pre className="max-h-56 overflow-y-auto whitespace-pre-wrap rounded-xl border border-[#E1ECF2] bg-[#F4F9FC] p-4 text-xs text-[#193953] font-mono leading-relaxed">
              {summaryText}
            </pre>
          </div>
        </details>
      </div>

      {/* Section E: Save & Share Actions */}
      <div className="space-y-4 rounded-2xl border border-[#176EA8]/30 bg-[#DDF0F6]/50 p-5 sm:p-6 shadow-sm">
        <div>
          <h2 className="text-base font-bold text-[#193953]">Save & Share Trip</h2>
          <p className="text-xs text-[#5A7184]">
            Save this itinerary to your browser storage, or share with your crew via WhatsApp.
          </p>
        </div>

        {/* If guest view, also provide RSVP action in Section E */}
        {isGuestView && (
          <div className="rounded-xl border border-[#BAE3F1] bg-white p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#176EA8]">Guest RSVP</span>
              <span className="text-xs text-[#5A7184]">Confirm spot with {organizerName || 'organizer'}</span>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                maxLength={40}
                placeholder="Your name to RSVP"
                value={guestName}
                onChange={e => {
                  setGuestError('');
                  setGuestName(cleanInputDisplayName(e.target.value));
                }}
                className="flex-1 rounded-xl border border-[#E1ECF2] p-2.5 text-xs text-[#193953] placeholder:text-[#5A7184]/60 focus:border-[#176EA8] focus:outline-none"
              />
              <button
                type="button"
                onClick={handleGuestRSVP}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-[#25D366] px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-[#20ba5a] active:scale-[0.99] transition-all cursor-pointer"
              >
                <span>💬</span> Join & Send RSVP
              </button>
            </div>
            {guestError && <p className="text-xs font-semibold text-red-700">{guestError}</p>}
            {rsvpSent && (
              <p className="text-xs font-semibold text-emerald-800">✓ WhatsApp opened with your RSVP message.</p>
            )}
          </div>
        )}

        {/* Primary Action Buttons: Save My Trip & Copy Share Link */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={handleSaveTrip}
            className={`w-full flex items-center justify-center gap-2 rounded-xl py-3.5 px-4 text-sm font-bold text-white shadow-xs transition-all cursor-pointer ${
              savedSuccess
                ? 'bg-emerald-600 hover:bg-emerald-700'
                : 'bg-[#176EA8] hover:bg-[#135a8a]'
            }`}
          >
            <span>{savedSuccess ? '✓' : '💾'}</span>
            <span>{savedSuccess ? 'Saved to My Trip!' : 'Save My Trip (This Device)'}</span>
          </button>

          <button
            onClick={handleCopyTripLink}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-[#E1ECF2] bg-white py-3.5 px-4 text-sm font-bold text-[#193953] shadow-xs hover:bg-slate-50 active:scale-[0.99] transition-all cursor-pointer"
          >
            <span>🔗</span>
            <span>Share Trip (Copy Link)</span>
          </button>
        </div>

        {/* WhatsApp Sharing Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
          <button
            onClick={handleShareInviteWhatsApp}
            className="flex items-center justify-center gap-2 rounded-xl bg-[#25D366] px-3.5 py-3 text-xs font-bold text-white shadow-xs hover:bg-[#20ba5a] active:scale-[0.99] transition-all cursor-pointer"
          >
            <span>💬</span> WhatsApp Invite
          </button>
          <button
            onClick={handleCopySummary}
            className="flex items-center justify-center gap-2 rounded-xl border border-[#E1ECF2] bg-white px-3.5 py-3 text-xs font-bold text-[#193953] hover:bg-slate-50 shadow-xs active:scale-[0.99] transition-all cursor-pointer"
          >
            <span>📋</span> Copy Text Summary
          </button>
          <button
            onClick={handleShareSummaryWhatsApp}
            className="flex items-center justify-center gap-2 rounded-xl border border-[#E1ECF2] bg-white px-3.5 py-3 text-xs font-bold text-[#193953] hover:bg-slate-50 shadow-xs active:scale-[0.99] transition-all cursor-pointer"
          >
            <span>💬</span> WhatsApp Summary
          </button>
        </div>

        {/* Local Storage Disclosure */}
        <p className="text-[11px] text-[#5A7184] bg-white p-3 rounded-xl border border-[#E1ECF2] leading-relaxed">
          ℹ️ <strong>Account-Free Storage:</strong> "Save My Trip" bookmarks your plan locally in this browser. No login or account required. Clearing browser cache will remove it. To share across devices or with your crew, use the WhatsApp invitation link.
        </p>

        {/* Toast confirmation feedback */}
        {toastMessage && (
          <p
            role="status"
            className="text-center text-sm font-semibold text-[#176EA8] animate-fade-in py-1"
          >
            ✓ {toastMessage}
          </p>
        )}
      </div>

      <p className="text-center text-xs text-[#5A7184]">
        Cost assumes {activeInputs.partySize} travelers sharing a car and room. Meals and personal expenses excluded. Route durations and most costs are unverified planning estimates.
      </p>
    </section>
  );
}
