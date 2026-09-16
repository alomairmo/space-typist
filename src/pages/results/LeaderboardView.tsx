import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { motion } from 'framer-motion'
import { ArrowRight, Play, Trash2 } from 'lucide-react'
import NeonButton from '@/components/NeonButton'
import SegmentedControl from '@/components/SegmentedControl'
import LeaderboardTable from '@/components/LeaderboardTable'
import { Panel } from '@/components/ArcadeCard'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import type { LeaderboardEntry } from '@/lib/storage'
import { loadLeaderboard, saveLeaderboard } from '@/lib/storage'
import { formatNumber } from '@/lib/format'
import { useSettings } from '@/context/SettingsContext'
import { audio } from '@/lib/audio'

type BoardTab = 'arcade' | 'levels' | 'custom'

const TAB_LABELS: Record<BoardTab, string> = {
  arcade: 'الأركيد',
  levels: 'المراحل',
  custom: 'المخصص',
}

export interface LeaderboardViewProps {
  /** معرّف إدخال الجولة الحالية — يومض صفّه */
  highlightId?: string | null
  /** رجوع: لو وُجدت جولة يعود لمراسمها، وإلا للقائمة الرئيسية */
  onBack?: (() => void) | null
}

/** لوحة الشرف — الترتيب العام لكل طور (أفضل 20) مع مسح السجل بتأكيد مكتوب */
export default function LeaderboardView({ highlightId = null, onBack = null }: LeaderboardViewProps) {
  const navigate = useNavigate()
  const { settings } = useSettings()
  const [tab, setTab] = useState<BoardTab>('arcade')
  const [entries, setEntries] = useState<LeaderboardEntry[]>(() => loadLeaderboard().entries)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')

  const rows = useMemo(
    () =>
      entries
        .filter((e) => e.mode === tab)
        .sort((a, b) => b.score - a.score || b.wpm - a.wpm)
        .slice(0, 20),
    [entries, tab],
  )

  const clearTab = () => {
    const next = entries.filter((e) => e.mode !== tab)
    saveLeaderboard({ entries: next })
    setEntries(next)
    setConfirmOpen(false)
    setConfirmText('')
    audio.play('explosion')
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-10">
      {/* الترويسة */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => {
            audio.play('menuClick')
            if (onBack) onBack()
            else navigate('/')
          }}
          className="inline-flex items-center gap-1 text-sm font-bold text-ink-400 transition-colors hover:text-neon-cyan"
        >
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
          رجوع
        </button>
        <h1 className="font-display text-[28px] font-bold text-ink-100 text-glow-cyan">
          لوحة الشرف — الترتيب العام
        </h1>
      </div>

      {/* التبويبات + مسح السجل */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SegmentedControl<BoardTab>
          options={[
            { value: 'arcade', label: TAB_LABELS.arcade },
            { value: 'levels', label: TAB_LABELS.levels },
            { value: 'custom', label: TAB_LABELS.custom },
          ]}
          value={tab}
          onValueChange={setTab}
          className="w-full max-w-md py-0"
        />
        <NeonButton
          variant="danger"
          size="md"
          className="border-bad-glow/40 bg-transparent text-bad-glow/80 hover:text-white"
          onClick={() => setConfirmOpen(true)}
          disabled={rows.length === 0}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          مسح السجل
        </NeonButton>
      </div>

      {/* الجدول / الحالة الفارغة */}
      {rows.length > 0 ? (
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        >
          <LeaderboardTable entries={rows} highlightId={highlightId ?? undefined} limit={20} />
        </motion.div>
      ) : (
        <Panel glow="cyan-dim" className="flex flex-col items-center gap-4 p-12 text-center">
          <p className="text-lg text-ink-400">لا توجد نتائج بعد... العب جولتك الأولى!</p>
          <NeonButton variant="primary" size="lg" onClick={() => navigate('/arcade')}>
            <Play className="h-5 w-5" aria-hidden="true" />
            ابدأ اللعب
          </NeonButton>
        </Panel>
      )}

      <p className="text-center text-xs text-ink-600">
        يُحفظ أفضل {formatNumber(20, settings.numerals)} نتيجة لكل طور على هذا الجهاز.
      </p>

      {/* نافذة تأكيد المسح المكتوب */}
      <Dialog
        open={confirmOpen}
        onOpenChange={(open) => {
          setConfirmOpen(open)
          if (!open) setConfirmText('')
        }}
      >
        <DialogContent className="border-bad-glow/40 bg-space-900 text-ink-100 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-bad-glow">مسح سجل {TAB_LABELS[tab]}؟</DialogTitle>
            <DialogDescription className="text-ink-400">
              ستحذف كل نتائج تبويب «{TAB_LABELS[tab]}» نهائياً ولا يمكن التراجع.
              <br />
              اكتب <span className="font-bold text-bad-glow">حذف</span> للتأكيد.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="حذف"
            autoFocus
            className="border-space-700 bg-space-800 text-center text-lg font-bold text-ink-100 placeholder:text-ink-600"
          />
          <DialogFooter className="gap-2 sm:justify-center">
            <NeonButton variant="ghost" onClick={() => setConfirmOpen(false)}>
              إلغاء
            </NeonButton>
            <NeonButton variant="danger" disabled={confirmText !== 'حذف'} onClick={clearTab}>
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              مسح نهائي
            </NeonButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
