import { useLocation, useNavigate } from 'react-router-dom'
import { Home, Settings, Volume2, Clock, Mic, Sparkles } from 'lucide-react'
import { useI18n } from '@renderer/i18n/I18nProvider'

const navItems = [
  { icon: Home, labelKey: 'sidebar.home', path: '/' },
  { icon: Settings, labelKey: 'sidebar.settings', path: '/settings' },
  { icon: Mic, labelKey: 'sidebar.transcription', path: '/settings/transcription' },
  { icon: Sparkles, labelKey: 'sidebar.aiProcessing', path: '/settings/ai' },
  { icon: Volume2, labelKey: 'sidebar.sound', path: '/sound' },
  { icon: Clock, labelKey: 'sidebar.history', path: '/history' },
]

export default function Sidebar(): React.JSX.Element {
  const location = useLocation()
  const navigate = useNavigate()
  const { t } = useI18n()
  return (
    <aside className="flex flex-col w-14 min-w-14 no-drag">
      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-1 flex flex-col items-center justify-center">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path
          const Icon = item.icon
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              title={t(item.labelKey)}
              className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                isActive
                  ? 'bg-primary/15 text-primary'
                  : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
              }`}
            >
              <div className="relative">
                <Icon className="h-5 w-5" />
              </div>
            </button>
          )
        })}
      </nav>
    </aside>
  )
}
