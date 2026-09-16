import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type GlowColor = 'cyan' | 'magenta' | 'amber' | 'cyan-dim' | 'gold' | 'none'

const borderClasses: Record<GlowColor, string> = {
  cyan: 'border-neon-cyan/40 hover:border-neon-cyan',
  magenta: 'border-neon-magenta/40 hover:border-neon-magenta',
  amber: 'border-neon-amber/40 hover:border-neon-amber',
  'cyan-dim': 'border-neon-cyan/20 hover:border-neon-cyan/60',
  gold: 'border-neon-amber/50 hover:border-neon-amber',
  none: 'border-space-700',
}

const glowShadows: Record<GlowColor, string> = {
  cyan: 'hover:shadow-[0_0_32px_rgba(34,211,238,.4)]',
  magenta: 'hover:shadow-[0_0_32px_rgba(232,121,249,.4)]',
  amber: 'hover:shadow-[0_0_32px_rgba(251,191,36,.4)]',
  'cyan-dim': 'hover:shadow-[0_0_24px_rgba(34,211,238,.25)]',
  gold: 'hover:shadow-[0_0_32px_rgba(245,158,11,.45)]',
  none: '',
}

/** لوحة أركيد — خلفية space-800، إطار نيون، زوايا مقصوصة بأسلوب كابينة الأركيد */
export function Panel({
  children,
  className,
  glow = 'none',
}: {
  children: ReactNode
  className?: string
  glow?: GlowColor
}) {
  return (
    <div className={cn('arcade-corners border bg-space-800 panel-glow', borderClasses[glow], className)}>
      {children}
    </div>
  )
}

export interface ArcadeCardProps {
  children: ReactNode
  glow?: GlowColor
  className?: string
  onClick?: () => void
}

/** بطاقة أركيد تفاعلية — ترتفع عند التحويم ويشتد توهجها */
export default function ArcadeCard({ children, glow = 'cyan', className, onClick }: ArcadeCardProps) {
  return (
    <motion.div
      whileHover={{ y: -6 }}
      whileTap={{ scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 380, damping: 26 }}
      onClick={onClick}
      className={cn(
        'arcade-corners cursor-pointer border bg-space-800 transition-[box-shadow,border-color] duration-200',
        borderClasses[glow],
        glowShadows[glow],
        className,
      )}
    >
      {children}
    </motion.div>
  )
}
