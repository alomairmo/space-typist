const AR_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩']

/** تنسيق الأرقام حسب نظام الترقيم المختار (غربي 0-9 افتراضياً، عربي ٠-٩ اختياري) */
export function formatNumber(n: number | string, numerals: 'western' | 'arabic' = 'western'): string {
  const s = String(n)
  if (numerals === 'arabic') return s.replace(/[0-9]/g, (d) => AR_DIGITS[Number(d)])
  return s
}
