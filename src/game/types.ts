import type { CharState } from '@/components/TypingLine'

/**
 * أنواع محرك اللعب — شاشة /game/:mode
 * mode ∈ arcade | level-:id | custom | placement
 */

export type GameMode = 'arcade' | 'levels' | 'custom' | 'placement'

export type EndReason = 'انتهت القلوب' | 'انتهى الوقت'

export type ArcadeDifficulty = 'easy' | 'normal' | 'hard'

/** مواصفات الصعوبة المحسوبة (تتدرج مع الموجة في الأركيد) */
export interface DifficultySpec {
  /** 1..10 — سرعة نزول الصف */
  enemySpeed: number
  /** 1..10 — سرعة طلقات العدو */
  bulletSpeed: number
  /** 1..3 — عدد المركبات المهاجمة في الهجوم المستفَز */
  assaultSize: number
  /** مركبات نخبة (ضربتان) */
  elites: boolean
  /** مضاعف النقاط (صعب = 1.25) */
  scoreMultiplier: number
  /** إلغاء التفادي التلقائي — كل الطلقات تصيب */
  noDodge: boolean
}

/** قواعد الكتابة */
export interface TypingRules {
  /** الإيقاف عند الخطأ — يجب إعادة كتابة الحرف */
  stopOnError: boolean
  /** تساهل الهمزات: أ/إ/آ/ء/ؤ/ئ قابلة للتبادل */
  hamzaLeniency: boolean
  /** تجاهل التشكيل والتطويل */
  ignoreDiacritics: boolean
}

/** إعداد الجولة المحلول من المسار + التخزين */
export interface GameConfig {
  mode: GameMode
  /** سطر السياق في الشريط العلوي */
  title: string
  levelId: number | null
  levelName: string | null
  targetWpm: number | null
  presetName: string | null
  placementRound: number | null
  /** طور لا نهائي (أركيد) — الأسطر تُولَّد موجة بموجة */
  endless: boolean
  /** أسطر المحتوى (غير الأركيد) */
  lines: string[]
  hearts: number
  letterTimer: { enabled: boolean; seconds: number }
  lineTimer: { enabled: boolean; seconds: number; scope: 'line' | 'level' }
  camera: { enabled: boolean; damageHearts: number; gracePeriod: number }
  difficulty: DifficultySpec
  typing: TypingRules
  arcadeDifficulty: ArcadeDifficulty
}

/** إحصائية سطر واحد (مخطط الأداء في شاشة النتائج) */
export interface LineStat {
  text: string
  correct: number
  errors: number
  seconds: number
  wpm: number
  acc: number
}

/** حمولة نتيجة الجولة — تُمرر إلى /results عبر navigate state وتُحفظ محلياً */
export interface RunResult {
  mode: GameMode
  victory: boolean
  reason: EndReason | null
  score: number
  wpm: number
  acc: number
  elapsedSec: number
  correct: number
  wrong: number
  timeouts: number
  maxStreak: number
  linesCleared: number
  totalLines: number
  heartsLeft: number
  heartsMax: number
  lookDowns: number
  wave: number | null
  levelId: number | null
  levelName: string | null
  presetName: string | null
  placementRound: number | null
  perLine: LineStat[]
}

/** نتيجة مُغناة بعد الحفظ (تُمرر في state إلى /results) */
export interface FinalizedRun extends RunResult {
  stars: number
  isNewBest: boolean
  rank: number | null
  nextLevelId: number | null
  /** معرّف إدخال لوحة الشرف المسجّل (يُمرر لشاشة النتائج لتفادي التكرار) */
  entryId: string
}

export type EnginePhase =
  | 'ready'
  | 'playing'
  | 'paused'
  | 'transition'
  | 'barrage'
  | 'victory'
  | 'dying'
  | 'over'

export interface TimerState {
  remaining: number
  total: number
}

/** أحداث المحرك نحو واجهة React */
export type EngineEvent =
  | {
      type: 'typing'
      text: string
      states: CharState[]
      cursor: number
      lastWrongIndex: number | null
      nextChar: string | null
      totalChars: number
    }
  | { type: 'score'; score: number; delta: number; streak: number }
  | { type: 'hearts'; hearts: number }
  | { type: 'timers'; letter: TimerState; line: TimerState; wpm: number; acc: number }
  | { type: 'context'; wave: number; lineIndex: number; totalLines: number }
  | { type: 'hit' }
  | { type: 'banner'; text: string }
  | { type: 'camera-shot' }
  | { type: 'phase'; phase: EnginePhase }
  | { type: 'game-over'; result: RunResult }

export interface EngineCallbacks {
  onEvent: (e: EngineEvent) => void
}
