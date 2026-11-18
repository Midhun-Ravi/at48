import { useState, useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import type { Dispatch, SetStateAction } from 'react';
import type { UserConstraints } from '../types';
import { getDestination } from '../data/destinations';
import { getCompatiblePitstops } from '../data/pitstops';
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
import TactileButton from '../components/ui/TactileButton';
import ScenicBackground from '../components/scenic/ScenicBackground';

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
            className="inline-block rounded-xl bg-[#C65B32] px-5 py-3 text-sm font-bold text-white hover:bg-[#B04E27] transition-colors"
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
      <div className="mx-auto max-w-xl space-y-4 py-8 text-center text-[#344F48]">
        <p className="text-lg font-bold text-[#344F48]">Unknown destination.</p>
        <Link to="/compare" className="text-[#C65B32] underline font-semibold">
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

  // Vehicle fleet modeling
  const partySize = activeInputs.partySize;
  const getFleetInfo = (size: number) => {
    if (size <= 4) {
      return {
        label: '1 Standard Car (Hatchback/Sedan)',
        badge: '1 Car',
        vehicles: 1,
        note: 'Fits 1–4 adults comfortably. 1x fuel and toll calculations apply.',
      };
    }
    if (size <= 6) {
      return {
        label: '1 Large SUV (6-Seater Innova / Safari)',
        badge: '1 SUV',
        vehicles: 1,
        note: 'Single 6-seater SUV. 1x vehicle fuel and toll calculations apply.',
      };
    }
    const count = Math.ceil(size / 5);
    return {
      label: `${count} Vehicles (Multi-Car Convoy or Tempo Traveller)`,
      badge: `${count} Cars / Tempo`,
      vehicles: count,
      note: `For ${size} travelers, models ${count} vehicles or a 12/17-seater Tempo Traveller. Fuel and toll budgets scale proportionally.`,
    };
  };

  const fleet = getFleetInfo(partySize);

  return (
    <section className="relative mx-auto max-w-3xl space-y-6 w-full min-w-0">
      {/* 4-part segmented progress meter */}
      <ProgressBar currentStep={4} />

      {/* Screen Hero Banner with Warm Scenic Layers */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-b from-[#F8E1D2]/50 via-[#FAF2EB] to-[#FFF7F0] p-4 sm:p-6 border border-[#EADBCE]">
        <ScenicBackground variant="compact" />
        <div className="relative z-10 flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[11px] font-bold text-[#C65B32] border border-[#EADBCE] shadow-2xs">
              <span className="h-1.5 w-1.5 rounded-full bg-[#C65B32]" />
              Step 4 · Final Reality Check & RSVP
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-[#344F48] tracking-tight leading-snug">
              Ready to hit the road?
            </h1>
            <p className="text-xs sm:text-sm text-[#6B7C77] max-w-xl leading-relaxed">
              Review your return deadline margin, transparent vehicle fleet costs, and invite your crew via WhatsApp.
            </p>
          </div>

          <Link
            to={editUrl}
            className="text-xs font-bold text-[#C65B32] hover:text-[#B04E27] hover:underline transition-colors"
          >
            ← Edit Schedule
          </Link>
        </div>
      </div>

      {/* Guest Invitation Notice (if opening shared link) */}
      {isGuestView && (
        <div className="rounded-2xl border border-[#EADBCE] bg-[#FAF2EB] p-4 text-xs text-[#344F48] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">🚗</span>
            <span>
              <strong>Trip Invitation from {organizerName || 'your organizer'}:</strong> Review the planned timeline below, then send your RSVP at the bottom of the page.
            </span>
          </div>
          <a
            href="#guest-rsvp"
            className="rounded-xl bg-[#C65B32] text-white px-3.5 py-1.5 font-bold text-xs hover:bg-[#B04E27] transition-colors whitespace-nowrap self-end sm:self-auto shadow-2xs"
          >
            Jump to RSVP ↓
          </a>
        </div>
      )}

      {/* Section A: Trip Overview Hero Card */}
      <div className="overflow-hidden rounded-2xl sm:rounded-3xl border border-[#EADBCE] bg-white shadow-sm">
        {/* Destination Photo Header */}
        <div className="relative aspect-[16/9] sm:aspect-[21/9] w-full bg-slate-100 overflow-hidden">
          {heroImage && (
            <img
              src={heroImage.src}
              alt={heroImage.alt}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
          <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between text-white">
            <div>
              <span className="rounded-full bg-[#C65B32] px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider backdrop-blur-xs">
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
        <div className="p-4 sm:p-6 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs border-t border-[#EADBCE] bg-[#FAF2EB]">
          <div>
            <span className="block text-[#6B7C77] font-medium">Organizer</span>
            <strong className="text-sm font-bold text-[#344F48]">
              {organizerName || (isGroup ? 'Trip Organizer' : 'Solo Traveler')}
            </strong>
          </div>
          <div>
            <span className="block text-[#6B7C77] font-medium">Party Size</span>
            <strong className="text-sm font-bold text-[#344F48]">
              {activeInputs.partySize} {activeInputs.partySize === 1 ? 'traveler' : 'travelers'}
            </strong>
          </div>
          <div>
            <span className="block text-[#6B7C77] font-medium">Corridor Distance</span>
            <strong className="text-sm font-bold text-[#344F48]">
              {dest.oneWayDistanceKm} km one-way
            </strong>
          </div>
          <div>
            <span className="block text-[#6B7C77] font-medium">Target Budget</span>
            <strong className="text-sm font-bold text-[#344F48]">
              ₹{activeInputs.perPersonBudgetINR.toLocaleString('en-IN')}/person
            </strong>
          </div>
        </div>

        {/* Travel Window Times */}
        <div className="p-4 sm:p-6 border-t border-[#EADBCE] grid sm:grid-cols-2 gap-4 text-sm bg-white">
          <div className="rounded-xl border border-[#EADBCE] bg-[#FAF2EB] p-3.5">
            <span className="block text-xs font-bold uppercase text-[#C65B32]">Leave Bengaluru</span>
            <strong className="mt-1 block text-[#344F48]">
              {formatReadableDateTime(activeInputs.departureDateTime)} (IST)
            </strong>
            <span className="text-xs text-[#6B7C77]">Origin: MG Road reference corridor</span>
          </div>
          <div className="rounded-xl border border-[#EADBCE] bg-[#FAF2EB] p-3.5">
            <span className="block text-xs font-bold uppercase text-[#344F48]">Must Be Home By</span>
            <strong className="mt-1 block text-[#344F48]">
              {formatReadableDateTime(activeInputs.returnDeadlineDateTime)} (IST)
            </strong>
            <span className="text-xs text-[#6B7C77]">
              Expected arrival: {formatReadableDateTime(r.homeArrivalTime)}
            </span>
          </div>
        </div>
      </div>

      {/* Section B: Feasibility Verdict & Return Margin Card */}
      <div className="rounded-2xl sm:rounded-3xl border border-[#EADBCE] bg-white p-5 sm:p-6 text-[#344F48] shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#EADBCE] pb-3">
          <span className="rounded-full bg-[#FAF2EB] border border-[#EADBCE] px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#C65B32]">
            Feasibility Verdict
          </span>
          <span className="text-xs text-[#6B7C77]">Deterministic MG Road baseline</span>
        </div>

        <div>
          <p className="text-2xl sm:text-3xl font-black tracking-tight text-[#344F48]">{r.rating}</p>
          <p className="mt-1 text-xs sm:text-sm text-[#6B7C77]">{r.ratingExplanation}</p>
        </div>

        <div className="grid grid-cols-2 gap-4 border-t border-[#EADBCE] pt-4 text-sm">
          <div>
            <p className="text-xs text-[#6B7C77]">Usable destination free time</p>
            <strong className="text-xl sm:text-2xl font-black text-[#344F48]">
              {formatDuration(r.destinationSlackMinutes)}
            </strong>
          </div>
          <div>
            <p className="text-xs text-[#6B7C77]">Return deadline margin</p>
            <strong
              className={`text-xl sm:text-2xl font-black ${
                r.returnDeadlineMarginMinutes < 0 ? 'text-rose-700' : 'text-emerald-700'
              }`}
            >
              {formatDuration(r.returnDeadlineMarginMinutes, true)}
            </strong>
          </div>
        </div>

        <div className="border-t border-[#EADBCE] pt-3 text-xs text-[#6B7C77] space-y-1">
          <p>
            Expected home: <strong className="text-[#344F48]">{formatReadableDateTime(r.homeArrivalTime)} (IST)</strong>
          </p>
          <p>
            Estimated cost: <strong className="text-[#344F48]">₹{r.estimatedCostPerPersonINR.toLocaleString('en-IN')}/person</strong> (₹{r.estimatedTripTotalINR.toLocaleString('en-IN')} total for party of {activeInputs.partySize})
          </p>
        </div>
      </div>

      {/* Section C: Transparent Vehicle Fleet & Cost Breakdown */}
      <div className="space-y-4 rounded-2xl sm:rounded-3xl border border-[#EADBCE] bg-white p-5 sm:p-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-[#EADBCE] pb-3">
          <div>
            <h2 className="text-base font-black text-[#344F48]">Vehicle Fleet & Cost Sharing</h2>
            <p className="text-xs text-[#6B7C77]">
              Transparent cost-sharing model based on party size of {activeInputs.partySize}.
            </p>
          </div>
          <span className="rounded-full bg-[#FAF2EB] border border-[#EADBCE] px-3 py-1 text-xs font-bold text-[#C65B32]">
            {fleet.badge}
          </span>
        </div>

        <div className="rounded-xl border border-[#EADBCE] bg-[#FAF2EB] p-4 text-xs space-y-2">
          <strong className="block text-sm text-[#344F48]">{fleet.label}</strong>
          <p className="text-[#6B7C77] leading-relaxed">{fleet.note}</p>
          <div className="pt-2 border-t border-[#EADBCE] grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
            <div>
              <span className="text-[#6B7C77] block">Round-Trip Fuel:</span>
              <strong className="text-[#344F48]">₹{(dest.approximateRoundTripFuelINR * fleet.vehicles).toLocaleString('en-IN')}</strong>
            </div>
            <div>
              <span className="text-[#6B7C77] block">Highway Tolls:</span>
              <strong className="text-[#344F48]">₹{(dest.approximateRoundTripTollsINR * fleet.vehicles).toLocaleString('en-IN')}</strong>
            </div>
            <div>
              <span className="text-[#6B7C77] block">Stays ({Math.ceil(activeInputs.partySize / 2)} rooms):</span>
              <strong className="text-[#344F48]">₹{(dest.approximateOneNightStayINR * Math.ceil(activeInputs.partySize / 2)).toLocaleString('en-IN')}</strong>
            </div>
            <div>
              <span className="text-[#6B7C77] block">Cost Per Traveler:</span>
              <strong className="text-[#C65B32] font-black">₹{r.estimatedCostPerPersonINR.toLocaleString('en-IN')}</strong>
            </div>
          </div>
        </div>

        <p className="text-[11px] text-[#6B7C77] leading-relaxed">
          💡 Fuel and toll expenses are divided equally among all {activeInputs.partySize} travelers. Accommodation assumes twin sharing rooms. Personal dining and souvenir purchases are excluded.
        </p>
      </div>

      {/* Section D: Route & Stop Highlights with External Links */}
      <div className="space-y-4 rounded-2xl sm:rounded-3xl border border-[#EADBCE] bg-white p-5 sm:p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-black text-[#344F48]">Route & Landmark Destinations</h2>
          <a
            href={googleMapsDirectionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-bold text-[#C65B32] hover:underline"
          >
            Open in Google Maps ↗
          </a>
        </div>

        {/* Selected Pitstop Highlight */}
        {selectedStops.length > 0 && (
          <div className="rounded-xl border border-[#EADBCE] bg-[#FAF2EB] p-4 space-y-2 text-xs">
            <span className="font-bold text-[#344F48] block uppercase tracking-wider text-[11px]">
              ☕ Selected Highway Pitstops ({selectedStops.length})
            </span>
            {selectedStops.map(stop => (
              <div key={stop.id} className="flex gap-3 items-center pt-1 border-t border-[#EADBCE] first:border-t-0">
                <div className="text-xs text-[#6B7C77] flex-1">
                  <strong className="block text-sm text-[#344F48]">{stop.name}</strong>
                  <p className="mt-0.5">
                    Est. Dwell: {stop.dwellMinutes}m · Detour: {stop.detourMinutes}m (+{stop.dwellMinutes + stop.detourMinutes}m total)
                  </p>
                </div>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(stop.name)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg bg-white border border-[#EADBCE] px-3 py-1.5 text-xs font-bold text-[#C65B32] hover:bg-[#FAF2EB] transition-colors"
                >
                  Directions ↗
                </a>
              </div>
            ))}
          </div>
        )}

        {/* Planned Attractions & Custom Activities */}
        <div className="space-y-2 text-xs">
          <span className="block font-bold text-[#6B7C77] uppercase tracking-wider text-[11px]">
            Planned Attractions & Activities
          </span>
          <div className="grid gap-2 sm:grid-cols-2">
            {dest.activities.map(a => {
              const isSkipped = activeInputs.disabledActivityIds.includes(a.id);
              const aImg = getPlaceImage(a.id);
              return (
                <div
                  key={a.id}
                  className={`flex items-center gap-3 rounded-xl border p-2.5 ${
                    isSkipped ? 'border-[#EADBCE] bg-[#FAF2EB] opacity-60' : 'border-[#EADBCE] bg-white'
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
                    <strong className="block text-[#344F48] truncate">{a.name}</strong>
                    <span className="text-[#6B7C77]">
                      {isSkipped ? 'Skipped' : `${formatDuration(a.durationMinutes)} planned visit`}
                    </span>
                  </div>
                </div>
              );
            })}

            {(activeInputs.customActivities ?? []).map(ca => (
              <div
                key={ca.id}
                className="flex items-center gap-3 rounded-xl border border-[#EADBCE] bg-[#FAF2EB] p-2.5"
              >
                <div className="h-10 w-10 rounded-lg bg-[#C65B32] text-white flex items-center justify-center text-base font-bold flex-shrink-0">
                  ✨
                </div>
                <div className="min-w-0 flex-1">
                  <strong className="block text-[#344F48] truncate">{ca.name}</strong>
                  <span className="text-[#6B7C77]">
                    Day {ca.day} · {ca.durationMinutes}m · {ca.costPerPersonINR ? `₹${ca.costPerPersonINR}` : 'Free'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Section E: Day-by-Day Itinerary Review */}
      <div className="space-y-5 rounded-2xl sm:rounded-3xl border border-[#EADBCE] bg-white p-5 sm:p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#EADBCE] pb-3">
          <div>
            <h2 className="text-base font-black text-[#344F48]">Day-by-Day Itinerary Review</h2>
            <p className="text-xs text-[#6B7C77]">
              Hour-by-hour breakdown of highway driving, stops, and leisure windows.
            </p>
          </div>
          <span className="rounded-full bg-[#FAF2EB] border border-[#EADBCE] px-3 py-1 text-xs font-bold text-[#5F7B6B]">
            Verified Schedule
          </span>
        </div>

        {/* Day-by-Day Cards */}
        {availableDays.map(day => {
          const items = r.timeline.filter(t => t.day === day && t.category !== 'REST');
          const dayDate = r.timeline.find(t => t.day === day)?.startTime;
          return (
            <div key={day} className="rounded-xl border border-[#EADBCE] bg-[#FAF2EB] p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-[#EADBCE] pb-2">
                <h3 className="text-sm font-extrabold text-[#344F48] uppercase tracking-wide">
                  Day {day} {dayDate && <span className="text-xs font-normal text-[#6B7C77] lowercase">· {formatReadableDate(dayDate)}</span>}
                </h3>
                <span className="text-[11px] font-semibold text-[#6B7C77]">
                  {items.length} segments
                </span>
              </div>

              <div className="space-y-2">
                {items.map(item => {
                  const duration = Math.round((parseIST(item.endTime) - parseIST(item.startTime)) / 60_000);

                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-[#EADBCE] bg-white p-2.5 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="font-semibold text-[#344F48]">{item.label}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 text-[#6B7C77]">
                        <span>
                          {formatTimelineTime(item.startTime)} - {formatTimelineTime(item.endTime)}
                        </span>
                        <span className="font-bold text-[#344F48]">({formatDuration(duration)})</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Expandable Plain-Text Preview for Copying */}
        <details className="group border-t border-[#EADBCE] pt-3">
          <summary className="cursor-pointer text-xs font-bold text-[#C65B32] hover:underline select-none flex items-center justify-between">
            <span>Show plain-text messaging preview</span>
            <span className="group-open:rotate-180 transition-transform">▼</span>
          </summary>
          <div className="mt-3">
            <pre className="max-h-56 overflow-y-auto whitespace-pre-wrap rounded-xl border border-[#EADBCE] bg-[#FAF2EB] p-4 text-xs text-[#344F48] font-mono leading-relaxed">
              {summaryText}
            </pre>
          </div>
        </details>
      </div>

      {/* Section F: Save & Share Actions */}
      <div className="space-y-4 rounded-2xl sm:rounded-3xl border border-[#EADBCE] bg-[#FAF2EB]/70 p-5 sm:p-6 shadow-sm">
        <div>
          <h2 className="text-base font-black text-[#344F48]">Save & Share Trip</h2>
          <p className="text-xs text-[#6B7C77]">
            Save this itinerary to your browser storage, or share with your crew via WhatsApp.
          </p>
        </div>

        {/* If guest view, provide the RSVP action (Preserved for tests & guests) */}
        {isGuestView && (
          <div id="guest-rsvp" className="rounded-xl border border-[#EADBCE] bg-white p-4 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#C65B32]">Trip Invitation & RSVP</span>
              <span className="text-xs text-[#6B7C77]">Confirm spot with {organizerName || 'organizer'}</span>
            </div>
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#344F48]">
                Your Name to RSVP
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  maxLength={40}
                  placeholder="e.g. Arun or Priya"
                  value={guestName}
                  onChange={e => {
                    setGuestError('');
                    setGuestName(cleanInputDisplayName(e.target.value));
                  }}
                  className="flex-1 rounded-xl border border-[#EADBCE] p-2.5 text-xs text-[#344F48] placeholder:text-[#6B7C77]/60 focus:border-[#C65B32] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleGuestRSVP}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-[#25D366] px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-[#20ba5a] active:scale-[0.99] transition-all cursor-pointer whitespace-nowrap"
                >
                  <span>💬</span> Join Trip & Send RSVP via WhatsApp
                </button>
              </div>
            </div>
            {guestError && <p className="text-xs font-semibold text-red-700">{guestError}</p>}
            {rsvpSent && (
              <p className="text-xs font-semibold text-emerald-800">✓ WhatsApp opened with your RSVP message.</p>
            )}
          </div>
        )}

        {/* Primary Action Buttons: Prioritize Share Trip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <TactileButton
            variant="primary"
            size="md"
            onClick={handleCopyTripLink}
            className="w-full justify-center"
          >
            <span>🔗</span>
            <span>Share Trip (Copy Link)</span>
          </TactileButton>

          <TactileButton
            variant="secondary"
            size="md"
            onClick={handleSaveTrip}
            className="w-full justify-center"
          >
            <span>{savedSuccess ? '✓' : '💾'}</span>
            <span>{savedSuccess ? 'Saved to My Trip!' : 'Save Trip (This Device)'}</span>
          </TactileButton>
        </div>

        {/* Supporting Quick Sharing Options */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
          <button
            type="button"
            onClick={handleShareInviteWhatsApp}
            className="flex items-center justify-center gap-2 rounded-xl bg-[#25D366] px-3.5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-[#20ba5a] active:scale-[0.99] transition-all cursor-pointer"
          >
            <span>💬</span> WhatsApp Invite
          </button>
          <button
            type="button"
            onClick={handleCopySummary}
            className="flex items-center justify-center gap-2 rounded-xl border border-[#EADBCE] bg-white px-3.5 py-2.5 text-xs font-bold text-[#344F48] hover:bg-[#FAF2EB] shadow-xs active:scale-[0.99] transition-all cursor-pointer"
          >
            <span>📋</span> Copy Text Summary
          </button>
          <button
            type="button"
            onClick={handleShareSummaryWhatsApp}
            className="flex items-center justify-center gap-2 rounded-xl border border-[#EADBCE] bg-white px-3.5 py-2.5 text-xs font-bold text-[#344F48] hover:bg-[#FAF2EB] shadow-xs active:scale-[0.99] transition-all cursor-pointer"
          >
            <span>💬</span> WhatsApp Summary
          </button>
        </div>

        {/* Local Storage Disclosure */}
        <p className="text-[11px] text-[#6B7C77] bg-white p-3 rounded-xl border border-[#EADBCE] leading-relaxed">
          ℹ️ <strong>Account-Free Storage:</strong> "Save Trip" bookmarks your plan locally in this browser. No login or account required. Clearing browser cache will remove it. To share across devices or with your crew, use the WhatsApp invitation link.
        </p>

        {/* Toast confirmation feedback */}
        {toastMessage && (
          <p
            role="status"
            className="text-center text-sm font-semibold text-[#C65B32] animate-fade-in py-1"
          >
            ✓ {toastMessage}
          </p>
        )}
      </div>

      <p className="text-center text-xs text-[#6B7C77]">
        Cost assumes {activeInputs.partySize} travelers sharing {fleet.vehicles} vehicle{fleet.vehicles > 1 ? 's' : ''} and {Math.ceil(activeInputs.partySize / 2)} hotel room{Math.ceil(activeInputs.partySize / 2) > 1 ? 's' : ''}. Personal expenses and meals are excluded. Highway driving times include standard 20% traffic buffers.
      </p>
    </section>
  );
}
