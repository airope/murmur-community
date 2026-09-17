export type Locale = 'fr' | 'en' | 'es' | 'de' | 'pt'
export const SUPPORTED_LOCALES: Locale[] = ['fr', 'en', 'es', 'de', 'pt']
export const LOCALE_LABELS: Record<Locale, string> = {
  fr: 'Francais',
  en: 'English',
  es: 'Espanol',
  de: 'Deutsch',
  pt: 'Portugues'
}

import fr from './translations/fr.json'
import en from './translations/en.json'
import es from './translations/es.json'
import de from './translations/de.json'
import pt from './translations/pt.json'

const translations: Record<Locale, Record<string, any>> = { fr, en, es, de, pt }
let currentLocale: Locale = 'en'

export function setLocale(locale: Locale): void {
  currentLocale = locale
}

export function getLocale(): Locale {
  return currentLocale
}

export function t(key: string, params?: Record<string, string | number>): string {
  const keys = key.split('.')
  let value: any = translations[currentLocale]
  for (const k of keys) {
    value = value?.[k]
  }
  if (typeof value !== 'string') {
    // Fallback to French
    value = translations.fr
    for (const k of keys) {
      value = value?.[k]
    }
  }
  if (typeof value !== 'string') return key
  if (params) {
    return value.replace(/\{\{(\w+)\}\}/g, (_, name) => String(params[name] ?? ''))
  }
  return value
}
