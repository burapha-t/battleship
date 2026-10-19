import { useEffect, useState } from 'react'
import { Avatar } from '../components/Avatar'
import { Board } from '../components/Board'
import type { BoardShip } from '../components/Board'
import { matchSides } from '../gameReducer'
import type { GameState } from '../gameReducer'
import { GRID_SIZE, SHIP_COUNT, SHIP_LENGTH, randomPlacement, shipAt, validatePlacement } from '../placement'
import type { Cell } from '../protocol'
import { SHIP_COLORS } from './shipColors'
import './screens.css'

type Slots = (Cell[] | null)[]

const EMPTY: Slots = Array.from({ length: SHIP_COUNT }, () => null)
const sameCell = (a: Cell, b: Cell) => a[0] === b[0] && a[1] === b[1]
const isHorizontal = (ship: Cell[]) => ship.every((c) => c[0] === ship[0][0])

type Props = { state: GameState; onReady: (ships: Cell[][]) => void }

/**
 * Place 4 ships of 4: click the grid to drop the ship in hand, click a placed
 * ship (or its row in the fleet list) to pick it up again, R rotates.
 */
export function PlacementScreen({ state, onReady }: Props) {
  const { opponent } = matchSides(state)
  const opponentName = opponent?.name ?? 'Your opponent'

  const [ships, setShips] = useState<Slots>(EMPTY)
  const [held, setHeld] = useState<number | null>(0)
  const [horizontal, setHorizontal] = useState(true)
  const [hover, setHover] = useState<Cell | null>(null)
  // The lastError when I pressed Ready: until it changes, `place` is in flight.
  const [sentWith, setSentWith] = useState<GameState['lastError'] | undefined>(undefined)

  const iPlaced = state.myId !== null && state.placed.includes(state.myId)
  const opponentPlaced = opponent !== undefined && state.placed.includes(opponent.id)
  const pending = sentWith !== undefined && state.lastError === sentWith && !iPlaced
  const serverError =
    sentWith !== undefined && state.lastError !== sentWith && state.lastError?.code === 'invalid-placement'
      ? state.lastError.message
      : null
  const locked = iPlaced || pending

  const placedCount = ships.filter(Boolean).length
  const problem = placedCount === SHIP_COUNT ? validatePlacement(ships) : null
  const canReady = !locked && placedCount === SHIP_COUNT && problem === null

  // The ship in hand follows the pointer, shifted back so it stays on the grid.
  const ghost =
    !locked && held !== null && hover
      ? shipAt(
          horizontal
            ? [hover[0], Math.min(hover[1], GRID_SIZE - SHIP_LENGTH)]
            : [Math.min(hover[0], GRID_SIZE - SHIP_LENGTH), hover[1]],
          horizontal,
        )
      : null
  const blocked = ghost !== null && ghost.some((g) => ships.some((s) => s?.some((c) => sameCell(c, g))))

  const pickUp = (index: number) => {
    const ship = ships[index]
    if (ship) {
      setShips(ships.map((s, i) => (i === index ? null : s)))
      setHorizontal(isHorizontal(ship))
    }
    setHeld(index)
  }

  const clickCell = (cell: Cell) => {
    const under = ships.findIndex((s) => s?.some((c) => sameCell(c, cell)))
    if (under >= 0) return pickUp(under)
    if (held === null || !ghost || blocked) return
    const next = ships.map((s, i) => (i === held ? ghost : s))
    setShips(next)
    const empty = next.findIndex((s) => s === null)
    setHeld(empty >= 0 ? empty : null)
  }

  const rotate = () => setHorizontal((h) => !h)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'r' || e.key === 'R') && !e.ctrlKey && !e.metaKey && !e.altKey) setHorizontal((h) => !h)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const shuffle = () => {
    setShips(randomPlacement())
    setHeld(null)
  }

  const clear = () => {
    setShips(EMPTY)
    setHeld(0)
    setHorizontal(true)
  }

  const ready = () => {
    setSentWith(state.lastError)
    onReady(ships.filter((s): s is Cell[] => s !== null))
  }

  // Once placed, draw the fleet the server accepted.
  const shown: Slots = iPlaced && state.myShips ? state.myShips : ships
  const boardShips: BoardShip[] = shown.flatMap((cells, i) => (cells ? [{ cells, color: SHIP_COLORS[i] }] : []))
  if (ghost && held !== null) boardShips.push({ cells: ghost, color: SHIP_COLORS[held], ghost: true, blocked })

  const remaining = SHIP_COUNT - placedCount
  const readyLabel = iPlaced
    ? `Waiting for ${opponentName}…`
    : pending
      ? 'Sending…'
      : remaining > 0
        ? `Place ${remaining} more ship${remaining === 1 ? '' : 's'}`
        : problem
          ? 'Fix your fleet'
          : 'Ready!'

  return (
    <main className="placement">
      <h1 className="title">Place your ships</h1>
      <p className="sub">
        Place your 4 ships on your grid. Each ship fills 4 slots in a straight line. {opponentName} can't see where
        you put them.
      </p>
      <div className="placement-lay">
        <div>
          <Board
            label="Your grid"
            ships={boardShips}
            disabled={locked}
            onCellClick={clickCell}
            onCellHover={setHover}
          />
          <p className="board-hint">
            {iPlaced
              ? 'Your fleet is locked in.'
              : held !== null
                ? `Click the grid to drop Ship ${held + 1} · R rotates · click a placed ship to move it`
                : 'Click a placed ship to move it'}
          </p>
        </div>

        <div className="placement-side">
          <div className="card panel">
            <h3>Your fleet</h3>
            <ul className="fleet">
              {shown.map((ship, i) => {
                const inHand = !iPlaced && held === i
                return (
                  <li key={i}>
                    <button
                      type="button"
                      className={`fl${ship ? ' done' : ''}${inHand ? ' now' : ''}`}
                      disabled={locked}
                      onClick={() => pickUp(i)}
                    >
                      <span className="mini" style={{ background: SHIP_COLORS[i] }}>
                        <i />
                        <i />
                        <i />
                        <i />
                      </span>
                      Ship {i + 1}
                      <span className="st">{ship ? '✓ Placed' : inHand ? `Placing… ${horizontal ? '↔' : '↕'}` : 'Not placed'}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
            <div className="tools">
              <button type="button" className="btn white small" onClick={rotate} disabled={locked || held === null}>
                ↻ Rotate
              </button>
              <button type="button" className="btn white small" onClick={shuffle} disabled={locked}>
                Shuffle
              </button>
              <button type="button" className="btn white small" onClick={clear} disabled={locked}>
                Clear
              </button>
            </div>
            <button type="button" className={`btn wide${iPlaced ? ' pressed' : ''}`} disabled={!canReady} onClick={ready}>
              {readyLabel}
            </button>
            {(serverError ?? problem) && (
              <p className="field-error" role="alert">
                {serverError ?? problem}
              </p>
            )}
          </div>

          <div className="card opp">
            <Avatar name={opponentName} color="var(--lilac)" />
            <div>
              <b>{opponentPlaced ? `${opponentName} is ready!` : `${opponentName} is placing ships`}</b>
              <span>The match starts when you're both ready</span>
            </div>
            <span className={`dot ${opponentPlaced ? '' : 'sun'}`} />
          </div>
        </div>
      </div>
    </main>
  )
}
