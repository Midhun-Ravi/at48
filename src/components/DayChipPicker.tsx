import { useState, useMemo } from 'react';

interface DayChipPickerProps {
  departureDateTime: string; // YYYY-MM-DDTHH:mm
  returnDeadlineDateTime: string; // YYYY-MM-DDTHH:mm
  onChange: (departure: string, returnDeadline: string) => void;
}

const IST_OFFSET_MS = 330 * 60_000;

function toISTDate(epochMs: number): Date {
  return new Date(epochMs + IST_OFFSET_MS);
}

function formatYYYYMMDD(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default function DayChipPicker({
  departureDateTime,
  returnDeadlineDateTime,
  onChange,
}: DayChipPickerProps) {
  const currentDepDate = departureDateTime.slice(0, 10);
  const currentDepTime = departureDateTime.slice(11, 16) || '08:00';
  const currentRetDate = returnDeadlineDateTime.slice(0, 10);
  const currentRetTime = returnDeadlineDateTime.slice(11, 16) || '20:30';

  // Base day for chip generator: start near departure date or today
  const [dayOffset, setDayOffset] = useState(0);

  // Generate 14 selectable day chips starting from (today + dayOffset)
  const days = useMemo(() => {
    const list: Array<{
      dateStr: string;
      dayOfWeek: string;
      dayOfMonth: number;
      monthName: string;
      year: number;
      isWeekend: boolean;
    }> = [];

    const nowEpoch = Date.now();
    const todayIST = toISTDate(nowEpoch);
    const baseEpoch = Date.UTC(
      todayIST.getUTCFullYear(),
      todayIST.getUTCMonth(),
      todayIST.getUTCDate()
    );

    for (let i = 0; i < 14; i++) {
      const targetEpoch = baseEpoch + (dayOffset + i) * 86_400_000;
      const d = new Date(targetEpoch);
      const dateStr = formatYYYYMMDD(d);
      const dayOfWeek = d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }).toUpperCase();
      const dayOfMonth = d.getUTCDate();
      const monthName = d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
      const year = d.getUTCFullYear();
      const isWeekend = d.getUTCDay() === 0 || d.getUTCDay() === 6;

      list.push({ dateStr, dayOfWeek, dayOfMonth, monthName, year, isWeekend });
    }
    return list;
  }, [dayOffset]);

  // Handle day chip click
  const handleDayClick = (dateStr: string) => {
    // If clicking before departure date, or if both are set and user clicks to reset:
    if (dateStr < currentDepDate || (currentDepDate && currentRetDate && currentDepDate !== currentRetDate)) {
      // Set new departure
      onChange(`${dateStr}T${currentDepTime}`, `${dateStr}T${currentRetTime}`);
    } else if (dateStr === currentDepDate) {
      // Same day return or resetting
      onChange(`${dateStr}T${currentDepTime}`, `${dateStr}T${currentRetTime}`);
    } else {
      // Set return date
      onChange(`${currentDepDate}T${currentDepTime}`, `${dateStr}T${currentRetTime}`);
    }
  };

  const handleDepTimeChange = (timeStr: string) => {
    onChange(`${currentDepDate}T${timeStr}`, `${currentRetDate}T${currentRetTime}`);
  };

  const handleRetTimeChange = (timeStr: string) => {
    onChange(`${currentDepDate}T${currentDepTime}`, `${currentRetDate}T${timeStr}`);
  };

  // Duration in hours
  const startEpoch = Date.parse(`${currentDepDate}T${currentDepTime}:00Z`);
  const endEpoch = Date.parse(`${currentRetDate}T${currentRetTime}:00Z`);
  const durationHours = (endEpoch - startEpoch) / 3_600_000;
  const isValidDuration = durationHours >= 18 && durationHours <= 60;

  return (
    <div className="space-y-4 rounded-2xl border border-slate-700/60 bg-[#15191F] p-4 sm:p-5 text-slate-100 shadow-md">
      {/* Header with Navigation */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">
            Tap Departure & Return Dates
          </span>
          <h3 className="text-base font-bold text-white">
            {days[0]?.monthName} {days[0]?.year} {days[13]?.monthName !== days[0]?.monthName && `– ${days[13]?.monthName}`}
          </h3>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setDayOffset(prev => Math.max(0, prev - 7))}
            disabled={dayOffset === 0}
            className="rounded-lg bg-[#292F39] px-2.5 py-1 text-xs font-semibold text-slate-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Earlier days"
          >
            ← Previous
          </button>
          <button
            type="button"
            onClick={() => setDayOffset(prev => prev + 7)}
            className="rounded-lg bg-[#292F39] px-2.5 py-1 text-xs font-semibold text-slate-300 hover:text-white transition-colors"
            title="Next week"
          >
            Next week →
          </button>
        </div>
      </div>

      {/* Horizontally Scrollable Day Chips */}
      <div className="overflow-x-auto pb-2 scrollbar-thin">
        <div className="flex items-center gap-2 min-w-max">
          {days.map(d => {
            const isDep = d.dateStr === currentDepDate;
            const isRet = d.dateStr === currentRetDate;
            const isInRange = d.dateStr > currentDepDate && d.dateStr < currentRetDate;

            return (
              <button
                key={d.dateStr}
                type="button"
                onClick={() => handleDayClick(d.dateStr)}
                className={`flex flex-col items-center justify-center rounded-xl p-2.5 min-w-[56px] text-center border transition-all cursor-pointer ${
                  isDep || isRet
                    ? 'border-[#2962FF] bg-[#2962FF] text-white shadow-md shadow-[#2962FF]/40 font-bold scale-105'
                    : isInRange
                    ? 'border-[#2962FF]/50 bg-[#2962FF]/15 text-blue-200'
                    : d.isWeekend
                    ? 'border-slate-700 bg-[#292F39] text-slate-200 hover:border-slate-500'
                    : 'border-slate-800 bg-[#20252E] text-slate-400 hover:border-slate-600'
                }`}
              >
                <span className="text-[10px] uppercase font-semibold tracking-wider">
                  {d.dayOfWeek}
                </span>
                <span className="text-base font-black my-0.5 leading-none">
                  {d.dayOfMonth}
                </span>
                <span className="text-[9px] font-medium opacity-80">
                  {isDep ? 'Dep' : isRet ? 'Ret' : d.monthName}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Matching Trip Starts and Back By Selection Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-800">
        {/* Departure Time */}
        <div className="rounded-xl border border-slate-700/60 bg-[#20252E] p-3 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300">🚀 Trip Starts</span>
            <span className="text-[11px] font-semibold text-blue-400">{currentDepDate}</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="time"
              value={currentDepTime}
              onChange={e => handleDepTimeChange(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-[#15191F] px-3 py-1.5 text-sm font-bold text-white focus:border-[#2962FF] focus:outline-none"
            />
          </div>
        </div>

        {/* Return Deadline Time */}
        <div className="rounded-xl border border-slate-700/60 bg-[#20252E] p-3 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300">🏠 Back By (Home Deadline)</span>
            <span className="text-[11px] font-semibold text-blue-400">{currentRetDate}</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="time"
              value={currentRetTime}
              onChange={e => handleRetTimeChange(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-[#15191F] px-3 py-1.5 text-sm font-bold text-white focus:border-[#2962FF] focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Duration and Feasibility Status Badge */}
      <div className="flex items-center justify-between pt-1 text-xs">
        <span className="text-slate-400">Total Planned Trip Window:</span>
        {isValidDuration ? (
          <span className="flex items-center gap-1.5 font-bold text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
            <span>✓</span>
            <span>{durationHours.toFixed(1)} hours (within 18–60h escape window)</span>
          </span>
        ) : (
          <span className="font-semibold text-amber-300 bg-amber-950/40 border border-amber-500/30 px-2.5 py-0.5 rounded-full">
            {durationHours < 18
              ? `${durationHours.toFixed(1)}h (Minimum is 18h)`
              : `${durationHours.toFixed(1)}h (Maximum is 60h)`}
          </span>
        )}
      </div>
    </div>
  );
}
