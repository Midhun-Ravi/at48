import { useState, useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import type { Dispatch, SetStateAction } from 'react';
import type { UserConstraints } from '../types';
import { getDestination } from '../data/destinations';
import { getCompatiblePitstops } from '../data/pitstops.js';
import { evaluateFeasibility, parseIST } from '../engine/scheduler';
import TripMap from '../components/TripMap';
import {
  buildTripSummaryText,
  buildWhatsAppShareUrl,
  formatDuration,
  formatReadableDate,
  formatReadableDateTime,
  formatTimelineTime,
} from '../utils/formatters';
import {
  buildShareableTripUrl,
  buildWhatsAppInvitationMessage,
  buildWhatsAppRSVPMessage,
  parseShareableTrip,
  sanitizeDisplayName,
} from '../utils/tripShare';

type Props = { inputs: UserConstraints; setInputs: Dispatch<SetStateAction<UserConstraints>> };

export default function ScheduleScreen({ inputs, setInputs }: Props) {
  const { id } = useParams();
  const [searchParams] = useSearchParams();

  // Parse shareable URL query parameters if present
  const parsedTrip = useMemo(() => {
    if (!searchParams || searchParams.toString().length === 0) return null;
    return parseShareableTrip(searchParams, id ?? '');
  }, [searchParams, id]);

  // Defensive fallback: If URL parameters were provided but corrupted/invalid, render friendly error
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

  // Active inputs: Reconstructed from URL if valid share link opened; otherwise use props from planning flow
  const initialInputs = parsedTrip?.valid ? parsedTrip.data.inputs : inputs;
  const [currentInputs, setCurrentInputs] = useState<UserConstraints>(initialInputs);
  const [copied, setCopied] = useState('');
  const [linkCopied, setLinkCopied] = useState('');
  const [guestName, setGuestName] = useState('');
  const [guestError, setGuestError] = useState('');
  const [rsvpSent, setRsvpSent] = useState(false);

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

  // Re-evaluate feasibility dynamically using the scheduler engine (NEVER trust serialized metrics)
  const r = evaluateFeasibility(dest, currentInputs);
  const compatibleStops = getCompatiblePitstops(dest.id);
  const selectedPitstopIds = currentInputs.selectedPitstopIds ?? [];

  const isGuestView = parsedTrip?.valid ? parsedTrip.data.isGuestView : false;
  const organizerName = parsedTrip?.valid
    ? parsedTrip.data.organizerName
    : currentInputs.organizerName || '';

  const isLocalhost =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  const updateInputs = (updater: (prev: UserConstraints) => UserConstraints) => {
    setCurrentInputs(prev => {
      const next = updater(prev);
      setInputs(next);
      return next;
    });
  };

  const togglePitstop = (pitstopId: string) => {
    updateInputs(s => {
      const current = s.selectedPitstopIds ?? [];
      const updated = current.includes(pitstopId)
        ? current.filter(item => item !== pitstopId)
        : [...current, pitstopId];
      return { ...s, selectedPitstopIds: updated };
    });
  };

  const maps =
    'https://www.google.com/maps/dir/?api=1&origin=' +
    encodeURIComponent('MG Road, Bengaluru') +
    '&destination=' +
    encodeURIComponent(dest.name + ', India') +
    '&travelmode=driving';

  const summaryText = buildTripSummaryText({
    destination: dest,
    inputs: currentInputs,
    result: r,
    originUrl: typeof window !== 'undefined' ? window.location.origin : undefined,
  });

  const copySummary = async () => {
    try {
      await navigator.clipboard.writeText(summaryText);
      setCopied('Summary copied to clipboard!');
    } catch {
      setCopied('Select and copy from the preview below.');
      window.prompt('Copy your @48 plan:', summaryText);
    }
  };

  const shareViaWhatsApp = () => {
    const url = buildWhatsAppShareUrl(summaryText);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleCopyTripLink = async () => {
    const shareUrl = buildShareableTripUrl(dest.id, currentInputs);
    try {
      await navigator.clipboard.writeText(shareUrl);
      setLinkCopied('Trip invitation link copied to clipboard!');
    } catch {
      window.prompt('Copy trip link:', shareUrl);
      setLinkCopied('Trip link ready to copy.');
    }
  };

  const handleShareInviteWhatsApp = () => {
    const shareUrl = buildShareableTripUrl(dest.id, currentInputs);
    const msg = buildWhatsAppInvitationMessage({
      destinationName: dest.name,
      inputs: currentInputs,
      tripUrl: shareUrl,
    });
    const url = buildWhatsAppShareUrl(msg);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleGuestRSVP = () => {
    const trimmed = guestName.trim();
    if (!trimmed) {
      setGuestError('Please enter your name to prepare the RSVP message.');
      return;
    }
    setGuestError('');

    const shareUrl = buildShareableTripUrl(dest.id, currentInputs);
    const rsvpMsg = buildWhatsAppRSVPMessage({
      organizerName: organizerName || 'Organizer',
      guestName: trimmed,
      destinationName: dest.name,
      departureDateTime: currentInputs.departureDateTime,
      returnDeadlineDateTime: currentInputs.returnDeadlineDateTime,
      tripUrl: shareUrl,
    });

    const url = buildWhatsAppShareUrl(rsvpMsg);
    window.open(url, '_blank', 'noopener,noreferrer');
    setRsvpSent(true);
  };

  const day1Start = r.timeline.find(t => t.day === 1)?.startTime;
  const day2Start = r.timeline.find(t => t.day === 2)?.startTime;

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <Link to="/compare" className="inline-flex items-center text-sm font-semibold text-teal-700 hover:underline">
        ← Compare destinations
      </Link>

      {/* Guest Invitation Banner when opened via shared link */}
      {isGuestView && (
        <div className="rounded-2xl border border-teal-200 bg-teal-50/90 p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="rounded-full bg-teal-200/80 px-3 py-1 text-xs font-bold uppercase tracking-wider text-teal-900">
              👥 Group Trip Invitation
            </span>
            <span className="text-xs font-medium text-teal-800">No account required</span>
          </div>
          <h2 className="mt-2 text-xl font-bold text-slate-900">
            {organizerName
              ? `${organizerName} invited you to a road trip to ${dest.name}!`
              : `You've been invited to a road trip to ${dest.name}!`}
          </h2>
          <p className="mt-1 text-xs text-slate-700">
            {formatReadableDateTime(currentInputs.departureDateTime)} →{' '}
            {formatReadableDateTime(currentInputs.returnDeadlineDateTime)} (IST)
          </p>
        </div>
      )}

      {/* Guest RSVP Action Card */}
      {isGuestView && (
        <div className="space-y-3 rounded-2xl border border-emerald-300 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Join this Road Trip</h3>
              <p className="text-xs text-slate-500">
                Send your RSVP directly to {organizerName || 'the organizer'} on WhatsApp with this verified trip plan.
              </p>
            </div>
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-900">
              WhatsApp RSVP
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700">
              Your Display Name
              <input
                type="text"
                maxLength={40}
                placeholder="e.g. Roshan"
                className="mt-1.5 block w-full rounded-lg border border-slate-300 p-2.5 text-sm focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
                value={guestName}
                onChange={e => setGuestName(sanitizeDisplayName(e.target.value))}
              />
            </label>
            {guestError && <p className="mt-1 text-xs text-red-600">{guestError}</p>}
          </div>

          <button
            onClick={handleGuestRSVP}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-3.5 font-bold text-white shadow-sm hover:bg-[#20ba5a] active:scale-[0.99] transition-all cursor-pointer"
          >
            <span className="text-base">💬</span> Join Trip & Send RSVP via WhatsApp
          </button>

          {rsvpSent && (
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3.5 text-xs text-emerald-950 space-y-1">
              <p className="font-bold">✓ WhatsApp opened with your RSVP message.</p>
              <p>
                Send the message directly to {organizerName || 'the organizer'} to confirm your spot.
              </p>
              <p className="text-slate-500 text-[11px]">
                Note: Participation is confirmed directly through WhatsApp, not synchronized online.
              </p>
            </div>
          )}
        </div>
      )}

      <div>
        <div className="text-sm font-semibold uppercase tracking-widest text-teal-700">Step 3 / 3</div>
        <h1 className="mt-1 text-3xl font-extrabold text-slate-900">{dest.name}: your weekend</h1>
        <p className="mt-1 text-sm text-slate-600">Plan estimates in IST, not a live GPS tracker.</p>
      </div>

      {/* Informational Stay Zone Badge */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-700">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-900">📍 Planned Stay Zone:</span>
          <span>Central {dest.name} Area</span>
        </div>
        <span className="rounded bg-slate-200 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
          Informational Badge · 1 PM check-in modeled
        </span>
      </div>

      {/* Primary Feasibility Card */}
      <div className="rounded-2xl bg-[#0d352f] p-6 text-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="rounded-full bg-emerald-900/60 px-3 py-1 text-xs font-bold uppercase tracking-wider text-emerald-200">
            Feasibility Verdict
          </span>
          <span className="text-xs text-emerald-200">MG Road reference</span>
        </div>
        <p className="mt-2 text-2xl font-black tracking-tight">{r.rating}</p>
        <p className="mt-1 text-sm text-emerald-100">{r.ratingExplanation}</p>

        <div className="mt-5 grid grid-cols-2 gap-4 border-t border-emerald-900/50 pt-4 text-sm">
          <div>
            <p className="text-xs text-emerald-300">Usable destination free time</p>
            <strong className="text-2xl font-black text-white">{formatDuration(r.destinationSlackMinutes)}</strong>
          </div>
          <div>
            <p className="text-xs text-emerald-300">Return deadline margin</p>
            <strong className={`text-2xl font-black ${r.returnDeadlineMarginMinutes < 0 ? 'text-red-300' : 'text-white'}`}>
              {formatDuration(r.returnDeadlineMarginMinutes, true)}
            </strong>
          </div>
        </div>

        <div className="mt-4 border-t border-emerald-900/50 pt-3 text-xs text-emerald-200 space-y-1">
          <p>
            Expected home: <strong>{formatReadableDateTime(r.homeArrivalTime)} (IST)</strong>
          </p>
          <p>
            Estimated cost: <strong>₹{r.estimatedCostPerPersonINR.toLocaleString('en-IN')}/person</strong> (₹{r.estimatedTripTotalINR.toLocaleString('en-IN')} total for party of {currentInputs.partySize})
          </p>
        </div>
      </div>

      {/* Interactive Trip Map */}
      <TripMap
        destination={dest}
        inputs={currentInputs}
        result={r}
        onTogglePitstop={togglePitstop}
      />

      {/* Adjustments & Scenarios */}
      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-bold text-slate-900">Itinerary Adjustments</h2>
        <label className="flex items-center gap-3 font-semibold text-slate-800 cursor-pointer">
          <input
            type="checkbox"
            className="h-4 w-4 rounded text-teal-600 focus:ring-teal-500"
            checked={currentInputs.simulateDelayMinutes === 60}
            onChange={e =>
              updateInputs(s => ({
                ...s,
                simulateDelayMinutes: e.target.checked ? 60 : 0,
              }))
            }
          />
          Simulate +1 hour outbound delay
        </label>

        {dest.activities.filter(a => a.isOptional).map(a => (
          <label key={a.id} className="flex items-center gap-3 text-sm text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              className="h-4 w-4 rounded text-teal-600 focus:ring-teal-500"
              checked={!currentInputs.disabledActivityIds.includes(a.id)}
              onChange={e =>
                updateInputs(s => ({
                  ...s,
                  disabledActivityIds: e.target.checked
                    ? s.disabledActivityIds.filter(i => i !== a.id)
                    : [...s.disabledActivityIds, a.id],
                }))
              }
            />
            Include optional attraction: <strong>{a.name}</strong> ({formatDuration(a.durationMinutes)})
          </label>
        ))}
      </div>

      {/* Curated Highway Pitstops Section */}
      {compatibleStops.length > 0 && (
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-900">Curated Highway Pitstops</h2>
              <p className="text-xs text-slate-500">
                Verified highway stops along your travel corridor. Adding a stop inserts an explicit PITSTOP block and updates arrival time and slack.
              </p>
            </div>
            <span className="rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-xs font-bold text-amber-800">
              Corridor Stops
            </span>
          </div>

          <div className="space-y-3">
            {compatibleStops.map(stop => {
              const isSelected = selectedPitstopIds.includes(stop.id);
              const totalStopMinutes = stop.dwellMinutes + stop.detourMinutes;

              return (
                <div
                  key={stop.id}
                  className={`rounded-xl border p-4 transition-all ${
                    isSelected ? 'border-amber-400 bg-amber-50/50 shadow-sm' : 'border-slate-200 bg-slate-50/40 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <strong className="text-sm font-bold text-slate-900">{stop.name}</strong>
                        <span className="rounded bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-900">
                          {stop.categoryLabel}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-600">{stop.description}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        📍 {stop.location.address}{' '}
                        <a
                          href={stop.location.osmUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-teal-700 hover:underline ml-1"
                        >
                          [OpenStreetMap Node #{stop.location.osmNodeId} ↗]
                        </a>
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/80 pt-3 text-xs">
                    <div className="text-slate-600">
                      <span>Est. Dwell: <strong>{stop.dwellMinutes}m</strong></span>
                      <span className="mx-1.5">·</span>
                      <span>Slip-road Detour: <strong>{stop.detourMinutes}m</strong></span>
                      <span className="mx-1.5">·</span>
                      <span className="font-semibold text-slate-800">Total: +{totalStopMinutes}m</span>
                      {stop.replacesArrivalMeal && (
                        <p className="mt-0.5 text-[11px] text-teal-800 font-medium">
                          ✓ Midday meal taken at pitstop replaces redundant 45m check-in dining allowance.
                        </p>
                      )}
                    </div>

                    <button
                      onClick={() => togglePitstop(stop.id)}
                      className={`rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer ${
                        isSelected
                          ? 'border border-amber-600 bg-amber-600 text-white shadow-sm hover:bg-amber-700'
                          : 'border border-slate-300 bg-white text-slate-800 shadow-sm hover:bg-slate-100'
                      }`}
                    >
                      {isSelected ? '✓ Stop Included (Click to Remove)' : `+ Add Pitstop (+${totalStopMinutes}m)`}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Violations / Advisories */}
      {r.violations.length > 0 && (
        <div className="space-y-2">
          {r.violations.map((v, i) => (
            <p
              key={i}
              className={`rounded-xl border p-3.5 text-sm ${
                v.severity === 'BLOCKER'
                  ? 'border-red-200 bg-red-50 text-red-900'
                  : 'border-amber-200 bg-amber-50 text-amber-900'
              }`}
            >
              <strong>{v.severity}:</strong> {v.message}
            </p>
          ))}
        </div>
      )}

      {/* Human-Readable Timelines for Day 1 and Day 2 */}
      {([1, 2] as const).map(day => {
        const dayDate = day === 1 ? day1Start : day2Start;
        const items = r.timeline.filter(t => t.day === day);
        return (
          <div key={day} className="space-y-3">
            <div className="flex items-baseline justify-between">
              <h2 className="text-xl font-bold text-slate-900">
                Day {day} {dayDate && <span className="text-sm font-medium text-slate-500">· {formatReadableDate(dayDate)}</span>}
              </h2>
              <span className="text-xs text-slate-400">{items.length} segments</span>
            </div>

            <div className="space-y-2">
              {items.map(entry => {
                const duration = Math.round((parseIST(entry.endTime) - parseIST(entry.startTime)) / 60_000);
                const isFree = entry.category === 'FREE';
                const isDrive = entry.category === 'DRIVE';
                const isActivity = entry.category === 'ACTIVITY';
                const isPitstop = entry.category === 'PITSTOP';

                return (
                  <div
                    key={entry.id}
                    className={`rounded-xl border p-3.5 text-sm transition-colors ${
                      isFree
                        ? 'border-emerald-200 bg-emerald-50/70 text-emerald-950'
                        : isPitstop
                        ? 'border-amber-300 bg-amber-50/80 text-amber-950'
                        : isDrive
                        ? 'border-blue-100 bg-blue-50/50'
                        : isActivity
                        ? 'border-purple-100 bg-purple-50/40'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <strong className="text-slate-900">{entry.label}</strong>
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-semibold ${
                          isPitstop
                            ? 'bg-amber-200 text-amber-900 font-bold'
                            : isFree
                            ? 'bg-emerald-100 text-emerald-800 font-bold'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {entry.category}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-xs text-slate-600">
                      <span>
                        {formatTimelineTime(entry.startTime)} → {formatTimelineTime(entry.endTime)}
                      </span>
                      <span className="font-semibold">{formatDuration(duration)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Invite Your Crew Section */}
      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Invite Your Crew</h2>
            <p className="text-xs text-slate-500">
              Share this trip plan snapshot with friends via direct link or WhatsApp.
            </p>
          </div>
          <span className="rounded-full bg-teal-50 border border-teal-200 px-3 py-1 text-xs font-bold text-teal-800">
            Private Invitation
          </span>
        </div>

        {/* Trip Snapshot Preview Box */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-700 space-y-1.5">
          <div className="flex justify-between">
            <span className="font-semibold text-slate-900">Destination:</span>
            <span>{dest.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-semibold text-slate-900">Travel Dates:</span>
            <span>
              {formatReadableDateTime(currentInputs.departureDateTime)} →{' '}
              {formatReadableDateTime(currentInputs.returnDeadlineDateTime)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="font-semibold text-slate-900">Organizer:</span>
            <span>{organizerName || 'Trip Organizer'}</span>
          </div>
          {selectedPitstopIds.length > 0 && (
            <div className="flex justify-between">
              <span className="font-semibold text-slate-900">Planned Highway Stop:</span>
              <span className="font-medium text-amber-900">Maddur Tiffanys included</span>
            </div>
          )}
        </div>

        {isLocalhost && (
          <p className="rounded-lg bg-amber-50 p-2.5 text-xs text-amber-900">
            ⚠️ <strong>Local environment detected:</strong> This link is generated using <code>localhost</code> and will only work on this device. Deploy to Vercel (or provide a public URL) for cross-device sharing.
          </p>
        )}

        <p className="text-xs text-slate-500 italic">
          Shared trip snapshot. Changes are not synchronized automatically.
        </p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 pt-1">
          <button
            onClick={handleShareInviteWhatsApp}
            className="flex items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-3.5 font-bold text-white shadow-sm hover:bg-[#20ba5a] active:scale-[0.99] transition-all cursor-pointer"
          >
            <span className="text-base">💬</span> Share Invite via WhatsApp
          </button>
          <button
            onClick={handleCopyTripLink}
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3.5 font-bold text-slate-800 shadow-sm hover:bg-slate-50 active:scale-[0.99] transition-all cursor-pointer"
          >
            <span className="text-base">🔗</span> Copy Trip Link
          </button>
        </div>

        {linkCopied && (
          <p role="status" className="text-center text-sm font-semibold text-teal-700 animate-fade-in">
            ✓ {linkCopied}
          </p>
        )}
      </div>

      {/* Dynamic Summary Preview Card */}
      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Trip Summary Preview</h2>
            <p className="text-xs text-slate-500">
              Live preview updates instantly when you modify delays, pitstops, or optional activities.
            </p>
          </div>
          <span className="rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-bold text-emerald-800">
            Dynamic Live Output
          </span>
        </div>

        <pre className="max-h-72 overflow-y-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-4 font-mono text-xs text-slate-800 leading-relaxed">
          {summaryText}
        </pre>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 pt-1">
          <button
            onClick={shareViaWhatsApp}
            className="flex items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-3.5 font-bold text-white shadow-sm hover:bg-[#20ba5a] active:scale-[0.99] transition-all cursor-pointer"
          >
            <span className="text-base">💬</span> Share via WhatsApp
          </button>
          <button
            onClick={copySummary}
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3.5 font-bold text-slate-800 shadow-sm hover:bg-slate-50 active:scale-[0.99] transition-all cursor-pointer"
          >
            <span className="text-base">📋</span> Copy Summary
          </button>
        </div>

        {copied && (
          <p role="status" className="text-center text-sm font-semibold text-teal-700 animate-fade-in">
            ✓ {copied}
          </p>
        )}
      </div>

      <a
        href={maps}
        target="_blank"
        rel="noopener noreferrer"
        className="block text-center text-sm font-semibold text-teal-700 hover:underline"
      >
        Open route in Google Maps ↗
      </a>

      <p className="text-center text-xs text-slate-500">
        Cost assumes {currentInputs.partySize} travelers sharing a car and room. Meals and personal expenses excluded. Route durations and most costs are unverified planning estimates.
      </p>
    </section>
  );
}
