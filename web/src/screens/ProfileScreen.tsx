import { useEffect, useRef, useState } from 'react'
import { BADGES, GROUPS } from '../badges'
import { Avatar } from '../components/Avatar'
import { Medal } from '../components/Medal'
import { SeaAvatar } from '../components/SeaAvatar'
import { MAX_SHOWN, profileDirty, toggleBadge } from '../profile'
import type { AchievementsView, ProfileView } from '../protocol'
import { useSettings } from '../useSettings'
import { badgeLabel, badgesText } from './badgesText'
import type { Language } from './historyText'
import { AVATARS, bestText, chosenText, profileText, rankLine } from './profileText'
import './profile.css'

type Props = {
  /** Null while loading. */
  profile: ProfileView | null
  /** My badges and bests; null while loading. */
  achievements: AchievementsView | null
  failed: boolean
  saving: boolean
  myName: string | null
  onHome: () => void
  onRetry: () => void
  onSave: (avatar: string, shownBadges: string[]) => void
}

/**
 * The mockup layout (9_profile): on the left how others see me, on the right
 * the picture and badges to choose. Choices stay local until Save.
 */
export function ProfileScreen({ profile, achievements, failed, saving, myName, onHome, onRetry, onSave }: Props) {
  const { language } = useSettings()
  const t = profileText(language)
  const title = useRef<HTMLHeadingElement>(null)
  useEffect(() => title.current?.focus(), [])

  return (
    <main className="profile">
      <div className="profile-head">
        <h1 ref={title} tabIndex={-1} className="title">{t('title')}</h1>
        <span className="profile-sub">{t('subtitle')}</span>
        <button type="button" className="btn white small" onClick={onHome}>
          <svg viewBox="0 0 24 24" aria-hidden>
            <path d="M3 11.5 12 4l9 7.5" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M5.5 10v9.5h13V10" fill="#fff" stroke="currentColor" strokeWidth="2.8" strokeLinejoin="round" />
            <rect x="10" y="13.5" width="4" height="6" rx="1" fill="var(--sun)" stroke="currentColor" strokeWidth="2" />
          </svg>
          {t('home')}
        </button>
      </div>

      {profile === null || achievements === null ? (
        <section className="card profile-note" role={failed ? 'alert' : 'status'}>
          <p>{failed ? t('failed') : t('loading')}</p>
          {failed && <button type="button" className="btn small" onClick={onRetry}>{t('retry')}</button>}
        </section>
      ) : (
        // A new saved profile starts my choices over from it.
        <Editor key={JSON.stringify(profile)} profile={profile} achievements={achievements} saving={saving}
          myName={myName} language={language} onSave={onSave} />
      )}
    </main>
  )
}

type EditorProps = {
  profile: ProfileView
  achievements: AchievementsView
  saving: boolean
  myName: string | null
  language: Language
  onSave: (avatar: string, shownBadges: string[]) => void
}

function Editor({ profile, achievements, saving, myName, language, onSave }: EditorProps) {
  const t = profileText(language)
  const groupName = badgesText(language)
  const [avatar, setAvatar] = useState(profile.avatar)
  const [shown, setShown] = useState(profile.shownBadges)
  const earned = achievements.badges.map((b) => b.code)
  const full = shown.length >= MAX_SHOWN

  return (
    <div className="profile-layout">
      <section className="card profile-card" aria-label={t('title')}>
        <div className="profile-picture">
          {avatar ? <SeaAvatar code={avatar} /> : <Avatar name={myName} color="var(--sun)" />}
        </div>
        <div className="profile-name">{myName}</div>
        <p className="profile-meta">{rankLine(profile.rank, profile.wins, language)}</p>
        <h2 className="profile-label">{t('onShow')}</h2>
        {shown.length > 0 ? (
          <ul className="profile-shelf">
            {shown.map((code) => (
              <li key={code}>
                <Medal code={code} />
                {badgeLabel(code, language)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="profile-none">{t('noneShown')}</p>
        )}
        <button type="button" className="btn wide" disabled={profile.guest || saving || !profileDirty(profile, avatar, shown)}
          onClick={() => onSave(avatar, shown)}>
          {saving ? t('saving') : t('save')}
        </button>
        {profile.guest && <p className="profile-guest">{t('guest')}</p>}
      </section>

      <div className="profile-panels">
        <section className="card profile-panel" aria-labelledby="profile-pictures">
          <h2 id="profile-pictures">{t('pictures')}</h2>
          <div className="profile-avatars" role="radiogroup" aria-labelledby="profile-pictures">
            {AVATARS.map((code) => (
              <label key={code} className={`profile-avatar${avatar === code ? ' on' : ''}`}>
                <input type="radio" name="profile-avatar" value={code} checked={avatar === code}
                  disabled={saving} onChange={() => setAvatar(code)} />
                <span className="profile-tile">
                  <SeaAvatar code={code} />
                  {avatar === code && (
                    <span className="badge-chip badge-tick" aria-hidden>
                      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                    </span>
                  )}
                </span>
                {t(code)}
              </label>
            ))}
          </div>
        </section>

        <section className="card profile-panel" aria-labelledby="profile-badges">
          <div className="profile-panel-head">
            <h2 id="profile-badges">{t('badges')}</h2>
            <span className="count" aria-live="polite">{chosenText(shown.length, language)}</span>
          </div>
          <div className="profile-rows">
            {GROUPS.map((group) => (
              <div key={group} className="profile-row">
                <div className="profile-row-label">
                  <b>{groupName(group)}</b>
                  <small>{bestText(group, achievements, language)}</small>
                </div>
                {BADGES.filter((b) => b.group === group).map((badge) => {
                  const owned = earned.includes(badge.code)
                  const on = shown.includes(badge.code)
                  const label = badgeLabel(badge.code, language)
                  // Locked, or 3 already chosen: nothing to do but look.
                  const off = saving || (!on && (!owned || full))
                  return (
                    <button key={badge.code} type="button" className={`profile-badge${owned ? '' : ' locked'}`}
                      aria-pressed={on} aria-disabled={off} aria-label={owned ? label : `${label}, ${t('locked')}`}
                      onClick={() => { if (!off) setShown(toggleBadge(shown, badge.code, earned)) }}>
                      <Medal code={badge.code} earned={owned} chosen={on} />
                      <b>{label}</b>
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
