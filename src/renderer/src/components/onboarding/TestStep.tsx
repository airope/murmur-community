import { useState, useEffect, useCallback, useRef } from 'react'
import { Mic, CheckCircle } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { useI18n } from '@renderer/i18n/I18nProvider'

interface TestStepProps {
  onNext: () => void
  onBack: () => void
}

export default function TestStep({ onNext, onBack }: TestStepProps): React.JSX.Element {
  const [demoState, setDemoState] = useState<'idle' | 'listening' | 'processing' | 'done'>('idle')
  const [demoText, setDemoText] = useState('')
  const [demoError, setDemoError] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { t } = useI18n()

  const handleHotkey = useCallback((e: KeyboardEvent) => {
    if (e.ctrlKey && e.code === 'Space') {
      e.preventDefault()
      window.api.demoToggle()
    }
  }, [])

  useEffect(() => {
    window.api.demoEnter()
    window.addEventListener('keydown', handleHotkey)

    window.api.onStateChange((state: string) => {
      if (state === 'listening') setDemoState('listening')
      else if (state === 'processing') setDemoState('processing')
      else if (state === 'idle') setDemoState(prev => prev === 'done' ? 'done' : 'idle')
    })

    window.api.onDemoResult((text: string) => {
      if (text) { setDemoText(text); setDemoState('done'); setDemoError('') }
      else setDemoState('idle')
    })

    window.api.onDemoError((message: string) => {
      setDemoError(message); setDemoState('idle')
    })

    return () => {
      window.removeEventListener('keydown', handleHotkey)
      window.api.demoExit()
    }
  }, [handleHotkey])

  return (
    <div className="space-y-5">
      <div className="text-center">
        <div className="flex justify-center mb-3">
          <div className={`h-16 w-16 rounded-full flex items-center justify-center transition-colors ${
            demoState === 'listening' ? 'bg-red-500/10 animate-pulse' :
            demoState === 'processing' ? 'bg-yellow-500/10' :
            demoState === 'done' ? 'bg-green-500/10' : 'bg-primary/10'
          }`}>
            {demoState === 'done' ? (
              <CheckCircle className="h-8 w-8 text-green-500" />
            ) : (
              <Mic className={`h-8 w-8 ${
                demoState === 'listening' ? 'text-red-500' :
                demoState === 'processing' ? 'text-yellow-500' : 'text-primary'
              }`} />
            )}
          </div>
        </div>
        <h2 className="text-xl font-bold text-foreground">{t('onboarding.test.title')}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {demoState === 'idle' && t('onboarding.test.idle')}
          {demoState === 'listening' && t('onboarding.test.listening')}
          {demoState === 'processing' && t('onboarding.test.processing')}
          {demoState === 'done' && t('onboarding.test.done')}
        </p>
      </div>

      <textarea
        ref={textareaRef}
        className="w-full h-24 rounded-lg border border-border bg-secondary px-4 py-3 text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary"
        placeholder={t('onboarding.test.placeholder')}
        value={demoText}
        onChange={(e) => setDemoText(e.target.value)}
      />

      {demoError && (
        <p className="text-xs text-destructive text-center">{demoError}</p>
      )}

      {demoState === 'idle' && (
        <Button className="w-full" onClick={() => window.api.demoToggle()}>
          <Mic className="h-4 w-4 mr-2" />
          {demoError ? t('onboarding.test.retry') : t('onboarding.test.start')}
        </Button>
      )}

      <div className="flex gap-2 justify-center pt-1">
        <Button variant="outline" onClick={onBack}>{t('onboarding.back')}</Button>
        <Button onClick={onNext}>{t('onboarding.next')}</Button>
      </div>
    </div>
  )
}
