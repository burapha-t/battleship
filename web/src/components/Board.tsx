// The 8×8 grid shared by the placement and game screens. It draws what it is
// given and reports clicks and hovers; it holds no game logic. Labels are
// display only (A–H, 1–8); every callback uses the wire's 0-based [row, col].

import type { CSSProperties } from 'react'
import { GRID_SIZE, cellName, colName } from '../placement'
import type { Cell } from '../protocol'
import './Board.css'

export type BoardShip = {
  cells: Cell[]
  color?: string
  sunk?: boolean
  /** A preview that hasn't been placed yet. */
  ghost?: boolean
  /** A ghost that can't be dropped where it is. */
  blocked?: boolean
}

export type BoardShot = { row: number; col: number; result: 'hit' | 'miss' }

type Props = {
  label: string
  ships?: BoardShip[]
  shots?: BoardShot[]
  /** Optional AI sonar cells. Display only; they do not alter game logic. */
  signals?: Cell[]
  /** Draws the aim marker on this cell. */
  hover?: Cell | null
  /** Darker water for the opponent's board. */
  enemy?: boolean
  /** No cell is clickable. */
  disabled?: boolean
  /** Which cells are clickable when the board isn't disabled (default: all). */
  canClick?: (cell: Cell) => boolean
  onCellClick?: (cell: Cell) => void
  onCellHover?: (cell: Cell | null) => void
}

const LINES = Array.from({ length: GRID_SIZE }, (_, i) => i)
const tracks = `repeat(${GRID_SIZE}, var(--cell))`

const at = (row: number, col: number): CSSProperties => ({ gridRow: row + 1, gridColumn: col + 1 })

export function Board({
  label,
  ships = [],
  shots = [],
  signals = [],
  hover = null,
  enemy = false,
  disabled = false,
  canClick,
  onCellClick,
  onCellHover,
}: Props) {
  const shotAt = new Map(shots.map((s) => [`${s.row},${s.col}`, s.result]))
  const shipAt = new Map(ships.filter((s) => !s.ghost).flatMap((s) => s.cells.map((c) => [`${c[0]},${c[1]}`, s])))

  return (
    <div className={`board${enemy ? ' enemy' : ''}`} role="group" aria-label={label}>
      <div className="board-cols" style={{ gridTemplateColumns: tracks }} aria-hidden>
        {LINES.map((i) => <span key={i}>{colName(i)}</span>)}
      </div>
      <div className="board-rows" style={{ gridTemplateRows: tracks }} aria-hidden>
        {LINES.map((i) => <span key={i}>{i + 1}</span>)}
      </div>
      <div
        className="water"
        style={{ gridTemplateColumns: tracks, gridTemplateRows: tracks }}
        onMouseLeave={() => onCellHover?.(null)}
      >
        {LINES.flatMap((row) =>
          LINES.map((col) => {
            const cell: Cell = [row, col]
            const key = `${row},${col}`
            const clickable = !disabled && onCellClick !== undefined && (canClick?.(cell) ?? true)
            const ship = shipAt.get(key)
            const shot = shotAt.get(key)
            const state = [ship && (ship.sunk ? 'sunk ship' : 'ship'), shot].filter(Boolean).join(', ')
            return (
              <button
                key={key}
                type="button"
                className="cell"
                style={at(row, col)}
                disabled={!clickable}
                aria-label={state ? `${cellName(cell)}, ${state}` : cellName(cell)}
                onClick={() => onCellClick?.(cell)}
                onMouseEnter={() => onCellHover?.(cell)}
                onFocus={() => onCellHover?.(cell)}
              />
            )
          }),
        )}
        {signals.map(([row, col]) => (
          <div key={`signal-${row},${col}`} className="mark sonar-signal" style={at(row, col)} aria-hidden>
            <b>?</b>
          </div>
        ))}
        {ships.map((ship, i) => <ShipHull key={i} ship={ship} />)}
        {shots.map((s) => (
          <div key={`${s.row},${s.col}`} className={`mark ${s.result}`} style={at(s.row, s.col)} aria-hidden>
            <b>{s.result === 'hit' ? '✕' : ''}</b>
          </div>
        ))}
        {hover && (
          <div className="mark aim" style={at(hover[0], hover[1])} aria-hidden>
            <b />
          </div>
        )}
      </div>
    </div>
  )
}

function ShipHull({ ship }: { ship: BoardShip }) {
  const rows = ship.cells.map((c) => c[0])
  const cols = ship.cells.map((c) => c[1])
  const [top, bottom, left, right] = [Math.min(...rows), Math.max(...rows), Math.min(...cols), Math.max(...cols)]
  const classes = ['ship', bottom > top ? 'v' : 'h', ship.sunk && 'sunk', ship.ghost && 'ghost', ship.blocked && 'blocked']
  return (
    <div
      className={classes.filter(Boolean).join(' ')}
      style={{ gridRow: `${top + 1} / ${bottom + 2}`, gridColumn: `${left + 1} / ${right + 2}`, backgroundColor: ship.color }}
      aria-hidden
    >
      {ship.cells.map((_, i) => <i key={i} />)}
    </div>
  )
}
