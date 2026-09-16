import { useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useNavigate } from 'react-router'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowRight,
  ChevronDown,
  Compass,
  Gauge,
  Heart,
  Hourglass,
  Lock,
  Play,
  Timer,
  Trophy,
  X,
  Zap,
} from 'lucide-react'
import ArcadeCard, { Panel } from '@/components/ArcadeCard'
import NeonButton from '@/components/NeonButton'
import StarRating from '@/components/StarRating'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useSettings } from '@/context/SettingsContext'
import { audio } from '@/lib/audio'
import { loadProgress } from '@/lib/storage'
import type { LevelProgress } from '@/lib/storage'
import { LEVELS, STAGES, TOTAL_LEVELS } from '@/lib/curriculum'
import type { LevelDef, StageDef } from '@/lib/curriculum'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import { STAGE_DESCRIPTIONS, STAR_RULES_TEXT } from '@/pages/levels/stage-meta'

const EXPO = [0.16, 1, 0.3, 1] as [number, number, number, number]

/* ---------- تقدّم المراحل (فتح تسلسلي صارم من التخزين) ---------- */

interface LevelState {
  progress: LevelProgress | null
  completed: boolean
  unlocked: boolean
  isCurrent: boolean
}

function buildLevelStates(progressLevels: LevelProgress[]): Map<number, LevelState> {
  const byId = new Map(progressLevels.map((p) => [p.id, p]))
  const completedOf = (id: number) => (byId.get(id)?.stars ?? 0) >= 1
  const states = new Map<number, LevelState>()
  for (const level of LEVELS) {
    const p = byId.get(level.id) ?? null
    const completed = completedOf(level.id)
    // فتح صارم: المرحلة 1 مفتوحة دوماً، وكل مرحلة تُفتح فقط بإنهاء السابقة (★ على الأقل)،
    // مع احترام علم unlocked المخزّن (مثلاً بعد اختبار تحديد المستوى).
    const unlocked = level.id === 1 || (p?.unlocked ?? false) || completedOf(level.id - 1)
    states.set(level.id, { progress: p, completed, unlocked, isCurrent: false })
  }
  // المرحلة الحالية = أول مرحلة مفتوحة غير مكتملة
  const current = LEVELS.find((l) => {
    const s = states.get(l.id)!
    return s.unlocked && !s.completed
  })
  if (current) states.get(current.id)!.isCurrent = true
  return states
}

const EMPTY_PROGRESS: LevelProgress = { id: 0, unlocked: false, stars: 0, bestWpm: 0, bestAcc: 0, completedAt: null }

/* ---------- خلية مرحلة (مربّع التقويم) ---------- */

interface CellProps {
  level: LevelDef
  state: LevelState
  numerals: 'western' | 'arabic'
  reducedMotion: boolean
  index: number
  onOpen: (level: LevelDef) => void
  registerRef: (id: number, el: HTMLDivElement | null) => void
  onKeyNav: (e: KeyboardEvent, id: number) => void
}

function LevelCell({ level, state, numerals, reducedMotion, index, onOpen, registerRef, onKeyNav }: CellProps) {
  const [shaking, setShaking] = useState(false)
  const num = formatNumber(level.id, numerals)

  const handleLockedClick = () => {
    audio.play('lock')
    setShaking(true)
    window.setTimeout(() => setShaking(false), 220)
  }

  const reviewBadge = level.isReview && (
    <span className="absolute left-1.5 top-1.5 text-neon-magenta" title="مراجعة شاملة">
      <Trophy size={14} aria-label="مراجعة شاملة" />
    </span>
  )

  const inner = (
    <div className="relative flex h-full w-full flex-col items-center justify-center gap-1 p-2">
      {reviewBadge}
      <span
        className={cn(
          'font-hud text-2xl leading-none',
          state.unlocked ? 'text-ink-100' : 'text-ink-600',
          level.isReview && state.unlocked && 'text-neon-magenta',
        )}
        style={{ fontSize: 24 }}
      >
        {num}
      </span>
      {state.completed && state.progress ? (
        <>
          <StarRating stars={state.progress.stars} size={14} />
          {state.progress.bestWpm > 0 && (
            <span className="text-[10px] leading-none text-ink-400">
              {formatNumber(state.progress.bestWpm, numerals)} ك/د
            </span>
          )}
        </>
      ) : state.unlocked ? (
        <span className="flex items-center gap-1 text-[11px] font-bold text-neon-cyan opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          <Play size={11} />
          العب
        </span>
      ) : (
        <Lock size={16} className="text-ink-600" />
      )}
      {state.isCurrent && (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[inherit] border-2 border-neon-cyan"
          animate={reducedMotion ? undefined : { opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          style={{ opacity: 0.7 }}
        />
      )}
    </div>
  )

  if (!state.unlocked) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <motion.div
            ref={(el) => registerRef(level.id, el)}
            role="button"
            tabIndex={-1}
            aria-label={`المرحلة ${num} — مقفلة`}
            initial={reducedMotion ? false : { scale: 0.8, opacity: 0 }}
            animate={shaking ? { x: [0, -6, 6, -6, 6, 0], scale: 1, opacity: 1 } : { x: 0, scale: 1, opacity: 1 }}
            transition={
              shaking
                ? { duration: 0.2 }
                : reducedMotion
                  ? { duration: 0.15 }
                  : { delay: index * 0.03, type: 'spring', stiffness: 380, damping: 26 }
            }
            onClick={handleLockedClick}
            onKeyDown={(e) => onKeyNav(e, level.id)}
            className={cn(
              'arcade-corners aspect-square min-h-[96px] cursor-not-allowed select-none border bg-space-700/60',
              level.isReview ? 'border-neon-magenta/20' : 'border-space-700',
            )}
          >
            {inner}
          </motion.div>
        </TooltipTrigger>
        <TooltipContent>أنهِ المرحلة السابقة لفتح هذه المرحلة</TooltipContent>
      </Tooltip>
    )
  }

  const p = state.progress ?? EMPTY_PROGRESS
  const dateText = p.completedAt ? new Date(p.completedAt).toLocaleDateString('ar') : null

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <motion.div
          ref={(el) => registerRef(level.id, el)}
          initial={reducedMotion ? false : { scale: 0.8, opacity: 0 }}
          animate={{ scale: state.isCurrent ? 1.03 : 1, opacity: 1 }}
          transition={
            reducedMotion
              ? { duration: 0.15 }
              : { delay: index * 0.03, type: 'spring', stiffness: 380, damping: 26 }
          }
          className="aspect-square min-h-[96px]"
        >
          <ArcadeCard
            glow={level.isReview ? 'magenta' : state.completed ? 'cyan' : 'cyan-dim'}
            onClick={() => onOpen(level)}
            className={cn('group h-full w-full', state.completed && 'border-neon-cyan/60')}
          >
            <div
              role="button"
              tabIndex={0}
              aria-label={`المرحلة ${num} — ${level.name}`}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  onOpen(level)
                  return
                }
                onKeyNav(e, level.id)
              }}
              className="h-full w-full outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan"
            >
              {inner}
            </div>
          </ArcadeCard>
        </motion.div>
      </TooltipTrigger>
      <TooltipContent>
        {state.completed ? (
          <span className="flex flex-col gap-0.5 text-xs">
            <span>السرعة: {formatNumber(p.bestWpm, numerals)} ك/د · الدقة: {formatNumber(p.bestAcc, numerals)}٪</span>
            <span>النجوم: {formatNumber(p.stars, numerals)} من 3{dateText ? ` · ${dateText}` : ''}</span>
            <span className="text-ink-400">اضغط لإعادة المرحلة</span>
          </span>
        ) : level.isReview ? (
          'مراجعة شاملة — اضغط للعب'
        ) : (
          `${level.name} — اضغط للعب`
        )}
      </TooltipContent>
    </Tooltip>
  )
}

/* ---------- قسم مرحلة تعليمية (أكورديون) ---------- */

interface StageSectionProps {
  stage: StageDef
  states: Map<number, LevelState>
  open: boolean
  onToggle: () => void
  numerals: 'western' | 'arabic'
  reducedMotion: boolean
  sectionIndex: number
  onOpenLevel: (level: LevelDef) => void
  registerRef: (id: number, el: HTMLDivElement | null) => void
  onKeyNav: (e: KeyboardEvent, id: number) => void
}

function StageSection({
  stage,
  states,
  open,
  onToggle,
  numerals,
  reducedMotion,
  sectionIndex,
  onOpenLevel,
  registerRef,
  onKeyNav,
}: StageSectionProps) {
  const done = stage.levels.filter((l) => states.get(l.id)?.completed).length
  const pct = Math.round((done / stage.levels.length) * 100)

  return (
    <motion.section
      initial={reducedMotion ? false : { y: 24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: sectionIndex * 0.1, duration: 0.4, ease: EXPO }}
      className="flex flex-col"
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="sticky top-16 z-10 flex w-full items-center gap-4 rounded-xl border border-space-700 bg-space-950/80 px-4 py-3 text-start backdrop-blur transition-colors hover:border-neon-cyan/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-neon-cyan font-hud text-lg text-neon-cyan shadow-[0_0_16px_rgba(34,211,238,.35)]">
          {formatNumber(stage.id, numerals)}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-baseline justify-between gap-3">
            <span className="truncate font-display text-[22px] font-bold text-ink-100">{stage.name}</span>
            <span className="shrink-0 font-hud text-sm text-ink-400">
              {formatNumber(done, numerals)}/{formatNumber(stage.levels.length, numerals)}
            </span>
          </span>
          <span className="truncate text-sm text-ink-400">{STAGE_DESCRIPTIONS[stage.id]}</span>
          <span className="mt-1 h-1 w-full overflow-hidden rounded-full bg-space-700">
            <motion.span
              className="block h-full rounded-full bg-neon-cyan shadow-[0_0_8px_rgba(34,211,238,.6)]"
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.5, ease: EXPO }}
            />
          </span>
        </span>
        <ChevronDown
          size={20}
          className={cn('shrink-0 text-ink-400 transition-transform duration-300', open && 'rotate-180 text-neon-cyan')}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="grid"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: EXPO }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-4 gap-3 pt-4 md:grid-cols-5 lg:grid-cols-7">
              {stage.levels.map((level, i) => (
                <LevelCell
                  key={level.id}
                  level={level}
                  state={states.get(level.id)!}
                  numerals={numerals}
                  reducedMotion={reducedMotion}
                  index={i}
                  onOpen={onOpenLevel}
                  registerRef={registerRef}
                  onKeyNav={onKeyNav}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  )
}

/* ---------- نافذة بطاقة المرحلة ---------- */

interface LevelDialogProps {
  level: LevelDef | null
  state: LevelState | null
  numerals: 'western' | 'arabic'
  onClose: () => void
  onStart: (id: number) => void
}

function LevelDialog({ level, state, numerals, onClose, onStart }: LevelDialogProps) {
  const p = state?.progress ?? null
  return (
    <Dialog open={level != null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="border-neon-cyan/40 bg-space-900 text-ink-100 sm:max-w-md">
        {level && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 font-display text-2xl text-ink-100">
                {level.isReview && <Trophy size={22} className="text-neon-magenta" />}
                <span>
                  المرحلة {formatNumber(level.id, numerals)} — {level.name}
                </span>
              </DialogTitle>
              <DialogDescription className="text-ink-400">
                {level.isReview ? 'مراجعة شاملة' : STAGE_DESCRIPTIONS[level.stage]}
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-3 py-2">
              <div className="flex items-center gap-2 rounded-lg border border-space-700 bg-space-800 px-3 py-2">
                <Gauge size={18} className="text-neon-cyan" />
                <span className="text-xs text-ink-400">الهدف</span>
                <span className="ms-auto font-hud text-neon-cyan">{formatNumber(level.targetWpm, numerals)}</span>
                <span className="text-[10px] text-ink-600">ك/د</span>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-space-700 bg-space-800 px-3 py-2">
                <Heart size={18} className="text-heart-red" />
                <span className="text-xs text-ink-400">القلوب</span>
                <span className="ms-auto font-hud text-ink-100">{formatNumber(level.rules.hearts ?? 3, numerals)}</span>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-space-700 bg-space-800 px-3 py-2">
                <Timer size={18} className="text-neon-amber" />
                <span className="text-xs text-ink-400">مؤقت الحرف</span>
                <span className="ms-auto font-hud text-ink-100">{formatNumber(level.rules.letterSeconds ?? 4, numerals)}</span>
                <span className="text-[10px] text-ink-600">ث</span>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-space-700 bg-space-800 px-3 py-2">
                <Hourglass size={18} className="text-neon-amber" />
                <span className="text-xs text-ink-400">مؤقت السطر</span>
                <span className="ms-auto font-hud text-ink-100">{formatNumber(level.rules.lineSeconds ?? 90, numerals)}</span>
                <span className="text-[10px] text-ink-600">ث</span>
              </div>
              <div className="col-span-2 flex items-center gap-2 rounded-lg border border-space-700 bg-space-800 px-3 py-2">
                <Zap size={18} className="text-neon-magenta" />
                <span className="text-xs text-ink-400">سرعة المركبات</span>
                <span className="ms-auto font-hud text-ink-100">{formatNumber(level.rules.enemySpeed ?? 1, numerals)}/10</span>
              </div>
            </div>

            <div className="rounded-lg border border-space-700 bg-space-800/60 px-4 py-3">
              {state?.completed && p ? (
                <div className="flex items-center justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-ink-400">أفضل سجل</span>
                    <StarRating stars={p.stars} size={18} />
                  </div>
                  <div className="flex flex-col items-end gap-1 text-sm">
                    <span className="text-ink-100">
                      <span className="font-hud">{formatNumber(p.bestWpm, numerals)}</span> ك/د · دقة{' '}
                      <span className="font-hud">{formatNumber(p.bestAcc, numerals)}٪</span>
                    </span>
                    <span className="text-xs text-ink-400">إعادة المرحلة ممكنة دائماً — يُحفظ أفضل سجل</span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-ink-400">لم تُلعب بعد — {STAR_RULES_TEXT}</p>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <NeonButton size="lg" className="flex-1" onClick={() => onStart(level.id)}>
                <Play size={18} />
                ابدأ المرحلة
              </NeonButton>
              <NeonButton size="lg" variant="ghost" onClick={onClose}>
                إلغاء
              </NeonButton>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

/* ---------- الصفحة ---------- */

export default function Levels() {
  const navigate = useNavigate()
  const { settings } = useSettings()
  const numerals = settings.numerals
  const reducedMotion = settings.reducedMotion

  const [progress] = useState(() => loadProgress())
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [bannerDismissed, setBannerDismissed] = useState(false)

  const states = useMemo(() => buildLevelStates(progress.levels), [progress.levels])

  const currentLevel = LEVELS.find((l) => states.get(l.id)?.isCurrent) ?? null
  const [openStageId, setOpenStageId] = useState<number>(() => currentLevel?.stage ?? 1)

  const completedCount = useMemo(() => LEVELS.filter((l) => states.get(l.id)?.completed).length, [states])
  const totalStars = useMemo(
    () => progress.levels.reduce((sum, l) => sum + (l.stars ?? 0), 0),
    [progress.levels],
  )
  const maxStars = TOTAL_LEVELS * 3
  const overallPct = Math.round((completedCount / TOTAL_LEVELS) * 100)

  /* تنقّل لوحة المفاتيح بين الخلايا (tabindex متنقّل) */
  const cellRefs = useRef(new Map<number, HTMLDivElement>())
  const registerRef = (id: number, el: HTMLDivElement | null) => {
    if (el) cellRefs.current.set(id, el)
    else cellRefs.current.delete(id)
  }
  const focusLevel = (id: number) => {
    const host = cellRefs.current.get(id)
    const target = host?.querySelector<HTMLElement>('[role="button"][tabindex="0"]') ?? host
    target?.focus()
  }
  const onKeyNav = (e: KeyboardEvent, id: number) => {
    const cols = 7
    let next: number | null = null
    // RTL: السهم الأيسر = للأمام في ترتيب القراءة
    if (e.key === 'ArrowLeft') next = id + 1
    else if (e.key === 'ArrowRight') next = id - 1
    else if (e.key === 'ArrowDown') next = id + cols
    else if (e.key === 'ArrowUp') next = id - cols
    if (next != null && next >= 1 && next <= TOTAL_LEVELS) {
      e.preventDefault()
      const target = LEVELS[next - 1]
      if (target && target.stage !== openStageId) setOpenStageId(target.stage)
      requestAnimationFrame(() => focusLevel(next!))
    }
  }

  const openLevel = (level: LevelDef) => {
    if (!states.get(level.id)?.unlocked) return
    audio.play('menuClick')
    setSelectedId(level.id)
  }
  const startLevel = (id: number) => {
    audio.play('menuClick')
    navigate(`/game/level/${id}`)
  }

  const selectedLevel = selectedId != null ? LEVELS[selectedId - 1] : null

  return (
    <TooltipProvider delayDuration={200}>
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8">
        {/* الشريط العلوي */}
        <header className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={() => navigate('/')}
            onMouseEnter={() => audio.play('menuHover')}
            className="flex items-center gap-2 rounded-full border border-space-700 px-4 py-2 text-sm font-bold text-ink-400 transition-colors hover:border-neon-cyan/50 hover:text-neon-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan"
          >
            <ArrowRight size={16} />
            القائمة الرئيسية
          </button>
          <div className="flex-1">
            <h1 className="font-display text-4xl font-black text-ink-100 text-glow-cyan">وضع المراحل</h1>
            <p className="text-sm text-ink-400">أنهِ كل مرحلة لفتح التالية — اجمع النجوم بإتقان</p>
          </div>
          <Panel glow="amber" className="flex items-center gap-2 px-4 py-2">
            <img src="/star-rating.svg" alt="نجمة" width={22} height={22} style={{ filter: 'drop-shadow(0 0 6px rgba(251,191,36,.7))' }} />
            <span className="font-hud text-xl text-neon-amber">{formatNumber(totalStars, numerals)}</span>
            <span className="text-xs text-ink-400">من {formatNumber(maxStars, numerals)}</span>
          </Panel>
        </header>

        {/* شريط التقدم الإجمالي */}
        <Panel glow="cyan-dim" className="flex flex-col gap-2 px-5 py-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-bold text-ink-100">
              التقدم الإجمالي:{' '}
              <span className="font-hud text-neon-cyan">
                {formatNumber(completedCount, numerals)}/{formatNumber(TOTAL_LEVELS, numerals)}
              </span>{' '}
              مرحلة
            </span>
            <span className="text-ink-400">
              النجوم:{' '}
              <span className="font-hud text-neon-amber">
                {formatNumber(totalStars, numerals)}/{formatNumber(maxStars, numerals)}
              </span>
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-space-700">
            <motion.div
              className="h-full rounded-full bg-neon-cyan shadow-[0_0_12px_rgba(34,211,238,.6)]"
              initial={{ width: 0 }}
              animate={{ width: `${overallPct}%` }}
              transition={{ duration: 0.8, ease: EXPO }}
            />
          </div>
          <p className="text-xs text-ink-600">{STAR_RULES_TEXT}</p>
        </Panel>

        {/* بطاقة اختبار تحديد المستوى */}
        <AnimatePresence>
          {!progress.placementDone && !bannerDismissed && (
            <motion.div
              key="placement-banner"
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0, marginBottom: -24 }}
              transition={{ duration: 0.3, ease: EXPO }}
              className="overflow-hidden"
            >
              <Panel glow="magenta" className="flex flex-wrap items-center gap-4 px-5 py-4">
                <Compass size={28} className="shrink-0 text-neon-magenta" />
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-ink-100">لا تعرف من أين تبدأ؟</p>
                  <p className="text-sm text-ink-400">خذ اختبار تحديد المستوى وسنفتح لك المرحلة المناسبة مباشرة</p>
                </div>
                <NeonButton size="md" onClick={() => navigate('/placement')}>
                  ابدأ الاختبار
                </NeonButton>
                <button
                  type="button"
                  aria-label="إغلاق"
                  onClick={() => setBannerDismissed(true)}
                  className="rounded-full p-1.5 text-ink-600 transition-colors hover:bg-space-700 hover:text-ink-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan"
                >
                  <X size={16} />
                </button>
              </Panel>
            </motion.div>
          )}
        </AnimatePresence>

        {/* أقسام المراحل التعليمية الخمس */}
        <div className="flex flex-col gap-8">
          {STAGES.map((stage, i) => (
            <StageSection
              key={stage.id}
              stage={stage}
              states={states}
              open={openStageId === stage.id}
              onToggle={() => setOpenStageId((prev) => (prev === stage.id ? prev : stage.id))}
              numerals={numerals}
              reducedMotion={reducedMotion}
              sectionIndex={i}
              onOpenLevel={openLevel}
              registerRef={registerRef}
              onKeyNav={onKeyNav}
            />
          ))}
        </div>

        <LevelDialog
          level={selectedLevel}
          state={selectedId != null ? states.get(selectedId) ?? null : null}
          numerals={numerals}
          onClose={() => setSelectedId(null)}
          onStart={startLevel}
        />
      </div>
    </TooltipProvider>
  )
}
