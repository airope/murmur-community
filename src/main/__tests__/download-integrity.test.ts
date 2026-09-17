import { describe, it, expect, vi, afterEach } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { createHash } from 'crypto'
import https from 'https'
import { PassThrough } from 'stream'
import { EventEmitter } from 'events'
vi.mock('electron', () => ({ app: { getPath: () => os.tmpdir() } }))
import { ModelManager } from '../model-manager'
import { MODEL_CATALOG, SHERPA_ONNX_RUNTIME_INTEGRITY } from '../../shared/constants'

const dirs: string[] = []
function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'murmur-integrity-'))
  dirs.push(dir)
  return { manager: new ModelManager() as any, dest: path.join(dir, 'model') }
}
function network(body: string) {
  vi.spyOn(https, 'get').mockImplementation(((_url: unknown, _opts: unknown, callback: any) => {
    const req = new EventEmitter() as any
    req.setTimeout = vi.fn()
    queueMicrotask(() => {
      const response = new PassThrough() as any
      response.statusCode = 200
      response.headers = { 'content-length': String(Buffer.byteLength(body)) }
      callback(response)
      response.end(body)
    })
    return req
  }) as any)
}
afterEach(() => { vi.restoreAllMocks(); dirs.splice(0).forEach(d => fs.rmSync(d, { recursive: true, force: true })) })
describe('download integrity (real streams, disk and SHA-256)', () => {
  it('publishes authentic bytes and rejects truncation and oversized responses', async () => {
    const { manager, dest } = fixture()
    const expected = { size: 9, sha256: createHash('sha256').update('authentic').digest('hex') }
    network('authentic')
    await manager.downloadFile('https://huggingface.co/model', dest, undefined, 0, expected)
    expect(fs.readFileSync(dest, 'utf8')).toBe('authentic')
    for (const body of ['short', 'much too long']) {
      network(body)
      await expect(manager.downloadFile('https://huggingface.co/model', dest, undefined, 0, expected)).rejects.toThrow(/size/)
      expect(fs.readFileSync(dest, 'utf8')).toBe('authentic')
    }
  })
  it('does not treat an unverified legacy runtime as installed', () => {
    const { manager, dest } = fixture()
    manager.baseDir = path.dirname(dest)
    fs.mkdirSync(manager.getRuntimeDir())
    fs.writeFileSync(manager.getRuntimePath(), 'not a verified executable')
    expect(manager.isRuntimeInstalled()).toBe(false)
  })
  it('requires pinned hashes and exact sizes for every catalog download', () => {
    for (const entry of MODEL_CATALOG) {
      expect(entry.license).toBe('MIT')
      expect(entry.sizeBytes).toBe(entry.files.reduce((n, f) => n + f.size, 0))
      for (const file of entry.files) {
        expect(file.url).toMatch(/\/resolve\/[a-f0-9]{40}\//)
        expect(file.sha256).toMatch(/^[a-f0-9]{64}$/)
      }
    }
  })
  it('extracts only a verified executable and notices later tampering', async () => {
    const { manager, dest } = fixture()
    manager.baseDir = path.dirname(dest)
    fs.mkdirSync(manager.getRuntimeDir())
    const archive = Buffer.from('QlpoOTFBWSZTWdcz4F8AAITdgMqAQALtgCAAf2XfQAgIIAB0Gk1MmmRppo0AaYgSUQaaADQAA+g8ahA2JCEVcVuK53uQIYDDF/sG72OE5gQiZA25Ri+CloQJTDtnmHxlNGnqaz2oo6MQubbDwNYuw9F2NZMFkEh0M6V+c1+5EQH4u5IpwoSGuZ8C+A==', 'base64')
    const archivePath = path.join(manager.getRuntimeDir(), 'fixture.tar.bz2')
    fs.writeFileSync(archivePath, archive)
    const integrity = { size: archive.length, sha256: createHash('sha256').update(archive).digest('hex') }
    await manager.extractRuntime(archivePath, manager.getRuntimeDir(), integrity, 'sherpa-onnx-offline')
    expect(fs.readFileSync(manager.getRuntimePath(), 'utf8')).toBe('verified executable fixture')
    const receipt = JSON.parse(fs.readFileSync(path.join(manager.getRuntimeDir(), 'verified.json'), 'utf8'))
    expect(receipt.archiveSha256).toBe(integrity.sha256)
    expect(manager.verifyFile(manager.getRuntimePath(), receipt)).toBe(true)
    fs.writeFileSync(manager.getRuntimePath(), 'tampered')
    expect(manager.verifyFile(manager.getRuntimePath(), receipt)).toBe(false)
  })
  it('rejects traversal archive entries without writing outside the runtime', async () => {
    const { manager, dest } = fixture()
    manager.baseDir = path.dirname(dest)
    fs.mkdirSync(manager.getRuntimeDir())
    const archive = Buffer.from('QlpoOTFBWSZTWfqFe/kAAFxbgMqAQAHPgAEAfyRfQAgIIAB1DU1NAHqaekNGBqBJSNNMjIAAGk84FCEGjUIRbzJ5TY9yBDAYQe2JFwnMEH3MHDRo40fliQp4UKIzqa1qs4NK2ZWMKYIbm5UnXLJJB+LuSKcKEh9Qr38g', 'base64')
    const archivePath = path.join(manager.getRuntimeDir(), 'fixture.tar.bz2')
    fs.writeFileSync(archivePath, archive)
    const integrity = { size: archive.length, sha256: createHash('sha256').update(archive).digest('hex') }
    await expect(manager.extractRuntime(archivePath, manager.getRuntimeDir(), integrity)).rejects.toThrow(/Unsafe archive path/)
    expect(fs.existsSync(path.join(path.dirname(dest), 'escaped'))).toBe(false)
    expect(manager.isRuntimeInstalled()).toBe(false)
  })
  it('rehashes installed models and repairs existing corrupt files through a verified download', async () => {
    const { manager, dest } = fixture()
    manager.baseDir = path.dirname(dest)
    fs.mkdirSync(manager.getRuntimeDir())
    fs.writeFileSync(manager.getRuntimePath(), 'authentic')
    const expected = { size: 9, sha256: createHash('sha256').update('authentic').digest('hex') }
    fs.writeFileSync(path.join(manager.getRuntimeDir(), 'verified.json'), JSON.stringify({
      ...expected, archiveSha256: SHERPA_ONNX_RUNTIME_INTEGRITY.sha256
    }))
    expect(manager.isRuntimeInstalled()).toBe(true)
    const entry = { ...MODEL_CATALOG[0], id: 'integrity-fixture', sizeBytes: 9,
      files: [{ name: 'model.onnx', url: 'https://huggingface.co/fixture', ...expected }] }
    MODEL_CATALOG.push(entry)
    try {
      fs.mkdirSync(manager.getModelPath(entry.id), { recursive: true })
      const model = path.join(manager.getModelPath(entry.id), 'model.onnx')
      fs.writeFileSync(model, 'corrupted')
      expect(manager.isModelInstalled(entry.id)).toBe(false)
      network('authentic')
      await manager.installModel(entry.id)
      expect(manager.isModelInstalled(entry.id)).toBe(true)
      fs.writeFileSync(model, 'corrupted')
      expect(manager.isModelInstalled(entry.id)).toBe(false)
    } finally { MODEL_CATALOG.pop() }
  })
  it('rejects an archive whose digest does not match before decompression', async () => {
    const { manager, dest } = fixture()
    fs.writeFileSync(dest, 'bad archive')
    await expect(manager.extractRuntime(dest, path.dirname(dest))).rejects.toThrow(/SHA-256/)
    expect(fs.readdirSync(path.dirname(dest))).toEqual(['model'])
  })
  it('rejects HTTPS URLs with embedded credentials or unexpected ports', async () => {
    const { manager, dest } = fixture()
    network('authentic')
    const expected = { size: 9, sha256: createHash('sha256').update('authentic').digest('hex') }
    for (const url of ['https://user:pass@github.com/file', 'https://github.com:8443/file']) {
      await expect(manager.downloadFile(url, dest, undefined, 0, expected)).rejects.toThrow(/credentials or port/)
    }
  })
  it('handles malformed redirects as rejected downloads', async () => {
    const { manager, dest } = fixture()
    vi.spyOn(https, 'get').mockImplementation(((_url: unknown, _opts: unknown, callback: any) => {
      const req = new EventEmitter() as any
      req.setTimeout = vi.fn()
      const response = new PassThrough() as any
      response.statusCode = 302
      response.headers = { location: 'https://[' }
      callback(response)
      return req
    }) as any)
    await expect(manager.downloadFile('https://huggingface.co/model', dest)).rejects.toThrow(/Invalid redirect/)
    expect(fs.existsSync(dest)).toBe(false)
  })
  it('revalidates redirect destinations before following them', async () => {
    const { manager, dest } = fixture()
    for (const location of ['http://github.com/file', 'https://github.com.evil.test/file']) {
      const get = vi.spyOn(https, 'get').mockImplementation(((_url: unknown, _opts: unknown, callback: any) => {
        const req = new EventEmitter() as any
        req.setTimeout = vi.fn()
        const response = new PassThrough() as any
        response.statusCode = 302
        response.headers = { location }
        callback(response)
        return req
      }) as any)
      await expect(manager.downloadFile('https://huggingface.co/model', dest)).rejects.toThrow(/HTTPS|host not allowed/)
      expect(get).toHaveBeenCalledTimes(1)
      vi.restoreAllMocks()
    }
  })
  it('rejects corrupted bytes without publishing a destination', async () => {
    const { manager, dest } = fixture()
    network('corrupted')
    const expected = { size: 9, sha256: createHash('sha256').update('authentic').digest('hex') }
    await expect(manager.downloadFile('https://huggingface.co/model', dest, undefined, 0, expected)).rejects.toThrow(/SHA-256/)
    expect(fs.existsSync(dest)).toBe(false)
    expect(fs.readdirSync(path.dirname(dest))).toEqual([])
  })
})
