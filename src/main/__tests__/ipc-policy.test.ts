import { expect, test } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
test('IPC requires a registered local window and its exact main frame', async () => {
  expect(existsSync(resolve('src/main/ipc-policy.ts'))).toBe(true)
  const { isTrustedLocalSender } = await import('../ipc-policy')
  const frame = { url: 'file:///app/renderer/index.html#/settings' }
  const sender = { mainFrame: frame }
  const win = { isDestroyed: () => false, webContents: sender }
  const event = { sender, senderFrame: frame }
  expect(isTrustedLocalSender(event as any, [win] as any, 'file:///app/renderer/index.html')).toBe(true)
  expect(isTrustedLocalSender(event as any, [], 'file:///app/renderer/index.html')).toBe(false)
  expect(isTrustedLocalSender({ ...event, senderFrame: { ...frame } } as any, [win] as any, 'file:///app/renderer/index.html')).toBe(false)
  frame.url = 'https://chatgpt.com/'
  expect(isTrustedLocalSender(event as any, [win] as any, 'file:///app/renderer/index.html')).toBe(false)
  frame.url = 'file:///other/index.html'
  expect(isTrustedLocalSender(event as any, [win] as any, 'file:///app/renderer/index.html')).toBe(false)
})
test('every invoke and recording channel uses sender checks, preload does not expose raw IPC', () => {
 const index = readFileSync(resolve('src/main/index.ts'),'utf8')
 expect(index.match(/ipcMain\.handle\(/g)).toHaveLength(1)
 expect(index).toContain('isTrustedSender(event)')
 expect(readFileSync(resolve('src/main/transcription.ts'),'utf8')).toContain('isTrustedSender(_event)')
 expect(readFileSync(resolve('src/preload/preload.ts'),'utf8')).not.toContain('electronAPI')
})
