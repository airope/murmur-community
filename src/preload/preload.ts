import { contextBridge, ipcRenderer } from 'electron'

const api = {
  getSettings: (): Promise<Record<string, unknown>> => ipcRenderer.invoke('settings:get'),
  setSettings: (settings: Record<string, unknown>): Promise<void> =>
    ipcRenderer.invoke('settings:set', settings),
  getHistory: (): Promise<unknown[]> => ipcRenderer.invoke('history:get'),
  clearHistory: (): Promise<void> => ipcRenderer.invoke('history:clear'),
  copyToClipboard: (text: string): Promise<void> =>
    ipcRenderer.invoke('clipboard:copy', text),
  testShortcut: (): Promise<boolean> => ipcRenderer.invoke('shortcut:test'),
  testShortcutKeypress: (): Promise<void> => ipcRenderer.invoke('shortcut:test-keypress'),
  checkChatGPTSession: (): Promise<boolean> => ipcRenderer.invoke('chatgpt:check-session'),
  loginChatGPT: (): Promise<void> => ipcRenderer.invoke('chatgpt:login'),
  hideChatGPT: (): Promise<void> => ipcRenderer.invoke('chatgpt:hide'),
  demoEnter: (): Promise<void> => ipcRenderer.invoke('demo:enter'),
  demoExit: (): Promise<void> => ipcRenderer.invoke('demo:exit'),
  demoToggle: (): Promise<void> => ipcRenderer.invoke('demo:toggle'),
  onDemoResult: (callback: (text: string) => void): void => {
    ipcRenderer.on('demo:result', (_event, text) => callback(text))
  },
  onDemoError: (callback: (message: string) => void): void => {
    ipcRenderer.on('demo:error', (_event, message) => callback(message))
  },
  onStateChange: (callback: (state: string) => void): void => {
    ipcRenderer.on('app:state-change', (_event, state) => callback(state))
  },
  getStats: (): Promise<unknown> => ipcRenderer.invoke('stats:get'),
  navigate: (path: string): Promise<void> => ipcRenderer.invoke('window:navigate', path),
  getDevices: (): Promise<unknown[]> => ipcRenderer.invoke('audio:devices'),
  deleteHistoryEntry: (id: string): Promise<void> => ipcRenderer.invoke('history:delete', id),
  onNavigate: (callback: (path: string) => void): void => {
    ipcRenderer.on('window:navigate', (_event, path) => callback(path))
  },
  getVersion: (): Promise<string> => ipcRenderer.invoke('app:version'),
  windowMinimize: (): Promise<void> => ipcRenderer.invoke('window:minimize'),
  windowMaximize: (): Promise<void> => ipcRenderer.invoke('window:maximize'),
  windowClose: (): Promise<void> => ipcRenderer.invoke('window:close'),
  getLocale: (): Promise<string> => ipcRenderer.invoke('app:locale'),
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke('shell:open-external', url),
  onHotkeyRegistrationFailed: (callback: (key: string) => void): void => {
    ipcRenderer.on('hotkey:registration-failed', (_event, key) => callback(key))
  },
  byokSaveApiKey: (provider: string, key: string): Promise<void> =>
    ipcRenderer.invoke('byok:save-api-key', provider, key),
  byokHasApiKey: (provider: string): Promise<boolean> =>
    ipcRenderer.invoke('byok:has-api-key', provider),
  byokGetMaskedKey: (provider: string): Promise<string | null> =>
    ipcRenderer.invoke('byok:get-masked-key', provider),
  byokTestApiKey: (provider: string, key: string): Promise<boolean> =>
    ipcRenderer.invoke('byok:test-api-key', provider, key),
  byokDeleteApiKey: (provider: string): Promise<void> =>
    ipcRenderer.invoke('byok:delete-api-key', provider),

  // AI Modes
  getAiModes: (): Promise<any[]> => ipcRenderer.invoke('ai-modes:list'),
  saveCustomAiMode: (mode: any): Promise<void> => ipcRenderer.invoke('ai-modes:save-custom', mode),
  deleteCustomAiMode: (id: string): Promise<void> => ipcRenderer.invoke('ai-modes:delete-custom', id),

  // Snippets
  getSnippets: (): Promise<any[]> => ipcRenderer.invoke('snippets:list'),
  saveSnippet: (snippet: any): Promise<void> => ipcRenderer.invoke('snippets:save', snippet),
  deleteSnippet: (id: string): Promise<void> => ipcRenderer.invoke('snippets:delete', id),

  // Overlay recording (overlay → main)
  sendAudioData: (buffer: ArrayBuffer): void => {
    ipcRenderer.send('recording:audio-data', Buffer.from(buffer))
  },
  onRecordingStart: (callback: (options?: { format?: string }) => void): void => {
    ipcRenderer.on('recording:start', (_event, options) => callback(options))
  },
  onRecordingStop: (callback: () => void): void => {
    ipcRenderer.on('recording:stop', () => callback())
  },

  // Live text preview (main → overlay)
  onLiveText: (callback: (text: string) => void): void => {
    ipcRenderer.on('overlay:live-text', (_event, text) => callback(text))
  },

  // Local model management
  getModelCatalog: (): Promise<any[]> => ipcRenderer.invoke('models:catalog'),
  getInstalledModels: (): Promise<any[]> => ipcRenderer.invoke('models:installed'),
  isModelInstalled: (id: string): Promise<boolean> => ipcRenderer.invoke('models:is-installed', id),
  getRuntimeStatus: (): Promise<boolean> => ipcRenderer.invoke('models:runtime-status'),
  installModel: (id: string): Promise<void> => ipcRenderer.invoke('models:install', id),
  deleteModel: (id: string): Promise<void> => ipcRenderer.invoke('models:delete', id),
  onModelInstallProgress: (callback: (data: any) => void): void => {
    ipcRenderer.on('models:install-progress', (_event, data) => callback(data))
  },
  removeModelInstallProgressListener: (): void => {
    ipcRenderer.removeAllListeners('models:install-progress')
  }
}

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('api', api)
} else {
  // @ts-expect-error fallback
  window.api = api
}
