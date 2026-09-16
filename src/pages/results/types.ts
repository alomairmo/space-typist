/**
 * واجهة نتيجة الجولة — يمرّرها وكيل شاشة اللعب عبر
 *   navigate('/results?run=latest', { state: { run: RunResult } })
 *
 * ملاحظات الدمج:
 * - إن سجّلت شاشة اللعب نفسها إدخال لوحة الشرف مسبقاً، مرّر `entryId`
 *   حتى لا تكرره شاشة النتائج؛ وإلا سجّلته هي تلقائياً.
 * - `stars` اختياري — تُحسب من العتبات عند غيابها (إنهاء / دقة≥92٪ / دقة≥97٪ + سرعة الهدف).
 */

export type RunMode = 'arcade' | 'levels' | 'custom' | 'placement'

export type DefeatReason = 'hearts' | 'time'

/** إحصاء سطر واحد من الأسطر المكتوبة */
export interface RunLineStat {
  /** نص السطر كاملاً */
  text: string
  /** سرعة السطر كلمات/دقيقة (كلمة = 5 أحرف) */
  wpm: number
  /** دقة السطر 0..100 */
  acc: number
  /** عدد الأخطاء في السطر */
  errors: number
}

export interface RunResult {
  mode: RunMode
  /** رقم المرحلة (طور المراحل) */
  levelId?: number
  /** هل انتهت الجولة بالنصر؟ */
  victory: boolean
  /** سبب الهزيمة: نفاد القلوب / انتهاء الوقت */
  reason?: DefeatReason
  score: number
  /** السرعة كلمات/دقيقة (كلمة = 5 أحرف) */
  wpm: number
  /** الدقة 0..100 */
  accuracy: number
  correctChars: number
  wrongChars: number
  /** الوقت المستغرق بالثواني */
  timeTaken: number
  /** النجوم 0..3 (مراحل) — تحسب تلقائياً عند غيابها */
  stars?: number
  /** الموجة الأخيرة (أركيد) */
  wave?: number
  /** إحصاءات الأسطر المكتوبة للمخطط الشريطي */
  lines?: RunLineStat[]
  /** معرّف إدخال لوحة الشرف إن كان مسجلاً مسبقاً */
  entryId?: string
  /** المرحلة الموصى بها بعد اختبار تحديد المستوى */
  placementLevelId?: number
}

export const MODE_NAMES: Record<RunMode, string> = {
  arcade: 'طور الأركيد',
  levels: 'وضع المراحل',
  custom: 'الطور المخصص',
  placement: 'اختبار تحديد المستوى',
}

export const DEFEAT_REASONS: Record<DefeatReason, string> = {
  hearts: 'انتهت القلوب',
  time: 'انتهى الوقت — هجمت المركبات دفعة واحدة',
}
