import { safeStorage } from 'electron'
import { MurmurConfig } from '../shared/types'

export class ApiKeysService {
  private getConfig: () => MurmurConfig
  private setConfig: (partial: Partial<MurmurConfig>) => void
  private encryptionAvailable(): boolean {
    return safeStorage.isEncryptionAvailable() && safeStorage.getSelectedStorageBackend?.() !== 'basic_text'
  }

  constructor(
    getConfig: () => MurmurConfig,
    setConfig: (partial: Partial<MurmurConfig>) => void
  ) {
    this.getConfig = getConfig
    this.setConfig = setConfig

  }

  saveApiKey(provider: string, key: string): void {
    const config = this.getConfig()
    const apiKeys = { ...config.apiKeys }

    if (!this.encryptionAvailable()) {
      throw new Error('OS-backed encryption is unavailable. Unlock or configure your system keychain/keyring, then try again. No API key was saved.')
    }
    const encrypted = safeStorage.encryptString(key)
    apiKeys[provider] = encrypted.toString('base64')

    this.setConfig({ apiKeys })
  }

  getApiKey(provider: string): string | null {
    const config = this.getConfig()
    const stored = config.apiKeys[provider]

    if (!stored) return null

    if (this.encryptionAvailable()) {
      try {
        const decrypted = safeStorage.decryptString(Buffer.from(stored, 'base64'))
        return decrypted
      } catch (err) {
        console.error(`[Murmur] Failed to decrypt API key for ${provider}:`, err)
        return null
      }
    } else {
      return null
    }
  }

  hasApiKey(provider: string): boolean {
    return this.getApiKey(provider) !== null
  }

  deleteApiKey(provider: string): void {
    const config = this.getConfig()
    const apiKeys = { ...config.apiKeys }
    delete apiKeys[provider]
    this.setConfig({ apiKeys })
  }

  getMaskedKey(provider: string): string | null {
    const key = this.getApiKey(provider)
    if (!key) return null

    if (key.length <= 8) {
      return 'sk-' + 'X'.repeat(key.length - 3)
    }

    return 'sk-' + key.substring(key.length - 4).padStart(key.length - 3, 'X')
  }

  async testApiKey(provider: string, key: string): Promise<boolean> {
    try {
      if (provider === 'groq') {
        const Groq = (await import('groq-sdk')).default
        const groq = new Groq({ apiKey: key })
        await groq.models.list()
        return true
      } else if (provider === 'openai') {
        const OpenAI = (await import('openai')).default
        const openai = new OpenAI({ apiKey: key })
        await openai.models.list()
        return true
      } else if (provider === 'anthropic') {
        const Anthropic = (await import('@anthropic-ai/sdk')).default
        const client = new Anthropic({ apiKey: key })
        await client.messages.create({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'test' }],
        })
        return true
      } else if (provider === 'gemini') {
        const { GoogleGenerativeAI } = await import('@google/generative-ai')
        const genAI = new GoogleGenerativeAI(key)
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
        await model.generateContent('test')
        return true
      } else if (provider === 'mistral') {
        const OpenAI = (await import('openai')).default
        const mistral = new OpenAI({ apiKey: key, baseURL: 'https://api.mistral.ai/v1' })
        await mistral.models.list()
        return true
      } else if (provider === 'deepseek') {
        const OpenAI = (await import('openai')).default
        const deepseek = new OpenAI({ apiKey: key, baseURL: 'https://api.deepseek.com' })
        await deepseek.models.list()
        return true
      } else if (provider === 'openrouter') {
        const OpenAI = (await import('openai')).default
        const openrouter = new OpenAI({ apiKey: key, baseURL: 'https://openrouter.ai/api/v1' })
        await openrouter.models.list()
        return true
      } else if (provider === 'deepgram') {
        const response = await fetch('https://api.deepgram.com/v1/projects', {
          headers: { Authorization: `Token ${key}` },
        })
        return response.ok
      } else if (provider === 'assemblyai') {
        const response = await fetch('https://api.assemblyai.com/v2/transcript?limit=1', {
          headers: { authorization: key },
        })
        return response.ok
      } else if (provider === 'elevenlabs') {
        const response = await fetch('https://api.elevenlabs.io/v1/user', {
          headers: { 'xi-api-key': key },
        })
        return response.ok
      }
      return false
    } catch {
      return false
    }
  }
}

export default ApiKeysService
