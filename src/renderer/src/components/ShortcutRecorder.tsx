import { useState, useEffect, useCallback } from 'react'
import { Button } from '@renderer/components/ui/button'
import { useI18n } from '@renderer/i18n/I18nProvider'

interface ShortcutRecorderProps {
  value: string
  onChange: (shortcut: string) => void
}

export default function ShortcutRecorder({ value, onChange }: ShortcutRecorderProps): React.JSX.Element {
  const [capturing, setCapturing] = useState(false)
  const { t } = useI18n()

  const handleKeyCapture = useCallback(
    (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()

      const parts: string[] = []
      if (e.ctrlKey) parts.push('Ctrl')
      if (e.altKey) parts.push('Alt')
      if (e.shiftKey) parts.push('Shift')
      if (e.metaKey) parts.push('Super')

      const key = e.key
      if (!['Control', 'Alt', 'Shift', 'Meta'].includes(key)) {
        const keyName = key === ' ' ? 'Space' : key.length === 1 ? key.toUpperCase() : key
        parts.push(keyName)
        onChange(parts.join('+'))
        setCapturing(false)
      }
    },
    [onChange]
  )

  useEffect(() => {
    if (capturing) {
      window.addEventListener('keydown', handleKeyCapture)
      return () => window.removeEventListener('keydown', handleKeyCapture)
    }
    return undefined
  }, [capturing, handleKeyCapture])

  return (
    <div className="flex items-center gap-2">
      <div className={`rounded-md border px-3 py-1.5 font-mono text-xs text-center min-w-[80px] ${
        capturing ? 'border-primary bg-primary/10 text-primary animate-pulse' : 'border-border bg-secondary text-foreground'
      }`}>
        {capturing ? t('shortcutRecorder.press') : value}
      </div>
      <Button
        variant={capturing ? 'destructive' : 'outline'}
        size="sm"
        className="h-7 text-xs"
        onClick={() => setCapturing(!capturing)}
      >
        {capturing ? t('shortcutRecorder.cancel') : t('shortcutRecorder.edit')}
      </Button>
    </div>
  )
}
