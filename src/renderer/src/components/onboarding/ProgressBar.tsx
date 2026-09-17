interface ProgressBarProps {
  currentStep: number
  totalSteps: number
}

export default function ProgressBar({ currentStep, totalSteps }: ProgressBarProps): React.JSX.Element {
  return (
    <div className="flex items-center justify-center gap-2">
      {Array.from({ length: totalSteps }, (_, i) => i + 1).map((s) => (
        <div
          key={s}
          className={`h-1.5 rounded-full transition-all duration-300 ${
            s === currentStep
              ? 'w-8 bg-primary'
              : s < currentStep
                ? 'w-1.5 bg-primary/60'
                : 'w-1.5 bg-muted'
          }`}
        />
      ))}
    </div>
  )
}
