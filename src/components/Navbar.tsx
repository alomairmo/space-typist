import { NavLink } from 'react-router'
import { Volume2, VolumeX } from 'lucide-react'
import { useSettings } from '@/context/SettingsContext'
import { audio } from '@/lib/audio'
import { cn } from '@/lib/utils'

const LINKS = [
  { to: '/', label: 'القائمة' },
  { to: '/arcade', label: 'أركيد' },
  { to: '/levels', label: 'المراحل' },
  { to: '/placement', label: 'تحديد المستوى' },
  { to: '/custom', label: 'مخصص' },
  { to: '/results', label: 'النتائج' },
  { to: '/settings', label: 'الإعدادات' },
]

/** شريط التنقل العلوي — ثابت أعلى الشاشة في كل الشاشات عدا القائمة الرئيسية */
export default function Navbar() {
  const { settings, updateSettings } = useSettings()
  return (
    <nav className="sticky top-0 z-50 border-b border-space-700/80 bg-space-900/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
        <NavLink to="/" className="flex items-center gap-2">
          <img src="/logo.svg" alt="مدفع الفضاء" className="h-8 w-auto" draggable={false} />
          <span className="hidden font-display text-lg font-black text-ink-100 text-glow-cyan sm:inline">
            مدفع الفضاء
          </span>
        </NavLink>
        <div className="mx-auto flex items-center gap-1 overflow-x-auto">
          {LINKS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === '/'}
              className={({ isActive }) =>
                cn(
                  'whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-bold transition-colors',
                  isActive
                    ? 'bg-neon-cyan/15 text-neon-cyan shadow-[inset_0_0_0_1px_rgba(34,211,238,.35)]'
                    : 'text-ink-400 hover:text-ink-100',
                )
              }
            >
              {l.label}
            </NavLink>
          ))}
        </div>
        <button
          onClick={() => {
            audio.ensureContext()
            updateSettings({ audio: { ...settings.audio, muted: !settings.audio.muted } })
          }}
          className="rounded-full border border-space-700 p-2 text-ink-400 transition-colors hover:border-neon-cyan/50 hover:text-neon-cyan"
          aria-label={settings.audio.muted ? 'إلغاء كتم الصوت' : 'كتم الصوت'}
        >
          {settings.audio.muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
      </div>
    </nav>
  )
}
