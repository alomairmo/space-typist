import { memo, useEffect, useRef } from 'react'

/**
 * قماش الاحتفال — نمطان:
 * - confetti: دفقة قصاصات سماوية/أرجوانية/كهرمانية (120 جسيماً، 1.8ث)
 * - ember: جمرات خافتة تتصاعد ببطء (حالة الهزيمة)
 * يحترم تقليل الحركة: لا يرسم شيئاً عند تفعيله.
 */

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  color: string
  rotation: number
  vr: number
  life: number
  maxLife: number
}

const CONFETTI_COLORS = ['#22D3EE', '#E879F9', '#FBBF24']
const EMBER_COLORS = ['rgba(251,191,36,.5)', 'rgba(248,113,113,.4)', 'rgba(232,121,249,.25)']

export interface ConfettiCanvasProps {
  variant: 'confetti' | 'ember'
  /** إيقاف مبكر (تخطي الحركة) */
  stop?: boolean
}

function ConfettiCanvas({ variant, stop = false }: ConfettiCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || stop) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let width = (canvas.width = window.innerWidth)
    let height = (canvas.height = window.innerHeight)
    const onResize = () => {
      width = canvas.width = window.innerWidth
      height = canvas.height = window.innerHeight
    }
    window.addEventListener('resize', onResize)

    const particles: Particle[] = []
    if (variant === 'confetti') {
      // دفقة 120 جسيماً من أعلى المنتصف
      for (let i = 0; i < 120; i++) {
        const angle = Math.PI / 2 + (Math.random() - 0.5) * 1.6
        const speed = 5 + Math.random() * 9
        particles.push({
          x: width / 2 + (Math.random() - 0.5) * 80,
          y: height * 0.18,
          vx: Math.cos(angle) * speed * (Math.random() < 0.5 ? -1 : 1),
          vy: -Math.abs(Math.sin(angle) * speed),
          size: 4 + Math.random() * 6,
          color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
          rotation: Math.random() * Math.PI,
          vr: (Math.random() - 0.5) * 0.3,
          life: 0,
          maxLife: 108, // ~1.8ث بمعدل 60إطار/ث
        })
      }
    }

    let raf = 0
    let frame = 0
    const tick = () => {
      frame++
      ctx.clearRect(0, 0, width, height)

      if (variant === 'ember') {
        // توليد جمرات خافتة مستمرة (بحد أقصى ~36 حياً)
        if (frame % 8 === 0 && particles.length < 36) {
          particles.push({
            x: Math.random() * width,
            y: height + 10,
            vx: (Math.random() - 0.5) * 0.3,
            vy: -(0.3 + Math.random() * 0.6),
            size: 1.5 + Math.random() * 2.5,
            color: EMBER_COLORS[Math.floor(Math.random() * EMBER_COLORS.length)],
            rotation: 0,
            vr: 0,
            life: 0,
            maxLife: 600,
          })
        }
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]
        p.life++
        if (variant === 'confetti') {
          p.vy += 0.35 // جاذبية
          p.vx *= 0.985
          p.x += p.vx
          p.y += p.vy
          p.rotation += p.vr
        } else {
          p.x += p.vx + Math.sin((p.life + i * 13) * 0.02) * 0.25
          p.y += p.vy
        }
        const fade = 1 - p.life / p.maxLife
        if (fade <= 0 || p.y > height + 30) {
          particles.splice(i, 1)
          continue
        }
        ctx.save()
        ctx.globalAlpha = variant === 'confetti' ? Math.min(1, fade * 1.6) : fade * 0.55
        ctx.fillStyle = p.color
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rotation)
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6)
        ctx.restore()
      }

      if (variant === 'ember' || particles.length > 0) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
    }
  }, [variant, stop])

  if (stop) return null

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 30, pointerEvents: 'none' }}
    />
  )
}

export default memo(ConfettiCanvas)
