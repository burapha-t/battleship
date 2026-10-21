// Profile navigation (#42), using the supplied home mockup's corner buttons.
import { useSettings } from '../useSettings'
import { profileText } from '../screens/profileText'
import './ProfileNav.css'
export function ProfileNav({ onOpenProfile, onOpenSettings, disabled }: { onOpenProfile: () => void; onOpenSettings: () => void; disabled: boolean }) {
  const { language } = useSettings()
  const profile = profileText(language)('title')
  const settings = language === 'th' ? 'การตั้งค่า' : 'Settings'
  return <div className="profile-corner-nav">
    <button type="button" aria-label={profile} title={profile} disabled={disabled} onClick={onOpenProfile}>
      <svg viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8.5" r="4.2" fill="#FFC83D" /><path d="M4.5 20.5c.8-4 3.8-6.3 7.5-6.3s6.7 2.3 7.5 6.3z" fill="#FFC83D" />
      </svg>
    </button>
    <button type="button" aria-label={settings} title={settings} aria-haspopup="dialog" onClick={onOpenSettings}>
      <svg viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        {[0, 45, 90, 135, 180, 225, 270, 315].map(angle => <rect key={angle} x="10.4" y="1.6" width="3.2" height="4.4" rx="1" fill="currentColor" stroke="none" transform={`rotate(${angle} 12 12)`} />)}
        <circle cx="12" cy="12" r="6.6" fill="#fff" /><circle cx="12" cy="12" r="2.6" fill="#FFC83D" />
      </svg>
    </button>
  </div>
}
