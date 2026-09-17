import { useState, useEffect } from 'react'
import { useSettings } from '@renderer/hooks/useIPC'
import { useI18n } from '@renderer/i18n/I18nProvider'
import SettingSection from './SettingSection'
import SettingRow from './SettingRow'
import { Switch } from '@renderer/components/ui/switch'
import { Input } from '@renderer/components/ui/input'
import { Button } from '@renderer/components/ui/button'
import { Badge } from '@renderer/components/ui/badge'

interface AiMode {
  id: string
  name: string
  description: string
  icon?: string
}

interface CustomSnippet {
  id: string
  trigger: string
  text: string
}

const PROVIDERS = ['OpenAI', 'Groq', 'Anthropic', 'Gemini', 'Mistral', 'DeepSeek', 'OpenRouter'] as const

export default function AISettingsPage(): React.JSX.Element {
  const { settings, updateSettings, loading, reload } = useSettings()
  const { t } = useI18n()
  const [modes, setModes] = useState<AiMode[]>([])
  const [dictionary, setDictionary] = useState<string[]>([])
  const [dictWord, setDictWord] = useState('')

  // Custom mode form
  const [showAddMode, setShowAddMode] = useState(false)
  const [modeName, setModeName] = useState('')
  const [modeDesc, setModeDesc] = useState('')
  const [modePrompt, setModePrompt] = useState('')

  // Snippets
  const [snippets, setSnippets] = useState<CustomSnippet[]>([])
  const [showAddSnippet, setShowAddSnippet] = useState(false)
  const [snippetTrigger, setSnippetTrigger] = useState('')
  const [snippetText, setSnippetText] = useState('')

  // API Keys state
  const [apiKeys, setApiKeys] = useState<Record<string, { key: string; has: boolean; masked: string; showPassword: boolean; testing: boolean; testResult: 'success' | 'error' | null; saved: boolean }>>(
    Object.fromEntries(
      PROVIDERS.map(p => [p.toLowerCase(), { key: '', has: false, masked: '', showPassword: false, testing: false, testResult: null, saved: false }])
    )
  )

  // Load AI modes and API keys (IPC calls, run once)
  useEffect(() => {
    const init = async () => {
      try {
        const aiModes = await window.api.getAiModes()
        setModes(aiModes)

        const newApiKeys = { ...apiKeys }
        for (const provider of PROVIDERS) {
          const key = provider.toLowerCase()
          const has = await window.api.byokHasApiKey(key)
          const masked = has ? await window.api.byokGetMaskedKey(key) : ''
          newApiKeys[key] = { ...newApiKeys[key], has, masked: masked ?? '' }
        }
        setApiKeys(newApiKeys)
      } catch (err) {
        console.error('Failed to load AI settings:', err)
      }
    }
    init()
  }, [])

  // Sync dictionary and snippets from settings (runs when settings load)
  useEffect(() => {
    if (!loading) {
      setDictionary(settings.customDictionary || [])
      setSnippets(settings.snippets || [])
    }
  }, [loading])

  // Dictionary functions
  const addDictWord = () => {
    const word = dictWord.trim()
    if (!word || word.length > 100 || dictionary.includes(word)) return
    if (dictionary.length >= 50) return
    const updated = [...dictionary, word]
    setDictionary(updated)
    setDictWord('')
    updateSettings({ customDictionary: updated })
  }

  const removeDictWord = (index: number) => {
    const updated = dictionary.filter((_, i) => i !== index)
    setDictionary(updated)
    updateSettings({ customDictionary: updated })
  }

  // Custom mode functions
  const generateModeId = (name: string): string => {
    return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  }

  const saveCustomMode = async () => {
    const trimmedName = modeName.trim()
    const trimmedDesc = modeDesc.trim()
    const trimmedPrompt = modePrompt.trim()

    if (!trimmedName || !trimmedDesc || !trimmedPrompt) return

    const id = generateModeId(trimmedName)
    try {
      await window.api.saveCustomAiMode({
        id,
        name: trimmedName,
        description: trimmedDesc,
        systemPrompt: trimmedPrompt,
        icon: 'sparkles'
      })

      setModes(await window.api.getAiModes())
      await reload()
      setModeName('')
      setModeDesc('')
      setModePrompt('')
      setShowAddMode(false)
    } catch (err) {
      console.error('Failed to save custom AI mode:', err)
    }
  }

  const deleteCustomMode = async (id: string) => {
    try {
      await window.api.deleteCustomAiMode(id)
      setModes(await window.api.getAiModes())
      await reload()
    } catch (err) {
      console.error('Failed to delete custom AI mode:', err)
    }
  }

  // Snippet functions
  const saveSnippet = async () => {
    const trimmedTrigger = snippetTrigger.trim()
    const trimmedText = snippetText.trim()

    if (!trimmedTrigger || !trimmedText) return

    const id = Date.now().toString()
    try {
      await window.api.saveSnippet({
        id,
        trigger: trimmedTrigger,
        text: trimmedText
      })

      const updated = [...snippets, { id, trigger: trimmedTrigger, text: trimmedText }]
      setSnippets(updated)
      updateSettings({ snippets: updated })
      setSnippetTrigger('')
      setSnippetText('')
      setShowAddSnippet(false)
    } catch (err) {
      console.error('Failed to save snippet:', err)
    }
  }

  const deleteSnippet = async (id: string) => {
    try {
      await window.api.deleteSnippet(id)
      const updated = snippets.filter(s => s.id !== id)
      setSnippets(updated)
      updateSettings({ snippets: updated })
    } catch (err) {
      console.error('Failed to delete snippet:', err)
    }
  }

  // API Key functions
  const handleApiKeySave = async (provider: string) => {
    const key = provider.toLowerCase()
    const keyValue = apiKeys[key].key
    try {
      await window.api.byokSaveApiKey(key, keyValue)
      const masked = await window.api.byokGetMaskedKey(key)
      setApiKeys(prev => ({
        ...prev,
        [key]: { ...prev[key], has: true, masked: masked ?? '', key: '', saved: true }
      }))
      setTimeout(() => {
        setApiKeys(prev => ({
          ...prev,
          [key]: { ...prev[key], saved: false }
        }))
      }, 2000)
    } catch (err) {
      console.error(`Failed to save ${provider} key:`, err)
    }
  }

  const handleApiKeyTest = async (provider: string) => {
    const key = provider.toLowerCase()
    const keyValue = apiKeys[key].key
    setApiKeys(prev => ({
      ...prev,
      [key]: { ...prev[key], testing: true, testResult: null }
    }))
    const success = await window.api.byokTestApiKey(key, keyValue)
    setApiKeys(prev => ({
      ...prev,
      [key]: { ...prev[key], testing: false, testResult: success ? 'success' : 'error' }
    }))
    setTimeout(() => {
      setApiKeys(prev => ({
        ...prev,
        [key]: { ...prev[key], testResult: null }
      }))
    }, 3000)
  }

  const handleApiKeyDelete = async (provider: string) => {
    const key = provider.toLowerCase()
    try {
      await window.api.byokDeleteApiKey(key)
      setApiKeys(prev => ({
        ...prev,
        [key]: { ...prev[key], has: false, masked: '', key: '' }
      }))
    } catch (err) {
      console.error(`Failed to delete ${provider} key:`, err)
    }
  }

  const toggleApiKeyPasswordVisibility = (provider: string) => {
    const key = provider.toLowerCase()
    setApiKeys(prev => ({
      ...prev,
      [key]: { ...prev[key], showPassword: !prev[key].showPassword }
    }))
  }

  const customModes = settings.customAiModes ?? []

  if (loading) return <div className="p-6 text-muted-foreground text-sm">{t('common.loading')}</div>

  return (
    <div className="space-y-6">
      <SettingSection title={t('aiSettings.postProcessing')}>
        <SettingRow label={t('aiSettings.postProcessing')} description={t('aiSettings.postProcessingDesc')}>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch
                checked={settings.postProcessingEnabled ?? false}
                onCheckedChange={(checked) => {
                  updateSettings({ postProcessingEnabled: checked })
                }}
              />

            </div>
          </div>
        </SettingRow>

        {settings.postProcessingEnabled && (
          <SettingRow label={t('aiSettings.llmProvider')} description={t('aiSettings.llmProviderDesc')}>
            <div className="flex flex-wrap gap-2">
              {PROVIDERS.map(provider => (
                <Button
                  key={provider}
                  variant={settings.postProcessingProvider === provider.toLowerCase() ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => updateSettings({ postProcessingProvider: provider.toLowerCase() })}
                >
                  {provider}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">{t('aiSettings.configureKeysBelow')}</p>
          </SettingRow>
        )}
      </SettingSection>

      {settings.postProcessingEnabled && (
        <SettingSection title={t('aiSettings.defaultAiMode')}>
          <SettingRow label={t('aiSettings.defaultMode')} description={t('aiSettings.defaultModeDesc')}>
            <select
              value={settings.defaultAiMode ?? 'raw'}
              onChange={(e) => updateSettings({ defaultAiMode: e.target.value })}
              className="h-8 text-xs rounded-md border border-input bg-background px-3 text-foreground"
            >
              {modes.map((mode) => (
                <option key={mode.id} value={mode.id}>
                  {mode.name}
                </option>
              ))}
            </select>
          </SettingRow>
        </SettingSection>
      )}

      <SettingSection title={t('aiSettings.customAiModes')}>
        {customModes.length > 0 && (
          <div className="bg-card border border-border rounded-lg p-4 space-y-2 mb-4">
            {customModes.map(mode => (
              <div key={mode.id} className="flex items-start justify-between p-3 rounded-lg bg-muted/30">
                <div className="flex-1">
                  <p className="text-sm font-medium">{mode.name}</p>
                  <p className="text-xs text-muted-foreground">{mode.description}</p>
                </div>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => deleteCustomMode(mode.id)}
                  className="h-7 text-xs ml-2"
                >
                  {t('common.delete')}
                </Button>
              </div>
            ))}
          </div>
        )}

        {showAddMode ? (
          <div className="bg-card border border-border rounded-lg p-4 space-y-3">
            <Input
              placeholder={t('aiSettings.modeNamePlaceholder')}
              value={modeName}
              onChange={(e) => setModeName(e.target.value)}
              className="h-8 text-xs"
            />
            <Input
              placeholder={t('aiSettings.modeDescPlaceholder')}
              value={modeDesc}
              onChange={(e) => setModeDesc(e.target.value)}
              className="h-8 text-xs"
            />
            <textarea
              placeholder={t('aiSettings.systemPromptPlaceholder')}
              value={modePrompt}
              onChange={(e) => setModePrompt(e.target.value)}
              rows={4}
              className="w-full h-24 rounded-md border border-border bg-secondary px-3 py-2 text-xs text-foreground resize-none"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={saveCustomMode}
                disabled={!modeName.trim() || !modeDesc.trim() || !modePrompt.trim()}
                className="h-8 text-xs"
              >
                {t('aiSettings.saveMode')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setShowAddMode(false)
                  setModeName('')
                  setModeDesc('')
                  setModePrompt('')
                }}
                className="h-8 text-xs"
              >
                {t('common.cancel')}
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddMode(true)}
            className="h-8 text-xs"
          >
            {t('aiSettings.addCustomMode')}
          </Button>
        )}
      </SettingSection>

      <SettingSection title={t('aiSettings.customDictionary')}>
        <div className="bg-card border border-border rounded-lg p-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            {t('aiSettings.dictionaryDesc')}
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={dictWord}
              onChange={(e) => setDictWord(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addDictWord() }}
              placeholder={t('aiSettings.addWordPlaceholder')}
              className="flex-1 h-8 rounded-md border border-border bg-secondary px-3 text-sm text-foreground"
            />
            <button
              onClick={addDictWord}
              disabled={!dictWord.trim() || dictWord.length > 100 || dictionary.length >= 50}
              className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/80 disabled:opacity-50"
            >
              {t('common.add')}
            </button>
          </div>
          {dictionary.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {dictionary.map((word, i) => (
                <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-secondary text-sm text-foreground border border-border">
                  {word}
                  <button onClick={() => removeDictWord(i)} className="text-muted-foreground hover:text-destructive ml-0.5">×</button>
                </span>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground">{t('aiSettings.wordCount', { count: dictionary.length })}</p>
        </div>
      </SettingSection>

      <SettingSection title={t('aiSettings.snippets')}>
        {snippets.length > 0 && (
          <div className="bg-card border border-border rounded-lg p-4 space-y-2 mb-4">
            {snippets.map(snippet => (
              <div key={snippet.id} className="flex items-start justify-between p-3 rounded-lg bg-muted/30">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium font-mono">{snippet.trigger}</p>
                  <p className="text-xs text-muted-foreground break-words">{snippet.text}</p>
                </div>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => deleteSnippet(snippet.id)}
                  className="h-7 text-xs ml-2"
                >
                  {t('common.delete')}
                </Button>
              </div>
            ))}
          </div>
        )}

        {showAddSnippet ? (
          <div className="bg-card border border-border rounded-lg p-4 space-y-3">
            <Input
              placeholder={t('aiSettings.snippetTriggerPlaceholder')}
              value={snippetTrigger}
              onChange={(e) => setSnippetTrigger(e.target.value)}
              className="h-8 text-xs"
            />
            <textarea
              placeholder={t('aiSettings.snippetTextPlaceholder')}
              value={snippetText}
              onChange={(e) => setSnippetText(e.target.value)}
              rows={4}
              className="w-full h-24 rounded-md border border-border bg-secondary px-3 py-2 text-xs text-foreground resize-none"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={saveSnippet}
                disabled={!snippetTrigger.trim() || !snippetText.trim()}
                className="h-8 text-xs"
              >
                {t('aiSettings.saveSnippet')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setShowAddSnippet(false)
                  setSnippetTrigger('')
                  setSnippetText('')
                }}
                className="h-8 text-xs"
              >
                {t('common.cancel')}
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddSnippet(true)}
            className="h-8 text-xs"
          >
            {t('aiSettings.addSnippet')}
          </Button>
        )}
      </SettingSection>

      <SettingSection title={t('aiSettings.llmApiKeys')}>
        <div className="space-y-3">
          {PROVIDERS.map(provider => {
            const key = provider.toLowerCase()
            const state = apiKeys[key]

            return (
              <div key={provider} className="flex gap-2 w-full max-w-2xl items-center">
                <span className="text-xs font-medium w-20 shrink-0">{provider}</span>
                <div className="relative flex-1">
                  <Input
                    type={state.showPassword ? 'text' : 'password'}
                    placeholder={state.has ? state.masked : t('aiSettings.enterApiKey', { provider })}
                    value={state.key}
                    onChange={(e) =>
                      setApiKeys(prev => ({
                        ...prev,
                        [key]: { ...prev[key], key: e.target.value }
                      }))
                    }
                    className="h-8 text-xs pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => toggleApiKeyPasswordVisibility(provider)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
                  >
                    {state.showPassword ? t('common.hide') : t('common.show')}
                  </button>
                </div>
                {!state.has ? (
                  <Button
                    size="sm"
                    onClick={() => handleApiKeySave(provider)}
                    className="h-8 text-xs shrink-0"
                  >
                    {t('common.save')}
                  </Button>
                ) : (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleApiKeyTest(provider)}
                      disabled={state.testing}
                      className="h-8 text-xs shrink-0"
                    >
                      {t('common.test')}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleApiKeyDelete(provider)}
                      className="h-8 text-xs shrink-0"
                    >
                      {t('common.delete')}
                    </Button>
                  </>
                )}
                {state.testResult && (
                  <Badge
                    variant={state.testResult === 'success' ? 'default' : 'destructive'}
                    className="text-xs shrink-0"
                  >
                    {state.testResult === 'success' ? t('common.success') : t('common.failed')}
                  </Badge>
                )}
                {state.saved && (
                  <Badge variant="default" className="text-xs shrink-0">
                    {t('common.saved')}
                  </Badge>
                )}
              </div>
            )
          })}
        </div>
      </SettingSection>

    </div>
  )
}
