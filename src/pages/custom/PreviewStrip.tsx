import { memo, useEffect, useRef } from 'react'
import { useSettings } from '@/context/SettingsContext'
import { descentPx } from '@/pages/custom/config'
import type { DescentSpeed } from '@/pages/custom/config'

export interface PreviewStripProps {
  descentSpeed: DescentSpeed
  className?: string
}

const W = 280
const H = 120

/**
 * شريط معاينة مصغّر — 3 مركبات عدو تتمايل (جيب، ثانيتان) + مركبة اللاعب
 * بانحراف جيبي ±10px. سرعة التمايل تقريبية لسرعة النزول المختارة.
 */
function PreviewStrip({ descentSpeed, className }: PreviewStripProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const { settings } = useSettings()
  const reduced = settings.reducedMotion

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const cx = canvas.getContext('2d')
    if (!cx) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = W * dpr
    canvas.height = H * dpr
    cx.scale(dpr, dpr)

    const enemy = new Image()
    enemy.src = '/enemy-ship-1.svg'
    const player = new Image()
    player.src = '/player-ship.svg'

    // سرعة بصرية تقريبية مشتقة من px/s (6..20)
    const px = descentPx(descentSpeed)
    const bobAmp = 2 + px / 6
    const drift = px * 0.35

    let raf = 0
    let alive = true
    const draw = (t: number) => {
      if (!alive) return
      const s = t / 1000
      cx.clearRect(0, 0, W, H)
      // خلفية داكنة + نجوم خافتة
      cx.fillStyle = '#0A0F1E'
      cx.fillRect(0, 0, W, H)
      cx.fillStyle = 'rgba(232,236,248,.35)'
      for (let i = 0; i < 18; i++) {
        const sx = (i * 53 + 17) % W
        const sy = (i * 37 + 11) % H
        cx.fillRect(sx, sy, 1, 1)
      }
      const period = (2 * Math.PI) / 2 // جيب بثانيتين
      // 3 مركبات عدو تتمايل
      for (let i = 0; i < 3; i++) {
        const ex = 52 + i * 88 + (reduced ? 0 : Math.sin(s * period * 0.5 + i * 1.7) * drift * 0.4)
        const ey = 26 + (reduced ? 0 : Math.sin(s * period + i * 2.1) * bobAmp)
        if (enemy.complete && enemy.naturalWidth > 0) cx.drawImage(enemy, ex - 17, ey - 17, 34, 34)
      }
      // مركبة اللاعب بانحراف ±10px
      const pxPos = W / 2 + (reduced ? 0 : Math.sin(s * period * 0.7) * 10)
      if (player.complete && player.naturalWidth > 0) cx.drawImage(player, pxPos - 19, H - 48, 38, 38)
      if (!reduced) raf = requestAnimationFrame(draw)
    }
    if (reduced) {
      // إطار ثابت واحد بعد تحميل الصور
      const still = () => draw(0)
      if (enemy.complete && player.complete) still()
      else {
        enemy.onload = still
        player.onload = still
      }
    } else {
      raf = requestAnimationFrame(draw)
    }
    return () => {
      alive = false
      cancelAnimationFrame(raf)
    }
  }, [descentSpeed, reduced])

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: 120 }}
      className={className}
      role="img"
      aria-label="معاينة مصغرة لمركبات اللعب"
    />
  )
}

export default memo(PreviewStrip)
