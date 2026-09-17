interface Window {
  api: {
    getSettings: () => Promise<Record<string, unknown>>
    setSettings: (settings: Record<string, unknown>) => Promise<void>
    getHistory: () => Promise<
      Array<{ id: string; text: string; timestamp: number; duration: number }>
    >
    clearHistory: () => Promise<void>
    copyToClipboard: (text: string) => Promise<void>
    testShortcut: () => Promise<boolean>
    testShortcutKeypress: () => Promise<void>
    checkChatGPTSession: () => Promise<boolean>
    loginChatGPT: () => Promise<void>
    hideChatGPT: () => Promise<void>
    demoEnter: () => Promise<void>
    demoExit: () => Promise<void>
    demoToggle: () => Promise<void>
    onDemoResult: (callback: (text: string) => void) => void
    onDemoError: (callback: (message: string) => void) => void
    onStateChange: (callback: (state: string) => void) => void
    getStats: () => Promise<unknown>
    getDevices: () => Promise<unknown[]>
    deleteHistoryEntry: (id: string) => Promise<void>
    onNavigate: (callback: (path: string) => void) => void
    getVersion: () => Promise<string>
    getLocale: () => Promise<string>
    windowMinimize: () => Promise<void>
    windowMaximize: () => Promise<void>
    windowClose: () => Promise<void>
    openExternal: (url: string) => Promise<void>
    onHotkeyRegistrationFailed: (callback: (key: string) => void) => void
    navigate: (path: string) => Promise<void>

    // BYOK API keys
    byokSaveApiKey: (provider: string, key: string) => Promise<void>
    byokHasApiKey: (provider: string) => Promise<boolean>
    byokGetMaskedKey: (provider: string) => Promise<string | null>
    byokTestApiKey: (provider: string, key: string) => Promise<boolean>
    byokDeleteApiKey: (provider: string) => Promise<void>

    // AI Modes
    getAiModes: () => Promise<{ id: string; name: string; description: string }[]>

    saveCustomAiMode: (mode: { id: string; name: string; description: string; systemPrompt: string; icon: string }) => Promise<void>
    deleteCustomAiMode: (id: string) => Promise<void>
    getSnippets: () => Promise<{ id: string; trigger: string; text: string }[]>
    saveSnippet: (snippet: { id: string; trigger: string; text: string }) => Promise<void>
    deleteSnippet: (id: string) => Promise<void>
    onLiveText: (callback: (text: string) => void) => void

    // Overlay recording
    sendAudioData: (buffer: ArrayBuffer) => void
    onRecordingStart: (callback: (options?: { format?: string }) => void) => void
    onRecordingStop: (callback: () => void) => void

    // Local model management
    getModelCatalog: () => Promise<any[]>
    getInstalledModels: () => Promise<{ id: string; name: string; type: string; path: string }[]>
    isModelInstalled: (id: string) => Promise<boolean>
    getRuntimeStatus: () => Promise<boolean>
    installModel: (id: string) => Promise<void>
    deleteModel: (id: string) => Promise<void>
    onModelInstallProgress: (callback: (data: { modelId: string; file: string; pct: number; overallPct: number }) => void) => void
    removeModelInstallProgressListener: () => void
  }
}
