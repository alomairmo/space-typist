import { Canvas, useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useSettings } from '@/context/SettingsContext'

const COUNT = 1200

function DriftingStars() {
  const { settings } = useSettings()
  const pointsRef = useRef<THREE.Points>(null)
  const mouseRef = useRef({ x: 0, y: 0 })
  const speedsRef = useRef<Float32Array | null>(null)
  const positions = useMemo(() => new Float32Array(COUNT * 3), [])

  useFrame((state, dt) => {
    const points = pointsRef.current
    if (!points) return
    const pos = points.geometry.attributes.position as THREE.BufferAttribute
    // تهيئة كسولة داخل أول إطار (تجنّب العشوائية أثناء الرسم)
    if (speedsRef.current == null) {
      const speeds = new Float32Array(COUNT)
      for (let i = 0; i < COUNT; i++) {
        pos.setXYZ(i, (Math.random() - 0.5) * 60, (Math.random() - 0.5) * 36, (Math.random() - 0.5) * 40)
        speeds[i] = 0.5 + Math.random()
      }
      pos.needsUpdate = true
      speedsRef.current = speeds
    }
    const speeds = speedsRef.current
    const reduced = settings.reducedMotion
    if (!reduced) {
      // انجراف بطيء نحو المشاهد (سرعة 0.15)
      for (let i = 0; i < COUNT; i++) {
        let z = pos.getZ(i) + 0.15 * speeds[i] * dt * 10
        if (z > 20) z = -20
        pos.setZ(i, z)
      }
      pos.needsUpdate = true
      // ميل تفاعلي مع الفأرة ±2° (تقارب ناعم)
      const targetX = (state.pointer.y * Math.PI * 2) / 180
      const targetY = (state.pointer.x * Math.PI * 2) / 180
      mouseRef.current.x += (targetX - mouseRef.current.x) * 0.05
      mouseRef.current.y += (targetY - mouseRef.current.y) * 0.05
      points.rotation.x = mouseRef.current.x
      points.rotation.y = mouseRef.current.y
    }
  })

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#E8ECF8" size={0.09} sizeAttenuation transparent opacity={0.85} />
    </points>
  )
}

/** حقل نجوم ثلاثي الأبعاد للقائمة الرئيسية — منعزل، يُحمَّل كسولاً */
export default function MenuStars() {
  return (
    <Canvas
      camera={{ position: [0, 0, 12], fov: 60 }}
      dpr={[1, 1.5]}
      gl={{ antialias: false, alpha: true, powerPreference: 'low-power' }}
      style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 2, pointerEvents: 'none' }}
    >
      <DriftingStars />
    </Canvas>
  )
}
