import { app, BrowserWindow, ipcMain, clipboard, Menu, shell } from 'electron'
import { join, isAbsolute } from 'node:path'
import { electronApp, optimizer } from '@electron-toolkit/utils'

// Required for transparent windows on Windows — prevents GPU compositor crashes
if (process.platform === 'win32') {
  app.disableHardwareAcceleration()
}
import { publicSettings, validateSettings } from './settings-policy'
import { StorageService } from './storage'
import { HotkeyManager } from './hotkey'
import { TrayManager } from './tray'
import { WindowManager } from './window'
import { TranscriptionService } from './transcription'
import { ClipboardService } from './clipboard'
import { NotificationService } from './notifications'
import ApiKeysService from './api-keys'
import ModelManager from './model-manager'
import { getAllModes } from './ai-modes'
import { AppState } from '../shared/types'
import { initMainI18n, setMainLocale, mt } from './i18n'
import { MODEL_CATALOG } from '../shared/constants'

// Isolate all settings, encrypted keys, Chromium sessions and models from production.
const testData = !app.isPackaged ? process.env.MURMUR_TEST_USER_DATA : undefined
if (testData && !isAbsolute(testData)) throw new Error('MURMUR_TEST_USER_DATA must be absolute')
app.setPath('userData', testData || join(app.getPath('appData'), 'Murmur Community'))

// Services
let storage: StorageService
let hotkey: HotkeyManager
let tray: TrayManager
let windowManager: WindowManager
let transcription: TranscriptionService
let clipboardService: ClipboardService
let notifications: NotificationService
let apiKeys: ApiKeysService
let modelManager: ModelManager

// Double-tap detection and concurrency guard
let lastHotkeyTime = 0
let isProcessingHotkey = false
let isStartingHotkey = false
const DOUBLE_TAP_MS = 500

// Shortcut test mode — resolved when the hotkey is pressed during test
let shortcutTestResolve: ((value: boolean) => void) | null = null

// Demo mode — full dictation test with visible ChatGPT
let demoMode = false
let demoGeneration = 0
function exitDemo(): void {
  if (!demoMode) return
  demoMode = false
  demoGeneration++
  transcription.cancelDictation()
  windowManager.hideChatGPT()
}

function broadcastState(state: AppState): void {
  console.log(`[Murmur] State → ${state}`)
  for (const win of windowManager.getLocalWindows()) {
    if (!win.isDestroyed()) {
      try {
        win.webContents.send('app:state-change', state)
      } catch {
        // Render frame may be disposed during window transitions
      }
    }
  }
  tray?.setState(state)

}

function broadcastDemoError(message: string): void {
  for (const win of windowManager.getLocalWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('demo:error', message)
    }
  }
}

async function handleDemoToggle(): Promise<void> {
  if (!demoMode) return
  const generation = demoGeneration
  console.log(`[Murmur] Demo toggle, state=${transcription.getState()}`)
  if (isProcessingHotkey) return
  isProcessingHotkey = true

  try {
    if (transcription.getState() === 'idle') {
      console.log('[Murmur] Demo: starting dictation...')
      if (storage.getConfig().transcriptionProvider === 'chatgpt') windowManager.showChatGPT()
      await transcription.startDictation()
    } else if (transcription.getState() === 'listening') {
      console.log('[Murmur] Demo: stopping dictation...')
      const text = await transcription.stopDictation()
      if (!demoMode || generation !== demoGeneration) return
      windowManager.hideOverlay()
      // Send text to renderer instead of clipboard paste
      for (const win of windowManager.getLocalWindows()) {
        if (!win.isDestroyed()) {
          win.webContents.send('demo:result', text || '')
        }
      }
      if (text) {
        storage.addToHistory({
          id: Date.now().toString(),
          text,
          timestamp: Date.now(),
          duration: 0,
          wordCount: text.trim().split(/\s+/).filter(Boolean).length
        })
        storage.incrementUsage()
      }
    }
  } catch (err) {
    if (!demoMode || generation !== demoGeneration) return
    console.error('Demo toggle error:')

    // Reset state cleanly
    transcription.resetToIdle()

    // Send error to renderer UI
    const message = err instanceof Error && err.message.includes('session')
      ? mt('notifications.demoVoiceNotFound')
      : mt('notifications.demoError')
    broadcastDemoError(message)
  } finally {
    isProcessingHotkey = false
  }
}

async function handleHotkeyPress(): Promise<void> {
  console.log('[Murmur] Hotkey pressed')

  // If we're in shortcut test mode, resolve the test and show brief overlay feedback
  if (shortcutTestResolve) {
    console.log('[Murmur] Hotkey: shortcut test mode → resolving')
    const resolve = shortcutTestResolve
    shortcutTestResolve = null
    windowManager.showOverlay()
    setTimeout(() => windowManager.hideOverlay(), 1500)
    resolve(true)
    return
  }

  // If demo mode, use demo flow (visible ChatGPT, no clipboard paste)
  if (demoMode) {
    console.log('[Murmur] Hotkey: demo mode → delegating')
    return handleDemoToggle()
  }

  // Cancellation must reach the service even while ChatGPT startup is pending.
  const now = Date.now()
  if (now - lastHotkeyTime < DOUBLE_TAP_MS &&
      (isStartingHotkey || transcription.getState() === 'listening')) {
    console.log('[Murmur] Double-tap detected, cancelling dictation')
    transcription.cancelDictation()
    return
  }

  // Only the original handler owns/releases the concurrency guard.
  if (isProcessingHotkey) return
  isProcessingHotkey = true
  isStartingHotkey = transcription.getState() === 'idle'

  try {
    lastHotkeyTime = now

    console.log(`[Murmur] Hotkey: normal mode, state=${transcription.getState()}`)

    console.log('[Murmur] Calling transcription.toggle()')
    await transcription.toggle()
  } catch (err) {
    console.error('Hotkey handler error:')
  } finally {
    isStartingHotkey = false
    isProcessingHotkey = false
  }
}

async function handleAiProcessPress(): Promise<void> {
  console.log('[Murmur] AI Process hotkey pressed')
  if (isProcessingHotkey) return
  isProcessingHotkey = true

  try {

    // Force AI post-processing regardless of user's postProcessingEnabled setting
    await transcription.toggle({ forceAi: true })
  } catch (err) {
    console.error('AI Process hotkey handler error:')
  } finally {
    isProcessingHotkey = false
  }
}

async function handleHandsFreePress(): Promise<void> {
  console.log('[Murmur] Hands-free hotkey pressed')
  if (isProcessingHotkey) return
  isProcessingHotkey = true
  try {

    const config = storage.getConfig()
    if (config.handsFreeContinuous) {
      await transcription.toggleContinuous()
    } else {
      await transcription.toggle()
    }
  } catch (err) {
    console.error('Hands-free hotkey handler error:')
  } finally {
    isProcessingHotkey = false
  }
}

function setupIPC(): void {
  const handle = (channel: string, listener: (event: Electron.IpcMainInvokeEvent, ...args: any[]) => unknown): void => {
    ipcMain.handle(channel, (event, ...args) => {
      if (!windowManager.isTrustedSender(event)) throw new Error('Untrusted IPC sender')
      return listener(event, ...args)
    })
  }
  // Window controls (frameless window)
  handle('window:minimize', () => {
    BrowserWindow.getFocusedWindow()?.minimize()
  })
  handle('window:maximize', () => {
    const win = BrowserWindow.getFocusedWindow()
    if (win?.isMaximized()) win.unmaximize()
    else win?.maximize()
  })
  handle('window:close', () => {
    exitDemo()
    BrowserWindow.getFocusedWindow()?.close()
  })

  handle('settings:get', () => publicSettings(storage.getConfig()))

  handle('settings:set', (_event, input: unknown) => {
    const settings = validateSettings(input)
    const previous = storage.getConfig()
    const changed: Array<['transcribe' | 'aiProcess' | 'handsFree', string]> = []
    if (!testData) {
      for (const [field, action] of [['hotkey', 'transcribe'], ['hotkeyAiProcess', 'aiProcess'], ['hotkeyHandsFree', 'handsFree']] as const) {
        const key = settings[field]
        if (key === undefined) continue
        if (!hotkey.updateShortcut(action, key)) {
          for (const [name, oldKey] of changed.reverse()) hotkey.updateShortcut(name, oldKey)
          throw new Error(`Could not register shortcut "${key}". Choose an available shortcut.`)
        }
        changed.push([action, previous[field]])
      }
    }
    storage.setConfig(settings)
    if (!testData && settings.autoStart !== undefined) app.setLoginItemSettings({ openAtLogin: settings.autoStart, path: app.getPath('exe') })
    if (settings.locale !== undefined) { setMainLocale(settings.locale); tray?.buildMenu() }
  })

  handle('history:get', () => {
    return storage.getHistory()
  })

  handle('history:clear', () => {
    storage.clearHistory()
  })

  handle('clipboard:copy', (_event, text: string) => {
    clipboard.writeText(text)
  })

  handle('shortcut:test', () => {
    return new Promise<boolean>((resolve) => {
      // Cancel any previous pending test
      if (shortcutTestResolve) {
        shortcutTestResolve(false)
      }
      shortcutTestResolve = resolve
      // Timeout after 15 seconds if user never presses the shortcut
      setTimeout(() => {
        if (shortcutTestResolve === resolve) {
          shortcutTestResolve = null
          resolve(false)
        }
      }, 15000)
    })
  })

  // Fallback: renderer detected hotkey keydown while its window has focus
  // (globalShortcut may not fire when an Electron window is focused on Windows)
  handle('shortcut:test-keypress', () => {
    if (shortcutTestResolve) {
      const resolve = shortcutTestResolve
      shortcutTestResolve = null
      windowManager.showOverlay()
      setTimeout(() => windowManager.hideOverlay(), 1500)
      resolve(true)
    }
  })

  handle('chatgpt:check-session', async () => {
    return transcription.checkSession()
  })

  handle('chatgpt:login', () => {
    windowManager.showChatGPTForLogin()
  })

  handle('chatgpt:hide', () => {
    windowManager.hideChatGPT()
  })

  handle('demo:enter', () => {
    console.log('[Murmur] Demo mode entered')
    demoMode = true
    if (storage.getConfig().transcriptionProvider === 'chatgpt') windowManager.showChatGPT()
  })

  handle('demo:exit', () => {
    exitDemo()
  })

  // Renderer-triggered demo toggle (hotkey keydown fallback)
  handle('demo:toggle', () => {
    console.log('[Murmur] Demo toggle IPC received')
    handleDemoToggle().catch(() => console.error('[Murmur] Operation failed'))
  })

  handle('stats:get', () => {
    return storage.getStats()
  })

  handle('window:navigate', (_event, path: string) => {
    const mainWin = windowManager.getMainWindow()
    if (mainWin && !mainWin.isDestroyed()) {
      mainWin.webContents.send('window:navigate', path)
    }
  })

  handle('audio:devices', async () => {
    const mainWin = windowManager.getMainWindow()
    if (!mainWin) return []
    const devices = await mainWin.webContents.executeJavaScript(
      `navigator.mediaDevices.enumerateDevices().then(d => d.filter(x => x.kind === "audioinput").map(x => ({ deviceId: x.deviceId, label: x.label })))`
    )
    return devices
  })

  handle('history:delete', (_event, id: string) => {
    const history = storage.getHistory()
    const filtered = history.filter(e => e.id !== id)
    storage.setHistory(filtered)
  })

  handle('app:version', () => {
    return app.getVersion()
  })

  handle('app:locale', () => {
    return app.getLocale()
  })

  handle('shell:open-external', (_event, url: string) => {
    try {
      const parsed = new URL(url)
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
        shell.openExternal(parsed.href)
      }
    } catch { /* invalid URL */ }
  })

  // BYOK API key management
  const ALLOWED_PROVIDERS = ['groq', 'openai', 'anthropic', 'gemini', 'mistral', 'deepseek', 'openrouter', 'deepgram', 'assemblyai', 'elevenlabs']

  handle('byok:save-api-key', (_event, provider: string, key: string) => {
    if (!ALLOWED_PROVIDERS.includes(provider)) throw new Error('Invalid provider')
    if (!key || key.length < 10 || key.length > 1000) throw new Error('Invalid API key')
    apiKeys.saveApiKey(provider, key)
  })

  handle('byok:has-api-key', (_event, provider: string) => {
    if (!ALLOWED_PROVIDERS.includes(provider)) return false
    return apiKeys.hasApiKey(provider)
  })

  handle('byok:get-masked-key', (_event, provider: string) => {
    if (!ALLOWED_PROVIDERS.includes(provider)) return null
    return apiKeys.getMaskedKey(provider)
  })

  handle('byok:test-api-key', async (_event, provider: string, key: string) => {
    if (!ALLOWED_PROVIDERS.includes(provider)) return false
    return apiKeys.testApiKey(provider, key)
  })

  handle('byok:delete-api-key', (_event, provider: string) => {
    if (!ALLOWED_PROVIDERS.includes(provider)) throw new Error('Invalid provider')
    apiKeys.deleteApiKey(provider)
  })

  // AI Modes
  handle('ai-modes:list', () => {
    const config = storage.getConfig()
    return getAllModes(config.customAiModes)
  })

  handle('ai-modes:save-custom', (_event, mode: { id: string; name: string; description: string; systemPrompt: string; icon: string }) => {
    if (!mode.id || !mode.name || !mode.systemPrompt) throw new Error('Invalid mode')
    if (mode.name.length > 100) throw new Error('Mode name too long')
    if (mode.systemPrompt.length > 5000) throw new Error('System prompt too long')
    if (/\x00/.test(mode.systemPrompt)) throw new Error('Invalid characters in prompt')
    const sanitized = { ...mode, name: mode.name.trim(), systemPrompt: mode.systemPrompt.trim() }
    const config = storage.getConfig()
    const existing = (config.customAiModes || []).filter(m => m.id !== sanitized.id)
    storage.setConfig({ customAiModes: [...existing, sanitized] })
  })

  handle('ai-modes:delete-custom', (_event, modeId: string) => {
    if (!modeId) throw new Error('Invalid mode ID')
    const config = storage.getConfig()
    storage.setConfig({ customAiModes: (config.customAiModes || []).filter(m => m.id !== modeId) })
  })

  // Snippets
  handle('snippets:list', () => {
    return storage.getConfig().snippets || []
  })

  handle('snippets:save', (_event, snippet: { id: string; trigger: string; text: string }) => {
    if (!snippet.id || !snippet.trigger?.trim() || !snippet.text) throw new Error('Invalid snippet')
    if (snippet.trigger.length > 200) throw new Error('Trigger too long')
    if (snippet.text.length > 10000) throw new Error('Snippet text too long')
    if (/\x00/.test(snippet.text)) throw new Error('Invalid characters in snippet')
    const sanitized = { ...snippet, trigger: snippet.trigger.trim(), text: snippet.text.trim() }
    const config = storage.getConfig()
    const existing = (config.snippets || []).filter(s => s.id !== sanitized.id)
    storage.setConfig({ snippets: [...existing, sanitized] })
  })

  handle('snippets:delete', (_event, snippetId: string) => {
    if (!snippetId) throw new Error('Invalid snippet ID')
    const config = storage.getConfig()
    storage.setConfig({ snippets: (config.snippets || []).filter(s => s.id !== snippetId) })
  })

  // Local model management
  handle('models:catalog', () => {
    return MODEL_CATALOG
  })

  handle('models:installed', () => {
    return modelManager.getInstalledModels()
  })

  handle('models:is-installed', (_event, modelId: string) => {
    if (typeof modelId !== 'string') return false
    return modelManager.isModelInstalled(modelId)
  })

  handle('models:runtime-status', () => {
    return modelManager.isRuntimeInstalled()
  })

  handle('models:install', async (event, modelId: string) => {
    if (typeof modelId !== 'string') throw new Error('Invalid model ID')
    const entry = MODEL_CATALOG.find((m) => m.id === modelId)
    if (!entry) throw new Error(`Unknown model: ${modelId}`)

    await modelManager.installModel(modelId, (data) => {
      try {
        event.sender.send('models:install-progress', data)
      } catch { /* window may be closed */ }
    })
  })

  handle('models:delete', (_event, modelId: string) => {
    if (typeof modelId !== 'string') throw new Error('Invalid model ID')
    modelManager.deleteModel(modelId)
  })
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.murmur.community')

  // Remove application menu (no File/Edit/View bar)
  Menu.setApplicationMenu(null)

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
    window.on('close', () => {
      if (windowManager?.getLocalWindows().includes(window)) exitDemo()
    })
  })

  // Initialize storage first
  storage = new StorageService()
  storage.init()

  // Initialize main process i18n (reads stored locale or detects from OS)
  const storedConfig = storage.getConfig()
  initMainI18n(storedConfig.locale as string | undefined)

  // Initialize services
  notifications = new NotificationService()
  clipboardService = new ClipboardService()
  windowManager = new WindowManager()
  // Create overlay window (hidden)
  windowManager.createOverlayWindow()

  // Initialize API keys service (encrypted storage)
  apiKeys = new ApiKeysService(
    () => storage.getConfig(),
    (partial) => storage.setConfig(partial)
  )

  // Initialize model manager (local STT models)
  modelManager = new ModelManager()

  // Initialize transcription service
  transcription = new TranscriptionService(
    windowManager,
    clipboardService,
    storage,
    notifications,
    apiKeys,
    modelManager
  )
  transcription.setStateChangeListener(broadcastState)

  // Create main window (hidden initially — tray app)
  windowManager.createMainWindow()

  // Set up tray
  tray = new TrayManager({
    onDictate: () => handleHotkeyPress(),
    onShowApp: (route?: string) => windowManager.showMainWindow(route)
  })
  tray.create()

  // Set up global hotkeys
  hotkey = new HotkeyManager()
  const config = storage.getConfig()
  const transcribeKey = config.hotkey || 'ctrl+space'
  const transcribeOk = !!testData || hotkey.register('transcribe', transcribeKey, () => { handleHotkeyPress().catch(() => console.error('[Murmur] Operation failed')) })
  if (!transcribeOk) {
    console.error(`[Murmur] ⚠️  Hotkey "${transcribeKey}" failed to register — likely taken by another app or macOS (e.g. input method switching). Change it in Settings.`)
    windowManager.getMainWindow()?.webContents.send('hotkey:registration-failed', transcribeKey)
  }
  if (!testData) {
    hotkey.register('aiProcess', config.hotkeyAiProcess, () => { handleAiProcessPress().catch(() => console.error('[Murmur] Operation failed')) })
  }
  if (!testData) {
    hotkey.register('handsFree', config.hotkeyHandsFree, () => { handleHandsFreePress().catch(() => console.error('[Murmur] Operation failed')) })
  }
  if (!testData) hotkey.register('cancel', 'Escape', () => { transcription.cancelDictation() })

  console.log(`[Murmur] Hotkeys registered: transcribe=${transcribeKey}${transcribeOk ? '' : ' (FAILED)'}`)

  // Set up IPC handlers
  setupIPC()

  // Check onboarding
  if (!config.onboardingCompleted) {
    windowManager.createOnboardingWindow()
  }

  console.log('[Murmur] App started, services initialized')

  // Sync auto-start with system
  const autoStartConfig = storage.getConfig()
  if (!testData) app.setLoginItemSettings({
    openAtLogin: autoStartConfig.autoStart,
    path: app.getPath('exe')
  })
})

// On Windows, hide to tray instead of quitting when all windows are closed
app.on('window-all-closed', () => {
  // Don't quit - keep running in tray
})

app.on('before-quit', async () => {
  hotkey?.destroy()
  tray?.destroy()
  transcription?.stopSessionMonitoring()
  windowManager?.destroyAll()
})

// Global error handler
process.on('uncaughtException', () => {
  console.error('Uncaught exception:')
})

process.on('unhandledRejection', () => {
  console.error('Unhandled rejection:')
})
