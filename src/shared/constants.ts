export const APP_NAME = 'Murmur Community'
export const DEFAULT_HOTKEY = 'Ctrl+Space'
export const MAX_HISTORY_ENTRIES = 500
export const TRANSCRIPTION_TIMEOUT_MS = 30_000
export const TRANSCRIPTION_STABLE_MS = 2_000
export const TRANSCRIPTION_POLL_MS = 500
export const CLIPBOARD_RESTORE_DELAY_MS = 2_000
export const CHATGPT_URL = 'https://chatgpt.com'
export const CHATGPT_PARTITION = 'persist:chatgpt'
export const GROQ_STT_TIMEOUT_MS = 30_000
export const LLM_PROCESSING_TIMEOUT_MS = 15_000
export const GROQ_STT_MODEL = 'whisper-large-v3-turbo'
export const OPENAI_LLM_MODEL = 'gpt-4o-mini'
export const GROQ_LLM_MODEL = 'llama-3.3-70b-versatile'
export const LOCAL_STT_TIMEOUT_MS = 60_000
export const DEEPGRAM_STT_TIMEOUT_MS = 30_000
export const ASSEMBLYAI_STT_TIMEOUT_MS = 60_000
export const ELEVENLABS_STT_TIMEOUT_MS = 30_000

export const ANTHROPIC_LLM_MODEL = 'claude-sonnet-4-20250514'
export const GEMINI_LLM_MODEL = 'gemini-2.0-flash'
export const MISTRAL_LLM_MODEL = 'mistral-large-latest'
export const DEEPSEEK_LLM_MODEL = 'deepseek-chat'
export const OPENROUTER_LLM_MODEL = 'anthropic/claude-sonnet-4-20250514'

export const OPENAI_COMPATIBLE_ENDPOINTS: Record<string, string> = {
  openai: 'https://api.openai.com/v1',
  groq: 'https://api.groq.com/openai/v1',
  mistral: 'https://api.mistral.ai/v1',
  deepseek: 'https://api.deepseek.com',
  openrouter: 'https://openrouter.ai/api/v1'
}

export const LLM_MODEL_MAP: Record<string, string> = {
  openai: OPENAI_LLM_MODEL,
  groq: GROQ_LLM_MODEL,
  mistral: MISTRAL_LLM_MODEL,
  deepseek: DEEPSEEK_LLM_MODEL,
  openrouter: OPENROUTER_LLM_MODEL
}

export const SHERPA_ONNX_VERSION = '1.12.27'

function getSherpaOnnxRuntimeUrl(): string {
  const ver = SHERPA_ONNX_VERSION
  if (process.platform === 'darwin') {
    return `https://github.com/k2-fsa/sherpa-onnx/releases/download/v${ver}/sherpa-onnx-v${ver}-osx-universal2-static.tar.bz2`
  }
  return `https://github.com/k2-fsa/sherpa-onnx/releases/download/v${ver}/sherpa-onnx-v${ver}-win-x64-static-MT-Release.tar.bz2`
}

// GitHub release asset digests and exact compressed sizes (see docs/MODELS.md).
export const SHERPA_ONNX_RUNTIME_INTEGRITY = process.platform === 'darwin'
  ? { size: 423371358, sha256: 'b2745e840b5460d7d9ad67ccb26b4d8e3c769f7663682dd805d0fb2f345e30d2' }
  : { size: 198251806, sha256: '1fed2afff5135645cda03d764a80761a3afcae12e08f9e2033912964b1d46900' }
export const SHERPA_ONNX_RUNTIME_URL = getSherpaOnnxRuntimeUrl()
export const SHERPA_ONNX_RUNTIME_BINARY = process.platform === 'darwin' ? 'sherpa-onnx-offline' : 'sherpa-onnx-offline.exe'

import type { ModelCatalogEntry } from './types'

export const MODEL_CATALOG: ModelCatalogEntry[] = [
  {
    id: 'whisper-tiny-en',
    name: 'Whisper Tiny (English)',
    type: 'whisper',
    language: 'en',
    description: 'Fastest model, good for quick dictation. English only.',
    license: 'MIT',
    sizeBytes: 103627191,
    files: [
      {
        name: 'tiny.en-encoder.int8.onnx',
        url: 'https://huggingface.co/csukuangfj/sherpa-onnx-whisper-tiny.en/resolve/d026532c022fa99fd789d6b32446a1df7b6bfc43/tiny.en-encoder.int8.onnx',
        size: 12937772,
        sha256: '0ce578b827c94a961aacb8fa14b02f096504b337e5c94be37c36238cbe3e8bc6'
      },
      {
        name: 'tiny.en-decoder.int8.onnx',
        url: 'https://huggingface.co/csukuangfj/sherpa-onnx-whisper-tiny.en/resolve/d026532c022fa99fd789d6b32446a1df7b6bfc43/tiny.en-decoder.int8.onnx',
        size: 89853865,
        sha256: '06c0e6ff6348d427e51839219d1c886c18cfdf411e629e33f5e1679bff9c1527'
      },
      {
        name: 'tiny.en-tokens.txt',
        url: 'https://huggingface.co/csukuangfj/sherpa-onnx-whisper-tiny.en/resolve/d026532c022fa99fd789d6b32446a1df7b6bfc43/tiny.en-tokens.txt',
        size: 835554,
        sha256: '306cd27f03c1a714eca7108e03d66b7dc042abe8c258b44c199a7ed9838dd930'
      }
    ],
    cliArgs: {
      '--whisper-encoder': 'tiny.en-encoder.int8.onnx',
      '--whisper-decoder': 'tiny.en-decoder.int8.onnx',
      '--tokens': 'tiny.en-tokens.txt'
    }
  },
  {
    id: 'whisper-small-en',
    name: 'Whisper Small (English)',
    type: 'whisper',
    language: 'en',
    description: 'Great balance of speed and accuracy. English only.',
    license: 'MIT',
    sizeBytes: 375501079,
    files: [
      {
        name: 'small.en-encoder.int8.onnx',
        url: 'https://huggingface.co/csukuangfj/sherpa-onnx-whisper-small.en/resolve/d9533f69affd85061aee349af7fea5cb2996dbbe/small.en-encoder.int8.onnx',
        size: 112442483,
        sha256: '8bdac288f369aa94ee2194059238c465ed82ea9d47ee8fa4a8c0a891873e462f'
      },
      {
        name: 'small.en-decoder.int8.onnx',
        url: 'https://huggingface.co/csukuangfj/sherpa-onnx-whisper-small.en/resolve/d9533f69affd85061aee349af7fea5cb2996dbbe/small.en-decoder.int8.onnx',
        size: 262223042,
        sha256: '710ccf890e10f3faa15f51ec346081a2723c9f3adb6e4da81c6573a5a6f877fb'
      },
      {
        name: 'small.en-tokens.txt',
        url: 'https://huggingface.co/csukuangfj/sherpa-onnx-whisper-small.en/resolve/d9533f69affd85061aee349af7fea5cb2996dbbe/small.en-tokens.txt',
        size: 835554,
        sha256: '306cd27f03c1a714eca7108e03d66b7dc042abe8c258b44c199a7ed9838dd930'
      }
    ],
    cliArgs: {
      '--whisper-encoder': 'small.en-encoder.int8.onnx',
      '--whisper-decoder': 'small.en-decoder.int8.onnx',
      '--tokens': 'small.en-tokens.txt'
    }
  },
  {
    id: 'whisper-large-v3',
    name: 'Whisper Large V3',
    type: 'whisper',
    language: 'multi',
    description: 'Best accuracy, supports 90+ languages. Slower, needs more RAM.',
    license: 'MIT',
    sizeBytes: 1775753918,
    files: [
      {
        name: 'large-v3-encoder.int8.onnx',
        url: 'https://huggingface.co/csukuangfj/sherpa-onnx-whisper-large-v3/resolve/2a6507094dd6020d939d78e3f1834a1d06267fca/large-v3-encoder.int8.onnx',
        size: 766671985,
        sha256: 'd531cf17248acc43e8c09b472a0877055e770877857a5332fc1304b36534ec85'
      },
      {
        name: 'large-v3-decoder.int8.onnx',
        url: 'https://huggingface.co/csukuangfj/sherpa-onnx-whisper-large-v3/resolve/2a6507094dd6020d939d78e3f1834a1d06267fca/large-v3-decoder.int8.onnx',
        size: 1008265203,
        sha256: 'ebc6bfd88e162a46cb3edee8a7e727e1dcbc65cabecb19e2573695e4d495e1af'
      },
      {
        name: 'large-v3-tokens.txt',
        url: 'https://huggingface.co/csukuangfj/sherpa-onnx-whisper-large-v3/resolve/2a6507094dd6020d939d78e3f1834a1d06267fca/large-v3-tokens.txt',
        size: 816730,
        sha256: 'b34b360dbb493e781e479794586d661700670d65564001f23024971d1f2fa126'
      }
    ],
    cliArgs: {
      '--whisper-encoder': 'large-v3-encoder.int8.onnx',
      '--whisper-decoder': 'large-v3-decoder.int8.onnx',
      '--tokens': 'large-v3-tokens.txt'
    }
  }
]
