import { Link } from 'react-router';
import { DESTINATIONS } from '../data/destinations';
import { getDestinationImage } from '../data/images';

export default function HomeScreen() {
  const heroImage = getDestinationImage('coorg-madikeri');

  return (
    <div className="space-y-16 pb-12">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-[#0d352f] to-[#12423b] text-white shadow-xl">
        {/* Subtle background decoration */}
        <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

        <div className="relative mx-auto grid max-w-5xl gap-8 px-6 py-12 md:grid-cols-12 md:items-center md:py-16">
          <div className="space-y-5 md:col-span-7">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-900/70 border border-emerald-500/30 px-3.5 py-1 text-xs font-semibold text-emerald-200">
              <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              Bengaluru Weekend Escapes · 18–60 Hours
            </div>

            <h1 className="text-3xl font-black tracking-tight sm:text-4xl md:text-5xl leading-[1.15]">
              Great road trips start with a{' '}
              <span className="text-emerald-400 underline decoration-emerald-500/40 underline-offset-6">
                realistic plan.
              </span>
            </h1>

            <p className="text-base text-emerald-100/90 leading-relaxed max-w-lg">
              Plan your short escape, account for highway stops and time limits, and share the journey with your crew.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Link
                to="/plan"
                className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-6 py-3.5 text-base font-bold text-slate-950 shadow-lg shadow-emerald-950/40 hover:bg-emerald-400 active:scale-[0.99] transition-all cursor-pointer"
              >
                Plan My Road Trip →
              </Link>

              <a
                href="#how-it-works"
                className="inline-flex items-center justify-center rounded-xl border border-emerald-400/40 bg-emerald-950/40 px-5 py-3.5 text-sm font-semibold text-emerald-100 hover:bg-emerald-900/50 hover:text-white transition-all cursor-pointer"
              >
                How @48 Works ↓
              </a>
            </div>

            <div className="pt-2 flex items-center gap-4 text-xs text-emerald-200/80">
              <span>✓ 100% Free & Account-Free</span>
              <span>•</span>
              <span>✓ WhatsApp Group RSVP</span>
              <span>•</span>
              <span>✓ Stop-Aware Itinerary</span>
            </div>
          </div>

          {/* Hero Visual Card */}
          <div className="md:col-span-5">
            <div className="relative overflow-hidden rounded-2xl border-2 border-emerald-400/20 bg-slate-900/60 shadow-2xl group">
              <div className="aspect-[4/3] w-full overflow-hidden bg-slate-800">
                {heroImage && (
                  <img
                    src={heroImage.src}
                    alt={heroImage.alt}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                )}
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent pointer-events-none" />
              <div className="absolute bottom-3 left-3 right-3 text-white">
                <span className="rounded bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-slate-950 uppercase tracking-wider">
                  Featured Corridor
                </span>
                <p className="mt-1 text-sm font-bold">Western Ghats & Mysuru Expressway</p>
                <p className="text-[11px] text-emerald-200">
                  Calculated from MG Road, Bengaluru with contingency buffers.
                </p>
                {heroImage && (
                  <p className="mt-1 text-[9px] text-slate-400">
                    Photo: {heroImage.author} · {heroImage.license}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Product Explanation Section: Three Simple Steps */}
      <section id="how-it-works" className="space-y-8 scroll-mt-8">
        <div className="text-center space-y-2 max-w-2xl mx-auto">
          <p className="text-xs font-bold uppercase tracking-widest text-teal-700">How It Works</p>
          <h2 className="text-2xl font-black text-slate-900 sm:text-3xl">
            A reality check before you start the car
          </h2>
          <p className="text-sm text-slate-600">
            Most weekend road trips fail because navigation apps show best-case travel times. @48 models your real limits deterministically.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {/* Step 1 */}
          <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50 border border-teal-200 text-2xl font-black text-teal-800">
              1
            </div>
            <h3 className="mt-4 text-lg font-bold text-slate-900">Create your trip</h3>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              Select your departure and firm return deadline (18–60 hours), travel pace, per-person budget, and whether you're traveling solo or organizing a group.
            </p>
            <div className="mt-4 pt-3 border-t border-slate-100 text-xs font-semibold text-teal-700">
              Step 1 of 4: Setup & limits
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50 border border-teal-200 text-2xl font-black text-teal-800">
              2
            </div>
            <h3 className="mt-4 text-lg font-bold text-slate-900">Plan the journey</h3>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              Compare 4 proven escapes side-by-side. Add verified highway pitstops like Maddur Tiffanys, simulate traffic delays, and adjust driving offsets independently.
            </p>
            <div className="mt-4 pt-3 border-t border-slate-100 text-xs font-semibold text-teal-700">
              Step 2 & 3: Compare & customize
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50 border border-teal-200 text-2xl font-black text-teal-800">
              3
            </div>
            <h3 className="mt-4 text-lg font-bold text-slate-900">Review and share</h3>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              Review your hour-by-hour itinerary and budget breakdown. Copy a formatted WhatsApp summary or share a direct link for 1-click crew RSVPs without accounts.
            </p>
            <div className="mt-4 pt-3 border-t border-slate-100 text-xs font-semibold text-teal-700">
              Step 4: Itinerary snapshot & crew RSVP
            </div>
          </div>
        </div>
      </section>

      {/* Destination Preview Cards */}
      <section className="space-y-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-teal-700">Curated Destinations</p>
            <h2 className="mt-1 text-2xl font-black text-slate-900 sm:text-3xl">
              Four escapes from Bengaluru
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Grounded with real highway corridors, verified opening hours, and geographic waypoints.
            </p>
          </div>
          <Link
            to="/plan"
            className="text-sm font-bold text-teal-800 hover:text-teal-900 hover:underline"
          >
            Compare All Four in Step 2 →
          </Link>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {DESTINATIONS.map(d => {
            const img = getDestinationImage(d.id);
            return (
              <div
                key={d.id}
                className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow group"
              >
                <div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-100">
                  {img ? (
                    <img
                      src={img.src}
                      alt={img.alt}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      onError={e => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-3xl">🏞️</div>
                  )}
                  {img && (
                    <div className="absolute bottom-2 right-2 rounded bg-black/60 px-1.5 py-0.5 text-[9px] text-white/90 backdrop-blur-sm pointer-events-none">
                      {img.license}
                    </div>
                  )}
                </div>

                <div className="flex flex-1 flex-col p-4">
                  <h3 className="text-lg font-bold text-slate-900">{d.name}</h3>
                  <p className="text-xs text-teal-800 font-semibold mt-0.5">
                    {d.routeName} · {d.oneWayDistanceKm} km
                  </p>
                  <p className="mt-2 text-xs text-slate-600 leading-relaxed flex-1">
                    {d.activities.map(a => a.name).join(', ')}
                  </p>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[11px] text-slate-500">
                      ~{Math.round(d.baselineOneWayDriveMinutes / 60)}h base drive
                    </span>
                    <Link
                      to="/plan"
                      className="text-xs font-bold text-teal-700 group-hover:text-teal-900 group-hover:underline"
                    >
                      Plan Trip →
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Transparency & Disclaimer Box */}
      <section className="rounded-2xl border border-teal-200 bg-teal-50/70 p-6 text-xs text-teal-950 space-y-2 leading-relaxed">
        <div className="flex items-center gap-2 font-bold text-teal-900 text-sm">
          <span>ℹ️</span>
          <span>Transparency & Planning Scope</span>
        </div>
        <p>
          <strong>Planning estimates only:</strong> @48 models weekend road trips originating from MG Road, Bengaluru with declared highway corridors and conservative 20% travel buffers. It does <em>not</em> claim live GPS routing, live traffic forecasting, or hotel availability.
        </p>
        <p>
          <strong>Supported window:</strong> Escapes between 18.0 and 60.0 hours. Operating hours and night-driving restrictions (such as Bandipur National Park) are validated against published operator rules. Always verify road conditions before departing.
        </p>
      </section>

      {/* Bottom CTA Banner */}
      <section className="rounded-2xl bg-[#0d352f] text-white p-8 text-center space-y-4">
        <h2 className="text-2xl font-black sm:text-3xl">Ready to test your weekend reality?</h2>
        <p className="text-sm text-emerald-100 max-w-xl mx-auto leading-relaxed">
          It takes less than 60 seconds to set your limits, see usable destination free time, and send an invitation to your friends.
        </p>
        <div className="pt-2">
          <Link
            to="/plan"
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-8 py-3.5 text-base font-bold text-slate-950 shadow-md hover:bg-emerald-400 active:scale-[0.99] transition-all cursor-pointer"
          >
            Start Planning Now →
          </Link>
        </div>
      </section>
    </div>
  );
}
