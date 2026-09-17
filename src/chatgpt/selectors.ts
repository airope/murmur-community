export const SELECTORS = {
  // Chat input textarea - indicates page is ready
  chatInput: 'textarea[id="prompt-textarea"], div[id="prompt-textarea"], #prompt-textarea',

  // Voice/dictation button in the composer area (CSS class-based selector is language-independent)
  voiceButton: [
    'button.composer-btn.min-h-9.min-w-9:not([data-testid])',
    'button[aria-label*="dictée"]',
    'button[aria-label*="Dictée"]',
    'button[aria-label*="dictation"]',
    'button[aria-label*="Dictation"]',
    'button[aria-label*="Dictate"]',
    'button[aria-label*="dictate"]',
    'button[aria-label*="Dicter"]',
    'button[aria-label*="dicter"]',
    'button[aria-label*="Voice"]',
    'button[aria-label*="voice"]',
    'button[data-testid*="voice"]',
    'button[data-testid*="dictation"]',
    'button[aria-label*="micro"]',
    'button[aria-label*="Micro"]',
    'button[aria-label*="Speak"]',
    'button[aria-label*="speak"]',
    'button[aria-label*="Voix"]',
    'button[aria-label*="Audio"]',
    'button[aria-label*="audio"]',
    'button[aria-label*="Record"]',
    'button[aria-label*="record"]'
  ].join(', '),

  // Submit dictation button (validates recording and triggers transcription)
  submitDictationButton: [
    'button[aria-label*="Soumettre la dict"]',
    'button[aria-label*="Soumettre"]',
    'button[aria-label*="Submit dict"]',
    'button[aria-label*="Submit"]',
    'button[aria-label*="submit"]',
    'button[aria-label*="Send"]',
    'button[aria-label*="send"]',
    'button[aria-label*="Envoyer"]'
  ].join(', '),

  // Cancel/stop dictation button
  cancelDictationButton: [
    'button[aria-label*="Arr"]',
    'button[aria-label*="Stop"]',
    'button[aria-label*="stop"]',
    'button[data-testid*="stop"]'
  ].join(', '),

  // The area where transcribed text appears (last assistant message)
  transcriptionArea: '[data-message-author-role="assistant"]:last-child .markdown',

  // Alternative: the user message that was sent (transcribed input)
  userMessage: '[data-message-author-role="user"]:last-child',

  // Login page indicator
  loginPage: 'button[data-testid="login-button"], a[href*="auth"]',

  // Navigation/sidebar (indicates logged in)
  sidebar: 'nav[aria-label]'
} as const
