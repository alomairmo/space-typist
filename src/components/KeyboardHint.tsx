import { cn } from '@/lib/utils'

/** صفوف لوحة المفاتيح العربية (101) */
const ROWS: string[][] = [
  ['ذ', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='],
  ['ض', 'ص', 'ث', 'ق', 'ف', 'غ', 'ع', 'ه', 'خ', 'ح', 'ج', 'د'],
  ['ش', 'س', 'ي', 'ب', 'ل', 'ا', 'ت', 'ن', 'م', 'ك', 'ط'],
  ['ئ', 'ء', 'ؤ', 'ر', 'لا', 'ى', 'ة', 'و', 'ز', 'ظ'],
]
const HOME_ROW = 2
const ANCHOR_KEYS = new Set(['ت', 'ن'])

export interface KeyboardHintProps {
  /** الحرف المطلوب حالياً — يُبرَز مفتاحه */
  currentChar?: string | null
  className?: string
}

/**
 * شريط تلميح لوحة المفاتيح العربية — منطقة الصف الرئيسي مضاءة بالسماوي،
 * مفاتيح الارتكاز «ت» و«ن» بإطار أوضح، والمفتاح المطلوب يتوهج.
 */
export default function KeyboardHint({ currentChar = null, className }: KeyboardHintProps) {
  return (
    <div
      className={cn('select-none rounded-xl border border-space-700 bg-space-900/90 p-2', className)}
      role="img"
      aria-label="تلميح لوحة المفاتيح العربية"
    >
      <div dir="rtl" className="flex flex-col items-center gap-1">
        {ROWS.map((row, ri) => (
          <div key={ri} className="flex gap-1">
            {row.map((key) => {
              const active = currentChar === key
              const home = ri === HOME_ROW
              const anchor = ANCHOR_KEYS.has(key)
              return (
                <span
                  key={key}
                  className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-md border text-xs font-bold transition-all duration-100 sm:h-8 sm:w-8 sm:text-sm',
                    active
                      ? 'border-neon-cyan bg-neon-cyan text-space-950 shadow-[0_0_14px_rgba(34,211,238,.8)]'
                      : home
                        ? 'border-space-700 bg-[#13203F] text-ink-100'
                        : 'border-space-700/70 bg-space-800 text-ink-400',
                    anchor && !active && 'border-neon-cyan/50',
                  )}
                >
                  {key}
                </span>
              )
            })}
          </div>
        ))}
        <span
          className={cn(
            'mt-0.5 flex h-7 w-56 items-center justify-center rounded-md border text-[10px] transition-all duration-100 sm:h-8',
            currentChar === ' '
              ? 'border-neon-cyan bg-neon-cyan text-space-950 shadow-[0_0_14px_rgba(34,211,238,.8)]'
              : 'border-space-700/70 bg-space-800 text-ink-600',
          )}
        >
          مسافة
        </span>
      </div>
    </div>
  )
}
