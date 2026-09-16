import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Gauge,
  Map,
  Maximize,
  Pencil,
  Rocket,
  Settings as SettingsIcon,
  SlidersHorizontal,
  Trophy,
  Volume2,
  VolumeX,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import ArcadeCard from '@/components/ArcadeCard'
import type { GlowColor } from '@/components/ArcadeCard'
import NeonButton from '@/components/NeonButton'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useSettings } from '@/context/SettingsContext'
import { audio } from '@/lib/audio'
import {
  loadCustomPresets,
  loadLastRun,
  loadLeaderboard,
  loadPlayer,
  loadProgress,
  savePlayer,
} from '@/lib/storage'
import { getLevel, TOTAL_LEVELS } from '@/lib/curriculum'
import { formatNumber } from '@/lib/format'

const MenuStars = lazy(() => import('@/components/MenuStars'))

interface ModeCard {
  title: string
  icon: LucideIcon
  glow: GlowColor
  route: string
  description: string
  stat: string
}

const MODE_LABEL: Record<string, string> = {
  arcade: 'أركيد',
  levels: 'مراحل',
  custom: 'مخصص',
  placement: 'تحديد المستوى',
}

function supportsWebGL(): boolean {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') ?? c.getContext('webgl'))
  } catch {
    return false
  }
}

const easeOutExpo = [0.16, 1, 0.3, 1] as [number, number, number, number]

export default function Home() {
  const navigate = useNavigate()
  const { settings, updateSettings } = useSettings()
  const [player, setPlayer] = useState(() => loadPlayer())
  const [lastRun] = useState(() => loadLastRun())
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState(player.name)
  const [welcomeOpen, setWelcomeOpen] = useState(!player.welcomed)
  const [introSkipped, setIntroSkipped] = useState(false)
  const [webgl] = useState(supportsWebGL)
  const nameInputRef = useRef<HTMLInputElement>(null)

  const reduced = settings.reducedMotion

  const stats = useMemo(() => {
    const lb = loadLeaderboard().entries
    const progress = loadProgress()
    const presets = loadCustomPresets().presets
    const bestScore = lb.length ? Math.max(...lb.map((e) => e.score)) : 0
    const topWpm = lb.length ? Math.max(...lb.map((e) => e.wpm)) : 0
    const completed = progress.levels.filter((l) => l.stars > 0).length
    const stars = progress.levels.reduce((s, l) => s + l.stars, 0)
    const placementLevel = progress.placementLevelId != null ? getLevel(progress.placementLevelId) : undefined
    return { bestScore, topWpm, completed, stars, presetCount: presets.length, progress, placementLevel }
  }, [])

  const fmt = (n: number) => formatNumber(Math.round(n), settings.numerals)

  const cards: ModeCard[] = [
    {
      title: 'طور الأركيد',
      icon: Rocket,
      glow: 'magenta',
      route: '/arcade',
      description: 'جمل عشوائية تتدرج في الصعوبة والسرعة بلا نهاية — كم موجة تصمد؟',
      stat: `أفضل نتيجة: ${fmt(stats.bestScore)}`,
    },
    {
      title: 'وضع المراحل',
      icon: Map,
      glow: 'cyan',
      route: '/levels',
      description: 'تدرّج من الصفر إلى الاحتراف وفق منهج الطباعة المعتمد',
      stat: `${fmt(stats.completed)}/${fmt(TOTAL_LEVELS)} مرحلة · ${fmt(stats.stars)}★`,
    },
    {
      title: 'تحديد المستوى',
      icon: Gauge,
      glow: 'amber',
      route: '/placement',
      description: 'اختبار قصير يقيس سرعتك ودقتك ويفتح المرحلة المناسبة لك',
      stat: stats.progress.placementDone && stats.placementLevel ? `مستواك: ${stats.placementLevel.name}` : 'لم يُجرَ بعد',
    },
    {
      title: 'الطور المخصص',
      icon: SlidersHorizontal,
      glow: 'cyan-dim',
      route: '/custom',
      description: 'عدّل كل شيء: التوقيتات، الصحة، الكاميرا، المحتوى',
      stat: `${fmt(stats.presetCount)} إعداد محفوظ`,
    },
    {
      title: 'لوحة النتائج',
      icon: Trophy,
      glow: 'gold',
      route: '/results',
      description: 'ترتيبك العام وأفضل الجولات في كل طور',
      stat: `أعلى سرعة: ${fmt(stats.topWpm)} ك/د`,
    },
  ]

  const launch = (route: string) => {
    audio.play('menuClick')
    navigate(route)
  }

  // تنقل لوحة المفاتيح: الأرقام 1–5 تشغّل الأطوار، وأي زر يتخطى المقدمة
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (welcomeOpen) return
      setIntroSkipped(true)
      const n = Number(e.key)
      if (n >= 1 && n <= 5) {
        const card = cards[n - 1]
        if (card) launch(card.route)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [welcomeOpen, navigate])

  const saveName = (name: string) => {
    const trimmed = name.trim() || 'قائد المجرّة'
    const next = { ...player, name: trimmed, welcomed: true }
    setPlayer(next)
    savePlayer(next)
    setNameDraft(trimmed)
  }

  const toggleFullscreen = () => {
    audio.play('menuClick')
    if (document.fullscreenElement) void document.exitFullscreen()
    else void document.documentElement.requestFullscreen().catch(() => undefined)
  }

  const toggleMute = () => {
    audio.ensureContext()
    updateSettings({ audio: { ...settings.audio, muted: !settings.audio.muted } })
    audio.play('menuClick')
  }

  const titleWords = ['مدفع', 'الفضاء']

  return (
    <div className="relative flex min-h-[100dvh] flex-col overflow-x-hidden">
      {/* الخلفية: سديم ثابت + نجوم ثلاثية الأبعاد (أو بديل متكرر) */}
      <div
        className="pointer-events-none fixed inset-0 z-[1] bg-cover bg-center brightness-50"
        style={{ backgroundImage: 'url(/menu-hero-bg.png)' }}
        aria-hidden="true"
      />
      {webgl ? (
        <Suspense fallback={<div className="stars-fallback pointer-events-none fixed inset-0 z-[2] opacity-70" aria-hidden="true" />}>
          <MenuStars />
        </Suspense>
      ) : (
        <div className="stars-fallback pointer-events-none fixed inset-0 z-[2] opacity-70" aria-hidden="true" />
      )}
      <div className="bg-nebula pointer-events-none fixed inset-0 z-[3]" aria-hidden="true" />

      <motion.div
        className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pb-6"
        initial={reduced || introSkipped ? false : 'hidden'}
        animate="show"
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08 } } }}
      >
        {/* الشريط العلوي */}
        <header className="flex h-16 items-start justify-between gap-4 pt-3">
          <div>
            <div className="flex items-center gap-3">
              <motion.img
                src="/logo.svg"
                alt="شعار مدفع الفضاء"
                draggable={false}
                className="w-[120px] sm:w-[200px]"
                variants={{ hidden: { y: 30, opacity: 0 }, show: { y: 0, opacity: 1, transition: { duration: 0.5, ease: easeOutExpo } } }}
              />
              <h1 className="font-display text-[28px] font-black leading-none text-ink-100 text-glow-cyan" aria-label="مدفع الفضاء">
                {titleWords.map((word, i) => (
                  <motion.span
                    key={word}
                    className="inline-block"
                    variants={{
                      hidden: { y: 30, opacity: 0 },
                      show: { y: 0, opacity: 1, transition: { duration: 0.5, ease: easeOutExpo, delay: 0.1 + i * 0.05 } },
                    }}
                  >
                    {word}
                    {i < titleWords.length - 1 ? ' ' : ''}
                  </motion.span>
                ))}
              </h1>
            </div>
            <motion.p
              className="mt-1 text-base font-medium text-ink-400"
              variants={{ hidden: { y: 16, opacity: 0 }, show: { y: 0, opacity: 1, transition: { duration: 0.4, ease: easeOutExpo, delay: 0.3 } } }}
            >
              تعلّم الطباعة باللمس بالعربية... وادفع عن المجرّة بأصابعك
            </motion.p>
          </div>
          <motion.div
            className="flex shrink-0 items-center gap-2"
            variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { delay: 0.5 } } }}
          >
            <button
              onClick={() => launch('/settings')}
              className="rounded-full border border-space-700 bg-space-900/70 p-2.5 text-ink-400 transition-all hover:-translate-y-0.5 hover:border-neon-cyan/50 hover:text-neon-cyan"
              aria-label="الإعدادات"
            >
              <SettingsIcon size={20} />
            </button>
            <button
              onClick={toggleMute}
              className="rounded-full border border-space-700 bg-space-900/70 p-2.5 text-ink-400 transition-all hover:-translate-y-0.5 hover:border-neon-cyan/50 hover:text-neon-cyan"
              aria-label={settings.audio.muted ? 'إلغاء كتم الصوت' : 'كتم الصوت'}
            >
              {settings.audio.muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
            </button>
            <button
              onClick={toggleFullscreen}
              className="rounded-full border border-space-700 bg-space-900/70 p-2.5 text-ink-400 transition-all hover:-translate-y-0.5 hover:border-neon-cyan/50 hover:text-neon-cyan"
              aria-label="ملء الشاشة"
            >
              <Maximize size={20} />
            </button>
          </motion.div>
        </header>

        {/* بطاقات الأطوار */}
        <div className="mt-8 grid flex-1 grid-cols-1 content-center gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card, i) => {
            const Icon = card.icon
            return (
              <motion.div
                key={card.route}
                variants={{
                  hidden: { y: 40, opacity: 0 },
                  show: { y: 0, opacity: 1, transition: { duration: 0.5, ease: easeOutExpo, delay: 0.5 + i * 0.08 } },
                }}
              >
                <ArcadeCard glow={card.glow} onClick={() => launch(card.route)} className="group relative h-[200px] w-full p-5">
                  {/* شارة التشغيل السريع */}
                  <span className="absolute left-3 top-3 flex h-6 w-6 items-center justify-center rounded-full border border-space-700 bg-space-900 font-hud text-xs font-bold text-ink-600">
                    {formatNumber(i + 1, settings.numerals)}
                  </span>
                  <div className="flex h-full flex-col">
                    <div className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-full border border-current bg-space-900/60 transition-transform duration-200 group-hover:rotate-[8deg]"
                      style={{
                        color:
                          card.glow === 'magenta' ? '#E879F9' : card.glow === 'amber' || card.glow === 'gold' ? '#FBBF24' : '#22D3EE',
                        boxShadow: `0 0 18px ${card.glow === 'magenta' ? 'rgba(232,121,249,.3)' : card.glow === 'amber' || card.glow === 'gold' ? 'rgba(251,191,36,.3)' : 'rgba(34,211,238,.3)'}`,
                      }}
                    >
                      <Icon size={28} />
                    </div>
                    <h2 className="font-display text-2xl font-bold text-ink-100">{card.title}</h2>
                    <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-ink-400">{card.description}</p>
                    <div className="mt-auto flex items-center justify-between pt-2">
                      <span className="text-xs text-ink-600">{card.stat}</span>
                      <span className="translate-x-2 font-bold text-neon-cyan opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100">
                        ابدأ ←
                      </span>
                    </div>
                  </div>
                </ArcadeCard>
              </motion.div>
            )
          })}
        </div>

        {/* الشريط السفلي */}
        <motion.div
          className="mt-6 flex flex-wrap items-center justify-between gap-3"
          variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { delay: 1.1 } } }}
        >
          <div className="flex items-center gap-3">
            <AnimatePresence>
              {lastRun && (
                <motion.button
                  onClick={() => launch(lastRun.mode === 'arcade' ? '/arcade' : `/${lastRun.mode}`)}
                  initial={lastRun.isNewBest && !reduced ? { scale: 0.9 } : false}
                  animate={{ scale: 1 }}
                  className="relative rounded-full border border-space-700 bg-space-900/80 px-4 py-2 text-sm text-ink-400 transition-colors hover:border-neon-cyan/50 hover:text-ink-100"
                >
                  آخر جولة: {MODE_LABEL[lastRun.mode] ?? lastRun.mode} — {fmt(lastRun.score)} نقطة · {fmt(lastRun.wpm)} ك/د · {fmt(lastRun.acc)}٪
                  {lastRun.isNewBest && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 380, damping: 14, delay: 0.3 }}
                      className="absolute -top-3 right-3 rounded-full bg-neon-amber px-2 py-0.5 text-[10px] font-bold text-space-950 shadow-[0_0_12px_rgba(251,191,36,.7)]"
                    >
                      رقم قياسي جديد!
                    </motion.span>
                  )}
                </motion.button>
              )}
            </AnimatePresence>
          </div>
          <div className="flex items-center gap-2 text-sm text-ink-400">
            {editingName ? (
              <Input
                ref={nameInputRef}
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onBlur={() => {
                  saveName(nameDraft)
                  setEditingName(false)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    saveName(nameDraft)
                    setEditingName(false)
                  }
                  if (e.key === 'Escape') {
                    setNameDraft(player.name)
                    setEditingName(false)
                  }
                }}
                className="h-9 w-44 border-neon-cyan/50 bg-space-900 text-ink-100"
                aria-label="اسم اللاعب"
                autoFocus
              />
            ) : (
              <>
                <span>
                  مرحباً، <span className="font-bold text-ink-100">{player.name}</span>
                </span>
                <button
                  onClick={() => {
                    setEditingName(true)
                    setNameDraft(player.name)
                  }}
                  className="rounded-full p-1.5 text-ink-600 transition-colors hover:text-neon-cyan"
                  aria-label="تعديل الاسم"
                >
                  <Pencil size={14} />
                </button>
              </>
            )}
          </div>
        </motion.div>
      </motion.div>

      {/* نافذة الترحيب بالزيارة الأولى */}
      <Dialog open={welcomeOpen} onOpenChange={setWelcomeOpen}>
        <DialogContent className="border-neon-cyan/40 bg-space-900 text-ink-100 shadow-[0_0_40px_rgba(34,211,238,.25)] sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl font-black text-glow-cyan">أهلاً بك أيها القائد!</DialogTitle>
            <DialogDescription className="text-ink-400">ما الاسم الذي سيُخلَّد في لوحة الشرف؟</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              audio.play('menuClick')
              saveName(nameDraft)
              setWelcomeOpen(false)
            }}
            className="flex flex-col gap-4"
          >
            <Input
              value={nameDraft === 'قائد المجرّة' && !player.welcomed ? '' : nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              placeholder="اسمك..."
              className="border-space-700 bg-space-800 text-ink-100 placeholder:text-ink-600"
              aria-label="اسمك"
              autoFocus
            />
            <div className="flex gap-3">
              <NeonButton type="submit" size="md" className="flex-1">
                لنبدأ
              </NeonButton>
              <NeonButton
                type="button"
                variant="ghost"
                size="md"
                onClick={() => {
                  saveName('قائد المجرّة')
                  setWelcomeOpen(false)
                }}
              >
                تخطَّ
              </NeonButton>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
