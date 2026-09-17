import { execFile } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import path from 'path'
import os from 'os'
import type { ModelType } from '../shared/types'

const execFileAsync = promisify(execFile)

export default class LocalSTTService {
  private runtimePath: string

  constructor(runtimePath: string) {
    this.runtimePath = runtimePath
  }

  async transcribe(
    wavBuffer: Buffer,
    modelPath: string,
    modelType: ModelType,
    cliArgs: Record<string, string>
  ): Promise<string> {
    const tmpFile = path.join(os.tmpdir(), `murmur-audio-${Date.now()}-${Math.random().toString(36).slice(2)}.wav`)

    try {
      fs.writeFileSync(tmpFile, wavBuffer)

      const args = this.buildArgs(modelPath, modelType, cliArgs, tmpFile)
      console.log(`[Murmur] LocalSTT: spawning ${path.basename(this.runtimePath)} with ${args.length} args (60s timeout)`)

      const { stdout, stderr } = await execFileAsync(this.runtimePath, args, {
        timeout: 60_000,
        maxBuffer: 10 * 1024 * 1024,
        windowsHide: process.platform === 'win32',
        cwd: modelPath // ONNX models may reference external files (e.g. encoder.weights) by relative path
      })


      // sherpa-onnx may output the transcription to stdout or stderr depending on version
      let text = this.parseOutput(stdout)
      if (!text) {
        text = this.parseOutput(stderr)
      }
      if (!text) {
        throw new Error('Local transcription returned empty result')
      }

      return text
    } catch (err: unknown) {
      // execFile errors include stdout/stderr as properties

      if (err instanceof Error) {
        throw new Error(`Local transcription failed: ${err.message}`)
      }
      throw new Error('Local transcription failed with unknown error')
    } finally {
      try { fs.unlinkSync(tmpFile) } catch { /* ignore */ }
    }
  }

  private buildArgs(
    modelPath: string,
    _modelType: ModelType,
    cliArgs: Record<string, string>,
    audioFile: string
  ): string[] {
    const args: string[] = []

    for (const [flag, fileName] of Object.entries(cliArgs)) {
      args.push(`${flag}=${path.join(modelPath, fileName)}`)
    }

    args.push('--num-threads=2')
    args.push(audioFile)

    return args
  }

  private parseOutput(output: string): string {
    // sherpa-onnx outputs a JSON object with the transcription in the "text" field
    // e.g. {"lang": "", "text": " Hello world", "tokens": [...], ...}
    const jsonMatch = output.match(/\{[^{}]*"text"\s*:\s*"[^"]*"[^{}]*\}/)
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0])
        if (typeof parsed.text === 'string') {
          return parsed.text.trim()
        }
      } catch { /* fall through to line-based parsing */ }
    }

    // Fallback: filter out known info lines and return the rest
    const lines = output.split('\n').map((l) => l.trim()).filter(Boolean)
    const textLines = lines.filter((line) => {
      if (/^[A-Z]:\\/.test(line)) return false
      if (line.startsWith('/')) return false
      if (line.startsWith('--')) return false
      if (line.includes('Config(')) return false
      if (/^(num_threads|decoding_method|Elapsed|Duration|Real time factor|Wave duration|Loading model|Creating recognizer|recognizer created|Started|Done!)/.test(line)) return false
      return true
    })
    return textLines.join(' ').trim()
  }
}
