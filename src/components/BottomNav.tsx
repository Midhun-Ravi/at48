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
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[92%] max-w-md rounded-2xl border border-[#EADBCE] bg-white/95 backdrop-blur-md px-3 py-2 shadow-xl mb-[env(safe-area-inset-bottom)]"
      >
        <div className="flex items-center justify-around">
          {/* Home */}
          <Link
            to="/"
            onClick={closeModal}
            className={`flex flex-col items-center gap-1 py-1 px-2 rounded-xl text-[11px] font-medium transition-colors ${
              location.pathname === '/' && !activeModal
                ? 'text-[#C65B32] font-bold'
                : 'text-[#6B7C77] hover:text-[#344F48]'
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
                ? 'text-[#C65B32] font-bold'
                : 'text-[#6B7C77] hover:text-[#344F48]'
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
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#C65B32] text-white shadow-lg shadow-[#C65B32]/30 border-2 border-white group-hover:bg-[#B04E27] group-active:scale-95 transition-all">
              <span className="text-xl font-black leading-none">+</span>
            </div>
            <span className="text-[11px] font-bold text-[#344F48] mt-1">Plan</span>
          </Link>

          {/* My Trip */}
          <button
            type="button"
            onClick={() => setActiveModal(activeModal === 'mytrip' ? null : 'mytrip')}
            className={`flex flex-col items-center gap-1 py-1 px-2 rounded-xl text-[11px] font-medium transition-colors cursor-pointer ${
              activeModal === 'mytrip'
                ? 'text-[#C65B32] font-bold'
                : 'text-[#6B7C77] hover:text-[#344F48]'
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
                ? 'text-[#C65B32] font-bold'
                : 'text-[#6B7C77] hover:text-[#344F48]'
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
          <div className="w-full max-w-xl max-h-[85vh] overflow-y-auto rounded-3xl border border-[#EADBCE] bg-white text-[#344F48] p-5 sm:p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-[#EADBCE] pb-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#C65B32]">Destination Directory</span>
                <h3 className="text-xl font-black text-[#344F48]">Bengaluru Weekend Escapes</h3>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-full bg-[#FAF2EB] p-2 text-[#6B7C77] hover:text-[#344F48] transition-colors cursor-pointer"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="flex h-2 w-2 rounded-full bg-emerald-600 animate-pulse" />
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
                        className="overflow-hidden rounded-xl border border-[#EADBCE] bg-[#FAF2EB] hover:bg-[#F8E1D2]/40 transition-colors p-3 flex flex-col justify-between"
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
                            <h4 className="text-sm font-bold text-[#344F48] truncate">{d.name}</h4>
                            <p className="text-[11px] text-[#6B7C77] truncate">{d.routeName}</p>
                            <p className="text-[10px] text-[#C65B32]">~{d.oneWayDistanceKm} km · ~{Math.round(d.baselineOneWayDriveMinutes / 60)}h base drive</p>
                          </div>
                        </div>
                        <Link
                          to={`/schedule/${d.id}`}
                          onClick={closeModal}
                          className="mt-2.5 inline-block text-center rounded-lg bg-[#C65B32] text-white hover:bg-[#B04E27] py-1 text-xs font-bold transition-colors"
                        >
                          Plan Trip →
                        </Link>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2 pt-2 border-t border-[#EADBCE]">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#C65B32]">
                    More Escapes to Explore (8 Additional Ideas)
                  </span>
                </div>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {CANDIDATE_DESTINATIONS.map(c => (
                    <div
                      key={c.id}
                      className="rounded-xl border border-[#EADBCE] bg-white p-3 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#344F48]">{c.name}</span>
                        <span className="rounded bg-[#F8E1D2] text-[#C65B32] border border-[#EADBCE] px-1.5 py-0.5 text-[9px] font-bold">
                          Trip Idea
                        </span>
                      </div>
                      <p className="text-[11px] text-[#6B7C77]">{c.routeName} ({c.approxDriveLabel})</p>
                      <p className="text-[10px] text-[#6B7C77]/80 leading-snug">{c.highlights}</p>
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
          <div className="w-full max-w-xl max-h-[85vh] overflow-y-auto rounded-3xl border border-[#EADBCE] bg-white text-[#344F48] p-5 sm:p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-[#EADBCE] pb-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#C65B32]">Account-Free Storage</span>
                <h3 className="text-xl font-black text-[#344F48]">Saved Trips on This Device</h3>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-full bg-[#FAF2EB] p-2 text-[#6B7C77] hover:text-[#344F48] transition-colors cursor-pointer"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {savedTrips.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#EADBCE] p-8 text-center space-y-3">
                <span className="text-3xl">🎒</span>
                <h4 className="text-base font-bold text-[#344F48]">No saved trips yet</h4>
                <p className="text-xs text-[#6B7C77] max-w-xs mx-auto">
                  When you review a trip in Step 4, click "Save Trip to This Device" to keep your customized itinerary right here without an account.
                </p>
                <div className="pt-2">
                  <Link
                    to="/plan"
                    onClick={closeModal}
                    className="inline-block rounded-xl bg-[#C65B32] text-white px-4 py-2 text-xs font-bold hover:bg-[#B04E27] transition-colors"
                  >
                    Plan a New Trip →
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {savedTrips.map(trip => (
                  <div
                    key={trip.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-[#EADBCE] bg-[#FAF2EB] p-4 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <strong className="text-sm font-bold text-[#344F48]">{trip.destinationName}</strong>
                        {trip.organizerName && (
                          <span className="rounded bg-[#F8E1D2] px-2 py-0.5 text-[10px] font-bold text-[#C65B32]">
                            By {trip.organizerName}
                          </span>
                        )}
                      </div>
                      <p className="text-[#6B7C77]">
                        {trip.departureDateTime.slice(0, 10)} → {trip.returnDeadlineDateTime.slice(0, 10)} · {trip.partySize} {trip.partySize === 1 ? 'traveler' : 'travelers'}
                      </p>
                      <p className="text-[10px] text-[#6B7C77]">
                        Budget: ₹{trip.perPersonBudgetINR.toLocaleString('en-IN')}/person · Saved {new Date(trip.savedAt).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Link
                        to={trip.shareUrl ? trip.shareUrl.replace(/^[a-z]+:\/\/[^/]+/i, '') : `/schedule/${trip.destinationId}`}
                        onClick={closeModal}
                        className="rounded-lg bg-[#C65B32] text-white px-3 py-1.5 font-bold hover:bg-[#B04E27] transition-colors text-center"
                      >
                        Open Itinerary
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDelete(trip.id)}
                        className="rounded-lg border border-[#EADBCE] bg-white px-2.5 py-1.5 text-red-600 hover:bg-red-50 font-bold transition-colors cursor-pointer"
                        title="Delete saved trip"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Help Modal */}
      {activeModal === 'help' && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-3 animate-fadeIn">
          <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-3xl border border-[#EADBCE] bg-white text-[#344F48] p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#EADBCE] pb-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#C65B32]">How @48 Works</span>
                <h3 className="text-xl font-black text-[#344F48]">Help & Reality-Check Guide</h3>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-full bg-[#FAF2EB] p-2 text-[#6B7C77] hover:text-[#344F48] transition-colors cursor-pointer"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs leading-relaxed text-[#6B7C77]">
              <div className="rounded-xl bg-[#FAF2EB] p-3 space-y-1">
                <h4 className="font-bold text-[#344F48]">⏱️ Why are travel times longer than GPS navigation?</h4>
                <p>
                  Navigation apps show best-case driving times with no stops. @48 adds mandatory 20% highway contingency buffers, handles ghat climbs, and checks checkpoint curfews (such as Bandipur NH 766 21:00 cutoff) so you arrive home on schedule.
                </p>
              </div>

              <div className="rounded-xl bg-[#FAF2EB] p-3 space-y-1">
                <h4 className="font-bold text-[#344F48]">👥 Group Travel & Vehicle Fleet Scaling</h4>
                <p>
                  Groups of 1–4 are modeled as a standard car. Groups of 5–6 are modeled as an SUV. Groups of 7+ automatically scale fuel and toll allowances for a multi-car convoy or a Tempo Traveller arrangement.
                </p>
              </div>

              <div className="rounded-xl bg-[#FAF2EB] p-3 space-y-1">
                <h4 className="font-bold text-[#344F48]">💰 How are trip expenses calculated?</h4>
                <p>
                  We model round-trip fuel, toll plaza charges, hotel stays (twin-sharing rooms), and official landmark entry tickets. Food and shopping are personal choices and excluded from automated estimates.
                </p>
              </div>

              <div className="rounded-xl bg-[#FAF2EB] p-3 space-y-1">
                <h4 className="font-bold text-[#344F48]">🔒 Zero Accounts & Privacy</h4>
                <p>
                  @48 requires no login, passwords, cookies, or phone numbers. Saved trips live only in your browser's private localStorage. Share links encode all itinerary parameters cleanly into the URL.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
