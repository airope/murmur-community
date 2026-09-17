import { useState, useRef, createContext, useContext, useCallback, type ReactNode } from 'react'
import { Check, Info, AlertTriangle } from 'lucide-react'

type ToastVariant = 'success' | 'error' | 'info'

interface Toast {
  id: number
  message: string
  variant: ToastVariant
}

interface ToastContextType {
  toast: (message: string, variant?: ToastVariant) => void
}

const ToastContext = createContext<ToastContextType>({ toast: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

const ICONS = {
  success: Check,
  error: AlertTriangle,
  info: Info
}

const COLORS = {
  success: 'bg-green-500/15 border-green-500/30 text-green-400',
  error: 'bg-red-500/15 border-red-500/30 text-red-400',
  info: 'bg-primary/15 border-primary/30 text-primary'
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const counterRef = useRef(0)

  const addToast = useCallback((message: string, variant: ToastVariant = 'info') => {
    const id = ++counterRef.current
    setToasts(prev => [...prev, { id, message, variant }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 3000)
  }, [])

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map(t => {
          const Icon = ICONS[t.variant]
          return (
            <div
              key={t.id}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium animate-slide-in ${COLORS[t.variant]}`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {t.message}
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
