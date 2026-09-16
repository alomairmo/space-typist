import { Panel } from '@/components/ArcadeCard'
import SegmentedControl from '@/components/SegmentedControl'
import SliderRow from '@/components/SliderRow'
import ToggleSwitch from '@/components/ToggleSwitch'
import TypingLine from '@/components/TypingLine'
import type { CharState } from '@/components/TypingLine'
import { useSettings } from '@/context/SettingsContext'
import { Row, Rows } from '@/pages/settings/common'
import type { UiPrefs } from '@/pages/custom/config'

export interface AppearanceTabProps {
  prefs: UiPrefs
  updatePrefs: (patch: Partial<UiPrefs>) => void
}

const PREVIEW_TEXT = 'الطباعة السريعة مهارة العصر'
const PREVIEW_STATES: CharState[] = Array.from(PREVIEW_TEXT, (_, i) =>
  i < 7 ? 'correct' : i === 7 ? 'current' : 'pending',
)

/** تبويب المظهر — حجم الخط بمعاينة حية، نظام الأرقام، scanlines، تقليل الحركة، السمة، رموز الأحرف، تلميح لوحة المفاتيح */
export default function AppearanceTab({ prefs, updatePrefs }: AppearanceTabProps) {
  const { settings, updateSettings } = useSettings()

  return (
    <Rows>
      <Row>
        <SliderRow
          label="حجم الخط"
          helper="يُطبَّق فوراً على كامل الواجهة (75% – 125%)"
          value={settings.fontSize}
          onValueChange={(v) => updateSettings({ fontSize: v })}
          min={75}
          max={125}
          unit="%"
        />
        <Panel glow="cyan-dim" className="mb-3 px-4 py-5">
          <TypingLine text={PREVIEW_TEXT} states={PREVIEW_STATES} />
        </Panel>
      </Row>
      <Row>
        <SegmentedControl
          label="نظام الأرقام"
          options={[
            { value: 'western' as const, label: '123' },
            { value: 'arabic' as const, label: '١٢٣' },
          ]}
          value={settings.numerals}
          onValueChange={(v) => updateSettings({ numerals: v })}
        />
      </Row>
      <Row>
        <ToggleSwitch
          label="مظهر شاشة الأركيد (خطوط المسح)"
          helper="طبقة scanlines خفيفة فوق الواجهة بروح شاشات CRT"
          checked={settings.scanlines}
          onCheckedChange={(v) => updateSettings({ scanlines: v })}
        />
      </Row>
      <Row>
        <ToggleSwitch
          label="تقليل الحركة"
          helper="يتبع إعداد النظام افتراضياً؛ يوقف اهتزاز الشاشة والحركات الزائدة"
          checked={settings.reducedMotion}
          onCheckedChange={(v) => updateSettings({ reducedMotion: v })}
        />
      </Row>
      <Row>
        <SegmentedControl
          label="السمة"
          options={[
            { value: 'dark' as const, label: 'فضاء داكن' },
            { value: 'contrast' as const, label: 'تباين عالٍ' },
          ]}
          value={prefs.highContrast ? 'contrast' : 'dark'}
          onValueChange={(v) => updatePrefs({ highContrast: v === 'contrast' })}
        />
        <p className="pb-3 text-[13px] text-ink-400">
          التباين العالي: نص أوضح وحدود أسمك بلا شفافية — أنسب لضعف النظر.
        </p>
      </Row>
      <Row>
        <ToggleSwitch
          label="حروف ملتصقة (مثل الكتابة العادية)"
          helper="إلغاء الفراغات وهوامش خلايا الأحرف لتظهر الجملة كنص متصل طبيعي يعتاد عليه المتدرب"
          checked={settings.joinedChars}
          onCheckedChange={(v) => updateSettings({ joinedChars: v })}
        />
      </Row>
      <Row>
        <ToggleSwitch
          label="رموز ✓/✗ إضافية على الأحرف"
          helper="مساعدة لسلامة عمى الألوان بجانب لونَي الصح والخطأ"
          checked={settings.charStateGlyphs}
          onCheckedChange={(v) => updateSettings({ charStateGlyphs: v })}
        />
      </Row>
      <Row>
        <SegmentedControl
          label="إظهار تلميح لوحة المفاتيح"
          options={[
            { value: 'auto' as const, label: 'تلقائي حسب المرحلة' },
            { value: 'always' as const, label: 'دائماً' },
            { value: 'never' as const, label: 'أبداً' },
          ]}
          value={prefs.keyboardHintMode}
          onValueChange={(v) => {
            updatePrefs({ keyboardHintMode: v })
            updateSettings({ keyboardHints: v !== 'never' })
          }}
        />
      </Row>
    </Rows>
  )
}
