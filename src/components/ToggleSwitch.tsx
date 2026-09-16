import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { audio } from '@/lib/audio'

export interface ToggleSwitchProps {
  label: string
  helper?: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  className?: string
}

/** مفتاح تبديل باتجاه RTL — سماوي عند التفعيل، مع تسمية ونص مساعد */
export default function ToggleSwitch({ label, helper, checked, onCheckedChange, disabled, className }: ToggleSwitchProps) {
  return (
    <div className={cn('flex items-center justify-between gap-4 py-3', className)}>
      <div className="min-w-0">
        <div className="text-base font-bold text-ink-100">{label}</div>
        {helper && <div className="mt-0.5 text-sm text-ink-400">{helper}</div>}
      </div>
      <Switch
        dir="rtl"
        checked={checked}
        disabled={disabled}
        onCheckedChange={(v) => {
          audio.play('menuClick')
          onCheckedChange(v)
        }}
        className="data-[state=checked]:bg-neon-cyan data-[state=unchecked]:bg-space-700"
        aria-label={label}
      />
    </div>
  )
}
