import { ASSEMBLYAI_STT_TIMEOUT_MS } from '../shared/constants'

export default class AssemblyAISTTService {
  private apiKey: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async transcribe(audioBuffer: Buffer, language?: string): Promise<string> {
    if (!audioBuffer || audioBuffer.length === 0) {
      throw new Error('Empty audio buffer — nothing was recorded')
    }

    try {
      // Step 1: Upload audio
      const uploadRes = await fetch('https://api.assemblyai.com/v2/upload', {
        method: 'POST',
        headers: { 'authorization': this.apiKey },
        body: new Uint8Array(audioBuffer)
      })
      if (!uploadRes.ok) throw new Error(`AssemblyAI upload failed: ${uploadRes.status}`)
      const { upload_url } = await uploadRes.json()

      // Step 2: Create transcription
      const createRes = await fetch('https://api.assemblyai.com/v2/transcript', {
        method: 'POST',
        headers: {
          'authorization': this.apiKey,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          audio_url: upload_url,
          ...(language ? { language_code: language } : {})
        })
      })
      if (!createRes.ok) throw new Error(`AssemblyAI create failed: ${createRes.status}`)
      const { id } = await createRes.json()

      // Step 3: Poll until complete (max 120 attempts as safety bound)
      const startTime = Date.now()
      let attempts = 0
      while (Date.now() - startTime < ASSEMBLYAI_STT_TIMEOUT_MS && attempts++ < 120) {
        await new Promise(r => setTimeout(r, 1000))

        const pollRes = await fetch(`https://api.assemblyai.com/v2/transcript/${id}`, {
          headers: { 'authorization': this.apiKey }
        })
        const result = await pollRes.json()

        if (result.status === 'completed') {
          if (!result.text) throw new Error('AssemblyAI returned empty transcription')
          return result.text
        }
        if (result.status === 'error') {
          throw new Error(`AssemblyAI transcription error: ${result.error}`)
        }
      }

      throw new Error(`AssemblyAI transcription timeout after ${ASSEMBLYAI_STT_TIMEOUT_MS}ms`)
    } catch (error: unknown) {
      if (error instanceof Error) throw error
      throw new Error('AssemblyAI transcription failed with unknown error')
    }
  }
}
