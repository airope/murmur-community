import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = fileURLToPath(new URL('../src/', import.meta.url))
function sources(dir = root) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(dir, entry.name)
    return entry.isDirectory() ? sources(file) : /\.tsx?$/.test(file) ? [file] : []
  })
}
const read = file => readFileSync(path.join(root, file), 'utf8')

test('onboarding keeps explicit microphone, shortcut, provider and test steps', () => {
  const source = read('components/OnboardingPage.tsx')
  for (const component of ['WelcomeStep', 'MicStep', 'ShortcutStep', 'TranscriptionSettingsPage', 'TestStep', 'CompleteStep']) {
    assert.match(source, new RegExp(`<${component}\\b`))
  }
  assert.match(source, /await window\.api\.setSettings\(\{ onboardingCompleted: true \}\)/)
  assert.match(source, /const \[step, setStep\] = useState\(1\)/)
  assert.doesNotMatch(source, /handleFinish\}\s*>\s*\{t\('onboarding\.skip'/)
})

test('ChatGPT is explicitly experimental and never checked for a local provider', () => {
  assert.match(read('components/TranscriptionSettingsPage.tsx'), /experimental/)
  assert.match(read('hooks/useIPC.ts'), /if \(enabled\) checkSession\(\)/)
  assert.match(read('components/SettingsPage.tsx'), /useChatGPT\(settings\.transcriptionProvider === 'chatgpt'\)/)
})

test('updates use a manual community releases link instead of updater IPC', () => {
  for (const file of sources()) assert.doesNotMatch(readFileSync(file, 'utf8'), /\b(?:UpdateBanner|downloadUpdate|installUpdate|onUpdateAvailable|onUpdateDownloaded|onUpdateProgress)\b/)
  assert.match(read('components/SettingsPage.tsx'), /https:\/\/github\.com\/airope\/murmur-community\/releases/)
})

test('settings writes send only the requested patch, not a stale settings snapshot', () => {
  assert.ok(read('hooks/useIPC.ts').includes('await window.api.setSettings(newSettings)'))
})

test('renderer uses only IPC methods provided by the community preload', () => {
  const preload = readFileSync(path.join(root, '../../preload/preload.ts'), 'utf8')
  const names = new Set([...preload.matchAll(/^  (\w+):/gm)].map(match => match[1]))
  const calls = new Set(sources().flatMap(file => [...readFileSync(file, 'utf8').matchAll(/window\.api\.(\w+)/g)].map(match => match[1])))
  assert.deepEqual([...calls].filter(name => !names.has(name)), [])
})

test('community copy is present in every locale without retired commercial sections', () => {
  const localeDir = path.join(root, 'i18n/translations')
  for (const file of readdirSync(localeDir)) {
    const data = JSON.parse(readFileSync(path.join(localeDir, file), 'utf8'))
    assert.ok(data.community?.providerIntro, `${file}: provider setup copy`)
    assert.match(data.onboarding.welcome.title, /Murmur Community/)
    for (const key of ['upgrade', 'license', 'auth', 'referral', 'trial', 'trialExpired', 'update']) {
      assert.equal(data[key], undefined, `${file}: retired ${key}`)
    }
  }
})

test('renderer contains no account, license, referral, quota, upsell or analytics integration', () => {
  const forbidden = /\b(?:useLicense|useAuth|isPro|authToken|userEmail|trackEvent|getAnalyticsId|setAnalyticsEnabled|getAnalyticsEnabled|activateLicense|deactivateLicense|getLicenseStatus|authSendCode|authVerifyCode|authMe|authLogout|onAuthRefresh|getQuotaInfo|onQuotaExceeded|removeQuotaExceededListener|referralStats|referralGenerate|referralGift|referralConvertLifetime|UpgradeDialog|TrialExpiredDialog|TierUnlockModal|QuotaBadge|ReferralPage|LicensePage|AccountStep|VerifyStep|TrialActivatedStep)\b/
  const offenders = sources().filter(file => forbidden.test(readFileSync(file, 'utf8'))).map(file => path.relative(root, file))
  assert.deepEqual(offenders, [])
  assert.doesNotMatch(read('components/TranscriptionCard.tsx'), /\blocked\b|blur-sm/)
})
