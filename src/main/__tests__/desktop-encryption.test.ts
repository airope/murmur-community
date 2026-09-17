import { beforeEach, expect, it, vi } from 'vitest'
const safe = vi.hoisted(() => ({ isEncryptionAvailable: vi.fn(), getSelectedStorageBackend: vi.fn(), encryptString: vi.fn(), decryptString: vi.fn() }))
vi.mock('electron', () => ({ safeStorage: safe }))
import { ApiKeysService } from '../api-keys'
beforeEach(() => { vi.resetAllMocks(); safe.getSelectedStorageBackend.mockReturnValue('keychain') })
it.each([false, true])('refuses insecure storage (available=%s) without writing or reading plaintext', available => {
 safe.isEncryptionAvailable.mockReturnValue(available)
 if (available) safe.getSelectedStorageBackend.mockReturnValue('basic_text')
 const write = vi.fn()
 const service = new ApiKeysService(() => ({ apiKeys: { groq: 'synthetic-old-plaintext' } }) as any, write)
 expect(() => service.saveApiKey('groq', 'synthetic-new-secret')).toThrow(/encrypt|keychain|keyring/i)
 expect(write).not.toHaveBeenCalled()
 expect(service.getApiKey('groq')).toBeNull()
 expect(service.hasApiKey('groq')).toBe(false)
})
it('round trips encrypted keys and checks current backend at every use', () => {
 safe.isEncryptionAvailable.mockReturnValue(true)
 safe.encryptString.mockReturnValue(Buffer.from('ciphertext'))
 safe.decryptString.mockReturnValue('synthetic-secret')
 let config: any = { apiKeys: {} }
 const service = new ApiKeysService(() => config, partial => { config = { ...config, ...partial } })
 service.saveApiKey('groq', 'synthetic-secret')
 expect(config.apiKeys.groq).not.toContain('synthetic-secret')
 expect(service.getApiKey('groq')).toBe('synthetic-secret')
 safe.isEncryptionAvailable.mockReturnValue(false)
 expect(service.getApiKey('groq')).toBeNull()
 expect(() => service.saveApiKey('groq', 'synthetic-secret')).toThrow()
})
