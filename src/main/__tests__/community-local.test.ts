import { expect, test, vi } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
vi.mock('electron', () => ({ ipcMain: { on: vi.fn() } }))
vi.mock('../clipboard', () => ({ ClipboardService: class {} }))
import { TranscriptionService } from '../transcription'
test('unconfigured local transcription fails locally without remote fallback', async () => {
  const windows = { getChatGPTWindow: vi.fn(), createHiddenChatGPT: vi.fn(), showOverlay: vi.fn(), hideOverlay: vi.fn() }
  const service = new TranscriptionService(windows as any, {} as any, { getConfig: () => ({ transcriptionProvider: 'local', localModel: null }) } as any, {} as any, { hasApiKey: () => false } as any, {} as any)
  await expect(service.startDictation()).rejects.toThrow(/local|model/i)
  expect(windows.createHiddenChatGPT).not.toHaveBeenCalled()
})
test('startup is isolated, remote windows are lazy and context capture is absent', () => {
  const index = readFileSync(resolve('src/main/index.ts'), 'utf8')
  const startup = index.split('app.whenReady()')[1]
  expect(startup).not.toMatch(/createHiddenChatGPT\(|startSessionMonitoring\(/)
  expect(index).toContain('com.murmur.community')
  expect(index).toContain('MURMUR_TEST_USER_DATA')
  expect(existsSync(resolve('src/main/context-adapter.ts'))).toBe(false)
})
