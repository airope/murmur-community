import { Tray, Menu, app, nativeImage } from 'electron'
import { join } from 'path'
import { AppState } from '../shared/types'
import { mt } from './i18n'

interface TrayCallbacks {
  onDictate: () => void
  onShowApp: (route?: string) => void
}

function getTrayIconPath(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'tray-icon.png')
  }
  return join(app.getAppPath(), 'build', 'tray-icon.png')
}

function loadTrayIcon(): Electron.NativeImage {
  try {
    const icon = nativeImage.createFromPath(getTrayIconPath())
    const size = process.platform === 'darwin' ? 16 : 32
    const resized = icon.resize({ width: size, height: size })
    if (process.platform === 'darwin') {
      resized.setTemplateImage(true)
    }
    return resized
  } catch {
    // Fallback: orange square
    const size = 16
    const buffer = Buffer.alloc(size * size * 4)
    for (let i = 0; i < size * size; i++) {
      buffer[i * 4] = 190
      buffer[i * 4 + 1] = 85
      buffer[i * 4 + 2] = 20
      buffer[i * 4 + 3] = 255
    }
    return nativeImage.createFromBuffer(buffer, { width: size, height: size })
  }
}

export class TrayManager {
  private tray: Tray | null = null
  private callbacks: TrayCallbacks

  constructor(callbacks: TrayCallbacks) {
    this.callbacks = callbacks
  }

  create(): void {
    const icon = loadTrayIcon()
    this.tray = new Tray(icon)
    this.tray.setToolTip('Murmur Community')
    this.tray.on('double-click', () => this.callbacks.onShowApp())
    this.buildMenu()
  }

  buildMenu(): void {
    if (!this.tray) return
    const menu = Menu.buildFromTemplate([
      { label: mt('tray.open'), click: () => this.callbacks.onShowApp() },
      { type: 'separator' },
      { label: mt('tray.startDictation'), click: () => this.callbacks.onDictate() },
      { type: 'separator' },
      { label: mt('tray.history'), click: () => this.callbacks.onShowApp('/history') },
      { label: mt('tray.settings'), click: () => this.callbacks.onShowApp('/settings') },
      { type: 'separator' },
      { type: 'separator' },
      { label: mt('tray.quit'), click: () => app.quit() }
    ])
    this.tray.setContextMenu(menu)
  }

  setState(_state: AppState): void {
    // Logo stays the same — overlay handles state feedback
  }

  destroy(): void {
    this.tray?.destroy()
    this.tray = null
  }
}
