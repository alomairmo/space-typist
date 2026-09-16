import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Camera,
  Clock,
  Eye,
  Heart,
  MoreHorizontal,
  Pencil,
  Plus,
  Rocket,
  Save,
  Shield,
  Timer,
  Trash2,
  Type,
  Zap,
} from 'lucide-react'
import { toast } from 'sonner'
import ArcadeCard from '@/components/ArcadeCard'
import { Panel } from '@/components/ArcadeCard'
import HeartRow from '@/components/HeartRow'
import NeonButton from '@/components/NeonButton'
import SegmentedControl from '@/components/SegmentedControl'
import SliderRow from '@/components/SliderRow'
import ToggleSwitch from '@/components/ToggleSwitch'
import { Toaster } from '@/components/ui/sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useCamera } from '@/context/CameraContext'
import { useSettings } from '@/context/SettingsContext'
import { cn } from '@/lib/utils'
import Section from '@/pages/custom/Section'
import PreviewStrip from '@/pages/custom/PreviewStrip'
import {
  BUILT_IN_PRESETS,
  CAMERA_STATUS_LABELS,
  CONTENT_CATEGORIES,
  CONTENT_LENGTHS,
  DESCENT_SPEEDS,
  LEVEL_TIMER_SCOPES,
  MAX_USER_PRESETS,
  addPreset,
  customConfigSchema,
  customLines,
  deletePreset,
  descentPx,
  isCustomTextPlayable,
  isLatinHeavy,
  loadDraft,
  loadSavedPresets,
  presetSummary,
  renamePreset,
  saveDraft,
} from '@/pages/custom/config'
import type { CustomConfig, SavedPreset } from '@/pages/custom/config'

type SectionKey = 'health' | 'letter' | 'level' | 'camera' | 'ships' | 'typing' | 'content'

/** قيمة تومض سماوية عند تغيّرها (بطاقة الإعداد) */
function Flash({ value, children, className }: { value: string; children?: ReactNode; className?: string }) {
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span
        key={value}
        initial={{ opacity: 0, y: -5, color: '#22D3EE' }}
        animate={{ opacity: 1, y: 0, color: '#E8ECF8' }}
        exit={{ opacity: 0, y: 5 }}
        transition={{ duration: 0.25 }}
        className={cn('inline-block', className)}
      >
        {children ?? value}
      </motion.span>
    </AnimatePresence>
  )
}

/** لوحة اختبار الكاميرا داخل قسم الكاميرا — معاينة حية + حالة الكشف */
function CameraTestInline() {
  const { status, stream, start, stop } = useCamera()
  const { rules } = useSettings()
  const [testing, setTesting] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const manualRef = useRef(false)

  useEffect(() => {
    const v = videoRef.current
    if (v && stream) {
      v.srcObject = stream
      void v.play().catch(() => undefined)
    }
  }, [stream, testing])

  const startTest = () => {
    setTesting(true)
    if (!stream) {
      manualRef.current = true
      void start()
    }
  }
  const stopTest = () => {
    setTesting(false)
    if (manualRef.current && !rules.camera.enabled) stop()
    manualRef.current = false
  }

  return (
    <div className="py-3">
      <Panel glow="cyan-dim" className="flex flex-col gap-3 p-4">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-neon-cyan/30 bg-space-900 text-neon-cyan">
            <Camera size={20} />
          </span>
          <p className="text-sm leading-relaxed text-ink-400">
            تُعالج الصورة على جهازك فقط ولا تُسجَّل أو تُرسَل أبداً.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!testing ? (
            <NeonButton variant="ghost" size="md" onClick={startTest}>
              <Eye size={16} />
              اختبار الكاميرا
            </NeonButton>
          ) : (
            <NeonButton variant="ghost" size="md" onClick={stopTest}>
              إيقاف الاختبار
            </NeonButton>
          )}
          {testing && (
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold',
                status === 'ok' && 'border-good-glow/40 text-good-glow',
                status === 'looking-down' && 'border-bad-glow/40 text-bad-glow',
                status !== 'ok' && status !== 'looking-down' && 'border-space-700 text-ink-400',
              )}
              role="status"
            >
              <span
                className={cn(
                  'h-2 w-2 rounded-full',
                  status === 'ok' && 'bg-good-glow',
                  status === 'looking-down' && 'bg-bad-glow animate-pulse',
                  status !== 'ok' && status !== 'looking-down' && 'bg-ink-600',
                )}
              />
              {CAMERA_STATUS_LABELS[status]}
            </span>
          )}
        </div>
        <AnimatePresence>
          {testing && stream && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <video
                ref={videoRef}
                muted
                playsInline
                className="h-36 w-48 rounded-xl border border-space-700 bg-space-950 object-cover -scale-x-100"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </Panel>
    </div>
  )
}

/** حوار حفظ الإعداد الحالي كـ preset */
function SavePresetDialog({
  open,
  onOpenChange,
  currentCount,
  onSave,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  currentCount: number
  onSave: (name: string) => void
}) {
  const [name, setName] = useState('')
  const [wasOpen, setWasOpen] = useState(false)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setName('')
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="border-neon-cyan/30 bg-space-900">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-bold text-ink-100">حفظ الإعداد الحالي</DialogTitle>
          <DialogDescription className="text-ink-400">اختر اسماً مميزاً لإعدادك المخصص.</DialogDescription>
        </DialogHeader>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="مثال: تدريب سريع"
          maxLength={30}
          className="border-space-700 bg-space-800 text-ink-100 placeholder:text-ink-600"
          aria-label="اسم الإعداد"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && name.trim()) onSave(name.trim())
          }}
        />
        {currentCount >= MAX_USER_PRESETS && (
          <p className="rounded-lg border border-neon-amber/40 bg-neon-amber/10 px-3 py-2 text-sm font-bold text-neon-amber">
            وصلت إلى الحد الأقصى ({MAX_USER_PRESETS}) — سيُؤرشف أقدم إعداد عند الحفظ.
          </p>
        )}
        <DialogFooter>
          <NeonButton variant="primary" disabled={!name.trim()} onClick={() => name.trim() && onSave(name.trim())}>
            <Save size={16} />
            حفظ
          </NeonButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** حوار إعادة تسمية preset */
function RenameDialog({
  preset,
  onClose,
  onRename,
}: {
  preset: SavedPreset | null
  onClose: () => void
  onRename: (id: string, name: string) => void
}) {
  const [name, setName] = useState('')
  const [prevId, setPrevId] = useState<string | null>(null)
  const currentId = preset?.id ?? null
  if (currentId !== prevId) {
    setPrevId(currentId)
    setName(preset?.name ?? '')
  }
  return (
    <Dialog open={preset != null} onOpenChange={(v) => !v && onClose()}>
      <DialogContent dir="rtl" className="border-neon-cyan/30 bg-space-900">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-bold text-ink-100">إعادة تسمية الإعداد</DialogTitle>
        </DialogHeader>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={30}
          className="border-space-700 bg-space-800 text-ink-100"
          aria-label="الاسم الجديد"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && preset && name.trim()) onRename(preset.id, name.trim())
          }}
        />
        <DialogFooter>
          <NeonButton
            variant="primary"
            disabled={!name.trim()}
            onClick={() => preset && name.trim() && onRename(preset.id, name.trim())}
          >
            حفظ الاسم
          </NeonButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** شريط الإعدادات المحفوظة — 3 مدمجة + حتى 12 من إعدادات اللاعب */
function PresetsBar({
  presets,
  onLoad,
  onDelete,
  onRenameRequest,
  onSaveRequest,
}: {
  presets: SavedPreset[]
  onLoad: (p: SavedPreset) => void
  onDelete: (id: string) => void
  onRenameRequest: (p: SavedPreset) => void
  onSaveRequest: () => void
}) {
  const chipBase =
    'inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-bold transition-colors'
  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-display text-lg font-bold text-ink-100">الإعدادات المحفوظة:</h2>
      <div className="flex flex-wrap items-center gap-2">
        {BUILT_IN_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            title={presetSummary(p.config)}
            onClick={() => onLoad(p)}
            className={cn(
              chipBase,
              'border-neon-amber/40 bg-neon-amber/5 text-neon-amber hover:border-neon-amber hover:shadow-[0_0_16px_rgba(251,191,36,.3)]',
            )}
          >
            <Shield size={14} />
            {p.name}
            <span className="rounded-full bg-neon-amber/15 px-1.5 text-[10px]">مدمج</span>
          </button>
        ))}
        {presets.map((p) => (
          <span
            key={p.id}
            className={cn(chipBase, 'border-neon-cyan/40 bg-neon-cyan/5 pe-1.5 text-neon-cyan hover:border-neon-cyan')}
          >
            <button type="button" title={presetSummary(p.config)} onClick={() => onLoad(p)} className="font-bold">
              {p.name}
            </button>
            <DropdownMenu dir="rtl">
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={`خيارات ${p.name}`}
                  className="rounded-full p-1 text-ink-400 transition-colors hover:bg-space-700 hover:text-ink-100"
                >
                  <MoreHorizontal size={14} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="border-space-700 bg-space-900">
                <DropdownMenuItem onClick={() => onRenameRequest(p)} className="gap-2 text-ink-100">
                  <Pencil size={14} />
                  إعادة تسمية
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onDelete(p.id)}
                  className="gap-2 text-bad-glow focus:text-bad-glow"
                >
                  <Trash2 size={14} />
                  حذف
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </span>
        ))}
        <button
          type="button"
          onClick={onSaveRequest}
          className={cn(
            chipBase,
            'border-dashed border-space-700 text-ink-400 hover:border-neon-cyan/50 hover:text-neon-cyan',
          )}
        >
          <Plus size={14} />
          حفظ الإعداد الحالي
        </button>
      </div>
    </div>
  )
}

/** البطاقة اللاصقة — ملخص القواعد + معاينة + إطلاق */
function SummaryCard({
  config,
  onLaunch,
  onSaveRequest,
}: {
  config: CustomConfig
  onLaunch: () => void
  onSaveRequest: () => void
}) {
  const speedLabel = DESCENT_SPEEDS.find((s) => s.value === config.ships.descentSpeed)?.label ?? ''
  const letterText = config.letterTimer.enabled ? `حرف ${config.letterTimer.seconds}ث` : 'حرف: متوقف'
  const levelText = config.levelTimer.enabled
    ? `${config.levelTimer.scope === 'line' ? 'سطر' : 'مرحلة'} ${config.levelTimer.seconds}ث`
    : 'مرحلة: متوقف'
  const cameraText = config.camera.enabled ? `مفعّلة · ضرر ${config.camera.damageHearts}` : 'متوقفة'

  return (
    <ArcadeCard glow="cyan" className="cursor-default p-5">
      <h2 className="mb-4 hidden font-display text-xl font-bold text-ink-100 text-glow-cyan lg:block">بطاقة الإعداد</h2>
      {/* شريط مضغوط للجوال */}
      <div className="flex flex-wrap items-center gap-2 lg:hidden">
        <span className="inline-flex items-center gap-1 rounded-full border border-heart-red/40 bg-space-900 px-2.5 py-1 text-xs font-bold text-heart-red">
          <Heart size={12} />×{config.hearts}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-space-700 bg-space-900 px-2.5 py-1 text-xs font-bold text-ink-400">
          <Timer size={12} />
          {letterText}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-space-700 bg-space-900 px-2.5 py-1 text-xs font-bold text-ink-400">
          <Clock size={12} />
          {levelText}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-space-700 bg-space-900 px-2.5 py-1 text-xs font-bold text-ink-400">
          <Camera size={12} />
          {cameraText}
        </span>
        <NeonButton size="md" className="group ms-auto" onClick={onLaunch}>
          <Rocket size={16} className="transition-transform duration-150 group-hover:-rotate-12" />
          ابدأ
        </NeonButton>
      </div>
      {/* البطاقة الكاملة لسطح المكتب */}
      <div className="hidden flex-col gap-3 lg:flex">
        <div className="flex items-center justify-between border-b border-space-700/60 pb-3">
          <span className="inline-flex items-center gap-2 text-sm font-bold text-ink-400">
            <Heart size={16} className="text-heart-red" />
            القلوب
          </span>
          <span className="flex items-center gap-2">
            <HeartRow hearts={config.hearts} maxHearts={config.hearts} size={18} />
            <Flash value={`${config.hearts}`} className="font-hud text-sm font-bold">
              ×{config.hearts}
            </Flash>
          </span>
        </div>
        <div className="flex items-center justify-between border-b border-space-700/60 pb-3">
          <span className="inline-flex items-center gap-2 text-sm font-bold text-ink-400">
            <Timer size={16} className="text-neon-cyan" />
            عداد الحرف
          </span>
          <Flash value={letterText} className="text-sm font-bold" />
        </div>
        <div className="flex items-center justify-between border-b border-space-700/60 pb-3">
          <span className="inline-flex items-center gap-2 text-sm font-bold text-ink-400">
            <Clock size={16} className="text-neon-cyan" />
            مؤقت المرحلة
          </span>
          <Flash value={levelText} className="text-sm font-bold" />
        </div>
        <div className="flex items-center justify-between border-b border-space-700/60 pb-3">
          <span className="inline-flex items-center gap-2 text-sm font-bold text-ink-400">
            <Camera size={16} className="text-neon-magenta" />
            الكاميرا
          </span>
          <Flash value={cameraText} className="text-sm font-bold" />
        </div>
        <div className="flex items-center justify-between pb-1">
          <span className="inline-flex items-center gap-2 text-sm font-bold text-ink-400">
            <Zap size={16} className="text-neon-amber" />
            السرعة
          </span>
          <Flash value={speedLabel} className="text-sm font-bold" />
        </div>
        <div className="overflow-hidden rounded-xl border border-space-700">
          <PreviewStrip descentSpeed={config.ships.descentSpeed} />
        </div>
        <NeonButton size="lg" className="group mt-1 w-full" onClick={onLaunch}>
          <Rocket size={20} className="transition-transform duration-150 group-hover:-rotate-12" />
          ابدأ اللعب
        </NeonButton>
        <NeonButton variant="ghost" size="md" className="w-full" onClick={onSaveRequest}>
          <Save size={16} />
          حفظ كإعداد
        </NeonButton>
      </div>
    </ArcadeCard>
  )
}

export default function Custom() {
  const navigate = useNavigate()
  const [config, setConfig] = useState<CustomConfig>(() => loadDraft())
  const [presets, setPresets] = useState<SavedPreset[]>(() => loadSavedPresets())
  const [openSections, setOpenSections] = useState<Set<SectionKey>>(() => new Set<SectionKey>(['health']))
  const [saveOpen, setSaveOpen] = useState(false)
  const [renameTarget, setRenameTarget] = useState<SavedPreset | null>(null)
  const [savedTick, setSavedTick] = useState(0)
  const [badgeVisible, setBadgeVisible] = useState(false)
  const badgeTimer = useRef(0)

  // حفظ تلقائي للمسودة عند كل تغيير
  useEffect(() => {
    saveDraft(config)
  }, [config])

  // كل تعديل يمر من هنا: يحدّث الحالة ويُظهر شارة «محفوظ تلقائياً ✓» لحظياً
  const applyConfig = (updater: (c: CustomConfig) => CustomConfig) => {
    setConfig(updater)
    setSavedTick((t) => t + 1)
    setBadgeVisible(true)
    window.clearTimeout(badgeTimer.current)
    badgeTimer.current = window.setTimeout(() => setBadgeVisible(false), 1600)
  }

  const toggleSection = (key: SectionKey) =>
    setOpenSections((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const resetSection = (key: SectionKey) => {
    const base = customConfigSchema.parse({})
    let backup: Partial<CustomConfig> = {}
    let patch: Partial<CustomConfig> = {}
    switch (key) {
      case 'health':
        backup = { hearts: config.hearts, bonusHearts: config.bonusHearts }
        patch = { hearts: base.hearts, bonusHearts: base.bonusHearts }
        break
      case 'letter':
        backup = { letterTimer: config.letterTimer }
        patch = { letterTimer: base.letterTimer }
        break
      case 'level':
        backup = { levelTimer: config.levelTimer }
        patch = { levelTimer: base.levelTimer }
        break
      case 'camera':
        backup = { camera: config.camera }
        patch = { camera: base.camera }
        break
      case 'ships':
        backup = { ships: config.ships }
        patch = { ships: base.ships }
        break
      case 'typing':
        backup = { typing: config.typing }
        patch = { typing: base.typing }
        break
      case 'content':
        backup = { content: config.content }
        patch = { content: base.content }
        break
    }
    applyConfig(() => ({ ...config, ...patch }))
    toast('أُعيد القسم إلى الافتراضي', {
      duration: 5000,
      action: { label: 'تراجع', onClick: () => applyConfig((prev) => ({ ...prev, ...backup })) },
    })
  }

  const loadPreset = (p: SavedPreset) => {
    applyConfig(() => p.config)
    toast.success(`تم التحميل: ${p.name}`)
  }

  const handleSavePreset = (name: string) => {
    const { presets: next, archived } = addPreset(name, config)
    setPresets(next)
    setSaveOpen(false)
    toast.success(archived ? 'تم الحفظ — أُرشف أقدم إعداد' : `تم الحفظ: ${name}`)
  }

  const launch = () => {
    if (config.typing.source === 'custom' && !isCustomTextPlayable(config.content.customText)) {
      toast.error('أضف سطراً واحداً على الأقل من 3 أحرف فأكثر في «نصوصي الخاصة» قبل البدء')
      return
    }
    saveDraft(config)
    navigate('/game/custom', { state: { config } })
  }

  const lines = useMemo(() => customLines(config.content.customText), [config.content.customText])
  const charCount = useMemo(() => lines.reduce((s, l) => s + l.length, 0), [lines])
  const latinWarning = useMemo(
    () => config.typing.source === 'custom' && isLatinHeavy(config.content.customText),
    [config.typing.source, config.content.customText],
  )

  const sectionMotion = (i: number) => ({
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.35, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
  })

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Toaster dir="rtl" position="bottom-center" />
      {/* الترويسة */}
      <header className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-4xl font-black text-ink-100 text-glow-cyan">الطور المخصص</h1>
        <AnimatePresence>
          {badgeVisible && (
            <motion.span
              key={savedTick}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="rounded-full border border-good-glow/40 bg-good-glow/10 px-3 py-1 text-xs font-bold text-good-glow"
              role="status"
            >
              محفوظ تلقائياً ✓
            </motion.span>
          )}
        </AnimatePresence>
        <NeonButton variant="ghost" size="md" className="ms-auto" onClick={() => setSaveOpen(true)}>
          <Save size={16} />
          حفظ
        </NeonButton>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* عمود التحكم */}
        <div className="order-2 flex flex-col gap-4 lg:order-1">
          <motion.div {...sectionMotion(0)}>
            <Section
              id="health"
              title="الصحة"
              icon={Heart}
              open={openSections.has('health')}
              onToggle={() => toggleSection('health')}
              onReset={() => resetSection('health')}
            >
              <SliderRow
                label="عدد القلوب"
                value={config.hearts}
                onValueChange={(v) => applyConfig((c) => ({ ...c, hearts: v }))}
                min={1}
                max={10}
                unit="قلب"
              />
              <div className="flex justify-center py-3">
                <HeartRow hearts={config.hearts} maxHearts={config.hearts} size={30} />
              </div>
              <ToggleSwitch
                label="قلوب إضافية عند إنهاء سطر بدون أخطاء"
                helper="أكمل سطراً كاملاً بلا أخطاء لتسترد قلباً"
                checked={config.bonusHearts.enabled}
                onCheckedChange={(v) => applyConfig((c) => ({ ...c, bonusHearts: { ...c.bonusHearts, enabled: v } }))}
              />
              <SliderRow
                label="الحد الأقصى"
                helper="أقصى عدد قلوب يمكن بلوغه بالمكافأة"
                value={config.bonusHearts.max}
                onValueChange={(v) => applyConfig((c) => ({ ...c, bonusHearts: { ...c.bonusHearts, max: v } }))}
                min={1}
                max={10}
                unit="قلب"
                disabled={!config.bonusHearts.enabled}
              />
            </Section>
          </motion.div>

          <motion.div {...sectionMotion(1)}>
            <Section
              id="letter"
              title="عداد الحرف"
              icon={Timer}
              open={openSections.has('letter')}
              onToggle={() => toggleSection('letter')}
              onReset={() => resetSection('letter')}
            >
              <ToggleSwitch
                label="تفعيل عداد لكل حرف"
                helper="لكل حرف مهلة زمنية قبل استدعاء هجوم العدو"
                checked={config.letterTimer.enabled}
                onCheckedChange={(v) => applyConfig((c) => ({ ...c, letterTimer: { ...c.letterTimer, enabled: v } }))}
              />
              <SliderRow
                label="الوقت لكل حرف"
                value={config.letterTimer.seconds}
                onValueChange={(v) => applyConfig((c) => ({ ...c, letterTimer: { ...c.letterTimer, seconds: v } }))}
                min={1}
                max={10}
                step={0.5}
                unit="ث"
                disabled={!config.letterTimer.enabled}
              />
              <ToggleSwitch
                label="إعادة ضبط العداد عند الخطأ"
                helper="يعود العداد كاملاً بعد كل خطأ إدخال"
                checked={config.letterTimer.resetOnError}
                onCheckedChange={(v) =>
                  applyConfig((c) => ({ ...c, letterTimer: { ...c.letterTimer, resetOnError: v } }))
                }
                disabled={!config.letterTimer.enabled}
              />
              <p className="py-3 text-[13px] text-ink-400">التأخر عن الوقت يستدعي هجوماً مؤكد الإصابة.</p>
            </Section>
          </motion.div>

          <motion.div {...sectionMotion(2)}>
            <Section
              id="level"
              title="عداد الجملة / المرحلة"
              icon={Clock}
              open={openSections.has('level')}
              onToggle={() => toggleSection('level')}
              onReset={() => resetSection('level')}
            >
              <ToggleSwitch
                label="تفعيل مؤقت السطر/المرحلة"
                helper="مهلة إجمالية لإنهاء السطر أو المرحلة كاملة"
                checked={config.levelTimer.enabled}
                onCheckedChange={(v) => applyConfig((c) => ({ ...c, levelTimer: { ...c.levelTimer, enabled: v } }))}
              />
              <SegmentedControl
                label="نطاق المؤقت"
                options={LEVEL_TIMER_SCOPES}
                value={config.levelTimer.scope}
                onValueChange={(v) => applyConfig((c) => ({ ...c, levelTimer: { ...c.levelTimer, scope: v } }))}
              />
              <SliderRow
                label="الوقت"
                value={config.levelTimer.seconds}
                onValueChange={(v) => applyConfig((c) => ({ ...c, levelTimer: { ...c.levelTimer, seconds: v } }))}
                min={20}
                max={180}
                step={5}
                unit="ث"
                disabled={!config.levelTimer.enabled}
              />
              <p className="py-3 text-[13px] font-bold text-neon-amber">
                عند انتهاء الوقت تهاجمك جميع المركبات دفعة واحدة!
              </p>
            </Section>
          </motion.div>

          <motion.div {...sectionMotion(3)}>
            <Section
              id="camera"
              title="الكاميرا (انظر للشاشة)"
              icon={Camera}
              open={openSections.has('camera')}
              onToggle={() => toggleSection('camera')}
              onReset={() => resetSection('camera')}
            >
              <ToggleSwitch
                label="تفعيل مراقبة النظر للشاشة"
                helper="تحذير ثم ضرر عند النظر إلى لوحة المفاتيح طويلاً"
                checked={config.camera.enabled}
                onCheckedChange={(v) => applyConfig((c) => ({ ...c, camera: { ...c.camera, enabled: v } }))}
              />
              {config.camera.enabled && <CameraTestInline />}
              <SliderRow
                label="مدة السماح بالنظر للأسفل"
                value={config.camera.lookDownThreshold}
                onValueChange={(v) =>
                  applyConfig((c) => ({ ...c, camera: { ...c.camera, lookDownThreshold: v } }))
                }
                min={0.5}
                max={3}
                step={0.1}
                unit="ث"
                disabled={!config.camera.enabled}
              />
              <SliderRow
                label="الضرر عند النظر للأسفل"
                helper="0 = تحذير فقط"
                value={config.camera.damageHearts}
                onValueChange={(v) => applyConfig((c) => ({ ...c, camera: { ...c.camera, damageHearts: v } }))}
                min={0}
                max={3}
                unit="قلب"
                disabled={!config.camera.enabled}
              />
              <ToggleSwitch
                label="إظهار نافذة الكاميرا أثناء اللعب"
                helper="معاينة مصغرة في زاوية الشاشة مع نقطة الحالة"
                checked={config.camera.showPiP}
                onCheckedChange={(v) => applyConfig((c) => ({ ...c, camera: { ...c.camera, showPiP: v } }))}
                disabled={!config.camera.enabled}
              />
            </Section>
          </motion.div>

          <motion.div {...sectionMotion(4)}>
            <Section
              id="ships"
              title="المركبات والسرعة"
              icon={Zap}
              open={openSections.has('ships')}
              onToggle={() => toggleSection('ships')}
              onReset={() => resetSection('ships')}
            >
              <div className="py-3">
                <SegmentedControl
                  label="سرعة هجوم المركبات"
                  options={DESCENT_SPEEDS.map((s) => ({ value: s.value, label: s.label }))}
                  value={config.ships.descentSpeed}
                  onValueChange={(v) => applyConfig((c) => ({ ...c, ships: { ...c.ships, descentSpeed: v } }))}
                />
                <p className="mt-1 text-[13px] text-ink-400">
                  سرعة نزول الصف: {descentPx(config.ships.descentSpeed)} بكسل/ث
                </p>
              </div>
              <SliderRow
                label="سرعة طلقات العدو"
                value={config.ships.bulletSpeed}
                onValueChange={(v) => applyConfig((c) => ({ ...c, ships: { ...c.ships, bulletSpeed: v } }))}
                min={200}
                max={600}
                step={25}
                unit="بكسل/ث"
              />
              <SliderRow
                label="عدد الصفوف المتزامنة"
                value={config.ships.rows}
                onValueChange={(v) => applyConfig((c) => ({ ...c, ships: { ...c.ships, rows: v } }))}
                min={1}
                max={3}
                unit="صف"
              />
              <ToggleSwitch
                label="مركبات النخبة"
                helper="مركبات أقوى تحتاج إصابتين بدءاً من الموجة 5"
                checked={config.ships.eliteShips}
                onCheckedChange={(v) => applyConfig((c) => ({ ...c, ships: { ...c.ships, eliteShips: v } }))}
              />
              <ToggleSwitch
                label="تفادي تلقائي لمركبتك"
                helper="عند الإيقاف: كل الطلقات تصيب — وضع التحدي"
                checked={config.ships.autoDodge}
                onCheckedChange={(v) => applyConfig((c) => ({ ...c, ships: { ...c.ships, autoDodge: v } }))}
              />
            </Section>
          </motion.div>

          <motion.div {...sectionMotion(5)}>
            <Section
              id="typing"
              title="قواعد الكتابة"
              icon={Pencil}
              open={openSections.has('typing')}
              onToggle={() => toggleSection('typing')}
              onReset={() => resetSection('typing')}
            >
              <ToggleSwitch
                label="الإيقاف عند الخطأ"
                helper="يجب كتابة الحرف الصحيح قبل المتابعة"
                checked={config.typing.stopOnError}
                onCheckedChange={(v) => applyConfig((c) => ({ ...c, typing: { ...c.typing, stopOnError: v } }))}
              />
              <ToggleSwitch
                label="تساهل الهمزات"
                helper="أ/إ/آ/ء/ؤ/ئ تُعامل كحرف واحد"
                checked={config.typing.hamzaLeniency}
                onCheckedChange={(v) => applyConfig((c) => ({ ...c, typing: { ...c.typing, hamzaLeniency: v } }))}
              />
              <ToggleSwitch
                label="تجاهل التشكيل والتطويل"
                helper="الحركات والمدّ (~) اختيارية أثناء الكتابة"
                checked={config.typing.ignoreDiacritics}
                onCheckedChange={(v) => applyConfig((c) => ({ ...c, typing: { ...c.typing, ignoreDiacritics: v } }))}
              />
              <ToggleSwitch
                label="إظهار مسافات مرئية ·"
                helper="نقطة صغيرة تحت كل مسافة في سطر الكتابة"
                checked={config.typing.showSpaces}
                onCheckedChange={(v) => applyConfig((c) => ({ ...c, typing: { ...c.typing, showSpaces: v } }))}
              />
              <SegmentedControl
                label="مصدر الجمل"
                options={[
                  { value: 'library' as const, label: 'من مكتبة اللعبة' },
                  { value: 'custom' as const, label: 'نصوصي الخاصة' },
                ]}
                value={config.typing.source}
                onValueChange={(v) => applyConfig((c) => ({ ...c, typing: { ...c.typing, source: v } }))}
              />
            </Section>
          </motion.div>

          <motion.div {...sectionMotion(6)}>
            <Section
              id="content"
              title="المحتوى (النصوص)"
              icon={Type}
              open={openSections.has('content')}
              onToggle={() => toggleSection('content')}
              onReset={() => resetSection('content')}
            >
              {config.typing.source === 'custom' ? (
                <div className="flex flex-col gap-3 py-3">
                  <Textarea
                    value={config.content.customText}
                    onChange={(e) =>
                      applyConfig((c) => ({ ...c, content: { ...c.content, customText: e.target.value } }))
                    }
                    placeholder="اكتب كل سطر في سطر مستقل..."
                    rows={5}
                    dir="rtl"
                    className="min-h-28 border-space-700 bg-space-900 font-typing text-lg text-ink-100 placeholder:text-ink-600"
                    aria-label="النصوص الخاصة"
                  />
                  <div className="flex items-center justify-between text-[13px] text-ink-400">
                    <span>
                      {lines.length} سطر · {charCount} حرف
                    </span>
                    {latinWarning && (
                      <span className="font-bold text-neon-amber">تنبيه: النص غالباً بأحرف لاتينية</span>
                    )}
                  </div>
                  <ToggleSwitch
                    label="خلط ترتيب الأسطر"
                    helper="تظهر الأسطر بترتيب عشوائي كل جولة"
                    checked={config.content.shuffle}
                    onCheckedChange={(v) => applyConfig((c) => ({ ...c, content: { ...c.content, shuffle: v } }))}
                  />
                </div>
              ) : (
                <div className="flex flex-col gap-2 py-3">
                  <SegmentedControl
                    label="طول الجمل"
                    options={CONTENT_LENGTHS}
                    value={config.content.length}
                    onValueChange={(v) => applyConfig((c) => ({ ...c, content: { ...c.content, length: v } }))}
                  />
                  <div className="py-2">
                    <div className="mb-2 text-base font-bold text-ink-100">فئة النصوص</div>
                    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="فئة النصوص">
                      {CONTENT_CATEGORIES.map((cat) => {
                        const active = config.content.category === cat.value
                        return (
                          <button
                            key={cat.value}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            onClick={() =>
                              applyConfig((c) => ({ ...c, content: { ...c.content, category: cat.value } }))
                            }
                            className={cn(
                              'rounded-full border px-4 py-1.5 text-sm font-bold transition-colors',
                              active
                                ? 'border-neon-magenta/60 bg-neon-magenta/15 text-neon-magenta shadow-[0_0_12px_rgba(232,121,249,.25)]'
                                : 'border-space-700 text-ink-400 hover:border-neon-magenta/40 hover:text-ink-100',
                            )}
                          >
                            {cat.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  <ToggleSwitch
                    label="خلط ترتيب الأسطر"
                    helper="تظهر الأسطر بترتيب عشوائي كل جولة"
                    checked={config.content.shuffle}
                    onCheckedChange={(v) => applyConfig((c) => ({ ...c, content: { ...c.content, shuffle: v } }))}
                  />
                </div>
              )}
            </Section>
          </motion.div>

          <motion.div {...sectionMotion(7)}>
            <PresetsBar
              presets={presets}
              onLoad={loadPreset}
              onDelete={(id) => {
                setPresets(deletePreset(id))
                toast('تم حذف الإعداد')
              }}
              onRenameRequest={setRenameTarget}
              onSaveRequest={() => setSaveOpen(true)}
            />
          </motion.div>
        </div>

        {/* البطاقة اللاصقة */}
        <div className="sticky top-16 z-20 order-1 lg:top-20 lg:order-2">
          <SummaryCard config={config} onLaunch={launch} onSaveRequest={() => setSaveOpen(true)} />
        </div>
      </div>

      <SavePresetDialog
        open={saveOpen}
        onOpenChange={setSaveOpen}
        currentCount={presets.length}
        onSave={handleSavePreset}
      />
      <RenameDialog
        preset={renameTarget}
        onClose={() => setRenameTarget(null)}
        onRename={(id, name) => {
          setPresets(renamePreset(id, name))
          setRenameTarget(null)
          toast.success('تمت إعادة التسمية')
        }}
      />
    </div>
  )
}
