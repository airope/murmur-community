import { describe, it, expect, vi, beforeEach } from 'vitest'
import path from 'path'
import os from 'os'

// local-stt uses `const execFileAsync = promisify(execFile)` at module level.
// Node's execFile has [util.promisify.custom] symbol, so we must set that on the mock
// for promisify to return our async mock rather than wrapping a callback.
const mockExecFileAsync = vi.fn<(_bin: string, args: string[]) => Promise<{ stdout: string; stderr: string }>>()
const mockExecFile = vi.fn()
Object.defineProperty(mockExecFile, Symbol.for('nodejs.util.promisify.custom'), { value: mockExecFileAsync })

vi.mock('child_process', () => ({
  execFile: mockExecFile,
}))

const { default: LocalSTTService } = await import('../local-stt')
import fs from 'fs'

const RUNTIME_PATH = '/fake/runtime/sherpa-onnx-offline'
const MODEL_PATH = '/fake/models/whisper-tiny-en'

function setExecResult(stdout: string, stderr = ''): void {
  mockExecFileAsync.mockResolvedValue({ stdout, stderr })
}

function setExecError(message: string): void {
  mockExecFileAsync.mockRejectedValue(new Error(message))
}

describe('LocalSTTService', () => {
  let service: InstanceType<typeof LocalSTTService>
  let unlinkSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    service = new LocalSTTService(RUNTIME_PATH)
    vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {})
    unlinkSpy = vi.spyOn(fs, 'unlinkSync').mockImplementation(() => {})
    vi.clearAllMocks()
    // Re-apply after clearAllMocks since spies track calls
    vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {})
    unlinkSpy = vi.spyOn(fs, 'unlinkSync').mockImplementation(() => {})
  })

  it('never logs transcription or subprocess output', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    setExecResult('{"text":"PRIVATE_TRANSCRIPT"}', 'PRIVATE_STDERR')
    await service.transcribe(Buffer.from('fake-wav'), MODEL_PATH, 'whisper', {})
    const output = JSON.stringify([...log.mock.calls, ...error.mock.calls])
    log.mockRestore(); error.mockRestore()
    expect(output).not.toContain('PRIVATE_TRANSCRIPT')
    expect(output).not.toContain('PRIVATE_STDERR')
  })

  // ---- parseOutput (via transcribe) ----

  describe('parseOutput via transcribe', () => {
    it('parses JSON output from stdout', async () => {
      setExecResult('{"text": " Hello world", "lang": "en"}')
      const result = await service.transcribe(
        Buffer.from('fake-wav'),
        MODEL_PATH,
        'whisper',
        { '--whisper-encoder': 'encoder.onnx', '--whisper-decoder': 'decoder.onnx', '--tokens': 'tokens.txt' }
      )
      expect(result).toBe('Hello world')
    })

    it('falls back to stderr when stdout is empty', async () => {
      setExecResult('', '{"text": " Fallback text"}')
      const result = await service.transcribe(
        Buffer.from('fake-wav'),
        MODEL_PATH,
        'whisper',
        { '--whisper-encoder': 'encoder.onnx', '--whisper-decoder': 'decoder.onnx', '--tokens': 'tokens.txt' }
      )
      expect(result).toBe('Fallback text')
    })

    it('throws when output is empty', async () => {
      setExecResult('', '')
      await expect(
        service.transcribe(
          Buffer.from('fake-wav'),
          MODEL_PATH,
          'whisper',
          { '--whisper-encoder': 'encoder.onnx', '--whisper-decoder': 'decoder.onnx', '--tokens': 'tokens.txt' }
        )
      ).rejects.toThrow('empty result')
    })

    it('filters debug lines and returns plain text', async () => {
      const debugOutput = [
        'Loading model...',
        'num_threads=2',
        'Done!',
        'This is the transcription'
      ].join('\n')
      setExecResult(debugOutput)
      const result = await service.transcribe(
        Buffer.from('fake-wav'),
        MODEL_PATH,
        'whisper',
        { '--whisper-encoder': 'encoder.onnx', '--whisper-decoder': 'decoder.onnx', '--tokens': 'tokens.txt' }
      )
      expect(result).toBe('This is the transcription')
    })

    it('throws when binary execution fails', async () => {
      setExecError('spawn ENOENT')
      await expect(
        service.transcribe(
          Buffer.from('fake-wav'),
          MODEL_PATH,
          'whisper',
          { '--whisper-encoder': 'encoder.onnx', '--whisper-decoder': 'decoder.onnx', '--tokens': 'tokens.txt' }
        )
      ).rejects.toThrow('Local transcription failed')
    })
  })

  // ---- buildArgs (via transcribe) ----

  describe('buildArgs via transcribe', () => {
    it('passes model file paths as absolute paths from modelPath', async () => {
      let capturedArgs: string[] = []
      mockExecFileAsync.mockImplementation(async (_bin: string, args: string[]) => {
        capturedArgs = args
        return { stdout: '{"text": "test"}', stderr: '' }
      })

      await service.transcribe(Buffer.from('fake-wav'), MODEL_PATH, 'whisper', {
        '--whisper-encoder': 'encoder.onnx',
        '--whisper-decoder': 'decoder.onnx',
        '--tokens': 'tokens.txt'
      })

      expect(capturedArgs).toContain(`--whisper-encoder=${path.join(MODEL_PATH, 'encoder.onnx')}`)
      expect(capturedArgs).toContain(`--whisper-decoder=${path.join(MODEL_PATH, 'decoder.onnx')}`)
      expect(capturedArgs).toContain(`--tokens=${path.join(MODEL_PATH, 'tokens.txt')}`)
      expect(capturedArgs).toContain('--num-threads=2')
    })

    it('includes audio file as last argument', async () => {
      let capturedArgs: string[] = []
      mockExecFileAsync.mockImplementation(async (_bin: string, args: string[]) => {
        capturedArgs = args
        return { stdout: '{"text": "test"}', stderr: '' }
      })

      await service.transcribe(Buffer.from('fake-wav'), MODEL_PATH, 'whisper', {
        '--whisper-encoder': 'encoder.onnx',
        '--tokens': 'tokens.txt'
      })

      const lastArg = capturedArgs[capturedArgs.length - 1]
      expect(lastArg).toMatch(/murmur-audio-.*\.wav$/)
      expect(lastArg).toContain(os.tmpdir())
    })
  })

  // ---- temp file cleanup ----

  describe('temp file cleanup', () => {
    it('removes temp WAV file on success', async () => {
      setExecResult('{"text": "test"}')
      await service.transcribe(Buffer.from('fake-wav'), MODEL_PATH, 'whisper', { '--tokens': 'tokens.txt' })
      expect(unlinkSpy).toHaveBeenCalledOnce()
      const call = unlinkSpy.mock.calls[0][0] as string
      expect(call).toMatch(/murmur-audio-.*\.wav$/)
    })

    it('removes temp WAV file on failure', async () => {
      setExecError('binary failed')
      await expect(
        service.transcribe(Buffer.from('fake-wav'), MODEL_PATH, 'whisper', { '--tokens': 'tokens.txt' })
      ).rejects.toThrow()
      expect(unlinkSpy).toHaveBeenCalledOnce()
    })
  })
})
