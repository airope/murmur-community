import OpenAI from 'openai'
import { LlmProvider } from '../shared/types'
import {
  LLM_PROCESSING_TIMEOUT_MS,
  OPENAI_COMPATIBLE_ENDPOINTS,
  LLM_MODEL_MAP,
  ANTHROPIC_LLM_MODEL,
  GEMINI_LLM_MODEL
} from '../shared/constants'

export default class LLMService {
  private provider: LlmProvider
  private apiKey: string

  constructor(provider: LlmProvider, apiKey: string) {
    this.provider = provider
    this.apiKey = apiKey
  }

  private static SUPPORTED: readonly string[] = ['openai', 'groq', 'anthropic', 'gemini', 'mistral', 'deepseek', 'openrouter']

  async processText(text: string, systemPrompt: string): Promise<string> {
    if (!LLMService.SUPPORTED.includes(this.provider)) {
      throw new Error(`Unsupported LLM provider: ${this.provider}`)
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), LLM_PROCESSING_TIMEOUT_MS)

    try {
      let content: string | null = null

      if (this.provider === 'anthropic') {
        content = await this.callAnthropic(systemPrompt, text, controller.signal)
      } else if (this.provider === 'gemini') {
        content = await this.callGemini(systemPrompt, text, controller.signal)
      } else {
        content = await this.callOpenAICompatible(systemPrompt, text, controller.signal)
      }

      if (!content) {
        throw new Error('No content in LLM response')
      }

      return content
    } finally {
      clearTimeout(timeout)
    }
  }

  private async callOpenAICompatible(
    systemPrompt: string,
    text: string,
    signal: AbortSignal
  ): Promise<string | null> {
    const baseURL = OPENAI_COMPATIBLE_ENDPOINTS[this.provider]
    const model = LLM_MODEL_MAP[this.provider]
    if (!baseURL || !model) throw new Error(`Unsupported OpenAI-compatible provider: ${this.provider}`)

    const client = new OpenAI({
      apiKey: this.apiKey,
      baseURL
    })
    const completion = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text }
      ]
    }, { signal })
    return completion.choices?.[0]?.message?.content ?? null
  }

  private async callAnthropic(
    systemPrompt: string,
    text: string,
    _signal: AbortSignal
  ): Promise<string | null> {
    const Anthropic = (await import('@anthropic-ai/sdk')).default
    const isOAuth = this.apiKey.startsWith('sk-ant-oat')

    const client = isOAuth
      ? new Anthropic({
          apiKey: 'oauth-token',
          defaultHeaders: {
            'anthropic-beta': 'oauth-2025-04-20'
          },
          fetch: (async (url: RequestInfo | URL, options?: RequestInit) => {
            const headers = new Headers(options?.headers)
            headers.delete('x-api-key')
            headers.set('Authorization', `Bearer ${this.apiKey}`)
            return fetch(url, { ...options, headers })
          }) as typeof fetch
        })
      : new Anthropic({ apiKey: this.apiKey })

    const message = await client.messages.create({
      model: ANTHROPIC_LLM_MODEL,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: text }]
    })
    const block = message.content[0]
    return block.type === 'text' ? block.text : null
  }

  private async callGemini(
    systemPrompt: string,
    text: string,
    _signal: AbortSignal
  ): Promise<string | null> {
    const { GoogleGenerativeAI } = await import('@google/generative-ai')
    const genAI = new GoogleGenerativeAI(this.apiKey)
    const model = genAI.getGenerativeModel({
      model: GEMINI_LLM_MODEL,
      systemInstruction: systemPrompt
    })
    const result = await model.generateContent(text)
    return result.response.text() || null
  }
}
