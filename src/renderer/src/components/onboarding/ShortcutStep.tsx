import { useState, useEffect, useCallback } from 'react'
import { Keyboard, CheckCircle } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { useI18n } from '@renderer/i18n/I18nProvider'

interface ShortcutStepProps {
  onNext: () => void
  onBack: () => void
}

export default function ShortcutStep({ onNext, onBack }: ShortcutStepProps): React.JSX.Element {
  const [tested, setTested] = useState(false)
  const [loading, setLoading] = useState(false)
  const { t } = useI18n()

  const handleHotkey = useCallback((e: KeyboardEvent) => {
    if (e.ctrlKey && e.code === 'Space') {
      e.preventDefault()
      window.api.testShortcutKeypress()
    }
  }, [])

  useEffect(() => {
    if (loading) {
      window.addEventListener('keydown', handleHotkey)
      return () => window.removeEventListener('keydown', handleHotkey)
    }
    return undefined
  }, [loading, handleHotkey])

  const handleTest = async () => {
    setLoading(true)
    try {
      const result = await window.api.testShortcut()
      setTested(result)
    } catch {
      setTested(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="text-center space-y-6">
      <div className="flex justify-center">
        <div className={`h-16 w-16 rounded-full flex items-center justify-center ${tested ? 'bg-green-500/10' : 'bg-primary/10'}`}>
          {tested ? (
            <CheckCircle className="h-8 w-8 text-green-500" />
          ) : (
            <Keyboard className="h-8 w-8 text-primary" />
          )}
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-xl font-bold text-foreground">{t('onboarding.shortcut.title')}</h2>
        <p className="text-sm text-muted-foreground max-w-xs mx-auto">
          {t('onboarding.shortcut.description').split('<shortcut>').map((part, i) => {
            if (i === 0) return part
            const [inside, after] = part.split('</shortcut>')
            return (
              <span key={i}>
                <span className="font-mono text-foreground bg-secondary px-1.5 py-0.5 rounded text-xs">{inside}</span>
                {after}
              </span>
            )
          })}
        </p>
      </div>

      {!tested && !loading && (
        <Button className="w-full max-w-xs mx-auto" onClick={handleTest}>
          {t('onboarding.shortcut.test')}
        </Button>
      )}
      {loading && (
        <div className="flex flex-col items-center gap-2">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
            <Keyboard className="h-5 w-5 text-primary" />
          </div>
          <p className="text-xs text-muted-foreground">{t('onboarding.shortcut.waiting')}</p>
        </div>
      )}
      {tested && (
        <p className="text-sm text-green-500 font-medium">{t('onboarding.shortcut.success')}</p>
      )}

      <div className="flex gap-2 justify-center pt-2">
        <Button variant="outline" onClick={onBack}>{t('onboarding.back')}</Button>
        <Button onClick={onNext}>{t('onboarding.next')}</Button>
      </div>
    </div>
  )
}
