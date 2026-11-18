import { Link } from 'react-router';
import { DESTINATIONS } from '../data/destinations';
import { getDestinationImage } from '../data/images';
import TrustNote from '../components/TrustNote';
import HowItWorksAnimation from '../components/HowItWorksAnimation';
import TactileButton from '../components/ui/TactileButton';
import ScenicBackground from '../components/scenic/ScenicBackground';

export default function HomeScreen() {
  return (
    <div className="space-y-12 sm:space-y-16 pb-12">
      {/* Center-Aligned Hero Section with Scenic 2D Background */}
      <section className="relative overflow-hidden rounded-3xl border border-[#EADBCE] bg-white text-[#344F48] shadow-sm p-6 sm:p-10 md:p-14 text-center">
        {/* Scenic Background Layer */}
        <ScenicBackground variant="hero" />

        <div className="relative z-10 mx-auto max-w-3xl space-y-5 sm:space-y-6 flex flex-col items-center">
          {/* Badge */}
          <div className="inline-flex items-center justify-center text-center gap-2 rounded-full bg-[#F8E1D2] border border-[#EADBCE] px-4 py-1.5 text-xs font-bold text-[#C65B32] shadow-2xs max-w-full">
            <span className="flex h-2 w-2 shrink-0 rounded-full bg-[#C65B32] animate-pulse" />
            <span>Bengaluru Weekend Escapes · 1 to 4 Days</span>
          </div>

          {/* Center-aligned headline */}
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight leading-[1.12] text-[#344F48]">
            Road trips,{' '}
            <span className="text-[#C65B32] underline decoration-[#F8E1D2] underline-offset-8">
              without guesswork.
            </span>
          </h1>

          {/* Center-aligned explanatory text */}
          <p className="text-base sm:text-lg text-[#6B7C77] leading-relaxed max-w-2xl mx-auto px-1">
            Set your departure time and firm return deadline in Indian Standard Time (IST). @48 models your real highway driving,
            mandatory 20% traffic buffers, landmark operating hours, and return margin deterministically—before you start the car.
          </p>

          {/* Center-aligned tactile primary & secondary CTAs */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 pt-2 w-full sm:w-auto">
            <TactileButton
              variant="primary"
              size="lg"
              to="/plan"
              className="w-full sm:w-auto text-center"
            >
              Plan Weekend Road Trip →
            </TactileButton>

            <TactileButton
              variant="secondary"
              size="lg"
              href="#how-it-works"
              className="w-full sm:w-auto text-center"
            >
              How It Works ↓
            </TactileButton>

            <TactileButton
              variant="forest"
              size="lg"
              to="/compare"
              className="w-full sm:w-auto text-center"
            >
              Compare Escapes →
            </TactileButton>
          </div>

          {/* Trust badges */}
          <div className="pt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-xs text-[#6B7C77]">
            <span className="font-bold text-[#344F48]">✓ 100% Free & Account-Free</span>
            <span>•</span>
            <span className="font-bold text-[#344F48]">✓ 20% Highway Contingency Buffers</span>
            <span>•</span>
            <span className="font-bold text-[#344F48]">✓ Deterministic Return Feasibility</span>
            <span>•</span>
            <span className="font-bold text-[#344F48]">✓ WhatsApp Group RSVP</span>
          </div>
        </div>
      </section>

      {/* 2D Animated "How @48 Works" Explainer Section */}
      <section id="how-it-works" className="scroll-mt-20">
        <HowItWorksAnimation />
      </section>

      {/* Curated Destination Highlights */}
      <section className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[#C65B32]">Curated Escapes</p>
            <h2 className="mt-1 text-2xl font-black text-[#344F48] sm:text-3xl">
              Four verified corridors from Bengaluru
            </h2>
            <p className="mt-1 text-sm text-[#6B7C77]">
              Grounded with real highway waypoints, verified opening hours, and geographic coordinates.
            </p>
          </div>
          <Link
            to="/compare"
            className="text-sm font-bold text-[#C65B32] hover:text-[#B04E27] hover:underline"
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
                className="flex flex-col overflow-hidden rounded-2xl border border-[#EADBCE] bg-white shadow-xs hover:border-[#C65B32] hover:shadow-md transition-all group"
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
                  <h3 className="text-lg font-bold text-[#344F48]">{d.name}</h3>
                  <p className="text-xs text-[#C65B32] font-semibold mt-0.5">
                    {d.routeName} · {d.oneWayDistanceKm} km
                  </p>
                  <p className="mt-2 text-xs text-[#6B7C77] leading-relaxed flex-1">
                    {d.activities.map(a => a.name).join(', ')}
                  </p>

                  <div className="mt-4 pt-3 border-t border-[#EADBCE] flex items-center justify-between">
                    <span className="text-[11px] text-[#6B7C77]">
                      ~{Math.round(d.baselineOneWayDriveMinutes / 60)}h base drive
                    </span>
                    <TactileButton
                      variant="primary"
                      size="sm"
                      to={`/schedule/${d.id}`}
                    >
                      Plan Trip →
                    </TactileButton>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Expandable Trust Note */}
      <TrustNote />

      {/* Bottom CTA Banner */}
      <section className="rounded-3xl border border-[#EADBCE] bg-gradient-to-b from-[#F8E1D2]/40 to-white text-[#344F48] p-8 sm:p-10 text-center space-y-4 shadow-sm">
        <h2 className="text-2xl font-black sm:text-3xl text-[#344F48]">Ready to test your weekend reality?</h2>
        <p className="text-sm text-[#6B7C77] max-w-xl mx-auto leading-relaxed">
          It takes less than 60 seconds to set your limits, see usable destination free time, and send an invitation to your friends.
        </p>
        <div className="pt-2 flex justify-center">
          <TactileButton
            variant="primary"
            size="lg"
            to="/plan"
          >
            Start Planning Now →
          </TactileButton>
        </div>
      </section>
    </div>
  );
}
