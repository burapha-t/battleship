import { useEffect, useState } from 'react'
import { Board } from '../components/Board'
import type { BoardShip } from '../components/Board'
import { Countdown } from '../components/Countdown'
import { HotStreak, StreakLevels } from '../components/HotStreak'
import { END_DELAY_MS } from '../endDelay'
import { matchSides } from '../gameReducer'
import type { GameState, Shot } from '../gameReducer'
import { SHIP_COUNT, cellName } from '../placement'
import type { Cell } from '../protocol'
import { playSound } from '../sound'
import { SHIP_COLORS } from './shipColors'
import './screens.css'

const LOG_LENGTH = 4

type Props = { state: GameState; onFire: (cell: Cell) => void }

/**
 * My board (my ships + shots at me) and the target board (my shots). Marks
 * come only from `fireResult`, never from my own click.
 */
export function GameScreen({ state, onFire }: Props) {
  const { me, opponent } = matchSides(state)
  const myId = state.myId
  const opponentName = opponent?.name ?? 'Your opponent'
  const nameOf = (id: string) => (id === me?.id ? me.name : id === opponent?.id ? opponent.name : id)

  // The turn I fired on: no second shot until the next `turn`.
  const [firedOn, setFiredOn] = useState<number | null>(null)
  const [aim, setAim] = useState<Cell | null>(null)

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
  // My newest shot, if it hit, gets the yellow ring until my next shot.
  const myLast = myShots.at(-1)
  const freshHit: Cell | null = myLast?.result === 'hit' ? [myLast.row, myLast.col] : null
  // Only the shooter sees the pop-up; the opponent just sees the hits in the log.
  const myStreak = state.streak?.player === myId ? state.streak : null

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
  useEffect(() => {
    if (!last) return
    if (last.allSunk) playSound(last.by === myId ? 'win' : 'lose')
    else playSound(last.sunk ? 'sunk' : last.result)
  }, [last, myId])

  // Only the shooter hears it, like the pop-up.
  useEffect(() => {
    if (myStreak) playSound('streak')
  }, [myStreak])

  return (
    <main className="game">
      <div className={`banner${(over ? iWon : myTurn) ? '' : ' theirs'}`} role="status">
        {over
          ? iWon
            ? `You sank ${opponentName}'s last ship!`
            : `${opponentName} sank your last ship`
          : myTurn
            ? `Your turn! Pick one slot in ${opponentName}'s waters`
            : `${opponentName}'s turn`}
      </div>
      <p className="auto-note" role="status">
        {last?.auto && (
          <span>
            {nameOf(last.by)} ran out of time — the server fired at {cellName([last.row, last.col])}.
          </span>
        )}
      </p>

      <div className="field2">
        <section className="side">
          <h3>
            Your fleet
            <span className="pill">
              <span className="dot" />
              {SHIP_COUNT - sunkAtMe.length} of {SHIP_COUNT} afloat
            </span>
          </h3>
          <Board label="Your fleet" ships={ownShips} shots={incoming} />
        </section>

        <div className="mid">
          {over ? (
            // Counts down the pause before the Win/Lost screen.
            <Countdown seconds={END_DELAY_MS / 1000} turnNumber={-1} label="results in" />
          ) : (
            turn && <Countdown seconds={turn.seconds} turnNumber={turn.turnNumber} />
          )}
          <div className="card log">
            <h4>Last shots</h4>
            {state.shots.length === 0 && <p className="empty">No shots yet</p>}
            {state.shots
              .slice(-LOG_LENGTH)
              .reverse()
              .map((s) => (
                <p key={`${s.by}-${s.row},${s.col}`}>
                  <span className={`tag ${s.sunk ? 's' : s.result === 'hit' ? 'h' : 'm'}`}>
                    {s.sunk ? 'Sunk' : s.result === 'hit' ? 'Hit' : 'Miss'}
                  </span>
                  {s.auto
                    ? `${nameOf(s.by)} ran out of time → ${cellName([s.row, s.col])}`
                    : s.sunk
                      ? `${nameOf(s.by)} sank ${nameOf(s.target)}'s ship`
                      : `${nameOf(s.by)} → ${cellName([s.row, s.col])}`}
                </p>
              ))}
          </div>
          <StreakLevels />
          <div className="legend">
            <span>
              <i className="sw hit">✕</i>Hit
            </span>
            <span>
              <i className="sw miss" />
              Miss
            </span>
            <span>
              <i className="sw sunk" />
              Sunk ship
            </span>
          </div>
        </div>

        <section className={`side${canFire ? ' active' : ''}`}>
          <h3>
            {opponentName}'s waters
            <span className="pill">
              <span className="dot coral" />
              {SHIP_COUNT - sunkByMe.length} of {SHIP_COUNT} afloat
            </span>
          </h3>
          <Board
            label={`${opponentName}'s waters`}
            enemy
            ships={sunkByMe.map((cells) => ({ cells, sunk: true }))}
            shots={myShots}
            hover={canFire && aim && !alreadyShot.has(`${aim[0]},${aim[1]}`) ? aim : null}
            fresh={freshHit}
            disabled={!canFire}
            canClick={([r, c]) => !alreadyShot.has(`${r},${c}`)}
            onCellClick={fire}
            onCellHover={setAim}
          >
            {/* Over the half of the board away from the newest hit. */}
            <HotStreak streak={myStreak} half={freshHit && freshHit[0] < 4 ? 'bottom' : 'top'} />
          </Board>
        </section>
      </div>
    </main>
  )
}

function sunkShips(shots: Shot[]): Cell[][] {
  return shots.flatMap((s) => (s.sunk && s.sunkCells ? [s.sunkCells] : []))
}
