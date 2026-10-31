import { useTranslation } from '../i18n/useTranslation'
import { useEffect, useRef, useState } from 'react'
import { Board } from '../components/Board'
import type { BoardShip } from '../components/Board'
import { Countdown } from '../components/Countdown'
import { StreakLevels, StreakNotification } from '../components/StreakNotification'
import { END_DELAY_MS } from '../state/endDelay'
import { matchSides } from '../state/gameReducer'
import type { GameState, Shot } from '../state/gameReducer'
import { SHIP_COUNT, cellName } from '../rules/placement'
import type { Cell } from '../protocol'
import { playSound } from '../sound/sound'
import { STREAK_MIN, consecutiveHits } from '../rules/streak'
import { SHIP_COLORS } from '../components/shipColors'
import { isUsefulRegion, suggestSonarRegions } from '../aiSonar'
import type { SonarRegion } from '../aiSonar'
import './screens.css'

const LOG_LENGTH = 4

type Props = { state: GameState; onFire: (cell: Cell) => void }

/**
 * My board (my ships + shots at me) and the target board (my shots). Marks
 * come only from `fireResult`, never from my own click.
 */
export function GameScreen({ state, onFire }: Props) {
  const { t } = useTranslation('game')
  const { me, opponent } = matchSides(state)
  const myId = state.myId
  const opponentName = opponent?.name ?? t('yourOpponent')
  const nameOf = (id: string) => (id === me?.id ? me.name : id === opponent?.id ? opponent.name : id)

  // The turn I fired on: no second shot until the next `turn`.
  const [firedOn, setFiredOn] = useState<number | null>(null)
  const [aim, setAim] = useState<Cell | null>(null)
  const [sonarScans, setSonarScans] = useState(0)
  const [sonarRegions, setSonarRegions] = useState<SonarRegion[]>([])
  const [sonarHelp, setSonarHelp] = useState(false)
  const sonarCard = useRef<HTMLDivElement>(null)

  const turn = state.turn
  const myTurn = turn !== null && turn.activePlayerId === myId
  // Set while the final board stays up, before the end screen.
  const over = state.winnerId !== null
  const iWon = over && state.winnerId === myId
  const canFire = !over && myTurn && firedOn !== turn.turnNumber

  const myShots = state.shots.filter((s) => s.by === myId)
  const incoming = state.shots.filter((s) => s.target === myId)
  const sunkByMe = sunkShips(myShots)
  const sunkAtMe = sunkShips(incoming)
  const alreadyShot = new Set(myShots.map((s) => `${s.row},${s.col}`))

  // A region may include an old hit as useful evidence, but it disappears once
  // a cell turns out to be a miss or part of a sunk ship, or once every cell
  // has been attempted: the same rule the scan uses.
  const liveSonarRegions = sonarRegions.filter((region) => isUsefulRegion(region.cells, myShots))
  // Late-match regions may overlap; Board keys sonar cells by position.
  const sonarCells = liveSonarRegions
    .flatMap((region) => region.cells)
    .filter(([row, col], i, cells) => cells.findIndex(([r, c]) => r === row && c === col) === i)

  const scanSonar = () => {
    if (sonarScans >= 2) return
    const regions = suggestSonarRegions(myShots, 2)
    setSonarRegions(regions)
    setSonarScans((count) => count + 1)
  }

  // The "?" explanation closes on Escape or a click outside the Sonar card.
  useEffect(() => {
    if (!sonarHelp) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSonarHelp(false)
    }
    const onPointer = (e: PointerEvent) => {
      if (!sonarCard.current?.contains(e.target as Node)) setSonarHelp(false)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onPointer)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onPointer)
    }
  }, [sonarHelp])

  // My newest shot, if it hit, gets the yellow ring until my next shot.
  const myLast = myShots.at(-1)
  const freshHit: Cell | null = myLast?.result === 'hit' ? [myLast.row, myLast.col] : null

  const ownShips: BoardShip[] = state.myShips
    ? state.myShips.map((cells, i) => ({
        cells,
        color: SHIP_COLORS[i],
        sunk: sunkAtMe.some((sunk) => sunk.some(([r, c]) => cells.some((x) => x[0] === r && x[1] === c))),
      }))
    : sunkAtMe.map((cells) => ({ cells, sunk: true }))

  const fire = (cell: Cell) => {
    if (!canFire || !turn) return
    setFiredOn(turn.turnNumber)
    onFire(cell)
  }

  const last = state.shots.at(-1)
  // A hit that keeps my streak going plays the streak sound instead of the
  // hit sound; a sinking shot keeps the sunk (or win) clip.
  const streakHit = last?.by === myId && consecutiveHits(myShots, myId) >= STREAK_MIN
  useEffect(() => {
    if (!last) return
    if (last.allSunk) playSound(last.by === myId ? 'win' : 'lose')
    else if (last.sunk) playSound('sunk')
    else playSound(last.result === 'hit' && streakHit ? 'streak' : last.result)
  }, [last, myId, streakHit])

  return (
    <main className="game">
      <div className={`banner${(over ? iWon : myTurn) ? '' : ' theirs'}`} role="status">
        {over
          ? iWon
            ? t('sankLast', { name: opponentName })
            : t('lostLast', { name: opponentName })
          : myTurn
            ? t('yourTurn', { name: opponentName })
            : t('opponentTurn', { name: opponentName })}
      </div>
      <p className="auto-note" role="status">
        {last?.auto && (
          <span>
            {t('timeoutShot', { name: nameOf(last.by), cell: cellName([last.row, last.col]) })}
          </span>
        )}
      </p>

      <div className="field2">
        <section className="side">
          <h3>
            {t('yourFleet')}
            <span className="pill">
              <span className="dot" />
              {t('afloat', { count: SHIP_COUNT - sunkAtMe.length, total: SHIP_COUNT })}
            </span>
          </h3>
          <Board label={t('yourFleet')} ships={ownShips} shots={incoming} />
        </section>

        <div className="mid">
          {over ? (
            // Counts down the pause before the Win/Lost screen.
            <Countdown seconds={END_DELAY_MS / 1000} turnNumber={-1} label={t('resultsIn')} />
          ) : (
            turn && <Countdown seconds={turn.seconds} turnNumber={turn.turnNumber} />
          )}
          <div className="log-wrap">
            {/* Over the top of the log: it covers neither board nor the timer. */}
            <StreakNotification myShots={myShots} myId={myId} />
            <div className="card log">
              <h4>{t('lastShots')}</h4>
              {state.shots.length === 0 && <p className="empty">{t('noShots')}</p>}
              {state.shots
                .slice(-LOG_LENGTH)
                .reverse()
                .map((s) => (
                  <p key={`${s.by}-${s.row},${s.col}`}>
                    <span className={`tag ${s.sunk ? 's' : s.result === 'hit' ? 'h' : 'm'}`}>
                      {t(s.sunk ? 'sunk' : s.result === 'hit' ? 'hit' : 'miss')}
                    </span>
                    {s.auto
                      ? t('timeoutLog', { name: nameOf(s.by), cell: cellName([s.row, s.col]) })
                      : s.sunk
                        ? t('sunkLog', { name: nameOf(s.by), target: nameOf(s.target) })
                        : `${nameOf(s.by)} → ${cellName([s.row, s.col])}`}
                  </p>
                ))}
            </div>
          </div>
          <StreakLevels />
          <div className="sonar-card card" ref={sonarCard}>
            <b>{t('sonarTitle')}</b>
            <button
              type="button"
              className="sonar-help"
              aria-label={t('sonarHelpTitle')}
              title={t('sonarHelpTitle')}
              aria-expanded={sonarHelp}
              aria-controls="sonar-help"
              onClick={() => setSonarHelp((open) => !open)}
            >
              ?
            </button>
            {sonarHelp && (
              <div id="sonar-help" className="sonar-help-box">
                <b>{t('sonarHelpTitle')}</b>
                <p>{t('sonarHelp')}</p>
              </div>
            )}
            <button type="button" className="btn" disabled={sonarScans >= 2 || over} onClick={scanSonar}>
              {t('sonarScan', { count: Math.max(0, 2 - sonarScans) })}
            </button>
            {sonarScans > 0 && (
              <span>
                {liveSonarRegions.length
                  ? t('sonarSignals', { count: liveSonarRegions.length })
                  : t('sonarNoUseful')}
              </span>
            )}
          </div>
          <div className="legend">
            <span>
              <i className="sw hit">✕</i>{t('hit')}
            </span>
            <span>
              <i className="sw miss" />
              {t('miss')}
            </span>
            <span>
              <i className="sw sunk" />
              {t('sunkShip')}
            </span>
          </div>
        </div>

        <section className={`side${canFire ? ' active' : ''}`}>
          <h3>
            {t('waters', { name: opponentName })}
            <span className="pill">
              <span className="dot coral" />
              {t('afloat', { count: SHIP_COUNT - sunkByMe.length, total: SHIP_COUNT })}
            </span>
          </h3>
          <Board
            label={t('waters', { name: opponentName })}
            enemy
            ships={sunkByMe.map((cells) => ({ cells, sunk: true }))}
            shots={myShots}
            sonar={sonarCells}
            hover={canFire && aim && !alreadyShot.has(`${aim[0]},${aim[1]}`) ? aim : null}
            fresh={freshHit}
            disabled={!canFire}
            canClick={([r, c]) => !alreadyShot.has(`${r},${c}`)}
            onCellClick={fire}
            onCellHover={setAim}
          />
        </section>
      </div>
    </main>
  )
}

function sunkShips(shots: Shot[]): Cell[][] {
  return shots.flatMap((s) => (s.sunk && s.sunkCells ? [s.sunkCells] : []))
}
