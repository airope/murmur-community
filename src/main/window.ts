import { app, BrowserWindow, screen, session } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { CHATGPT_URL, CHATGPT_PARTITION } from '../shared/constants'
import { pathToFileURL } from 'node:url'
import { isTrustedLocalSender } from './ipc-policy'
import { mt } from './i18n'

export class WindowManager {
  private mainWindow: BrowserWindow | null = null
  private chatgptWindow: BrowserWindow | null = null
  private settingsWindow: BrowserWindow | null = null
  private historyWindow: BrowserWindow | null = null
  private onboardingWindow: BrowserWindow | null = null
  private overlayWindow: BrowserWindow | null = null
  private isCreatingChatGPT = false

  createMainWindow(): BrowserWindow {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.focus()
      return this.mainWindow
    }

    // Transparent window so CSS rounded corners don't show white artifacts at edges
    const platformStyle = { transparent: true, backgroundColor: '#00000000' as const }

    this.mainWindow = new BrowserWindow({
      width: 780,
      height: 650,
      minWidth: 600,
      minHeight: 500,
      title: 'Murmur Community',
      frame: false,
      ...platformStyle,
      webPreferences: {
        preload: join(__dirname, '../preload/preload.js'),
        contextIsolation: true,
        sandbox: true,
        devTools: !app.isPackaged
      }
    })

    // Content Security Policy (relaxed in dev for Vite HMR inline scripts)
    const csp = is.dev
      ? "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ws://localhost:* http://localhost:*; font-src 'self'"
      : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ; font-src 'self'"
    this.mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [csp]
        }
      })
    })

    this.loadRendererRoute(this.mainWindow, '/')

    this.mainWindow.on('close', (e) => {
      // Hide to tray instead of quitting
      e.preventDefault()
      this.mainWindow?.hide()
    })

    this.mainWindow.on('closed', () => {
      this.mainWindow = null
    })

    return this.mainWindow
  }

  getMainWindow(): BrowserWindow | null {
    return this.mainWindow && !this.mainWindow.isDestroyed() ? this.mainWindow : null
  }

  showMainWindow(route?: string): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      this.createMainWindow()
    }
    if (route && this.mainWindow) {
      this.mainWindow.webContents.send('window:navigate', route)
    }
    this.mainWindow?.show()
    this.mainWindow?.focus()
  }

  createHiddenChatGPT(): BrowserWindow {
    if (this.chatgptWindow && !this.chatgptWindow.isDestroyed()) {
      return this.chatgptWindow
    }
    if (this.isCreatingChatGPT) {
      return this.chatgptWindow!
    }
    this.isCreatingChatGPT = true

    // Set up permission handler for microphone access
    const ses = session.fromPartition(CHATGPT_PARTITION)
    ses.setPermissionRequestHandler((_webContents, permission, callback) => {
      if (permission === 'media') {
        callback(true)
        return
      }
      callback(false)
    })

    this.chatgptWindow = new BrowserWindow({
      width: 1280,
      height: 800,
      show: false,
      webPreferences: {
        partition: CHATGPT_PARTITION,
        sandbox: true
      }
    })

    this.chatgptWindow.loadURL(CHATGPT_URL)

    // Hide instead of destroy on close to preserve session cookies
    this.chatgptWindow.on('close', (e) => {
      if (this.chatgptWindow && !this.chatgptWindow.isDestroyed()) {
        e.preventDefault()
        this.chatgptWindow.hide()
      }
    })

    this.chatgptWindow.on('closed', () => {
      this.chatgptWindow = null
      this.isCreatingChatGPT = false
    })

    this.isCreatingChatGPT = false
    return this.chatgptWindow
  }

  /** Wait for ChatGPT page to finish loading, with timeout */
  waitForChatGPTLoad(timeoutMs = 15000): Promise<boolean> {
    return new Promise((resolve) => {
      const win = this.getChatGPTWindow()
      if (!win) {
        resolve(false)
        return
      }

      const wc = win.webContents

      // If page already loaded, resolve immediately
      if (!wc.isLoading()) {
        resolve(true)
        return
      }

      let settled = false

      const cleanup = (): void => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        wc.removeListener('did-finish-load', onLoad)
        wc.removeListener('did-fail-load', onFail)
      }

      const timer = setTimeout(() => {
        cleanup()
        resolve(false)
      }, timeoutMs)

      const onLoad = (): void => {
        cleanup()
        resolve(true)
      }

      const onFail = (): void => {
        cleanup()
        resolve(false)
      }

      wc.once('did-finish-load', onLoad)
      wc.once('did-fail-load', onFail)
    })
  }

  getChatGPTWindow(): BrowserWindow | null {
    return this.chatgptWindow && !this.chatgptWindow.isDestroyed() ? this.chatgptWindow : null
  }

  showChatGPTForLogin(): void {
    this.createHiddenChatGPT()
    if (this.chatgptWindow && !this.chatgptWindow.isDestroyed()) {
      this.chatgptWindow.show()
      this.chatgptWindow.focus()
    }
  }

  showChatGPT(): void {
    this.createHiddenChatGPT()
    if (this.chatgptWindow && !this.chatgptWindow.isDestroyed()) {
      this.chatgptWindow.show()
    }
  }

  hideChatGPT(): void {
    if (this.chatgptWindow && !this.chatgptWindow.isDestroyed()) {
      this.chatgptWindow.hide()
    }
  }

  createSettingsWindow(): BrowserWindow {
    if (this.settingsWindow && !this.settingsWindow.isDestroyed()) {
      this.settingsWindow.focus()
      return this.settingsWindow
    }

    this.settingsWindow = new BrowserWindow({
      width: 500,
      height: 600,
      resizable: false,
      title: mt('window.settings'),
      webPreferences: {
        preload: join(__dirname, '../preload/preload.js'),
        contextIsolation: true,
        sandbox: true,
        devTools: !app.isPackaged
      }
    })

    this.loadRendererRoute(this.settingsWindow, '/settings')

    this.settingsWindow.on('closed', () => {
      this.settingsWindow = null
    })

    return this.settingsWindow
  }

  createHistoryWindow(): BrowserWindow {
    if (this.historyWindow && !this.historyWindow.isDestroyed()) {
      this.historyWindow.focus()
      return this.historyWindow
    }

    this.historyWindow = new BrowserWindow({
      width: 600,
      height: 700,
      title: mt('window.history'),
      webPreferences: {
        preload: join(__dirname, '../preload/preload.js'),
        contextIsolation: true,
        sandbox: true,
        devTools: !app.isPackaged
      }
    })

    this.loadRendererRoute(this.historyWindow, '/history')

    this.historyWindow.on('closed', () => {
      this.historyWindow = null
    })

    return this.historyWindow
  }

  createOnboardingWindow(): BrowserWindow {
    if (this.onboardingWindow && !this.onboardingWindow.isDestroyed()) {
      this.onboardingWindow.focus()
      return this.onboardingWindow
    }

    // Transparent window so CSS rounded corners don't show white artifacts at edges
    const platformStyle = { transparent: true, backgroundColor: '#00000000' as const }

    this.onboardingWindow = new BrowserWindow({
      width: 700,
      height: 500,
      resizable: false,
      title: mt('window.welcome'),
      frame: false,
      ...platformStyle,
      webPreferences: {
        preload: join(__dirname, '../preload/preload.js'),
        contextIsolation: true,
        sandbox: true,
        devTools: !app.isPackaged
      }
    })

    this.loadRendererRoute(this.onboardingWindow, '/onboarding')

    this.onboardingWindow.on('closed', () => {
      this.onboardingWindow = null
    })

    return this.onboardingWindow
  }

  createOverlayWindow(): BrowserWindow {
    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
      return this.overlayWindow
    }

    const display = screen.getPrimaryDisplay()
    const { width, height } = display.workAreaSize
    const overlayWidth = 140
    const overlayHeight = 140

    this.overlayWindow = new BrowserWindow({
      width: overlayWidth,
      height: overlayHeight,
      x: Math.round((width - overlayWidth) / 2),
      y: height - overlayHeight - 40,
      frame: false,
      transparent: true,
      hasShadow: false,
      alwaysOnTop: true,
      focusable: false,
      skipTaskbar: true,
      resizable: false,
      show: false,
      paintWhenInitiallyHidden: false,
      ...(process.platform === 'darwin' ? { type: 'panel' as const } : {}),
      webPreferences: {
        preload: join(__dirname, '../preload/preload.js'),
        contextIsolation: true,
        sandbox: true,
        devTools: !app.isPackaged
      }
    })

    // On macOS: use floating level so the panel stays above all windows without stealing focus
    if (process.platform === 'darwin') {
      this.overlayWindow.setAlwaysOnTop(true, 'floating')
      this.overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
      this.overlayWindow.setOpacity(0.92)
    }

    // Grant microphone access for voice-reactive orb
    this.overlayWindow.webContents.session.setPermissionRequestHandler((_wc, permission, callback) => {
      callback(permission === 'media')
    })

    this.loadRendererRoute(this.overlayWindow, '/overlay')
    this.overlayWindow.setIgnoreMouseEvents(true)

    // Inject transparent background CSS before any rendering to prevent white flash
    this.overlayWindow.webContents.on('dom-ready', () => {
      this.overlayWindow?.webContents.insertCSS(
        'html, body, #root { background: transparent !important; background-color: transparent !important; overflow: hidden !important; }'
      )
    })

    // Auto-recreate if renderer crashes
    this.overlayWindow.webContents.on('render-process-gone', () => {
      console.log('[Murmur] Overlay renderer crashed, will recreate on next use')
      this.overlayWindow = null
    })

    this.overlayWindow.on('closed', () => {
      this.overlayWindow = null
    })

    return this.overlayWindow
  }

  showOverlay(state: 'listening' | 'transcribing' | 'processing' | 'done' = 'listening'): void {
    if (!this.overlayWindow || this.overlayWindow.isDestroyed()) {
      this.createOverlayWindow()
    }
    try {
      this.overlayWindow?.webContents.executeJavaScript(`window.setOverlayState?.('${state}')`)
      this.overlayWindow?.show()
    } catch {
      // Render frame may not be ready yet
    }
  }

  setOverlayState(state: 'listening' | 'transcribing' | 'processing' | 'done'): void {
    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
      try {
        this.overlayWindow.webContents.executeJavaScript(`window.setOverlayState?.('${state}')`)
      } catch {
        // Render frame may be disposed
      }
    }
  }

  sendToOverlay(channel: string, ...args: unknown[]): void {
    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
      try {
        this.overlayWindow.webContents.send(channel, ...args)
      } catch {
        // Render frame may be disposed
      }
    }
  }

  hideOverlay(): void {
    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
      this.overlayWindow.webContents.executeJavaScript('window.hideOverlay?.()').catch(() => {
        // Render frame may be disposed
      })
      setTimeout(() => {
        if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
          this.overlayWindow.hide()
        }
      }, 350)
    }
  }

  getLocalWindows(): BrowserWindow[] {
    return [this.mainWindow, this.onboardingWindow, this.overlayWindow].filter((win): win is BrowserWindow => !!win && !win.isDestroyed())
  }

  isTrustedSender(event: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent): boolean {
    const rendererURL = !app.isPackaged && process.env.ELECTRON_RENDERER_URL
      ? process.env.ELECTRON_RENDERER_URL
      : pathToFileURL(join(__dirname, '../renderer/index.html')).href
    return isTrustedLocalSender(event, [this.mainWindow, this.onboardingWindow, this.overlayWindow], rendererURL)
  }

  private loadRendererRoute(win: BrowserWindow, route: string): void {
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    win.webContents.on('will-navigate', (event) => event.preventDefault())
    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      win.loadURL(process.env['ELECTRON_RENDERER_URL'] + '#' + route)
    } else {
      win.loadFile(join(__dirname, '../renderer/index.html'), { hash: route })
    }
  }

  destroyAll(): void {
    // Allow windows to close for real during quit
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.removeAllListeners('close')
    }
    if (this.chatgptWindow && !this.chatgptWindow.isDestroyed()) {
      this.chatgptWindow.removeAllListeners('close')
    }
    const windows = [
      this.mainWindow,
      this.chatgptWindow,
      this.settingsWindow,
      this.historyWindow,
      this.onboardingWindow,
      this.overlayWindow
    ]
    for (const win of windows) {
      if (win && !win.isDestroyed()) {
        win.destroy()
      }
    }
  }
}
