interface ProgressBarProps {
  currentStep: 1 | 2 | 3 | 4;
}

const STEPS = [
  { step: 1, label: 'Dates & Group' },
  { step: 2, label: 'Destinations' },
  { step: 3, label: 'Stops & Route' },
  { step: 4, label: 'Review & Share' },
] as const;

export default function ProgressBar({ currentStep }: ProgressBarProps) {
  return (
    <div className="w-full space-y-2 mb-6" aria-label={`Step ${currentStep} of 4`}>
      <div className="flex items-center justify-between text-xs font-semibold tracking-wider uppercase text-[#6B7C77]">
        <span className="text-[#C65B32]">
          Step {currentStep} of 4: <span className="text-[#344F48] font-bold">{STEPS[currentStep - 1].label}</span>
        </span>
        <span className="text-[#6B7C77] hidden sm:inline">
          {Math.round((currentStep / 4) * 100)}% Complete
        </span>
      </div>

      {/* 4-part segmented bar */}
      <div className="grid grid-cols-4 gap-2">
        {STEPS.map(s => {
          const isDone = s.step < currentStep;
          const isCurrent = s.step === currentStep;

          return (
            <div
              key={s.step}
              className={`h-2 rounded-full transition-all duration-300 ${
                isCurrent
                  ? 'bg-[#C65B32] shadow-xs shadow-[#C65B32]/40 ring-2 ring-[#C65B32]/20'
                  : isDone
                  ? 'bg-[#5F7B6B]'
                  : 'bg-[#EADBCE]'
              }`}
            />
          );
        })}
      </div>
    </div>
  );
}
