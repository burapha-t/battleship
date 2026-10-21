import { useTranslation } from '../useTranslation'
// Dev page at ?preview=board: every cell state from mock data, and a board
// that reports the [row, col] of each click. No server needed.

import { useState } from 'react'
import { Board } from '../components/Board'
import type { BoardShip, BoardShot } from '../components/Board'
import { cellName } from '../placement'
import type { Cell } from '../protocol'
import '../screens/screens.css'

const ownShips: BoardShip[] = [
  { cells: [[0, 1], [0, 2], [0, 3], [0, 4]], color: 'var(--ship-1)' },
  { cells: [[2, 6], [3, 6], [4, 6], [5, 6]], color: 'var(--ship-2)' },
  { cells: [[4, 0], [5, 0], [6, 0], [7, 0]], color: 'var(--ship-3)', sunk: true },
  { cells: [[7, 3], [7, 4], [7, 5], [7, 6]], color: 'var(--ship-4)' },
]

const ownShots: BoardShot[] = [
  { row: 0, col: 2, result: 'hit' },
  { row: 0, col: 3, result: 'hit' },
  { row: 4, col: 0, result: 'hit' },
  { row: 5, col: 0, result: 'hit' },
  { row: 6, col: 0, result: 'hit' },
  { row: 7, col: 0, result: 'hit' },
  { row: 1, col: 4, result: 'miss' },
  { row: 3, col: 2, result: 'miss' },
  { row: 6, col: 5, result: 'miss' },
]

const placing: BoardShip[] = [
  { cells: [[1, 1], [1, 2], [1, 3], [1, 4]], color: 'var(--ship-1)' },
  { cells: [[3, 6], [4, 6], [5, 6], [6, 6]], color: 'var(--ship-2)' },
  { cells: [[4, 0], [4, 1], [4, 2], [4, 3]], color: 'var(--ship-3)', ghost: true },
  { cells: [[5, 4], [5, 5], [5, 6], [5, 7]], color: 'var(--ship-4)', ghost: true, blocked: true },
]

export function BoardPreview() {
  const { t } = useTranslation('preview')
  const [shots, setShots] = useState<BoardShot[]>([
    { row: 1, col: 1, result: 'hit' },
    { row: 1, col: 2, result: 'hit' },
    { row: 1, col: 3, result: 'hit' },
    { row: 1, col: 4, result: 'hit' },
    { row: 5, col: 5, result: 'hit' },
    { row: 3, col: 3, result: 'miss' },
  ])
  const [hover, setHover] = useState<Cell | null>([6, 2])
  const [clicked, setClicked] = useState<Cell | null>(null)
  const shot = new Set(shots.map((s) => `${s.row},${s.col}`))

  const click = (cell: Cell) => {
    setClicked(cell)
    // Mock data only: alternate hit and miss.
    setShots([...shots, { row: cell[0], col: cell[1], result: shots.length % 2 ? 'hit' : 'miss' }])
  }

  return (
    <div className="app preview">
      <header className="header">
        <div className="logo">
          {t('board')}
        </div>
      </header>
      <p>
        {t('hint')}
      </p>
      <div className="preview-grid">
        <figure>
          <figcaption>{t('ownCaption')}</figcaption>
          <Board label={t('own')} ships={ownShips} shots={ownShots} />
        </figure>
        <figure>
          <figcaption>
            {t('targetCaption')}{' '}
            <output>{clicked ? t('clicked', { row: clicked[0], col: clicked[1], cell: cellName(clicked) }) : t('notClicked')}</output>
          </figcaption>
          <Board
            label={t('target')}
            enemy
            ships={[{ cells: [[1, 1], [1, 2], [1, 3], [1, 4]], sunk: true }]}
            shots={shots}
            hover={hover && !shot.has(`${hover[0]},${hover[1]}`) ? hover : null}
            canClick={([r, c]) => !shot.has(`${r},${c}`)}
            onCellClick={click}
            onCellHover={setHover}
          />
        </figure>
        <figure>
          <figcaption>{t('placementCaption')}</figcaption>
          <Board label={t('placement')} ships={placing} disabled />
        </figure>
      </div>
    </div>
  )
}
