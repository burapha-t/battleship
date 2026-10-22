import { Avatar } from '../components/Avatar'
import { ScreenHead } from '../components/ScreenHead'
import type { HistoryView } from '../gameReducer'
import type { HistoryMatch } from '../protocol'
import { localTime, percent } from './historyText'
import type { Language } from '../settings'
import { useTranslation } from '../useTranslation'
import './history.css'

const OPPONENT_COLORS = ['var(--lilac)', 'var(--peach)', 'var(--kelp)', 'var(--sea)']

type Props = {
  /** Null while the first page is loading. */
  history: HistoryView | null
  failed: boolean
  onBack: () => void
  onLoadMore: () => void
  onRetry: () => void
}

/** The spec layout: my five stats on top, my matches below, newest first. */
export function HistoryScreen({ history, failed, onBack, onLoadMore, onRetry }: Props) {
  const { language, t } = useTranslation('history')

  const stats = history?.stats
  const cells: [label: string, value: string, tone?: string][] = [
    [t('matches'), stats ? String(stats.matchCount) : '–'],
    [t('wins'), stats ? String(stats.winCount) : '–', 'win'],
    [t('losses'), stats ? String(stats.loseCount) : '–', 'lost'],
    [t('winRate'), stats ? percent(stats.winRate, language) : '–'],
    [t('accuracy'), stats ? percent(stats.accuracy, language) : '–'],
  ]

  return (
    <main className="history">
      <ScreenHead title={t('title')} subtitle={t('subtitle')} home={t('home')} onHome={onBack} />

      <dl className="card history-stats">
        {cells.map(([label, value, tone]) => (
          <div key={label} className={tone}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      <section className="card history-log" aria-labelledby="history-log-title">
        <h2 id="history-log-title" className="visually-hidden">{t('title')}</h2>
        {history === null ? (
          failed ? <Failed t={t} onRetry={onRetry} /> : <p className="history-note" role="status">{t('loading')}</p>
        ) : history.matches.length === 0 ? (
          <div className="history-note">
            <h3>{t('emptyTitle')}</h3>
            <p>{t('emptyBody')}</p>
          </div>
        ) : (
          <div className="history-scroll">
            <div className="history-row history-columns" aria-hidden>
              <span>{t('result')}</span>
              <span>{t('opponent')}</span>
              <span>{t('when')}</span>
              <span>{t('matchAccuracy')}</span>
            </div>
            <ol>
              {history.matches.map((match, i) => (
                <MatchRow key={`${match.endedAt}-${i}`} match={match} language={language} t={t} />
              ))}
            </ol>
            {failed ? (
              <Failed t={t} onRetry={onRetry} />
            ) : (
              history.more && (
                <div className="history-more">
                  <button type="button" className="btn white small" disabled={history.loadingMore} onClick={onLoadMore}>
                    {history.loadingMore ? t('loadingMore') : t('more')}
                  </button>
                </div>
              )
            )}
          </div>
        )}
      </section>
    </main>
  )
}

type T = ReturnType<typeof useTranslation<'history'>>['t']

function MatchRow({ match, language, t }: { match: HistoryMatch; language: Language; t: T }) {
  const color = OPPONENT_COLORS[[...match.opponent].reduce((sum, c) => sum + c.charCodeAt(0), 0) % OPPONENT_COLORS.length]
  return (
    <li className="history-row">
      <Pennant won={match.won} label={match.won ? t('win') : t('lost')} />
      <span className="history-opponent">
        <Avatar name={match.opponent} color={color} />
        {match.opponent}
      </span>
      <time className="history-when" dateTime={match.endedAt}>
        {localTime(match.endedAt, language)}
      </time>
      <span className="history-accuracy">
        <span className="visually-hidden">{t('matchAccuracy')} </span>
        <span className="meter" aria-hidden>
          <i style={{ width: `${Math.min(100, Math.max(0, match.accuracy))}%` }} />
        </span>
        {percent(match.accuracy, language)}
      </span>
    </li>
  )
}

/** A swallowtail signal flag: kelp for a win, coral for a loss. */
function Pennant({ won, label }: { won: boolean; label: string }) {
  return (
    <span className={`pennant ${won ? 'win' : 'lost'}`}>
      <svg viewBox="0 0 76 34" preserveAspectRatio="none" aria-hidden>
        <path d="M2 2 H74 L60 17 L74 32 H2 Z" />
      </svg>
      <span>{label}</span>
    </span>
  )
}

function Failed({ t, onRetry }: { t: T; onRetry: () => void }) {
  return (
    <div className="history-note" role="alert">
      <p>{t('failed')}</p>
      <button type="button" className="btn small" onClick={onRetry}>{t('retry')}</button>
    </div>
  )
}
