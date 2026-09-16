import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useSettings } from '@/context/SettingsContext'
import { audio } from '@/lib/audio'

export type CameraStatus = 'off' | 'starting' | 'ok' | 'looking-down' | 'uncertain' | 'denied' | 'error'

interface CameraContextValue {
  status: CameraStatus
  stream: MediaStream | null
  videoRef: React.RefObject<HTMLVideoElement | null>
  start: () => Promise<void>
  stop: () => void
  /** عدد مرات رصد النظر للأسفل (لإحصاءات الجولة) */
  lookDownCount: number
}

const CameraContext = createContext<CameraContextValue | null>(null)

/* ---------- خوارزمية الكشف (محلية بالكامل — لا يُسجَّل ولا يُرفَع أي فيديو) ----------
 * كشف لون البشرة + أكبر كتلة متصلة على إطارات مصغّرة 64×48:
 *  - قناع البشرة (قاعدة RGB كلاسيكية) ثم أكبر مكوّن متصل (BFS).
 *  - الوجه صالح إذا كانت الكتلة ضمن حجم معقول (2.5%–75% من الإطار) —
 *    جدار بلون قريب من البشرة يغطي الإطار كله فيُرفض، وغياب الوجه
 *    يعني كتلة شبه معدومة. بدون وجه صالح → «تعذّر التحديد» (أصفر).
 *  - معايرة تلقائية في أول فترة من رؤية الوجه (خط الأساس = النظر للشاشة).
 *  - النظر للأسفل: هبوط مركز الكتلة بوضوح تحت خط الأساس، أو انكماش
 *    مساحتها (الجبهة/العينان تخرجان من الإطار عند إمالة الرأس).
 *  - الحالة الافتراضية بعد التشغيل «تعذّر التحديد» حتى يثبت التحليل
 *    وجود وجه (أخضر) أو نظراً للأسفل (أحمر).
 * -------------------------------------------------------------------------- */

const FRAME_W = 64
const FRAME_H = 48
const CALIBRATION_MS = 2000
/** حدود حجم كتلة الوجه الصالحة (نسبة من بكسلات الإطار) */
const MIN_FACE_RATIO = 0.025
const MAX_FACE_RATIO = 0.75
/** هبوط المركز الرأسي عن خط الأساس لاعتباره نظراً للأسفل (نسبة من ارتفاع الإطار) */
const CENTROID_DROP = 0.10
/** انخفاض مساحة الوجه عن خط الأساس لاعتباره نظراً للأسفل */
const AREA_DROP = 0.40

/** قاعدة لون البشرة الكلاسيكية (RGB) */
function isSkin(r: number, g: number, b: number): boolean {
  return r > 60 && g > 40 && b > 20 && r > g && r > b && r - Math.min(g, b) > 15 && Math.abs(r - g) > 15
}

interface FaceStats {
  /** نسبة أكبر كتلة بشرة متصلة من الإطار */
  faceRatio: number
  /** مركزها الرأسي 0..1 من أعلى الإطار */
  centroidY: number
  /** هل تُعد وجهاً صالحاً؟ */
  valid: boolean
}

/** الحد الأدنى لتباين الإضاءة (انحراف معياري) داخل كتلة الوجه —
 * الوجه الحقيقي فيه عينان وحواجب وشعر أغمق؛ الجدار المتجانس يُرفض */
const MIN_LUM_STD = 6

/** قناع بشرة + أكبر مكوّن متصل (4-اتصال) عبر BFS على شبكة 64×48 + تباين داخلي */
function computeFaceStats(data: Uint8ClampedArray): FaceStats {
  const total = FRAME_W * FRAME_H
  const mask = new Uint8Array(total)
  for (let y = 0; y < FRAME_H; y++) {
    for (let x = 0; x < FRAME_W; x++) {
      const i = (y * FRAME_W + x) * 4
      if (isSkin(data[i], data[i + 1], data[i + 2])) mask[y * FRAME_W + x] = 1
    }
  }
  const visited = new Uint8Array(total)
  let bestSize = 0
  let bestSumY = 0
  let bestBox = { x0: 0, y0: 0, x1: 0, y1: 0 }
  const queue = new Int32Array(total)
  for (let s = 0; s < total; s++) {
    if (!mask[s] || visited[s]) continue
    let head = 0
    let tail = 0
    queue[tail++] = s
    visited[s] = 1
    let size = 0
    let sumY = 0
    let x0 = FRAME_W, x1 = 0, y0 = FRAME_H, y1 = 0
    while (head < tail) {
      const c = queue[head++]
      const cy = Math.floor(c / FRAME_W)
      const cx = c % FRAME_W
      size++
      sumY += cy
      if (cx < x0) x0 = cx
      if (cx > x1) x1 = cx
      if (cy < y0) y0 = cy
      if (cy > y1) y1 = cy
      // الجيران الأربعة
      if (cx > 0 && mask[c - 1] && !visited[c - 1]) { visited[c - 1] = 1; queue[tail++] = c - 1 }
      if (cx < FRAME_W - 1 && mask[c + 1] && !visited[c + 1]) { visited[c + 1] = 1; queue[tail++] = c + 1 }
      if (c >= FRAME_W && mask[c - FRAME_W] && !visited[c - FRAME_W]) { visited[c - FRAME_W] = 1; queue[tail++] = c - FRAME_W }
      if (c < total - FRAME_W && mask[c + FRAME_W] && !visited[c + FRAME_W]) { visited[c + FRAME_W] = 1; queue[tail++] = c + FRAME_W }
    }
    if (size > bestSize) {
      bestSize = size
      bestSumY = sumY
      bestBox = { x0, y0, x1, y1 }
    }
  }
  const faceRatio = bestSize / total

  // تباين الإضاءة داخل الصندوق المحيط بأكبر كتلة
  let lumStd = 0
  if (bestSize > 0) {
    let n = 0, sum = 0, sumSq = 0
    for (let y = bestBox.y0; y <= bestBox.y1; y++) {
      for (let x = bestBox.x0; x <= bestBox.x1; x++) {
        const i = (y * FRAME_W + x) * 4
        const lum = (data[i] + data[i + 1] + data[i + 2]) / 3
        n++
        sum += lum
        sumSq += lum * lum
      }
    }
    const mean = sum / n
    lumStd = Math.sqrt(Math.max(0, sumSq / n - mean * mean))
  }

  return {
    faceRatio,
    centroidY: bestSize > 0 ? bestSumY / bestSize / FRAME_H : 0.5,
    valid: faceRatio >= MIN_FACE_RATIO && faceRatio <= MAX_FACE_RATIO && lumStd >= MIN_LUM_STD,
  }
}

export function CameraProvider({ children }: { children: ReactNode }) {
  const { rules } = useSettings()
  const [status, setStatus] = useState<CameraStatus>('off')
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [lookDownCount, setLookDownCount] = useState(0)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const rafRef = useRef<number>(0)
  const analyzeRef = useRef<() => void>(() => undefined)
  const lookDownSinceRef = useRef<number | null>(null)
  const lastWarnRef = useRef(0)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  // المعايرة وخط الأساس
  const calibStartRef = useRef<number | null>(null)
  const baseCentroidRef = useRef<number | null>(null)
  const baseRatioRef = useRef<number | null>(null)
  const statusRef = useRef<CameraStatus>('off')
  const streamRef = useRef<MediaStream | null>(null)

  const setStatusTracked = useCallback((s: CameraStatus) => {
    statusRef.current = s
    setStatus(s)
  }, [])

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    streamRef.current = null
    setStream((prev) => {
      prev?.getTracks().forEach((t) => t.stop())
      return null
    })
    if (videoRef.current) videoRef.current.srcObject = null
    calibStartRef.current = null
    baseCentroidRef.current = null
    baseRatioRef.current = null
    lookDownSinceRef.current = null
    setStatusTracked('off')
  }, [setStatusTracked])

  const analyze = useCallback(() => {
    const video = videoRef.current
    // أعد توصيل البث إن أُعيد تركيب عنصر الفيديو (تبديل PiP مثلاً)
    if (video && streamRef.current && video.srcObject !== streamRef.current) {
      video.srcObject = streamRef.current
      void video.play().catch(() => undefined)
    }
    if (!video || video.readyState < 2 || video.videoWidth === 0) {
      rafRef.current = requestAnimationFrame(() => analyzeRef.current())
      return
    }
    if (!canvasRef.current) canvasRef.current = document.createElement('canvas')
    const canvas = canvasRef.current
    canvas.width = FRAME_W
    canvas.height = FRAME_H
    const cx = canvas.getContext('2d', { willReadFrequently: true })
    if (!cx) return
    cx.drawImage(video, 0, 0, FRAME_W, FRAME_H)
    const { faceRatio, centroidY, valid } = computeFaceStats(cx.getImageData(0, 0, FRAME_W, FRAME_H).data)
    const now = performance.now()
    const threshold = rules.camera.lookDownThreshold

    if (!valid) {
      // لا وجه صالح: غياب الوجه أو خلفية ملتبسة → «تعذّر التحديد» دائماً
      lookDownSinceRef.current = null
      if (statusRef.current !== 'uncertain') setStatusTracked('uncertain')
      rafRef.current = requestAnimationFrame(() => analyzeRef.current())
      return
    }

    // ----- المعايرة: أول فترة من رؤية الوجه تُعتبر «نظراً للشاشة» -----
    if (calibStartRef.current == null) calibStartRef.current = now
    if (baseCentroidRef.current == null || baseRatioRef.current == null) {
      if (now - calibStartRef.current < CALIBRATION_MS || baseCentroidRef.current == null) {
        baseCentroidRef.current =
          baseCentroidRef.current == null ? centroidY : baseCentroidRef.current * 0.7 + centroidY * 0.3
        baseRatioRef.current =
          baseRatioRef.current == null ? faceRatio : baseRatioRef.current * 0.7 + faceRatio * 0.3
        // أثناء المعايرة الوجه مرئي وباتجاه الشاشة (هو خط الأساس نفسه)
        if (statusRef.current !== 'ok') setStatusTracked('ok')
        rafRef.current = requestAnimationFrame(() => analyzeRef.current())
        return
      }
    }

    const baseY = baseCentroidRef.current
    const baseRatio = baseRatioRef.current ?? faceRatio
    if (baseY == null) {
      rafRef.current = requestAnimationFrame(() => analyzeRef.current())
      return
    }

    const centroidDrop = centroidY - baseY // موجب = نزول الرأس في الإطار
    const areaDrop = (baseRatio - faceRatio) / Math.max(0.0001, baseRatio)
    const lookingDown = centroidDrop > CENTROID_DROP || areaDrop > AREA_DROP

    if (lookingDown) {
      if (lookDownSinceRef.current == null) lookDownSinceRef.current = now
      const elapsed = (now - lookDownSinceRef.current) / 1000
      if (elapsed >= threshold && statusRef.current !== 'looking-down') {
        setStatusTracked('looking-down')
        setLookDownCount((c) => c + 1)
        if (now - lastWarnRef.current > 3000) {
          lastWarnRef.current = now
          audio.play('cameraWarning')
        }
      }
    } else {
      lookDownSinceRef.current = null
      if (statusRef.current !== 'ok') setStatusTracked('ok')
      // تكيّف بطيء جداً مع الوضعية المعتادة أثناء النظر السليم
      baseCentroidRef.current = baseY * 0.998 + centroidY * 0.002
      baseRatioRef.current = baseRatio * 0.998 + faceRatio * 0.002
    }

    rafRef.current = requestAnimationFrame(() => analyzeRef.current())
  }, [rules.camera.lookDownThreshold, setStatusTracked])

  useEffect(() => {
    analyzeRef.current = analyze
  }, [analyze])

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatusTracked('error')
      return
    }
    setStatusTracked('starting')
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: 'user' },
        audio: false,
      })
      setStream(s)
      streamRef.current = s
      // وصّل البث فوراً إن كان عنصر الفيديو موجوداً
      const v = videoRef.current
      if (v) {
        v.srcObject = s
        await v.play().catch(() => undefined)
      }
      calibStartRef.current = null
      baseCentroidRef.current = null
      baseRatioRef.current = null
      // الافتراضي «تعذّر التحديد» حتى يثبت التحليل حالة النظر فعلياً
      setStatusTracked('uncertain')
      cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(analyze)
    } catch (err) {
      setStatusTracked(err instanceof DOMException && err.name === 'NotAllowedError' ? 'denied' : 'error')
    }
  }, [analyze, setStatusTracked])

  /* إصلاح سباق التوصيل: إن وُصِل البث قبل تركيب عنصر الفيديو، نستطلع
   * حتى يُركَّب ثم نوصّله (وإعادة التوصيل اللاحقة تتم داخل حلقة التحليل) */
  useEffect(() => {
    if (!stream) return
    let cancelled = false
    const attach = () => {
      if (cancelled) return
      const v = videoRef.current
      if (v) {
        if (v.srcObject !== stream) {
          v.srcObject = stream
          void v.play().catch(() => undefined)
        }
        return // تم التوصيل
      }
      window.setTimeout(attach, 200)
    }
    attach()
    return () => {
      cancelled = true
    }
  }, [stream])

  // تشغيل/إيقاف تلقائي حسب إعداد الكاميرا (مؤجّل لتجنّب setState المتزامن)
  useEffect(() => {
    const id = window.setTimeout(() => {
      if (rules.camera.enabled) void start()
      else stop()
    }, 0)
    return () => {
      window.clearTimeout(id)
      cancelAnimationFrame(rafRef.current)
    }
  }, [rules.camera.enabled, start, stop])

  const value = useMemo(
    () => ({ status, stream, videoRef, start, stop, lookDownCount }),
    [status, stream, start, stop, lookDownCount],
  )

  return <CameraContext.Provider value={value}>{children}</CameraContext.Provider>
}

export function useCamera(): CameraContextValue {
  const ctx = useContext(CameraContext)
  if (!ctx) throw new Error('useCamera must be used within CameraProvider')
  return ctx
}
