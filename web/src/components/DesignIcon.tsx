export type IconName = 'home' | 'settings' | 'profile' | 'history' | 'trophy' | 'logout' | 'anchor' | 'fire' | 'target' | 'lock' | 'check' | 'close' | 'sound' | 'language'
export function DesignIcon({ name }: { name: IconName }) {
  const paths: Record<IconName, React.ReactNode> = {
    home: <><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9.5h13V10" fill="#fff"/><rect x="10" y="13.5" width="4" height="6" rx="1" fill="#FFC83D"/></>,
    settings: <>{Array.from({length:8},(_,i)=><rect key={i} x="10.4" y="1.6" width="3.2" height="4.4" rx="1" fill="currentColor" stroke="none" transform={`rotate(${i*45} 12 12)`}/>)}<circle cx="12" cy="12" r="6.6" fill="#fff"/><circle cx="12" cy="12" r="2.6" fill="#FFC83D"/></>,
    profile: <><circle cx="12" cy="7" r="4" fill="#FFC83D"/><path d="M4 21v-3a8 8 0 0 1 16 0v3z" fill="#fff"/></>,
    history: <><rect x="4" y="4" width="16" height="17" rx="3" fill="#fff"/><path d="M8 2v4M16 2v4M8 11h8M8 15h5"/></>,
    trophy: <><path d="M7 4h10v4.5a5 5 0 0 1-10 0z" fill="#FFC83D"/><path d="M7 6H4.5c0 2.4 1.2 4 3.2 4.2M17 6h2.5c0 2.4-1.2 4-3.2 4.2M12 13.5V17M8 20.5h8"/></>,
    logout: <><path d="M9 4H4v16h5M10 12h11M17 8l4 4-4 4"/></>,
    anchor: <><circle cx="12" cy="5" r="2.2"/><path d="M12 7.2V21M8 11h8M4.5 14.5c.5 3.6 3.6 6.5 7.5 6.5s7-2.9 7.5-6.5"/></>,
    fire: <path d="M12 3c1.5 4 6 6 6 11.5a6 6 0 0 1-12 0c0-3 1.6-4.8 3-6 0 2 .8 3.3 2 3.8-.4-3.8 0-6.8 1-9.3z"/>,
    target: <><circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="2.5"/><path d="M12 1.5v4M12 18.5v4M1.5 12h4M18.5 12h4"/></>,
    lock: <><rect x="5.5" y="10.5" width="13" height="10" rx="2.5" fill="#fff"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/></>,
    check: <path d="M5 12.5l4.5 4.5L19 7.5"/>, close: <path d="m6 6 12 12M18 6 6 18"/>,
    sound: <><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M17 8.5a5 5 0 0 1 0 7M19.5 6a8.5 8.5 0 0 1 0 12"/></>,
    language: <><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a19 19 0 0 1 0 18 19 19 0 0 1 0-18"/></>,
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>
}
