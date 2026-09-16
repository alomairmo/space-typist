/**
 * تحميل صور المركبات من public/ مع رسم احتياطي هندسي إن لم تكتمل الصورة بعد.
 */

export type SpriteKey = 'player' | 'enemy1' | 'enemy2' | 'enemy3'

const SPRITE_SRC: Record<SpriteKey, string> = {
  player: '/player-ship.svg',
  enemy1: '/enemy-ship-1.svg',
  enemy2: '/enemy-ship-2.svg',
  enemy3: '/enemy-ship-3.svg',
}

const cache = new Map<SpriteKey, HTMLImageElement>()

export function loadSprites(): void {
  for (const [key, src] of Object.entries(SPRITE_SRC) as [SpriteKey, string][]) {
    if (cache.has(key)) continue
    const img = new Image()
    img.src = src
    cache.set(key, img)
  }
}

export function getSprite(key: SpriteKey): HTMLImageElement | null {
  const img = cache.get(key)
  return img && img.complete && img.naturalWidth > 0 ? img : null
}

/** رسم احتياطي لمركبة العدو (معين بتوهج قرمزي) */
export function drawEnemyFallback(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  tier: 1 | 2 | 3,
  glow: number,
): void {
  const s = size / 2
  ctx.save()
  ctx.translate(x, y)
  ctx.shadowColor = tier === 3 ? '#F87171' : tier === 2 ? '#FBBF24' : '#E879F9'
  ctx.shadowBlur = 12 * glow
  ctx.fillStyle = '#101830'
  ctx.strokeStyle = tier === 3 ? '#F87171' : tier === 2 ? '#FBBF24' : '#E879F9'
  ctx.lineWidth = 2
  ctx.beginPath()
  if (tier === 3) {
    ctx.ellipse(0, 0, s * 1.3, s * 0.55, 0, 0, Math.PI * 2)
  } else {
    ctx.moveTo(-s, s * 0.4)
    ctx.lineTo(-s * 0.3, -s * 0.7)
    ctx.lineTo(s * 0.3, -s * 0.7)
    ctx.lineTo(s, s * 0.4)
    ctx.lineTo(s * 0.4, s * 0.8)
    ctx.lineTo(-s * 0.4, s * 0.8)
    ctx.closePath()
  }
  ctx.fill()
  ctx.stroke()
  // قمرة القيادة
  ctx.beginPath()
  ctx.fillStyle = tier === 2 ? '#FBBF24' : '#E879F9'
  ctx.arc(0, tier === 3 ? 0 : -s * 0.15, s * 0.22, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

/** رسم احتياطي لمركبة اللاعب (سهم سماوي) */
export function drawPlayerFallback(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  const s = size / 2
  ctx.save()
  ctx.translate(x, y)
  ctx.shadowColor = '#22D3EE'
  ctx.shadowBlur = 16
  ctx.fillStyle = '#0A0F1E'
  ctx.strokeStyle = '#22D3EE'
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.moveTo(0, -s)
  ctx.lineTo(s * 0.7, s * 0.7)
  ctx.lineTo(0, s * 0.3)
  ctx.lineTo(-s * 0.7, s * 0.7)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  ctx.restore()
}
