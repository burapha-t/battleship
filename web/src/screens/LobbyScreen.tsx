import { useTranslation } from '../useTranslation'
import { Avatar } from '../components/Avatar'
import { Hero } from '../components/Hero'
import type { GameState } from '../gameReducer'
import type { LobbyStatus } from '../protocol'
import './screens.css'

const STATUS: Record<LobbyStatus, { label: 'connecting' | 'idle' | 'searching' | 'placing' | 'inMatch'; dot: string }> = {
  connecting: { label: 'connecting', dot: 'grey' },
  idle: { label: 'idle', dot: '' },
  searching: { label: 'searching', dot: 'sun' },
  placing: { label: 'placing', dot: 'lilac' },
  'in-match': { label: 'inMatch', dot: 'coral' },
}

const OTHER_COLORS = ['var(--lilac)', 'var(--peach)', 'var(--kelp)']

type Props = {
  state: GameState
  /** I'm waiting to be paired (App works it out, so the header's buttons can follow it too). */
  searching: boolean
  onStartGame: () => void
}

export function LobbyScreen({ state, searching, onStartGame }: Props) {
  const { t } = useTranslation('game')
  return (
    <main className="home">
      <Hero />
      <aside className="home-side">
        <div className="card join">
          <h2>{t('welcome', { name: state.myName ?? '' })}</h2>
          <p className="hint">
            {searching
              ? t('searchHint')
              : t('startHint')}
          </p>
          <button type="button" className="btn wide" disabled={searching} onClick={onStartGame}>
            {searching ? t('searchingOpponent') : t('startGame')}
          </button>
        </div>
        <section className="card lobby" aria-labelledby="lobby-title">
          <div className="lobby-head">
            <h3 id="lobby-title">{t('online')}</h3>
            <span className="count">{state.lobby.length}</span>
          </div>
          <ul>
            {state.lobby.map((client, i) => {
              const you = client.id === state.myId
              const status = STATUS[client.status] ?? STATUS.idle
              return (
                <li key={client.id} className="who">
                  <Avatar name={client.name} color={you ? 'var(--sun)' : client.name ? OTHER_COLORS[i % OTHER_COLORS.length] : '#C3D3E3'} />
                  <span className="who-name">
                    {client.name ?? <em>{t('connecting')}</em>}
                    {you && <small>{t('thatsYou')}</small>}
                  </span>
                  <span className="pill">
                    <span className={`dot ${status.dot}`} />
                    {t(status.label)}
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      </aside>
    </main>
  )
}
