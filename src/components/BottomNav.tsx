import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router';
import { DESTINATIONS } from '../data/destinations';
import { getDestinationImage } from '../data/images';
import { getSavedTrips, deleteSavedTrip, type SavedTrip } from '../utils/savedTrips';

// 8 Candidate Destinations in Curation (Grounded descriptions, honest Coming Soon status)
const COMING_SOON_DESTINATIONS = [
  {
    id: 'kabini',
    name: 'Kabini & Nagarhole',
    route: 'Mysuru Corridor · ~215 km',
    drive: '~5h',
    highlights: 'Wildlife safari corridor, forest reserve border',
  },
  {
    id: 'sakleshpur',
    name: 'Sakleshpur',
    route: 'NH 75 Hassan Highway · ~220 km',
    drive: '~4.5h',
    highlights: 'Manjarabad Star Fort, Western Ghats mist',
  },
  {
    id: 'chikmagalur',
    name: 'Chikmagalur',
    route: 'Hassan Corridor · ~245 km',
    drive: '~5h',
    highlights: 'Mullayanagiri peak, coffee plantation estates',
  },
  {
    id: 'yelagiri',
    name: 'Yelagiri Hills',
    route: 'NH 44 Krishnagiri Route · ~160 km',
    drive: '~3.5h',
    highlights: '14 hairpin bends, peaceful lake circuit',
  },
  {
    id: 'wayanad',
    name: 'Wayanad',
    route: 'Bandipur Forest Corridor · ~275 km',
    drive: '~6.5h',
    highlights: 'Edakkal Caves, Chembra Peak viewpoint',
  },
  {
    id: 'hampi',
    name: 'Hampi',
    route: 'NH 48 / NH 50 Chitradurga Route · ~340 km',
    drive: '~7h',
    highlights: 'Vijayanagara UNESCO ruins, Tungabhadra boulders',
  },
  {
    id: 'puducherry',
    name: 'Puducherry (Pondicherry)',
    route: 'Krishnagiri / Tiruvannamalai · ~310 km',
    drive: '~6.5h',
    highlights: 'French Quarter promenade, Auroville',
  },
  {
    id: 'shivanasamudra',
    name: 'Shivanasamudra Falls',
    route: 'Kanakapura Road / Malavalli · ~135 km',
    drive: '~3h',
    highlights: 'Gaganachukki & Bharachukki dual waterfalls',
  },
];

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
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[92%] max-w-md rounded-2xl border border-slate-700/60 bg-[#15191F]/95 backdrop-blur-md px-3 py-2 shadow-2xl shadow-black/80"
      >
        <div className="flex items-center justify-around">
          {/* Home */}
          <Link
            to="/"
            onClick={closeModal}
            className={`flex flex-col items-center gap-1 py-1 px-2 rounded-xl text-[11px] font-medium transition-colors ${
              location.pathname === '/' && !activeModal
                ? 'text-[#2962FF] font-bold'
                : 'text-slate-400 hover:text-slate-200'
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
                ? 'text-[#2962FF] font-bold'
                : 'text-slate-400 hover:text-slate-200'
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
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#2962FF] text-white shadow-lg shadow-[#2962FF]/50 border-2 border-[#15191F] group-hover:bg-blue-600 group-active:scale-95 transition-all">
              <span className="text-xl font-black leading-none">+</span>
            </div>
            <span className="text-[11px] font-bold text-white mt-1">Plan</span>
          </Link>

          {/* My Trip */}
          <button
            type="button"
            onClick={() => setActiveModal(activeModal === 'mytrip' ? null : 'mytrip')}
            className={`flex flex-col items-center gap-1 py-1 px-2 rounded-xl text-[11px] font-medium transition-colors cursor-pointer ${
              activeModal === 'mytrip'
                ? 'text-[#2962FF] font-bold'
                : 'text-slate-400 hover:text-slate-200'
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
                ? 'text-[#2962FF] font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="text-lg leading-none">💡</span>
            <span>Help</span>
          </button>
        </div>
      </nav>

      {/* Explore Modal */}
      {activeModal === 'explore' && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-3 animate-fadeIn">
          <div className="w-full max-w-xl max-h-[85vh] overflow-y-auto rounded-3xl border border-slate-700 bg-[#15191F] text-slate-100 p-5 sm:p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-blue-400">Destination Directory</span>
                <h3 className="text-xl font-black text-white">Bengaluru Weekend Escapes</h3>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-full bg-[#292F39] p-2 text-slate-300 hover:text-white transition-colors"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                    4 Verified & Schedulable Corridors
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {DESTINATIONS.map(d => {
                    const img = getDestinationImage(d.id);
                    return (
                      <div
                        key={d.id}
                        className="overflow-hidden rounded-xl border border-slate-700/60 bg-[#292F39]/50 hover:bg-[#292F39] transition-colors p-3 flex flex-col justify-between"
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
                            <h4 className="text-sm font-bold text-white truncate">{d.name}</h4>
                            <p className="text-[11px] text-slate-400 truncate">{d.routeName}</p>
                            <p className="text-[10px] text-blue-300">~{d.oneWayDistanceKm} km · ~{Math.round(d.baselineOneWayDriveMinutes / 60)}h base drive</p>
                          </div>
                        </div>
                        <Link
                          to="/plan"
                          onClick={closeModal}
                          className="mt-2.5 inline-block text-center rounded-lg bg-[#2962FF]/20 hover:bg-[#2962FF] border border-[#2962FF]/40 text-blue-300 hover:text-white py-1 text-xs font-bold transition-colors"
                        >
                          Plan Trip →
                        </Link>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2 pt-2 border-t border-slate-800">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                    8 Corridors In Curation (Coming Soon)
                  </span>
                </div>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {COMING_SOON_DESTINATIONS.map(c => (
                    <div
                      key={c.id}
                      className="rounded-xl border border-slate-800 bg-[#20252E] p-3 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-200">{c.name}</span>
                        <span className="rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 text-[9px] font-semibold">
                          In Curation
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">{c.route} ({c.drive})</p>
                      <p className="text-[10px] text-slate-500 leading-snug">{c.highlights}</p>
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
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-3 animate-fadeIn">
          <div className="w-full max-w-xl max-h-[85vh] overflow-y-auto rounded-3xl border border-slate-700 bg-[#15191F] text-slate-100 p-5 sm:p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-blue-400">Local Device Storage</span>
                <h3 className="text-xl font-black text-white">My Saved Trips</h3>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-full bg-[#292F39] p-2 text-slate-300 hover:text-white transition-colors"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {savedTrips.length === 0 ? (
              <div className="py-8 text-center space-y-3">
                <span className="text-4xl">🎒</span>
                <p className="text-base font-bold text-slate-200">No saved trips on this device yet.</p>
                <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                  When you review your road trip on Step 4, click <strong>"Save My Trip"</strong> to bookmark it here without creating an account.
                </p>
                <Link
                  to="/plan"
                  onClick={closeModal}
                  className="inline-block rounded-xl bg-[#2962FF] px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-blue-600 transition-colors"
                >
                  Create a New Trip →
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {savedTrips.map(trip => (
                  <div
                    key={trip.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-slate-700/70 bg-[#292F39]/50 p-4 hover:bg-[#292F39] transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-base font-bold text-white">{trip.destinationName}</h4>
                        <span className="rounded bg-blue-500/20 text-blue-300 text-[10px] font-semibold px-2 py-0.5">
                          {trip.planningMode === 'solo' ? 'Solo' : `${trip.partySize} travelers`}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">
                        {trip.departureDateTime.slice(0, 10)} to {trip.returnDeadlineDateTime.slice(0, 10)}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Budget: ₹{trip.perPersonBudgetINR.toLocaleString('en-IN')} / person · Pace: {trip.pace}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-700">
                      <a
                        href={trip.shareUrl}
                        onClick={closeModal}
                        className="rounded-lg bg-[#2962FF] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-blue-600 transition-colors"
                      >
                        Open Itinerary
                      </a>
                      <button
                        type="button"
                        onClick={() => handleDelete(trip.id)}
                        className="rounded-lg bg-red-950/40 hover:bg-red-900/60 border border-red-800/40 px-2.5 py-1.5 text-xs font-semibold text-red-300 transition-colors cursor-pointer"
                        title="Delete saved trip"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}

                <p className="text-[11px] text-slate-400 bg-slate-900/50 p-3 rounded-xl border border-slate-800">
                  ℹ️ <strong>Account-Free Storage:</strong> These trips are saved locally in your browser's local storage on this device. Clearing your browser cache will erase them. To transfer a trip to another phone or computer, share the WhatsApp link.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Help Modal */}
      {activeModal === 'help' && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-3 animate-fadeIn">
          <div className="w-full max-w-xl max-h-[85vh] overflow-y-auto rounded-3xl border border-slate-700 bg-[#15191F] text-slate-100 p-5 sm:p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-blue-400">Product FAQs</span>
                <h3 className="text-xl font-black text-white">How @48 Works</h3>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-full bg-[#292F39] p-2 text-slate-300 hover:text-white transition-colors"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs leading-relaxed text-slate-300">
              <div className="rounded-xl border border-slate-800 bg-[#20252E] p-3.5 space-y-1.5">
                <h4 className="font-bold text-white text-sm">Why 18–60 hours?</h4>
                <p>
                  Most Bengaluru weekend road trips cover a Friday night to Sunday evening or Saturday dawn to Sunday night window (18 to 60 hours). Within this range, @48 provides deterministic schedule verification. Extended multi-day itineraries (4+ days) are actively in curation.
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-[#20252E] p-3.5 space-y-1.5">
                <h4 className="font-bold text-white text-sm">Where does driving time start from?</h4>
                <p>
                  All baseline driving estimates use MG Road, Bengaluru as the geographic reference corridor. In Step 2, you can adjust each destination card independently by -60m to +120m to reflect your exact neighborhood (e.g. Whitefield vs Electronic City).
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-[#20252E] p-3.5 space-y-1.5">
                <h4 className="font-bold text-white text-sm">What makes feasibility deterministic?</h4>
                <p>
                  Unlike AI chatbots that guess schedules, @48 runs a rigorous mathematical engine that checks highway buffers (20% mandatory contingency), attraction opening & last-entry hours, mandatory 10 PM sleep anchors, and wildlife sanctuary night curfews (such as Bandipur's 9 PM to 6 AM closure).
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-[#20252E] p-3.5 space-y-1.5">
                <h4 className="font-bold text-white text-sm">How does group sharing work without accounts?</h4>
                <p>
                  Trip constraints and selected pitstops are encoded directly into clean URL parameters. When your friends open your link, the app reconstructs the exact mathematical itinerary in their browser. They can RSVP directly to your WhatsApp without signing up or logging in.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
