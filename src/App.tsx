import { useState } from 'react';
import { Link, Route, Routes } from 'react-router';
import type { UserConstraints } from './types';
import HomeScreen from './screens/HomeScreen';
import InputScreen from './screens/InputScreen';
import CompareScreen from './screens/CompareScreen';
import ScheduleScreen from './screens/ScheduleScreen';
import ReviewScreen from './screens/ReviewScreen';
import BottomNav from './components/BottomNav';
import ScrollToTop from './components/ScrollToTop';

function upcomingWeekend(): [string, string] {
  const nowIST = new Date(Date.now() + 330 * 60_000);
  const dayUTC = nowIST.getUTCDay();
  let daysAhead = (6 - dayUTC + 7) % 7;
  if (dayUTC === 6 && nowIST.getUTCHours() >= 8) daysAhead = 7;
  const saturday = new Date(nowIST.getTime() + daysAhead * 86_400_000);
  const sunday = new Date(saturday.getTime() + 86_400_000);
  return [
    saturday.toISOString().slice(0, 10) + 'T08:00',
    sunday.toISOString().slice(0, 10) + 'T20:30',
  ];
}

const [departureDateTime, returnDeadlineDateTime] = upcomingWeekend();
const DEFAULTS: UserConstraints = {
  departureDateTime,
  returnDeadlineDateTime,
  pace: 'balanced',
  perPersonBudgetINR: 6000,
  partySize: 2,
  drivingAdjustmentMinutes: 0,
  simulateDelayMinutes: 0,
  disabledActivityIds: [],
  selectedPitstopIds: [],
  organizerName: '',
  planningMode: 'group',
  destinationAdjustments: {},
};

export default function App() {
  const [inputs, setInputs] = useState<UserConstraints>(DEFAULTS);

  return (
    <div className="min-h-screen bg-[#F4F9FC] text-[#193953] flex flex-col font-sans selection:bg-[#176EA8] selection:text-white">
      <ScrollToTop />
      {/* Sticky Top Header */}
      <header className="sticky top-0 z-40 border-b border-[#E1ECF2] bg-white/95 backdrop-blur-md shadow-xs">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:py-3.5">
          <Link to="/" className="flex items-center gap-3 group">
            <img
              src="/images/at48-logo.png"
              alt="@48 Logo"
              className="h-9 w-9 rounded-xl object-cover border border-[#E1ECF2] shadow-xs group-hover:scale-105 transition-transform"
            />
            <div className="flex flex-col">
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-black tracking-tight leading-none text-[#193953]">
                  @48
                </span>
                <span className="rounded bg-[#DDF0F6] px-1.5 py-0.5 text-[9px] font-bold text-[#176EA8] border border-[#BAE3F1] tracking-wider">
                  BENGALURU EDITION
                </span>
              </div>
              <span className="text-[10px] text-[#5A7184] font-medium hidden sm:inline">
                Road trips, without the guesswork.
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-3 sm:gap-5">
            <a
              href="/#how-it-works"
              className="text-xs font-semibold text-[#193953] hover:text-[#176EA8] transition-colors"
            >
              How It Works
            </a>
            <Link
              to="/plan"
              className="rounded-xl bg-[#176EA8] px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#135A8A] active:scale-95 transition-all"
            >
              Plan a Trip
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Area (pb-28 reserves space for floating bottom navigation) */}
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:py-8 pb-28">
        <Routes>
          <Route path="/" element={<HomeScreen />} />
          <Route path="/plan" element={<InputScreen inputs={inputs} setInputs={setInputs} />} />
          <Route path="/compare" element={<CompareScreen inputs={inputs} setInputs={setInputs} />} />
          <Route path="/schedule/:id" element={<ScheduleScreen inputs={inputs} setInputs={setInputs} />} />
          <Route path="/review/:id" element={<ReviewScreen inputs={inputs} setInputs={setInputs} />} />
          <Route
            path="*"
            element={
              <div className="rounded-2xl border border-[#E1ECF2] bg-white p-8 text-center space-y-3 shadow-sm">
                <p className="text-base font-bold text-[#193953]">Page not found.</p>
                <Link to="/plan" className="inline-block text-sm font-semibold text-[#176EA8] hover:underline">
                  Return to planning
                </Link>
              </div>
            }
          />
        </Routes>
      </main>

      {/* Desktop Accessible Footer */}
      <footer className="mx-auto w-full max-w-5xl px-4 pb-20 pt-4 text-center text-xs text-[#5A7184] border-t border-[#E1ECF2] hidden md:block">
        <p>
          @48 provides deterministic planning estimates from MG Road, Bengaluru. Always verify live highway conditions and attraction rules.
        </p>
      </footer>

      {/* Floating Rounded Bottom Navigation */}
      <BottomNav />
    </div>
  );
}
