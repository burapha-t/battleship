import { useEffect, useEffectEvent, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Avatar } from '../components/Avatar'
import { DesignIcon } from '../components/DesignIcon'
import type { IconName } from '../components/DesignIcon'
import { usePreferences } from '../preferences'
import { captains, matches } from './data'

export type Page = 'play' | 'leaderboard' | 'profile' | 'history'

export function UtilityNavigation({ page, stage, authenticated, online, onNavigate, onSettings, onLogout }: {
  page: Page; stage: string; authenticated: boolean; online: number
  onNavigate: (page: Page) => void; onSettings: () => void; onLogout: () => void
}) {
  const { t, language, setLanguage } = usePreferences()
  const game = page === 'play' && stage === 'game'
  const home = page === 'play' && ['connecting', 'nickname', 'lobby'].includes(stage)
  const iconButton = (icon: IconName, en: string, th: string, click: () => void) => <button type="button" className="iconbtn" title={t(en, th)} aria-label={t(en, th)} onClick={click}><DesignIcon name={icon} /></button>
  return <>
    {authenticated && page === 'play' && !home && !game && <div className="design-top"><div className="logo"><b>Battle</b>ship</div><span className="pill"><span className="dot" />{stage === 'end' ? t('Match is over', 'แมตช์จบแล้ว') : t(`${online} captains online`, `กัปตันออนไลน์ ${online} คน`)}</span></div>}
    <nav className={`utility-nav${game ? ' game-utility' : ''}`} aria-label={t('Navigation', 'เมนูนำทาง')}>
      {!authenticated ? <button type="button" className="btn white small language-quick" onClick={() => setLanguage(language === 'en' ? 'th' : 'en')}>{language === 'en' ? 'ไทย' : 'English'}</button> : <>
        {home ? <>{iconButton('profile', 'Profile', 'โปรไฟล์', () => onNavigate('profile'))}{iconButton('history', 'Match history', 'ประวัติแมตช์', () => onNavigate('history'))}{iconButton('trophy', 'Leaderboard', 'กระดานผู้นำ', () => onNavigate('leaderboard'))}{iconButton('logout', 'Log out', 'ออกจากระบบ', onLogout)}</> : !game && page !== 'play' ? <button type="button" className="btn white small" onClick={() => onNavigate('play')}><DesignIcon name="home" />{t('Home', 'หน้าหลัก')}</button> : null}
        {iconButton('settings', 'Settings', 'ตั้งค่า', onSettings)}
      </>}
    </nav>
  </>
}

export function LoginScreen({ onEnter }: { onEnter: (name: string, guest: boolean) => void }) {
  const { t } = usePreferences()
  const [mode, setMode] = useState<'login' | 'signup' | 'guest'>('login')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)
  const [visible, setVisible] = useState(false)
  const enter = useEffectEvent(onEnter)
  useEffect(() => {
    if (!pending) return
    const timer = setTimeout(() => enter(name.trim(), mode === 'guest'), 750)
    return () => clearTimeout(timer)
  }, [pending, name, mode])
  const submit = (event: FormEvent) => { event.preventDefault(); if (name.trim()) setPending(true) }
  const changeMode = (next: typeof mode) => { setMode(next); setPassword(''); setVisible(false) }
  const captain = name.trim() || t('Your name', 'ชื่อของคุณ')
  return <main className="id-center">
    <div className="card idcard">
      <div className="idhead"><span><DesignIcon name="anchor" />{t('Battleship fleet', 'กองเรือ Battleship')}</span><small>{t('CAPTAIN’S ID', 'บัตรประจำตัวกัปตัน')}</small></div>
      <div className="id-stub">
        <div className={`id-photo${mode === 'signup' && !name ? ' new' : ''}`}>{name.trim() ? Array.from(name.trim())[0].toUpperCase() : '?'}</div>
        <div className="id-rank">{mode === 'signup' ? t('New captain', 'กัปตันใหม่') : t('Captain', 'กัปตัน')}</div>
        <div className="id-holder">{captain}</div>
        <div className="id-number">{t('Demo captain ID', 'บัตรกัปตันตัวอย่าง')}</div>
        <div className="barcode" aria-hidden />
      </div>
      <form className="id-form" onSubmit={submit}>
        <div className="id-tabs"><button type="button" aria-pressed={mode !== 'signup'} disabled={pending} onClick={() => changeMode('login')}>{t('Log in', 'เข้าสู่ระบบ')}</button><button type="button" aria-pressed={mode === 'signup'} disabled={pending} onClick={() => changeMode('signup')}>{t('Sign up', 'สมัครสมาชิก')}</button></div>
        <h1>{mode === 'signup' ? t('Welcome aboard, captain!', 'ยินดีต้อนรับ กัปตัน!') : mode === 'guest' ? t('Ahoy, captain!', 'สวัสดี กัปตัน!') : t('Welcome back, captain!', 'ยินดีต้อนรับกลับ กัปตัน!')}</h1>
        <label htmlFor="captain-username">{t('Username', 'ชื่อผู้ใช้')}</label>
        <input id="captain-username" className="field" autoComplete="username" value={name} maxLength={16} required pattern=".*\S.*" disabled={pending} onChange={event => setName(event.target.value)} autoFocus />
        {mode !== 'guest' && <><label htmlFor="captain-password">{t('Password', 'รหัสผ่าน')}</label><div className="id-password"><input id="captain-password" className="field" type={visible ? 'text' : 'password'} required minLength={8} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password} disabled={pending} onChange={event => setPassword(event.target.value)} /><button type="button" onClick={() => setVisible(!visible)} disabled={pending} aria-label={visible ? t('Hide password', 'ซ่อนรหัสผ่าน') : t('Show password', 'แสดงรหัสผ่าน')}>{visible ? t('Hide', 'ซ่อน') : t('Show', 'แสดง')}</button></div></>}
        <button type="submit" className={`btn wide${pending ? ' pressed' : ''}`} disabled={pending}>{pending ? t('Raising the anchor…', 'กำลังยกสมอ…') : mode === 'signup' ? t('Sign up', 'สมัครสมาชิก') : mode === 'guest' ? t('Set sail', 'ออกเรือ') : t('Log in', 'เข้าสู่ระบบ')}</button>
        <button type="button" className="guest-link" disabled={pending} onClick={() => changeMode(mode === 'guest' ? 'login' : 'guest')}>{mode === 'guest' ? t('Back to log in', 'กลับไปเข้าสู่ระบบ') : t('Play as guest', 'เล่นในฐานะผู้เยี่ยมชม')}</button>
      </form>
      {pending && <div className="id-stamp">{t('Cleared to sail', 'พร้อมออกเรือ')}</div>}
    </div>
    {pending ? <div className="login-progress" role="status"><b>{t('Preparing your demo profile…', 'กำลังเตรียมโปรไฟล์ตัวอย่าง…')}</b><div className="loading-track"><i /></div></div> : <p className="design-disclaimer">{t('Frontend demo · Use made-up details. No account is created; passwords are never saved or sent.', 'ตัวอย่างหน้าจอ · ใช้ข้อมูลสมมติ ไม่มีการสร้างบัญชี บันทึก หรือส่งรหัสผ่าน')}</p>}
  </main>
}

export function LeaderboardScreen({ name }: { name: string }) {
  const { t } = usePreferences()
  const rows = captains.map((captain, index) => index === 2 ? { ...captain, name } : captain)
  return <main className="design-page leaderboard-page">
    <div className="design-title"><h1>{t('Leaderboard', 'กระดานผู้นำ')}</h1><span>{t('Ranked by total wins', 'จัดอันดับตามจำนวนชัยชนะ')}</span></div>
    <div className="wins-podium">{[1, 0, 2].map(index => <div className={`podium-spot podium-${index+1}${index === 2 ? ' you' : ''}`} key={index}><Avatar name={rows[index].name} color={rows[index].color} /><div className="podium-name">{rows[index].name}{index === 2 && <span className="pill">{t('You', 'คุณ')}</span>}</div><div className="podium-block"><b>{index+1}</b><span>{t(`${rows[index].wins} wins`, `ชนะ ${rows[index].wins} ครั้ง`)}</span></div></div>)}</div>
    <section className="card ranking-list" aria-label={t('Player rankings', 'อันดับผู้เล่น')}><div className="ranking-row list-head"><span>{t('Rank', 'อันดับ')}</span><span>{t('Player', 'ผู้เล่น')}</span><span>{t('Wins', 'ชนะ')}</span></div><div className="ranking-scroll">{rows.slice(3).map((captain,index) => <div className="ranking-row" key={captain.name}><b className="ranking-number">{index+4}</b><span className="ranking-player"><Avatar name={captain.name} color={captain.color}/>{captain.name}</span><b className="ranking-wins">{captain.wins}</b></div>)}</div></section>
    <p className="design-disclaimer">{t('Sample leaderboard · Global rankings are not connected yet.', 'กระดานผู้นำตัวอย่าง · ยังไม่ได้เชื่อมต่ออันดับทั่วโลก')}</p>
  </main>
}

export function HistoryScreen({ name }: { name: string }) {
  const { t, language } = usePreferences()
  return <main className="design-page history-page">
    <div className="design-title"><h1>{t('Match history', 'ประวัติแมตช์')}</h1><span>{t(`Captain ${name} · 12 matches`, `กัปตัน ${name} · 12 แมตช์`)}</span></div>
    <div className="history-stats">{[[t('Matches played','แมตช์ที่เล่น'),'12'],[t('Wins','ชนะ'),'8'],[t('Losses','แพ้'),'4'],[t('Win rate','อัตราชนะ'),'67%'],[t('Shot accuracy','ความแม่นยำ'),'50%']].map(([label,value])=><div className="card history-stat" key={label}><span>{label}</span><b>{value}</b></div>)}</div>
    <div className="card history-table-wrap"><table className="history-table"><thead><tr>{[t('Result','ผลการแข่งขัน'),t('Opponent','คู่แข่ง'),t('Score','คะแนน'),t('Shots and accuracy','การยิงและความแม่นยำ'),t('Date and time','วันที่และเวลา')].map(label=><th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{matches.map(match=><tr key={match.date}><td><span className={`history-result ${match.won?'win':'lost'}`}>{match.won?t('Win','ชนะ'):t('Lost','แพ้')}</span></td><td><span className="history-opponent"><Avatar name={match.opponent} color={match.color}/>{match.opponent}</span></td><td className="history-score">{match.score}</td><td><div className="accuracy-cell"><span className="accuracy-meter"><i style={{width:`${Math.round(match.hits/match.shots*100)}%`}}/></span><b>{Math.round(match.hits/match.shots*100)}%</b><small>{t(`${match.hits} hits · ${match.shots} shots`, `โดน ${match.hits} · ยิง ${match.shots} ครั้ง`)}</small></div></td><td className="history-date"><time dateTime={match.date}>{new Date(match.date).toLocaleString(language==='th'?'th-TH':'en-US',{timeZone:'Asia/Bangkok',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false})}</time></td></tr>)}</tbody></table></div>
    <p className="design-disclaimer">{t('Sample match records · Live match history is not connected yet.', 'ประวัติแมตช์ตัวอย่าง · ยังไม่ได้เชื่อมต่อประวัติแมตช์จริง')}</p>
  </main>
}

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const { t, language, setLanguage, musicVolume, effectsVolume, setMusicVolume, setEffectsVolume, streaks, toggleStreaks } = usePreferences()
  const [preview, setPreview] = useState(false)
  useEffect(() => { if (!preview) return; const timer = setTimeout(() => setPreview(false), 3500); return () => clearTimeout(timer) }, [preview])
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => { const dialog=ref.current; if (dialog && !dialog.open) dialog.showModal() }, [])
  return <dialog ref={ref} className="card settings-modal" aria-labelledby="settings-title" onClose={onClose} onClick={event=>{if(event.target===event.currentTarget){const bounds=event.currentTarget.getBoundingClientRect();if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)onClose()}}}>
    <div className="modal-heading"><h2 id="settings-title">{t('Settings','ตั้งค่า')}</h2><button type="button" className="iconbtn" aria-label={t('Close settings','ปิดการตั้งค่า')} onClick={onClose} autoFocus><DesignIcon name="close"/></button></div>
    <section className="settings-section"><h3><DesignIcon name="sound"/>{t('Sound','เสียง')}</h3>{[[t('Music','ดนตรี'),musicVolume,setMusicVolume],[t('Sound effects','เอฟเฟกต์เสียง'),effectsVolume,setEffectsVolume]].map(([label,value,setter])=><label className="volume-row" key={String(label)}><span>{String(label)}</span><input type="range" aria-label={String(label)} min="0" max="100" value={value as number} onChange={event=>(setter as (value:number)=>void)(Number(event.target.value))} style={{'--volume':`${value}%`} as React.CSSProperties}/><output>{Number(value)}%</output></label>)}</section>
    <section className="settings-section settings-language"><h3><DesignIcon name="language"/>{t('Language','ภาษา')}</h3><div className="id-tabs"><button type="button" lang="en" aria-pressed={language==='en'} onClick={()=>setLanguage('en')}>EN</button><button type="button" lang="th" aria-pressed={language==='th'} onClick={()=>setLanguage('th')}>TH</button></div></section>
    <div className="settings-streak"><label><input type="checkbox" checked={streaks} onChange={toggleStreaks}/>{t('Hit streak notifications','แจ้งเตือนการยิงโดนต่อเนื่อง')}</label><button className="guest-link" type="button" disabled={!streaks} onClick={() => setPreview(true)}>{t('Preview','ดูตัวอย่าง')}</button></div>
    {preview && streaks && <p className="settings-preview" role="status">{t('Hot streak ×3 · 3 hits in a row!', 'ยิงโดนต่อเนื่อง ×3 · โดน 3 ครั้งติดกัน!')}</p>}
    <div className="modal-footer"><span>{t('Saved on this device','บันทึกในอุปกรณ์นี้')}</span><button type="button" className="btn" onClick={onClose}>{t('Done','เสร็จแล้ว')}</button></div>
  </dialog>
}
