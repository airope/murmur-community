import Groq, { toFile } from 'groq-sdk'
import { GROQ_STT_MODEL, GROQ_STT_TIMEOUT_MS } from '../shared/constants'

export default class GroqSTTService {
  private client: Groq

  constructor(apiKey: string) {
    this.client = new Groq({ apiKey })
  }

  async transcribe(audioBuffer: Buffer, language?: string): Promise<string> {
    if (!audioBuffer || audioBuffer.length === 0) {
      throw new Error('Empty audio buffer — nothing was recorded')
    }

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), GROQ_STT_TIMEOUT_MS)

      try {
        const result = await this.client.audio.transcriptions.create({
          model: GROQ_STT_MODEL,
          file: await toFile(audioBuffer, 'recording.webm', { type: 'audio/webm' }),
          language,
          response_format: 'json',
        })

        clearTimeout(timeoutId)
        return result.text
      } catch (error) {
        clearTimeout(timeoutId)
        throw error
      }
    } catch (error: unknown) {
      const status = (error as any)?.status ?? (error as any)?.statusCode
      if (status === 429) {
        throw new Error('Groq API rate limit exceeded — try again in a few seconds')
      }
      if (status === 413) {
        throw new Error('Audio file too large for Groq API (max 25MB)')
      }
      if (error instanceof Error) {
        if (error.name === 'AbortError' || error.message.includes('aborted')) {
          throw new Error(`Groq transcription timeout after ${GROQ_STT_TIMEOUT_MS}ms`)
        }
        throw new Error(`Groq transcription failed: ${error.message}`)
      }
      throw new Error('Groq transcription failed with unknown error')
    }
  }
}
