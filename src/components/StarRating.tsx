import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

export interface StarRatingProps {
  stars: number // 0..3
  max?: number
  size?: number
  /** تفعيل ظهور النجوم المتتابع (شاشة النتائج) */
  animated?: boolean
  className?: string
}

/** تقييم النجوم — 3 نجوم كهرمانية، تظهر تتابعياً في شاشة النتائج */
export default function StarRating({ stars, max = 3, size = 32, animated = false, className }: StarRatingProps) {
  return (
    <div className={cn('flex items-center gap-1', className)} role="img" aria-label={`${stars} من ${max} نجوم`}>
      {Array.from({ length: max }, (_, i) => {
        const filled = i < stars
        return (
          <motion.span
            key={i}
            initial={animated ? { scale: 0, rotate: -60, opacity: 0 } : false}
            animate={animated ? { scale: 1, rotate: 0, opacity: 1 } : undefined}
            transition={
              animated
                ? { delay: 0.4 + i * 0.25, type: 'spring', stiffness: 380, damping: 16 }
                : undefined
            }
            className="inline-block"
          >
            <img
              src="/star-rating.svg"
              alt={filled ? 'نجمة مكتسبة' : 'نجمة فارغة'}
              width={size}
              height={size}
              draggable={false}
              className={cn(!filled && 'opacity-25 grayscale')}
              style={filled ? { filter: 'drop-shadow(0 0 6px rgba(251,191,36,.7))' } : undefined}
            />
          </motion.span>
        )
      })}
    </div>
  )
}
