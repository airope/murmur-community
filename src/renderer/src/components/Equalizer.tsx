import { useState, useEffect, useRef } from 'react'

const BAR_COUNT = 40
const TARGET_FPS = 15
const FRAME_INTERVAL = 1000 / TARGET_FPS

export function Equalizer({ className = '' }: { className?: string }) {
  const [bars, setBars] = useState(() =>
    Array.from({ length: BAR_COUNT }, () => ({ len: 5, alpha: 0.5 }))
  )
  const lastFrameRef = useRef(0)

  useEffect(() => {
    let raf: number
    const animate = (now: number) => {
      raf = requestAnimationFrame(animate)
      if (now - lastFrameRef.current < FRAME_INTERVAL) return
      lastFrameRef.current = now

      const t = now / 600
      const next = Array.from({ length: BAR_COUNT }, (_, i) => {
        const p = (i / BAR_COUNT) * Math.PI * 2
        const wave =
          Math.sin(t + p * 3) * 0.3 +
          Math.sin(t * 1.7 + p * 7) * 0.15 +
          Math.sin(t * 0.6 + p * 5) * 0.1 +
          0.5
        return {
          len: 5 + wave * 12,
          alpha: 0.5 + wave * 0.4,
        }
      })
      setBars(next)
    }
    raf = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(raf)
  }, [])

  const INNER_R = 28
  return (
    <svg viewBox="0 0 100 100" className={className}>
      {bars.map((bar, i) => {
        const angle = (i / BAR_COUNT) * Math.PI * 2 - Math.PI / 2
        const cos = Math.cos(angle)
        const sin = Math.sin(angle)
        const cx = 50, cy = 50
        return (
          <line
            key={i}
            x1={cx + cos * INNER_R}
            y1={cy + sin * INNER_R}
            x2={cx + cos * (INNER_R + bar.len)}
            y2={cy + sin * (INNER_R + bar.len)}
            stroke={`rgba(190,85,20,${bar.alpha})`}
            strokeWidth={2.2}
            strokeLinecap="round"
            style={{ filter: 'drop-shadow(0 0 3px rgba(190,85,20,0.5))' }}
          />
        )
      })}
    </svg>
  )
}
