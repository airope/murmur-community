import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mic, FileText, Clock, Flame, Keyboard, History } from 'lucide-react'
import { Card, CardContent } from '@renderer/components/ui/card'
import { Badge } from '@renderer/components/ui/badge'
import { StatCard } from '@renderer/components/ui/stat-card'
import { useI18n } from '@renderer/i18n/I18nProvider'

interface UsageStats {
  dictationsToday: number
  wordsThisWeek: number
  timeSavedMin: number
  streakDays: number
}

export default function HomePage(): React.JSX.Element {
  const navigate = useNavigate()
  const { t } = useI18n()
  const [stats, setStats] = useState<UsageStats>({
    dictationsToday: 0,
    wordsThisWeek: 0,
    timeSavedMin: 0,
    streakDays: 0
  })

  useEffect(() => {
    window.api.getStats().then((data: any) => {
      if (data) setStats(data)
    })
  }, [])

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{t('home.greeting')}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t('home.subtitle').split('<shortcut>').map((part, i) => {
            if (i === 0) return part
            const [inside, after] = part.split('</shortcut>')
            return (
              <span key={i}>
                <Badge variant="secondary" className="text-xs px-1.5 py-0 mx-1 font-mono">{inside}</Badge>
                {after}
              </span>
            )
          })}
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon={Mic}
          label={t('home.dictationsToday')}
          value={stats.dictationsToday}
        />
        <StatCard
          icon={FileText}
          label={t('home.wordsThisWeek')}
          value={stats.wordsThisWeek}
        />
        <StatCard
          icon={Clock}
          label={t('home.timeSaved')}
          value={stats.timeSavedMin}
          suffix="min"
        />
        <StatCard
          icon={Flame}
          label={t('home.streakDays')}
          value={stats.streakDays}
        />
      </div>

      {/* Quick actions */}
      <div className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{t('home.quickActions')}</h2>
        <div className="grid grid-cols-1 gap-2">
          <Card className="bg-card border-border hover:bg-white/[0.1] transition-colors cursor-pointer" onClick={() => navigate('/settings')}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Keyboard className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{t('home.keyboardShortcuts')}</p>
                <p className="text-xs text-muted-foreground">{t('home.configureShortcut')}</p>
              </div>
              <Badge variant="secondary" className="text-[10px] font-mono">Ctrl+Espace</Badge>
            </CardContent>
          </Card>

          <Card className="bg-card border-border hover:bg-white/[0.1] transition-colors cursor-pointer" onClick={() => navigate('/history')}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <History className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{t('home.history')}</p>
                <p className="text-xs text-muted-foreground">{t('home.recentTranscriptions')}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

    </div>
  )
}
