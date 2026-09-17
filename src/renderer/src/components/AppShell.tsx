import { useState, useEffect, useRef } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import { Equalizer } from './Equalizer'
import { WindowControls } from './WindowControls'
import { ToastProvider } from '@renderer/components/ui/toast'

export default function AppShell(): React.JSX.Element {
  // Show warning banner if hotkey failed to register (e.g. Ctrl+Space taken by macOS)
  const [hotkeyFailedKey, setHotkeyFailedKey] = useState<string | null>(null)
  const hotkeyFailedListened = useRef(false)
  useEffect(() => {
    if (hotkeyFailedListened.current) return
    hotkeyFailedListened.current = true
    window.api.onHotkeyRegistrationFailed?.((key) => setHotkeyFailedKey(key))
  }, [])

  return (
    <ToastProvider>
      <div className="h-screen overflow-hidden bg-gradient-to-br from-orange-800/80 via-orange-950/80 to-black/80 animated-gradient relative rounded-2xl">
        {/* Frosted overlay */}
        <div className="absolute inset-0 bg-black/25 backdrop-blur-md rounded-2xl pointer-events-none z-0" />

        {/* Titlebar: drag region + window controls */}
        <div className="drag-region h-10 shrink-0 flex items-center justify-end px-2">
          <WindowControls />
        </div>

        <div className="relative z-20">
          {hotkeyFailedKey && (
            <div className="mx-3 mt-1 px-3 py-2 rounded-lg bg-destructive/20 border border-destructive/40 text-destructive text-xs flex items-center justify-between gap-2">
              <span>⚠️ Shortcut <kbd className="font-mono bg-black/30 px-1 rounded">{hotkeyFailedKey}</kbd> couldn't be registered — possibly used by another application. Change it in Settings.</span>
              <button onClick={() => setHotkeyFailedKey(null)} className="shrink-0 opacity-60 hover:opacity-100">✕</button>
            </div>
          )}
        </div>

        <div className="flex flex-1 overflow-hidden relative z-10" style={{ height: 'calc(100vh - 40px)' }}>
          <Sidebar />
          <main className="flex-1 overflow-y-auto scrollbar-thin">
            <Outlet />
          </main>
        </div>

        {/* Decorative equalizer glow — bottom-right corner */}
        <div className="absolute bottom-[-250px] right-[-250px] opacity-80 pointer-events-none">
          <Equalizer className="w-[600px] h-[600px]" />
        </div>

      </div>
    </ToastProvider>
  )
}
