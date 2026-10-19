import { useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'
import { updateSettings } from '../settings'
import { useSettings } from '../useSettings'
import './SettingsModal.css'

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const settings = useSettings()
  const t = (en: string, th: string) => settings.language === 'th' ? th : en
  useEffect(() => { if (!dialog.current?.open) dialog.current?.showModal() }, [])
  return (
    <dialog ref={dialog} className="settings-modal" aria-labelledby="settings-title" onCancel={onClose} onClose={onClose}
      onClick={event => {
        if (event.target !== event.currentTarget) return
        const rect = event.currentTarget.getBoundingClientRect()
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose()
      }}>
      <div className="settings-heading">
        <h2 id="settings-title">{t('Settings', 'การตั้งค่า')}</h2>
        <button type="button" className="settings-close" aria-label={t('Close', 'ปิด')} onClick={onClose}>×</button>
      </div>
      <section className="settings-section" aria-labelledby="settings-sound">
        <h3 id="settings-sound"><span aria-hidden>♫</span> {t('Sound', 'เสียง')}</h3>
        {(['musicVolume', 'effectsVolume'] as const).map(key => (
          <div className="settings-volume" key={key}>
            <label htmlFor={key}>{key === 'musicVolume' ? t('Music', 'เพลง') : t('Sound effects', 'เสียงเอฟเฟกต์')}</label>
            <input id={key} type="range" min="0" max="100" step="1" value={settings[key]} aria-valuetext={`${settings[key]}%`}
              style={{ '--volume': `${settings[key]}%`, '--fill': key === 'musicVolume' ? 'var(--sea)' : 'var(--kelp)' } as CSSProperties}
              onChange={event => updateSettings({ [key]: Number(event.target.value) })} />
            <output htmlFor={key}>{settings[key]}%</output>
          </div>
        ))}
      </section>
      <section className="settings-section settings-language" aria-labelledby="settings-language">
        <h3 id="settings-language"><span aria-hidden>◎</span> {t('Language', 'ภาษา')}</h3>
        <div className="settings-segment" role="group" aria-labelledby="settings-language">
          <button type="button" lang="en" aria-pressed={settings.language === 'en'} onClick={() => updateSettings({ language: 'en' })}>English</button>
          <button type="button" lang="th" aria-pressed={settings.language === 'th'} onClick={() => updateSettings({ language: 'th' })}>ไทย</button>
        </div>
      </section>
      <div className="settings-footer"><button type="button" className="btn" onClick={onClose}>{t('Done', 'เสร็จสิ้น')}</button></div>
    </dialog>
  )
}
