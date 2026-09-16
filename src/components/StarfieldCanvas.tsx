import { memo, useEffect, useRef } from 'react'
import { useSettings } from '@/context/SettingsContext'

interface Star {
  x: number
  y: number
  z: number // العمق — للطبقتين
  r: number
  tw: number
}

/** خلفية نجوم ثنائية الطبقات بانجراف متوازٍ بطيء — مكون معزول ومخزّن */
const StarfieldCanvas = memo(function StarfieldCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { settings } = useSettings()
  const reducedRef = useRef(settings.reducedMotion)

  useEffect(() => {
    reducedRef.current = settings.reducedMotion
  }, [settings.reducedMotion])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let w = 0
    let h = 0
    let stars: Star[] = []
    const dpr = Math.min(2, window.devicePixelRatio || 1)

    const resize = () => {
      w = window.innerWidth
      h = window.innerHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      stars = Array.from({ length: 160 }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        z: Math.random() < 0.6 ? 0.35 : 1,
        r: Math.random() * 1.4 + 0.4,
        tw: Math.random() * Math.PI * 2,
      }))
    }
    resize()
    window.addEventListener('resize', resize)

    let raf = 0
    let last = performance.now()
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      ctx.clearRect(0, 0, w, h)
      const drift = reducedRef.current ? 0 : 1
      for (const s of stars) {
        s.y += s.z * 6 * dt * drift
        s.tw += dt * 1.5
        if (s.y > h + 2) {
          s.y = -2
          s.x = Math.random() * w
        }
        const alpha = reducedRef.current ? 0.7 : 0.45 + Math.sin(s.tw) * 0.25
        ctx.globalAlpha = alpha * s.z
        ctx.fillStyle = s.z === 1 ? '#E8ECF8' : '#94A3C7'
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r * s.z, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0, pointerEvents: 'none' }}
    />
  )
})

export default StarfieldCanvas
