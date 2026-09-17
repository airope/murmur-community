import { afterEach, expect, it, vi } from 'vitest'
vi.mock('electron', () => ({ ipcMain: { on: vi.fn() } }))
import { TranscriptionService } from '../transcription'
import { VOICE_START_SCRIPT } from '../../chatgpt/voice-start'
function fixture() {
 const executeJavaScript = vi.fn(async (_script: string) => true)
 const windows = { getChatGPTWindow: () => ({ isDestroyed: () => false, webContents: { executeJavaScript } }), hideOverlay: vi.fn(), hideChatGPT: vi.fn(), showOverlay: vi.fn(), sendToOverlay: vi.fn() }
 const service = new TranscriptionService(windows as any, {} as any, { getConfig: () => ({ transcriptionProvider: 'chatgpt' }) } as any, {} as any, {} as any, {} as any)
 const ready = vi.spyOn(service as any, 'ensureChatGPTReady').mockResolvedValue(true)
 return { service, ready, executeJavaScript, windows }
}
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })
it('ChatGPT cancellation executes remote stop and clears listening', async () => {
 vi.useFakeTimers()
 const h = fixture(); await h.service.startDictation()
 h.service.cancelDictation()
 expect(h.executeJavaScript.mock.calls.some(([script]) => script.includes('cancelBtn'))).toBe(true)
 expect(h.service.getState()).toBe('idle')
 expect(h.windows.hideOverlay).toHaveBeenCalled()
})
it('cancel never clicks the start button when ChatGPT has no active recording', async () => {
 vi.useFakeTimers()
 const h = fixture(); await h.service.startDictation()
 const voiceClick = vi.fn()
 h.executeJavaScript.mockImplementation(async script => {
   new Function('document', script)({ querySelector: (selector: string) => selector.includes('voice') ? { click: voiceClick } : null })
   return true
 })
 h.service.cancelDictation()
 expect(voiceClick).not.toHaveBeenCalled()
})
it('exit during readiness prevents remote voice start', async () => {
 const h = fixture(); let ready!: (value: boolean) => void
 h.ready.mockImplementation(() => new Promise(r => { ready = r }))
 const start = h.service.startDictation()
 h.service.cancelDictation(); ready(true); await start
 expect(h.executeJavaScript).not.toHaveBeenCalledWith(VOICE_START_SCRIPT)
 expect(h.service.getState()).toBe('idle')
})
it('exit during remote start cancels again after it completes and never shows listening', async () => {
 vi.useFakeTimers()
 const h = fixture(); let started!: (value: boolean) => void
 h.executeJavaScript.mockImplementation(script => script === VOICE_START_SCRIPT ? new Promise<boolean>(r => { started = r }) : Promise.resolve(true))
 const start = h.service.startDictation(); await Promise.resolve()
 h.service.cancelDictation(); started(true); await start
 expect(h.executeJavaScript.mock.calls.filter(([script]) => script.includes('cancelBtn')).length).toBeGreaterThanOrEqual(2)
 expect(h.service.getState()).toBe('idle')
 expect(h.windows.showOverlay).not.toHaveBeenCalled()
})
