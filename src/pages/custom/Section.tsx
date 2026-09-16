import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, Undo2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface SectionProps {
  id: string
  title: string
  icon: LucideIcon
  open: boolean
  onToggle: () => void
  onReset: () => void
  children: ReactNode
  className?: string
}

/** قسم أكورديون في محرر الطور المخصص — رأس زر (aria-expanded)، شيفرون يدور 180°، تمدد 280ms، زر «إعادة الافتراضي» */
export default function Section({ title, icon: Icon, open, onToggle, onReset, children, className }: SectionProps) {
  return (
    <section
      className={cn(
        'arcade-corners border border-space-700 bg-space-800/80 transition-colors',
        open && 'border-neon-cyan/30',
        className,
      )}
    >
      <div className="flex items-center gap-1 pe-2">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex flex-1 items-center gap-3 px-4 py-3.5 text-start"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-neon-cyan/30 bg-space-900 text-neon-cyan">
            <Icon size={18} />
          </span>
          <span className="flex-1 font-display text-lg font-bold text-ink-100">{title}</span>
          <motion.span
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ duration: 0.28 }}
            className="text-ink-400"
          >
            <ChevronDown size={18} />
          </motion.span>
        </button>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-transparent px-2.5 py-1.5 text-xs font-bold text-ink-600 transition-colors hover:border-space-700 hover:text-ink-100"
        >
          <Undo2 size={13} />
          إعادة الافتراضي
        </button>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{
              height: { duration: 0.28, ease: [0.16, 1, 0.3, 1] },
              opacity: { duration: 0.18, delay: open ? 0.1 : 0 },
            }}
            className="overflow-hidden"
          >
            <div className="divide-y divide-space-700/60 border-t border-space-700/60 px-5 pb-2">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
