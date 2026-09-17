import { useState } from 'react'
import { Copy, Check, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { Card, CardContent } from '@renderer/components/ui/card'
import { Button } from '@renderer/components/ui/button'
import { useI18n } from '@renderer/i18n/I18nProvider'

interface TranscriptionCardProps {
  id: string
  text: string
  timestamp: number
  onCopy: (text: string) => void
  onDelete: (id: string) => void
}

function formatTime(timestamp: number, locale: string): string {
  const localeMap: Record<string, string> = {
    fr: 'fr-FR', en: 'en-US', es: 'es-ES', de: 'de-DE', pt: 'pt-BR'
  }
  return new Date(timestamp).toLocaleTimeString(localeMap[locale] || 'fr-FR', { hour: '2-digit', minute: '2-digit' })
}

export default function TranscriptionCard({ id, text, timestamp, onCopy, onDelete }: TranscriptionCardProps): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const { t, locale } = useI18n()

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    onCopy(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    onDelete(id)
  }

  const relativeTime = (ts: number): string => {
    const diff = Date.now() - ts
    const minutes = Math.floor(diff / 60000)
    if (minutes < 1) return t('transcription.justNow')
    if (minutes < 60) return t('transcription.minutesAgo', { count: minutes })
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return t('transcription.hoursAgo', { count: hours })
    const days = Math.floor(hours / 24)
    return t('transcription.daysAgo', { count: days })
  }

  const preview = text.length > 120 ? text.slice(0, 120) + '...' : text
  const isLong = text.length > 120

  return (
    <Card
      className="transition-colors group hover:bg-accent/30 cursor-pointer"
      onClick={() => isLong && setExpanded(!expanded)}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm text-foreground leading-relaxed">
              {expanded ? text : preview}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs text-muted-foreground">{formatTime(timestamp, locale)}</span>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs text-muted-foreground">{relativeTime(timestamp)}</span>
            </div>
          </div>
            <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={handleCopy}
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-green-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={handleDelete}
              >
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
              </Button>
              {isLong && (
                expanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </div>
        </div>
      </CardContent>
    </Card>
  )
}
