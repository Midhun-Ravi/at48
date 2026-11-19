import { useState, useMemo } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import type { Dispatch, SetStateAction } from 'react';
import type { CustomPlannedActivity, UserConstraints, TimetableEntry } from '../types';
import { getDestination } from '../data/destinations';
import { getDestinationGuide } from '../data/destinationGuides';
import { getCompatiblePitstops } from '../data/pitstops';
import { evaluateFeasibility, parseIST } from '../engine/scheduler';
import { evaluateActivityMove, getMoveCandidates, getInsertionSlotsForDay } from '../engine/moveActivity';
import {
  getTransferDetails,
  evaluateTransferAdjustment,
  evaluateVisitScheduling,
  type VisitSchedulingPreview,
} from '../engine/timelineEditing';
import TripMap from '../components/TripMap';
import ProgressBar from '../components/ProgressBar';
import {
  formatDuration,
  formatReadableDateTime,
} from '../utils/formatters';
import {
  buildShareableParams,
  parseShareableTrip,
} from '../utils/tripShare';
import TactileButton from '../components/ui/TactileButton';
import ScenicBackground from '../components/scenic/ScenicBackground';
import DestinationGuideModal from '../components/DestinationGuideModal';

type Props = { inputs: UserConstraints; setInputs: Dispatch<SetStateAction<UserConstraints>> };

interface WhatChangedNotice {
  message: string;
  timestamp: number;
}

export default function ScheduleScreen({ inputs, setInputs }: Props) {
  const { id } = useParams();
  const nav = useNavigate();
  const [searchParams] = useSearchParams();

  // Active day tab (1 to N)
  const [activeDay, setActiveDay] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<'schedule' | 'places'>('schedule');
  const [showMobileMap, setShowMobileMap] = useState<boolean>(false);
  const [activeGuideId, setActiveGuideId] = useState<string | null>(null);

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
            className="inline-block rounded-xl bg-[#C65B32] px-5 py-3 text-sm font-bold text-white hover:bg-[#B04E27] transition-colors"
          >
            ← Create a new trip
          </Link>
        </div>
      </div>
    );
  }

  // Active inputs: Reconstructed from URL if valid share link opened; otherwise use props from planning flow
  const isGuestView = Boolean(parsedTrip?.valid && parsedTrip.data.isGuestView);
  const initialInputs = parsedTrip?.valid ? parsedTrip.data.inputs : inputs;
  const [currentInputs, setCurrentInputs] = useState<UserConstraints>(initialInputs);

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

  // Re-evaluate feasibility dynamically using deterministic scheduling engine
  const r = evaluateFeasibility(dest, currentInputs);

  // Progressive disclosure toggle states
  const selectedPitstopIds = currentInputs.selectedPitstopIds ?? [];
  const [isPitstopsOpen, setIsPitstopsOpen] = useState<boolean>(selectedPitstopIds.length > 0);
  const [isDelayScenarioOpen, setIsDelayScenarioOpen] = useState<boolean>(
    (currentInputs.drivingAdjustmentMinutes ?? 0) !== 0
  );

  // Pitstop dietary filter: 'all' | 'veg' | 'non-veg'
  const [dietaryFilter, setDietaryFilter] = useState<'all' | 'veg' | 'non-veg'>('all');

  // History stack for Transactional Undo
  const [historyStack, setHistoryStack] = useState<UserConstraints[]>([]);
  const [whatChangedNotice, setWhatChangedNotice] = useState<WhatChangedNotice | null>(null);

  // Move Activity Modal State
  const [isMoveModalOpen, setIsMoveModalOpen] = useState<boolean>(false);
  const [selectedMoveActivityId, setSelectedMoveActivityId] = useState<string>('');
  const [moveTargetDay, setMoveTargetDay] = useState<number>(2);
  const [moveTargetPosition, setMoveTargetPosition] = useState<number>(0);

  // Local Transfer Adjustment Modal State
  const [isTransferModalOpen, setIsTransferModalOpen] = useState<boolean>(false);
  const [selectedTransferEntry, setSelectedTransferEntry] = useState<TimetableEntry | null>(null);
  const [transferMinutesInput, setTransferMinutesInput] = useState<number>(30);

  // Traveler-Controlled Visit Scheduling Editor State ("Use This Time")
  const [isVisitEditorOpen, setIsVisitEditorOpen] = useState<boolean>(false);
  const [editorMode, setEditorMode] = useState<'schedule_free' | 'edit_visit'>('schedule_free');
  const [editorTargetDay, setEditorTargetDay] = useState<number>(1);
  const [editorActivityType, setEditorActivityType] = useState<'curated' | 'custom' | 'buffer'>('custom');
  const [editorActivityId, setEditorActivityId] = useState<string>('');
  const [editorCustomId, setEditorCustomId] = useState<string | undefined>(undefined);
  const [editorName, setEditorName] = useState<string>('');
  const [editorVisitStartTime, setEditorVisitStartTime] = useState<string>('15:00');
  const [editorDurationMinutes, setEditorDurationMinutes] = useState<number>(45);
  const [editorTransferMinutes, setEditorTransferMinutes] = useState<number>(15);
  const [editorCostPerPerson, setEditorCostPerPerson] = useState<number>(0);
  const [selectedFreeWindowInfo, setSelectedFreeWindowInfo] = useState<{ start: string; end: string; mins: number } | null>(null);

  // Add Custom Place Form State
  const [customPlaceName, setCustomPlaceName] = useState('');
  const [customPlaceCategory, setCustomPlaceCategory] = useState<'sightseeing' | 'food' | 'nature' | 'relaxation'>('sightseeing');
  const [customPlaceDuration, setCustomPlaceDuration] = useState<number>(45);
  const customPlaceCost = 0;
  const [customPlaceTransfer, setCustomPlaceTransfer] = useState<number>(15);

  // Available days dynamically extracted from timeline entries
  const availableDays = useMemo(() => {
    const days = Array.from(new Set(r.timeline.map(t => t.day))).sort((a, b) => a - b);
    return days.length > 0 ? days : [1];
  }, [r.timeline]);

  const currentActiveDay = availableDays.includes(activeDay) ? activeDay : availableDays[0] || 1;

  const compatibleStops = getCompatiblePitstops(dest.id);

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

  // Transactional state modifier: pushes current snapshot to history stack
  const recordHistory = (newConstraints: UserConstraints, message: string) => {
    if (isGuestView) return;
    setHistoryStack(prev => [...prev, currentInputs]);
    setCurrentInputs(newConstraints);
    setInputs(newConstraints);
    setWhatChangedNotice({
      message,
      timestamp: Date.now(),
    });
  };

  // Undo handler
  const handleUndo = () => {
    if (isGuestView) return;
    if (historyStack.length === 0) return;
    const previous = historyStack[historyStack.length - 1];
    setHistoryStack(prev => prev.slice(0, -1));
    setCurrentInputs(previous);
    setInputs(previous);
    setWhatChangedNotice({
      message: 'Action undone. Schedule restored to previous state.',
      timestamp: Date.now(),
    });
  };

  const updateInputs = (updater: (prev: UserConstraints) => UserConstraints, changeMessage?: string) => {
    const next = updater(currentInputs);
    recordHistory(next, changeMessage || 'Schedule updated.');
  };

  // Pitstop toggle
  const togglePitstop = (pitstopId: string) => {
    const current = currentInputs.selectedPitstopIds ?? [];
    const isAdding = !current.includes(pitstopId);
    const next = isAdding
      ? [...current, pitstopId]
      : current.filter(s => s !== pitstopId);

    const stopName = compatibleStops.find(s => s.id === pitstopId)?.name || 'Highway Pitstop';
    updateInputs(
      prev => ({ ...prev, selectedPitstopIds: next }),
      isAdding ? `Added pitstop "${stopName}".` : `Removed pitstop "${stopName}".`
    );
  };

  // Activity enable/disable toggle
  const toggleActivity = (activityId: string) => {
    const current = currentInputs.disabledActivityIds ?? [];
    const isDisabling = !current.includes(activityId);
    const next = isDisabling
      ? [...current, activityId]
      : current.filter(id => id !== activityId);

    const actName = dest.activities.find(a => a.id === activityId)?.name || 'Stop';
    updateInputs(
      prev => ({ ...prev, disabledActivityIds: next }),
      isDisabling ? `Removed stop "${actName}".` : `Restored stop "${actName}".`
    );
  };

  // Extra travel allowance (delay simulation)
  const setDrivingAdjustment = (minutes: number) => {
    const next = Math.max(-60, Math.min(120, minutes));
    updateInputs(
      prev => ({ ...prev, drivingAdjustmentMinutes: next }),
      `Updated travel allowance to ${next > 0 ? `+${next}m` : `${next}m`}.`
    );
  };

  // 1. MOVE ACTIVITY ENGINE INTEGRATION
  const moveCandidates = useMemo(() => {
    return getMoveCandidates(dest, currentInputs, r);
  }, [dest, currentInputs, r]);

  const insertionSlots = useMemo(() => {
    return getInsertionSlotsForDay(dest, currentInputs, moveTargetDay);
  }, [dest, currentInputs, moveTargetDay]);

  const movePreview = useMemo(() => {
    if (!selectedMoveActivityId) return null;
    return evaluateActivityMove(
      dest,
      currentInputs,
      selectedMoveActivityId,
      moveTargetDay,
      moveTargetPosition
    );
  }, [dest, currentInputs, selectedMoveActivityId, moveTargetDay, moveTargetPosition]);

  const handleOpenMoveModal = (actId?: string) => {
    const candidateId = actId || moveCandidates[0]?.activityId || dest.activities[0]?.id || '';
    setSelectedMoveActivityId(candidateId);
    setMoveTargetDay(currentActiveDay === 1 ? 2 : 1);
    setMoveTargetPosition(0);
    setIsMoveModalOpen(true);
  };

  const handleConfirmMove = () => {
    if (!movePreview || !movePreview.isValid) return;
    const deltaMsg = movePreview.deltas.marginDeltaMinutes !== 0
      ? ` (Return margin: ${movePreview.after.returnMarginMinutes >= 0 ? '+' : ''}${movePreview.after.returnMarginMinutes}m)`
      : ` (Return margin unchanged at +${movePreview.after.returnMarginMinutes}m)`;

    recordHistory(
      movePreview.proposedConstraints,
      `Moved "${movePreview.activityName}" to Day ${moveTargetDay} (${movePreview.after.activityStartTime}–${movePreview.after.activityEndTime} IST).${deltaMsg}`
    );
    setIsMoveModalOpen(false);
  };

  // 2. LOCAL TRANSFER ADJUSTMENT ENGINE INTEGRATION
  const transferDetails = useMemo(() => {
    if (!selectedTransferEntry) return null;
    return getTransferDetails(selectedTransferEntry, r.timeline, dest, currentInputs);
  }, [selectedTransferEntry, r.timeline, dest, currentInputs]);

  const transferPreview = useMemo(() => {
    if (!selectedTransferEntry || !selectedTransferEntry.activityId) return null;
    return evaluateTransferAdjustment(
      selectedTransferEntry.activityId,
      transferMinutesInput,
      dest,
      currentInputs
    );
  }, [selectedTransferEntry, transferMinutesInput, dest, currentInputs]);

  const handleOpenTransferModal = (entry: TimetableEntry) => {
    setSelectedTransferEntry(entry);
    const details = getTransferDetails(entry, r.timeline, dest, currentInputs);
    setTransferMinutesInput(details?.currentDurationMinutes ?? 30);
    setIsTransferModalOpen(true);
  };

  const handleConfirmTransferAdjustment = () => {
    if (!transferPreview || !transferPreview.isValid) return;
    const destName = transferDetails?.destinationLabel || 'stop';
    recordHistory(
      transferPreview.proposedConstraints,
      `Adjusted transfer to "${destName}" to ${transferPreview.proposedDurationMinutes}m. Return margin: ${transferPreview.after.returnMarginMinutes >= 0 ? '+' : ''}${transferPreview.after.returnMarginMinutes}m.`
    );
    setIsTransferModalOpen(false);
    setSelectedTransferEntry(null);
  };

  // 3. VISIT SCHEDULING ENGINE INTEGRATION ("Use This Time")
  const visitSchedulingPreview: VisitSchedulingPreview | null = useMemo(() => {
    if (!isVisitEditorOpen) return null;
    const isBuffer = editorActivityType === 'buffer';
    const isCurated = editorActivityType === 'curated';
    const catalogAct = isCurated ? dest.activities.find(a => a.id === editorActivityId) : undefined;
    const displayName = isCurated
      ? catalogAct?.name || editorActivityId
      : editorName.trim() || (isBuffer ? 'Personal Rest Buffer' : 'Custom Stop');

    return evaluateVisitScheduling(
      {
        activityId: isCurated ? editorActivityId : undefined,
        customId: editorCustomId,
        name: displayName,
        day: editorTargetDay,
        visitStartTime: editorVisitStartTime,
        durationMinutes: editorDurationMinutes,
        transferMinutes: isBuffer ? 0 : editorTransferMinutes,
        costPerPersonINR: editorCostPerPerson,
        openTime: catalogAct?.openTime,
        closeTime: catalogAct?.closeTime,
        lastEntryTime: catalogAct?.lastEntryTime,
        isRestBuffer: isBuffer,
      },
      dest,
      currentInputs
    );
  }, [
    isVisitEditorOpen,
    editorActivityType,
    editorActivityId,
    editorCustomId,
    editorName,
    editorTargetDay,
    editorVisitStartTime,
    editorDurationMinutes,
    editorTransferMinutes,
    editorCostPerPerson,
    dest,
    currentInputs,
  ]);

  const handleOpenVisitEditorForFreeTime = (entry: TimetableEntry) => {
    const startEpoch = parseIST(entry.startTime);
    // Exact slot start preservation
    const exactSlotStart = entry.startTime.slice(11, 16);
    setSelectedFreeWindowInfo({
      start: exactSlotStart,
      end: entry.endTime.slice(11, 16),
      mins: Math.round((parseIST(entry.endTime) - startEpoch) / 60000),
    });
    setEditorMode('schedule_free');
    setEditorTargetDay(entry.day);
    setEditorActivityType('custom');
    setEditorActivityId(dest.activities[0]?.id || '');
    setEditorCustomId(undefined);
    setEditorName('');
    setEditorVisitStartTime(exactSlotStart);
    setEditorDurationMinutes(Math.min(45, Math.round((parseIST(entry.endTime) - startEpoch) / 60000)));
    setEditorTransferMinutes(15);
    setEditorCostPerPerson(0);
    setIsVisitEditorOpen(true);
  };

  const handleOpenVisitEditorForActivity = (entry: TimetableEntry) => {
    setEditorMode('edit_visit');
    setEditorTargetDay(entry.day);
    setSelectedFreeWindowInfo(null);

    if (entry.isCustom) {
      setEditorActivityType(entry.isRestBuffer ? 'buffer' : 'custom');
      setEditorCustomId(entry.activityId);
      setEditorActivityId('');
      setEditorName(entry.label);
    } else {
      setEditorActivityType('curated');
      setEditorActivityId(entry.activityId!);
      setEditorCustomId(undefined);
      setEditorName(entry.label);
    }

    setEditorVisitStartTime(entry.startTime.slice(11, 16));
    setEditorDurationMinutes(
      Math.round((parseIST(entry.endTime) - parseIST(entry.startTime)) / 60000)
    );

    const transferEntry = r.timeline.find(
      t => t.activityId === entry.activityId && t.category === 'TRANSFER'
    );
    const transMins = transferEntry
      ? Math.round((parseIST(transferEntry.endTime) - parseIST(transferEntry.startTime)) / 60000)
      : currentInputs.transferAdjustments?.[entry.activityId!] ?? 15;
    setEditorTransferMinutes(transMins);

    setIsVisitEditorOpen(true);
  };

  const handleConfirmVisitScheduling = () => {
    if (!visitSchedulingPreview || !visitSchedulingPreview.isValid) return;
    const actName = visitSchedulingPreview.details.activityName;
    const timeStr = visitSchedulingPreview.details.visitStartTime.slice(11);
    const dayNum = visitSchedulingPreview.details.day;

    const actionText =
      editorMode === 'edit_visit'
        ? `Updated visit timing for "${actName}" to ${timeStr} on Day ${dayNum}.`
        : `Scheduled "${actName}" at ${timeStr} on Day ${dayNum} (${visitSchedulingPreview.params.durationMinutes}m visit).`;

    recordHistory(visitSchedulingPreview.proposedConstraints, actionText);
    setIsVisitEditorOpen(false);
  };

  // 4. ADD CUSTOM SPOT DIRECTLY
  const handleAddCustomSpot = (e: React.FormEvent) => {
    e.preventDefault();
    const name = customPlaceName.trim();
    if (!name) return;

    const newId = `custom_${Date.now()}`;
    const newActivity: CustomPlannedActivity = {
      id: newId,
      name,
      day: currentActiveDay,
      durationMinutes: customPlaceDuration,
      costPerPersonINR: customPlaceCost,
    };

    updateInputs(
      prev => ({
        ...prev,
        customActivities: [...(prev.customActivities ?? []), newActivity],
        transferAdjustments: {
          ...(prev.transferAdjustments ?? {}),
          [newId]: customPlaceTransfer,
        },
      }),
      `Added custom stop "${name}" to Day ${currentActiveDay}.`
    );

    setCustomPlaceName('');
    setActiveTab('schedule');
  };

  const handleRemoveCustomActivity = (customId: string) => {
    updateInputs(
      prev => ({
        ...prev,
        customActivities: (prev.customActivities ?? []).filter(a => a.id !== customId),
      }),
      'Removed custom stop.'
    );
  };

  const isComfortable = r.rating === 'Comfortable';
  const isTight = r.rating === 'Tight';
  const activeBlockers = r.violations.filter(v => v.severity === 'BLOCKER');
  const hasBlocker = activeBlockers.length > 0;

  const goToReviewScreen = () => {
    const params = buildShareableParams(dest.id, currentInputs);
    nav(`/review/${dest.id}?${params.toString()}`);
  };

  return (
    <section className="relative space-y-5 w-full min-w-0">
      {/* 4-part segmented progress meter */}
      <ProgressBar currentStep={3} />

      {/* 1. Page 3 Calm Workspace Header */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-b from-[#F8E1D2]/50 via-[#FAF2EB] to-[#FFF7F0] p-4 sm:p-6 border border-[#EADBCE]">
        <ScenicBackground variant="compact" />
        <div className="relative z-10 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[11px] font-bold text-[#C65B32] border border-[#EADBCE] shadow-2xs">
                <span className="h-1.5 w-1.5 rounded-full bg-[#C65B32]" />
                Step 3 · Trip Workspace
              </span>
              <span className="rounded-full bg-white/80 border border-[#EADBCE] px-2.5 py-0.5 text-xs font-semibold text-[#344F48]">
                📍 {dest.name} ({dest.routeName})
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Link
                to="/compare"
                className="text-xs font-bold text-[#6B7C77] hover:text-[#C65B32] px-3 py-1.5 rounded-xl border border-[#EADBCE] bg-white transition-colors"
              >
                ← Other Destinations
              </Link>
              <TactileButton
                variant="primary"
                size="sm"
                onClick={goToReviewScreen}
                className="!px-3.5 !py-1.5 text-xs font-bold"
              >
                Review & Share →
              </TactileButton>
            </div>
          </div>

          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-[#344F48] tracking-tight leading-snug">
              What should we explore along the way?
            </h1>
            <p className="text-xs sm:text-sm text-[#6B7C77] max-w-2xl leading-relaxed mt-0.5">
              Connected itinerary and map workspace. Reorder activities, adjust transfer allowances, or reserve personal free time while maintaining deterministic return feasibility.
            </p>
          </div>

          {/* Editable Trip Summary Pill Bar */}
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-white border border-[#EADBCE] px-3 py-1.5 font-bold text-[#344F48]">
              <span>📅</span>
              <span>
                {formatReadableDateTime(currentInputs.departureDateTime)} – {formatReadableDateTime(currentInputs.returnDeadlineDateTime)}
              </span>
            </span>

            <span className="inline-flex items-center gap-1.5 rounded-xl bg-white border border-[#EADBCE] px-3 py-1.5 font-bold text-[#344F48]">
              <span>👥</span>
              <span>{currentInputs.partySize} {currentInputs.partySize === 1 ? 'Traveler' : 'Travelers'}</span>
            </span>

            <span className="inline-flex items-center gap-1.5 rounded-xl bg-white border border-[#EADBCE] px-3 py-1.5 font-bold text-[#344F48]">
              <span>⚡</span>
              <span className="capitalize">{currentInputs.pace} pace</span>
            </span>

            {!isGuestView && (
              <Link
                to="/plan"
                className="text-xs font-bold text-[#C65B32] hover:underline px-2 py-1 transition-colors"
              >
                Edit dates & limits ✎
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Persistent "What Changed?" Transactional Notification with Undo */}
      {whatChangedNotice && (
        <div className="rounded-2xl border border-[#EADBCE] bg-white p-3.5 sm:p-4 shadow-sm flex items-center justify-between gap-3 animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="h-2 w-2 rounded-full bg-[#5F7B6B] shrink-0" />
            <p className="text-xs sm:text-sm font-semibold text-[#344F48] truncate">
              {whatChangedNotice.message}
            </p>
          </div>
          <button
            type="button"
            onClick={handleUndo}
            disabled={historyStack.length === 0}
            className="flex items-center gap-1.5 rounded-xl bg-[#FAF2EB] border border-[#EADBCE] hover:bg-[#F8E1D2] px-3 py-1.5 text-xs font-black text-[#C65B32] transition-colors shrink-0 shadow-2xs cursor-pointer"
          >
            <span>↩</span>
            <span>Undo</span>
          </button>
        </div>
      )}

      {/* 2. Sticky Compact Feasibility Indicator */}
      <div className="sticky top-16 z-30 rounded-2xl border border-[#EADBCE] bg-white/95 backdrop-blur-md p-3 sm:p-4 shadow-sm transition-all duration-200">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Left: Grounded Feasibility Verdict & Return Margin */}
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-4">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black uppercase tracking-wider ${
                isComfortable
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                  : isTight
                  ? 'bg-amber-50 text-amber-800 border border-amber-300'
                  : 'bg-red-50 text-red-800 border border-red-300'
              }`}
            >
              <span>{isComfortable ? '✓' : isTight ? '⚠️' : '✕'}</span>
              <span>{isComfortable ? 'Comfortable' : isTight ? 'Tight Schedule' : 'Not Recommended'}</span>
            </span>

            {/* Return Margin Pill */}
            <div className="flex items-center gap-1.5 text-xs sm:text-sm">
              <span className="text-[#6B7C77] font-medium hidden sm:inline">Return Margin:</span>
              <strong
                className={`font-black ${
                  r.returnDeadlineMarginMinutes >= 60
                    ? 'text-emerald-700'
                    : r.returnDeadlineMarginMinutes >= 0
                    ? 'text-amber-700'
                    : 'text-red-700'
                }`}
              >
                {r.returnDeadlineMarginMinutes >= 0
                  ? `+${formatDuration(r.returnDeadlineMarginMinutes)} margin`
                  : `−${formatDuration(Math.abs(r.returnDeadlineMarginMinutes))} projected late`}
              </strong>
            </div>

            {/* Home arrival & deadline reminder */}
            <span className="text-xs text-[#6B7C77] hidden md:inline">
              (Arrive ~{r.homeArrivalTime.slice(11, 16)} IST · Deadline {currentInputs.returnDeadlineDateTime.slice(11, 16)})
            </span>

            {hasBlocker && (
              <span className="rounded-full bg-rose-50 text-rose-800 border border-rose-300 px-2.5 py-0.5 text-xs font-bold animate-pulse">
                {activeBlockers.length} Blocker Violation
              </span>
            )}
          </div>

          {/* Right: Make Fit Button & Review Action */}
          <div className="flex items-center gap-2">
            <TactileButton
              variant="secondary"
              size="sm"
              disabled={isGuestView}
              onClick={() => handleOpenMoveModal()}
              className="!px-3 !py-1 text-xs font-bold"
            >
              🔄 Move Activity / Make Fit
            </TactileButton>

            <TactileButton
              variant="primary"
              size="sm"
              onClick={goToReviewScreen}
              className="!px-3 !py-1 text-xs font-bold hidden sm:inline-flex"
            >
              Review & Share →
            </TactileButton>
          </div>
        </div>

        {/* Subtitle / Advisory text if tight or blocker exists */}
        {!isComfortable && (
          <p className="text-[11px] text-[#6B7C77] mt-1.5 pt-1.5 border-t border-[#EADBCE] font-medium">
            {hasBlocker
              ? `⚠️ Schedule conflict: ${activeBlockers[0]?.message || 'Operating window or transfer exceeded.'} Click "Move Activity / Make Fit" to resolve.`
              : `⚠️ Return buffer is tight (+${r.returnDeadlineMarginMinutes}m). Highway traffic or prolonged stops risk missing the return deadline.`}
          </p>
        )}
      </div>

      {isGuestView && (
        <div role="status" className="rounded-xl border border-[#EADBCE] bg-[#FAF2EB] p-3 text-sm text-[#344F48]">
          Shared trip preview · Editing is disabled. Review the route and itinerary, then continue to RSVP.
          <TactileButton variant="primary" size="sm" onClick={goToReviewScreen} className="ml-3">Review & RSVP →</TactileButton>
        </div>
      )}

      {/* Road & Operating Advisories Banner (if night curfew active) */}
      {dest.routeRestriction && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/90 p-3 text-xs text-amber-900 flex items-start gap-2">
          <span className="text-sm">⚠️</span>
          <p className="leading-relaxed">
            <strong>Night Curfew in Effect:</strong> {dest.routeRestriction.name} gates close between {dest.routeRestriction.startTime} and {dest.routeRestriction.endTime}. Transit through the reserve must clear before 21:00.
          </p>
        </div>
      )}

      {/* Mobile Map Toggle Button (Collapsible) */}
      <div className="lg:hidden flex items-center justify-between bg-white border border-[#EADBCE] p-2.5 rounded-2xl shadow-2xs">
        <span className="text-xs font-bold text-[#344F48] flex items-center gap-1.5">
          <span>🗺️</span>
          <span>Corridor Map & Stops</span>
        </span>
        <button
          type="button"
          onClick={() => setShowMobileMap(!showMobileMap)}
          className="flex items-center gap-1.5 rounded-xl border border-[#EADBCE] bg-[#FAF2EB] hover:bg-[#F8E1D2] px-3 py-1.5 text-xs font-bold text-[#C65B32] shadow-2xs cursor-pointer transition-colors"
        >
          <span>{showMobileMap ? '✕ Hide Map' : '🗺️ Show Map'}</span>
        </button>
      </div>

      {/* Mobile Map View (Collapsible) */}
      {showMobileMap && (
        <div className="lg:hidden rounded-2xl border border-[#EADBCE] overflow-hidden shadow-sm animate-in fade-in duration-200">
          <TripMap
            destination={dest}
            inputs={currentInputs}
            result={r}
            onTogglePitstop={isGuestView ? undefined : togglePitstop}
          />
        </div>
      )}

      {/* Connected 2-Column Desktop Workspace (Left: Timeline & Tools, Right: Sticky Map) */}
      <div className="grid grid-cols-12 gap-6 items-start">
        {/* Left Column (7 of 12 cols): Timeline, Tabs & Editing Tools */}
        <fieldset disabled={isGuestView} className="col-span-12 lg:col-span-7 min-w-0 space-y-5 border-0 p-0">
          {/* Day Selector Tabs & Action Strip */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#EADBCE] pb-2">
            <div className="flex items-center gap-1.5 overflow-x-auto">
              {availableDays.map(dayNum => {
                const dayStopsCount = r.timeline.filter(
                  t => t.day === dayNum && t.category === 'ACTIVITY' && !t.isRestBuffer
                ).length;

                return (
                  <button
                    key={dayNum}
                    type="button"
                    onClick={() => {
                      setActiveDay(dayNum);
                      setActiveTab('schedule');
                    }}
                    className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                      activeDay === dayNum && activeTab === 'schedule'
                        ? 'bg-[#C65B32] text-white shadow-xs'
                        : 'bg-[#FAF2EB] text-[#6B7C77] hover:text-[#344F48] border border-[#EADBCE]'
                    }`}
                  >
                    Day {dayNum} ({dayStopsCount} stops)
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => setActiveTab('places')}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  activeTab === 'places'
                    ? 'bg-[#344F48] text-white shadow-xs'
                    : 'bg-[#FAF2EB] text-[#6B7C77] hover:text-[#344F48] border border-[#EADBCE]'
                }`}
              >
                <span>+</span>
                <span>Add Place / Spot</span>
              </button>
            </div>

            <div className="text-xs text-[#6B7C77] hidden sm:block">
              Day {currentActiveDay} of {availableDays.length}
            </div>
          </div>

          {/* TAB 1: Chronological Timetable View */}
          {activeTab === 'schedule' && (
            <div className="space-y-3.5">
              {(() => {
                const dayEntries = r.timeline.filter(t => t.day === currentActiveDay);
                const dayScheduledStops = dayEntries.filter(
                  t => t.category === 'ACTIVITY' && !t.isRestBuffer
                );

                if (dayEntries.length === 0) {
                  return (
                    <div className="rounded-2xl border border-[#EADBCE] bg-white p-8 text-center text-xs text-[#6B7C77]">
                      No events scheduled for Day {currentActiveDay}.
                    </div>
                  );
                }

                return dayEntries.map(entry => {
                  // 1. TOURIST STOP / ACTIVITY
                  if (entry.category === 'ACTIVITY' && !entry.isRestBuffer) {
                    const stopIdx = dayScheduledStops.findIndex(s => s.id === entry.id);
                    const stopNumber = stopIdx >= 0 ? stopIdx + 1 : 1;
                    const actCost = dest.activities.find(a => a.id === entry.activityId)?.costPerPersonINR;

                    return (
                      <div
                        key={entry.id}
                        className="group rounded-2xl border border-[#EADBCE] bg-white p-4 sm:p-5 transition-all shadow-xs hover:border-[#C65B32]/40 hover:shadow-md space-y-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#C65B32] text-white font-black text-xs shrink-0 shadow-2xs">
                              #{stopNumber}
                            </div>
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="text-sm sm:text-base font-black text-[#344F48]">{entry.label}</h4>
                                <span className="rounded-md bg-[#FAF2EB] border border-[#EADBCE] px-2 py-0.5 text-[10px] font-bold text-[#C65B32] uppercase tracking-wider">
                                  Stop #{stopNumber}
                                </span>
                                {entry.isOptional && (
                                  <span className="text-[10px] text-[#6B7C77] font-semibold">
                                    (Optional)
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-[#6B7C77] mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                                <span className="font-bold text-[#344F48]">⏰ {entry.startTime.slice(11)}–{entry.endTime.slice(11)} IST</span>
                                {actCost !== undefined && actCost > 0 && (
                                  <span>🎟️ ₹{actCost}/person</span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Stop Action Buttons */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleOpenVisitEditorForActivity(entry)}
                              className="rounded-lg border border-[#EADBCE] bg-[#FAF2EB] hover:bg-[#F8E1D2] px-2.5 py-1 text-xs font-bold text-[#344F48] transition-colors flex items-center gap-1 shadow-2xs cursor-pointer"
                              title="Edit visit timing & duration"
                            >
                              <span>✏️</span>
                              <span>Edit</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenMoveModal(entry.activityId)}
                              className="rounded-lg border border-[#EADBCE] bg-white hover:bg-[#FAF2EB] px-2.5 py-1 text-xs font-bold text-[#C65B32] transition-colors flex items-center gap-1 shadow-2xs cursor-pointer"
                              title="Move stop to another day"
                            >
                              <span>🔄</span>
                              <span>Move</span>
                            </button>

                            {(entry.isOptional || entry.isCustom) && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (entry.isCustom) {
                                    handleRemoveCustomActivity(entry.activityId!);
                                  } else {
                                    toggleActivity(entry.activityId!);
                                  }
                                }}
                                className="h-7 w-7 rounded-lg border border-rose-200 text-xs font-bold text-rose-600 hover:bg-rose-50 transition-colors flex items-center justify-center cursor-pointer"
                                title="Remove stop"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // 2. LOCAL TRANSFER
                  if (entry.category === 'TRANSFER') {
                    const transferMins = Math.round(
                      (parseIST(entry.endTime) - parseIST(entry.startTime)) / 60000
                    );
                    const isAdjusted =
                      entry.activityId &&
                      currentInputs.transferAdjustments?.[entry.activityId] !== undefined;

                    return (
                      <div
                        key={entry.id}
                        className="rounded-xl border border-[#EADBCE] bg-[#FAF2EB]/60 p-3 text-xs transition-all shadow-2xs hover:border-[#C65B32]/30 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="text-base">🚗</span>
                          <div>
                            <div className="font-bold text-[#344F48] text-xs">
                              {entry.label}
                            </div>
                            <div className="text-[11px] text-[#6B7C77] mt-0.5 flex flex-wrap items-center gap-x-2">
                              <span>⏱️ <strong>{transferMins}m</strong> ({entry.startTime.slice(11)}–{entry.endTime.slice(11)} IST)</span>
                              <span>·</span>
                              <span className={isAdjusted ? 'text-[#C65B32] font-semibold' : 'text-[#6B7C77]'}>
                                {isAdjusted ? 'User planning allowance' : 'Corridor baseline estimate'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleOpenTransferModal(entry)}
                          className="rounded-lg border border-[#EADBCE] bg-white px-2.5 py-1 text-xs font-bold text-[#344F48] hover:bg-[#FAF2EB] transition-colors shrink-0 shadow-2xs cursor-pointer"
                          title="Review / Adjust local transfer allowance"
                        >
                          Review / Adjust
                        </button>
                      </div>
                    );
                  }

                  // 3. FREE TIME SLOT
                  if (entry.category === 'FREE') {
                    const freeMins = Math.round(
                      (parseIST(entry.endTime) - parseIST(entry.startTime)) / 60000
                    );
                    const isEvening = entry.startTime.slice(11) >= '18:15';

                    return (
                      <div
                        key={entry.id}
                        className="rounded-xl border-2 border-dashed border-[#5F7B6B]/40 bg-[#E4ECE5]/40 p-3.5 text-xs transition-all shadow-2xs hover:border-[#5F7B6B] flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="text-base">{isEvening ? '🌙' : '☀️'}</span>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-xs font-black text-[#344F48]">{entry.label}</h4>
                              <span className="rounded-md bg-[#E4ECE5] px-1.5 py-0.5 text-[10px] font-bold text-[#5F7B6B] uppercase tracking-wider">
                                {isEvening ? 'Evening Leisure' : 'Daytime Free Time'}
                              </span>
                            </div>
                            <div className="text-[11px] text-[#6B7C77] mt-0.5">
                              ⏰ <strong>{entry.startTime.slice(11)}–{entry.endTime.slice(11)}</strong> IST ({freeMins}m available)
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleOpenVisitEditorForFreeTime(entry)}
                          className="rounded-lg bg-[#5F7B6B] hover:bg-[#485E52] text-white px-3 py-1.5 text-xs font-bold transition-all shadow-2xs shrink-0 flex items-center gap-1 cursor-pointer"
                          title="Use available free time to schedule a visit"
                        >
                          <span>⚡</span>
                          <span>Use This Time</span>
                        </button>
                      </div>
                    );
                  }

                  // 4. REST SLOTS
                  if (entry.category === 'REST') {
                    if (entry.isRestBuffer) {
                      const bufferMins = Math.round(
                        (parseIST(entry.endTime) - parseIST(entry.startTime)) / 60000
                      );
                      return (
                        <div
                          key={entry.id}
                          className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-3 text-xs flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="text-base">🧘</span>
                            <div>
                              <strong className="text-indigo-950 font-bold">{entry.label}</strong>
                              <span className="block text-[11px] text-indigo-700">
                                {entry.startTime.slice(11)}–{entry.endTime.slice(11)} IST ({bufferMins}m reserved)
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveCustomActivity(entry.activityId!)}
                            className="h-6 w-6 rounded-md border border-rose-200 text-xs font-bold text-rose-600 hover:bg-rose-50 flex items-center justify-center cursor-pointer"
                            title="Remove buffer"
                          >
                            ✕
                          </button>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={entry.id}
                        className="rounded-xl border border-[#EADBCE] bg-[#FAF2EB] p-3 text-xs flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="text-base">🛌</span>
                          <div>
                            <strong className="text-[#344F48] font-bold">{entry.label}</strong>
                            <span className="block text-[11px] text-[#6B7C77]">
                              {entry.startTime.slice(11)}–{entry.endTime.slice(11)} IST (Night Anchor)
                            </span>
                          </div>
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-white text-[#344F48] border border-[#EADBCE]">
                          Overnight Stay
                        </span>
                      </div>
                    );
                  }

                  // 5. MILESTONE DRIVES, PITSTOPS & MEALS
                  return (
                    <div
                      key={entry.id}
                      className="rounded-xl border border-[#EADBCE] bg-white p-3 text-xs flex items-center justify-between text-[#344F48]"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-base">
                          {entry.category === 'DRIVE' ? '🛣️' : entry.category === 'PITSTOP' ? '☕' : '🍽️'}
                        </span>
                        <div>
                          <strong className="text-[#344F48] font-bold">{entry.label}</strong>
                          <span className="block text-[11px] text-[#6B7C77]">
                            {entry.startTime.slice(11)}–{entry.endTime.slice(11)} IST
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#FAF2EB] text-[#6B7C77]">
                        {entry.category}
                      </span>
                    </div>
                  );
                });
              })()}
            </div>
          )}

          {/* TAB 2: Add Place or Custom Spot View */}
          {activeTab === 'places' && (
            <div className="space-y-4 rounded-2xl border border-[#EADBCE] bg-white p-4 sm:p-5 shadow-sm">
              <div className="flex items-center justify-between border-b border-[#EADBCE] pb-2">
                <div>
                  <h3 className="text-sm font-black text-[#344F48]">Add Place to Day {currentActiveDay}</h3>
                  <p className="text-xs text-[#6B7C77]">
                    Add a custom spot or personal stop with duration and planning transfer allowance.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('schedule')}
                  className="text-xs font-bold text-[#6B7C77] hover:text-[#C65B32] cursor-pointer"
                >
                  ✕ Close
                </button>
              </div>

              <form onSubmit={handleAddCustomSpot} className="space-y-3.5 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-[#6B7C77] mb-1">Place / Activity Name</label>
                  <input
                    type="text"
                    value={customPlaceName}
                    onChange={e => setCustomPlaceName(e.target.value)}
                    placeholder="e.g. Local Silk Weaving Center / Cafe Stop"
                    required
                    className="w-full rounded-xl border border-[#EADBCE] bg-[#FAF2EB] p-2.5 text-xs text-[#344F48] focus:border-[#C65B32] focus:bg-white focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-[#6B7C77] mb-1">Category</label>
                    <select
                      value={customPlaceCategory}
                      onChange={e => setCustomPlaceCategory(e.target.value as any)}
                      className="w-full rounded-xl border border-[#EADBCE] bg-[#FAF2EB] p-2 text-xs text-[#344F48]"
                    >
                      <option value="sightseeing">Attraction / Culture</option>
                      <option value="food">Food & Beverage</option>
                      <option value="nature">Nature / Viewpoint</option>
                      <option value="relaxation">Rest & Relaxation</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[#6B7C77] mb-1">Visit Duration</label>
                    <select
                      value={customPlaceDuration}
                      onChange={e => setCustomPlaceDuration(Number(e.target.value))}
                      className="w-full rounded-xl border border-[#EADBCE] bg-[#FAF2EB] p-2 text-xs text-[#344F48]"
                    >
                      <option value={30}>30 minutes</option>
                      <option value={45}>45 minutes</option>
                      <option value={60}>60 minutes</option>
                      <option value={90}>90 minutes</option>
                      <option value={120}>2 hours</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[#6B7C77] mb-1">Transfer Allowance</label>
                    <select
                      value={customPlaceTransfer}
                      onChange={e => setCustomPlaceTransfer(Number(e.target.value))}
                      className="w-full rounded-xl border border-[#EADBCE] bg-[#FAF2EB] p-2 text-xs text-[#344F48]"
                    >
                      <option value={10}>+10 min transfer</option>
                      <option value={15}>+15 min transfer</option>
                      <option value={30}>+30 min transfer</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-[#EADBCE]">
                  <TactileButton
                    variant="secondary"
                    size="sm"
                    onClick={() => setActiveTab('schedule')}
                  >
                    Cancel
                  </TactileButton>
                  <TactileButton
                    variant="primary"
                    size="sm"
                    type="submit"
                  >
                    + Add to Day {currentActiveDay}
                  </TactileButton>
                </div>
              </form>
            </div>
          )}

          {/* PROGRESSIVE DISCLOSURE 1: Verified Highway Pitstops (Collapsible Drawer) */}
          <div className="rounded-2xl border border-[#EADBCE] bg-white overflow-hidden shadow-sm">
            <button
              type="button"
              onClick={() => setIsPitstopsOpen(!isPitstopsOpen)}
              className="w-full p-4 sm:p-5 flex items-center justify-between text-left hover:bg-[#FAF2EB]/40 transition-colors cursor-pointer"
              aria-expanded={isPitstopsOpen}
            >
              <div className="flex items-center gap-2.5">
                <span className="text-base">☕</span>
                <div>
                  <h3 className="text-sm font-black text-[#344F48]">
                    Verified Highway Pitstops ({filteredStops.length} Along Corridor)
                  </h3>
                  <p className="text-xs text-[#6B7C77]">
                    {selectedPitstopIds.length > 0
                      ? `${selectedPitstopIds.length} pitstop(s) selected for this trip`
                      : 'Curated highway rest stops with verified coordinates & dining'}
                  </p>
                </div>
              </div>

              <span className="rounded-xl border border-[#EADBCE] bg-[#FAF2EB] px-3 py-1 text-xs font-bold text-[#344F48] flex items-center gap-1">
                <span>{isPitstopsOpen ? 'Hide' : 'Explore'}</span>
                <span className={`text-[10px] transition-transform duration-200 ${isPitstopsOpen ? 'rotate-180' : ''}`}>▼</span>
              </span>
            </button>

            {isPitstopsOpen && (
              <div className="p-4 sm:p-5 pt-0 space-y-3 border-t border-[#EADBCE] animate-in fade-in duration-200">
                {/* Dietary Filter Pills */}
                <div className="flex items-center justify-between gap-2 pt-3">
                  <span className="text-xs font-bold text-[#6B7C77]">Dietary Preference:</span>
                  <div className="flex items-center gap-1 bg-[#FAF2EB] p-1 rounded-xl border border-[#EADBCE]">
                    {(['all', 'veg', 'non-veg'] as const).map(f => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setDietaryFilter(f)}
                        className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all cursor-pointer ${
                          dietaryFilter === f
                            ? 'bg-[#C65B32] text-white shadow-2xs'
                            : 'text-[#6B7C77] hover:text-[#344F48]'
                        }`}
                      >
                        {f === 'all' ? 'All Food' : f === 'veg' ? 'Pure Veg' : 'Non-Veg'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-2.5">
                  {filteredStops.map(stop => {
                    const isSelected = selectedPitstopIds.includes(stop.id);

                    return (
                      <div
                        key={stop.id}
                        className={`rounded-xl border p-3 text-xs transition-all flex items-center justify-between gap-3 ${
                          isSelected
                            ? 'border-[#C65B32] bg-[#FAF2EB] shadow-2xs'
                            : 'border-[#EADBCE] bg-white hover:border-[#C65B32]/30'
                        }`}
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <strong className="font-bold text-[#344F48]">{stop.name}</strong>
                            <span className="rounded bg-white border border-[#EADBCE] px-1.5 py-0.2 text-[10px] font-semibold text-[#6B7C77]">
                              {stop.categoryLabel}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#6B7C77]">
                            📍 {stop.location.address} · {stop.dwellMinutes}m dwell · {stop.dietary || 'Food & Rest'}
                          </p>
                        </div>

                        <TactileButton
                          variant={isSelected ? 'primary' : 'secondary'}
                          size="sm"
                          onClick={() => togglePitstop(stop.id)}
                          className="!px-3 !py-1 text-xs shrink-0"
                        >
                          {isSelected ? '✓ Added' : '+ Add Stop'}
                        </TactileButton>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* PROGRESSIVE DISCLOSURE 2: "What if the drive takes longer?" Scenario Adjustment (Collapsible Drawer) */}
          <div className="rounded-2xl border border-[#EADBCE] bg-white overflow-hidden shadow-sm">
            <button
              type="button"
              onClick={() => setIsDelayScenarioOpen(!isDelayScenarioOpen)}
              className="w-full p-4 sm:p-5 flex items-center justify-between text-left hover:bg-[#FAF2EB]/40 transition-colors cursor-pointer"
              aria-expanded={isDelayScenarioOpen}
            >
              <div className="flex items-center gap-2.5">
                <span className="text-base">⏱️</span>
                <div>
                  <h2 className="text-sm sm:text-base font-black text-[#344F48]">What if the drive takes longer?</h2>
                  <p className="text-xs text-[#6B7C77]">
                    {(currentInputs.drivingAdjustmentMinutes ?? 0) !== 0
                      ? `Active delay allowance: +${currentInputs.drivingAdjustmentMinutes}m extra`
                      : 'Test highway delay scenarios against your return deadline'}
                  </p>
                </div>
              </div>

              <span className="rounded-xl border border-[#EADBCE] bg-[#FAF2EB] px-3 py-1 text-xs font-bold text-[#344F48] flex items-center gap-1">
                <span>{isDelayScenarioOpen ? 'Hide' : 'Test Scenarios'}</span>
                <span className={`text-[10px] transition-transform duration-200 ${isDelayScenarioOpen ? 'rotate-180' : ''}`}>▼</span>
              </span>
            </button>

            {isDelayScenarioOpen && (
              <div className="p-4 sm:p-5 pt-0 space-y-3.5 border-t border-[#EADBCE] animate-in fade-in duration-200">
                <div className="flex flex-wrap items-center justify-between gap-1 pt-3">
                  <p className="text-xs text-[#6B7C77]">
                    Add extra travel time to see how it affects your itinerary and return deadline.
                  </p>
                  <span className="rounded-full bg-[#FAF2EB] border border-[#EADBCE] px-2.5 py-0.5 text-[10px] font-bold text-[#C65B32]">
                    Planning scenario · Not live GPS
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-[#344F48]">Extra travel allowance:</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setDrivingAdjustment((currentInputs.drivingAdjustmentMinutes ?? 0) - 15)}
                      disabled={(currentInputs.drivingAdjustmentMinutes ?? 0) <= -60}
                      className="h-7 w-7 rounded-lg bg-[#FAF2EB] border border-[#EADBCE] text-xs font-bold text-[#344F48] hover:bg-[#F8E1D2] disabled:opacity-30 cursor-pointer"
                    >
                      −15
                    </button>
                    <span className="min-w-12 text-center text-xs font-black text-[#C65B32]">
                      {(currentInputs.drivingAdjustmentMinutes ?? 0) > 0
                        ? `+${currentInputs.drivingAdjustmentMinutes}m`
                        : (currentInputs.drivingAdjustmentMinutes ?? 0) < 0
                        ? `${currentInputs.drivingAdjustmentMinutes}m`
                        : '0m'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setDrivingAdjustment((currentInputs.drivingAdjustmentMinutes ?? 0) + 15)}
                      disabled={(currentInputs.drivingAdjustmentMinutes ?? 0) >= 120}
                      className="h-7 w-7 rounded-lg bg-[#FAF2EB] border border-[#EADBCE] text-xs font-bold text-[#344F48] hover:bg-[#F8E1D2] disabled:opacity-30 cursor-pointer"
                    >
                      +15
                    </button>
                  </div>

                  {/* Quick Presets */}
                  <div className="flex items-center gap-1.5 ml-auto">
                    {([0, 30, 45, 60] as const).map(p => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setDrivingAdjustment(p)}
                        className={`rounded-lg px-2.5 py-1 text-[11px] font-bold cursor-pointer transition-colors ${
                          (currentInputs.drivingAdjustmentMinutes ?? 0) === p
                            ? 'bg-[#C65B32] text-white shadow-xs'
                            : 'bg-[#FAF2EB] border border-[#EADBCE] text-[#344F48] hover:bg-white'
                        }`}
                      >
                        {p === 0 ? 'Baseline' : `+${p}m`}
                      </button>
                    ))}
                  </div>
                </div>

                <p className="text-[11px] text-[#6B7C77] leading-relaxed">
                  Standard 20% highway traffic buffer (+{Math.round(dest.baselineOneWayDriveMinutes * 0.20)}m) is always active. Use these controls to stress-test your return margin against extra toll gate slowdowns or roadwork delays.
                </p>
              </div>
            )}
          </div>

          {/* Primary Footer Navigation CTA */}
          <div className="pt-2">
            <TactileButton
              variant="primary"
              size="lg"
              fullWidth
              onClick={goToReviewScreen}
              className="text-base font-black shadow-md"
            >
              Review Trip & Cost Sharing →
            </TactileButton>
          </div>
        </fieldset>

        {/* Right Column (5 of 12 cols): Sticky Connected Leaflet Map */}
        <div className="hidden lg:block col-span-5 sticky top-24 space-y-3 self-start">
          <div className="rounded-2xl sm:rounded-3xl border border-[#EADBCE] bg-white overflow-hidden shadow-sm">
            <TripMap
              destination={dest}
              inputs={currentInputs}
              result={r}
              onTogglePitstop={isGuestView ? undefined : togglePitstop}
            />
          </div>

          <div className="rounded-xl border border-[#EADBCE] bg-[#FAF2EB] p-3 text-[11px] text-[#6B7C77] space-y-1">
            <strong className="text-[#344F48] block">Interactive Map & Waypoint Routing</strong>
            <p>
              Shows verified OpenStreetMap corridor routing from MG Road, Bengaluru with stops and pitstops plotted at exact geographic coordinates.
            </p>
          </div>
        </div>
      </div>

      {/* ===================== MODALS ===================== */}

      {/* 1. MOVE ACTIVITY MODAL ("Make This Trip Fit") */}
      {!isGuestView && isMoveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl rounded-2xl sm:rounded-3xl bg-white p-5 sm:p-6 shadow-2xl border border-[#EADBCE] space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-[#EADBCE] pb-3">
              <div>
                <span className="text-[10px] font-bold text-[#C65B32] uppercase tracking-wider">
                  Make This Trip Fit · Schedule Adjustment
                </span>
                <h3 className="text-lg sm:text-xl font-black text-[#344F48]">Move an Activity Between Days</h3>
                <p className="text-xs text-[#6B7C77] mt-0.5">
                  Simulate proposed activity insertion against opening hours, transfers, and your return deadline.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsMoveModalOpen(false)}
                className="h-8 w-8 rounded-full bg-[#FAF2EB] text-[#344F48] hover:bg-[#F8E1D2] font-black text-sm flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Activity Selection */}
              <div>
                <label className="block text-[11px] font-bold text-[#6B7C77] mb-1.5 uppercase tracking-wider">
                  1. Choose Activity to Move
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {moveCandidates.map(cand => (
                    <button
                      key={cand.activityId}
                      type="button"
                      onClick={() => setSelectedMoveActivityId(cand.activityId)}
                      className={`rounded-xl border p-3 text-left transition-all cursor-pointer ${
                        selectedMoveActivityId === cand.activityId
                          ? 'border-[#C65B32] bg-[#FAF2EB] ring-1 ring-[#C65B32]'
                          : 'border-[#EADBCE] bg-white hover:bg-[#FAF2EB]/60'
                      }`}
                    >
                      <strong className="font-bold text-[#344F48] block">{cand.name}</strong>
                      <span className="text-[11px] text-[#6B7C77] block mt-0.5">
                        Currently: Day {cand.currentDay} ({cand.durationMinutes}m duration)
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Target Day Selection */}
              <div>
                <label className="block text-[11px] font-bold text-[#6B7C77] mb-1.5 uppercase tracking-wider">
                  2. Target Day
                </label>
                <div className="flex gap-2">
                  {availableDays.map(dNum => (
                    <button
                      key={dNum}
                      type="button"
                      onClick={() => {
                        setMoveTargetDay(dNum);
                        setMoveTargetPosition(0);
                      }}
                      className={`flex-1 rounded-xl py-2 px-3 text-xs font-bold cursor-pointer transition-all ${
                        moveTargetDay === dNum
                          ? 'bg-[#C65B32] text-white shadow-xs'
                          : 'bg-[#FAF2EB] text-[#6B7C77] border border-[#EADBCE] hover:text-[#344F48]'
                      }`}
                    >
                      Day {dNum}
                    </button>
                  ))}
                </div>
              </div>

              {/* Insertion Position */}
              <div>
                <label className="block text-[11px] font-bold text-[#6B7C77] mb-1.5 uppercase tracking-wider">
                  3. Insertion Position in Day {moveTargetDay}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {insertionSlots.map(slot => (
                    <button
                      key={slot.position}
                      type="button"
                      onClick={() => setMoveTargetPosition(slot.position)}
                      className={`rounded-xl border p-2.5 text-center text-xs font-bold transition-all cursor-pointer ${
                        moveTargetPosition === slot.position
                          ? 'border-[#C65B32] bg-[#FAF2EB] text-[#C65B32] ring-1 ring-[#C65B32]'
                          : 'border-[#EADBCE] bg-white text-[#6B7C77] hover:bg-[#FAF2EB]'
                      }`}
                    >
                      {slot.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Live Before / After Preview */}
              {movePreview && (
                <div className="rounded-xl border border-[#EADBCE] bg-[#FAF2EB] p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#344F48]">Engine Feasibility Verdict:</span>
                    <span
                      className={`rounded-md px-2 py-0.5 text-[11px] font-black ${
                        movePreview.isValid
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {movePreview.resolutionLabel}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="bg-white p-2.5 rounded-lg border border-[#EADBCE]">
                      <span className="text-[#6B7C77] block text-[10px]">Previous Home Arrival:</span>
                      <strong>{movePreview.before.homeArrival}</strong>
                      <span className="text-[#6B7C77] block mt-0.5">
                        Margin: {movePreview.before.returnMarginMinutes >= 0 ? '+' : ''}{movePreview.before.returnMarginMinutes}m
                      </span>
                    </div>

                    <div className="bg-white p-2.5 rounded-lg border border-[#EADBCE]">
                      <span className="text-[#6B7C77] block text-[10px]">Proposed Home Arrival:</span>
                      <strong>{movePreview.after.homeArrival}</strong>
                      <span className="text-[#C65B32] block mt-0.5 font-bold">
                        Margin: {movePreview.after.returnMarginMinutes >= 0 ? '+' : ''}{movePreview.after.returnMarginMinutes}m
                      </span>
                    </div>
                  </div>

                  {(movePreview.validationError || movePreview.deltas.newConflicts.length > 0) && (
                    <div className="rounded-lg bg-red-50 border border-red-200 p-2 text-[11px] text-red-800 space-y-0.5">
                      {movePreview.validationError && <div>• {movePreview.validationError}</div>}
                      {movePreview.deltas.newConflicts.map((c, idx) => (
                        <div key={idx}>• {c}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#EADBCE]">
              <TactileButton
                variant="secondary"
                size="sm"
                onClick={() => setIsMoveModalOpen(false)}
              >
                Cancel
              </TactileButton>
              <TactileButton
                variant="primary"
                size="sm"
                disabled={!movePreview || !movePreview.isValid}
                onClick={handleConfirmMove}
              >
                Confirm & Apply Move →
              </TactileButton>
            </div>
          </div>
        </div>
      )}

      {/* 2. VISIT SCHEDULING MODAL ("Use This Time") */}
      {!isGuestView && isVisitEditorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-2xl sm:rounded-3xl bg-white p-5 sm:p-6 shadow-2xl border border-[#EADBCE] space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-[#EADBCE] pb-3">
              <div>
                <span className="text-[10px] font-bold text-[#5F7B6B] uppercase tracking-wider">
                  {editorMode === 'edit_visit' ? 'Edit Scheduled Stop' : 'Use Free Time Window'}
                </span>
                <h3 className="text-lg sm:text-xl font-black text-[#344F48]">
                  {editorMode === 'edit_visit' ? 'Adjust Stop Timing' : 'Schedule Activity or Buffer'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsVisitEditorOpen(false)}
                className="h-8 w-8 rounded-full bg-[#FAF2EB] text-[#344F48] hover:bg-[#F8E1D2] font-black text-sm flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              {/* Free Window Info */}
              {selectedFreeWindowInfo && (
                <div className="rounded-xl bg-[#FAF2EB] p-3 border border-[#EADBCE] text-[11px] text-[#344F48] flex justify-between items-center">
                  <span>Selected Free Window:</span>
                  <strong>{selectedFreeWindowInfo.start}–{selectedFreeWindowInfo.end} IST ({selectedFreeWindowInfo.mins}m available)</strong>
                </div>
              )}

              {/* Activity Type Selector */}
              <div>
                <label className="block text-[11px] font-bold text-[#6B7C77] mb-1">Type</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditorActivityType('custom')}
                    className={`rounded-xl py-2 px-2 text-center font-bold text-xs cursor-pointer ${
                      editorActivityType === 'custom'
                        ? 'bg-[#C65B32] text-white shadow-2xs'
                        : 'bg-[#FAF2EB] text-[#6B7C77] border border-[#EADBCE]'
                    }`}
                  >
                    Custom Spot
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditorActivityType('curated')}
                    className={`rounded-xl py-2 px-2 text-center font-bold text-xs cursor-pointer ${
                      editorActivityType === 'curated'
                        ? 'bg-[#C65B32] text-white shadow-2xs'
                        : 'bg-[#FAF2EB] text-[#6B7C77] border border-[#EADBCE]'
                    }`}
                  >
                    Curated Spot
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditorActivityType('buffer')}
                    className={`rounded-xl py-2 px-2 text-center font-bold text-xs cursor-pointer ${
                      editorActivityType === 'buffer'
                        ? 'bg-[#C65B32] text-white shadow-2xs'
                        : 'bg-[#FAF2EB] text-[#6B7C77] border border-[#EADBCE]'
                    }`}
                  >
                    Rest Buffer
                  </button>
                </div>
              </div>

              {/* Name or Selection */}
              {editorActivityType === 'curated' ? (
                <div>
                  <label className="block text-[11px] font-bold text-[#6B7C77] mb-1">Select Curated Stop</label>
                  <select
                    value={editorActivityId}
                    onChange={e => setEditorActivityId(e.target.value)}
                    className="w-full rounded-xl border border-[#EADBCE] bg-[#FAF2EB] p-2 text-xs text-[#344F48]"
                  >
                    {dest.activities.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.openTime}–{a.closeTime})
                      </option>
                    ))}
                  </select>
                </div>
              ) : editorActivityType === 'custom' ? (
                <div>
                  <label className="block text-[11px] font-bold text-[#6B7C77] mb-1">Place Name</label>
                  <input
                    type="text"
                    value={editorName}
                    onChange={e => setEditorName(e.target.value)}
                    placeholder="e.g. Silk Saree Emporium / Tea Tasting"
                    className="w-full rounded-xl border border-[#EADBCE] bg-[#FAF2EB] p-2 text-xs text-[#344F48] focus:border-[#C65B32] focus:bg-white focus:outline-none"
                  />
                </div>
              ) : null}

              {/* Start Time & Duration */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[#6B7C77] mb-1">Visit Start Time (IST)</label>
                  <input
                    type="time"
                    value={editorVisitStartTime}
                    onChange={e => setEditorVisitStartTime(e.target.value)}
                    className="w-full rounded-xl border border-[#EADBCE] bg-[#FAF2EB] p-2 text-xs text-[#344F48] font-bold focus:border-[#C65B32] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#6B7C77] mb-1">Visit Duration (Minutes)</label>
                  <select
                    value={editorDurationMinutes}
                    onChange={e => setEditorDurationMinutes(Number(e.target.value))}
                    className="w-full rounded-xl border border-[#EADBCE] bg-[#FAF2EB] p-2 text-xs text-[#344F48] font-bold"
                  >
                    <option value={30}>30 minutes</option>
                    <option value={45}>45 minutes</option>
                    <option value={60}>60 minutes</option>
                    <option value={90}>90 minutes</option>
                    <option value={120}>2 hours</option>
                  </select>
                </div>
              </div>

              {/* Transfer Planning Allowance */}
              {editorActivityType !== 'buffer' && (
                <div>
                  <label className="block text-[11px] font-bold text-[#6B7C77] mb-1">Transfer Planning Allowance</label>
                  <select
                    value={editorTransferMinutes}
                    onChange={e => setEditorTransferMinutes(Number(e.target.value))}
                    className="w-full rounded-xl border border-[#EADBCE] bg-[#FAF2EB] p-2 text-xs text-[#344F48]"
                  >
                    <option value={10}>10 minutes</option>
                    <option value={15}>15 minutes (Standard)</option>
                    <option value={20}>20 minutes</option>
                    <option value={30}>30 minutes</option>
                  </select>
                </div>
              )}

              {/* Feasibility Simulation Preview */}
              {visitSchedulingPreview && (
                <div className="rounded-xl border border-[#EADBCE] bg-[#FAF2EB] p-3 space-y-1.5 text-[11px]">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-[#344F48]">Engine Feasibility:</span>
                    <span
                      className={`rounded px-1.5 py-0.2 font-black ${
                        visitSchedulingPreview.isValid
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {visitSchedulingPreview.isValid ? 'Fits Schedule' : 'Schedule Conflict'}
                    </span>
                  </div>
                  <div className="flex justify-between text-[#6B7C77]">
                    <span>Proposed Return Margin:</span>
                    <strong className="text-[#344F48]">
                      {visitSchedulingPreview.after.returnMarginMinutes >= 0 ? '+' : ''}{visitSchedulingPreview.after.returnMarginMinutes}m
                    </strong>
                  </div>
                  {visitSchedulingPreview.validationError && (
                    <div className="text-red-700 font-medium">
                      • {visitSchedulingPreview.validationError}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#EADBCE]">
              <TactileButton
                variant="secondary"
                size="sm"
                onClick={() => setIsVisitEditorOpen(false)}
              >
                Cancel
              </TactileButton>
              <TactileButton
                variant="primary"
                size="sm"
                disabled={!visitSchedulingPreview || !visitSchedulingPreview.isValid}
                onClick={handleConfirmVisitScheduling}
              >
                Confirm & Apply →
              </TactileButton>
            </div>
          </div>
        </div>
      )}

      {/* 3. LOCAL TRANSFER ADJUSTMENT MODAL */}
      {!isGuestView && isTransferModalOpen && selectedTransferEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-2xl sm:rounded-3xl bg-white p-5 sm:p-6 shadow-2xl border border-[#EADBCE] space-y-4">
            <div className="flex items-start justify-between border-b border-[#EADBCE] pb-3">
              <div>
                <span className="text-[10px] font-bold text-[#C65B32] uppercase tracking-wider">
                  Transfer Planning Allowance
                </span>
                <h3 className="text-lg font-black text-[#344F48]">Review & Adjust Transfer</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsTransferModalOpen(false)}
                className="h-8 w-8 rounded-full bg-[#FAF2EB] text-[#344F48] hover:bg-[#F8E1D2] font-black text-sm flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="rounded-xl bg-[#FAF2EB] p-3 border border-[#EADBCE]">
                <strong className="block text-[#344F48]">{selectedTransferEntry.label}</strong>
                <span className="text-[11px] text-[#6B7C77]">
                  Baseline time: {transferDetails?.currentDurationMinutes ?? 30}m ({selectedTransferEntry.startTime.slice(11)}–{selectedTransferEntry.endTime.slice(11)} IST)
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#6B7C77] mb-1">
                  Custom Planning Allowance (Minutes)
                </label>
                <div className="flex items-center gap-2">
                  {[15, 20, 30, 45, 60].map(mins => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => setTransferMinutesInput(mins)}
                      className={`flex-1 rounded-xl py-2 text-xs font-bold transition-all cursor-pointer ${
                        transferMinutesInput === mins
                          ? 'bg-[#C65B32] text-white shadow-2xs'
                          : 'bg-[#FAF2EB] text-[#6B7C77] border border-[#EADBCE]'
                      }`}
                    >
                      {mins}m
                    </button>
                  ))}
                </div>
              </div>

              {transferPreview && (
                <div className="rounded-xl border border-[#EADBCE] bg-[#FAF2EB] p-3 text-[11px] flex justify-between items-center">
                  <span>Simulated Return Margin:</span>
                  <strong className="text-[#344F48]">
                    {transferPreview.after.returnMarginMinutes >= 0 ? '+' : ''}{transferPreview.after.returnMarginMinutes}m
                  </strong>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#EADBCE]">
              <TactileButton
                variant="secondary"
                size="sm"
                onClick={() => setIsTransferModalOpen(false)}
              >
                Cancel
              </TactileButton>
              <TactileButton
                variant="primary"
                size="sm"
                disabled={!transferPreview || !transferPreview.isValid}
                onClick={handleConfirmTransferAdjustment}
              >
                Apply Allowance →
              </TactileButton>
            </div>
          </div>
        </div>
      )}

      {/* Destination Guide Modal */}
      <DestinationGuideModal
        guide={activeGuideId ? getDestinationGuide(activeGuideId, availableDays.length, currentInputs.pace) : null}
        onClose={() => setActiveGuideId(null)}
      />
    </section>
  );
}
