import { MurmurConfig, TranscriptionEntry, DailyUsage, UsageStats } from '../shared/types'
import { DEFAULT_HOTKEY, MAX_HISTORY_ENTRIES } from '../shared/constants'

const defaults: MurmurConfig = {
  hotkey: DEFAULT_HOTKEY,
  hotkeyAiProcess: '',
  hotkeyHandsFree: '',
  autoStart: false,
  onboardingCompleted: false,
  soundEnabled: true,
  transcriptionProvider: 'local',
  postProcessingEnabled: false,
  postProcessingProvider: 'openai',
  defaultAiMode: 'raw',
  apiKeys: {},
  localModel: null,
  customDictionary: [],
  customAiModes: [],
  handsFreeContinuous: false,
  liveTextDurationMs: 3000,
  snippets: []
}

import Store from 'electron-store'

type StoreSchema = { config: MurmurConfig; history: TranscriptionEntry[]; usage: DailyUsage }

let store: Store<StoreSchema> | null = null

export function getStore(): Store<StoreSchema> {
  if (!store) {
    store = new Store<StoreSchema>({
      defaults: {
        config: defaults,
        history: [],
        usage: { date: new Date().toISOString().split('T')[0], count: 0 }
      }
    })
  }
  return store
}

export class StorageService {
  private store: Store<StoreSchema> | null = null

  init(): void {
    this.store = getStore()
    this.migrateOldHotkey()
  }

  /** Migrate old default hotkey (F9) to Ctrl+Space */
  private migrateOldHotkey(): void {
    const config = this.getConfig()
    const old = config.hotkey
    if (old === 'F9') {
      console.log(`[Murmur] Migrating old hotkey "${old}" → "${DEFAULT_HOTKEY}"`)
      this.setConfig({ hotkey: DEFAULT_HOTKEY })
    }
  }

  getConfig(): MurmurConfig {
    const config = { ...defaults, ...this.store!.get('config') }
    return config
  }

  setConfig(config: Partial<MurmurConfig>): void {
    const current = this.getConfig()
    const merged = { ...current, ...config }
    this.store!.set('config', merged)

  }

  getHistory(): TranscriptionEntry[] {
    return this.store!.get('history')
  }

  addToHistory(entry: TranscriptionEntry): void {
    const history = this.getHistory()
    if (!entry.wordCount) {
      entry.wordCount = entry.text.split(/\s+/).filter(Boolean).length
    }
    history.unshift(entry)
    if (history.length > MAX_HISTORY_ENTRIES) history.length = MAX_HISTORY_ENTRIES
    this.store!.set('history', history)
  }

  clearHistory(): void {
    this.store!.set('history', [])
  }

  getUsage(): DailyUsage {
    const usage = this.store!.get('usage')
    const today = new Date().toISOString().split('T')[0]
    if (usage.date !== today) {
      const reset = { date: today, count: 0 }
      this.store!.set('usage', reset)
      return reset
    }
    return usage
  }

  incrementUsage(): void {
    const usage = this.getUsage()
    this.store!.set('usage', { ...usage, count: usage.count + 1 })
  }


  getWordsToday(): number {
    const today = new Date().toISOString().split('T')[0]
    const history = this.getHistory()
    return history
      .filter(entry => new Date(entry.timestamp).toISOString().split('T')[0] === today)
      .reduce((sum, entry) => sum + (entry.wordCount ?? 0), 0)
  }

  setHistory(entries: TranscriptionEntry[]): void {
    this.store!.set('history', entries)
  }

  getStats(): UsageStats {
    const history = this.getHistory()
    const usage = this.getUsage()
    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    const wordsThisWeek = history
      .filter(e => e.timestamp > weekAgo.getTime())
      .reduce((sum, e) => sum + (e.wordCount || e.text.split(/\s+/).length), 0)

    // Estimate time saved: ~150 WPM speaking vs ~40 WPM typing = ~73% faster
    const timeSavedMin = Math.round(wordsThisWeek / 40 * 0.73)

    return {
      dictationsToday: usage.count,
      wordsThisWeek,
      timeSavedMin,
      streakDays: this.getStreak()
    }
  }

  private getStreak(): number {
    const history = this.getHistory()
    if (history.length === 0) return 0

    let streak = 0
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    for (let d = 0; d < 365; d++) {
      const day = new Date(today.getTime() - d * 24 * 60 * 60 * 1000)
      const dayStr = day.toISOString().split('T')[0]
      const hasEntry = history.some(e => {
        const entryDay = new Date(e.timestamp).toISOString().split('T')[0]
        return entryDay === dayStr
      })
      if (hasEntry) streak++
      else if (d > 0) break // Allow today to not have entries yet
    }
    return streak
  }
}
