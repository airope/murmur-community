import { Button } from '@renderer/components/ui/button'
import { useI18n } from '@renderer/i18n/I18nProvider'

interface WelcomeStepProps {
  onNext: () => void
}

export default function WelcomeStep({ onNext }: WelcomeStepProps): React.JSX.Element {
  const { t } = useI18n()

  return (
    <div className="text-center space-y-6">
      {/* Animated equalizer icon */}
      <div className="flex justify-center">
        <div className="relative h-20 w-20">
          <svg viewBox="0 0 100 100" className="h-full w-full">
            {Array.from({ length: 12 }).map((_, i) => {
              const angle = (i / 12) * Math.PI * 2 - Math.PI / 2
              const cos = Math.cos(angle)
              const sin = Math.sin(angle)
              const innerR = 28
              const barLen = 8 + Math.sin(i * 0.8) * 10
              return (
                <line
                  key={i}
                  x1={50 + cos * innerR}
                  y1={50 + sin * innerR}
                  x2={50 + cos * (innerR + barLen)}
                  y2={50 + sin * (innerR + barLen)}
                  stroke="hsl(29, 79%, 57%)"
                  strokeWidth={3}
                  strokeLinecap="round"
                  opacity={0.5 + Math.sin(i * 0.8) * 0.3}
                  className="animate-pulse"
                  style={{ animationDelay: `${i * 100}ms` }}
                />
              )
            })}
          </svg>
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-foreground">{t('onboarding.welcome.title')}</h2>
        <p className="text-sm text-muted-foreground max-w-xs mx-auto">
          {t('onboarding.welcome.description')}
        </p>
      </div>

      <Button className="w-full max-w-xs mx-auto" size="lg" onClick={onNext}>
        {t('onboarding.welcome.start')}
      </Button>
    </div>
  )
}
