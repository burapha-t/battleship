import type { Cell } from './protocol'

// The browser always talks to its own Battleship.Client.
// The C# client proxies Sonar/history to the local Python AI helper.
// This avoids hard-coding 127.0.0.1:8091 in the browser and works the same
// whether the game server is on this laptop or another laptop.
const AI_BASE = '/api/ai'

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

export type GhostStatus = {
  running: boolean
  ghostOf: string | null
  message: string
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

export async function getGhostStatus(): Promise<GhostStatus> {
  const response = await fetch('/api/ghost/status')
  if (!response.ok) throw new Error('Ghost Fleet status is unavailable')
  return (await response.json()) as GhostStatus
}

export async function startGhostFleet(ghostOf: string): Promise<GhostStatus> {
  const response = await fetch('/api/ghost/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ghostOf }),
  })
  const status = (await response.json()) as GhostStatus
  if (!response.ok) throw new Error(status.message || 'Could not start Ghost Fleet')
  return status
}

export async function stopGhostFleet(): Promise<GhostStatus> {
  const response = await fetch('/api/ghost/stop', { method: 'POST' })
  if (!response.ok) throw new Error('Could not stop Ghost Fleet')
  return (await response.json()) as GhostStatus
}
