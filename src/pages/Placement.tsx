import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, Gauge, LockOpen, Map as MapIcon, Play, RotateCcw, Star } from 'lucide-react'
import { Panel } from '@/components/ArcadeCard'
import NeonButton from '@/components/NeonButton'
import TypingLine from '@/components/TypingLine'
import HeartRow from '@/components/HeartRow'
import ClockGauge from '@/components/ClockGauge'
import CountdownOverlay from '@/components/CountdownOverlay'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useSettings } from '@/context/SettingsContext'
import { audio } from '@/lib/audio'
import { loadProgress, saveProgress } from '@/lib/storage'
import { getLevel, TOTAL_LEVELS } from '@/lib/curriculum'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  accuracyOf,
  buildPlacementRounds,
  computePlacement,
  emptyRoundStats,
  mergeStats,
  wpmOf,
} from '@/pages/placement/engine'
import type { PlacementResult, RoundStats } from '@/pages/placement/engine'
import StatGauge from '@/pages/placement/StatGauge'

const easeOutExpo = [0.16, 1, 0.3, 1] as [number, number, number, number]

/** قواعد مبسطة ثابتة — عدالة المقارنة بين الطلاب */
const PLACEMENT_HEARTS = 5
const LINE_SECONDS = 120

type Phase = 'intro' | 'banner' | 'countdown' | 'round' | 'intermission' | 'result'

/** فتح المراحل 1..n جماعياً — لا يقفل أي مرحلة مفتوحة سابقاً أبداً */
function unlockLevelsUpTo(n: number, markDone: boolean): void {
  const progress = loadProgress()
  const byId = new Map(progress.levels.map((l) => [l.id, l]))
  const levels = Array.from({ length: TOTAL_LEVELS }, (_, i) => {
    const id = i + 1
    const existing = byId.get(id)
    if (existing) return id <= n ? { ...existing, unlocked: true } : existing
    return { id, unlocked: id <= n, stars: 0, bestWpm: 0, bestAcc: 0, completedAt: null }
  })
  saveProgress({
    ...progress,
    levels,
    placementDone: markDone ? true : progress.placementDone,
    placementLevelId: Math.max(progress.placementLevelId ?? 0, n),
  })
}

export default function Placement() {
  const navigate = useNavigate()
  const { settings } = useSettings()
  const fmt = (n: number) => formatNumber(Math.round(n), settings.numerals)

  const rounds = useMemo(buildPlacementRounds, [])
  const [phase, setPhase] = useState<Phase>('intro')
  const [roundIdx, setRoundIdx] = useState(0)
  const [lineIdx, setLineIdx] = useState(0)
  const [typedCount, setTypedCount] = useState(0)
  const [lastWrongIndex, setLastWrongIndex] = useState<number | null>(null)
  const [hearts, setHearts] = useState(PLACEMENT_HEARTS)
  const [lineRemaining, setLineRemaining] = useState(LINE_SECONDS)
  const [roundStats, setRoundStats] = useState<RoundStats[]>([])
  const [result, setResult] = useState<PlacementResult | null>(null)
  const [abortOpen, setAbortOpen] = useState(false)

  const currentStatsRef = useRef<RoundStats>(emptyRoundStats())
  const roundStartRef = useRef(0)
  const wrongFlashRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const appliedUnlockRef = useRef(false)

  const round = rounds[roundIdx]!
  const line = round.lines[lineIdx] ?? ''
  const totalLines = round.lines.length

  const resetTest = useCallback(() => {
    setRoundIdx(0)
    setLineIdx(0)
    setTypedCount(0)
    setLastWrongIndex(null)
    setHearts(PLACEMENT_HEARTS)
    setLineRemaining(LINE_SECONDS)
    setRoundStats([])
    setResult(null)
    currentStatsRef.current = emptyRoundStats()
    appliedUnlockRef.current = false
  }, [])

  const startRound = useCallback((idx: number) => {
    setRoundIdx(idx)
    setLineIdx(0)
    setTypedCount(0)
    setLastWrongIndex(null)
    setLineRemaining(LINE_SECONDS)
    currentStatsRef.current = emptyRoundStats()
    setPhase('banner')
    audio.play('levelClear')
  }, [])

  /* ---------- تدفق المراحل ---------- */

  // لافتة الجولة: وميض مظلم + عنوان يكبر ثم يهدأ 800ms ← العد التنازلي
  useEffect(() => {
    if (phase !== 'banner') return
    const t = setTimeout(() => setPhase('countdown'), 900)
    return () => clearTimeout(t)
  }, [phase])

  const finalizeRound = useCallback(() => {
    const s = currentStatsRef.current
    const elapsed = roundStartRef.current > 0 ? Date.now() - roundStartRef.current : 0
    const done: RoundStats = { ...s, elapsedMs: Math.max(elapsed, s.elapsedMs) }
    setRoundStats((prev) => [...prev, done])
    return done
  }, [])

  const finishTest = useCallback(
    (stats: RoundStats[]) => {
      const merged = mergeStats(stats)
      const placement = computePlacement(wpmOf(merged), accuracyOf(merged))
      setResult(placement)
      setPhase('result')
      // تعظي النجاح: شريحة المحترف تحصل على أربجيو ممتد
      audio.play('levelClear')
      if (placement.band === 'محترف') {
        window.setTimeout(() => audio.play('levelClear'), 450)
      }
    },
    [],
  )

  const advanceLine = useCallback(() => {
    if (lineIdx + 1 < totalLines) {
      setLineIdx(lineIdx + 1)
      setTypedCount(0)
      setLineRemaining(LINE_SECONDS)
      return
    }
    // نهاية الجولة
    const done = finalizeRound()
    if (roundIdx + 1 < rounds.length) {
      setPhase('intermission')
    } else {
      finishTest([...roundStats, done])
    }
  }, [lineIdx, totalLines, finalizeRound, roundIdx, rounds.length, finishTest, roundStats])

  // بدء توقيت الجولة وعداد السطر
  useEffect(() => {
    if (phase !== 'round') return
    roundStartRef.current = Date.now()
    setLineRemaining(LINE_SECONDS)
    const iv = setInterval(() => {
      setLineRemaining((prev) => {
        if (prev <= 1) {
          // نفد عداد الجملة السخي — انتقال للسطر التالي بلا عقوبة دقة
          window.setTimeout(advanceLine, 0)
          return LINE_SECONDS
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(iv)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, roundIdx, lineIdx])

  /* ---------- إدخال الكتابة ---------- */

  useEffect(() => {
    if (phase !== 'round') return
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || abortOpen) return
      if (e.key === 'Escape') {
        e.preventDefault()
        setAbortOpen(true)
        return
      }
      if (e.key.length !== 1) return
      e.preventDefault()
      const chars = Array.from(line)
      const target = chars[typedCount]
      if (target == null) return
      if (e.key === target) {
        currentStatsRef.current.correctChars += 1
        audio.play('correct')
        const next = typedCount + 1
        setTypedCount(next)
        if (next >= chars.length) {
          window.setTimeout(advanceLine, 180)
        }
      } else {
        currentStatsRef.current.wrongChars += 1
        audio.play('wrong')
        audio.play('heartLoss')
        setLastWrongIndex(typedCount)
        if (wrongFlashRef.current) clearTimeout(wrongFlashRef.current)
        wrongFlashRef.current = setTimeout(() => setLastWrongIndex(null), 200)
        const nh = Math.max(0, hearts - 1)
        setHearts(nh)
        if (nh === 0) {
          // نفدت القلوب — ينتهي الاختبار مبكراً ويُحتسب ما قيسه الطالب
          const done = finalizeRound()
          window.setTimeout(() => finishTest([...roundStats, done]), 400)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, line, typedCount, hearts, abortOpen, advanceLine, finalizeRound, finishTest, roundStats])

  // Esc في اللافتة/العد أيضاً يفتح تأكيد الإلغاء
  useEffect(() => {
    if (phase !== 'banner' && phase !== 'countdown') return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbortOpen(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase])

  /* ---------- نتيجة الاختبار: فتح المراحل مرة واحدة ---------- */

  useEffect(() => {
    if (phase !== 'result' || !result || appliedUnlockRef.current) return
    appliedUnlockRef.current = true
    unlockLevelsUpTo(result.levelId, true)
    // شلال الأقفال المنفتحة
    for (let i = 0; i < 6; i++) {
      window.setTimeout(() => audio.play('lock'), 900 + i * 100)
    }
  }, [phase, result])

  const handleSkip = () => {
    audio.play('menuClick')
    unlockLevelsUpTo(1, true)
    navigate('/levels')
  }

  const abortTest = () => {
    setAbortOpen(false)
    resetTest()
    setPhase('intro')
  }

  const cumulative = mergeStats(roundStats)
  const liveWpm = wpmOf(cumulative)
  const liveAcc = accuracyOf(cumulative)
  const resultStats = result ? mergeStats(roundStats) : null
  const resultLevel = result ? getLevel(result.levelId) : undefined

  /* ================= الواجهات ================= */

  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-4 py-8">
      <AnimatePresence mode="wait">
        {/* ---------- شاشة المقدمة ---------- */}
        {phase === 'intro' && (
          <motion.div
            key="intro"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.35, ease: easeOutExpo }}
            className="w-full max-w-[560px]"
          >
            <Panel glow="cyan" className="flex flex-col items-center gap-6 p-6 sm:p-8">
              <motion.div
                initial={{ scale: 0.5, rotate: -90, opacity: 0 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.1 }}
                className="relative flex items-center justify-center"
              >
                <div className="absolute h-24 w-24 animate-[spin_16s_linear_infinite] rounded-full border border-dashed border-neon-cyan/40" />
                <div className="flex h-16 w-16 items-center justify-center rounded-full border border-neon-cyan/50 bg-space-900 shadow-[0_0_28px_rgba(34,211,238,.4)]">
                  <Gauge size={30} className="text-neon-cyan" />
                </div>
              </motion.div>

              <div className="text-center">
                <h1 className="font-display text-4xl font-black text-ink-100 text-glow-cyan">تحديد المستوى</h1>
                <p className="mt-2 leading-relaxed text-ink-400">
                  ثلاث جولات قصيرة تقيس سرعتك
                  <br />
                  ودقتك لتبدأ من المرحلة المناسبة
                </p>
              </div>

              {/* معاينة الجولات */}
              <div className="flex w-full flex-col gap-2">
                {rounds.map((r, i) => (
                  <motion.div
                    key={r.name}
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.25 + i * 0.08, duration: 0.35, ease: easeOutExpo }}
                    className="flex items-center gap-3 rounded-lg border border-space-700 bg-space-900/60 px-4 py-2.5"
                  >
                    <span className="font-hud flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-neon-cyan/60 text-sm font-bold text-neon-cyan shadow-[0_0_10px_rgba(34,211,238,.3)]">
                      {fmt(i + 1)}
                    </span>
                    <div>
                      <div className="text-sm font-bold text-ink-100">
                        الجولة {fmt(i + 1)}: {r.name}
                      </div>
                      <div className="text-[12px] text-ink-600">{r.micro}</div>
                    </div>
                  </motion.div>
                ))}
              </div>

              <p className="text-center text-[13px] leading-relaxed text-ink-400">
                قواعد مبسطة: ٥ قلوب · بدون عداد حرف
                <br />
                <span className="text-ink-600">
                  قواعد ثابتة لضمان عدالة المقارنة: {fmt(PLACEMENT_HEARTS)} قلوب · بدون عداد حرف · عداد جملة سخي (
                  {fmt(LINE_SECONDS)}ث) · الكاميرا متوقفة
                </span>
              </p>

              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.35 }}
                className="flex flex-wrap items-center justify-center gap-3"
              >
                <NeonButton size="lg" onClick={() => startRound(0)}>
                  <Play size={19} />
                  ابدأ الاختبار
                </NeonButton>
                <NeonButton size="lg" variant="ghost" onClick={handleSkip}>
                  تخطَّ إلى المرحلة 1
                </NeonButton>
              </motion.div>
            </Panel>
          </motion.div>
        )}

        {/* ---------- جولة الكتابة ---------- */}
        {phase === 'round' && (
          <motion.div
            key={`round-${roundIdx}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.35, ease: easeOutExpo }}
            className="w-full max-w-[720px]"
          >
            <Panel glow="cyan" className="flex flex-col items-center gap-6 p-6 sm:p-8">
              {/* شريط الحالة */}
              <div className="flex w-full flex-wrap items-center justify-between gap-3">
                <div className="text-sm font-bold text-ink-100">
                  الجولة {fmt(roundIdx + 1)} من {fmt(rounds.length)} — <span className="text-neon-cyan">{round.name}</span>
                  <span className="ms-2 text-xs text-ink-600">
                    السطر {fmt(lineIdx + 1)} من {fmt(totalLines)}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <HeartRow hearts={hearts} maxHearts={PLACEMENT_HEARTS} size={22} />
                  <ClockGauge remaining={lineRemaining} total={LINE_SECONDS} label="عداد الجملة" size={56} />
                </div>
              </div>

              {/* سطر الكتابة */}
              <div className="flex min-h-[120px] w-full items-center justify-center rounded-lg border border-space-700 bg-space-900/70 px-4 py-6">
                <TypingLine text={line} typedCount={typedCount} lastWrongIndex={lastWrongIndex} />
              </div>

              <p className="text-[13px] text-ink-600">
                اكتب السطر الظاهر — كل خطأ يكلّفك قلباً · <kbd className="rounded border border-space-700 bg-space-900 px-1.5 py-0.5 text-[11px] text-ink-400">Esc</kbd> لإلغاء الاختبار
              </p>
            </Panel>
          </motion.div>
        )}

        {/* ---------- إحصاءات ما بين الجولات ---------- */}
        {phase === 'intermission' && (
          <motion.div
            key={`inter-${roundIdx}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.35, ease: easeOutExpo }}
            className="w-full max-w-[560px]"
          >
            <Panel glow="cyan" className="flex flex-col items-center gap-5 p-8 text-center">
              <h2 className="font-display text-2xl font-black text-ink-100 text-glow-cyan">
                أحسنت! أنهيت الجولة {fmt(roundIdx + 1)}
              </h2>
              <div className="flex items-center gap-3 rounded-full border border-space-700 bg-space-900/70 px-5 py-2.5 text-sm">
                <span className="text-ink-400">
                  دقتك حتى الآن <span className="font-hud font-bold text-good-glow">{fmt(liveAcc)}٪</span>
                </span>
                <span className="text-ink-600">·</span>
                <span className="text-ink-400">
                  سرعتك <span className="font-hud font-bold text-neon-cyan">{fmt(liveWpm)}</span> ك/د
                </span>
              </div>
              <p className="text-[13px] text-ink-600">
                الجولة التالية: {rounds[roundIdx + 1]?.name}
              </p>
              <NeonButton size="lg" onClick={() => startRound(roundIdx + 1)}>
                متابعة
                <ChevronLeft size={18} />
              </NeonButton>
            </Panel>
          </motion.div>
        )}

        {/* ---------- شاشة النتيجة ---------- */}
        {phase === 'result' && result && resultStats && (
          <motion.div
            key="result"
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: easeOutExpo }}
            className="w-full max-w-[560px]"
          >
            <Panel glow={result.band === 'محترف' ? 'gold' : 'cyan'} className="flex flex-col items-center gap-6 p-6 sm:p-8">
              <motion.h1
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 18, delay: 0.15 }}
                className="text-center font-display text-[32px] font-black leading-snug text-ink-100"
              >
                نتيجتك: المستوى{' '}
                <span className={cn(result.bandColor, result.bandGlow)}>«{result.band}»</span>
              </motion.h1>

              {/* مقاييس الإحصاءات */}
              <div className="flex w-full items-start justify-around rounded-lg border border-space-700 bg-space-900/60 p-5">
                <StatGauge label="السرعة" value={wpmOf(resultStats)} max={60} suffix="ك/د" color="#22D3EE" delay={0.2} />
                <StatGauge label="الدقة" value={accuracyOf(resultStats)} max={100} suffix="٪" color="#4ADE80" delay={0.35} />
                <StatGauge label="الأخطاء" value={resultStats.wrongChars} max={30} color="#F87171" delay={0.5} />
              </div>

              {/* شلال فتح المراحل */}
              <div className="flex flex-col items-center gap-2">
                <div className="flex items-center gap-1.5">
                  {Array.from({ length: 6 }, (_, i) => (
                    <motion.span
                      key={i}
                      initial={{ scale: 0, rotate: -40, opacity: 0 }}
                      animate={{ scale: 1, rotate: 0, opacity: 1 }}
                      transition={{ delay: 0.9 + i * 0.1, type: 'spring', stiffness: 380, damping: 18 }}
                    >
                      <LockOpen size={18} className="text-neon-amber" />
                    </motion.span>
                  ))}
                </div>
                <motion.p
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.1 }}
                  className="text-center text-lg font-bold text-ink-100"
                >
                  تم فتح المراحل حتى: المرحلة {fmt(result.levelId)}{' '}
                  <Star size={16} className="inline text-neon-amber" fill="currentColor" />
                </motion.p>
                {resultLevel && (
                  <p className="text-[13px] text-ink-400">
                    {resultLevel.name} — {wpmOf(resultStats) > 0 && `سرعتك ${fmt(wpmOf(resultStats))} ك/د بدقة ${fmt(accuracyOf(resultStats))}٪`}
                  </p>
                )}
              </div>

              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.25 }}
                className="flex flex-wrap items-center justify-center gap-3"
              >
                <NeonButton size="lg" onClick={() => navigate(`/game/levels?level=${result.levelId}`)}>
                  ابدأ من المرحلة {fmt(result.levelId)}
                </NeonButton>
                <NeonButton
                  size="lg"
                  variant="ghost"
                  onClick={() => {
                    resetTest()
                    startRound(0)
                  }}
                >
                  <RotateCcw size={18} />
                  إعادة الاختبار
                </NeonButton>
              </motion.div>
              <p className="text-[13px] text-ink-400">
                أو اختر يدوياً من{' '}
                <Link to="/levels" className="inline-flex items-center gap-1 font-bold text-neon-cyan hover:underline">
                  <MapIcon size={14} />
                  خريطة المراحل
                </Link>
              </p>
            </Panel>
          </motion.div>
        )}
      </AnimatePresence>

      {/* لافتة الجولة: وميض مظلم + عنوان يتصاغر من ×2 مع توهج سماوي */}
      <AnimatePresence>
        {phase === 'banner' && (
          <motion.div
            key="banner"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[70] flex flex-col items-center justify-center gap-3 bg-space-950/85 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 2, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.8, ease: easeOutExpo }}
              className="text-center font-display text-4xl font-black text-neon-cyan text-glow-cyan"
            >
              الجولة {fmt(roundIdx + 1)} من {fmt(rounds.length)}
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-xl font-bold text-ink-100"
            >
              {round.name}
            </motion.div>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="text-sm text-ink-400">
              استعد...
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* العد التنازلي قبل كل جولة */}
      <CountdownOverlay
        active={phase === 'countdown' && !abortOpen}
        onDone={() => setPhase('round')}
      />

      {/* تأكيد إلغاء الاختبار */}
      <Dialog open={abortOpen} onOpenChange={setAbortOpen}>
        <DialogContent className="border-neon-cyan/30 bg-space-900" dir="rtl">
          <DialogHeader>
            <DialogTitle className="font-display text-ink-100">إلغاء الاختبار؟</DialogTitle>
            <DialogDescription className="text-ink-400">سيُلغى الاختبار ولن يُحفظ — لن يتغير تقدمك في المراحل.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-start">
            <NeonButton variant="danger" onClick={abortTest}>
              خروج
            </NeonButton>
            <NeonButton variant="ghost" onClick={() => setAbortOpen(false)}>
              متابعة الاختبار
            </NeonButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
