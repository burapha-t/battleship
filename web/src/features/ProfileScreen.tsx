import { useState } from 'react'
import { DesignIcon } from '../components/DesignIcon'
import { readPreference, savePreference, usePreferences } from '../preferences'
import { avatarOptions, badgeGroups } from './data'

type SavedProfile = { avatar: string; badges: string[] }
const defaults: SavedProfile = { avatar: 'pufferfish', badges: ['wins-5','accuracy-70','streak-6'] }
export function ProfileScreen({ name }: { name: string }) {
  const { t } = usePreferences()
  const storageKey=`battleship.captain.${encodeURIComponent(name)}`
  const [draft,setDraft]=useState<SavedProfile>(()=>{
    const value=readPreference<SavedProfile>(storageKey,defaults)
    const validBadges=badgeGroups.flatMap(group=>group.values.filter(value=>value<=group.best).map(value=>`${group.id}-${value}`))
    return {avatar:avatarOptions.some(([id])=>id===value?.avatar)?value.avatar:defaults.avatar,badges:Array.isArray(value?.badges)?[...new Set(value.badges)].filter(id=>validBadges.includes(id)).slice(0,3):defaults.badges}
  })
  const [saved,setSaved]=useState(false)
  const toggleBadge=(id:string)=>{setSaved(false);setDraft(value=>({...value,badges:value.badges.includes(id)?value.badges.filter(item=>item!==id):value.badges.length<3?[...value.badges,id]:value.badges}))}
  const medal=(group:typeof badgeGroups[number],value:number,selected=false)=> <span className={`design-medal${selected?' selected':''}`} style={{background:group.colors[group.values.indexOf(value)]}}><DesignIcon name={group.icon}/><span>{group.id==='accuracy'?`${value}%`:group.id==='streak'?`×${value}`:value}</span>{selected&&<i className="badge-tick"><DesignIcon name="check"/></i>}</span>
  const label=(group:string,value:number)=>group==='wins'?t(`${value} wins`,`ชนะ ${value} ครั้ง`):group==='accuracy'?t(`Over ${value}%`,`มากกว่า ${value}%`):t(`${value} in a row`,`ต่อเนื่อง ${value} ครั้ง`)
  return <main className="design-page profile-page">
    <div className="design-title"><h1>{t('Profile','โปรไฟล์')}</h1><span>{t('How other captains see you','ตัวตนที่กัปตันคนอื่นจะเห็น')}</span></div>
    <div className="profile-layout">
      <aside className="card captain-preview">
        <div className="big-avatar"><img src={`/avatars/${draft.avatar}.svg`} alt={t(...(avatarOptions.find(([id])=>id===draft.avatar)?.slice(1) as [string,string]))}/></div>
        <h2>{name}</h2><p className="captain-meta">{t('Rank 3 · 8 wins','อันดับ 3 · ชนะ 8 ครั้ง')}</p>
        <h3>{t('Badges on show','ตราที่แสดง')}</h3>
        <div className="badge-shelf">{draft.badges.map(id=>{const [category,value]=id.split('-');const group=badgeGroups.find(group=>group.id===category)!;return <div key={id}>{medal(group,Number(value))}<b>{label(category,Number(value))}</b></div>})}{draft.badges.length===0&&<p>{t('Choose up to 3 badges to display.','เลือกตราที่จะแสดงได้สูงสุด 3 ตรา')}</p>}</div>
        <button type="button" className="btn wide" onClick={()=>{savePreference(storageKey,draft);window.dispatchEvent(new Event('battleship-profile-updated'));setSaved(true)}}>{saved?t('Profile saved ✓','บันทึกโปรไฟล์แล้ว ✓'):t('Save profile','บันทึกโปรไฟล์')}</button>
        <p className="profile-save-status" role="status">{saved?t('Saved on this device.','บันทึกในอุปกรณ์นี้แล้ว'):t('Avatar and display badges are saved locally.','บันทึกอวตารและตราที่แสดงในอุปกรณ์นี้')}</p>
      </aside>
      <div className="profile-panels">
        <section className="card choice-panel"><h2>{t('Choose your profile picture','เลือกรูปโปรไฟล์ของคุณ')}</h2><div className="avatar-options">{avatarOptions.map(([id,en,th])=><button type="button" className={`avatar-choice${draft.avatar===id?' chosen':''}`} key={id} aria-pressed={draft.avatar===id} onClick={()=>{setDraft({...draft,avatar:id});setSaved(false)}}><span className="avatar-tile"><img src={`/avatars/${id}.svg`} alt=""/>{draft.avatar===id&&<i className="badge-tick"><DesignIcon name="check"/></i>}</span><b>{t(en,th)}</b></button>)}</div></section>
        <section className="card choice-panel"><div className="choice-heading"><h2>{t('Choose 3 badges to show','เลือกตราที่จะแสดง 3 ตรา')}</h2><span className="pill badge-count">{t(`${draft.badges.length} of 3 chosen`,`เลือกแล้ว ${draft.badges.length} จาก 3`)}</span></div>
          <div className="badge-selection">{badgeGroups.map(group=><div className="badge-selection-row" key={group.id}><div className="badge-row-label"><h3>{t(group.en,group.th)}</h3><small>{group.id==='wins'?t('Best: 8 wins','สูงสุด: ชนะ 8 ครั้ง'):group.id==='accuracy'?t('Best match: 73%','แมตช์ที่ดีที่สุด: 73%'):t('Best: 6 in a row','สูงสุด: ต่อเนื่อง 6 ครั้ง')}</small></div>{group.values.map(value=>{const id=`${group.id}-${value}`,locked=value>group.best,selected=draft.badges.includes(id);return <button type="button" className={`badge-choice${locked?' locked':''}`} key={id} aria-pressed={selected} aria-label={`${label(group.id,value)}${locked?t(', locked',', ยังไม่ปลดล็อก'):''}`} disabled={locked||(!selected&&draft.badges.length>=3)} onClick={()=>toggleBadge(id)}><span className="medal-wrap">{medal(group,value,selected)}{locked&&<i className="badge-lock"><DesignIcon name="lock"/></i>}</span><b>{label(group.id,value)}</b></button>})}</div>)}</div>
        </section>
      </div>
    </div>
    <p className="design-disclaimer">{t('Sample ranks and badge progress · Online accounts are not connected yet.','อันดับและความคืบหน้าตราเป็นข้อมูลตัวอย่าง · ยังไม่ได้เชื่อมต่อบัญชีออนไลน์')}</p>
  </main>
}
