import { Minus, Square, X } from 'lucide-react'

export function WindowControls() {
  return (
    <div className="flex items-center gap-1 no-drag">
      <button
        onClick={() => (window as any).api.windowMinimize()}
        className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:bg-white/10 hover:text-white/70 transition-colors"
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => (window as any).api.windowMaximize()}
        className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:bg-white/10 hover:text-white/70 transition-colors"
      >
        <Square className="h-3 w-3" />
      </button>
      <button
        onClick={() => (window as any).api.windowClose()}
        className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:bg-red-500/30 hover:text-red-400 transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
