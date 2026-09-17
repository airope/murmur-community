import { HashRouter, Routes, Route } from 'react-router-dom'
import { I18nProvider } from '@renderer/i18n/I18nProvider'
import AppShell from '@renderer/components/AppShell'
import HomePage from '@renderer/components/HomePage'
import SettingsPage from '@renderer/components/SettingsPage'
import HistoryPage from '@renderer/components/HistoryPage'
import SoundPage from '@renderer/components/SoundPage'
import OnboardingPage from '@renderer/components/OnboardingPage'
import OverlayPage from '@renderer/components/OverlayPage'
import TranscriptionSettingsPage from '@renderer/components/TranscriptionSettingsPage'
import AISettingsPage from '@renderer/components/AISettingsPage'

export default function App(): React.JSX.Element {
  return (
    <I18nProvider>
      <HashRouter>
        <Routes>
          {/* Main app window — sidebar + content */}
          <Route element={<AppShell />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/settings/transcription" element={<TranscriptionSettingsPage />} />
            <Route path="/settings/ai" element={<AISettingsPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/sound" element={<SoundPage />} />
          </Route>

          {/* Standalone windows (no sidebar) */}
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/overlay" element={<OverlayPage />} />
        </Routes>
      </HashRouter>
    </I18nProvider>
  )
}
