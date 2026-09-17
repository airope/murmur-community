import { expect, test, vi } from 'vitest'
vi.mock('electron-store', () => ({ default: class {
  data: any
  constructor(options: any) { this.data = structuredClone(options.defaults) }
  get(key: string) { return this.data[key] }
  set(key: string, value: any) { this.data[key] = value }
} }))
import { StorageService } from '../storage'
test('community defaults are local and history remains accessible without commercial state', () => {
  const storage = new StorageService()
  storage.init()
  expect(storage.getConfig().transcriptionProvider).toBe('local')
  expect(storage.getConfig().autoStart).toBe(false)
  expect(storage.getConfig()).not.toHaveProperty('isPro')
  expect(storage.getConfig()).not.toHaveProperty('authToken')
  for (let i = 0; i < 12; i++) storage.addToHistory({ id: String(i), text: 'hello', timestamp: Date.now(), duration: 1, wordCount: 1 })
  expect(storage.getHistory()).toHaveLength(12)
  expect(storage.getHistory().some((entry: any) => entry.locked)).toBe(false)
})
