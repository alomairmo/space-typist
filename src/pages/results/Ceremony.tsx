import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { motion } from 'framer-motion'
import { ChevronLeft, Copy, Home, Map, Play, RotateCcw, Trophy } from 'lucide-react'
import NeonButton from '@/components/NeonButton'
import StarRating from '@/components/StarRating'
import ArcadeCard, { Panel } from '@/components/ArcadeCard'
import PerLineChart from '@/pages/results/PerLineChart'
import type { RunResult } from '@/pages/results/types'
import { DEFEAT_REASONS, MODE_NAMES } from '@/pages/results/types'
import type { LeaderboardEntry } from '@/lib/storage'
import { formatNumber } from '@/lib/format'
import { useSettings } from '@/context/SettingsContext'
import { audio } from '@/lib/audio'
import { cn } from '@/lib/utils'

gsap.registerPlugin(useGSAP)

const RANK_MEDALS = ['/medal-gold.svg', '/medal-silver.svg', '/medal-bronze.svg']
const RANK_GLOWS = [
  'drop-shadow(0 0 10px rgba(245,158,11,.8))',
  'drop-shadow(0 0 10px rgba(148,163,184,.7))',
  'drop-shadow(0 0 10px rgba(194,113,12,.7))',
]

export interface RankNeighbors {
  above?: LeaderboardEntry
  self?: LeaderboardEntry
  below?: LeaderboardEntry
}

export interface CeremonyProps {
  run: RunResult
  /** ترتيب الجولة (1-based) — قد يكون افتراضياً للبيانات التجريبية */
  rank: number
  neighbors: RankNeighbors
  /** أفضل نتيجة سابقة في نفس الطور (قبل هذه الجولة) */
  prevBest: number | null
  isNewBest: boolean
  stars: number
  targetWpm: number
  /** اسم المرحلة/سياق الجولة */
  contextLine: string
  /** المرحلة التالية المتاحة (مراحل/نصر فقط) */
  nextLevelId: number | null
  /** المرحلة الموصى بها (تحديد المستوى) */
  placementLevelId: number | null
  onShowBoard: () => void
}

interface StatDef {
  label: string
  value: number
  format: (v: number) => string
  suffix?: string
}

export default function Ceremony({
  run,
  rank,
  neighbors,
  prevBest,
  isNewBest,
  stars,
  targetWpm,
  contextLine,
  nextLevelId,
  placementLevelId,
  onShowBoard,
}: CeremonyProps) {
  const navigate = useNavigate()
  const { settings } = useSettings()
  const containerRef = useRef<HTMLDivElement>(null)
  const counterRefs = useRef<(HTMLSpanElement | null)[]>([])
  const rankRef = useRef<HTMLSpanElement>(null)
  const timelineRef = useRef<gsap.core.Timeline | null>(null)
  const [timelineDone, setTimelineDone] = useState(false)
  const [copied, setCopied] = useState(false)

  const victory = run.victory
  const reduced = settings.reducedMotion
  const fmtInt = (v: number) => formatNumber(Math.round(v).toLocaleString('en-US'), settings.numerals)
  const fmtPlain = (v: number) => formatNumber(Math.round(v), settings.numerals)

  const formatTime = (secs: number): string => {
    const s = Math.round(secs)
    if (s < 60) return `${fmtPlain(s)}ث`
    const m = Math.floor(s / 60)
    return `${fmtPlain(m)}:${String(s % 60).padStart(2, '0')}`
  }

  const stats: StatDef[] = [
    { label: 'النقاط', value: run.score, format: fmtInt },
    { label: 'السرعة', value: run.wpm, format: fmtPlain, suffix: 'ك/د' },
    { label: 'الدقة', value: run.accuracy, format: fmtPlain, suffix: '٪' },
    run.mode === 'arcade' && run.wave != null
      ? { label: 'الموجة', value: run.wave, format: fmtPlain }
      : { label: 'الوقت', value: run.timeTaken, format: formatTime },
  ]

  const delta = prevBest != null ? run.score - prevBest : null

  /* ---------- تسلسل المراسم (GSAP، ~2.2ث / 2.8ث هزيمة، قابل للتخطي) ---------- */
  useGSAP(
    () => {
      const tl = gsap.timeline({
        defaults: { ease: 'expo.out' },
        onComplete: () => setTimelineDone(true),
      })
      timelineRef.current = tl

      // 1) العنوان — كلمات متتابعة
      tl.from('.ceremony-word', { y: 30, opacity: 0, stagger: 0.05, duration: 0.6 })
      tl.from('.ceremony-context', { opacity: 0, y: 12, duration: 0.4 }, '-=0.25')

      // 2) أصوات النجوم متزامنة مع ظهور StarRating (0.4 + i*0.25)
      if (run.mode === 'levels' && victory) {
        for (let i = 0; i < stars; i++) {
          tl.call(() => audio.play(i === 2 ? 'countdownGo' : 'correct'), [], 0.4 + i * 0.25)
        }
      }

      // 3) بطاقات الإحصاءات + عدادات الأرقام
      tl.from('.stat-card-wrap', { y: 24, opacity: 0, stagger: 0.1, duration: 0.5 }, '-=0.15')
      stats.forEach((s, i) => {
        const el = counterRefs.current[i]
        if (!el) return
        const obj = { v: 0 }
        tl.to(
          obj,
          {
            v: s.value,
            duration: 0.9,
            ease: 'power2.out',
            onUpdate: () => {
              el.textContent = s.format(obj.v)
            },
          },
          i === 0 ? '<+0.1' : '<',
        )
      })
      // دقات العدّ
      tl.call(() => audio.play('timerTick'), [], '<')
      tl.call(() => audio.play('timerTick'), [], '<+0.3')
      tl.call(() => audio.play('timerTick'), [], '<+0.6')

      // 4) أشرطة مخطط الأسطر
      const bars = containerRef.current?.querySelectorAll<HTMLElement>('.line-bar-fill')
      if (bars && bars.length > 0) {
        tl.fromTo(
          bars,
          { width: 0 },
          {
            width: (_i, el) => `${(el as HTMLElement).dataset.pct ?? 0}%`,
            stagger: 0.08,
            duration: 0.5,
            ease: 'power2.out',
          },
          '-=0.5',
        )
      }

      // 5) بطاقة الترتيب: العدّ نحو الرتبة + دوران الميدالية
      tl.from('.rank-card-wrap', { y: 24, opacity: 0, duration: 0.5 }, '-=0.2')
      const rankEl = rankRef.current
      if (rankEl) {
        const obj = { v: rank + 9 }
        tl.to(
          obj,
          {
            v: rank,
            duration: 0.7,
            ease: 'power2.out',
            onUpdate: () => {
              rankEl.textContent = `#${fmtPlain(obj.v)}`
            },
          },
          '<+0.1',
        )
      }
      if (containerRef.current?.querySelector('.rank-medal')) {
        tl.from('.rank-medal', { rotation: -180, scale: 0, duration: 0.5, ease: 'back.out(1.7)' }, '<')
      }
      tl.call(() => audio.play('explosion'), [], '<') // طبل كشف الرتبة

      // 6) الأزرار
      tl.from('.ceremony-actions', { y: 16, opacity: 0, duration: 0.4 }, '-=0.2')

      // الصوت الرئيسي
      if (victory) tl.call(() => audio.play('levelClear'), [], 0)
      else {
        tl.call(() => audio.play('levelFail'), [], 0)
        tl.call(() => audio.play('wrong'), [], 0.9) // هدير منخفض
        tl.timeScale(2.2 / 2.8) // أبطأ في الهزيمة (~2.8ث)
      }

      if (reduced) tl.progress(1)

      return () => {
        tl.kill()
        timelineRef.current = null
      }
    },
    { scope: containerRef },
  )

  /* ---------- تخطي الحركة بأي مفتاح/نقرة ---------- */
  useEffect(() => {
    if (timelineDone) return
    const skip = () => timelineRef.current?.progress(1)
    window.addEventListener('pointerdown', skip)
    window.addEventListener('keydown', skip)
    return () => {
      window.removeEventListener('pointerdown', skip)
      window.removeEventListener('keydown', skip)
    }
  }, [timelineDone])

  /* ---------- نسخ النتيجة ---------- */
  const copyResult = async () => {
    const text = victory
      ? `سجّلت ${fmtInt(run.score)} نقطة بسرعة ${fmtPlain(run.wpm)} ك/د ودقة ${fmtPlain(run.accuracy)}٪ في مدفع الفضاء!`
      : `خضت معركة مدفع الفضاء وسجّلت ${fmtInt(run.score)} نقطة — تحدّاني إن استطعت!`
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // الحافظة غير متاحة — تجاهل
    }
  }

  /* ---------- أزرار حسب الطور ---------- */
  const replay = () => {
    if (run.mode === 'levels') navigate(`/game/levels?level=${run.levelId}`)
    else navigate(`/game/${run.mode}`)
  }

  const title = victory ? 'أحسنت أيها القائد!' : 'سقطت المركبة...'
  const titleWords = title.split(' ')

  return (
    <div
      ref={containerRef}
      className={cn('mx-auto flex w-full max-w-4xl flex-col items-center gap-8 px-4 py-12', !victory && 'saturate-[.6]')}
    >
      {/* الترويسة */}
      <header className="text-center">
        <h1
          className="font-display text-[40px] font-black leading-snug"
          style={{
            color: victory ? '#FBBF24' : '#F87171',
            textShadow: victory
              ? '0 0 12px rgba(251,191,36,.55), 0 0 40px rgba(251,191,36,.25)'
              : '0 0 12px rgba(248,113,113,.55), 0 0 40px rgba(248,113,113,.25)',
          }}
        >
          <span aria-hidden="true" className="ceremony-word inline-block">✦</span>{' '}
          {titleWords.map((w, i) => (
            <span key={i} className="ceremony-word inline-block">
              {w}
              {i < titleWords.length - 1 ? ' ' : ''}
            </span>
          ))}{' '}
          <span aria-hidden="true" className="ceremony-word inline-block">✦</span>
        </h1>
        <p className="ceremony-context mt-2 text-base text-ink-400">{contextLine}</p>
        {!victory && (
          <p className="ceremony-context mt-1 text-base text-ink-400">
            {DEFEAT_REASONS[run.reason ?? 'hearts']}
          </p>
        )}
      </header>

      {/* النجوم (طور المراحل فقط) */}
      {run.mode === 'levels' && (
        <div className="flex flex-col items-center gap-2">
          <StarRating stars={stars} size={64} animated={!reduced} />
          <ul className="mt-1 space-y-0.5 text-center text-xs text-ink-600">
            <li className={cn(stars >= 1 && 'text-good-glow')}>
              {stars >= 1 ? '✓' : '✗'} النجمة الأولى: إنهاء المرحلة
            </li>
            <li className={cn(stars >= 2 ? 'text-good-glow' : stars >= 1 && 'text-bad-glow')}>
              {stars >= 2 ? '✓' : '✗'} النجمة الثانية: دقة ≥ {fmtPlain(92)}٪
            </li>
            <li className={cn(stars >= 3 ? 'text-good-glow' : stars >= 1 && 'text-bad-glow')}>
              {stars >= 3 ? '✓' : '✗'} للنجمة الثالثة: دقة {fmtPlain(97)}٪+ وسرعة {fmtPlain(targetWpm)} ك/د
            </li>
          </ul>
        </div>
      )}

      {/* بطاقات الإحصاءات */}
      <div className="grid w-full grid-cols-2 gap-4 md:grid-cols-4">
        {stats.map((s, i) => (
          <div key={s.label} className="stat-card-wrap">
            <Panel glow="cyan-dim" className="flex h-full flex-col items-center gap-1 p-4 text-center">
              <span className="text-[13px] text-ink-400">{s.label}</span>
              <span className="font-hud text-[32px] font-bold leading-none text-ink-100" dir="ltr">
                <span ref={(el) => { counterRefs.current[i] = el }}>{s.format(0)}</span>
                {s.suffix && <span className="ms-1 text-base text-ink-400">{s.suffix}</span>}
              </span>
              {i === 0 && delta != null && !isNewBest && (
                <span className={cn('text-xs', delta >= 0 ? 'text-good-glow' : 'text-ink-600')}>
                  {delta >= 0 ? '▲' : '▼'} {delta >= 0 ? '+' : '−'}
                  {fmtInt(Math.abs(delta))} عن أفضل نتيجة
                </span>
              )}
              {i === 0 && isNewBest && prevBest != null && (
                <motion.span
                  animate={{ scale: [1, 1.08, 1] }}
                  transition={{ duration: 1.2, repeat: Infinity }}
                  className="rounded-full border border-neon-amber/50 bg-neon-amber/10 px-2 py-0.5 text-xs font-bold text-neon-amber"
                >
                  أفضل نتيجة جديدة!
                </motion.span>
              )}
              {i === 0 && prevBest == null && (
                <span className="text-xs text-ink-600">أول نتيجة في هذا الطور</span>
              )}
            </Panel>
          </div>
        ))}
      </div>

      {/* مخطط الأداء لكل سطر */}
      {run.lines && run.lines.length > 0 && (
        <Panel glow="none" className="w-full p-5">
          <PerLineChart lines={run.lines} targetWpm={targetWpm} />
        </Panel>
      )}

      {/* كشف الترتيب العام */}
      <div className="rank-card-wrap w-full max-w-lg">
        <ArcadeCard glow={rank <= 3 ? 'gold' : 'cyan'} className="cursor-default p-6 text-center">
          <div className="mb-1 flex items-center justify-center gap-2 text-sm font-bold text-ink-400">
            <Trophy className="h-4 w-4 text-neon-amber" aria-hidden="true" />
            ترتيبك العام في لوحة {MODE_NAMES[run.mode]}
          </div>
          <div className="flex items-center justify-center gap-3">
            <span ref={rankRef} className="font-hud text-5xl font-bold text-neon-cyan text-glow-cyan" dir="ltr">
              #{fmtPlain(rank + 9)}
            </span>
            {rank <= 3 && (
              <img
                src={RANK_MEDALS[rank - 1]}
                alt={`ميدالية المركز ${fmtPlain(rank)}`}
                width={44}
                height={44}
                className="rank-medal"
                style={{ filter: RANK_GLOWS[rank - 1] }}
              />
            )}
          </div>

          {isNewBest && prevBest != null && (
            <div className="relative mx-auto mt-3 inline-block overflow-hidden rounded-full border border-neon-amber/60 bg-neon-amber/10 px-4 py-1 text-sm font-bold text-neon-amber">
              رقم قياسي!
              <motion.span
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 w-1/3 bg-gradient-to-l from-transparent via-white/40 to-transparent"
                animate={{ x: ['220%', '-220%'] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'linear' }}
                style={{ right: 0 }}
              />
            </div>
          )}

          {/* الصفوف المحيطة بإدخال اللاعب */}
          {(neighbors.above || neighbors.self || neighbors.below) && (
            <div className="mt-4 space-y-1 text-sm">
              {neighbors.above && (
                <div className="flex items-center justify-between rounded-md px-3 py-1.5 text-ink-400">
                  <span className="flex items-center gap-2">
                    <span className="font-hud">{fmtPlain(rank - 1)}</span>
                    {neighbors.above.name}
                  </span>
                  <span className="font-hud">{fmtInt(neighbors.above.score)}</span>
                </div>
              )}
              {neighbors.self && (
                <motion.div
                  initial={{ backgroundColor: 'rgba(34,211,238,.35)' }}
                  animate={{ backgroundColor: 'rgba(34,211,238,.08)' }}
                  transition={{ duration: 1.4 }}
                  className="flex items-center justify-between rounded-md border border-neon-cyan/40 px-3 py-1.5 font-bold text-ink-100"
                >
                  <span className="flex items-center gap-2">
                    <span className="font-hud">{fmtPlain(rank)}</span>
                    {neighbors.self.name}
                    <span className="rounded-full bg-neon-cyan px-2 py-0.5 text-[10px] font-bold text-space-950">أنت</span>
                  </span>
                  <span className="font-hud text-neon-cyan">{fmtInt(neighbors.self.score)}</span>
                </motion.div>
              )}
              {neighbors.below && (
                <div className="flex items-center justify-between rounded-md px-3 py-1.5 text-ink-400">
                  <span className="flex items-center gap-2">
                    <span className="font-hud">{fmtPlain(rank + 1)}</span>
                    {neighbors.below.name}
                  </span>
                  <span className="font-hud">{fmtInt(neighbors.below.score)}</span>
                </div>
              )}
            </div>
          )}

          <button
            onClick={() => {
              audio.play('menuClick')
              onShowBoard()
            }}
            className="mt-4 text-sm font-bold text-neon-cyan underline-offset-4 hover:underline"
          >
            عرض لوحة الشرف كاملة ←
          </button>
        </ArcadeCard>
      </div>

      {/* الأزرار */}
      <div className="ceremony-actions flex flex-wrap items-center justify-center gap-3">
        {run.mode === 'levels' && victory && nextLevelId != null && (
          <motion.span animate={timelineDone && !reduced ? { scale: [1, 1.06, 1] } : false} transition={{ duration: 0.5 }}>
            <NeonButton variant="primary" size="lg" onClick={() => navigate(`/game/levels?level=${nextLevelId}`)}>
              المرحلة التالية
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </NeonButton>
          </motion.span>
        )}
        {run.mode === 'levels' && victory && nextLevelId == null && (
          <NeonButton variant="primary" size="lg" onClick={() => navigate('/levels')}>
            <Map className="h-5 w-5" aria-hidden="true" />
            خريطة المراحل
          </NeonButton>
        )}
        {run.mode === 'levels' && (
          <NeonButton variant={victory ? 'ghost' : 'primary'} size="lg" onClick={replay}>
            <RotateCcw className="h-5 w-5" aria-hidden="true" />
            {victory ? 'إعادة المرحلة' : 'إعادة المحاولة'}
          </NeonButton>
        )}
        {run.mode === 'arcade' && (
          <motion.span animate={timelineDone && !reduced ? { scale: [1, 1.06, 1] } : false} transition={{ duration: 0.5 }}>
            <NeonButton variant="primary" size="lg" onClick={replay}>
              <Play className="h-5 w-5" aria-hidden="true" />
              العب مجدداً
            </NeonButton>
          </motion.span>
        )}
        {run.mode === 'custom' && (
          <>
            <NeonButton variant="primary" size="lg" onClick={replay}>
              <RotateCcw className="h-5 w-5" aria-hidden="true" />
              إعادة بنفس الإعداد
            </NeonButton>
            <NeonButton variant="ghost" size="lg" onClick={() => navigate('/custom')}>
              تعديل الإعدادات
            </NeonButton>
          </>
        )}
        {run.mode === 'placement' && placementLevelId != null && (
          <NeonButton
            variant="primary"
            size="lg"
            onClick={() => navigate(`/game/levels?level=${placementLevelId}`)}
          >
            ابدأ من المرحلة {fmtPlain(placementLevelId)}
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </NeonButton>
        )}
        {run.mode === 'levels' && victory && nextLevelId != null && (
          <NeonButton variant="ghost" size="lg" onClick={() => navigate('/levels')}>
            <Map className="h-5 w-5" aria-hidden="true" />
            خريطة المراحل
          </NeonButton>
        )}
        <NeonButton variant="ghost" size="lg" onClick={() => navigate('/')}>
          <Home className="h-5 w-5" aria-hidden="true" />
          القائمة الرئيسية
        </NeonButton>
        <NeonButton variant="ghost" size="lg" onClick={copyResult} soundOnClick={!copied}>
          <Copy className="h-5 w-5" aria-hidden="true" />
          {copied ? 'تم النسخ!' : 'نسخ النتيجة'}
        </NeonButton>
      </div>
    </div>
  )
}
