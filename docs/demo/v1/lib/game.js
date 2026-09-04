// Pure Battleship rules. No networking here.

const SIZE = 8;
const SHIP_LEN = 4;
const SHIP_COUNT = 4;

// ships: array of SHIP_COUNT ships; each ship = array of SHIP_LEN [r, c] pairs,
// forming a straight, contiguous, non-overlapping line inside the grid.
// Returns an error string, or null if valid.
function validatePlacement(ships) {
  if (!Array.isArray(ships) || ships.length !== SHIP_COUNT) {
    return `Place exactly ${SHIP_COUNT} ships`;
  }
  const used = new Set();
  for (const ship of ships) {
    if (!Array.isArray(ship) || ship.length !== SHIP_LEN) {
      return `Each ship must cover ${SHIP_LEN} slots`;
    }
    const rs = ship.map((c) => c[0]);
    const cs = ship.map((c) => c[1]);
    for (const [r, c] of ship) {
      if (!Number.isInteger(r) || !Number.isInteger(c) ||
          r < 0 || c < 0 || r >= SIZE || c >= SIZE) {
        return 'Ship is out of bounds';
      }
      const key = r + ',' + c;
      if (used.has(key)) return 'Ships overlap';
      used.add(key);
    }
    const sameRow = rs.every((r) => r === rs[0]);
    const sameCol = cs.every((c) => c === cs[0]);
    if (!sameRow && !sameCol) return 'Ship must be a straight line';
    const line = (sameRow ? cs : rs).slice().sort((a, b) => a - b);
    for (let i = 1; i < line.length; i++) {
      if (line[i] !== line[i - 1] + 1) return 'Ship must be contiguous';
    }
  }
  return null;
}

// Build the authoritative board from a validated placement.
function newBoard(ships) {
  const grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
  ships.forEach((ship, idx) => {
    ship.forEach(([r, c]) => { grid[r][c] = idx + 1; }); // 1-based ship id
  });
  return {
    grid,
    shots: Array.from({ length: SIZE }, () => Array(SIZE).fill(false)),
    ships: ships.map((cells) => ({ cells, hits: 0 })),
  };
}

// Apply a shot. Returns { error } OR { result: 'hit'|'miss', sunk, allSunk }.
function fireAt(board, r, c) {
  if (!Number.isInteger(r) || !Number.isInteger(c) ||
      r < 0 || c < 0 || r >= SIZE || c >= SIZE) {
    return { error: 'Target out of range' };
  }
  if (board.shots[r][c]) return { error: 'Slot already fired' };
  board.shots[r][c] = true;

  const shipId = board.grid[r][c];
  if (!shipId) return { result: 'miss', sunk: false, allSunk: false };

  const ship = board.ships[shipId - 1];
  ship.hits += 1;
  const sunk = ship.hits === SHIP_LEN;
  const allSunk = board.ships.every((s) => s.hits === SHIP_LEN);
  return { result: 'hit', sunk, allSunk };
}

// A valid random placement of SHIP_COUNT ships.
function randomShips() {
  for (;;) {
    const ships = [];
    const used = new Set();
    let ok = true;
    for (let n = 0; n < SHIP_COUNT && ok; n++) {
      let placed = false;
      for (let tries = 0; tries < 300 && !placed; tries++) {
        const horiz = Math.random() < 0.5;
        const r = Math.floor(Math.random() * (horiz ? SIZE : SIZE - SHIP_LEN + 1));
        const c = Math.floor(Math.random() * (horiz ? SIZE - SHIP_LEN + 1 : SIZE));
        const cells = [];
        for (let k = 0; k < SHIP_LEN; k++) {
          cells.push(horiz ? [r, c + k] : [r + k, c]);
        }
        if (cells.some(([rr, cc]) => used.has(rr + ',' + cc))) continue;
        cells.forEach(([rr, cc]) => used.add(rr + ',' + cc));
        ships.push(cells);
        placed = true;
      }
      if (!placed) ok = false;
    }
    if (ok) return ships;
  }
}

module.exports = {
  SIZE, SHIP_LEN, SHIP_COUNT,
  validatePlacement, newBoard, fireAt, randomShips,
};
