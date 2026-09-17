import { useState, useEffect, useRef, useCallback } from 'react'
import { Volume2, Mic } from 'lucide-react'
import { Switch } from '@renderer/components/ui/switch'
import { Card, CardContent } from '@renderer/components/ui/card'
import { useSettings } from '@renderer/hooks/useIPC'
import { useI18n } from '@renderer/i18n/I18nProvider'
import SettingSection from './SettingSection'
import SettingRow from './SettingRow'

interface AudioDevice {
  deviceId: string
  label: string
}

export default function SoundPage(): React.JSX.Element {
  const { settings, updateSettings } = useSettings()
  const { t } = useI18n()
  const [devices, setDevices] = useState<AudioDevice[]>([])
  const [selectedDevice, setSelectedDevice] = useState<string>('')
  const [micLevel, setMicLevel] = useState(0)
  const audioRef = useRef<{ ctx: AudioContext; analyser: AnalyserNode; stream: MediaStream } | null>(null)
  const rafRef = useRef<number>(0)

  // Load audio devices
  useEffect(() => {
    window.api.getDevices().then((devs: any) => {
      setDevices(devs || [])
      if (devs?.length > 0 && !selectedDevice) {
        setSelectedDevice(devs[0].deviceId)
      }
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Mic level monitor
  const startMonitor = useCallback(async () => {
    try {
      const constraints: MediaStreamConstraints = {
        audio: selectedDevice ? { deviceId: { exact: selectedDevice } } : true
      }
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      const ctx = new AudioContext()
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.8
      source.connect(analyser)
      audioRef.current = { ctx, analyser, stream }

      const data = new Uint8Array(analyser.frequencyBinCount)
      const loop = (): void => {
        analyser.getByteFrequencyData(data)
        const avg = data.reduce((a, b) => a + b, 0) / data.length / 255
        setMicLevel(avg)
        rafRef.current = requestAnimationFrame(loop)
      }
      rafRef.current = requestAnimationFrame(loop)
    } catch {
      // Mic unavailable
    }
  }, [selectedDevice])

  const stopMonitor = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    if (audioRef.current) {
      audioRef.current.stream.getTracks().forEach(track => track.stop())
      audioRef.current.ctx.close()
      audioRef.current = null
    }
    setMicLevel(0)
  }, [])

  useEffect(() => {
    startMonitor()
    return () => stopMonitor()
  }, [startMonitor, stopMonitor])

  const handleDeviceChange = (deviceId: string) => {
    setSelectedDevice(deviceId)
    stopMonitor()
  }

  return (
    <div className="p-6 space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{t('sound.title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('sound.subtitle')}</p>
      </div>

      <SettingSection title={t('sound.soundEffects')}>
        <SettingRow label={t('sound.dictationSounds')} description={t('sound.dictationSoundsDesc')}>
          <Switch
            checked={settings.soundEnabled !== false}
            onCheckedChange={(checked) => updateSettings({ soundEnabled: checked })}
          />
        </SettingRow>
      </SettingSection>

      <SettingSection title={t('sound.microphone')}>
        <Card className="bg-card border-border">
          <CardContent className="p-4 space-y-4">
            {/* Device selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground flex items-center gap-2">
                <Mic className="h-4 w-4 text-primary" />
                {t('sound.inputDevice')}
              </label>
              <select
                value={selectedDevice}
                onChange={(e) => handleDeviceChange(e.target.value)}
                className="w-full h-9 rounded-md border border-border bg-secondary px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {devices.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Microphone ${d.deviceId.slice(0, 8)}`}
                  </option>
                ))}
                {devices.length === 0 && (
                  <option disabled>{t('sound.noMicDetected')}</option>
                )}
              </select>
            </div>

            {/* Volume level */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground flex items-center gap-2">
                <Volume2 className="h-4 w-4 text-primary" />
                {t('sound.inputLevel')}
              </label>
              <div className="h-2 rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-75"
                  style={{
                    width: `${Math.min(100, micLevel * 300)}%`,
                    backgroundColor: micLevel > 0.3 ? 'hsl(24, 81%, 41%)' : 'hsl(var(--muted-foreground))'
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {micLevel > 0.05 ? t('sound.signalDetected') : t('sound.speakToTest')}
              </p>
            </div>
          </CardContent>
        </Card>
      </SettingSection>
    </div>
  )
}
