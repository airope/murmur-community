import { useState, useEffect } from 'react'
import { useSettings } from '@renderer/hooks/useIPC'
import { useI18n } from '@renderer/i18n/I18nProvider'
import ChatGPTStep from './onboarding/ChatGPTStep'
import SettingSection from './SettingSection'
import SettingRow from './SettingRow'
import { Input } from '@renderer/components/ui/input'
import { Button } from '@renderer/components/ui/button'
import { Badge } from '@renderer/components/ui/badge'

interface ModelCatalogEntry {
  id: string
  name: string
  type: string
  language: string
  description: string
  sizeBytes: number
  files: { name: string; url: string; size: number }[]
  cliArgs: Record<string, string>
}

interface ApiKeyRowProps {
  provider: string
  label: string
  description: string
}

function ApiKeyRow({ provider, label, description }: ApiKeyRowProps): React.JSX.Element {
  const { t } = useI18n()
  const [key, setKey] = useState('')
  const [saved, setSaved] = useState(false)
  const [hasKey, setHasKey] = useState(false)
  const [masked, setMasked] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null)

  useEffect(() => {
    const init = async () => {
      try {
        const has = await window.api.byokHasApiKey(provider)
        setHasKey(has)
        const mask = await window.api.byokGetMaskedKey(provider)
        setMasked(mask ?? '')
      } catch (err) {
        console.error(`Failed to load ${provider} key status:`, err)
      }
    }
    init()
  }, [provider])

  const handleSave = async () => {
    try {
      await window.api.byokSaveApiKey(provider, key)
      setSaved(true)
      setHasKey(true)
      setKey('')
      const mask = await window.api.byokGetMaskedKey(provider)
      setMasked(mask ?? '')
      setTimeout(() => setSaved(false), 2000)
    } catch (error) {
      console.error(`Failed to save ${provider} key:`, error)
    }
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    const success = await window.api.byokTestApiKey(provider, key)
    setTestResult(success ? 'success' : 'error')
    setTesting(false)
    setTimeout(() => setTestResult(null), 3000)
  }

  const handleDelete = async () => {
    try {
      await window.api.byokDeleteApiKey(provider)
      setHasKey(false)
      setMasked('')
      setKey('')
    } catch (error) {
      console.error(`Failed to delete ${provider} key:`, error)
    }
  }

  return (
    <SettingRow label={label} description={description}>
      <div className="flex gap-2 w-full max-w-lg">
        <div className="relative flex-1">
          <Input
            type={showPassword ? 'text' : 'password'}
            placeholder={hasKey ? masked : `Enter your ${provider.toUpperCase()} API key`}
            value={key}
            onChange={(e) => setKey(e.target.value)}
            className="h-8 text-xs pr-20"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground hover:text-foreground"
          >
            {showPassword ? t('common.hide') : t('common.show')}
          </button>
        </div>
        {!hasKey ? (
          <Button size="sm" onClick={handleSave} className="h-8 text-xs">
            {t('common.save')}
          </Button>
        ) : (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={handleTest}
              disabled={testing}
              className="h-8 text-xs"
            >
              {t('common.test')}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleDelete}
              className="h-8 text-xs"
            >
              {t('common.delete')}
            </Button>
          </>
        )}
      </div>
      {testResult && (
        <Badge
          variant={testResult === 'success' ? 'default' : 'destructive'}
          className="ml-2"
        >
          {testResult === 'success' ? t('common.success') : t('common.failed')}
        </Badge>
      )}
      {saved && (
        <Badge variant="default" className="ml-2">
          {t('common.saved')}
        </Badge>
      )}
    </SettingRow>
  )
}

export default function TranscriptionSettingsPage(): React.JSX.Element {
  const { t } = useI18n()
  const { settings, updateSettings, loading } = useSettings()
  const [catalog, setCatalog] = useState<ModelCatalogEntry[]>([])
  const [installedIds, setInstalledIds] = useState<Set<string>>(new Set())
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [downloadPhase, setDownloadPhase] = useState<'downloading' | 'extracting'>('downloading')
  const [installError, setInstallError] = useState<{ modelId: string; message: string } | null>(null)
  const [showModelStore, setShowModelStore] = useState(false)

  useEffect(() => {
    const init = async () => {
      try {
        const catalogData = await window.api.getModelCatalog()
        setCatalog(catalogData)
        const installed = await window.api.getInstalledModels()
        setInstalledIds(new Set(installed.map((m: any) => m.id)))
      } catch (err) {
        console.error('Failed to load model catalog:', err)
      }
    }
    init()
  }, [])

  useEffect(() => {
    if (!downloadingId) return
    const handler = (data: any): void => {
      if (data.pct === -1) {
        // Sentinel: extraction phase in progress
        setDownloadPhase('extracting')
      } else {
        setDownloadPhase('downloading')
        setDownloadProgress(Math.round((data.overallPct ?? 0) * 100))
      }
    }
    window.api.onModelInstallProgress(handler)
    return () => window.api.removeModelInstallProgressListener()
  }, [downloadingId])

  const handleInstallModel = async (modelId: string) => {
    setDownloadingId(modelId)
    setDownloadProgress(0)
    setDownloadPhase('downloading')
    setInstallError(null)
    try {
      await window.api.installModel(modelId)
      setInstalledIds((prev) => new Set([...prev, modelId]))
      if (!settings.localModel) {
        updateSettings({ localModel: modelId })
      }
    } catch (error) {
      console.error('Failed to install model:', error)
      setInstallError({ modelId, message: error instanceof Error ? error.message : 'Installation failed' })
    } finally {
      setDownloadingId(null)
      setDownloadProgress(0)
      setDownloadPhase('downloading')
    }
  }

  const handleDeleteModel = async (modelId: string) => {
    try {
      await window.api.deleteModel(modelId)
      setInstalledIds((prev) => {
        const next = new Set(prev)
        next.delete(modelId)
        return next
      })
      if (settings.localModel === modelId) {
        updateSettings({ localModel: null })
      }
    } catch (error) {
      console.error('Failed to delete model:', error)
    }
  }

  const formatSize = (bytes: number): string => {
    if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} GB`
    return `${Math.round(bytes / 1_000_000)} MB`
  }

  const installedModels = catalog.filter((m) => installedIds.has(m.id))

  if (loading) return <div className="p-6 text-muted-foreground text-sm">{t('common.loading')}</div>

  return (
    <div className="space-y-6">
      <SettingSection title={t('transcriptionSettings.transcriptionEngine')}>
        <SettingRow stacked label={t('transcriptionSettings.sttProvider')} description={t('transcriptionSettings.sttProviderDesc')}>
          <div className="flex gap-2 flex-wrap">
            {[
              { id: 'local', label: 'Local' },
              { id: 'groq', label: 'Groq' },
              { id: 'deepgram', label: 'Deepgram' },
              { id: 'assemblyai', label: 'AssemblyAI' },
              { id: 'elevenlabs', label: 'ElevenLabs' },
              { id: 'chatgpt', label: t('community.experimentalChatgpt') },
            ].map((provider) => (
              <Button
                key={provider.id}
                variant={settings.transcriptionProvider === provider.id ? 'default' : 'outline'}
                size="sm"
                onClick={() => updateSettings({ transcriptionProvider: provider.id })}
              >
                {provider.label}
              </Button>
            ))}
          </div>
        </SettingRow>

        {['groq', 'deepgram', 'assemblyai', 'elevenlabs'].includes(settings.transcriptionProvider || 'local') && (
            <div className="text-xs text-muted-foreground px-4 py-2">
              {t('transcriptionSettings.addApiKeyBelow', { provider: (settings.transcriptionProvider || '').toUpperCase() })}
            </div>
          )}

        {settings.transcriptionProvider === 'local' && installedModels.length === 0 && (
          <div className="text-xs text-muted-foreground px-4 py-2">
            {t('transcriptionSettings.installModelBelow')}
          </div>
        )}
      </SettingSection>

      {settings.transcriptionProvider === 'chatgpt' && <ChatGPTStep />}

      {settings.transcriptionProvider === 'local' && (
        <SettingSection title={t('transcriptionSettings.localModels')}>
          {installedModels.length > 0 && (
            <SettingRow label={t('transcriptionSettings.activeModel')} description={t('transcriptionSettings.activeModelDesc')}>
              <select
                value={settings.localModel ?? ''}
                onChange={(e) => updateSettings({ localModel: e.target.value || null })}
                className="h-8 text-xs rounded-md border border-input bg-background px-3 text-foreground"
              >
                <option value="">{t('transcriptionSettings.selectModel')}</option>
                {installedModels.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </select>
            </SettingRow>
          )}

          <SettingRow
            label={t('transcriptionSettings.modelStore')}
            description={t('transcriptionSettings.modelStoreDesc')}
          >
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowModelStore(!showModelStore)}
            >
              {showModelStore ? t('common.hide') : t('transcriptionSettings.manageModels')}
            </Button>
          </SettingRow>

          {showModelStore && (
            <div className="px-4 pb-4 space-y-3">
              {catalog.map((model) => {
                const isInstalled = installedIds.has(model.id)
                const isDownloading = downloadingId === model.id

                return (
                  <div
                    key={model.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{model.name}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {formatSize(model.sizeBytes)}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">
                          {model.language === 'multi' ? t('transcriptionSettings.multilingual') : model.language.toUpperCase()}
                        </Badge>
                        {isInstalled && (
                          <Badge variant="default" className="text-[10px]">
                            {t('transcriptionSettings.installed')}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{model.description}</p>
                      {isDownloading && (
                        <div className="mt-2">
                          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full transition-all duration-300"
                              style={{ width: downloadPhase === 'extracting' ? '100%' : `${downloadProgress}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-muted-foreground mt-0.5">
                            {downloadPhase === 'extracting' ? 'Extracting...' : `${downloadProgress}%`}
                          </span>
                        </div>
                      )}
                      {!isDownloading && installError?.modelId === model.id && (
                        <p className="text-[10px] text-destructive mt-1">{installError.message}</p>
                      )}
                    </div>
                    <div className="ml-3 flex-shrink-0">
                      {isDownloading ? (
                        <Button size="sm" variant="outline" disabled className="h-7 text-xs">
                          {t('transcriptionSettings.downloading')}
                        </Button>
                      ) : isInstalled ? (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeleteModel(model.id)}
                          className="h-7 text-xs"
                        >
                          {t('common.delete')}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => handleInstallModel(model.id)}
                          className="h-7 text-xs"
                        >
                          {t('transcriptionSettings.install')}
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </SettingSection>
      )}

      <SettingSection title={t('transcriptionSettings.apiKeys')}>
        <ApiKeyRow
          provider="groq"
          label={t('transcriptionSettings.groqApiKey')}
          description={t('transcriptionSettings.groqApiKeyDesc')}
        />
        <ApiKeyRow
          provider="deepgram"
          label={t('transcriptionSettings.deepgramApiKey')}
          description={t('transcriptionSettings.deepgramApiKeyDesc')}
        />
        <ApiKeyRow
          provider="assemblyai"
          label={t('transcriptionSettings.assemblyaiApiKey')}
          description={t('transcriptionSettings.assemblyaiApiKeyDesc')}
        />
        <ApiKeyRow
          provider="elevenlabs"
          label={t('transcriptionSettings.elevenlabsApiKey')}
          description={t('transcriptionSettings.elevenlabsApiKeyDesc')}
        />
      </SettingSection>
    </div>
  )
}
