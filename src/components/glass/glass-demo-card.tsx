'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Flashlight,
  Droplets,
  Music,
  Play,
  SkipBack,
  SkipForward,
  Sun,
  Wifi,
  BatteryFull,
  Volume2,
  Bluetooth,
  Airplay,
} from 'lucide-react'
import { LiquidGlass } from '@/components/glass/liquid-glass'
import type { GlassConfig } from '@/lib/glass/presets'

interface DemoCardProps {
  config: GlassConfig
  dark?: boolean
}

/**
 * The floating glass demo card — a mini iOS-style control center with a
 * live clock, quick toggles, a slider and a music player strip.
 */
export function GlassDemoCard({ config, dark }: DemoCardProps) {
  const [now, setNow] = useState<Date | null>(null)
  const [toggles, setToggles] = useState({
    wifi: true,
    bt: true,
    air: false,
    torch: false,
  })
  const [volume, setVolume] = useState(64)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    const raf = requestAnimationFrame(() => setNow(new Date()))
    return () => {
      clearInterval(t)
      cancelAnimationFrame(raf)
    }
  }, [])

  const text = dark ? 'text-white' : 'text-foreground'
  const subText = dark ? 'text-white/70' : 'text-muted-foreground'

  const flip = useCallback(
    (key: keyof typeof toggles) =>
      setToggles(s => ({ ...s, [key]: !s[key] })),
    []
  )

  const timeStr = useMemo(
    () =>
      now
        ? now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
        : '--:--',
    [now]
  )
  const dateStr = useMemo(
    () =>
      now
        ? now.toLocaleDateString('zh-CN', {
            month: 'long',
            day: 'numeric',
            weekday: 'long',
          })
        : '',
    [now]
  )

  return (
    <LiquidGlass config={config} interactive className="w-[320px] max-w-full select-none">
      <div className={`flex h-full flex-col gap-4 p-5 ${text}`} data-testid="glass-demo-card">
        {/* Clock */}
        <div className="flex items-start justify-between">
          <div>
            <div className="text-4xl font-semibold tracking-tight tabular-nums" suppressHydrationWarning>
              {timeStr}
            </div>
            <div className={`mt-1 text-xs ${subText}`} suppressHydrationWarning>
              {dateStr}
            </div>
          </div>
          <div className={`flex items-center gap-1.5 text-xs ${subText}`}>
            <Sun className="h-3.5 w-3.5" />
            <span>22°</span>
          </div>
        </div>

        {/* Quick toggles */}
        <div className="grid grid-cols-4 gap-2">
          {(
            [
              { key: 'wifi', icon: Wifi, label: 'Wi-Fi' },
              { key: 'bt', icon: Bluetooth, label: '蓝牙' },
              { key: 'air', icon: Airplay, label: '投送' },
              { key: 'torch', icon: Flashlight, label: '手电' },
            ] as const
          ).map(({ key, icon: Icon, label }) => {
            const on = toggles[key]
            return (
              <button
                key={key}
                onClick={() => flip(key)}
                aria-pressed={on}
                className={`flex min-h-[44px] flex-col items-center justify-center gap-1 rounded-xl border text-[10px] transition-all active:scale-95 ${
                  on
                    ? 'border-white/25 bg-white/20 shadow-sm'
                    : 'border-white/10 bg-white/5 opacity-60'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </button>
            )
          })}
        </div>

        {/* Volume slider */}
        <div className="flex items-center gap-3">
          <Volume2 className="h-4 w-4 shrink-0 opacity-80" />
          <input
            type="range"
            min={0}
            max={100}
            value={volume}
            onChange={e => setVolume(Number(e.target.value))}
            aria-label="音量"
            className="glass-range flex-1"
          />
          <span className="w-7 text-right text-xs tabular-nums opacity-80">{volume}</span>
        </div>

        {/* Music strip */}
        <div className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 px-3 py-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-300 to-rose-400 shadow-inner">
            <Music className="h-4 w-4 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-medium">Liquid Glass Dreams</div>
            <div className={`truncate text-[10px] ${subText}`}>Kyant0 · Refraction EP</div>
          </div>
          <SkipBack className="h-4 w-4 opacity-70" aria-hidden />
          <button
            onClick={() => setPlaying(p => !p)}
            aria-label={playing ? '暂停' : '播放'}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/25 transition-transform active:scale-90"
          >
            {playing ? (
              <span className="flex gap-[3px]" aria-hidden>
                <span className="h-3 w-[3px] rounded-sm bg-current" />
                <span className="h-3 w-[3px] rounded-sm bg-current" />
              </span>
            ) : (
              <Play className="h-4 w-4 pl-[1px]" aria-hidden />
            )}
          </button>
          <SkipForward className="h-4 w-4 opacity-70" aria-hidden />
        </div>

        {/* Status row */}
        <div className={`flex items-center justify-between text-[10px] ${subText}`}>
          <span className="flex items-center gap-1">
            <Droplets className="h-3 w-3" /> 62%
          </span>
          <span className="flex items-center gap-1">
            <BatteryFull className="h-3.5 w-3.5" /> 86%
          </span>
        </div>
      </div>
    </LiquidGlass>
  )
}

/** Small pill widget floating on the stage. */
export function GlassPill({
  config,
  label,
  dark,
}: {
  config: GlassConfig
  label: string
  /** use light text on dark-ish stage backgrounds */
  dark?: boolean
}) {
  return (
    <LiquidGlass config={config} interactive className="select-none">
      <div
        className={`flex items-center gap-2 px-4 py-2 text-xs font-medium ${
          dark ? 'text-white' : 'text-foreground'
        }`}
      >
        <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
        {label}
      </div>
    </LiquidGlass>
  )
}
