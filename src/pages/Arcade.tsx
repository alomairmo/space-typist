import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Camera,
  CameraOff,
  ChevronRight,
  Clock,
  Crown,
  Heart,
  Infinity as InfinityIcon,
  Rocket,
  Settings2,
  Timer,
  TrendingUp,
  Trophy,
  Waves,
  Zap,
} from 'lucide-react'
import { Panel } from '@/components/ArcadeCard'
import NeonButton from '@/components/NeonButton'
import SegmentedControl from '@/components/SegmentedControl'
import CountdownOverlay from '@/components/CountdownOverlay'
import { useSettings } from '@/context/SettingsContext'
import { loadLastRun, loadLeaderboard } from '@/lib/storage'
import type { LeaderboardEntry } from '@/lib/storage'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import { audio } from '@/lib/audio'

/** صعوبة الانطلاق في طور الأركيد — تُخزن للجلسة ويقرأها محرك اللعب /game/arcade */
export type ArcadeDifficulty = 'easy' | 'normal' | 'hard'
export const ARCADE_DIFFICULTY_KEY = 'space-typist:v1:arcade-difficulty'

const easeOutExpo = [0.16, 1, 0.3, 1] as [number, number, number, number]

const DIFFICULTY_HINTS: Record<ArcadeDifficulty, string> = {
  easy: 'يبدأ من موجة أبطأ · قلوب +1',
  normal: 'الافتراضي من الإعدادات',
  hard: 'سرعة أعلى · نقاط ×1.25',
}

const RULE_BULLETS = [
  { icon: InfinityIcon, text: 'جمل عشوائية تتدرج في الصعوبة' },
  { icon: TrendingUp, text: 'كل موجة أسرع من سابقتها' },
  { icon: Trophy, text: 'عند الخسارة يُسجَّل ترتيبك في لوحة الشرف' },
]

/** منحنى التدرج اللانهائي — شرح أطوار الموجات */
const WAVE_TIERS = [
  { icon: Waves, text: 'الموجات 1–3: كلمات الصف الرئيسي · مهلة حرف أرحم +50٪' },
  { icon: Waves, text: 'الموجات 4–7: كلمات الأبجدية الكاملة' },
  { icon: Zap, text: 'الموجات 8–12: جمل كاملة مع ترقيم' },
  { icon: Zap, text: 'الموجات 13+: أرقام ورموز · سفن نخبة (ضربتان) كل 3 موجات' },
  { icon: Crown, text: 'كل 5 موجات: سفينة أم (3 ضربات · ‎+500 نقطة)' },
]

function loadSessionDifficulty(): ArcadeDifficulty {
  try {
    const v = sessionStorage.getItem(ARCADE_DIFFICULTY_KEY)
    if (v === 'easy' || v === 'normal' || v === 'hard') return v
  } catch {
    /* تجاهل */
  }
  return 'normal'
}

function formatDayMonth(dateIso: string): string {
  const d = new Date(dateIso)
  if (Number.isNaN(d.getTime())) return ''
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function Arcade() {
  const navigate = useNavigate()
  const { settings, rules } = useSettings()
  const [difficulty, setDifficulty] = useState<ArcadeDifficulty>(loadSessionDifficulty)
  const [launching, setLaunching] = useState(false)
  const [flash, setFlash] = useState(false)

  const fmt = (n: number) => formatNumber(Math.round(n), settings.numerals)

  const arcadeEntries = useMemo(
    () =>
      loadLeaderboard()
        .entries.filter((e) => e.mode === 'arcade')
        .sort((a, b) => b.score - a.score),
    [],
  )
  const top3 = arcadeEntries.slice(0, 3)
  const personalBest = arcadeEntries[0]?.score ?? 0
  const lastRun = useMemo(() => loadLastRun(), [])
  const justSetRecord = lastRun?.mode === 'arcade' && lastRun.isNewBest

  // حفظ اختيار الصعوبة للجلسة
  useEffect(() => {
    try {
      sessionStorage.setItem(ARCADE_DIFFICULTY_KEY, difficulty)
    } catch {
      /* تجاهل */
    }
  }, [difficulty])

  const start = () => {
    if (launching) return
    audio.ensureContext()
    setLaunching(true)
  }

  const onCountdownDone = () => {
    setFlash(true)
    window.setTimeout(() => navigate('/game/arcade'), 170)
  }

  // لوحة المفاتيح: 1/2/3 للصعوبة، Enter للانطلاق
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (launching) return
      if (e.key === '1') setDifficulty('easy')
      else if (e.key === '2') setDifficulty('normal')
      else if (e.key === '3') setDifficulty('hard')
      else if (e.key === 'Enter') start()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [launching])

  // حبوب القواعد الحالية من الإعدادات
  const rulePills = [
    {
      icon: Heart,
      text: `${fmt(rules.hearts)} ${rules.hearts === 1 ? 'قلب' : rules.hearts === 2 ? 'قلبان' : 'قلوب'}`,
      hint: 'القلوب: عدد الأخطاء المسموح بها قبل نهاية الجولة',
      danger: rules.hearts === 1,
    },
    {
      icon: Timer,
      text: rules.letterTimer.enabled ? `عداد حرف ${fmt(rules.letterTimer.seconds)}ث` : 'بدون عداد حرف',
      hint: 'عداد الحرف: مهلة لكتابة كل حرف قبل هجوم المركبات',
      danger: rules.letterTimer.enabled && rules.letterTimer.seconds <= 2,
    },
    {
      icon: Clock,
      text: rules.levelTimer.enabled ? `عداد جملة ${fmt(rules.levelTimer.seconds)}ث` : 'بدون عداد جملة',
      hint: 'عداد الجملة: مهلة إجمالية لكل موجة — عند نفادها تهجم كل المركبات',
      danger: false,
    },
    {
      icon: rules.camera.enabled ? Camera : CameraOff,
      text: rules.camera.enabled ? 'كاميرا: تعمل' : 'كاميرا: مغلقة',
      hint: 'الكاميرا: ترصد النظر إلى لوحة المفاتيح وتحذّرك (تُعالج محلياً فقط)',
      danger: false,
    },
  ]

  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-4 py-8">
      {/* الشريط العلوي: رجوع + العنوان + شريحة أفضل نتيجة */}
      <div className="flex w-full items-center justify-between gap-3">
        <Link
          to="/"
          className="inline-flex items-center gap-1 rounded-full border border-space-700 px-3 py-1.5 text-sm font-bold text-ink-400 transition-colors hover:border-neon-cyan/50 hover:text-neon-cyan"
        >
          <ChevronRight size={16} />
          رجوع
        </Link>
        <h1 className="font-display text-2xl font-black text-ink-100 text-glow-magenta sm:text-3xl">طور الأركيد</h1>
        <motion.div
          initial={justSetRecord ? { scale: 0.6 } : false}
          animate={justSetRecord ? { scale: [0.6, 1.15, 1] } : undefined}
          transition={{ duration: 0.6, ease: easeOutExpo }}
          className={cn(
            'inline-flex items-center gap-2 rounded-full border px-3 py-1.5',
            justSetRecord ? 'border-neon-amber/60 bg-neon-amber/10' : 'border-space-700 bg-space-900/60',
          )}
          title="أفضل نتيجة شخصية في طور الأركيد"
        >
          <Trophy size={16} className={justSetRecord ? 'text-neon-amber' : 'text-ink-400'} />
          <span className={cn('font-hud text-sm font-bold', justSetRecord ? 'text-neon-amber' : 'text-ink-100')} dir="ltr">
            {fmt(personalBest)}
          </span>
        </motion.div>
      </div>

      {/* البطاقة الرئيسية */}
      <motion.div
        initial={{ scale: 0.94, y: 20, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={{ duration: 0.4, ease: easeOutExpo, delay: 0.1 }}
        className="w-full max-w-[620px]"
      >
        <Panel glow="magenta" className="flex flex-col items-center gap-6 p-6 sm:p-8">
          {/* أيقونة الصاروخ مع حلقة دوارة وتوهج أرجواني */}
          <div className="relative mt-1 flex items-center justify-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
              className="absolute h-24 w-24 rounded-full border border-dashed border-neon-magenta/40"
            />
            <motion.div
              animate={{ boxShadow: ['0 0 18px rgba(232,121,249,.35)', '0 0 38px rgba(232,121,249,.6)', '0 0 18px rgba(232,121,249,.35)'] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              className="flex h-16 w-16 items-center justify-center rounded-full border border-neon-magenta/50 bg-space-900"
            >
              <Rocket size={30} className="text-neon-magenta" />
            </motion.div>
          </div>

          <h2 className="text-center font-display text-3xl font-black leading-snug text-ink-100 text-glow-magenta">
            موجات لا تنتهي... كم تصمد؟
          </h2>

          {/* كيف يعمل */}
          <div className="w-full">
            <h3 className="mb-2 text-base font-bold text-ink-100">كيف يعمل:</h3>
            <ul className="flex flex-col gap-2">
              {RULE_BULLETS.map((b, i) => (
                <motion.li
                  key={b.text}
                  initial={{ x: 16, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.25 + i * 0.08, duration: 0.35, ease: easeOutExpo }}
                  className="flex items-center gap-2.5 text-[15px] text-ink-100"
                >
                  <b.icon size={18} className="shrink-0 text-neon-cyan" />
                  {b.text}
                </motion.li>
              ))}
            </ul>
          </div>

          {/* منحنى التدرج اللانهائي */}
          <div className="w-full rounded-lg border border-space-700 bg-space-900/60 p-4">
            <h3 className="mb-2 flex items-center gap-2 text-base font-bold text-ink-100">
              <TrendingUp size={17} className="text-neon-magenta" />
              منحنى الموجات — بلا نهاية
            </h3>
            <ul className="flex flex-col gap-1.5">
              {WAVE_TIERS.map((t, i) => (
                <motion.li
                  key={t.text}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + i * 0.06, duration: 0.3 }}
                  className="flex items-center gap-2 text-[13px] text-ink-400"
                >
                  <t.icon size={14} className="shrink-0 text-neon-cyan/80" />
                  {t.text}
                </motion.li>
              ))}
            </ul>
            <p className="mt-2 border-t border-space-700/70 pt-2 text-[12px] text-ink-600">
              كل موجة: هبوط المركبات +8٪ · سرعة الطلقات +6٪ · عداد الحرف −4٪ (أدناه 1.5ث) · عداد الجملة −3٪ (أدناه 25ث)
            </p>
          </div>

          {/* نقطة الانطلاق */}
          <div className="w-full">
            <SegmentedControl<ArcadeDifficulty>
              label="نقطة الانطلاق:"
              options={[
                { value: 'easy', label: 'سهل' },
                { value: 'normal', label: 'عادي' },
                { value: 'hard', label: 'صعب' },
              ]}
              value={difficulty}
              onValueChange={setDifficulty}
            />
            <p className="text-center text-[13px] text-ink-400">{DIFFICULTY_HINTS[difficulty]}</p>
          </div>

          {/* القواعد الحالية */}
          <div className="w-full">
            <div className="flex flex-wrap items-center justify-center gap-2">
              {rulePills.map((p, i) => (
                <motion.span
                  key={p.text}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 + i * 0.08, duration: 0.3 }}
                  title={p.hint}
                  className={cn(
                    'inline-flex cursor-help items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-bold',
                    p.danger
                      ? 'border-neon-amber/60 bg-neon-amber/10 text-neon-amber shadow-[0_0_12px_rgba(251,191,36,.25)]'
                      : 'border-space-700 bg-space-900/70 text-ink-100',
                  )}
                >
                  <p.icon size={14} className={p.danger ? 'text-neon-amber' : 'text-neon-cyan'} />
                  {p.text}
                  {p.danger && <span className="text-[11px]">· وضع صعب</span>}
                </motion.span>
              ))}
            </div>
            <div className="mt-2 text-center">
              <Link
                to="/settings"
                className="inline-flex items-center gap-1 text-[13px] font-bold text-neon-cyan underline-offset-4 transition-colors hover:text-good-glow hover:underline"
              >
                <Settings2 size={14} />
                تعديل القواعد في الإعدادات
              </Link>
            </div>
          </div>

          {/* زر الانطلاق */}
          <motion.div
            animate={{ scale: [1, 1.03, 1] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            <NeonButton size="xl" onClick={start} className="group shadow-[0_0_24px_rgba(34,211,238,.25)]">
              <motion.span
                className="inline-flex"
                whileHover={{ rotate: [0, -8, 8, 0] }}
                transition={{ duration: 0.4 }}
              >
                <Rocket size={22} />
              </motion.span>
              ابدأ الانطلاق
            </NeonButton>
          </motion.div>

          {/* أفضل 3 جولات */}
          <div className="w-full">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-base font-bold text-ink-100">
                <Trophy size={17} className="text-neon-amber" />
                أفضل 3 جولات:
              </h3>
              <Link to="/results" className="text-[13px] font-bold text-neon-cyan hover:underline">
                عرض الكل
              </Link>
            </div>
            {top3.length === 0 ? (
              <p className="rounded-lg border border-space-700 bg-space-900/60 p-4 text-center text-[13px] text-ink-400">
                لا جولات مسجلة بعد — كن أول من يخلّد اسمه في لوحة الشرف!
              </p>
            ) : (
              <ol className="flex flex-col gap-1.5">
                {top3.map((e: LeaderboardEntry, i: number) => (
                  <motion.li
                    key={e.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 + i * 0.1, duration: 0.3 }}
                    className={cn(
                      'relative flex items-center gap-3 overflow-hidden rounded-lg border px-3 py-2 text-sm',
                      i === 0 ? 'border-neon-amber/50 bg-neon-amber/5' : 'border-space-700 bg-space-900/60',
                    )}
                  >
                    {i === 0 && (
                      <motion.span
                        initial={{ x: '120%' }}
                        animate={{ x: '-120%' }}
                        transition={{ delay: 1.1, duration: 0.9, ease: 'easeInOut' }}
                        className="pointer-events-none absolute inset-y-0 w-1/3 bg-gradient-to-l from-transparent via-neon-amber/25 to-transparent"
                      />
                    )}
                    <span
                      className={cn(
                        'font-hud w-6 text-center font-bold',
                        i === 0 ? 'text-neon-amber' : i === 1 ? 'text-slate-300' : 'text-orange-400',
                      )}
                    >
                      {fmt(i + 1)}
                    </span>
                    <span className="font-hud font-bold text-neon-cyan" dir="ltr">
                      {fmt(e.score)}
                    </span>
                    <span className="text-ink-400">—</span>
                    <span className="text-ink-100">{e.wave != null ? `الموجة ${fmt(e.wave)}` : 'موجة غير مسجلة'}</span>
                    <span className="text-ink-400">—</span>
                    <span className="font-hud text-xs text-ink-600" dir="ltr">
                      {formatDayMonth(e.date)}
                    </span>
                    <span className="ms-auto max-w-[110px] truncate text-xs text-ink-600">{e.name}</span>
                  </motion.li>
                ))}
              </ol>
            )}
          </div>
        </Panel>
      </motion.div>

      {/* العد التنازلي ثم وميض الانتقال */}
      <CountdownOverlay active={launching && !flash} onDone={onCountdownDone} />
      <AnimatePresence>
        {flash && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.9, 0] }}
            transition={{ duration: 0.15 }}
            className="pointer-events-none fixed inset-0 z-[90] bg-neon-cyan"
            aria-hidden="true"
          />
        )}
      </AnimatePresence>
    </div>
  )
}
