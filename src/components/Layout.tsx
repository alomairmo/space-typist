import { Outlet, useLocation } from 'react-router'
import { useEffect } from 'react'
import { SettingsProvider, useSettings } from '@/context/SettingsContext'
import { CameraProvider } from '@/context/CameraContext'
import StarfieldCanvas from '@/components/StarfieldCanvas'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import PiPCamera from '@/components/PiPCamera'
import { audio } from '@/lib/audio'

/** الشاشات ذات العرض الكامل بلا شريط تنقل/تذييل */
const CHROMELESS: (string | RegExp)[] = ['/', /^\/game\//]

function Shell() {
  const { pathname } = useLocation()
  const { settings } = useSettings()
  const chromeless = CHROMELESS.some((p) => (typeof p === 'string' ? p === pathname : p.test(pathname)))

  // تفعيل السياق الصوتي عند أول تفاعل (سياسة التشغيل التلقائي)
  useEffect(() => {
    const unlock = () => audio.ensureContext()
    window.addEventListener('pointerdown', unlock, { once: true })
    window.addEventListener('keydown', unlock, { once: true })
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [])

  // احترام تقليل الحركة
  useEffect(() => {
    document.documentElement.classList.toggle('reduce-motion', settings.reducedMotion)
  }, [settings.reducedMotion])

  return (
    <div className="relative min-h-[100dvh]">
      <StarfieldCanvas />
      {/* تدرج السديم فوق النجوم */}
      <div className="bg-nebula pointer-events-none fixed inset-0 z-[1]" aria-hidden="true" />
      <div className="relative z-10 flex min-h-[100dvh] flex-col">
        {!chromeless && <Navbar />}
        <main className="flex-1">
          <Outlet />
        </main>
        {!chromeless && <Footer />}
      </div>
      <PiPCamera />
    </div>
  )
}

/**
 * AppShell — ملء نافذة العرض، RTL، خلفية نجوم، تدرج سديم،
 * طبقة scanlines (عبر body)، مدير الصوت العام، سياقا الإعدادات والكاميرا.
 * عقد التخطيط: مسارات متداخلة مع <Outlet/> فقط.
 */
export default function Layout() {
  return (
    <SettingsProvider>
      <CameraProvider>
        <Shell />
      </CameraProvider>
    </SettingsProvider>
  )
}
