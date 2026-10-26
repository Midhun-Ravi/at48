import { useState } from 'react';

/**
 * Gate 7: Compact, expandable trust note "How @48 plans your trip"
 * Lightweight, clean typography, non-intrusive.
 */
export default function TrustNote() {
  const [expanded, setExpanded] = useState(false);

  return (
    <section className="rounded-2xl border border-[#E1ECF2] bg-[#F4F9FC] p-4 sm:p-5 text-xs text-[#193953] transition-all">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg bg-[#DDF0F6] text-[#176EA8] text-xs">
            🛡️
          </span>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#193953]">
              How @48 plans your trip
            </h3>
            <p className="mt-1 text-xs text-[#5A7184] leading-relaxed">
              We calculate road trips using real highway distances from Bengaluru with standard weekend traffic buffers (+20%). Operating hours, daylight windows, and rest stops are verified against local regulations. Feasibility scores are deterministic — computed mathematically from your chosen dates and times, not guessed by AI.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setExpanded(prev => !prev)}
          className="flex-shrink-0 rounded-lg border border-[#BAE3F1] bg-white px-2.5 py-1 text-[11px] font-bold text-[#176EA8] hover:bg-[#DDF0F6] transition-colors cursor-pointer"
        >
          {expanded ? 'Hide Details ▲' : 'Learn More ▼'}
        </button>
      </div>

      {expanded && (
        <div className="mt-4 pt-3.5 border-t border-[#E1ECF2] grid sm:grid-cols-2 gap-3 text-xs animate-fadeIn">
          <div className="rounded-xl border border-[#E1ECF2] bg-white p-3 space-y-1">
            <strong className="block text-[#193953] text-[11px] uppercase tracking-wider font-bold">
              📍 Departure Hub Baseline
            </strong>
            <p className="text-[#5A7184] leading-relaxed text-[11px]">
              Calculated from Central Bengaluru (MG Road baseline) with corridor adjustments for Whitefield, Hebbal, Indiranagar, and Electronic City.
            </p>
          </div>

          <div className="rounded-xl border border-[#E1ECF2] bg-white p-3 space-y-1">
            <strong className="block text-[#193953] text-[11px] uppercase tracking-wider font-bold">
              ⏱️ Traffic Buffer Model
            </strong>
            <p className="text-[#5A7184] leading-relaxed text-[11px]">
              Applies a conservative +20% weekend highway contingency buffer to absorb city crawl and toll booth queues.
            </p>
          </div>

          <div className="rounded-xl border border-[#E1ECF2] bg-white p-3 space-y-1">
            <strong className="block text-[#193953] text-[11px] uppercase tracking-wider font-bold">
              🏛️ Operating Hours Database
            </strong>
            <p className="text-[#5A7184] leading-relaxed text-[11px]">
              Landmark schedules (Mysore Palace lighting, Dubare elephant camp, Doddabetta Peak) verified against official gate timings.
            </p>
          </div>

          <div className="rounded-xl border border-[#E1ECF2] bg-white p-3 space-y-1">
            <strong className="block text-[#193953] text-[11px] uppercase tracking-wider font-bold">
              🚫 Night Driving Safety
            </strong>
            <p className="text-[#5A7184] leading-relaxed text-[11px]">
              Respects protected wildlife curfews (such as Bandipur NH 766 9:00 PM–6:00 AM closure) and discourages risky overnight ghat drives.
            </p>
          </div>

          <div className="sm:col-span-2 rounded-xl border border-[#E1ECF2] bg-white p-3 space-y-1">
            <strong className="block text-[#193953] text-[11px] uppercase tracking-wider font-bold">
              💰 Deterministic Group Budgeting
            </strong>
            <p className="text-[#5A7184] leading-relaxed text-[11px]">
              Shared vehicle costs (fuel @ ~14 km/l + FASTag tolls) are split evenly across group members; hotel rooms assume twin-sharing per 2 travelers; activities and food are budgeted per person.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
