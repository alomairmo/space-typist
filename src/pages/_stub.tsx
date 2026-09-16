import { Panel } from '@/components/ArcadeCard'

/** صفحة مؤقتة — يبنيها وكيل الصفحة لاحقاً */
export default function PageStub({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mx-auto flex max-w-4xl flex-col items-center gap-6 px-4 py-16">
      <h1 className="font-display text-4xl font-black text-ink-100 text-glow-cyan">{title}</h1>
      {subtitle && <p className="text-ink-400">{subtitle}</p>}
      <Panel glow="cyan" className="p-10 text-center text-ink-400">
        هذه الشاشة قيد البناء...
      </Panel>
    </div>
  )
}
