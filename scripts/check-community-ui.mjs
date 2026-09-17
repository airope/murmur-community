import '../src/renderer/tests/community.test.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = file => readFileSync(new URL(`../src/renderer/src/${file}`, import.meta.url), 'utf8')

test('deletable modes come from the persisted custom list, not invented builtin flags or ID prefixes', () => {
  const source = read('components/AISettingsPage.tsx')
  const expression = source.match(/const customModes = (.+)/)?.[1]
  assert.ok(expression)
  const select = new Function('modes', 'settings', `return ${expression}`)
  const builtins = ['raw', 'grammar-fix', 'email-pro', 'code-prompt', 'summary'].map(id => ({ id, name: id }))
  const custom = [{ id: 'my-mode', name: 'Custom' }, { id: 'builtin-my-mode', name: 'Also custom' }]
  assert.deepEqual(select([...builtins, ...custom], { customAiModes: custom }), custom)
  assert.deepEqual(select(builtins, { customAiModes: [] }), [])
  assert.deepEqual(select(builtins, {}), [])
  // Dedicated save/delete IPC mutates persisted settings; refresh after both operations.
  for (const handler of ['saveCustomMode', 'deleteCustomMode']) {
    const body = source.slice(source.indexOf(`const ${handler} =`)).split('\n  //')[0]
    assert.match(body, /await reload\(\)/)
  }
})

test('transcription provider controls stack below their description in a width-constrained row', () => {
  const page = read('components/TranscriptionSettingsPage.tsx')
  const row = page.match(/<SettingRow\b[^>]*sttProvider[^>]*>/)?.[0]
  assert.ok(row?.includes('stacked'), 'provider row must opt into stacked layout rather than squeeze the description')
  const component = read('components/SettingRow.tsx')
  assert.match(component, /stacked\s*\?\s*'[^']*flex-col/)
  assert.match(component, /stacked\s*\?\s*'[^']*w-full[^']*min-w-0/)
  assert.match(page, /className="flex gap-2 flex-wrap"/)
})
