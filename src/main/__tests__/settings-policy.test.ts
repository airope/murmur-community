import { expect, test } from 'vitest'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
test('settings allowlist rejects secrets, unknown fields and invalid values', async () => {
  expect(existsSync(resolve('src/main/settings-policy.ts'))).toBe(true)
  const { validateSettings, publicSettings } = await import('../settings-policy')
  expect(() => validateSettings({ apiKeys: { groq: 'secret' } })).toThrow()
  expect(() => validateSettings({ isPro: true })).toThrow()
  expect(() => validateSettings({ transcriptionProvider: 'unknown' })).toThrow()
  expect(() => validateSettings({ autoStart: 'yes' })).toThrow()
  expect(() => validateSettings({ liveTextDurationMs: -1 })).toThrow()
  expect(validateSettings({ transcriptionProvider: 'local', autoStart: false })).toEqual({ transcriptionProvider: 'local', autoStart: false })
  expect(publicSettings({ apiKeys: { groq: 'secret' }, hotkey: 'Ctrl+Space' } as any)).toEqual({ hotkey: 'Ctrl+Space' })
})
