import { useState } from 'react';

/**
 * Compact, expandable trust note "How @48 plans your trip"
 * Warm, elegant palette, transparent assumptions.
 */
export default function TrustNote() {
  const [expanded, setExpanded] = useState(false);

  return (
    <section className="rounded-2xl border border-[#EADBCE] bg-[#FAF2EB] p-4 sm:p-5 text-xs text-[#344F48] transition-all">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg bg-[#F8E1D2] text-[#C65B32] text-xs">
            🛡️
          </span>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#344F48]">
              How @48 plans your trip
            </h3>
            <p className="mt-1 text-xs text-[#6B7C77] leading-relaxed">
              We calculate road trips using real highway distances from Bengaluru with mandatory weekend contingency traffic buffers (+20%). Operating hours, daylight windows, and rest stops are verified against local regulations. Feasibility scores are deterministic — computed mathematically from your chosen dates and times, not guessed by AI.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setExpanded(prev => !prev)}
          className="flex-shrink-0 rounded-lg border border-[#EADBCE] bg-white px-2.5 py-1 text-[11px] font-bold text-[#C65B32] hover:bg-[#FFF7F0] transition-colors cursor-pointer"
        >
          {expanded ? 'Hide Details ▲' : 'Learn More ▼'}
        </button>
      </div>

      {expanded && (
        <div className="mt-4 pt-3.5 border-t border-[#EADBCE] grid sm:grid-cols-2 gap-3 text-xs animate-fadeIn">
          <div className="rounded-xl border border-[#EADBCE] bg-white p-3 space-y-1">
            <strong className="block text-[#344F48] text-[11px] uppercase tracking-wider font-bold">
              📍 Departure Hub Baseline
            </strong>
            <p className="text-[#6B7C77] leading-relaxed text-[11px]">
              Calculated from Central Bengaluru (MG Road baseline) with corridor adjustments for Whitefield, Hebbal, Indiranagar, and Electronic City.
            </p>
          </div>

          <div className="rounded-xl border border-[#EADBCE] bg-white p-3 space-y-1">
            <strong className="block text-[#344F48] text-[11px] uppercase tracking-wider font-bold">
              ⏱️ Traffic Buffer Model (+20%)
            </strong>
            <p className="text-[#6B7C77] leading-relaxed text-[11px]">
              Applies a conservative +20% weekend highway contingency buffer to absorb city crawl, NICE road delays, and toll plaza queues.
            </p>
          </div>

          <div className="rounded-xl border border-[#EADBCE] bg-white p-3 space-y-1">
            <strong className="block text-[#344F48] text-[11px] uppercase tracking-wider font-bold">
              🏛️ Operating Hours Database
            </strong>
            <p className="text-[#6B7C77] leading-relaxed text-[11px]">
              Monitored attraction timings prevent being locked out. Checkpoints like Bandipur Forest Gate (21:00–06:00 curfew) are flagged before booking.
            </p>
          </div>

          <div className="rounded-xl border border-[#EADBCE] bg-white p-3 space-y-1">
            <strong className="block text-[#344F48] text-[11px] uppercase tracking-wider font-bold">
              💰 Transparent Cost Model
            </strong>
            <p className="text-[#6B7C77] leading-relaxed text-[11px]">
              Models fuel, tolls, twin-sharing hotel rooms, and official landmark entry tickets. Scales transparently across solo, SUV, or multi-car groups.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
