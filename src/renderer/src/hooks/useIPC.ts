import { useState, useEffect, useCallback } from 'react'
import { t } from '@renderer/i18n/i18n'

interface Settings {
  shortcut?: string
  hotkey?: string
  hotkeyAiProcess?: string
  hotkeyHandsFree?: string
  autoStart?: boolean
  onboardingCompleted?: boolean
  soundEnabled?: boolean
  transcriptionProvider?: string
  postProcessingEnabled?: boolean
  postProcessingProvider?: string
  defaultAiMode?: string
  localModel?: string | null
  customDictionary?: string[]
  customAiModes?: { id: string; name: string; description: string; systemPrompt: string; icon: string }[]
  snippets?: { id: string; trigger: string; text: string }[]
  handsFreeContinuous?: boolean
  liveTextDurationMs?: number
}

interface HistoryEntry {
  id: string
  text: string
  timestamp: number
  duration: number
}

export function useSettings() {
  const [settings, setSettingsState] = useState<Settings>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true)
      const data = await window.api.getSettings()
      setSettingsState(data as Settings)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.loadSettings'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  const updateSettings = useCallback(
    async (newSettings: Partial<Settings>) => {
      try {
        await window.api.setSettings(newSettings)
        setSettingsState(current => ({ ...current, ...newSettings }))
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : t('errors.saveSettings'))
      }
    },
    [settings]
  )

  return { settings, updateSettings, loading, error, reload: loadSettings }
}

export function useHistory() {
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadHistory = useCallback(async () => {
    try {
      setLoading(true)
      const data = await window.api.getHistory()
      setHistory(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.loadHistory'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  const clearHistory = useCallback(async () => {
    try {
      await window.api.clearHistory()
      setHistory([])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.deleteHistory'))
    }
  }, [])

  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await window.api.copyToClipboard(text)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.copyError'))
    }
  }, [])

  return { history, loading, error, clearHistory, copyToClipboard, reload: loadHistory }
}

export function useChatGPT(enabled = false) {
  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const checkSession = useCallback(async () => {
    try {
      setLoading(true)
      const result = await window.api.checkChatGPTSession()
      setConnected(result)
      setError(null)
      return result
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.verifyError'))
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (enabled) checkSession()
  }, [checkSession, enabled])

  const login = useCallback(async () => {
    try {
      await window.api.loginChatGPT()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.loginError'))
    }
  }, [])

  return { connected, loading, error, checkSession, login }
}
