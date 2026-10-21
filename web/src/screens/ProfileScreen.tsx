// Own profile (#42): saved server data and a local, unsaved draft.
import { useEffect, useRef, useState } from 'react'
import { Avatar } from '../components/Avatar'
import { SeaAvatar } from '../components/SeaAvatar'
import { Medal } from '../components/Medal'
import { BADGES, badgeLabel, editableProfile, profileDirty, toggleBadge } from '../badges'
import type { ProfileView } from '../protocol'
import { useSettings } from '../useSettings'
import { percent } from './historyText'
import { AVATAR_CODES, profileText } from './profileText'
import './profile.css'

type Props = { profile: ProfileView | null; failed: boolean; saving: boolean; myName: string | null; onBack: () => void; onRetry: () => void; onSave: (avatar: string, shownBadges: string[]) => void }
export function ProfileScreen({ profile, failed, saving, myName, onBack, onRetry, onSave }: Props) {
  const { language } = useSettings()
  const t = profileText(language)
  const title = useRef<HTMLHeadingElement>(null)
  useEffect(() => title.current?.focus(), [])
  return <main className="profile-page" lang={language}>
    <div className="profile-head"><div><h1 ref={title} tabIndex={-1}>{t('title')}</h1><span>{t('subtitle')}</span></div>
      <button type="button" className="btn white small" onClick={onBack}>{t('home')}</button></div>
    {profile === null ? <section className="card profile-panel" role={failed ? 'alert' : 'status'}>
      <p>{failed ? t('failed') : t('loading')}</p>
      {failed && <button type="button" className="btn small" onClick={onRetry}>{t('retry')}</button>}
    </section> : <ProfileEditor key={JSON.stringify(profile)} profile={profile} saving={saving} myName={myName} onSave={onSave} />}
  </main>
}
function ProfileEditor({ profile, saving, myName, onSave }: Pick<Props, 'saving' | 'myName' | 'onSave'> & { profile: ProfileView }) {
  const { language } = useSettings()
  const t = profileText(language)
  const [avatar, setAvatar] = useState(profile.avatar)
  const [shown, setShown] = useState(profile.shownBadges)
  const earned = profile.badges.map(b => b.code)
  const editable = editableProfile(profile)
  const wins = language === 'th' ? `ชนะ ${profile.wins} ครั้ง` : `${profile.wins} wins`
  const streak = language === 'th' ? `ยิงโดนติดกัน ${profile.bestStreak} ครั้ง` : `${profile.bestStreak} in a row`
  const bests = [wins, percent(profile.bestAccuracy, language), streak]
  return <div className="profile-layout">
    <section className="card profile-preview" aria-label={t('shelf')}>
      <div className="profile-big-avatar">{avatar ? <SeaAvatar code={avatar} /> : <Avatar name={myName} color="var(--sun)" />}</div>
      <div className="profile-name">{myName}</div><p className="profile-meta">{wins}</p>
      <h2>{t('shelf')}</h2>
      <div className="profile-shelf">{shown.length ? shown.map(code => <div key={code}><Medal code={code} /><b>{badgeLabel(code, language)}</b></div>) : <p>{t('empty')}</p>}</div>
      <button type="button" className="btn wide" disabled={!editable || saving || !profileDirty(profile, avatar, shown)} onClick={() => onSave(avatar, shown)}>{!editable ? t('guest') : saving ? t('saving') : t('save')}</button>
      {!editable && <p className="profile-guest">{t('guestHint')}</p>}
    </section>
    <div className="profile-panels">
      <section className="card profile-panel"><h2 id="profile-pictures">{t('pictures')}</h2>
        <div className="profile-avatars" role="radiogroup" aria-labelledby="profile-pictures">
          {AVATAR_CODES.map(code => <label key={code} className="profile-avatar-choice">
            <input type="radio" name="avatar" value={code} checked={avatar === code} disabled={!editable || saving} onChange={() => setAvatar(code)} />
            <span className={`profile-avatar-tile${avatar === code ? ' selected' : ''}`}><SeaAvatar code={code} />{avatar === code && <span className="badge-chip badge-tick" aria-hidden>✓</span>}</span>
            <span>{t(code)}</span>
          </label>)}
        </div>
      </section>
      <section className="card profile-panel"><div className="profile-panel-head"><h2>{t('choose')}</h2><span>{shown.length} {t('chosen')}</span></div>
        <div className="profile-badge-grid">{(['wins', 'accuracy', 'streak'] as const).map((group, row) => <div className="profile-badge-row" key={group}>
          <div className="profile-row-label"><b>{t(group)}</b><small>{t(group === 'accuracy' ? 'bestMatch' : 'best')} {bests[row]}</small></div>
          {BADGES.filter(b => b.group === group).map(badge => {
            const owned = earned.includes(badge.code)
            const label = badgeLabel(badge.code, language)
            return <button type="button" className="profile-badge" key={badge.code} aria-label={`${label}${owned ? '' : `, ${t('locked')}`}`} aria-pressed={shown.includes(badge.code)} aria-disabled={!owned || !editable || saving}
              onClick={() => { if (editable && !saving) setShown(toggleBadge(shown, badge.code, earned)) }}>
              <Medal code={badge.code} earned={owned} chosen={shown.includes(badge.code)} /><b>{label}</b>
            </button>
          })}
        </div>)}</div>
      </section>
    </div>
  </div>
}
