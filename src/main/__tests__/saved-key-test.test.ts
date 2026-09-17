import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import vm from 'node:vm'
import ts from 'typescript'

const safe = vi.hoisted(() => ({
  isEncryptionAvailable: vi.fn(), getSelectedStorageBackend: vi.fn(),
  encryptString: vi.fn(), decryptString: vi.fn()
}))
vi.mock('electron', () => ({ safeStorage: safe }))
import { ApiKeysService } from '../api-keys'

const savedKey = 'synthetic-saved-key-only'
const replacementKey = 'synthetic-replacement-key-only'
const request = vi.fn()
beforeEach(() => {
  vi.resetAllMocks()
  safe.isEncryptionAvailable.mockReturnValue(true)
  safe.getSelectedStorageBackend.mockReturnValue('keychain')
  safe.encryptString.mockReturnValue(Buffer.from('synthetic-ciphertext'))
  safe.decryptString.mockImplementation((buffer: Buffer) => {
    if (buffer.toString() !== 'synthetic-ciphertext') throw new Error('Invalid ciphertext')
    return savedKey
  })
  request.mockResolvedValue({ ok: true })
  vi.stubGlobal('fetch', request)
})
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

// Execute the actual IPC registration and real ApiKeysService, without booting
// Electron, accessing a real keychain/config, or making network requests.
function ipc() {
  let config: any = { apiKeys: {} }
  const service = new ApiKeysService(() => config, partial => { config = { ...config, ...partial } })
  const handlers: Record<string, Function> = {}
  const app = { isPackaged: true, setPath() {}, getPath: () => '/tmp', whenReady: () => ({ then() {} }), on() {} }
  const electron = { app, ipcMain: { handle: (name: string, fn: Function) => { handlers[name] = fn } } }
  const context: any = {
    exports: {},
    require: (id: string) => id === 'electron' ? electron : id === 'node:path' ? { join: (...parts: string[]) => parts.join('/'), isAbsolute: () => true } : {},
    process: { platform: 'darwin', env: {}, on() {} }, console, setTimeout, clearTimeout
  }
  vm.createContext(context)
  const source = readFileSync(resolve('src/main/index.ts'), 'utf8') + '\nexports.bind = (keys, windows) => { apiKeys = keys; windowManager = windows; setupIPC(); };'
  vm.runInContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, context)
  const windows = { isTrustedSender: vi.fn(() => true) }
  context.exports.bind(service, windows)
  return {
    call: (channel: string, ...args: unknown[]) => handlers[channel]({}, ...args),
    config: () => config, windows
  }
}

it('honors an explicit replacement without decrypting or overwriting the saved key', async () => {
  const h = ipc()
  h.call('byok:save-api-key', 'elevenlabs', savedKey)
  const before = { ...h.config().apiKeys }
  expect(await h.call('byok:test-api-key', 'elevenlabs', replacementKey)).toBe(true)
  expect(request).toHaveBeenCalledExactlyOnceWith('https://api.elevenlabs.io/v1/user', {
    headers: { 'xi-api-key': replacementKey }
  })
  expect(safe.decryptString).not.toHaveBeenCalled()
  expect(h.config().apiKeys).toEqual(before)
})

it.each(['unsupported', '__proto__', 'constructor', '', null, {}])('rejects unsupported provider %s before key lookup or network access', async provider => {
  const h = ipc()
  expect(await h.call('byok:test-api-key', provider, '')).toBe(false)
  expect(await h.call('byok:test-api-key', provider, replacementKey)).toBe(false)
  expect(safe.decryptString).not.toHaveBeenCalled()
  expect(request).not.toHaveBeenCalled()
})

it.each(['unavailable', 'basic_text', 'decrypt failure'])('fails closed for saved-key tests when encryption is %s', async failure => {
  const h = ipc()
  h.call('byok:save-api-key', 'elevenlabs', savedKey)
  if (failure === 'unavailable') safe.isEncryptionAvailable.mockReturnValue(false)
  if (failure === 'basic_text') safe.getSelectedStorageBackend.mockReturnValue('basic_text')
  if (failure === 'decrypt failure') {
    safe.decryptString.mockImplementation(() => { throw new Error('Synthetic decryption failure') })
    vi.spyOn(console, 'error').mockImplementation(() => {})
  }
  expect(await h.call('byok:test-api-key', 'elevenlabs', '')).toBe(false)
  expect(request).not.toHaveBeenCalled()
  if (failure !== 'decrypt failure') {
    expect(safe.decryptString).not.toHaveBeenCalled()
    expect(() => h.call('byok:save-api-key', 'elevenlabs', replacementKey)).toThrow(/encryption/)
    expect(safe.encryptString).toHaveBeenCalledOnce()
  }
})

it('returns false rather than provider errors or key material on request failure', async () => {
  const h = ipc()
  h.call('byok:save-api-key', 'elevenlabs', savedKey)
  request.mockRejectedValue(new Error(savedKey))
  expect(await h.call('byok:test-api-key', 'elevenlabs', '')).toBe(false)
})

it('keeps the trusted-sender guard in front of saved-key access', () => {
  const h = ipc()
  h.windows.isTrustedSender.mockReturnValue(false)
  expect(() => h.call('byok:test-api-key', 'elevenlabs', '')).toThrow('Untrusted IPC sender')
  expect(safe.decryptString).not.toHaveBeenCalled()
  expect(request).not.toHaveBeenCalled()
})

it('returns false without contacting the provider when no key has been saved', async () => {
  const h = ipc()
  expect(await h.call('byok:test-api-key', 'elevenlabs', '')).toBe(false)
  expect(request).not.toHaveBeenCalled()
})

it('Save then Test with cleared input tests the saved encrypted key and returns only a boolean', async () => {
  const h = ipc()
  expect(h.call('byok:save-api-key', 'elevenlabs', savedKey)).toBeUndefined()
  expect(h.config().apiKeys.elevenlabs).not.toContain(savedKey)
  expect(await h.call('byok:test-api-key', 'elevenlabs', '')).toBe(true)
  expect(safe.decryptString).toHaveBeenCalledOnce()
  expect(request).toHaveBeenCalledExactlyOnceWith('https://api.elevenlabs.io/v1/user', {
    headers: { 'xi-api-key': savedKey }
  })
})
