import { afterEach, expect, it, vi } from 'vitest'
vi.mock('electron', () => ({ ipcMain: { on: vi.fn() } }))
import { TranscriptionService } from '../transcription'
import { VOICE_START_SCRIPT } from '../../chatgpt/voice-start'
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import vm from 'node:vm'
import ts from 'typescript'

// Execute the real entrypoint handlers with OS/service boundaries replaced; no Electron launch.
function controls(service?: TranscriptionService) {
 const handlers: Record<string, Function> = {}
 const app = { isPackaged: true, setPath() {}, getPath: () => '/tmp', whenReady: () => ({ then() {} }), on() {} }
 const win = { close: vi.fn() }
 const electron = { app, ipcMain: { handle: (name: string, fn: Function) => { handlers[name] = fn } }, BrowserWindow: { getFocusedWindow: () => win } }
 const context: any = { exports: {}, require: (id: string) => id === 'electron' ? electron : id === 'node:path' ? { join: (...a: string[]) => a.join('/'), isAbsolute: () => true } : id === './settings-policy' ? { validateSettings: (x: unknown) => x } : {}, process: { platform: 'darwin', env: {}, on() {} }, console, Date, setTimeout, clearTimeout }
 vm.createContext(context)
 const source = readFileSync(resolve('src/main/index.ts'), 'utf8') + '\nexports.harness = (s, t, w, h) => { storage=s; transcription=t; windowManager=w; hotkey=h; setupIPC(); return { handleHotkeyPress, handleDemoToggle }; };'
 vm.runInContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, context)
 const storage = { getConfig: () => ({ transcriptionProvider: 'chatgpt', hotkeyAiProcess: '', hotkey: 'ctrl+space' }), setConfig: vi.fn(), addToHistory: vi.fn(), incrementUsage: vi.fn() }
 let state = 'idle'
 const transcription = { getState: () => state, toggle: vi.fn(async () => { state = 'listening' }), stopContinuous: vi.fn(), resetToIdle: vi.fn(() => { state = 'idle' }), cancelDictation: vi.fn(() => { state = 'idle' }), startDictation: vi.fn(async () => { state = 'listening' }), stopDictation: vi.fn(async () => 'demo text') }
 const windows = { isTrustedSender: () => true, showChatGPT: vi.fn(), hideChatGPT: vi.fn(), showOverlay: vi.fn(), hideOverlay: vi.fn(), getLocalWindows: () => [] }
 const hotkeys = { updateShortcut: vi.fn(() => false) }
 const actions = context.exports.harness(storage, service ?? transcription, windows, hotkeys)
 const call = (name: string, ...args: unknown[]) => handlers[name]({}, ...args)
 return { call, actions, transcription, storage, windows, win }
}
it('double tap dispatches provider cancellation rather than a cosmetic reset', async () => {
 const h = controls()
 await h.actions.handleHotkeyPress(); await h.actions.handleHotkeyPress()
 expect(h.transcription.cancelDictation).toHaveBeenCalledOnce()
})
it.each(['readiness', 'remote start'])('double tap cancels pending %s through the real entrypoint and service', async phase => {
 vi.useFakeTimers()
 vi.setSystemTime(10_000)
 let finish!: (value: boolean) => void
 const deferred = new Promise<boolean>(resolve => { finish = resolve })
 let remoteRecording = false
 const executeJavaScript = vi.fn(async (script: string) => {
   if (script === VOICE_START_SCRIPT) {
     const started = phase === 'remote start' ? await deferred : true
     remoteRecording = started
     return started
   }
   if (script.includes('cancelBtn')) remoteRecording = false
   return true
 })
 const windows = { getChatGPTWindow: () => ({ isDestroyed: () => false, webContents: { executeJavaScript } }), hideOverlay: vi.fn(), hideChatGPT: vi.fn(), showOverlay: vi.fn(), sendToOverlay: vi.fn() }
 const service = new TranscriptionService(windows as any, {} as any, { getConfig: () => ({ transcriptionProvider: 'chatgpt' }) } as any, {} as any, {} as any, {} as any)
 vi.spyOn(service as any, 'ensureChatGPTReady').mockImplementation(() => phase === 'readiness' ? deferred : Promise.resolve(true))
 const stateChanges = vi.spyOn(service as any, 'setState')
 const cancel = vi.spyOn(service, 'cancelDictation')
 const toggle = vi.spyOn(service, 'toggle')
 const h = controls(service)
 const first = h.actions.handleHotkeyPress()
 await Promise.resolve() // Reach remote start when applicable, without settling the first toggle.
 expect(service.getState()).toBe('idle')
 vi.setSystemTime(10_100)
 await h.actions.handleHotkeyPress()
 expect(cancel).toHaveBeenCalledOnce()
 // Cancellation must not release the first handler's concurrency lock.
 vi.setSystemTime(10_600)
 await h.actions.handleHotkeyPress()
 expect(toggle).toHaveBeenCalledOnce()
 finish(true)
 await first
 expect(service.getState()).toBe('idle')
 expect(windows.showOverlay).not.toHaveBeenCalled()
 expect(stateChanges).not.toHaveBeenCalledWith('listening')
 expect(remoteRecording).toBe(false)
 if (phase === 'readiness') expect(executeJavaScript).not.toHaveBeenCalledWith(VOICE_START_SCRIPT)
 else expect(executeJavaScript.mock.calls.filter(([script]) => script.includes('cancelBtn'))).toHaveLength(2)
 // The original handler releases the lock once its cancelled start settles.
 vi.setSystemTime(11_200)
 await h.actions.handleHotkeyPress()
 expect(toggle).toHaveBeenCalledTimes(2)
 expect(service.getState()).toBe('listening')
 service.cancelDictation()
})
it.each(['demo:exit', 'window:close'])('%s cancels a demo immediately, including while start is pending', async channel => {
 const h = controls()
 let finish!: () => void
 h.transcription.startDictation.mockImplementation(() => new Promise<void>(r => { finish = r }))
 h.call('demo:enter')
 const pending = h.actions.handleDemoToggle()
 h.call(channel)
 expect(h.transcription.cancelDictation).toHaveBeenCalled()
 finish(); await pending
 expect(h.windows.hideChatGPT).toHaveBeenCalled()
})
it.each(['shortcut test', 'demo'])('%s retains priority over normal pending-start cancellation', async mode => {
 vi.useFakeTimers()
 vi.setSystemTime(10_000)
 const h = controls()
 let finish!: () => void
 h.transcription.toggle.mockImplementation(() => new Promise<void>(resolve => { finish = resolve }))
 const first = h.actions.handleHotkeyPress()
 vi.setSystemTime(10_100)
 const test = mode === 'shortcut test' ? h.call('shortcut:test') : undefined
 if (mode === 'demo') h.call('demo:enter')
 await h.actions.handleHotkeyPress()
 if (test) {
   expect(await test).toBe(true)
   expect(h.windows.showOverlay).toHaveBeenCalledOnce()
 }
 expect(h.transcription.cancelDictation).not.toHaveBeenCalled()
 expect(h.transcription.toggle).toHaveBeenCalledOnce()
 expect(h.transcription.startDictation).not.toHaveBeenCalled()
 finish(); await first
 if (mode === 'demo') {
   await h.actions.handleHotkeyPress()
   expect(h.transcription.startDictation).toHaveBeenCalledOnce()
 }
})
it('rejects a failed shortcut registration without persisting settings', () => {
 const h = controls()
 expect(() => h.call('settings:set', { hotkeyAiProcess: 'ctrl+j' })).toThrow(/shortcut|register/i)
 expect(h.storage.setConfig).not.toHaveBeenCalled()
})
