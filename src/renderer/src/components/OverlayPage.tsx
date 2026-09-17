import { useState, useEffect, useRef, useCallback } from 'react'

type OverlayState = 'listening' | 'transcribing' | 'processing' | 'done'

function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const numChannels = 1
  const bitsPerSample = 16
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8)
  const blockAlign = numChannels * (bitsPerSample / 8)
  const dataSize = samples.length * (bitsPerSample / 8)
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)
  const writeStr = (offset: number, str: string): void => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
  }
  writeStr(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitsPerSample, true)
  writeStr(36, 'data')
  view.setUint32(40, dataSize, true)
  let offset = 44
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
    offset += 2
  }
  return buffer
}

const BAR_COUNT = 40

export default function OverlayPage(): React.JSX.Element {
  const [state, setState] = useState<OverlayState>('listening')
  const [visible, setVisible] = useState(false)
  const [freqs, setFreqs] = useState<number[]>(() => Array(BAR_COUNT).fill(0))
  const [tick, setTick] = useState(0)
  const audioRef = useRef<{ stream: MediaStream; dispose: () => void } | null>(null)
  const procRafRef = useRef<number>(0)
  const recorderRef = useRef<{
    recorder: MediaRecorder
    chunks: Blob[]
    format: 'webm' | 'wav'
    stopped: Promise<void>
    generation: number
  } | null>(null)
  const lastFreqsRef = useRef<number[]>(Array(BAR_COUNT).fill(0))
  const transitionStartRef = useRef<number>(0)
  const listeningStartRef = useRef<number>(0)
  const [elapsed, setElapsed] = useState(0)
  const activeStateRef = useRef<OverlayState>('listening')

  const micGenerationRef = useRef(0)
  const micPendingRef = useRef<{ generation: number; promise: Promise<void> } | null>(null)

  const startMic = useCallback((): Promise<void> => {
    if (audioRef.current) return Promise.resolve()
    const generation = micGenerationRef.current
    const previous = micPendingRef.current
    if (previous) {
      if (previous.generation === generation) return previous.promise
      // getUserMedia cannot be cancelled: drain and discard it before reacquiring.
      return previous.promise.then(() => {
        if (generation === micGenerationRef.current) return startMic()
        return undefined
      })
    }
    const pending = (async () => {
      let dispose: (() => void) | undefined
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        let ctx: AudioContext | undefined
        let source: MediaStreamAudioSourceNode | undefined
        let analyser: AnalyserNode | undefined
        let frame = 0
        let disposed = false
        dispose = () => {
          if (disposed) return
          disposed = true
          cancelAnimationFrame(frame)
          // Release each resource independently, even if another cleanup fails.
          for (const track of stream.getTracks()) {
            try { track.stop() } catch { /* continue releasing other tracks */ }
          }
          try { source?.disconnect() } catch { /* already disconnected */ }
          try { analyser?.disconnect() } catch { /* already disconnected */ }
          try { void ctx?.close().catch(() => {}) } catch { /* already closed */ }
        }
        if (generation !== micGenerationRef.current) {
          dispose()
          return
        }
        ctx = new AudioContext()
        source = ctx.createMediaStreamSource(stream)
        analyser = ctx.createAnalyser()
        analyser.fftSize = 256
        analyser.smoothingTimeConstant = 0.7
        source.connect(analyser)
        const activeAnalyser = analyser
        const data = new Uint8Array(activeAnalyser.frequencyBinCount)
        const half = BAR_COUNT / 2
        const loop = (): void => {
          if (disposed || generation !== micGenerationRef.current) return
          activeAnalyser.getByteFrequencyData(data)
          // Mirror frequencies so the seam at 12 o'clock is smooth.
          const raw: number[] = []
          for (let i = 0; i < half; i++) {
            raw.push(data[Math.floor((i / half) * data.length)] / 255)
          }
          const sampled: number[] = []
          for (let i = 0; i < BAR_COUNT; i++) {
            const idx = i < half ? i : BAR_COUNT - 1 - i
            sampled.push(raw[idx])
          }
          lastFreqsRef.current = sampled
          setFreqs(sampled)
          frame = requestAnimationFrame(loop)
        }
        frame = requestAnimationFrame(loop)
        audioRef.current = { stream, dispose }
      } catch {
        // Permission, context construction and partial graph failures all release capture.
        dispose?.()
      }
    })()
    micPendingRef.current = { generation, promise: pending }
    void pending.finally(() => { micPendingRef.current = null })
    return pending
  }, [])

  const stopMic = useCallback(() => {
    micGenerationRef.current++
    const audio = audioRef.current
    audioRef.current = null
    audio?.dispose()
    setFreqs(Array(BAR_COUNT).fill(0))
  }, [])

  useEffect(() => {
    let active = true
    for (const el of [document.documentElement, document.body]) {
      el.style.background = 'transparent'
      el.style.backgroundColor = 'transparent'
      el.style.overflow = 'hidden'
    }
    const root = document.getElementById('root')
    if (root) {
      root.style.background = 'transparent'
      root.style.backgroundColor = 'transparent'
      root.style.overflow = 'hidden'
    }

    ;(window as any).setOverlayState = (newState: OverlayState) => {
      if (!active) return
      if (newState !== 'listening') stopMic()
      activeStateRef.current = newState
      setState(newState)
      setVisible(true)
    }
    ;(window as any).hideOverlay = () => {
      if (!active) return
      stopMic()
      // Don't update activeStateRef — keeps the real state for fade-out rendering
      // (e.g. timer only shows during listening fade-out, not transcribing/processing fade-out)
      setVisible(false)
      setState('listening') // Reset for next use — prevents flash of old state
    }

    // BYOK recording: listen for start/stop from main process
    const api = (window as any).api

    if (api?.onRecordingStart) {
      api.onRecordingStart(async (options?: { format?: string }) => {
        if (!active) return
        const generation = micGenerationRef.current
        const format = options?.format === 'wav' ? 'wav' : 'webm'
        // Ensure mic is running (may arrive before useEffect starts it)
        if (!audioRef.current) {
          await startMic()
        }
        const audio = audioRef.current
        if (!active || !audio || generation !== micGenerationRef.current) return
        if (recorderRef.current?.generation === generation) return
        const previousRecorder = recorderRef.current?.recorder
        if (previousRecorder && previousRecorder.state !== 'inactive') previousRecorder.stop()
        recorderRef.current = null
        try {
          const recorder = new MediaRecorder(audio.stream, { mimeType: 'audio/webm;codecs=opus' })
          const chunks: Blob[] = []
          recorder.ondataavailable = (e: BlobEvent) => {
            if (e.data.size > 0) chunks.push(e.data)
          }
          // Track completion from creation, including automatic stop after tracks end.
          const stopped = new Promise<void>((resolve) => { recorder.onstop = () => resolve() })
          recorder.start()
          recorderRef.current = { recorder, chunks, format, stopped, generation }
        } catch {
          // MediaRecorder not available or format unsupported
        }
      })
    }
    if (api?.onRecordingStop) {
      api.onRecordingStop(async () => {
        if (!active) return
        const session = recorderRef.current
        recorderRef.current = null
        if (session && session.recorder.state !== 'inactive') session.recorder.stop()
        stopMic()
        if (!session) return
        await session.stopped
        if (!active) return
        const blob = new Blob(session.chunks, { type: 'audio/webm' })

        if (session.format === 'wav') {
          // Convert WebM → WAV (16kHz mono 16-bit PCM) for local STT
          let ctx: AudioContext | null = null
          try {
            const webmBuffer = await blob.arrayBuffer()
            ctx = new AudioContext({ sampleRate: 16000 })
            const decoded = await ctx.decodeAudioData(webmBuffer)
            const frames = Math.max(1, Math.round(decoded.duration * 16000))
            // Downmix to mono and resample to 16kHz
            const offline = new OfflineAudioContext(1, frames, 16000)
            const source = offline.createBufferSource()
            source.buffer = decoded
            source.connect(offline.destination)
            source.start()
            const rendered = await offline.startRendering()
            const wavBuffer = encodeWav(rendered.getChannelData(0), 16000)
            api.sendAudioData(wavBuffer)
          } catch (err) {
            console.error('WAV conversion failed:', err)
            // Fallback: send WebM as-is
            api.sendAudioData(await blob.arrayBuffer())
          } finally {
            try { await ctx?.close() } catch { /* ignore */ }
          }
        } else {
          api.sendAudioData(await blob.arrayBuffer())
        }

      })
    }

    // The preload currently has no unsubscribe API. Retire this effect's callbacks
    // explicitly so StrictMode replay/unmount cannot restart capture through old listeners.
    return () => {
      active = false
      stopMic()
      const recorder = recorderRef.current?.recorder
      recorderRef.current = null
      if (recorder && recorder.state !== 'inactive') recorder.stop()
    }
  }, [startMic, stopMic])

  // Mic for listening
  useEffect(() => {
    if (state === 'listening' && visible) startMic()
    else stopMic()
    // Unmount cleanup belongs to the subscription effect above. A dependency
    // cleanup here would cancel recording:start arriving just before visibility changes.
  }, [state, visible, startMic, stopMic])

  // Timer for listening mode
  useEffect(() => {
    if (state === 'listening' && visible) {
      listeningStartRef.current = Date.now()
      setElapsed(0)
      const iv = setInterval(() => {
        setElapsed(Date.now() - listeningStartRef.current)
      }, 1000)
      return () => clearInterval(iv)
    }
    setElapsed(0)
    return undefined
  }, [state, visible])

  // Capture transition start when entering transcribing
  useEffect(() => {
    if (state === 'transcribing') {
      transitionStartRef.current = performance.now()
    }
  }, [state])

  // Animation tick for transcribing and processing states (spinning wave)
  useEffect(() => {
    if (state !== 'transcribing' && state !== 'processing') return
    const loop = (): void => {
      setTick(performance.now())
      procRafRef.current = requestAnimationFrame(loop)
    }
    procRafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(procRafRef.current)
  }, [state])

  const isTranscribing = state === 'transcribing'
  const isProcessing = state === 'processing'
  const isSpinning = isTranscribing || isProcessing

  const totalSec = Math.floor(elapsed / 1000)
  const mm = String(Math.floor(totalSec / 60)).padStart(2, '0')
  const ss = String(totalSec % 60).padStart(2, '0')

  const orangeCol = { r: 190, g: 85, b: 20 }
  const blueCol = { r: 100, g: 120, b: 220 }

  const TRANSITION_MS = 300
  const SIZE = 100

  // Smoothstep easing: 0→1
  const smoothstep = (x: number): number => {
    const c = Math.max(0, Math.min(1, x))
    return c * c * (3 - 2 * c)
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: 'transparent',
        opacity: visible ? 1 : 0,
        transform: visible ? 'scale(1)' : 'scale(0.3)',
        transition: visible
          ? 'opacity 0.35s cubic-bezier(0.34,1.56,0.64,1), transform 0.35s cubic-bezier(0.34,1.56,0.64,1)'
          : 'opacity 0.3s ease-in, transform 0.3s ease-in',
      }}
    >
      <svg width={SIZE} height={SIZE} viewBox="0 0 100 100">
{Array.from({ length: BAR_COUNT }).map((_, i) => {
          const angle = (i / BAR_COUNT) * Math.PI * 2 - Math.PI / 2
          const val = freqs[i] || 0
          const cos = Math.cos(angle)
          const sin = Math.sin(angle)

          let innerR: number, barLen: number, alpha: number
          const t = tick / 300
          const p = (i / BAR_COUNT) * Math.PI * 2

          // Wave target values (used by transcribing & processing)
          const wave =
            Math.sin(t + p * 3) * 0.3 +
            Math.sin(t * 1.7 + p * 7) * 0.15 +
            Math.sin(t * 0.6 + p * 5) * 0.1 +
            0.5
          const waveInnerR = 28
          let waveBarLen = 5 + wave * 12

          if (isProcessing) {
            // Extra micro-waves layered on top for post-process
            const micro =
              Math.sin(t * 3.2 + p * 11) * 0.08 +
              Math.sin(t * 4.5 + p * 17) * 0.06
            waveBarLen += micro * 10
          }

          if (isTranscribing) {
            // Blend from equalizer snapshot → spinning wave
            const elapsed = tick - transitionStartRef.current
            const blend = smoothstep(elapsed / TRANSITION_MS)

            const eqVal = lastFreqsRef.current[i] || 0
            const eqInnerR = 26
            const eqBarLen = 3 + eqVal * 20

            innerR = eqInnerR + (waveInnerR - eqInnerR) * blend
            barLen = eqBarLen + (waveBarLen - eqBarLen) * blend
            alpha = 1
          } else if (isProcessing) {
            innerR = waveInnerR
            barLen = waveBarLen
            alpha = 1
          } else {
            // Listening: equalizer reacting to mic audio
            innerR = 26
            barLen = 3 + val * 20
            alpha = 1
          }

          // Orange for listening + transcribing, blue for processing
          const c = isProcessing ? blueCol : orangeCol

          return (
            <line
              key={i}
              x1={50 + cos * innerR}
              y1={50 + sin * innerR}
              x2={50 + cos * (innerR + barLen)}
              y2={50 + sin * (innerR + barLen)}
              stroke={`rgba(${c.r},${c.g},${c.b},${alpha})`}
              strokeWidth={2.2}
              strokeLinecap="round"
              style={{
                filter: val > 0.4 || isSpinning ? `drop-shadow(0 0 3px rgba(${c.r},${c.g},${c.b},0.5))` : 'none',
              }}
            />
          )
        })}
        {activeStateRef.current === 'listening' && (
          <text
            x="50"
            y="50"
            textAnchor="middle"
            dominantBaseline="central"
            fill={`rgba(${orangeCol.r},${orangeCol.g},${orangeCol.b},1)`}
            fontSize="11"
            fontFamily="monospace"
            fontWeight="bold"
          >
            {mm}:{ss}
          </text>
        )}
      </svg>
    </div>
  )
}
