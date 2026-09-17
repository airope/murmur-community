import { useState, useEffect } from 'react'
import { Badge } from '@renderer/components/ui/badge'
import { Switch } from '@renderer/components/ui/switch'
import { Button } from '@renderer/components/ui/button'
import { useSettings, useChatGPT } from '@renderer/hooks/useIPC'
import { useI18n } from '@renderer/i18n/I18nProvider'
import { SUPPORTED_LOCALES, LOCALE_LABELS, Locale } from '@renderer/i18n/i18n'
import SettingSection from './SettingSection'
import SettingRow from './SettingRow'
import ShortcutRecorder from './ShortcutRecorder'

export default function SettingsPage(): React.JSX.Element {
  const { settings, updateSettings, loading } = useSettings()
  const { connected, login } = useChatGPT(settings.transcriptionProvider === 'chatgpt')
  const { t, locale, setLocale } = useI18n()

  const [appVersion, setAppVersion] = useState('...')

  useEffect(() => {
    let cancelled = false
    ;(window.api as any).getVersion?.()
      .then((v: string) => { if (!cancelled) setAppVersion(v) })
      .catch(() => { if (!cancelled) setAppVersion('?') })
    return () => { cancelled = true }
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground text-sm">{t('settings.loading')}</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{t('settings.title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('settings.subtitle')}</p>
      </div>

      <SettingSection title={t('settings.shortcutSection')}>
        <SettingRow label={t('settings.dictationKey')} description={t('settings.dictationKeyDesc')}>
          <ShortcutRecorder value={settings.shortcut || settings.hotkey || ''} onChange={(v) => updateSettings({ shortcut: v })} />
        </SettingRow>
        <SettingRow label={t('settings.aiProcessKey') || 'AI Process'} description={t('settings.aiProcessKeyDesc') || 'Transcribe with forced AI enhancement'}>
          <ShortcutRecorder value={settings.hotkeyAiProcess || ''} onChange={(v) => updateSettings({ hotkeyAiProcess: v })} />
        </SettingRow>
        <SettingRow label={t('settings.handsFreeKey') || 'Hands-Free'} description={t('settings.handsFreeKeyDesc') || 'Toggle continuous recording mode'}>
          <ShortcutRecorder value={settings.hotkeyHandsFree || ''} onChange={(v) => updateSettings({ hotkeyHandsFree: v })} />
        </SettingRow>
      </SettingSection>

      <SettingSection title={t('settings.general')}>
        <SettingRow label={t('settings.autoStart')} description={t('settings.autoStartDesc')}>
          <Switch
            checked={!!settings.autoStart}
            onCheckedChange={(checked) => updateSettings({ autoStart: checked })}
          />
        </SettingRow>
        <SettingRow label={t('settings.soundEffects')} description={t('settings.soundEffectsDesc')}>
          <Switch
            checked={settings.soundEnabled !== false}
            onCheckedChange={(checked) => updateSettings({ soundEnabled: checked })}
          />
        </SettingRow>
      </SettingSection>

      <SettingSection title={t('settings.languageSection')}>
        <SettingRow label={t('settings.language')} description={t('settings.languageDesc')}>
          <select
            value={locale}
            onChange={(e) => setLocale(e.target.value as Locale)}
            className="h-8 rounded-md border border-border bg-secondary px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {SUPPORTED_LOCALES.map((loc) => (
              <option key={loc} value={loc}>
                {LOCALE_LABELS[loc]}
              </option>
            ))}
          </select>
        </SettingRow>
      </SettingSection>

      {settings.transcriptionProvider === 'chatgpt' && <SettingSection title={t('community.experimentalChatgpt')}>
        <SettingRow
          label={t('settings.connectionStatus')}
          description={connected ? t('settings.chatgptConnected') : t('settings.chatgptDisconnected')}
        >
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
            <Badge variant={connected ? 'default' : 'destructive'} className="text-xs">
              {connected ? t('settings.connected') : t('settings.disconnected')}
            </Badge>
            {!connected && (
              <Button variant="outline" size="sm" className="h-7 text-xs ml-2" onClick={login}>
                {t('settings.reconnect')}
              </Button>
            )}
          </div>
        </SettingRow>
      </SettingSection>}

      <SettingSection title="Advanced Settings">
        <SettingRow label="Transcription Engine" description="Configure speech-to-text provider and local models">
          <Button variant="outline" size="sm" onClick={() => window.api.navigate('/settings/transcription')}>
            Configure
          </Button>
        </SettingRow>
        <SettingRow label="AI Processing" description="Post-processing, AI modes, dictionary, and snippets">
          <Button variant="outline" size="sm" onClick={() => window.api.navigate('/settings/ai')}>
            Configure
          </Button>
        </SettingRow>
      </SettingSection>

      <SettingSection title={t('settings.about')}>
        <SettingRow label={t('settings.version')} description="Murmur Community">
          <span className="text-xs text-muted-foreground font-mono">v{appVersion}</span>
          <Button variant="outline" size="sm" onClick={() => window.api.openExternal('https://github.com/airope/murmur-community/releases')}>
            {t('community.releases')}
          </Button>
        </SettingRow>
      </SettingSection>

    </div>
  )
}
