/**
 * محرك اختبار تحديد المستوى — محتوى ثابت البذرة (عدالة النتائج)،
 * حساب السرعة والدقة، وتعيين شريحة المستوى والمراحل المفتوحة.
 */

/** مولد عشوائي ثابت البذرة (mulberry32) — نفس الجولات لكل طالب */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** اختيار n عناصر من قائمة ببذرة ثابتة (خلط فيشر-ييتس جزئي) */
export function seededPick<T>(pool: readonly T[], n: number, seed: number): T[] {
  const rand = mulberry32(seed)
  const arr = [...pool]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j]!, arr[i]!]
  }
  return arr.slice(0, Math.min(n, arr.length))
}

export interface PlacementRound {
  /** اسم الجولة المعروض في اللافتة */
  name: string
  /** وصف قصير يظهر في قائمة المعاينة */
  micro: string
  lines: string[]
}

export const PLACEMENT_SEED = 20250611

const HOME_ROW_POOL = [
  'ت ن ا م ل ك ب ط ي س ش',
  'ش س ي ب ل ا ت ن م ك ط',
  'شسيب لاتن مكط اشل',
  'سلك شبك كلب شمل',
  'بكم شلاك سيل طيش',
  'سيبان كشلان بسكلات',
] as const

const WORDS_POOL = [
  'من على كتاب مدرسة جميل',
  'في هذا الذي كان عن بعد',
  'قلم صفحة حقيبة قهوة',
  'جمل حصان دجاج ثعلب',
  'عقل حقل نخلة ضحك',
  'قلبي صفحة جديدة نظيفة',
] as const

const SENTENCES_POOL = [
  'العلم في الصغر كالنقش على الحجر',
  'من جد وجد ومن زرع حصد',
] as const

/** الجولات الثلاث — محتوى ثابت لكل المستخدمين */
export function buildPlacementRounds(): PlacementRound[] {
  return [
    {
      name: 'أحرف الصف الرئيسي',
      micro: 'مثال: «ش س ي ب ل ا ت ن م ك ط»',
      lines: seededPick(HOME_ROW_POOL, 3, PLACEMENT_SEED),
    },
    {
      name: 'كلمات عربية',
      micro: 'مثال: «من على كتاب مدرسة جميل»',
      lines: seededPick(WORDS_POOL, 3, PLACEMENT_SEED + 1),
    },
    {
      name: 'جملة كاملة',
      micro: 'مثال: «العلم في الصغر كالنقش على الحجر»',
      lines: [...SENTENCES_POOL],
    },
  ]
}

/* ---------- الإحصاءات ---------- */

export interface RoundStats {
  correctChars: number
  wrongChars: number
  /** مللي ثانية من أول ضغطة حتى نهاية آخر سطر */
  elapsedMs: number
}

export const emptyRoundStats = (): RoundStats => ({ correctChars: 0, wrongChars: 0, elapsedMs: 0 })

export function mergeStats(rounds: RoundStats[]): RoundStats {
  return rounds.reduce<RoundStats>(
    (acc, r) => ({
      correctChars: acc.correctChars + r.correctChars,
      wrongChars: acc.wrongChars + r.wrongChars,
      elapsedMs: acc.elapsedMs + r.elapsedMs,
    }),
    emptyRoundStats(),
  )
}

/** الكلمة = 5 أحرف (المعيار الدولي) */
export function wpmOf(s: RoundStats): number {
  const minutes = s.elapsedMs / 60000
  if (minutes <= 0) return 0
  return s.correctChars / 5 / minutes
}

export function accuracyOf(s: RoundStats): number {
  const total = s.correctChars + s.wrongChars
  if (total === 0) return 100
  return (s.correctChars / total) * 100
}

/* ---------- شريحة المستوى ---------- */

export type PlacementBand = 'مبتدئ' | 'متوسط' | 'متقدم' | 'محترف'

export interface PlacementResult {
  band: PlacementBand
  /** لون الشريحة (سماوي ← كهرماني ← أرجواني ← ذهبي) */
  bandColor: string
  bandGlow: string
  /** آخر مرحلة تُفتح (1..30) */
  levelId: number
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

/** ربط خطي ضمن نطاق */
const bandLevel = (wpm: number, fromWpm: number, toWpm: number, fromLevel: number, toLevel: number) =>
  Math.round(fromLevel + (clamp((wpm - fromWpm) / (toWpm - fromWpm), 0, 1) * (toLevel - fromLevel)))

/**
 * يحسب الشريحة والمرحلة من السرعة (ك/د) والدقة (٪).
 * الدقة شرط أهلية لكل شريحة، والسرعة تحدد الموقع داخلها.
 */
export function computePlacement(wpm: number, acc: number): PlacementResult {
  if (wpm >= 30 && acc >= 95) {
    return {
      band: 'محترف',
      bandColor: 'text-[#FDE68A]',
      bandGlow: '',
      levelId: bandLevel(wpm, 30, 40, 27, 30),
    }
  }
  if (wpm >= 22 && acc >= 92) {
    return {
      band: 'متقدم',
      bandColor: 'text-neon-magenta',
      bandGlow: 'text-glow-magenta',
      levelId: bandLevel(wpm, 22, 30, 19, 26),
    }
  }
  if (wpm >= 12 && acc >= 85) {
    return {
      band: 'متوسط',
      bandColor: 'text-neon-amber',
      bandGlow: '',
      levelId: bandLevel(wpm, 12, 22, 7, 18),
    }
  }
  // مبتدئ — سماوي (أول سلّم الألوان: سماوي ← كهرماني ← أرجواني ← ذهبي)
  return {
    band: 'مبتدئ',
    bandColor: 'text-neon-cyan',
    bandGlow: 'text-glow-cyan',
    levelId: bandLevel(wpm, 0, 12, 1, 6),
  }
}
