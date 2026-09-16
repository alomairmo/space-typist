import { useRef, useState } from 'react'
import { AlertTriangle, Check, Download, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Panel } from '@/components/ArcadeCard'
import NeonButton from '@/components/NeonButton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useSettings } from '@/context/SettingsContext'
import { formatNumber } from '@/lib/format'
import {
  STORAGE_KEYS,
  STORAGE_PREFIX,
  customPresetsSchema,
  exportAllData,
  gameRulesSchema,
  importAllData,
  leaderboardSchema,
  loadLeaderboard,
  loadPlayer,
  loadProgress,
  playerSchema,
  progressSchema,
  resetAllData,
  savePlayer,
  settingsSchema,
} from '@/lib/storage'
import { Row, Rows } from '@/pages/settings/common'

const CONFIRM_WORD = 'حذف'

/** حوار تأكيد كتابي — لا يُفعَّل زر التأكيد إلا بكتابة «حذف» حرفياً */
function TypedConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  solid,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  title: string
  description: string
  confirmLabel: string
  solid?: boolean
  onConfirm: () => void
}) {
  const [typed, setTyped] = useState('')
  const close = (v: boolean) => {
    if (!v) setTyped('')
    onOpenChange(v)
  }
  const ok = typed.trim() === CONFIRM_WORD
  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent dir="rtl" className="border-bad-glow/40 bg-space-900">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-xl font-bold text-bad-glow">
            <AlertTriangle size={20} />
            {title}
          </DialogTitle>
          <DialogDescription className="leading-relaxed text-ink-400">{description}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <label className="text-sm font-bold text-ink-100" htmlFor={`confirm-${title}`}>
            اكتب «{CONFIRM_WORD}» للتأكيد
          </label>
          <Input
            id={`confirm-${title}`}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={CONFIRM_WORD}
            className="border-bad-glow/40 bg-space-800 text-ink-100 placeholder:text-ink-600"
            autoComplete="off"
          />
        </div>
        <DialogFooter>
          <NeonButton variant="ghost" onClick={() => close(false)}>
            إلغاء
          </NeonButton>
          <NeonButton
            variant="danger"
            disabled={!ok}
            className={solid && ok ? 'bg-bad-600 text-white hover:bg-bad-600' : undefined}
            onClick={() => {
              close(false)
              onConfirm()
            }}
          >
            <Trash2 size={16} />
            {confirmLabel}
          </NeonButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** يتحقق من بنية ملف الاستيراد قبل عرض تأكيد الاستبدال */
function validateImport(json: string): boolean {
  try {
    const d: unknown = JSON.parse(json)
    if (d == null || typeof d !== 'object') return false
    const o = d as Record<string, unknown>
    return (
      settingsSchema.safeParse(o.settings).success &&
      gameRulesSchema.safeParse(o.gameRules).success &&
      progressSchema.safeParse(o.progress).success &&
      leaderboardSchema.safeParse(o.leaderboard).success &&
      customPresetsSchema.safeParse(o.customPresets).success &&
      playerSchema.safeParse(o.player).success
    )
  } catch {
    return false
  }
}

function computeStats() {
  const entries = loadLeaderboard().entries
  const progress = loadProgress()
  const arcadeScores = entries.filter((e) => e.mode === 'arcade').map((e) => e.score)
  const bestArcade = arcadeScores.length ? Math.max(...arcadeScores) : 0
  const completedLevels = progress.levels.filter((l) => l.stars > 0)
  const stars = progress.levels.reduce((s, l) => s + l.stars, 0)
  const accSource = entries.length ? entries.map((e) => e.acc) : completedLevels.map((l) => l.bestAcc)
  const avgAcc = accSource.length ? Math.round(accSource.reduce((s, a) => s + a, 0) / accSource.length) : 0
  return { bestArcade, completed: completedLevels.length, stars, avgAcc }
}

/** تبويب البيانات — اسم اللاعب، ملخص الإحصاءات، تصدير/استيراد، إعادة التعيين */
export default function DataTab() {
  const { settings } = useSettings()
  const [player, setPlayer] = useState(() => loadPlayer())
  const [nameDraft, setNameDraft] = useState(player.name)
  const [stats] = useState(computeStats)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [pendingImport, setPendingImport] = useState<string | null>(null)
  const [resetProgressOpen, setResetProgressOpen] = useState(false)
  const [resetAllOpen, setResetAllOpen] = useState(false)

  const fmt = (n: number) => formatNumber(n, settings.numerals)

  const saveName = () => {
    const name = nameDraft.trim() || 'قائد المجرّة'
    const next = { ...player, name }
    savePlayer(next)
    setPlayer(next)
    setNameDraft(name)
    toast.success('تم حفظ الاسم')
  }

  const doExport = () => {
    const blob = new Blob([exportAllData()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'space-typist-data.json'
    a.click()
    URL.revokeObjectURL(url)
    toast.success('تم تصدير بياناتك')
  }

  const onPickFile = (file: File | undefined) => {
    if (!file) return
    void file.text().then((text) => {
      if (validateImport(text)) setPendingImport(text)
      else toast.error('ملف غير صالح')
    })
  }

  const doImport = () => {
    if (!pendingImport) return
    try {
      importAllData(pendingImport)
      toast.success('تم الاستيراد — جارٍ تحديث البيانات...')
      window.setTimeout(() => window.location.reload(), 900)
    } catch {
      toast.error('ملف غير صالح')
    } finally {
      setPendingImport(null)
    }
  }

  const resetProgressOnly = () => {
    localStorage.removeItem(STORAGE_KEYS.progress)
    localStorage.removeItem(STORAGE_KEYS.leaderboard)
    localStorage.removeItem(`${STORAGE_PREFIX}:last-run`)
    toast.success('أُعيد تعيين التقدم — جارٍ التحديث...')
    window.setTimeout(() => window.location.reload(), 900)
  }

  const resetEverything = () => {
    resetAllData()
    toast.success('أُعيد تعيين كل شيء — جارٍ التحديث...')
    window.setTimeout(() => window.location.reload(), 900)
  }

  return (
    <Rows>
      <Row>
        <div className="flex flex-wrap items-center justify-between gap-4 py-3">
          <div className="min-w-0">
            <div className="text-base font-bold text-ink-100">اسم اللاعب</div>
            <div className="mt-0.5 text-sm text-ink-400">يظهر في لوحة النتائج والقوائم</div>
          </div>
          <div className="flex items-center gap-2">
            <Input
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              maxLength={24}
              className="w-48 border-space-700 bg-space-800 text-ink-100"
              aria-label="اسم اللاعب"
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveName()
              }}
            />
            <NeonButton variant="ghost" size="md" onClick={saveName}>
              <Check size={16} />
              حفظ
            </NeonButton>
          </div>
        </div>
      </Row>
      <Row>
        <Panel glow="cyan-dim" className="my-3 grid grid-cols-2 gap-4 p-4 sm:grid-cols-4">
          <div className="text-center">
            <div className="font-hud text-2xl font-bold text-neon-cyan">{fmt(stats.bestArcade)}</div>
            <div className="mt-1 text-[13px] text-ink-400">أفضل نتيجة أركيد</div>
          </div>
          <div className="text-center">
            <div className="font-hud text-2xl font-bold text-neon-cyan">{fmt(stats.completed)}</div>
            <div className="mt-1 text-[13px] text-ink-400">المراحل المكتملة</div>
          </div>
          <div className="text-center">
            <div className="font-hud text-2xl font-bold text-neon-amber">{fmt(stats.stars)}</div>
            <div className="mt-1 text-[13px] text-ink-400">مجموع النجوم</div>
          </div>
          <div className="text-center">
            <div className="font-hud text-2xl font-bold text-good-glow">{fmt(stats.avgAcc)}%</div>
            <div className="mt-1 text-[13px] text-ink-400">متوسط الدقة</div>
          </div>
        </Panel>
      </Row>
      <Row>
        <div className="flex flex-col gap-3 py-3">
          <NeonButton variant="ghost" size="lg" className="w-full" onClick={doExport}>
            <Download size={18} />
            تصدير بياناتي
          </NeonButton>
          <NeonButton variant="ghost" size="lg" className="w-full" onClick={() => fileRef.current?.click()}>
            <Upload size={18} />
            استيراد بيانات
          </NeonButton>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            aria-label="اختيار ملف البيانات"
            onChange={(e) => {
              onPickFile(e.target.files?.[0])
              e.target.value = ''
            }}
          />
          <NeonButton variant="danger" size="lg" className="w-full" onClick={() => setResetProgressOpen(true)}>
            <Trash2 size={18} />
            إعادة تعيين التقدم فقط
          </NeonButton>
          <NeonButton
            variant="danger"
            size="lg"
            className="w-full bg-bad-600/70 text-white transition-transform hover:-rotate-1 hover:bg-bad-600"
            onClick={() => setResetAllOpen(true)}
          >
            <AlertTriangle size={18} />
            إعادة تعيين كل شيء
          </NeonButton>
        </div>
      </Row>
      <Row>
        <p className="py-4 text-center text-[13px] text-ink-600">
          مدفع الفضاء — نسخة 1.0 · جميع البيانات محفوظة محلياً على جهازك
        </p>
      </Row>

      {/* تأكيد الاستيراد */}
      <Dialog open={pendingImport != null} onOpenChange={(v) => !v && setPendingImport(null)}>
        <DialogContent dir="rtl" className="border-neon-amber/40 bg-space-900">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display text-xl font-bold text-neon-amber">
              <Upload size={20} />
              استيراد بيانات
            </DialogTitle>
            <DialogDescription className="leading-relaxed text-ink-400">
              سيستبدل بياناتك الحالية (الإعدادات، التقدم، لوحة النتائج، الإعدادات المحفوظة). هل تريد المتابعة؟
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <NeonButton variant="ghost" onClick={() => setPendingImport(null)}>
              إلغاء
            </NeonButton>
            <NeonButton variant="primary" onClick={doImport}>
              <Upload size={16} />
              استيراد واستبدال
            </NeonButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TypedConfirmDialog
        open={resetProgressOpen}
        onOpenChange={setResetProgressOpen}
        title="إعادة تعيين التقدم فقط"
        description="سيمحو هذا تقدم المراحل ولوحة النتائج، ويبقي إعداداتك وإعداداتك المحفوظة واسمك كما هي."
        confirmLabel="تعيين التقدم"
        onConfirm={resetProgressOnly}
      />
      <TypedConfirmDialog
        open={resetAllOpen}
        onOpenChange={setResetAllOpen}
        title="إعادة تعيين كل شيء"
        description="سيمحو هذا كل بيانات اللعبة نهائياً: الإعدادات، التقدم، لوحة النتائج، الإعدادات المحفوظة، واسم اللاعب. لا يمكن التراجع."
        confirmLabel="تعيين كل شيء"
        solid
        onConfirm={resetEverything}
      />
    </Rows>
  )
}
