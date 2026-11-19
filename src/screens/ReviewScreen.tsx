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
  const [whatsappOpened, setWhatsappOpened] = useState(false);

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

    setWhatsappOpened(true);
    window.open(buildWhatsAppShareUrl(text), '_blank', 'noopener,noreferrer');
  };

  // Evaluate feasibility using the deterministic engine
  const r = evaluateFeasibility(dest, activeInputs);

  const isNotRecommended = r.rating === 'Not Recommended' || r.returnDeadlineMarginMinutes < 0;
  const isTight = r.rating === 'Tight' && !isNotRecommended;
  const blockers = r.violations.filter(v => v.severity === 'BLOCKER');
  const warnings = r.violations.filter(v => v.severity === 'WARNING');

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

      {/* Screen Hero Banner with Warm Scenic Layers - Honest Header based on Feasibility */}
      <div
        className={`relative overflow-hidden rounded-2xl sm:rounded-3xl border p-4 sm:p-6 transition-all ${
          isNotRecommended
            ? 'bg-gradient-to-b from-rose-50/90 via-[#FAF2EB] to-[#FFF7F0] border-rose-300'
            : isTight
            ? 'bg-gradient-to-b from-amber-50/80 via-[#FAF2EB] to-[#FFF7F0] border-amber-300'
            : 'bg-gradient-to-b from-[#F8E1D2]/50 via-[#FAF2EB] to-[#FFF7F0] border-[#EADBCE]'
        }`}
      >
        <ScenicBackground variant="compact" />
        <div className="relative z-10 flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-1">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold border shadow-2xs ${
                isNotRecommended
                  ? 'bg-rose-100 text-rose-800 border-rose-200'
                  : isTight
                  ? 'bg-amber-100 text-amber-900 border-amber-200'
                  : 'bg-white text-[#C65B32] border-[#EADBCE]'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  isNotRecommended ? 'bg-rose-600' : isTight ? 'bg-amber-600' : 'bg-[#C65B32]'
                }`}
              />
              {isNotRecommended
                ? 'Schedule Alert · Return Blocker Detected'
                : isTight
                ? 'Step 4 · Trip Review · Tight Schedule'
                : 'Step 4 · Final Reality Check & RSVP'}
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-[#344F48] tracking-tight leading-snug">
              {isNotRecommended
                ? 'Schedule requires adjustments'
                : isTight
                ? 'Trip confirmed with narrow buffers'
                : 'Ready to hit the road?'}
            </h1>
            <p className="text-xs sm:text-sm text-[#6B7C77] max-w-xl leading-relaxed">
              {isNotRecommended
                ? 'Return blockers or timing conflicts detected. Review issues below before locking your road trip.'
                : isTight
                ? 'Review your tight return margin, transparent vehicle fleet costs, and invite your crew via WhatsApp.'
                : 'Review your return deadline margin, transparent vehicle fleet costs, and invite your crew via WhatsApp.'}
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
              <strong>Trip Invitation from {organizerName || 'your organizer'}:</strong> Review the planned timeline below, then send your RSVP via WhatsApp.
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

      {/* Prominent Blocker Alert Box (if Not Recommended or violations exist) */}
      {isNotRecommended && (
        <div className="rounded-2xl border-2 border-rose-300 bg-rose-50/70 p-4 sm:p-5 text-rose-950 space-y-3 shadow-xs">
          <div className="flex items-center gap-2">
            <span className="text-xl">⚠️</span>
            <h2 className="text-sm sm:text-base font-extrabold text-rose-900 uppercase tracking-wide">
              Critical Schedule Blockers
            </h2>
          </div>
          <ul className="space-y-1.5 text-xs text-rose-900 list-disc list-inside">
            {r.returnDeadlineMarginMinutes < 0 && (
              <li>
                <strong>Missed Return Deadline:</strong> Projected home arrival is {formatReadableDateTime(r.homeArrivalTime)}, which is <strong>{formatDuration(Math.abs(r.returnDeadlineMarginMinutes))} after your deadline</strong> ({formatReadableDateTime(activeInputs.returnDeadlineDateTime)}).
              </li>
            )}
            {blockers.map((b, i) => (
              <li key={`blocker-${i}`}>
                <strong>{b.type.replace(/_/g, ' ')}:</strong> {b.message}
              </li>
            ))}
            {warnings.map((w, i) => (
              <li key={`warn-${i}`}>
                <strong>{w.type.replace(/_/g, ' ')}:</strong> {w.message}
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-rose-800 pt-1 border-t border-rose-200">
            💡 Recommended action: Use <strong>← Edit Schedule</strong> above to adjust departure time, prune optional activities, or extend your return deadline.
          </p>
        </div>
      )}

      {/* Section A: Concise Destination Hero Card */}
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
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/10" />
          <div className="absolute bottom-3 left-4 right-4 flex flex-wrap items-end justify-between gap-2 text-white">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[#C65B32] px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider backdrop-blur-xs">
                  {isGroup ? 'Group Escape' : 'Solo Road Trip'}
                </span>
                <span className="rounded-full bg-black/50 px-2.5 py-0.5 text-xs font-medium backdrop-blur-xs">
                  {formatReadableDate(activeInputs.departureDateTime)} – {formatReadableDate(activeInputs.returnDeadlineDateTime)}
                </span>
              </div>
              <h2 className="mt-1 text-2xl sm:text-3xl font-black">{dest.name}</h2>
              <p className="text-xs text-white/80">{dest.routeName}</p>
            </div>
            
            <div className="flex flex-col items-end gap-1">
              <span
                className={`rounded-xl px-3 py-1 text-xs font-extrabold uppercase tracking-wide border shadow-xs ${
                  r.rating === 'Not Recommended'
                    ? 'bg-rose-600 text-white border-rose-700'
                    : r.rating === 'Tight'
                    ? 'bg-amber-500 text-white border-amber-600'
                    : 'bg-emerald-600 text-white border-emerald-700'
                }`}
              >
                {r.rating === 'Tight' ? 'Tight Schedule' : r.rating}
              </span>
              {heroImage && (
                <span className="text-[10px] text-white/70 bg-black/60 px-2 py-0.5 rounded backdrop-blur-xs">
                  Photo: {heroImage.author} · {heroImage.license}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Core Trip Parameters Bar */}
        <div className="p-4 sm:p-5 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs border-t border-[#EADBCE] bg-[#FAF2EB]">
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
      </div>

      {/* Section B: Immediate 3 Primary Facts Bar */}
      <div className="rounded-2xl sm:rounded-3xl border border-[#EADBCE] bg-white p-5 sm:p-6 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 divide-y sm:divide-y-0 sm:divide-x divide-[#EADBCE]">
          {/* Fact 1: Expected Home Arrival */}
          <div className="sm:pr-4 pt-2 sm:pt-0">
            <span className="block text-[11px] font-bold uppercase tracking-wider text-[#6B7C77]">
              Expected Home Arrival
            </span>
            <strong className="mt-1 block text-lg sm:text-xl font-black text-[#344F48]">
              {formatReadableDateTime(r.homeArrivalTime)}
            </strong>
            <span className="text-xs text-[#6B7C77] block mt-0.5">
              Deadline: {formatTimelineTime(activeInputs.returnDeadlineDateTime)} (IST)
            </span>
          </div>

          {/* Fact 2: Return Deadline Margin */}
          <div className="sm:px-4 pt-3 sm:pt-0">
            <span className="block text-[11px] font-bold uppercase tracking-wider text-[#6B7C77]">
              Return Deadline Margin
            </span>
            <strong
              className={`mt-1 block text-lg sm:text-xl font-black ${
                r.returnDeadlineMarginMinutes < 0 ? 'text-rose-700' : 'text-emerald-700'
              }`}
            >
              {formatDuration(r.returnDeadlineMarginMinutes, true)}
            </strong>
            <span className="text-xs text-[#6B7C77] block mt-0.5">
              {r.returnDeadlineMarginMinutes >= 0 ? 'Buffer before deadline' : 'Projected late return'}
            </span>
          </div>

          {/* Fact 3: Estimated Cost Per Traveler */}
          <div className="sm:pl-4 pt-3 sm:pt-0">
            <span className="block text-[11px] font-bold uppercase tracking-wider text-[#6B7C77]">
              Estimated Cost Per Traveler
            </span>
            <strong className="mt-1 block text-lg sm:text-xl font-black text-[#C65B32]">
              ₹{r.estimatedCostPerPersonINR.toLocaleString('en-IN')}
            </strong>
            <span className="text-xs text-[#6B7C77] block mt-0.5">
              ₹{r.estimatedTripTotalINR.toLocaleString('en-IN')} total ({activeInputs.partySize} {activeInputs.partySize === 1 ? 'traveler' : 'travelers'})
            </span>
          </div>
        </div>
      </div>

      {/* Section C: Clear Action-Oriented Hierarchy (Save Trip, Share Trip, WhatsApp Invite) */}
      <div className="space-y-4 rounded-2xl sm:rounded-3xl border border-[#EADBCE] bg-[#FAF2EB]/70 p-5 sm:p-6 shadow-sm">
        <div>
          <h2 className="text-base font-black text-[#344F48]">Save & Share Trip</h2>
          <p className="text-xs text-[#6B7C77]">
            Lock this verified itinerary locally to this device, or invite your group via WhatsApp.
          </p>
        </div>

        {/* Primary Action Buttons */}
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

        {/* Supporting Quick Options */}
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

        {/* Guest RSVP Card (Active only on shared guest view) */}
        {isGuestView && (
          <div id="guest-rsvp" className="rounded-xl border border-[#EADBCE] bg-white p-4 space-y-3 shadow-2xs mt-3">
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
            {guestError && <p className="text-xs font-semibold text-rose-700">{guestError}</p>}
            {whatsappOpened && (
              <p className="text-xs font-semibold text-emerald-800">
                ✓ WhatsApp opened. Send the message there to complete your RSVP.
              </p>
            )}
            <p className="text-[11px] text-[#6B7C77] pt-1 border-t border-[#EADBCE]">
              ℹ️ Guest RSVP is sent directly to your organizer via WhatsApp. Guest actions on this link never modify the organizer's original trip schedule.
            </p>
          </div>
        )}

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

      {/* Section D: Progressive Disclosure Accordion 1 - Vehicle Fleet & Cost Sharing */}
      <details className="group rounded-2xl sm:rounded-3xl border border-[#EADBCE] bg-white p-5 sm:p-6 shadow-sm">
        <summary className="flex items-center justify-between cursor-pointer select-none">
          <div className="flex items-center gap-2">
            <span className="text-lg">🚗</span>
            <div>
              <h2 className="text-base font-black text-[#344F48]">Vehicle Fleet & Cost Sharing</h2>
              <p className="text-xs text-[#6B7C77]">
                Transparent cost model for {activeInputs.partySize} {activeInputs.partySize === 1 ? 'traveler' : 'travelers'} ({fleet.badge})
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-[#FAF2EB] border border-[#EADBCE] px-3 py-1 text-xs font-bold text-[#C65B32]">
              ₹{r.estimatedCostPerPersonINR.toLocaleString('en-IN')}/person
            </span>
            <span className="text-[#6B7C77] group-open:rotate-180 transition-transform">▼</span>
          </div>
        </summary>
        <div className="mt-4 space-y-3 pt-3 border-t border-[#EADBCE]">
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
      </details>

      {/* Section E: Progressive Disclosure Accordion 2 - Day-by-Day Itinerary Review */}
      <details className="group rounded-2xl sm:rounded-3xl border border-[#EADBCE] bg-white p-5 sm:p-6 shadow-sm">
        <summary className="flex items-center justify-between cursor-pointer select-none">
          <div className="flex items-center gap-2">
            <span className="text-lg">📅</span>
            <div>
              <h2 className="text-base font-black text-[#344F48]">Day-by-Day Itinerary Review</h2>
              <p className="text-xs text-[#6B7C77]">
                Hour-by-hour breakdown across {availableDays.length} {availableDays.length === 1 ? 'day' : 'days'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-[#FAF2EB] border border-[#EADBCE] px-3 py-1 text-xs font-bold text-[#5F7B6B]">
              Verified Schedule
            </span>
            <span className="text-[#6B7C77] group-open:rotate-180 transition-transform">▼</span>
          </div>
        </summary>
        <div className="mt-4 space-y-4 pt-3 border-t border-[#EADBCE]">
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
        </div>
      </details>

      {/* Section F: Progressive Disclosure Accordion 3 - Route & Planned Places */}
      <details className="group rounded-2xl sm:rounded-3xl border border-[#EADBCE] bg-white p-5 sm:p-6 shadow-sm">
        <summary className="flex items-center justify-between cursor-pointer select-none">
          <div className="flex items-center gap-2">
            <span className="text-lg">📍</span>
            <div>
              <h2 className="text-base font-black text-[#344F48]">Route & Planned Places</h2>
              <p className="text-xs text-[#6B7C77]">
                {dest.activities.length} attractions, {selectedStops.length} highway pitstops, and custom stops
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={googleMapsDirectionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="text-xs font-bold text-[#C65B32] hover:underline"
            >
              Open in Google Maps ↗
            </a>
            <span className="text-[#6B7C77] group-open:rotate-180 transition-transform">▼</span>
          </div>
        </summary>
        <div className="mt-4 space-y-4 pt-3 border-t border-[#EADBCE]">
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
      </details>

      {/* Section G: Progressive Disclosure Accordion 4 - Plain-Text Messaging Summary */}
      <details className="group rounded-2xl sm:rounded-3xl border border-[#EADBCE] bg-white p-5 sm:p-6 shadow-sm">
        <summary className="flex items-center justify-between cursor-pointer select-none">
          <div className="flex items-center gap-2">
            <span className="text-lg">📋</span>
            <div>
              <h2 className="text-base font-black text-[#344F48]">Plain-Text Messaging Summary</h2>
              <p className="text-xs text-[#6B7C77]">
                Clean unformatted text formatted for messaging apps, notes, or team chats
              </p>
            </div>
          </div>
          <span className="text-[#6B7C77] group-open:rotate-180 transition-transform">▼</span>
        </summary>
        <div className="mt-4 space-y-3 pt-3 border-t border-[#EADBCE]">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleCopySummary}
              className="text-xs font-bold text-[#C65B32] hover:underline cursor-pointer"
            >
              Copy Full Text 📋
            </button>
          </div>
          <pre className="max-h-60 overflow-y-auto whitespace-pre-wrap rounded-xl border border-[#EADBCE] bg-[#FAF2EB] p-4 text-xs text-[#344F48] font-mono leading-relaxed">
            {summaryText}
          </pre>
        </div>
      </details>

      {/* Section H: Honest Planning Assumptions & Disclosures */}
      <div className="rounded-2xl sm:rounded-3xl border border-[#EADBCE] bg-[#FAF2EB]/70 p-5 sm:p-6 space-y-3 text-xs text-[#6B7C77] leading-relaxed">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#344F48]">
          Planning Assumptions & Disclosures
        </h3>
        <ul className="space-y-2 list-none">
          <li className="flex items-start gap-2">
            <span className="text-base leading-none">🚗</span>
            <span>
              <strong>20% Driving Contingency:</strong> Highway travel times include a mandatory 20% traffic buffer above Google Maps / OSM baseline times. This is a deterministic planning assumption, not live GPS traffic.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-base leading-none">💰</span>
            <span>
              <strong>Transparent Estimated Costs:</strong> Cost per person assumes {activeInputs.partySize} {activeInputs.partySize === 1 ? 'traveler' : 'travelers'} sharing {fleet.vehicles} vehicle{fleet.vehicles > 1 ? 's' : ''} and {Math.ceil(activeInputs.partySize / 2)} twin-sharing hotel room{Math.ceil(activeInputs.partySize / 2) > 1 ? 's' : ''}. Personal meals, activities, and discretionary shopping are excluded.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-base leading-none">🔒</span>
            <span>
              <strong>Account-Free Device Storage:</strong> "Save Trip" saves your itinerary locally to this browser's <code>localStorage</code>. No account creation or cloud sync is involved. Clearing your browser data will delete it. To share across devices or with your crew, use the share link or WhatsApp invite.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-base leading-none">📍</span>
            <span>
              <strong>Reference Corridor:</strong> Calculations use MG Road, Bengaluru as the common origin and final arrival point. Actual travel time within Bengaluru city limits before hitting the highway corridor may vary.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-base leading-none">🔗</span>
            <span>
              <strong>Shareable Link Fidelity:</strong> Shared trip links serialize your complete customized itinerary: departure/return dates, party size, budget, vehicle fleet, selected highway stops, reordered activities, moved days, custom visit times, and transfer allowances. Guests opening the link enter in read-only preview mode and can RSVP via WhatsApp without altering your saved itinerary.
            </span>
          </li>
        </ul>
      </div>
    </section>
  );
}
