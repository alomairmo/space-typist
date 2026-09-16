import { cn } from '@/lib/utils'
import { formatNumber } from '@/lib/format'
import { useSettings } from '@/context/SettingsContext'

export interface ClockGaugeProps {
  /** الثواني المتبقية */
  remaining: number
  /** إجمالي الثواني */
  total: number
  label: string
  size?: number
  className?: string
}

/**
 * عداد دائري — القوس المتبقي أخضر good-glow، المنقضي أحمر bad-600
 * (الوقت المتبقي أخضر والذي ذهب أحمر). تحذير كهرماني <30٪ ونبض أحمر <10٪.
 */
export default function ClockGauge({ remaining, total, label, size = 96, className }: ClockGaugeProps) {
  const { settings } = useSettings()
  const ratio = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0
  const stroke = Math.max(6, size * 0.09)
  const r = (size - stroke) / 2 - 2
  const c = 2 * Math.PI * r
  const center = size / 2
  const seconds = Math.max(0, Math.ceil(remaining))

  const state: 'ok' | 'warn' | 'danger' = ratio < 0.1 ? 'danger' : ratio < 0.3 ? 'warn' : 'ok'
  const arcColor = state === 'ok' ? '#4ADE80' : state === 'warn' ? '#FBBF24' : '#F87171'

  return (
    <div
      className={cn('relative inline-flex items-center justify-center', state === 'danger' && 'animate-pulse', className)}
      role="timer"
      aria-label={`${label}: ${seconds} ثانية متبقية`}
    >
      <svg width={size} height={size} className="-rotate-90">
        {/* المسار الكامل */}
        <circle cx={center} cy={center} r={r} fill="none" stroke="#1A2444" strokeWidth={stroke} />
        {/* القوس المنقضي (أحمر) — يكبر مع اتجاه عقارب الساعة */}
        <circle
          cx={center}
          cy={center}
          r={r}
          fill="none"
          stroke="#B91C1C"
          strokeWidth={stroke}
          strokeDasharray={`${(1 - ratio) * c} ${c}`}
          strokeDashoffset={0}
          opacity={0.85}
        />
        {/* القوس المتبقي (أخضر/كهرماني/أحمر) */}
        <circle
          cx={center}
          cy={center}
          r={r}
          fill="none"
          stroke={arcColor}
          strokeWidth={stroke}
          strokeDasharray={`${ratio * c} ${c}`}
          strokeDashoffset={-(1 - ratio) * c}
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 6px ${arcColor})` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-hud font-bold leading-none text-ink-100" style={{ fontSize: size * 0.28 }}>
          {formatNumber(seconds, settings.numerals)}
        </span>
        <span className="mt-1 text-ink-400" style={{ fontSize: size * 0.11 }}>
          {label}
        </span>
      </div>
    </div>
  )
}
