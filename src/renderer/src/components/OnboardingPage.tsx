import { useState } from 'react'
import { Card, CardContent } from '@renderer/components/ui/card'
import { Button } from '@renderer/components/ui/button'
import { WindowControls } from './WindowControls'
import { useI18n } from '@renderer/i18n/I18nProvider'
import ProgressBar from './onboarding/ProgressBar'
import WelcomeStep from './onboarding/WelcomeStep'
import MicStep from './onboarding/MicStep'
import ShortcutStep from './onboarding/ShortcutStep'
import TranscriptionSettingsPage from './TranscriptionSettingsPage'
import TestStep from './onboarding/TestStep'
import CompleteStep from './onboarding/CompleteStep'

const TOTAL_STEPS = 6

export default function OnboardingPage(): React.JSX.Element {
  const [step, setStep] = useState(1)
  const [finishError, setFinishError] = useState('')
  const { t } = useI18n()

  const handleFinish = async () => {
    try {
      await window.api.setSettings({ onboardingCompleted: true })
      window.close()
    } catch (error) {
      setFinishError(error instanceof Error ? error.message : t('errors.saveSettings'))
    }
  }

  return (
    <div className="h-screen bg-gradient-to-br from-orange-800 via-orange-950/60 to-black animated-gradient relative rounded-2xl overflow-hidden">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-md rounded-2xl pointer-events-none z-0" />
      <div className="drag-region h-10 shrink-0 flex items-center justify-end px-2 relative z-20">
        <WindowControls />
      </div>
      <div className="relative z-10 overflow-y-auto p-6" style={{ height: 'calc(100vh - 40px)' }}>
        <div className={`w-full mx-auto space-y-6 ${step === 4 ? 'max-w-2xl' : 'max-w-md'}`}>
          <ProgressBar currentStep={step} totalSteps={TOTAL_STEPS} />
          <Card>
            <CardContent className="p-8">
              <div key={step} className="animate-fade-in">
                {step === 1 && <WelcomeStep onNext={() => setStep(2)} />}
                {step === 2 && <MicStep onNext={() => setStep(3)} onBack={() => setStep(1)} />}
                {step === 3 && <ShortcutStep onNext={() => setStep(4)} onBack={() => setStep(2)} />}
                {step === 4 && (
                  <div className="space-y-6">
                    <h2 className="text-xl font-bold">{t('transcriptionSettings.transcriptionEngine')}</h2>
                    <p className="text-sm text-muted-foreground">{t('community.providerIntro')}</p>
                    <TranscriptionSettingsPage />
                    <div className="flex gap-2 justify-center">
                      <Button variant="outline" onClick={() => setStep(3)}>{t('onboarding.back')}</Button>
                      <Button onClick={() => setStep(5)}>{t('onboarding.next')}</Button>
                    </div>
                  </div>
                )}
                {step === 5 && <TestStep onNext={() => setStep(6)} onBack={() => setStep(4)} />}
                {step === 6 && <CompleteStep onFinish={handleFinish} onBack={() => setStep(5)} />}
              </div>
              {finishError && <p role="alert" className="text-sm text-destructive mt-4">{finishError}</p>}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
