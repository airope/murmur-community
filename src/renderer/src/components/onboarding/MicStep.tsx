import { useState } from 'react'
import { Mic, CheckCircle } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { useI18n } from '@renderer/i18n/I18nProvider'

interface MicStepProps {
  onNext: () => void
  onBack: () => void
}

export default function MicStep({ onNext, onBack }: MicStepProps): React.JSX.Element {
  const [granted, setGranted] = useState(false)
  const [error, setError] = useState('')
  const { t } = useI18n()

  const requestMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach(track => track.stop())
      setGranted(true)
      setError('')
    } catch {
      setError(t('onboarding.mic.error'))
    }
  }

  return (
    <div className="text-center space-y-6">
      <div className="flex justify-center">
        <div className={`h-16 w-16 rounded-full flex items-center justify-center ${granted ? 'bg-green-500/10' : 'bg-primary/10'}`}>
          {granted ? (
            <CheckCircle className="h-8 w-8 text-green-500" />
          ) : (
            <Mic className="h-8 w-8 text-primary" />
          )}
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-xl font-bold text-foreground">{t('onboarding.mic.title')}</h2>
        <p className="text-sm text-muted-foreground max-w-xs mx-auto">
          {t('onboarding.mic.description')}
        </p>
      </div>

      {!granted && (
        <Button className="w-full max-w-xs mx-auto" onClick={requestMic}>
          {t('onboarding.mic.authorize')}
        </Button>
      )}
      {granted && (
        <p className="text-sm text-green-500 font-medium">{t('onboarding.mic.granted')}</p>
      )}
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}

      <div className="flex gap-2 justify-center pt-2">
        <Button variant="outline" onClick={onBack}>{t('onboarding.back')}</Button>
        <Button onClick={onNext} disabled={!granted}>{t('onboarding.next')}</Button>
      </div>
    </div>
  )
}
