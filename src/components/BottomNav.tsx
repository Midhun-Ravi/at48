import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router';
import { DESTINATIONS } from '../data/destinations';
import { getDestinationImage } from '../data/images';
import { getSavedTrips, deleteSavedTrip, type SavedTrip } from '../utils/savedTrips';
import { CANDIDATE_DESTINATIONS } from '../engine/recommendations';

export default function BottomNav() {
  const location = useLocation();
  const [activeModal, setActiveModal] = useState<'explore' | 'mytrip' | 'help' | null>(null);
  const [savedTrips, setSavedTrips] = useState<SavedTrip[]>([]);

  useEffect(() => {
    if (activeModal === 'mytrip') {
      setSavedTrips(getSavedTrips());
    }
  }, [activeModal]);

  const handleDelete = (id: string) => {
    const remaining = deleteSavedTrip(id);
    setSavedTrips(remaining);
  };

  const closeModal = () => setActiveModal(null);

  return (
    <>
      {/* Floating Bottom Navigation Bar */}
      <nav
        aria-label="Mobile Navigation"
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[92%] max-w-md rounded-2xl border border-[#E1ECF2] bg-white/95 backdrop-blur-md px-3 py-2 shadow-xl mb-[env(safe-area-inset-bottom)]"
      >
        <div className="flex items-center justify-around">
          {/* Home */}
          <Link
            to="/"
            onClick={closeModal}
            className={`flex flex-col items-center gap-1 py-1 px-2 rounded-xl text-[11px] font-medium transition-colors ${
              location.pathname === '/' && !activeModal
                ? 'text-[#176EA8] font-bold'
                : 'text-[#5A7184] hover:text-[#193953]'
            }`}
          >
            <span className="text-lg leading-none">🏠</span>
            <span>Home</span>
          </Link>

          {/* Explore */}
          <button
            type="button"
            onClick={() => setActiveModal(activeModal === 'explore' ? null : 'explore')}
            className={`flex flex-col items-center gap-1 py-1 px-2 rounded-xl text-[11px] font-medium transition-colors cursor-pointer ${
              activeModal === 'explore'
                ? 'text-[#176EA8] font-bold'
                : 'text-[#5A7184] hover:text-[#193953]'
            }`}
          >
            <span className="text-lg leading-none">🧭</span>
            <span>Explore</span>
          </button>

          {/* Plan (Center Prominent CTA) */}
          <Link
            to="/plan"
            onClick={closeModal}
            className="flex flex-col items-center -mt-5 group"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#176EA8] text-white shadow-lg shadow-[#176EA8]/40 border-2 border-white group-hover:bg-[#135a8a] group-active:scale-95 transition-all">
              <span className="text-xl font-black leading-none">+</span>
            </div>
            <span className="text-[11px] font-bold text-[#193953] mt-1">Plan</span>
          </Link>

          {/* My Trip */}
          <button
            type="button"
            onClick={() => setActiveModal(activeModal === 'mytrip' ? null : 'mytrip')}
            className={`flex flex-col items-center gap-1 py-1 px-2 rounded-xl text-[11px] font-medium transition-colors cursor-pointer ${
              activeModal === 'mytrip'
                ? 'text-[#176EA8] font-bold'
                : 'text-[#5A7184] hover:text-[#193953]'
            }`}
          >
            <span className="text-lg leading-none">🎒</span>
            <span>My Trip</span>
          </button>

          {/* Help */}
          <button
            type="button"
            onClick={() => setActiveModal(activeModal === 'help' ? null : 'help')}
            className={`flex flex-col items-center gap-1 py-1 px-2 rounded-xl text-[11px] font-medium transition-colors cursor-pointer ${
              activeModal === 'help'
                ? 'text-[#176EA8] font-bold'
                : 'text-[#5A7184] hover:text-[#193953]'
            }`}
          >
            <span className="text-lg leading-none">💡</span>
            <span>Help</span>
          </button>
        </div>
      </nav>

      {/* Explore Modal */}
      {activeModal === 'explore' && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-3 animate-fadeIn">
          <div className="w-full max-w-xl max-h-[85vh] overflow-y-auto rounded-3xl border border-[#E1ECF2] bg-white text-[#193953] p-5 sm:p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-[#E1ECF2] pb-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#176EA8]">Destination Directory</span>
                <h3 className="text-xl font-black text-[#193953]">Bengaluru Weekend Escapes</h3>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-full bg-[#F4F9FC] p-2 text-[#5A7184] hover:text-[#193953] transition-colors cursor-pointer"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                    4 Verified & Schedulable Corridors
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {DESTINATIONS.map(d => {
                    const img = getDestinationImage(d.id);
                    return (
                      <div
                        key={d.id}
                        className="overflow-hidden rounded-xl border border-[#E1ECF2] bg-[#F4F9FC] hover:bg-[#DDF0F6]/40 transition-colors p-3 flex flex-col justify-between"
                      >
                        <div className="flex items-start gap-3">
                          {img && (
                            <img
                              src={img.src}
                              alt={img.alt}
                              className="h-12 w-12 rounded-lg object-cover flex-shrink-0"
                            />
                          )}
                          <div className="min-w-0">
                            <h4 className="text-sm font-bold text-[#193953] truncate">{d.name}</h4>
                            <p className="text-[11px] text-[#5A7184] truncate">{d.routeName}</p>
                            <p className="text-[10px] text-[#176EA8]">~{d.oneWayDistanceKm} km · ~{Math.round(d.baselineOneWayDriveMinutes / 60)}h base drive</p>
                          </div>
                        </div>
                        <Link
                          to="/plan"
                          onClick={closeModal}
                          className="mt-2.5 inline-block text-center rounded-lg bg-[#176EA8] text-white hover:bg-[#135a8a] py-1 text-xs font-bold transition-colors"
                        >
                          Plan Trip →
                        </Link>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2 pt-2 border-t border-[#E1ECF2]">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#176EA8]">
                    More escapes to explore (8 Curated Destinations)
                  </span>
                </div>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {CANDIDATE_DESTINATIONS.map(c => (
                    <div
                      key={c.id}
                      className="rounded-xl border border-[#E1ECF2] bg-white p-3 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#193953]">{c.name}</span>
                        <span className="rounded bg-[#DDF0F6] text-[#176EA8] border border-[#BAE3F1] px-1.5 py-0.5 text-[9px] font-bold">
                          Trip Inspiration
                        </span>
                      </div>
                      <p className="text-[11px] text-[#5A7184]">{c.routeName} ({c.approxDriveLabel})</p>
                      <p className="text-[10px] text-[#5A7184]/80 leading-snug">{c.highlights}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* My Trip Modal */}
      {activeModal === 'mytrip' && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-3 animate-fadeIn">
          <div className="w-full max-w-xl max-h-[85vh] overflow-y-auto rounded-3xl border border-[#E1ECF2] bg-white text-[#193953] p-5 sm:p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-[#E1ECF2] pb-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#176EA8]">Local Device Storage</span>
                <h3 className="text-xl font-black text-[#193953]">My Saved Trips</h3>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-full bg-[#F4F9FC] p-2 text-[#5A7184] hover:text-[#193953] transition-colors cursor-pointer"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {savedTrips.length === 0 ? (
              <div className="py-8 text-center space-y-3">
                <span className="text-4xl">🎒</span>
                <p className="text-base font-bold text-[#193953]">No saved trips on this device yet.</p>
                <p className="text-xs text-[#5A7184] max-w-sm mx-auto leading-relaxed">
                  When you review your road trip on Step 4, click <strong>"Save My Trip"</strong> to bookmark it here without creating an account.
                </p>
                <Link
                  to="/plan"
                  onClick={closeModal}
                  className="inline-block rounded-xl bg-[#176EA8] px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-[#135a8a] transition-colors"
                >
                  Create a New Trip →
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {savedTrips.map(trip => (
                  <div
                    key={trip.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-[#E1ECF2] bg-[#F4F9FC] p-4 hover:bg-[#DDF0F6]/30 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-base font-bold text-[#193953]">{trip.destinationName}</h4>
                        <span className="rounded bg-[#DDF0F6] text-[#176EA8] border border-[#176EA8]/30 text-[10px] font-semibold px-2 py-0.5">
                          {trip.planningMode === 'solo' ? 'Solo' : `${trip.partySize} travelers`}
                        </span>
                      </div>
                      <p className="text-xs text-[#5A7184]">
                        {trip.departureDateTime.slice(0, 10)} to {trip.returnDeadlineDateTime.slice(0, 10)}
                      </p>
                      <p className="text-[11px] text-[#5A7184]">
                        Budget: ₹{trip.perPersonBudgetINR.toLocaleString('en-IN')} / person · Pace: {trip.pace}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#E1ECF2]">
                      <a
                        href={trip.shareUrl}
                        className="rounded-xl bg-[#176EA8] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[#135a8a] transition-colors cursor-pointer"
                      >
                        Open Plan →
                      </a>
                      <button
                        type="button"
                        onClick={() => handleDelete(trip.id)}
                        className="rounded-xl border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100 transition-colors cursor-pointer"
                        title="Delete saved trip"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Help & About Modal */}
      {activeModal === 'help' && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-3 animate-fadeIn">
          <div className="w-full max-w-xl max-h-[85vh] overflow-y-auto rounded-3xl border border-[#E1ECF2] bg-white text-[#193953] p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#E1ECF2] pb-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#176EA8]">About @48</span>
                <h3 className="text-xl font-black text-[#193953]">How It Works</h3>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-full bg-[#F4F9FC] p-2 text-[#5A7184] hover:text-[#193953] transition-colors cursor-pointer"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs text-[#5A7184] leading-relaxed">
              <div className="rounded-xl bg-[#F4F9FC] border border-[#E1ECF2] p-3 space-y-1">
                <strong className="text-sm font-bold text-[#193953] block">1. Deterministic Scheduling</strong>
                <p>
                  No fake optimistic travel times. All schedules calculate driving buffers (20%), highway slip-road detours, dining breaks, and official attraction operating hours in Asia/Kolkata timezone.
                </p>
              </div>

              <div className="rounded-xl bg-[#F4F9FC] border border-[#E1ECF2] p-3 space-y-1">
                <strong className="text-sm font-bold text-[#193953] block">2. Verified Highway Pitstops & Road Geometry</strong>
                <p>
                  Highway food stops (Maddur Tiffanys, Kamat Lokaruchi, Shivalli, Empire, etc.) are verified on OpenStreetMap with real slip-road detours and dietary classifications. Road geometry is powered by OSRM driving graphs.
                </p>
              </div>

              <div className="rounded-xl bg-[#F4F9FC] border border-[#E1ECF2] p-3 space-y-1">
                <strong className="text-sm font-bold text-[#193953] block">3. 100% Stateless & Shareable</strong>
                <p>
                  No account, sign-in, or database required. Your full trip configuration, including custom planned activities and pitstops, is encoded into shareable URLs and WhatsApp invitation links.
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-[#E1ECF2] text-center">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-xl bg-[#176EA8] px-6 py-2.5 text-xs font-bold text-white hover:bg-[#135a8a] transition-colors cursor-pointer"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
