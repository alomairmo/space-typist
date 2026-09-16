/**
 * تجمع جسيمات (pooling) للانفجارات — بلا تخصيص ذاكرة في حلقة اللعب.
 * الحد الأقصى 400 جسيم حي حسب ضوابط الأداء.
 */

const MAX_PARTICLES = 400

export type ParticleKind = 'spark' | 'ring' | 'debris'

interface Particle {
  active: boolean
  kind: ParticleKind
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
  color: string
}

export class ParticlePool {
  private particles: Particle[] = []
  private liveCount = 0

  constructor() {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.particles.push({
        active: false,
        kind: 'spark',
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        life: 0,
        maxLife: 1,
        size: 2,
        color: '#22D3EE',
      })
    }
  }

  private alloc(): Particle | null {
    if (this.liveCount >= MAX_PARTICLES) return null
    for (const p of this.particles) {
      if (!p.active) {
        p.active = true
        this.liveCount++
        return p
      }
    }
    return null
  }

  /** انفجار مركبة: 26 شرارة + موجة صدمية حلقية + حطام — 450ms */
  explosion(x: number, y: number, opts?: { big?: boolean; reducedMotion?: boolean }): void {
    const big = opts?.big ?? false
    const reduced = opts?.reducedMotion ?? false
    const sparkCount = reduced ? 0 : big ? 60 : 26
    const colors = ['#E879F9', '#22D3EE', '#FBBF24', '#F87171', '#E8ECF8']
    for (let i = 0; i < sparkCount; i++) {
      const p = this.alloc()
      if (!p) break
      const angle = Math.random() * Math.PI * 2
      const speed = (big ? 320 : 220) * (0.3 + Math.random() * 0.7)
      p.kind = 'spark'
      p.x = x
      p.y = y
      p.vx = Math.cos(angle) * speed
      p.vy = Math.sin(angle) * speed
      p.maxLife = 0.25 + Math.random() * 0.2
      p.life = p.maxLife
      p.size = 1.5 + Math.random() * 2.5
      p.color = colors[Math.floor(Math.random() * colors.length)]!
    }
    if (big) {
      // حطام أثقل وأبطأ
      for (let i = 0; i < 18; i++) {
        const p = this.alloc()
        if (!p) break
        const angle = Math.random() * Math.PI * 2
        const speed = 90 * (0.4 + Math.random() * 0.6)
        p.kind = 'debris'
        p.x = x
        p.y = y
        p.vx = Math.cos(angle) * speed
        p.vy = Math.sin(angle) * speed - 40
        p.maxLife = 0.5 + Math.random() * 0.3
        p.life = p.maxLife
        p.size = 2.5 + Math.random() * 3
        p.color = '#5B6A94'
      }
    }
    // حلقة الموجة الصدمية
    const ring = this.alloc()
    if (ring) {
      ring.kind = 'ring'
      ring.x = x
      ring.y = y
      ring.vx = 0
      ring.vy = 0
      ring.maxLife = reduced ? 0.3 : 0.45
      ring.life = ring.maxLife
      ring.size = big ? 90 : 46
      ring.color = big ? '#F87171' : '#E879F9'
    }
  }

  /** شرارة صغيرة (إصابة طلقة / اختفاء) */
  spark(x: number, y: number, color: string): void {
    for (let i = 0; i < 6; i++) {
      const p = this.alloc()
      if (!p) break
      const angle = Math.random() * Math.PI * 2
      const speed = 120 * (0.4 + Math.random() * 0.6)
      p.kind = 'spark'
      p.x = x
      p.y = y
      p.vx = Math.cos(angle) * speed
      p.vy = Math.sin(angle) * speed
      p.maxLife = 0.18 + Math.random() * 0.12
      p.life = p.maxLife
      p.size = 1.5 + Math.random() * 1.5
      p.color = color
    }
  }

  update(dt: number): void {
    for (const p of this.particles) {
      if (!p.active) continue
      p.life -= dt
      if (p.life <= 0) {
        p.active = false
        this.liveCount--
        continue
      }
      if (p.kind !== 'ring') {
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.vx *= 1 - 2.2 * dt
        p.vy *= 1 - 2.2 * dt
        if (p.kind === 'debris') p.vy += 180 * dt
      }
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    for (const p of this.particles) {
      if (!p.active) continue
      const t = p.life / p.maxLife
      if (p.kind === 'ring') {
        const r = p.size * (1 - t)
        ctx.save()
        ctx.globalAlpha = t * 0.9
        ctx.strokeStyle = p.color
        ctx.lineWidth = 3 * t + 1
        ctx.beginPath()
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
        ctx.stroke()
        ctx.restore()
      } else {
        ctx.save()
        ctx.globalAlpha = Math.min(1, t * 1.4)
        ctx.fillStyle = p.color
        ctx.shadowColor = p.color
        ctx.shadowBlur = 6
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size)
        ctx.restore()
      }
    }
  }
}
