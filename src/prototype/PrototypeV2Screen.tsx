import { useState, useMemo } from 'react';
import {
  PROTOTYPE_DESTINATIONS,
  INITIAL_MYSURU_SCHEDULE,
  DISCOVER_PLACES_MYSURU,
  type DestinationCardData,
  type ScheduledActivity,
  type DiscoverPlace,
} from './prototypeData';
import PrototypeMap from './PrototypeMap';

interface WhatChangedNotice {
  message: string;
  previousSchedule: ScheduledActivity[];
  timestamp: number;
}

export default function PrototypeV2Screen() {
  // Navigation: Step 1 (Destination Chooser) or Step 2 (Trip Builder)
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);

  // Device simulation: desktop (side-by-side) or mobile (375px preview)
  const [deviceView, setDeviceView] = useState<'desktop' | 'mobile'>('desktop');

  // Mobile sheet snap state: 'peek' | 'half' | 'full'
  const [sheetSnap, setSheetSnap] = useState<'peek' | 'half' | 'full'>('half');

  // Page 2 modal state for "Why this result?"
  const [selectedWhyDest, setSelectedWhyDest] = useState<DestinationCardData | null>(null);

  // Page 3 Active view: 'schedule' or 'discover'
  const [builderTab, setBuilderTab] = useState<'schedule' | 'discover'>('schedule');

  // Itinerary schedule state
  const [schedule, setSchedule] = useState<ScheduledActivity[]>(INITIAL_MYSURU_SCHEDULE);
  const [historyStack, setHistoryStack] = useState<ScheduledActivity[][]>([]);
  const [whatChangedNotice, setWhatChangedNotice] = useState<WhatChangedNotice | null>(null);

  // Projected late delay simulation in minutes (0 = normal, 150 = simulated highway delay)
  const [simulatedDelayMinutes, setSimulatedDelayMinutes] = useState<number>(0);

  // Hover sync between list and map
  const [activeHoverId, setActiveHoverId] = useState<string | null>(null);

  // Place discovery category filter
  const [discoverCategory, setDiscoverCategory] = useState<string>('all');

  // Custom place form state
  const [customName, setCustomName] = useState('');
  const [customCategory, setCustomCategory] = useState<'sightseeing' | 'food' | 'nature'>('sightseeing');
  const [customDuration, setCustomDuration] = useState<number>(45);
  const [customDetourMode, setCustomDetourMode] = useState<'wishlist' | 'schedule'>('schedule');
  const [customUserAllowance, setCustomUserAllowance] = useState<number>(15);

  // Active day in builder
  const [activeDay, setActiveDay] = useState<number>(1);

  // Push state to history stack before modifying schedule
  const recordHistory = (newSchedule: ScheduledActivity[], changeMessage: string) => {
    setHistoryStack(prev => [...prev, schedule]);
    setSchedule(newSchedule);
    setWhatChangedNotice({
      message: changeMessage,
      previousSchedule: schedule,
      timestamp: Date.now(),
    });
  };

  // Undo last action
  const handleUndo = () => {
    if (historyStack.length === 0) return;
    const previous = historyStack[historyStack.length - 1];
    setHistoryStack(prev => prev.slice(0, -1));
    setSchedule(previous);
    setWhatChangedNotice({
      message: 'Action undone. Schedule restored.',
      previousSchedule: schedule,
      timestamp: Date.now(),
    });
  };

  // Base schedule calculations for Mysuru 2-day
  const calculatedMetrics = useMemo(() => {
    // Total scheduled activity duration in Day 1
    const day1Activities = schedule.filter(s => s.day === 1);
    const day1ActivityMinutes = day1Activities.reduce((acc, curr) => acc + curr.durationMinutes, 0);
    const day1DetourMinutes = day1Activities.reduce((acc, curr) => acc + curr.detourMinutes, 0);

    // Baseline return buffer is 120m (+2h 00m) with initial schedule
    // Baseline Day 1 activities: Palace (150m) + Market (60m) = 210m
    const initialDay1ActivityMinutes = 210;
    const initialDay1DetourMinutes = 10;
    const initialTotalDay1 = initialDay1ActivityMinutes + initialDay1DetourMinutes; // 220m

    const currentTotalDay1 = day1ActivityMinutes + day1DetourMinutes;
    const day1Delta = currentTotalDay1 - initialTotalDay1;

    // Day 2 baseline return buffer (120m) minus simulated highway delay
    // Note: Day 1 changes affect Day 1 leisure time; only Day 2 activities or overall delays affect Sunday return buffer
    let returnBufferMinutes = 120 - simulatedDelayMinutes;

    // Home arrival time calculation (baseline 18:30 IST)
    const baselineArrivalHour = 18;
    const baselineArrivalMinute = 30;
    const totalArrivalMinutes = baselineArrivalHour * 60 + baselineArrivalMinute + simulatedDelayMinutes;
    const arrH = Math.floor(totalArrivalMinutes / 60) % 24;
    const arrM = totalArrivalMinutes % 60;
    const formattedArrival = `${String(arrH).padStart(2, '0')}:${String(arrM).padStart(2, '0')} IST`;

    // Feasibility status
    const isProjectedLate = returnBufferMinutes < 0;

    // Total daylight sightseeing minutes (baseline 366m / 6h 06m)
    // When activities are removed or added, unallocated daylight leisure shifts accordingly
    const daylightSightseeingMinutes = Math.max(0, 366 - Math.max(0, day1Delta));
    const eveningLeisureMinutes = 135; // 2h 15m (18:45-21:00)
    const totalFreeTimeMinutes = daylightSightseeingMinutes + eveningLeisureMinutes;

    return {
      returnBufferMinutes,
      formattedArrival,
      isProjectedLate,
      daylightSightseeingMinutes,
      eveningLeisureMinutes,
      totalFreeTimeMinutes,
      day1ActivityMinutes,
      day1Delta,
    };
  }, [schedule, simulatedDelayMinutes]);

  // Handle Remove Activity
  const handleRemoveActivity = (id: string) => {
    const target = schedule.find(s => s.id === id);
    if (!target) return;
    const next = schedule.filter(s => s.id !== id);
    const freedMinutes = target.durationMinutes + target.detourMinutes;
    recordHistory(
      next,
      `Removed "${target.name}". Freed ${freedMinutes}m of schedule. Day 2 return buffer unchanged (+${calculatedMetrics.returnBufferMinutes}m).`
    );
  };

  // Handle Reorder Activities (Move Up/Down)
  const handleMoveActivity = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= schedule.length) return;
    const next = [...schedule];
    const temp = next[index];
    next[index] = next[targetIndex];
    next[targetIndex] = temp;
    recordHistory(next, `Reordered stops: "${temp.name}" moved ${direction}.`);
  };

  // Handle Add Place from Discovery
  const handleAddDiscoverPlace = (place: DiscoverPlace) => {
    // Check if already in schedule
    if (schedule.some(s => s.id === place.id)) {
      alert(`"${place.name}" is already in your itinerary.`);
      return;
    }

    const newStop: ScheduledActivity = {
      id: place.id,
      name: place.name,
      category: place.category,
      day: activeDay,
      startTime: '19:00',
      endTime: '19:45',
      durationMinutes: place.durationMinutes,
      costINR: place.costINR,
      locationName: place.locationName,
      coordinates: place.coordinates,
      imageSrc: place.imageSrc,
      notes: `${place.description} (${place.operatingHours})`,
      detourMinutes: place.estimatedDetourMinutes,
      detourSource: 'engine_verified',
      isDeletable: true,
    };

    const next = [...schedule, newStop];
    recordHistory(
      next,
      `Scheduled "${place.name}" into Day ${activeDay}. Added ${place.durationMinutes}m visit + ${place.estimatedDetourMinutes}m corridor detour.`
    );
    setBuilderTab('schedule');
  };

  // Handle Add Custom Spot
  const handleAddCustomSpot = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) return;

    const detourAllowance = customDetourMode === 'wishlist' ? 0 : customUserAllowance;
    const newCustomStop: ScheduledActivity = {
      id: `custom-${Date.now()}`,
      name: customName.trim(),
      category: customCategory,
      day: activeDay,
      startTime: '19:30',
      endTime: '20:15',
      durationMinutes: customDuration,
      costINR: 0,
      locationName: 'User-specified location, Mysuru',
      coordinates: [12.3150, 76.6520], // Central Mysuru default for custom spot
      notes:
        customDetourMode === 'wishlist'
          ? 'Saved to wishlist (no corridor detour scheduled).'
          : `Scheduled with ${detourAllowance}m user-entered detour allowance.`,
      detourMinutes: detourAllowance,
      detourSource: customDetourMode === 'wishlist' ? 'none' : 'user_specified',
      isDeletable: true,
    };

    const next = [...schedule, newCustomStop];
    recordHistory(
      next,
      `Added custom place "${customName.trim()}". Detour allowance: ${detourAllowance}m (${
        customDetourMode === 'wishlist' ? 'Wishlist' : 'User-entered'
      }).`
    );
    setCustomName('');
    setBuilderTab('schedule');
  };

  // Filter discover places
  const filteredPlaces = useMemo(() => {
    if (discoverCategory === 'all') return DISCOVER_PLACES_MYSURU;
    return DISCOVER_PLACES_MYSURU.filter(p => p.category === discoverCategory);
  }, [discoverCategory]);

  return (
    <div className="space-y-6">
      {/* Prototype Control Banner */}
      <div className="rounded-2xl border-2 border-[#176EA8]/30 bg-white p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-[#176EA8]"></span>
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-[#176EA8] bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                  V2.1 Clickable Prototype
                </span>
                <span className="text-xs font-semibold text-[#5A7184]">Route: /prototype/v2</span>
              </div>
              <p className="text-xs text-[#5A7184] mt-0.5">
                Isolated sandbox for Product Owner review. Production routes untouched.
              </p>
            </div>
          </div>

          {/* Interactive Step Switcher & Device Toggle */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-xl bg-[#F4F9FC] p-1 border border-[#E1ECF2]">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                  currentStep === 1
                    ? 'bg-[#176EA8] text-white shadow-xs'
                    : 'text-[#5A7184] hover:text-[#193953]'
                }`}
              >
                1. Destination Chooser (Page 2)
              </button>
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                  currentStep === 2
                    ? 'bg-[#176EA8] text-white shadow-xs'
                    : 'text-[#5A7184] hover:text-[#193953]'
                }`}
              >
                2. Trip Builder (Page 3)
              </button>
            </div>

            <div className="inline-flex rounded-xl bg-[#F4F9FC] p-1 border border-[#E1ECF2]">
              <button
                type="button"
                onClick={() => setDeviceView('desktop')}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition-all ${
                  deviceView === 'desktop'
                    ? 'bg-white text-[#193953] shadow-xs border border-[#E1ECF2]'
                    : 'text-[#5A7184] hover:text-[#193953]'
                }`}
                title="Desktop Side-by-Side Workspace"
              >
                🖥️ Desktop
              </button>
              <button
                type="button"
                onClick={() => setDeviceView('mobile')}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition-all ${
                  deviceView === 'mobile'
                    ? 'bg-white text-[#193953] shadow-xs border border-[#E1ECF2]'
                    : 'text-[#5A7184] hover:text-[#193953]'
                }`}
                title="Mobile 375px Collapsible View"
              >
                📱 Mobile
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* STEP 1: PAGE 2 — MINIMAL DESTINATION CHOOSER                              */}
      {/* ========================================================================= */}
      {currentStep === 1 && (
        <section className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#E1ECF2] pb-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#176EA8]">
                Step 2 of 4 · Feasibility Comparison
              </span>
              <h1 className="text-2xl sm:text-3xl font-black text-[#193953] tracking-tight">
                Where can you realistically go this weekend?
              </h1>
              <p className="text-sm text-[#5A7184] mt-1">
                Calculated from <strong>MG Road, Bengaluru</strong> · Sat 08:00 IST departure → Sun 20:30 IST return deadline.
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs bg-white px-3 py-2 rounded-xl border border-[#E1ECF2] shadow-xs text-[#5A7184]">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>
                <strong>4 destinations evaluated</strong> by deterministic scheduler
              </span>
            </div>
          </div>

          {/* 2-Column Desktop Grid for Minimal Scanability */}
          <div
            className={`grid gap-5 ${
              deviceView === 'mobile' ? 'grid-cols-1 max-w-[375px] mx-auto' : 'grid-cols-1 md:grid-cols-2'
            }`}
          >
            {PROTOTYPE_DESTINATIONS.map(dest => {
              const isFeasible = dest.feasibilityRating === 'FEASIBLE';
              const isChallenging = dest.feasibilityRating === 'CHALLENGING';

              return (
                <div
                  key={dest.id}
                  className="group relative flex flex-col justify-between rounded-2xl border border-[#E1ECF2] bg-white overflow-hidden shadow-xs hover:shadow-md hover:border-[#176EA8]/40 transition-all"
                >
                  {/* Hero Photo & Verified Badges */}
                  <div className="relative h-48 w-full overflow-hidden bg-slate-100">
                    <img
                      src={dest.imageSrc}
                      alt={dest.imageAlt}
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"></div>

                    {/* Feasibility Badge */}
                    <div className="absolute top-3 left-3">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black uppercase tracking-wider shadow-sm ${
                          isFeasible
                            ? 'bg-emerald-500 text-white'
                            : isChallenging
                            ? 'bg-amber-500 text-white'
                            : 'bg-rose-500 text-white'
                        }`}
                      >
                        {isFeasible ? '✓' : isChallenging ? '⚡' : '✕'} {dest.feasibilityLabel}
                      </span>
                    </div>

                    {/* Image Attribution Pill */}
                    <div className="absolute top-3 right-3">
                      <span className="rounded-md bg-black/60 backdrop-blur-xs px-2 py-0.5 text-[10px] text-white/90">
                        📷 {dest.imageAuthor} ({dest.imageLicense})
                      </span>
                    </div>

                    {/* Destination Title & Tagline */}
                    <div className="absolute bottom-3 left-3 right-3 text-white">
                      <div className="flex items-baseline gap-2">
                        <h2 className="text-xl font-black tracking-tight">{dest.name}</h2>
                        <span className="text-xs text-white/80 font-medium">{dest.state}</span>
                      </div>
                      <p className="text-xs text-white/90 line-clamp-1">{dest.tagline}</p>
                    </div>
                  </div>

                  {/* Body: 3 Essential Decision Metrics */}
                  <div className="p-4 space-y-4 flex-1 flex flex-col justify-between">
                    <div className="grid grid-cols-3 gap-2 text-center bg-[#F4F9FC] p-3 rounded-xl border border-[#E1ECF2]">
                      {/* Metric 1: Estimated Drive */}
                      <div className="space-y-0.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#5A7184]">
                          Est. Drive
                        </span>
                        <div className="text-sm font-black text-[#193953]">{dest.drivingTimeFormatted}</div>
                        <span className="text-[9px] text-[#5A7184] block">each way</span>
                      </div>

                      {/* Metric 2: Daylight Leisure */}
                      <div className="space-y-0.5 border-x border-[#E1ECF2] px-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#5A7184]">
                          Daylight Sightseeing
                        </span>
                        <div className="text-sm font-black text-[#176EA8]">
                          {Math.floor(dest.daylightSightseeingMinutes / 60)}h{' '}
                          {dest.daylightSightseeingMinutes % 60}m
                        </div>
                        <span className="text-[9px] text-[#5A7184] block">
                          +{Math.floor(dest.unallocatedEveningMinutes / 60)}h eve
                        </span>
                      </div>

                      {/* Metric 3: Return Margin */}
                      <div className="space-y-0.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#5A7184]">
                          Return Margin
                        </span>
                        <div
                          className={`text-sm font-black ${
                            dest.returnBufferMinutes >= 60
                              ? 'text-emerald-700'
                              : dest.returnBufferMinutes > 0
                              ? 'text-amber-700'
                              : 'text-rose-700'
                          }`}
                        >
                          {dest.returnBufferMinutes >= 0 ? `+${dest.returnBufferMinutes}m` : `${dest.returnBufferMinutes}m`}
                        </div>
                        <span className="text-[9px] text-[#5A7184] block">
                          {dest.returnBufferMinutes >= 60 ? 'Safe buffer' : 'Tight / Late'}
                        </span>
                      </div>
                    </div>

                    {/* Highlights bullets */}
                    <div className="space-y-1">
                      <div className="text-[11px] font-bold text-[#5A7184] uppercase tracking-wider">
                        Key Attractions
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {dest.highlights.map((h, i) => (
                          <span
                            key={i}
                            className="inline-block rounded-md bg-white border border-[#E1ECF2] px-2 py-0.5 text-xs text-[#193953]"
                          >
                            {h}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Actions: "Why this result?" and Primary CTA */}
                    <div className="pt-2 flex items-center justify-between gap-3 border-t border-[#E1ECF2]">
                      <button
                        type="button"
                        onClick={() => setSelectedWhyDest(dest)}
                        className="text-xs font-bold text-[#176EA8] hover:underline flex items-center gap-1 py-1"
                      >
                        <span>Why this result?</span>
                        <span className="text-[10px]">ℹ️</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (dest.id === 'mysuru') {
                            setCurrentStep(2);
                          } else {
                            alert(`Prototype interactive workspace is configured for Mysuru. Click "Plan Mysuru Trip".`);
                          }
                        }}
                        className={`rounded-xl px-4 py-2 text-xs font-bold text-white shadow-xs transition-all active:scale-95 ${
                          dest.id === 'mysuru'
                            ? 'bg-[#176EA8] hover:bg-[#135A8A]'
                            : 'bg-[#5A7184] hover:bg-[#485B6B]'
                        }`}
                      >
                        Plan {dest.name} Trip →
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* "Why this result?" Modal / Drawer */}
          {selectedWhyDest && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fadeIn">
              <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-[#E1ECF2] space-y-4">
                <div className="flex items-start justify-between border-b border-[#E1ECF2] pb-3">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-[#176EA8]">
                      Deterministic Feasibility Calculation
                    </span>
                    <h3 className="text-xl font-black text-[#193953]">
                      Why is {selectedWhyDest.name} {selectedWhyDest.feasibilityLabel}?
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedWhyDest(null)}
                    className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-3 text-xs text-[#193953]">
                  {/* Drive Breakdown */}
                  <div className="rounded-xl bg-[#F4F9FC] p-3 border border-[#E1ECF2] space-y-1.5">
                    <div className="font-bold text-xs text-[#193953] flex justify-between">
                      <span>Highway Routing & Congestion Buffer</span>
                      <span className="text-[#176EA8]">{selectedWhyDest.drivingTimeFormatted} each way</span>
                    </div>
                    <p className="text-[#5A7184]">
                      Route: {selectedWhyDest.assumptions.route}. Modeled base drive:{' '}
                      <strong>{selectedWhyDest.drivingBaseMinutes} min</strong> +{' '}
                      <strong>{selectedWhyDest.drivingBufferMinutes} min</strong> (20% safety margin).
                    </p>
                  </div>

                  {/* Daylight Leisure vs Evening Split */}
                  <div className="rounded-xl bg-sky-50 p-3 border border-sky-200 space-y-1.5">
                    <div className="font-bold text-xs text-sky-900 flex justify-between">
                      <span>Daylight vs. Evening Leisure Split</span>
                      <span className="text-sky-800">
                        Total Free Time: {Math.floor(selectedWhyDest.totalFreeTimeMinutes / 60)}h{' '}
                        {selectedWhyDest.totalFreeTimeMinutes % 60}m
                      </span>
                    </div>
                    <ul className="list-disc pl-4 space-y-1 text-sky-950">
                      <li>
                        <strong>Actual Daylight Sightseeing:</strong>{' '}
                        {Math.floor(selectedWhyDest.daylightSightseeingMinutes / 60)}h{' '}
                        {selectedWhyDest.daylightSightseeingMinutes % 60}m (07:45–18:15 IST natural sunlight window).
                      </li>
                      <li>
                        <strong>Unallocated Evening Leisure:</strong>{' '}
                        {Math.floor(selectedWhyDest.unallocatedEveningMinutes / 60)}h{' '}
                        {selectedWhyDest.unallocatedEveningMinutes % 60}m (18:45–21:00 post-sunset dinner & rest).
                      </li>
                    </ul>
                  </div>

                  {/* Return Deadline Timing */}
                  <div className="rounded-xl bg-[#F4F9FC] p-3 border border-[#E1ECF2] space-y-1">
                    <div className="font-bold text-xs text-[#193953]">Timeline Milestones</div>
                    <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                      <div>
                        Outbound: <strong>{selectedWhyDest.outboundDeparture}</strong>
                      </div>
                      <div>
                        Day 1 Arrival: <strong>{selectedWhyDest.day1Arrival}</strong>
                      </div>
                      <div>
                        Return Departs: <strong>{selectedWhyDest.day2ReturnDeparture}</strong>
                      </div>
                      <div>
                        Home Arrival: <strong>{selectedWhyDest.homeArrival}</strong>
                      </div>
                    </div>
                    <div className="pt-1 text-[11px] text-emerald-700 font-semibold">
                      Return buffer before 20:30 IST deadline: +{selectedWhyDest.returnBufferMinutes}m margin
                    </div>
                  </div>

                  {/* Official Evidence Citations */}
                  <div className="space-y-1 pt-1">
                    <div className="font-bold text-[11px] text-[#5A7184] uppercase tracking-wider">
                      Official Source & Attribution Evidence
                    </div>
                    {selectedWhyDest.assumptions.evidenceNotes.map((note, idx) => (
                      <div key={idx} className="text-[11px] text-[#5A7184] flex items-start gap-1.5">
                        <span>•</span>
                        <span>{note}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setSelectedWhyDest(null)}
                    className="rounded-xl bg-[#176EA8] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#135A8A]"
                  >
                    Got It
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* ========================================================================= */}
      {/* STEP 2: PAGE 3 — CONNECTED INTERACTIVE TRIP BUILDER                       */}
      {/* ========================================================================= */}
      {currentStep === 2 && (
        <section className="space-y-5">
          {/* Top Sticky Return-Margin Feasibility Indicator */}
          <div
            className={`rounded-2xl p-4 shadow-sm border transition-all ${
              calculatedMetrics.isProjectedLate
                ? 'bg-rose-50 border-rose-300 text-rose-900'
                : 'bg-white border-[#E1ECF2] text-[#193953]'
            }`}
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-xl font-black text-lg ${
                    calculatedMetrics.isProjectedLate
                      ? 'bg-rose-500 text-white'
                      : 'bg-emerald-500 text-white'
                  }`}
                >
                  {calculatedMetrics.isProjectedLate ? '⚠️' : '✓'}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black">
                      {calculatedMetrics.isProjectedLate
                        ? `Projected Late by ${Math.abs(calculatedMetrics.returnBufferMinutes)} min`
                        : `Return Margin: +${calculatedMetrics.returnBufferMinutes}m Safe Buffer`}
                    </span>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        calculatedMetrics.isProjectedLate
                          ? 'bg-rose-200 text-rose-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {calculatedMetrics.isProjectedLate ? 'Overdue Constraint' : 'On Schedule'}
                    </span>
                  </div>

                  <p className="text-xs text-[#5A7184] mt-0.5">
                    Est. Home Arrival: <strong>{calculatedMetrics.formattedArrival}</strong> · Hard Deadline:{' '}
                    <strong>Sun 20:30 IST</strong> · Usable Daylight Sightseeing:{' '}
                    <strong>
                      {Math.floor(calculatedMetrics.daylightSightseeingMinutes / 60)}h{' '}
                      {calculatedMetrics.daylightSightseeingMinutes % 60}m
                    </strong>
                  </p>
                </div>
              </div>

              {/* Simulation Test Controls */}
              <div className="flex items-center gap-2">
                {simulatedDelayMinutes === 0 ? (
                  <button
                    type="button"
                    onClick={() => setSimulatedDelayMinutes(150)}
                    className="rounded-xl bg-amber-500 hover:bg-amber-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs transition-all"
                    title="Simulate a 2h 30m delay on the expressway"
                  >
                    Simulate +150m Highway Delay
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setSimulatedDelayMinutes(0)}
                    className="rounded-xl bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white shadow-xs transition-all"
                  >
                    Reset Delay (Clear 150m)
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setSchedule(INITIAL_MYSURU_SCHEDULE);
                    setHistoryStack([]);
                    setWhatChangedNotice(null);
                    setSimulatedDelayMinutes(0);
                  }}
                  className="rounded-xl border border-[#E1ECF2] bg-white px-3 py-1.5 text-xs font-bold text-[#5A7184] hover:text-[#193953] shadow-xs"
                >
                  Reset Schedule
                </button>
              </div>
            </div>

            {/* Projected Late Alert & One-Click Remedies */}
            {calculatedMetrics.isProjectedLate && (
              <div className="mt-3 pt-3 border-t border-rose-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="text-xs text-rose-800 font-medium">
                  <strong>Constraint violation:</strong> Projected arrival at {calculatedMetrics.formattedArrival}{' '}
                  violates your 20:30 IST return deadline. Choose a remedy:
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      // Remedy 1: Drop Devaraja Market Walk (-60m)
                      handleRemoveActivity('mysuru-market');
                      setSimulatedDelayMinutes(prev => Math.max(0, prev - 60));
                    }}
                    className="rounded-lg bg-rose-600 hover:bg-rose-700 px-3 py-1 text-xs font-bold text-white shadow-xs"
                  >
                    Drop Market (-60m)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      // Remedy 2: Extend deadline
                      setSimulatedDelayMinutes(0);
                      alert('Deadline extended to 22:00 IST for testing. Margin restored.');
                    }}
                    className="rounded-lg bg-white border border-rose-300 text-rose-700 hover:bg-rose-50 px-3 py-1 text-xs font-bold shadow-xs"
                  >
                    Extend Deadline (+60m)
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* "What Changed?" Persistent Notification Card with Undo */}
          {whatChangedNotice && (
            <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-2.5 shadow-xs flex items-center justify-between gap-3 animate-fadeIn">
              <div className="flex items-center gap-2 text-xs text-sky-900">
                <span className="text-base">ℹ️</span>
                <span className="font-semibold">{whatChangedNotice.message}</span>
              </div>
              <button
                type="button"
                onClick={handleUndo}
                className="rounded-lg bg-white border border-sky-300 px-2.5 py-1 text-xs font-bold text-[#176EA8] hover:bg-sky-100 shadow-xs active:scale-95 transition-all flex items-center gap-1"
              >
                <span>↩</span>
                <span>Undo</span>
              </button>
            </div>
          )}

          {/* ========================================================================= */}
          {/* WORKSPACE VIEW: DESKTOP (SIDE-BY-SIDE) OR MOBILE (COLLAPSIBLE SHEET)      */}
          {/* ========================================================================= */}

          {deviceView === 'desktop' ? (
            /* DESKTOP SIDE-BY-SIDE WORKSPACE (55% Itinerary / 45% Sticky Map) */
            <div className="grid grid-cols-12 gap-5 items-start">
              {/* Left Column (55% / 7 cols): Itinerary or Place Discovery */}
              <div className="col-span-12 lg:col-span-7 space-y-4">
                {/* Mode Selector Tabs: Schedule vs Place Discovery */}
                <div className="flex items-center justify-between border-b border-[#E1ECF2] pb-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setBuilderTab('schedule');
                        setActiveDay(1);
                      }}
                      className={`text-sm font-bold pb-2 px-1 border-b-2 transition-all ${
                        builderTab === 'schedule' && activeDay === 1
                          ? 'border-[#176EA8] text-[#176EA8]'
                          : 'border-transparent text-[#5A7184] hover:text-[#193953]'
                      }`}
                    >
                      Day 1: Sat ({schedule.filter(s => s.day === 1).length} stops)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setBuilderTab('schedule');
                        setActiveDay(2);
                      }}
                      className={`text-sm font-bold pb-2 px-1 border-b-2 transition-all ${
                        builderTab === 'schedule' && activeDay === 2
                          ? 'border-[#176EA8] text-[#176EA8]'
                          : 'border-transparent text-[#5A7184] hover:text-[#193953]'
                      }`}
                    >
                      Day 2: Sun (Return 14:36)
                    </button>
                    <button
                      type="button"
                      onClick={() => setBuilderTab('discover')}
                      className={`text-sm font-bold pb-2 px-1 border-b-2 transition-all flex items-center gap-1.5 ${
                        builderTab === 'discover'
                          ? 'border-[#176EA8] text-[#176EA8]'
                          : 'border-transparent text-[#5A7184] hover:text-[#193953]'
                      }`}
                    >
                      <span>+ Discover Places</span>
                      <span className="rounded-full bg-sky-100 text-[#176EA8] px-1.5 py-0.2 text-[10px] font-bold">
                        5
                      </span>
                    </button>
                  </div>

                  {builderTab === 'schedule' && (
                    <button
                      type="button"
                      onClick={() => setBuilderTab('discover')}
                      className="rounded-xl bg-[#176EA8] hover:bg-[#135A8A] px-3 py-1.5 text-xs font-bold text-white shadow-xs active:scale-95 transition-all"
                    >
                      + Add a Place
                    </button>
                  )}
                </div>

                {/* TAB 1: SCHEDULE VIEW */}
                {builderTab === 'schedule' && (
                  <div className="space-y-3">
                    {/* Fixed Outbound Leg Card */}
                    <div className="rounded-xl border border-dashed border-[#BAE3F1] bg-[#F4F9FC] p-3 text-xs text-[#5A7184] flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-base">🚗</span>
                        <div>
                          <strong className="text-[#193953]">Outbound Drive from MG Road</strong>
                          <span className="block text-[11px]">08:00 IST departure → 11:54 IST arrival (3h 54m via NH 275)</span>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold bg-white border border-[#E1ECF2] px-2 py-0.5 rounded text-[#176EA8]">
                        Fixed Corridor
                      </span>
                    </div>

                    {/* Check-in / Lunch break */}
                    <div className="rounded-xl border border-[#E1ECF2] bg-white p-3 text-xs text-[#5A7184] flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-base">🏨</span>
                        <div>
                          <strong className="text-[#193953]">Hotel Check-in & Lunch</strong>
                          <span className="block text-[11px]">11:54–13:09 IST (75m modeled allocation)</span>
                        </div>
                      </div>
                      <span className="text-[10px] text-gray-500">Scheduled</span>
                    </div>

                    {/* Active Scheduled Activities */}
                    <div className="space-y-3">
                      {schedule.map((item, index) => {
                        const isHovered = activeHoverId === item.id;

                        return (
                          <div
                            key={item.id}
                            onMouseEnter={() => setActiveHoverId(item.id)}
                            onMouseLeave={() => setActiveHoverId(null)}
                            className={`rounded-2xl border p-4 transition-all duration-200 bg-white shadow-xs ${
                              isHovered
                                ? 'border-[#176EA8] ring-2 ring-[#176EA8]/20 shadow-md'
                                : 'border-[#E1ECF2] hover:border-[#176EA8]/40'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-3">
                                {/* Order Badge */}
                                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#176EA8] text-white font-bold text-xs">
                                  #{index + 1}
                                </div>

                                <div>
                                  <div className="flex items-center gap-2">
                                    <h4 className="text-sm font-black text-[#193953]">{item.name}</h4>
                                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                                      {item.category}
                                    </span>
                                  </div>

                                  <div className="text-xs text-[#5A7184] mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                                    <span>
                                      ⏰ <strong>{item.startTime}–{item.endTime}</strong> ({item.durationMinutes}m)
                                    </span>
                                    <span>📍 {item.locationName}</span>
                                    {item.costINR > 0 ? (
                                      <span className="font-semibold text-emerald-700">Entry: ₹{item.costINR}</span>
                                    ) : (
                                      <span className="font-semibold text-sky-700">Free Access</span>
                                    )}
                                  </div>

                                  {item.notes && <p className="text-xs text-gray-600 mt-2">{item.notes}</p>}

                                  {item.detourMinutes > 0 && (
                                    <div className="text-[11px] text-amber-700 mt-1 font-medium">
                                      Detour allowance: {item.detourMinutes}m ({item.detourSource})
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Reorder and Delete Action Buttons */}
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleMoveActivity(index, 'up')}
                                  disabled={index === 0}
                                  className="h-7 w-7 rounded-lg border border-[#E1ECF2] text-xs font-bold text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent"
                                  title="Move Earlier"
                                >
                                  ▲
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleMoveActivity(index, 'down')}
                                  disabled={index === schedule.length - 1}
                                  className="h-7 w-7 rounded-lg border border-[#E1ECF2] text-xs font-bold text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent"
                                  title="Move Later"
                                >
                                  ▼
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveActivity(item.id)}
                                  className="h-7 w-7 rounded-lg border border-rose-200 text-xs font-bold text-rose-600 hover:bg-rose-50"
                                  title="Remove Stop"
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Free Evening Leisure Box */}
                    <div className="rounded-xl border border-dashed border-emerald-300 bg-emerald-50/60 p-3 text-xs text-emerald-900 flex items-center justify-between">
                      <div>
                        <strong className="block text-emerald-950 font-bold">
                          Post-Sunset Evening Leisure (18:45–21:00 IST)
                        </strong>
                        <span className="text-[11px] text-emerald-800">
                          2h 15m unallocated for local dining, Mysore pak tasting, or rest. (Daylight ends ~18:18 IST).
                        </span>
                      </div>
                      <span className="text-xs font-bold text-emerald-800 bg-white px-2 py-1 rounded border border-emerald-200">
                        +2h 15m free
                      </span>
                    </div>
                  </div>
                )}

                {/* TAB 2: PLACE DISCOVERY VIEW (Keeps Map 100% visible on right!) */}
                {builderTab === 'discover' && (
                  <div className="space-y-4 rounded-2xl border border-[#E1ECF2] bg-white p-5 shadow-xs animate-fadeIn">
                    <div className="flex items-center justify-between border-b border-[#E1ECF2] pb-3">
                      <div>
                        <h3 className="text-base font-black text-[#193953]">Discover Places in Mysuru</h3>
                        <p className="text-xs text-[#5A7184]">
                          Select places to schedule or create a custom stop with explicit detour allowance.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setBuilderTab('schedule')}
                        className="rounded-lg border border-[#E1ECF2] px-3 py-1 text-xs font-bold text-[#5A7184] hover:text-[#193953]"
                      >
                        ← Back to Schedule
                      </button>
                    </div>

                    {/* Category Filter Pills */}
                    <div className="flex flex-wrap gap-1.5 text-xs">
                      {['all', 'food', 'sightseeing', 'nature', 'fuel'].map(cat => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setDiscoverCategory(cat)}
                          className={`rounded-lg px-3 py-1 font-bold capitalize transition-all ${
                            discoverCategory === cat
                              ? 'bg-[#176EA8] text-white shadow-xs'
                              : 'bg-[#F4F9FC] text-[#5A7184] hover:text-[#193953] border border-[#E1ECF2]'
                          }`}
                        >
                          {cat === 'all' ? 'All Places' : cat}
                        </button>
                      ))}
                    </div>

                    {/* Curated Places List */}
                    <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                      {filteredPlaces.map(place => {
                        const isScheduled = schedule.some(s => s.id === place.id);

                        return (
                          <div
                            key={place.id}
                            className="rounded-xl border border-[#E1ECF2] p-3.5 hover:border-[#176EA8]/40 bg-white transition-all space-y-2"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="flex items-center gap-2">
                                  <h4 className="text-sm font-bold text-[#193953]">{place.name}</h4>
                                  <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded bg-sky-50 text-[#176EA8] border border-sky-200">
                                    {place.categoryLabel}
                                  </span>
                                </div>
                                <p className="text-xs text-[#5A7184] mt-1">{place.description}</p>
                              </div>

                              <button
                                type="button"
                                disabled={isScheduled}
                                onClick={() => handleAddDiscoverPlace(place)}
                                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all shadow-xs shrink-0 ${
                                  isScheduled
                                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                    : 'bg-[#176EA8] text-white hover:bg-[#135A8A] active:scale-95'
                                }`}
                              >
                                {isScheduled ? '✓ Scheduled' : '+ Add to Day 1'}
                              </button>
                            </div>

                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[#5A7184] border-t border-[#E1ECF2] pt-2">
                              <span>⏱️ Visit: {place.durationMinutes}m</span>
                              <span>
                                🚗 Detour: ~{place.estimatedDetourMinutes}m ({place.detourType})
                              </span>
                              <span>🕒 {place.operatingHours}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Custom Spot Addition Form */}
                    <div className="rounded-xl border border-dashed border-[#176EA8]/40 bg-sky-50/50 p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="text-base">📍</span>
                        <h4 className="text-xs font-black uppercase tracking-wider text-[#176EA8]">
                          Add Custom Place or Spot
                        </h4>
                      </div>

                      <form onSubmit={handleAddCustomSpot} className="space-y-3 text-xs">
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                          <div className="sm:col-span-2">
                            <label className="block text-[11px] font-bold text-[#5A7184] mb-1">
                              Place Name
                            </label>
                            <input
                              type="text"
                              value={customName}
                              onChange={e => setCustomName(e.target.value)}
                              placeholder="e.g. Guru Sweet Mart (Mysore Pak)"
                              className="w-full rounded-lg border border-[#E1ECF2] bg-white px-3 py-1.5 text-xs text-[#193953] focus:border-[#176EA8] focus:outline-none"
                              required
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-[#5A7184] mb-1">
                              Category
                            </label>
                            <select
                              value={customCategory}
                              onChange={e => setCustomCategory(e.target.value as 'sightseeing' | 'food' | 'nature')}
                              className="w-full rounded-lg border border-[#E1ECF2] bg-white px-2 py-1.5 text-xs text-[#193953]"
                            >
                              <option value="sightseeing">Attraction</option>
                              <option value="food">Food & Café</option>
                              <option value="nature">Nature / Park</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-[#5A7184] mb-1">
                              Duration (min)
                            </label>
                            <select
                              value={customDuration}
                              onChange={e => setCustomDuration(Number(e.target.value))}
                              className="w-full rounded-lg border border-[#E1ECF2] bg-white px-2 py-1.5 text-xs text-[#193953]"
                            >
                              <option value={30}>30 min</option>
                              <option value={45}>45 min</option>
                              <option value={60}>60 min</option>
                              <option value={90}>90 min</option>
                            </select>
                          </div>
                        </div>

                        {/* Detour Allowance Option (Addressing Product Owner Instruction #4) */}
                        <div className="space-y-1.5 rounded-lg bg-white p-3 border border-[#E1ECF2]">
                          <div className="font-bold text-[11px] text-[#193953]">
                            Detour & Scheduling Protocol:
                          </div>
                          <div className="space-y-1 text-[11px] text-[#5A7184]">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="radio"
                                name="detourMode"
                                checked={customDetourMode === 'wishlist'}
                                onChange={() => setCustomDetourMode('wishlist')}
                              />
                              <span>Save to Wishlist only (0m detour, no deadline impact)</span>
                            </label>

                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="radio"
                                name="detourMode"
                                checked={customDetourMode === 'schedule'}
                                onChange={() => setCustomDetourMode('schedule')}
                              />
                              <span>
                                Schedule into day with user-entered driving allowance (explicit, no auto-15m)
                              </span>
                            </label>
                          </div>

                          {customDetourMode === 'schedule' && (
                            <div className="pt-2 pl-5 flex items-center gap-3">
                              <span className="text-[11px] font-semibold text-[#193953]">Allowance:</span>
                              {[10, 15, 30].map(mins => (
                                <button
                                  key={mins}
                                  type="button"
                                  onClick={() => setCustomUserAllowance(mins)}
                                  className={`rounded px-2.5 py-1 text-[11px] font-bold ${
                                    customUserAllowance === mins
                                      ? 'bg-[#176EA8] text-white'
                                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                  }`}
                                >
                                  +{mins}m
                                </button>
                              ))}
                              <span className="text-[10px] text-gray-500">(user-specified driving allowance)</span>
                            </div>
                          )}
                        </div>

                        <div className="flex justify-end">
                          <button
                            type="submit"
                            className="rounded-xl bg-[#176EA8] hover:bg-[#135A8A] px-4 py-2 text-xs font-bold text-white shadow-xs"
                          >
                            + Add Custom Place
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column (45% / 5 cols): Sticky Interactive Leaflet Map */}
              <div className="col-span-12 lg:col-span-5 sticky top-20">
                <PrototypeMap
                  scheduledActivities={schedule}
                  activeHoverId={activeHoverId}
                  onSelectActivity={id => {
                    setActiveHoverId(id);
                    setBuilderTab('schedule');
                  }}
                  heightClass="h-[560px]"
                />
              </div>
            </div>
          ) : (
            /* ======================================================================= */
            /* MOBILE COLLAPSIBLE WORKSPACE SIMULATION (375px viewport container)      */
            /* ======================================================================= */
            <div className="max-w-[375px] mx-auto rounded-3xl border-4 border-gray-800 bg-white overflow-hidden shadow-2xl relative min-h-[640px] flex flex-col">
              {/* Mobile Top Map (takes upper area) */}
              <div className="h-72 w-full relative">
                <PrototypeMap
                  scheduledActivities={schedule}
                  activeHoverId={activeHoverId}
                  onSelectActivity={id => {
                    setActiveHoverId(id);
                    setSheetSnap('half');
                  }}
                  heightClass="h-72"
                />
              </div>

              {/* Mobile Collapsible 3-Snap Bottom Sheet */}
              <div
                className={`flex-1 bg-white rounded-t-3xl border-t-2 border-[#176EA8]/20 shadow-2xl transition-all duration-300 flex flex-col ${
                  sheetSnap === 'peek'
                    ? 'h-36'
                    : sheetSnap === 'half'
                    ? 'h-[360px]'
                    : 'h-[500px]'
                }`}
              >
                {/* Drag Handle & Snap Controls */}
                <div className="p-3 pb-1 flex flex-col items-center">
                  <div className="w-12 h-1.5 bg-gray-300 rounded-full mb-2"></div>
                  <div className="flex items-center justify-between w-full px-2">
                    <span className="text-xs font-black text-[#193953]">Day 1 Itinerary</span>
                    <div className="flex gap-1 text-[10px]">
                      <button
                        type="button"
                        onClick={() => setSheetSnap('peek')}
                        className={`px-2 py-0.5 rounded ${sheetSnap === 'peek' ? 'bg-sky-100 font-bold' : 'text-gray-500'}`}
                      >
                        Peek
                      </button>
                      <button
                        type="button"
                        onClick={() => setSheetSnap('half')}
                        className={`px-2 py-0.5 rounded ${sheetSnap === 'half' ? 'bg-sky-100 font-bold' : 'text-gray-500'}`}
                      >
                        Half
                      </button>
                      <button
                        type="button"
                        onClick={() => setSheetSnap('full')}
                        className={`px-2 py-0.5 rounded ${sheetSnap === 'full' ? 'bg-sky-100 font-bold' : 'text-gray-500'}`}
                      >
                        Full
                      </button>
                    </div>
                  </div>
                </div>

                {/* Sheet Body Content */}
                <div className="p-4 overflow-y-auto flex-1 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold text-emerald-700">
                      Margin: +{calculatedMetrics.returnBufferMinutes}m
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setBuilderTab(builderTab === 'schedule' ? 'discover' : 'schedule');
                        setSheetSnap('full');
                      }}
                      className="rounded-lg bg-[#176EA8] text-white px-2.5 py-1 text-xs font-bold"
                    >
                      {builderTab === 'schedule' ? '+ Add Stop' : 'View Schedule'}
                    </button>
                  </div>

                  {builderTab === 'schedule' ? (
                    <div className="space-y-2">
                      {schedule.map((item, index) => (
                        <div
                          key={item.id}
                          className="rounded-xl border border-[#E1ECF2] p-2.5 bg-white text-xs space-y-1"
                        >
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-[#193953]">
                              #{index + 1} {item.name}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveActivity(item.id)}
                              className="text-rose-600 font-bold px-1.5 py-0.5 rounded hover:bg-rose-50"
                            >
                              ✕
                            </button>
                          </div>
                          <div className="text-[11px] text-[#5A7184]">
                            {item.startTime}–{item.endTime} ({item.durationMinutes}m)
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="text-xs font-bold text-[#193953]">Popular Stops:</div>
                      {DISCOVER_PLACES_MYSURU.slice(0, 3).map(p => (
                        <div
                          key={p.id}
                          className="rounded-xl border border-[#E1ECF2] p-2 bg-white text-xs flex justify-between items-center"
                        >
                          <div>
                            <div className="font-bold text-[#193953]">{p.name}</div>
                            <div className="text-[10px] text-[#5A7184]">{p.durationMinutes}m visit</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleAddDiscoverPlace(p)}
                            className="bg-[#176EA8] text-white px-2 py-1 rounded text-[11px] font-bold"
                          >
                            + Add
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
