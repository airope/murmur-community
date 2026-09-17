import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const hooks = vi.hoisted(() => ({ effects: [] as Array<() => void | (() => void)> }))
vi.mock('react', () => ({
  useState: (initial: unknown) => [typeof initial === 'function' ? initial() : initial === false ? true : initial, vi.fn()],
  useRef: (current: unknown) => ({ current }),
  useCallback: (callback: unknown) => callback,
  useEffect: (effect: () => void | (() => void)) => { hooks.effects.push(effect) }
}))
// Runtime import keeps renderer JSX outside the composite node TypeScript project.
const overlayModule = '../../renderer/src/components/OverlayPage'
const { default: OverlayPage } = await import(overlayModule)

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => { resolve = r })
  return { promise, resolve }
}
function stream() {
  const tracks = [{ stop: vi.fn() }, { stop: vi.fn() }]
  return { getTracks: () => tracks, tracks }
}
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve() }

describe('overlay microphone lifecycle', () => {
  let startRecording: () => Promise<void>
  let stopRecording: () => Promise<void>
  let getUserMedia: ReturnType<typeof vi.fn>
  let cleanups: Array<() => void>
  let contexts: Array<{ close: ReturnType<typeof vi.fn>; source: { disconnect: ReturnType<typeof vi.fn> }; analyser: { disconnect: ReturnType<typeof vi.fn> } }>
  let recorders: Array<{ stop: () => void }>
  let recorderStarts: ReturnType<typeof vi.fn<() => void>>

  beforeEach(() => {
    hooks.effects = []
    cleanups = []
    contexts = []
    getUserMedia = vi.fn()
    recorderStarts = vi.fn()
    recorders = []
    vi.stubGlobal('React', { createElement: vi.fn() })
    vi.stubGlobal('document', { documentElement: { style: {} }, body: { style: {} }, getElementById: () => null })
    vi.stubGlobal('window', { api: {
      onRecordingStart: (callback: typeof startRecording) => { startRecording = callback },
      onRecordingStop: (callback: typeof stopRecording) => { stopRecording = callback },
      sendAudioData: vi.fn()
    } })
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } })
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1))
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    vi.stubGlobal('AudioContext', class {
      close = vi.fn(async () => {})
      source = { connect: vi.fn(), disconnect: vi.fn() }
      analyser = { disconnect: vi.fn(), frequencyBinCount: 128, getByteFrequencyData: vi.fn() }
      constructor() { contexts.push(this) }
      createMediaStreamSource() { return this.source }
      createAnalyser() { return this.analyser }
    })
    vi.stubGlobal('MediaRecorder', class {
      state = 'inactive'
      onstop?: () => void
      ondataavailable?: (event: { data: Blob }) => void
      constructor() { recorders.push(this) }
      start() { this.state = 'recording'; recorderStarts() }
      stop() {
        this.state = 'inactive'
        queueMicrotask(() => {
          this.ondataavailable?.({ data: new Blob(['local audio']) })
          this.onstop?.()
        })
      }
    })
  })
  afterEach(() => {
    cleanups.reverse().forEach((cleanup) => cleanup())
    vi.unstubAllGlobals()
  })
  function mount() {
    OverlayPage()
    // Event subscription effect, then listening/visibility effect.
    for (const effect of hooks.effects.slice(0, 2)) {
      const cleanup = effect()
      if (cleanup) cleanups.push(cleanup)
    }
  }

  it('cancels a queued restart if another stop arrives before permission resolves', async () => {
    const pending = deferred<ReturnType<typeof stream>>()
    getUserMedia.mockReturnValue(pending.promise)
    mount()
    ;(window as any).hideOverlay()
    const queued = startRecording()
    await stopRecording()
    const media = stream()
    pending.resolve(media)
    await queued
    expect(getUserMedia).toHaveBeenCalledTimes(1)
    media.tracks.forEach((track) => expect(track.stop).toHaveBeenCalledTimes(1))
    expect(recorderStarts).not.toHaveBeenCalled()
  })

  it('can retry after permission rejection', async () => {
    getUserMedia.mockRejectedValueOnce(new Error('permission denied')).mockResolvedValue(stream())
    mount()
    await flush()
    await startRecording()
    expect(getUserMedia).toHaveBeenCalledTimes(2)
    expect(recorderStarts).toHaveBeenCalledTimes(1)
  })

  it('keeps frequency visualization live only while its stream is current', async () => {
    getUserMedia.mockResolvedValue(stream())
    mount()
    await flush()
    const loop = vi.mocked(requestAnimationFrame).mock.calls[0][0]
    loop(0)
    expect(requestAnimationFrame).toHaveBeenCalledTimes(2)
    ;(window as any).hideOverlay()
    loop(0)
    expect(requestAnimationFrame).toHaveBeenCalledTimes(2)
  })

  it('still produces 16kHz mono PCM WAV for local recording', async () => {
    getUserMedia.mockResolvedValue(stream())
    mount()
    await (startRecording as (options: { format: string }) => Promise<void>)({ format: 'wav' })
    const close = vi.fn(async () => {})
    vi.stubGlobal('AudioContext', class {
      close = close
      decodeAudioData = async () => ({ duration: 0.001 })
    })
    vi.stubGlobal('OfflineAudioContext', class {
      destination = {}
      createBufferSource() { return { connect: vi.fn(), start: vi.fn() } }
      startRendering = async () => ({ getChannelData: () => new Float32Array([0, 0.5, -0.5]) })
    })
    await stopRecording()
    const buffer = (window as any).api.sendAudioData.mock.calls[0][0]
    const view = new DataView(buffer)
    expect(new TextDecoder().decode(buffer.slice(0, 4))).toBe('RIFF')
    expect(view.getUint32(24, true)).toBe(16000)
    expect(view.getUint16(22, true)).toBe(1)
    expect(view.getUint16(34, true)).toBe(16)
    expect(close).toHaveBeenCalledTimes(1)
  })

  it('preserves a pending recording start across the visibility effect rerun', async () => {
    const first = deferred<ReturnType<typeof stream>>()
    getUserMedia.mockReturnValueOnce(first.promise).mockResolvedValue(stream())
    mount()
    const recording = startRecording()
    // React cleans up the previous visibility effect before running its next version.
    // This must not retire recording:start that arrived between those two renders.
    const cleanup = hooks.effects[1]()
    if (cleanup) cleanup()
    hooks.effects[1]()
    first.resolve(stream())
    await recording
    await flush()
    expect(recorderStarts).toHaveBeenCalledTimes(1)
    expect(getUserMedia).toHaveBeenCalledTimes(1)
  })

  it('does not create duplicate recorders for concurrent start events', async () => {
    getUserMedia.mockResolvedValue(stream())
    mount()
    await Promise.all([startRecording(), startRecording()])
    expect(recorderStarts).toHaveBeenCalledTimes(1)
  })

  it('delivers final local data if track shutdown stops the recorder before recording:stop', async () => {
    getUserMedia.mockResolvedValue(stream())
    mount()
    await startRecording()
    // Browser MediaRecorder auto-stop on track exhaustion may precede IPC stop.
    recorders[0].stop()
    await flush()
    await stopRecording()
    expect((window as any).api.sendAudioData).toHaveBeenCalledTimes(1)
    const buffer = (window as any).api.sendAudioData.mock.calls[0][0]
    expect(new TextDecoder().decode(buffer)).toBe('local audio')
  })

  it('invalidates pending acquisition immediately on recording:stop', async () => {
    const pending = deferred<ReturnType<typeof stream>>()
    getUserMedia.mockReturnValue(pending.promise)
    mount()
    const recording = startRecording()
    await stopRecording()
    const media = stream()
    pending.resolve(media)
    await recording
    media.tracks.forEach((track) => expect(track.stop).toHaveBeenCalledTimes(1))
    expect(recorderStarts).not.toHaveBeenCalled()
  })

  it('ignores retained IPC callbacks after unmount', async () => {
    getUserMedia.mockResolvedValue(stream())
    mount()
    await flush()
    cleanups.forEach((cleanup) => cleanup())
    await startRecording()
    expect(getUserMedia).toHaveBeenCalledTimes(1)
    expect(recorderStarts).not.toHaveBeenCalled()
  })

  it('cleans up acquired tracks and context if audio graph setup fails', async () => {
    const media = stream()
    getUserMedia.mockResolvedValue(media)
    const close = vi.fn(async () => {})
    vi.stubGlobal('AudioContext', class {
      close = close
      createMediaStreamSource() { throw new Error('audio graph failed') }
    })
    mount()
    await flush()
    media.tracks.forEach((track) => expect(track.stop).toHaveBeenCalledTimes(1))
    expect(close).toHaveBeenCalledTimes(1)
  })

  it('disconnects audio nodes and cancels visualization on stop', async () => {
    getUserMedia.mockResolvedValue(stream())
    mount()
    await flush()
    cleanups.forEach((cleanup) => cleanup())
    expect(contexts[0].source.disconnect).toHaveBeenCalledTimes(1)
    expect(contexts[0].analyser.disconnect).toHaveBeenCalledTimes(1)
    expect(cancelAnimationFrame).toHaveBeenCalled()
  })

  it('serializes a fresh start after stop and never lends its stream to an old recording request', async () => {
    const first = deferred<ReturnType<typeof stream>>()
    const second = deferred<ReturnType<typeof stream>>()
    getUserMedia.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    mount()
    const oldRecording = startRecording()
    // A hide/state change stops capture without retiring the IPC subscriptions.
    ;(window as any).hideOverlay()
    const newRecording = startRecording()
    expect(getUserMedia).toHaveBeenCalledTimes(1)
    const stale = stream()
    first.resolve(stale)
    await flush()
    expect(getUserMedia).toHaveBeenCalledTimes(2)
    stale.tracks.forEach((track) => expect(track.stop).toHaveBeenCalledTimes(1))
    const fresh = stream()
    second.resolve(fresh)
    await Promise.all([oldRecording, newRecording])
    expect(recorderStarts).toHaveBeenCalledTimes(1)
  })

  it('stops a late stream after unmount without starting audio or recording', async () => {
    const pending = deferred<ReturnType<typeof stream>>()
    getUserMedia.mockReturnValue(pending.promise)
    mount()
    const recording = startRecording()
    cleanups.forEach((cleanup) => cleanup())
    const media = stream()
    pending.resolve(media)
    await recording
    await flush()
    media.tracks.forEach((track) => expect(track.stop).toHaveBeenCalledTimes(1))
    expect(contexts).toHaveLength(0)
    expect(recorderStarts).not.toHaveBeenCalled()
  })

  it('coalesces recording-start and visibility acquisition and stops every track', async () => {
    const pending = deferred<ReturnType<typeof stream>>()
    getUserMedia.mockReturnValue(pending.promise)
    mount()
    const recording = startRecording()
    expect(getUserMedia).toHaveBeenCalledTimes(1)
    const media = stream()
    pending.resolve(media)
    await recording
    expect(recorderStarts).toHaveBeenCalledTimes(1)
    cleanups.forEach((cleanup) => cleanup())
    media.tracks.forEach((track) => expect(track.stop).toHaveBeenCalledTimes(1))
    expect(contexts[0].close).toHaveBeenCalledTimes(1)
  })
})
