import { useState, useEffect, useCallback, useRef } from 'react';
import TactileButton from './ui/TactileButton';

export interface StageInfo {
  id: number;
  title: string;
  shortLabel: string;
  tagline: string;
  description: string;
}

const STAGES: StageInfo[] = [
  {
    id: 1,
    title: 'Set Your Trip Envelope',
    shortLabel: '1. Set Limits',
    tagline: 'Define your firm weekend boundaries',
    description:
      'Input departure time and hard return deadline in Indian Standard Time (IST). Specify party size and budget cap—no account, login, or tracking required.',
  },
  {
    id: 2,
    title: 'Compare Escapes Side-by-Side',
    shortLabel: '2. Compare Escapes',
    tagline: 'Grounded by usable daylight, not just distance',
    description:
      'Navigation apps show best-case travel times. @48 models actual highway corridor speeds, mandatory 20% contingency buffers, and daylight sightseeing hours.',
  },
  {
    id: 3,
    title: 'Customize Itinerary in Real Time',
    shortLabel: '3. Customize Stops',
    tagline: 'Adjust visit start times, durations, or days',
    description:
      'Add curated pitstops, change attraction visit hours, or move activities between days. Every tweak deterministically recalculates downstream transfers and free time.',
  },
  {
    id: 4,
    title: 'Verify Return Feasibility',
    shortLabel: '4. Check Return',
    tagline: 'Know your home arrival margin before departure',
    description:
      'Get a deterministic feasibility verdict with exact return margin in minutes, highway curfew validation (e.g. Bandipur 21:00), and zero fabricated estimates.',
  },
];

const STAGE_DURATION_MS = 5000;

export default function HowItWorksAnimation() {
  const [activeStage, setActiveStage] = useState(1);
  const [isPlaying, setIsPlaying] = useState(true);
  const [progress, setProgress] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const animRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(Date.now());

  // Check system prefers-reduced-motion
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      setPrefersReducedMotion(mediaQuery.matches);
      const listener = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    }
  }, []);

  // Timer loop for auto-advancing stages
  const nextStage = useCallback(() => {
    setActiveStage(current => (current >= 4 ? 1 : current + 1));
    setProgress(0);
  }, []);

  useEffect(() => {
    if (!isPlaying || prefersReducedMotion) {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      return;
    }

    lastTickRef.current = Date.now();
    const tick = () => {
      const now = Date.now();
      const delta = now - lastTickRef.current;
      lastTickRef.current = now;

      setProgress(prev => {
        const next = prev + (delta / STAGE_DURATION_MS) * 100;
        if (next >= 100) {
          nextStage();
          return 0;
        }
        return next;
      });

      animRef.current = requestAnimationFrame(tick);
    };

    animRef.current = requestAnimationFrame(tick);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [isPlaying, nextStage, prefersReducedMotion]);

  const selectStage = (stageId: number) => {
    setActiveStage(stageId);
    setProgress(0);
  };

  const handleTogglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  const handleReplay = () => {
    setActiveStage(1);
    setProgress(0);
    setIsPlaying(true);
  };

  const currentStage = STAGES[activeStage - 1];

  return (
    <div
      className="overflow-hidden rounded-3xl border border-[#EADBCE] bg-white text-[#344F48] shadow-sm transition-all"
      aria-label="How @48 Works Explainer Animation"
    >
      {/* Top Header & Stage Navigation */}
      <div className="border-b border-[#EADBCE] bg-[#FAF2EB] p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-[#F8E1D2] px-3 py-1 text-xs font-black tracking-wider text-[#C65B32] uppercase">
              <span className="h-2 w-2 rounded-full bg-[#C65B32] animate-ping" />
              Interactive Engine Explainer
            </div>
            <h3 className="mt-2 text-xl sm:text-2xl font-black tracking-tight text-[#344F48]">
              How @48 Works in 4 Steps
            </h3>
            <p className="mt-0.5 text-xs sm:text-sm text-[#6B7C77]">
              No optimistic guestimates. A deterministic engine built for Bengaluru road trips.
            </p>
          </div>

          {/* Controls: Play/Pause & Replay */}
          <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
            <TactileButton
              variant="secondary"
              size="sm"
              onClick={handleTogglePlay}
              aria-label={isPlaying ? 'Pause animation' : 'Play animation'}
              title={isPlaying ? 'Pause animation' : 'Play animation'}
            >
              {isPlaying ? (
                <span className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                    <rect x="6" y="4" width="4" height="16" rx="1" />
                    <rect x="14" y="4" width="4" height="16" rx="1" />
                  </svg>
                  <span>Pause</span>
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  <span>Play</span>
                </span>
              )}
            </TactileButton>

            <TactileButton
              variant="ghost"
              size="sm"
              onClick={handleReplay}
              aria-label="Replay animation from start"
              title="Replay from step 1"
            >
              <svg className="w-3.5 h-3.5 stroke-current fill-none stroke-2" viewBox="0 0 24 24">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
              </svg>
              <span>Replay</span>
            </TactileButton>
          </div>
        </div>

        {/* Stage Selector Pills */}
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-2">
          {STAGES.map(s => {
            const isCurrent = s.id === activeStage;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => selectStage(s.id)}
                className={`group relative overflow-hidden rounded-xl border p-2.5 text-left transition-all cursor-pointer ${
                  isCurrent
                    ? 'border-[#C65B32] bg-white shadow-xs'
                    : 'border-[#EADBCE] bg-white/70 hover:bg-white hover:border-[#D1BFB0]'
                }`}
                aria-pressed={isCurrent}
              >
                {/* Progress bar inside active pill */}
                {isCurrent && !prefersReducedMotion && (
                  <div
                    className="absolute top-0 left-0 bottom-0 bg-[#F8E1D2]/80 -z-0 transition-all ease-linear"
                    style={{ width: `${progress}%` }}
                  />
                )}
                <div className="relative z-10 flex items-center justify-between">
                  <span
                    className={`text-[11px] font-black tracking-wide uppercase ${
                      isCurrent ? 'text-[#C65B32]' : 'text-[#6B7C77]'
                    }`}
                  >
                    Step {s.id}
                  </span>
                  {isCurrent && (
                    <span className="h-1.5 w-1.5 rounded-full bg-[#C65B32]" />
                  )}
                </div>
                <div
                  className={`relative z-10 mt-0.5 text-xs font-bold truncate ${
                    isCurrent ? 'text-[#344F48]' : 'text-[#6B7C77]'
                  }`}
                >
                  {s.title.replace('Your ', '').replace(' Side-by-Side', '')}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Interactive Stage Display Area */}
      <div className="grid md:grid-cols-12 gap-6 p-6 sm:p-8 items-center min-h-[360px]">
        {/* Left Side: Stage Text & Key Highlights */}
        <div className="md:col-span-5 space-y-4">
          <div className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-[#C65B32]">
            <span>Step {currentStage.id} of 4</span>
            <span>·</span>
            <span>{currentStage.tagline}</span>
          </div>

          <h4 className="text-2xl sm:text-3xl font-black text-[#344F48] leading-tight">
            {currentStage.title}
          </h4>

          <p className="text-sm text-[#6B7C77] leading-relaxed">
            {currentStage.description}
          </p>

          <div className="pt-2 flex items-center gap-3">
            <TactileButton
              variant="primary"
              size="sm"
              to="/plan"
            >
              Plan Your Limits →
            </TactileButton>

            <span className="text-[11px] text-[#6B7C77] font-medium">
              Deterministic calculations
            </span>
          </div>
        </div>

        {/* Right Side: Animated 2D Vector Visuals */}
        <div className="md:col-span-7 flex justify-center">
          <div className="w-full max-w-md rounded-2xl border border-[#EADBCE] bg-[#FAF2EB] p-5 shadow-inner">
            {activeStage === 1 && <Stage1Graphic prefersReducedMotion={prefersReducedMotion} />}
            {activeStage === 2 && <Stage2Graphic />}
            {activeStage === 3 && <Stage3Graphic />}
            {activeStage === 4 && <Stage4Graphic />}
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   STAGE 1 GRAPHIC: Set Limits (Envelope, Dates, Clock, Budget)
   ========================================================================= */
function Stage1Graphic({ prefersReducedMotion }: { prefersReducedMotion: boolean }) {
  return (
    <div className="space-y-3 font-sans">
      <div className="flex items-center justify-between pb-2 border-b border-[#EADBCE]">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-[#C65B32] text-white flex items-center justify-center font-bold text-xs shadow-xs">
            IST
          </div>
          <span className="text-xs font-bold text-[#344F48]">Weekend Time Envelope</span>
        </div>
        <span className="rounded bg-[#F8E1D2] px-2 py-0.5 text-[10px] font-extrabold text-[#C65B32]">
          36h 30m Total
        </span>
      </div>

      {/* Date & Time Badges */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-xl bg-white p-3 border border-[#EADBCE] shadow-xs">
          <span className="text-[10px] font-black uppercase text-[#6B7C77] block">Departure</span>
          <span className="text-sm font-black text-[#344F48] block mt-0.5">Sat, 08:00 AM</span>
          <span className="text-[10px] text-[#C65B32] font-bold">Indiranagar, BLR</span>
        </div>
        <div className="rounded-xl bg-white p-3 border border-[#EADBCE] shadow-xs">
          <span className="text-[10px] font-black uppercase text-[#6B7C77] block">Firm Deadline</span>
          <span className="text-sm font-black text-[#344F48] block mt-0.5">Sun, 08:30 PM</span>
          <span className="text-[10px] text-[#5F7B6B] font-bold">Home Arrival</span>
        </div>
      </div>

      {/* Constraints Bar with animated tick */}
      <div className="rounded-xl bg-white p-3 border border-[#EADBCE] space-y-2">
        <div className="flex justify-between text-[11px] font-bold text-[#6B7C77]">
          <span>Party: 4 travelers (1 car)</span>
          <span className="text-[#3D694E] font-bold">₹6,000 / person cap</span>
        </div>
        <div className="h-2 w-full bg-[#EADBCE] rounded-full overflow-hidden relative">
          <div
            className={`h-full bg-[#C65B32] rounded-full ${
              prefersReducedMotion ? 'w-3/4' : 'w-3/4 transition-all duration-1000'
            }`}
          />
        </div>
        <div className="flex justify-between text-[10px] text-[#6B7C77]">
          <span>✓ Zero login required</span>
          <span>✓ No cookies or tracking</span>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   STAGE 2 GRAPHIC: Compare Destinations (Distance vs Usable Daylight)
   ========================================================================= */
function Stage2Graphic() {
  return (
    <div className="space-y-3 font-sans">
      <div className="flex items-center justify-between pb-2 border-b border-[#EADBCE]">
        <span className="text-xs font-bold text-[#344F48]">Corridors Compared</span>
        <span className="text-[10px] font-extrabold text-[#3D694E] bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
          +20% Traffic Buffer Included
        </span>
      </div>

      {/* Corridor 1: Mysuru */}
      <div className="rounded-xl bg-white p-3 border border-[#EADBCE] shadow-xs space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black text-[#344F48]">Mysuru Heritage Corridor</span>
          <span className="rounded bg-emerald-100 text-emerald-800 text-[10px] font-black px-1.5 py-0.5">
            Comfortable
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
          <div className="rounded bg-[#FFF7F0] p-1.5 border border-[#EADBCE]">
            <span className="text-[#6B7C77] block font-bold">Drive (1-Way)</span>
            <span className="text-xs font-black text-[#344F48]">3h 15m</span>
          </div>
          <div className="rounded bg-[#FFF7F0] p-1.5 border border-[#EADBCE]">
            <span className="text-[#6B7C77] block font-bold">Daylight Usable</span>
            <span className="text-xs font-black text-[#C65B32]">6h 45m</span>
          </div>
          <div className="rounded bg-[#FFF7F0] p-1.5 border border-[#EADBCE]">
            <span className="text-[#6B7C77] block font-bold">Return Buffer</span>
            <span className="text-xs font-black text-[#3D694E]">+2h 10m</span>
          </div>
        </div>
      </div>

      {/* Corridor 2: Coorg */}
      <div className="rounded-xl bg-white p-3 border border-[#EADBCE] shadow-xs space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black text-[#344F48]">Coorg Madikeri Highlands</span>
          <span className="rounded bg-amber-100 text-amber-800 text-[10px] font-black px-1.5 py-0.5">
            Tight Margin
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
          <div className="rounded bg-[#FFF7F0] p-1.5 border border-[#EADBCE]">
            <span className="text-[#6B7C77] block font-bold">Drive (1-Way)</span>
            <span className="text-xs font-black text-[#344F48]">5h 45m</span>
          </div>
          <div className="rounded bg-[#FFF7F0] p-1.5 border border-[#EADBCE]">
            <span className="text-[#6B7C77] block font-bold">Daylight Usable</span>
            <span className="text-xs font-black text-[#C65B32]">4h 15m</span>
          </div>
          <div className="rounded bg-[#FFF7F0] p-1.5 border border-[#EADBCE]">
            <span className="text-[#6B7C77] block font-bold">Return Buffer</span>
            <span className="text-xs font-black text-[#D97706]">+45m</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   STAGE 3 GRAPHIC: Customize Stops (Timeline Drag/Edit, Free Time)
   ========================================================================= */
function Stage3Graphic() {
  return (
    <div className="space-y-3 font-sans">
      <div className="flex items-center justify-between pb-2 border-b border-[#EADBCE]">
        <span className="text-xs font-bold text-[#344F48]">Interactive Timeline Editor</span>
        <span className="text-[10px] font-bold text-[#C65B32] bg-[#F8E1D2] px-2 py-0.5 rounded">
          Day 1 Itinerary
        </span>
      </div>

      {/* Timeline items */}
      <div className="space-y-1.5 text-xs">
        {/* Drive block */}
        <div className="flex items-center gap-2 rounded-lg bg-white p-2 border border-[#EADBCE]">
          <span className="w-16 font-mono text-[10px] font-bold text-[#6B7C77]">08:00–11:30</span>
          <span className="h-2 w-2 rounded-full bg-[#C65B32]" />
          <span className="font-bold text-[#344F48]">Bengaluru → Mysuru Expressway</span>
        </div>

        {/* Palace visit */}
        <div className="flex items-center gap-2 rounded-lg bg-white p-2 border border-[#EADBCE]">
          <span className="w-16 font-mono text-[10px] font-bold text-[#6B7C77]">14:30–16:30</span>
          <span className="h-2 w-2 rounded-full bg-[#5F7B6B]" />
          <div className="flex-1 flex items-center justify-between">
            <span className="font-bold text-[#344F48]">Mysore Palace Visit</span>
            <span className="text-[10px] font-bold text-[#3D694E] bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
              Edited (2h)
            </span>
          </div>
        </div>

        {/* Free Window with "Use This Time" button */}
        <div className="rounded-xl border border-dashed border-[#C65B32] bg-[#F8E1D2]/30 p-2.5">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-black uppercase text-[#C65B32] block">
                Free Time Window
              </span>
              <span className="text-xs font-black text-[#344F48]">16:30–19:00 (2h 30m)</span>
            </div>
            <span className="rounded-lg bg-[#C65B32] text-white px-2.5 py-1 text-[10px] font-bold shadow-xs">
              + Add Place / Buffer
            </span>
          </div>
        </div>
      </div>

      <div className="text-[10px] text-[#6B7C77] text-center">
        Every tweak updates downstream arrival times deterministically.
      </div>
    </div>
  );
}

/* =========================================================================
   STAGE 4 GRAPHIC: Return Feasibility & Checkpoint Verification
   ========================================================================= */
function Stage4Graphic() {
  return (
    <div className="space-y-3 font-sans">
      <div className="flex items-center justify-between pb-2 border-b border-[#EADBCE]">
        <span className="text-xs font-bold text-[#344F48]">Deterministic Feasibility Gate</span>
        <span className="rounded bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[10px] font-black">
          VERIFIED SAFE
        </span>
      </div>

      {/* Main Verdict Card */}
      <div className="rounded-2xl bg-white p-4 border border-[#EADBCE] shadow-xs text-center space-y-2">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-black text-[#3D694E]">
          <span>✓</span>
          <span>Trip Feasible & Within Bounds</span>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-1">
          <div className="rounded-xl bg-[#FFF7F0] p-2.5 border border-[#EADBCE]">
            <span className="text-[10px] font-bold text-[#6B7C77] block">Projected Home</span>
            <span className="text-base font-black text-[#344F48]">19:45 IST</span>
            <span className="text-[10px] text-[#3D694E] font-bold">Before 20:30 cut-off</span>
          </div>
          <div className="rounded-xl bg-[#FFF7F0] p-2.5 border border-[#EADBCE]">
            <span className="text-[10px] font-bold text-[#6B7C77] block">Safety Margin</span>
            <span className="text-base font-black text-[#3D694E]">+45 Minutes</span>
            <span className="text-[10px] text-[#6B7C77]">Spare buffer</span>
          </div>
        </div>
      </div>

      {/* Checkpoint Curfew Check */}
      <div className="rounded-xl bg-white p-2.5 border border-[#EADBCE] flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="text-sm">🛡️</span>
          <div>
            <span className="font-bold text-[#344F48] block text-[11px]">Highway Night Curfew Check</span>
            <span className="text-[10px] text-[#6B7C77]">Bandipur NH 766 (Closed 21:00–06:00)</span>
          </div>
        </div>
        <span className="text-[10px] font-black text-[#3D694E]">PASSED (17:40 ETA)</span>
      </div>
    </div>
  );
}
