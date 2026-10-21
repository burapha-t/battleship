import { useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'
import { getSettings, updateSettings } from '../settings'
import { useTranslation } from '../useTranslation'
import './SettingsModal.css'

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const { t } = useTranslation('game')
  const settings = getSettings()
  useEffect(() => { if (!dialog.current?.open) dialog.current?.showModal() }, [])
  return (
    <dialog ref={dialog} className="settings-modal" aria-labelledby="settings-title" onClose={onClose}
      onClick={event => {
        if (event.target !== event.currentTarget) return
        const rect = event.currentTarget.getBoundingClientRect()
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.current?.close()
      }}>
      <div className="settings-heading">
        <h2 id="settings-title">{t('settings')}</h2>
        <button type="button" className="settings-close" aria-label={t('close')} onClick={() => dialog.current?.close()}>×</button>
      </div>
      <section className="settings-section" aria-labelledby="settings-sound">
        <h3 id="settings-sound"><span aria-hidden>♫</span> {t('sound')}</h3>
        {(['musicVolume', 'effectsVolume'] as const).map(key => (
          <div className="settings-volume" key={key}>
            <label htmlFor={key}>{key === 'musicVolume' ? t('music') : t('effects')}</label>
            <input id={key} type="range" min="0" max="100" step="1" value={settings[key]} aria-valuetext={`${settings[key]}%`}
              style={{ '--volume': `${settings[key]}%`, '--fill': key === 'musicVolume' ? 'var(--sea)' : 'var(--kelp)' } as CSSProperties}
              onChange={event => updateSettings({ [key]: Number(event.target.value) })} />
            <output htmlFor={key}>{settings[key]}%</output>
          </div>
        ))}
      </section>
      <section className="settings-section settings-language" aria-labelledby="settings-language">
        <h3 id="settings-language"><span aria-hidden>◎</span> {t('language')}</h3>
        <div className="settings-segment" role="group" aria-labelledby="settings-language">
          <button type="button" lang="en" aria-pressed={settings.language === 'en'} onClick={() => updateSettings({ language: 'en' })}>English</button>
          <button type="button" lang="th" aria-pressed={settings.language === 'th'} onClick={() => updateSettings({ language: 'th' })}>ไทย</button>
        </div>
      </section>
      <div className="settings-footer"><button type="button" className="btn" onClick={() => dialog.current?.close()}>{t('done')}</button></div>
    </dialog>
  )
}
