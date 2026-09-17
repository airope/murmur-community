import { ipcMain } from 'electron'
import { AppState } from '../shared/types'
import { SESSION_CHECK_SCRIPT } from '../chatgpt/session-check'
import { VOICE_START_SCRIPT } from '../chatgpt/voice-start'
import { VOICE_STOP_SCRIPT } from '../chatgpt/voice-stop'
import { SELECTORS } from '../chatgpt/selectors'
import { WindowManager } from './window'
import { ClipboardService } from './clipboard'
import { StorageService } from './storage'
import { NotificationService } from './notifications'
import { CHATGPT_URL } from '../shared/constants'
import {
  TimeoutError,
  SessionExpiredError,
  EmptyTranscriptionError
} from './errors'
import GroqSTTService from './groq-stt'
import DeepgramSTTService from './deepgram-stt'
import AssemblyAISTTService from './assemblyai-stt'
import ElevenLabsSTTService from './elevenlabs-stt'
import LLMService from './llm-service'
import LocalSTTService from './local-stt'
import ApiKeysService from './api-keys'
import ModelManager from './model-manager'
import { MODEL_CATALOG } from '../shared/constants'
import { getMode } from './ai-modes'

const CHATGPT_LISTENING_TIMEOUT_MS = 600_000 // 10 minutes safety net for ChatGPT DOM mode

export class TranscriptionService {
  private state: AppState = 'idle'
  private windowManager: WindowManager
  private clipboardService: ClipboardService
  private storage: StorageService
  private notifications: NotificationService
  private apiKeys: ApiKeysService
  private modelManager: ModelManager
  private onStateChange: ((state: AppState) => void) | null = null
  private listeningTimer: ReturnType<typeof setTimeout> | null = null
  private pendingAudioResolve: ((buffer: Buffer) => void) | null = null
  private isToggling = false
  private cancellationGeneration = 0
  private activeMode: 'local' | 'groq' | 'chatgpt' | 'deepgram' | 'assemblyai' | 'elevenlabs' | null = null
  private continuousMode = false
  private listeningStartedAt: number = 0

  constructor(
    windowManager: WindowManager,
    clipboardService: ClipboardService,
    storage: StorageService,
    notifications: NotificationService,
    apiKeys: ApiKeysService,
    modelManager: ModelManager
  ) {
    this.windowManager = windowManager
    this.clipboardService = clipboardService
    this.storage = storage
    this.notifications = notifications
    this.apiKeys = apiKeys
    this.modelManager = modelManager

    // Listen for audio data from overlay
    ipcMain.on('recording:audio-data', (_event, buffer: Buffer) => {
      if (!this.windowManager.isTrustedSender(_event) || !Buffer.isBuffer(buffer) || buffer.length > 100 * 1024 * 1024) return
      if (this.pendingAudioResolve) {
        this.pendingAudioResolve(buffer)
        this.pendingAudioResolve = null
      }
    })
  }

  private isGroqMode(): boolean {
    const config = this.storage.getConfig()
    return config.transcriptionProvider === 'groq' && this.apiKeys.hasApiKey('groq')
  }

  private isLocalMode(): boolean {
    const config = this.storage.getConfig()
    return (
      config.transcriptionProvider === 'local' &&
      !!config.localModel &&
      this.modelManager.isModelInstalled(config.localModel) &&
      this.modelManager.isRuntimeInstalled()
    )
  }

  private isDeepgramMode(): boolean {
    const config = this.storage.getConfig()
    return config.transcriptionProvider === 'deepgram' && this.apiKeys.hasApiKey('deepgram')
  }

  private isAssemblyAIMode(): boolean {
    const config = this.storage.getConfig()
    return config.transcriptionProvider === 'assemblyai' && this.apiKeys.hasApiKey('assemblyai')
  }

  private isElevenLabsMode(): boolean {
    const config = this.storage.getConfig()
    return config.transcriptionProvider === 'elevenlabs' && this.apiKeys.hasApiKey('elevenlabs')
  }

  setStateChangeListener(listener: (state: AppState) => void): void {
    this.onStateChange = listener
  }

  getState(): AppState {
    return this.state
  }

  private setState(state: AppState): void {
    console.log(`[Murmur] Transcription state: ${state}`)
    this.state = state
    this.onStateChange?.(state)
  }

  private clearListeningTimer(): void {
    if (this.listeningTimer) {
      clearTimeout(this.listeningTimer)
      this.listeningTimer = null
    }
  }

  /** Force-reset to idle, hide overlay, clear timers */
  resetToIdle(): void {
    console.log('[Murmur] Transcription: force reset to idle')
    this.clearListeningTimer()
    this.pendingAudioResolve = null
    this.activeMode = null
    this.continuousMode = false
    this.windowManager.hideOverlay()
    this.setState('idle')
  }

  cancelDictation(): void {
    this.cancellationGeneration++
    console.log('[Murmur] Dictation cancelled by user')

    if (this.activeMode === 'chatgpt') {
      this.cancelChatGPTRecording(this.getChatGPTWebContents())
    } else {
      this.windowManager.sendToOverlay('recording:stop')
    }

    this.resetToIdle()
  }

  private cancelChatGPTRecording(wc: Electron.WebContents | null): void {
    if (wc) {
      wc.executeJavaScript(`
          (function() {
            var cancelBtn = document.querySelector('${SELECTORS.cancelDictationButton}');
            if (cancelBtn) { cancelBtn.click(); return true; }
            return false;
          })()
        `).catch(() => {})
    }
  }

  private getChatGPTWebContents(): Electron.WebContents | null {
    const win = this.windowManager.getChatGPTWindow()
    if (!win || win.isDestroyed()) return null
    return win.webContents
  }

  async checkSession(): Promise<boolean> {
    const wc = this.getChatGPTWebContents()
    if (!wc) return false
    try {
      return await wc.executeJavaScript(SESSION_CHECK_SCRIPT)
    } catch {
      return false
    }
  }

  private sessionMonitorInterval: ReturnType<typeof setInterval> | null = null
  private sessionMonitorAborted = false

  /** Check if ChatGPT page is navigated to the right URL, with retry */
  private async ensureChatGPTReady(): Promise<boolean> {
    const MAX_RETRIES = 3
    const RETRY_DELAY_MS = 2000

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      console.log(`[Murmur] ensureChatGPTReady: attempt ${attempt}/${MAX_RETRIES}`)
      const result = await this.tryChatGPTReady()
      if (result) return true

      if (attempt < MAX_RETRIES) {
        console.log(`[Murmur] ensureChatGPTReady: retrying in ${RETRY_DELAY_MS}ms...`)
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS))
      }
    }

    console.log('[Murmur] ensureChatGPTReady: all retries exhausted')
    return false
  }

  /** Single attempt to verify ChatGPT is ready */
  private async tryChatGPTReady(): Promise<boolean> {
    const wc = this.getChatGPTWebContents()
    if (!wc) {
      console.log('[Murmur] tryChatGPTReady: no webContents, recreating...')
      this.windowManager.createHiddenChatGPT()
      this.setupWindowHealthMonitoring()
      // Wait for page to actually finish loading
      const loaded = await this.windowManager.waitForChatGPTLoad(15000)
      if (!loaded) {
        console.log('[Murmur] tryChatGPTReady: page load timed out')
        return false
      }
      // Give DOM a moment to render after load
      await new Promise((r) => setTimeout(r, 1000))
      return this.checkSession()
    }

    const url = wc.getURL()

    // Check if URL is still ChatGPT
    if (!url.includes('chatgpt.com') && !url.includes('chat.openai.com')) {
      console.log('[Murmur] tryChatGPTReady: URL navigated away, reloading...')
      wc.loadURL(CHATGPT_URL)
      const loaded = await this.windowManager.waitForChatGPTLoad(15000)
      if (!loaded) return false
      await new Promise((r) => setTimeout(r, 1000))
      return this.checkSession()
    }

    // If page is still loading, wait for it
    if (wc.isLoading()) {
      console.log('[Murmur] tryChatGPTReady: page still loading, waiting...')
      const loaded = await this.windowManager.waitForChatGPTLoad(15000)
      if (!loaded) return false
      await new Promise((r) => setTimeout(r, 1000))
      return this.checkSession()
    }

    // Check for Cloudflare challenge
    try {
      const isBlocked = await wc.executeJavaScript(`
        (function() {
          var title = document.title || '';
          return title.includes('Just a moment') || title.includes('Attention Required');
        })()
      `)
      if (isBlocked) {
        console.log('[Murmur] tryChatGPTReady: Cloudflare challenge detected, waiting...')
        await new Promise((r) => setTimeout(r, 5000))
        return this.checkSession()
      }
    } catch {
      return false
    }

    return this.checkSession()
  }

  /** Periodically check ChatGPT session and preemptively reload if lost */
  startSessionMonitoring(): void {
    if (this.storage.getConfig().transcriptionProvider !== 'chatgpt' || this.sessionMonitorInterval) return
    this.sessionMonitorAborted = false

    this.sessionMonitorInterval = setInterval(async () => {
      if (this.sessionMonitorAborted || this.storage.getConfig().transcriptionProvider !== 'chatgpt') return
      if (this.state !== 'idle') return // Don't interfere with active dictation

      const connected = await this.checkSession()
      if (this.sessionMonitorAborted || this.storage.getConfig().transcriptionProvider !== 'chatgpt') return // Re-check after async gap
      if (this.state !== 'idle') return // Re-check: state may have changed during async checkSession

      if (!connected) {
        console.log('[Murmur] Session monitor: session lost, preemptively reloading ChatGPT...')
        const wc = this.getChatGPTWebContents()
        if (wc) {
          wc.loadURL(CHATGPT_URL)
        } else {
          this.windowManager.createHiddenChatGPT()
          this.setupWindowHealthMonitoring()
        }
      }
    }, 60_000) // Check every 60 seconds
  }

  stopSessionMonitoring(): void {
    this.sessionMonitorAborted = true
    if (this.sessionMonitorInterval) {
      clearInterval(this.sessionMonitorInterval)
      this.sessionMonitorInterval = null
    }
  }

  /** Set up event listeners on the ChatGPT window for crash/close detection */
  setupWindowHealthMonitoring(): void {
    const win = this.windowManager.getChatGPTWindow()
    if (!win || win.isDestroyed()) return

    win.webContents.on('render-process-gone', (_event, details) => {
      console.error(`[Murmur] ChatGPT renderer crashed: ${details.reason}`)
      if (this.state !== 'idle') {
        this.resetToIdle()
        this.notifications.showError(new SessionExpiredError('ChatGPT a plante. Redemarrage automatique.'))
      }
      // Recreate the window
      setTimeout(() => {
        if (this.storage.getConfig().transcriptionProvider !== 'chatgpt') return
        console.log('[Murmur] Auto-recreating ChatGPT window after crash...')
        this.windowManager.createHiddenChatGPT()
        this.setupWindowHealthMonitoring()
      }, 2000)
    })

    win.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
      console.error(`[Murmur] ChatGPT failed to load: ${errorCode} ${errorDescription}`)
      if (this.state !== 'idle') {
        this.resetToIdle()
        this.notifications.showError(new SessionExpiredError('Connexion a ChatGPT perdue.'))
      }
    })

    win.on('closed', () => {
      console.log('[Murmur] ChatGPT window closed unexpectedly')
      if (this.state !== 'idle') {
        this.resetToIdle()
      }
    })

    console.log('[Murmur] ChatGPT window health monitoring set up')
  }

  async startDictation(): Promise<void> {
    const generation = this.cancellationGeneration
    const config = this.storage.getConfig()
    if (config.transcriptionProvider === 'local' && !this.isLocalMode()) {
      throw new Error('Install and select a local model before dictating.')
    }
    if (config.transcriptionProvider !== 'chatgpt' && config.transcriptionProvider !== 'local' && !this.apiKeys.hasApiKey(config.transcriptionProvider)) {
      throw new Error('Configure an API key for the selected transcription provider.')
    }
    if (this.isLocalMode()) {
      this.activeMode = 'local'
      console.log('[Murmur] startDictation: Local mode — starting audio recording (WAV)...')
      this.windowManager.sendToOverlay('recording:start', { format: 'wav' })
      this.setState('listening')
      this.windowManager.showOverlay('listening')
    } else if (this.isDeepgramMode()) {
      this.activeMode = 'deepgram'
      console.log('[Murmur] startDictation: Deepgram mode — starting audio recording...')
      this.windowManager.sendToOverlay('recording:start')
      this.setState('listening')
      this.windowManager.showOverlay('listening')
    } else if (this.isAssemblyAIMode()) {
      this.activeMode = 'assemblyai'
      console.log('[Murmur] startDictation: AssemblyAI mode — starting audio recording...')
      this.windowManager.sendToOverlay('recording:start')
      this.setState('listening')
      this.windowManager.showOverlay('listening')
    } else if (this.isElevenLabsMode()) {
      this.activeMode = 'elevenlabs'
      console.log('[Murmur] startDictation: ElevenLabs mode — starting audio recording...')
      this.windowManager.sendToOverlay('recording:start')
      this.setState('listening')
      this.windowManager.showOverlay('listening')
    } else if (this.isGroqMode()) {
      this.activeMode = 'groq'
      console.log('[Murmur] startDictation: Groq BYOK mode — starting audio recording...')
      this.windowManager.sendToOverlay('recording:start')
      this.setState('listening')
      this.windowManager.showOverlay('listening')
    } else {
      this.activeMode = 'chatgpt'
      console.log('[Murmur] startDictation: checking ChatGPT readiness...')

      const ready = await this.ensureChatGPTReady()
      if (generation !== this.cancellationGeneration) return
      if (!ready) {
        console.log('[Murmur] startDictation: ChatGPT not ready after checks')
        throw new SessionExpiredError()
      }

      const wc = this.getChatGPTWebContents()
      if (!wc) {
        throw new SessionExpiredError()
      }

      const started = await wc.executeJavaScript(VOICE_START_SCRIPT)
      if (generation !== this.cancellationGeneration) {
        this.cancelChatGPTRecording(wc)
        return
      }
      if (!started) {
        throw new SessionExpiredError()
      }

      // On macOS, triggering getUserMedia in a hidden window may surface it — force hide
      if (process.platform === 'darwin') {
        this.windowManager.hideChatGPT()
      }

      this.setState('listening')
      this.windowManager.showOverlay('listening')
    }

    this.listeningStartedAt = Date.now()

    this.clearListeningTimer()
    // Only ChatGPT needs a listening timeout (DOM-controlled, we can't know when it stops)
    // For all other providers, the user stops manually — no timeout needed
    if (this.activeMode === 'chatgpt') {
      this.listeningTimer = setTimeout(async () => {
        if (this.state === 'listening') {
          // Transcribe what was recorded instead of throwing it away
          try {
            await this.stopDictation()
          } catch {
            this.resetToIdle()
          }
        }
      }, CHATGPT_LISTENING_TIMEOUT_MS)
    }
  }

  private waitForAudioData(): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingAudioResolve = null
        reject(new TimeoutError('Audio recording timeout'))
      }, 60_000)

      this.pendingAudioResolve = (buffer: Buffer) => {
        clearTimeout(timeout)
        resolve(buffer)
      }
    })
  }

  async stopDictation(): Promise<string | null> {
    this.clearListeningTimer()

    this.setState('processing')
    // Orange spinning wave during STT transcription
    this.windowManager.setOverlayState('transcribing')

    try {
      let text: string | null = null

      if (this.activeMode === 'local') {
        console.log('[Murmur] stopDictation: Local mode — stopping recording...')
        this.windowManager.sendToOverlay('recording:stop')
        const audioBuffer = await this.waitForAudioData()
        console.log(`[Murmur] stopDictation: got WAV buffer (${audioBuffer.length} bytes)`)

        const config = this.storage.getConfig()
        const entry = MODEL_CATALOG.find((m) => m.id === config.localModel)
        if (!entry) throw new Error(`Model not found: ${config.localModel}`)

        const localSTT = new LocalSTTService(this.modelManager.getRuntimePath())
        text = await localSTT.transcribe(
          audioBuffer,
          this.modelManager.getModelPath(entry.id),
          entry.type,
          entry.cliArgs
        )
        console.log(`[Murmur] stopDictation: Local transcription (${text?.length || 0} chars)`)
      } else if (this.activeMode === 'groq') {
        console.log('[Murmur] stopDictation: Groq mode — stopping recording...')
        this.windowManager.sendToOverlay('recording:stop')
        const audioBuffer = await this.waitForAudioData()
        console.log(`[Murmur] stopDictation: got audio buffer (${audioBuffer.length} bytes)`)

        const groqKey = this.apiKeys.getApiKey('groq')
        if (!groqKey) {
          throw new Error('Groq API key not found or failed to decrypt')
        }
        const groqSTT = new GroqSTTService(groqKey)
        text = await groqSTT.transcribe(audioBuffer)
        console.log(`[Murmur] stopDictation: Groq transcription (${text?.length || 0} chars)`)
      } else if (this.activeMode === 'deepgram') {
        console.log('[Murmur] stopDictation: Deepgram mode — stopping recording...')
        this.windowManager.sendToOverlay('recording:stop')
        const audioBuffer = await this.waitForAudioData()
        console.log(`[Murmur] stopDictation: got audio buffer (${audioBuffer.length} bytes)`)

        const deepgramKey = this.apiKeys.getApiKey('deepgram')
        if (!deepgramKey) throw new Error('Deepgram API key not found')
        const stt = new DeepgramSTTService(deepgramKey)
        text = await stt.transcribe(audioBuffer)
        console.log(`[Murmur] stopDictation: Deepgram transcription (${text?.length || 0} chars)`)
      } else if (this.activeMode === 'assemblyai') {
        console.log('[Murmur] stopDictation: AssemblyAI mode — stopping recording...')
        this.windowManager.sendToOverlay('recording:stop')
        const audioBuffer = await this.waitForAudioData()
        console.log(`[Murmur] stopDictation: got audio buffer (${audioBuffer.length} bytes)`)

        const assemblyKey = this.apiKeys.getApiKey('assemblyai')
        if (!assemblyKey) throw new Error('AssemblyAI API key not found')
        const stt = new AssemblyAISTTService(assemblyKey)
        text = await stt.transcribe(audioBuffer)
        console.log(`[Murmur] stopDictation: AssemblyAI transcription (${text?.length || 0} chars)`)
      } else if (this.activeMode === 'elevenlabs') {
        console.log('[Murmur] stopDictation: ElevenLabs mode — stopping recording...')
        this.windowManager.sendToOverlay('recording:stop')
        const audioBuffer = await this.waitForAudioData()
        console.log(`[Murmur] stopDictation: got audio buffer (${audioBuffer.length} bytes)`)

        const elevenKey = this.apiKeys.getApiKey('elevenlabs')
        if (!elevenKey) throw new Error('ElevenLabs API key not found')
        const stt = new ElevenLabsSTTService(elevenKey)
        text = await stt.transcribe(audioBuffer)
        console.log(`[Murmur] stopDictation: ElevenLabs transcription (${text?.length || 0} chars)`)
      } else {
        const wc = this.getChatGPTWebContents()
        if (!wc) {
          this.resetToIdle()
          throw new SessionExpiredError()
        }

        console.log('[Murmur] stopDictation: submitting dictation + polling for text...')
        text = await wc.executeJavaScript(VOICE_STOP_SCRIPT)
        console.log(`[Murmur] stopDictation: got text (${text?.length || 0} chars)`)
      }

      if (!text) {
        this.windowManager.hideOverlay()
        this.setState('idle')
        throw new EmptyTranscriptionError()
      }

      // Don't set 'done' here — let _toggle() do it after post-processing + paste
      this.setState('idle')
      return text
    } catch (err) {
      this.windowManager.hideOverlay()
      this.setState('idle')
      console.error('[Murmur] stopDictation error:')
      throw err
    }
  }

  private async postProcess(text: string, forceAi = false): Promise<string> {
    const config = this.storage.getConfig()
    if (!forceAi && (!config.postProcessingEnabled || config.defaultAiMode === 'raw')) {
      return text
    }

    const modeId = forceAi && config.defaultAiMode === 'raw' ? 'grammar' : config.defaultAiMode
    const mode = getMode(modeId, config.customAiModes)
    if (!mode || !mode.systemPrompt) {
      return text
    }

    const apiKey = this.apiKeys.getApiKey(config.postProcessingProvider)
    if (!apiKey) {
      console.log('[Murmur] postProcess: no API key for provider, skipping')
      return text
    }

    try {
      let systemPrompt = mode.systemPrompt
      // Inject custom dictionary terms (sanitized: max 50 words, 100 chars each, alphanumeric+basic punct only)
      const dict = (config.customDictionary || [])
        .slice(0, 50)
        .map(w => w.trim().slice(0, 100))
        .filter(w => w.length > 0)
      if (dict.length > 0) {
        systemPrompt = `Important: These custom terms/names must be preserved exactly as written (do not correct their spelling): ${dict.join(', ')}.\n\n${systemPrompt}`
      }

      // Always preserve the input language
      systemPrompt = `IMPORTANT: Always respond in the same language as the user's input. If the input is in French, respond in French. If in English, respond in English. Etc.\n\n${systemPrompt}`

      console.log(`[Murmur] postProcess: applying mode "${mode.id}" via ${config.postProcessingProvider}`)
      const llm = new LLMService(config.postProcessingProvider, apiKey)
      const processed = await llm.processText(text, systemPrompt)
      console.log(`[Murmur] postProcess: done (${processed.length} chars)`)
      return processed
    } catch (err) {
      console.error('[Murmur] postProcess: failed, using raw text')
      return text
    }
  }

  async toggle(options?: { forceAi?: boolean }): Promise<void> {
    if (this.isToggling) return
    this.isToggling = true
    try {
      await this._toggle(options)
    } finally {
      this.isToggling = false
    }
  }

  private async _toggle(options?: { forceAi?: boolean }): Promise<void> {
    console.log(`[Murmur] toggle: current state = ${this.state}`)
    if (this.state === 'idle') {
      try {
        await this.startDictation()
      } catch (err) {
        this.resetToIdle()
        if (err instanceof SessionExpiredError) {
          this.notifications.showError(err)
          this.windowManager.showChatGPTForLogin()
        } else if (err instanceof Error) {
          this.notifications.showError(err as any)
        }
      }
    } else if (this.state === 'listening') {
      try {
        const rawText = await this.stopDictation()
        if (rawText) {
          // Check for snippet trigger match
          const config = this.storage.getConfig()
          const snippets = config.snippets || []
          const trimmedRaw = rawText.trim()
          const matchedSnippet = trimmedRaw.length > 0 ? snippets.find(
            s => s.trigger.trim().length > 0 && s.trigger.toLowerCase() === trimmedRaw.toLowerCase()
          ) : undefined
          let finalText: string
          if (matchedSnippet) {
            finalText = matchedSnippet.text
          } else {
            // Switch overlay to blue wave only if AI post-processing will actually run
            const willPostProcess = options?.forceAi ||
              (config.postProcessingEnabled && config.defaultAiMode !== 'raw')
            if (willPostProcess) {
              this.windowManager.setOverlayState('processing')
            }
            finalText = await this.postProcess(rawText, options?.forceAi)
          }

          try {
            await this.clipboardService.writeAndPaste(finalText)
          } catch (pasteErr) {
            throw pasteErr
          }

          const durationMs = Date.now() - this.listeningStartedAt
          const wordCount = finalText.trim().split(/\s+/).filter(Boolean).length

          // Fade out the overlay (same animation as Escape cancel)
          this.windowManager.hideOverlay()

          this.storage.addToHistory({
            id: Date.now().toString(),
            text: finalText,
            timestamp: Date.now(),
            duration: durationMs,
            wordCount
          })
          this.storage.incrementUsage()

          // Continuous mode: auto-restart dictation after successful transcription
          if (this.continuousMode) {
            console.log('[Murmur] Continuous mode: auto-restarting dictation...')
            setTimeout(() => {
              this.startDictation().catch(() => {
                console.error('[Murmur] Continuous mode restart failed:')
                this.continuousMode = false
                this.resetToIdle()
              })
            }, 500)
          }
        }
      } catch (err) {
        this.continuousMode = false
        this.resetToIdle()
        if (err instanceof Error) {
          this.notifications.showError(err as any)
        }
      }
    }
  }

  async toggleContinuous(): Promise<void> {
    if (this.isToggling) return
    this.isToggling = true
    try {
      if (this.state === 'idle') {
        this.continuousMode = true
        console.log('[Murmur] Entering continuous (hands-free) mode')
        await this._toggle()
      } else {
        this.continuousMode = false
        console.log('[Murmur] Exiting continuous mode')
        await this._toggle()
      }
    } finally {
      this.isToggling = false
    }
  }

  stopContinuous(): void {
    this.continuousMode = false
  }
}
