import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'
import { useSettings } from '@/context/SettingsContext'
import { formatNumber } from '@/lib/format'

export interface SliderRowProps {
  label: string
  helper?: string
  value: number
  onValueChange: (value: number) => void
  min: number
  max: number
  step?: number
  unit?: string
  disabled?: boolean
  className?: string
}

/** صف منزلق — تسمية + Slider + شارة قيمة حية بأرقام Orbitron + وحدة */
export default function SliderRow({
  label,
  helper,
  value,
  onValueChange,
  min,
  max,
  step = 1,
  unit,
  disabled,
  className,
}: SliderRowProps) {
  const { settings } = useSettings()
  return (
    <div className={cn('py-3', disabled && 'opacity-50', className)}>
      <div className="mb-2 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="text-base font-bold text-ink-100">{label}</div>
          {helper && <div className="mt-0.5 text-sm text-ink-400">{helper}</div>}
        </div>
        <span className="shrink-0 rounded-full border border-neon-cyan/40 bg-space-900 px-3 py-1 font-hud text-sm font-bold text-neon-cyan">
          {formatNumber(value, settings.numerals)}
          {unit && <span className="ms-1 font-sans text-xs font-medium text-ink-400">{unit}</span>}
        </span>
      </div>
      <Slider
        dir="rtl"
        min={min}
        max={max}
        step={step}
        value={[value]}
        disabled={disabled}
        onValueChange={([v]) => onValueChange(v ?? value)}
        aria-label={label}
      />
    </div>
  )
}
