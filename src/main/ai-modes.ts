import { AiMode } from '../shared/types';

export const BUILTIN_MODES: Record<string, AiMode> = {
  raw: {
    id: 'raw',
    name: 'Raw',
    description: 'No processing, paste text as-is',
    systemPrompt: '',
    icon: 'type',
  },
  'grammar-fix': {
    id: 'grammar-fix',
    name: 'Grammar Fix',
    description: 'Fix grammar, spelling, remove filler words',
    systemPrompt:
      'Fix grammar, spelling, and punctuation. Remove filler words (um, uh, like, you know). Keep the original meaning and tone. ALWAYS respond in the same language as the input. Output ONLY the corrected text.',
    icon: 'check',
  },
  'email-pro': {
    id: 'email-pro',
    name: 'Email Pro',
    description: 'Rewrite as professional email',
    systemPrompt:
      'Rewrite as a professional business email. Make it polite, clear, and concise. ALWAYS respond in the same language as the input. Output ONLY the email text.',
    icon: 'mail',
  },
  'code-prompt': {
    id: 'code-prompt',
    name: 'Code Prompt',
    description: 'Format as clear code instruction',
    systemPrompt:
      'Reformat the dictated text as a clear, structured prompt or instruction for a code AI assistant. ALWAYS respond in the same language as the input. Output ONLY the formatted prompt.',
    icon: 'code',
  },
  summary: {
    id: 'summary',
    name: 'Summary',
    description: 'Summarize concisely',
    systemPrompt:
      'Summarize in 2-3 sentences. Maintain key points. ALWAYS respond in the same language as the input. Output ONLY the summary.',
    icon: 'minimize-2',
  },
};

export function getMode(id: string, customModes?: AiMode[]): AiMode | null {
  if (customModes) {
    const custom = customModes.find((mode) => mode.id === id);
    if (custom) {
      return custom;
    }
  }
  return BUILTIN_MODES[id] || null;
}

export function getAllModes(customModes?: AiMode[]): AiMode[] {
  const builtinModes = Object.values(BUILTIN_MODES);
  if (!customModes) {
    return builtinModes;
  }
  return [...builtinModes, ...customModes];
}
