import { useState, useMemo } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import type { Dispatch, SetStateAction } from 'react';
import type { UserConstraints } from '../types';
import { getDestination } from '../data/destinations';
import { getCompatiblePitstops } from '../data/pitstops.js';
import { evaluateFeasibility, parseIST } from '../engine/scheduler';
import TripMap from '../components/TripMap';
import ProgressBar from '../components/ProgressBar';
import { getPlaceImage } from '../data/images';
import {
  buildWhatsAppShareUrl,
  formatDuration,
  formatReadableDate,
  formatReadableDateTime,
  formatTimelineTime,
} from '../utils/formatters';
import {
  buildShareableParams,
  buildShareableTripUrl,
  buildWhatsAppRSVPMessage,
  cleanInputDisplayName,
  parseShareableTrip,
  sanitizeDisplayName,
} from '../utils/tripShare';

type Props = { inputs: UserConstraints; setInputs: Dispatch<SetStateAction<UserConstraints>> };

export default function ScheduleScreen({ inputs, setInputs }: Props) {
  const { id } = useParams();
  const nav = useNavigate();
  const [searchParams] = useSearchParams();

  // Active day tab (1 to N)
  const [activeDay, setActiveDay] = useState<number>(1);

  // Pitstop dietary filter: 'all' | 'veg' | 'non-veg'
  const [dietaryFilter, setDietaryFilter] = useState<'all' | 'veg' | 'non-veg'>('all');

  // Parse shareable URL query parameters if present
  const parsedTrip = useMemo(() => {
    if (!searchParams || searchParams.toString().length === 0) return null;
    return parseShareableTrip(searchParams, id ?? '');
  }, [searchParams, id]);

  // Defensive fallback: If URL parameters were provided but corrupted/invalid, render friendly error
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

  // Active inputs: Reconstructed from URL if valid share link opened; otherwise use props from planning flow
  const initialInputs = parsedTrip?.valid ? parsedTrip.data.inputs : inputs;
  const [currentInputs, setCurrentInputs] = useState<UserConstraints>(initialInputs);
  const [guestName, setGuestName] = useState('');
  const [guestError, setGuestError] = useState('');
  const [rsvpSent, setRsvpSent] = useState(false);

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

  // Re-evaluate feasibility dynamically using the scheduler engine
  const r = evaluateFeasibility(dest, currentInputs);
  // Available days dynamically extracted from timeline entries
  const availableDays = useMemo(() => {
    const days = Array.from(new Set(r.timeline.map(t => t.day))).sort((a, b) => a - b);
    return days.length > 0 ? days : [1];
  }, [r.timeline]);

  const currentActiveDay = availableDays.includes(activeDay) ? activeDay : availableDays[0] || 1;

  const compatibleStops = getCompatiblePitstops(dest.id);
  const selectedPitstopIds = currentInputs.selectedPitstopIds ?? [];

  // Filter pitstops by dietary preference (Maddur Tiffanys is Vegetarian)
  const filteredStops = compatibleStops.filter(_s => {
    if (dietaryFilter === 'all') return true;
    if (dietaryFilter === 'veg') return true; // Maddur Tiffanys is pure veg
    if (dietaryFilter === 'non-veg') return false; // currently only verified veg corridor stops
    return true;
  });

  const isGuestView = parsedTrip?.valid ? parsedTrip.data.isGuestView : false;
  const organizerName = parsedTrip?.valid
    ? parsedTrip.data.organizerName
    : currentInputs.organizerName || '';

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

  const goToReviewScreen = () => {
    const params = buildShareableParams(dest.id, currentInputs);
    nav(`/review/${dest.id}?${params.toString()}`);
  };


  return (
    <section className="mx-auto max-w-3xl space-y-6">
      {/* 4-part segmented progress meter */}
      <ProgressBar currentStep={3} />

      <Link to="/compare" className="inline-flex items-center text-xs font-semibold text-blue-400 hover:underline">
        ← Compare destinations
      </Link>

      {/* Guest Invitation Banner when opened via shared link */}
      {isGuestView && (
        <div className="rounded-2xl border border-blue-500/40 bg-blue-950/40 p-5 shadow-lg text-white">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="rounded-full bg-blue-500/20 px-3 py-1 text-xs font-bold uppercase tracking-wider text-blue-300 border border-blue-500/30">
              👥 Group Trip Invitation
            </span>
            <span className="text-xs font-medium text-slate-400">No account required</span>
          </div>
          <h2 className="mt-2 text-xl font-bold text-white">
            {organizerName
              ? `${organizerName} invited you to a road trip to ${dest.name}!`
              : `You've been invited to a road trip to ${dest.name}!`}
          </h2>
          <p className="mt-1 text-xs text-slate-300">
            {formatReadableDateTime(currentInputs.departureDateTime)} →{' '}
            {formatReadableDateTime(currentInputs.returnDeadlineDateTime)} (IST)
          </p>
        </div>
      )}

      {/* Guest RSVP Action Card */}
      {isGuestView && (
        <div className="space-y-3 rounded-2xl border border-emerald-500/40 bg-[#20252E] p-5 shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-lg font-bold text-white">Join this Road Trip</h3>
              <p className="text-xs text-slate-400">
                Send your RSVP directly to {organizerName || 'the organizer'} on WhatsApp with this verified trip plan.
              </p>
            </div>
            <span className="rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-3 py-1 text-xs font-bold">
              WhatsApp RSVP
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300">
              Your Display Name
              <input
                type="text"
                maxLength={40}
                placeholder="e.g. Roshan"
                className="mt-1.5 block w-full rounded-xl border border-slate-700 bg-[#15191F] p-3 text-sm text-white focus:border-[#2962FF] focus:outline-none"
                value={guestName}
                onChange={e => setGuestName(cleanInputDisplayName(e.target.value))}
                onBlur={e => setGuestName(sanitizeDisplayName(e.target.value))}
              />
            </label>
            {guestError && <p className="mt-1 text-xs text-red-400">{guestError}</p>}
          </div>

          <button
            onClick={handleGuestRSVP}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-3.5 font-bold text-white shadow-lg hover:bg-[#20ba5a] active:scale-[0.99] transition-all cursor-pointer"
          >
            <span className="text-base">💬</span> Join Trip & Send RSVP via WhatsApp
          </button>

          {rsvpSent && (
            <div className="rounded-xl bg-emerald-950/40 border border-emerald-500/40 p-3.5 text-xs text-emerald-200 space-y-1">
              <p className="font-bold">✓ WhatsApp opened with your RSVP message.</p>
              <p>
                Send the message directly to {organizerName || 'the organizer'} to confirm your spot.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Step Heading */}
      <div>
        <h1 className="text-3xl font-extrabold text-white">
          What should we explore along the way?
        </h1>
        <p className="mt-1 text-sm text-slate-300">
          Customize your stops, delays, and schedule for {dest.name} in Asia/Kolkata wall-clock time.
        </p>
      </div>

      {/* Before You Go Warning Section */}
      <div className="rounded-2xl border border-amber-500/30 bg-amber-950/20 p-4 text-xs text-amber-200 space-y-2">
        <div className="flex items-center gap-2 font-bold text-amber-300 text-sm">
          <span>⚠️</span>
          <span>Before You Go: Road & Operating Advisories</span>
        </div>
        {dest.routeRestriction ? (
          <p>
            <strong>Night Curfew in Effect:</strong> {dest.routeRestriction.name} gates close between {dest.routeRestriction.startTime} and {dest.routeRestriction.endTime}. Transit through the reserve must clear before 21:00.
          </p>
        ) : (
          <p>
            <strong>Standard Corridor:</strong> No national park night driving bans along this highway. Departure timing models typical weekend toll and traffic buffers.
          </p>
        )}
        <p className="text-[11px] text-amber-300/80">
          Weather Forecast: Outside 5-day predictive horizon for requested dates. Check official IMD / Karnataka State Natural Disaster Monitoring Centre updates before departure.
        </p>
      </div>

      {/* Primary Feasibility Card */}
      <div className="rounded-2xl border border-slate-800 bg-[#20252E] p-6 text-white shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="rounded-full bg-blue-500/20 border border-blue-500/30 px-3 py-1 text-xs font-bold uppercase tracking-wider text-blue-300">
            Feasibility Verdict
          </span>
          <span className="text-xs text-slate-400">MG Road reference origin</span>
        </div>
        <p className="mt-2 text-2xl font-black tracking-tight">{r.rating}</p>
        <p className="mt-1 text-sm text-slate-300">{r.ratingExplanation}</p>

        <div className="mt-5 grid grid-cols-2 gap-4 border-t border-slate-800 pt-4 text-sm">
          <div>
            <p className="text-xs text-slate-400">Usable destination free time</p>
            <strong className="text-2xl font-black text-white">{formatDuration(r.destinationSlackMinutes)}</strong>
          </div>
          <div>
            <p className="text-xs text-slate-400">Return deadline margin</p>
            <strong className={`text-2xl font-black ${r.returnDeadlineMarginMinutes < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
              {formatDuration(r.returnDeadlineMarginMinutes, true)}
            </strong>
          </div>
        </div>

        <div className="mt-4 border-t border-slate-800 pt-3 text-xs text-slate-300 space-y-1">
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
      <div className="space-y-4 rounded-2xl border border-slate-800 bg-[#20252E] p-5 shadow-lg">
        <div>
          <h2 className="text-base font-bold text-white">Itinerary Scenarios & Sightseeing</h2>
          <p className="text-xs text-slate-400">
            Customize departure delays and optional visits. Feasibility metrics and timelines recalculate immediately.
          </p>
        </div>

        {/* Departure Delay Scenario */}
        <div className="rounded-xl border border-slate-700/60 bg-[#15191F] p-3.5">
          <label className="flex items-center gap-3 font-semibold text-slate-200 cursor-pointer">
            <input
              type="checkbox"
              className="h-4 w-4 rounded accent-[#2962FF] cursor-pointer"
              checked={currentInputs.simulateDelayMinutes === 60}
              onChange={e =>
                updateInputs(s => ({
                  ...s,
                  simulateDelayMinutes: e.target.checked ? 60 : 0,
                }))
              }
            />
            <div>
              <span className="block text-sm text-white font-bold">Simulate +1 hour outbound departure delay</span>
              <span className="text-xs text-slate-400 font-normal">
                Models being held up leaving Bengaluru (e.g., Saturday morning traffic or late start).
              </span>
            </div>
          </label>
        </div>

        {/* Attractions List: Required vs Optional */}
        <div className="space-y-3 pt-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Destination Attractions & Sightseeing
          </h3>

          <div className="space-y-2.5">
            {dest.activities.map(a => {
              const aImg = getPlaceImage(a.id);
              const isOptional = a.isOptional;
              const isIncluded = !currentInputs.disabledActivityIds.includes(a.id);

              if (!isOptional) {
                return (
                  <div
                    key={a.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-700/60 bg-[#15191F] p-3.5"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {aImg && (
                        <img
                          src={aImg.src}
                          alt={aImg.alt}
                          className="h-10 w-10 rounded-lg object-cover flex-shrink-0 border border-slate-700"
                          onError={e => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <strong className="text-sm text-white">{a.name}</strong>
                          <span className="rounded bg-blue-500/20 text-blue-300 px-2 py-0.5 text-[10px] font-bold border border-blue-500/30">
                            Required Highlight
                          </span>
                        </div>
                        <p className="text-xs text-slate-400">
                          {formatDuration(a.durationMinutes)} planned visit · Core destination landmark mandatory for feasibility modeling.
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-slate-500">Locked</span>
                  </div>
                );
              }

              return (
                <div
                  key={a.id}
                  className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3.5 transition-all ${
                    isIncluded
                      ? 'border-emerald-500/40 bg-emerald-950/20 shadow-sm'
                      : 'border-slate-800 bg-[#15191F] opacity-75'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {aImg && (
                      <img
                        src={aImg.src}
                        alt={aImg.alt}
                        className="h-10 w-10 rounded-lg object-cover flex-shrink-0 border border-slate-700"
                        onError={e => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <strong className="text-sm text-white">{a.name}</strong>
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                            isIncluded
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {isIncluded ? 'Included in Trip' : 'Excluded from Plan'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">
                        {formatDuration(a.durationMinutes)} planned visit · Optional stop — Include in my trip to visit.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      updateInputs(s => ({
                        ...s,
                        disabledActivityIds: isIncluded
                          ? [...s.disabledActivityIds, a.id]
                          : s.disabledActivityIds.filter(i => i !== a.id),
                      }))
                    }
                    className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                      isIncluded
                        ? 'border border-emerald-600 bg-emerald-600 text-white shadow-sm hover:bg-emerald-700'
                        : 'border border-slate-700 bg-[#292F39] text-slate-200 hover:text-white'
                    }`}
                  >
                    {isIncluded ? '✓ Stop Included (Click to Remove)' : '+ Include in Trip'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Curated Highway Pitstops Section with Dietary Filter */}
      {compatibleStops.length > 0 && (
        <div className="space-y-4 rounded-2xl border border-slate-800 bg-[#20252E] p-5 shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-white">Curated Highway Pitstops</h2>
              <p className="text-xs text-slate-400">
                Verified highway stops along your travel corridor with realistic detour & dwell time.
              </p>
            </div>
            {/* Dietary filter chips */}
            <div className="flex items-center gap-1.5 bg-[#15191F] p-1 rounded-xl border border-slate-700">
              {(['all', 'veg', 'non-veg'] as const).map(f => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setDietaryFilter(f)}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-bold capitalize transition-colors cursor-pointer ${
                    dietaryFilter === f
                      ? 'bg-[#2962FF] text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {f === 'all' ? 'All Stops' : f === 'veg' ? '🌿 Veg Only' : '🍗 Non-Veg'}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {filteredStops.length === 0 ? (
              <p className="text-xs text-slate-400 p-3 bg-[#15191F] rounded-xl border border-slate-800">
                No highway pitstops match the selected dietary filter on this route.
              </p>
            ) : (
              filteredStops.map(stop => {
                const isSelected = selectedPitstopIds.includes(stop.id);
                const totalStopMinutes = stop.dwellMinutes + stop.detourMinutes;
                const stopImg = getPlaceImage(stop.id);

                return (
                  <div
                    key={stop.id}
                    className={`rounded-xl border p-4 transition-all ${
                      isSelected
                        ? 'border-amber-500/40 bg-amber-950/20 shadow-md'
                        : 'border-slate-800 bg-[#15191F] hover:border-slate-700'
                    }`}
                  >
                    <div className="flex gap-4 items-start">
                      {stopImg ? (
                        <div className="relative h-20 w-20 sm:h-24 sm:w-24 flex-shrink-0 overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-inner">
                          <img
                            src={stopImg.src}
                            alt={stopImg.alt}
                            loading="lazy"
                            className="h-full w-full object-cover"
                            onError={e => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        </div>
                      ) : (
                        <div className="flex h-20 w-20 sm:h-24 sm:w-24 flex-shrink-0 items-center justify-center rounded-xl bg-amber-900/30 text-3xl">
                          ☕
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <strong className="text-sm font-bold text-white">{stop.name}</strong>
                          <span className="rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 text-[11px] font-bold">
                            {stop.categoryLabel}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-300">{stop.description}</p>
                        <p className="mt-1 text-xs text-slate-400">
                          📍 {stop.location.address}{' '}
                          <a
                            href={stop.location.osmUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-semibold text-blue-400 hover:underline ml-1"
                          >
                            [OpenStreetMap ↗]
                          </a>
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-3 text-xs">
                      <div className="text-slate-300">
                        <span>Est. Dwell: <strong>{stop.dwellMinutes}m</strong></span>
                        <span className="mx-1.5">·</span>
                        <span>Slip-road Detour: <strong>{stop.detourMinutes}m</strong></span>
                        <span className="mx-1.5">·</span>
                        <span className="font-semibold text-white">Total: +{totalStopMinutes}m</span>
                        {stop.replacesArrivalMeal && (
                          <p className="mt-0.5 text-[11px] text-blue-300 font-medium">
                            ✓ Midday meal taken at pitstop replaces redundant 45m check-in dining allowance.
                          </p>
                        )}
                      </div>

                      <button
                        onClick={() => togglePitstop(stop.id)}
                        className={`rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer ${
                          isSelected
                            ? 'border border-amber-600 bg-amber-600 text-white shadow-sm hover:bg-amber-700'
                            : 'border border-slate-700 bg-[#292F39] text-white shadow-sm hover:bg-slate-700'
                        }`}
                      >
                        {isSelected ? '✓ Stop Included (Click to Remove)' : `+ Add Pitstop (+${totalStopMinutes}m)`}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
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
                  ? 'border-red-500/40 bg-red-950/40 text-red-200'
                  : 'border-amber-500/40 bg-amber-950/40 text-amber-200'
              }`}
            >
              <strong>{v.severity}:</strong> {v.message}
            </p>
          ))}
        </div>
      )}

      {/* Dynamic Day 1 .. Day N Tabs */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div className="flex flex-wrap items-center gap-2">
            {availableDays.map(d => {
              const dayStart = r.timeline.find(t => t.day === d)?.startTime;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setActiveDay(d)}
                  className={`rounded-xl px-4 py-2 text-sm font-bold transition-colors cursor-pointer ${
                    currentActiveDay === d
                      ? 'bg-[#2962FF] text-white shadow-md shadow-[#2962FF]/40'
                      : 'bg-[#20252E] text-slate-400 hover:text-white'
                  }`}
                >
                  Day {d} {dayStart && `· ${formatReadableDate(dayStart)}`}
                </button>
              );
            })}
          </div>
          <span className="text-xs text-slate-400">
            {r.timeline.filter(t => t.day === currentActiveDay).length} timeline blocks
          </span>
        </div>

        {/* Selected Day Timeline List */}
        <div className="space-y-2.5">
          {r.timeline
            .filter(t => t.day === currentActiveDay)
            .map(entry => {
              const duration = Math.round((parseIST(entry.endTime) - parseIST(entry.startTime)) / 60_000);
              const isFree = entry.category === 'FREE';
              const isDrive = entry.category === 'DRIVE';
              const isActivity = entry.category === 'ACTIVITY';
              const isPitstop = entry.category === 'PITSTOP';
              const actImg = entry.activityId
                ? getPlaceImage(entry.activityId)
                : isPitstop
                ? getPlaceImage('maddur-tiffanys')
                : undefined;

              return (
                <div
                  key={entry.id}
                  className={`rounded-xl border p-3.5 text-sm transition-colors ${
                    isFree
                      ? 'border-emerald-500/30 bg-emerald-950/20 text-emerald-200'
                      : isPitstop
                      ? 'border-amber-500/40 bg-amber-950/30 text-amber-200'
                      : isDrive
                      ? 'border-blue-500/30 bg-blue-950/20 text-blue-200'
                      : isActivity
                      ? 'border-purple-500/30 bg-purple-950/20 text-purple-200'
                      : 'border-slate-800 bg-[#20252E] text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {actImg && (
                      <img
                        src={actImg.src}
                        alt={actImg.alt}
                        loading="lazy"
                        className="h-10 w-10 rounded-lg object-cover flex-shrink-0 border border-slate-700"
                        onError={e => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <strong className="text-white">{entry.label}</strong>
                        <span
                          className={`rounded px-2.5 py-0.5 text-xs font-semibold ${
                            isPitstop
                              ? 'bg-amber-500/20 text-amber-300 font-bold'
                              : isFree
                              ? 'bg-emerald-500/20 text-emerald-300 font-bold'
                              : isDrive
                              ? 'bg-blue-500/20 text-blue-300'
                              : isActivity
                              ? 'bg-purple-500/20 text-purple-300'
                              : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          {isPitstop
                            ? '☕ Highway Pitstop'
                            : isFree
                            ? '🌿 Usable Free Time'
                            : isDrive
                            ? '🚗 Highway Drive'
                            : isActivity
                            ? '📍 Attraction Visit'
                            : entry.category === 'REST'
                            ? '🌙 Overnight Rest'
                            : entry.category === 'CHECK_IN'
                            ? '🏨 Hotel Check-in'
                            : entry.category === 'MEAL'
                            ? '🍽️ Dining Break'
                            : entry.category}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-xs text-slate-400">
                        <span>
                          {formatTimelineTime(entry.startTime)} → {formatTimelineTime(entry.endTime)}
                        </span>
                        <span className="font-semibold text-slate-300">{formatDuration(duration)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Primary CTA: "Your adventure is taking shape! / See My Trip" */}
      <div className="rounded-2xl border border-blue-500/40 bg-[#20252E] p-6 shadow-lg space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-blue-400">Step 3 Complete</span>
            <h2 className="text-xl font-black text-white mt-0.5">Your adventure is taking shape!</h2>
            <p className="text-xs text-slate-300 mt-1">
              Review the complete digital itinerary, save locally on your device, and invite your crew with a 1-click WhatsApp RSVP.
            </p>
          </div>
          <span className="rounded-full bg-blue-500/20 border border-blue-500/30 px-3 py-1 text-xs font-bold text-blue-300">
            Final Step Ahead
          </span>
        </div>

        <button
          onClick={goToReviewScreen}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#2962FF] px-6 py-4 text-base font-bold text-white shadow-lg shadow-[#2962FF]/40 hover:bg-blue-600 active:scale-[0.99] transition-all cursor-pointer"
        >
          Review My Trip →
        </button>
      </div>

      <a
        href={maps}
        target="_blank"
        rel="noopener noreferrer"
        className="block text-center text-sm font-semibold text-blue-400 hover:underline"
      >
        Open route in Google Maps ↗
      </a>

      <p className="text-center text-xs text-slate-500">
        Cost assumes {currentInputs.partySize} travelers sharing a car and room. Meals and personal expenses excluded. Route durations and most costs are unverified planning estimates.
      </p>
    </section>
  );
}
