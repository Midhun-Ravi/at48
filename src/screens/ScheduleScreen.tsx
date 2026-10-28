import { useState, useMemo } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import type { Dispatch, SetStateAction } from 'react';
import type { CustomPlannedActivity, UserConstraints } from '../types';
import { getDestination } from '../data/destinations';
import { getDestinationGuide } from '../data/destinationGuides';
import { getCompatiblePitstops } from '../data/pitstops.js';
import { evaluateFeasibility, parseIST } from '../engine/scheduler';
import TripMap from '../components/TripMap';
import ProgressBar from '../components/ProgressBar';
import { getPlaceImage } from '../data/images';
import {
  formatDuration,
  formatReadableDate,
  formatReadableDateTime,
  formatTimelineTime,
} from '../utils/formatters';
import {
  buildShareableParams,
  parseShareableTrip,
} from '../utils/tripShare';

type Props = { inputs: UserConstraints; setInputs: Dispatch<SetStateAction<UserConstraints>> };

interface PlanningSlotState {
  day: number;
  startTime: string;
  endTime: string;
  maxDuration: number;
  editActivity?: CustomPlannedActivity;
}

export default function ScheduleScreen({ inputs, setInputs }: Props) {
  const { id } = useParams();
  const nav = useNavigate();
  const [searchParams] = useSearchParams();

  // Active day tab (1 to N)
  const [activeDay, setActiveDay] = useState<number>(1);

  // Pitstop dietary filter: 'all' | 'veg' | 'non-veg'
  const [dietaryFilter, setDietaryFilter] = useState<'all' | 'veg' | 'non-veg'>('all');

  // State for "Plan This Time" Modal
  const [planningSlot, setPlanningSlot] = useState<PlanningSlotState | null>(null);
  const [planFormName, setPlanFormName] = useState('');
  const [planFormDuration, setPlanFormDuration] = useState(60);
  const [planFormCost, setPlanFormCost] = useState(0);
  const [planCategory, setPlanCategory] = useState<'food' | 'sightseeing' | 'shopping' | 'walks' | 'relaxation' | 'custom'>('food');

  // Parse shareable URL query parameters if present
  const parsedTrip = useMemo(() => {
    if (!searchParams || searchParams.toString().length === 0) return null;
    return parseShareableTrip(searchParams, id ?? '');
  }, [searchParams, id]);

  // Defensive fallback: If URL parameters were provided but corrupted/invalid, render friendly error
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

  // Active inputs: Reconstructed from URL if valid share link opened; otherwise use props from planning flow
  const initialInputs = parsedTrip?.valid ? parsedTrip.data.inputs : inputs;
  const [currentInputs, setCurrentInputs] = useState<UserConstraints>(initialInputs);

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

  // Filter highway pitstops by dietary preference
  const filteredStops = useMemo(() => {
    if (dietaryFilter === 'all') return compatibleStops;
    return compatibleStops.filter(s => {
      const tag = s.dietary ?? (s.categoryLabel.toLowerCase().includes('veg') ? 'veg' : 'multi');
      if (dietaryFilter === 'veg') return tag === 'veg';
      if (dietaryFilter === 'non-veg') return tag === 'non-veg' || tag === 'multi';
      return true;
    });
  }, [compatibleStops, dietaryFilter]);

  // Keep parent state updated when adjustments occur
  const updateInputs = (updater: (prev: UserConstraints) => UserConstraints) => {
    setCurrentInputs(prev => {
      const next = updater(prev);
      setInputs(next);
      return next;
    });
  };

  const togglePitstop = (pitstopId: string) => {
    updateInputs(prev => {
      const current = prev.selectedPitstopIds ?? [];
      const next = current.includes(pitstopId)
        ? current.filter(id => id !== pitstopId)
        : [...current, pitstopId];
      return { ...prev, selectedPitstopIds: next };
    });
  };

  const toggleActivity = (activityId: string) => {
    updateInputs(prev => {
      const current = prev.disabledActivityIds ?? [];
      const next = current.includes(activityId)
        ? current.filter(id => id !== activityId)
        : [...current, activityId];
      return { ...prev, disabledActivityIds: next };
    });
  };

  // Free-Time Custom Activity Handlers (Gate 4 & Gate 6)
  const openPlanSlotModal = (slot: { day: number; startTime: string; endTime: string }, editActivity?: CustomPlannedActivity) => {
    const maxDur = Math.round((parseIST(slot.endTime) - parseIST(slot.startTime)) / 60_000);
    setPlanningSlot({
      day: slot.day,
      startTime: slot.startTime,
      endTime: slot.endTime,
      maxDuration: maxDur,
      editActivity,
    });
    if (editActivity) {
      setPlanFormName(editActivity.name);
      setPlanFormDuration(editActivity.durationMinutes);
      setPlanFormCost(editActivity.costPerPersonINR || 0);
      setPlanCategory('custom');
    } else {
      setPlanFormName('');
      setPlanFormDuration(Math.min(60, maxDur));
      setPlanFormCost(0);
      setPlanCategory('food');
    }
  };

  const handleSaveCustomActivity = () => {
    if (!planningSlot) return;
    const name = planFormName.trim();
    if (!name) return;

    const dur = Math.min(planningSlot.maxDuration, Math.max(15, planFormDuration));
    const cost = Math.max(0, planFormCost);

    updateInputs(prev => {
      const list = [...(prev.customActivities ?? [])];
      if (planningSlot.editActivity) {
        // Edit existing
        const idx = list.findIndex(a => a.id === planningSlot.editActivity?.id);
        if (idx !== -1) {
          list[idx] = {
            ...list[idx],
            name,
            durationMinutes: dur,
            costPerPersonINR: cost,
          };
        }
      } else {
        // Add new
        list.push({
          id: `custom_${Date.now()}`,
          day: planningSlot.day,
          name,
          durationMinutes: dur,
          costPerPersonINR: cost,
          slotStart: planningSlot.startTime,
        });
      }
      return { ...prev, customActivities: list };
    });

    setPlanningSlot(null);
  };

  const handleDeleteCustomActivity = (activityId: string) => {
    updateInputs(prev => ({
      ...prev,
      customActivities: (prev.customActivities ?? []).filter(a => a.id !== activityId),
    }));
    setPlanningSlot(null);
  };

  const isGuestView = Boolean(parsedTrip?.valid && parsedTrip.data.isGuestView);
  const organizerName = parsedTrip?.valid
    ? parsedTrip.data.organizerName
    : currentInputs.organizerName || '';

  const maps = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
    dest.name + ', Karnataka, India'
  )}`;

  const goToReviewScreen = () => {
    const params = buildShareableParams(dest.id, currentInputs);
    nav(`/review/${dest.id}?${params.toString()}`);
  };

  return (
    <section className="space-y-6">
      {/* 4-part segmented progress meter */}
      <ProgressBar currentStep={3} />

      {/* Guest Invitation Notice: Directs to Page 4 for RSVP while preserving trip data */}
      {isGuestView && (
        <div className="rounded-2xl border border-[#BAE3F1] bg-[#DDF0F6] p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-[#193953] shadow-xs">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">🚗</span>
            <div>
              <p className="font-bold text-[#176EA8]">
                {organizerName ? `Trip Invitation from ${organizerName}` : 'Shared Road Trip Invitation'}
              </p>
              <p className="text-[#5A7184] text-[11px] mt-0.5">
                Explore the planned schedule and route below, or proceed directly to review and send your RSVP.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={goToReviewScreen}
            className="w-full sm:w-auto flex-shrink-0 rounded-xl bg-[#176EA8] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#135a8a] active:scale-[0.99] transition-all cursor-pointer shadow-xs"
          >
            Review & RSVP on Page 4 →
          </button>
        </div>
      )}

      {/* Step Heading */}
      <div>
        <h1 className="text-3xl font-extrabold text-[#193953]">
          What should we explore along the way?
        </h1>
        <p className="mt-1 text-sm text-[#5A7184]">
          Customize your stops, delays, and schedule for {dest.name} in Asia/Kolkata wall-clock time.
        </p>
      </div>

      {/* Before You Go Warning Section */}
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800 space-y-2">
        <div className="flex items-center gap-2 font-bold text-amber-900 text-sm">
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
        <p className="text-[11px] text-amber-800/80">
          Weather Forecast: Outside 5-day predictive horizon for requested dates. Check official IMD / Karnataka State Natural Disaster Monitoring Centre updates before departure.
        </p>
      </div>

      {/* Primary Feasibility Card */}
      <div className="rounded-2xl border border-[#E1ECF2] bg-white p-6 text-[#193953] shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="rounded-full bg-[#DDF0F6] border border-[#176EA8]/30 px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#176EA8]">
            Feasibility Verdict
          </span>
          <span className="text-xs text-[#5A7184]">MG Road reference origin</span>
        </div>
        <p className="mt-2 text-2xl font-black tracking-tight text-[#193953]">{r.rating}</p>
        <p className="mt-1 text-sm text-[#5A7184]">{r.ratingExplanation}</p>

        <div className="mt-5 grid grid-cols-2 gap-4 border-t border-[#E1ECF2] pt-4 text-sm">
          <div>
            <p className="text-xs text-[#5A7184]">Usable destination free time</p>
            <strong className="text-2xl font-black text-[#193953]">{formatDuration(r.destinationSlackMinutes)}</strong>
          </div>
          <div>
            <p className="text-xs text-[#5A7184]">Return deadline margin</p>
            <strong className={`text-2xl font-black ${r.returnDeadlineMarginMinutes < 0 ? 'text-red-700' : 'text-emerald-700'}`}>
              {formatDuration(r.returnDeadlineMarginMinutes, true)}
            </strong>
          </div>
        </div>

        <div className="mt-4 border-t border-[#E1ECF2] pt-3 text-xs text-[#5A7184] space-y-1">
          <p>
            Expected home: <strong className="text-[#193953]">{formatReadableDateTime(r.homeArrivalTime)} (IST)</strong>
          </p>
          <p>
            Estimated cost: <strong className="text-[#193953]">₹{r.estimatedCostPerPersonINR.toLocaleString('en-IN')}/person</strong> (₹{r.estimatedTripTotalINR.toLocaleString('en-IN')} total for party of {currentInputs.partySize})
          </p>
        </div>
      </div>

      {/* Interactive Trip Map (Gate 5) */}
      <TripMap
        destination={dest}
        inputs={currentInputs}
        result={r}
        onTogglePitstop={togglePitstop}
      />

      {/* Adjustments & Scenarios */}
      <div className="space-y-4 rounded-2xl border border-[#E1ECF2] bg-white p-5 shadow-sm">
        <div>
          <h2 className="text-base font-bold text-[#193953]">Itinerary Scenarios & Sightseeing</h2>
          <p className="text-xs text-[#5A7184]">
            Customize departure delays and optional visits. Feasibility metrics and timelines recalculate immediately.
          </p>
        </div>

        {/* Departure Delay Scenario */}
        <div className="rounded-xl border border-[#E1ECF2] bg-[#F4F9FC] p-3.5">
          <label className="flex items-center gap-3 font-semibold text-[#193953] cursor-pointer">
            <input
              type="checkbox"
              className="h-4 w-4 rounded accent-[#176EA8] cursor-pointer"
              checked={currentInputs.simulateDelayMinutes === 60}
              onChange={e =>
                updateInputs(s => ({
                  ...s,
                  simulateDelayMinutes: e.target.checked ? 60 : 0,
                }))
              }
            />
            <div>
              <span className="block text-sm text-[#193953] font-bold">Simulate +1 hour outbound departure delay</span>
              <span className="text-xs text-[#5A7184] font-normal">
                Models being held up leaving Bengaluru (e.g., Saturday morning traffic or late start).
              </span>
            </div>
          </label>
        </div>

        {/* Attractions List: Required vs Optional */}
        <div className="space-y-3 pt-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#5A7184]">
            Destination Attractions & Sightseeing
          </h3>

          <div className="space-y-2.5">
            {dest.activities.map(a => {
              const aImg = getPlaceImage(a.id);
              const isOptional = a.isOptional;
              const isDisabled = (currentInputs.disabledActivityIds ?? []).includes(a.id);
              const outcome = r.activityOutcomes.find(o => o.activityId === a.id);

              return (
                <div
                  key={a.id}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border p-3.5 transition-all ${
                    isDisabled
                      ? 'border-[#E1ECF2] bg-[#F4F9FC] opacity-60'
                      : 'border-[#E1ECF2] bg-white shadow-xs'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {aImg ? (
                      <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-xl border border-[#E1ECF2] bg-[#F4F9FC] shadow-inner">
                        <img
                          src={aImg.src}
                          alt={aImg.alt}
                          loading="lazy"
                          className="h-full w-full object-cover"
                          onError={e => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      </div>
                    ) : (
                      <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-[#DDF0F6] text-xl">
                        📍
                      </div>
                    )}

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <strong className="text-sm font-bold text-[#193953]">{a.name}</strong>
                        {isOptional ? (
                          <span className="rounded bg-[#F4F9FC] border border-[#E1ECF2] px-2 py-0.5 text-[10px] font-semibold text-[#5A7184]">
                            Optional
                          </span>
                        ) : (
                          <span className="rounded bg-[#DDF0F6] text-[#176EA8] border border-[#176EA8]/30 px-2 py-0.5 text-[10px] font-bold">
                            Signature
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#5A7184] mt-0.5">
                        Operating: {a.openTime}–{a.closeTime} · Allocated: {a.durationMinutes}m · ₹{a.costPerPersonINR}/person
                      </p>
                      {outcome && (
                        <p className="text-[11px] font-medium mt-0.5 text-[#176EA8]">
                          {outcome.status === 'omitted'
                            ? 'Omitted by traveler choice'
                            : outcome.status === 'unavailable'
                            ? 'Operating hours closed during visit'
                            : `Scheduled for Day ${outcome.status === 'day1' ? '1' : outcome.status === 'day2' ? '2' : outcome.status === 'day3' ? '3' : '4'}`}
                        </p>
                      )}
                    </div>
                  </div>

                  {isOptional ? (
                    <button
                      type="button"
                      onClick={() => toggleActivity(a.id)}
                      className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                        isDisabled
                          ? 'border border-[#E1ECF2] bg-white text-[#193953] hover:bg-[#F4F9FC]'
                          : 'border border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
                      }`}
                    >
                      {isDisabled ? '+ Include in Trip' : '✕ Skip This Stop'}
                    </button>
                  ) : (
                    <span className="text-[11px] font-semibold text-[#5A7184] px-2 py-1">
                      Always included
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Highway Pitstops & Dining Section (Gate 6) */}
      {compatibleStops.length > 0 && (
        <div className="space-y-4 rounded-2xl border border-[#E1ECF2] bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E1ECF2] pb-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-[#193953]">
                  Verified Highway Food Stops ({compatibleStops.length} Options)
                </h2>
                <span className="rounded-full bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 text-[10px] font-bold">
                  Curated Dining
                </span>
              </div>
              <p className="text-xs text-[#5A7184]">
                Authentic highway eateries with verified reviews and road detour accounting.
              </p>
            </div>
            {/* Dietary filter chips */}
            <div className="flex items-center gap-1.5 bg-[#F4F9FC] p-1 rounded-xl border border-[#E1ECF2]">
              {(['all', 'veg', 'non-veg'] as const).map(f => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setDietaryFilter(f)}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-bold capitalize transition-colors cursor-pointer ${
                    dietaryFilter === f
                      ? 'bg-[#176EA8] text-white shadow-xs'
                      : 'text-[#5A7184] hover:text-[#193953]'
                  }`}
                >
                  {f === 'all' ? 'All Stops' : f === 'veg' ? '🌿 Veg Only' : '🍗 Non-Veg'}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {filteredStops.length === 0 ? (
              <p className="text-xs text-[#5A7184] p-3 bg-[#F4F9FC] rounded-xl border border-[#E1ECF2]">
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
                        ? 'border-amber-300 bg-amber-50/50 shadow-xs'
                        : 'border-[#E1ECF2] bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex gap-4 items-start">
                      {stopImg ? (
                        <div className="relative h-20 w-20 sm:h-24 sm:w-24 flex-shrink-0 overflow-hidden rounded-xl border border-[#E1ECF2] bg-[#F4F9FC] shadow-inner">
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
                        <div className="flex h-20 w-20 sm:h-24 sm:w-24 flex-shrink-0 items-center justify-center rounded-xl bg-amber-100 text-3xl">
                          ☕
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <strong className="text-sm font-bold text-[#193953]">{stop.name}</strong>
                          <span className="rounded bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 text-[11px] font-bold">
                            {stop.categoryLabel}
                          </span>
                          {stop.dietary && (
                            <span className="rounded bg-[#F4F9FC] border border-[#E1ECF2] px-1.5 py-0.5 text-[10px] font-semibold text-[#5A7184]">
                              {stop.dietary === 'veg' ? '🌿 Pure Veg' : stop.dietary === 'non-veg' ? '🍗 Non-Veg' : 'Multi-Cuisine'}
                            </span>
                          )}
                          {stop.rating && (
                            <span className="text-xs font-bold text-amber-700 flex items-center gap-0.5">
                              ★ {stop.rating} {stop.reviewCount && <span className="font-normal text-[#5A7184]">({stop.reviewCount.toLocaleString()}+ reviews)</span>}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-[#5A7184]">{stop.description}</p>
                        <p className="mt-1 text-xs text-[#5A7184]">
                          📍 {stop.location.address}{' '}
                          <a
                            href={stop.location.osmUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-semibold text-[#176EA8] hover:underline ml-1"
                          >
                            [OpenStreetMap ↗]
                          </a>
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-[#E1ECF2] pt-3 text-xs">
                      <div className="text-[#5A7184]">
                        <span>Est. Dwell: <strong>{stop.dwellMinutes}m</strong></span>
                        <span className="mx-1.5">·</span>
                        <span>Slip-road Detour: <strong>{stop.detourMinutes}m</strong></span>
                        <span className="mx-1.5">·</span>
                        <span className="font-semibold text-[#193953]">Total: +{totalStopMinutes}m</span>
                        {stop.replacesArrivalMeal && (
                          <p className="mt-0.5 text-[11px] text-[#176EA8] font-medium">
                            ✓ Midday meal taken at pitstop replaces redundant 45m check-in dining allowance.
                          </p>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => togglePitstop(stop.id)}
                        className={`rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer ${
                          isSelected
                            ? 'border border-amber-600 bg-amber-600 text-white shadow-xs hover:bg-amber-700'
                            : 'border border-[#E1ECF2] bg-[#F4F9FC] text-[#193953] shadow-xs hover:bg-white'
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
                  ? 'border-red-200 bg-red-50 text-red-800'
                  : 'border-amber-200 bg-amber-50 text-amber-800'
              }`}
            >
              <strong>{v.severity}:</strong> {v.message}
            </p>
          ))}
        </div>
      )}

      {/* Dynamic Day 1 .. Day N Tabs (Gate 3: Clean Navigation Without Block Counts) */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between border-b border-[#E1ECF2] pb-2 gap-2">
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
                      ? 'bg-[#176EA8] text-white shadow-xs'
                      : 'bg-white border border-[#E1ECF2] text-[#5A7184] hover:text-[#193953]'
                  }`}
                >
                  Day {d} {dayStart && `· ${formatReadableDate(dayStart)}`}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Day Timeline List (Gate 4: Editable Free-Time UI) */}
        <div className="space-y-2.5">
          {r.timeline
            .filter(t => t.day === currentActiveDay)
            .map(entry => {
              const duration = Math.round((parseIST(entry.endTime) - parseIST(entry.startTime)) / 60_000);
              const isFree = entry.category === 'FREE';
              const isDrive = entry.category === 'DRIVE';
              const isActivity = entry.category === 'ACTIVITY';
              const isPitstop = entry.category === 'PITSTOP';
              const isCustom = entry.isCustom;
              const customAct = isCustom ? (currentInputs.customActivities ?? []).find(ca => ca.id === entry.activityId) : undefined;
              const actImg = entry.activityId && !isCustom
                ? getPlaceImage(entry.activityId)
                : isPitstop
                ? getPlaceImage('maddur-tiffanys')
                : undefined;

              return (
                <div
                  key={entry.id}
                  className={`rounded-xl border p-3.5 text-sm transition-colors ${
                    isFree
                      ? 'border-emerald-200 bg-emerald-50/70 text-emerald-900'
                      : isPitstop
                      ? 'border-amber-200 bg-amber-50/80 text-amber-900'
                      : isDrive
                      ? 'border-blue-200 bg-blue-50/80 text-blue-900'
                      : isCustom
                      ? 'border-[#176EA8]/40 bg-[#DDF0F6]/80 text-[#193953]'
                      : isActivity
                      ? 'border-purple-200 bg-purple-50/80 text-purple-900'
                      : 'border-[#E1ECF2] bg-white text-[#193953]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {actImg && (
                      <img
                        src={actImg.src}
                        alt={actImg.alt}
                        loading="lazy"
                        className="h-10 w-10 rounded-lg object-cover flex-shrink-0 border border-[#E1ECF2]"
                        onError={e => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <strong className="text-[#193953]">{entry.label}</strong>
                        <span
                          className={`rounded px-2.5 py-0.5 text-xs font-semibold ${
                            isPitstop
                              ? 'bg-amber-100 text-amber-800 font-bold'
                              : isFree
                              ? 'bg-emerald-100 text-emerald-800 font-bold'
                              : isDrive
                              ? 'bg-blue-100 text-blue-800'
                              : isCustom
                              ? 'bg-[#176EA8] text-white font-bold'
                              : isActivity
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-[#F4F9FC] border border-[#E1ECF2] text-[#5A7184]'
                          }`}
                        >
                          {isPitstop
                            ? '☕ Highway Pitstop'
                            : isCustom
                            ? '✨ User Planned Activity'
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
                      <div className="mt-1 flex items-center justify-between text-xs text-[#5A7184]">
                        <span>
                          {formatTimelineTime(entry.startTime)} → {formatTimelineTime(entry.endTime)}
                        </span>
                        <span className="font-semibold text-[#193953]">{formatDuration(duration)}</span>
                      </div>

                      {/* Action buttons for Free Time and Custom Activities */}
                      {isFree && duration >= 15 && (
                        <div className="mt-2.5 pt-2 border-t border-emerald-200/60 flex items-center justify-between">
                          <span className="text-[11px] text-emerald-800">
                            Have specific plans for this {formatDuration(duration)} slot?
                          </span>
                          <button
                            type="button"
                            onClick={() => openPlanSlotModal({ day: currentActiveDay, startTime: entry.startTime, endTime: entry.endTime })}
                            className="rounded-lg bg-[#176EA8] px-3 py-1 text-xs font-bold text-white shadow-xs hover:bg-[#135a8a] transition-colors cursor-pointer"
                          >
                            + Plan This Time
                          </button>
                        </div>
                      )}

                      {isCustom && customAct && (
                        <div className="mt-2.5 pt-2 border-t border-[#176EA8]/20 flex items-center justify-between text-xs">
                          <span className="text-[#176EA8] font-medium">
                            {customAct.costPerPersonINR ? `₹${customAct.costPerPersonINR}/person` : 'No added ticket fee'}
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => openPlanSlotModal({ day: currentActiveDay, startTime: entry.startTime, endTime: entry.endTime }, customAct)}
                              className="text-[#176EA8] font-bold hover:underline cursor-pointer"
                            >
                              Edit
                            </button>
                            <span className="text-[#5A7184]">·</span>
                            <button
                              type="button"
                              onClick={() => handleDeleteCustomActivity(customAct.id)}
                              className="text-red-700 font-bold hover:underline cursor-pointer"
                            >
                              ✕ Remove
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Gate 4: "Plan This Time" Modal */}
      {planningSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl border border-[#E1ECF2] bg-white p-6 text-[#193953] shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-[#E1ECF2] pb-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#176EA8]">
                  Day {planningSlot.day} Free-Time Slot
                </span>
                <h3 className="text-xl font-black text-[#193953] mt-0.5">
                  {planningSlot.editActivity ? 'Edit Planned Activity' : 'Plan This Time'}
                </h3>
                <p className="text-xs text-[#5A7184]">
                  {formatTimelineTime(planningSlot.startTime)} → {formatTimelineTime(planningSlot.endTime)} ({formatDuration(planningSlot.maxDuration)} usable free time)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPlanningSlot(null)}
                className="rounded-full bg-[#F4F9FC] p-1.5 text-[#5A7184] hover:text-[#193953] transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Categorized Options Selector (Gate 6) */}
            <div className="space-y-3">
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#5A7184]">
                Choose Activity Category
              </label>

              {/* Category Filter Chips */}
              <div className="flex flex-wrap gap-1.5 pb-1">
                {[
                  { id: 'food', label: '🍽️ Food & Cafés' },
                  { id: 'sightseeing', label: '🏛️ Sightseeing' },
                  { id: 'shopping', label: '🛍️ Shopping' },
                  { id: 'walks', label: '🌲 Scenic Walks' },
                  { id: 'relaxation', label: '🌿 Relaxation' },
                  { id: 'custom', label: '✏️ Custom Input' },
                ].map(cat => {
                  const isSel = planCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setPlanCategory(cat.id as typeof planCategory)}
                      className={`rounded-xl px-2.5 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                        isSel
                          ? 'bg-[#176EA8] text-white shadow-2xs'
                          : 'bg-[#F4F9FC] border border-[#E1ECF2] text-[#5A7184] hover:border-[#176EA8]/40 hover:text-[#193953]'
                      }`}
                    >
                      {cat.label}
                    </button>
                  );
                })}
              </div>

              {/* Category Presets (Realistic, No Fabricated Prices) */}
              {planCategory !== 'custom' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {(
                    (planCategory === 'food'
                      ? [
                          {
                            name: 'Traditional Regional Lunch / Thali',
                            mins: 60,
                            desc: 'Wholesome vegetarian thali or authentic regional lunch spread.',
                          },
                          {
                            name: 'Local Breakfast & Heritage Tiffin (Dosa & Coffee)',
                            mins: 45,
                            desc: 'Iconic heritage tiffin room stop for crispy dosas and filter coffee.',
                          },
                          {
                            name: 'Plantation / Specialty Coffee Café Stop',
                            mins: 45,
                            desc: 'Scenic café break featuring freshly brewed local coffee & light snacks.',
                          },
                          {
                            name: 'Casual Local Cuisine Dinner',
                            mins: 60,
                            desc: 'Relaxed dinner exploring regional dishes in a comfortable local setting.',
                          },
                        ]
                      : planCategory === 'sightseeing'
                      ? [
                          {
                            name: 'Historic Heritage Walk & Architecture',
                            mins: 60,
                            desc: 'Explore historic quarters, colonial bungalows, or heritage streetscapes.',
                          },
                          {
                            name: 'Panoramic Hilltop Viewpoint',
                            mins: 45,
                            desc: 'Short trip to an elevated scenic overlook for landscape photography.',
                          },
                          {
                            name: 'Sacred Temple / Cultural Landmark Visit',
                            mins: 45,
                            desc: 'Peaceful exploration of local architecture, courtyards and traditions.',
                          },
                        ]
                      : planCategory === 'shopping'
                      ? [
                          {
                            name: 'Spice, Tea & Coffee Plantation Bazaar',
                            mins: 45,
                            desc: 'Sample and purchase fresh estate spices, cardamom, tea leaves & coffee.',
                          },
                          {
                            name: 'Local Artisan Handicrafts & Silks',
                            mins: 60,
                            desc: 'Authentic regional textiles, sandalwood carvings, pottery and souvenirs.',
                          },
                        ]
                      : planCategory === 'walks'
                      ? [
                          {
                            name: 'Golden Hour Sunset Promenade',
                            mins: 45,
                            desc: 'Scenic walk along ridge trails or lakeside paths during sunset.',
                          },
                          {
                            name: 'Botanical Garden & Nature Trail',
                            mins: 60,
                            desc: 'Shaded walking path through flora, tea gardens, and lush greenery.',
                          },
                        ]
                      : [
                          {
                            name: 'Resort Pool & Balcony Downtime',
                            mins: 90,
                            desc: 'Unwind at stay with fresh tea, reading, or quiet poolside relaxation.',
                          },
                          {
                            name: 'Traditional Ayurvedic Wellness Session',
                            mins: 60,
                            desc: 'Natural herbal rejuvenation treatment or steam bath.',
                          },
                        ]
                    )
                  ).map((sugg, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        setPlanFormName(sugg.name);
                        setPlanFormDuration(Math.min(planningSlot.maxDuration, sugg.mins));
                        setPlanFormCost(0);
                      }}
                      className="rounded-xl border border-[#E1ECF2] bg-[#F4F9FC] p-3 text-left hover:border-[#176EA8]/50 hover:bg-[#DDF0F6] transition-all cursor-pointer group"
                    >
                      <div className="flex items-start justify-between gap-1">
                        <strong className="block text-xs font-bold text-[#193953] group-hover:text-[#176EA8]">
                          {sugg.name}
                        </strong>
                        <span className="text-[10px] font-semibold text-[#176EA8] bg-white border border-[#BAE3F1] rounded-md px-1.5 py-0.5 whitespace-nowrap">
                          {sugg.mins}m
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-[#5A7184] leading-snug">
                        {sugg.desc}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Destination Curated Ideas (from Timing-Aware Guide) */}
            {(() => {
              const guide = getDestinationGuide(dest.id, availableDays.length, currentInputs.pace);
              if (!guide || guide.freeTimeIdeas.length === 0) return null;
              return (
                <div className="space-y-2 pt-2 border-t border-[#E1ECF2]">
                  <span className="block text-xs font-semibold uppercase tracking-wider text-[#176EA8]">
                    🌟 Curated Ideas for {dest.name}
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {guide.freeTimeIdeas.map((idea, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setPlanFormName(idea.title);
                          setPlanFormDuration(Math.min(planningSlot.maxDuration, idea.durationMins));
                          setPlanFormCost(0);
                        }}
                        className="rounded-xl border border-[#BAE3F1] bg-[#DDF0F6]/40 p-2.5 text-left hover:border-[#176EA8] hover:bg-[#DDF0F6] transition-all cursor-pointer"
                      >
                        <div className="flex items-center justify-between gap-1">
                          <strong className="text-xs text-[#193953] truncate">{idea.title}</strong>
                          <span className="text-[10px] text-[#176EA8] font-bold">{idea.durationMins}m</span>
                        </div>
                        <p className="mt-0.5 text-[10px] text-[#5A7184] line-clamp-2 leading-tight">
                          {idea.description}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Activity Details / Fine-Tuning Form */}
            <div className="space-y-3 pt-2 border-t border-[#E1ECF2]">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#193953]">
                  Activity Title
                </label>
                <input
                  type="text"
                  maxLength={60}
                  placeholder="e.g. Traditional Thali Lunch, Ayurvedic Massage, Evening Walk"
                  value={planFormName}
                  onChange={e => setPlanFormName(e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-[#E1ECF2] bg-[#F4F9FC] p-3 text-sm text-[#193953] focus:border-[#176EA8] focus:bg-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#193953]">
                    Duration (Minutes)
                  </label>
                  <input
                    type="number"
                    min={15}
                    max={planningSlot.maxDuration}
                    step={15}
                    value={planFormDuration}
                    onChange={e => setPlanFormDuration(parseInt(e.target.value, 10) || 15)}
                    className="mt-1 block w-full rounded-xl border border-[#E1ECF2] bg-[#F4F9FC] p-3 text-sm text-[#193953] focus:border-[#176EA8] focus:bg-white focus:outline-none"
                  />
                  <span className="text-[10px] text-[#5A7184]">Max: {planningSlot.maxDuration}m slot available</span>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#193953]">
                    Cost / Person (₹)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={50}
                    value={planFormCost}
                    onChange={e => setPlanFormCost(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    className="mt-1 block w-full rounded-xl border border-[#E1ECF2] bg-[#F4F9FC] p-3 text-sm text-[#193953] focus:border-[#176EA8] focus:bg-white focus:outline-none"
                  />
                  <span className="text-[10px] text-[#5A7184]">Optional ticket/meal budget</span>
                </div>
              </div>

              {/* Live Remaining Free Time Calculation */}
              <div className="rounded-xl bg-[#DDF0F6] border border-[#176EA8]/20 p-2.5 text-xs text-[#193953] flex items-center justify-between">
                <span>Remaining usable free time in this slot:</span>
                <strong className="text-sm text-[#176EA8]">
                  {formatDuration(Math.max(0, planningSlot.maxDuration - planFormDuration))}
                </strong>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E1ECF2]">
              <button
                type="button"
                onClick={() => setPlanningSlot(null)}
                className="rounded-xl border border-[#E1ECF2] bg-white px-4 py-2.5 text-xs font-bold text-[#5A7184] hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              {planningSlot.editActivity && (
                <button
                  type="button"
                  onClick={() => handleDeleteCustomActivity(planningSlot.editActivity!.id)}
                  className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-bold text-red-700 hover:bg-red-100 transition-colors cursor-pointer"
                >
                  Delete
                </button>
              )}
              <button
                type="button"
                disabled={!planFormName.trim()}
                onClick={handleSaveCustomActivity}
                className="rounded-xl bg-[#176EA8] px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-[#135a8a] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                Save to Schedule
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Primary CTA: "Your adventure is taking shape! / See My Trip" */}
      <div className="rounded-2xl border border-[#176EA8]/30 bg-[#DDF0F6]/60 p-6 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#176EA8]">Step 3 Complete</span>
            <h2 className="text-xl font-black text-[#193953] mt-0.5">Your adventure is taking shape!</h2>
            <p className="text-xs text-[#5A7184] mt-1">
              Review the complete digital itinerary, save locally on your device, and invite your crew with a 1-click WhatsApp RSVP.
            </p>
          </div>
          <span className="rounded-full bg-[#176EA8] text-white px-3 py-1 text-xs font-bold">
            Final Step Ahead
          </span>
        </div>

        <button
          onClick={goToReviewScreen}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#176EA8] px-6 py-4 text-base font-bold text-white shadow-sm hover:bg-[#135a8a] active:scale-[0.99] transition-all cursor-pointer"
        >
          {isGuestView ? 'Review Trip & RSVP →' : 'Review My Trip →'}
        </button>
      </div>

      <a
        href={maps}
        target="_blank"
        rel="noopener noreferrer"
        className="block text-center text-sm font-semibold text-[#176EA8] hover:underline"
      >
        Open route in Google Maps ↗
      </a>

      <p className="text-center text-xs text-[#5A7184]">
        Cost assumes {currentInputs.partySize} travelers sharing a car and room. Meals and personal expenses excluded. Route durations and most costs are unverified planning estimates.
      </p>
    </section>
  );
}
