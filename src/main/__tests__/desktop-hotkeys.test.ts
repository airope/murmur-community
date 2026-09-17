import { beforeEach, expect, it, vi } from 'vitest'
const os = vi.hoisted(() => ({ register: vi.fn(), unregister: vi.fn(), unregisterAll: vi.fn() }))
vi.mock('electron', () => ({ globalShortcut: os }))
import { HotkeyManager } from '../hotkey'
beforeEach(() => { vi.resetAllMocks(); os.register.mockReturnValue(true) })
it('remembers disabled actions for first registration and re-enabling', () => {
 const keys = new HotkeyManager(), callback = vi.fn()
 keys.register('aiProcess', '', callback)
 expect(keys.updateShortcut('aiProcess', 'ctrl+j')).toBe(true)
 expect(os.register).toHaveBeenLastCalledWith('ctrl+j', callback)
 expect(keys.updateShortcut('aiProcess', '')).toBe(true)
 expect(keys.updateShortcut('aiProcess', 'ctrl+k')).toBe(true)
 expect(os.register).toHaveBeenLastCalledWith('ctrl+k', callback)
})
it('failed replacement preserves the old working registration', () => {
 const keys = new HotkeyManager(), callback = vi.fn()
 keys.register('transcribe', 'ctrl+space', callback)
 os.register.mockReturnValue(false)
 expect(keys.updateShortcut('transcribe', 'ctrl+j')).toBe(false)
 expect(os.unregister).not.toHaveBeenCalled()
})
