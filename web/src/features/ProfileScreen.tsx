import { useState } from 'react'
import { Avatar } from '../components/Avatar'
import { readPreference, savePreference, usePreferences } from '../preferences'
import { AchievementsScreen, EloCard, HistoryScreen } from './FeatureScreens'
import { badges, matches } from './data'

type ProfileTab = 'overview' | 'history' | 'badges'
const colors = ['var(--sun)', 'var(--kelp)', 'var(--lilac)', 'var(--peach)', 'var(--foam)']

type Props = { name: string | null; guest: boolean; onPlay: () => void }

export function ProfileScreen({ name, guest, onPlay }: Props) {
  const { t } = usePreferences()
  const [tab, setTab] = useState<ProfileTab>('overview')
  const [editing, setEditing] = useState(false)
  const storageKey = `battleship.profile-color.${encodeURIComponent(name ?? 'preview')}`
  const [colorIndex, setColorIndex] = useState(() => {
    const stored = readPreference<number>(storageKey, 0)
    return Number.isInteger(stored) && stored >= 0 && stored < colors.length ? stored : 0
  })
  const captainName = name ?? t('Demo captain', 'กัปตันตัวอย่าง')
  const unlocked = badges.filter(badge => badge.value >= badge.goal)
  const tabs: [ProfileTab, string, string][] = [
    ['overview', 'Overview', 'ภาพรวม'],
    ['history', 'Match history', 'ประวัติแมตช์'],
    ['badges', 'Badges', 'ตราความสำเร็จ'],
  ]

  return (
    <main className="feature-page profile-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">{t('YOUR CAPTAIN’S QUARTERS', 'ห้องส่วนตัวของกัปตัน')}</span>
          <h1>{t('My profile', 'โปรไฟล์ของฉัน')}</h1>
          <p>{t('Your captain, your battles, your collection.', 'กัปตันของคุณ การรบของคุณ คอลเลกชันของคุณ')}</p>
        </div>
        <span className="pill demo-pill"><span className="dot sun" />{t('Sample stats', 'สถิติตัวอย่าง')}</span>
      </div>

      <section className="card profile-hero" aria-label={t('Captain profile', 'โปรไฟล์กัปตัน')}>
        <div className="profile-avatar"><Avatar name={captainName} color={colors[colorIndex]} /></div>
        <div className="profile-identity">
          <span className="eyebrow">{guest ? t('GUEST CAPTAIN', 'กัปตันผู้เยี่ยมชม') : t('CAPTAIN PROFILE', 'โปรไฟล์กัปตัน')}</span>
          <h2>{captainName}</h2>
          <p>{t('Ready for the next adventure.', 'พร้อมสำหรับการผจญภัยครั้งต่อไป')}</p>
          <div className="profile-tags">
            <span className="pill">⚓ {t('Captain', 'กัปตัน')}</span>
            <span className="pill">✦ {t(`${unlocked.length} badges unlocked`, `ปลดล็อกแล้ว ${unlocked.length} ตรา`)}</span>
          </div>
        </div>
        <div className="profile-actions">
          <button className="btn white small" type="button" aria-expanded={editing} aria-controls="profile-customization" onClick={() => setEditing(!editing)}>
            {editing ? t('Done', 'เสร็จแล้ว') : t('Customize avatar', 'ปรับแต่งอวตาร')}
          </button>
          <button className="btn small" type="button" onClick={onPlay}>{name ? t('Play a match →', 'เล่นแมตช์ →') : t('Create your profile →', 'สร้างโปรไฟล์ของคุณ →')}</button>
        </div>
        {editing && <div id="profile-customization" className="profile-customization">
          <div><h3>{t('Avatar color', 'สีอวตาร')}</h3><p>{t('Saved on this device for this captain name.', 'บันทึกในอุปกรณ์นี้สำหรับชื่อกัปตันนี้')}</p></div>
          <div className="avatar-colors" role="group" aria-label={t('Avatar color', 'สีอวตาร')}>
            {colors.map((color, index) => <button key={color} type="button" style={{ background: color }} aria-label={t(['Yellow', 'Green', 'Purple', 'Peach', 'Blue'][index], ['เหลือง', 'เขียว', 'ม่วง', 'พีช', 'ฟ้า'][index])} aria-pressed={colorIndex === index} onClick={() => { setColorIndex(index); savePreference(storageKey, index) }}>{colorIndex === index ? '✓' : ''}</button>)}
          </div>
        </div>}
      </section>

      <p className="profile-demo-note">{t('Your captain name comes from this session. Elo, match history, and badges below are sample data; online accounts and saved match records are not connected yet.', 'ชื่อกัปตันมาจากเซสชันนี้ คะแนน Elo ประวัติแมตช์ และตราด้านล่างเป็นข้อมูลตัวอย่าง ยังไม่ได้เชื่อมต่อบัญชีออนไลน์หรือบันทึกแมตช์ถาวร')}</p>

      <div className="profile-tabs" role="group" aria-label={t('Profile sections', 'ส่วนต่าง ๆ ของโปรไฟล์')}>
        {tabs.map(([value, en, th]) => <button key={value} type="button" aria-pressed={tab === value} aria-controls="profile-content" className={tab === value ? 'active' : ''} onClick={() => setTab(value)}>{t(en, th)}{value === 'badges' && <span>{unlocked.length}</span>}</button>)}
      </div>

      <div id="profile-content">
        {tab === 'overview' ? <div className="profile-overview">
          <EloCard />
          <div className="stat-grid">
            {[[t('Matches played', 'แมตช์ที่เล่น'), '68'], [t('Victories', 'ชัยชนะ'), '42'], [t('Win rate', 'อัตราชนะ'), '62%'], [t('Badges unlocked', 'ตราที่ปลดล็อก'), `${unlocked.length} / ${badges.length}`]].map(([label, value]) => <div className="card stat" key={label}><b>{value}</b><span>{label}</span></div>)}
          </div>
          <div className="profile-highlights">
            <section className="card profile-highlight">
              <div className="profile-highlight-heading"><h2>{t('Recent battles', 'การรบล่าสุด')}</h2><button className="text-button" type="button" onClick={() => setTab('history')}>{t('View history →', 'ดูประวัติ →')}</button></div>
              {matches.slice(0, 3).map(match => <div className="profile-recent-match" key={match.id}><span aria-hidden>{match.won ? '🏆' : '⚓'}</span><div><b>{match.opponent}</b><small>{match.won ? t('Victory', 'ชนะ') : t('Defeat', 'แพ้')}</small></div><strong className={match.won ? 'positive' : 'negative'}>{match.change > 0 ? '+' : ''}{match.change} Elo</strong></div>)}
            </section>
            <section className="card profile-highlight">
              <div className="profile-highlight-heading"><h2>{t('Badge collection', 'คอลเลกชันตรา')}</h2><button className="text-button" type="button" onClick={() => setTab('badges')}>{t('View badges →', 'ดูตราทั้งหมด →')}</button></div>
              <div className="profile-badge-preview">{unlocked.map(badge => <div key={badge.en}><span style={{ background: badge.color }} aria-hidden>{badge.icon}</span><b>{t(badge.en, badge.th)}</b></div>)}</div>
            </section>
          </div>
        </div> : tab === 'history' ? <HistoryScreen embedded /> : <AchievementsScreen embedded />}
      </div>
    </main>
  )
}
