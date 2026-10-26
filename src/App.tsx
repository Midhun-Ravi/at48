import { useState } from 'react';
import { Link, Route, Routes } from 'react-router';
import type { UserConstraints } from './types';
import HomeScreen from './screens/HomeScreen';
import InputScreen from './screens/InputScreen';
import CompareScreen from './screens/CompareScreen';
import ScheduleScreen from './screens/ScheduleScreen';
import ReviewScreen from './screens/ReviewScreen';
import BottomNav from './components/BottomNav';

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
    <div className="min-h-screen bg-[#15191F] text-[#F5F7FA] flex flex-col font-sans selection:bg-[#2962FF] selection:text-white">
      {/* Sticky Top Header */}
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-[#15191F]/90 backdrop-blur-md shadow-lg">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:py-3.5">
          <Link to="/" className="flex items-center gap-3 group">
            <img
              src="/images/at48-logo.png"
              alt="@48 Logo"
              className="h-9 w-9 rounded-xl object-cover border border-slate-700/80 shadow-md group-hover:scale-105 transition-transform"
            />
            <div className="flex flex-col">
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-black tracking-tight leading-none text-white">
                  @48
                </span>
                <span className="rounded bg-[#2962FF]/20 px-1.5 py-0.5 text-[9px] font-bold text-blue-400 border border-[#2962FF]/40 tracking-wider">
                  BENGALURU EDITION
                </span>
              </div>
              <span className="text-[10px] text-slate-400 font-medium hidden sm:inline">
                Road trips, without the guesswork.
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-3 sm:gap-5">
            <a
              href="/#how-it-works"
              className="text-xs font-semibold text-slate-300 hover:text-white transition-colors"
            >
              How It Works
            </a>
            <Link
              to="/plan"
              className="rounded-xl bg-[#2962FF] px-4 py-2 text-xs font-bold text-white shadow-md shadow-[#2962FF]/40 hover:bg-blue-600 active:scale-95 transition-all"
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
              <div className="rounded-2xl border border-slate-800 bg-[#20252E] p-8 text-center space-y-3">
                <p className="text-base font-bold text-white">Page not found.</p>
                <Link to="/plan" className="inline-block text-sm font-semibold text-blue-400 hover:underline">
                  Return to planning
                </Link>
              </div>
            }
          />
        </Routes>
      </main>

      {/* Desktop Accessible Footer */}
      <footer className="mx-auto w-full max-w-5xl px-4 pb-20 pt-4 text-center text-xs text-slate-500 border-t border-slate-800/60 hidden md:block">
        <p>
          @48 provides deterministic planning estimates from MG Road, Bengaluru. Always verify live highway conditions and attraction rules.
        </p>
      </footer>

      {/* Floating Rounded Bottom Navigation */}
      <BottomNav />
    </div>
  );
}
