import { it, expect, vi } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { createHash } from 'crypto'

// Only Electron's path API is mocked. Downloads, hashes, extraction, model loading,
// process execution and recognition are real. Opt in on Windows/macOS with ample disk.
const state = vi.hoisted(() => ({ userData: '' }))
vi.mock('electron', () => ({ app: { getPath: () => state.userData } }))
import { ModelManager } from '../model-manager'
import LocalSTTService from '../local-stt'

it.skipIf(process.env.MURMUR_RUN_MODEL_INTEGRATION !== '1')(
  'recognizes the pinned public JFK fixture using real local Whisper Tiny',
  async () => {
    expect(['darwin', 'win32']).toContain(process.platform)
    state.userData = fs.mkdtempSync(path.join(os.tmpdir(), 'murmur-recognition-'))
    try {
      const manager = new ModelManager()
      await manager.installModel('whisper-tiny-en')
      expect(manager.isRuntimeInstalled()).toBe(true)
      expect(manager.isModelInstalled('whisper-tiny-en')).toBe(true)
      const url = 'https://raw.githubusercontent.com/ggerganov/whisper.cpp/b0a11594aec50892a02cd8d129eee2dfe93a8bb8/samples/jfk.wav'
      const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(30_000) })
      expect(response.ok).toBe(true)
      const wav = Buffer.from(await response.arrayBuffer())
      expect(wav.length).toBe(352078)
      expect(createHash('sha256').update(wav).digest('hex')).toBe('59dfb9a4acb36fe2a2affc14bacbee2920ff435cb13cc314a08c13f66ba7860e')
      const entry = manager.getCatalogEntry('whisper-tiny-en')!
      const text = await new LocalSTTService(manager.getRuntimePath()).transcribe(
        wav, manager.getModelPath(entry.id), entry.type, entry.cliArgs
      )
      const normalized = text.toLowerCase().replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ')
      expect(normalized).toContain('ask not what your country can do for you')
      expect(normalized).toContain('what you can do for your country')
    } finally {
      fs.rmSync(state.userData, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
    }
  },
  20 * 60_000
)
