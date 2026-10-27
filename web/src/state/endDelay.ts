import { useEffect, useState } from 'react'
import type { Screen } from './gameReducer'

/** How long the final board stays up after the winning shot, before Win/Lost. */
export const END_DELAY_MS = 3000

/**
 * The screen to show: `state.screen`, except that going from the game to the
 * end screen waits END_DELAY_MS, so both players see the last ship sink.
 */
export function useEndDelay(screen: Screen): Screen {
  const [prev, setPrev] = useState(screen)
  const [holding, setHolding] = useState(false)
  if (screen !== prev) {
    setPrev(screen)
    setHolding(prev === 'game' && screen === 'end')
  }

  useEffect(() => {
    if (!holding) return
    const timer = setTimeout(() => setHolding(false), END_DELAY_MS)
    return () => clearTimeout(timer)
  }, [holding])

  return holding ? 'game' : screen
}
