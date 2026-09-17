import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8')
const pkg = JSON.parse(read('package.json'))
assert.equal(pkg.name, 'murmur-community', 'Community must have a distinct package name')
assert.equal(pkg.license, 'MIT')
for (const name of ['electron-updater', 'node-machine-id', 'vite-plugin-javascript-obfuscator']) {
  assert.ok(!pkg.dependencies?.[name] && !pkg.devDependencies?.[name], `${name} must not ship`)
}
const builder = read('electron-builder.yml')
assert.match(builder, /appId: com\.murmur\.community/)
assert.match(builder, /identity: null/)
assert.doesNotMatch(builder, /murmur-releases|publish:|7J434WCRT8/)
assert.match(builder, /'out\/\*\*\/\*'/, 'Package must explicitly allow compiled code')
assert.doesNotMatch(read('electron.vite.config.ts'), /bytecodePlugin|javascriptObfuscator/)
assert.match(pkg.scripts.typecheck, /tsconfig\.node\.json/)
assert.match(pkg.scripts.typecheck, /tsconfig\.web\.json/)
console.log('Community packaging contract passed')
