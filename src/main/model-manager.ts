import { app } from 'electron'
import fs from 'fs'
import path from 'path'
import https from 'https'
import unbzip2Stream from 'unbzip2-stream'
import { createHash, randomUUID } from 'crypto'
import { Transform } from 'stream'
import { pipeline } from 'stream/promises'
import { MODEL_CATALOG, SHERPA_ONNX_RUNTIME_URL, SHERPA_ONNX_RUNTIME_BINARY, SHERPA_ONNX_RUNTIME_INTEGRITY } from '../shared/constants'
import type { InstalledModel, ModelCatalogEntry } from '../shared/types'

const MAX_REDIRECTS = 5
const ALLOWED_DOWNLOAD_HOSTS = ['github.com', 'objects.githubusercontent.com', 'release-assets.githubusercontent.com']
const ALLOWED_DOWNLOAD_SUFFIXES = ['.huggingface.co', '.hf.co']

export class ModelManager {
  private baseDir: string

  constructor() {
    this.baseDir = app.getPath('userData')
  }

  getRuntimeDir(): string {
    return path.join(this.baseDir, 'runtime')
  }

  getRuntimePath(): string {
    return path.join(this.getRuntimeDir(), SHERPA_ONNX_RUNTIME_BINARY)
  }

  getModelsDir(): string {
    return path.join(this.baseDir, 'models')
  }

  getModelPath(modelId: string): string {
    const resolved = path.resolve(this.getModelsDir(), modelId)
    if (!resolved.startsWith(this.getModelsDir() + path.sep) && resolved !== this.getModelsDir()) {
      throw new Error(`Invalid model ID: path traversal detected`)
    }
    return resolved
  }

  isRuntimeInstalled(): boolean {
    try {
      const receipt = JSON.parse(fs.readFileSync(path.join(this.getRuntimeDir(), 'verified.json'), 'utf8'))
      return receipt.archiveSha256 === SHERPA_ONNX_RUNTIME_INTEGRITY.sha256 &&
        this.verifyFile(this.getRuntimePath(), receipt)
    } catch { return false }
  }

  private hashFile(file: string): string {
    const fd = fs.openSync(file, 'r')
    try {
      const hash = createHash('sha256')
      const buffer = Buffer.allocUnsafe(1024 * 1024)
      let count: number
      while ((count = fs.readSync(fd, buffer, 0, buffer.length, null)) > 0) hash.update(buffer.subarray(0, count))
      return hash.digest('hex')
    } finally { fs.closeSync(fd) }
  }

  private verifyFile(file: string, expected: { size: number; sha256: string }): boolean {
    try {
      const stat = fs.lstatSync(file)
      return stat.isFile() && stat.size === expected.size && /^[a-f0-9]{64}$/.test(expected.sha256) &&
        this.hashFile(file) === expected.sha256
    } catch { return false }
  }

  isModelInstalled(modelId: string): boolean {
    const entry = MODEL_CATALOG.find((m) => m.id === modelId)
    if (!entry) return false
    const modelDir = this.getModelPath(modelId)
    if (!fs.existsSync(modelDir)) return false
    return entry.files.every((f) => this.verifyFile(path.join(modelDir, f.name), f))
  }

  getInstalledModels(): InstalledModel[] {
    const modelsDir = this.getModelsDir()
    if (!fs.existsSync(modelsDir)) return []

    const installed: InstalledModel[] = []
    for (const entry of MODEL_CATALOG) {
      if (this.isModelInstalled(entry.id)) {
        installed.push({
          id: entry.id,
          name: entry.name,
          type: entry.type,
          path: this.getModelPath(entry.id)
        })
      }
    }
    return installed
  }

  getCatalogEntry(modelId: string): ModelCatalogEntry | undefined {
    return MODEL_CATALOG.find((m) => m.id === modelId)
  }

  async installRuntime(onProgress?: (pct: number) => void): Promise<void> {
    if (this.isRuntimeInstalled()) return

    const runtimeDir = this.getRuntimeDir()
    fs.mkdirSync(runtimeDir, { recursive: true })

    const archivePath = path.join(runtimeDir, 'sherpa-onnx.tar.bz2')

    console.log('[Murmur] Downloading sherpa-onnx runtime...')
    await this.downloadFile(SHERPA_ONNX_RUNTIME_URL, archivePath, onProgress, 0, SHERPA_ONNX_RUNTIME_INTEGRITY)

    console.log('[Murmur] Extracting runtime binary...')
    // Signal extraction in progress so the UI doesn't appear frozen after download
    onProgress?.(-1)
    try {
      await this.extractRuntime(archivePath, runtimeDir)
    } finally {
      fs.rmSync(archivePath, { force: true })
    }

    if (!this.isRuntimeInstalled()) {
      throw new Error('Runtime extraction failed — binary not found after extraction')
    }
    console.log('[Murmur] Runtime installed successfully')
  }

  /** Read a verified tar.bz2 as a stream. Never give archive paths to the filesystem:
   * only the one regular-file binary is copied to an exclusively-created staging file.
   * Links, directories, PAX/GNU metadata and unrelated files are not materialized.
   */
  private async extractRuntime(
    archivePath: string,
    outputDir: string,
    integrity = SHERPA_ONNX_RUNTIME_INTEGRITY,
    binaryName = SHERPA_ONNX_RUNTIME_BINARY
  ): Promise<void> {
    if (!this.verifyFile(archivePath, integrity)) throw new Error('Runtime archive SHA-256 mismatch')
    const temp = path.join(outputDir, `${randomUUID()}.part`)
    const fd = fs.openSync(temp, 'wx', 0o600)
    let closed = false
    let pending = Buffer.alloc(0)
    let remaining = 0
    let padding = 0
    let selected = false
    let found = false
    let size = 0
    let ended = false
    const hash = createHash('sha256')
    const text = (b: Buffer): string => b.toString('utf8').split('\0')[0]
    const reader = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        try {
          pending = Buffer.concat([pending, chunk])
          while (pending.length) {
            if (remaining > 0) {
              const length = Math.min(remaining, pending.length)
              if (selected) {
                const bytes = pending.subarray(0, length)
                fs.writeSync(fd, bytes)
                hash.update(bytes)
              }
              remaining -= length
              pending = pending.subarray(length)
              continue
            }
            if (padding > 0) {
              const length = Math.min(padding, pending.length)
              padding -= length
              pending = pending.subarray(length)
              continue
            }
            if (pending.length < 512) break
            const header = pending.subarray(0, 512)
            pending = pending.subarray(512)
            if (header.every(b => b === 0)) { ended = true; continue }
            if (ended) throw new Error('Unexpected data after tar end')
            const checksum = parseInt(text(header.subarray(148, 156)).trim(), 8)
            const actual = header.reduce((sum, byte, i) => sum + (i >= 148 && i < 156 ? 32 : byte), 0)
            if (checksum !== actual) throw new Error('Invalid tar header checksum')
            const name = text(header.subarray(0, 100))
            // Only ustar uses this prefix field; GNU tar uses it for other metadata.
            const prefix = text(header.subarray(257, 263)) === 'ustar' ? text(header.subarray(345, 500)) : ''
            const fullName = prefix ? `${prefix}/${name}` : name
            if (fullName.startsWith('/') || fullName.includes('\\') || fullName.includes(':') || fullName.split('/').includes('..')) {
              throw new Error('Unsafe archive path')
            }
            const sizeText = text(header.subarray(124, 136)).trim()
            if (!/^[0-7]+$/.test(sizeText)) throw new Error('Unsupported tar entry size')
            remaining = parseInt(sizeText, 8)
            if (!Number.isSafeInteger(remaining)) throw new Error('Invalid tar entry size')
            padding = (512 - remaining % 512) % 512
            const type = header[156]
            selected = fullName.split('/').pop() === binaryName && (type === 0 || type === 48)
            if (selected) {
              if (found || remaining === 0 || remaining > 1024 * 1024 * 1024) throw new Error('Invalid runtime binary entry')
              found = true
              size = remaining
            }
          }
          callback()
        } catch (error) { callback(error as Error) }
      }
    })
    try {
      await pipeline(fs.createReadStream(archivePath), unbzip2Stream(), reader)
      if (!found || !ended || remaining || padding || pending.some(b => b !== 0)) throw new Error('Incomplete runtime archive')
      fs.closeSync(fd)
      closed = true
      if (process.platform !== 'win32') fs.chmodSync(temp, 0o755)
      fs.renameSync(temp, this.getRuntimePath())
      // This receipt ties the locally extracted binary to the pinned archive. It is
      // not a signature and does not defend against an attacker who can rewrite userData.
      fs.writeFileSync(path.join(outputDir, 'verified.json'), JSON.stringify({
        archiveSha256: integrity.sha256, size, sha256: hash.digest('hex')
      }), { mode: 0o600 })
    } finally {
      if (!closed) fs.closeSync(fd)
      fs.rmSync(temp, { force: true })
    }
  }

  async installModel(
    modelId: string,
    onProgress?: (data: { modelId: string; file: string; pct: number; overallPct: number }) => void
  ): Promise<void> {
    const entry = MODEL_CATALOG.find((m) => m.id === modelId)
    if (!entry) throw new Error(`Unknown model: ${modelId}`)

    // Install runtime first if needed
    if (!this.isRuntimeInstalled()) {
      console.log('[Murmur] Runtime not found — installing first...')
      await this.installRuntime((pct) => {
        onProgress?.({ modelId, file: 'runtime', pct, overallPct: pct * 0.1 })
      })
    }

    const modelDir = this.getModelPath(modelId)
    fs.mkdirSync(modelDir, { recursive: true })

    const totalSize = entry.files.reduce((sum, f) => sum + f.size, 0)
    let downloadedTotal = 0

    for (const file of entry.files) {
      const destPath = path.join(modelDir, file.name)
      if (this.verifyFile(destPath, file)) {
        downloadedTotal += file.size
        continue
      }

      console.log(`[Murmur] Downloading ${file.name}...`)
      await this.downloadFile(file.url, destPath, (pct) => {
        const fileDownloaded = pct * file.size
        const overall = (downloadedTotal + fileDownloaded) / totalSize
        onProgress?.({ modelId, file: file.name, pct, overallPct: 0.1 + overall * 0.9 })
      }, 0, file)
      downloadedTotal += file.size
    }

    console.log(`[Murmur] Model ${modelId} installed`)
  }

  deleteModel(modelId: string): void {
    if (!MODEL_CATALOG.find((m) => m.id === modelId)) {
      throw new Error(`Unknown model: ${modelId}`)
    }
    const modelDir = this.getModelPath(modelId)
    if (fs.existsSync(modelDir)) {
      fs.rmSync(modelDir, { recursive: true, force: true })
      console.log(`[Murmur] Model ${modelId} deleted`)
    }
  }

  private downloadFile(
    url: string,
    dest: string,
    onProgress?: (pct: number) => void,
    redirectCount = 0,
    expected?: { size: number; sha256: string }
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      // Only allow HTTPS downloads
      if (!url.startsWith('https://')) {
        reject(new Error('Only HTTPS downloads are permitted'))
        return
      }

      // Validate host against allowlist
      try {
        const parsed = new URL(url)
        if (parsed.username || parsed.password || (parsed.port && parsed.port !== '443')) {
          reject(new Error('Download URL has forbidden credentials or port'))
          return
        }
        const host = parsed.hostname
        const allowed = ALLOWED_DOWNLOAD_HOSTS.includes(host) ||
          host === 'huggingface.co' ||
          ALLOWED_DOWNLOAD_SUFFIXES.some((suffix) => host.endsWith(suffix))
        if (!allowed) {
          reject(new Error(`Download host not allowed: ${host}`))
          return
        }
      } catch {
        reject(new Error(`Invalid download URL: ${url}`))
        return
      }

      const req = https.get(url, { headers: { 'User-Agent': 'Murmur' } }, (response) => {
        // Handle redirects with depth limit
        if (response.statusCode && [301, 302, 303, 307, 308].includes(response.statusCode)) {
          response.resume()
          if (redirectCount >= MAX_REDIRECTS) {
            reject(new Error('Too many redirects'))
            return
          }
          const location = response.headers.location
          if (location) {
            // Resolve relative redirects against the original URL
            try {
              const redirectUrl = new URL(location, url).href
              this.downloadFile(redirectUrl, dest, onProgress, redirectCount + 1, expected).then(resolve).catch(reject)
            } catch {
              reject(new Error('Invalid redirect URL'))
            }
            return
          }
        }

        if (response.statusCode !== 200) {
          response.resume()
          reject(new Error(`Download failed: HTTP ${response.statusCode} for ${url}`))
          return
        }

        if (!expected || !/^[a-f0-9]{64}$/.test(expected.sha256)) {
          response.resume()
          reject(new Error('Missing SHA-256 download integrity metadata'))
          return
        }
        const temp = `${dest}.${randomUUID()}.part`
        let received = 0
        const hash = createHash('sha256')
        const meter = new Transform({
          transform(chunk: Buffer, _encoding, callback) {
            received += chunk.length
            if (received > expected.size) {
              callback(new Error('Download size exceeds expected size'))
              return
            }
            hash.update(chunk)
            onProgress?.(received / expected.size)
            callback(null, chunk)
          }
        })
        void (async () => {
          try {
            await pipeline(response, meter, fs.createWriteStream(temp, { flags: 'wx', mode: 0o600 }))
            if (received !== expected.size) throw new Error('Download size mismatch')
            if (hash.digest('hex') !== expected.sha256) throw new Error('SHA-256 mismatch')
            fs.renameSync(temp, dest)
            resolve()
          } catch (error) {
            reject(error)
          } finally {
            fs.rmSync(temp, { force: true })
          }
        })()
      })
      req.on('error', (err) => {
        reject(err)
      })
      req.setTimeout(30_000, () => {
        req.destroy()
        reject(new Error('Download timed out (30s socket inactivity)'))
      })
    })
  }
}

export default ModelManager
