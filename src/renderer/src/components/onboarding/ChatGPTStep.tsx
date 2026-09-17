import { useState, useEffect } from 'react'
import { Button } from '@renderer/components/ui/button'
import { useI18n } from '@renderer/i18n/I18nProvider'

// Mounted only after the user explicitly selects the experimental provider.
export default function ChatGPTStep(): React.JSX.Element {
  const [connected, setConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState('')
  const { t } = useI18n()

  useEffect(() => {
    if (!connecting) return
    const timer = setInterval(async () => {
      try {
        if (await window.api.checkChatGPTSession()) {
          setConnected(true)
          setConnecting(false)
          await window.api.hideChatGPT()
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : t('errors.verifyError'))
        setConnecting(false)
      }
    }, 3000)
    return () => clearInterval(timer)
  }, [connecting, t])

  const connect = async () => {
    setError('')
    try {
      await window.api.loginChatGPT()
      setConnecting(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.loginError'))
    }
  }

  return (
    <div className="text-center space-y-4 rounded-lg border border-border p-4">
      <h2 className="text-lg font-semibold">{t('community.experimentalChatgpt')}</h2>
      <p className="text-sm text-muted-foreground">{t('community.chatgptWarning')}</p>
      {connected ? <p className="text-sm text-green-500">{t('onboarding.chatgpt.connected')}</p> : (
        <Button onClick={connect} disabled={connecting}>{t('onboarding.chatgpt.open')}</Button>
      )}
      {connecting && <p className="text-xs text-muted-foreground">{t('onboarding.chatgpt.checking')}</p>}
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
