import { beforeEach, expect, it, vi } from 'vitest'

const harness = vi.hoisted(() => ({ sessions: new Map<string, any>() }))
vi.mock('electron', async () => {
  const { EventEmitter } = await import('node:events')
  class Window extends EventEmitter {
    webContents: any
    constructor(public options: any) {
      super()
      const partition = options.webPreferences.partition || 'default'
      if (!harness.sessions.has(partition)) harness.sessions.set(partition, {
        setPermissionRequestHandler(handler: any) { this.request = handler },
        setPermissionCheckHandler(handler: any) { this.check = handler },
        webRequest: { onHeadersReceived: vi.fn() }
      })
      this.webContents = Object.assign(new EventEmitter(), {
        session: harness.sessions.get(partition),
        mainFrame: { url: 'https://chatgpt.com/', processId: 1, routingId: 1 },
        getURL() { return this.mainFrame.url },
        isDestroyed: () => false,
        setWindowOpenHandler(this: any, handler: any) { this.open = handler }
      })
    }
    isDestroyed() { return false }
    loadURL = vi.fn()
    loadFile = vi.fn()
  }
  return { BrowserWindow: Window, session: { fromPartition: (p: string) => {
    if (!harness.sessions.has(p)) harness.sessions.set(p, {
      setPermissionRequestHandler(handler: any) { this.request = handler },
      setPermissionCheckHandler(handler: any) { this.check = handler }
    })
    return harness.sessions.get(p)
  } }, app: { isPackaged: true }, ipcMain: { on: vi.fn() } }
})
vi.mock('@electron-toolkit/utils', () => ({ is: { dev: false } }))
import { WindowManager } from '../window'

beforeEach(() => harness.sessions.clear())
function fixture() {
  const manager = new WindowManager()
  const win = manager.createHiddenChatGPT()
  const wc = win.webContents as any
  const ses = wc.session
  const details = { isMainFrame: true, requestingUrl: 'https://chatgpt.com/', securityOrigin: 'https://chatgpt.com', mediaTypes: ['audio'], mediaType: 'audio' }
  const request = (overrides = {}, sender = wc, permission = 'media') => {
    const callback = vi.fn()
    ses.request(sender, permission, callback, { ...details, ...overrides })
    return callback.mock.calls[0][0]
  }
  return { manager, wc, ses, details, request }
}

it('actual remote permission handlers only grant owned main-frame ChatGPT audio', () => {
  const h = fixture()
  expect(h.request({ requestingUrl: 'https://evil.test/', securityOrigin: 'https://evil.test' })).toBe(false)
  expect(h.request()).toBe(true)
  for (const url of ['https://chatgpt.com.evil.test/', 'https://evil.test/?chatgpt.com', 'http://chatgpt.com/', 'https://chatgpt.com:444/', 'https://***@evil.test/', 'about:blank', '', 'null', 'https://auth.openai.com/']) {
    expect(h.request({ requestingUrl: url, securityOrigin: url }), url).toBe(false)
  }
  expect(h.request({ isMainFrame: false })).toBe(false)
  expect(h.request({ mediaTypes: ['video'] })).toBe(false)
  expect(h.request({ mediaTypes: ['audio', 'video'] })).toBe(false)
  expect(h.request({ mediaTypes: [] })).toBe(false)
  expect(h.request({ mediaTypes: undefined })).toBe(false)
  expect(h.request({ securityOrigin: undefined })).toBe(false)
  expect(h.request({}, { ...h.wc })).toBe(false)
  expect(h.request({}, null)).toBe(false)
  expect(h.request({}, h.wc, 'notifications')).toBe(false)
  expect(h.ses.check(h.wc, 'media', 'https://chatgpt.com', h.details)).toBe(true)
  for (const change of [{ isMainFrame: false }, { mediaType: 'video' }, { mediaType: 'unknown' }, { mediaType: undefined }, { requestingUrl: undefined }, { securityOrigin: 'https://evil.test' }]) {
    expect(h.ses.check(h.wc, 'media', 'https://chatgpt.com', { ...h.details, ...change })).toBe(false)
  }
  expect(h.ses.check(h.wc, 'media', 'https://evil.test', h.details)).toBe(false)
  expect(h.ses.check(null, 'media', 'https://chatgpt.com', h.details)).toBe(false)
  h.wc.mainFrame.url = 'https://auth.openai.com/'
  expect(h.request()).toBe(false)
})


it('blocks unapproved top-level navigation, redirects and all popups; permits explicit login origins', () => {
  const { wc, request } = fixture()
  for (const eventName of ['will-navigate', 'will-redirect']) {
    for (const url of ['https://evil.test/', 'https://chatgpt.com.evil.test/', 'http://chatgpt.com/', 'javascript:alert(1)', 'file:///tmp/x', 'https://auth.openai.com.evil.test/']) {
      const event = { preventDefault: vi.fn() }
      wc.emit(eventName, event, url, false, true)
      expect(event.preventDefault, `${eventName}: ${url}`).toHaveBeenCalled()
    }
    for (const url of ['https://chatgpt.com/', 'https://chat.openai.com/', 'https://auth.openai.com/', 'https://auth0.openai.com/', 'https://accounts.google.com/', 'https://login.microsoftonline.com/', 'https://appleid.apple.com/']) {
      const event = { preventDefault: vi.fn() }
      wc.emit(eventName, event, url, false, true)
      expect(event.preventDefault).not.toHaveBeenCalled()
      if (!url.includes('chatgpt.com') && !url.includes('chat.openai.com')) {
        wc.mainFrame.url = url
        expect(request({ requestingUrl: url, securityOrigin: url })).toBe(false)
      }
    }
  }
  expect(wc.open({ url: 'https://chatgpt.com/' })).toEqual({ action: 'deny' })
  expect(wc.open({ url: 'https://evil.test/' })).toEqual({ action: 'deny' })
})

it('does not create remote content eagerly or replace local session permission handlers', () => {
  const manager = new WindowManager()
  expect(harness.sessions.size).toBe(0)
  const local = manager.createMainWindow().webContents.session as any
  const request = vi.fn(); const check = vi.fn()
  local.setPermissionRequestHandler(request); local.setPermissionCheckHandler(check)
  manager.createHiddenChatGPT()
  expect(local.request).toBe(request)
  expect(local.check).toBe(check)
})


import { TranscriptionService } from '../transcription'
it.each(['https://chatgpt.com.evil.test/', 'https://evil.test/?chat.openai.com', 'http://chatgpt.com/', 'https://auth.openai.com/'])('readiness never probes DOM on untrusted URL %s', async (url) => {
  const executeJavaScript = vi.fn(async () => false)
  const wc = { getURL: () => url, isLoading: () => false, loadURL: vi.fn(), executeJavaScript }
  const manager = { getChatGPTWindow: () => ({ isDestroyed: () => false, webContents: wc }), waitForChatGPTLoad: async () => false }
  const service = new TranscriptionService(manager as any, {} as any, {} as any, {} as any, {} as any, {} as any)
  expect(await (service as any).tryChatGPTReady()).toBe(false)
  expect(executeJavaScript).not.toHaveBeenCalled()
  expect(await service.checkSession()).toBe(false)
  expect(executeJavaScript).not.toHaveBeenCalled()
})


it.each(['https://chatgpt.com/', 'https://chat.openai.com/'])('allows audio and session checking at exact trusted origin %s', async (url) => {
  const h = fixture()
  h.wc.mainFrame.url = url
  const details = { ...h.details, requestingUrl: url, securityOrigin: new URL(url).origin }
  expect(h.request(details)).toBe(true)
  expect(h.ses.check(h.wc, 'media', new URL(url).origin, details)).toBe(true)
  expect(h.ses.check({ ...h.wc }, 'media', new URL(url).origin, details)).toBe(false)
  expect(h.ses.check(h.wc, 'notifications', new URL(url).origin, details)).toBe(false)
  h.wc.executeJavaScript = vi.fn(async () => true)
  const service = new TranscriptionService(h.manager, {} as any, {} as any, {} as any, {} as any, {} as any)
  expect(await service.checkSession()).toBe(true)
})
