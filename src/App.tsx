import { useState } from 'react';
import { Link, Route, Routes } from 'react-router';
import type { UserConstraints } from './types';
import InputScreen from './screens/InputScreen';
import CompareScreen from './screens/CompareScreen';
import ScheduleScreen from './screens/ScheduleScreen';

function upcomingWeekend(): [string, string] {
  const nowIST = new Date(Date.now() + 330 * 60_000);
  const dayUTC = nowIST.getUTCDay();
  let daysAhead = (6 - dayUTC + 7) % 7;
  if (dayUTC === 6 && nowIST.getUTCHours() >= 8) daysAhead = 7;
  const saturday = new Date(nowIST.getTime() + daysAhead * 86_400_000);
  const sunday = new Date(saturday.getTime() + 86_400_000);
  return [saturday.toISOString().slice(0, 10) + 'T08:00',
    sunday.toISOString().slice(0, 10) + 'T20:30'];
}
const [departureDateTime, returnDeadlineDateTime] = upcomingWeekend();
const DEFAULTS: UserConstraints = {
  departureDateTime, returnDeadlineDateTime, pace: 'balanced',
  perPersonBudgetINR: 6000, partySize: 2, drivingAdjustmentMinutes: 0,
  simulateDelayMinutes: 0, disabledActivityIds: [],
};

export default function App() {
  const [inputs, setInputs] = useState<UserConstraints>(DEFAULTS);
  return <div className="min-h-screen">
    <header className="bg-[#0d352f] text-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <Link to="/" className="text-2xl font-black tracking-tight">@48<span className="ml-2 text-xs font-medium text-emerald-100">BENGALURU EDITION</span></Link>
        <span className="text-xs text-emerald-100">THE WEEKEND REALITY CHECKER</span>
      </div>
    </header>
    <main className="mx-auto max-w-5xl px-4 py-7">
      <Routes>
        <Route path="/" element={<InputScreen inputs={inputs} setInputs={setInputs} />} />
        <Route path="/compare" element={<CompareScreen inputs={inputs} setInputs={setInputs} />} />
        <Route path="/schedule/:id" element={<ScheduleScreen inputs={inputs} setInputs={setInputs} />} />
        <Route path="*" element={<p>Page not found. <Link to="/" className="underline">Return to planning</Link>.</p>} />
      </Routes>
    </main>
    <footer className="mx-auto max-w-5xl px-4 pb-8 text-xs text-slate-500">
      @48 provides planning estimates, not live traffic or booking information. Verify with Google Maps and attraction operators.
    </footer>
  </div>;
}
