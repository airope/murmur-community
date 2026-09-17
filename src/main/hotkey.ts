import { globalShortcut } from 'electron'

interface HotkeyBinding {
  key: string
  callback: () => void
}

export class HotkeyManager {
  private bindings = new Map<string, HotkeyBinding>()

  register(name: string, key: string, callback: () => void): boolean {
    this.bindings.set(name, { key: '', callback })
    return this.updateShortcut(name, key)
  }

  updateShortcut(name: string, newKey: string): boolean {
    const existing = this.bindings.get(name)
    if (!existing) return false
    if (existing.key === newKey) return true
    // Acquire the replacement before releasing the working shortcut.
    if (newKey && !this.bindKey(name, newKey, existing.callback)) return false
    if (existing.key) globalShortcut.unregister(existing.key)
    existing.key = newKey
    return true
  }

  private bindKey(name: string, key: string, callback: () => void): boolean {
    try {
      const success = globalShortcut.register(key, callback)
      if (!success) {
        console.error(`[Murmur] HotkeyManager: Failed to register "${name}": ${key}`)
      } else {
        console.log(`[Murmur] HotkeyManager: bound "${name}" → "${key}"`)
      }
      return success
    } catch (err) {
      console.error(`[Murmur] HotkeyManager: Error registering "${name}" ${key}:`, err)
      return false
    }
  }

  destroy(): void {
    console.log('[Murmur] HotkeyManager: destroyed')
    globalShortcut.unregisterAll()
    this.bindings.clear()
  }
}
