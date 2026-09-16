import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Camera, Database, Gamepad2, Palette, Volume2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Toaster } from '@/components/ui/sonner'
import { useSettings } from '@/context/SettingsContext'
import { cn } from '@/lib/utils'
import {
  applyHighContrast,
  loadExtraRules,
  loadUiPrefs,
  saveExtraRules,
  saveUiPrefs,
} from '@/pages/custom/config'
import type { ExtraRules, UiPrefs } from '@/pages/custom/config'
import AppearanceTab from '@/pages/settings/AppearanceTab'
import AudioTab from '@/pages/settings/AudioTab'
import CameraTab from '@/pages/settings/CameraTab'
import DataTab from '@/pages/settings/DataTab'
import GameplayTab from '@/pages/settings/GameplayTab'

type TabId = 'audio' | 'appearance' | 'gameplay' | 'camera' | 'data'

const TABS: { id: TabId; label: string; icon: LucideIcon }[] = [
  { id: 'audio', label: 'الصوت', icon: Volume2 },
  { id: 'appearance', label: 'المظهر', icon: Palette },
  { id: 'gameplay', label: 'اللعب', icon: Gamepad2 },
  { id: 'camera', label: 'الكاميرا', icon: Camera },
  { id: 'data', label: 'البيانات', icon: Database },
]

export default function Settings() {
  const { settings, rules } = useSettings()
  const [tab, setTab] = useState<TabId>('audio')
  const [prefs, setPrefs] = useState<UiPrefs>(() => loadUiPrefs())
  const [extra, setExtra] = useState<ExtraRules>(() => loadExtraRules())
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const firstPaint = useRef(true)

  // حفظ فوري للتفضيلات الإضافية
  useEffect(() => saveUiPrefs(prefs), [prefs])
  useEffect(() => saveExtraRules(extra), [extra])

  // تطبيق التباين العالي فورياً (وعند دخول الصفحة)
  useEffect(() => {
    applyHighContrast(prefs.highContrast)
  }, [prefs.highContrast])

  // شارة «تم الحفظ ✓» مؤجلة 1.5s بعد آخر تغيير
  useEffect(() => {
    if (firstPaint.current) {
      firstPaint.current = false
      return
    }
    const id = window.setTimeout(() => {
      toast.success('تم الحفظ ✓', { id: 'settings-saved', duration: 1500 })
    }, 1500)
    return () => window.clearTimeout(id)
  }, [settings, rules, prefs, extra])

  const updatePrefs = (patch: Partial<UiPrefs>) => setPrefs((p) => ({ ...p, ...patch }))
  const updateExtra = (patch: Partial<ExtraRules>) => setExtra((e) => ({ ...e, ...patch }))

  /** تنقل لوحة المفاتيح بين التبويبات (roving) — RTL: السهم الأيسر = التالي */
  const onTabKeyDown = (e: React.KeyboardEvent, index: number) => {
    const last = TABS.length - 1
    let next: number | null = null
    if (e.key === 'ArrowLeft') next = index === last ? 0 : index + 1
    else if (e.key === 'ArrowRight') next = index === 0 ? last : index - 1
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = last
    if (next != null) {
      e.preventDefault()
      setTab(TABS[next].id)
      tabRefs.current[next]?.focus()
    }
  }

  return (
    <div className="mx-auto max-w-[760px] px-4 py-8">
      <Toaster dir="rtl" position="bottom-center" />
      {/* الترويسة */}
      <header className="mb-6 flex items-center gap-4">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 rounded-full border border-space-700 px-4 py-2 text-sm font-bold text-ink-400 transition-colors hover:border-neon-cyan/40 hover:text-ink-100"
        >
          <ArrowRight size={16} />
          رجوع
        </Link>
        <h1 className="font-display text-4xl font-black text-ink-100 text-glow-cyan">الإعدادات</h1>
      </header>

      {/* شريط التبويبات */}
      <div
        role="tablist"
        aria-label="أقسام الإعدادات"
        className="mb-6 flex gap-1 overflow-x-auto rounded-full border border-space-700 bg-space-900 p-1"
      >
        {TABS.map((t, i) => {
          const active = tab === t.id
          const Icon = t.icon
          return (
            <button
              key={t.id}
              ref={(el) => {
                tabRefs.current[i] = el
              }}
              role="tab"
              aria-selected={active}
              tabIndex={active ? 0 : -1}
              onClick={() => setTab(t.id)}
              onKeyDown={(e) => onTabKeyDown(e, i)}
              className={cn(
                'relative flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-bold transition-colors',
                active ? 'text-neon-cyan' : 'text-ink-400 hover:text-ink-100',
              )}
            >
              <Icon size={16} />
              {t.label}
              {active && (
                <motion.span
                  layoutId="settings-tab-underline"
                  transition={{ type: 'spring', stiffness: 380, damping: 26 }}
                  className="absolute inset-x-3 bottom-1 h-[3px] rounded-full bg-neon-cyan shadow-[0_0_10px_rgba(34,211,238,.7)]"
                />
              )}
            </button>
          )
        })}
      </div>

      {/* محتوى التبويب — انتقال تلاشٍ + انزلاق 16px واعٍ للاتجاه */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={tab}
          role="tabpanel"
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 16 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="arcade-corners border border-space-700 bg-space-800/80 px-5"
        >
          {tab === 'audio' && <AudioTab prefs={prefs} updatePrefs={updatePrefs} />}
          {tab === 'appearance' && <AppearanceTab prefs={prefs} updatePrefs={updatePrefs} />}
          {tab === 'gameplay' && <GameplayTab extra={extra} updateExtra={updateExtra} />}
          {tab === 'camera' && <CameraTab />}
          {tab === 'data' && <DataTab />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
