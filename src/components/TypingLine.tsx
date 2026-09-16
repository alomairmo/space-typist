import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useSettings } from '@/context/SettingsContext'

export type CharState = 'pending' | 'correct' | 'wrong' | 'current'

/* ---------- اتصال الحروف العربية ----------
 * كل حرف يُعرض في خلية مستقلة (لتلوين حالته)، ما يقطع التشكيل السياقي
 * للحروف العربية. نغلّف كل حرف عربي بعلامة الوصل الصفري ZWJ (U+200D)
 * ليظهر بصورته المتصلة الصحيحة (أولية/وسطية/نهائية) رغم فصل الخلايا. */
const ZWJ = '\u200D'
const AR_LETTER = /[ء-يٱ-ە]/
/** حروف لا تتصل بما بعدها (تقطع الوصل من جهة اليسار في RTL) */
const NO_JOIN_AFTER = new Set(['ا', 'أ', 'إ', 'آ', 'ٱ', 'د', 'ذ', 'ر', 'ز', 'و', 'ؤ', 'ة', 'ى', 'ء', 'ە'])

function joinArabic(chars: string[], i: number): string {
  const ch = chars[i]
  if (!AR_LETTER.test(ch)) return ch
  const prev = chars[i - 1]
  const next = chars[i + 1]
  const joinBefore = prev != null && AR_LETTER.test(prev) && !NO_JOIN_AFTER.has(prev)
  const joinAfter = next != null && AR_LETTER.test(next) && !NO_JOIN_AFTER.has(ch)
  return (joinBefore ? ZWJ : '') + ch + (joinAfter ? ZWJ : '')
}

export interface TypingLineProps {
  /** السطر المستهدف */
  text: string
  /** عدد الأحرف المكتوبة (لتحديد الحالة تلقائياً) */
  typedCount?: number
  /** حالات صريحة لكل حرف (تتقدم على typedCount) */
  states?: CharState[]
  /** فهرس آخر خطأ (يُهز 150ms) */
  lastWrongIndex?: number | null
  className?: string
}

/**
 * سطر الكتابة — خلية لكل حرف بحالات:
 * pending (شفاف)، correct (تعبئة خضراء داكنة + قفزة)،
 * wrong (تعبئة حمراء داكنة + اهتزاز)، current (مؤشر سماوي وامض).
 */
export default function TypingLine({ text, typedCount = 0, states, lastWrongIndex = null, className }: TypingLineProps) {
  const { settings } = useSettings()
  const chars = Array.from(text)
  const joined = settings.joinedChars

  return (
    <div
      dir="rtl"
      className={cn(
        'flex flex-wrap items-stretch justify-center',
        joined ? 'gap-0' : 'gap-[3px]',
        className,
      )}
      role="text"
      aria-label={`سطر الكتابة: ${text}`}
    >
      {chars.map((ch, i) => {
        const state: CharState =
          states?.[i] ?? (i < typedCount ? 'correct' : i === typedCount ? 'current' : 'pending')
        const isSpace = ch === ' '
        return (
          <motion.span
            key={i}
            initial={false}
            animate={
              state === 'wrong' || i === lastWrongIndex
                ? { x: [0, -4, 4, -2, 0], scale: 1 }
                : state === 'correct'
                  ? { scale: [1, 1.15, 1], x: 0 }
                  : { scale: 1, x: 0 }
            }
            transition={{ duration: state === 'wrong' ? 0.15 : 0.18 }}
            className={cn(
              'relative inline-flex items-center justify-center py-[0.08em] font-typing font-semibold',
              joined ? 'rounded-[2px] px-0' : 'rounded-md px-[0.22em]',
              'text-[clamp(22px,2.6vw,34px)] leading-[1.6]',
              isSpace && (joined ? 'min-w-[0.55em]' : 'min-w-[0.9em]'),
              state === 'pending' && 'bg-transparent text-ink-100',
              state === 'correct' && 'bg-good-500 text-white',
              state === 'wrong' && 'bg-bad-600 text-white',
              state === 'current' && 'bg-transparent text-ink-100',
            )}
          >
            {isSpace ? '\u00A0' : joinArabic(chars, i)}
            {/* تلميح المسافة الاختياري: نقطة سفلية */}
            {isSpace && settings.showSpaceHint && (
              <span className="absolute bottom-[0.18em] left-1/2 h-[3px] w-[3px] -translate-x-1/2 rounded-full bg-ink-600" />
            )}
            {/* المؤشر الوامض تحت الحرف الحالي */}
            {state === 'current' && (
              <span className="typing-caret absolute inset-x-[2px] bottom-0 h-[3px] rounded-full bg-neon-cyan shadow-[0_0_8px_rgba(34,211,238,.8)]" />
            )}
            {/* رموز ✓/✗ الاختيارية (سلامة عمى الألوان) */}
            {settings.charStateGlyphs && state === 'correct' && (
              <span className="absolute -top-[0.5em] left-1/2 -translate-x-1/2 text-[0.35em] text-good-glow">✓</span>
            )}
            {settings.charStateGlyphs && state === 'wrong' && (
              <span className="absolute -top-[0.5em] left-1/2 -translate-x-1/2 text-[0.35em] text-bad-glow">✗</span>
            )}
          </motion.span>
        )
      })}
    </div>
  )
}
