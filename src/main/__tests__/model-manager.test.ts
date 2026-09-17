import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import https from 'https'
import { EventEmitter } from 'events'

// Share fully qualified native paths with the hoisted Electron mock.
const { BASE_DIR, TEMP_DIR } = await vi.hoisted(async () => {
  const os = await import('node:os')
  const path = await import('node:path')
  const TEMP_DIR = path.resolve(os.tmpdir())
  return { TEMP_DIR, BASE_DIR: path.join(TEMP_DIR, 'murmur-test-userdata') }
})

// Mock modules before importing model-manager
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn((name: string) => {
      if (name === 'userData') return BASE_DIR
      return TEMP_DIR
    }),
  },
}))

// We need to import after mock setup
const { ModelManager } = await import('../model-manager')

const RUNTIME_DIR = path.join(BASE_DIR, 'runtime')
const MODELS_DIR = path.join(BASE_DIR, 'models')

describe('ModelManager', () => {
  let manager: InstanceType<typeof ModelManager>

  beforeEach(() => {
    manager = new (ModelManager as any)()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ---- Path methods ----

  describe('path methods', () => {
    it('returns correct runtime dir', () => {
      expect(manager.getRuntimeDir()).toBe(RUNTIME_DIR)
    })

    it('returns correct models dir', () => {
      expect(manager.getModelsDir()).toBe(MODELS_DIR)
    })

    it('returns correct model path for valid id', () => {
      const modelPath = manager.getModelPath('whisper-tiny-en')
      expect(modelPath).toBe(path.join(MODELS_DIR, 'whisper-tiny-en'))
    })

    it('throws on path traversal attack', () => {
      expect(() => manager.getModelPath('../evil')).toThrow('path traversal detected')
      expect(() => manager.getModelPath('../../etc/passwd')).toThrow('path traversal detected')
    })
  })

  // ---- isRuntimeInstalled ----

  describe('isRuntimeInstalled', () => {
    it('returns false when binary does not exist', () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(false)
      expect(manager.isRuntimeInstalled()).toBe(false)
    })

    it('does not trust existence alone without a verified receipt', () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true)
      expect(manager.isRuntimeInstalled()).toBe(false)
    })
  })

  // ---- isModelInstalled ----

  describe('isModelInstalled', () => {
    it('returns false for unknown model', () => {
      expect(manager.isModelInstalled('nonexistent-model')).toBe(false)
    })

    it('returns false when model directory does not exist', () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(false)
      expect(manager.isModelInstalled('whisper-tiny-en')).toBe(false)
    })

    it('does not trust model file existence without correct bytes', () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true)
      expect(manager.isModelInstalled('whisper-tiny-en')).toBe(false)
    })

    it('returns false when some model files are missing', () => {
      let callCount = 0
      vi.spyOn(fs, 'existsSync').mockImplementation(() => {
        callCount++
        return callCount === 1 // Only the directory exists, not the files
      })
      expect(manager.isModelInstalled('whisper-tiny-en')).toBe(false)
    })
  })

  // ---- getCatalogEntry ----

  describe('getCatalogEntry', () => {
    it('returns entry for known model', () => {
      const entry = manager.getCatalogEntry('whisper-tiny-en')
      expect(entry).toBeDefined()
      expect(entry?.id).toBe('whisper-tiny-en')
      expect(entry?.type).toBe('whisper')
      expect(entry?.files.length).toBeGreaterThan(0)
    })

    it('returns undefined for unknown model', () => {
      expect(manager.getCatalogEntry('unknown')).toBeUndefined()
    })
  })

  // ---- getInstalledModels ----

  describe('getInstalledModels', () => {
    it('returns empty array when models dir does not exist', () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(false)
      expect(manager.getInstalledModels()).toEqual([])
    })
  })

  // ---- deleteModel ----

  describe('deleteModel', () => {
    it('throws for unknown model', () => {
      expect(() => manager.deleteModel('nonexistent')).toThrow('Unknown model')
    })

    it('removes model directory when it exists', () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true)
      const rmSpy = vi.spyOn(fs, 'rmSync').mockImplementation(() => {})
      manager.deleteModel('whisper-tiny-en')
      expect(rmSpy).toHaveBeenCalledWith(
        path.join(MODELS_DIR, 'whisper-tiny-en'),
        { recursive: true, force: true }
      )
    })

    it('does nothing when model directory does not exist', () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(false)
      const rmSpy = vi.spyOn(fs, 'rmSync').mockImplementation(() => {})
      manager.deleteModel('whisper-tiny-en')
      expect(rmSpy).not.toHaveBeenCalled()
    })
  })

  // ---- downloadFile (via installModel) ----

  describe('downloadFile (private, tested via installModel)', () => {
    it('rejects on non-HTTPS URL', async () => {
      // Patch the private method temporarily via prototype
      const mgr = manager as any
      await expect(mgr.downloadFile('http://example.com/file', '/tmp/test', undefined)).rejects.toThrow(
        'Only HTTPS downloads are permitted'
      )
    })

    it('rejects on disallowed host', async () => {
      const mgr = manager as any
      await expect(mgr.downloadFile('https://evil.com/file', '/tmp/test', undefined)).rejects.toThrow(
        'Download host not allowed'
      )
    })

    it('rejects on too many redirects', async () => {
      const mgr = manager as any
      // Simulate a redirect storm by starting at redirectCount = MAX_REDIRECTS (5)
      // We pass redirectCount=5 directly to the private method
      // The redirect logic checks redirectCount >= MAX_REDIRECTS (5)
      const mockResponse = new EventEmitter() as any
      mockResponse.statusCode = 301
      mockResponse.headers = { location: 'https://github.com/redirect' }
      mockResponse.resume = vi.fn()

      const mockRequest = new EventEmitter() as any
      mockRequest.setTimeout = vi.fn()

      vi.spyOn(https, 'get').mockImplementation((_url: any, _opts: any, callback: any) => {
        callback(mockResponse)
        return mockRequest
      })

      await expect(
        mgr.downloadFile('https://github.com/file', '/tmp/test', undefined, 5)
      ).rejects.toThrow('Too many redirects')
    })

    it('rejects on non-200 status', async () => {
      const mgr = manager as any
      const mockResponse = new EventEmitter() as any
      mockResponse.statusCode = 404
      mockResponse.headers = {}
      mockResponse.resume = vi.fn()

      const mockRequest = new EventEmitter() as any
      mockRequest.setTimeout = vi.fn()

      vi.spyOn(https, 'get').mockImplementation((_url: any, _opts: any, callback: any) => {
        callback(mockResponse)
        return mockRequest
      })

      await expect(
        mgr.downloadFile('https://github.com/file', '/tmp/test', undefined, 0)
      ).rejects.toThrow('HTTP 404')
    })
  })

  // ---- installModel validation ----

  describe('installModel', () => {
    it('throws for unknown model', async () => {
      await expect(manager.installModel('nonexistent-model')).rejects.toThrow('Unknown model')
    })
  })
})
