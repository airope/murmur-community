import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { Locale, setLocale as setGlobalLocale, getLocale, t as globalT } from './i18n'

interface I18nContextType {
  t: (key: string, params?: Record<string, string | number>) => string
  locale: Locale
  setLocale: (locale: Locale) => void
}

const I18nContext = createContext<I18nContextType>(null!)

export function I18nProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [locale, setLocaleState] = useState<Locale>(getLocale())

  const changeLocale = useCallback((newLocale: Locale) => {
    setGlobalLocale(newLocale)
    setLocaleState(newLocale)
    localStorage.setItem('murmur-locale', newLocale)
    // Also save to settings so main process can read it
    window.api?.setSettings?.({ locale: newLocale }).catch(() => {})
  }, [])

  useEffect(() => {
    const saved = localStorage.getItem('murmur-locale') as Locale | null
    if (saved && (['fr', 'en', 'es', 'de', 'pt'] as string[]).includes(saved)) {
      setGlobalLocale(saved)
      setLocaleState(saved)
    } else {
      // Auto-detect from OS
      (window.api as any)
        .getLocale?.()
        .then((osLocale: string) => {
          const lang = osLocale?.split('-')[0] as Locale
          if (['fr', 'en', 'es', 'de', 'pt'].includes(lang)) {
            changeLocale(lang)
          }
        })
        .catch(() => {})
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const tFn = useCallback(
    (key: string, params?: Record<string, string | number>) => globalT(key, params),
    // re-bind when locale changes so components re-render with new strings
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locale]
  )

  return (
    <I18nContext.Provider value={{ t: tFn, locale, setLocale: changeLocale }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n(): I18nContextType {
  return useContext(I18nContext)
}
