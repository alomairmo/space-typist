/**
 * محرك الصوت — كل المؤثرات مولّدة عبر Web Audio API (بلا ملفات صوتية).
 * سياق صوتي واحد، مذبذب لكل مؤثر مع أغلفة قصيرة.
 */

export type SfxName =
  | 'laser'
  | 'explosion'
  | 'correct'
  | 'wrong'
  | 'heartLoss'
  | 'levelClear'
  | 'levelFail'
  | 'menuHover'
  | 'menuClick'
  | 'timerTick'
  | 'cameraWarning'
  | 'countdown'
  | 'countdownGo'
  | 'lock'

export interface AudioVolumes {
  master: number // 0..100
  music: number
  sfx: number
  muted: boolean
  ambientMusic: boolean
}

class AudioEngine {
  private ctx: AudioContext | null = null
  private masterGain: GainNode | null = null
  private sfxGain: GainNode | null = null
  private musicGain: GainNode | null = null
  private noiseBuffer: AudioBuffer | null = null
  private ambientNodes: { oscs: OscillatorNode[]; gain: GainNode } | null = null
  private volumes: AudioVolumes = { master: 80, music: 50, sfx: 90, muted: false, ambientMusic: false }

  /** يجب استدعاؤها من تفاعل مستخدم (نقرة/زر) أول مرة */
  ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AC) return null
      this.ctx = new AC()
      this.masterGain = this.ctx.createGain()
      this.masterGain.connect(this.ctx.destination)
      this.sfxGain = this.ctx.createGain()
      this.sfxGain.connect(this.masterGain)
      this.musicGain = this.ctx.createGain()
      this.musicGain.connect(this.masterGain)
      this.applyVolumes()
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    return this.ctx
  }

  setVolumes(v: AudioVolumes): void {
    this.volumes = v
    this.applyVolumes()
    if (v.ambientMusic) this.startAmbient()
    else this.stopAmbient()
  }

  private applyVolumes(): void {
    if (!this.ctx || !this.masterGain || !this.sfxGain || !this.musicGain) return
    const muted = this.volumes.muted ? 0 : 1
    const t = this.ctx.currentTime
    this.masterGain.gain.setTargetAtTime((this.volumes.master / 100) * muted, t, 0.02)
    this.sfxGain.gain.setTargetAtTime(this.volumes.sfx / 100, t, 0.02)
    this.musicGain.gain.setTargetAtTime(this.volumes.music / 100, t, 0.02)
  }

  private getNoiseBuffer(): AudioBuffer {
    const ctx = this.ensureContext()!
    if (!this.noiseBuffer) {
      const len = Math.floor(ctx.sampleRate * 0.5)
      this.noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate)
      const data = this.noiseBuffer.getChannelData(0)
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
    }
    return this.noiseBuffer
  }

  private tone(opts: {
    type: OscillatorType
    from: number
    to?: number
    duration: number
    gain?: number
    when?: number
    destination?: GainNode | null
  }): void {
    const ctx = this.ensureContext()
    if (!ctx || !this.sfxGain) return
    const { type, from, to, duration, gain = 0.25, when = 0, destination } = opts
    const t0 = ctx.currentTime + when
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(from, t0)
    if (to != null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + duration)
    g.gain.setValueAtTime(gain, t0)
    g.gain.exponentialRampToValueAtTime(0.001, t0 + duration)
    osc.connect(g)
    g.connect(destination ?? this.sfxGain)
    osc.start(t0)
    osc.stop(t0 + duration + 0.02)
  }

  play(name: SfxName): void {
    const ctx = this.ensureContext()
    if (!ctx || this.volumes.muted) return
    switch (name) {
      case 'laser':
        // طلقة ليزر: مربع 880←220 هرتز، 90ms
        this.tone({ type: 'square', from: 880, to: 220, duration: 0.09, gain: 0.18 })
        break
      case 'explosion': {
        // انفجار: دفقة ضجيج + مرشح تمرير منخفض، 350ms
        const src = ctx.createBufferSource()
        src.buffer = this.getNoiseBuffer()
        const lp = ctx.createBiquadFilter()
        lp.type = 'lowpass'
        lp.frequency.setValueAtTime(1800, ctx.currentTime)
        lp.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.35)
        const g = ctx.createGain()
        g.gain.setValueAtTime(0.5, ctx.currentTime)
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35)
        src.connect(lp)
        lp.connect(g)
        g.connect(this.sfxGain!)
        src.start()
        src.stop(ctx.currentTime + 0.4)
        break
      }
      case 'correct':
        // حرف صحيح: جيب 660 هرتز، 60ms
        this.tone({ type: 'sine', from: 660, duration: 0.06, gain: 0.22 })
        break
      case 'wrong':
        // حرف خاطئ: منشار 140 هرتز، 150ms
        this.tone({ type: 'sawtooth', from: 140, duration: 0.15, gain: 0.2 })
        break
      case 'heartLoss':
        // فقدان قلب: ثلاث نغمات هابطة
        this.tone({ type: 'triangle', from: 440, duration: 0.12, gain: 0.25 })
        this.tone({ type: 'triangle', from: 330, duration: 0.12, gain: 0.25, when: 0.12 })
        this.tone({ type: 'triangle', from: 220, duration: 0.22, gain: 0.28, when: 0.24 })
        break
      case 'levelClear':
        // نجاح المرحلة: أربجيو صاعد دو-مي-صول-دو
        ;[523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
          this.tone({ type: 'square', from: f, duration: 0.16, gain: 0.16, when: i * 0.11 }),
        )
        break
      case 'levelFail':
        // فشل: انحدار تدريجي
        this.tone({ type: 'sawtooth', from: 400, to: 60, duration: 0.8, gain: 0.22 })
        break
      case 'menuHover':
        this.tone({ type: 'sine', from: 1200, duration: 0.03, gain: 0.06 })
        break
      case 'menuClick':
        this.tone({ type: 'sine', from: 880, duration: 0.05, gain: 0.12 })
        this.tone({ type: 'sine', from: 1320, duration: 0.04, gain: 0.08, when: 0.04 })
        break
      case 'timerTick':
        this.tone({ type: 'square', from: 990, duration: 0.04, gain: 0.1 })
        break
      case 'cameraWarning':
        this.tone({ type: 'square', from: 620, duration: 0.1, gain: 0.16 })
        this.tone({ type: 'square', from: 470, duration: 0.12, gain: 0.16, when: 0.12 })
        break
      case 'countdown':
        this.tone({ type: 'sine', from: 440, duration: 0.12, gain: 0.2 })
        break
      case 'countdownGo':
        this.tone({ type: 'sine', from: 880, duration: 0.3, gain: 0.25 })
        break
      case 'lock':
        this.tone({ type: 'square', from: 160, duration: 0.08, gain: 0.15 })
        this.tone({ type: 'square', from: 110, duration: 0.1, gain: 0.15, when: 0.07 })
        break
    }
  }

  /** موسيقى خلفية اختيارية: طبقة درون متكررة بالمذبذبات */
  startAmbient(): void {
    const ctx = this.ensureContext()
    if (!ctx || !this.musicGain || this.ambientNodes) return
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0, ctx.currentTime)
    gain.gain.setTargetAtTime(0.06, ctx.currentTime, 1.5)
    gain.connect(this.musicGain)
    const freqs = [55, 82.5, 110, 165]
    const oscs = freqs.map((f, i) => {
      const osc = ctx.createOscillator()
      osc.type = i % 2 === 0 ? 'sine' : 'triangle'
      osc.frequency.value = f
      osc.detune.setValueAtTime(i * 3 - 4, ctx.currentTime)
      osc.connect(gain)
      osc.start()
      return osc
    })
    this.ambientNodes = { oscs, gain }
  }

  stopAmbient(): void {
    if (!this.ambientNodes || !this.ctx) return
    const { oscs, gain } = this.ambientNodes
    gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.4)
    const nodes = oscs
    window.setTimeout(() => nodes.forEach((o) => o.stop()), 1500)
    this.ambientNodes = null
  }
}

/** نسخة عامة واحدة */
export const audio = new AudioEngine()
