import { Volume2, VolumeX } from 'lucide-react'
import NeonButton from '@/components/NeonButton'
import SliderRow from '@/components/SliderRow'
import ToggleSwitch from '@/components/ToggleSwitch'
import { useSettings } from '@/context/SettingsContext'
import { audio } from '@/lib/audio'
import { Row, Rows } from '@/pages/settings/common'
import type { UiPrefs } from '@/pages/custom/config'

export interface AudioTabProps {
  prefs: UiPrefs
  updatePrefs: (patch: Partial<UiPrefs>) => void
}

/** تبويب الصوت — كتم الكل، منزلقات master/music/sfx مستقلة، موسيقى محيطة، أصوات القوائم، تنبيه الوقت */
export default function AudioTab({ prefs, updatePrefs }: AudioTabProps) {
  const { settings, updateSettings } = useSettings()
  const a = settings.audio

  const trySfx = () => {
    audio.ensureContext()
    audio.play('laser')
    window.setTimeout(() => audio.play('explosion'), 220)
  }

  return (
    <Rows>
      <Row>
        <ToggleSwitch
          label="كتم الكل"
          helper="يكتم كل أصوات اللعبة وينعكس على أيقونة الصوت في كل الشاشات"
          checked={a.muted}
          onCheckedChange={(v) => updateSettings({ audio: { ...a, muted: v } })}
        />
      </Row>
      <Row>
        <SliderRow
          label="مستوى الصوت العام"
          value={a.master}
          onValueChange={(v) => updateSettings({ audio: { ...a, master: v } })}
          min={0}
          max={100}
          unit="%"
          disabled={a.muted}
        />
      </Row>
      <Row>
        <SliderRow
          label="المؤثرات الصوتية"
          helper="طلقات الليزر والانفجارات وأصوات الكتابة"
          value={a.sfx}
          onValueChange={(v) => updateSettings({ audio: { ...a, sfx: v } })}
          min={0}
          max={100}
          unit="%"
          disabled={a.muted}
        />
        <div className="flex pb-3">
          <NeonButton variant="ghost" size="md" soundOnClick={false} onClick={trySfx} disabled={a.muted}>
            {a.muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            تجربة
          </NeonButton>
        </div>
      </Row>
      <Row>
        <SliderRow
          label="الموسيقى الخلفية"
          value={a.music}
          onValueChange={(v) => updateSettings({ audio: { ...a, music: v } })}
          min={0}
          max={100}
          unit="%"
          disabled={a.muted}
        />
      </Row>
      <Row>
        <ToggleSwitch
          label="الموسيقى المحيطة أثناء اللعب"
          helper="طبقة درون هادئة مولّدة بالمذبذبات"
          checked={a.ambientMusic}
          onCheckedChange={(v) => updateSettings({ audio: { ...a, ambientMusic: v } })}
        />
      </Row>
      <Row>
        <ToggleSwitch
          label="أصوات واجهة القوائم"
          helper="نقرات خفيفة عند التحويم والضغط على الأزرار"
          checked={prefs.menuSounds}
          onCheckedChange={(v) => updatePrefs({ menuSounds: v })}
        />
      </Row>
      <Row>
        <ToggleSwitch
          label="تنبيه صوتي عند اقتراب انتهاء الوقت"
          helper="نبضة كل ثانية عند بقاء أقل من 10 ثوانٍ"
          checked={prefs.timerWarningSound}
          onCheckedChange={(v) => updatePrefs({ timerWarningSound: v })}
        />
      </Row>
    </Rows>
  )
}
