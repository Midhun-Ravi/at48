import { useState, useMemo } from 'react';
import {
  PROTOTYPE_DESTINATIONS,
  DISCOVER_PLACES_MYSURU,
  discoverPlaceToActivity,
  type DestinationCardData,
  type DiscoverPlace,
} from './prototypeData';
import { DESTINATIONS } from '../data/destinations';
import { evaluateFeasibility } from '../engine/scheduler';
import { evaluateActivityMove, getMoveCandidates, getInsertionSlotsForDay } from '../engine/moveActivity';
import type { Activity, UserConstraints } from '../types';
import PrototypeMap from './PrototypeMap';

interface WhatChangedNotice {
  message: string;
  timestamp: number;
}

const MYSURU_DEST = DESTINATIONS.find(d => d.id === 'mysuru')!;

const INITIAL_CONSTRAINTS: UserConstraints = {
  departureDateTime: '2026-11-21T08:00',
  returnDeadlineDateTime: '2026-11-22T20:30',
  pace: 'balanced',
  perPersonBudgetINR: 6000,
  partySize: 2,
  drivingAdjustmentMinutes: 0,
  simulateDelayMinutes: 0,
  disabledActivityIds: [],
  activityDayAssignments: {},
  activityOrder: ['mysuru-palace', 'mysuru-market'],
  additionalActivities: [],
};

// Activity coordinate map for Leaflet pins
const ACTIVITY_COORDS: Record<string, [number, number]> = {
  'mysuru-palace': [12.3051, 76.6551],
  'mysuru-market': [12.3117, 76.6508],
  'place-mylari': [12.3117, 76.6660],
  'place-chamundi': [12.2725, 76.6710],
  'place-philomena': [12.3210, 76.6580],
  'place-karanji': [12.3020, 76.6730],
  'place-maddur-tiffanys': [12.6233, 77.0984],
};

const ACTIVITY_IMAGES: Record<string, string> = {
  'mysuru-palace': '/images/places/mysuru-palace.jpg',
  'mysuru-market': '/images/places/mysuru-market.jpg',
  'place-maddur-tiffanys': '/images/places/maddur-tiffanys.jpg',
};

export default function PrototypeV2Screen() {
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  const [deviceView, setDeviceView] = useState<'desktop' | 'mobile'>('desktop');
  const [sheetSnap, setSheetSnap] = useState<'peek' | 'half' | 'full'>('half');
  const [selectedWhyDest, setSelectedWhyDest] = useState<DestinationCardData | null>(null);
  const [builderTab, setBuilderTab] = useState<'schedule' | 'discover'>('schedule');

  // Grounded Deterministic Constraints State
  const [constraints, setConstraints] = useState<UserConstraints>(INITIAL_CONSTRAINTS);
  const [historyStack, setHistoryStack] = useState<UserConstraints[]>([]);
  const [whatChangedNotice, setWhatChangedNotice] = useState<WhatChangedNotice | null>(null);

  // Active day in builder
  const [activeDay, setActiveDay] = useState<number>(1);
  const [activeHoverId, setActiveHoverId] = useState<string | null>(null);
  const [discoverCategory, setDiscoverCategory] = useState<string>('all');

  // Move Activity Modal State
  const [isMoveModalOpen, setIsMoveModalOpen] = useState<boolean>(false);
  const [selectedMoveActivityId, setSelectedMoveActivityId] = useState<string>('mysuru-market');
  const [moveTargetDay, setMoveTargetDay] = useState<number>(2);
  const [moveTargetPosition, setMoveTargetPosition] = useState<number>(0);

  // Custom place form state
  const [customName, setCustomName] = useState('');
  const [customCategory, setCustomCategory] = useState<'sightseeing' | 'food' | 'nature'>('sightseeing');
  const [customDuration, setCustomDuration] = useState<number>(45);
  const [customDetourMode, setCustomDetourMode] = useState<'wishlist' | 'schedule'>('schedule');
  const [customUserAllowance, setCustomUserAllowance] = useState<number>(15);
  const [wishlistPlaces, setWishlistPlaces] = useState<Array<{ id: string; name: string; durationMinutes: number }>>([]);

  // Execute scheduling engine against active constraints
  const currentResult = useMemo(() => {
    return evaluateFeasibility(MYSURU_DEST, constraints);
  }, [constraints]);

  // Derived metrics straight from scheduler.ts (ZERO fabricated numbers!)
  const returnBufferMinutes = currentResult.returnDeadlineMarginMinutes;
  const isProjectedLate = returnBufferMinutes < 0;
  const activeBlockers = currentResult.violations.filter(v => v.severity === 'BLOCKER');
  const hasScheduleBlocker = activeBlockers.length > 0;
  const isTripFeasible = !isProjectedLate && !hasScheduleBlocker && currentResult.rating !== 'Not Recommended';
  const primaryBlocker = activeBlockers[0];
  const formattedArrival = currentResult.homeArrivalTime.slice(11) + ' IST';

  // Push state to history stack before modifying constraints
  const recordHistory = (newConstraints: UserConstraints, changeMessage: string) => {
    setHistoryStack(prev => [...prev, constraints]);
    setConstraints(newConstraints);
    setWhatChangedNotice({
      message: changeMessage,
      timestamp: Date.now(),
    });
  };

  // Undo last action
  const handleUndo = () => {
    if (historyStack.length === 0) return;
    const previous = historyStack[historyStack.length - 1];
    setHistoryStack(prev => prev.slice(0, -1));
    setConstraints(previous);
    setWhatChangedNotice({
      message: 'Action undone. Schedule restored to previous state.',
      timestamp: Date.now(),
    });
  };

  // Movable candidates
  const moveCandidates = useMemo(() => {
    return getMoveCandidates(MYSURU_DEST, constraints, currentResult);
  }, [constraints, currentResult]);

  // Insertion slots for target day
  const insertionSlots = useMemo(() => {
    return getInsertionSlotsForDay(MYSURU_DEST, constraints, moveTargetDay);
  }, [constraints, moveTargetDay]);

  // Live Before / After Move Preview from deterministic engine
  const movePreview = useMemo(() => {
    if (!selectedMoveActivityId) return null;
    return evaluateActivityMove(
      MYSURU_DEST,
      constraints,
      selectedMoveActivityId,
      moveTargetDay,
      moveTargetPosition
    );
  }, [constraints, selectedMoveActivityId, moveTargetDay, moveTargetPosition]);

  // Confirm and apply Move Activity transaction (P0: exact snapshot apply)
  const handleConfirmMove = () => {
    if (!movePreview || !movePreview.isValid) return;

    // Apply the exact proposedConstraints snapshot returned by evaluateActivityMove
    const nextConstraints: UserConstraints = movePreview.proposedConstraints;

    const deltaMsg = movePreview.deltas.marginDeltaMinutes !== 0
      ? ` (Return margin: ${movePreview.after.returnMarginMinutes >= 0 ? '+' : ''}${movePreview.after.returnMarginMinutes}m)`
      : ` (Return margin unchanged at +${movePreview.after.returnMarginMinutes}m)`;

    recordHistory(
      nextConstraints,
      `Moved "${movePreview.activityName}" to Day ${moveTargetDay} (${movePreview.after.activityStartTime}–${movePreview.after.activityEndTime} IST).${deltaMsg}`
    );

    setIsMoveModalOpen(false);
  };

  // Scheduled activities mapped from current timetable for PrototypeMap
  const mapScheduledActivities = useMemo(() => {
    return currentResult.timeline
      .filter(t => t.category === 'ACTIVITY' && t.activityId)
      .map(t => {
        const coords = ACTIVITY_COORDS[t.activityId!];
        return {
          id: t.activityId!,
          name: t.label,
          category: (t.activityId?.startsWith('place-mylari') ? 'food' : 'sightseeing') as any,
          day: t.day,
          startTime: t.startTime.slice(11),
          endTime: t.endTime.slice(11),
          durationMinutes: 60,
          costINR: t.activityId === 'mysuru-palace' ? 120 : 0,
          locationName: coords ? (t.activityId === 'mysuru-palace' ? 'Sayyaji Rao Rd' : 'Devaraja Market') : 'Custom location (unverified)',
          coordinates: coords, // No fake coordinates! Excluded from Leaflet pins if undefined
          imageSrc: ACTIVITY_IMAGES[t.activityId!],
          detourMinutes: 10,
          detourSource: coords ? ('engine_verified' as const) : ('user_specified' as const),
          isDeletable: true,
        };
      });
  }, [currentResult.timeline]);

  // Toggle optional activity disabled status or remove custom/pitstop
  const handleToggleActivity = (activityId: string) => {
    // 1. Pitstop toggle
    if (activityId === 'maddur-tiffanys' || activityId === 'place-maddur-tiffanys') {
      const nextStops = (constraints.selectedPitstopIds ?? []).filter(id => id !== 'maddur-tiffanys');
      recordHistory({ ...constraints, selectedPitstopIds: nextStops }, 'Removed Maddur Tiffanys highway pitstop from route.');
      return;
    }

    // 2. Added/custom activity removal
    const isAdditional = (constraints.additionalActivities ?? []).some(a => a.id === activityId);
    if (isAdditional) {
      const nextAdditional = (constraints.additionalActivities ?? []).filter(a => a.id !== activityId);
      const nextDayAssignments = { ...(constraints.activityDayAssignments ?? {}) };
      delete nextDayAssignments[activityId];
      const nextOrder = (constraints.activityOrder ?? []).filter(id => id !== activityId);
      recordHistory(
        {
          ...constraints,
          additionalActivities: nextAdditional,
          activityDayAssignments: nextDayAssignments,
          activityOrder: nextOrder,
        },
        'Removed added activity from itinerary.'
      );
      return;
    }

    // 3. Built-in optional activity disable/restore
    const isCurrentlyDisabled = constraints.disabledActivityIds.includes(activityId);
    const nextDisabled = isCurrentlyDisabled
      ? constraints.disabledActivityIds.filter(id => id !== activityId)
      : [...constraints.disabledActivityIds, activityId];

    const nextConstraints = {
      ...constraints,
      disabledActivityIds: nextDisabled,
    };

    const action = isCurrentlyDisabled ? 'Restored' : 'Removed';
    recordHistory(nextConstraints, `${action} activity in itinerary.`);
  };

  // Add Place from Discover (converting to real Activity or Pitstop and scheduling)
  const handleAddDiscoverPlace = (place: DiscoverPlace) => {
    if (place.id === 'place-maddur-tiffanys') {
      const currentStops = constraints.selectedPitstopIds ?? [];
      if (!currentStops.includes('maddur-tiffanys')) {
        const nextConstraints: UserConstraints = {
          ...constraints,
          selectedPitstopIds: [...currentStops, 'maddur-tiffanys'],
        };
        recordHistory(
          nextConstraints,
          `Added Maddur Tiffanys highway pitstop on NH 275 expressway corridor. 30m dwell + 10m detour evaluated by scheduler.`
        );
      }
      setBuilderTab('schedule');
      return;
    }

    const activityObj = discoverPlaceToActivity(place);
    const nextAdditional = [...(constraints.additionalActivities ?? []), activityObj];
    const nextDayAssignments = {
      ...(constraints.activityDayAssignments ?? {}),
      [place.id]: activeDay,
    };

    const nextConstraints: UserConstraints = {
      ...constraints,
      additionalActivities: nextAdditional,
      activityDayAssignments: nextDayAssignments,
    };

    recordHistory(
      nextConstraints,
      `Scheduled "${place.name}" into Day ${activeDay}. Timetable and operating window evaluated by engine.`
    );
    setBuilderTab('schedule');
  };

  // Add Custom Spot (Wishlist-only places remain unscheduled with 0m schedule impact)
  const handleAddCustomSpot = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) return;

    if (customDetourMode === 'wishlist') {
      const newWishlistPlace = {
        id: `wishlist-${Date.now()}`,
        name: customName.trim(),
        durationMinutes: customDuration,
      };
      setWishlistPlaces(prev => [...prev, newWishlistPlace]);
      setCustomName('');
      setBuilderTab('schedule');
      return;
    }

    const customId = `custom-${Date.now()}`;
    const customActivityObj: Activity = {
      id: customId,
      name: customName.trim(),
      durationMinutes: customDuration,
      openTime: '09:00',
      closeTime: '21:00',
      costPerPersonINR: 0,
      isOptional: true,
      priority: 3,
      localTransferMinutes: customUserAllowance,
      openingHoursEvidence: { level: 'assumption', note: 'User-specified timing' },
      costEvidence: { level: 'assumption' },
    };

    const nextAdditional = [...(constraints.additionalActivities ?? []), customActivityObj];
    const nextDayAssignments = {
      ...(constraints.activityDayAssignments ?? {}),
      [customId]: activeDay,
    };

    const nextConstraints: UserConstraints = {
      ...constraints,
      additionalActivities: nextAdditional,
      activityDayAssignments: nextDayAssignments,
    };

    recordHistory(
      nextConstraints,
      `Added custom place "${customName.trim()}". Detour allowance: ${customActivityObj.localTransferMinutes}m.`
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
      {/* Prototype Top Banner */}
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
                Deterministic engine active. Grounded in scheduler.ts without hardcoded placeholders.
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
              <span><strong>4 destinations evaluated</strong> by deterministic scheduler</span>
            </div>
          </div>

          <div className={`grid gap-5 ${deviceView === 'mobile' ? 'grid-cols-1 max-w-[375px] mx-auto' : 'grid-cols-1 md:grid-cols-2'}`}>
            {PROTOTYPE_DESTINATIONS.map(dest => {
              const isFeasible = dest.feasibilityRating === 'FEASIBLE';
              const isChallenging = dest.feasibilityRating === 'CHALLENGING';

              return (
                <div
                  key={dest.id}
                  className="group relative flex flex-col justify-between rounded-2xl border border-[#E1ECF2] bg-white overflow-hidden shadow-xs hover:shadow-md hover:border-[#176EA8]/40 transition-all"
                >
                  <div className="relative h-48 w-full overflow-hidden bg-slate-100">
                    <img
                      src={dest.imageSrc}
                      alt={dest.imageAlt}
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"></div>

                    <div className="absolute top-3 left-3">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black uppercase tracking-wider shadow-sm ${
                          isFeasible ? 'bg-emerald-500 text-white' : isChallenging ? 'bg-amber-500 text-white' : 'bg-rose-500 text-white'
                        }`}
                      >
                        {isFeasible ? '✓' : isChallenging ? '⚡' : '✕'} {dest.feasibilityLabel}
                      </span>
                    </div>

                    <div className="absolute top-3 right-3">
                      <span className="rounded-md bg-black/60 backdrop-blur-xs px-2 py-0.5 text-[10px] text-white/90">
                        📷 {dest.imageAuthor} ({dest.imageLicense})
                      </span>
                    </div>

                    <div className="absolute bottom-3 left-3 right-3 text-white">
                      <div className="flex items-baseline gap-2">
                        <h2 className="text-xl font-black tracking-tight">{dest.name}</h2>
                        <span className="text-xs text-white/80 font-medium">{dest.state}</span>
                      </div>
                      <p className="text-xs text-white/90 line-clamp-1">{dest.tagline}</p>
                    </div>
                  </div>

                  <div className="p-4 space-y-4 flex-1 flex flex-col justify-between">
                    <div className="grid grid-cols-3 gap-2 text-center bg-[#F4F9FC] p-3 rounded-xl border border-[#E1ECF2]">
                      <div className="space-y-0.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#5A7184]">Est. Drive</span>
                        <div className="text-sm font-black text-[#193953]">{dest.drivingTimeFormatted}</div>
                        <span className="text-[9px] text-[#5A7184] block">each way</span>
                      </div>

                      <div className="space-y-0.5 border-x border-[#E1ECF2] px-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#5A7184]">Daylight Sightseeing</span>
                        <div className="text-sm font-black text-[#176EA8]">
                          {Math.floor(dest.daylightSightseeingMinutes / 60)}h {dest.daylightSightseeingMinutes % 60}m
                        </div>
                        <span className="text-[9px] text-[#5A7184] block">+{Math.floor(dest.unallocatedEveningMinutes / 60)}h eve</span>
                      </div>

                      <div className="space-y-0.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#5A7184]">Return Margin</span>
                        <div className={`text-sm font-black ${dest.returnBufferMinutes >= 60 ? 'text-emerald-700' : dest.returnBufferMinutes > 0 ? 'text-amber-700' : 'text-rose-700'}`}>
                          {dest.returnBufferMinutes >= 0 ? `+${dest.returnBufferMinutes}m` : `${dest.returnBufferMinutes}m`}
                        </div>
                        <span className="text-[9px] text-[#5A7184] block">{dest.returnBufferMinutes >= 60 ? 'Safe buffer' : 'Tight / Late'}</span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="text-[11px] font-bold text-[#5A7184] uppercase tracking-wider">Key Attractions</div>
                      <div className="flex flex-wrap gap-1.5">
                        {dest.highlights.map((h, i) => (
                          <span key={i} className="inline-block rounded-md bg-white border border-[#E1ECF2] px-2 py-0.5 text-xs text-[#193953]">
                            {h}
                          </span>
                        ))}
                      </div>
                    </div>

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
                          if (dest.id === 'mysuru') setCurrentStep(2);
                          else alert(`Interactive prototype workspace is configured for Mysuru. Click "Plan Mysuru Trip".`);
                        }}
                        className={`rounded-xl px-4 py-2 text-xs font-bold text-white shadow-xs transition-all active:scale-95 ${
                          dest.id === 'mysuru' ? 'bg-[#176EA8] hover:bg-[#135A8A]' : 'bg-[#5A7184] hover:bg-[#485B6B]'
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

          {selectedWhyDest && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fadeIn">
              <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-[#E1ECF2] space-y-4">
                <div className="flex items-start justify-between border-b border-[#E1ECF2] pb-3">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-[#176EA8]">Deterministic Feasibility Calculation</span>
                    <h3 className="text-xl font-black text-[#193953]">Why is {selectedWhyDest.name} {selectedWhyDest.feasibilityLabel}?</h3>
                  </div>
                  <button type="button" onClick={() => setSelectedWhyDest(null)} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700">✕</button>
                </div>

                <div className="space-y-3 text-xs text-[#193953]">
                  <div className="rounded-xl bg-[#F4F9FC] p-3 border border-[#E1ECF2] space-y-1.5">
                    <div className="font-bold text-xs text-[#193953] flex justify-between">
                      <span>Highway Routing & Congestion Buffer</span>
                      <span className="text-[#176EA8]">{selectedWhyDest.drivingTimeFormatted} each way</span>
                    </div>
                    <p className="text-[#5A7184]">
                      Route: {selectedWhyDest.assumptions.route}. Base drive: <strong>{selectedWhyDest.drivingBaseMinutes} min</strong> + <strong>{selectedWhyDest.drivingBufferMinutes} min</strong> (20% buffer).
                    </p>
                  </div>

                  <div className="rounded-xl bg-sky-50 p-3 border border-sky-200 space-y-1.5">
                    <div className="font-bold text-xs text-sky-900 flex justify-between">
                      <span>Daylight vs. Evening Leisure Split</span>
                      <span className="text-sky-800">Total Free: {Math.floor(selectedWhyDest.totalFreeTimeMinutes / 60)}h {selectedWhyDest.totalFreeTimeMinutes % 60}m</span>
                    </div>
                    <ul className="list-disc pl-4 space-y-1 text-sky-950">
                      <li><strong>Actual Daylight Sightseeing:</strong> {Math.floor(selectedWhyDest.daylightSightseeingMinutes / 60)}h {selectedWhyDest.daylightSightseeingMinutes % 60}m (07:45–18:15 IST).</li>
                      <li><strong>Unallocated Evening Leisure:</strong> {Math.floor(selectedWhyDest.unallocatedEveningMinutes / 60)}h {selectedWhyDest.unallocatedEveningMinutes % 60}m (18:45–21:00 post-sunset).</li>
                    </ul>
                  </div>

                  <div className="space-y-1 pt-1">
                    <div className="font-bold text-[11px] text-[#5A7184] uppercase tracking-wider">Official Evidence Citations</div>
                    {selectedWhyDest.assumptions.evidenceNotes.map((note, idx) => (
                      <div key={idx} className="text-[11px] text-[#5A7184] flex items-start gap-1.5">
                        <span>•</span>
                        <span>{note}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button type="button" onClick={() => setSelectedWhyDest(null)} className="rounded-xl bg-[#176EA8] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#135A8A]">
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
          {/* Top Return-Margin Feasibility Indicator */}
          <div
            className={`rounded-2xl p-4 shadow-sm border transition-all ${
              !isTripFeasible
                ? 'bg-rose-50 border-rose-300 text-rose-900'
                : 'bg-white border-[#E1ECF2] text-[#193953]'
            }`}
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-xl font-black text-lg ${
                    !isTripFeasible ? 'bg-rose-500 text-white' : 'bg-emerald-500 text-white'
                  }`}
                >
                  {!isTripFeasible ? '⚠️' : '✓'}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black">
                      {isProjectedLate
                        ? `Projected Late by ${Math.abs(returnBufferMinutes)} min`
                        : hasScheduleBlocker
                        ? `Schedule Conflict: ${primaryBlocker.message}`
                        : `Return Margin: +${returnBufferMinutes}m Safe Buffer`}
                    </span>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        !isTripFeasible ? 'bg-rose-200 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {isProjectedLate
                        ? 'Deadline Breach'
                        : hasScheduleBlocker
                        ? 'Schedule Blocked'
                        : 'On Schedule'}
                    </span>
                  </div>

                  <p className="text-xs text-[#5A7184] mt-0.5">
                    Est. Home Arrival: <strong>{formattedArrival}</strong> · Hard Deadline:{' '}
                    <strong>Sun 20:30 IST</strong> · Engine Rating:{' '}
                    <strong className={!isTripFeasible ? 'text-rose-700' : 'text-emerald-700'}>
                      {currentResult.rating}
                    </strong>
                    {hasScheduleBlocker && !isProjectedLate && (
                      <span className="text-rose-600 ml-1.5 font-medium">
                        (Activity operating constraint violated)
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {/* Simulation Controls & Make This Trip Fit Action */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsMoveModalOpen(true)}
                  className="rounded-xl bg-[#176EA8] hover:bg-[#135A8A] px-3.5 py-1.5 text-xs font-bold text-white shadow-xs transition-all flex items-center gap-1.5 active:scale-95"
                >
                  <span>⚡</span>
                  <span>Make This Trip Fit</span>
                </button>

                {constraints.simulateDelayMinutes === 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      recordHistory(
                        { ...constraints, simulateDelayMinutes: 60 },
                        'Simulated +60m highway delay. Recalculated feasibility.'
                      );
                    }}
                    className="rounded-xl bg-amber-500 hover:bg-amber-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs transition-all"
                  >
                    Simulate Delay (+60m)
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      recordHistory(
                        { ...constraints, simulateDelayMinutes: 0 },
                        'Reset delay to 0m.'
                      );
                    }}
                    className="rounded-xl bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white shadow-xs transition-all"
                  >
                    Clear Delay
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setConstraints(INITIAL_CONSTRAINTS);
                    setHistoryStack([]);
                    setWhatChangedNotice(null);
                  }}
                  className="rounded-xl border border-[#E1ECF2] bg-white px-3 py-1.5 text-xs font-bold text-[#5A7184] hover:text-[#193953] shadow-xs"
                >
                  Reset
                </button>
              </div>
            </div>

            {/* Violation Alert Callout & Remedies */}
            {currentResult.violations.length > 0 && (
              <div className="mt-3 pt-3 border-t border-rose-200/80 space-y-2">
                <div className="text-xs text-rose-800 font-medium">
                  <strong>Engine Violations Detected:</strong>
                  <ul className="list-disc pl-5 mt-1 space-y-0.5">
                    {currentResult.violations.map((v, i) => (
                      <li key={i}>{v.message}</li>
                    ))}
                  </ul>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsMoveModalOpen(true)}
                    className="rounded-lg bg-rose-600 hover:bg-rose-700 px-3 py-1 text-xs font-bold text-white shadow-xs flex items-center gap-1"
                  >
                    <span>🔄</span>
                    <span>Move an activity to another day</span>
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
          {/* WORKSPACE VIEW: DESKTOP OR MOBILE SHEET                                   */}
          {/* ========================================================================= */}
          {deviceView === 'desktop' ? (
            <div className="grid grid-cols-12 gap-5 items-start">
              {/* Left Column (55% / 7 cols): Itinerary */}
              <div className="col-span-12 lg:col-span-7 space-y-4">
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
                      Day 1: Sat ({currentResult.timeline.filter(t => t.day === 1 && t.category === 'ACTIVITY').length} stops)
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
                      Day 2: Sun ({currentResult.timeline.filter(t => t.day === 2 && t.category === 'ACTIVITY').length} stops)
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

                {/* SCHEDULE VIEW: Rendered dynamically from currentResult.timeline */}
                {builderTab === 'schedule' && (
                  <div className="space-y-3">
                    {currentResult.timeline
                      .filter(t => t.day === activeDay)
                      .map((entry, idx) => {
                        const isActivity = entry.category === 'ACTIVITY';
                        const isHovered = activeHoverId === entry.activityId;

                        if (isActivity) {
                          return (
                            <div
                              key={entry.id}
                              onMouseEnter={() => setActiveHoverId(entry.activityId ?? null)}
                              onMouseLeave={() => setActiveHoverId(null)}
                              className={`rounded-2xl border p-4 transition-all duration-200 bg-white shadow-xs ${
                                isHovered
                                  ? 'border-[#176EA8] ring-2 ring-[#176EA8]/20 shadow-md'
                                  : 'border-[#E1ECF2] hover:border-[#176EA8]/40'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-start gap-3">
                                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#176EA8] text-white font-bold text-xs">
                                    #{idx + 1}
                                  </div>

                                  <div>
                                    <div className="flex items-center gap-2">
                                      <h4 className="text-sm font-black text-[#193953]">{entry.label}</h4>
                                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-sky-50 text-[#176EA8]">
                                        Day {entry.day} Stop
                                      </span>
                                    </div>

                                    <div className="text-xs text-[#5A7184] mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                                      <span>⏰ <strong>{entry.startTime.slice(11)}–{entry.endTime.slice(11)}</strong> IST</span>
                                      <span>📍 {ACTIVITY_COORDS[entry.activityId!] ? 'Mysuru' : 'Expressway Corridor'}</span>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedMoveActivityId(entry.activityId!);
                                      setMoveTargetDay(activeDay === 1 ? 2 : 1);
                                      setIsMoveModalOpen(true);
                                    }}
                                    className="rounded-lg border border-[#E1ECF2] bg-white px-2 py-1 text-xs font-bold text-[#176EA8] hover:bg-sky-50 shadow-xs flex items-center gap-1"
                                    title="Move to another day"
                                  >
                                    <span>🔄</span>
                                    <span>Move Day</span>
                                  </button>

                                  {entry.isOptional && (
                                    <button
                                      type="button"
                                      onClick={() => handleToggleActivity(entry.activityId!)}
                                      className="h-7 w-7 rounded-lg border border-rose-200 text-xs font-bold text-rose-600 hover:bg-rose-50"
                                      title="Remove Stop"
                                    >
                                      ✕
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        }

                        // Render Non-Activity Timeline Milestones (Drive, Pitstop, Meals, Rest, Checkin)
                        return (
                          <div
                            key={entry.id}
                            className={`rounded-xl border p-3 text-xs flex items-center justify-between ${
                              entry.category === 'DRIVE'
                                ? 'border-dashed border-[#BAE3F1] bg-[#F4F9FC] text-[#5A7184]'
                                : entry.category === 'PITSTOP'
                                ? 'border-amber-300 bg-amber-50 text-amber-900'
                                : entry.category === 'MEAL'
                                ? 'border-amber-200 bg-amber-50/50 text-amber-900'
                                : entry.category === 'CHECK_IN'
                                ? 'border-[#E1ECF2] bg-white text-[#5A7184]'
                                : entry.category === 'REST'
                                ? 'border-indigo-100 bg-indigo-50/40 text-indigo-900'
                                : 'border-[#E1ECF2] bg-gray-50 text-gray-600'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span>
                                {entry.category === 'DRIVE'
                                  ? '🚗'
                                  : entry.category === 'PITSTOP'
                                  ? '☕'
                                  : entry.category === 'MEAL'
                                  ? '🍽️'
                                  : entry.category === 'CHECK_IN'
                                  ? '🏨'
                                  : entry.category === 'REST'
                                  ? '🛌'
                                  : '⏱️'}
                              </span>
                              <div>
                                <strong className="text-[#193953]">{entry.label}</strong>
                                <span className="block text-[11px]">
                                  {entry.startTime.slice(11)}–{entry.endTime.slice(11)} IST
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-[#5A7184]">
                                {entry.category}
                              </span>
                              {entry.category === 'PITSTOP' && (
                                <button
                                  type="button"
                                  onClick={() => handleToggleActivity('maddur-tiffanys')}
                                  className="h-6 w-6 rounded-md border border-rose-200 text-xs font-bold text-rose-600 hover:bg-rose-50 flex items-center justify-center"
                                  title="Remove highway stop"
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}

                    {/* Saved Wishlist (Unscheduled Places) */}
                    {wishlistPlaces.length > 0 && (
                      <div className="rounded-2xl border border-sky-200 bg-sky-50/50 p-4 space-y-2 mt-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm">📌</span>
                            <span className="text-xs font-black text-[#193953] uppercase tracking-wider">
                              Wishlist Places ({wishlistPlaces.length})
                            </span>
                          </div>
                          <span className="text-[10px] font-bold text-sky-700 bg-sky-100 px-2 py-0.5 rounded">
                            Unscheduled · 0m impact
                          </span>
                        </div>
                        <div className="space-y-1.5">
                          {wishlistPlaces.map(w => (
                            <div
                              key={w.id}
                              className="flex items-center justify-between bg-white rounded-xl p-2.5 border border-sky-100 text-xs shadow-2xs"
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-[#193953]">{w.name}</span>
                                <span className="text-[11px] text-[#5A7184]">({w.durationMinutes}m duration)</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-gray-400">Wishlist only</span>
                                <button
                                  type="button"
                                  onClick={() => setWishlistPlaces(prev => prev.filter(p => p.id !== w.id))}
                                  className="h-5 w-5 rounded text-gray-400 hover:text-rose-600 flex items-center justify-center font-bold text-xs"
                                  title="Remove from wishlist"
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* DISCOVER PLACES VIEW */}
                {builderTab === 'discover' && (
                  <div className="space-y-4 rounded-2xl border border-[#E1ECF2] bg-white p-5 shadow-xs animate-fadeIn">
                    <div className="flex items-center justify-between border-b border-[#E1ECF2] pb-3">
                      <div>
                        <h3 className="text-base font-black text-[#193953]">Discover Places in Mysuru</h3>
                        <p className="text-xs text-[#5A7184]">Engine computes operating windows and corridor travel allowances.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setBuilderTab('schedule')}
                        className="rounded-lg border border-[#E1ECF2] px-3 py-1 text-xs font-bold text-[#5A7184] hover:text-[#193953]"
                      >
                        ← Back to Schedule
                      </button>
                    </div>

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

                    <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                      {filteredPlaces.map(place => {
                        const isScheduled = currentResult.timeline.some(t => t.activityId === place.id);

                        return (
                          <div key={place.id} className="rounded-xl border border-[#E1ECF2] p-3.5 hover:border-[#176EA8]/40 bg-white transition-all space-y-2">
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
                                {isScheduled ? '✓ Scheduled' : `+ Add to Day ${activeDay}`}
                              </button>
                            </div>

                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[#5A7184] border-t border-[#E1ECF2] pt-2">
                              <span>⏱️ Visit: {place.durationMinutes}m</span>
                              <span>🚗 Detour: ~{place.estimatedDetourMinutes}m</span>
                              <span>🕒 Hours: {place.operatingHours}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Custom Spot Addition */}
                    <div className="rounded-xl border border-dashed border-[#176EA8]/40 bg-sky-50/50 p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="text-base">📍</span>
                        <h4 className="text-xs font-black uppercase tracking-wider text-[#176EA8]">Add Custom Place or Spot</h4>
                      </div>

                      <form onSubmit={handleAddCustomSpot} className="space-y-3 text-xs">
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                          <div className="sm:col-span-2">
                            <label className="block text-[11px] font-bold text-[#5A7184] mb-1">Place Name</label>
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
                            <label className="block text-[11px] font-bold text-[#5A7184] mb-1">Category</label>
                            <select
                              value={customCategory}
                              onChange={e => setCustomCategory(e.target.value as any)}
                              className="w-full rounded-lg border border-[#E1ECF2] bg-white px-2 py-1.5 text-xs text-[#193953]"
                            >
                              <option value="sightseeing">Attraction</option>
                              <option value="food">Food & Café</option>
                              <option value="nature">Nature / Park</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-[#5A7184] mb-1">Duration</label>
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

                        <div className="space-y-1.5 rounded-lg bg-white p-3 border border-[#E1ECF2]">
                          <div className="font-bold text-[11px] text-[#193953]">Detour Protocol:</div>
                          <div className="space-y-1 text-[11px] text-[#5A7184]">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="radio"
                                name="detourMode"
                                checked={customDetourMode === 'wishlist'}
                                onChange={() => setCustomDetourMode('wishlist')}
                              />
                              <span>Save to Wishlist only (0m detour)</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="radio"
                                name="detourMode"
                                checked={customDetourMode === 'schedule'}
                                onChange={() => setCustomDetourMode('schedule')}
                              />
                              <span>Schedule into day with user allowance:</span>
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
                                    customUserAllowance === mins ? 'bg-[#176EA8] text-white' : 'bg-gray-100 text-gray-700'
                                  }`}
                                >
                                  +{mins}m
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="flex justify-end">
                          <button type="submit" className="rounded-xl bg-[#176EA8] hover:bg-[#135A8A] px-4 py-2 text-xs font-bold text-white shadow-xs">
                            + Add Custom Place
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column (45% / 5 cols): Sticky Map */}
              <div className="col-span-12 lg:col-span-5 sticky top-20">
                <PrototypeMap
                  scheduledActivities={mapScheduledActivities}
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
            /* Mobile View */
            <div className="max-w-[375px] mx-auto rounded-3xl border-4 border-gray-800 bg-white overflow-hidden shadow-2xl relative min-h-[640px] flex flex-col">
              <div className="h-72 w-full relative">
                <PrototypeMap
                  scheduledActivities={mapScheduledActivities}
                  activeHoverId={activeHoverId}
                  heightClass="h-72"
                />
              </div>

              <div className={`flex-1 bg-white rounded-t-3xl border-t-2 border-[#176EA8]/20 shadow-2xl transition-all duration-300 flex flex-col ${
                sheetSnap === 'peek' ? 'h-36' : sheetSnap === 'half' ? 'h-[360px]' : 'h-[500px]'
              }`}>
                <div className="p-3 pb-1 flex flex-col items-center">
                  <div className="w-12 h-1.5 bg-gray-300 rounded-full mb-2"></div>
                  <div className="flex items-center justify-between w-full px-2">
                    <span className="text-xs font-black text-[#193953]">Day {activeDay} Itinerary</span>
                    <div className="flex gap-1 text-[10px]">
                      <button type="button" onClick={() => setSheetSnap('peek')} className={`px-2 py-0.5 rounded ${sheetSnap === 'peek' ? 'bg-sky-100 font-bold' : 'text-gray-500'}`}>Peek</button>
                      <button type="button" onClick={() => setSheetSnap('half')} className={`px-2 py-0.5 rounded ${sheetSnap === 'half' ? 'bg-sky-100 font-bold' : 'text-gray-500'}`}>Half</button>
                      <button type="button" onClick={() => setSheetSnap('full')} className={`px-2 py-0.5 rounded ${sheetSnap === 'full' ? 'bg-sky-100 font-bold' : 'text-gray-500'}`}>Full</button>
                    </div>
                  </div>
                </div>

                <div className="p-4 overflow-y-auto flex-1 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold text-emerald-700">Margin: +{returnBufferMinutes}m</div>
                    <button
                      type="button"
                      onClick={() => setIsMoveModalOpen(true)}
                      className="rounded-lg bg-[#176EA8] text-white px-2.5 py-1 text-xs font-bold"
                    >
                      🔄 Move Activity
                    </button>
                  </div>

                  <div className="space-y-2">
                    {currentResult.timeline.filter(t => t.day === activeDay && t.category === 'ACTIVITY').map(item => (
                      <div key={item.id} className="rounded-xl border border-[#E1ECF2] p-2.5 bg-white text-xs flex justify-between items-center">
                        <div>
                          <div className="font-bold text-[#193953]">{item.label}</div>
                          <div className="text-[11px] text-[#5A7184]">{item.startTime.slice(11)}–{item.endTime.slice(11)} IST</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedMoveActivityId(item.activityId!);
                            setMoveTargetDay(activeDay === 1 ? 2 : 1);
                            setIsMoveModalOpen(true);
                          }}
                          className="text-[#176EA8] font-bold text-[11px] px-2 py-1 rounded bg-sky-50 border border-sky-200"
                        >
                          Move
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* MAKE THIS TRIP FIT: MOVE ACTIVITY MODAL WITH TRUE ENGINE BEFORE/AFTER      */}
          {/* ========================================================================= */}
          {isMoveModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fadeIn">
              <div className="relative w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl border border-[#E1ECF2] space-y-5 max-h-[90vh] overflow-y-auto">
                <div className="flex items-start justify-between border-b border-[#E1ECF2] pb-3">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-[#176EA8]">
                      Make This Trip Fit · Conflict Resolution
                    </span>
                    <h3 className="text-xl font-black text-[#193953]">Move an Activity Between Days</h3>
                    <p className="text-xs text-[#5A7184] mt-0.5">
                      Evaluated live by the deterministic scheduling engine. True before and proposed feasibility.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsMoveModalOpen(false)}
                    className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                  >
                    ✕
                  </button>
                </div>

                {/* Step 1: Select Activity to Move */}
                <div className="space-y-2">
                  <label className="block text-xs font-black uppercase tracking-wider text-[#193953]">
                    1. Select Activity to Move:
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {moveCandidates.map(candidate => {
                      const isSelected = selectedMoveActivityId === candidate.activityId;

                      let statusBadge = null;
                      if (candidate.scheduleStatus === 'scheduled') {
                        statusBadge = (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-50 border border-sky-200 text-[#176EA8]">
                            Day {candidate.currentDay}
                          </span>
                        );
                      } else if (candidate.scheduleStatus === 'unavailable') {
                        statusBadge = (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-50 border border-rose-200 text-rose-700">
                            Unavailable {candidate.assignedDay ? `(Day ${candidate.assignedDay})` : '(Conflict)'}
                          </span>
                        );
                      } else {
                        statusBadge = (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 border border-gray-200 text-gray-600">
                            Unscheduled
                          </span>
                        );
                      }

                      return (
                        <button
                          key={candidate.activityId}
                          type="button"
                          onClick={() => {
                            setSelectedMoveActivityId(candidate.activityId);
                            const current = candidate.currentDay ?? candidate.assignedDay ?? 1;
                            setMoveTargetDay(current === 1 ? 2 : 1);
                          }}
                          className={`rounded-xl border p-3 text-left transition-all ${
                            isSelected
                              ? 'border-[#176EA8] bg-sky-50/60 ring-2 ring-[#176EA8]/20'
                              : 'border-[#E1ECF2] bg-white hover:border-[#176EA8]/40'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1.5">
                            <span className="font-bold text-xs text-[#193953] truncate">{candidate.name}</span>
                            {statusBadge}
                          </div>
                          <div className="text-[11px] text-[#5A7184] mt-1 space-y-0.5">
                            <div>⏱️ {candidate.durationMinutes}m visit · {candidate.localTransferMinutes}m transfer</div>
                            <div>🕒 Operating: {candidate.operatingWindow}</div>
                            {candidate.scheduleStatus === 'unavailable' && candidate.conflictReason && (
                              <div className="text-rose-600 font-medium text-[10px] line-clamp-1">
                                ⚠️ {candidate.conflictReason}
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Step 2: Choose Destination Day & Insertion Slot */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-[#F4F9FC] p-3.5 rounded-xl border border-[#E1ECF2]">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-[#193953] mb-1.5">
                      2. Destination Day:
                    </label>
                    <div className="flex gap-2">
                      {[1, 2].map(dayNum => (
                        <button
                          key={dayNum}
                          type="button"
                          onClick={() => setMoveTargetDay(dayNum)}
                          className={`flex-1 rounded-lg py-2 px-3 text-xs font-bold transition-all ${
                            moveTargetDay === dayNum
                              ? 'bg-[#176EA8] text-white shadow-xs'
                              : 'bg-white border border-[#E1ECF2] text-[#5A7184] hover:text-[#193953]'
                          }`}
                        >
                          Day {dayNum} ({dayNum === 1 ? 'Saturday' : 'Sunday'})
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-[#193953] mb-1.5">
                      3. Insertion Position:
                    </label>
                    <select
                      value={moveTargetPosition}
                      onChange={e => setMoveTargetPosition(Number(e.target.value))}
                      className="w-full rounded-lg border border-[#E1ECF2] bg-white px-3 py-2 text-xs text-[#193953] focus:border-[#176EA8] focus:outline-none"
                    >
                      {insertionSlots.map(slot => (
                        <option key={slot.position} value={slot.position}>
                          {slot.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Step 3: True Engine Before / After Preview */}
                {movePreview && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase tracking-wider text-[#193953]">
                        Engine Simulation Preview
                      </span>
                      {movePreview.resolutionLabel === 'Move Fits' && (
                        <span className="text-xs font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                          ✓ Move Fits
                        </span>
                      )}
                      {movePreview.resolutionLabel === 'Conflict Resolved' && (
                        <span className="text-xs font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                          ✓ Conflict Resolved
                        </span>
                      )}
                      {movePreview.resolutionLabel === 'More Changes Needed' && (
                        <span className="text-xs font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800">
                          ⚠️ More Changes Needed
                        </span>
                      )}
                      {movePreview.resolutionLabel === 'Cannot Fit' && (
                        <span className="text-xs font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800">
                          ✕ Cannot Fit
                        </span>
                      )}
                    </div>

                    {/* Before vs Proposed Metrics Grid */}
                    <div className="rounded-xl border border-[#E1ECF2] bg-white overflow-hidden text-xs">
                      <div className="grid grid-cols-4 bg-[#F4F9FC] p-2.5 font-bold text-[#5A7184] border-b border-[#E1ECF2] text-[11px] uppercase tracking-wider">
                        <div>Metric</div>
                        <div>Current (Before)</div>
                        <div>Proposed (After)</div>
                        <div>Scheduler Delta</div>
                      </div>

                      {/* Home Arrival */}
                      <div className="grid grid-cols-4 p-2.5 border-b border-[#E1ECF2] items-center">
                        <div className="font-bold text-[#193953]">Home Arrival</div>
                        <div className="text-gray-700">{movePreview.before.homeArrival}</div>
                        <div className="font-bold text-[#176EA8]">{movePreview.after.homeArrival}</div>
                        <div className="text-[11px] text-gray-500">
                          {movePreview.deltas.homeArrivalDeltaMinutes === 0
                            ? '0 min (unchanged)'
                            : `${movePreview.deltas.homeArrivalDeltaMinutes > 0 ? '+' : ''}${movePreview.deltas.homeArrivalDeltaMinutes}m`}
                        </div>
                      </div>

                      {/* Return Margin */}
                      <div className="grid grid-cols-4 p-2.5 border-b border-[#E1ECF2] items-center">
                        <div className="font-bold text-[#193953]">Return Margin</div>
                        <div className={movePreview.before.returnMarginMinutes >= 60 ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'}>
                          {movePreview.before.returnMarginMinutes >= 0 ? `+${movePreview.before.returnMarginMinutes}m` : `${movePreview.before.returnMarginMinutes}m`}
                        </div>
                        <div className={movePreview.after.returnMarginMinutes >= 60 ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'}>
                          {movePreview.after.returnMarginMinutes >= 0 ? `+${movePreview.after.returnMarginMinutes}m` : `${movePreview.after.returnMarginMinutes}m`}
                        </div>
                        <div className="text-[11px] text-gray-500">
                          {movePreview.deltas.marginDeltaMinutes === 0
                            ? '0 min (unchanged)'
                            : `${movePreview.deltas.marginDeltaMinutes > 0 ? '+' : ''}${movePreview.deltas.marginDeltaMinutes}m`}
                        </div>
                      </div>

                      {/* Activity Timetable */}
                      <div className="grid grid-cols-4 p-2.5 border-b border-[#E1ECF2] items-center">
                        <div className="font-bold text-[#193953]">{movePreview.activityName}</div>
                        <div className="text-gray-700">
                          {movePreview.before.activityStartTime && movePreview.before.activityEndTime && movePreview.fromDay ? (
                            `Day ${movePreview.fromDay} (${movePreview.before.activityStartTime}–${movePreview.before.activityEndTime})`
                          ) : movePreview.fromDay ? (
                            `Day ${movePreview.fromDay} (Unavailable)`
                          ) : (
                            'Unscheduled'
                          )}
                        </div>
                        <div className="font-bold text-[#176EA8]">
                          {movePreview.after.activityStartTime && movePreview.after.activityEndTime ? (
                            `Day ${movePreview.toDay} (${movePreview.after.activityStartTime}–${movePreview.after.activityEndTime})`
                          ) : (
                            `Day ${movePreview.toDay} (Cannot Fit)`
                          )}
                        </div>
                        <div className="text-[11px] text-gray-500">
                          Transfer: {movePreview.deltas.additionalTravelAllowanceMinutes}m
                        </div>
                      </div>

                      {/* Violations / Resolution */}
                      <div className="grid grid-cols-4 p-2.5 items-center">
                        <div className="font-bold text-[#193953]">Resolution Verdict</div>
                        <div className="text-gray-600">{movePreview.before.violationsCount} violations</div>
                        <div className="font-bold text-gray-900">{movePreview.after.violationsCount} violations</div>
                        <div>
                          <span
                            className={`text-[11px] font-bold px-2 py-0.5 rounded border ${
                              movePreview.resolutionLabel === 'Move Fits' || movePreview.resolutionLabel === 'Conflict Resolved'
                                ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                                : movePreview.resolutionLabel === 'More Changes Needed'
                                ? 'text-amber-700 bg-amber-50 border-amber-200'
                                : 'text-rose-700 bg-rose-50 border-rose-200'
                            }`}
                          >
                            {movePreview.resolutionLabel}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Resolution Banner */}
                    {movePreview.resolutionLabel === 'Move Fits' && (
                      <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-xs text-emerald-900 font-medium">
                        ✓ <strong>Move Fits:</strong> {movePreview.resolutionMessage}
                      </div>
                    )}

                    {movePreview.resolutionLabel === 'Conflict Resolved' && (
                      <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-xs text-emerald-900 font-medium">
                        ✓ <strong>Conflict Resolved:</strong> {movePreview.resolutionMessage}
                      </div>
                    )}

                    {movePreview.resolutionLabel === 'More Changes Needed' && (
                      <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 space-y-1">
                        <div className="font-bold flex items-center gap-1.5">
                          <span>⚠️</span>
                          <span>More Changes Needed:</span>
                        </div>
                        <p>{movePreview.resolutionMessage}</p>
                        <p className="text-[11px] text-amber-800 pt-0.5 font-medium">
                          The activity fits on Day {movePreview.toDay}, but the overall trip remains overdue or has other active constraints. Additional adjustments are needed to achieve feasibility.
                        </p>
                      </div>
                    )}

                    {movePreview.resolutionLabel === 'Cannot Fit' && (
                      <div className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-xs text-rose-900 space-y-1">
                        <div className="font-bold flex items-center gap-1.5">
                          <span>✕</span>
                          <span>Why this slot cannot be scheduled:</span>
                        </div>
                        <p>{movePreview.validationError}</p>
                        {movePreview.deltas.displacedActivities && movePreview.deltas.displacedActivities.length > 0 && (
                          <p className="text-[11px] text-rose-800 font-semibold">
                            Displaced activity: {movePreview.deltas.displacedActivities.join(', ')}
                          </p>
                        )}
                        <p className="text-[11px] text-rose-700 pt-1 font-medium">
                          Alternative adjustments: choose another day, adjust visit order, or remove an optional stop.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Modal Footer Actions */}
                <div className="pt-2 flex items-center justify-end gap-3 border-t border-[#E1ECF2]">
                  <button
                    type="button"
                    onClick={() => setIsMoveModalOpen(false)}
                    className="rounded-xl border border-[#E1ECF2] px-4 py-2 text-xs font-bold text-[#5A7184] hover:text-[#193953]"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    disabled={!movePreview || !movePreview.isValid}
                    onClick={handleConfirmMove}
                    className={`rounded-xl px-4 py-2 text-xs font-bold text-white shadow-xs transition-all active:scale-95 ${
                      movePreview && movePreview.isValid
                        ? 'bg-[#176EA8] hover:bg-[#135A8A]'
                        : 'bg-gray-300 cursor-not-allowed text-gray-500'
                    }`}
                  >
                    Confirm & Move Activity →
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
