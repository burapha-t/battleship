import type { Cell } from './protocol'

const AI_BASE = 'http://127.0.0.1:8091'

type ShotLike = { row: number; col: number; result: 'hit' | 'miss' }

export type SonarSignal = {
  cells: Cell[]
  confidence: number
}

export type SonarResponse = {
  signals: SonarSignal[]
  trainingMatches: number
  mode: 'personalized' | 'cold-start'
}

export async function saveMatchHistory(input: {
  playerName: string
  matchId: string
  ships: Cell[][]
  shots: ShotLike[]
  won: boolean
}): Promise<void> {
  const response = await fetch(`${AI_BASE}/history`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!response.ok) throw new Error('AI history service is unavailable')
}

export async function scanSonar(shots: ShotLike[]): Promise<SonarResponse> {
  const response = await fetch(`${AI_BASE}/sonar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ shots }),
  })
  if (!response.ok) throw new Error('AI Sonar is unavailable')
  return (await response.json()) as SonarResponse
}
