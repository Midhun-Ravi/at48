import type { DestinationGuide } from '../data/destinationGuides';
import { getDestinationImage } from '../data/images';

interface DestinationGuideModalProps {
  guide: DestinationGuide | null;
  onClose: () => void;
  onSelectDestination?: (destinationId: string) => void;
}

export default function DestinationGuideModal({
  guide,
  onClose,
  onSelectDestination,
}: DestinationGuideModalProps) {
  if (!guide) return null;

  const heroImg = getDestinationImage(guide.destinationId);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="guide-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 animate-fadeIn"
    >
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-[#E1ECF2] bg-white text-[#193953] shadow-2xl space-y-5">
        {/* Modal Hero Header with Image */}
        <div className="relative aspect-[16/9] sm:aspect-[21/9] w-full overflow-hidden bg-slate-100 rounded-t-3xl">
          {heroImg ? (
            <img
              src={heroImg.src}
              alt={heroImg.alt}
              loading="lazy"
              className="h-full w-full object-cover"
              onError={e => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[#DDF0F6] text-4xl">
              🏞️
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />

          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 rounded-full bg-black/60 backdrop-blur-xs p-2 text-white hover:bg-black/80 transition-colors cursor-pointer"
            aria-label="Close Guide"
          >
            ✕
          </button>

          <div className="absolute bottom-3 left-4 right-4 text-white">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="rounded-full bg-[#176EA8] px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider">
                Destination Guide
              </span>
              <span className="rounded-full bg-white/20 backdrop-blur-xs px-2.5 py-0.5 text-[11px] font-semibold">
                {guide.durationDays} Calendar Day{guide.durationDays > 1 ? 's' : ''} · {guide.pace} pace
              </span>
            </div>
            <h2 id="guide-title" className="text-2xl sm:text-3xl font-black">
              {guide.destinationName}
            </h2>
            {heroImg && (
              <span className="text-[10px] text-white/80 block mt-0.5">
                Photo: {heroImg.author} · {heroImg.license}
              </span>
            )}
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 space-y-5 -mt-2">
          {/* Why Visit */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#176EA8]">Why Visit?</h3>
            <p className="mt-1 text-sm text-[#193953] leading-relaxed font-medium">
              {guide.whyVisit}
            </p>
          </div>

          {/* Duration & Fit Verdict */}
          <div className="rounded-2xl bg-[#F4F9FC] border border-[#E1ECF2] p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#5A7184]">
                Trip Duration Analysis
              </span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-bold border ${
                  guide.durationFitVerdict === 'ideal'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : guide.durationFitVerdict === 'tight'
                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                    : 'bg-blue-50 text-blue-800 border-blue-200'
                }`}
              >
                {guide.durationFitVerdict === 'ideal'
                  ? '✓ Ideal Window'
                  : guide.durationFitVerdict === 'tight'
                  ? '⚠️ Tight Schedule'
                  : '🌿 Extended Leisure'}
              </span>
            </div>
            <p className="text-xs text-[#193953] leading-relaxed">
              {guide.durationNote}
            </p>
            <p className="text-[11px] text-[#5A7184] border-t border-[#E1ECF2] pt-2">
              <strong>Benchmark Recommendation:</strong> {guide.idealDuration}
            </p>
          </div>

          {/* Highlights & What to Prioritize */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-[#E1ECF2] bg-white p-4 space-y-2 shadow-xs">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#193953]">
                🎯 Top Must-See Highlights
              </h4>
              <ul className="text-xs text-[#5A7184] space-y-1.5 list-disc list-inside">
                {guide.whatToPrioritize.map((item, i) => (
                  <li key={i} className="text-[#193953] font-medium">{item}</li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-[#E1ECF2] bg-white p-4 space-y-2 shadow-xs">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#193953]">
                🛑 What to Skip if Time is Tight
              </h4>
              <ul className="text-xs text-[#5A7184] space-y-1.5 list-disc list-inside">
                {guide.whatToSkipIfTight.map((item, i) => (
                  <li key={i} className="text-[#5A7184]">{item}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Recommended Geographical / Timing Order */}
          <div className="rounded-2xl border border-[#E1ECF2] bg-white p-4 space-y-2.5 shadow-xs">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#176EA8]">
              🗺️ Recommended Visiting Order
            </h4>
            <div className="space-y-2 text-xs">
              {guide.recommendedOrder.map((step, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[#DDF0F6] text-[#176EA8] text-[10px] font-black">
                    {i + 1}
                  </span>
                  <span className="text-[#193953] leading-relaxed">{step}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Free-Time Ideas */}
          {guide.freeTimeIdeas.length > 0 && (
            <div className="space-y-2.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#5A7184]">
                🌿 Recommended Free-Time Experiences
              </h4>
              <div className="grid sm:grid-cols-2 gap-2 text-xs">
                {guide.freeTimeIdeas.map((idea, i) => (
                  <div key={i} className="rounded-xl border border-[#E1ECF2] bg-[#F4F9FC] p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <strong className="text-[#193953]">{idea.title}</strong>
                      <span className="text-[10px] font-semibold text-[#176EA8] capitalize">
                        {idea.durationMins}m · {idea.category}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#5A7184] leading-relaxed">{idea.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Practical Cautions */}
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-2 text-xs text-amber-900">
            <h4 className="font-bold flex items-center gap-1.5 text-amber-900">
              <span>⚠️</span>
              <span>Practical Road & Operating Cautions</span>
            </h4>
            <ul className="space-y-1 list-disc list-inside text-amber-800">
              {guide.practicalCautions.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </div>

          {/* Trust Disclosure Banner */}
          {!guide.isSchedulable && (
            <div className="rounded-xl bg-[#F4F9FC] border border-[#E1ECF2] p-3 text-xs text-[#5A7184] leading-relaxed">
              ℹ️ <strong>Trip Inspiration:</strong> This destination is part of our upcoming curated corridor catalog. Verified attraction timetables and deterministic feasibility calculations will unlock as field data is finalized.
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E1ECF2]">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-[#E1ECF2] bg-white px-5 py-2.5 text-xs font-bold text-[#5A7184] hover:bg-[#F4F9FC] transition-colors cursor-pointer"
            >
              Close
            </button>
            {guide.isSchedulable && onSelectDestination && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onSelectDestination(guide.destinationId);
                }}
                className="rounded-xl bg-[#176EA8] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#135a8a] transition-colors cursor-pointer"
              >
                Customize Schedule →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
