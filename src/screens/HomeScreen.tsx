import { Link } from 'react-router';
import { DESTINATIONS } from '../data/destinations';
import { getDestinationImage } from '../data/images';

export default function HomeScreen() {
  const heroImage = getDestinationImage('coorg-madikeri');

  return (
    <div className="space-y-16 pb-12">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl border border-[#E1ECF2] bg-white text-[#193953] shadow-md p-6 sm:p-10 md:p-12">
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 opacity-40 bg-[radial-gradient(#176EA8_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />

        <div className="relative mx-auto grid max-w-5xl gap-8 md:grid-cols-12 md:items-center">
          <div className="space-y-5 md:col-span-7">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#DDF0F6] border border-[#BAE3F1] px-3.5 py-1 text-xs font-bold text-[#176EA8]">
              <span className="flex h-2 w-2 rounded-full bg-[#176EA8] animate-pulse" />
              Bengaluru Weekend Escapes · 1 to 4 Calendar Days
            </div>

            <h1 className="text-3xl font-black tracking-tight sm:text-4xl md:text-5xl leading-[1.15] text-[#193953]">
              Road trips,{' '}
              <span className="text-[#176EA8] underline decoration-[#FF9870] underline-offset-6">
                without the guesswork.
              </span>
            </h1>

            <p className="text-base text-[#5A7184] leading-relaxed max-w-lg">
              Set your departure and firm return deadline. @48 models your real highway driving, curated pitstops, and landmark operating hours deterministically.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Link
                to="/plan"
                className="flex items-center justify-center gap-2 rounded-xl bg-[#176EA8] px-6 py-3.5 text-base font-bold text-white shadow-md shadow-[#176EA8]/20 hover:bg-[#135A8A] active:scale-[0.99] transition-all cursor-pointer"
              >
                Plan My Road Trip →
              </Link>

              <a
                href="#how-it-works"
                className="inline-flex items-center justify-center rounded-xl border border-[#E1ECF2] bg-[#F0F6FA] px-5 py-3.5 text-sm font-semibold text-[#193953] hover:bg-[#DDF0F6] transition-all cursor-pointer"
              >
                How It Works ↓
              </a>
            </div>

            <div className="pt-2 flex flex-wrap items-center gap-4 text-xs text-[#5A7184]">
              <span className="font-semibold text-[#193953]">✓ 100% Free & Account-Free</span>
              <span>•</span>
              <span className="font-semibold text-[#193953]">✓ WhatsApp Group RSVP</span>
              <span>•</span>
              <span className="font-semibold text-[#193953]">✓ Stop-Aware Itinerary</span>
            </div>
          </div>

          {/* Hero Visual Card */}
          <div className="md:col-span-5">
            <div className="relative overflow-hidden rounded-2xl border border-[#E1ECF2] bg-white shadow-lg group">
              <div className="aspect-[4/3] w-full overflow-hidden bg-slate-100">
                {heroImage && (
                  <img
                    src={heroImage.src}
                    alt={heroImage.alt}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                )}
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent pointer-events-none" />
              <div className="absolute bottom-3 left-3 right-3 text-white">
                <span className="rounded bg-[#176EA8] px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
                  Featured Corridor
                </span>
                <p className="mt-1 text-sm font-bold">Western Ghats & Mysuru Expressway</p>
                <p className="text-[11px] text-blue-100">
                  Calculated from MG Road, Bengaluru with 20% contingency buffers.
                </p>
                {heroImage && (
                  <p className="mt-1 text-[9px] text-white/80">
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
          <p className="text-xs font-bold uppercase tracking-widest text-[#176EA8]">How It Works</p>
          <h2 className="text-2xl font-black text-[#193953] sm:text-3xl">
            A reality check before you start the car
          </h2>
          <p className="text-sm text-[#5A7184]">
            Most weekend road trips fail because navigation apps show best-case travel times. @48 models your real limits deterministically.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {/* Step 1 */}
          <div className="flex flex-col rounded-2xl border border-[#E1ECF2] bg-white p-6 shadow-sm hover:border-[#BAE3F1] hover:shadow-md transition-all">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#DDF0F6] border border-[#BAE3F1] text-2xl font-black text-[#176EA8]">
              1
            </div>
            <h3 className="mt-4 text-lg font-bold text-[#193953]">Create your trip</h3>
            <p className="mt-2 text-sm text-[#5A7184] leading-relaxed">
              Select your departure and return dates (1 to 4 calendar days), group size (1–10), and per-person budget (₹1,000–₹30,000).
            </p>
            <div className="mt-4 pt-3 border-t border-[#E1ECF2] text-xs font-semibold text-[#176EA8]">
              Step 1 of 4: When are we hitting the road?
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex flex-col rounded-2xl border border-[#E1ECF2] bg-white p-6 shadow-sm hover:border-[#BAE3F1] hover:shadow-md transition-all">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#DDF0F6] border border-[#BAE3F1] text-2xl font-black text-[#176EA8]">
              2
            </div>
            <h3 className="mt-4 text-lg font-bold text-[#193953]">Plan the journey</h3>
            <p className="mt-2 text-sm text-[#5A7184] leading-relaxed">
              Compare 4 proven escapes side-by-side. Choose your travel pace, view usable destination leisure time, and adjust driving times for your area.
            </p>
            <div className="mt-4 pt-3 border-t border-[#E1ECF2] text-xs font-semibold text-[#176EA8]">
              Step 2 of 4: Where should we escape to?
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex flex-col rounded-2xl border border-[#E1ECF2] bg-white p-6 shadow-sm hover:border-[#BAE3F1] hover:shadow-md transition-all">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#DDF0F6] border border-[#BAE3F1] text-2xl font-black text-[#176EA8]">
              3
            </div>
            <h3 className="mt-4 text-lg font-bold text-[#193953]">Review and share</h3>
            <p className="mt-2 text-sm text-[#5A7184] leading-relaxed">
              Inspect the hour-by-hour itinerary, add highway pitstops like Maddur Tiffanys, save locally without an account, and invite friends via WhatsApp RSVP.
            </p>
            <div className="mt-4 pt-3 border-t border-[#E1ECF2] text-xs font-semibold text-[#176EA8]">
              Steps 3 & 4: Explore & Hit the Road
            </div>
          </div>
        </div>
      </section>

      {/* Destination Preview Cards */}
      <section className="space-y-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[#176EA8]">Curated Destinations</p>
            <h2 className="mt-1 text-2xl font-black text-[#193953] sm:text-3xl">
              Four verified escapes from Bengaluru
            </h2>
            <p className="mt-1 text-sm text-[#5A7184]">
              Grounded with real highway corridors, verified opening hours, and geographic waypoints.
            </p>
          </div>
          <Link
            to="/plan"
            className="text-sm font-bold text-[#176EA8] hover:text-[#135A8A] hover:underline"
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
                className="flex flex-col overflow-hidden rounded-2xl border border-[#E1ECF2] bg-white shadow-sm hover:border-[#BAE3F1] hover:shadow-md transition-all group"
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
                    <div className="absolute bottom-2 right-2 rounded bg-black/75 px-1.5 py-0.5 text-[9px] text-white/90 backdrop-blur-sm pointer-events-none">
                      {img.license}
                    </div>
                  )}
                </div>

                <div className="flex flex-1 flex-col p-4">
                  <h3 className="text-lg font-bold text-[#193953]">{d.name}</h3>
                  <p className="text-xs text-[#176EA8] font-semibold mt-0.5">
                    {d.routeName} · {d.oneWayDistanceKm} km
                  </p>
                  <p className="mt-2 text-xs text-[#5A7184] leading-relaxed flex-1">
                    {d.activities.map(a => a.name).join(', ')}
                  </p>

                  <div className="mt-4 pt-3 border-t border-[#E1ECF2] flex items-center justify-between">
                    <span className="text-[11px] text-[#5A7184]">
                      ~{Math.round(d.baselineOneWayDriveMinutes / 60)}h base drive
                    </span>
                    <Link
                      to="/plan"
                      className="text-xs font-bold text-[#176EA8] group-hover:text-[#135A8A] group-hover:underline"
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
      <section className="rounded-2xl border border-[#BAE3F1] bg-[#F0F6FA] p-6 text-xs text-[#193953] space-y-2 leading-relaxed">
        <div className="flex items-center gap-2 font-bold text-[#176EA8] text-sm">
          <span>ℹ️</span>
          <span>Transparency & Planning Scope</span>
        </div>
        <p>
          <strong>Planning estimates only:</strong> @48 models weekend road trips originating from MG Road, Bengaluru with declared highway corridors and conservative 20% travel buffers. It does <em>not</em> claim live GPS routing, live traffic forecasting, or hotel availability.
        </p>
        <p>
          <strong>Supported window:</strong> Escapes between 1 and 4 calendar dates. Operating hours and night-driving restrictions (such as Bandipur National Park) are validated against published operator rules. Always verify road conditions before departing.
        </p>
      </section>

      {/* Bottom CTA Banner */}
      <section className="rounded-2xl border border-[#E1ECF2] bg-white text-[#193953] p-8 text-center space-y-4 shadow-sm">
        <h2 className="text-2xl font-black sm:text-3xl">Ready to test your weekend reality?</h2>
        <p className="text-sm text-[#5A7184] max-w-xl mx-auto leading-relaxed">
          It takes less than 60 seconds to set your limits, see usable destination free time, and send an invitation to your friends.
        </p>
        <div className="pt-2">
          <Link
            to="/plan"
            className="inline-flex items-center gap-2 rounded-xl bg-[#176EA8] px-8 py-3.5 text-base font-bold text-white shadow-md shadow-[#176EA8]/20 hover:bg-[#135A8A] active:scale-[0.99] transition-all cursor-pointer"
          >
            Start Planning Now →
          </Link>
        </div>
      </section>
    </div>
  );
}
