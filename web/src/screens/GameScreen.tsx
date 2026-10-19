import { usePreferences } from '../preferences'
import { useEffect, useState } from 'react'
import { Avatar } from '../components/Avatar'
import { DesignIcon } from '../components/DesignIcon'
import { Board } from '../components/Board'
import type { BoardShip } from '../components/Board'
import { Countdown } from '../components/Countdown'
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
  const { t } = usePreferences()
  const { me, opponent } = matchSides(state)
  const myId = state.myId
  const opponentName = opponent?.name ?? t('Your opponent', 'คู่แข่งของคุณ')
  const nameOf = (id: string) => (id === me?.id ? me.name : id === opponent?.id ? opponent.name : id)

  // The turn I fired on: no second shot until the next `turn`.
  const [firedOn, setFiredOn] = useState<number | null>(null)
  const [aim, setAim] = useState<Cell | null>(null)

  const turn = state.turn
  const myTurn = turn !== null && turn.activePlayerId === myId
  const canFire = myTurn && firedOn !== turn.turnNumber

  const myShots = state.shots.filter((s) => s.by === myId)
  const incoming = state.shots.filter((s) => s.target === myId)
  const sunkByMe = sunkShips(myShots)
  const sunkAtMe = sunkShips(incoming)
  const alreadyShot = new Set(myShots.map((s) => `${s.row},${s.col}`))

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

  return (
    <main className="game">
      <div className="game-hud">
        <div className={`card game-player${myTurn ? ' turn' : ''}`}><Avatar name={me?.name ?? ''} color="var(--sun)" /><div className="game-player-name">{me?.name}<small>{t('You', 'คุณ')}</small></div><b className="game-player-score">{me?.score ?? 0}</b></div>
        {turn && <Countdown seconds={turn.seconds} turnNumber={turn.turnNumber} />}
        <div className={`card game-player opponent${!myTurn ? ' turn' : ''}`}><Avatar name={opponentName} color="var(--lilac)" /><div className="game-player-name">{opponentName}<small>{t('Opponent', 'คู่แข่ง')}</small></div><b className="game-player-score">{opponent?.score ?? 0}</b></div>
      </div>
      <div className={`banner${myTurn ? '' : ' theirs'}`} role="status">
        {myTurn ? t(`Your turn! Pick one slot in ${opponentName}'s waters`, `ตาคุณ! เลือกยิงหนึ่งช่องในน่านน้ำของ ${opponentName}`) : t(`${opponentName}'s turn`, `ตาของ ${opponentName}`)}
      </div>
      <p className="auto-note" role="status">
        {last?.auto && (
          <span>
            {t(`${nameOf(last.by)} ran out of time — the server fired at ${cellName([last.row, last.col])}.`, `${nameOf(last.by)} หมดเวลา — เซิร์ฟเวอร์ยิงที่ ${cellName([last.row, last.col])}`)}
          </span>
        )}
      </p>

      <div className="field2">
        <section className="side">
          <h3>
            {t('Your fleet', 'กองเรือของคุณ')}
            <span className="pill">
              <span className="dot" />
              {t(`${SHIP_COUNT - sunkAtMe.length} of ${SHIP_COUNT} afloat`, `เหลือ ${SHIP_COUNT - sunkAtMe.length} จาก ${SHIP_COUNT} ลำ`)}
            </span>
          </h3>
          <Board label={t('Your fleet', 'กองเรือของคุณ')} ships={ownShips} shots={incoming} />
        </section>

        <div className="mid">
          <div className="card log">
            <h4>{t('Last shots', 'การยิงล่าสุด')}</h4>
            {state.shots.length === 0 && <p className="empty">{t('No shots yet', 'ยังไม่มีการยิง')}</p>}
            {state.shots
              .slice(-LOG_LENGTH)
              .reverse()
              .map((s) => (
                <p key={`${s.by}-${s.row},${s.col}`}>
                  <span className={`tag ${s.sunk ? 's' : s.result === 'hit' ? 'h' : 'm'}`}>
                    {s.sunk ? t('Sunk', 'จม') : s.result === 'hit' ? t('Hit', 'โดน') : t('Miss', 'พลาด')}
                  </span>
                  {s.auto
                    ? t(`${nameOf(s.by)} ran out of time → ${cellName([s.row, s.col])}`, `${nameOf(s.by)} หมดเวลา → ${cellName([s.row, s.col])}`)
                    : s.sunk
                      ? t(`${nameOf(s.by)} sank ${nameOf(s.target)}'s ship`, `${nameOf(s.by)} จมเรือของ ${nameOf(s.target)}`)
                      : `${nameOf(s.by)} → ${cellName([s.row, s.col])}`}
                </p>
              ))}
          </div>
          <div className="card streak-levels"><h4>{t('Hot streak', 'ยิงโดนต่อเนื่อง')}</h4><p>{t('Keep landing hits! A miss resets your streak.', 'ยิงให้โดนต่อเนื่อง! ยิงพลาดจะเริ่มนับใหม่')}</p>{[2,3,4].map(level => <div key={level}><span>{t(level === 4 ? '4 or more' : `${level} hits in a row`, level === 4 ? '4 ครั้งขึ้นไป' : `โดนต่อเนื่อง ${level} ครั้ง`)}</span><b><DesignIcon name="fire" />×{level}</b></div>)}</div>
          <div className="legend">
            <span>
              <i className="sw hit">✕</i>{t('Hit', 'โดน')}
            </span>
            <span>
              <i className="sw miss" />
              {t('Miss', 'พลาด')}
            </span>
            <span>
              <i className="sw sunk" />
              {t('Sunk ship', 'เรือจม')}
            </span>
          </div>
        </div>

        <section className={`side${canFire ? ' active' : ''}`}>
          <h3>
            {t(`${opponentName}'s waters`, `น่านน้ำของ ${opponentName}`)}
            <span className="pill">
              <span className="dot coral" />
              {t(`${SHIP_COUNT - sunkByMe.length} of ${SHIP_COUNT} afloat`, `เหลือ ${SHIP_COUNT - sunkByMe.length} จาก ${SHIP_COUNT} ลำ`)}
            </span>
          </h3>
          <Board
            label={t(`${opponentName}'s waters`, `น่านน้ำของ ${opponentName}`)}
            enemy
            ships={sunkByMe.map((cells) => ({ cells, sunk: true }))}
            shots={myShots}
            hover={canFire && aim && !alreadyShot.has(`${aim[0]},${aim[1]}`) ? aim : null}
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
