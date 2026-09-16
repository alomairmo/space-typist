import { useState } from 'react'
import type { RunLineStat } from '@/pages/results/types'
import { formatNumber } from '@/lib/format'
import { useSettings } from '@/context/SettingsContext'
import { cn } from '@/lib/utils'

/**
 * مخطط الأداء لكل سطر — أشرطة أفقية:
 * الطول = سرعة السطر مقابل السرعة المستهدفة، اللون = الدقة
 * (أخضر ≥95٪، كهرماني ≥85٪، أحمر دون ذلك).
 * يتسع لـ6 أسطر ثم يتمرر. التلميح عند التحويم يعرض السطر كاملاً + القيم الدقيقة.
 * تنمو الأشرطة عبر GSAP من المكوّن الأب (فئة .line-bar-fill).
 */

const TRUNCATE = 24

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}…` : s
}

export interface PerLineChartProps {
  lines: RunLineStat[]
  /** السرعة المستهدفة (ك/د) لقياس طول الأشرطة */
  targetWpm: number
}

export default function PerLineChart({ lines, targetWpm }: PerLineChartProps) {
  const { settings } = useSettings()
  const [hovered, setHovered] = useState<number | null>(null)
  const fmt = (n: number) => formatNumber(Math.round(n), settings.numerals)

  if (lines.length === 0) return null

  const maxWpm = Math.max(targetWpm * 1.4, ...lines.map((l) => l.wpm), 1)

  return (
    <div className="relative">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-base font-bold text-ink-100">الأداء لكل سطر</h3>
        <span className="text-xs text-ink-600">
          الطول = السرعة مقابل الهدف ({fmt(targetWpm)} ك/د) · اللون = الدقة
        </span>
      </div>
      <div className="max-h-[264px] space-y-2 overflow-y-auto pe-2">
        {lines.map((line, i) => {
          const pct = Math.min(100, (line.wpm / maxWpm) * 100)
          const color =
            line.acc >= 95
              ? 'bg-good-glow shadow-[0_0_10px_rgba(74,222,128,.45)]'
              : line.acc >= 85
                ? 'bg-neon-amber shadow-[0_0_10px_rgba(251,191,36,.4)]'
                : 'bg-bad-glow shadow-[0_0_10px_rgba(248,113,113,.4)]'
          return (
            <div
              key={i}
              className="group relative"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(i)}
              onBlur={() => setHovered(null)}
              tabIndex={0}
            >
              <div className="mb-0.5 flex items-baseline justify-between gap-2">
                <span className="truncate font-typing text-xs text-ink-400" dir="rtl">
                  {truncate(line.text, TRUNCATE)}
                </span>
                <span className="shrink-0 font-hud text-[11px] text-ink-600">
                  {fmt(line.wpm)} ك/د · {fmt(line.acc)}٪
                </span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-space-900">
                <div
                  className={cn('line-bar-fill h-full rounded-full', color)}
                  style={{ width: `${pct}%` }}
                  data-pct={pct}
                />
              </div>
            </div>
          )
        })}
      </div>

      {/* تلميح التفاصيل */}
      {hovered != null && lines[hovered] && (
        <div
          className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-64 -translate-x-1/2 rounded-lg border border-neon-cyan/35 bg-space-900 p-3 text-xs shadow-[0_0_24px_rgba(34,211,238,.25)]"
          role="tooltip"
        >
          <p className="mb-2 font-typing text-ink-100" dir="rtl">
            {lines[hovered].text}
          </p>
          <div className="grid grid-cols-3 gap-1 text-center font-hud">
            <div>
              <div className="text-neon-cyan">{fmt(lines[hovered].wpm)}</div>
              <div className="font-sans text-ink-600">ك/د</div>
            </div>
            <div>
              <div className="text-good-glow">{fmt(lines[hovered].acc)}٪</div>
              <div className="font-sans text-ink-600">الدقة</div>
            </div>
            <div>
              <div className="text-bad-glow">{fmt(lines[hovered].errors)}</div>
              <div className="font-sans text-ink-600">أخطاء</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
