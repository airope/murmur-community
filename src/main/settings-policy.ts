import type { MurmurConfig } from '../shared/types'
import { MODEL_CATALOG } from '../shared/constants'
const text = (v: unknown, max: number): v is string => typeof v === 'string' && v.length <= max && !v.includes('\0')
const bool = (v: unknown): boolean => typeof v === 'boolean'
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const fields: Record<string, (value: unknown) => boolean> = {
  hotkey: v => text(v, 100), hotkeyAiProcess: v => text(v, 100), hotkeyHandsFree: v => text(v, 100),
  autoStart: bool, onboardingCompleted: bool, soundEnabled: bool, postProcessingEnabled: bool,
  handsFreeContinuous: bool,
  locale: v => typeof v === 'string' && ['en', 'fr', 'de', 'es', 'pt'].includes(v),
  transcriptionProvider: v => ['chatgpt', 'local', 'groq', 'deepgram', 'assemblyai', 'elevenlabs'].includes(v as string),
  postProcessingProvider: v => ['openai', 'groq', 'anthropic', 'gemini', 'mistral', 'deepseek', 'openrouter'].includes(v as string),
  defaultAiMode: v => text(v, 100),
  localModel: v => v === null || MODEL_CATALOG.some(m => m.id === v),
  liveTextDurationMs: v => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 60000,
  customDictionary: v => Array.isArray(v) && v.length <= 1000 && v.every(w => text(w, 100)),
  customAiModes: v => Array.isArray(v) && v.every(m => record(m) && text(m.id, 100) && text(m.name, 100) && text(m.description, 1000) && text(m.systemPrompt, 5000) && text(m.icon, 100) && Object.keys(m).every(k => ['id','name','description','systemPrompt','icon'].includes(k))),
  snippets: v => Array.isArray(v) && v.every(s => record(s) && text(s.id, 100) && text(s.trigger, 200) && text(s.text, 10000) && Object.keys(s).every(k => ['id','trigger','text'].includes(k)))
}
export function validateSettings(input: unknown): Partial<MurmurConfig> {
  if (!record(input)) throw new Error('Invalid settings')
  const output: Record<string, unknown> = {}
  for (const [name, value] of Object.entries(input)) {
    const key = name === 'shortcut' ? 'hotkey' : name
    if (!Object.hasOwn(fields, key) || !fields[key](value)) throw new Error(`Invalid setting: ${name}`)
    output[key] = value
  }
  return output
}
export function publicSettings(config: MurmurConfig): Omit<MurmurConfig, 'apiKeys'> {
  const { apiKeys: _keys, ...settings } = config
  return settings
}
