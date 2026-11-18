import { useState, useMemo } from 'react';
import { getCalendarDaysCount } from '../engine/scheduler';
import TactileButton from './ui/TactileButton';

interface MonthCalendarPickerProps {
  departureDateTime: string; // YYYY-MM-DDTHH:mm
  returnDeadlineDateTime: string; // YYYY-MM-DDTHH:mm
  onChange: (departure: string, returnDeadline: string) => void;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const TIME_PRESETS_DEP = ['06:00', '07:00', '08:00', '09:00', '10:00', '14:00'];
const TIME_PRESETS_RET = ['18:00', '19:30', '20:30', '21:30', '22:30', '23:30'];

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

export default function MonthCalendarPicker({
  departureDateTime,
  returnDeadlineDateTime,
  onChange,
}: MonthCalendarPickerProps) {
  const currentDepDate = departureDateTime.slice(0, 10);
  const currentDepTime = departureDateTime.slice(11, 16) || '08:00';
  const currentRetDate = returnDeadlineDateTime.slice(0, 10);
  const currentRetTime = returnDeadlineDateTime.slice(11, 16) || '20:30';

  // Active month view initialized from current departure date or today
  const initDate = currentDepDate ? new Date(currentDepDate) : new Date();
  const [viewYear, setViewYear] = useState(initDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initDate.getMonth()); // 0-indexed

  // Navigation handlers
  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(y => y - 1);
    } else {
      setViewMonth(m => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(y => y + 1);
    } else {
      setViewMonth(m => m + 1);
    }
  };

  const handleQuickWeekendPreset = (offsetWeeks = 0) => {
    // Find next Saturday
    const now = new Date();
    const currentDay = now.getDay();
    const daysUntilSaturday = ((6 - currentDay + 7) % 7) + offsetWeeks * 7;
    const sat = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (daysUntilSaturday === 0 ? 7 : daysUntilSaturday));
    const sun = new Date(sat.getFullYear(), sat.getMonth(), sat.getDate() + 1);

    const satStr = `${sat.getFullYear()}-${pad2(sat.getMonth() + 1)}-${pad2(sat.getDate())}`;
    const sunStr = `${sun.getFullYear()}-${pad2(sun.getMonth() + 1)}-${pad2(sun.getDate())}`;

    setViewYear(sat.getFullYear());
    setViewMonth(sat.getMonth());
    onChange(`${satStr}T${currentDepTime}`, `${sunStr}T${currentRetTime}`);
  };

  // Calendar cells generation for viewMonth
  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(viewYear, viewMonth, 1);
    const lastDayOfMonth = new Date(viewYear, viewMonth + 1, 0);
    const totalDays = lastDayOfMonth.getDate();

    // Monday as index 0: JS getDay(): 0 is Sun, 1 is Mon...
    let startingDayOfWeek = firstDayOfMonth.getDay() - 1;
    if (startingDayOfWeek === -1) startingDayOfWeek = 6; // Sunday is 6th position

    const days: Array<{
      dateStr: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isWeekend: boolean; // Fri, Sat, Sun
      isSaturdayOrSunday: boolean;
      isDeparture: boolean;
      isReturn: boolean;
      isInRange: boolean;
    }> = [];

    // Blank cells before month start
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push({
        dateStr: `prev-${i}`,
        dayNumber: 0,
        isCurrentMonth: false,
        isWeekend: false,
        isSaturdayOrSunday: false,
        isDeparture: false,
        isReturn: false,
        isInRange: false,
      });
    }

    // Days in current month
    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${viewYear}-${pad2(viewMonth + 1)}-${pad2(d)}`;
      const dayDate = new Date(viewYear, viewMonth, d);
      const dayOfWeek = dayDate.getDay(); // 0 is Sun, 5 is Fri, 6 is Sat
      const isWeekend = dayOfWeek === 5 || dayOfWeek === 6 || dayOfWeek === 0;
      const isSaturdayOrSunday = dayOfWeek === 6 || dayOfWeek === 0;

      const isDeparture = dateStr === currentDepDate;
      const isReturn = dateStr === currentRetDate;
      const isInRange = Boolean(
        currentDepDate &&
        currentRetDate &&
        dateStr > currentDepDate &&
        dateStr < currentRetDate
      );

      days.push({
        dateStr,
        dayNumber: d,
        isCurrentMonth: true,
        isWeekend,
        isSaturdayOrSunday,
        isDeparture,
        isReturn,
        isInRange,
      });
    }

    return days;
  }, [viewYear, viewMonth, currentDepDate, currentRetDate]);

  // Handle cell click
  const handleDateClick = (dateStr: string) => {
    // If clicking before departure, or if range is already completed, start new range
    if (!currentDepDate || (currentDepDate && currentRetDate && currentDepDate !== currentRetDate)) {
      onChange(`${dateStr}T${currentDepTime}`, `${dateStr}T${currentRetTime}`);
      return;
    }

    // If only departure was set (or departure == return)
    if (dateStr < currentDepDate) {
      // User clicked an earlier date: make it the new departure
      onChange(`${dateStr}T${currentDepTime}`, `${dateStr}T${currentRetTime}`);
    } else {
      // User clicked same day or later date
      // Check 1 to 4 calendar days
      const daysCount = getCalendarDaysCount(
        `${currentDepDate}T${currentDepTime}`,
        `${dateStr}T${currentRetTime}`
      );
      if (daysCount > 4) {
        // Clamp to max 4 calendar days (3 nights)
        const depD = new Date(currentDepDate);
        depD.setDate(depD.getDate() + 3);
        const maxRetStr = `${depD.getFullYear()}-${pad2(depD.getMonth() + 1)}-${pad2(depD.getDate())}`;
        onChange(`${currentDepDate}T${currentDepTime}`, `${maxRetStr}T${currentRetTime}`);
      } else {
        onChange(`${currentDepDate}T${currentDepTime}`, `${dateStr}T${currentRetTime}`);
      }
    }
  };

  const handleDepTimeChange = (t: string) => {
    onChange(`${currentDepDate}T${t}`, `${currentRetDate}T${currentRetTime}`);
  };

  const handleRetTimeChange = (t: string) => {
    onChange(`${currentDepDate}T${currentDepTime}`, `${currentRetDate}T${t}`);
  };

  // Calendar days count & verification
  const calendarDaysCount = getCalendarDaysCount(departureDateTime, returnDeadlineDateTime);
  const isOrderValid = returnDeadlineDateTime > departureDateTime;

  return (
    <div className="space-y-3.5 sm:space-y-4 rounded-2xl sm:rounded-3xl border border-[#EADBCE] bg-white p-2.5 sm:p-5 text-[#344F48] shadow-sm">
      {/* Calendar Header with Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2.5 border-b border-[#EADBCE]">
        <div className="flex items-center justify-between sm:justify-start gap-2 w-full sm:w-auto">
          <TactileButton
            variant="secondary"
            size="sm"
            onClick={handlePrevMonth}
            aria-label="Previous month"
            title="Previous month"
            className="!px-2.5 !py-1 text-xs"
          >
            ←
          </TactileButton>

          <span className="text-sm sm:text-base font-black tracking-tight text-[#344F48] flex-1 sm:flex-none text-center sm:min-w-[140px]">
            {MONTH_NAMES[viewMonth]} {viewYear}
          </span>

          <TactileButton
            variant="secondary"
            size="sm"
            onClick={handleNextMonth}
            aria-label="Next month"
            title="Next month"
            className="!px-2.5 !py-1 text-xs"
          >
            →
          </TactileButton>
        </div>

        {/* Quick Presets */}
        <div className="flex items-center justify-center gap-1.5 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => handleQuickWeekendPreset(0)}
            className="flex-1 sm:flex-none text-center rounded-lg border border-[#EADBCE] bg-[#FAF2EB] px-2.5 py-1 text-[11px] sm:text-xs font-bold text-[#C65B32] hover:bg-[#F8E1D2] transition-colors cursor-pointer"
          >
            This Weekend
          </button>
          <button
            type="button"
            onClick={() => handleQuickWeekendPreset(1)}
            className="flex-1 sm:flex-none text-center rounded-lg border border-[#EADBCE] bg-[#FAF2EB] px-2.5 py-1 text-[11px] sm:text-xs font-bold text-[#344F48] hover:bg-[#F8E1D2] transition-colors cursor-pointer"
          >
            Next Weekend
          </button>
        </div>
      </div>

      {/* Weekday Labels (Mon - Sun, with Fri/Sat/Sun highlighted) */}
      <div className="grid grid-cols-7 gap-0.5 sm:gap-1 text-center">
        {WEEKDAYS.map((wd, i) => {
          const isWeekendHeader = i >= 4; // Fri, Sat, Sun
          return (
            <div
              key={wd}
              className={`py-1 text-[10px] sm:text-[11px] font-black uppercase tracking-wider rounded ${
                isWeekendHeader
                  ? 'text-[#C65B32] bg-[#F8E1D2]/40 font-black'
                  : 'text-[#6B7C77]'
              }`}
            >
              {wd}
            </div>
          );
        })}
      </div>

      {/* Calendar Days Grid */}
      <div className="grid grid-cols-7 gap-0.5 sm:gap-1.5" role="grid" aria-label="Month dates">
        {calendarDays.map((cell, idx) => {
          if (!cell.isCurrentMonth) {
            return (
              <div
                key={`empty-${idx}`}
                className="aspect-square rounded-xl bg-transparent pointer-events-none"
              />
            );
          }

          const isSelectedEndpoint = cell.isDeparture || cell.isReturn;

          return (
            <button
              key={cell.dateStr}
              type="button"
              onClick={() => handleDateClick(cell.dateStr)}
              className={`relative aspect-square min-w-0 max-w-full flex flex-col items-center justify-center rounded-lg sm:rounded-xl p-0.5 sm:p-1 text-[11px] sm:text-xs font-bold transition-all cursor-pointer ${
                cell.isDeparture && cell.isReturn
                  ? 'bg-[#C65B32] text-white shadow-sm ring-1 sm:ring-2 ring-[#8D3817]'
                  : cell.isDeparture
                  ? 'bg-[#C65B32] text-white shadow-sm ring-1 sm:ring-2 ring-[#C65B32]'
                  : cell.isReturn
                  ? 'bg-[#344F48] text-white shadow-sm ring-1 sm:ring-2 ring-[#344F48]'
                  : cell.isInRange
                  ? 'bg-[#F8E1D2] text-[#C65B32] rounded-none first-of-type:rounded-l-lg last-of-type:rounded-r-lg sm:first-of-type:rounded-l-xl sm:last-of-type:rounded-r-xl font-black'
                  : cell.isSaturdayOrSunday
                  ? 'bg-[#FAF2EB] text-[#344F48] hover:bg-[#F8E1D2]/60 border border-[#EADBCE]'
                  : cell.isWeekend
                  ? 'bg-[#FFF7F0] text-[#344F48] hover:bg-[#F8E1D2]/40 border border-dashed border-[#EADBCE]'
                  : 'bg-white text-[#6B7C77] hover:bg-[#FAF2EB] border border-transparent hover:border-[#EADBCE]'
              }`}
              aria-label={`${cell.dateStr}${cell.isDeparture ? ' (Departure)' : ''}${cell.isReturn ? ' (Return)' : ''}`}
            >
              <span className={`text-xs sm:text-sm ${isSelectedEndpoint ? 'font-black' : ''}`}>
                {cell.dayNumber}
              </span>

              {/* Status Pill on Selected Days */}
              {cell.isDeparture && cell.isReturn ? (
                <span className="text-[9px] font-extrabold text-[#F8E1D2] uppercase tracking-tighter">
                  1-Day
                </span>
              ) : cell.isDeparture ? (
                <span className="text-[9px] font-extrabold text-[#F8E1D2] uppercase tracking-tighter">
                  Dep
                </span>
              ) : cell.isReturn ? (
                <span className="text-[9px] font-extrabold text-[#E4ECE5] uppercase tracking-tighter">
                  Ret
                </span>
              ) : cell.isSaturdayOrSunday ? (
                <span className="text-[8px] font-medium text-[#C65B32]/70 hidden sm:inline">
                  Wknd
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Selected Trip Window Summary & Time Selectors */}
      <div className="rounded-2xl border border-[#EADBCE] bg-[#FAF2EB] p-3.5 sm:p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#6B7C77]">
              Trip Window:
            </span>
            <span className="rounded-lg bg-[#F8E1D2] px-2.5 py-0.5 text-xs font-black text-[#C65B32]">
              {calendarDaysCount} {calendarDaysCount === 1 ? 'Calendar Day' : 'Calendar Days'}
            </span>
          </div>

          <div className="text-xs text-[#6B7C77] font-medium">
            Strict IST interpretation (Asia/Kolkata)
          </div>
        </div>

        {/* Departure & Return Controls */}
        <div className="grid sm:grid-cols-2 gap-3 text-xs">
          {/* Departure */}
          <div className="rounded-xl bg-white p-3 border border-[#EADBCE] space-y-1.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="font-black uppercase tracking-wider text-[#C65B32]">
                🛫 Departure Date & Time
              </span>
              <span className="text-[11px] font-bold text-[#344F48]">{currentDepDate}</span>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <div className="flex items-center gap-2">
                <label htmlFor="dep-time-input" className="text-[#6B7C77] shrink-0 font-medium">
                  Time (IST):
                </label>
                <input
                  id="dep-time-input"
                  type="time"
                  value={currentDepTime}
                  onChange={e => handleDepTimeChange(e.target.value)}
                  className="rounded-lg border border-[#EADBCE] bg-[#FAF2EB] px-2 py-1 font-bold text-[#344F48] focus:border-[#C65B32] focus:outline-none"
                />
              </div>
              <div className="flex gap-1 overflow-x-auto">
                {TIME_PRESETS_DEP.slice(0, 3).map(preset => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handleDepTimeChange(preset)}
                    className={`rounded px-1.5 py-0.5 text-[10px] font-bold cursor-pointer ${
                      currentDepTime === preset
                        ? 'bg-[#C65B32] text-white'
                        : 'bg-[#EADBCE] text-[#6B7C77] hover:bg-[#CFBCAC]'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Return Deadline */}
          <div className="rounded-xl bg-white p-3 border border-[#EADBCE] space-y-1.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="font-black uppercase tracking-wider text-[#344F48]">
                🏁 Return Deadline (IST)
              </span>
              <span className="text-[11px] font-bold text-[#344F48]">{currentRetDate}</span>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <div className="flex items-center gap-2">
                <label htmlFor="ret-time-input" className="text-[#6B7C77] shrink-0 font-medium">
                  Time (IST):
                </label>
                <input
                  id="ret-time-input"
                  type="time"
                  value={currentRetTime}
                  onChange={e => handleRetTimeChange(e.target.value)}
                  className="rounded-lg border border-[#EADBCE] bg-[#FAF2EB] px-2 py-1 font-bold text-[#344F48] focus:border-[#C65B32] focus:outline-none"
                />
              </div>
              <div className="flex gap-1 overflow-x-auto">
                {TIME_PRESETS_RET.slice(1, 4).map(preset => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handleRetTimeChange(preset)}
                    className={`rounded px-1.5 py-0.5 text-[10px] font-bold cursor-pointer ${
                      currentRetTime === preset
                        ? 'bg-[#344F48] text-white'
                        : 'bg-[#EADBCE] text-[#6B7C77] hover:bg-[#CFBCAC]'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Validation indicator */}
        {!isOrderValid && (
          <div className="rounded-lg bg-red-50 p-2 text-xs font-bold text-red-700 border border-red-200">
            ⚠️ Return date and time must be strictly after departure date and time in IST.
          </div>
        )}
      </div>
    </div>
  );
}
