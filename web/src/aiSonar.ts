import type { Cell } from './protocol'

export type SonarShot = {
  row: number
  col: number
  result: 'hit' | 'miss'
  sunkCells?: Cell[] | null
}

export type SonarRegion = {
  cells: Cell[]
  score: number
}

const GRID = 8

// Same row-major occupancy prior committed in bot/models/global_prior_v2.json.
// The model artifact was trained with sklearn RandomForestClassifier.
const GLOBAL_ML_PRIOR = [
  0.1684999373, 0.2091983645, 0.2569975762, 0.3007249402, 0.3047331876, 0.2471036483, 0.1951961677, 0.1585838379,
  0.2038414010, 0.2208498410, 0.2402087014, 0.2806764692, 0.2797385669, 0.2504951640, 0.2196459975, 0.1954690205,
  0.2423096360, 0.2322375361, 0.2429950800, 0.2691435172, 0.2761806270, 0.2553090208, 0.2386054199, 0.2402615504,
  0.3016196756, 0.2732052141, 0.2703368448, 0.2882934157, 0.2874964282, 0.2788707549, 0.2708026716, 0.2858857431,
  0.3016634243, 0.2786057461, 0.2759574634, 0.2965859137, 0.2933410726, 0.2765164246, 0.2709889727, 0.2822224086,
  0.2553678904, 0.2384151077, 0.2502907619, 0.2755923357, 0.2776215848, 0.2498132688, 0.2396825467, 0.2341080286,
  0.2055294594, 0.2156911553, 0.2357885719, 0.2696755369, 0.2759617070, 0.2411383761, 0.2189015764, 0.1950774314,
  0.1683776171, 0.2080317751, 0.2567838405, 0.3095273890, 0.3109000630, 0.2498919452, 0.2050128113, 0.1531506342,
] as const

const key = ([row, col]: Cell) => `${row},${col}`
const prior = ([row, col]: Cell) => GLOBAL_ML_PRIOR[row * GRID + col]

type ShotSets = {
  attempted: Set<string>
  misses: Set<string>
  sunk: Set<string>
}

function shotSets(shots: readonly SonarShot[]): ShotSets {
  return {
    attempted: new Set(shots.map((shot) => `${shot.row},${shot.col}`)),
    misses: new Set(
      shots.filter((shot) => shot.result === 'miss').map((shot) => `${shot.row},${shot.col}`),
    ),
    sunk: new Set(shots.flatMap((shot) => shot.sunkCells ?? []).map(key)),
  }
}

function isUseful(cells: readonly Cell[], { attempted, misses, sunk }: ShotSets): boolean {
  // Do not highlight cells already proven empty or belonging to a sunk ship.
  if (cells.some((cell) => misses.has(key(cell)) || sunk.has(key(cell)))) return false
  // A region whose every cell was already fired at is exhausted.
  if (cells.every((cell) => attempted.has(key(cell)))) return false
  return true
}

/**
 * True while a Sonar region is still worth showing: no cell is a known miss
 * or part of a sunk ship, and at least one cell has never been fired at.
 * The scan and the on-screen display share this rule.
 */
export function isUsefulRegion(cells: readonly Cell[], shots: readonly SonarShot[]): boolean {
  return isUseful(cells, shotSets(shots))
}

/**
 * Returns up to `count` 2x2 Sonar regions.
 *
 * A previous HIT is allowed inside a region because it is useful evidence.
 * A previous MISS is not useful evidence and is excluded.
 * Most importantly, every returned region must contain at least one cell
 * that has never been fired at, so Sonar can never return an entirely
 * exhausted/useless suggestion.
 */
export function suggestSonarRegions(
  shots: readonly SonarShot[],
  count = 2,
): SonarRegion[] {
  if (count <= 0) return []

  const sets = shotSets(shots)
  const { attempted, sunk } = sets
  const unresolvedHits = new Set(
    shots
      .filter((shot) => shot.result === 'hit' && !sunk.has(`${shot.row},${shot.col}`))
      .map((shot) => `${shot.row},${shot.col}`),
  )

  const candidates: SonarRegion[] = []

  for (let row = 0; row < GRID - 1; row++) {
    for (let col = 0; col < GRID - 1; col++) {
      const cells: Cell[] = [
        [row, col],
        [row + 1, col],
        [row, col + 1],
        [row + 1, col + 1],
      ]

      if (!isUseful(cells, sets)) continue

      const unshot = cells.filter((cell) => !attempted.has(key(cell)))
      const hits = cells.filter((cell) => unresolvedHits.has(key(cell))).length

      // ML prior drives the base score. Existing hits are strong evidence that
      // nearby unshot cells may complete a ship. Regions with more new cells
      // get a small bonus so the scan remains useful.
      const mlScore = unshot.reduce((sum, cell) => sum + prior(cell), 0) / unshot.length
      const score = mlScore + hits * 0.45 + unshot.length * 0.03

      candidates.push({ cells, score })
    }
  }

  candidates.sort((a, b) => b.score - a.score)

  const chosen: SonarRegion[] = []
  for (const candidate of candidates) {
    // Keep the two signals visually distinct when possible.
    if (chosen.some((region) =>
      candidate.cells.some((cell) => region.cells.some((other) => key(cell) === key(other))),
    )) continue
    chosen.push(candidate)
    if (chosen.length === count) break
  }

  // Late in a match there may be no two non-overlapping candidates left.
  if (chosen.length < count) {
    for (const candidate of candidates) {
      if (chosen.includes(candidate)) continue
      chosen.push(candidate)
      if (chosen.length === count) break
    }
  }

  return chosen
}
