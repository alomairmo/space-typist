import { motion } from 'framer-motion'
import type { LeaderboardEntry } from '@/lib/storage'
import { cn } from '@/lib/utils'
import { formatNumber } from '@/lib/format'
import { useSettings } from '@/context/SettingsContext'

const MODE_LABELS: Record<LeaderboardEntry['mode'], string> = {
  arcade: 'أركيد',
  levels: 'مراحل',
  custom: 'مخصص',
  placement: 'تحديد مستوى',
}

const rankStyles = [
  'shadow-[0_0_18px_rgba(245,158,11,.35)] border-neon-amber/50', // ذهبي
  'shadow-[0_0_18px_rgba(148,163,184,.3)] border-slate-400/50', // فضي
  'shadow-[0_0_18px_rgba(194,113,12,.3)] border-orange-700/50', // برونزي
]

const rankMedals = ['/medal-gold.svg', '/medal-silver.svg', '/medal-bronze.svg']

export interface LeaderboardTableProps {
  entries: LeaderboardEntry[]
  /** معرف الجولة الحالية — يومض صفها عند دخولها */
  highlightId?: string
  limit?: number
  className?: string
}

/** جدول النتائج — الترتيب، الاسم، الطور، النقاط، السرعة، الدقة، التاريخ */
export default function LeaderboardTable({ entries, highlightId, limit = 10, className }: LeaderboardTableProps) {
  const { settings } = useSettings()
  const rows = entries.slice(0, limit)
  const fmt = (n: number) => formatNumber(Math.round(n), settings.numerals)

  if (rows.length === 0) {
    return (
      <div className={cn('rounded-lg border border-space-700 bg-space-800 p-8 text-center text-ink-400', className)}>
        لا توجد نتائج مسجلة بعد — كن أول من يخلّد اسمه!
      </div>
    )
  }

  return (
    <div className={cn('overflow-hidden rounded-lg border border-space-700 bg-space-800', className)}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-space-700 bg-space-900 text-ink-400">
            <th className="px-3 py-2.5 text-start font-bold">الترتيب</th>
            <th className="px-3 py-2.5 text-start font-bold">الاسم</th>
            <th className="px-3 py-2.5 text-start font-bold">الطور</th>
            <th className="px-3 py-2.5 text-start font-bold">النقاط</th>
            <th className="px-3 py-2.5 text-start font-bold">ك/د</th>
            <th className="px-3 py-2.5 text-start font-bold">الدقة</th>
            <th className="hidden px-3 py-2.5 text-start font-bold sm:table-cell">التاريخ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((e, i) => (
            <motion.tr
              key={e.id}
              initial={e.id === highlightId ? { opacity: 0, backgroundColor: 'rgba(34,211,238,.25)' } : false}
              animate={{ opacity: 1, backgroundColor: 'rgba(34,211,238,0)' }}
              transition={{ duration: 1.2 }}
              className={cn('border-b border-space-700/60 last:border-0', i < 3 && `border ${rankStyles[i]}`)}
            >
              <td className="px-3 py-2.5">
                {i < 3 ? (
                  <img src={rankMedals[i]} alt={`المركز ${i + 1}`} width={24} height={24} className="inline-block" />
                ) : (
                  <span className="font-hud font-bold text-ink-400">{fmt(i + 1)}</span>
                )}
              </td>
              <td className="px-3 py-2.5 font-bold text-ink-100">{e.name}</td>
              <td className="px-3 py-2.5 text-ink-400">
                {MODE_LABELS[e.mode]}
                {e.wave != null && <span className="text-xs"> · موجة {fmt(e.wave)}</span>}
                {e.level != null && <span className="text-xs"> · مرحلة {fmt(e.level)}</span>}
              </td>
              <td className="px-3 py-2.5 font-hud font-bold text-neon-cyan">{fmt(e.score)}</td>
              <td className="px-3 py-2.5 font-hud text-ink-100">{fmt(e.wpm)}</td>
              <td className="px-3 py-2.5 font-hud text-ink-100">{fmt(e.acc)}٪</td>
              <td className="hidden px-3 py-2.5 text-xs text-ink-600 sm:table-cell">
                {new Date(e.date).toLocaleDateString('ar')}
              </td>
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
