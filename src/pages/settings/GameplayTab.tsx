import { Panel } from '@/components/ArcadeCard'
import HeartRow from '@/components/HeartRow'
import SegmentedControl from '@/components/SegmentedControl'
import SliderRow from '@/components/SliderRow'
import ToggleSwitch from '@/components/ToggleSwitch'
import { useSettings } from '@/context/SettingsContext'
import { LEVEL_TIMER_SCOPES } from '@/pages/custom/config'
import type { ExtraRules } from '@/pages/custom/config'
import { Row, Rows } from '@/pages/settings/common'

export interface GameplayTabProps {
  extra: ExtraRules
  updateExtra: (patch: Partial<ExtraRules>) => void
}

/** تبويب اللعب — القيم الافتراضية لقواعد الأركيد ونقطة انطلاق الطور المخصص */
export default function GameplayTab({ extra, updateExtra }: GameplayTabProps) {
  const { rules, updateRules } = useSettings()

  return (
    <Rows>
      <Row>
        <SliderRow
          label="عدد القلوب"
          value={rules.hearts}
          onValueChange={(v) => updateRules({ hearts: v })}
          min={1}
          max={10}
          unit="قلب"
        />
        <div className="flex justify-center pb-3">
          <HeartRow hearts={rules.hearts} maxHearts={rules.hearts} size={28} />
        </div>
      </Row>
      <Row>
        <ToggleSwitch
          label="عداد الحرف"
          helper="مهلة زمنية لكل حرف قبل استدعاء هجوم العدو"
          checked={rules.letterTimer.enabled}
          onCheckedChange={(v) => updateRules({ letterTimer: { ...rules.letterTimer, enabled: v } })}
        />
        <SliderRow
          label="الوقت لكل حرف"
          value={rules.letterTimer.seconds}
          onValueChange={(v) => updateRules({ letterTimer: { ...rules.letterTimer, seconds: v } })}
          min={1}
          max={10}
          step={0.5}
          unit="ث"
          disabled={!rules.letterTimer.enabled}
        />
      </Row>
      <Row>
        <ToggleSwitch
          label="عداد الجملة/المرحلة"
          helper="مهلة إجمالية؛ عند انتهائها تهاجمك جميع المركبات دفعة واحدة"
          checked={rules.levelTimer.enabled}
          onCheckedChange={(v) => updateRules({ levelTimer: { ...rules.levelTimer, enabled: v } })}
        />
        <SliderRow
          label="الوقت"
          value={rules.levelTimer.seconds}
          onValueChange={(v) => updateRules({ levelTimer: { ...rules.levelTimer, seconds: v } })}
          min={20}
          max={180}
          step={5}
          unit="ث"
          disabled={!rules.levelTimer.enabled}
        />
        <SegmentedControl
          label="نطاق المؤقت"
          options={LEVEL_TIMER_SCOPES}
          value={extra.levelTimerScope}
          onValueChange={(v) => updateExtra({ levelTimerScope: v })}
        />
      </Row>
      <Row>
        <ToggleSwitch
          label="التفادي التلقائي لمركبة اللاعب"
          helper="عند الإيقاف تصيبك كل طلقات العدو — وضع التحدي"
          checked={extra.autoDodge}
          onCheckedChange={(v) => updateExtra({ autoDodge: v })}
        />
      </Row>
      <Row>
        <SegmentedControl
          label="صعوبة الأركيد"
          options={[
            { value: 'easy' as const, label: 'سهل' },
            { value: 'normal' as const, label: 'عادي' },
            { value: 'hard' as const, label: 'صعب' },
          ]}
          value={extra.arcadeDifficulty}
          onValueChange={(v) => updateExtra({ arcadeDifficulty: v })}
        />
        <p className="pb-3 text-[13px] text-ink-400">تحدد سرعة الموجة الأولى في طور الأركيد.</p>
      </Row>
      <Row>
        <ToggleSwitch
          label="اهتزاز الشاشة"
          helper="اهتزاز خفيف عند الانفجارات وفقدان القلوب"
          checked={extra.screenShake}
          onCheckedChange={(v) => updateExtra({ screenShake: v })}
        />
      </Row>
      <Row>
        <Panel glow="amber" className="my-3 p-4 text-sm font-bold leading-relaxed text-neon-amber">
          قواعد وضع المراحل تحددها المرحلة نفسها؛ هذه القيم للأركيد والطور المخصص.
        </Panel>
      </Row>
    </Rows>
  )
}
