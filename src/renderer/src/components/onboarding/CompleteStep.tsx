import { Rocket } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { useI18n } from '@renderer/i18n/I18nProvider'

interface CompleteStepProps {
  onFinish: () => void
  onBack: () => void
}

export default function CompleteStep({ onFinish, onBack }: CompleteStepProps): React.JSX.Element {
  const { t } = useI18n()
  return (
    <div className="text-center space-y-6">
      <div className="flex justify-center">
        <div className="h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center">
          <Rocket className="h-8 w-8 text-green-500" />
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-foreground">{t('onboarding.complete.title')}</h2>
        <p className="text-sm text-muted-foreground max-w-xs mx-auto">
          {t('onboarding.complete.description')}
        </p>
      </div>

      <div className="bg-card border border-border rounded-lg p-4 text-left space-y-2 max-w-xs mx-auto">
        <p className="text-xs text-muted-foreground">{t('onboarding.complete.summary')}</p>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">{t('onboarding.complete.shortcutLabel')}</span>
          <span className="font-mono text-foreground">Ctrl+Espace</span>
        </div>

      </div>

      <div className="space-y-2">
        <Button className="w-full max-w-xs mx-auto" size="lg" onClick={onFinish}>
          {t('onboarding.complete.finish')}
        </Button>
        <Button variant="ghost" size="sm" onClick={onBack}>
          {t('onboarding.complete.back')}
        </Button>
      </div>
    </div>
  )
}
