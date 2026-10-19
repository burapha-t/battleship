import { useEffect, useRef, useState } from 'react'
import { Avatar } from '../components/Avatar'
import type { LeaderboardRow } from '../protocol'
import { historyLanguage, percent } from './historyText'
import type { Language } from './historyText'
import { leaderboardText, wins } from './leaderboardText'
import './leaderboard.css'

const OTHER_COLORS = ['var(--lilac)', 'var(--peach)', 'var(--kelp)', 'var(--sea)']

type Props = {
  /** Null while loading. Best first. */
  rows: LeaderboardRow[] | null
  failed: boolean
  /** My account name, to mark my spot. */
  myName: string | null
  onHome: () => void
  onRetry: () => void
}

/** The mockup layout (8_leaderboard): the top three on a podium, everyone else in a list. */
export function LeaderboardScreen({ rows, failed, myName, onHome, onRetry }: Props) {
  const [language] = useState(historyLanguage)
  const t = leaderboardText(language)
  const title = useRef<HTMLHeadingElement>(null)
  useEffect(() => title.current?.focus(), [])

  return (
    <main className="leaderboard">
      <div className="leaderboard-head">
        <h1 ref={title} tabIndex={-1} className="title">{t('title')}</h1>
        <span className="leaderboard-sub">{t('subtitle')}</span>
        <button type="button" className="btn white small" onClick={onHome}>
          <svg viewBox="0 0 24 24" aria-hidden>
            <path d="M3 11.5 12 4l9 7.5" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M5.5 10v9.5h13V10" fill="#fff" stroke="currentColor" strokeWidth="2.8" strokeLinejoin="round" />
            <rect x="10" y="13.5" width="4" height="6" rx="1" fill="var(--sun)" stroke="currentColor" strokeWidth="2" />
          </svg>
          {t('home')}
        </button>
      </div>

      {rows === null ? (
        <section className="card leaderboard-note" role={failed ? 'alert' : 'status'}>
          {failed ? (
            <>
              <p>{t('failed')}</p>
              <button type="button" className="btn small" onClick={onRetry}>{t('retry')}</button>
            </>
          ) : (
            <p>{t('loading')}</p>
          )}
        </section>
      ) : rows.length === 0 ? (
        <section className="card leaderboard-note">
          <h3>{t('emptyTitle')}</h3>
          <p>{t('emptyBody')}</p>
        </section>
      ) : (
        <>
          <Podium top={rows.slice(0, 3)} myName={myName} language={language} t={t} />
          {rows.length > 3 && (
            <section className="card leaderboard-list" aria-label={t('title')}>
              <div className="leaderboard-row leaderboard-columns" aria-hidden>
                <span>{t('rank')}</span>
                <span>{t('name')}</span>
                <span>{t('point')}</span>
                <span>{t('accuracy')}</span>
              </div>
              <ol className="leaderboard-scroll">
                {rows.slice(3).map((row) => {
                  const me = row.name === myName
                  return (
                    <li key={row.name} className={`leaderboard-row${me ? ' me' : ''}`}>
                      <span className="leaderboard-rank">{row.rank}</span>
                      <span className="leaderboard-name">
                        <Avatar name={row.name} color={colorOf(row.name, me)} />
                        {row.name}
                        {me && <span className="pill">{t('you')}</span>}
                      </span>
                      <span className="leaderboard-points">{row.points}</span>
                      <span className="leaderboard-accuracy">{percent(row.accuracy, language)}</span>
                    </li>
                  )
                })}
              </ol>
            </section>
          )}
        </>
      )}
    </main>
  )
}

type T = ReturnType<typeof leaderboardText>

/** 2nd, 1st, 3rd from left to right, only the spots that exist. */
function Podium({ top, myName, language, t }: { top: LeaderboardRow[]; myName: string | null; language: Language; t: T }) {
  const order = [1, 0, 2].filter((i) => i < top.length)
  return (
    <ol className="podium" style={{ gridTemplateColumns: `repeat(${order.length}, minmax(0, 210px))` }}>
      {order.map((i) => {
        const row = top[i]
        const me = row.name === myName
        return (
          <li key={row.name} className={`podium-spot podium-${i + 1}${me ? ' you' : ''}`}>
            <Avatar name={row.name} color={colorOf(row.name, me)} />
            <div className="podium-name">
              {row.name}
              {me && <span className="pill">{t('you')}</span>}
            </div>
            <div className="podium-block">
              <b><span className="visually-hidden">{t('rank')} </span>{row.rank}</b>
              <span>{wins(row.points, language)} · {percent(row.accuracy, language)}</span>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

/** Gold for me, as in the mockup; anyone else keeps one colour by name. */
function colorOf(name: string, me: boolean): string {
  if (me) return 'var(--sun)'
  return OTHER_COLORS[[...name].reduce((sum, c) => sum + c.charCodeAt(0), 0) % OTHER_COLORS.length]
}
