import { useEffect, useRef } from 'react'
import { useCamera } from '@/context/CameraContext'
import type { CameraStatus } from '@/context/CameraContext'
import { useSettings } from '@/context/SettingsContext'
import { cn } from '@/lib/utils'

const statusLabels: Record<CameraStatus, string> = {
  ok: 'تنظر إلى الشاشة — الكاميرا تعمل بشكل صحيح',
  'looking-down': 'انظر إلى الشاشة!',
  uncertain: 'تعذّر تحديد اتجاه نظرك',
  starting: 'جارٍ تشغيل الكاميرا...',
  off: 'الكاميرا متوقفة',
  denied: 'رُفض إذن الكاميرا',
  error: 'الكاميرا غير متاحة',
}

/** إطار الحالة حول مربع الكاميرا: أخضر = تنظر للشاشة، أحمر = تنظر بعيداً/لأسفل، أصفر = تعذّر التحديد */
const frameStyles: Record<CameraStatus, string> = {
  ok: 'border-good-glow shadow-[0_0_18px_rgba(74,222,128,.55)]',
  'looking-down': 'border-bad-glow shadow-[0_0_18px_rgba(248,113,113,.7)] animate-pulse',
  uncertain: 'border-neon-amber shadow-[0_0_18px_rgba(251,191,36,.55)]',
  starting: 'border-neon-amber/60',
  off: 'border-space-700',
  denied: 'border-space-700',
  error: 'border-space-700',
}

const dotStyles: Record<CameraStatus, string> = {
  ok: 'bg-good-glow shadow-[0_0_8px_rgba(74,222,128,.8)]',
  'looking-down': 'bg-bad-glow shadow-[0_0_8px_rgba(248,113,113,.8)] animate-pulse',
  uncertain: 'bg-neon-amber shadow-[0_0_8px_rgba(251,191,36,.8)]',
  starting: 'bg-neon-amber animate-pulse',
  off: 'bg-ink-600',
  denied: 'bg-ink-600',
  error: 'bg-ink-600',
}

export interface PiPCameraProps {
  className?: string
}

/** معاينة كاميرا مصغّرة (صورة داخل صورة) بإطار حالة ملوّن — تظهر في كل الشاشات عند تفعيل وضع الكاميرا */
export default function PiPCamera({ className }: PiPCameraProps) {
  const { status, stream, videoRef } = useCamera()
  const { rules } = useSettings()
  const localVideoRef = useRef<HTMLVideoElement | null>(null)

  // نوصّل البث بعنصر فيديو محلي للمعاينة (عنصر السياق يبقى للتحليل)
  useEffect(() => {
    const v = localVideoRef.current
    if (v && stream) {
      v.srcObject = stream
      void v.play().catch(() => undefined)
    } else if (v) {
      v.srcObject = null
    }
  }, [stream])

  if (!rules.camera.enabled || !rules.camera.showPiP) return null

  return (
    <div
      className={cn('fixed bottom-4 left-4 z-[70] select-none', className)}
      role="status"
      aria-label={statusLabels[status]}
    >
      {status === 'looking-down' && (
        <div className="mb-2 rounded-full border border-bad-glow/60 bg-bad-600/80 px-3 py-1 text-center text-xs font-bold text-white shadow-[0_0_16px_rgba(248,113,113,.6)]">
          انظر إلى الشاشة!
        </div>
      )}
      {status === 'uncertain' && (
        <div className="mb-2 flex items-center justify-center gap-1 rounded-full border border-neon-amber/60 bg-neon-amber/20 px-3 py-1 text-center text-xs font-bold text-neon-amber shadow-[0_0_16px_rgba(251,191,36,.4)]">
          <span aria-hidden>⚠</span> تعذّر تحديد اتجاه نظرك
        </div>
      )}
      <div
        className={cn(
          'relative h-24 w-32 overflow-hidden rounded-xl border-2 bg-space-900 transition-colors duration-300',
          frameStyles[status],
        )}
      >
        {/* عنصر تحليل السياق (مخفي) */}
        <video ref={videoRef} className="hidden" muted playsInline />
        <video
          ref={localVideoRef}
          muted
          playsInline
          className="h-full w-full -scale-x-100 object-cover"
        />
        <span
          className={cn(
            'absolute right-2 top-2 h-3 w-3 rounded-full border border-space-950',
            dotStyles[status],
          )}
        />
        {status === 'uncertain' && (
          <span className="absolute left-2 top-1 text-lg font-black text-neon-amber drop-shadow-[0_0_6px_rgba(251,191,36,.9)]">
            !
          </span>
        )}
      </div>
      {/* سطر حالة نصي صغير يؤكد أن التحليل يعمل */}
      <div className="mt-1 text-center text-[10px] font-medium text-ink-400">
        {statusLabels[status]}
      </div>
    </div>
  )
}
