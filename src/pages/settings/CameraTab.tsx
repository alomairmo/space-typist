import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Camera, RefreshCw } from 'lucide-react'
import { Panel } from '@/components/ArcadeCard'
import NeonButton from '@/components/NeonButton'
import SliderRow from '@/components/SliderRow'
import ToggleSwitch from '@/components/ToggleSwitch'
import { useCamera } from '@/context/CameraContext'
import { useSettings } from '@/context/SettingsContext'
import { cn } from '@/lib/utils'
import { CAMERA_STATUS_LABELS } from '@/pages/custom/config'
import { Row, Rows } from '@/pages/settings/common'

const dotClass: Record<string, string> = {
  ok: 'bg-good-glow shadow-[0_0_8px_rgba(74,222,128,.8)]',
  'looking-down': 'bg-bad-glow shadow-[0_0_8px_rgba(248,113,113,.8)] animate-pulse',
  uncertain: 'bg-neon-amber shadow-[0_0_8px_rgba(251,191,36,.8)]',
  starting: 'bg-neon-amber animate-pulse',
  off: 'bg-ink-600',
  denied: 'bg-bad-glow',
  error: 'bg-ink-600',
}

/** تبويب الكاميرا — بطاقة الحالة، اختبار مباشر، الإذن، العتبة، الضرر، المعاينة، الخصوصية */
export default function CameraTab() {
  const { rules, updateRules } = useSettings()
  const { status, stream, start, stop } = useCamera()
  const [testing, setTesting] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const manualRef = useRef(false)

  useEffect(() => {
    const v = videoRef.current
    if (v && stream) {
      v.srcObject = stream
      void v.play().catch(() => undefined)
    }
  }, [stream, testing])

  // إيقاف الاختبار اليدوي عند مغادرة التبويب (إن لم تكن الكاميرا مفعّلة عامة)
  useEffect(() => {
    return () => {
      if (manualRef.current && !rules.camera.enabled) stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const startTest = () => {
    setTesting(true)
    if (!stream) {
      manualRef.current = true
      void start()
    }
  }
  const stopTest = () => {
    setTesting(false)
    if (manualRef.current && !rules.camera.enabled) stop()
    manualRef.current = false
  }
  /** إعادة المعايرة: إعادة تشغيل تصفّر خط أساس الإضاءة */
  const recalibrate = () => {
    stop()
    void start()
  }

  return (
    <Rows>
      <Row>
        <Panel glow={status === 'ok' ? 'cyan' : status === 'denied' ? 'magenta' : 'cyan-dim'} className="my-3 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-xl border border-neon-cyan/30 bg-space-900 text-neon-cyan">
              <Camera size={24} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', dotClass[status])} />
                <span className="font-bold text-ink-100" role="status">
                  {CAMERA_STATUS_LABELS[status]}
                </span>
              </div>
              <p className="mt-0.5 text-[13px] text-ink-400">كشف النظر للوحة المفاتيح يعمل محلياً بالكامل.</p>
            </div>
            {!testing ? (
              <NeonButton variant="ghost" size="md" onClick={startTest}>
                اختبار الكاميرا
              </NeonButton>
            ) : (
              <NeonButton variant="ghost" size="md" onClick={stopTest}>
                إيقاف الاختبار
              </NeonButton>
            )}
          </div>
          <AnimatePresence>
            {testing && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-space-700/60 pt-4">
                  {stream ? (
                    <video
                      ref={videoRef}
                      muted
                      playsInline
                      className="h-36 w-48 rounded-xl border border-space-700 bg-space-950 object-cover -scale-x-100"
                    />
                  ) : (
                    <div className="grid h-36 w-48 place-items-center rounded-xl border border-dashed border-space-700 text-[13px] text-ink-600">
                      {status === 'denied' ? 'الإذن مرفوض' : 'بانتظار البث...'}
                    </div>
                  )}
                  <div className="flex flex-col gap-2">
                    <span className="text-sm font-bold text-ink-100">قراءة الكشف: {CAMERA_STATUS_LABELS[status]}</span>
                    <NeonButton variant="ghost" size="md" onClick={recalibrate} disabled={!stream}>
                      <RefreshCw size={15} />
                      إعادة المعايرة
                    </NeonButton>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </Panel>
      </Row>
      <Row>
        <ToggleSwitch
          label="تفعيل وضع الكاميرا"
          helper="سيطلب المتصفح إذن الكاميرا عند التفعيل"
          checked={rules.camera.enabled}
          onCheckedChange={(v) => updateRules({ camera: { ...rules.camera, enabled: v } })}
        />
        {status === 'denied' && (
          <p className="pb-3 text-[13px] font-bold text-bad-glow" role="alert">
            تم رفض إذن الكاميرا — فعّل الكاميرا من إعدادات المتصفح ثم أعد المحاولة.
          </p>
        )}
      </Row>
      <Row>
        <SliderRow
          label="مدة السماح بالنظر للأسفل"
          helper="المدة قبل إطلاق التحذير ثم الضرر"
          value={rules.camera.lookDownThreshold}
          onValueChange={(v) => updateRules({ camera: { ...rules.camera, lookDownThreshold: v } })}
          min={0.5}
          max={3}
          step={0.1}
          unit="ث"
          disabled={!rules.camera.enabled}
        />
      </Row>
      <Row>
        <SliderRow
          label="الضرر عند النظر للوحة المفاتيح"
          helper="0 = تحذير فقط"
          value={rules.camera.damageHearts}
          onValueChange={(v) => updateRules({ camera: { ...rules.camera, damageHearts: v } })}
          min={0}
          max={3}
          unit="قلب"
          disabled={!rules.camera.enabled}
        />
      </Row>
      <Row>
        <ToggleSwitch
          label="إظهار نافذة المعاينة أثناء اللعب"
          helper="معاينة مصغرة في زاوية الشاشة مع نقطة الحالة"
          checked={rules.camera.showPiP}
          onCheckedChange={(v) => updateRules({ camera: { ...rules.camera, showPiP: v } })}
          disabled={!rules.camera.enabled}
        />
      </Row>
      <Row>
        <Panel glow="cyan-dim" className="my-3 border-neon-cyan/30 p-4">
          <p className="text-sm leading-relaxed text-neon-cyan">
            تُعالج لقطات الكاميرا محلياً على جهازك فقط. لا يُسجَّل أي فيديو ولا يغادر أي شيء جهازك.
          </p>
        </Panel>
      </Row>
    </Rows>
  )
}
