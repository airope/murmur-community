import { expect, test } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
const source = (p: string) => readFileSync(resolve('src', p), 'utf8')
test('commercial services and their IPC are absent, not stubbed', () => {
  for (const service of ['analytics', 'usageSync', 'license', 'gates', 'anti-tamper', 'integrity', 'updater']) {
    expect(existsSync(resolve('src/main', service + '.ts'))).toBe(false)
  }
  for (const file of ['main/index.ts', 'preload/preload.ts', 'main/transcription.ts']) {
    expect(source(file)).not.toMatch(/analytics|usageSync|gates\.|license:|auth:|referral:|update:|TRACKING_PREFIX/)
  }
})
