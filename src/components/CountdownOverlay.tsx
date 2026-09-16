import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { audio } from '@/lib/audio'
import { cn } from '@/lib/utils'

export interface CountdownOverlayProps {
  /** يُستدعى عند انتهاء العد (بعد «انطلق») */
  onDone: () => void
  /** إلغاء العد عند false */
  active?: boolean
  className?: string
}

const STEPS = ['3', '2', '1', 'انطلق!'] as const

/** عداد 3-2-1-انطلق بملء الشاشة — أرقام Orbitron كبيرة مع قفزة وصوت عند كل نبضة */
export default function CountdownOverlay({ onDone, active = true, className }: CountdownOverlayProps) {
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (!active) return
    setStep(0)
    audio.play('countdown')
    const timers: ReturnType<typeof setTimeout>[] = []
    for (let i = 1; i < STEPS.length; i++) {
      timers.push(
        setTimeout(() => {
          setStep(i)
          audio.play(i === STEPS.length - 1 ? 'countdownGo' : 'countdown')
        }, i * 800),
      )
    }
    timers.push(setTimeout(onDone, STEPS.length * 800))
    return () => timers.forEach(clearTimeout)
  }, [active, onDone])

  if (!active) return null

  return (
    <div
      className={cn(
        'fixed inset-0 z-[80] flex items-center justify-center bg-space-950/80 backdrop-blur-sm',
        className,
      )}
      aria-live="assertive"
      aria-label="عد تنازلي قبل بدء اللعب"
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ scale: 0.3, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 1.6, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 22 }}
          className={cn(
            'font-hud text-[120px] font-bold leading-none',
            step === STEPS.length - 1 ? 'font-display text-good-glow text-glow-cyan' : 'text-neon-cyan text-glow-cyan',
          )}
          style={step === STEPS.length - 1 ? { fontSize: 96 } : undefined}
        >
          {STEPS[step]}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
