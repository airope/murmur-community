export type TranscriptionProvider = 'chatgpt' | 'groq' | 'local' | 'deepgram' | 'assemblyai' | 'elevenlabs'
export type LlmProvider = 'openai' | 'groq' | 'anthropic' | 'gemini' | 'mistral' | 'deepseek' | 'openrouter'

export type ModelType = 'whisper' | 'transducer'
export type ModelStatus = 'available' | 'downloading' | 'installed'

export interface ModelFileEntry {
  name: string
  url: string
  size: number
}

export interface ModelCatalogEntry {
  id: string
  name: string
  type: ModelType
  language: string
  description: string
  sizeBytes: number
  license: 'MIT'
  files: (ModelFileEntry & { sha256: string })[]
  cliArgs: Record<string, string>
}

export interface InstalledModel {
  id: string
  name: string
  type: ModelType
  path: string
}

export interface AiMode {
  id: string
  name: string
  description: string
  systemPrompt: string
  icon: string
}

export interface MurmurConfig {
  locale?: string
  hotkey: string
  hotkeyAiProcess: string
  hotkeyHandsFree: string
  autoStart: boolean
  onboardingCompleted: boolean
  soundEnabled: boolean
  transcriptionProvider: TranscriptionProvider
  postProcessingEnabled: boolean
  postProcessingProvider: LlmProvider
  defaultAiMode: string
  apiKeys: Record<string, string>
  localModel: string | null
  customDictionary: string[]
  customAiModes: AiMode[]
  handsFreeContinuous: boolean
  liveTextDurationMs: number
  snippets: Snippet[]
}

export interface Snippet {
  id: string
  trigger: string
  text: string
}

export interface TranscriptionEntry {
  id: string
  text: string
  timestamp: number
  duration: number
  wordCount: number
}

export type AppState = 'idle' | 'listening' | 'processing' | 'error'

export interface TranscriptionHistory {
  entries: TranscriptionEntry[]
}

export interface DailyUsage {
  date: string
  count: number
}

export interface UsageStats {
  dictationsToday: number
  wordsThisWeek: number
  timeSavedMin: number
  streakDays: number
}
