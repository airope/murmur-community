import { DEEPGRAM_STT_TIMEOUT_MS } from '../shared/constants'

export default class DeepgramSTTService {
  private apiKey: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async transcribe(audioBuffer: Buffer, language?: string): Promise<string> {
    if (!audioBuffer || audioBuffer.length === 0) {
      throw new Error('Empty audio buffer — nothing was recorded')
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), DEEPGRAM_STT_TIMEOUT_MS)

    try {
      const params = new URLSearchParams({
        model: 'nova-3',
        smart_format: 'true'
      })
      if (language) params.set('language', language)

      const response = await fetch(
        `https://api.deepgram.com/v1/listen?${params}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Token ${this.apiKey}`,
            'Content-Type': 'audio/webm'
          },
          body: new Uint8Array(audioBuffer),
          signal: controller.signal
        }
      )

      clearTimeout(timeoutId)

      if (!response.ok) {
        if (response.status === 429) throw new Error('Deepgram API rate limit exceeded')
        if (response.status === 413) throw new Error('Audio file too large for Deepgram API')
        throw new Error(`Deepgram API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      const text = data?.results?.channels?.[0]?.alternatives?.[0]?.transcript
      if (!text) throw new Error('No transcription in Deepgram response')
      return text
    } catch (error: unknown) {
      clearTimeout(timeoutId)
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error(`Deepgram transcription timeout after ${DEEPGRAM_STT_TIMEOUT_MS}ms`)
        }
        throw error
      }
      throw new Error('Deepgram transcription failed with unknown error')
    }
  }
}
