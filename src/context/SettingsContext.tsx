import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { GameRules, Settings } from '@/lib/storage'
import { STORAGE_KEYS, loadGameRules, loadSettings, saveGameRules, saveSettings } from '@/lib/storage'
import { audio } from '@/lib/audio'

interface SettingsContextValue {
  settings: Settings
  updateSettings: (patch: Partial<Settings>) => void
  rules: GameRules
  updateRules: (patch: Partial<GameRules>) => void
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => {
    const s = loadSettings()
    // افتراضياً نحترم prefers-reduced-motion عند أول زيارة
    if (
      typeof window !== 'undefined' &&
      localStorage.getItem(STORAGE_KEYS.settings) == null &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ) {
      s.reducedMotion = true
    }
    return s
  })
  const [rules, setRules] = useState<GameRules>(() => loadGameRules())

  // حفظ فوري + تطبيق الآثار الجانبية
  useEffect(() => {
    saveSettings(settings)
    // حجم الخط الجذري (±25%)
    document.documentElement.style.fontSize = `${(16 * settings.fontSize) / 100}px`
    // طبقة خطوط المسح (مظهر شاشة الأركيد)
    document.body.classList.toggle('scanlines', settings.scanlines)
    // الصوت
    audio.setVolumes({ ...settings.audio })
  }, [settings])

  useEffect(() => {
    saveGameRules(rules)
  }, [rules])

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch }
      if (patch.audio) next.audio = { ...prev.audio, ...patch.audio }
      return next
    })
  }, [])

  const updateRules = useCallback((patch: Partial<GameRules>) => {
    setRules((prev) => ({
      ...prev,
      ...patch,
      letterTimer: patch.letterTimer ? { ...prev.letterTimer, ...patch.letterTimer } : prev.letterTimer,
      levelTimer: patch.levelTimer ? { ...prev.levelTimer, ...patch.levelTimer } : prev.levelTimer,
      camera: patch.camera ? { ...prev.camera, ...patch.camera } : prev.camera,
    }))
  }, [])

  const value = useMemo(
    () => ({ settings, updateSettings, rules, updateRules }),
    [settings, updateSettings, rules, updateRules],
  )

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider')
  return ctx
}
