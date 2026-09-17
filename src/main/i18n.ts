import { app } from 'electron'

type Locale = 'fr' | 'en' | 'es' | 'de' | 'pt'
const SUPPORTED: readonly string[] = ['fr', 'en', 'es', 'de', 'pt']

function isValidLocale(value: unknown): value is Locale {
  return typeof value === 'string' && SUPPORTED.includes(value)
}

const translations: Record<Locale, Record<string, string>> = {
  fr: {
    'tray.open': 'Ouvrir Murmur',
    'tray.startDictation': 'Démarrer la dictée',
    'tray.history': 'Historique',
    'tray.settings': 'Paramètres',
    'tray.quit': 'Quitter',
    'notifications.timeout': 'La transcription a pris trop de temps. Réessayez.',
    'notifications.sessionExpired': 'Session ChatGPT expirée. Reconnectez-vous dans la fenêtre qui s\'ouvre.',
    'notifications.micOccupied': 'Le microphone est utilisé par une autre application.',
    'notifications.cloudflareBlock': 'ChatGPT est temporairement inaccessible.',
    'notifications.emptyTranscription': 'Aucun texte détecté.',
    'notifications.genericError': 'Erreur: ',
    'notifications.demoVoiceNotFound': 'Bouton vocal introuvable. Vérifiez que ChatGPT est chargé dans la fenêtre.',
    'notifications.demoError': 'Erreur lors de la dictée.',
    'window.settings': 'Murmur - Paramètres',
    'window.history': 'Murmur - Historique',
    'window.welcome': 'Murmur - Bienvenue'
  },
  en: {
    'tray.open': 'Open Murmur',
    'tray.startDictation': 'Start dictation',
    'tray.history': 'History',
    'tray.settings': 'Settings',
    'tray.quit': 'Quit',
    'notifications.timeout': 'Transcription took too long. Try again.',
    'notifications.sessionExpired': 'ChatGPT session expired. Please reconnect in the window that opens.',
    'notifications.micOccupied': 'The microphone is being used by another application.',
    'notifications.cloudflareBlock': 'ChatGPT is temporarily unavailable.',
    'notifications.emptyTranscription': 'No text detected.',
    'notifications.genericError': 'Error: ',
    'notifications.demoVoiceNotFound': 'Voice button not found. Make sure ChatGPT is loaded in the window.',
    'notifications.demoError': 'Error during dictation.',
    'window.settings': 'Murmur - Settings',
    'window.history': 'Murmur - History',
    'window.welcome': 'Murmur - Welcome'
  },
  es: {
    'tray.open': 'Abrir Murmur',
    'tray.startDictation': 'Iniciar dictado',
    'tray.history': 'Historial',
    'tray.settings': 'Configuración',
    'tray.quit': 'Salir',
    'notifications.timeout': 'La transcripción tardó demasiado. Inténtalo de nuevo.',
    'notifications.sessionExpired': 'Sesión de ChatGPT expirada. Reconéctate en la ventana que se abre.',
    'notifications.micOccupied': 'El micrófono está siendo usado por otra aplicación.',
    'notifications.cloudflareBlock': 'ChatGPT está temporalmente inaccesible.',
    'notifications.emptyTranscription': 'No se detectó texto.',
    'notifications.genericError': 'Error: ',
    'notifications.demoVoiceNotFound': 'Botón de voz no encontrado. Verifica que ChatGPT esté cargado en la ventana.',
    'notifications.demoError': 'Error durante el dictado.',
    'window.settings': 'Murmur - Configuración',
    'window.history': 'Murmur - Historial',
    'window.welcome': 'Murmur - Bienvenido'
  },
  de: {
    'tray.open': 'Murmur öffnen',
    'tray.startDictation': 'Diktat starten',
    'tray.history': 'Verlauf',
    'tray.settings': 'Einstellungen',
    'tray.quit': 'Beenden',
    'notifications.timeout': 'Die Transkription hat zu lange gedauert. Versuchen Sie es erneut.',
    'notifications.sessionExpired': 'ChatGPT-Sitzung abgelaufen. Bitte im geöffneten Fenster erneut verbinden.',
    'notifications.micOccupied': 'Das Mikrofon wird von einer anderen Anwendung verwendet.',
    'notifications.cloudflareBlock': 'ChatGPT ist vorübergehend nicht erreichbar.',
    'notifications.emptyTranscription': 'Kein Text erkannt.',
    'notifications.genericError': 'Fehler: ',
    'notifications.demoVoiceNotFound': 'Sprachtaste nicht gefunden. Stellen Sie sicher, dass ChatGPT im Fenster geladen ist.',
    'notifications.demoError': 'Fehler beim Diktat.',
    'window.settings': 'Murmur - Einstellungen',
    'window.history': 'Murmur - Verlauf',
    'window.welcome': 'Murmur - Willkommen'
  },
  pt: {
    'tray.open': 'Abrir Murmur',
    'tray.startDictation': 'Iniciar ditado',
    'tray.history': 'Histórico',
    'tray.settings': 'Configurações',
    'tray.quit': 'Sair',
    'notifications.timeout': 'A transcrição demorou muito. Tente novamente.',
    'notifications.sessionExpired': 'Sessão do ChatGPT expirada. Reconecte-se na janela que se abre.',
    'notifications.micOccupied': 'O microfone está sendo usado por outro aplicativo.',
    'notifications.cloudflareBlock': 'O ChatGPT está temporariamente inacessível.',
    'notifications.emptyTranscription': 'Nenhum texto detectado.',
    'notifications.genericError': 'Erro: ',
    'notifications.demoVoiceNotFound': 'Botão de voz não encontrado. Verifique se o ChatGPT está carregado na janela.',
    'notifications.demoError': 'Erro durante o ditado.',
    'window.settings': 'Murmur - Configurações',
    'window.history': 'Murmur - Histórico',
    'window.welcome': 'Murmur - Bem-vindo'
  }
}

let currentLocale: Locale = 'en'

export function initMainI18n(storedLocale?: string): void {
  // Priority: stored user preference > OS locale > French default
  if (isValidLocale(storedLocale)) {
    currentLocale = storedLocale
  } else {
    const osLocale = app.getLocale().split('-')[0]
    if (isValidLocale(osLocale)) {
      currentLocale = osLocale
    }
  }
}

export function setMainLocale(locale: string): void {
  if (isValidLocale(locale)) {
    currentLocale = locale
  }
}

export function mt(key: string): string {
  return translations[currentLocale]?.[key] || translations.fr[key] || key
}
