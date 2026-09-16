import { z } from 'zod'

/**
 * طبقة التخزين المحلية — كل الحالة في localStorage تحت النطاق space-typist:v1:*
 * مخططات zod للتحقق + مفاتيح مرقّمة للترحيل المستقبلي.
 */

export const STORAGE_PREFIX = 'space-typist:v1'

export const STORAGE_KEYS = {
  settings: `${STORAGE_PREFIX}:settings`,
  gameRules: `${STORAGE_PREFIX}:game-rules`,
  progress: `${STORAGE_PREFIX}:progress`,
  leaderboard: `${STORAGE_PREFIX}:leaderboard`,
  customPresets: `${STORAGE_PREFIX}:custom-presets`,
  player: `${STORAGE_PREFIX}:player`,
} as const

/* ---------- الإعدادات ---------- */
export const settingsSchema = z.object({
  audio: z.object({
    master: z.number().min(0).max(100).default(80),
    music: z.number().min(0).max(100).default(50),
    sfx: z.number().min(0).max(100).default(90),
    muted: z.boolean().default(false),
    ambientMusic: z.boolean().default(false),
  }).prefault({}),
  fontSize: z.number().min(75).max(125).default(100),
  numerals: z.enum(['western', 'arabic']).default('western'),
  scanlines: z.boolean().default(true),
  keyboardHints: z.boolean().default(true),
  showSpaceHint: z.boolean().default(false),
  charStateGlyphs: z.boolean().default(false),
  /** إلصاق خلايا الأحرف ببعضها (بلا فراغات) كالكتابة العادية */
  joinedChars: z.boolean().default(true),
  reducedMotion: z.boolean().default(false),
})
export type Settings = z.infer<typeof settingsSchema>

/* ---------- قواعد اللعب ---------- */
export const gameRulesSchema = z.object({
  hearts: z.number().int().min(1).max(10).default(3),
  letterTimer: z.object({
    enabled: z.boolean().default(true),
    seconds: z.number().min(1).max(10).default(4),
  }).prefault({}),
  levelTimer: z.object({
    enabled: z.boolean().default(true),
    seconds: z.number().min(10).max(300).default(90),
  }).prefault({}),
  camera: z.object({
    enabled: z.boolean().default(false),
    lookDownThreshold: z.number().min(0.5).max(5).default(1.2),
    damageHearts: z.number().int().min(0).max(3).default(1),
    gracePeriod: z.number().min(0).max(30).default(5),
    showPiP: z.boolean().default(true),
  }).prefault({}),
})
export type GameRules = z.infer<typeof gameRulesSchema>

/* ---------- التقدّم في المراحل ---------- */
export const levelProgressSchema = z.object({
  id: z.number().int(),
  unlocked: z.boolean().default(false),
  stars: z.number().int().min(0).max(3).default(0),
  bestWpm: z.number().default(0),
  bestAcc: z.number().default(0),
  completedAt: z.string().nullable().default(null),
})
export type LevelProgress = z.infer<typeof levelProgressSchema>

export const progressSchema = z.object({
  levels: z.array(levelProgressSchema).default([]),
  placementDone: z.boolean().default(false),
  placementLevelId: z.number().int().nullable().default(null),
})
export type Progress = z.infer<typeof progressSchema>

/* ---------- لوحة النتائج ---------- */
export const leaderboardEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  mode: z.enum(['arcade', 'levels', 'custom', 'placement']),
  score: z.number(),
  wpm: z.number(),
  acc: z.number(),
  wave: z.number().nullable().default(null),
  level: z.number().nullable().default(null),
  date: z.string(),
})
export type LeaderboardEntry = z.infer<typeof leaderboardEntrySchema>

export const leaderboardSchema = z.object({
  entries: z.array(leaderboardEntrySchema).default([]),
})
export type Leaderboard = z.infer<typeof leaderboardSchema>

/* ---------- الإعدادات المخصصة المحفوظة ---------- */
export const customPresetSchema = z.object({
  id: z.string(),
  name: z.string(),
  rules: gameRulesSchema,
  content: z.object({
    source: z.enum(['letters', 'words', 'sentences', 'custom-text']).default('sentences'),
    customText: z.string().default(''),
    includeDigits: z.boolean().default(false),
    includeSymbols: z.boolean().default(false),
  }).prefault({}),
  difficulty: z.object({
    enemySpeed: z.number().min(1).max(10).default(5),
    bulletSpeed: z.number().min(1).max(10).default(5),
    assaultSize: z.number().int().min(1).max(3).default(1),
  }).prefault({}),
  createdAt: z.string(),
})
export type CustomPreset = z.infer<typeof customPresetSchema>

export const customPresetsSchema = z.object({
  presets: z.array(customPresetSchema).default([]),
})
export type CustomPresets = z.infer<typeof customPresetsSchema>

/* ---------- اللاعب ---------- */
export const playerSchema = z.object({
  name: z.string().default('قائد المجرّة'),
  lastMode: z.string().nullable().default(null),
  welcomed: z.boolean().default(false),
})
export type Player = z.infer<typeof playerSchema>

/* ---------- آخر جولة (شريحة القائمة الرئيسية) ---------- */
export const lastRunSchema = z.object({
  mode: z.string(),
  score: z.number(),
  wpm: z.number(),
  acc: z.number(),
  isNewBest: z.boolean().default(false),
  date: z.string(),
})
export type LastRun = z.infer<typeof lastRunSchema>

/* ---------- أدوات القراءة/الكتابة العامة ---------- */
export function loadKey<T>(key: string, schema: z.ZodType<T>): T {
  const attempts: unknown[] = []
  try {
    const raw = localStorage.getItem(key)
    if (raw != null) attempts.push(JSON.parse(raw))
  } catch {
    // JSON تالف — نسقط إلى القيم الافتراضية
  }
  attempts.push({}, undefined)
  for (const attempt of attempts) {
    const result = schema.safeParse(attempt)
    if (result.success) return result.data
  }
  return schema.parse(undefined)
}

export function saveKey<T>(key: string, schema: z.ZodType<T>, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(schema.parse(value)))
  } catch {
    // localStorage ممتلئ أو غير متاح — تجاهل بصمت
  }
}

export const loadSettings = () => loadKey(STORAGE_KEYS.settings, settingsSchema)
export const saveSettings = (v: Settings) => saveKey(STORAGE_KEYS.settings, settingsSchema, v)
export const loadGameRules = () => loadKey(STORAGE_KEYS.gameRules, gameRulesSchema)
export const saveGameRules = (v: GameRules) => saveKey(STORAGE_KEYS.gameRules, gameRulesSchema, v)
export const loadProgress = () => loadKey(STORAGE_KEYS.progress, progressSchema)
export const saveProgress = (v: Progress) => saveKey(STORAGE_KEYS.progress, progressSchema, v)
export const loadLeaderboard = () => loadKey(STORAGE_KEYS.leaderboard, leaderboardSchema)
export const saveLeaderboard = (v: Leaderboard) => saveKey(STORAGE_KEYS.leaderboard, leaderboardSchema, v)
export const loadCustomPresets = () => loadKey(STORAGE_KEYS.customPresets, customPresetsSchema)
export const saveCustomPresets = (v: CustomPresets) => saveKey(STORAGE_KEYS.customPresets, customPresetsSchema, v)
export const loadPlayer = () => loadKey(STORAGE_KEYS.player, playerSchema)
export const savePlayer = (v: Player) => saveKey(STORAGE_KEYS.player, playerSchema, v)
export const loadLastRun = () => loadKey(`${STORAGE_PREFIX}:last-run`, lastRunSchema.nullable().default(null))
export const saveLastRun = (v: LastRun) => saveKey(`${STORAGE_PREFIX}:last-run`, lastRunSchema, v)

/** تصدير كل البيانات كـ JSON (الإعدادات ← إدارة البيانات) */
export function exportAllData(): string {
  return JSON.stringify(
    {
      version: 1,
      settings: loadSettings(),
      gameRules: loadGameRules(),
      progress: loadProgress(),
      leaderboard: loadLeaderboard(),
      customPresets: loadCustomPresets(),
      player: loadPlayer(),
    },
    null,
    2,
  )
}

/** استيراد البيانات من JSON — يرمي خطأ عند فشل التحقق */
export function importAllData(json: string): void {
  const data = JSON.parse(json)
  saveSettings(settingsSchema.parse(data.settings))
  saveGameRules(gameRulesSchema.parse(data.gameRules))
  saveProgress(progressSchema.parse(data.progress))
  saveLeaderboard(leaderboardSchema.parse(data.leaderboard))
  saveCustomPresets(customPresetsSchema.parse(data.customPresets))
  savePlayer(playerSchema.parse(data.player))
}

/** مسح كل بيانات اللعبة */
export function resetAllData(): void {
  for (const key of Object.values(STORAGE_KEYS)) localStorage.removeItem(key)
  localStorage.removeItem(`${STORAGE_PREFIX}:last-run`)
}
