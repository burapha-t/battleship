import { useState } from 'react'
import type { FormEvent } from 'react'
import { Avatar } from '../components/Avatar'
import { Hero } from '../components/Hero'
import { usePreferences } from '../preferences'
import { badges, captains, matches, rank } from './data'
import './features.css'

export type Page = 'play' | 'leaderboard' | 'profile' | 'settings'
export function Navigation({ page, onNavigate }: { page: Page; onNavigate: (page: Page) => void }) {
  const { t } = usePreferences()
  const items: [Page, string, string, string][] = [['play', '⚓', 'Play', 'เล่น'], ['leaderboard', '🏆', 'Leaderboard', 'กระดานผู้นำ'], ['profile', '⚓', 'My profile', 'โปรไฟล์ของฉัน'], ['settings', '⚙', 'Settings', 'ตั้งค่า']]
  return <nav className="feature-nav" aria-label={t('Main navigation', 'เมนูหลัก')}>{items.map(([key, icon, en, th]) => <button type="button" key={key} className={`nav-item${page === key ? ' selected' : ''}`} aria-current={page === key ? 'page' : undefined} onClick={() => onNavigate(key)}><span aria-hidden>{icon}</span>{t(en, th)}</button>)}</nav>
}

export function LoginScreen({ onEnter }: { onEnter: (name: string, guest: boolean) => void }) {
  const { t } = usePreferences()
  const [mode, setMode] = useState<'login' | 'signup' | 'guest'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const submit = (event: FormEvent) => {
    event.preventDefault()
    onEnter(mode === 'login' ? email.split('@')[0].slice(0, 16) : name.trim(), mode === 'guest')
    setPassword('')
  }
  const changeMode = (value: typeof mode) => { setMode(value); setPassword(''); setShowPassword(false) }
  return <main className="home login-home"><Hero /><aside className="home-side"><form className="card join login-card" onSubmit={submit}>
    <span className="eyebrow">{t('YOUR NEXT ADVENTURE AWAITS', 'การผจญภัยครั้งใหม่รอคุณอยู่')}</span>
    <h2>{mode === 'signup' ? t('Join the crew!', 'มาเป็นลูกเรือกัน!') : mode === 'guest' ? t('Ahoy, captain!', 'สวัสดี กัปตัน!') : t('Welcome aboard!', 'ยินดีต้อนรับขึ้นเรือ!')}</h2>
    <p className="hint">{t('A little strategy. A lot of splash.', 'วางแผนให้ดี แล้วลุยทะเลกันเลย')}</p>
    {mode !== 'guest' && <div className="segmented"><button type="button" aria-pressed={mode === 'login'} onClick={() => changeMode('login')}>{t('Log in', 'เข้าสู่ระบบ')}</button><button type="button" aria-pressed={mode === 'signup'} onClick={() => changeMode('signup')}>{t('Sign up', 'สมัครสมาชิก')}</button></div>}
    {mode !== 'login' && <label className="input-label">{t('Captain name', 'ชื่อกัปตัน')}<input className="field" value={name} onChange={e => setName(e.target.value)} required pattern=".*\S.*" maxLength={16} autoComplete="nickname" placeholder={t('Your nickname', 'ชื่อเล่นของคุณ')} /></label>}
    {mode !== 'guest' && <><label className="input-label">{t('Email', 'อีเมล')}<input className="field" type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" placeholder="captain@example.com" /></label><label className="input-label">{t('Password', 'รหัสผ่าน')}<span className="password-field"><input className="field" aria-label={t('Password', 'รหัสผ่าน')} type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required minLength={8} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} placeholder={t('At least 8 characters', 'อย่างน้อย 8 ตัวอักษร')} /><button type="button" aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>{showPassword ? t('Hide', 'ซ่อน') : t('Show', 'แสดง')}</button></span></label></>}
    <p className="demo-note">{t('Frontend demo · Use made-up details. No account is created and no password is saved or sent.', 'ตัวอย่างหน้าจอ · ใช้ข้อมูลสมมติ ไม่มีการสร้างบัญชี บันทึก หรือส่งรหัสผ่าน')}</p>
    <button className="btn wide" type="submit">{mode === 'signup' ? t('Create demo profile →', 'สร้างโปรไฟล์ตัวอย่าง →') : mode === 'guest' ? t('Set sail →', 'ออกเรือ →') : t('Log in to demo →', 'เข้าสู่ตัวอย่าง →')}</button>
    <button className="text-button" type="button" onClick={() => changeMode(mode === 'guest' ? 'login' : 'guest')}>{mode === 'guest' ? t('Back to log in', 'กลับไปเข้าสู่ระบบ') : t('Or play as guest', 'หรือเล่นในฐานะผู้เยี่ยมชม')}</button>
  </form></aside></main>
}

function PageHeading({ icon, title, subtitle }: { icon: string; title: string; subtitle: string }) {
  const { t } = usePreferences()
  return <div className="page-heading"><div><span className="eyebrow">{t('THE CAPTAIN’S CLUB', 'สโมสรของกัปตัน')}</span><h1><span aria-hidden>{icon}</span> {title}</h1><p>{subtitle}</p></div><span className="pill demo-pill"><span className="dot sun" />{t('Sample data', 'ข้อมูลตัวอย่าง')}</span></div>
}
export function EloCard() {
  const { t } = usePreferences()
  return <section className="card elo-card"><div className="rank-emblem" aria-hidden>⚓</div><div><span className="eyebrow">{t('YOUR DEMO RANK', 'อันดับตัวอย่างของคุณ')}</span><h2>{t(...rank(1480))} <span className="elo-number">1,480 <small>Elo</small></span></h2><p>{t('20 Elo to Commander. Steady as she goes!', 'อีก 20 Elo ถึงผู้บัญชาการ เดินหน้าต่อไป!')}</p><progress aria-label={t('Progress to Commander', 'ความคืบหน้าสู่ผู้บัญชาการ')} max={300} value={280} /><div className="progress-label"><span>1,200</span><span>1,500</span></div></div><div className="elo-stat"><b>42 / 68</b><span>{t('Matches won', 'แมตช์ที่ชนะ')}</span></div></section>
}

export function LeaderboardScreen() {
  const { t } = usePreferences()
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<'elo' | 'wins'>('elo')
  const rows = [...captains].sort((a, b) => b[sort] - a[sort])
  return <main className="feature-page"><PageHeading icon="🏆" title={t('Global leaderboard', 'กระดานผู้นำทั่วโลก')} subtitle={t('Big waves. Brilliant captains. Who rules the sea?', 'คลื่นใหญ่ กัปตันเก่ง ใครจะครองท้องทะเล?')} /><EloCard />
    <div className="podium">{[captains[1], captains[0], captains[2]].map((captain, i) => <div key={captain.name} className={`card podium-card place-${i === 1 ? 1 : i === 0 ? 2 : 3}`}><span className="podium-place">{i === 1 ? '👑' : i === 0 ? '#2' : '#3'}</span><Avatar name={captain.name} color={captain.color} /><h3>{captain.name}</h3><strong>{captain.elo.toLocaleString()} <small>Elo</small></strong><span>{t(...rank(captain.elo))}</span></div>)}</div>
    <section className="card table-card"><div className="table-toolbar"><h2>{t('All captains', 'กัปตันทั้งหมด')}</h2><label className="sr-only" htmlFor="captain-search">{t('Search captains', 'ค้นหากัปตัน')}</label><input id="captain-search" className="field" placeholder={t('Search captain…', 'ค้นหากัปตัน…')} value={query} onChange={e => setQuery(e.target.value)} /><label className="sort-label">{t('Sort by', 'เรียงตาม')}<select value={sort} onChange={e => setSort(e.target.value as 'elo' | 'wins')}><option value="elo">Elo</option><option value="wins">{t('Wins', 'ชัยชนะ')}</option></select></label></div><div className="table-scroll"><table><thead><tr>{[t('Rank', 'อันดับ'), t('Captain', 'กัปตัน'), 'Elo', t('Wins', 'ชนะ'), t('Win rate', 'อัตราชนะ')].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{rows.filter(c => c.name.toLowerCase().includes(query.toLowerCase())).map(c => <tr key={c.name} className={c.name === 'Captain' ? 'your-row' : ''}><td>#{rows.indexOf(c) + 1}</td><td><div className="captain-cell"><Avatar name={c.name} color={c.color} /><div>{c.name}{c.name === 'Captain' && <small>{t('Demo profile', 'โปรไฟล์ตัวอย่าง')}</small>}</div></div></td><td><b>{c.elo.toLocaleString()}</b></td><td>{c.wins}</td><td>{Math.round(c.wins / (c.wins + c.losses) * 100)}%</td></tr>)}</tbody></table></div>{!rows.some(c => c.name.toLowerCase().includes(query.toLowerCase())) && <p className="empty-state">{t('No captains found. Try another name.', 'ไม่พบกัปตัน ลองค้นหาชื่ออื่น')}</p>}</section>
    <p className="page-footnote">{t('Elo demo: Cadet < 1,200 · Captain 1,200–1,499 · Commander 1,500–1,799 · Admiral 1,800+. Ratings and rankings are illustrative.', 'ตัวอย่าง Elo: นักเรียนนายเรือ < 1,200 · กัปตัน 1,200–1,499 · ผู้บัญชาการ 1,500–1,799 · พลเรือเอก 1,800+ คะแนนและอันดับเป็นตัวอย่าง')}</p>
  </main>
}

export function HistoryScreen({ embedded = false }: { embedded?: boolean }) {
  const { t, language } = usePreferences()
  const [filter, setFilter] = useState('all')
  const [selected, setSelected] = useState<string | null>(null)
  const visible = matches.filter(m => filter === 'all' || m.won === (filter === 'wins'))
  const Container = embedded ? 'section' : 'main'
  return <Container className={embedded ? 'profile-section' : 'feature-page'}>{embedded ? <h2 className="profile-section-title">{t('Match history', 'ประวัติแมตช์')}</h2> : <PageHeading icon="◷" title={t('Match history', 'ประวัติแมตช์')} subtitle={t('Every battle has a story. Here’s your ship’s log.', 'ทุกการรบมีเรื่องราว นี่คือบันทึกการเดินเรือของคุณ')} />}<div className="stat-grid">{[[t('Matches played', 'แมตช์ที่เล่น'), '68'], [t('Victories', 'ชัยชนะ'), '42'], [t('Win rate', 'อัตราชนะ'), '62%'], [t('Current Elo', 'Elo ปัจจุบัน'), '1,480']].map(([label, value]) => <div className="card stat" key={label}><b>{value}</b><span>{label}</span></div>)}</div>
    <div className="history-toolbar"><h2>{t('Recent battles', 'การรบล่าสุด')}</h2><div className="segmented">{[['all', t('All', 'ทั้งหมด')], ['wins', t('Wins', 'ชนะ')], ['losses', t('Losses', 'แพ้')]].map(([key, label]) => <button type="button" key={key} aria-pressed={filter === key} onClick={() => { setFilter(key); setSelected(null) }}>{label}</button>)}</div></div>
    <div className="history-list">{visible.map(m => <article key={m.id} className={`card match-card${m.won ? ' victory' : ' defeat'}`}><div className="match-summary"><span className="match-icon" aria-hidden>{m.won ? '🏆' : '⚓'}</span><div className="match-opponent"><span className={`result-label ${m.won ? 'positive' : 'negative'}`}>{m.won ? t('VICTORY', 'ชนะ') : t('DEFEAT', 'แพ้')}</span><h3><small>vs </small>{m.opponent}</h3><time dateTime={m.date}>{new Date(m.date).toLocaleString(language === 'th' ? 'th-TH' : 'en-GB', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</time></div><div className="match-rating"><strong className={m.change > 0 ? 'positive' : 'negative'}>{m.change > 0 ? '+' : ''}{m.change} Elo</strong><span>{m.elo.toLocaleString()} {t('total', 'รวม')}</span></div><button type="button" className="btn white small" aria-expanded={selected === m.id} aria-controls={`detail-${m.id}`} onClick={() => setSelected(selected === m.id ? null : m.id)}>{selected === m.id ? t('Close', 'ปิด') : t('Details', 'รายละเอียด')}</button></div>{selected === m.id && <div className="match-details" id={`detail-${m.id}`}><span>{t('Duration', 'ระยะเวลา')} <b>{m.duration}</b></span><span>{t('Accuracy', 'ความแม่นยำ')} <b>{m.accuracy}%</b></span><span>{t('Shots fired', 'จำนวนครั้งที่ยิง')} <b>{m.shots}</b></span><span>{t('Best hit streak', 'ยิงโดนต่อเนื่องสูงสุด')} <b>{m.streak}</b></span><small>{t('Sample match', 'แมตช์ตัวอย่าง')} {m.id}</small></div>}</article>)}</div>
  </Container>
}

export function AchievementsScreen({ embedded = false }: { embedded?: boolean }) {
  const { t } = usePreferences()
  const [filter, setFilter] = useState('all')
  const Container = embedded ? 'section' : 'main'
  return <Container className={embedded ? 'profile-section' : 'feature-page'}>{embedded ? <h2 className="profile-section-title">{t('Badges', 'ตราความสำเร็จ')}</h2> : <PageHeading icon="✦" title={t('A captain’s collection', 'คอลเลกชันของกัปตัน')} subtitle={t('Little milestones. Legendary adventures. Earn your sea legs!', 'ทุกก้าวสู่ตำนาน สะสมความสำเร็จกลางทะเล!')} />}<section className="card collection-banner"><span aria-hidden>🎖</span><div><h2>{t('4 of 6 badges unlocked', 'ปลดล็อกแล้ว 4 จาก 6 ตรา')}</h2><p>{t('Your next legend is just a battle away.', 'ตำนานบทต่อไปอาจอยู่ในแมตช์ถัดไป')}</p><progress aria-label={t('Badges unlocked', 'ตราที่ปลดล็อก')} max={6} value={4} /></div></section><div className="segmented badge-filter">{[['all', t('All badges', 'ตราทั้งหมด')], ['unlocked', t('Unlocked', 'ปลดล็อกแล้ว')], ['locked', t('In progress', 'กำลังสะสม')]].map(([key, label]) => <button type="button" key={key} aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}</button>)}</div><div className="badge-grid">{badges.filter(b => filter === 'all' || (b.value >= b.goal) === (filter === 'unlocked')).map(b => <article key={b.en} className={`card badge-card${b.value < b.goal ? ' locked' : ''}`}><span className="badge-state">{b.value >= b.goal ? t('✓ Unlocked', '✓ ปลดล็อกแล้ว') : t('In progress', 'กำลังสะสม')}</span><div className="badge-emblem" style={{ background: b.color }} aria-hidden>{b.icon}</div><h2>{t(b.en, b.th)}</h2><p>{t(b.desc, b.thai)}</p><progress aria-label={t(b.en, b.th)} value={b.value} max={b.goal} /><span className="badge-progress">{b.value.toLocaleString()} / {b.goal.toLocaleString()}</span></article>)}</div></Container>
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: () => void }) {
  const { t } = usePreferences()
  return <div className="setting-row"><div><h3>{label}</h3><p>{hint}</p></div><button type="button" className={`toggle${checked ? ' on' : ''}`} role="switch" aria-checked={checked} aria-label={label} onClick={onChange}><span /><b>{checked ? t('On', 'เปิด') : t('Off', 'ปิด')}</b></button></div>
}
export function SettingsScreen({ onPreviewStreak }: { onPreviewStreak: () => void }) {
  const { t, language, setLanguage, effects, toggleEffects, music, toggleMusic, streaks, toggleStreaks } = usePreferences()
  return <main className="feature-page settings-page"><div className="page-heading"><div><span className="eyebrow">{t('MAKE YOURSELF AT HOME', 'ปรับให้เป็นแบบที่คุณชอบ')}</span><h1>⚙ {t('Ship settings', 'ตั้งค่าการเดินเรือ')}</h1><p>{t('Your ship. Your sound. Your way to play.', 'เรือของคุณ เสียงของคุณ เล่นในแบบของคุณ')}</p></div><span className="pill"><span className="dot" />{t('Saved on this device', 'บันทึกในอุปกรณ์นี้')}</span></div><section className="card settings-card"><h2>🌐 {t('Language', 'ภาษา')}</h2><div className="setting-row"><div><h3>{t('In-game language', 'ภาษาภายในเกม')}</h3><p>{t('Switch language anytime, even during a match.', 'เปลี่ยนภาษาได้ทุกเวลา แม้ระหว่างแมตช์')}</p></div><div className="segmented"><button type="button" lang="en" aria-pressed={language === 'en'} onClick={() => setLanguage('en')}>English</button><button type="button" lang="th" aria-pressed={language === 'th'} onClick={() => setLanguage('th')}>ไทย</button></div></div></section><section className="card settings-card"><h2>♫ {t('Sound & music', 'เสียงและดนตรี')}</h2><Toggle label={t('Sound effects', 'เอฟเฟกต์เสียง')} hint={t('Splashes, hits, sinking ships, and victory fanfares.', 'เสียงน้ำ เสียงยิงโดน เรือจม และชัยชนะ')} checked={effects} onChange={toggleEffects} /><Toggle label={t('Background music', 'ดนตรีประกอบ')} hint={t('A gentle nautical melody for your adventure.', 'ทำนองเบา ๆ สำหรับการผจญภัยของคุณ')} checked={music} onChange={toggleMusic} /></section><section className="card settings-card"><h2>🔥 {t('Battle notifications', 'การแจ้งเตือนในการรบ')}</h2><Toggle label={t('Hit streak notifications', 'แจ้งเตือนการยิงโดนต่อเนื่อง')} hint={t('Celebrate 3 or more consecutive hits. A miss resets your streak.', 'ฉลองเมื่อยิงโดนติดต่อกันตั้งแต่ 3 ครั้ง ยิงพลาดจะเริ่มนับใหม่')} checked={streaks} onChange={toggleStreaks} /><button className="btn white small" type="button" onClick={onPreviewStreak} disabled={!streaks}>{t('Preview notification', 'ดูตัวอย่างการแจ้งเตือน')}</button></section></main>
}
