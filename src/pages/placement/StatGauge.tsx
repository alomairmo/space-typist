import { useEffect, useRef, useState } from 'react'
import { animate } from 'framer-motion'
import { useSettings } from '@/context/SettingsContext'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import { audio } from '@/lib/audio'

export interface StatGaugeProps {
  label: string
  /** القيمة النهائية المعروضة */
  value: number
  /** الحد الأقصى لامتلاء القوس */
  max: number
  /** لاحقة الوحدة (ك/د، ٪ ...) */
  suffix?: string
  /** تأخير بدء الحركة (تتابع 150ms) */
  delay?: number
  /** لون القوس */
  color?: string
  size?: number
  className?: string
}

/** مقياس دائري متحرك — يمتلئ القوس من 0 إلى القيمة خلال 900ms مع عدّاد رقمي Orbitron ونغمات عد */
export default function StatGauge({
  label,
  value,
  max,
  suffix = '',
  delay = 0,
  color = '#22D3EE',
  size = 92,
  className,
}: StatGaugeProps) {
  const { settings } = useSettings()
  const [ratio, setRatio] = useState(0)
  const [display, setDisplay] = useState(0)
  const ticksRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const controls = animate(0, 1, {
      duration: 0.9,
      delay,
      ease: 'easeOut',
      onUpdate: (t) => {
        setRatio(t)
        setDisplay(value * t)
      },
    })
    // نغمات العد أثناء الامتلاء
    const startTicks = window.setTimeout(() => {
      ticksRef.current = setInterval(() => audio.play('timerTick'), 180)
    }, delay * 1000)
    const stopTicks = window.setTimeout(
      () => ticksRef.current && clearInterval(ticksRef.current),
      delay * 1000 + 900,
    )
    return () => {
      controls.stop()
      window.clearTimeout(startTicks)
      window.clearTimeout(stopTicks)
      if (ticksRef.current) clearInterval(ticksRef.current)
    }
  }, [value, delay])

  const stroke = Math.max(6, size * 0.1)
  const r = (size - stroke) / 2 - 2
  const c = 2 * Math.PI * r
  const center = size / 2
  const fill = Math.min(1, max > 0 ? ratio * (value / max) : 0)

  return (
    <div className={cn('flex flex-col items-center gap-1', className)}>
      <div className="relative inline-flex items-center justify-center">
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={center} cy={center} r={r} fill="none" stroke="#1A2444" strokeWidth={stroke} />
          <circle
            cx={center}
            cy={center}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${fill * c} ${c}`}
            style={{ filter: `drop-shadow(0 0 6px ${color})` }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-hud text-lg font-bold text-ink-100" dir="ltr">
            {formatNumber(Math.round(display), settings.numerals)}
          </span>
          {suffix && <span className="text-[11px] font-bold text-ink-400">{suffix}</span>}
        </div>
      </div>
      <span className="text-sm font-bold text-ink-400">{label}</span>
    </div>
  )
}
