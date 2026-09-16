/**
 * أدوات تطبيع النص العربي للمطابقة بين المفتاح المضغوط والحرف المطلوب.
 * - التطويل (ـ) يُتجاهل دائماً.
 * - «تجاهل التشكيل» يزيل الحركات.
 * - «تساهل الهمزات»: أ/إ/آ→ا، ؤ→و، ئ→ي.
 */

export const TATWEEL = 'ـ'
const DIACRITICS = /[ً-ْٰ]/g

const HAMZA_MAP: Record<string, string> = {
  أ: 'ا',
  إ: 'ا',
  آ: 'ا',
  ٱ: 'ا',
  ؤ: 'و',
  ئ: 'ي',
}

export interface NormalizeOpts {
  ignoreDiacritics: boolean
  hamzaLeniency: boolean
}

/** تجهيز سطر الهدف: إزالة التطويل (+ التشكيل اختيارياً) وإرجاع مصفوفة الأحرف */
export function prepareLine(line: string, opts: NormalizeOpts): string[] {
  let s = line.replaceAll(TATWEEL, '')
  if (opts.ignoreDiacritics) s = s.replace(DIACRITICS, '')
  // إزالة الحركات اليتيمة التي تلي حرفاً أزيل معه التطويل فقط لا شيء — التشكيل يبقى مطلوباً
  return Array.from(s).filter((ch) => ch.trim().length > 0 || ch === ' ')
}

/** تطبيع حرف واحد (مفتاح أو هدف) للمقارنة */
export function normalizeChar(ch: string, opts: NormalizeOpts): string {
  if (ch === 'Spacebar') ch = ' '
  if (ch === TATWEEL) return ''
  if (opts.ignoreDiacritics) ch = ch.replace(DIACRITICS, '')
  if (opts.hamzaLeniency) ch = HAMZA_MAP[ch] ?? ch
  return ch
}

/** هل المفتاح المضغوط قابل للطباعة كحرف واحد؟ */
export function isPrintableKey(key: string): boolean {
  if (key === ' ' || key === 'Spacebar') return true
  return Array.from(key).length === 1
}
