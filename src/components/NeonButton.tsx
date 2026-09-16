import { forwardRef } from 'react'
import { motion } from 'framer-motion'
import type { HTMLMotionProps } from 'framer-motion'
import { cn } from '@/lib/utils'
import { audio } from '@/lib/audio'

type Variant = 'primary' | 'danger' | 'ghost'
type Size = 'md' | 'lg' | 'xl'

export interface NeonButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  variant?: Variant
  size?: Size
  children: React.ReactNode
  /** تشغيل صوت نقرة القائمة عند الضغط */
  soundOnClick?: boolean
}

const variantClasses: Record<Variant, string> = {
  primary:
    'border-neon-cyan/60 text-neon-cyan bg-neon-cyan/5 hover:bg-neon-cyan hover:text-space-950 hover:shadow-[0_0_32px_rgba(34,211,238,.45)]',
  danger:
    'border-bad-glow/60 text-bad-glow bg-bad-600/10 hover:bg-bad-600 hover:text-white hover:shadow-[0_0_32px_rgba(248,113,113,.45)]',
  ghost:
    'border-space-700 text-ink-400 bg-transparent hover:border-neon-cyan/40 hover:text-ink-100',
}

const sizeClasses: Record<Size, string> = {
  md: 'h-11 px-5 text-base rounded-full',
  lg: 'h-12 px-7 text-lg rounded-full',
  xl: 'h-14 px-9 text-xl rounded-full font-display font-bold',
}

/** زر نيون — primary (سماوي) / danger (أحمر) / ghost، بضغط وتحويم زنبركي */
const NeonButton = forwardRef<HTMLButtonElement, NeonButtonProps>(function NeonButton(
  { variant = 'primary', size = 'md', soundOnClick = true, className, onClick, onMouseEnter, children, ...rest },
  ref,
) {
  return (
    <motion.button
      ref={ref}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 380, damping: 26 }}
      className={cn(
        'inline-flex select-none items-center justify-center gap-2 border font-sans font-bold transition-colors duration-150',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      onMouseEnter={(e) => {
        audio.play('menuHover')
        onMouseEnter?.(e)
      }}
      onClick={(e) => {
        if (soundOnClick) audio.play('menuClick')
        onClick?.(e)
      }}
      {...rest}
    >
      {children}
    </motion.button>
  )
})

export default NeonButton
