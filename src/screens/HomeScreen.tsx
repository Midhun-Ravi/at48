import { Link } from 'react-router';
import { DESTINATIONS } from '../data/destinations';
import { getDestinationImage } from '../data/images';

export default function HomeScreen() {
  const heroImage = getDestinationImage('coorg-madikeri');

  return (
    <div className="space-y-16 pb-12">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-b from-[#1C222B] to-[#15191F] text-slate-100 shadow-2xl p-6 sm:p-10 md:p-12">
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#2962FF_1px,transparent_1px)] [background-size:20px_20px] pointer-events-none" />

        <div className="relative mx-auto grid max-w-5xl gap-8 md:grid-cols-12 md:items-center">
          <div className="space-y-5 md:col-span-7">
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-950/60 border border-blue-500/30 px-3.5 py-1 text-xs font-semibold text-blue-300">
              <span className="flex h-2 w-2 rounded-full bg-[#2962FF] animate-pulse" />
              Bengaluru Weekend Escapes · 18–60 Hours
            </div>

            <h1 className="text-3xl font-black tracking-tight sm:text-4xl md:text-5xl leading-[1.15] text-white">
              Road trips,{' '}
              <span className="text-[#2962FF] underline decoration-[#2962FF]/40 underline-offset-6">
                without the guesswork.
              </span>
            </h1>

            <p className="text-base text-slate-300 leading-relaxed max-w-lg">
              Set your departure and firm return deadline. @48 models your real highway driving, curated pitstops, and landmark operating hours deterministically.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Link
                to="/plan"
                className="flex items-center justify-center gap-2 rounded-xl bg-[#2962FF] px-6 py-3.5 text-base font-bold text-white shadow-lg shadow-[#2962FF]/40 hover:bg-blue-600 active:scale-[0.99] transition-all cursor-pointer"
              >
                Plan My Road Trip →
              </Link>

              <a
                href="#how-it-works"
                className="inline-flex items-center justify-center rounded-xl border border-slate-700 bg-[#292F39]/60 px-5 py-3.5 text-sm font-semibold text-slate-200 hover:bg-[#292F39] hover:text-white transition-all cursor-pointer"
              >
                How It Works ↓
              </a>
            </div>

            <div className="pt-2 flex flex-wrap items-center gap-4 text-xs text-slate-400">
              <span className="text-slate-300">✓ 100% Free & Account-Free</span>
              <span>•</span>
              <span className="text-slate-300">✓ WhatsApp Group RSVP</span>
              <span>•</span>
              <span className="text-slate-300">✓ Stop-Aware Itinerary</span>
            </div>
          </div>

          {/* Hero Visual Card */}
          <div className="md:col-span-5">
            <div className="relative overflow-hidden rounded-2xl border border-slate-700/80 bg-[#20252E] shadow-2xl group">
              <div className="aspect-[4/3] w-full overflow-hidden bg-slate-900">
                {heroImage && (
                  <img
                    src={heroImage.src}
                    alt={heroImage.alt}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                )}
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent pointer-events-none" />
              <div className="absolute bottom-3 left-3 right-3 text-white">
                <span className="rounded bg-[#2962FF] px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
                  Featured Corridor
                </span>
                <p className="mt-1 text-sm font-bold">Western Ghats & Mysuru Expressway</p>
                <p className="text-[11px] text-blue-200">
                  Calculated from MG Road, Bengaluru with 20% contingency buffers.
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
      <section id="how-it-works" className="space-y-8 scroll-mt-20">
        <div className="text-center space-y-2 max-w-2xl mx-auto">
          <p className="text-xs font-bold uppercase tracking-widest text-blue-400">How It Works</p>
          <h2 className="text-2xl font-black text-white sm:text-3xl">
            A reality check before you start the car
          </h2>
          <p className="text-sm text-slate-400">
            Most weekend road trips fail because navigation apps show best-case travel times. @48 models your real limits deterministically.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {/* Step 1 */}
          <div className="flex flex-col rounded-2xl border border-slate-800 bg-[#20252E] p-6 shadow-sm hover:border-slate-700 transition-all">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#2962FF]/15 border border-[#2962FF]/40 text-2xl font-black text-[#2962FF]">
              1
            </div>
            <h3 className="mt-4 text-lg font-bold text-white">Create your trip</h3>
            <p className="mt-2 text-sm text-slate-300 leading-relaxed">
              Select your departure and return dates (18–60 hours), group size (1–10), and per-person budget (₹1,000–₹30,000).
            </p>
            <div className="mt-4 pt-3 border-t border-slate-800 text-xs font-semibold text-blue-400">
              Step 1 of 4: When are we hitting the road?
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex flex-col rounded-2xl border border-slate-800 bg-[#20252E] p-6 shadow-sm hover:border-slate-700 transition-all">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#2962FF]/15 border border-[#2962FF]/40 text-2xl font-black text-[#2962FF]">
              2
            </div>
            <h3 className="mt-4 text-lg font-bold text-white">Plan the journey</h3>
            <p className="mt-2 text-sm text-slate-300 leading-relaxed">
              Compare 4 proven escapes side-by-side. Choose your travel pace, view usable destination leisure time, and adjust driving times for your area.
            </p>
            <div className="mt-4 pt-3 border-t border-slate-800 text-xs font-semibold text-blue-400">
              Step 2 of 4: Where should we escape to?
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex flex-col rounded-2xl border border-slate-800 bg-[#20252E] p-6 shadow-sm hover:border-slate-700 transition-all">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#2962FF]/15 border border-[#2962FF]/40 text-2xl font-black text-[#2962FF]">
              3
            </div>
            <h3 className="mt-4 text-lg font-bold text-white">Review and share</h3>
            <p className="mt-2 text-sm text-slate-300 leading-relaxed">
              Inspect the hour-by-hour itinerary, add highway pitstops like Maddur Tiffanys, save locally without an account, and invite friends via WhatsApp RSVP.
            </p>
            <div className="mt-4 pt-3 border-t border-slate-800 text-xs font-semibold text-blue-400">
              Steps 3 & 4: Explore & Hit the Road
            </div>
          </div>
        </div>
      </section>

      {/* Destination Preview Cards */}
      <section className="space-y-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-blue-400">Curated Destinations</p>
            <h2 className="mt-1 text-2xl font-black text-white sm:text-3xl">
              Four verified escapes from Bengaluru
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Grounded with real highway corridors, verified opening hours, and geographic waypoints.
            </p>
          </div>
          <Link
            to="/plan"
            className="text-sm font-bold text-blue-400 hover:text-blue-300 hover:underline"
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
                className="flex flex-col overflow-hidden rounded-2xl border border-slate-800 bg-[#20252E] shadow-sm hover:border-slate-700 hover:shadow-lg transition-all group"
              >
                <div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-900">
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
                    <div className="absolute bottom-2 right-2 rounded bg-black/75 px-1.5 py-0.5 text-[9px] text-white/90 backdrop-blur-sm pointer-events-none">
                      {img.license}
                    </div>
                  )}
                </div>

                <div className="flex flex-1 flex-col p-4">
                  <h3 className="text-lg font-bold text-white">{d.name}</h3>
                  <p className="text-xs text-blue-400 font-semibold mt-0.5">
                    {d.routeName} · {d.oneWayDistanceKm} km
                  </p>
                  <p className="mt-2 text-xs text-slate-300 leading-relaxed flex-1">
                    {d.activities.map(a => a.name).join(', ')}
                  </p>

                  <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">
                      ~{Math.round(d.baselineOneWayDriveMinutes / 60)}h base drive
                    </span>
                    <Link
                      to="/plan"
                      className="text-xs font-bold text-blue-400 group-hover:text-blue-300 group-hover:underline"
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
      <section className="rounded-2xl border border-blue-900/40 bg-blue-950/20 p-6 text-xs text-slate-300 space-y-2 leading-relaxed">
        <div className="flex items-center gap-2 font-bold text-blue-400 text-sm">
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
      <section className="rounded-2xl border border-slate-800 bg-[#20252E] text-white p-8 text-center space-y-4">
        <h2 className="text-2xl font-black sm:text-3xl">Ready to test your weekend reality?</h2>
        <p className="text-sm text-slate-300 max-w-xl mx-auto leading-relaxed">
          It takes less than 60 seconds to set your limits, see usable destination free time, and send an invitation to your friends.
        </p>
        <div className="pt-2">
          <Link
            to="/plan"
            className="inline-flex items-center gap-2 rounded-xl bg-[#2962FF] px-8 py-3.5 text-base font-bold text-white shadow-lg shadow-[#2962FF]/40 hover:bg-blue-600 active:scale-[0.99] transition-all cursor-pointer"
          >
            Start Planning Now →
          </Link>
        </div>
      </section>
    </div>
  );
}
