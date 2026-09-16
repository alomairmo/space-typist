import { audio } from '@/lib/audio'
import { arcadeLineForWave } from '@/lib/curriculum'
import type { CharState } from '@/components/TypingLine'
import { ParticlePool } from '@/game/particles'
import { drawEnemyFallback, drawPlayerFallback, getSprite, loadSprites } from '@/game/sprites'
import { isPrintableKey, normalizeChar, prepareLine } from '@/game/arabic'
import type {
  EndReason,
  EngineCallbacks,
  EnginePhase,
  GameConfig,
  LineStat,
  RunResult,
  TimerState,
} from '@/game/types'

/**
 * محرك اللعب الأساسي — حلقة rAF على canvas ثنائي الأبعاد.
 * حرف صحيح = ليزر على مركبة حية عشوائية (غير تسلسلي) وتفجيرها.
 * حرف خاطئ / تأخر عن عداد الحرف = هجوم مؤكد الإصابة يخصم قلباً.
 * انتهاء عداد السطر = وابل من كل المركبات يقتل اللاعب.
 */

const PLAYER_SIZE = 72
const PLAYER_RADIUS = 24
const LASER_TRAVEL = 0.09 // 90ms
const MAX_DODGE_SPEED = 480 // px/s

interface Enemy {
  slot: number
  alive: boolean
  x: number
  y: number
  baseX: number
  baseY: number
  row: number
  hp: number
  tier: 1 | 2 | 3
  size: number
  bobPhase: number
  warpT: number
  targetFlash: number
  charge: number
  pendingShot: { t: number; provoked: boolean; group: number } | null
}

interface Bullet {
  active: boolean
  kind: 'laser' | 'enemy'
  x: number
  y: number
  vx: number
  vy: number
  speed: number
  provoked: boolean
  group: number
  targetSlot: number
  willDodge: boolean
  trail: { x: number; y: number }[]
}

interface Star {
  x: number
  y: number
  r: number
  layer: number
  tw: number
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export class GameEngine {
  private bgCanvas: HTMLCanvasElement
  private gameCanvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private bgCtx: CanvasRenderingContext2D
  private config: GameConfig
  private cb: EngineCallbacks
  private reducedMotion: boolean

  private w = 0
  private h = 0
  private raf = 0
  private lastT = 0
  private destroyed = false

  private phase: EnginePhase = 'ready'
  private timeScale = 1
  private slowMoT = 0
  private time = 0

  // الكتابة
  private currentText = ''
  private chars: string[] = []
  private states: CharState[] = []
  private cursor = 0
  private lastWrongIndex: number | null = null
  private wrongShakeT = 0

  // المؤقتات
  private letter: TimerState = { remaining: 0, total: 0 }
  private line: TimerState = { remaining: 0, total: 0 }
  private letterTickAcc = 0
  private lastLineTickSec = -1
  private timerEmitAcc = 0

  // الكيانات
  private enemies: Enemy[] = []
  private enemySlots = 0
  private bullets: Bullet[] = []
  private pool = new ParticlePool()
  private stars: Star[] = []
  private player = { x: 0, y: 0, alive: true }
  private shakeT = 0
  private shakeMag = 0

  // التدفق
  private lineIndex = 0
  private wave = 1
  private hearts: number
  private transitionT = 0
  private barrageT = 0
  private barrageFired = false
  private endT = 0
  private endReason: EndReason | null = null
  private endVictory = false
  private cleanupT = 0
  private groupSeq = 0
  private groupDamage = new Map<number, number>()
  private forceReason: EndReason | null = null
  private ambientT = 5

  // مُدرَّجات الموجة (أركيد)
  private waveLetterSec = 0
  private waveLineSec = 0
  private waveBulletScale = 1
  private waveDescentScale = 1

  // الإحصائيات
  private stats = {
    correct: 0,
    wrong: 0,
    timeouts: 0,
    streak: 0,
    maxStreak: 0,
    score: 0,
    kills: 0,
    lookDowns: 0,
    linesCleared: 0,
  }
  private perLine: LineStat[] = []
  private lineCorrect = 0
  private lineErrors = 0
  private lineStartTime = 0

  private keyHandler = (e: KeyboardEvent) => this.onKeyDown(e)
  private blurHandler = () => {
    if (this.phase === 'playing') this.pause()
  }

  constructor(opts: {
    bgCanvas: HTMLCanvasElement
    gameCanvas: HTMLCanvasElement
    config: GameConfig
    reducedMotion: boolean
    callbacks: EngineCallbacks
  }) {
    this.bgCanvas = opts.bgCanvas
    this.gameCanvas = opts.gameCanvas
    this.config = opts.config
    this.cb = opts.callbacks
    this.reducedMotion = opts.reducedMotion
    this.ctx = this.gameCanvas.getContext('2d')!
    this.bgCtx = this.bgCanvas.getContext('2d')!
    this.hearts = opts.config.hearts
    loadSprites()
    window.addEventListener('keydown', this.keyHandler)
    window.addEventListener('blur', this.blurHandler)
  }

  /* ---------- دورة الحياة ---------- */

  resize(w: number, h: number, dpr: number): void {
    this.w = w
    this.h = h
    for (const [canvas, ctx] of [
      [this.bgCanvas, this.bgCtx],
      [this.gameCanvas, this.ctx],
    ] as const) {
      canvas.width = Math.max(1, Math.round(w * dpr))
      canvas.height = Math.max(1, Math.round(h * dpr))
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    this.player.x = w / 2
    this.player.y = h - PLAYER_SIZE / 2 - 14
    this.genStars()
    this.layoutEnemies()
  }

  /** يشغّل حلقة الرسم قبل العد التنازلي (مشهد جاهز خلف البطاقة) */
  prewarm(): void {
    this.computeWaveScales()
    this.setupLine(0)
    this.lastT = performance.now()
    const frame = (now: number) => {
      if (this.destroyed) return
      const dtRaw = Math.min((now - this.lastT) / 1000, 0.05)
      this.lastT = now
      const dt = dtRaw * this.timeScale
      if (this.slowMoT > 0) {
        this.slowMoT -= dtRaw
        if (this.slowMoT <= 0) this.timeScale = 1
      }
      if (this.phase !== 'paused') this.update(dt, dtRaw)
      this.render()
      this.raf = requestAnimationFrame(frame)
    }
    this.raf = requestAnimationFrame(frame)
  }

  /** بدء اللعب الفعلي بعد العد التنازلي */
  start(): void {
    if (this.phase !== 'ready') return
    this.phase = 'playing'
    this.lineStartTime = this.time
    this.emitPhase()
    this.emitTyping()
    this.emitContext()
    this.emitTimers()
    this.cb.onEvent({ type: 'hearts', hearts: this.hearts })
  }

  pause(): void {
    if (this.phase !== 'playing') return
    this.phase = 'paused'
    this.emitPhase()
  }

  resume(): void {
    if (this.phase !== 'paused') return
    this.phase = 'playing'
    this.lastT = performance.now()
    this.emitPhase()
  }

  destroy(): void {
    this.destroyed = true
    cancelAnimationFrame(this.raf)
    window.removeEventListener('keydown', this.keyHandler)
    window.removeEventListener('blur', this.blurHandler)
  }

  getPhase(): EnginePhase {
    return this.phase
  }

  getStatsSnapshot(): { score: number; wpm: number; acc: number; streak: number } {
    return { score: this.stats.score, wpm: this.computeWpm(), acc: this.computeAcc(), streak: this.stats.streak }
  }

  /** هجوم الكاميرا المستفَز — ضرر قابل للتعديل من القواعد */
  cameraPenalty(): void {
    if (this.phase !== 'playing') return
    this.stats.lookDowns++
    const dmg = this.config.camera.damageHearts
    if (dmg > 0) this.provoke(dmg)
    this.cb.onEvent({ type: 'camera-shot' })
  }

  /* ---------- حسابات الموجة ---------- */

  private computeWaveScales(): void {
    const { config } = this
    if (!config.endless) {
      this.waveLetterSec = config.letterTimer.seconds
      this.waveLineSec = config.lineTimer.seconds
      this.waveBulletScale = 1
      this.waveDescentScale = 1
      return
    }
    const w = this.wave
    // منحنى الأركيد: نزول +8٪، طلقات +6٪، عداد حرف −4٪ (أرضية 1.5ث)، عداد سطر −3٪ (أرضية 25ث)
    this.waveDescentScale = 1 + 0.08 * (w - 1)
    this.waveBulletScale = 1 + 0.06 * (w - 1)
    const leniency = w <= 3 ? 1.5 : 1 // الموجات 1-3: تساهل +50٪
    this.waveLetterSec = Math.max(1.5, config.letterTimer.seconds * leniency * Math.pow(0.96, w - 1))
    this.waveLineSec = Math.max(25, config.lineTimer.seconds * Math.pow(0.97, w - 1))
  }

  /* ---------- تجهيز السطر ---------- */

  private setupLine(idx: number): void {
    const { config } = this
    const text = config.endless
      ? arcadeLineForWave(this.wave)
      : (config.lines[idx] ?? config.lines[config.lines.length - 1] ?? 'سلام')
    this.currentText = text
    this.chars = prepareLine(text, config.typing)
    this.states = this.chars.map(() => 'pending' as CharState)
    this.cursor = 0
    this.lastWrongIndex = null
    this.lineCorrect = 0
    this.lineErrors = 0
    this.lineStartTime = this.time
    this.letter = { remaining: this.waveLetterSec, total: this.waveLetterSec }
    if (config.lineTimer.scope === 'line' || idx === 0) {
      this.line = { remaining: this.waveLineSec, total: this.waveLineSec }
    }
    this.lastLineTickSec = -1
    this.spawnEnemies()
    this.emitTyping()
    this.emitContext()
    this.emitTimers()
  }

  private spawnEnemies(): void {
    const n = this.chars.length
    this.enemySlots = n
    this.enemies = []
    const { config } = this
    // النخبة: أركيد — كل موجة ثالثة من 13+؛ مخصص — حسب التبديل بعد السطر الأول
    const elitesWave = config.endless && this.wave >= 13 && this.wave % 3 === 0
    const elitesCustom = config.mode === 'custom' && config.difficulty.elites && this.lineIndex >= 1
    const mothershipWave = config.endless && this.wave % 5 === 0
    for (let i = 0; i < n; i++) {
      let hp = 1
      let tier: 1 | 2 | 3 = 1
      if (mothershipWave && i === n - 1) {
        hp = 3
        tier = 3
      } else if ((elitesWave || elitesCustom) && i % 3 === 2) {
        hp = 2
        tier = 2
      }
      this.enemies.push({
        slot: i,
        alive: true,
        x: 0,
        y: 0,
        baseX: 0,
        baseY: 0,
        row: 0,
        hp,
        tier,
        size: 44,
        bobPhase: Math.random() * Math.PI * 2,
        warpT: 0,
        targetFlash: 0,
        charge: 0,
        pendingShot: null,
      })
    }
    this.layoutEnemies()
  }

  /** توزيع الصفوف: ≤12 صف واحد، أكثر: صفوف ملتفة (2-3) */
  private layoutEnemies(): void {
    const n = this.enemySlots
    if (n === 0 || this.w === 0) return
    const rows = n <= 12 ? 1 : n <= 26 ? 2 : 3
    const perRow = Math.ceil(n / rows)
    const spacing = this.w / (perRow + 1)
    const size = clamp(spacing * 0.72, 22, 52)
    const rowH = size + 20
    const topPad = 44
    for (const e of this.enemies) {
      const row = Math.floor(e.slot / perRow)
      const col = e.slot % perRow
      const inRow = Math.min(perRow, n - row * perRow)
      const rowSpacing = this.w / (inRow + 1)
      e.row = row
      e.size = e.tier === 3 ? size * 1.5 : size
      e.baseX = rowSpacing * (col + 1)
      e.baseY = topPad + row * rowH
      if (e.warpT === 0) {
        e.x = e.baseX
        e.y = e.baseY
      }
    }
  }

  /* ---------- الإدخال ---------- */

  private onKeyDown(e: KeyboardEvent): void {
    if (this.phase !== 'playing') return
    if (e.ctrlKey || e.metaKey || e.altKey) return
    if (e.key === 'Escape' || e.key === 'Dead') return
    if (!isPrintableKey(e.key)) return
    e.preventDefault()
    if (this.cursor >= this.chars.length) return
    const opts = this.config.typing
    const pressed = normalizeChar(e.key, opts)
    if (pressed === '') return
    const target = normalizeChar(this.chars[this.cursor]!, opts)
    if (pressed === target) this.onCorrect()
    else this.onWrong()
  }

  private onCorrect(): void {
    this.stats.correct++
    this.lineCorrect++
    this.stats.streak++
    this.stats.maxStreak = Math.max(this.stats.maxStreak, this.stats.streak)
    this.states[this.cursor] = 'correct'
    this.cursor++
    this.rearmLetterTimer()
    audio.play('correct')
    // إطلاق عشوائي غير تسلسلي على أي مركبة حية
    const target = this.randomAliveEnemy()
    if (target) {
      this.fireLaser(target)
      audio.play('laser')
    }
    this.emitTyping()
  }

  private onWrong(): void {
    this.stats.wrong++
    this.lineErrors++
    this.stats.streak = 0
    this.states[this.cursor] = 'wrong'
    this.lastWrongIndex = this.cursor
    this.wrongShakeT = 0.16
    audio.play('wrong')
    if (!this.config.typing.stopOnError) this.cursor++
    this.rearmLetterTimer()
    // هجوم مضمون الإصابة — يخصم قلباً
    this.provoke(1)
    this.emitTyping()
  }

  private onLetterTimeout(): void {
    if (this.cursor >= this.chars.length) return
    this.stats.wrong++
    this.stats.timeouts++
    this.lineErrors++
    this.stats.streak = 0
    // الحرف يبقى pending ويتقدم المؤشر
    this.cursor++
    this.rearmLetterTimer()
    this.provoke(1)
    this.emitTyping()
  }

  private rearmLetterTimer(): void {
    this.letter.remaining = this.letter.total
    this.letterTickAcc = 0
  }

  private randomAliveEnemy(): Enemy | null {
    const alive = this.enemies.filter((e) => e.alive)
    if (alive.length === 0) return null
    return alive[Math.floor(Math.random() * alive.length)]!
  }

  /* ---------- الهجمات ---------- */

  /** هجوم مستفَز: أوضح المركبات (الأمامية) تطلق 1..assaultSize طلقات مؤكدة الإصابة */
  private provoke(damage: number): void {
    const shooters = this.enemies
      .filter((e) => e.alive)
      .sort((a, b) => b.baseY - a.baseY)
      .slice(0, this.config.difficulty.assaultSize)
    if (shooters.length === 0) {
      // لا مركبات حية — الضرر مباشر (حافة نادرة أثناء التطهير)
      this.damagePlayer(damage)
      return
    }
    const group = ++this.groupSeq
    this.groupDamage.set(group, damage)
    for (const s of shooters) {
      s.charge = 0.12
      s.pendingShot = { t: 0.12, provoked: true, group }
    }
  }

  private fireLaser(target: Enemy): void {
    target.targetFlash = 0.09
    const sx = this.player.x
    const sy = this.player.y - PLAYER_SIZE / 2
    const dx = target.x - sx
    const dy = target.y - sy
    const dist = Math.max(1, Math.hypot(dx, dy))
    const speed = dist / LASER_TRAVEL
    this.bullets.push({
      active: true,
      kind: 'laser',
      x: sx,
      y: sy,
      vx: (dx / dist) * speed,
      vy: (dy / dist) * speed,
      speed,
      provoked: false,
      group: 0,
      targetSlot: target.slot,
      willDodge: false,
      trail: [],
    })
  }

  private fireEnemyBullet(e: Enemy, provoked: boolean, group: number): void {
    const base = lerp(260, 520, this.config.difficulty.bulletSpeed / 10) * this.waveBulletScale
    const dx = this.player.x - e.x
    const dy = this.player.y - e.y
    const dist = Math.max(1, Math.hypot(dx, dy))
    this.bullets.push({
      active: true,
      kind: 'enemy',
      x: e.x,
      y: e.y + e.size / 2,
      vx: (dx / dist) * base,
      vy: (dy / dist) * base,
      speed: base,
      provoked,
      group,
      targetSlot: -1,
      willDodge: !provoked && Math.random() < 0.65,
      trail: [],
    })
  }

  /** طلقة محيطية عشوائية (تُتفادى بذكاء ~65٪) */
  private ambientShot(): void {
    const shooter = this.randomAliveEnemy()
    if (!shooter) return
    shooter.charge = 0.12
    shooter.pendingShot = { t: 0.12, provoked: false, group: 0 }
  }

  private damagePlayer(n: number): void {
    if (n <= 0) return
    if (this.phase !== 'playing' && this.phase !== 'barrage') return
    this.hearts = Math.max(0, this.hearts - n)
    this.stats.streak = 0
    audio.play('heartLoss')
    this.cb.onEvent({ type: 'hearts', hearts: this.hearts })
    this.cb.onEvent({ type: 'hit' })
    if (this.hearts <= 0) {
      this.death(this.forceReason ?? 'انتهت القلوب')
    }
  }

  /* ---------- التحديث ---------- */

  private update(dt: number, dtRaw: number): void {
    // جسيمات واهتزاز يعملان في كل الأطوار غير المتوقفة
    this.pool.update(dt)
    if (this.shakeT > 0) this.shakeT -= dtRaw
    for (const e of this.enemies) this.updateEnemy(e, dt)
    this.updateBullets(dt)
    if (this.phase !== 'dying') this.updatePlayer(dt)

    switch (this.phase) {
      case 'playing': {
        this.time += dt
        // عداد الحرف
        if (this.config.letterTimer.enabled && this.cursor < this.chars.length) {
          this.letter.remaining -= dt
          if (this.letter.remaining / Math.max(0.001, this.letter.total) < 0.15) {
            this.letterTickAcc += dt
            if (this.letterTickAcc >= 0.5) {
              this.letterTickAcc = 0
              audio.play('timerTick')
            }
          }
          if (this.letter.remaining <= 0) this.onLetterTimeout()
        }
        // عداد السطر/المرحلة
        if (this.config.lineTimer.enabled) {
          this.line.remaining -= dt
          const sec = Math.ceil(this.line.remaining)
          if (this.line.remaining <= 10 && sec !== this.lastLineTickSec && sec >= 0) {
            this.lastLineTickSec = sec
            audio.play('timerTick')
          }
          if (this.line.remaining <= 0) {
            this.startBarrage()
            break
          }
        }
        // نيران محيطية
        this.ambientT -= dt
        if (this.ambientT <= 0) {
          this.ambientShot()
          this.ambientT = Math.max(2.5, 6.5 - 0.35 * this.config.difficulty.enemySpeed) * (0.8 + Math.random() * 0.4)
        }
        // وابل التطهير: كتابة السطر اكتملت وبقيت مركبات نخبة — اللاعب يُجهز عليها تلقائياً
        if (this.cursor >= this.chars.length && this.enemies.some((e) => e.alive)) {
          this.cleanupT -= dt
          if (this.cleanupT <= 0) {
            this.cleanupT = 0.12
            const t = this.randomAliveEnemy()
            if (t) {
              this.fireLaser(t)
              audio.play('laser')
            }
          }
        }
        // اهتزاز الخطأ يزول
        if (this.wrongShakeT > 0) {
          this.wrongShakeT -= dt
          if (this.wrongShakeT <= 0 && this.lastWrongIndex != null) {
            this.lastWrongIndex = null
            this.emitTyping()
          }
        }
        // انتهاء السطر: كل المركبات دُمّرت وكل الأحرف كُتبت ولا ليزر بالطريق
        if (
          this.cursor >= this.chars.length &&
          !this.enemies.some((e) => e.alive) &&
          !this.bullets.some((b) => b.active && b.kind === 'laser')
        ) {
          this.onLineCleared()
        }
        // بث المؤقتات ~10 مرات/ث
        this.timerEmitAcc += dt
        if (this.timerEmitAcc >= 0.1) {
          this.timerEmitAcc = 0
          this.emitTimers()
        }
        break
      }
      case 'transition': {
        this.transitionT -= dt
        if (this.transitionT <= 0) {
          this.phase = 'playing'
          this.lineStartTime = this.time
          this.emitPhase()
          this.emitTimers()
        }
        break
      }
      case 'barrage': {
        this.barrageT += dt
        if (!this.barrageFired && this.barrageT >= 0.3) {
          this.barrageFired = true
          const group = ++this.groupSeq
          this.groupDamage.set(group, Math.max(1, this.hearts)) // قتل مؤكد
          for (const e of this.enemies) {
            if (!e.alive) continue
            e.pendingShot = { t: 0, provoked: true, group }
            e.charge = 0
          }
        }
        // أمان: لو لم تصب أي طلقة خلال 2.5ث
        if (this.barrageT > 2.5 && this.player.alive) this.death('انتهى الوقت')
        break
      }
      case 'victory':
      case 'dying': {
        this.endT -= dtRaw
        if (this.endT <= 0) this.finish()
        break
      }
      default:
        break
    }
  }

  private updateEnemy(e: Enemy, dt: number): void {
    if (!e.alive) return
    if (e.warpT < 1) e.warpT = Math.min(1, e.warpT + dt / 0.4)
    // هبوط بطيء متدرج الصعوبة + تمايل جيبي بإزاحة طور لكل مركبة
    const descent = lerp(6, 14, this.config.difficulty.enemySpeed / 10) * this.waveDescentScale
    e.baseY = Math.min(this.h * 0.62, e.baseY + descent * dt)
    e.x = e.baseX + Math.sin(this.time * 0.7 + e.bobPhase) * 3
    e.y = e.baseY + Math.sin(this.time * 1.3 + e.bobPhase) * 4
    if (e.targetFlash > 0) e.targetFlash -= dt
    if (e.pendingShot) {
      e.pendingShot.t -= dt
      if (e.charge > 0) e.charge -= dt
      if (e.pendingShot.t <= 0) {
        const shot = e.pendingShot
        e.pendingShot = null
        this.fireEnemyBullet(e, shot.provoked, shot.group)
      }
    }
  }

  private updateBullets(dt: number): void {
    for (const b of this.bullets) {
      if (!b.active) continue
      if (b.kind === 'laser') {
        // توجيه خفيف نحو الهدف المتحرك
        const target = this.enemies.find((e) => e.slot === b.targetSlot)
        if (!target || !target.alive) {
          // الهدف مات قبل الوصول — الليزر يتبخر
          this.pool.spark(b.x, b.y, '#22D3EE')
          b.active = false
          continue
        }
        const dx = target.x - b.x
        const dy = target.y - b.y
        const dist = Math.hypot(dx, dy)
        const step = b.speed * dt
        if (dist <= step + 6) {
          b.active = false
          this.hitEnemy(target)
          continue
        }
        b.vx = (dx / dist) * b.speed
        b.vy = (dy / dist) * b.speed
        b.x += b.vx * dt
        b.y += b.vy * dt
      } else {
        // طلقات العدو: المستفَزة موجّهة (إصابة مؤكدة)
        if (b.provoked && this.player.alive) {
          const dx = this.player.x - b.x
          const dy = this.player.y - b.y
          const dist = Math.max(1, Math.hypot(dx, dy))
          b.vx = lerp(b.vx, (dx / dist) * b.speed, Math.min(1, 10 * dt))
          b.vy = lerp(b.vy, (dy / dist) * b.speed, Math.min(1, 10 * dt))
          // إعادة التطبيع — السرعة ثابتة أثناء التوجيه (إصابة مؤكدة)
          const mag = Math.hypot(b.vx, b.vy) || 1
          b.vx = (b.vx / mag) * b.speed
          b.vy = (b.vy / mag) * b.speed
        }
        b.x += b.vx * dt
        b.y += b.vy * dt
        b.trail.push({ x: b.x, y: b.y })
        if (b.trail.length > 6) b.trail.shift()
        // اصطدام باللاعب
        if (this.player.alive && Math.hypot(b.x - this.player.x, b.y - this.player.y) < PLAYER_RADIUS + 4) {
          b.active = false
          this.pool.spark(b.x, b.y, '#F87171')
          if (b.group > 0) {
            const dmg = this.groupDamage.get(b.group)
            if (dmg != null) {
              this.groupDamage.delete(b.group)
              // بقية طلقات المجموعة تختفي — ضرر واحد لكل استفزاز
              for (const ob of this.bullets) {
                if (ob.active && ob.group === b.group) {
                  ob.active = false
                  this.pool.spark(ob.x, ob.y, '#F87171')
                }
              }
              this.damagePlayer(dmg)
            }
          } else {
            this.damagePlayer(1)
          }
          continue
        }
        if (b.y > this.h + 30 || b.x < -30 || b.x > this.w + 30 || b.y < -30) b.active = false
      }
    }
    if (this.bullets.length > 120) this.bullets = this.bullets.filter((b) => b.active)
  }

  /** ذكاء التفادي التلقائي لمركبة اللاعب */
  private updatePlayer(dt: number): void {
    const p = this.player
    if (!p.alive) return
    // التهديدات: الطلقات المحيطية المختار تفاديها (~65٪) — المستفَزة موجّهة ولا يُجدي تفاديها
    const threats = this.bullets.filter((b) => b.active && b.kind === 'enemy' && b.vy > 0 && b.y < p.y && b.willDodge)
    let targetX = this.w / 2 + Math.sin(this.time * 0.9) * 10 // تمايل خامل ±10px
    if (threats.length > 0 && !this.config.difficulty.noDodge) {
      let bestX = p.x
      let bestDanger = Infinity
      for (let x = 36; x <= this.w - 36; x += 24) {
        let danger = Math.abs(x - p.x) * 0.002 // كلفة الحركة
        for (const b of threats) {
          const tt = (p.y - b.y) / Math.max(1, b.vy)
          const bx = b.x + b.vx * tt
          danger += Math.max(0, 1 - Math.abs(x - bx) / 70) / (1 + tt)
        }
        if (danger < bestDanger) {
          bestDanger = danger
          bestX = x
        }
      }
      targetX = bestX
    }
    const dx = targetX - p.x
    const maxStep = MAX_DODGE_SPEED * dt
    p.x += clamp(dx, -maxStep, maxStep)
    p.x = clamp(p.x, 30, this.w - 30)
  }

  /* ---------- أحداث التدفق ---------- */

  private hitEnemy(e: Enemy): void {
    e.hp--
    if (e.hp > 0) {
      this.pool.spark(e.x, e.y, '#FBBF24')
      return
    }
    e.alive = false
    this.stats.kills++
    this.pool.explosion(e.x, e.y, { reducedMotion: this.reducedMotion })
    audio.play('explosion')
    if (!this.reducedMotion) {
      this.shakeT = 0.12
      this.shakeMag = 3
    }
    const comboMult = Math.min(2, 1 + this.stats.streak / 20)
    let pts = Math.round(50 * comboMult * this.config.difficulty.scoreMultiplier)
    if (e.tier === 3) pts += 500 // الأم
    this.stats.score += pts
    this.cb.onEvent({ type: 'score', score: this.stats.score, delta: pts, streak: this.stats.streak })
  }

  private onLineCleared(): void {
    this.stats.linesCleared++
    const lineNo = this.config.endless ? this.wave : this.lineIndex + 1
    let bonus = 100 * lineNo
    if (this.lineErrors === 0) bonus += 150 // سطر بلا أخطاء
    this.stats.score += bonus
    this.cb.onEvent({ type: 'score', score: this.stats.score, delta: bonus, streak: this.stats.streak })
    this.cb.onEvent({ type: 'banner', text: 'أحسنت!' })
    audio.play('menuClick') // رنين إنهاء السطر (أقرب مؤثر متاح في audio.ts)
    const seconds = Math.max(0.1, this.time - this.lineStartTime)
    const acc = this.lineCorrect + this.lineErrors > 0 ? this.lineCorrect / (this.lineCorrect + this.lineErrors) : 1
    this.perLine.push({
      text: this.currentText,
      correct: this.lineCorrect,
      errors: this.lineErrors,
      seconds,
      wpm: this.lineCorrect / 5 / (seconds / 60),
      acc,
    })
    const lastLine = !this.config.endless && this.lineIndex >= this.config.lines.length - 1
    if (lastLine) {
      this.victory()
      return
    }
    if (this.config.endless) {
      this.wave++
      this.computeWaveScales()
    } else {
      this.lineIndex++
    }
    this.phase = 'transition'
    this.transitionT = 0.9 // وابل «أحسنت!» + دخول الصف التالي 400ms
    this.setupLine(this.lineIndex)
    this.emitPhase()
  }

  private victory(): void {
    // مكافأة الوقت المتبقي
    if (this.config.lineTimer.enabled && this.line.total > 0) {
      const timeBonus = Math.round((this.line.remaining / this.line.total) * 200)
      if (timeBonus > 0) {
        this.stats.score += timeBonus
        this.cb.onEvent({ type: 'score', score: this.stats.score, delta: timeBonus, streak: this.stats.streak })
      }
    }
    audio.play('levelClear')
    this.phase = 'victory'
    this.endVictory = true
    this.endReason = null
    this.endT = 1.5
    if (!this.reducedMotion) {
      this.timeScale = 0.35 // تباطؤ 600ms على آخر انفجار
      this.slowMoT = 0.6
    }
    this.emitPhase()
  }

  private startBarrage(): void {
    this.phase = 'barrage'
    this.barrageT = 0
    this.barrageFired = false
    this.forceReason = 'انتهى الوقت'
    // توهج شحن لكل المركبات الحية 300ms ثم إطلاق متزامن
    for (const e of this.enemies) {
      if (e.alive) e.charge = 0.3
    }
    this.emitPhase()
  }

  private death(reason: EndReason): void {
    if (this.phase === 'dying' || this.phase === 'over') return
    this.phase = 'dying'
    this.player.alive = false
    this.endVictory = false
    this.endReason = reason
    this.endT = 1.6
    this.pool.explosion(this.player.x, this.player.y, { big: true, reducedMotion: this.reducedMotion })
    audio.play('levelFail')
    if (!this.reducedMotion) {
      this.shakeT = 0.3
      this.shakeMag = 5
    }
    this.cb.onEvent({ type: 'banner', text: 'سقطت المركبة!' })
    this.emitPhase()
  }

  private finish(): void {
    this.phase = 'over'
    this.emitPhase()
    this.cb.onEvent({ type: 'game-over', result: this.buildResult() })
  }

  private computeWpm(): number {
    return this.time > 3 ? this.stats.correct / 5 / (this.time / 60) : 0
  }

  private computeAcc(): number {
    const total = this.stats.correct + this.stats.wrong
    return total > 0 ? this.stats.correct / total : 1
  }

  private buildResult(): RunResult {
    const { config } = this
    return {
      mode: config.mode,
      victory: this.endVictory,
      reason: this.endReason,
      score: this.stats.score,
      wpm: Math.round(this.computeWpm() * 10) / 10,
      acc: Math.round(this.computeAcc() * 1000) / 1000,
      elapsedSec: Math.round(this.time * 10) / 10,
      correct: this.stats.correct,
      wrong: this.stats.wrong,
      timeouts: this.stats.timeouts,
      maxStreak: this.stats.maxStreak,
      linesCleared: this.stats.linesCleared,
      totalLines: config.endless ? this.stats.linesCleared : config.lines.length,
      heartsLeft: this.hearts,
      heartsMax: config.hearts,
      lookDowns: this.stats.lookDowns,
      wave: config.endless ? this.wave : null,
      levelId: config.levelId,
      levelName: config.levelName,
      presetName: config.presetName,
      placementRound: config.placementRound,
      perLine: this.perLine,
    }
  }

  /* ---------- بث الأحداث ---------- */

  private emitTyping(): void {
    this.cb.onEvent({
      type: 'typing',
      text: this.currentText,
      states: [...this.states],
      cursor: this.cursor,
      lastWrongIndex: this.lastWrongIndex,
      nextChar: this.cursor < this.chars.length ? (this.chars[this.cursor] ?? null) : null,
      totalChars: this.chars.length,
    })
  }

  private emitTimers(): void {
    this.cb.onEvent({
      type: 'timers',
      letter: { ...this.letter },
      line: { ...this.line },
      wpm: Math.round(this.computeWpm() * 10) / 10,
      acc: Math.round(this.computeAcc() * 1000) / 1000,
    })
  }

  private emitContext(): void {
    this.cb.onEvent({
      type: 'context',
      wave: this.wave,
      lineIndex: this.lineIndex,
      totalLines: this.config.endless ? -1 : this.config.lines.length,
    })
  }

  private emitPhase(): void {
    this.cb.onEvent({ type: 'phase', phase: this.phase })
  }

  /* ---------- الرسم ---------- */

  private genStars(): void {
    const count = Math.round((this.w * this.h) / 9000)
    this.stars = []
    for (let i = 0; i < count; i++) {
      this.stars.push({
        x: Math.random() * this.w,
        y: Math.random() * this.h,
        r: 0.4 + Math.random() * 1.3,
        layer: Math.random() < 0.6 ? 0 : 1,
        tw: 0.5 + Math.random() * 2,
      })
    }
  }

  private render(): void {
    this.renderBg()
    const ctx = this.ctx
    ctx.clearRect(0, 0, this.w, this.h)
    ctx.save()
    if (this.shakeT > 0 && !this.reducedMotion) {
      const m = this.shakeMag * (this.shakeT / 0.12)
      ctx.translate((Math.random() - 0.5) * 2 * m, (Math.random() - 0.5) * 2 * m)
    }
    this.renderEnemies(ctx)
    this.renderBullets(ctx)
    this.renderPlayer(ctx)
    this.pool.render(ctx)
    ctx.restore()
  }

  private renderBg(): void {
    const ctx = this.bgCtx
    const grad = ctx.createLinearGradient(0, 0, 0, this.h)
    grad.addColorStop(0, '#070B18')
    grad.addColorStop(1, '#05070F')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, this.w, this.h)
    const t = this.time + performance.now() / 1000
    for (const s of this.stars) {
      if (!this.reducedMotion) {
        s.y += (s.layer === 0 ? 6 : 16) * 0.016
        if (s.y > this.h + 2) {
          s.y = -2
          s.x = Math.random() * this.w
        }
      }
      const alpha = 0.35 + 0.45 * Math.abs(Math.sin(t * s.tw))
      ctx.globalAlpha = s.layer === 0 ? alpha * 0.6 : alpha
      ctx.fillStyle = '#E8ECF8'
      ctx.fillRect(s.x, s.y, s.r, s.r)
    }
    ctx.globalAlpha = 1
  }

  private renderEnemies(ctx: CanvasRenderingContext2D): void {
    for (const e of this.enemies) {
      if (!e.alive) continue
      const warp = e.warpT
      const scale = 0.2 + 0.8 * warp
      ctx.save()
      ctx.globalAlpha = warp
      ctx.translate(e.x, e.y)
      ctx.scale(scale, scale)
      // توهج نبضي أرجواني
      const glowPulse = 10 + 6 * Math.sin(this.time * 2 + e.bobPhase)
      const sprite = getSprite(e.tier === 1 ? 'enemy1' : e.tier === 2 ? 'enemy2' : 'enemy3')
      if (sprite) {
        ctx.shadowColor = e.tier === 3 ? '#F87171' : e.tier === 2 ? '#FBBF24' : '#E879F9'
        ctx.shadowBlur = glowPulse
        const w = e.tier === 3 ? e.size * 1.6 : e.size
        ctx.drawImage(sprite, -w / 2, -e.size / 2, w, e.size)
      } else {
        drawEnemyFallback(ctx, 0, 0, e.size, e.tier, glowPulse / 12)
      }
      ctx.restore()
      // شعلة دخول (warp) سماوية
      if (warp < 1 && !this.reducedMotion) {
        ctx.save()
        ctx.globalAlpha = (1 - warp) * 0.7
        ctx.strokeStyle = '#22D3EE'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(e.x, e.y - 60 * (1 - warp) - 30)
        ctx.lineTo(e.x, e.y - 10)
        ctx.stroke()
        ctx.restore()
      }
      // شبكة استهداف سماوية 90ms
      if (e.targetFlash > 0) {
        const r = e.size * 0.7
        ctx.save()
        ctx.globalAlpha = e.targetFlash / 0.09
        ctx.strokeStyle = '#22D3EE'
        ctx.lineWidth = 2
        for (const [sx, sy] of [
          [-1, -1],
          [1, -1],
          [-1, 1],
          [1, 1],
        ]) {
          ctx.beginPath()
          ctx.moveTo(e.x + sx * r, e.y + sy * r - sy * 8)
          ctx.lineTo(e.x + sx * r, e.y + sy * r)
          ctx.lineTo(e.x + sx * r - sx * 8, e.y + sy * r)
          ctx.stroke()
        }
        ctx.restore()
      }
      // توهج الشحن قبل الإطلاق
      if (e.charge > 0 || (this.phase === 'barrage' && !this.barrageFired)) {
        ctx.save()
        ctx.globalAlpha = 0.6
        ctx.fillStyle = '#F87171'
        ctx.shadowColor = '#F87171'
        ctx.shadowBlur = 18
        ctx.beginPath()
        ctx.arc(e.x, e.y + e.size * 0.4, 5 + 2 * Math.sin(this.time * 20), 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }
    }
  }

  private renderBullets(ctx: CanvasRenderingContext2D): void {
    for (const b of this.bullets) {
      if (!b.active) continue
      if (b.kind === 'laser') {
        // قذيفة سماوية 4×18 بتدرج
        const len = 18
        const mag = Math.max(1, Math.hypot(b.vx, b.vy))
        const nx = b.vx / mag
        const ny = b.vy / mag
        const grad = ctx.createLinearGradient(b.x - nx * len, b.y - ny * len, b.x, b.y)
        grad.addColorStop(0, 'rgba(34,211,238,0)')
        grad.addColorStop(1, '#22D3EE')
        ctx.save()
        ctx.strokeStyle = grad
        ctx.lineWidth = 4
        ctx.lineCap = 'round'
        ctx.shadowColor = '#22D3EE'
        ctx.shadowBlur = 8
        ctx.beginPath()
        ctx.moveTo(b.x - nx * len, b.y - ny * len)
        ctx.lineTo(b.x, b.y)
        ctx.stroke()
        ctx.restore()
      } else {
        // كرات قرمزية-حمراء 8px مع ذيول
        for (let i = 0; i < b.trail.length; i++) {
          const tp = b.trail[i]!
          ctx.save()
          ctx.globalAlpha = (i / b.trail.length) * 0.35
          ctx.fillStyle = '#E879F9'
          ctx.beginPath()
          ctx.arc(tp.x, tp.y, 3, 0, Math.PI * 2)
          ctx.fill()
          ctx.restore()
        }
        ctx.save()
        ctx.fillStyle = b.provoked ? '#F87171' : '#E879F9'
        ctx.shadowColor = b.provoked ? '#F87171' : '#E879F9'
        ctx.shadowBlur = 10
        ctx.beginPath()
        ctx.arc(b.x, b.y, 4, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }
    }
  }

  private renderPlayer(ctx: CanvasRenderingContext2D): void {
    const p = this.player
    if (!p.alive) return
    // وهج المحرك الوامض
    const flicker = 0.6 + 0.4 * Math.abs(Math.sin(performance.now() / 60))
    ctx.save()
    ctx.globalAlpha = 0.5 * flicker
    ctx.fillStyle = '#22D3EE'
    ctx.shadowColor = '#22D3EE'
    ctx.shadowBlur = 14
    ctx.beginPath()
    ctx.ellipse(p.x, p.y + PLAYER_SIZE * 0.42, 8, 14 * flicker, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
    const sprite = getSprite('player')
    if (sprite) {
      ctx.save()
      ctx.shadowColor = '#22D3EE'
      ctx.shadowBlur = 14
      ctx.drawImage(sprite, p.x - PLAYER_SIZE / 2, p.y - PLAYER_SIZE / 2, PLAYER_SIZE, PLAYER_SIZE)
      ctx.restore()
    } else {
      drawPlayerFallback(ctx, p.x, p.y, PLAYER_SIZE)
    }
  }
}
