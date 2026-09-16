import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertTriangle,
  Camera,
  Home,
  Pause,
  Play,
  RotateCcw,
  Settings as SettingsIcon,
  Volume2,
  VolumeX,
} from 'lucide-react'
import TypingLine from '@/components/TypingLine'
import type { CharState } from '@/components/TypingLine'
import ClockGauge from '@/components/ClockGauge'
import HeartRow from '@/components/HeartRow'
import CountdownOverlay from '@/components/CountdownOverlay'
import KeyboardHint from '@/components/KeyboardHint'
import NeonButton from '@/components/NeonButton'
import { Panel } from '@/components/ArcadeCard'
import SliderRow from '@/components/SliderRow'
import ToggleSwitch from '@/components/ToggleSwitch'
import { useSettings } from '@/context/SettingsContext'
import { useCamera } from '@/context/CameraContext'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import { resolveGameConfig } from '@/game/config'
import { GameEngine } from '@/game/engine'
import { finalizeRun } from '@/game/persist'
import type { EngineEvent, GameConfig, TimerState } from '@/game/types'

/**
 * شاشة اللعب /game/:mode — canvas للّعب وHUD في DOM.
 * mode ∈ arcade | level-:id | custom | placement
 */

type UiPhase = 'intro' | 'countdown' | 'playing' | 'paused'

interface TypingState {
  text: string
  states: CharState[]
  cursor: number
  lastWrongIndex: number | null
  nextChar: string | null
  totalChars: number
}

export default function Game() {
  const { mode } = useParams()
  const [searchParams] = useSearchParams()
  const config = useMemo(() => resolveGameConfig(mode, searchParams), [mode, searchParams])
  const [session, setSession] = useState(0)
  const navigate = useNavigate()

  if (!config) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center px-4">
        <Panel glow="magenta" className="max-w-md p-10 text-center">
          <h1 className="font-display text-2xl font-black text-ink-100">المسار غير معروف</h1>
          <p className="mt-3 text-ink-400">تعذّر تحديد طور اللعب أو المرحلة المطلوبة.</p>
          <NeonButton className="mt-6" onClick={() => navigate('/levels')}>
            خريطة المراحل
          </NeonButton>
        </Panel>
      </div>
    )
  }

  return (
    <GameSession
      key={`${mode ?? ''}-${session}`}
      config={config}
      skipIntro={session > 0}
      onRestart={() => setSession((s) => s + 1)}
    />
  )
}

function GameSession({
  config,
  skipIntro,
  onRestart,
}: {
  config: GameConfig
  skipIntro: boolean
  onRestart: () => void
}) {
  const navigate = useNavigate()
  const { settings, updateSettings, rules } = useSettings()
  const { status: camStatus, stream, videoRef } = useCamera()

  const containerRef = useRef<HTMLDivElement | null>(null)
  const bgRef = useRef<HTMLCanvasElement | null>(null)
  const gameRef = useRef<HTMLCanvasElement | null>(null)
  const engineRef = useRef<GameEngine | null>(null)

  const [uiPhase, setUiPhase] = useState<UiPhase>(skipIntro ? 'countdown' : 'intro')
  const [hearts, setHearts] = useState(config.hearts)
  const [score, setScore] = useState(0)
  const [floaters, setFloaters] = useState<{ id: number; delta: number }[]>([])
  const [typing, setTyping] = useState<TypingState>({
    text: '',
    states: [],
    cursor: 0,
    lastWrongIndex: null,
    nextChar: null,
    totalChars: 0,
  })
  const [letterT, setLetterT] = useState<TimerState>({ remaining: config.letterTimer.seconds, total: config.letterTimer.seconds })
  const [lineT, setLineT] = useState<TimerState>({ remaining: config.lineTimer.seconds, total: config.lineTimer.seconds })
  const [live, setLive] = useState({ wpm: 0, acc: 1 })
  const [contextLabel, setContextLabel] = useState(config.title)
  const [banner, setBanner] = useState<{ id: number; text: string } | null>(null)
  const [cameraWarn, setCameraWarn] = useState(false)
  const [vignetteId, setVignetteId] = useState(0)
  const [endOverlay, setEndOverlay] = useState<'victory' | 'death' | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [pausedStats, setPausedStats] = useState({ score: 0, wpm: 0, acc: 1 })

  const uiPhaseRef = useRef(uiPhase)
  uiPhaseRef.current = uiPhase
  const graceEndRef = useRef(0)
  const lastCamPenaltyRef = useRef(0)
  const navigatedRef = useRef(false)

  const exitPath =
    config.mode === 'levels'
      ? '/levels'
      : config.mode === 'arcade'
        ? '/arcade'
        : config.mode === 'placement'
          ? '/placement'
          : '/custom'

  /* ---------- أحداث المحرك ---------- */
  const handleEvent = useCallback(
    (e: EngineEvent) => {
      switch (e.type) {
        case 'typing':
          setTyping({
            text: e.text,
            states: e.states,
            cursor: e.cursor,
            lastWrongIndex: e.lastWrongIndex,
            nextChar: e.nextChar,
            totalChars: e.totalChars,
          })
          break
        case 'score': {
          setScore(e.score)
          if (e.delta > 0) {
            const id = Date.now() + Math.random()
            setFloaters((f) => [...f.slice(-4), { id, delta: e.delta }])
            window.setTimeout(() => setFloaters((f) => f.filter((x) => x.id !== id)), 600)
          }
          break
        }
        case 'hearts':
          setHearts(e.hearts)
          break
        case 'timers':
          setLetterT(e.letter)
          setLineT(e.line)
          setLive({ wpm: e.wpm, acc: e.acc })
          break
        case 'context':
          setContextLabel(
            config.mode === 'arcade' ? `الموجة ${e.wave}` : config.title,
          )
          break
        case 'hit':
          setVignetteId((v) => v + 1)
          break
        case 'banner': {
          const id = Date.now()
          setBanner({ id, text: e.text })
          window.setTimeout(() => setBanner((b) => (b?.id === id ? null : b)), 1000)
          break
        }
        case 'camera-shot':
          setCameraWarn(true)
          window.setTimeout(() => setCameraWarn(false), 2000)
          break
        case 'phase':
          if (e.phase === 'dying') setEndOverlay('death')
          else if (e.phase === 'victory') setEndOverlay('victory')
          break
        case 'game-over': {
          if (navigatedRef.current) return
          navigatedRef.current = true
          const result = e.result
          if (config.mode === 'placement') {
            // عقد placement: تجميع الجولات مسؤولية صفحة /placement
            navigate('/placement', { state: { roundResult: result } })
          } else {
            const fin = finalizeRun(config, result)
            // عقد شاشة النتائج: RunResult بواجهة src/pages/results/types داخل state.run
            const run = {
              mode: fin.mode,
              levelId: fin.levelId ?? undefined,
              victory: fin.victory,
              reason:
                fin.reason === 'انتهت القلوب'
                  ? ('hearts' as const)
                  : fin.reason === 'انتهى الوقت'
                    ? ('time' as const)
                    : undefined,
              score: fin.score,
              wpm: fin.wpm,
              accuracy: fin.acc,
              correctChars: fin.correct,
              wrongChars: fin.wrong,
              timeTaken: fin.elapsedSec,
              stars: fin.stars,
              wave: fin.wave ?? undefined,
              lines: fin.perLine.map((l) => ({ text: l.text, wpm: l.wpm, acc: l.acc, errors: l.errors })),
              entryId: fin.entryId,
            }
            navigate('/results?run=latest', { state: { run } })
          }
          break
        }
      }
    },
    [config, navigate],
  )

  const handleEventRef = useRef(handleEvent)
  handleEventRef.current = handleEvent

  /* ---------- دورة حياة المحرك ---------- */
  useEffect(() => {
    const bg = bgRef.current
    const game = gameRef.current
    const container = containerRef.current
    if (!bg || !game || !container) return
    const engine = new GameEngine({
      bgCanvas: bg,
      gameCanvas: game,
      config,
      reducedMotion: settings.reducedMotion,
      callbacks: { onEvent: (e) => handleEventRef.current(e) },
    })
    engineRef.current = engine
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    engine.resize(container.clientWidth, container.clientHeight, dpr)
    const obs = new ResizeObserver(() => {
      engine.resize(container.clientWidth, container.clientHeight, Math.min(2, window.devicePixelRatio || 1))
    })
    obs.observe(container)
    engine.prewarm()
    return () => {
      obs.disconnect()
      engine.destroy()
      engineRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config])

  /* ---------- البدء: أي زر من بطاقة الإحاطة ---------- */
  useEffect(() => {
    if (uiPhase !== 'intro') return
    const onKey = () => setUiPhase('countdown')
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [uiPhase])

  /* ---------- Esc للإيقاف المؤقت ---------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const engine = engineRef.current
      if (!engine) return
      if (engine.getPhase() === 'playing') {
        setPausedStats(engine.getStatsSnapshot())
        engine.pause()
        setUiPhase('paused')
      } else if (engine.getPhase() === 'paused') {
        engine.resume()
        setUiPhase('playing')
        setSettingsOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const pauseGame = useCallback(() => {
    const engine = engineRef.current
    if (!engine || engine.getPhase() !== 'playing') return
    setPausedStats(engine.getStatsSnapshot())
    engine.pause()
    setUiPhase('paused')
  }, [])

  const resumeGame = useCallback(() => {
    const engine = engineRef.current
    if (!engine) return
    engine.resume()
    setUiPhase('playing')
    setSettingsOpen(false)
  }, [])

  const onCountdownDone = useCallback(() => {
    graceEndRef.current = Date.now() + config.camera.gracePeriod * 1000
    engineRef.current?.start()
    setUiPhase('playing')
  }, [config.camera.gracePeriod])

  /* ---------- الكاميرا: النظر للأسفل ← هجوم مستفَز بضرر قابل للتعديل ---------- */
  useEffect(() => {
    if (!config.camera.enabled) return
    if (uiPhase !== 'playing') return
    if (camStatus !== 'looking-down') return
    const now = Date.now()
    if (now < graceEndRef.current) return
    if (now - lastCamPenaltyRef.current < 2000) return // تبريد ثانيتين
    lastCamPenaltyRef.current = now
    engineRef.current?.cameraPenalty()
  }, [camStatus, uiPhase, config.camera.enabled])

  /* ---------- فيديو الكاميرا المخفي عند إطفاء PiP (يُبقي كشف السياق حياً) ---------- */
  const needsHiddenVideo = config.camera.enabled && !rules.camera.showPiP
  useEffect(() => {
    if (!needsHiddenVideo) return
    const v = videoRef.current
    if (v && stream && v.srcObject !== stream) {
      v.srcObject = stream
      void v.play().catch(() => undefined)
    }
  }, [needsHiddenVideo, stream, videoRef])

  const muted = settings.audio.muted
  const showHints = settings.keyboardHints && config.mode !== 'arcade'
  const showWpmGhost = config.mode === 'levels' && (config.levelId ?? 99) <= 10
  const lineProgress = typing.totalChars > 0 ? typing.cursor / typing.totalChars : 0

  const camDotClass =
    camStatus === 'ok'
      ? 'bg-good-glow shadow-[0_0_8px_rgba(74,222,128,.8)]'
      : camStatus === 'looking-down'
        ? 'bg-bad-glow shadow-[0_0_8px_rgba(248,113,113,.8)] animate-pulse'
        : camStatus === 'uncertain'
          ? 'bg-neon-amber shadow-[0_0_8px_rgba(251,191,36,.8)]'
          : 'bg-ink-600'

  const letterGauge = (size: number) =>
    config.letterTimer.enabled ? (
      <ClockGauge remaining={letterT.remaining} total={letterT.total} label="وقت الحرف" size={size} />
    ) : (
      <InfinityGauge label="وقت الحرف" size={size} />
    )
  const lineGauge = (size: number) =>
    config.lineTimer.enabled ? (
      <ClockGauge remaining={lineT.remaining} total={lineT.total} label="وقت الجملة" size={size} />
    ) : (
      <InfinityGauge label="وقت الجملة" size={size} />
    )

  return (
    <div className="relative flex h-[100dvh] flex-col overflow-hidden">
      {/* وميض الضرر الأحمر */}
      {vignetteId > 0 && (
        <motion.div
          key={vignetteId}
          initial={{ opacity: 0.55 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="pointer-events-none fixed inset-0 z-[65]"
          style={{ background: 'radial-gradient(ellipse at center, transparent 40%, rgba(185,28,28,.55) 100%)' }}
        />
      )}

      {/* شريط HUD العلوي */}
      <motion.header
        initial={{ y: -48, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="relative z-20 flex h-12 shrink-0 items-center justify-between gap-2 border-b border-space-700/60 bg-space-900/80 px-3 backdrop-blur-sm sm:px-4"
      >
        {/* يمين (RTL أول): القلوب + إيقاف */}
        <div className="flex items-center gap-3">
          <HeartRow hearts={hearts} maxHearts={config.hearts} size={24} />
          <button
            type="button"
            onClick={pauseGame}
            className="flex items-center gap-1.5 rounded-full border border-space-700 px-3 py-1.5 text-sm font-bold text-ink-400 transition-colors hover:border-neon-cyan/40 hover:text-ink-100"
            aria-label="إيقاف مؤقت (Esc)"
          >
            <Pause size={15} />
            إيقاف
          </button>
        </div>
        {/* الوسط: النقاط */}
        <div className="relative flex flex-col items-center">
          <span className="text-[11px] leading-none text-ink-400">النقاط</span>
          <span className="font-hud text-[22px] font-bold leading-tight text-ink-100">
            {formatNumber(score, settings.numerals)}
          </span>
          <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center">
            <AnimatePresence>
              {floaters.map((f) => (
                <motion.span
                  key={f.id}
                  initial={{ y: 0, opacity: 1 }}
                  animate={{ y: -24, opacity: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5 }}
                  className="absolute font-hud text-sm font-bold text-good-glow"
                >
                  +{formatNumber(f.delta, settings.numerals)}
                </motion.span>
              ))}
            </AnimatePresence>
          </div>
        </div>
        {/* يسار: السياق + الصوت + الكاميرا */}
        <div className="flex items-center gap-3">
          <span className="hidden max-w-56 truncate text-sm font-bold text-neon-magenta sm:inline">{contextLabel}</span>
          {config.camera.enabled && (
            <span className="flex items-center gap-1.5" title="مراقبة النظر للشاشة">
              <Camera size={15} className="text-ink-400" />
              <span className={cn('h-2.5 w-2.5 rounded-full', camDotClass)} />
            </span>
          )}
          <button
            type="button"
            onClick={() => updateSettings({ audio: { ...settings.audio, muted: !muted } })}
            className="rounded-full border border-space-700 p-2 text-ink-400 transition-colors hover:border-neon-cyan/40 hover:text-ink-100"
            aria-label={muted ? 'تشغيل الصوت' : 'كتم الصوت'}
          >
            {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
        </div>
      </motion.header>

      {/* شريط الكتابة */}
      <div className="relative z-20 shrink-0 px-3 pt-3">
        <Panel glow="cyan-dim" className="mx-auto max-w-[900px] px-4 py-4 sm:px-7 sm:py-5">
          <div className="flex items-end gap-3">
            <TypingLine
              className="min-h-[52px] flex-1"
              text={typing.text || ' '}
              states={typing.states.length > 0 ? typing.states : undefined}
              lastWrongIndex={typing.lastWrongIndex}
            />
            {showWpmGhost && (
              <span className="shrink-0 font-hud text-xs text-ink-600" title="سرعتك الحالية">
                {formatNumber(Math.round(live.wpm), settings.numerals)} ك/د
              </span>
            )}
          </div>
          {/* شريط تقدم السطر */}
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-space-700">
            <div
              className="h-full rounded-full bg-neon-cyan shadow-[0_0_8px_rgba(34,211,238,.7)] transition-[width] duration-150"
              style={{ width: `${Math.round(lineProgress * 100)}%` }}
            />
          </div>
        </Panel>
      </div>

      {/* عدادات الجوال (أعلى الزوايا تحت شريط الكتابة) */}
      <div className="relative z-20 flex shrink-0 items-start justify-between px-4 pt-2 lg:hidden">
        {letterGauge(72)}
        {lineGauge(72)}
      </div>

      {/* منطقة اللعب + العدادات الجانبية */}
      <div className="relative z-10 flex min-h-0 flex-1 items-stretch gap-2 px-2 py-2 sm:px-4">
        {/* عداد الحرف — يميناً (أول عنصر في RTL) */}
        <motion.aside
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 380, damping: 26, delay: 0.08 }}
          className="hidden w-28 shrink-0 items-center justify-center lg:flex"
        >
          {letterGauge(96)}
        </motion.aside>

        <div ref={containerRef} className="relative min-w-0 flex-1 overflow-hidden rounded-xl border border-space-700/50">
          <canvas ref={bgRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
          <canvas ref={gameRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
        </div>

        {/* عداد الجملة — يساراً (آخر عنصر في RTL) */}
        <motion.aside
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 380, damping: 26, delay: 0.16 }}
          className="hidden w-32 shrink-0 items-center justify-center lg:flex"
        >
          {lineGauge(120)}
        </motion.aside>
      </div>

      {/* شريط تلميح لوحة المفاتيح */}
      {showHints && (
        <div className="relative z-20 hidden shrink-0 justify-center pb-2 sm:flex">
          <KeyboardHint currentChar={typing.nextChar} />
        </div>
      )}

      {/* فيديو الكاميرا المخفي (كشف السياق يعتمد عليه عند إطفاء PiP) */}
      {needsHiddenVideo && <video ref={videoRef} className="hidden" muted playsInline />}

      {/* لافتة «أحسنت!» / «سقطت المركبة!» */}
      <AnimatePresence>
        {banner && (
          <motion.div
            key={banner.id}
            initial={{ y: -20, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 380, damping: 26 }}
            className={cn(
              'pointer-events-none fixed left-1/2 top-24 z-[68] -translate-x-1/2 rounded-full border px-6 py-2 font-display text-xl font-black',
              banner.text === 'سقطت المركبة!'
                ? 'border-bad-glow/60 bg-bad-600/80 text-white shadow-[0_0_24px_rgba(248,113,113,.5)]'
                : 'border-good-glow/50 bg-good-500/80 text-white shadow-[0_0_24px_rgba(74,222,128,.5)]',
            )}
          >
            {banner.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* تحذير الكاميرا — ينزلق من الأعلى */}
      <AnimatePresence>
        {cameraWarn && (
          <motion.div
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -60, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed left-1/2 top-16 z-[69] flex -translate-x-1/2 items-center gap-2 rounded-full border border-neon-amber/60 bg-space-900/95 px-5 py-2 text-neon-amber shadow-[0_0_24px_rgba(251,191,36,.35)]"
            role="alert"
          >
            <AlertTriangle size={18} />
            <span className="font-bold">انظر إلى الشاشة!</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* بطاقة الإحاطة قبل البدء */}
      {uiPhase === 'intro' && (
        <div className="fixed inset-0 z-[75] flex items-center justify-center bg-space-950/70 p-4 backdrop-blur-sm">
          <motion.div
            initial={{ scale: 0.94, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          >
            <Panel glow="cyan" className="max-w-lg p-8 text-center">
              <h1 className="font-display text-3xl font-black text-ink-100 text-glow-cyan">{config.title}</h1>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-sm">
                <RulePill>قلوب ×{formatNumber(config.hearts, settings.numerals)}</RulePill>
                <RulePill>
                  {config.letterTimer.enabled
                    ? `عداد الحرف ${formatNumber(config.letterTimer.seconds, settings.numerals)}ث`
                    : 'بدون عداد حرف'}
                </RulePill>
                <RulePill>
                  {config.lineTimer.enabled
                    ? `عداد الجملة ${formatNumber(config.lineTimer.seconds, settings.numerals)}ث`
                    : 'بدون عداد جملة'}
                </RulePill>
                <RulePill danger={config.camera.enabled}>
                  {config.camera.enabled ? `كاميرا مفعّلة — ضرر ${formatNumber(config.camera.damageHearts, settings.numerals)}` : 'الكاميرا مغلقة'}
                </RulePill>
              </div>
              <p className="mt-6 text-ink-400">اكتب الحروف الظاهرة بدقة وسرعة — كل حرف صحيح يدمّر مركبة!</p>
              <NeonButton size="lg" className="mt-6" onClick={() => setUiPhase('countdown')}>
                <Play size={18} />
                اضغط أي زر للبدء
              </NeonButton>
            </Panel>
          </motion.div>
        </div>
      )}

      {/* العد التنازلي */}
      <CountdownOverlay active={uiPhase === 'countdown'} onDone={onCountdownDone} />

      {/* الإيقاف المؤقت */}
      {uiPhase === 'paused' && (
        <div className="fixed inset-0 z-[75] flex items-center justify-center bg-space-950/70 p-4 backdrop-blur-md">
          <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.2 }}>
            <Panel glow="cyan" className="w-[min(92vw,440px)] p-7">
              <h2 className="text-center font-display text-2xl font-black text-ink-100">متوقف مؤقتاً</h2>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <PauseStat label="النقاط" value={formatNumber(pausedStats.score, settings.numerals)} />
                <PauseStat label="الدقة" value={`${formatNumber(Math.round(pausedStats.acc * 100), settings.numerals)}٪`} />
                <PauseStat label="السرعة" value={`${formatNumber(Math.round(pausedStats.wpm), settings.numerals)} ك/د`} />
              </div>
              <div className="mt-6 flex flex-col gap-2.5">
                <NeonButton onClick={resumeGame}>
                  <Play size={17} />
                  استئناف
                </NeonButton>
                <NeonButton variant="ghost" onClick={onRestart}>
                  <RotateCcw size={17} />
                  إعادة المرحلة
                </NeonButton>
                <NeonButton variant="ghost" onClick={() => setSettingsOpen((o) => !o)}>
                  <SettingsIcon size={17} />
                  الإعدادات
                </NeonButton>
                <AnimatePresence>
                  {settingsOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden rounded-lg border border-space-700 bg-space-900/80 px-4"
                    >
                      <SliderRow
                        label="الصوت الرئيسي"
                        value={settings.audio.master}
                        onValueChange={(v) => updateSettings({ audio: { ...settings.audio, master: v } })}
                        min={0}
                        max={100}
                      />
                      <SliderRow
                        label="الموسيقى"
                        value={settings.audio.music}
                        onValueChange={(v) => updateSettings({ audio: { ...settings.audio, music: v } })}
                        min={0}
                        max={100}
                      />
                      <SliderRow
                        label="المؤثرات"
                        value={settings.audio.sfx}
                        onValueChange={(v) => updateSettings({ audio: { ...settings.audio, sfx: v } })}
                        min={0}
                        max={100}
                      />
                      <ToggleSwitch
                        label="كتم الكل"
                        checked={settings.audio.muted}
                        onCheckedChange={(v) => updateSettings({ audio: { ...settings.audio, muted: v } })}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
                <NeonButton variant="danger" onClick={() => navigate(exitPath)}>
                  <Home size={17} />
                  خروج للقائمة
                </NeonButton>
              </div>
            </Panel>
          </motion.div>
        </div>
      )}

      {/* ستارة النهاية */}
      <AnimatePresence>
        {endOverlay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={cn(
              'pointer-events-none fixed inset-0 z-[70] flex items-center justify-center',
              endOverlay === 'death' && 'shadow-[inset_0_0_120px_rgba(185,28,28,.55)]',
            )}
          >
            <motion.div
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className={cn(
                'font-display text-5xl font-black',
                endOverlay === 'victory' ? 'text-good-glow text-glow-cyan' : 'text-bad-glow text-glow-magenta',
              )}
            >
              {endOverlay === 'victory' ? 'أحسنت أيها القائد!' : 'سقطت المركبة!'}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function RulePill({ children, danger }: { children: React.ReactNode; danger?: boolean }) {
  return (
    <span
      className={cn(
        'rounded-full border px-3 py-1 font-bold',
        danger ? 'border-neon-amber/50 text-neon-amber' : 'border-space-700 bg-space-900 text-ink-400',
      )}
    >
      {children}
    </span>
  )
}

function PauseStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-space-700 bg-space-900/70 px-2 py-2.5">
      <div className="text-[11px] text-ink-400">{label}</div>
      <div className="font-hud text-lg font-bold text-ink-100">{value}</div>
    </div>
  )
}

/** هيكل عداد معطّل — «∞» باهت */
function InfinityGauge({ label, size }: { label: string; size: number }) {
  return (
    <div
      className="inline-flex flex-col items-center justify-center rounded-full border-space-700"
      style={{
        width: size,
        height: size,
        border: `${Math.max(6, size * 0.09)}px solid #1A2444`,
      }}
      role="timer"
      aria-label={`${label}: غير مفعّل`}
    >
      <span className="font-hud font-bold leading-none text-ink-600" style={{ fontSize: size * 0.3 }}>
        ∞
      </span>
      <span className="mt-1 text-ink-600" style={{ fontSize: size * 0.1 }}>
        {label}
      </span>
    </div>
  )
}
