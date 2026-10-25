import { useState } from 'react';
import { Link, Route, Routes } from 'react-router';
import type { UserConstraints } from './types';
import HomeScreen from './screens/HomeScreen';
import InputScreen from './screens/InputScreen';
import CompareScreen from './screens/CompareScreen';
import ScheduleScreen from './screens/ScheduleScreen';
import ReviewScreen from './screens/ReviewScreen';

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
    <div className="min-h-screen bg-slate-50">
      <header className="bg-[#0d352f] text-white sticky top-0 z-50 shadow-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:py-3.5">
          <Link to="/" className="flex items-center gap-2.5 group">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 font-black text-slate-950 text-base shadow-sm group-hover:bg-emerald-400 transition-colors">
              @48
            </span>
            <div className="flex flex-col">
              <span className="text-lg font-black tracking-tight leading-none text-white">
                @48
              </span>
              <span className="text-[10px] font-semibold tracking-wider text-emerald-300">
                BENGALURU EDITION
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-3 sm:gap-5">
            <a
              href="/#how-it-works"
              className="text-xs font-semibold text-emerald-100 hover:text-white transition-colors"
            >
              How It Works
            </a>
            <Link
              to="/plan"
              className="rounded-lg bg-emerald-500 px-3.5 py-1.5 text-xs font-bold text-slate-950 shadow-sm hover:bg-emerald-400 active:scale-95 transition-all"
            >
              Plan a Trip
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-7">
        <Routes>
          <Route path="/" element={<HomeScreen />} />
          <Route path="/plan" element={<InputScreen inputs={inputs} setInputs={setInputs} />} />
          <Route path="/compare" element={<CompareScreen inputs={inputs} setInputs={setInputs} />} />
          <Route path="/schedule/:id" element={<ScheduleScreen inputs={inputs} setInputs={setInputs} />} />
          <Route path="/review/:id" element={<ReviewScreen inputs={inputs} setInputs={setInputs} />} />
          <Route
            path="*"
            element={
              <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center space-y-3">
                <p className="text-base font-bold text-slate-800">Page not found.</p>
                <Link to="/plan" className="inline-block text-sm font-semibold text-teal-700 underline">
                  Return to planning
                </Link>
              </div>
            }
          />
        </Routes>
      </main>

      <footer className="mx-auto max-w-5xl px-4 pb-8 text-xs text-slate-500">
        @48 provides planning estimates, not live traffic or booking information. Verify with Google Maps and attraction operators.
      </footer>
    </div>
  );
}
