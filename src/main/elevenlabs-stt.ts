import { ELEVENLABS_STT_TIMEOUT_MS } from '../shared/constants'

export default class ElevenLabsSTTService {
  private apiKey: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async transcribe(audioBuffer: Buffer, language?: string): Promise<string> {
    if (!audioBuffer || audioBuffer.length === 0) {
      throw new Error('Empty audio buffer — nothing was recorded')
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), ELEVENLABS_STT_TIMEOUT_MS)

    try {
      const formData = new FormData()
      formData.append('file', new Blob([new Uint8Array(audioBuffer)], { type: 'audio/webm' }), 'recording.webm')
      formData.append('model_id', 'scribe_v1')
      if (language) formData.append('language_code', language)

      const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
        method: 'POST',
        headers: { 'xi-api-key': this.apiKey },
        body: formData,
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        if (response.status === 429) throw new Error('ElevenLabs API rate limit exceeded')
        throw new Error(`ElevenLabs API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      const text = data?.text
      if (!text) throw new Error('No transcription in ElevenLabs response')
      return text
    } catch (error: unknown) {
      clearTimeout(timeoutId)
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error(`ElevenLabs transcription timeout after ${ELEVENLABS_STT_TIMEOUT_MS}ms`)
        }
        throw error
      }
      throw new Error('ElevenLabs transcription failed with unknown error')
    }
  }
}
