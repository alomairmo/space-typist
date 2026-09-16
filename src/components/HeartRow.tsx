import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

export interface HeartRowProps {
  hearts: number
  maxHearts: number
  size?: number
  className?: string
}

/** صف القلوب — كاملة/فارغة مع حركة فقدان (تكبير ثم اختفاء) واستعادة (قفزة) */
export default function HeartRow({ hearts, maxHearts, size = 28, className }: HeartRowProps) {
  const [prevHearts, setPrevHearts] = useState(hearts)
  useEffect(() => {
    setPrevHearts(hearts)
  }, [hearts])
  const justLost = hearts < prevHearts

  return (
    <div className={cn('flex items-center gap-1.5', className)} role="status" aria-label={`القلوب: ${hearts} من ${maxHearts}`}>
      {Array.from({ length: maxHearts }, (_, i) => {
        const full = i < hearts
        return (
          <AnimatePresence key={i} mode="popLayout">
            <motion.img
              key={full ? 'full' : 'empty'}
              src={full ? '/heart-full.svg' : '/heart-empty.svg'}
              alt={full ? 'قلب كامل' : 'قلب فارغ'}
              width={size}
              height={size}
              initial={
                justLost && i === hearts
                  ? { scale: 1.4, opacity: 1 }
                  : { scale: 0.4, opacity: 0 }
              }
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.4, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 26 }}
              className={cn(!full && 'opacity-70')}
              draggable={false}
            />
          </AnimatePresence>
        )
      })}
    </div>
  )
}
