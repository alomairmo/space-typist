import { z } from 'zod'
import { ARCADE_SENTENCES, getLevel } from '@/lib/curriculum'
import {
  STORAGE_PREFIX,
  customPresetsSchema,
  gameRulesSchema,
  loadGameRules,
  loadKey,
} from '@/lib/storage'
import type { ArcadeDifficulty, GameConfig, GameMode } from '@/game/types'

/**
 * حلّ إعداد الجولة من المسار:
 *   /game/arcade[?difficulty=easy|normal|hard]
 *   /game/level-:id  (يُقبل أيضاً level_:id أو level/:id أو ?id= أو رقم صرف)
 *   /game/custom     (يقرأ المسودة space-typist:v1:custom-draft ثم آخر إعداد محفوظ)
 *   /game/placement[?round=1..3]
 */

/* ---------- مسودة الطور المخصص (عقد مع صفحة /custom) ---------- */
export const CUSTOM_DRAFT_KEY = `${STORAGE_PREFIX}:custom-draft`

export const customDraftSchema = z.object({
  name: z.string().default('طور مخصص'),
  rules: gameRulesSchema.partial().default({}),
  content: z
    .object({
      source: z.enum(['letters', 'words', 'sentences', 'custom-text']).default('sentences'),
      customText: z.string().default(''),
      includeDigits: z.boolean().default(false),
      includeSymbols: z.boolean().default(false),
      shuffle: z.boolean().default(false),
    })
    .partial()
    .default({}),
  difficulty: z
    .object({
      enemySpeed: z.number().min(1).max(10).default(5),
      bulletSpeed: z.number().min(1).max(10).default(5),
      assaultSize: z.number().int().min(1).max(3).default(1),
      elites: z.boolean().default(false),
      noDodge: z.boolean().default(false),
    })
    .partial()
    .default({}),
  typing: z
    .object({
      stopOnError: z.boolean().default(false),
      hamzaLeniency: z.boolean().default(false),
      ignoreDiacritics: z.boolean().default(true),
    })
    .partial()
    .default({}),
  lineTimerScope: z.enum(['line', 'level']).default('line'),
})
export type CustomDraft = z.infer<typeof customDraftSchema>

export function loadCustomDraft(): CustomDraft | null {
  try {
    if (localStorage.getItem(CUSTOM_DRAFT_KEY) == null) return null
    return loadKey(CUSTOM_DRAFT_KEY, customDraftSchema)
  } catch {
    return null
  }
}

/* ---------- محتوى ثابت ---------- */

/** جولات اختبار تحديد المستوى (بذرة ثابتة للعدل) */
const PLACEMENT_ROUNDS: { name: string; lines: string[] }[] = [
  {
    name: 'أحرف الصف الرئيسي',
    lines: ['ش س ي ب ل ا ت ن م ك ط', 'تنما امنت ماتن كلا سيب', 'سلك شبك كلب شمل بكم'],
  },
  {
    name: 'كلمات عربية',
    lines: ['في من على إلى أن هذا', 'كتاب مدرسة جميل قلم بيت', 'قلم صفحة حقيبة قهوة صقر'],
  },
  {
    name: 'جملة كاملة',
    lines: ['العلم في الصغر كالنقش على الحجر.', 'من جد وجد ومن زرع حصد.'],
  },
]

const LETTER_LINES = ['ش س ي ب ل ا ت ن م ك ط', 'ض ص ث ق ف غ ع ه خ ح ج د', 'ئ ء ؤ ر لا ى ة و ز ظ']
const WORD_LINES = ['باب مكتب كتاب سلام', 'كلب بطة ملاك تلميذ', 'قلم صفحة حقيبة قهوة']
const DIGIT_LINES = ['123 456 789 0', '12 34 56 78 90']
const SYMBOL_LINES = ['مرحبا. كيف حالك؟', 'نعم، لا، ربما!', '@ # ٪ ( ) - رموز']

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}

/* ---------- تحليل المسار ---------- */

export interface ParsedRoute {
  mode: GameMode
  levelId: number | null
  placementRound: number | null
  arcadeDifficulty: ArcadeDifficulty
}

/** يحلّل param‏ :mode + استعلام البحث إلى وضع اللعب */
export function parseGameRoute(modeParam: string | undefined, search: URLSearchParams): ParsedRoute | null {
  const raw = (modeParam ?? '').trim()
  // عقد صفحة الأركيد: تخزّن الصعوبة المختارة في sessionStorage قبل التنقل
  const storedDifficulty =
    typeof sessionStorage !== 'undefined'
      ? sessionStorage.getItem('space-typist:v1:arcade-difficulty')
      : null
  const difficulty = (search.get('difficulty') ?? storedDifficulty ?? 'normal') as ArcadeDifficulty
  const arcadeDifficulty: ArcadeDifficulty = ['easy', 'normal', 'hard'].includes(difficulty) ? difficulty : 'normal'

  if (raw === 'arcade') return { mode: 'arcade', levelId: null, placementRound: null, arcadeDifficulty }
  if (raw === 'custom') return { mode: 'custom', levelId: null, placementRound: null, arcadeDifficulty }
  if (raw === 'placement') {
    const r = Number(search.get('round') ?? '1')
    const round = Number.isInteger(r) && r >= 1 && r <= 3 ? r : 1
    return { mode: 'placement', levelId: null, placementRound: round, arcadeDifficulty }
  }
  // عقد صفحتَي النتائج/تحديد المستوى: /game/levels?level=N
  if (raw === 'levels') {
    const q = Number(search.get('level') ?? '1')
    const id = Number.isInteger(q) && q > 0 ? q : 1
    if (getLevel(id)) return { mode: 'levels', levelId: id, placementRound: null, arcadeDifficulty }
    return null
  }
  // level-3 | level_3 | level/3 | level?id=3 | 3
  let levelId: number | null = null
  const m = /^level[-_/]?(\d+)$/i.exec(raw) ?? /^(\d+)$/.exec(raw)
  if (m) levelId = Number(m[1])
  else if (raw === 'level') {
    const q = Number(search.get('id') ?? '1')
    levelId = Number.isInteger(q) && q > 0 ? q : 1
  }
  if (levelId != null && getLevel(levelId)) {
    return { mode: 'levels', levelId, placementRound: null, arcadeDifficulty }
  }
  return null
}

/* ---------- بناء الإعداد ---------- */

const clampSpeed = (v: number) => Math.min(10, Math.max(1, Math.round(v)))

/** الإعداد الافتراضي من قواعد اللعب المخزنة */
function baseConfig(mode: GameMode): GameConfig {
  const rules = loadGameRules()
  return {
    mode,
    title: '',
    levelId: null,
    levelName: null,
    targetWpm: null,
    presetName: null,
    placementRound: null,
    endless: false,
    lines: [],
    hearts: rules.hearts,
    letterTimer: { enabled: rules.letterTimer.enabled, seconds: rules.letterTimer.seconds },
    lineTimer: { enabled: rules.levelTimer.enabled, seconds: rules.levelTimer.seconds, scope: 'line' as const },
    camera: {
      enabled: rules.camera.enabled,
      damageHearts: rules.camera.damageHearts,
      gracePeriod: rules.camera.gracePeriod,
    },
    difficulty: {
      enemySpeed: 5,
      bulletSpeed: 5,
      assaultSize: 1,
      elites: false,
      scoreMultiplier: 1,
      noDodge: false,
    },
    typing: { stopOnError: false, hamzaLeniency: false, ignoreDiacritics: false },
    arcadeDifficulty: 'normal',
  }
}

function arcadeConfig(difficulty: ArcadeDifficulty): GameConfig {
  const cfg = baseConfig('arcade')
  cfg.endless = true
  cfg.title = 'طور الأركيد'
  cfg.arcadeDifficulty = difficulty
  if (difficulty === 'easy') {
    cfg.hearts = Math.min(10, cfg.hearts + 1)
    cfg.difficulty.enemySpeed = 3
    cfg.difficulty.bulletSpeed = 3
  } else if (difficulty === 'hard') {
    cfg.difficulty.enemySpeed = 7
    cfg.difficulty.bulletSpeed = 7
    cfg.difficulty.scoreMultiplier = 1.25
  }
  return cfg
}

function levelConfig(levelId: number): GameConfig | null {
  const level = getLevel(levelId)
  if (!level) return null
  const cfg = baseConfig('levels')
  cfg.levelId = level.id
  cfg.levelName = level.name
  cfg.title = `المرحلة ${level.id} — ${level.name}`
  cfg.targetWpm = level.targetWpm
  cfg.lines = level.lines
  const r = level.rules
  if (r.hearts != null) cfg.hearts = r.hearts
  if (r.letterSeconds != null) cfg.letterTimer = { enabled: true, seconds: r.letterSeconds }
  if (r.lineSeconds != null) cfg.lineTimer = { enabled: true, seconds: r.lineSeconds, scope: 'line' }
  if (r.enemySpeed != null) {
    cfg.difficulty.enemySpeed = clampSpeed(r.enemySpeed)
    cfg.difficulty.bulletSpeed = clampSpeed(r.enemySpeed)
  }
  return cfg
}

function placementConfig(round: number): GameConfig {
  const cfg = baseConfig('placement')
  const r = PLACEMENT_ROUNDS[round - 1] ?? PLACEMENT_ROUNDS[0]!
  // قواعد مبسطة ثابتة: ٥ قلوب · بدون عداد حرف · عداد جملة سخي ١٢٠ث · بلا كاميرا
  cfg.placementRound = round
  cfg.title = `اختبار المستوى — الجولة ${round} من 3`
  cfg.lines = r.lines
  cfg.hearts = 5
  cfg.letterTimer = { enabled: false, seconds: 0 }
  cfg.lineTimer = { enabled: true, seconds: 120, scope: 'line' }
  cfg.camera = { enabled: false, damageHearts: 0, gracePeriod: 0 }
  cfg.difficulty.enemySpeed = 3
  cfg.difficulty.bulletSpeed = 3
  return cfg
}

function customConfig(): GameConfig {
  const cfg = baseConfig('custom')

  // 1) مسودة صفحة /custom (الأولوية) 2) آخر إعداد محفوظ 3) افتراضي
  let draft = loadCustomDraft()
  if (!draft) {
    const presets = loadKey('space-typist:v1:custom-presets', customPresetsSchema).presets
    const last = [...presets].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
    if (last) {
      draft = customDraftSchema.parse({
        name: last.name,
        rules: last.rules,
        content: last.content,
        difficulty: last.difficulty,
      })
    }
  }

  const stored = loadGameRules()
  if (draft) {
    cfg.presetName = draft.name
    cfg.title = `الطور المخصص — ${draft.name}`
    const rules = { ...stored, ...draft.rules }
    cfg.hearts = rules.hearts
    cfg.letterTimer = { enabled: rules.letterTimer.enabled, seconds: rules.letterTimer.seconds }
    cfg.lineTimer = {
      enabled: rules.levelTimer.enabled,
      seconds: rules.levelTimer.seconds,
      scope: draft.lineTimerScope ?? 'line',
    }
    cfg.camera = {
      enabled: rules.camera.enabled,
      damageHearts: rules.camera.damageHearts,
      gracePeriod: rules.camera.gracePeriod,
    }
    const d = draft.difficulty
    cfg.difficulty.enemySpeed = clampSpeed(d.enemySpeed ?? 5)
    cfg.difficulty.bulletSpeed = clampSpeed(d.bulletSpeed ?? 5)
    cfg.difficulty.assaultSize = Math.min(3, Math.max(1, Math.round(d.assaultSize ?? 1)))
    cfg.difficulty.elites = d.elites ?? false
    cfg.difficulty.noDodge = d.noDodge ?? false
    cfg.typing = {
      stopOnError: draft.typing.stopOnError ?? false,
      hamzaLeniency: draft.typing.hamzaLeniency ?? false,
      ignoreDiacritics: draft.typing.ignoreDiacritics ?? true,
    }
    // المحتوى
    const c = draft.content
    let lines: string[] = []
    if (c.source === 'custom-text' && (c.customText ?? '').trim().length >= 3) {
      lines = (c.customText ?? '')
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length >= 3)
    } else if (c.source === 'letters') {
      lines = [...LETTER_LINES]
    } else if (c.source === 'words') {
      lines = [...WORD_LINES]
    } else {
      lines = ARCADE_SENTENCES.filter((g) => g.minWave >= 3).flatMap((g) => g.lines)
    }
    if (c.includeDigits) lines.push(...DIGIT_LINES)
    if (c.includeSymbols) lines.push(...SYMBOL_LINES)
    if (c.shuffle) lines = shuffle(lines)
    cfg.lines = lines
  } else {
    cfg.title = 'الطور المخصص'
    cfg.lines = [...WORD_LINES]
  }
  if (cfg.lines.length === 0) cfg.lines = [...WORD_LINES]
  return cfg
}

/** نقطة الدخول: يبني إعداد الجولة الكامل أو null إن كان المسار غير صالح */
export function resolveGameConfig(modeParam: string | undefined, search: URLSearchParams): GameConfig | null {
  const parsed = parseGameRoute(modeParam, search)
  if (!parsed) return null
  switch (parsed.mode) {
    case 'arcade':
      return arcadeConfig(parsed.arcadeDifficulty)
    case 'levels':
      return parsed.levelId != null ? levelConfig(parsed.levelId) : null
    case 'placement':
      return placementConfig(parsed.placementRound ?? 1)
    case 'custom':
      return customConfig()
  }
}
