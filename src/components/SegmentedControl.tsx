import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { audio } from '@/lib/audio'

export interface SegmentedOption<T extends string> {
  value: T
  label: string
}

export interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[]
  value: T
  onValueChange: (value: T) => void
  label?: string
  className?: string
}

/** مُحدد مقطعي — لاختيار الصعوبة/الطور */
export default function SegmentedControl<T extends string>({
  options,
  value,
  onValueChange,
  label,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div className={cn('py-2', className)}>
      {label && <div className="mb-2 text-base font-bold text-ink-100">{label}</div>}
      <div role="radiogroup" aria-label={label} className="flex gap-1 rounded-full border border-space-700 bg-space-900 p-1">
        {options.map((opt) => {
          const active = opt.value === value
          return (
            <button
              key={opt.value}
              role="radio"
              aria-checked={active}
              onClick={() => {
                audio.play('menuClick')
                onValueChange(opt.value)
              }}
              className={cn(
                'relative flex-1 rounded-full px-4 py-2 text-sm font-bold transition-colors',
                active ? 'text-space-950' : 'text-ink-400 hover:text-ink-100',
              )}
            >
              {active && (
                <motion.span
                  layoutId={undefined}
                  className="absolute inset-0 rounded-full bg-neon-cyan shadow-[0_0_16px_rgba(34,211,238,.5)]"
                  transition={{ type: 'spring', stiffness: 380, damping: 26 }}
                />
              )}
              <span className="relative z-10">{opt.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
