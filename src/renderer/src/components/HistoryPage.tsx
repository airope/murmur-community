import { useState, useMemo } from 'react'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import {
  AlertDialog,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel
} from '@renderer/components/ui/alert-dialog'
import { useHistory } from '@renderer/hooks/useIPC'
import { useI18n } from '@renderer/i18n/I18nProvider'
import { Trash2, Search, MessageSquare } from 'lucide-react'
import TranscriptionCard from './TranscriptionCard'

function groupByDate(
  entries: { id: string; text: string; timestamp: number; duration: number }[],
  t: (key: string) => string,
  locale: string
): Record<string, typeof entries> {
  const groups: Record<string, typeof entries> = {}
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  const dateLocaleMap: Record<string, string> = {
    fr: 'fr-FR', en: 'en-US', es: 'es-ES', de: 'de-DE', pt: 'pt-BR'
  }
  const dateLocale = dateLocaleMap[locale] || 'fr-FR'

  for (const entry of entries) {
    const date = new Date(entry.timestamp)
    date.setHours(0, 0, 0, 0)
    let label: string
    if (date.getTime() === today.getTime()) label = t('history.today')
    else if (date.getTime() === yesterday.getTime()) label = t('history.yesterday')
    else label = date.toLocaleDateString(dateLocale, { weekday: 'long', day: 'numeric', month: 'long' })

    if (!groups[label]) groups[label] = []
    groups[label].push(entry)
  }
  return groups
}

export default function HistoryPage(): React.JSX.Element {
  const { history, loading, clearHistory, copyToClipboard, reload } = useHistory()
  const { t, locale } = useI18n()
  const [search, setSearch] = useState('')
  const [showClearDialog, setShowClearDialog] = useState(false)
  const filtered = useMemo(
    () => history.filter((entry) =>
      entry.text.toLowerCase().includes(search.toLowerCase())
    ),
    [history, search]
  )

  const grouped = useMemo(() => groupByDate(filtered, t, locale), [filtered, t, locale])

  const handleDelete = async (id: string) => {
    await (window.api as any).deleteHistoryEntry(id)
    reload()
  }

  const handleClear = async () => {
    await clearHistory()
    setShowClearDialog(false)
  }

  return (
    <div className="p-6 space-y-4 animate-fade-in h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{t('history.title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {history.length !== 1
              ? t('history.transcriptionCountPlural', { count: history.length })
              : t('history.transcriptionCount', { count: history.length })}
          </p>
        </div>
        {history.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="text-destructive border-destructive/30 hover:bg-destructive/10"
            onClick={() => setShowClearDialog(true)}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            {t('history.clearAll')}
          </Button>
        )}
      </div>

      {/* Search */}
      {history.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('history.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 bg-card"
          />
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground text-sm">{t('history.loading')}</p>
        </div>
      ) : history.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center flex-1">
          <div className="h-14 w-14 rounded-full bg-card border border-border flex items-center justify-center mb-4">
            <MessageSquare className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">
            {t('history.empty')}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {t('history.emptyHint')}
          </p>
        </div>
      ) : (
        <ScrollArea className="flex-1 -mr-2">
          <div className="space-y-6 pr-2">
            {Object.entries(grouped).map(([dateLabel, entries]) => (
              <div key={dateLabel} className="space-y-2">
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1">
                  {dateLabel}
                </h3>
                <div className="space-y-1.5">
                  {entries.map((entry) => (
                    <TranscriptionCard
                      key={entry.id}
                      id={entry.id}
                      text={entry.text}
                      timestamp={entry.timestamp}
                      onCopy={copyToClipboard}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('history.clearTitle')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('history.clearDescription')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setShowClearDialog(false)}>
            {t('history.cancel')}
          </AlertDialogCancel>
          <AlertDialogAction onClick={handleClear}>{t('history.clear')}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialog>
    </div>
  )
}
