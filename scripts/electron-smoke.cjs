// Isolated, no-microphone desktop integration check. Run with Electron, not Node.
const { app, BrowserWindow, globalShortcut, session, shell } = require('electron')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const http = require('node:http')
const https = require('node:https')
const output = path.resolve(process.env.MURMUR_SMOKE_OUTPUT || 'test-results/electron')
fs.mkdirSync(output, { recursive: true })
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'murmur-community-smoke-'))
process.env.MURMUR_TEST_USER_DATA = profile
// Stub ONLY OS side effects. The actual app, IPC, renderer and storage still run.
app.setLoginItemSettings = () => {}
globalShortcut.register = () => true
globalShortcut.unregister = () => {}
globalShortcut.unregisterAll = () => {}
BrowserWindow.prototype.show = function () { this.showInactive() }
BrowserWindow.prototype.focus = function () {}
const network = []
const rejectNetwork = (destination) => { network.push(String(destination)); throw new Error('Unexpected network access in offline smoke') }
global.fetch = async (url) => rejectNetwork(url)
http.request = (url) => rejectNetwork(url)
https.request = (url) => rejectNetwork(url)
http.get = (url) => rejectNetwork(url)
https.get = (url) => rejectNetwork(url)
shell.openExternal = async (url) => rejectNetwork(url)
const errors = []
app.on('web-contents-created', (_event, contents) => {
  contents.on('preload-error', (_e, _p, error) => errors.push(String(error)))
  contents.on('console-message', (_e, detail, message) => {
    const level = typeof detail === 'object' ? detail.level : detail
    const text = typeof detail === 'object' ? detail.message : message
    if (level === 'error' || level === 3) errors.push(String(text))
  })
  contents.on('render-process-gone', (_e, detail) => errors.push(JSON.stringify(detail)))
})
const timeout = setTimeout(() => { console.error('Desktop smoke timed out'); app.exit(1) }, 45000)
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms))
async function waitFor(fn, message) {
  const until = Date.now() + 15000
  while (Date.now() < until) { const result = await fn(); if (result) return result; await delay(100) }
  throw new Error(message)
}
app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_wc, _permission, done) => done(false))
  session.defaultSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*'] }, (details, done) => {
    network.push(details.url); done({ cancel: true })
  })
})
require('../out/main/index.js')
app.whenReady().then(async () => {
  try {
    const win = await waitFor(() => BrowserWindow.getAllWindows().find(w => w.webContents.getURL().includes('/renderer/') && !w.webContents.getURL().includes('overlay') && !w.webContents.getURL().includes('onboarding')), 'No renderer window')
    await waitFor(() => win.webContents.executeJavaScript('Boolean(window.api && document.body.innerText.length > 30)').catch(() => false), 'Renderer/preload did not become ready')
    const settings = await win.webContents.executeJavaScript('window.api.getSettings()')
    assert.equal(settings.transcriptionProvider, 'local')
    assert.ok(!('apiKeys' in settings))
    assert.ok(!('authToken' in settings))
    assert.equal(app.getPath('userData'), profile)
    assert.ok(!BrowserWindow.getAllWindows().some(w => /^https?:/.test(w.webContents.getURL())))
    // Exercise the real settings IPC and read-after-write, with no credentials.
    await win.webContents.executeJavaScript("window.api.setSettings({ locale: 'en', soundEnabled: false })")
    const updated = await win.webContents.executeJavaScript('window.api.getSettings()')
    assert.equal(updated.locale, 'en')
    // First-run UI must not require a Murmur account.
    const onboarding = BrowserWindow.getAllWindows().find(w => w.webContents.getURL().includes('onboarding')) || win
    await waitFor(() => onboarding.webContents.executeJavaScript('document.body.innerText.length > 30').catch(() => false), 'Onboarding did not render')
    await delay(1000) // Allow first-run entrance animation to settle before visual evidence.
    fs.writeFileSync(path.join(output, 'onboarding.png'), (await onboarding.webContents.capturePage()).toPNG())
    await win.webContents.executeJavaScript("window.api.setSettings({ onboardingCompleted: true }); location.hash = '#/'")
    await win.webContents.reload()
    await waitFor(() => win.webContents.executeJavaScript('Boolean(window.api && document.body.innerText.length > 30)').catch(() => false), 'Home did not render')
    await delay(300)
    fs.writeFileSync(path.join(output, 'home.png'), (await win.webContents.capturePage()).toPNG())
    const text = await win.webContents.executeJavaScript('document.body.innerText')
    assert.doesNotMatch(text, /Activate Pro|Start free trial|Upgrade to Pro/)
    const routes = ['/settings', '/settings/transcription', '/settings/ai', '/history', '/sound']
    for (const route of routes) {
      await win.webContents.executeJavaScript(`location.hash = ${JSON.stringify('#' + route)}`)
      await delay(400)
      const body = await win.webContents.executeJavaScript('document.body.innerText')
      assert.ok(body.length > 30, `Empty renderer at ${route}`)
      assert.doesNotMatch(body, /Activate Pro|Upgrade to Pro|Start free trial/)
      fs.writeFileSync(path.join(output, route.replaceAll('/', '-').slice(1) + '.png'), (await win.webContents.capturePage()).toPNG())
    }
    assert.deepEqual(network, [], 'Offline startup/settings attempted a network request')
    assert.deepEqual(errors, [])
    fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify({ passed: true, networkRequests: network.length, errors, profileIsolated: true, nativeSideEffectsStubbed: ['login items', 'global shortcuts', 'focus'], microphoneTested: false, screenshots: ['onboarding.png', 'home.png'] }, null, 2))
    console.log('Isolated Electron smoke passed: real renderer, preload, settings IPC, offline startup; microphone not exercised')
    clearTimeout(timeout)
    app.exit(0)
  } catch (error) {
    fs.writeFileSync(path.join(output, 'failure.json'), JSON.stringify({ error: String(error), network, errors }, null, 2))
    console.error(error)
    clearTimeout(timeout)
    app.exit(1)
  }
})
