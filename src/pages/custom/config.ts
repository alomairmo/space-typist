import { z } from 'zod'
import type { CustomPreset, GameRules } from '@/lib/storage'
import { STORAGE_KEYS, loadGameRules } from '@/lib/storage'

/**
 * نموذج إعداد الطور المخصص الكامل + مسودّته + الإعدادات المحفوظة (presets).
 *
 * عقود التخزين:
 * - `space-typist:v1:custom-draft` — المسودة الكاملة (تُحفظ تلقائياً عند كل تغيير).
 * - `space-typist:v1:custom-presets` — نفس مفتاح storage.ts المشترك، لكن كل preset
 *   يحمل أيضاً الحقل الإضافي `config` (الإعداد الكامل). المخطط الأساسي في storage.ts
 *   يتجاهل الحقول الإضافية، فيبقى توافق القراء الآخرين (الرئيسية/اللعب) سليماً،
 *   بينما تقرأ هذه الصفحة الحقل الكامل لاستعادة كل القيم.
 * - `space-typist:v1:rules-extra` — قواعد لعب إضافية غير موجودة في مخطط game-rules
 *   (نطاق مؤقت المرحلة، التفادي التلقائي، صعوبة الأركيد، اهتزاز الشاشة...).
 * - `space-typist:v1:ui-prefs` — تفضيلات واجهة إضافية (أصوات القوائم، تنبيه الوقت،
 *   التباين العالي، وضع تلميح لوحة المفاتيح).
 */

export const CUSTOM_DRAFT_KEY = 'space-typist:v1:custom-draft'
export const RULES_EXTRA_KEY = 'space-typist:v1:rules-extra'
export const UI_PREFS_KEY = 'space-typist:v1:ui-prefs'

export const MAX_USER_PRESETS = 12

/* ---------- سرعة نزول الصف (مقطعية): بطيء/متوسط/سريع/جنوني = 6/10/14/20 px/s ---------- */
export const DESCENT_SPEEDS = [
  { value: 'slow', label: 'بطيء', px: 6 },
  { value: 'medium', label: 'متوسط', px: 10 },
  { value: 'fast', label: 'سريع', px: 14 },
  { value: 'insane', label: 'جنوني', px: 20 },
] as const
export type DescentSpeed = (typeof DESCENT_SPEEDS)[number]['value']
export const descentPx = (v: DescentSpeed): number =>
  DESCENT_SPEEDS.find((s) => s.value === v)?.px ?? 10

/* ---------- الإعداد الكامل للطور المخصص ---------- */
export const customConfigSchema = z.object({
  hearts: z.number().int().min(1).max(10).default(3),
  bonusHearts: z
    .object({
      enabled: z.boolean().default(false),
      max: z.number().int().min(1).max(10).default(5),
    })
    .prefault({}),
  letterTimer: z
    .object({
      enabled: z.boolean().default(true),
      seconds: z.number().min(1).max(10).default(4),
      resetOnError: z.boolean().default(true),
    })
    .prefault({}),
  levelTimer: z
    .object({
      enabled: z.boolean().default(true),
      scope: z.enum(['line', 'level']).default('line'),
      seconds: z.number().min(20).max(180).default(60),
    })
    .prefault({}),
  camera: z
    .object({
      enabled: z.boolean().default(false),
      lookDownThreshold: z.number().min(0.5).max(3).default(1.2),
      damageHearts: z.number().int().min(0).max(3).default(1),
      showPiP: z.boolean().default(true),
    })
    .prefault({}),
  ships: z
    .object({
      descentSpeed: z.enum(['slow', 'medium', 'fast', 'insane']).default('medium'),
      bulletSpeed: z.number().min(200).max(600).default(300),
      rows: z.number().int().min(1).max(3).default(1),
      eliteShips: z.boolean().default(false),
      autoDodge: z.boolean().default(true),
    })
    .prefault({}),
  typing: z
    .object({
      stopOnError: z.boolean().default(false),
      hamzaLeniency: z.boolean().default(false),
      ignoreDiacritics: z.boolean().default(true),
      showSpaces: z.boolean().default(false),
      source: z.enum(['library', 'custom']).default('library'),
    })
    .prefault({}),
  content: z
    .object({
      length: z.enum(['short', 'medium', 'long']).default('medium'),
      category: z.enum(['proverbs', 'literature', 'science', 'daily', 'random']).default('random'),
      customText: z.string().default(''),
      shuffle: z.boolean().default(false),
    })
    .prefault({}),
})
export type CustomConfig = z.infer<typeof customConfigSchema>

/* ---------- قواعد لعب إضافية (مشتركة مع تبويب «اللعب» في الإعدادات) ---------- */
export const extraRulesSchema = z.object({
  levelTimerScope: z.enum(['line', 'level']).default('line'),
  letterResetOnError: z.boolean().default(true),
  autoDodge: z.boolean().default(true),
  arcadeDifficulty: z.enum(['easy', 'normal', 'hard']).default('normal'),
  screenShake: z.boolean().default(true),
})
export type ExtraRules = z.infer<typeof extraRulesSchema>

export function loadExtraRules(): ExtraRules {
  try {
    const raw = localStorage.getItem(RULES_EXTRA_KEY)
    const result = extraRulesSchema.safeParse(raw ? JSON.parse(raw) : undefined)
    if (result.success) return result.data
  } catch {
    // JSON تالف
  }
  return extraRulesSchema.parse({})
}

export function saveExtraRules(v: ExtraRules): void {
  try {
    localStorage.setItem(RULES_EXTRA_KEY, JSON.stringify(extraRulesSchema.parse(v)))
  } catch {
    // تجاهل
  }
}

/* ---------- تفضيلات واجهة إضافية (تبويبا الصوت/المظهر) ---------- */
export const uiPrefsSchema = z.object({
  menuSounds: z.boolean().default(true),
  timerWarningSound: z.boolean().default(true),
  highContrast: z.boolean().default(false),
  keyboardHintMode: z.enum(['auto', 'always', 'never']).default('auto'),
})
export type UiPrefs = z.infer<typeof uiPrefsSchema>

export function loadUiPrefs(): UiPrefs {
  try {
    const raw = localStorage.getItem(UI_PREFS_KEY)
    const result = uiPrefsSchema.safeParse(raw ? JSON.parse(raw) : undefined)
    if (result.success) return result.data
  } catch {
    // JSON تالف
  }
  return uiPrefsSchema.parse({})
}

export function saveUiPrefs(v: UiPrefs): void {
  try {
    localStorage.setItem(UI_PREFS_KEY, JSON.stringify(uiPrefsSchema.parse(v)))
  } catch {
    // تجاهل
  }
}

/* ---------- التباين العالي: حقن CSS + تبديل صنف body ---------- */
export const HIGH_CONTRAST_STYLE_ID = 'space-typist-high-contrast'
const HIGH_CONTRAST_CSS = `
body.high-contrast .text-ink-100 { color: #FFFFFF !important; }
body.high-contrast .text-ink-400 { color: #C6D2F2 !important; }
body.high-contrast .text-ink-600 { color: #9DB0DE !important; }
body.high-contrast .bg-space-900\\/85 { background-color: #0A0F1E !important; }
body.high-contrast .backdrop-blur-md { backdrop-filter: none !important; }
body.high-contrast .border-space-700 { border-color: #2E3D6E !important; }
body.high-contrast .arcade-corners { border-width: 2px !important; }
body.high-contrast .scanlines\\:\\:after,
body.high-contrast::after { opacity: 0.03 !important; }
`

export function applyHighContrast(on: boolean): void {
  if (typeof document === 'undefined') return
  if (on && !document.getElementById(HIGH_CONTRAST_STYLE_ID)) {
    const style = document.createElement('style')
    style.id = HIGH_CONTRAST_STYLE_ID
    style.textContent = HIGH_CONTRAST_CSS
    document.head.appendChild(style)
  }
  document.body.classList.toggle('high-contrast', on)
}

/* ---------- الافتراضيات: تُبذر من قواعد اللعب العامة الحالية ---------- */
export function defaultCustomConfig(): CustomConfig {
  const rules = loadGameRules()
  const extra = loadExtraRules()
  const base = customConfigSchema.parse({})
  return {
    ...base,
    hearts: rules.hearts,
    letterTimer: {
      enabled: rules.letterTimer.enabled,
      seconds: Math.min(10, Math.max(1, rules.letterTimer.seconds)),
      resetOnError: extra.letterResetOnError,
    },
    levelTimer: {
      enabled: rules.levelTimer.enabled,
      scope: extra.levelTimerScope,
      seconds: Math.min(180, Math.max(20, rules.levelTimer.seconds)),
    },
    camera: {
      enabled: rules.camera.enabled,
      lookDownThreshold: Math.min(3, Math.max(0.5, rules.camera.lookDownThreshold)),
      damageHearts: rules.camera.damageHearts,
      showPiP: rules.camera.showPiP,
    },
    ships: { ...base.ships, autoDodge: extra.autoDodge },
  }
}

/* ---------- المسودة (حفظ تلقائي) ---------- */
export function loadDraft(): CustomConfig {
  try {
    const raw = localStorage.getItem(CUSTOM_DRAFT_KEY)
    if (raw) {
      const result = customConfigSchema.safeParse(JSON.parse(raw))
      if (result.success) return result.data
    }
  } catch {
    // JSON تالف
  }
  return defaultCustomConfig()
}

export function saveDraft(config: CustomConfig): void {
  try {
    localStorage.setItem(CUSTOM_DRAFT_KEY, JSON.stringify(config))
  } catch {
    // تجاهل
  }
}

/* ---------- الإسقاط على مخطط custom-presets الأساسي (توافق بقية الصفحات) ---------- */
export function projectRules(config: CustomConfig): GameRules {
  return {
    hearts: config.hearts,
    letterTimer: { enabled: config.letterTimer.enabled, seconds: config.letterTimer.seconds },
    levelTimer: { enabled: config.levelTimer.enabled, seconds: config.levelTimer.seconds },
    camera: {
      enabled: config.camera.enabled,
      lookDownThreshold: config.camera.lookDownThreshold,
      damageHearts: config.camera.damageHearts,
      gracePeriod: 5,
      showPiP: config.camera.showPiP,
    },
  }
}

/** إسقاط السرعات إلى مقياس 1..10 في مخطط difficulty: px/s = 2·v + 2 للنزول، و px/s = 200 + (v-1)·400/9 للطلقات */
export function projectDifficulty(config: CustomConfig): CustomPreset['difficulty'] {
  return {
    enemySpeed: Math.round((descentPx(config.ships.descentSpeed) - 2) / 2),
    bulletSpeed: Math.round((1 + ((config.ships.bulletSpeed - 200) * 9) / 400) * 100) / 100,
    assaultSize: config.ships.rows,
  }
}

function projectContent(config: CustomConfig): CustomPreset['content'] {
  return {
    source: config.typing.source === 'custom' ? 'custom-text' : 'sentences',
    customText: config.content.customText,
    includeDigits: false,
    includeSymbols: false,
  }
}

/* ---------- الإعدادات المحفوظة (موسّعة بالإعداد الكامل) ---------- */
export const savedPresetSchema = z.object({
  id: z.string(),
  name: z.string(),
  config: customConfigSchema,
  createdAt: z.string(),
})
export type SavedPreset = z.infer<typeof savedPresetSchema>

export function loadSavedPresets(): SavedPreset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.customPresets)
    const parsed: unknown = raw ? JSON.parse(raw) : undefined
    const list =
      parsed && typeof parsed === 'object' && Array.isArray((parsed as { presets?: unknown[] }).presets)
        ? ((parsed as { presets: unknown[] }).presets as unknown[])
        : []
    return list
      .map((p) => savedPresetSchema.safeParse(p))
      .filter((r) => r.success)
      .map((r) => r.data)
  } catch {
    return []
  }
}

function persistPresets(presets: SavedPreset[]): void {
  try {
    const projected = presets.map((p) => ({
      id: p.id,
      name: p.name,
      rules: projectRules(p.config),
      content: projectContent(p.config),
      difficulty: projectDifficulty(p.config),
      createdAt: p.createdAt,
      // الحقل الموسّع — يتجاهله المخطط الأساسي عند القراءة من الصفحات الأخرى
      config: p.config,
    }))
    localStorage.setItem(STORAGE_KEYS.customPresets, JSON.stringify({ presets: projected }))
  } catch {
    // تجاهل
  }
}

/** يحفظ إعداداً جديداً؛ عند تجاوز 12 يُحذف الأقدم (أرشفة) */
export function addPreset(name: string, config: CustomConfig): { presets: SavedPreset[]; archived: boolean } {
  const presets = loadSavedPresets()
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `preset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  let next = [...presets, { id, name, config, createdAt: new Date().toISOString() }]
  const archived = next.length > MAX_USER_PRESETS
  if (archived) next = next.slice(next.length - MAX_USER_PRESETS)
  persistPresets(next)
  return { presets: next, archived }
}

export function renamePreset(id: string, name: string): SavedPreset[] {
  const next = loadSavedPresets().map((p) => (p.id === id ? { ...p, name } : p))
  persistPresets(next)
  return next
}

export function deletePreset(id: string): SavedPreset[] {
  const next = loadSavedPresets().filter((p) => p.id !== id)
  persistPresets(next)
  return next
}

/* ---------- الإعدادات المدمجة الثلاثة ---------- */
function builtin(name: string, patch: (c: CustomConfig) => CustomConfig): SavedPreset {
  const base = customConfigSchema.parse({})
  return { id: `builtin-${name}`, name, config: patch(base), createdAt: '2025-01-01T00:00:00.000Z' }
}

export const BUILT_IN_PRESETS: SavedPreset[] = [
  builtin('تدريب سريع', (c) => ({
    ...c,
    hearts: 3,
    letterTimer: { ...c.letterTimer, seconds: 3 },
    levelTimer: { ...c.levelTimer, seconds: 45, scope: 'line' },
  })),
  builtin('ماراثون', (c) => ({
    ...c,
    hearts: 5,
    letterTimer: { ...c.letterTimer, enabled: false },
    levelTimer: { ...c.levelTimer, enabled: true, scope: 'level', seconds: 120 },
    content: { ...c.content, length: 'long' },
  })),
  builtin('وضع الخبراء', (c) => ({
    ...c,
    hearts: 2,
    letterTimer: { ...c.letterTimer, seconds: 2 },
    ships: { ...c.ships, descentSpeed: 'insane', autoDodge: false },
  })),
]

/* ---------- حالات الكاميرا (نصوص مشتركة بين الصفحتين) ---------- */
export const CAMERA_STATUS_LABELS: Record<string, string> = {
  off: 'غير مفعّلة',
  starting: 'جارٍ تشغيل الكاميرا...',
  ok: 'تعمل — تنظر إلى الشاشة ✓',
  'looking-down': 'انظر إلى الشاشة!',
  uncertain: 'تعذّر تحديد اتجاه النظر ⚠',
  denied: 'تم رفض الإذن — فعّل الكاميرا من إعدادات المتصفح',
  error: 'الكاميرا غير متاحة',
}

/* ---------- أدوات مساعدة ---------- */
export const LEVEL_TIMER_SCOPES = [
  { value: 'line' as const, label: 'لكل سطر' },
  { value: 'level' as const, label: 'لكامل المرحلة' },
]

export const CONTENT_LENGTHS = [
  { value: 'short' as const, label: 'قصير' },
  { value: 'medium' as const, label: 'متوسط' },
  { value: 'long' as const, label: 'طويل' },
]

export const CONTENT_CATEGORIES = [
  { value: 'proverbs' as const, label: 'أمثال' },
  { value: 'literature' as const, label: 'أدب' },
  { value: 'science' as const, label: 'علوم' },
  { value: 'daily' as const, label: 'يوميات' },
  { value: 'random' as const, label: 'عشوائي' },
]

/** أسطر النص المخصص الصالحة للعب (غير فارغة) */
export function customLines(text: string): string[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
}

/** تحقق بدء اللعب: سطر واحد على الأقل من 3 أحرف فأكثر */
export function isCustomTextPlayable(text: string): boolean {
  return customLines(text).some((l) => l.length >= 3)
}

/** نسبة الأحرف اللاتينية من الحروف — تحذير إن غلبت على النص */
export function isLatinHeavy(text: string): boolean {
  const arabic = (text.match(/[ء-غف-ي٠-٩]/g) ?? []).length
  const latin = (text.match(/[A-Za-z]/g) ?? []).length
  return latin > 0 && latin > arabic
}

/** ملخص قصير لقواعد إعداد محفوظ (تلميح الشارة) */
export function presetSummary(config: CustomConfig): string {
  const parts = [
    `${config.hearts} قلوب`,
    config.letterTimer.enabled ? `حرف ${config.letterTimer.seconds}ث` : 'بدون عداد حرف',
    config.levelTimer.enabled
      ? `${config.levelTimer.scope === 'line' ? 'سطر' : 'مرحلة'} ${config.levelTimer.seconds}ث`
      : 'بدون مؤقت مرحلة',
    config.camera.enabled ? 'كاميرا مفعّلة' : 'بدون كاميرا',
    `سرعة ${DESCENT_SPEEDS.find((s) => s.value === config.ships.descentSpeed)?.label ?? ''}`,
  ]
  return parts.join(' · ')
}
